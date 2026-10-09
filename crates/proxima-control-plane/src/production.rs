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
    audit, authenticate, bad, create_session, db_error, hash_password, internal, require_admin, require_write, token_hash, valid_public_support_email,
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
fn lemon_variant_id(plan: &str) -> Option<String> {
    let key = match plan {
        "starter" => "LEMON_SQUEEZY_STARTER_VARIANT_ID",
        "growth" => "LEMON_SQUEEZY_GROWTH_VARIANT_ID",
        "scale" => "LEMON_SQUEEZY_SCALE_VARIANT_ID",
        _ => return None,
    };
    env::var(key).ok().map(|v| v.trim().to_owned()).filter(|v| !v.is_empty() && v.chars().all(|c| c.is_ascii_digit()))
}
fn plan_for_code(variant_id: Option<&str>) -> Option<&'static str> {
    for plan in ["starter", "growth", "scale"] {
        if lemon_variant_id(plan).as_deref() == variant_id { return Some(match plan { "starter"=>"starter", "growth"=>"growth", _=>"scale" }); }
    }
    None
}
fn configured_lemonsqueezy_variants_unique() -> bool {
    let values = ["starter","growth","scale"].map(lemon_variant_id);
    values.iter().all(|v| v.as_ref().is_some_and(|x| !x.is_empty()))
        && values[0] != values[1] && values[0] != values[2] && values[1] != values[2]
}
fn expected_lemonsqueezy_amount(plan: &str) -> Option<i64> {
    match plan { "starter"=>Some(14_900), "growth"=>Some(49_900), "scale"=>Some(119_900), _=>None }
}
fn lemonsqueezy_test_mode() -> bool {
    env::var("LEMON_SQUEEZY_TEST_MODE").map(|v| matches!(v.trim().to_ascii_lowercase().as_str(),"true"|"1"|"yes")).unwrap_or(true)
}
fn verify_lemonsqueezy_signature(payload: &str, signature: &str, secret: &str) -> bool {
    type HmacSha256 = Hmac<sha2::Sha256>;
    let mut mac = match HmacSha256::new_from_slice(secret.as_bytes()) { Ok(v)=>v, Err(_)=>return false };
    mac.update(payload.as_bytes());
    constant_time_equal(&hex::encode(mac.finalize().into_bytes()), signature.trim())
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

fn plan_integration_limit(plan: &str) -> i32 {
    match plan {
        "starter" => 5,
        "growth" => 20,
        "scale" => 100,
        "enterprise" => i32::MAX,
        _ => 1,
    }
}

fn plan_verification_limit(plan: &str) -> i32 {
    match plan {
        "starter" => 1_000,
        "growth" => 10_000,
        "scale" => 100_000,
        "enterprise" => i32::MAX,
        _ => 100,
    }
}

fn plan_team_seat_limit(plan: &str) -> i32 {
    match plan {
        "starter" => 5,
        "growth" => 15,
        "scale" => 50,
        "enterprise" => i32::MAX,
        _ => 1,
    }
}

fn plan_api_key_limit(plan: &str) -> i32 {
    match plan {
        "starter" => 5,
        "growth" => 25,
        "scale" => 100,
        "enterprise" => i32::MAX,
        _ => 1,
    }
}

fn plan_api_requests_per_minute(plan: &str) -> i32 {
    match plan {
        "starter" => 300,
        "growth" => 1_000,
        "scale" => 5_000,
        "enterprise" => i32::MAX,
        _ => 60,
    }
}

fn plan_support_level(plan: &str) -> &'static str {
    match plan {
        "starter" => "standard",
        "growth" => "priority",
        "scale" => "priority_plus",
        "enterprise" => "enterprise_custom",
        _ => "community",
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
        _ => return Err(bad("Unsupported capacity resource.")),
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
pub(crate) async fn enforce_integration_capacity(
    db: &sqlx::PgPool,
    organization_id: Uuid,
) -> Result<(), Response> {
    let row = sqlx::query(
        "SELECT integration_limit,billing_status,plan_key
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
            Json(json!({
                "ok": false,
                "error": "subscription_inactive",
                "message": "Restore an active Agata Proxima subscription to create integrations."
            })),
        ).into_response());
    }

    let limit: i32 = row.get("integration_limit");
    let count: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM webhooks WHERE organization_id=$1 AND enabled IS TRUE",
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
                "ok": false,
                "error": "plan_limit_reached",
                "resource": "integrations",
                "limit": limit,
                "plan": plan,
                "message": "Active integration capacity reached. Upgrade the Agata Proxima plan to continue."
            })),
        ).into_response());
    }

    Ok(())
}

