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
    let key=match plan{"starter"=>"LEMON_SQUEEZY_STARTER_VARIANT_ID","growth"=>"LEMON_SQUEEZY_GROWTH_VARIANT_ID","scale"=>"LEMON_SQUEEZY_SCALE_VARIANT_ID",_=>return None};
    env::var(key).ok().map(|v|v.trim().to_owned()).filter(|v|!v.is_empty()&&v.chars().all(|c|c.is_ascii_digit()))
}
fn plan_for_code(id: Option<&str>) -> Option<&'static str> {
    let id = id?;
    for p in ["starter","growth","scale"] { if lemon_variant_id(p).as_deref()==Some(id) { return Some(match p{"starter"=>"starter","growth"=>"growth",_=>"scale"}); } } None
}
fn configured_lemonsqueezy_variants_unique()->bool {
    let v=[lemon_variant_id("starter"),lemon_variant_id("growth"),lemon_variant_id("scale")];
    v.iter().all(|x|x.as_ref().is_some_and(|s|!s.is_empty()))&&v[0]!=v[1]&&v[0]!=v[2]&&v[1]!=v[2]
}
fn expected_lemonsqueezy_amount(plan:&str)->Option<i64>{match plan{"starter"=>Some(14900),"growth"=>Some(49900),"scale"=>Some(119900),_=>None}}
fn lemonsqueezy_test_mode()->bool{env::var("LEMON_SQUEEZY_TEST_MODE").map(|v|matches!(v.trim().to_ascii_lowercase().as_str(),"true"|"1"|"yes")).unwrap_or(true)}
fn verify_lemonsqueezy_signature(payload:&str,signature:&str,secret:&str)->bool{
    type HmacSha256=Hmac<sha2::Sha256>;
    let mut mac=match HmacSha256::new_from_slice(secret.as_bytes()){Ok(v)=>v,Err(_)=>return false};mac.update(payload.as_bytes());
    constant_time_equal(&hex::encode(mac.finalize().into_bytes()),signature.trim())
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
    match sqlx::query("SELECT lemonsqueezy_customer_id,lemonsqueezy_subscription_id,lemonsqueezy_variant_id,plan_key,status,current_period_end,cancel_at_period_end FROM billing_accounts WHERE organization_id=$1 AND provider='lemonsqueezy'").bind(ctx.organization_id).fetch_optional(&s.db).await{
        Ok(Some(row))=>Json(json!({"configured":true,"provider":"lemonsqueezy","customer_id":row.get::<Option<String>,_>("lemonsqueezy_customer_id"),"subscription_id":row.get::<Option<String>,_>("lemonsqueezy_subscription_id"),"variant_id":row.get::<Option<String>,_>("lemonsqueezy_variant_id"),"plan":row.get::<String,_>("plan_key"),"status":row.get::<String,_>("status"),"current_period_end":row.get::<Option<chrono::DateTime<chrono::Utc>>,_>("current_period_end"),"cancel_at_period_end":row.get::<bool,_>("cancel_at_period_end")})).into_response(),
        Ok(None)=>Json(json!({"configured":false,"provider":"lemonsqueezy","plan":"free","status":"active"})).into_response(),Err(e)=>db_error(e)
    }
}
pub(crate) async fn checkout(State(s):State<AppState>,headers:HeaderMap,Json(input):Json<CheckoutInput>)->Response{
 let ctx=match authenticate(&s,&headers).await{Ok(v)=>v,Err(c)=>return c.into_response()};if let Err(c)=require_admin(&ctx,&headers){return c.into_response();}
 let key=match env::var("LEMON_SQUEEZY_API_KEY"){Ok(v)if !v.trim().is_empty()=>v,_=>return service_unavailable("Lemon Squeezy API key is not configured.")};
 let store=match env::var("LEMON_SQUEEZY_STORE_ID"){Ok(v)if !v.trim().is_empty()&&v.chars().all(|c|c.is_ascii_digit())=>v,_=>return service_unavailable("Lemon Squeezy store ID is not configured.")};
 if !configured_lemonsqueezy_variants_unique(){return service_unavailable("Lemon Squeezy monthly variant IDs must be configured and unique.");}
 let plan=match input.price_id.as_deref(){Some(v)if ["starter","growth","scale"].contains(&v.trim())=>v.trim(),Some(v)=>match plan_for_code(Some(v.trim())){Some(p)=>p,None=>return bad("Select a valid Agata Proxima plan.")},None=>return bad("Select a plan before checkout.")};
 if plan == "free" || plan == "enterprise" { return bad("Free and Enterprise plans do not use self-service checkout."); }
 let variant=lemon_variant_id(plan).unwrap();
 let client=Client::new();
 let store_response=match client.get(format!("https://api.lemonsqueezy.com/v1/stores/{store}")).bearer_auth(&key).header("Accept","application/vnd.api+json").send().await{Ok(v)=>v,Err(e)=>return external_error(e)};
 if !store_response.status().is_success(){return service_unavailable("Lemon Squeezy store validation failed.");}
 let store_body:Value=match store_response.json().await{Ok(v)=>v,Err(e)=>return external_error(e)};
 let returned_store=store_body.pointer("/data/id").and_then(Value::as_str).map(ToOwned::to_owned).or_else(||store_body.pointer("/data/id").and_then(Value::as_i64).map(|v|v.to_string()));
 if returned_store.as_deref()!=Some(store.as_str())||store_body.pointer("/data/attributes/currency").and_then(Value::as_str)!=Some("USD"){return service_unavailable("The configured Lemon Squeezy store must be the expected store and use USD.");}
 let vr=match client.get(format!("https://api.lemonsqueezy.com/v1/variants/{variant}")).bearer_auth(&key).header("Accept","application/vnd.api+json").send().await{Ok(v)=>v,Err(e)=>return external_error(e)};
 if !vr.status().is_success(){return service_unavailable("Lemon Squeezy variant validation failed.");}
 let vb:Value=match vr.json().await{Ok(v)=>v,Err(e)=>return external_error(e)};let at=vb.pointer("/data/attributes").cloned().unwrap_or(Value::Null);
 let valid=at.get("price").and_then(Value::as_i64)==expected_lemonsqueezy_amount(plan)&&at.get("is_subscription").and_then(Value::as_bool)==Some(true)&&at.get("interval").and_then(Value::as_str)==Some("month")&&at.get("interval_count").and_then(Value::as_i64).unwrap_or(1)==1&&at.get("status").and_then(Value::as_str)==Some("published")&&at.get("test_mode").and_then(Value::as_bool).map(|v|v==lemonsqueezy_test_mode()).unwrap_or(false);
 if !valid{return service_unavailable("Lemon Squeezy variant must match the configured test/live mode and exact monthly USD catalog price.");}
 let product_response=match client.get(format!("https://api.lemonsqueezy.com/v1/variants/{variant}/product")).bearer_auth(&key).header("Accept","application/vnd.api+json").send().await{Ok(v)=>v,Err(e)=>return external_error(e)};
 if !product_response.status().is_success(){return service_unavailable("Lemon Squeezy product validation failed.");}
 let product_body:Value=match product_response.json().await{Ok(v)=>v,Err(e)=>return external_error(e)};
 let product_attrs=product_body.pointer("/data/attributes").cloned().unwrap_or(Value::Null);
 let product_store=product_attrs.get("store_id").and_then(Value::as_i64).map(|v|v.to_string());
 if product_store.as_deref()!=Some(store.as_str())||product_attrs.get("status").and_then(Value::as_str)!=Some("published")||product_attrs.get("test_mode").and_then(Value::as_bool).map(|v|v==lemonsqueezy_test_mode())!=Some(true){return service_unavailable("The selected Lemon Squeezy variant must belong to the configured store and mode, and its product must be published.");}
 let email=match sqlx::query("SELECT email FROM users WHERE id=$1").bind(ctx.user_id).fetch_one(&s.db).await{Ok(r)=>r.get::<String,_>("email"),Err(e)=>return db_error(e)};
 let base=env::var("AGATA_PUBLIC_BASE_URL").unwrap_or_else(|_|"http://127.0.0.1:8080".into()).trim_end_matches('/').to_owned();
 let local_reference=Uuid::new_v4().to_string();
 let payload=json!({"data":{"type":"checkouts","attributes":{"checkout_data":{"email":email,"custom":{"organization_id":ctx.organization_id.to_string(),"plan_key":plan,"checkout_reference":local_reference}},"product_options":{"redirect_url":format!("{base}/api/v1/billing/lemonsqueezy/callback?reference={local_reference}")}},"relationships":{"store":{"data":{"type":"stores","id":store}},"variant":{"data":{"type":"variants","id":variant}}}}});
 let r=match client.post("https://api.lemonsqueezy.com/v1/checkouts").bearer_auth(&key).header("Accept","application/vnd.api+json").header("Content-Type","application/vnd.api+json").json(&payload).send().await{Ok(v)=>v,Err(e)=>return external_error(e)};
 if !r.status().is_success(){return service_unavailable("Lemon Squeezy checkout creation failed.");}
 let body:Value=match r.json().await{Ok(v)=>v,Err(e)=>return external_error(e)};let data=body.get("data").cloned().unwrap_or(Value::Null);let id=data.get("id").and_then(Value::as_str).unwrap_or_default();let url=data.pointer("/attributes/url").and_then(Value::as_str).unwrap_or_default();
 if id.is_empty()||!url.starts_with("https://"){return service_unavailable("Lemon Squeezy returned no valid checkout URL.");}
 if let Err(e)=sqlx::query("INSERT INTO billing_transactions(organization_id,provider,reference,provider_checkout_id,plan_key,plan_code,currency,status,metadata,payload,created_at,updated_at) VALUES($1,'lemonsqueezy',$2,$3,$4,$5,'USD','initialized',$6,$7,now(),now()) ON CONFLICT(provider,reference) DO NOTHING").bind(ctx.organization_id).bind(&local_reference).bind(id).bind(plan).bind(&variant).bind(&payload).bind(&body).execute(&s.db).await{return db_error(e);}
 audit(&s.db,ctx.organization_id,ctx.user_id,"billing.checkout.created","billing_transaction",None,json!({"provider":"lemonsqueezy","checkout_id":id,"plan":plan,"reference":local_reference})).await;
 Json(json!({"ok":true,"provider":"lemonsqueezy","checkout_url":url,"reference":local_reference})).into_response()
}
pub(crate) async fn lemonsqueezy_callback(Query(q):Query<std::collections::HashMap<String,String>>)->Response{
 let base=env::var("AGATA_PUBLIC_BASE_URL").unwrap_or_else(|_|"http://127.0.0.1:8080".into()).trim_end_matches('/').to_owned();
 let reference=q.get("reference").and_then(|v|Uuid::parse_str(v).ok()).map(|v|v.to_string());
 let destination=match reference{Some(v)=>format!("{base}/app?billing=return&reference={v}"),None=>format!("{base}/app?billing=return")};
 Html(format!("<html><head><meta http-equiv=\"refresh\" content=\"0;url={destination}\"></head><body>Return complete. Billing is confirmed only by a verified webhook.</body></html>")).into_response()
}
pub(crate) async fn billing_verify(State(s):State<AppState>,headers:HeaderMap,Query(q):Query<std::collections::HashMap<String,String>>)->Response{
 let ctx=match authenticate(&s,&headers).await{Ok(v)=>v,Err(c)=>return c.into_response()};if let Err(c)=require_admin(&ctx,&headers){return c.into_response();}
 let reference=match q.get("reference"){Some(v)if !v.trim().is_empty()=>v.trim(),_=>return bad("Lemon Squeezy checkout reference is required.")};
 match sqlx::query("SELECT status,plan_key FROM billing_transactions WHERE provider='lemonsqueezy' AND reference=$1 AND organization_id=$2").bind(reference).bind(ctx.organization_id).fetch_optional(&s.db).await{
 Ok(Some(r))=>Json(json!({"ok":true,"provider":"lemonsqueezy","reference":reference,"status":r.get::<String,_>("status"),"plan":r.get::<String,_>("plan_key"),"verified":r.get::<String,_>("status")=="success"})).into_response(),
 Ok(None)=>(StatusCode::NOT_FOUND,Json(json!({"ok":false,"error":"unknown_local_transaction"}))).into_response(),Err(e)=>db_error(e)}
}
pub(crate) async fn portal(State(s):State<AppState>,headers:HeaderMap)->Response{
 let ctx=match authenticate(&s,&headers).await{Ok(v)=>v,Err(c)=>return c.into_response()};if let Err(c)=require_admin(&ctx,&headers){return c.into_response();}
 let subscription=match sqlx::query("SELECT lemonsqueezy_subscription_id FROM billing_accounts WHERE organization_id=$1 AND provider='lemonsqueezy'").bind(ctx.organization_id).fetch_optional(&s.db).await{
  Ok(Some(row))=>row.get::<Option<String>,_>("lemonsqueezy_subscription_id"),
  Ok(None)=>return bad("No Lemon Squeezy subscription exists for this organization yet."),Err(e)=>return db_error(e)
 };
 let subscription=match subscription{Some(v)=>v,None=>return bad("No Lemon Squeezy subscription exists for this organization yet.")};
 let key=match env::var("LEMON_SQUEEZY_API_KEY"){Ok(v)if !v.trim().is_empty()=>v,_=>return service_unavailable("Lemon Squeezy API key is not configured.")};
 let response=match Client::new().get(format!("https://api.lemonsqueezy.com/v1/subscriptions/{subscription}")).bearer_auth(key).header("Accept","application/vnd.api+json").send().await{Ok(v)=>v,Err(e)=>return external_error(e)};
 if !response.status().is_success(){return service_unavailable("Lemon Squeezy customer portal could not be refreshed.");}
 let body:Value=match response.json().await{Ok(v)=>v,Err(e)=>return external_error(e)};
 let url=match body.pointer("/data/attributes/urls/customer_portal").and_then(Value::as_str).filter(|v|v.starts_with("https://")){Some(v)=>v,None=>return service_unavailable("Lemon Squeezy did not return a current customer portal URL.")};
 if let Err(e)=sqlx::query("UPDATE billing_accounts SET lemonsqueezy_customer_portal_url=$1,updated_at=now() WHERE organization_id=$2 AND provider='lemonsqueezy'").bind(url).bind(ctx.organization_id).execute(&s.db).await{return db_error(e);}
 Json(json!({"ok":true,"provider":"lemonsqueezy","portal_url":url})).into_response()
}
pub(crate) async fn lemonsqueezy_webhook(State(s):State<AppState>,headers:HeaderMap,body:String)->Response{
 let sig=match headers.get("x-signature").and_then(|v|v.to_str().ok()){Some(v)=>v,None=>return StatusCode::BAD_REQUEST.into_response()};
 let secret=match env::var("LEMON_SQUEEZY_WEBHOOK_SECRET"){Ok(v)if !v.trim().is_empty()=>v,_=>return StatusCode::SERVICE_UNAVAILABLE.into_response()};
 if !verify_lemonsqueezy_signature(&body,sig,&secret){return StatusCode::UNAUTHORIZED.into_response();}
 let event:Value=match serde_json::from_str(&body){Ok(v)=>v,Err(_)=>return StatusCode::BAD_REQUEST.into_response()};
 let name=event.pointer("/meta/event_name").and_then(Value::as_str).unwrap_or_default();let data=event.get("data").cloned().unwrap_or(Value::Null);let a=data.get("attributes").cloned().unwrap_or(Value::Null);let id=data.get("id").and_then(Value::as_str).unwrap_or_default();
 if name.is_empty()||id.is_empty(){return StatusCode::BAD_REQUEST.into_response();}
 let store=env::var("LEMON_SQUEEZY_STORE_ID").unwrap_or_default();
 if a.get("store_id").and_then(Value::as_i64).map(|v|v.to_string()).as_deref()!=Some(store.trim()){return StatusCode::FORBIDDEN.into_response();}
 if a.get("test_mode").and_then(Value::as_bool)!=Some(lemonsqueezy_test_mode()){return StatusCode::FORBIDDEN.into_response();}
 let event_key=format!("{}:{}:{}",name,id,hex::encode(Sha256::digest(body.as_bytes())));
 let claimed=match sqlx::query("INSERT INTO billing_events(provider,provider_event_id,event_type,payload,status,processing_started_at,attempt_count) VALUES('lemonsqueezy',$1,$2,$3,'processing',now(),1) ON CONFLICT(provider,provider_event_id) DO UPDATE SET status='processing',processing_started_at=now(),attempt_count=billing_events.attempt_count+1,payload=EXCLUDED.payload,event_type=EXCLUDED.event_type WHERE billing_events.status NOT IN ('processed','ignored') AND (billing_events.processing_started_at IS NULL OR billing_events.processing_started_at<now()-interval '1 minute') RETURNING id").bind(&event_key).bind(name).bind(&event).fetch_optional(&s.db).await{Ok(v)=>v.is_some(),Err(e)=>return db_error(e)};
 if !claimed{
  let existing=match sqlx::query("SELECT status FROM billing_events WHERE provider='lemonsqueezy' AND provider_event_id=$1").bind(&event_key).fetch_optional(&s.db).await{Ok(v)=>v,Err(e)=>return db_error(e)};
  return match existing.map(|row|row.get::<String,_>("status")).as_deref(){
   Some("processed")|Some("ignored")=>Json(json!({"received":true,"duplicate":true})).into_response(),
   _=>StatusCode::SERVICE_UNAVAILABLE.into_response()
  };
 }
 let org=event.pointer("/meta/custom_data/organization_id").and_then(Value::as_str).and_then(|v|Uuid::parse_str(v).ok());
 let sub=if data.get("type").and_then(Value::as_str)==Some("subscriptions"){Some(id.to_owned())}else{a.get("subscription_id").and_then(Value::as_i64).map(|v|v.to_string())};
 let cust=a.get("customer_id").and_then(Value::as_i64).map(|v|v.to_string());
 let resolved=if let Some(v)=org{Some(v)}else if let Some(ref v)=sub{match sqlx::query("SELECT organization_id FROM billing_accounts WHERE lemonsqueezy_subscription_id=$1").bind(v).fetch_optional(&s.db).await{Ok(r)=>r.map(|x|x.get::<Uuid,_>("organization_id")),Err(e)=>return db_error(e)}}else if let Some(ref v)=cust{match sqlx::query("SELECT organization_id FROM billing_accounts WHERE lemonsqueezy_customer_id=$1").bind(v).fetch_optional(&s.db).await{Ok(r)=>r.map(|x|x.get::<Uuid,_>("organization_id")),Err(e)=>return db_error(e)}}else{None};
 let org=match resolved{Some(v)=>v,None=>{let _=sqlx::query("UPDATE billing_events SET status='ignored',processed_at=now(),processing_started_at=NULL WHERE provider='lemonsqueezy' AND provider_event_id=$1").bind(&event_key).execute(&s.db).await;return Json(json!({"received":true,"ignored":"organization_not_resolved"})).into_response();}};
 let variant=if let Some(value)=a.get("variant_id").and_then(Value::as_i64){Some(value.to_string())}else if let Some(ref subscription_id)=sub{
  match sqlx::query("SELECT lemonsqueezy_variant_id FROM billing_accounts WHERE organization_id=$1 AND lemonsqueezy_subscription_id=$2").bind(org).bind(subscription_id).fetch_optional(&s.db).await{
   Ok(Some(row))=>row.get::<Option<String>,_>("lemonsqueezy_variant_id"),Ok(None)=>None,Err(e)=>return db_error(e)
  }
 }else{None};
 if name=="subscription_created" {
  let checkout_reference=event.pointer("/meta/custom_data/checkout_reference").and_then(Value::as_str);
  let checkout_reference=match checkout_reference{Some(v)=>v,None=>return StatusCode::FORBIDDEN.into_response()};
  let local=match sqlx::query("SELECT organization_id,plan_code FROM billing_transactions WHERE provider='lemonsqueezy' AND reference=$1").bind(checkout_reference).fetch_optional(&s.db).await{Ok(v)=>v,Err(e)=>return db_error(e)};
  let local=match local{Some(v)=>v,None=>return StatusCode::FORBIDDEN.into_response()};
  if local.get::<Uuid,_>("organization_id")!=org||local.get::<Option<String>,_>("plan_code").as_deref()!=variant.as_deref(){return StatusCode::FORBIDDEN.into_response();}
  let initial_status=match a.get("status").and_then(Value::as_str){Some("active")=>"success",Some("on_trial")=>"trialing",_=>"pending"};
  if let Err(e)=sqlx::query("UPDATE billing_transactions SET status=$1,payload=$2,updated_at=now() WHERE provider='lemonsqueezy' AND reference=$3 AND organization_id=$4").bind(initial_status).bind(&event).bind(checkout_reference).bind(org).execute(&s.db).await{return db_error(e);}
 }
 let plan=variant.as_deref().and_then(|v|plan_for_code(Some(v)));let status=a.get("status").and_then(Value::as_str).unwrap_or_default();
 let period=a.get("renews_at").and_then(Value::as_str).or_else(||a.get("ends_at").and_then(Value::as_str)).and_then(|v|chrono::DateTime::parse_from_rfc3339(v).ok()).map(|v|v.with_timezone(&chrono::Utc));
 let payment_failed=name=="subscription_payment_failed"||matches!(status,"past_due"|"unpaid");
 let active=!payment_failed&&(matches!(status,"active"|"on_trial")||matches!(name,"subscription_created"|"subscription_payment_success"|"subscription_resumed"|"subscription_payment_recovered"));
 let cancelled=name=="subscription_cancelled"||status=="cancelled"||a.get("cancelled").and_then(Value::as_bool)==Some(true);
 let mapped=if active{"active"}else if cancelled{"non-renewing"}else if payment_failed{"attention"}else if name=="subscription_expired"||status=="expired"{"canceled"}else if status=="paused"{"paused"}else{"pending"};
 if let Some(plan)=plan{
  if active{if let Err(e)=apply_entitlements(&s.db,org,plan).await{return db_error(e);}}
  if name!="subscription_payment_refunded" {
  if let Err(e)=sqlx::query("INSERT INTO billing_accounts(organization_id,provider,lemonsqueezy_customer_id,lemonsqueezy_subscription_id,lemonsqueezy_variant_id,lemonsqueezy_customer_portal_url,plan_key,status,current_period_end,cancel_at_period_end,updated_at) VALUES($1,'lemonsqueezy',$2,$3,$4,$5,$6,$7,$8,$9,now()) ON CONFLICT(organization_id) DO UPDATE SET provider='lemonsqueezy',lemonsqueezy_customer_id=COALESCE(EXCLUDED.lemonsqueezy_customer_id,billing_accounts.lemonsqueezy_customer_id),lemonsqueezy_subscription_id=COALESCE(EXCLUDED.lemonsqueezy_subscription_id,billing_accounts.lemonsqueezy_subscription_id),lemonsqueezy_variant_id=EXCLUDED.lemonsqueezy_variant_id,lemonsqueezy_customer_portal_url=COALESCE(EXCLUDED.lemonsqueezy_customer_portal_url,billing_accounts.lemonsqueezy_customer_portal_url),plan_key=EXCLUDED.plan_key,status=EXCLUDED.status,current_period_end=COALESCE(EXCLUDED.current_period_end,billing_accounts.current_period_end),cancel_at_period_end=CASE WHEN $10 THEN EXCLUDED.cancel_at_period_end ELSE billing_accounts.cancel_at_period_end END,updated_at=now()")
   .bind(org).bind(cust).bind(sub).bind(&variant).bind(a.pointer("/urls/customer_portal").and_then(Value::as_str)).bind(plan).bind(mapped).bind(period).bind(cancelled).bind(data.get("type").and_then(Value::as_str)==Some("subscriptions")).execute(&s.db).await{return db_error(e);}
  }
  if payment_failed {
   if let Err(e)=sqlx::query("UPDATE organization_entitlements SET billing_status='past_due',billing_grace_until=COALESCE(billing_grace_until,now()+interval '7 days'),updated_at=now() WHERE organization_id=$1").bind(org).execute(&s.db).await{return db_error(e);}
  }
  if name=="subscription_expired"||status=="expired" {
   if let Err(e)=apply_entitlements(&s.db,org,"free").await{return db_error(e);}
   if let Err(e)=sqlx::query("UPDATE organization_entitlements SET billing_status='canceled',billing_grace_until=NULL,updated_at=now() WHERE organization_id=$1").bind(org).execute(&s.db).await{return db_error(e);}
  }
 }
 if matches!(name,"subscription_payment_success"|"subscription_payment_recovered"|"subscription_payment_failed"|"subscription_payment_refunded") {
  if let (Some(plan),Some(variant_id))=(plan,variant.as_deref()) {
   let txstatus=match name {
    "subscription_payment_failed"=>"failed",
    "subscription_payment_refunded"=>"refunded",
    _=>"success"
   };
   let refund_status=if txstatus=="refunded"{Some("refunded")}else{None};
   let reference=format!("invoice:{id}");
   let amount=a.get("total_usd").and_then(Value::as_i64);
   let currency=a.get("currency").and_then(Value::as_str).unwrap_or("USD");
   if let Err(e)=sqlx::query("INSERT INTO billing_transactions(organization_id,provider,reference,plan_key,plan_code,amount,currency,status,refund_status,metadata,payload,created_at,updated_at) VALUES($1,'lemonsqueezy',$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),now()) ON CONFLICT(provider,reference) DO UPDATE SET status=EXCLUDED.status,refund_status=COALESCE(EXCLUDED.refund_status,billing_transactions.refund_status),payload=EXCLUDED.payload,updated_at=now()")
    .bind(org).bind(reference).bind(plan).bind(variant_id).bind(amount).bind(currency).bind(txstatus).bind(refund_status).bind(&event).bind(&event).execute(&s.db).await{return db_error(e);}
  }
 }
 if let Err(e)=sqlx::query("UPDATE billing_events SET status='processed',processed_at=now(),processing_started_at=NULL WHERE provider='lemonsqueezy' AND provider_event_id=$1").bind(&event_key).execute(&s.db).await{return db_error(e);}
 let notice=match name{
  "subscription_created"=>Some(("Subscription activated","Your Agata Proxima subscription is active.")),
  "subscription_payment_success"=>Some(("Subscription payment received","Your subscription payment was received successfully.")),
  "subscription_payment_failed"=>Some(("Subscription payment failed","The latest subscription payment failed. Please update your payment method in the customer portal.")),
  "subscription_payment_recovered"=>Some(("Subscription payment recovered","Your subscription payment issue has been resolved.")),
  "subscription_payment_refunded"=>Some(("Subscription payment refunded","A subscription payment was refunded. Your billing history has been updated; review your subscription status and customer portal for current details.")),
  "subscription_cancelled"=>Some(("Subscription cancellation scheduled","Your subscription was cancelled and access follows the provider's subscription period.")),
  "subscription_expired"=>Some(("Subscription expired","Your subscription has expired. Review your plan to restore paid access.")),
  _=>None
 };
 if let Some((title,details))=notice{
  let db=s.db.clone();let reference=event_key.clone();
  tokio::spawn(async move{send_billing_notice(&db,org,&reference,title,details).await;});
 }
 Json(json!({"received":true,"processed":true,"event":name})).into_response()
}
pub(crate) async fn send_verification_email(
    db: &sqlx::PgPool,
    user_id: Uuid,
    email: &str,
    display_name: &str,
) -> anyhow::Result<()> {
    let bytes = *Uuid::new_v4().as_bytes();
    let value = u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) % 1_000_000;
    let code = format!("{value:06}");

    sqlx::query(
        "UPDATE users SET email_verification_token_hash=$1,
         email_verification_expires_at=now()+interval '15 minutes',
         email_verification_attempts=0 WHERE id=$2",
    )
    .bind(token_hash(&code))
    .bind(user_id)
    .execute(db)
    .await?;

    send_template_email_as(
        email,
        "verify-email",
        json!({
            "DISPLAY_NAME": escape_email_template_value(display_name),
            "CODE": code,
            "ACTION_URL": ""
        }),
        "no-reply",
    )
    .await
}

