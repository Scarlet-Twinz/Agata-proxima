use axum::{
    extract::{Query, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::{Html, IntoResponse, Response},
    Json,
};
use hmac::{Hmac, Mac};
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use jsonwebtoken::jwk::JwkSet;
use reqwest::Client;
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::Sha256;
use sqlx::Row;
use std::env;
use uuid::Uuid;

use super::{
    audit, authenticate, bad, create_session, db_error, hash_password, internal, require_write, token_hash,
    AppState,
};

type HmacSha256 = Hmac<Sha256>;

#[derive(Deserialize)]
pub(crate) struct CheckoutInput {
    pub price_id: Option<String>,
}

#[derive(Deserialize)]
pub(crate) struct InviteInput {
    pub organization_id: Uuid,
    pub email: String,
    pub role: Option<String>,
}

#[derive(Deserialize)]
pub(crate) struct VerifyInput {
    pub token: String,
}

#[derive(Deserialize)]
pub(crate) struct OidcConfigureInput {
    pub tenant_id: String,
    pub jit_provisioning: Option<bool>,
}

#[derive(Deserialize)]
pub(crate) struct OidcCallbackQuery {
    code: String,
    state: String,
}

#[derive(Deserialize)]
struct OidcClaims {
    sub: String,
    tid: String,
    iss: String,
    aud: String,
    nonce: String,
    oid: Option<String>,
    email: Option<String>,
    preferred_username: Option<String>,
    name: Option<String>,
}

#[derive(Deserialize)]
pub(crate) struct PasswordResetRequest {
    pub email: String,
}

#[derive(Deserialize)]
pub(crate) struct PasswordResetConfirm {
    pub token: String,
    pub password: String,
}
fn plan_for_price(price_id: Option<&str>) -> Option<&'static str> {
    let starter = env::var("AGATA_STRIPE_STARTER_PRICE_ID").ok();
    let growth = env::var("AGATA_STRIPE_GROWTH_PRICE_ID").ok();
    let scale = env::var("AGATA_STRIPE_SCALE_PRICE_ID").ok();

    match price_id {
        Some(id) if starter.as_deref() == Some(id) => Some("starter"),
        Some(id) if growth.as_deref() == Some(id) => Some("growth"),
        Some(id) if scale.as_deref() == Some(id) => Some("scale"),
        _ => None,
    }
}

fn plan_limits(plan: &str) -> (i32, i32, i32, i32, bool, bool, bool, bool, bool) {
    match plan {
        "starter" => (2, 25, 2, 30, false, true, false, false, false),
        "growth" => (5, 100, 5, 180, true, true, true, true, false),
        "scale" => (15, 500, 50, 365, true, true, true, true, true),
        "enterprise" => (i32::MAX, i32::MAX, i32::MAX, 3650, true, true, true, true, true),
        _ => (1, 3, 1, 7, false, false, false, false, false),
    }
}

#[allow(clippy::result_large_err)]
pub(crate) async fn enforce_capacity(
    db: &sqlx::PgPool,
    organization_id: Uuid,
    resource: &str,
) -> Result<(), Response> {
    let row = sqlx::query(
        "SELECT node_limit,tenant_limit,environment_limit,billing_status,plan_key
         FROM organization_entitlements WHERE organization_id=$1",
    )
    .bind(organization_id)
    .fetch_optional(db)
    .await
    .map_err(db_error)?;

    let row = row.ok_or_else(|| service_unavailable("Organization entitlements are not initialized."))?;
    let status: String = row.get("billing_status");
    if matches!(status.as_str(), "canceled" | "unpaid") {
        return Err((
            StatusCode::PAYMENT_REQUIRED,
            Json(json!({"ok":false,"error":"subscription_inactive","message":"Restore an active Agata Proxima subscription to use this capacity."}))
        ).into_response());
    }

    let (limit_column, count_sql) = match resource {
        "tenants" => ("tenant_limit", "SELECT count(*) FROM tenants t JOIN projects p ON p.id=t.project_id WHERE p.organization_id=$1"),
        "nodes" => ("node_limit", "SELECT count(*) FROM nodes WHERE organization_id=$1"),
        _ => return Ok(()),
    };
    let limit: i32 = row.get(limit_column);
    let count: i64 = sqlx::query_scalar(count_sql).bind(organization_id).fetch_one(db).await.map_err(db_error)?;
    if count >= i64::from(limit) {
        let plan: String = row.get("plan_key");
        return Err((
            StatusCode::PAYMENT_REQUIRED,
            Json(json!({"ok":false,"error":"plan_limit_reached","resource":resource,"limit":limit,"plan":plan,"message":"Plan capacity reached. Upgrade the Agata Proxima plan to continue."}))
        ).into_response());
    }
    Ok(())
}

#[allow(clippy::result_large_err)]
pub(crate) async fn enforce_environment_capacity(
    db: &sqlx::PgPool,
    organization_id: Uuid,
    environment: &str,
) -> Result<(), Response> {
    let row = sqlx::query(
        "SELECT environment_limit,billing_status,plan_key
         FROM organization_entitlements WHERE organization_id=$1",
    )
    .bind(organization_id)
    .fetch_optional(db)
    .await
    .map_err(db_error)?;

    let row = row.ok_or_else(|| service_unavailable("Organization entitlements are not initialized."))?;
    let status: String = row.get("billing_status");
    if matches!(status.as_str(), "canceled" | "unpaid") {
        return Err((
            StatusCode::PAYMENT_REQUIRED,
            Json(json!({"ok":false,"error":"subscription_inactive","message":"Restore an active Agata Proxima subscription to use this capacity."}))
        ).into_response());
    }

    let limit: i32 = row.get("environment_limit");
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(
            SELECT 1 FROM nodes WHERE organization_id=$1 AND environment=$2
        )",
    )
    .bind(organization_id)
    .bind(environment)
    .fetch_one(db)
    .await
    .map_err(db_error)?;

    if exists {
        return Ok(());
    }

    let count: i64 = sqlx::query_scalar(
        "SELECT count(DISTINCT environment) FROM nodes WHERE organization_id=$1",
    )
    .bind(organization_id)
    .fetch_one(db)
    .await
    .map_err(db_error)?;

    if count >= i64::from(limit) {
        let plan: String = row.get("plan_key");
        return Err((
            StatusCode::PAYMENT_REQUIRED,
            Json(json!({
                "ok":false,
                "error":"plan_limit_reached",
                "resource":"environments",
                "limit":limit,
                "plan":plan,
                "message":"Environment capacity reached. Upgrade the Agata Proxima plan to continue."
            }))
        ).into_response());
    }

    Ok(())
}