#[allow(clippy::result_large_err)]
pub(crate) async fn enforce_api_key_capacity(
    db: &sqlx::PgPool,
    organization_id: Uuid,
) -> Result<(), Response> {
    let row = sqlx::query(
        "SELECT api_key_limit,billing_status,plan_key
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
            Json(json!({
                "ok": false,
                "error": "subscription_inactive",
                "message": "Restore an active Agata Proxima subscription to create API keys."
            })),
        ).into_response());
    }

    let limit: i32 = row.get("api_key_limit");
    let used: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM api_keys WHERE organization_id=$1 AND revoked_at IS NULL",
    )
    .bind(organization_id)
    .fetch_one(db)
    .await
    .map_err(db_error)?;

    if used >= i64::from(limit) {
        let plan: String = row.get("plan_key");
        return Err((
            StatusCode::PAYMENT_REQUIRED,
            Json(json!({
                "ok": false,
                "error": "plan_limit_reached",
                "resource": "api_keys",
                "limit": limit,
                "used": used,
                "plan": plan,
                "message": "Active API key capacity reached. Revoke an unused key or upgrade the plan."
            })),
        ).into_response());
    }

    Ok(())
}

pub(crate) async fn consume_api_request(
    db: &sqlx::PgPool,
    organization_id: Uuid,
) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar("SELECT proxima_consume_api_request($1)")
        .bind(organization_id)
        .fetch_one(db)
        .await
}

pub(crate) async fn purge_expired_api_rate_windows(db: &sqlx::PgPool) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar("SELECT proxima_purge_expired_api_rate_windows()")
        .fetch_one(db)
        .await
}

pub(crate) async fn reconcile_billing_lifecycle(db: &sqlx::PgPool) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar("SELECT proxima_reconcile_billing_lifecycle()")
        .fetch_one(db)
        .await
}

#[allow(clippy::result_large_err)]
pub(crate) async fn enforce_team_seat_capacity(
    db: &sqlx::PgPool,
    organization_id: Uuid,
    invite_email: Option<&str>,
) -> Result<(), Response> {
    let row = sqlx::query(
        "SELECT team_seat_limit,billing_status,plan_key
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
            Json(json!({
                "ok": false,
                "error": "subscription_inactive",
                "message": "Restore an active Agata Proxima subscription to add team seats."
            })),
        ).into_response());
    }

    let limit: i32 = row.get("team_seat_limit");
    let used: i64 = sqlx::query_scalar(
        "SELECT
           (SELECT count(*) FROM memberships WHERE organization_id=$1)
           +
           (SELECT count(*) FROM organization_invites
             WHERE organization_id=$1
               AND accepted_at IS NULL
               AND expires_at > now()
               AND ($2::text IS NULL OR lower(email) <> lower($2)))",
    )
    .bind(organization_id)
    .bind(invite_email)
    .fetch_one(db)
    .await
    .map_err(db_error)?;

    if used >= i64::from(limit) {
        let plan: String = row.get("plan_key");
        return Err((
            StatusCode::PAYMENT_REQUIRED,
            Json(json!({
                "ok": false,
                "error": "plan_limit_reached",
                "resource": "team_seats",
                "limit": limit,
                "used": used,
                "plan": plan,
                "message": "Team seat capacity reached. Upgrade the Agata Proxima plan or remove a member/pending invitation."
            })),
        ).into_response());
    }

    Ok(())
}

#[allow(clippy::result_large_err)]
pub(crate) async fn enforce_verification_quota(
    db: &sqlx::PgPool,
    organization_id: Uuid,
) -> Result<(), Response> {
    let row = sqlx::query(
        "SELECT verification_limit_monthly,billing_status,plan_key
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
            Json(json!({
                "ok": false,
                "error": "subscription_inactive",
                "message": "Restore an active Agata Proxima subscription to run verifications."
            })),
        ).into_response());
    }

    let limit: i32 = row.get("verification_limit_monthly");
    let used: i64 = sqlx::query_scalar(
        "SELECT COALESCE((
            SELECT used_count FROM organization_verification_usage
             WHERE organization_id=$1
               AND period_start=date_trunc('month', now() AT TIME ZONE 'UTC')::date
        ), 0)::bigint",
    )
    .bind(organization_id)
    .fetch_one(db)
    .await
    .map_err(db_error)?;

    if used >= i64::from(limit) {
        let plan: String = row.get("plan_key");
        return Err((
            StatusCode::PAYMENT_REQUIRED,
            Json(json!({
                "ok": false,
                "error": "plan_limit_reached",
                "resource": "verifications",
                "limit": limit,
                "used": used,
                "plan": plan,
                "message": "Monthly verification quota reached. Upgrade the Agata Proxima plan or wait for the next UTC calendar month."
            })),
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
        _ => {
            return Err((
                StatusCode::FORBIDDEN,
                Json(json!({
                    "ok": false,
                    "error": "unknown_feature_entitlement",
                    "feature": feature
                })),
            ).into_response());
        },
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
        let plan_code=lemon_variant_id(key);
        let (nodes,tenants,environments,retention,advanced,fleet,priority,entra,private_deployment)=plan_limits(key);
        let integrations = plan_integration_limit(key);
        let verifications = plan_verification_limit(key);
        let team_seats = plan_team_seat_limit(key);
        let api_keys = plan_api_key_limit(key);
        let api_requests = plan_api_requests_per_minute(key);
        let support = plan_support_level(key);
        json!({"key":key,"name":name,"monthly_usd":monthly_usd,"description":description,"provider":"lemonsqueezy","variant_id":plan_code,"checkout_available":key!=&"free"&&key!=&"enterprise"&&lemon_variant_id(key).is_some()&&configured_lemonsqueezy_variants_unique(),"limits":{"nodes":nodes,"tenants":tenants,"environments":environments,"integrations":integrations,"verifications_per_month":verifications,"team_seats":team_seats,"api_keys":api_keys,"api_requests_per_minute":api_requests,"audit_retention_days":retention},"support_level":support,"features":{"advanced_verification":advanced,"fleet_controls":fleet,"priority_support":priority,"entra_oidc":entra,"private_deployment":private_deployment,"policy_management":key!=&"free"}})
    }).collect::<Vec<_>>();
    Json(json!({"currency":"usd","billing_interval":"month","provider":"lemonsqueezy","plans":plans})).into_response()
}

