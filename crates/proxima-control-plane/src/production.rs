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

fn paystack_plan_codes_unique(starter: Option<&str>, growth: Option<&str>, scale: Option<&str>) -> bool {
    match (starter, growth, scale) {
        (Some(starter), Some(growth), Some(scale)) =>
            !starter.trim().is_empty()
                && !growth.trim().is_empty()
                && !scale.trim().is_empty()
                && starter != growth
                && starter != scale
                && growth != scale,
        _ => false,
    }
}

fn configured_paystack_plan_codes_unique() -> bool {
    let starter = paystack_plan_code("starter");
    let growth = paystack_plan_code("growth");
    let scale = paystack_plan_code("scale");
    paystack_plan_codes_unique(starter.as_deref(), growth.as_deref(), scale.as_deref())
}

fn expected_paystack_amount_usd(plan: &str) -> Option<i64> {
    match plan {
        "starter" => Some(14_900),
        "growth" => Some(49_900),
        "scale" => Some(119_900),
        _ => None,
    }
}

fn paystack_provider_plan_matches_catalog(data: &Value, plan: &str, expected_code: &str) -> bool {
    data.get("plan_code").and_then(Value::as_str) == Some(expected_code)
        && data.get("amount").and_then(Value::as_i64) == expected_paystack_amount_usd(plan)
        && data.get("currency").and_then(Value::as_str) == Some("USD")
        && data.get("interval").and_then(Value::as_str) == Some("monthly")
}