#[derive(Deserialize)]
pub(crate) struct VerificationResendInput {
    pub email: String,
}

pub(crate) async fn resend_verification_email(
    State(s): State<AppState>,
    Json(input): Json<VerificationResendInput>,
) -> Response {
    let email = input.email.trim().to_lowercase();
    if email.is_empty() || !email.contains('@') {
        return bad("A valid email is required.");
    }

    let user = match sqlx::query(
        "SELECT id,display_name,email_verified_at FROM users WHERE email=$1 AND status='active'",
    )
    .bind(&email)
    .fetch_optional(&s.db)
    .await
    {
        Ok(value) => value,
        Err(e) => return db_error(e),
    };

    if let Some(row) = user {
        if row
            .get::<Option<chrono::DateTime<chrono::Utc>>, _>("email_verified_at")
            .is_none()
        {
            if let Err(e) = send_verification_email(
                &s.db,
                row.get("id"),
                &email,
                row.get("display_name"),
            )
            .await
            {
                tracing::error!(%e, "verification email delivery failed");
                return service_unavailable("Verification email could not be sent. Check the Resend configuration.");
            }
        }
    }

    Json(json!({
        "ok": true,
        "message": "If the account requires verification, a new verification email has been sent."
    }))
    .into_response()
}

pub(crate) async fn verify_email(
    State(s): State<AppState>,
    Query(q): Query<VerifyInput>,
) -> Response {
    let result = sqlx::query(
        "UPDATE users SET email_verified_at=now(),email_verification_token_hash=NULL,
         email_verification_expires_at=NULL,email_verification_attempts=0
         WHERE email_verification_token_hash=$1
           AND email_verification_expires_at>now()
           AND email_verification_attempts<5
         RETURNING email",
    )
    .bind(token_hash(&q.token))
    .fetch_optional(&s.db)
    .await;

    match result {
        Ok(Some(row)) => Html(format!(
            "<html><body style=\"background:#05080c;color:#eef7f8;font-family:Arial;padding:60px\">
             <h1>Verification now uses a code.</h1><p>{}</p><p>Return to the Agata Proxima sign-in screen and enter the code from your latest email.</p></body></html>",
            row.get::<String,_>("email")
        )).into_response(),
        Ok(None) => (
            StatusCode::BAD_REQUEST,
            Html("<html><body style=\"background:#05080c;color:#eef7f8;font-family:Arial;padding:60px\"><h1>This verification link is no longer active.</h1><p>Request a new verification code from the sign-in screen.</p></body></html>"),
        ).into_response(),
        Err(e) => db_error(e),
    }
}