#[allow(clippy::result_large_err)]
pub(crate) async fn require_feature(
    db: &sqlx::PgPool,
    organization_id: Uuid,
    feature: &str,
) -> Result<(), Response> {
    let row = sqlx::query(
        "SELECT billing_status,plan_key,advanced_verification,fleet_controls,priority_support,entra_oidc,private_deployment
         FROM organization_entitlements WHERE organization_id=$1",
    )
    .bind(organization_id)
    .fetch_optional(db)
    .await
    .map_err(db_error)?;

    let row = row.ok_or_else(|| service_unavailable("Organization entitlements are not initialized."))?;
    let status: String = row.get("billing_status");
    if matches!(status.as_str(), "canceled" | "unpaid") {
        return Err((StatusCode::PAYMENT_REQUIRED, Json(json!({
            "ok":false,"error":"subscription_inactive","message":"This organization does not have an active subscription."
        }))).into_response());
    }

    let enabled: bool = match feature {
        "advanced_verification" => row.get("advanced_verification"),
        "fleet_controls" => row.get("fleet_controls"),
        "priority_support" => row.get("priority_support"),
        "entra_oidc" => row.get("entra_oidc"),
        "private_deployment" => row.get("private_deployment"),
        // Policy authoring is a management capability and starts at Starter.
        "policy_management" => row.get::<String, _>("plan_key") != "free",
        _ => return Ok(()),
    };
    if !enabled {
        let plan: String = row.get("plan_key");
        return Err((StatusCode::FORBIDDEN, Json(json!({
            "ok":false,"error":"feature_not_in_plan","feature":feature,"plan":plan,
            "message":"This capability is not included in the current Agata Proxima plan."
        }))).into_response());
    }
    Ok(())
}

pub(crate) async fn plans() -> Response {
    let catalog = [
        ("free", "Free", 0_i32, "Evaluation and small proofs of concept", "AGATA_STRIPE_FREE_PRICE_ID"),
        ("starter", "Starter", 149_i32, "First production SaaS deployments", "AGATA_STRIPE_STARTER_PRICE_ID"),
        ("growth", "Growth", 499_i32, "Multi-tenant production workloads", "AGATA_STRIPE_GROWTH_PRICE_ID"),
        ("scale", "Scale", 1199_i32, "Larger fleets and security operations", "AGATA_STRIPE_SCALE_PRICE_ID"),
        ("enterprise", "Enterprise", 0_i32, "Contracted enterprise deployments", ""),
    ];

    let plans = catalog.iter().map(|(key, name, monthly_usd, description, env_name)| {
        let price_id = if env_name.is_empty() {
            None
        } else {
            env::var(env_name).ok().filter(|v| !v.trim().is_empty())
        };
        let (nodes, tenants, environments, retention, advanced, fleet, priority, entra, private_deployment) =
            plan_limits(key);
        json!({
            "key": key,
            "name": name,
            "monthly_usd": monthly_usd,
            "description": description,
            "price_id": price_id,
            "checkout_available": key != &"free" && key != &"enterprise" && price_id.is_some(),
            "limits": {
                "nodes": nodes,
                "tenants": tenants,
                "environments": environments,
                "audit_retention_days": retention
            },
            "features": {
                "advanced_verification": advanced,
                "fleet_controls": fleet,
                "priority_support": priority,
                "entra_oidc": entra,
                "private_deployment": private_deployment,
                "policy_management": key != &"free"
            }
        })
    }).collect::<Vec<_>>();

    Json(json!({ "currency": "usd", "billing_interval": "month", "plans": plans })).into_response()
}

pub(crate) async fn entitlements(State(s): State<AppState>, headers: HeaderMap) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    match sqlx::query(
        "SELECT plan_key,billing_status,node_limit,tenant_limit,environment_limit,
                audit_retention_days,advanced_verification,fleet_controls,priority_support,
                entra_oidc,private_deployment,updated_at
         FROM organization_entitlements WHERE organization_id=$1",
    )
    .bind(ctx.organization_id)
    .fetch_optional(&s.db)
    .await
    {
        Ok(Some(row)) => Json(json!({
            "plan": row.get::<String,_>("plan_key"),
            "billing_status": row.get::<String,_>("billing_status"),
            "limits": {
                "nodes": row.get::<i32,_>("node_limit"),
                "tenants": row.get::<i32,_>("tenant_limit"),
                "environments": row.get::<i32,_>("environment_limit"),
                "audit_retention_days": row.get::<i32,_>("audit_retention_days")
            },
            "features": {
                "advanced_verification": row.get::<bool,_>("advanced_verification"),
                "fleet_controls": row.get::<bool,_>("fleet_controls"),
                "priority_support": row.get::<bool,_>("priority_support"),
                "entra_oidc": row.get::<bool,_>("entra_oidc"),
                "private_deployment": row.get::<bool,_>("private_deployment"),
                "policy_management": row.get::<String,_>("plan_key") != "free"
            }
        })).into_response(),
        Ok(None) => service_unavailable("Organization entitlements are not initialized."),
        Err(e) => db_error(e),
    }
}

