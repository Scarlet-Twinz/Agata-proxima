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
use sha2::{Digest, Sha256};
use sqlx::Row;
use std::env;
use uuid::Uuid;

use super::{
    audit, authenticate, bad, create_session, db_error, hash_password, internal, require_admin, require_write, token_hash,
    AppState,
};

type HmacSha512 = Hmac<sha2::Sha512>;

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
pub(crate) struct VerificationCodeInput {
    pub email: String,
    pub code: String,
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
fn plan_for_code(plan_code: Option<&str>) -> Option<&'static str> {
    let starter = env::var("AGATA_PAYSTACK_STARTER_PLAN_CODE").ok();
    let growth = env::var("AGATA_PAYSTACK_GROWTH_PLAN_CODE").ok();
    let scale = env::var("AGATA_PAYSTACK_SCALE_PLAN_CODE").ok();
    match plan_code {
        Some(id) if starter.as_deref() == Some(id) => Some("starter"),
        Some(id) if growth.as_deref() == Some(id) => Some("growth"),
        Some(id) if scale.as_deref() == Some(id) => Some("scale"),
        _ => None,
    }
}
fn paystack_plan_code(plan: &str) -> Option<String> {
    let key=match plan {"starter"=>"AGATA_PAYSTACK_STARTER_PLAN_CODE","growth"=>"AGATA_PAYSTACK_GROWTH_PLAN_CODE","scale"=>"AGATA_PAYSTACK_SCALE_PLAN_CODE",_=>return None};
    env::var(key).ok().filter(|v|!v.trim().is_empty())
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
    let catalog=[("free","Free",0_i32,"Evaluation and small proofs of concept"),("starter","Starter",149_i32,"First production SaaS deployments"),("growth","Growth",499_i32,"Multi-tenant production workloads"),("scale","Scale",1199_i32,"Larger fleets and security operations"),("enterprise","Enterprise",0_i32,"Contracted enterprise deployments")];
    let plans=catalog.iter().map(|(key,name,monthly_usd,description)|{
        let plan_code=paystack_plan_code(key);
        let (nodes,tenants,environments,retention,advanced,fleet,priority,entra,private_deployment)=plan_limits(key);
        json!({"key":key,"name":name,"monthly_usd":monthly_usd,"description":description,"provider":"paystack","plan_code":plan_code,"checkout_available":key!=&"free"&&key!=&"enterprise"&&paystack_plan_code(key).is_some(),"limits":{"nodes":nodes,"tenants":tenants,"environments":environments,"audit_retention_days":retention},"features":{"advanced_verification":advanced,"fleet_controls":fleet,"priority_support":priority,"entra_oidc":entra,"private_deployment":private_deployment,"policy_management":key!=&"free"}})
    }).collect::<Vec<_>>();
    Json(json!({"currency":"usd","billing_interval":"month","provider":"paystack","plans":plans})).into_response()
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
    let ctx=match authenticate(&s,&headers).await{Ok(v)=>v,Err(c)=>return c.into_response()};
    match sqlx::query("SELECT paystack_customer_code,paystack_subscription_code,paystack_plan_code,plan_key,status,current_period_end,cancel_at_period_end FROM billing_accounts WHERE organization_id=$1").bind(ctx.organization_id).fetch_optional(&s.db).await{
        Ok(Some(row))=>Json(json!({"configured":true,"provider":"paystack","customer_code":row.get::<Option<String>,_>("paystack_customer_code"),"subscription_code":row.get::<Option<String>,_>("paystack_subscription_code"),"plan_code":row.get::<Option<String>,_>("paystack_plan_code"),"plan":row.get::<String,_>("plan_key"),"status":row.get::<String,_>("status"),"current_period_end":row.get::<Option<chrono::DateTime<chrono::Utc>>,_>("current_period_end"),"cancel_at_period_end":row.get::<bool,_>("cancel_at_period_end")})).into_response(),
        Ok(None)=>Json(json!({"configured":false,"provider":"paystack","plan":"free","status":"active"})).into_response(),Err(e)=>db_error(e)
    }
}
pub(crate) async fn checkout(State(s):State<AppState>,headers:HeaderMap,Json(input):Json<CheckoutInput>)->Response{
    let ctx=match authenticate(&s,&headers).await{Ok(v)=>v,Err(c)=>return c.into_response()};if let Err(c)=require_write(&ctx,&headers){return c.into_response();}
    let secret=match env::var("PAYSTACK_SECRET_KEY"){Ok(v) if !v.trim().is_empty()=>v,_=>return service_unavailable("Paystack secret is not configured.")};
    let plan_code=match input.price_id.as_deref().and_then(paystack_plan_code_for_input){Some(v)=>v,None=>return bad("Select an Agata Proxima plan before checkout.")};
    let plan=match plan_for_code(Some(&plan_code)){Some(v)=>v,None=>return (StatusCode::FORBIDDEN,Json(json!({"ok":false,"error":"invalid_agata_plan"}))).into_response()};
    let email=match sqlx::query("SELECT email FROM users WHERE id=$1").bind(ctx.user_id).fetch_one(&s.db).await{Ok(r)=>r.get::<String,_>("email"),Err(e)=>return db_error(e)};
    let base=env::var("AGATA_PUBLIC_BASE_URL").unwrap_or_else(|_|"http://127.0.0.1:8080".into()).trim_end_matches('/').to_string();
    let reference=format!("agata-{}-{}",ctx.organization_id.simple(),Uuid::new_v4().simple());
    let response=match Client::new().post("https://api.paystack.co/transaction/initialize").bearer_auth(&secret).json(&json!({"email":email,"plan":plan_code,"currency":"USD","reference":reference,"callback_url":format!("{base}/api/v1/billing/paystack/callback"),"metadata":{"organization_id":ctx.organization_id.to_string(),"plan":plan}})).send().await{Ok(r)=>r,Err(e)=>return external_error(e)};
    if !response.status().is_success(){return paystack_error(response).await;}
    let body:Value=match response.json().await{Ok(v)=>v,Err(e)=>return external_error(e)};if body.get("status").and_then(Value::as_bool)!=Some(true){return service_unavailable("Paystack did not initialize the transaction.");}
    let data=body.get("data").cloned().unwrap_or(Value::Null);let url=data.get("authorization_url").and_then(Value::as_str).unwrap_or_default();let access=data.get("access_code").and_then(Value::as_str);let returned=data.get("reference").and_then(Value::as_str).unwrap_or(&reference);if url.is_empty(){return service_unavailable("Paystack did not return a checkout URL.");}
    if let Err(e)=sqlx::query("INSERT INTO billing_transactions(organization_id,provider,reference,plan_key,plan_code,currency,status,metadata,created_at,updated_at) VALUES($1,'paystack',$2,$3,$4,'USD','initialized',$5,now(),now()) ON CONFLICT(provider,reference) DO NOTHING").bind(ctx.organization_id).bind(returned).bind(plan).bind(&plan_code).bind(&body).execute(&s.db).await{return db_error(e);}
    audit(&s.db,ctx.organization_id,ctx.user_id,"billing.checkout.created","billing_transaction",None,json!({"provider":"paystack","reference":returned,"plan":plan,"plan_code":plan_code})).await;
    Json(json!({"ok":true,"provider":"paystack","checkout_url":url,"access_code":access,"reference":returned})).into_response()
}
fn paystack_plan_code_for_input(input:&str)->Option<String>{let v=input.trim();if ["starter","growth","scale"].contains(&v){paystack_plan_code(v)}else{plan_for_code(Some(v)).map(|_|v.to_string())}}
pub(crate) async fn paystack_callback(
    State(s): State<AppState>,
    Query(q): Query<std::collections::HashMap<String,String>>,
) -> Response {
    let reference = match q.get("reference").or_else(|| q.get("trxref")) {
        Some(v) if !v.trim().is_empty() => v.trim().to_string(),
        _ => return Html("<html><body>Missing Paystack transaction reference.</body></html>").into_response(),
    };
    let organization_id = match sqlx::query("SELECT organization_id FROM billing_transactions WHERE provider='paystack' AND reference=$1")
        .bind(&reference)
        .fetch_optional(&s.db)
        .await {
            Ok(Some(row)) => row.get::<Uuid,_>("organization_id"),
            Ok(None) => return Html("<html><body>Unknown Paystack transaction.</body></html>").into_response(),
            Err(e) => return db_error(e),
        };
    let _ = verify_paystack_transaction(&s.db, organization_id, &reference).await;
    let base = env::var("AGATA_PUBLIC_BASE_URL").unwrap_or_else(|_| "http://127.0.0.1:8080".into()).trim_end_matches('/').to_string();
    Html(format!(
        "<html><head><meta http-equiv=\"refresh\" content=\"0;url={base}/app?billing=complete\"></head><body style=\"background:#05080c;color:#eef7f8;font-family:Arial;padding:60px\">Payment verification complete. Returning to Agata Proxima…</body></html>"
    )).into_response()
}