pub(crate) async fn verify_email_code(
    State(s): State<AppState>,
    Json(input): Json<VerificationCodeInput>,
) -> Response {
    let email = input.email.trim().to_lowercase();
    let code = input.code.trim();

    if email.is_empty() || !email.contains('@') {
        return bad("A valid email is required.");
    }
    if code.len() != 6 || !code.chars().all(|value| value.is_ascii_digit()) {
        return bad("Enter the 6-digit verification code from your latest email.");
    }

    let row = match sqlx::query(
        "SELECT id,email_verification_token_hash,email_verification_expires_at,email_verification_attempts
         FROM users WHERE email=$1 AND status='active'",
    )
    .bind(&email)
    .fetch_optional(&s.db)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => return bad("The verification code is invalid or expired."),
        Err(e) => return db_error(e),
    };

    let attempts: i32 = row.get("email_verification_attempts");
    if attempts >= 5 {
        return (
            StatusCode::TOO_MANY_REQUESTS,
            Json(json!({"ok":false,"message":"Too many verification attempts. Request a new code and try again."})),
        ).into_response();
    }

    let expected: Vec<u8> = row.get("email_verification_token_hash");
    if token_hash(code) != expected {
        let _ = sqlx::query(
            "UPDATE users SET email_verification_attempts=email_verification_attempts+1 WHERE id=$1",
        )
        .bind(row.get::<Uuid,_>("id"))
        .execute(&s.db)
        .await;
        return bad("The verification code is invalid or expired.");
    }

    let updated = sqlx::query(
        "UPDATE users SET email_verified_at=now(),email_verification_token_hash=NULL,
         email_verification_expires_at=NULL,email_verification_attempts=0
         WHERE id=$1
           AND email_verification_token_hash=$2
           AND email_verification_expires_at>now()
           AND email_verification_attempts<5
         RETURNING id,email",
    )
    .bind(row.get::<Uuid,_>("id"))
    .bind(token_hash(code))
    .fetch_optional(&s.db)
    .await;

    match updated {
        Ok(Some(user)) => {
            if let Ok(Some(membership)) = sqlx::query(
                "SELECT organization_id FROM memberships WHERE user_id=$1 ORDER BY created_at LIMIT 1",
            )
            .bind(user.get::<Uuid,_>("id"))
            .fetch_optional(&s.db)
            .await
            {
                audit(
                    &s.db,
                    membership.get::<Uuid,_>("organization_id"),
                    user.get::<Uuid,_>("id"),
                    "auth.email_verified",
                    "user",
                    Some(user.get::<Uuid,_>("id")),
                    json!({"method":"verification_code"}),
                ).await;
            }
            Json(json!({
                "ok":true,
                "verified":true,
                "email":user.get::<String,_>("email"),
                "message":"Email verified. Sign in to open your Agata Proxima workspace."
            })).into_response()
        }
        Ok(None) => bad("The verification code is invalid or expired."),
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
        if let Err(e) = send_template_email_as(
            &email,
            "password-reset",
            json!({
                "DISPLAY_NAME": escape_email_template_value(&row.get::<String,_>("display_name")),
                "ACTION_URL": link
            }),
            "no-reply",
        )
        .await
        {
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
    if let Err(c) = require_admin(&ctx, &headers) {
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

    if let Err(response) =
        enforce_team_seat_capacity(&s.db, ctx.organization_id, Some(&email)).await
    {
        return response;
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

    let organization_name = match sqlx::query_scalar::<_, String>(
        "SELECT name FROM organizations WHERE id=$1",
    )
    .bind(ctx.organization_id)
    .fetch_one(&s.db)
    .await
    {
        Ok(name) => name,
        Err(e) => return db_error(e),
    };

    let base = env::var("AGATA_PUBLIC_BASE_URL")
        .unwrap_or_else(|_| "http://127.0.0.1:8080".into())
        .trim_end_matches('/')
        .to_string();
    let link = format!("{base}/accept-invite?token={token}");
    let email_result = send_template_email_as(
        &email,
        "organization-invitation",
        json!({
            "ORGANIZATION": escape_email_template_value(&organization_name),
            "ROLE": role,
            "ACTION_URL": link
        }),
        "notifications",
    )
    .await;

    audit(&s.db, ctx.organization_id, ctx.user_id, "organization.invite.created", "organization_invite", Some(id), json!({"email":email,"role":role,"email_delivery":if email_result.is_ok(){"sent"}else{"failed"}})).await;
    if let Err(e) = email_result {
        tracing::error!(%e, invitation_id = %id, "invitation email failed");
        return service_unavailable("The invitation was recorded, but its email could not be sent. Retry the invitation after checking the email configuration.");
    }
    Json(json!({"ok":true,"id":id,"email_delivery":"sent","expires_in":"7 days"})).into_response()
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
            let mut tx = match s.db.begin().await {
                Ok(tx) => tx,
                Err(e) => return db_error(e),
            };

            let claimed = match sqlx::query(
                "UPDATE organization_invites SET accepted_at=now()
                 WHERE id=$1 AND accepted_at IS NULL AND expires_at>now()
                 RETURNING id",
            )
            .bind(invite_id)
            .fetch_optional(&mut *tx)
            .await
            {
                Ok(v) => v,
                Err(e) => return db_error(e),
            };
            if claimed.is_none() {
                return bad("Invitation expired, invalid, or already accepted.");
            }

            if let Err(e) = sqlx::query(
                "INSERT INTO memberships(user_id,organization_id,role) VALUES($1,$2,$3)
                 ON CONFLICT (user_id,organization_id) DO UPDATE SET role=EXCLUDED.role",
            )
            .bind(ctx.user_id)
            .bind(org)
            .bind(&role)
            .execute(&mut *tx)
            .await
            {
                return db_error(e);
            }

            if let Err(e) = tx.commit().await {
                return db_error(e);
            }

            audit(&s.db, org, ctx.user_id, "organization.invite.accepted", "organization_invite", Some(invite_id), json!({})).await;
            Html("<html><body style=\"background:#05080c;color:#eef7f8;font-family:Arial;padding:60px\"><h1>Invitation accepted.</h1><p>Your organization access is active.</p><a href=\"/app\">Open Command Center</a></body></html>").into_response()
        }
        None => bad("Invitation expired, invalid, or not addressed to the signed-in user."),
    }
}


pub(crate) async fn purge_expired_audit_events(db: &sqlx::PgPool) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar("SELECT proxima_purge_expired_audit_events()")
        .fetch_one(db)
        .await
}