async fn apply_entitlements(db: &sqlx::PgPool, organization_id: Uuid, plan: &str) -> Result<(), sqlx::Error> {
    let (nodes, tenants, environments, retention, advanced, fleet, priority, entra, private_deployment) = plan_limits(plan);
    sqlx::query(
        "INSERT INTO organization_entitlements
            (organization_id,plan_key,billing_status,node_limit,tenant_limit,environment_limit,
             audit_retention_days,advanced_verification,fleet_controls,priority_support,entra_oidc,
             private_deployment,updated_at)
         VALUES($1,$2,'active',$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
         ON CONFLICT (organization_id) DO UPDATE SET
            plan_key=EXCLUDED.plan_key,billing_status=EXCLUDED.billing_status,
            node_limit=EXCLUDED.node_limit,tenant_limit=EXCLUDED.tenant_limit,
            environment_limit=EXCLUDED.environment_limit,audit_retention_days=EXCLUDED.audit_retention_days,
            advanced_verification=EXCLUDED.advanced_verification,fleet_controls=EXCLUDED.fleet_controls,
            priority_support=EXCLUDED.priority_support,entra_oidc=EXCLUDED.entra_oidc,
            private_deployment=EXCLUDED.private_deployment,updated_at=now()"
    )
    .bind(organization_id).bind(plan).bind(nodes).bind(tenants).bind(environments).bind(retention)
    .bind(advanced).bind(fleet).bind(priority).bind(entra).bind(private_deployment)
    .execute(db).await?;
    Ok(())
}


pub(crate) async fn configure_entra(
    State(s): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<OidcConfigureInput>,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if !matches!(ctx.role.as_str(), "owner" | "admin") {
        return StatusCode::FORBIDDEN.into_response();
    }
    if let Err(c) = require_write(&ctx, &headers) {
        return c.into_response();
    }
    if let Err(response) = require_feature(&s.db, ctx.organization_id, "entra_oidc").await {
        return response;
    }

    let tenant_id = match Uuid::parse_str(input.tenant_id.trim()) {
        Ok(v) => v,
        Err(_) => return bad("Microsoft Entra tenant_id must be a UUID."),
    };
    let client_id = match env::var("PROXIMA_OIDC_CLIENT_ID") {
        Ok(v) if !v.trim().is_empty() => v,
        _ => return service_unavailable("Microsoft Entra client ID is not configured."),
    };
    let issuer = format!("https://login.microsoftonline.com/{tenant_id}/v2.0");

    match sqlx::query(
        "INSERT INTO organization_oidc_connections(organization_id,provider,tenant_id,issuer,client_id,enabled,jit_provisioning,updated_at)
         VALUES($1,'microsoft-entra',$2,$3,$4,true,$5,now())
         ON CONFLICT (organization_id) DO UPDATE SET
           provider='microsoft-entra',tenant_id=EXCLUDED.tenant_id,issuer=EXCLUDED.issuer,
           client_id=EXCLUDED.client_id,enabled=true,updated_at=now()"
    )
    .bind(ctx.organization_id).bind(tenant_id).bind(&issuer).bind(&client_id)
    .bind(input.jit_provisioning.unwrap_or(false))
    .execute(&s.db).await {
        Ok(_) => {
            audit(&s.db, ctx.organization_id, ctx.user_id, "identity.entra.configured",
                "oidc_connection", None, json!({"tenant_id":tenant_id,"provider":"microsoft-entra"})).await;
            Json(json!({"ok":true,"provider":"microsoft-entra","tenant_id":tenant_id,"issuer":issuer})).into_response()
        }
        Err(e) => db_error(e),
    }
}

pub(crate) async fn entra_start(
    State(s): State<AppState>,
    Query(q): Query<std::collections::HashMap<String,String>>,
) -> Response {
    let organization_id = match q.get("organization_id").and_then(|v| Uuid::parse_str(v).ok()) {
        Some(v) => v,
        None => return bad("organization_id is required."),
    };
    let connection = match sqlx::query(
        "SELECT tenant_id,issuer,client_id,jit_provisioning FROM organization_oidc_connections
         WHERE organization_id=$1 AND provider='microsoft-entra' AND enabled=true"
    ).bind(organization_id).fetch_optional(&s.db).await {
        Ok(Some(row)) => row,
        Ok(None) => return bad("Microsoft Entra SSO is not configured for this organization."),
        Err(e) => return db_error(e),
    };

    let tenant_id: Uuid = connection.get("tenant_id");
    let issuer: String = connection.get("issuer");
    let client_id: String = connection.get("client_id");
    let nonce = format!("{}-{}", Uuid::new_v4(), Uuid::new_v4());
    let state = format!("{}-{}", Uuid::new_v4(), Uuid::new_v4());
    let state_hash = token_hash(&state);

    if let Err(e) = sqlx::query(
        "INSERT INTO oidc_login_states(state_hash,organization_id,nonce,expires_at)
         VALUES($1,$2,$3,now()+interval '10 minutes')"
    ).bind(state_hash).bind(organization_id).bind(&nonce).execute(&s.db).await {
        return db_error(e);
    }

    let authorize = match reqwest::Url::parse("https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize") {
        Ok(mut url) => {
            url.query_pairs_mut()
                .append_pair("client_id", &client_id)
                .append_pair("response_type", "code")
                .append_pair("redirect_uri", &oidc_redirect_uri())
                .append_pair("response_mode", "query")
                .append_pair("scope", "openid profile email")
                .append_pair("state", &state)
                .append_pair("nonce", &nonce)
                .append_pair("prompt", "select_account");
            url.to_string()
        }
        Err(_) => return service_unavailable("Unable to construct Microsoft Entra authorization URL."),
    };

    Json(json!({"ok":true,"authorization_url":authorize,"tenant_id":tenant_id,"issuer":issuer})).into_response()
}

pub(crate) async fn entra_callback(
    State(s): State<AppState>,
    Query(q): Query<OidcCallbackQuery>,
) -> Response {
    let state_hash = token_hash(&q.state);
    let state_row = match sqlx::query(
        "SELECT organization_id,nonce FROM oidc_login_states
         WHERE state_hash=$1 AND expires_at>now()"
    ).bind(&state_hash).fetch_optional(&s.db).await {
        Ok(Some(row)) => row,
        Ok(None) => return bad("SSO state is invalid or expired."),
        Err(e) => return db_error(e),
    };
    let organization_id: Uuid = state_row.get("organization_id");
    let expected_nonce: String = state_row.get("nonce");
    let _ = sqlx::query("DELETE FROM oidc_login_states WHERE state_hash=$1").bind(&state_hash).execute(&s.db).await;

    let connection = match sqlx::query(
        "SELECT tenant_id,issuer,client_id FROM organization_oidc_connections
         WHERE organization_id=$1 AND provider='microsoft-entra' AND enabled=true"
    ).bind(organization_id).fetch_optional(&s.db).await {
        Ok(Some(row)) => row,
        Ok(None) => return bad("Microsoft Entra SSO is not configured for this organization."),
        Err(e) => return db_error(e),
    };
    let tenant_id: Uuid = connection.get("tenant_id");
    let expected_issuer: String = connection.get("issuer");
    let client_id: String = connection.get("client_id");
    let jit_provisioning: bool = connection.get("jit_provisioning");
    let secret = match env::var("PROXIMA_OIDC_CLIENT_SECRET") {
        Ok(v) if !v.trim().is_empty() => v,
        _ => return service_unavailable("Microsoft Entra client secret is not configured."),
    };

    let client = Client::new();
    let token_response = match client
        .post("https://login.microsoftonline.com/organizations/oauth2/v2.0/token")
        .form(&[
            ("client_id", client_id.as_str()),
            ("client_secret", secret.as_str()),
            ("grant_type", "authorization_code"),
            ("code", q.code.as_str()),
            ("redirect_uri", oidc_redirect_uri().as_str()),
        ])
        .send().await {
        Ok(v) => v,
        Err(e) => return external_error(e),
    };
    if !token_response.status().is_success() {
        return service_unavailable("Microsoft Entra token exchange failed.");
    }
    let token_body: Value = match token_response.json().await {
        Ok(v) => v,
        Err(e) => return external_error(e),
    };
    let id_token = match token_body.get("id_token").and_then(Value::as_str) {
        Some(v) => v,
        None => return bad("Microsoft Entra did not return an ID token."),
    };

    let header = match decode_header(id_token) {
        Ok(v) => v,
        Err(_) => return bad("Invalid Microsoft Entra ID token header."),
    };
    if header.alg != Algorithm::RS256 {
        return bad("Unsupported Microsoft Entra token signing algorithm.");
    }
    let kid = match header.kid {
        Some(v) => v,
        None => return bad("Microsoft Entra token is missing a key identifier."),
    };

    let discovery: Value = match client
        .get("https://login.microsoftonline.com/organizations/v2.0/.well-known/openid-configuration")
        .send().await {
        Ok(v) => match v.json().await { Ok(x) => x, Err(e) => return external_error(e) },
        Err(e) => return external_error(e),
    };
    let jwks_uri = match discovery.get("jwks_uri").and_then(Value::as_str) {
        Some(v) => v,
        None => return service_unavailable("Microsoft Entra discovery metadata has no JWKS URI."),
    };
    let jwks: JwkSet = match client.get(jwks_uri).send().await {
        Ok(v) => match v.json().await { Ok(x) => x, Err(e) => return external_error(e) },
        Err(e) => return external_error(e),
    };
    let jwk = match jwks.keys.iter().find(|k| k.common.key_id.as_deref() == Some(kid.as_str())) {
        Some(v) => v,
        None => return bad("Microsoft Entra signing key is not published in the current JWKS."),
    };
    let key = match DecodingKey::from_jwk(jwk) {
        Ok(v) => v,
        Err(_) => return bad("Microsoft Entra signing key could not be loaded."),
    };

    let mut validation = Validation::new(Algorithm::RS256);
    validation.set_audience(&[client_id.as_str()]);
    validation.set_issuer(&[expected_issuer.as_str()]);
    validation.set_required_spec_claims(&["exp","iss","aud","sub"]);
    validation.validate_nbf = true;

    let decoded = match decode::<OidcClaims>(id_token, &key, &validation) {
        Ok(v) => v,
        Err(_) => return bad("Microsoft Entra ID token validation failed."),
    };
    let claims = decoded.claims;
    if claims.tid != tenant_id.to_string()
        || claims.iss != expected_issuer
        || claims.aud != client_id
        || claims.nonce != expected_nonce {
        return bad("Microsoft Entra identity boundary validation failed.");
    }

    let subject = claims.oid.clone().unwrap_or_else(|| claims.sub.clone());
    let email = claims.email.clone().or(claims.preferred_username.clone());
    let email = match email {
        Some(v) if v.contains('@') => v.to_lowercase(),
        _ => return bad("Microsoft Entra did not provide a usable email address."),
    };
    let display_name = claims.name.clone().unwrap_or_else(|| email.split('@').next().unwrap_or("Operator").to_string());

    let user_id = match sqlx::query(
        "SELECT user_id FROM user_identities WHERE provider='microsoft-entra'
         AND issuer=$1 AND subject=$2 AND organization_id=$3"
    ).bind(&claims.iss).bind(&subject).bind(organization_id).fetch_optional(&s.db).await {
        Ok(Some(row)) => row.get("user_id"),
        Ok(None) => {
            if !jit_provisioning {
                return (StatusCode::FORBIDDEN, Json(json!({
                    "ok":false,
                    "error":"sso_identity_not_linked",
                    "message":"This Microsoft Entra identity is not linked to the organization."
                }))).into_response();
            }
            let email_exists = match sqlx::query("SELECT 1 FROM users WHERE lower(email)=lower($1)")
                .bind(&email).fetch_optional(&s.db).await {
                Ok(v) => v.is_some(),
                Err(e) => return db_error(e),
            };
            if email_exists {
                return (StatusCode::CONFLICT, Json(json!({
                    "ok":false,
                    "error":"sso_identity_requires_link",
                    "message":"An Agata account already uses this email. An organization administrator must link the Entra identity explicitly."
                }))).into_response();
            }
            let uid = Uuid::new_v4();
            if let Err(e) = sqlx::query(
                "INSERT INTO users(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)"
            ).bind(uid).bind(&email).bind(&display_name).bind("OIDC_MANAGED_IDENTITY").execute(&s.db).await {
                return db_error(e);
            }
            if let Err(e) = sqlx::query(
                "INSERT INTO memberships(user_id,organization_id,role) VALUES($1,$2,'viewer')"
            ).bind(uid).bind(organization_id).execute(&s.db).await {
                return db_error(e);
            }
            if let Err(e) = sqlx::query(
                "INSERT INTO user_identities(id,user_id,organization_id,provider,issuer,subject)
                 VALUES($1,$2,$3,'microsoft-entra',$4,$5)"
            ).bind(Uuid::new_v4()).bind(uid).bind(organization_id).bind(&claims.iss).bind(&subject).execute(&s.db).await {
                return db_error(e);
            }
            uid
        }
        Err(e) => return db_error(e),
    };

    if let Err(e) = sqlx::query(
        "UPDATE user_identities SET last_login_at=now() WHERE user_id=$1 AND organization_id=$2
         AND provider='microsoft-entra' AND issuer=$3 AND subject=$4"
    ).bind(user_id).bind(organization_id).bind(&claims.iss).bind(&subject).execute(&s.db).await {
        return db_error(e);
    }

    audit(&s.db, organization_id, user_id, "auth.login", "session", None,
        json!({"method":"microsoft-entra-oidc","tenant_id":tenant_id,"subject":subject})).await;

    match create_session(&s.db, user_id, organization_id).await {
        Ok((token, _csrf)) => {
            let mut response = Html(
                "<html><head><meta http-equiv=\"refresh\" content=\"0;url=/app\"></head><body style=\"background:#05090d;color:#eef7f7;font-family:Arial;padding:60px\">Signing you in…</body></html>"
            ).into_response();
            let cookie_value = if s.secure_cookie {
                format!("proxima_session={token}; Path=/; HttpOnly; SameSite=Strict; Secure")
            } else {
                format!("proxima_session={token}; Path=/; HttpOnly; SameSite=Strict")
            };
            response.headers_mut().insert(
                header::SET_COOKIE,
                HeaderValue::from_str(&cookie_value).unwrap_or_else(|_| HeaderValue::from_static("proxima_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict"))
            );
            response
        }
        Err(e) => db_error(e),
    }
}

fn oidc_redirect_uri() -> String {
    let base = env::var("AGATA_PUBLIC_BASE_URL").unwrap_or_else(|_| "http://127.0.0.1:8080".into());
    format!("{}/api/v1/auth/oidc/callback", base.trim_end_matches('/'))
}

pub(crate) async fn billing_status(State(s): State<AppState>, headers: HeaderMap) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };

    match sqlx::query(
        "SELECT stripe_customer_id,stripe_subscription_id,stripe_price_id,plan_key,status,
                current_period_end,cancel_at_period_end
         FROM billing_accounts WHERE organization_id=$1",
    )
    .bind(ctx.organization_id)
    .fetch_optional(&s.db)
    .await
    {
        Ok(Some(row)) => Json(json!({
            "configured": true,
            "customer_id": row.get::<Option<String>,_>("stripe_customer_id"),
            "subscription_id": row.get::<Option<String>,_>("stripe_subscription_id"),
            "price_id": row.get::<Option<String>,_>("stripe_price_id"),
            "plan": row.get::<String,_>("plan_key"),
            "status": row.get::<String,_>("status"),
            "current_period_end": row.get::<Option<chrono::DateTime<chrono::Utc>>,_>("current_period_end"),
            "cancel_at_period_end": row.get::<bool,_>("cancel_at_period_end")
        }))
        .into_response(),
        Ok(None) => Json(json!({
            "configured": false,
            "plan": "unconfigured",
            "status": "inactive",
            "message": "Stripe is integrated; configure an Agata Stripe Price ID before checkout."
        }))
        .into_response(),
        Err(e) => db_error(e),
    }
}