fn paystack_payload_matches_plan_amount_currency(data: &Value, plan: &str) -> bool {
    let amount = data.get("amount")
        .or_else(|| data.pointer("/plan/amount"))
        .or_else(|| data.pointer("/subscription/plan/amount"))
        .and_then(Value::as_i64);
    let currency = data.get("currency")
        .or_else(|| data.pointer("/plan/currency"))
        .or_else(|| data.pointer("/subscription/plan/currency"))
        .and_then(Value::as_str);
    amount == expected_paystack_amount_usd(plan) && currency == Some("USD")
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
        let plan_code=paystack_plan_code(key);
        let (nodes,tenants,environments,retention,advanced,fleet,priority,entra,private_deployment)=plan_limits(key);
        let integrations = plan_integration_limit(key);
        let verifications = plan_verification_limit(key);
        let team_seats = plan_team_seat_limit(key);
        let api_keys = plan_api_key_limit(key);
        let api_requests = plan_api_requests_per_minute(key);
        let support = plan_support_level(key);
        json!({"key":key,"name":name,"monthly_usd":monthly_usd,"description":description,"provider":"paystack","plan_code":plan_code,"checkout_available":key!=&"free"&&key!=&"enterprise"&&paystack_plan_code(key).is_some()&&configured_paystack_plan_codes_unique(),"limits":{"nodes":nodes,"tenants":tenants,"environments":environments,"integrations":integrations,"verifications_per_month":verifications,"team_seats":team_seats,"api_keys":api_keys,"api_requests_per_minute":api_requests,"audit_retention_days":retention},"support_level":support,"features":{"advanced_verification":advanced,"fleet_controls":fleet,"priority_support":priority,"entra_oidc":entra,"private_deployment":private_deployment,"policy_management":key!=&"free"}})
    }).collect::<Vec<_>>();
    Json(json!({"currency":"usd","billing_interval":"month","provider":"paystack","plans":plans})).into_response()
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
        Ok(None)=>Json(json!({"configured":false,"provider":"paystack","plan":"free","status":"active"})).into_response(),Err(e)=>db_error(e)
    }
}
pub(crate) async fn checkout(State(s):State<AppState>,headers:HeaderMap,Json(input):Json<CheckoutInput>)->Response{
    let ctx=match authenticate(&s,&headers).await{Ok(v)=>v,Err(c)=>return c.into_response()};if let Err(c)=require_admin(&ctx,&headers){return c.into_response();}
    let secret=match env::var("PAYSTACK_SECRET_KEY"){Ok(v) if !v.trim().is_empty()=>v,_=>return service_unavailable("Paystack secret is not configured.")};
    if !configured_paystack_plan_codes_unique() {
        return service_unavailable("Agata Proxima Paystack plan codes must all be configured and unique before checkout.");
    }
    let plan_code=match input.price_id.as_deref().and_then(paystack_plan_code_for_input){Some(v)=>v,None=>return bad("Select an Agata Proxima plan before checkout.")};
    let plan=match plan_for_code(Some(&plan_code)){Some(v)=>v,None=>return (StatusCode::FORBIDDEN,Json(json!({"ok":false,"error":"invalid_agata_plan"}))).into_response()};
    if plan == "free" || plan == "enterprise" {
        return bad("Free plans do not use checkout; Enterprise access requires explicit contracted provisioning.");
    }

    // Check the provider-side plan before redirecting a customer to checkout.
    // A plan code can be misconfigured in the Paystack dashboard; never let that
    // silently charge a different currency, amount, or interval.
    let plan_response = match Client::new()
        .get(format!("https://api.paystack.co/plan/{plan_code}"))
        .bearer_auth(&secret)
        .send()
        .await {
            Ok(response) => response,
            Err(error) => return external_error(error),
        };
    if !plan_response.status().is_success() {
        return paystack_error(plan_response).await;
    }
    let plan_body: Value = match plan_response.json().await {
        Ok(value) => value,
        Err(error) => return external_error(error),
    };
    let provider_plan = plan_body.get("data").cloned().unwrap_or(Value::Null);
    if plan_body.get("status").and_then(Value::as_bool) != Some(true)
        || !paystack_provider_plan_matches_catalog(&provider_plan, plan, &plan_code) {
        return (StatusCode::SERVICE_UNAVAILABLE, Json(json!({
            "ok": false,
            "error": "paystack_plan_configuration_mismatch",
            "message": "The configured Paystack plan must match the Agata Proxima plan's exact USD amount and monthly interval. Checkout is disabled until the provider plan is corrected."
        }))).into_response();
    }

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
    let verified = match sqlx::query("SELECT status FROM billing_transactions WHERE provider='paystack' AND reference=$1 AND organization_id=$2")
        .bind(&reference).bind(organization_id).fetch_optional(&s.db).await {
        Ok(Some(row)) => row.get::<String,_>("status") == "success",
        _ => false,
    };
    let billing_state = if verified { "complete" } else { "verification-pending" };
    let base = env::var("AGATA_PUBLIC_BASE_URL").unwrap_or_else(|_| "http://127.0.0.1:8080".into()).trim_end_matches('/').to_string();
    Html(format!(
        "<html><head><meta http-equiv=\"refresh\" content=\"0;url={base}/app?billing={billing_state}\"></head><body style=\"background:#05080c;color:#eef7f8;font-family:Arial;padding:60px\">Returning to Agata Proxima. Check billing status before assuming payment was accepted.</body></html>"
    )).into_response()
}