pub(crate) async fn billing_verify(State(s):State<AppState>,headers:HeaderMap,Query(q):Query<std::collections::HashMap<String,String>>)->Response{
    let ctx=match authenticate(&s,&headers).await{Ok(v)=>v,Err(c)=>return c.into_response()};let reference=match q.get("reference").or_else(||q.get("trxref")){Some(v) if !v.trim().is_empty()=>v.trim(),_=>return bad("Paystack transaction reference is required.")};verify_paystack_transaction(&s.db,ctx.organization_id,reference).await
}
async fn verify_paystack_transaction(db:&sqlx::PgPool,org:Uuid,reference:&str)->Response{
    let secret=match env::var("PAYSTACK_SECRET_KEY"){Ok(v) if !v.trim().is_empty()=>v,_=>return service_unavailable("Paystack secret is not configured.")};let response=match Client::new().get(format!("https://api.paystack.co/transaction/verify/{reference}")).bearer_auth(secret).send().await{Ok(v)=>v,Err(e)=>return external_error(e)};if !response.status().is_success(){return paystack_error(response).await;}
    let body:Value=match response.json().await{Ok(v)=>v,Err(e)=>return external_error(e)};if body.get("status").and_then(Value::as_bool)!=Some(true){return service_unavailable("Paystack transaction verification failed.");}
    let data=body.get("data").cloned().unwrap_or(Value::Null);let status=data.get("status").and_then(Value::as_str).unwrap_or_default();let metadata_org=data.pointer("/metadata/organization_id").and_then(Value::as_str).and_then(|v|Uuid::parse_str(v).ok());if metadata_org!=Some(org){return (StatusCode::FORBIDDEN,Json(json!({"ok":false,"error":"transaction_organization_mismatch"}))).into_response();}
    let plan_code=data.pointer("/plan/plan_code").and_then(Value::as_str);let plan=plan_code.and_then(|v|plan_for_code(Some(v))).unwrap_or("free");let amount=data.get("amount").and_then(Value::as_i64);let currency=data.get("currency").and_then(Value::as_str).unwrap_or("USD");
    if let Err(e)=sqlx::query("UPDATE billing_transactions SET transaction_id=$1,plan_key=$2,plan_code=$3,amount=$4,currency=$5,status=$6,payload=$7,updated_at=now() WHERE provider='paystack' AND reference=$8 AND organization_id=$9").bind(data.get("id").and_then(Value::as_u64).map(|v|v as i64)).bind(plan).bind(plan_code).bind(amount).bind(currency).bind(status).bind(&data).bind(reference).bind(org).execute(db).await{return db_error(e);}
    if status=="success"{if let Err(e)=apply_entitlements(db,org,plan).await{return db_error(e)}if let Err(e)=sqlx::query("UPDATE billing_accounts SET paystack_plan_code=$1,plan_key=$2,status='active',updated_at=now() WHERE organization_id=$3").bind(plan_code).bind(plan).bind(org).execute(db).await{return db_error(e)}}
    Json(json!({"ok":true,"verified":status=="success","provider":"paystack","reference":reference,"status":status,"plan":plan})).into_response()
}
pub(crate) async fn portal(State(s):State<AppState>,headers:HeaderMap)->Response{
    let ctx=match authenticate(&s,&headers).await{Ok(v)=>v,Err(c)=>return c.into_response()};if let Err(c)=require_write(&ctx,&headers){return c.into_response();}
    let secret=match env::var("PAYSTACK_SECRET_KEY"){Ok(v) if !v.trim().is_empty()=>v,_=>return service_unavailable("Paystack secret is not configured.")};let code=match sqlx::query("SELECT paystack_subscription_code FROM billing_accounts WHERE organization_id=$1").bind(ctx.organization_id).fetch_optional(&s.db).await{Ok(Some(r))=>r.get::<Option<String>,_>("paystack_subscription_code"),Ok(None)=>None,Err(e)=>return db_error(e)};let code=match code{Some(v)=>v,None=>return bad("No Paystack subscription exists for this organization yet.")};
    let response=match Client::new().get(format!("https://api.paystack.co/subscription/{code}/manage/link")).bearer_auth(secret).send().await{Ok(r)=>r,Err(e)=>return external_error(e)};if !response.status().is_success(){return paystack_error(response).await;}let body:Value=match response.json().await{Ok(v)=>v,Err(e)=>return external_error(e)};let url=body.pointer("/data/link").and_then(Value::as_str).unwrap_or_default();if url.is_empty(){return service_unavailable("Paystack did not return a subscription management URL.");}Json(json!({"ok":true,"provider":"paystack","portal_url":url})).into_response()
}
pub(crate) async fn paystack_webhook(State(s):State<AppState>,headers:HeaderMap,body:String)->Response{
    let signature=match headers.get("x-paystack-signature").and_then(|v|v.to_str().ok()){Some(v)=>v,None=>return StatusCode::BAD_REQUEST.into_response()};let secret=match env::var("PAYSTACK_SECRET_KEY"){Ok(v) if !v.trim().is_empty()=>v,_=>return StatusCode::SERVICE_UNAVAILABLE.into_response()};if !verify_paystack_signature(&body,signature,&secret){return StatusCode::UNAUTHORIZED.into_response();}
    let event:Value=match serde_json::from_str(&body){Ok(v)=>v,Err(_)=>return StatusCode::BAD_REQUEST.into_response()};let event_type=event.get("event").and_then(Value::as_str).unwrap_or_default();if event_type.is_empty(){return StatusCode::BAD_REQUEST.into_response();}let data=event.get("data").cloned().unwrap_or(Value::Null);
    let key=data.get("id").and_then(Value::as_i64).map(|v|v.to_string()).or_else(||data.get("reference").and_then(Value::as_str).map(ToOwned::to_owned)).unwrap_or_else(||format!("{}:{}",event_type,hex::encode(Digest::digest(body.as_bytes()))));
    let inserted=match sqlx::query("INSERT INTO billing_events(provider,provider_event_id,event_type,payload) VALUES('paystack',$1,$2,$3) ON CONFLICT(provider,provider_event_id) DO NOTHING").bind(&key).bind(event_type).bind(&event).execute(&s.db).await{Ok(v)=>v.rows_affected()==1,Err(e)=>return db_error(e)};if !inserted{return Json(json!({"received":true,"duplicate":true})).into_response();}
    let org=if let Some(v)=data.pointer("/metadata/organization_id").and_then(Value::as_str).and_then(|v|Uuid::parse_str(v).ok()){Some(v)}else if let Some(code)=data.pointer("/customer/customer_code").and_then(Value::as_str).or_else(||data.get("customer_code").and_then(Value::as_str)){sqlx::query("SELECT organization_id FROM billing_accounts WHERE paystack_customer_code=$1").bind(code).fetch_optional(&s.db).await.ok().flatten().map(|r|r.get::<Uuid,_>("organization_id"))}else if let Some(reference)=data.get("reference").and_then(Value::as_str){sqlx::query("SELECT organization_id FROM billing_transactions WHERE provider='paystack' AND reference=$1").bind(reference).fetch_optional(&s.db).await.ok().flatten().map(|r|r.get::<Uuid,_>("organization_id"))}else{None};
    if let Some(org)=org{
        let plan_code=data.pointer("/plan/plan_code").and_then(Value::as_str).or_else(||data.pointer("/subscription/plan/plan_code").and_then(Value::as_str)).or_else(||data.pointer("/subscription/plan_code").and_then(Value::as_str)).or_else(||data.get("plan_code").and_then(Value::as_str));let plan=plan_code.and_then(|v|plan_for_code(Some(v))).unwrap_or("free");
        match event_type{
            "charge.success"|"subscription.create"|"subscription.enable"=>{let customer=data.pointer("/customer/customer_code").and_then(Value::as_str).or_else(||data.get("customer_code").and_then(Value::as_str));let subscription=data.get("subscription_code").and_then(Value::as_str).or_else(||data.pointer("/subscription/subscription_code").and_then(Value::as_str));let end=data.get("next_payment_date").and_then(Value::as_str).and_then(|v|chrono::DateTime::parse_from_rfc3339(v).ok()).map(|v|v.with_timezone(&chrono::Utc));if let Err(e)=sqlx::query("INSERT INTO billing_accounts(organization_id,paystack_customer_code,paystack_subscription_code,paystack_plan_code,plan_key,status,current_period_end,cancel_at_period_end,updated_at) VALUES($1,$2,$3,$4,$5,'active',$6,false,now()) ON CONFLICT(organization_id) DO UPDATE SET paystack_customer_code=COALESCE(EXCLUDED.paystack_customer_code,billing_accounts.paystack_customer_code),paystack_subscription_code=COALESCE(EXCLUDED.paystack_subscription_code,billing_accounts.paystack_subscription_code),paystack_plan_code=COALESCE(EXCLUDED.paystack_plan_code,billing_accounts.paystack_plan_code),plan_key=EXCLUDED.plan_key,status='active',current_period_end=EXCLUDED.current_period_end,cancel_at_period_end=false,updated_at=now()").bind(org).bind(customer).bind(subscription).bind(plan_code).bind(plan).bind(end).execute(&s.db).await{return db_error(e)}if let Err(e)=apply_entitlements(&s.db,org,plan).await{return db_error(e)}}
            "invoice.payment_failed"|"subscription.disable"|"subscription.not_renew"=>{let st=if event_type=="subscription.disable"{"canceled"}else if event_type=="subscription.not_renew"{"non-renewing"}else{"attention"};if let Err(e)=sqlx::query("UPDATE billing_accounts SET status=$1,cancel_at_period_end=$2,updated_at=now() WHERE organization_id=$3").bind(st,event_type=="subscription.not_renew",org).execute(&s.db).await{return db_error(e)}if event_type!="subscription.not_renew"{if let Err(e)=sqlx::query("UPDATE organization_entitlements SET billing_status=$1,updated_at=now() WHERE organization_id=$2").bind(st,org).execute(&s.db).await{return db_error(e)}}}
            "subscription.expiring_cards"=>{let _=sqlx::query("UPDATE billing_accounts SET status='attention',updated_at=now() WHERE organization_id=$1").bind(org).execute(&s.db).await;}
            "refund.pending"|"refund.processing"|"refund.processed"|"refund.failed"|"refund.needs-attention"=>{if let Some(reference)=data.get("reference").and_then(Value::as_str){let _=sqlx::query("UPDATE billing_transactions SET refund_status=$1,updated_at=now() WHERE provider='paystack' AND reference=$2 AND organization_id=$3").bind(event_type.trim_start_matches("refund.")).bind(reference).bind(org).execute(&s.db).await;}}
            _=>{}
        }
    }
    let _=sqlx::query("UPDATE billing_events SET status='processed',processed_at=now() WHERE provider='paystack' AND provider_event_id=$1").bind(&key).execute(&s.db).await;
    Json(json!({"received":true})).into_response()
}