pub(crate) async fn checkout(
    State(s): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<CheckoutInput>,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if let Err(c) = require_write(&ctx, &headers) {
        return c.into_response();
    }

    let secret = match env::var("STRIPE_SECRET_KEY") {
        Ok(v) if !v.is_empty() => v,
        _ => return service_unavailable("Stripe secret is not configured."),
    };
    let price_id = match input.price_id.as_deref().filter(|v| !v.trim().is_empty()) {
        Some(value) => value.to_string(),
        None => return bad("Select an Agata Proxima plan before checkout."),
    };
    if plan_for_price(Some(&price_id)).is_none() {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"ok":false,"error":"invalid_agata_price","message":"The selected Stripe Price is not an Agata Proxima plan."})),
        ).into_response();
    }

    let user = match sqlx::query("SELECT email FROM users WHERE id=$1")
        .bind(ctx.user_id)
        .fetch_one(&s.db)
        .await
    {
        Ok(row) => row.get::<String,_>("email"),
        Err(e) => return db_error(e),
    };

    let client = Client::new();
    let billing = sqlx::query(
        "SELECT stripe_customer_id FROM billing_accounts WHERE organization_id=$1",
    )
    .bind(ctx.organization_id)
    .fetch_optional(&s.db)
    .await;

    let existing_customer = match billing {
        Ok(Some(row)) => row.get::<Option<String>,_>("stripe_customer_id"),
        Ok(None) => None,
        Err(e) => return db_error(e),
    };

    let customer_id = match existing_customer {
        Some(id) => id,
        None => {
            let customer_params = vec![
                ("email".to_string(), user.clone()),
                ("description".to_string(), "Agata Proxima organization".to_string()),
                ("metadata[organization_id]".to_string(), ctx.organization_id.to_string()),
            ];
            let response = match client
                .post("https://api.stripe.com/v1/customers")
                .bearer_auth(&secret)
                .form(&customer_params)
                .send()
                .await
            {
                Ok(r) => r,
                Err(e) => return external_error(e),
            };
            if !response.status().is_success() {
                return stripe_error(response).await;
            }
            let body: Value = match response.json().await {
                Ok(v) => v,
                Err(e) => return external_error(e),
            };
            let id = body.get("id").and_then(Value::as_str).unwrap_or_default().to_string();
            if id.is_empty() {
                return service_unavailable("Stripe did not return a customer ID.");
            }
            if let Err(e) = sqlx::query(
                "INSERT INTO billing_accounts(organization_id,stripe_customer_id,status)
                 VALUES($1,$2,'pending')
                 ON CONFLICT (organization_id) DO UPDATE SET stripe_customer_id=EXCLUDED.stripe_customer_id",
            )
            .bind(ctx.organization_id)
            .bind(&id)
            .execute(&s.db)
            .await
            {
                return db_error(e);
            }
            id
        }
    };

    let base_url = env::var("AGATA_PUBLIC_BASE_URL")
        .unwrap_or_else(|_| "http://127.0.0.1:8080".into())
        .trim_end_matches('/')
        .to_string();

    let checkout_params = vec![
        ("mode".to_string(), "subscription".to_string()),
        ("customer".to_string(), customer_id.clone()),
        ("line_items[0][price]".to_string(), price_id.clone()),
        ("line_items[0][quantity]".to_string(), "1".to_string()),
        ("success_url".to_string(), format!("{base_url}/app?billing=success")),
        ("cancel_url".to_string(), format!("{base_url}/app?billing=cancelled")),
        ("client_reference_id".to_string(), ctx.organization_id.to_string()),
        ("metadata[organization_id]".to_string(), ctx.organization_id.to_string()),
        ("subscription_data[metadata][organization_id]".to_string(), ctx.organization_id.to_string()),
    ];
    let response = match client
        .post("https://api.stripe.com/v1/checkout/sessions")
        .bearer_auth(&secret)
        .form(&checkout_params)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => return external_error(e),
    };

    if !response.status().is_success() {
        return stripe_error(response).await;
    }

    let body: Value = match response.json().await {
        Ok(v) => v,
        Err(e) => return external_error(e),
    };
    let url = body.get("url").and_then(Value::as_str).unwrap_or_default();
    if url.is_empty() {
        return service_unavailable("Stripe did not return a checkout URL.");
    }

    audit(
        &s.db,
        ctx.organization_id,
        ctx.user_id,
        "billing.checkout.created",
        "billing",
        None,
        json!({"price_id":price_id}),
    )
    .await;

    Json(json!({"ok":true,"checkout_url":url})).into_response()
}