pub(crate) async fn billing_verify(State(s):State<AppState>,headers:HeaderMap,Query(q):Query<std::collections::HashMap<String,String>>)->Response{
    let ctx=match authenticate(&s,&headers).await{Ok(v)=>v,Err(c)=>return c.into_response()};if let Err(c)=require_admin(&ctx,&headers){return c.into_response();}let reference=match q.get("reference").or_else(||q.get("trxref")){Some(v) if !v.trim().is_empty()=>v.trim(),_=>return bad("Paystack transaction reference is required.")};verify_paystack_transaction(&s.db,ctx.organization_id,reference).await
}
async fn verify_paystack_transaction(db: &sqlx::PgPool, org: Uuid, reference: &str) -> Response {
    let local = match sqlx::query(
        "SELECT plan_key,plan_code FROM billing_transactions
          WHERE provider='paystack' AND reference=$1 AND organization_id=$2",
    )
    .bind(reference)
    .bind(org)
    .fetch_optional(db)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => return (StatusCode::NOT_FOUND, Json(json!({"ok":false,"error":"unknown_local_transaction"}))).into_response(),
        Err(e) => return db_error(e),
    };

    let plan: String = local.get("plan_key");
    let expected_plan_code: Option<String> = local.get("plan_code");
    if !matches!(plan.as_str(), "starter" | "growth" | "scale") {
        return (StatusCode::FORBIDDEN, Json(json!({"ok":false,"error":"invalid_local_plan"}))).into_response();
    }

    let secret = match env::var("PAYSTACK_SECRET_KEY") {
        Ok(value) if !value.trim().is_empty() => value,
        _ => return service_unavailable("Paystack secret is not configured."),
    };
    let response = match Client::new()
        .get(format!("https://api.paystack.co/transaction/verify/{reference}"))
        .bearer_auth(secret)
        .send()
        .await
    {
        Ok(value) => value,
        Err(e) => return external_error(e),
    };
    if !response.status().is_success() {
        return paystack_error(response).await;
    }

    let body: Value = match response.json().await {
        Ok(value) => value,
        Err(e) => return external_error(e),
    };
    if body.get("status").and_then(Value::as_bool) != Some(true) {
        return service_unavailable("Paystack transaction verification failed.");
    }

    let data = body.get("data").cloned().unwrap_or(Value::Null);
    let status = data.get("status").and_then(Value::as_str).unwrap_or_default();
    let metadata_org = data
        .pointer("/metadata/organization_id")
        .and_then(Value::as_str)
        .and_then(|value| Uuid::parse_str(value).ok());
    if metadata_org != Some(org) {
        return (StatusCode::FORBIDDEN, Json(json!({"ok":false,"error":"transaction_organization_mismatch"}))).into_response();
    }

    let returned_plan_code = data
        .pointer("/plan/plan_code")
        .and_then(Value::as_str)
        .or_else(|| data.pointer("/subscription/plan/plan_code").and_then(Value::as_str))
        .or_else(|| data.pointer("/subscription/plan_code").and_then(Value::as_str))
        .or_else(|| data.get("plan_code").and_then(Value::as_str));
    if expected_plan_code.as_deref().is_none() || returned_plan_code != expected_plan_code.as_deref() {
        return (StatusCode::FORBIDDEN, Json(json!({"ok":false,"error":"transaction_plan_mismatch"}))).into_response();
    }

    let amount = data.get("amount").and_then(Value::as_i64);
    let currency = data.get("currency").and_then(Value::as_str).unwrap_or_default();
    if status == "success" {
        if currency != "USD" {
            return (StatusCode::FORBIDDEN, Json(json!({"ok":false,"error":"transaction_currency_mismatch","expected_currency":"USD","received_currency":currency}))).into_response();
        }
        if amount != expected_paystack_amount_usd(&plan) {
            return (StatusCode::FORBIDDEN, Json(json!({"ok":false,"error":"transaction_amount_mismatch","expected_amount_subunits":expected_paystack_amount_usd(&plan),"received_amount_subunits":amount}))).into_response();
        }
    }
    let payload = data.clone();
    let end = data
        .get("next_payment_date")
        .and_then(Value::as_str)
        .and_then(|value| chrono::DateTime::parse_from_rfc3339(value).ok())
        .map(|value| value.with_timezone(&chrono::Utc));

    if let Err(e) = sqlx::query(
        "UPDATE billing_transactions
            SET transaction_id=$1,plan_key=$2,plan_code=$3,amount=$4,currency=$5,
                status=$6,payload=$7,updated_at=now()
          WHERE provider='paystack' AND reference=$8 AND organization_id=$9",
    )
    .bind(data.get("id").and_then(Value::as_u64).map(|value| value as i64))
    .bind(&plan)
    .bind(expected_plan_code.as_deref())
    .bind(amount)
    .bind(currency)
    .bind(status)
    .bind(&payload)
    .bind(reference)
    .bind(org)
    .execute(db)
    .await
    {
        return db_error(e);
    }

    if status == "success" {
        if let Err(e) = apply_entitlements(db, org, &plan).await {
            return db_error(e);
        }
        let customer_code = data
            .pointer("/customer/customer_code")
            .and_then(Value::as_str)
            .or_else(|| data.get("customer_code").and_then(Value::as_str));
        let subscription_code = data
            .get("subscription_code")
            .and_then(Value::as_str)
            .or_else(|| data.pointer("/subscription/subscription_code").and_then(Value::as_str));
        if let Err(e) = sqlx::query(
            "INSERT INTO billing_accounts
                (organization_id,paystack_customer_code,paystack_subscription_code,paystack_plan_code,
                 plan_key,status,current_period_end,cancel_at_period_end,updated_at)
             VALUES($1,$2,$3,$4,$5,'active',$6,false,now())
             ON CONFLICT(organization_id) DO UPDATE SET
                paystack_customer_code=COALESCE(EXCLUDED.paystack_customer_code,billing_accounts.paystack_customer_code),
                paystack_subscription_code=COALESCE(EXCLUDED.paystack_subscription_code,billing_accounts.paystack_subscription_code),
                paystack_plan_code=COALESCE(EXCLUDED.paystack_plan_code,billing_accounts.paystack_plan_code),
                plan_key=EXCLUDED.plan_key,status='active',
                current_period_end=COALESCE(EXCLUDED.current_period_end,billing_accounts.current_period_end),
                cancel_at_period_end=false,updated_at=now()",
        )
        .bind(org)
        .bind(customer_code)
        .bind(subscription_code)
        .bind(expected_plan_code.as_deref())
        .bind(&plan)
        .bind(end)
        .execute(db)
        .await
        {
            return db_error(e);
        }
    }

    Json(json!({
        "ok": true,
        "verified": status == "success",
        "provider": "paystack",
        "reference": reference,
        "status": status,
        "plan": plan
    }))
    .into_response()
}