pub(crate) async fn readiness(State(s): State<AppState>) -> Response {
    let db_ok=sqlx::query("SELECT 1").execute(&s.db).await.is_ok();
    let paystack=env::var("PAYSTACK_SECRET_KEY").map(|v|!v.trim().is_empty()).unwrap_or(false);
    let plans=["AGATA_PAYSTACK_STARTER_PLAN_CODE","AGATA_PAYSTACK_GROWTH_PLAN_CODE","AGATA_PAYSTACK_SCALE_PLAN_CODE"].iter().all(|k|env::var(k).map(|v|!v.trim().is_empty()).unwrap_or(false));
    let resend=env::var("RESEND_API_KEY").map(|v|!v.is_empty()).unwrap_or(false);let from=env::var("RESEND_FROM_EMAIL").map(|v|!v.is_empty()).unwrap_or(false);let base=env::var("AGATA_PUBLIC_BASE_URL").map(|v|!v.is_empty()).unwrap_or(false);let oidc=env::var("PROXIMA_OIDC_CLIENT_ID").map(|v|!v.is_empty()).unwrap_or(false)&&env::var("PROXIMA_OIDC_CLIENT_SECRET").map(|v|!v.is_empty()).unwrap_or(false);let all=db_ok&&paystack&&plans&&resend&&from&&base&&oidc;
    Json(json!({"status":if all{"ready"}else{"needs_configuration"},"checks":{"database":db_ok,"paystack_secret":paystack,"paystack_plans":plans,"resend_api_key":resend,"resend_from":from,"public_base_url":base,"oidc":oidc,"engine_remains_authoritative":true}})).into_response()
}