pub(crate) async fn portal(State(s): State<AppState>, headers: HeaderMap) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if let Err(c) = require_write(&ctx, &headers) {
        return c.into_response();
    }

    let secret = match env::var("STRIPE_SECRET_KEY") {
        Ok(v) if !v.is_empty() => v,
        _ => return service_unavailable("Stripe secret is not configured."),
    };
    let customer_id = match sqlx::query(
        "SELECT stripe_customer_id FROM billing_accounts WHERE organization_id=$1",
    )
    .bind(ctx.organization_id)
    .fetch_optional(&s.db)
    .await
    {
        Ok(Some(row)) => row.get::<Option<String>,_>("stripe_customer_id"),
        Ok(None) => None,
        Err(e) => return db_error(e),
    };
    let customer_id = match customer_id {
        Some(v) => v,
        None => return bad("No Stripe customer exists for this organization yet."),
    };

    let base_url = env::var("AGATA_PUBLIC_BASE_URL")
        .unwrap_or_else(|_| "http://127.0.0.1:8080".into())
        .trim_end_matches('/')
        .to_string();

    let portal_params = vec![
        ("customer".to_string(), customer_id.clone()),
        ("return_url".to_string(), format!("{base_url}/app?billing=portal")),
    ];
    let response = match Client::new()
        .post("https://api.stripe.com/v1/billing_portal/sessions")
        .bearer_auth(&secret)
        .form(&portal_params)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => return external_error(e),
    };

    if !response.status().is_success() {
        return stripe_error(response).await;
    }
    let body: Value = match response.json().await {
        Ok(v) => v,
        Err(e) => return external_error(e),
    };
    let url = body.get("url").and_then(Value::as_str).unwrap_or_default();
    if url.is_empty() {
        return service_unavailable("Stripe did not return a portal URL.");
    }
    Json(json!({"ok":true,"portal_url":url})).into_response()
}