pub(crate) async fn entitlements(State(s): State<AppState>, headers: HeaderMap) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    match sqlx::query(
        "SELECT plan_key,billing_status,node_limit,tenant_limit,environment_limit,integration_limit,
                verification_limit_monthly,team_seat_limit,api_key_limit,api_requests_per_minute,support_level,billing_grace_until,
                COALESCE((SELECT request_count FROM api_rate_limit_windows w WHERE w.organization_id=organization_entitlements.organization_id AND w.window_start=date_trunc('minute',now())),0)::bigint AS api_requests_this_minute,
                COALESCE((SELECT count(*) FROM memberships m WHERE m.organization_id=organization_entitlements.organization_id),0)::bigint AS active_team_members,
                COALESCE((SELECT count(*) FROM organization_invites i WHERE i.organization_id=organization_entitlements.organization_id AND i.accepted_at IS NULL AND i.expires_at>now()),0)::bigint AS pending_team_invites,
                COALESCE((SELECT used_count FROM organization_verification_usage u
                          WHERE u.organization_id=organization_entitlements.organization_id
                            AND u.period_start=date_trunc('month', now() AT TIME ZONE 'UTC')::date),0)::bigint AS verifications_used,
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
                "integrations": row.get::<i32,_>("integration_limit"),
                "verifications_per_month": row.get::<i32,_>("verification_limit_monthly"),
                "team_seats": row.get::<i32,_>("team_seat_limit"),
                "api_keys": row.get::<i32,_>("api_key_limit"),
                "api_requests_per_minute": row.get::<i32,_>("api_requests_per_minute"),
                "audit_retention_days": row.get::<i32,_>("audit_retention_days")
            },
            "support_level": row.get::<String,_>("support_level"),
            "billing_grace_until": row.get::<Option<chrono::DateTime<chrono::Utc>>,_>("billing_grace_until"),
            "usage": {
                "api_requests_this_minute": row.get::<i64,_>("api_requests_this_minute"),
                "verifications_this_month": row.get::<i64,_>("verifications_used"),
                "active_team_members": row.get::<i64,_>("active_team_members"),
                "pending_team_invites": row.get::<i64,_>("pending_team_invites")
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
    let integrations = plan_integration_limit(plan);
    let verifications = plan_verification_limit(plan);
    let team_seats = plan_team_seat_limit(plan);
    let api_keys = plan_api_key_limit(plan);
    let api_requests = plan_api_requests_per_minute(plan);
    let support = plan_support_level(plan);
    sqlx::query(
        "INSERT INTO organization_entitlements
            (organization_id,plan_key,billing_status,node_limit,tenant_limit,environment_limit,
             integration_limit,verification_limit_monthly,team_seat_limit,api_key_limit,
             api_requests_per_minute,support_level,audit_retention_days,advanced_verification,
             fleet_controls,priority_support,entra_oidc,private_deployment,updated_at)
         VALUES($1,$2,'active',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now())
         ON CONFLICT (organization_id) DO UPDATE SET
            plan_key=EXCLUDED.plan_key,billing_status=EXCLUDED.billing_status,
            node_limit=EXCLUDED.node_limit,tenant_limit=EXCLUDED.tenant_limit,
            environment_limit=EXCLUDED.environment_limit,integration_limit=EXCLUDED.integration_limit,
            verification_limit_monthly=EXCLUDED.verification_limit_monthly,
            team_seat_limit=EXCLUDED.team_seat_limit,api_key_limit=EXCLUDED.api_key_limit,
            api_requests_per_minute=EXCLUDED.api_requests_per_minute,support_level=EXCLUDED.support_level,
            audit_retention_days=EXCLUDED.audit_retention_days,
            advanced_verification=EXCLUDED.advanced_verification,fleet_controls=EXCLUDED.fleet_controls,
            priority_support=EXCLUDED.priority_support,entra_oidc=EXCLUDED.entra_oidc,
            private_deployment=EXCLUDED.private_deployment,billing_grace_until=NULL,updated_at=now()"
    )
    .bind(organization_id).bind(plan).bind(nodes).bind(tenants).bind(environments).bind(integrations).bind(verifications).bind(team_seats).bind(api_keys).bind(api_requests).bind(support).bind(retention)
    .bind(advanced).bind(fleet).bind(priority).bind(entra).bind(private_deployment)
    .execute(db).await?;
    Ok(())
}