pub(crate) async fn readiness(State(s): State<AppState>) -> Response {
    let db_ok = sqlx::query("SELECT 1").execute(&s.db).await.is_ok();
    let lemonsqueezy = env::var("LEMON_SQUEEZY_API_KEY").map(|v| !v.trim().is_empty()).unwrap_or(false) && env::var("LEMON_SQUEEZY_STORE_ID").map(|v| !v.trim().is_empty()).unwrap_or(false) && env::var("LEMON_SQUEEZY_WEBHOOK_SECRET").map(|v| !v.trim().is_empty()).unwrap_or(false);
    let plans = configured_lemonsqueezy_variants_unique();
    let resend = env::var("RESEND_API_KEY").map(|v| !v.trim().is_empty()).unwrap_or(false);
    let fallback_from = env::var("RESEND_FROM_EMAIL").map(|v| !v.trim().is_empty()).unwrap_or(false);
    let sender_identities = [
        "RESEND_FROM_NO_REPLY_EMAIL",
        "RESEND_FROM_SUPPORT_EMAIL",
        "RESEND_FROM_SECURITY_EMAIL",
        "RESEND_FROM_BILLING_EMAIL",
        "RESEND_FROM_NOTIFICATIONS_EMAIL",
    ].iter().all(|key| env::var(key).map(|v| !v.trim().is_empty()).unwrap_or(false));
    let templates_configured = [
        "RESEND_TEMPLATE_VERIFY_EMAIL_ID",
        "RESEND_TEMPLATE_PASSWORD_RESET_ID",
        "RESEND_TEMPLATE_ORGANIZATION_INVITATION_ID",
        "RESEND_TEMPLATE_NEW_LOGIN_ALERT_ID",
        "RESEND_TEMPLATE_SUPPORT_REQUEST_RECEIVED_ID",
        "RESEND_TEMPLATE_BILLING_UPDATE_ID",
    ].iter().all(|key| env::var(key).map(|v| !v.trim().is_empty()).unwrap_or(false));
    let support_inbox = env::var("AGATA_SUPPORT_INBOX_EMAIL").map(|v| valid_public_support_email(v.trim())).unwrap_or(false);
    let base = env::var("AGATA_PUBLIC_BASE_URL").map(|v| !v.trim().is_empty()).unwrap_or(false);
    let oidc = env::var("PROXIMA_OIDC_CLIENT_ID").map(|v| !v.trim().is_empty()).unwrap_or(false)
        && env::var("PROXIMA_OIDC_CLIENT_SECRET").map(|v| !v.trim().is_empty()).unwrap_or(false);
    let email_ready = resend && sender_identities && templates_configured && support_inbox;
    let all = db_ok && lemonsqueezy && plans && email_ready && base && oidc;
    Json(json!({
        "status": if all { "ready" } else { "needs_configuration" },
        "checks": {
            "database": db_ok,
            "lemonsqueezy_configured": lemonsqueezy,
            "lemonsqueezy_variants": plans,
            "resend_api_key": resend,
            "resend_fallback_sender": fallback_from,
            "resend_sender_identities": sender_identities,
            "resend_templates": templates_configured,
            "support_inbox": support_inbox,
            "public_base_url": base,
            "oidc": oidc,
            "engine_remains_authoritative": true
        }
    })).into_response()
}