pub(crate) async fn stripe_webhook(State(s): State<AppState>, headers: HeaderMap, body: String) -> Response {
    let signature = match headers.get("stripe-signature").and_then(|v| v.to_str().ok()) {
        Some(v) => v,
        None => return StatusCode::BAD_REQUEST.into_response(),
    };
    let secret = match env::var("STRIPE_WEBHOOK_SECRET") {
        Ok(v) if !v.is_empty() => v,
        _ => return StatusCode::SERVICE_UNAVAILABLE.into_response(),
    };
    if !verify_stripe_signature(&body, signature, &secret) {
        return StatusCode::UNAUTHORIZED.into_response();
    }

    let event: Value = match serde_json::from_str(&body) {
        Ok(v) => v,
        Err(_) => return StatusCode::BAD_REQUEST.into_response(),
    };
    let event_id = event.get("id").and_then(Value::as_str).unwrap_or_default();
    let event_type = event.get("type").and_then(Value::as_str).unwrap_or_default();
    if event_id.is_empty() || event_type.is_empty() {
        return StatusCode::BAD_REQUEST.into_response();
    }

    let inserted = match sqlx::query(
        "INSERT INTO billing_events(stripe_event_id,event_type,payload)
         VALUES($1,$2,$3) ON CONFLICT (stripe_event_id) DO NOTHING",
    )
    .bind(event_id)
    .bind(event_type)
    .bind(&event)
    .execute(&s.db)
    .await
    {
        Ok(v) => v.rows_affected() == 1,
        Err(e) => return db_error(e),
    };

    if !inserted {
        return Json(json!({"received":true,"duplicate":true})).into_response();
    }

    let object = event.pointer("/data/object").cloned().unwrap_or(Value::Null);
    let customer_id = object.get("customer").and_then(Value::as_str);
    let metadata_org = object.pointer("/metadata/organization_id").and_then(Value::as_str);

    let organization_id = if let Some(value) = metadata_org {
        Uuid::parse_str(value).ok()
    } else if let Some(customer) = customer_id {
        sqlx::query("SELECT organization_id FROM billing_accounts WHERE stripe_customer_id=$1")
            .bind(customer)
            .fetch_optional(&s.db)
            .await
            .ok()
            .flatten()
            .map(|r| r.get::<Uuid,_>("organization_id"))
    } else {
        None
    };

    if let Some(org) = organization_id {
        let subscription_id = object.get("subscription").and_then(Value::as_str)
            .or_else(|| object.get("id").and_then(Value::as_str));
        let status = object.get("status").and_then(Value::as_str).unwrap_or("active");
        let price_id = object.pointer("/items/data/0/price/id").and_then(Value::as_str);
        let cancel_at_period_end = object.get("cancel_at_period_end").and_then(Value::as_bool).unwrap_or(false);
        let period_end = object.get("current_period_end").and_then(Value::as_i64);

        match event_type {
            "checkout.session.completed"
            | "customer.subscription.created"
            | "customer.subscription.updated"
            | "customer.subscription.deleted" => {
                let normalized_status = if event_type == "customer.subscription.deleted" {
                    "canceled"
                } else {
                    status
                };
                let plan = if event_type == "customer.subscription.deleted" {
                    "free"
                } else {
                    plan_for_price(price_id).unwrap_or("free")
                };
                if let Err(e) = sqlx::query(
                    "INSERT INTO billing_accounts(
                        organization_id,stripe_customer_id,stripe_subscription_id,stripe_price_id,
                        plan_key,status,current_period_end,cancel_at_period_end,updated_at)
                     VALUES($1,$2,$3,$4,$5,$6,
                        CASE WHEN $7::bigint IS NULL THEN NULL ELSE to_timestamp($7) END,$8,now())
                     ON CONFLICT (organization_id) DO UPDATE SET
                       stripe_customer_id=COALESCE(EXCLUDED.stripe_customer_id,billing_accounts.stripe_customer_id),
                       stripe_subscription_id=COALESCE(EXCLUDED.stripe_subscription_id,billing_accounts.stripe_subscription_id),
                       stripe_price_id=COALESCE(EXCLUDED.stripe_price_id,billing_accounts.stripe_price_id),
                       plan_key=EXCLUDED.plan_key,status=EXCLUDED.status,
                       current_period_end=EXCLUDED.current_period_end,
                       cancel_at_period_end=EXCLUDED.cancel_at_period_end,updated_at=now()",
                )
                .bind(org)
                .bind(customer_id)
                .bind(subscription_id)
                .bind(price_id)
                .bind(plan)
                .bind(normalized_status)
                .bind(period_end)
                .bind(cancel_at_period_end)
                .execute(&s.db)
                .await {
                    return db_error(e);
                }
                if let Err(e) = apply_entitlements(&s.db, org, plan).await {
                    return db_error(e);
                }
            }
            "invoice.payment_failed" | "invoice.paid" => {
                let normalized_status = if event_type == "invoice.payment_failed" {
                    "past_due"
                } else {
                    "active"
                };
                if let Err(e) = sqlx::query(
                    "UPDATE billing_accounts SET status=$1,updated_at=now() WHERE organization_id=$2",
                )
                .bind(normalized_status)
                .bind(org)
                .execute(&s.db)
                .await {
                    return db_error(e);
                }
            }
            _ => {}
        }
        audit(
            &s.db,
            org,
            Uuid::nil(),
            "billing.webhook.processed",
            "billing_event",
            None,
            json!({"event_id":event_id,"event_type":event_type}),
        )
        .await;
    }

    let _ = sqlx::query(
        "UPDATE billing_events SET status='processed',processed_at=now() WHERE stripe_event_id=$1",
    )
    .bind(event_id)
    .execute(&s.db)
    .await;

    Json(json!({"received":true})).into_response()
}

pub(crate) async fn send_verification_email(
    db: &sqlx::PgPool,
    user_id: Uuid,
    email: &str,
    display_name: &str,
) -> anyhow::Result<()> {
    let token = format!("{}-{}", Uuid::new_v4(), Uuid::new_v4());
    sqlx::query(
        "UPDATE users SET email_verification_token_hash=$1,
         email_verification_expires_at=now()+interval '24 hours' WHERE id=$2",
    )
    .bind(token_hash(&token))
    .bind(user_id)
    .execute(db)
    .await?;

    let base = env::var("AGATA_PUBLIC_BASE_URL")
        .unwrap_or_else(|_| "http://127.0.0.1:8080".into())
        .trim_end_matches('/')
        .to_string();
    let link = format!("{base}/verify-email?token={token}");
    send_email(
        email,
        "Verify your Agata Proxima email",
        &format!(
            "<div style=\"font-family:Inter,Arial,sans-serif;background:#05080c;color:#eef7f8;padding:40px\">
             <h1>Agata Proxima</h1><p>Hello {display_name},</p>
             <p>Confirm this address to activate verified email status for your Proxima workspace.</p>
             <p><a href=\"{link}\" style=\"display:inline-block;padding:12px 18px;background:#71dcff;color:#061015;text-decoration:none;border-radius:8px\">Verify email</a></p>
             <p style=\"color:#8ea0ab\">This link expires in 24 hours.</p></div>"
        ),
    )
    .await
}

pub(crate) async fn verify_email(
    State(s): State<AppState>,
    Query(q): Query<VerifyInput>,
) -> Response {
    let result = sqlx::query(
        "UPDATE users SET email_verified_at=now(),email_verification_token_hash=NULL,
         email_verification_expires_at=NULL
         WHERE email_verification_token_hash=$1
           AND email_verification_expires_at>now()
         RETURNING email",
    )
    .bind(token_hash(&q.token))
    .fetch_optional(&s.db)
    .await;

    match result {
        Ok(Some(row)) => Html(format!(
            "<html><body style=\"background:#05080c;color:#eef7f8;font-family:Arial;padding:60px\">
             <h1>Email verified.</h1><p>{}</p><p><a href=\"/app\">Open Agata Proxima</a></p></body></html>",
            row.get::<String,_>("email")
        ))
        .into_response(),
        Ok(None) => (
            StatusCode::BAD_REQUEST,
            Html("<html><body style=\"background:#05080c;color:#eef7f8;font-family:Arial;padding:60px\"><h1>Verification link expired or invalid.</h1></body></html>"),
        )
            .into_response(),
        Err(e) => db_error(e),
    }
}

pub(crate) async fn reset_password_page(Query(q): Query<VerifyInput>) -> Response {
    let token = q.token.replace('"', "");
    Html(format!(
        "<!doctype html><html><body style=\"background:#05080c;color:#eef7f8;font-family:Arial;padding:60px\">
        <h1>Reset your Agata Proxima password</h1>
        <form id=\"f\"><input id=\"p\" type=\"password\" minlength=\"12\" placeholder=\"New password\" required style=\"padding:12px;width:320px\">
        <button style=\"margin-left:8px;padding:12px\">Reset password</button></form>
        <p id=\"m\"></p>
        <script>
        const token={token:?};
        document.getElementById('f').onsubmit=async(e)=>{{e.preventDefault();const r=await fetch('/api/v1/auth/password-reset/confirm',{{method:'POST',headers:{{'content-type':'application/json'}},body:JSON.stringify({{token,password:document.getElementById('p').value}})}});const j=await r.json();document.getElementById('m').textContent=j.message||'Done';}};
        </script></body></html>"
    ))
    .into_response()
}