pub(crate) async fn portal(State(s):State<AppState>,headers:HeaderMap)->Response{
    let ctx=match authenticate(&s,&headers).await{Ok(v)=>v,Err(c)=>return c.into_response()};if let Err(c)=require_admin(&ctx,&headers){return c.into_response();}
    let secret=match env::var("PAYSTACK_SECRET_KEY"){Ok(v) if !v.trim().is_empty()=>v,_=>return service_unavailable("Paystack secret is not configured.")};let code=match sqlx::query("SELECT paystack_subscription_code FROM billing_accounts WHERE organization_id=$1").bind(ctx.organization_id).fetch_optional(&s.db).await{Ok(Some(r))=>r.get::<Option<String>,_>("paystack_subscription_code"),Ok(None)=>None,Err(e)=>return db_error(e)};let code=match code{Some(v)=>v,None=>return bad("No Paystack subscription exists for this organization yet.")};
    let response=match Client::new().get(format!("https://api.paystack.co/subscription/{code}/manage/link")).bearer_auth(secret).send().await{Ok(r)=>r,Err(e)=>return external_error(e)};if !response.status().is_success(){return paystack_error(response).await;}let body:Value=match response.json().await{Ok(v)=>v,Err(e)=>return external_error(e)};let url=body.pointer("/data/link").and_then(Value::as_str).unwrap_or_default();if url.is_empty(){return service_unavailable("Paystack did not return a subscription management URL.");}Json(json!({"ok":true,"provider":"paystack","portal_url":url})).into_response()
}
async fn mark_paystack_event_ignored(
    db: &sqlx::PgPool,
    key: &str,
    reason: &str,
) -> Response {
    let _ = sqlx::query(
        "UPDATE billing_events
            SET status='ignored',processed_at=now(),processing_started_at=NULL
          WHERE provider='paystack' AND provider_event_id=$1",
    )
    .bind(key)
    .execute(db)
    .await;
    Json(json!({"received":true,"ignored":reason})).into_response()
}