fn configured_template_id(template_key: &str) -> anyhow::Result<String> {
    let env_key = match template_key {
        "verify-email" => "RESEND_TEMPLATE_VERIFY_EMAIL_ID",
        "password-reset" => "RESEND_TEMPLATE_PASSWORD_RESET_ID",
        "organization-invitation" => "RESEND_TEMPLATE_ORGANIZATION_INVITATION_ID",
        "new-login-alert" => "RESEND_TEMPLATE_NEW_LOGIN_ALERT_ID",
        "support-request-received" => "RESEND_TEMPLATE_SUPPORT_REQUEST_RECEIVED_ID",
        "billing-update" => "RESEND_TEMPLATE_BILLING_UPDATE_ID",
        _ => anyhow::bail!("Unsupported transactional email template key"),
    };
    match env::var(env_key) {
        Ok(value) if !value.trim().is_empty() => Ok(value.trim().to_owned()),
        _ => anyhow::bail!("{env_key} is not configured for the current deployment"),
    }
}

fn sender_address(role: &str) -> anyhow::Result<String> {
    let key = match role {
        "no-reply" => "RESEND_FROM_NO_REPLY_EMAIL",
        "support" => "RESEND_FROM_SUPPORT_EMAIL",
        "security" => "RESEND_FROM_SECURITY_EMAIL",
        "billing" => "RESEND_FROM_BILLING_EMAIL",
        "notifications" => "RESEND_FROM_NOTIFICATIONS_EMAIL",
        _ => anyhow::bail!("Unsupported transactional email sender role"),
    };
    if let Ok(value) = env::var(key) {
        if !value.trim().is_empty() {
            return Ok(value.trim().to_owned());
        }
    }
    match env::var("RESEND_FROM_EMAIL") {
        Ok(value) if !value.trim().is_empty() => Ok(value.trim().to_owned()),
        _ => anyhow::bail!("{key} and RESEND_FROM_EMAIL are not configured for the current deployment"),
    }
}