pub(crate) async fn send_template_email(
    to: &str,
    template_id: &str,
    variables: Value,
) -> anyhow::Result<()> {
    let key = env::var("RESEND_API_KEY")?;
    let from = match env::var("RESEND_FROM_EMAIL") {
        Ok(v) if !v.trim().is_empty() => v,
        _ => anyhow::bail!("RESEND_FROM_EMAIL is not configured for the current deployment"),
    };
    let response = Client::new()
        .post("https://api.resend.com/emails")
        .bearer_auth(key)
        .json(&json!({
            "from": from,
            "to": [to],
            "template": {
                "id": template_id,
                "variables": variables
            }
        }))
        .send()
        .await?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        anyhow::bail!("Resend returned {status}: {body}");
    }
    Ok(())
}

fn verify_paystack_signature(payload:&str,signature:&str,secret:&str)->bool{let mut mac=match HmacSha512::new_from_slice(secret.as_bytes()){Ok(v)=>v,Err(_)=>return false};mac.update(payload.as_bytes());let expected=hex::encode(mac.finalize().into_bytes());constant_time_equal(signature.trim(),&expected)}

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

async fn paystack_error(response:reqwest::Response)->Response{let status=response.status();let body=response.text().await.unwrap_or_default();tracing::error!(%status,body=%body,"Paystack API error");service_unavailable("Paystack request failed.")}

fn external_error<E: std::fmt::Display>(e: E) -> Response {
    tracing::error!(error = %e, "external integration error");
    service_unavailable("External integration request failed.")
}

pub(crate) fn service_unavailable(message: &str) -> Response {
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
    fn paystack_signature_round_trip(){let payload=r#"{"event":"charge.success","data":{"reference":"ref_test"}}"#;let secret="sk_test";let mut mac=HmacSha512::new_from_slice(secret.as_bytes()).unwrap();mac.update(payload.as_bytes());let signature=hex::encode(mac.finalize().into_bytes());assert!(verify_paystack_signature(payload,&signature,secret));}
    #[test]
    fn invalid_paystack_signature_is_rejected(){assert!(!verify_paystack_signature("payload","invalid","sk_test"));}

}