pub(crate) async fn paystack_webhook(
    State(s): State<AppState>,
    headers: HeaderMap,
    body: String,
) -> Response {
    let signature = match headers.get("x-paystack-signature").and_then(|v| v.to_str().ok()) {
        Some(value) => value,
        None => return StatusCode::BAD_REQUEST.into_response(),
    };
    let secret = match env::var("PAYSTACK_SECRET_KEY") {
        Ok(value) if !value.trim().is_empty() => value,
        _ => return StatusCode::SERVICE_UNAVAILABLE.into_response(),
    };
    if !verify_paystack_signature(&body, signature, &secret) {
        return StatusCode::UNAUTHORIZED.into_response();
    }

    let event: Value = match serde_json::from_str(&body) {
        Ok(value) => value,
        Err(_) => return StatusCode::BAD_REQUEST.into_response(),
    };
    let event_type = event.get("event").and_then(Value::as_str).unwrap_or_default();
    if event_type.is_empty() {
        return StatusCode::BAD_REQUEST.into_response();
    }
    let data = event.get("data").cloned().unwrap_or(Value::Null);
    let key = event
        .get("id")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .or_else(|| event.get("id").and_then(Value::as_i64).map(|v| v.to_string()))
        .or_else(|| {
            data.get("id")
                .and_then(Value::as_i64)
                .map(|v| format!("{event_type}:{v}"))
        })
        .or_else(|| {
            data.get("reference")
                .and_then(Value::as_str)
                .map(|v| format!("{event_type}:{v}"))
        })
        .unwrap_or_else(|| {
            format!(
                "{event_type}:{}",
                hex::encode(Sha256::digest(body.as_bytes()))
            )
        });

    let claimed = match sqlx::query(
        "INSERT INTO billing_events
            (provider,provider_event_id,event_type,payload,status,processing_started_at,attempt_count)
         VALUES('paystack',$1,$2,$3,'processing',now(),1)
         ON CONFLICT(provider,provider_event_id) DO UPDATE
            SET status='processing',processing_started_at=now(),
                attempt_count=billing_events.attempt_count+1,
                payload=EXCLUDED.payload,event_type=EXCLUDED.event_type
          WHERE billing_events.status NOT IN ('processed','ignored')
            AND (billing_events.processing_started_at IS NULL
                 OR billing_events.processing_started_at < now()-interval '5 minutes')
         RETURNING id",
    )
    .bind(&key)
    .bind(event_type)
    .bind(&event)
    .fetch_optional(&s.db)
    .await
    {
        Ok(value) => value.is_some(),
        Err(e) => return db_error(e),
    };
    if !claimed {
        return Json(json!({"received":true,"duplicate":true})).into_response();
    }

    let reference = data.get("reference").and_then(Value::as_str);
    let transaction = if let Some(reference) = reference {
        match sqlx::query(
            "SELECT organization_id,plan_key,plan_code
               FROM billing_transactions
              WHERE provider='paystack' AND reference=$1",
        )
        .bind(reference)
        .fetch_optional(&s.db)
        .await
        {
            Ok(value) => value,
            Err(e) => return db_error(e),
        }
    } else {
        None
    };

    let metadata_org = data
        .pointer("/metadata/organization_id")
        .and_then(Value::as_str)
        .and_then(|value| Uuid::parse_str(value).ok());
    let transaction_org = transaction.as_ref().map(|row| row.get::<Uuid, _>("organization_id"));
    if let (Some(metadata_org), Some(transaction_org)) = (metadata_org, transaction_org) {
        if metadata_org != transaction_org {
            return mark_paystack_event_ignored(&s.db, &key, "transaction_organization_mismatch").await;
        }
    }

    let customer_code = data
        .pointer("/customer/customer_code")
        .and_then(Value::as_str)
        .or_else(|| data.get("customer_code").and_then(Value::as_str));
    let subscription_code = data
        .get("subscription_code")
        .and_then(Value::as_str)
        .or_else(|| data.pointer("/subscription/subscription_code").and_then(Value::as_str));

    let customer_org = if metadata_org.is_none() && transaction_org.is_none() {
        if let Some(code) = customer_code {
            match sqlx::query(
                "SELECT organization_id FROM billing_accounts WHERE paystack_customer_code=$1",
            )
            .bind(code)
            .fetch_optional(&s.db)
            .await
            {
                Ok(value) => value.map(|row| row.get::<Uuid, _>("organization_id")),
                Err(e) => return db_error(e),
            }
        } else {
            None
        }
    } else {
        None
    };

    let subscription_org = if metadata_org.is_none() && transaction_org.is_none() && customer_org.is_none() {
        if let Some(code) = subscription_code {
            match sqlx::query(
                "SELECT organization_id FROM billing_accounts WHERE paystack_subscription_code=$1",
            )
            .bind(code)
            .fetch_optional(&s.db)
            .await
            {
                Ok(value) => value.map(|row| row.get::<Uuid, _>("organization_id")),
                Err(e) => return db_error(e),
            }
        } else {
            None
        }
    } else {
        None
    };

    let org = match metadata_org.or(transaction_org).or(customer_org).or(subscription_org) {
        Some(value) => value,
        None => return mark_paystack_event_ignored(&s.db, &key, "organization_not_resolved").await,
    };

    let payload_plan_code = data
        .pointer("/plan/plan_code")
        .and_then(Value::as_str)
        .or_else(|| data.pointer("/subscription/plan/plan_code").and_then(Value::as_str))
        .or_else(|| data.pointer("/subscription/plan_code").and_then(Value::as_str))
        .or_else(|| data.get("plan_code").and_then(Value::as_str));

    let transaction_plan = transaction.as_ref().map(|row| row.get::<String, _>("plan_key"));
    let transaction_plan_code = transaction
        .as_ref()
        .and_then(|row| row.get::<Option<String>, _>("plan_code"));

    if let (Some(expected), Some(received)) =
        (transaction_plan_code.as_deref(), payload_plan_code)
    {
        if expected != received {
            return mark_paystack_event_ignored(&s.db, &key, "transaction_plan_code_mismatch").await;
        }
    }

    let event_plan = transaction_plan
        .as_deref()
        .or_else(|| payload_plan_code.and_then(|code| plan_for_code(Some(code))));
    let event_plan_code = transaction_plan_code
        .as_deref()
        .or(payload_plan_code);

    match event_type {
        "charge.success" | "subscription.create" | "subscription.enable" => {
            if event_type == "charge.success" && transaction.is_none() {
                return mark_paystack_event_ignored(&s.db, &key, "successful_charge_without_local_transaction").await;
            }
            let plan = match event_plan {
                Some("starter") => "starter",
                Some("growth") => "growth",
                Some("scale") => "scale",
                _ => return mark_paystack_event_ignored(&s.db, &key, "unknown_or_non_self_service_plan").await,
            };

            // Never grant a paid entitlement based only on a successful event name.
            // The provider payload must match the configured plan's exact USD amount and currency.
            if !paystack_payload_matches_plan_amount_currency(&data, plan) {
                return mark_paystack_event_ignored(&s.db, &key, "webhook_plan_amount_or_currency_mismatch").await;
            }
            let configured_plan_code = paystack_plan_code(plan);
            if configured_plan_code.as_deref().is_none() || payload_plan_code != configured_plan_code.as_deref() {
                return mark_paystack_event_ignored(&s.db, &key, "webhook_plan_code_mismatch").await;
            }

            if let Some(reference) = reference {
                if event_type == "charge.success" {
                    if let Err(e) = sqlx::query(
                        "UPDATE billing_transactions
                            SET transaction_id=$1,status='success',payload=$2,updated_at=now()
                          WHERE provider='paystack' AND reference=$3 AND organization_id=$4",
                    )
                    .bind(data.get("id").and_then(Value::as_u64).map(|value| value as i64))
                    .bind(&data)
                    .bind(reference)
                    .bind(org)
                    .execute(&s.db)
                    .await
                    {
                        return db_error(e);
                    }
                }
            }

            let end = data
                .get("next_payment_date")
                .and_then(Value::as_str)
                .and_then(|value| chrono::DateTime::parse_from_rfc3339(value).ok())
                .map(|value| value.with_timezone(&chrono::Utc));

            if let Err(e) = sqlx::query(
                "INSERT INTO billing_accounts
                    (organization_id,paystack_customer_code,paystack_subscription_code,paystack_plan_code,
                     plan_key,status,current_period_end,cancel_at_period_end,updated_at)
                 VALUES($1,$2,$3,$4,$5,'active',$6,false,now())
                 ON CONFLICT(organization_id) DO UPDATE SET
                    paystack_customer_code=COALESCE(EXCLUDED.paystack_customer_code,billing_accounts.paystack_customer_code),
                    paystack_subscription_code=COALESCE(EXCLUDED.paystack_subscription_code,billing_accounts.paystack_subscription_code),
                    paystack_plan_code=COALESCE(EXCLUDED.paystack_plan_code,billing_accounts.paystack_plan_code),
                    plan_key=EXCLUDED.plan_key,status='active',
                    current_period_end=COALESCE(EXCLUDED.current_period_end,billing_accounts.current_period_end),
                    cancel_at_period_end=false,updated_at=now()",
            )
            .bind(org)
            .bind(customer_code)
            .bind(subscription_code)
            .bind(event_plan_code)
            .bind(plan)
            .bind(end)
            .execute(&s.db)
            .await
            {
                return db_error(e);
            }
            if let Err(e) = apply_entitlements(&s.db, org, plan).await {
                return db_error(e);
            }
            send_billing_notice(
                &s.db,
                org,
                &key,
                "Payment confirmed",
                "Your subscription payment was confirmed and the organization's paid entitlements were updated.",
            )
            .await;
        }
        "invoice.payment_failed" => {
            if let Err(e) = sqlx::query(
                "UPDATE billing_accounts SET status='attention',updated_at=now()
                  WHERE organization_id=$1 AND status NOT IN ('canceled','unpaid')",
            )
            .bind(org)
            .execute(&s.db)
            .await
            {
                return db_error(e);
            }
            if let Err(e) = sqlx::query(
                "UPDATE organization_entitlements
                    SET billing_status='past_due',
                        billing_grace_until=COALESCE(billing_grace_until,now()+interval '7 days'),
                        updated_at=now()
                  WHERE organization_id=$1 AND billing_status NOT IN ('canceled','unpaid')",
            )
            .bind(org)
            .execute(&s.db)
            .await
            {
                return db_error(e);
            }
            if let Some(reference) = reference {
                let _ = sqlx::query(
                    "UPDATE billing_transactions SET status='failed',payload=$1,updated_at=now()
                      WHERE provider='paystack' AND reference=$2 AND organization_id=$3 AND status <> 'success'",
                )
                .bind(&data)
                .bind(reference)
                .bind(org)
                .execute(&s.db)
                .await;
            }
            send_billing_notice(
                &s.db,
                org,
                &key,
                "Payment needs attention",
                "A subscription renewal payment failed. Your organization has a fixed seven-day recovery period. Review the billing settings to restore normal service before the grace period expires.",
            )
            .await;
        }
        "subscription.disable" => {
            if let Err(e) = sqlx::query(
                "UPDATE billing_accounts SET status='canceled',cancel_at_period_end=false,updated_at=now()
                  WHERE organization_id=$1",
            )
            .bind(org)
            .execute(&s.db)
            .await
            {
                return db_error(e);
            }
            if let Err(e) = sqlx::query(
                "UPDATE organization_entitlements
                    SET billing_status='canceled',billing_grace_until=NULL,updated_at=now()
                  WHERE organization_id=$1",
            )
            .bind(org)
            .execute(&s.db)
            .await
            {
                return db_error(e);
            }
            send_billing_notice(
                &s.db,
                org,
                &key,
                "Subscription canceled",
                "The payment provider reported that your subscription was disabled. Review your billing settings to understand the current plan and available options.",
            )
            .await;
        }
        "subscription.not_renew" => {
            let end = data
                .get("next_payment_date")
                .and_then(Value::as_str)
                .and_then(|value| chrono::DateTime::parse_from_rfc3339(value).ok())
                .map(|value| value.with_timezone(&chrono::Utc));
            if let Err(e) = sqlx::query(
                "UPDATE billing_accounts
                    SET status='non-renewing',cancel_at_period_end=true,
                        current_period_end=COALESCE($1,current_period_end),updated_at=now()
                  WHERE organization_id=$2",
            )
            .bind(end)
            .bind(org)
            .execute(&s.db)
            .await
            {
                return db_error(e);
            }
            send_billing_notice(
                &s.db,
                org,
                &key,
                "Subscription will not renew",
                "Your subscription is marked not to renew at the end of the current billing period. Review billing settings if this was not intended.",
            )
            .await;
        }
        "subscription.expiring_cards" => {
            if let Err(e) = sqlx::query(
                "UPDATE billing_accounts SET status='attention',updated_at=now()
                  WHERE organization_id=$1 AND status NOT IN ('canceled','unpaid')",
            )
            .bind(org)
            .execute(&s.db)
            .await
            {
                return db_error(e);
            }
            send_billing_notice(
                &s.db,
                org,
                &key,
                "Payment method may expire",
                "The payment provider reports that a saved payment card may expire soon. Review your billing settings to avoid an interruption.",
            )
            .await;
        }
        "refund.pending" | "refund.processing" | "refund.processed" | "refund.failed" | "refund.needs-attention" => {
            let refund_reference = data
                .get("reference")
                .and_then(Value::as_str)
                .or_else(|| data.get("transaction_reference").and_then(Value::as_str))
                .or_else(|| data.pointer("/transaction/reference").and_then(Value::as_str));
            if let Some(reference) = refund_reference {
                if let Err(e) = sqlx::query(
                    "UPDATE billing_transactions SET refund_status=$1,refund_payload=$2,updated_at=now()
                      WHERE provider='paystack' AND reference=$3 AND organization_id=$4",
                )
                .bind(event_type.trim_start_matches("refund."))
                .bind(&data)
                .bind(reference)
                .bind(org)
                .execute(&s.db)
                .await
                {
                    return db_error(e);
                }
            }
        }
        _ => {}
    }

    if let Err(e) = sqlx::query(
        "UPDATE billing_events SET status='processed',processed_at=now(),processing_started_at=NULL
          WHERE provider='paystack' AND provider_event_id=$1",
    )
    .bind(&key)
    .execute(&s.db)
    .await
    {
        return db_error(e);
    }
    Json(json!({"received":true,"processed":true})).into_response()
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
        "091dbdb2-21ed-444f-a209-6f44e55d192d",
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
            "d3c046c7-fef6-42f0-931e-d92b6f96cfdf",
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
        "0757a210-a372-4a5a-8fca-e642c2fed3da",
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
    let paystack = env::var("PAYSTACK_SECRET_KEY").map(|v| !v.trim().is_empty()).unwrap_or(false);
    let plans = configured_paystack_plan_codes_unique();
    let resend = env::var("RESEND_API_KEY").map(|v| !v.trim().is_empty()).unwrap_or(false);
    let fallback_from = env::var("RESEND_FROM_EMAIL").map(|v| !v.trim().is_empty()).unwrap_or(false);
    let sender_identities = [
        "RESEND_FROM_NO_REPLY_EMAIL",
        "RESEND_FROM_SUPPORT_EMAIL",
        "RESEND_FROM_SECURITY_EMAIL",
        "RESEND_FROM_BILLING_EMAIL",
        "RESEND_FROM_NOTIFICATIONS_EMAIL",
    ].iter().all(|key| env::var(key).map(|v| !v.trim().is_empty()).unwrap_or(false));
    let support_inbox = env::var("AGATA_SUPPORT_INBOX_EMAIL").map(|v| !v.trim().is_empty()).unwrap_or(false);
    let base = env::var("AGATA_PUBLIC_BASE_URL").map(|v| !v.trim().is_empty()).unwrap_or(false);
    let oidc = env::var("PROXIMA_OIDC_CLIENT_ID").map(|v| !v.trim().is_empty()).unwrap_or(false)
        && env::var("PROXIMA_OIDC_CLIENT_SECRET").map(|v| !v.trim().is_empty()).unwrap_or(false);
    let email_ready = resend && sender_identities && support_inbox;
    let all = db_ok && paystack && plans && email_ready && base && oidc;
    Json(json!({
        "status": if all { "ready" } else { "needs_configuration" },
        "checks": {
            "database": db_ok,
            "paystack_secret": paystack,
            "paystack_plans": plans,
            "resend_api_key": resend,
            "resend_fallback_sender": fallback_from,
            "resend_sender_identities": sender_identities,
            "support_inbox": support_inbox,
            "public_base_url": base,
            "oidc": oidc,
            "engine_remains_authoritative": true
        }
    })).into_response()
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

pub(crate) async fn send_template_email(
    to: &str,
    template_id: &str,
    variables: Value,
) -> anyhow::Result<()> {
    send_template_email_as(to, template_id, variables, "notifications").await
}

pub(crate) async fn send_template_email_as(
    to: &str,
    template_id: &str,
    variables: Value,
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

    let base = env::var("AGATA_PUBLIC_BASE_URL")
        .unwrap_or_else(|_| "https://agataproxima.com".to_string())
        .trim_end_matches('/')
        .to_string();
    if let Err(e) = send_template_email_as(
        &recipient.0,
        "0500c270-e1ab-474f-b3d4-288831b73049",
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