pub(crate) async fn send_template_email_as(
    to: &str,
    template_key: &str,
    variables: Value,
    sender_role: &str,
) -> anyhow::Result<()> {
    let key = env::var("RESEND_API_KEY")?;
    if key.trim().is_empty() {
        anyhow::bail!("RESEND_API_KEY is not configured for the current deployment");
    }
    let from = sender_address(sender_role)?;
    let template_id = configured_template_id(template_key)?;
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .build()?;
    let response = client
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
        anyhow::bail!("Resend returned {status}: {}", body.chars().take(500).collect::<String>());
    }
    Ok(())
}

pub(crate) async fn send_text_email(
    to: &str,
    subject: &str,
    text: &str,
    sender_role: &str,
) -> anyhow::Result<()> {
    let key = env::var("RESEND_API_KEY")?;
    if key.trim().is_empty() {
        anyhow::bail!("RESEND_API_KEY is not configured for the current deployment");
    }
    let from = sender_address(sender_role)?;
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .build()?;
    let response = client
        .post("https://api.resend.com/emails")
        .bearer_auth(key)
        .json(&json!({
            "from": from,
            "to": [to],
            "subject": subject,
            "text": text
        }))
        .send()
        .await?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        anyhow::bail!("Resend returned {status}: {}", body.chars().take(500).collect::<String>());
    }
    Ok(())
}