pub(crate) async fn request_password_reset(
    State(s): State<AppState>,
    Json(input): Json<PasswordResetRequest>,
) -> Response {
    let email = input.email.trim().to_lowercase();
    let user = match sqlx::query("SELECT id,display_name FROM users WHERE email=$1 AND status='active'")
        .bind(&email)
        .fetch_optional(&s.db)
        .await
    {
        Ok(v) => v,
        Err(e) => return db_error(e),
    };

    if let Some(row) = user {
        let token = format!("{}-{}", Uuid::new_v4(), Uuid::new_v4());
        if let Err(e) = sqlx::query(
            "UPDATE users SET password_reset_token_hash=$1,password_reset_expires_at=now()+interval '30 minutes'
             WHERE id=$2",
        )
        .bind(token_hash(&token))
        .bind(row.get::<Uuid,_>("id"))
        .execute(&s.db)
        .await {
            return db_error(e);
        }
        let base = env::var("AGATA_PUBLIC_BASE_URL")
            .unwrap_or_else(|_| "http://127.0.0.1:8080".into())
            .trim_end_matches('/')
            .to_string();
        let link = format!("{base}/reset-password?token={token}");
        let html = format!(
            "<div style=\"font-family:Inter,Arial,sans-serif;background:#05080c;color:#eef7f8;padding:40px\">
             <h1>Agata Proxima</h1><p>Hello {},</p><p>A password reset was requested for your workspace.</p>
             <p><a href=\"{link}\" style=\"display:inline-block;padding:12px 18px;background:#71dcff;color:#061015;text-decoration:none;border-radius:8px\">Reset password</a></p>
             <p style=\"color:#8ea0ab\">This link expires in 30 minutes. If you did not request it, ignore this email.</p></div>",
            row.get::<String,_>("display_name")
        );
        if let Err(e) = send_email(&email, "Reset your Agata Proxima password", &html).await {
            tracing::error!(%e, "password reset email failed");
        }
    }

    Json(json!({"ok":true,"message":"If that address exists, a reset email has been sent."})).into_response()
}

pub(crate) async fn reset_password(
    State(s): State<AppState>,
    Json(input): Json<PasswordResetConfirm>,
) -> Response {
    if input.password.len() < 12 {
        return bad("Password must be at least 12 characters.");
    }
    let hash = match hash_password(&input.password) {
        Ok(v) => v,
        Err(_) => return internal("Password hashing failed."),
    };
    let result = match sqlx::query(
        "UPDATE users SET password_hash=$1,password_reset_token_hash=NULL,password_reset_expires_at=NULL
         WHERE password_reset_token_hash=$2 AND password_reset_expires_at>now()
         RETURNING id",
    )
    .bind(hash)
    .bind(token_hash(&input.token))
    .fetch_optional(&s.db)
    .await
    {
        Ok(v) => v,
        Err(e) => return db_error(e),
    };

    match result {
        Some(row) => {
            let user_id: Uuid = row.get("id");
            let _ = sqlx::query("DELETE FROM sessions WHERE user_id=$1")
                .bind(user_id)
                .execute(&s.db)
                .await;
            Json(json!({"ok":true,"message":"Password changed. Sign in again."})).into_response()
        }
        None => bad("Reset link expired or invalid."),
    }
}

pub(crate) async fn invite(
    State(s): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<InviteInput>,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if ctx.organization_id != input.organization_id {
        return StatusCode::FORBIDDEN.into_response();
    }
    if let Err(c) = require_write(&ctx, &headers) {
        return c.into_response();
    }

    let role = input.role.unwrap_or_else(|| "viewer".into());
    if !matches!(role.as_str(), "admin" | "operator" | "viewer") {
        return bad("Invalid invitation role.");
    }
    let email = input.email.trim().to_lowercase();
    if !email.contains('@') {
        return bad("A valid email is required.");
    }

    let token = format!("{}-{}", Uuid::new_v4(), Uuid::new_v4());
    let id = Uuid::new_v4();
    if let Err(e) = sqlx::query(
        "INSERT INTO organization_invites(id,organization_id,invited_by,email,role,token_hash,expires_at)
         VALUES($1,$2,$3,$4,$5,$6,now()+interval '7 days')
         ON CONFLICT (organization_id,email) DO UPDATE SET
           invited_by=EXCLUDED.invited_by,role=EXCLUDED.role,token_hash=EXCLUDED.token_hash,
           expires_at=EXCLUDED.expires_at,accepted_at=NULL",
    )
    .bind(id).bind(ctx.organization_id).bind(ctx.user_id).bind(&email).bind(&role).bind(token_hash(&token))
    .execute(&s.db).await {
        return db_error(e);
    }

    let base = env::var("AGATA_PUBLIC_BASE_URL").unwrap_or_else(|_| "http://127.0.0.1:8080".into()).trim_end_matches('/').to_string();
    let link = format!("{base}/accept-invite?token={token}");
    let html = format!(
        "<div style=\"font-family:Inter,Arial,sans-serif;background:#05080c;color:#eef7f8;padding:40px\">
         <h1>Agata Proxima</h1><p>You have been invited to a Proxima organization.</p>
         <p>Role: <strong>{role}</strong></p><p><a href=\"{link}\" style=\"display:inline-block;padding:12px 18px;background:#71dcff;color:#061015;text-decoration:none;border-radius:8px\">Accept invitation</a></p>
         <p style=\"color:#8ea0ab\">This invitation expires in 7 days.</p></div>"
    );
    if let Err(e) = send_email(&email, "You have been invited to Agata Proxima", &html).await {
        tracing::error!(%e, "invitation email failed");
    }

    audit(&s.db, ctx.organization_id, ctx.user_id, "organization.invite.created", "organization_invite", Some(id), json!({"email":email,"role":role})).await;
    Json(json!({"ok":true,"id":id,"expires_in":"7 days"})).into_response()
}