pub(crate) async fn entra_status(State(s): State<AppState>, headers: HeaderMap) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(value) => value,
        Err(response) => return response.into_response(),
    };
    if !matches!(ctx.role.as_str(), "owner" | "admin") {
        return StatusCode::FORBIDDEN.into_response();
    }
    if let Err(response) = require_feature(&s.db, ctx.organization_id, "entra_oidc").await {
        return response;
    }

    match sqlx::query(
        "SELECT tenant_id,enabled,jit_provisioning FROM organization_oidc_connections
         WHERE organization_id=$1 AND provider='microsoft-entra'"
    ).bind(ctx.organization_id).fetch_optional(&s.db).await {
        Ok(Some(row)) => Json(json!({
            "ok": true,
            "provider": "microsoft-entra",
            "configured": row.get::<bool, _>("enabled"),
            "tenant_id": row.get::<Uuid, _>("tenant_id"),
            "jit_provisioning": row.get::<bool, _>("jit_provisioning")
        })).into_response(),
        Ok(None) => Json(json!({
            "ok": true,
            "provider": "microsoft-entra",
            "configured": false,
            "tenant_id": null,
            "jit_provisioning": false
        })).into_response(),
        Err(error) => db_error(error),
    }
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
           client_id=EXCLUDED.client_id,enabled=true,jit_provisioning=EXCLUDED.jit_provisioning,updated_at=now()"
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
    let organization_id = if let Some(raw_id) = q.get("organization_id") {
        match Uuid::parse_str(raw_id) {
            Ok(value) => value,
            Err(_) => return bad("organization_id must be a UUID."),
        }
    } else if let Some(slug) = q.get("organization_slug").map(|value| value.trim()).filter(|value| !value.is_empty()) {
        match sqlx::query("SELECT id FROM organizations WHERE lower(slug)=lower($1)")
            .bind(slug)
            .fetch_optional(&s.db)
            .await {
                Ok(Some(row)) => row.get::<Uuid, _>("id"),
                Ok(None) => return bad("Microsoft Entra SSO is not configured for this organization."),
                Err(error) => return db_error(error),
            }
    } else {
        return bad("organization_slug is required.");
    };
    if let Err(response) = require_feature(&s.db, organization_id, "entra_oidc").await {
        return response;
    }
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
    if let Err(response) = require_feature(&s.db, organization_id, "entra_oidc").await {
        return response;
    }

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
        Ok(None)=>Json(json!({"configured":false,"provider":"lemonsqueezy","plan":"free","status":"active"})).into_response(),Err(e)=>db_error(e)
    }
}
pub(crate) async fn checkout(State(s): State<AppState>, headers: HeaderMap, Json(input): Json<CheckoutInput>) -> Response {
    let ctx = match authenticate(&s,&headers).await { Ok(v)=>v, Err(c)=>return c.into_response() };
    if let Err(c)=require_admin(&ctx,&headers) { return c.into_response(); }
    let api_key = match env::var("LEMON_SQUEEZY_API_KEY") { Ok(v) if !v.trim().is_empty()=>v, _=>return service_unavailable("Lemon Squeezy API key is not configured.") };
    let store_id = match env::var("LEMON_SQUEEZY_STORE_ID") { Ok(v) if !v.trim().is_empty() && v.chars().all(|c|c.is_ascii_digit())=>v, _=>return service_unavailable("Lemon Squeezy store ID is not configured.") };
    if !configured_lemonsqueezy_variants_unique() { return service_unavailable("Lemon Squeezy Starter, Growth, and Scale variant IDs must be configured and unique."); }
    let plan = match input.price_id.as_deref() {
        Some(v) if ["starter","growth","scale"].contains(&v.trim()) => v.trim(),
        Some(v) => match plan_for_code(Some(v.trim())) { Some(p)=>p, None=>return bad("Select a valid Agata Proxima plan.") },
        None=>return bad("Select an Agata Proxima plan before checkout."),
    };
    let variant_id = lemon_variant_id(plan).expect("validated variant");
    let client=Client::builder().timeout(std::time::Duration::from_secs(12)).build().unwrap_or_else(|_|Client::new());
    let variant_response=match client.get(format!("https://api.lemonsqueezy.com/v1/variants/{variant_id}"))
        .bearer_auth(&api_key).header("Accept","application/vnd.api+json").send().await { Ok(r)=>r,Err(e)=>return external_error(e) };
    if !variant_response.status().is_success() { return service_unavailable("Could not validate the configured Lemon Squeezy variant."); }
    let variant_body:Value=match variant_response.json().await { Ok(v)=>v,Err(e)=>return external_error(e) };
    let attrs=variant_body.pointer("/data/attributes").cloned().unwrap_or(Value::Null);
    let expected=expected_lemonsqueezy_amount(plan);
    let valid=attrs.get("price").and_then(Value::as_i64)==expected
        && attrs.get("is_subscription").and_then(Value::as_bool)==Some(true)
        && attrs.get("interval").and_then(Value::as_str)==Some("month")
        && attrs.get("interval_count").and_then(Value::as_i64).unwrap_or(1)==1
        && attrs.get("status").and_then(Value::as_str).map(|v|v=="published").unwrap_or(true)
        && attrs.get("test_mode").and_then(Value::as_bool).map(|v|v==lemonsqueezy_test_mode()).unwrap_or(false);
    if !valid { return service_unavailable("The Lemon Squeezy variant must match the exact monthly USD catalog price and selected test/live mode."); }
    let email=match sqlx::query("SELECT email FROM users WHERE id=$1").bind(ctx.user_id).fetch_one(&s.db).await { Ok(r)=>r.get::<String,_>("email"),Err(e)=>return db_error(e) };
    let base=env::var("AGATA_PUBLIC_BASE_URL").unwrap_or_else(|_|"http://127.0.0.1:8080".into()).trim_end_matches('/').to_owned();
    let payload=json!({"data":{"type":"checkouts","attributes":{
        "checkout_options":{"embed":false},
        "checkout_data":{"email":email,"custom":{"organization_id":ctx.organization_id.to_string(),"plan_key":plan}},
        "product_options":{"redirect_url":format!("{base}/app?billing=return")}
    },"relationships":{"store":{"data":{"type":"stores","id":store_id}},"variant":{"data":{"type":"variants","id":variant_id}}}}});
    let response=match client.post("https://api.lemonsqueezy.com/v1/checkouts").bearer_auth(&api_key)
        .header("Accept","application/vnd.api+json").header("Content-Type","application/vnd.api+json").json(&payload).send().await { Ok(r)=>r,Err(e)=>return external_error(e) };
    if !response.status().is_success(){return service_unavailable("Lemon Squeezy checkout creation failed.");}
    let body:Value=match response.json().await {Ok(v)=>v,Err(e)=>return external_error(e)};
    let data=body.get("data").cloned().unwrap_or(Value::Null);
    let checkout_id=data.get("id").and_then(Value::as_str).unwrap_or_default();
    let url=data.pointer("/attributes/url").and_then(Value::as_str).unwrap_or_default();
    if checkout_id.is_empty() || !(url.starts_with("https://") && url.contains("lemonsqueezy.com/checkout/")) { return service_unavailable("Lemon Squeezy did not return a valid checkout URL."); }
    if let Err(e)=sqlx::query("INSERT INTO billing_transactions(organization_id,provider,reference,provider_checkout_id,plan_key,plan_code,currency,status,metadata,payload,created_at,updated_at) VALUES($1,'lemonsqueezy',$2,$2,$3,$4,'USD','initialized',$5,$6,now(),now()) ON CONFLICT(provider,reference) DO NOTHING")
        .bind(ctx.organization_id).bind(checkout_id).bind(plan).bind(&variant_id).bind(&payload).bind(&body).execute(&s.db).await {return db_error(e);}
    audit(&s.db,ctx.organization_id,ctx.user_id,"billing.checkout.created","billing_transaction",None,json!({"provider":"lemonsqueezy","checkout_id":checkout_id,"plan":plan,"variant_id":variant_id})).await;
    Json(json!({"ok":true,"provider":"lemonsqueezy","checkout_url":url,"reference":checkout_id})).into_response()
}
pub(crate) async fn lemonsqueezy_callback() -> Response {
    let base=env::var("AGATA_PUBLIC_BASE_URL").unwrap_or_else(|_|"http://127.0.0.1:8080".into()).trim_end_matches('/').to_owned();
    Html(format!("<html><head><meta http-equiv=\"refresh\" content=\"0;url={base}/app?billing=return\"></head><body>Returning to Agata Proxima. Billing is confirmed only after a verified webhook.</body></html>")).into_response()
}
pub(crate) async fn billing_verify(State(s):State<AppState>,headers:HeaderMap,Query(q):Query<std::collections::HashMap<String,String>>)->Response {
    let ctx=match authenticate(&s,&headers).await{Ok(v)=>v,Err(c)=>return c.into_response()};
    if let Err(c)=require_admin(&ctx,&headers){return c.into_response();}
    let reference=match q.get("reference"){Some(v) if !v.trim().is_empty()=>v.trim(),_=>return bad("Lemon Squeezy checkout reference is required.")};
    match sqlx::query("SELECT status,plan_key FROM billing_transactions WHERE provider='lemonsqueezy' AND reference=$1 AND organization_id=$2").bind(reference).bind(ctx.organization_id).fetch_optional(&s.db).await {
        Ok(Some(r))=>Json(json!({"ok":true,"provider":"lemonsqueezy","reference":reference,"status":r.get::<String,_>("status"),"plan":r.get::<String,_>("plan_key"),"verified":r.get::<String,_>("status")=="success"})).into_response(),
        Ok(None)=>(StatusCode::NOT_FOUND,Json(json!({"ok":false,"error":"unknown_local_transaction"}))).into_response(),
        Err(e)=>db_error(e)
    }
}
pub(crate) async fn portal(State(s):State<AppState>,headers:HeaderMap)->Response {
    let ctx=match authenticate(&s,&headers).await{Ok(v)=>v,Err(c)=>return c.into_response()};
    if let Err(c)=require_admin(&ctx,&headers){return c.into_response();}
    let sub=match sqlx::query("SELECT lemonsqueezy_subscription_id,lemonsqueezy_customer_portal_url FROM billing_accounts WHERE organization_id=$1").bind(ctx.organization_id).fetch_optional(&s.db).await {
        Ok(Some(r))=>(r.get::<Option<String>,_>("lemonsqueezy_subscription_id"),r.get::<Option<String>,_>("lemonsqueezy_customer_portal_url")),
        Ok(None)=>return bad("No Lemon Squeezy subscription exists for this organization yet."),Err(e)=>return db_error(e)
    };
    if let Some(url)=sub.1.filter(|u|u.starts_with("https://")) {return Json(json!({"ok":true,"provider":"lemonsqueezy","portal_url":url})).into_response();}
    let id=match sub.0{Some(v)=>v,None=>return bad("No Lemon Squeezy subscription exists for this organization yet.")};
    let key=match env::var("LEMON_SQUEEZY_API_KEY"){Ok(v) if !v.trim().is_empty()=>v,_=>return service_unavailable("Lemon Squeezy API key is not configured.")};
    let response=match Client::new().get(format!("https://api.lemonsqueezy.com/v1/subscriptions/{id}")).bearer_auth(key).header("Accept","application/vnd.api+json").send().await{Ok(r)=>r,Err(e)=>return external_error(e)};
    if !response.status().is_success(){return service_unavailable("Lemon Squeezy subscription portal could not be retrieved.");}
    let body:Value=match response.json().await{Ok(v)=>v,Err(e)=>return external_error(e)};
    match body.pointer("/data/attributes/urls/customer_portal").and_then(Value::as_str).filter(|u|u.starts_with("https://")) {
        Some(url)=>Json(json!({"ok":true,"provider":"lemonsqueezy","portal_url":url})).into_response(),
        None=>service_unavailable("Lemon Squeezy did not return a customer portal URL.")
    }
}
pub(crate) async fn lemonsqueezy_webhook(State(s):State<AppState>,headers:HeaderMap,body:String)->Response {
    let signature=match headers.get("x-signature").and_then(|v|v.to_str().ok()){Some(v)=>v,None=>return StatusCode::BAD_REQUEST.into_response()};
    let secret=match env::var("LEMON_SQUEEZY_WEBHOOK_SECRET"){Ok(v) if !v.trim().is_empty()=>v,_=>return StatusCode::SERVICE_UNAVAILABLE.into_response()};
    if !verify_lemonsqueezy_signature(&body,signature,&secret){return StatusCode::UNAUTHORIZED.into_response();}
    let event:Value=match serde_json::from_str(&body){Ok(v)=>v,Err(_)=>return StatusCode::BAD_REQUEST.into_response()};
    let event_type=event.pointer("/meta/event_name").and_then(Value::as_str).unwrap_or_default();
    let data=event.get("data").cloned().unwrap_or(Value::Null);
    let attrs=data.get("attributes").cloned().unwrap_or(Value::Null);
    let id=data.get("id").and_then(Value::as_str).unwrap_or_default();
    if event_type.is_empty()||id.is_empty(){return StatusCode::BAD_REQUEST.into_response();}
    if let Ok(expected_store)=env::var("LEMON_SQUEEZY_STORE_ID"){
        if attrs.get("store_id").and_then(Value::as_i64).map(|v|v.to_string()).as_deref()!=Some(expected_store.trim()){return StatusCode::FORBIDDEN.into_response();}
    } else { return StatusCode::SERVICE_UNAVAILABLE.into_response(); }
    if attrs.get("test_mode").and_then(Value::as_bool).map(|v|v!=lemonsqueezy_test_mode()).unwrap_or(false){return StatusCode::FORBIDDEN.into_response();}
    let event_key=format!("{}:{}:{}",event_type,id,hex::encode(Sha256::digest(body.as_bytes())));
    let claimed=match sqlx::query("INSERT INTO billing_events(provider,provider_event_id,event_type,payload,status,processing_started_at,attempt_count) VALUES('lemonsqueezy',$1,$2,$3,'processing',now(),1) ON CONFLICT(provider,provider_event_id) DO NOTHING RETURNING id")
        .bind(&event_key).bind(event_type).bind(&event).fetch_optional(&s.db).await{Ok(v)=>v.is_some(),Err(e)=>return db_error(e)};
    if !claimed{return Json(json!({"received":true,"duplicate":true})).into_response();}
    let org=event.pointer("/meta/custom_data/organization_id").and_then(Value::as_str).and_then(|v|Uuid::parse_str(v).ok())
        .or_else(||None);
    let customer_id=attrs.get("customer_id").and_then(Value::as_i64).map(|v|v.to_string());
    let sub_id=if data.get("type").and_then(Value::as_str)==Some("subscriptions"){Some(id.to_owned())}else{None};
    let resolved=if let Some(org)=org{Some(org)}else if let Some(ref sid)=sub_id{
        match sqlx::query("SELECT organization_id FROM billing_accounts WHERE lemonsqueezy_subscription_id=$1").bind(sid).fetch_optional(&s.db).await{Ok(v)=>v.map(|r|r.get::<Uuid,_>("organization_id")),Err(e)=>return db_error(e)}
    }else if let Some(ref cid)=customer_id{
        match sqlx::query("SELECT organization_id FROM billing_accounts WHERE lemonsqueezy_customer_id=$1").bind(cid).fetch_optional(&s.db).await{Ok(v)=>v.map(|r|r.get::<Uuid,_>("organization_id")),Err(e)=>return db_error(e)}
    }else{None};
    let org=match resolved{Some(v)=>v,None=>{
        let _=sqlx::query("UPDATE billing_events SET status='ignored',processed_at=now(),processing_started_at=NULL WHERE provider='lemonsqueezy' AND provider_event_id=$1").bind(&event_key).execute(&s.db).await;
        return Json(json!({"received":true,"ignored":"organization_not_resolved"})).into_response();
    }};
    let variant=attrs.get("variant_id").and_then(Value::as_i64).map(|v|v.to_string());
    let plan=variant.as_deref().and_then(|v|plan_for_code(Some(v)));
    let status=attrs.get("status").and_then(Value::as_str).unwrap_or_default();
    let period_end=attrs.get("renews_at").or_else(||attrs.get("ends_at")).and_then(Value::as_str).and_then(|v|chrono::DateTime::parse_from_rfc3339(v).ok()).map(|v|v.with_timezone(&chrono::Utc));
    let active=matches!(status,"active"|"on_trial") || matches!(event_type,"subscription_created"|"subscription_payment_success"|"subscription_resumed"|"subscription_payment_recovered");
    let canceled=matches!(event_type,"subscription_cancelled") || attrs.get("cancelled").and_then(Value::as_bool)==Some(true);
    let mapped_status=if active{"active"}else if canceled{"active"}else if matches!(event_type,"subscription_payment_failed")||status=="past_due"{"past_due"}else if matches!(event_type,"subscription_expired")||status=="expired"{"expired"}else if status=="paused"{"paused"}else{"pending"};
    if let Some(plan)=plan {
        if active {
            if let Err(e)=apply_entitlements(&s.db,org,plan).await{return db_error(e);}
        }
        if let Err(e)=sqlx::query("INSERT INTO billing_accounts(organization_id,provider,lemonsqueezy_customer_id,lemonsqueezy_subscription_id,lemonsqueezy_variant_id,lemonsqueezy_customer_portal_url,plan_key,status,current_period_end,cancel_at_period_end,updated_at) VALUES($1,'lemonsqueezy',$2,$3,$4,$5,$6,$7,$8,$9,now()) ON CONFLICT(organization_id) DO UPDATE SET provider='lemonsqueezy',lemonsqueezy_customer_id=COALESCE(EXCLUDED.lemonsqueezy_customer_id,billing_accounts.lemonsqueezy_customer_id),lemonsqueezy_subscription_id=COALESCE(EXCLUDED.lemonsqueezy_subscription_id,billing_accounts.lemonsqueezy_subscription_id),lemonsqueezy_variant_id=EXCLUDED.lemonsqueezy_variant_id,lemonsqueezy_customer_portal_url=COALESCE(EXCLUDED.lemonsqueezy_customer_portal_url,billing_accounts.lemonsqueezy_customer_portal_url),plan_key=EXCLUDED.plan_key,status=EXCLUDED.status,current_period_end=COALESCE(EXCLUDED.current_period_end,billing_accounts.current_period_end),cancel_at_period_end=EXCLUDED.cancel_at_period_end,updated_at=now()")
            .bind(org).bind(customer_id).bind(sub_id).bind(variant).bind(attrs.pointer("/urls/customer_portal").and_then(Value::as_str)).bind(plan).bind(mapped_status).bind(period_end).bind(canceled).execute(&s.db).await{return db_error(e);}
    }
    let tx_status=if matches!(event_type,"subscription_payment_success"|"order_created"){"success"}else if event_type=="subscription_payment_failed"{"failed"}else{"updated"};
    let _=sqlx::query("UPDATE billing_transactions SET status=$1,payload=$2,updated_at=now() WHERE provider='lemonsqueezy' AND organization_id=$3 AND plan_code=COALESCE($4,plan_code)")
        .bind(tx_status).bind(&event).bind(org).bind(variant.as_deref()).execute(&s.db).await;
    if let Err(e)=sqlx::query("UPDATE billing_events SET status='processed',processed_at=now(),processing_started_at=NULL WHERE provider='lemonsqueezy' AND provider_event_id=$1").bind(&event_key).execute(&s.db).await{return db_error(e);}
    Json(json!({"received":true,"processed":true,"event":event_type})).into_response()
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
        assert_eq!(super::plan_integration_limit("free"), 1);
        assert_eq!(super::plan_integration_limit("starter"), 5);
        assert_eq!(super::plan_integration_limit("growth"), 20);
        assert_eq!(super::plan_integration_limit("scale"), 100);
        assert_eq!(super::plan_integration_limit("enterprise"), i32::MAX);
        assert_eq!(super::plan_integration_limit("unknown"), 1);
        assert_eq!(super::plan_verification_limit("free"), 100);
        assert_eq!(super::plan_verification_limit("starter"), 1_000);
        assert_eq!(super::plan_verification_limit("growth"), 10_000);
        assert_eq!(super::plan_verification_limit("scale"), 100_000);
        assert_eq!(super::plan_verification_limit("enterprise"), i32::MAX);
        assert_eq!(super::plan_verification_limit("unknown"), 100);
        assert_eq!(super::plan_team_seat_limit("free"), 1);
        assert_eq!(super::plan_team_seat_limit("starter"), 5);
        assert_eq!(super::plan_team_seat_limit("growth"), 15);
        assert_eq!(super::plan_team_seat_limit("scale"), 50);
        assert_eq!(super::plan_team_seat_limit("enterprise"), i32::MAX);
        assert_eq!(super::plan_team_seat_limit("unknown"), 1);
        assert_eq!(super::plan_api_key_limit("free"), 1);
        assert_eq!(super::plan_api_key_limit("starter"), 5);
        assert_eq!(super::plan_api_key_limit("growth"), 25);
        assert_eq!(super::plan_api_key_limit("scale"), 100);
        assert_eq!(super::plan_api_key_limit("enterprise"), i32::MAX);
        assert_eq!(super::plan_api_requests_per_minute("free"), 60);
        assert_eq!(super::plan_api_requests_per_minute("starter"), 300);
        assert_eq!(super::plan_api_requests_per_minute("growth"), 1_000);
        assert_eq!(super::plan_api_requests_per_minute("scale"), 5_000);
        assert_eq!(super::plan_api_requests_per_minute("enterprise"), i32::MAX);
        assert_eq!(super::plan_support_level("free"), "community");
        assert_eq!(super::plan_support_level("starter"), "standard");
        assert_eq!(super::plan_support_level("growth"), "priority");
        assert_eq!(super::plan_support_level("scale"), "priority_plus");
        assert_eq!(super::plan_support_level("enterprise"), "enterprise_custom");
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

    #[test]
    fn paystack_plan_codes_must_be_present_and_unique() {
        assert!(super::paystack_plan_codes_unique(Some("PLN_starter"), Some("PLN_growth"), Some("PLN_scale")));
        assert!(!super::paystack_plan_codes_unique(Some("PLN_same"), Some("PLN_same"), Some("PLN_scale")));
        assert!(!super::paystack_plan_codes_unique(Some("PLN_starter"), None, Some("PLN_scale")));
        assert!(!super::paystack_plan_codes_unique(Some(""), Some("PLN_growth"), Some("PLN_scale")));
    }

    #[test]
    fn canonical_paystack_usd_amounts_are_exact_minor_units() {
        assert_eq!(super::expected_paystack_amount_usd("starter"), Some(14_900));
        assert_eq!(super::expected_paystack_amount_usd("growth"), Some(49_900));
        assert_eq!(super::expected_paystack_amount_usd("scale"), Some(119_900));
        assert_eq!(super::expected_paystack_amount_usd("free"), None);
        assert_eq!(super::expected_paystack_amount_usd("enterprise"), None);
    }

    #[test]
    fn paystack_success_payload_must_match_usd_amount_and_plan() {
        let starter = serde_json::json!({"amount":14900,"currency":"USD","plan":{"amount":14900,"currency":"USD"}});
        let wrong_amount = serde_json::json!({"amount":7900,"currency":"USD"});
        let wrong_currency = serde_json::json!({"amount":14900,"currency":"NGN"});
        let nested_plan = serde_json::json!({"plan":{"amount":49900,"currency":"USD"}});
        assert!(super::paystack_payload_matches_plan_amount_currency(&starter, "starter"));
        assert!(!super::paystack_payload_matches_plan_amount_currency(&wrong_amount, "starter"));
        assert!(!super::paystack_payload_matches_plan_amount_currency(&wrong_currency, "starter"));
        assert!(super::paystack_payload_matches_plan_amount_currency(&nested_plan, "growth"));
        assert!(!super::paystack_payload_matches_plan_amount_currency(&starter, "growth"));
    }

    #[test]
    fn paystack_provider_plan_must_match_catalog_before_checkout() {
        let starter = serde_json::json!({"plan_code":"PLN_starter","amount":14900,"currency":"USD","interval":"monthly"});
        let wrong_amount = serde_json::json!({"plan_code":"PLN_starter","amount":7900,"currency":"USD","interval":"monthly"});
        let wrong_currency = serde_json::json!({"plan_code":"PLN_starter","amount":14900,"currency":"NGN","interval":"monthly"});
        let wrong_interval = serde_json::json!({"plan_code":"PLN_starter","amount":14900,"currency":"USD","interval":"annually"});
        assert!(super::paystack_provider_plan_matches_catalog(&starter, "starter", "PLN_starter"));
        assert!(!super::paystack_provider_plan_matches_catalog(&wrong_amount, "starter", "PLN_starter"));
        assert!(!super::paystack_provider_plan_matches_catalog(&wrong_currency, "starter", "PLN_starter"));
        assert!(!super::paystack_provider_plan_matches_catalog(&wrong_interval, "starter", "PLN_starter"));
        assert!(!super::paystack_provider_plan_matches_catalog(&starter, "growth", "PLN_starter"));
    }

}