fn escape_email_template_value(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

async fn send_billing_notice(
    db: &sqlx::PgPool,
    organization_id: Uuid,
    event_reference: &str,
    title: &str,
    details: &str,
) {
    let recipient = match sqlx::query(
        "SELECT u.email,u.display_name
           FROM memberships m
           JOIN users u ON u.id=m.user_id
          WHERE m.organization_id=$1
            AND m.role IN ('owner','admin')
            AND u.status='active'
          ORDER BY CASE m.role WHEN 'owner' THEN 0 ELSE 1 END, m.created_at
          LIMIT 1",
    )
    .bind(organization_id)
    .fetch_optional(db)
    .await
    {
        Ok(Some(row)) => (row.get::<String, _>("email"), row.get::<String, _>("display_name")),
        Ok(None) => {
            tracing::warn!(%organization_id, "billing email skipped because no active organization owner/admin was found");
            return;
        }
        Err(e) => {
            tracing::error!(%organization_id, %e, "could not resolve billing email recipient");
            return;
        }
    };

    let base = match env::var("AGATA_PUBLIC_BASE_URL") {
        Ok(value) if !value.trim().is_empty() => value.trim_end_matches('/').to_string(),
        _ => {
            tracing::warn!(%organization_id, "billing email skipped because AGATA_PUBLIC_BASE_URL is not configured");
            return;
        }
    };
    if let Err(e) = send_template_email_as(
        &recipient.0,
        "billing-update",
        json!({
            "DISPLAY_NAME": escape_email_template_value(&recipient.1),
            "EVENT_TITLE": escape_email_template_value(title),
            "DETAILS": escape_email_template_value(details),
            "ACTION_URL": escape_email_template_value(&format!("{base}/app/billing")),
            "REQUEST_ID": escape_email_template_value(event_reference)
        }),
        "billing",
    )
    .await
    {
        tracing::error!(%organization_id, %e, "billing notification email delivery failed");
    }
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
    fn lemonsqueezy_signature_round_trip_and_rejection() {
        let payload = r#"{"meta":{"event_name":"subscription_created"},"data":{"id":"1"}}"#;
        let secret = "test_signing_secret";
        type HmacSha256 = Hmac<sha2::Sha256>;
        let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(payload.as_bytes());
        let signature = hex::encode(mac.finalize().into_bytes());
        assert!(verify_lemonsqueezy_signature(payload, &signature, secret));
        assert!(!verify_lemonsqueezy_signature(payload, "invalid", secret));
        assert!(!verify_lemonsqueezy_signature("different", &signature, secret));
    }
    #[test]
    fn lemonsqueezy_catalog_amounts_are_exact_minor_units() {
        assert_eq!(expected_lemonsqueezy_amount("starter"), Some(14_900));
        assert_eq!(expected_lemonsqueezy_amount("growth"), Some(49_900));
        assert_eq!(expected_lemonsqueezy_amount("scale"), Some(119_900));
        assert_eq!(expected_lemonsqueezy_amount("free"), None);
        assert_eq!(expected_lemonsqueezy_amount("enterprise"), None);
    }
}