pub(crate) async fn accept_invite(
    State(s): State<AppState>,
    Query(q): Query<VerifyInput>,
    headers: HeaderMap,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(_) => return (
            StatusCode::UNAUTHORIZED,
            Html("<html><body style=\"background:#05080c;color:#eef7f8;font-family:Arial;padding:60px\"><h1>Sign in first.</h1><p>Open the invitation link again after signing in.</p><a href=\"/login\">Sign in</a></body></html>")
        ).into_response(),
    };

    let row = match sqlx::query(
        "SELECT id,organization_id,role FROM organization_invites
         WHERE token_hash=$1 AND expires_at>now() AND accepted_at IS NULL
           AND lower(email)=(SELECT lower(email) FROM users WHERE id=$2)",
    )
    .bind(token_hash(&q.token))
    .bind(ctx.user_id)
    .fetch_optional(&s.db)
    .await
    {
        Ok(v) => v,
        Err(e) => return db_error(e),
    };

    match row {
        Some(row) => {
            let invite_id: Uuid = row.get("id");
            let org: Uuid = row.get("organization_id");
            let role: String = row.get("role");
            if let Err(e) = sqlx::query(
                "INSERT INTO memberships(user_id,organization_id,role) VALUES($1,$2,$3)
                 ON CONFLICT (user_id,organization_id) DO UPDATE SET role=EXCLUDED.role",
            )
            .bind(ctx.user_id).bind(org).bind(&role).execute(&s.db).await {
                return db_error(e);
            }
            let _ = sqlx::query("UPDATE organization_invites SET accepted_at=now() WHERE id=$1")
                .bind(invite_id).execute(&s.db).await;
            audit(&s.db, org, ctx.user_id, "organization.invite.accepted", "organization_invite", Some(invite_id), json!({})).await;
            Html("<html><body style=\"background:#05080c;color:#eef7f8;font-family:Arial;padding:60px\"><h1>Invitation accepted.</h1><p>Your organization access is active.</p><a href=\"/app\">Open Command Center</a></body></html>").into_response()
        }
        None => bad("Invitation expired, invalid, or not addressed to the signed-in user."),
    }
}

pub(crate) async fn readiness(State(s): State<AppState>) -> Response {
    let db_ok = sqlx::query("SELECT 1").execute(&s.db).await.is_ok();
    let stripe = env::var("STRIPE_SECRET_KEY").map(|v| !v.is_empty()).unwrap_or(false);
    let stripe_price = ["AGATA_STRIPE_STARTER_PRICE_ID","AGATA_STRIPE_GROWTH_PRICE_ID","AGATA_STRIPE_SCALE_PRICE_ID"]
        .iter().all(|key| env::var(key).map(|v| !v.trim().is_empty()).unwrap_or(false));
    let stripe_webhook = env::var("STRIPE_WEBHOOK_SECRET").map(|v| !v.is_empty()).unwrap_or(false);
    let resend = env::var("RESEND_API_KEY").map(|v| !v.is_empty()).unwrap_or(false);
    let from = env::var("RESEND_FROM_EMAIL").map(|v| !v.is_empty()).unwrap_or(false);
    let base = env::var("AGATA_PUBLIC_BASE_URL").map(|v| !v.is_empty()).unwrap_or(false);
    let oidc = env::var("PROXIMA_OIDC_CLIENT_ID").map(|v| !v.is_empty()).unwrap_or(false)
        && env::var("PROXIMA_OIDC_CLIENT_SECRET").map(|v| !v.is_empty()).unwrap_or(false);
    let all = db_ok && stripe && stripe_price && stripe_webhook && resend && from && base && oidc;
    Json(json!({
        "status": if all {"ready"} else {"needs_configuration"},
        "checks":{
            "database":db_ok,
            "stripe_secret":stripe,
            "stripe_price":stripe_price,
            "stripe_webhook":stripe_webhook,
            "resend_api_key":resend,
            "resend_from":from,
            "public_base_url":base,
            "oidc":oidc,
            "engine_remains_authoritative":true
        }
    })).into_response()
}

async fn send_email(to: &str, subject: &str, html: &str) -> anyhow::Result<()> {
    let key = env::var("RESEND_API_KEY")?;
    let from = match env::var("RESEND_FROM_EMAIL") {
        Ok(v) if !v.trim().is_empty() => v,
        _ => anyhow::bail!("RESEND_FROM_EMAIL is not configured for the current deployment"),
    };
    let response = Client::new()
        .post("https://api.resend.com/emails")
        .bearer_auth(key)
        .json(&json!({"from":from,"to":[to],"subject":subject,"html":html}))
        .send()
        .await?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        anyhow::bail!("Resend returned {status}: {body}");
    }
    Ok(())
}

fn verify_stripe_signature(payload: &str, signature: &str, secret: &str) -> bool {
    let mut timestamp = None;
    let mut signatures = Vec::new();
    for part in signature.split(',') {
        let mut pair = part.splitn(2, '=');
        match (pair.next(), pair.next()) {
            (Some("t"), Some(value)) => timestamp = value.parse::<i64>().ok(),
            (Some("v1"), Some(value)) => signatures.push(value.to_string()),
            _ => {}
        }
    }
    let timestamp = match timestamp {
        Some(v) => v,
        None => return false,
    };
    let now = chrono::Utc::now().timestamp();
    if (now - timestamp).abs() > 300 {
        return false;
    }
    let signed = format!("{timestamp}.{payload}");
    let mut mac = match HmacSha256::new_from_slice(secret.as_bytes()) {
        Ok(v) => v,
        Err(_) => return false,
    };
    mac.update(signed.as_bytes());
    let expected = hex::encode(mac.finalize().into_bytes());
    signatures.iter().any(|candidate| constant_time_equal(candidate, &expected))
}

fn constant_time_equal(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.as_bytes().iter().zip(b.as_bytes()) {
        diff |= x ^ y;
    }
    diff == 0
}

async fn stripe_error(response: reqwest::Response) -> Response {
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    tracing::error!(%status, body = %body, "Stripe API error");
    service_unavailable("Stripe request failed.")
}

fn external_error<E: std::fmt::Display>(e: E) -> Response {
    tracing::error!(error = %e, "external integration error");
    service_unavailable("External integration request failed.")
}

fn service_unavailable(message: &str) -> Response {
    (StatusCode::SERVICE_UNAVAILABLE, Json(json!({"ok":false,"message":message}))).into_response()
}


#[cfg(test)]
mod tests {
    #[test]
    fn entitlement_matrix_matches_launch_contract() {
        assert_eq!(super::plan_limits("free"), (1, 3, 1, 7, false, false, false, false, false));
        assert_eq!(super::plan_limits("starter"), (2, 25, 2, 30, false, true, false, false, false));
        assert_eq!(super::plan_limits("growth"), (5, 100, 5, 180, true, true, true, true, false));
        assert_eq!(super::plan_limits("scale"), (15, 500, 50, 365, true, true, true, true, true));
        assert_eq!(super::plan_limits("enterprise"), (i32::MAX, i32::MAX, i32::MAX, 3650, true, true, true, true, true));
    }

    #[test]
    fn unknown_plan_defaults_to_free_entitlements() {
        assert_eq!(super::plan_limits("unknown"), super::plan_limits("free"));
    }


    use super::*;

    #[test]
    fn stripe_signature_round_trip() {
        let payload = r#"{"id":"evt_test","type":"invoice.paid"}"#;
        let secret = "whsec_test";
        let timestamp = chrono::Utc::now().timestamp();
        let signed = format!("{timestamp}.{payload}");
        let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(signed.as_bytes());
        let signature = hex::encode(mac.finalize().into_bytes());
        let header = format!("t={timestamp},v1={signature}");
        assert!(verify_stripe_signature(payload, &header, secret));
    }

    #[test]
    fn expired_stripe_signature_is_rejected() {
        let payload = "payload";
        let secret = "whsec_test";
        let timestamp = chrono::Utc::now().timestamp() - 301;
        let signed = format!("{timestamp}.{payload}");
        let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(signed.as_bytes());
        let signature = hex::encode(mac.finalize().into_bytes());
        let header = format!("t={timestamp},v1={signature}");
        assert!(!verify_stripe_signature(payload, &header, secret));
    }
}
