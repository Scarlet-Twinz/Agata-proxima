#[rustfmt::skip]
mod production;

use crate::production::service_unavailable;

use anyhow::Result;
use argon2::{
    password_hash::{phc::PasswordHash, PasswordHasher, PasswordVerifier},
    Argon2,
};
use axum::{
    extract::{Path, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::{Html, IntoResponse, Response},
    routing::{delete, get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sqlx::{postgres::PgPoolOptions, PgPool, Row};
use std::{env, net::SocketAddr};
use tower_http::trace::TraceLayer;
use tracing::{error, info};
use uuid::Uuid;

#[derive(Clone)]
struct AppState {
    db: PgPool,
    secure_cookie: bool,
}

#[derive(Clone)]
struct AuthContext {
    user_id: Uuid,
    organization_id: Uuid,
    role: String,
    csrf: String,
}

#[derive(Deserialize)]
struct AuthInput {
    email: String,
    password: String,
    name: Option<String>,
    organization: Option<String>,
}

#[derive(Deserialize)]
struct NameInput {
    name: String,
}

#[derive(Deserialize)]
struct SwitchOrganizationInput {
    organization_id: Uuid,
}

#[derive(Deserialize)]
struct SettingsPatchInput {
    display_name: Option<String>,
    organization_name: Option<String>,
    preferences: Option<Value>,
}

#[derive(Deserialize)]
struct ChangeEmailInput {
    current_password: String,
    new_email: String,
}

#[derive(Deserialize)]
struct ConfirmEmailInput {
    code: String,
}

#[derive(Deserialize)]
struct PasswordChangeInput {
    current_password: String,
    new_password: String,
}

#[derive(Deserialize)]
struct TenantInput {
    organization_id: Uuid,
    name: String,
    slug: String,
    isolation_mode: Option<String>,
}

#[derive(Deserialize)]
struct PolicyInput {
    organization_id: Uuid,
    name: String,
    version: i32,
    document: Value,
}

#[derive(Deserialize)]
struct NodeInput {
    organization_id: Uuid,
    name: String,
    environment: Option<String>,
    region: Option<String>,
}

#[derive(Deserialize)]
struct DeploymentInput {
    organization_id: Uuid,
    node_id: Uuid,
    version: String,
    desired_state: String,
}

#[derive(Deserialize)]
struct VerificationInput {
    organization_id: Uuid,
    tenant_id: Option<Uuid>,
    kind: String,
    status: String,
    evidence: Value,
}

#[derive(Deserialize)]
struct SupportInput {
    organization_id: Uuid,
    subject: String,
    message: String,
    priority: Option<String>,
}

#[derive(Deserialize)]
struct ApiKeyInput {
    name: String,
}

#[derive(Deserialize)]
struct WebhookInput {
    name: String,
    endpoint_url: String,
    events: Vec<String>,
}

#[derive(Serialize)]
struct Message {
    ok: bool,
    message: String,
}

#[derive(Serialize)]
struct AuthOutput {
    user_id: Uuid,
    organization_id: Uuid,
    csrf_token: String,
}

#[tokio::main]
async fn main() -> Result<()> {
    let _ = dotenvy::from_filename(".env.local");
    let _ = dotenvy::dotenv();
    tracing_subscriber::fmt().with_target(false).init();

    let database_url = env::var("PROXIMA_CONTROL_DATABASE_URL").unwrap_or_else(|_| {
        "postgres://proxima_control:proxima-control-dev@127.0.0.1:55443/proxima_control".into()
    });

    let db = PgPoolOptions::new()
        .max_connections(20)
        .connect(&database_url)
        .await?;

    sqlx::raw_sql(include_str!("../migrations/0001_control_plane.sql"))
        .execute(&db)
        .await?;
    sqlx::raw_sql(include_str!("../migrations/0002_production.sql"))
        .execute(&db)
        .await?;
    sqlx::raw_sql(include_str!("../migrations/0003_entitlements.sql"))
        .execute(&db)
        .await?;
    sqlx::raw_sql(include_str!("../migrations/0004_oidc.sql"))
        .execute(&db)
        .await?;
    sqlx::raw_sql(include_str!("../migrations/0005_developer.sql"))
        .execute(&db)
        .await?;
    sqlx::raw_sql(include_str!("../migrations/0006_account_settings.sql"))
        .execute(&db)
        .await?;
    sqlx::raw_sql(include_str!("../migrations/0007_notifications_email.sql"))
        .execute(&db)
        .await?;
    sqlx::query("UPDATE organization_entitlements SET plan_key='free', billing_status='active' WHERE plan_key='agata'")
        .execute(&db)
        .await?;

    let state = AppState {
        db,
        secure_cookie: env::var("PROXIMA_COOKIE_SECURE").ok().as_deref() == Some("true"),
    };

    let app = Router::new()
        .route("/", get(home))
        .route("/product", get(public_page))
        .route("/solutions", get(public_page))
        .route("/security", get(public_page))
        .route("/trust", get(public_page))
        .route("/pricing", get(public_page))
        .route("/developer", get(public_page))
        .route("/changelog", get(public_page))
        .route("/docs", get(public_page))
        .route("/company", get(public_page))
        .route("/support", get(public_page))
        .route("/status", get(public_page))
        .route("/faq", get(public_page))
        .route("/contact", get(public_page))
        .route("/legal/privacy", get(public_page))
        .route("/legal/terms", get(public_page))
        .route("/legal/subprocessors", get(public_page))
        .route("/login", get(login_page))
        .route("/signup", get(signup_page))
        .route("/app", get(app_page))
        .route("/logo.svg", get(logo))
        .route("/docs/openapi.json", get(openapi))
        .route("/healthz", get(healthz))
        .route("/api/v1/health", get(healthz))
        .route("/api/v1/auth/signup", post(signup))
        .route("/api/v1/auth/login", post(login))
        .route(
            "/api/v1/auth/verification/resend",
            post(production::resend_verification_email),
        )
        .route(
            "/api/v1/auth/verification/confirm",
            post(production::verify_email_code),
        )
        .route(
            "/api/v1/auth/switch-organization",
            post(switch_organization),
        )
        .route("/api/v1/auth/logout", post(logout))
        .route("/api/v1/session", get(session))
        .route("/api/v1/settings", get(settings).patch(update_settings))
        .route("/api/v1/settings/email/change", post(change_email))
        .route("/api/v1/settings/email/confirm", post(confirm_email_change))
        .route("/api/v1/notifications", get(notifications))
        .route(
            "/api/v1/notifications/read-all",
            post(mark_all_notifications_read),
        )
        .route(
            "/api/v1/notifications/:id/read",
            post(mark_notification_read),
        )
        .route("/api/v1/account", delete(delete_account))
        .route("/api/v1/auth/password/change", post(change_password))
        .route("/api/v1/platform/status", get(platform_status))
        .route(
            "/api/v1/control-plane/overview",
            get(control_plane_overview),
        )
        .route(
            "/api/v1/organizations",
            get(organizations).post(create_organization),
        )
        .route("/api/v1/tenants", get(tenants).post(create_tenant))
        .route("/api/v1/policies", get(policies).post(create_policy))
        .route("/api/v1/nodes", get(nodes).post(create_node))
        .route(
            "/api/v1/deployments",
            get(deployments).post(create_deployment),
        )
        .route(
            "/api/v1/verifications",
            get(verifications).post(create_verification),
        )
        .route("/api/v1/audit", get(audit_events))
        .route("/api/v1/support", get(support).post(create_support))
        .route(
            "/api/v1/developer/api-keys",
            get(api_keys).post(create_api_key),
        )
        .route("/api/v1/developer/api-keys/{id}", delete(revoke_api_key))
        .route(
            "/api/v1/developer/webhooks",
            get(webhooks).post(create_webhook),
        )
        .route(
            "/api/v1/developer/webhooks/{id}",
            get(webhook_detail).delete(delete_webhook),
        )
        .route(
            "/api/v1/developer/webhooks/{id}/deliveries",
            get(webhook_deliveries),
        )
        .route("/api/v1/nodes/{id}/enrollment", post(start_enrollment))
        .route("/verify-email", get(production::verify_email))
        .route("/reset-password", get(production::reset_password_page))
        .route("/accept-invite", get(production::accept_invite))
        .route(
            "/api/v1/auth/password-reset/request",
            post(production::request_password_reset),
        )
        .route(
            "/api/v1/auth/password-reset/confirm",
            post(production::reset_password),
        )
        .route("/api/v1/billing", get(production::billing_status))
        .route("/api/v1/billing/plans", get(production::plans))
        .route(
            "/api/v1/billing/entitlements",
            get(production::entitlements),
        )
        .route("/api/v1/billing/checkout", post(production::checkout))
        .route("/api/v1/billing/portal", post(production::portal))
        .route("/api/v1/webhooks/stripe", post(production::stripe_webhook))
        .route(
            "/api/v1/organization/oidc/entra",
            post(production::configure_entra),
        )
        .route("/api/v1/auth/oidc/start", get(production::entra_start))
        .route(
            "/api/v1/auth/oidc/callback",
            get(production::entra_callback),
        )
        .route("/api/v1/organization/team", get(organization_team))
        .route(
            "/api/v1/organization/invitations",
            get(organization_invitations).post(production::invite),
        )
        .route(
            "/api/v1/organization/invitations/{id}",
            delete(revoke_organization_invitation),
        )
        .route("/api/v1/production/readiness", get(production::readiness))
        .with_state(state)
        .layer(TraceLayer::new_for_http());

    let addr: SocketAddr = env::var("PROXIMA_CONTROL_BIND")
        .unwrap_or_else(|_| "127.0.0.1:8080".into())
        .parse()?;

    info!(%addr, "Agata Proxima control plane listening");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

async fn home() -> Html<&'static str> {
    Html(include_str!("../web/home.html"))
}
async fn public_page() -> Html<&'static str> {
    Html(include_str!("../web/public.html"))
}
async fn login_page() -> Html<&'static str> {
    Html(include_str!("../web/login.html"))
}
async fn signup_page() -> Html<&'static str> {
    Html(include_str!("../web/signup.html"))
}
async fn app_page() -> Html<&'static str> {
    Html(include_str!("../web/app.html"))
}
async fn logo() -> Html<&'static str> {
    Html(include_str!("../web/logo.svg"))
}

async fn openapi() -> Json<Value> {
    Json(
        serde_json::from_str(include_str!("../../../control-plane/openapi.json"))
            .expect("control-plane OpenAPI contract must be valid JSON"),
    )
}

async fn healthz(State(s): State<AppState>) -> Response {
    match sqlx::query("SELECT 1").execute(&s.db).await {
        Ok(_) => Json(json!({
            "status": "ok",
            "control_plane": "healthy",
            "data_plane_authority": "proxima-engine",
            "control_plane_coupling": "non_authoritative"
        }))
        .into_response(),
        Err(e) => {
            error!(%e, "control-plane database health check failed");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({
                    "status": "degraded",
                    "control_plane": "database_unavailable",
                    "data_plane_authority": "proxima-engine"
                })),
            )
                .into_response()
        }
    }
}

async fn signup(State(s): State<AppState>, Json(input): Json<AuthInput>) -> Response {
    if input.password.len() < 12 {
        return bad("Password must be at least 12 characters.");
    }

    let email = input.email.trim().to_lowercase();
    if email.is_empty() || !email.contains('@') {
        return bad("A valid email is required.");
    }

    let display_name = input
        .name
        .unwrap_or_else(|| email.split('@').next().unwrap_or("Operator").to_string());
    let organization = input
        .organization
        .unwrap_or_else(|| format!("{} workspace", display_name));
    let password_hash = match hash_password(&input.password) {
        Ok(value) => value,
        Err(_) => return internal("Password hashing failed."),
    };

    let mut tx = match s.db.begin().await {
        Ok(value) => value,
        Err(e) => return db_error(e),
    };

    let user_id = Uuid::new_v4();
    let organization_id = Uuid::new_v4();
    let slug = slugify(&organization);

    if let Err(e) =
        sqlx::query("INSERT INTO users(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)")
            .bind(user_id)
            .bind(&email)
            .bind(&display_name)
            .bind(&password_hash)
            .execute(&mut *tx)
            .await
    {
        return unique_error(e);
    }

    if let Err(e) = sqlx::query("INSERT INTO organizations(id,name,slug) VALUES($1,$2,$3)")
        .bind(organization_id)
        .bind(&organization)
        .bind(&slug)
        .execute(&mut *tx)
        .await
    {
        return unique_error(e);
    }

    if let Err(e) =
        sqlx::query("INSERT INTO memberships(user_id,organization_id,role) VALUES($1,$2,'owner')")
            .bind(user_id)
            .bind(organization_id)
            .execute(&mut *tx)
            .await
    {
        return db_error(e);
    }

    if let Err(e) = sqlx::query(
        "INSERT INTO projects(organization_id,name,slug) VALUES($1,'Production','production')",
    )
    .bind(organization_id)
    .execute(&mut *tx)
    .await
    {
        return db_error(e);
    }

    if let Err(e) = sqlx::query(
        "INSERT INTO organization_entitlements(organization_id) VALUES($1) ON CONFLICT DO NOTHING",
    )
    .bind(organization_id)
    .execute(&mut *tx)
    .await
    {
        return db_error(e);
    }

    if let Err(e) = sqlx::query(
        "INSERT INTO audit_events(organization_id,user_id,action,resource_type,resource_id,metadata)
         VALUES($1,$2,'organization.created','organization',$1,$3)"
    )
    .bind(organization_id).bind(user_id).bind(json!({"source":"signup"}))
    .execute(&mut *tx).await {
        return db_error(e);
    }

    if let Err(e) = tx.commit().await {
        return db_error(e);
    }

    if let Err(e) = production::send_verification_email(&s.db, user_id, &email, &display_name).await
    {
        tracing::error!(%e, "verification email delivery failed");
        let _ = sqlx::query("DELETE FROM organizations WHERE id=$1")
            .bind(organization_id)
            .execute(&s.db)
            .await;
        let _ = sqlx::query("DELETE FROM users WHERE id=$1")
            .bind(user_id)
            .execute(&s.db)
            .await;
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(Message {
                ok: false,
                message: "Workspace creation was rolled back because the verification email could not be sent. Check the Resend configuration and try again.".into(),
            }),
        )
            .into_response();
    }

    Json(json!({
        "ok": true,
        "verification_required": true,
        "user_id": user_id,
        "organization_id": organization_id,
        "message": "Workspace created. Check your email to verify your address before signing in."
    }))
    .into_response()
}

async fn login(State(s): State<AppState>, Json(input): Json<AuthInput>) -> Response {
    let email = input.email.trim().to_lowercase();
    let row = match sqlx::query(
        "SELECT id,password_hash,email_verified_at FROM users WHERE email=$1 AND status='active'",
    )
    .bind(&email)
    .fetch_optional(&s.db)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => return unauthorized(),
        Err(e) => return db_error(e),
    };

    let user_id: Uuid = row.get("id");
    let password_hash: String = row.get("password_hash");

    if !verify_password(&input.password, &password_hash) {
        return unauthorized();
    }

    if row
        .get::<Option<chrono::DateTime<chrono::Utc>>, _>("email_verified_at")
        .is_none()
    {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({
                "ok": false,
                "error": "email_verification_required",
                "message": "Verify your email address before signing in. Check your inbox for the Agata Proxima verification email."
            })),
        )
            .into_response();
    }

    let organization_id: Uuid = match sqlx::query(
        "SELECT organization_id FROM memberships WHERE user_id=$1 ORDER BY created_at LIMIT 1",
    )
    .bind(user_id)
    .fetch_optional(&s.db)
    .await
    {
        Ok(Some(row)) => row.get("organization_id"),
        Ok(None) => {
            return (
                StatusCode::FORBIDDEN,
                Json(Message {
                    ok: false,
                    message: "No organization membership.".into(),
                }),
            )
                .into_response()
        }
        Err(e) => return db_error(e),
    };

    audit(
        &s.db,
        organization_id,
        user_id,
        "auth.login",
        "session",
        None,
        json!({"method":"password"}),
    )
    .await;

    create_notification(
        &s.db,
        user_id,
        Some(organization_id),
        "security",
        "New sign-in",
        "Your Agata Proxima account was signed in successfully.",
        Some("/app/security"),
    )
    .await;

    match create_session(&s.db, user_id, organization_id).await {
        Ok((token, csrf)) => auth_response(&s, user_id, organization_id, csrf, token),
        Err(e) => db_error(e),
    }
}

async fn logout(State(s): State<AppState>, headers: HeaderMap) -> Response {
    if let Some(token) = cookie(&headers, "proxima_session") {
        let _ = sqlx::query("DELETE FROM sessions WHERE token_hash=$1")
            .bind(token_hash(&token))
            .execute(&s.db)
            .await;
    }

    let mut response_headers = HeaderMap::new();
    response_headers.insert(
        header::SET_COOKIE,
        HeaderValue::from_static("proxima_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict"),
    );
    (
        response_headers,
        Json(Message {
            ok: true,
            message: "Signed out.".into(),
        }),
    )
        .into_response()
}

async fn session(State(s): State<AppState>, headers: HeaderMap) -> Response {
    match authenticate(&s, &headers).await {
        Ok(ctx) => Json(json!({
            "authenticated": true,
            "user_id": ctx.user_id,
            "organization_id": ctx.organization_id,
            "role": ctx.role,
            "csrf_token": ctx.csrf
        }))
        .into_response(),
        Err(_) => (
            StatusCode::UNAUTHORIZED,
            Json(json!({"authenticated":false})),
        )
            .into_response(),
    }
}

async fn api_keys(State(s): State<AppState>, headers: HeaderMap) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    match sqlx::query("SELECT id,name,key_prefix,last_used_at,created_at,revoked_at FROM api_keys WHERE organization_id=$1 ORDER BY created_at DESC").bind(ctx.organization_id).fetch_all(&s.db).await{
      Ok(rows)=>Json(rows.iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"name":r.get::<String,_>("name"),"key_prefix":r.get::<String,_>("key_prefix"),"last_used_at":r.get::<Option<chrono::DateTime<chrono::Utc>>,_>("last_used_at"),"created_at":r.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),"revoked_at":r.get::<Option<chrono::DateTime<chrono::Utc>>,_>("revoked_at")})).collect::<Vec<_>>()).into_response(),
      Err(e)=>db_error(e)
    }
}

async fn create_api_key(
    State(s): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<ApiKeyInput>,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if let Err(c) = require_write(&ctx, &headers) {
        return c.into_response();
    }
    let name = input.name.trim();
    if name.is_empty() {
        return bad("API key name is required.");
    }
    let id = Uuid::new_v4();
    let token = format!("aga_{}_{}", id.simple(), Uuid::new_v4().simple());
    let prefix = token.chars().take(12).collect::<String>();
    if let Err(e) = sqlx::query(
        "INSERT INTO api_keys(id,organization_id,name,key_prefix,key_hash) VALUES($1,$2,$3,$4,$5)",
    )
    .bind(id)
    .bind(ctx.organization_id)
    .bind(name)
    .bind(&prefix)
    .bind(token_hash(&token))
    .execute(&s.db)
    .await
    {
        return db_error(e);
    }
    audit(
        &s.db,
        ctx.organization_id,
        ctx.user_id,
        "developer.api_key.created",
        "api_key",
        Some(id),
        json!({"name":name}),
    )
    .await;
    Json(json!({"id":id,"name":name,"key":token,"key_prefix":prefix,"message":"Copy this key now. The full secret will not be shown again."})).into_response()
}

async fn revoke_api_key(
    State(s): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if let Err(c) = require_write(&ctx, &headers) {
        return c.into_response();
    }
    match sqlx::query("UPDATE api_keys SET revoked_at=now() WHERE id=$1 AND organization_id=$2 AND revoked_at IS NULL").bind(id).bind(ctx.organization_id).execute(&s.db).await{
      Ok(r) if r.rows_affected()==1=>{audit(&s.db,ctx.organization_id,ctx.user_id,"developer.api_key.revoked","api_key",Some(id),json!({})).await;Json(json!({"ok":true,"message":"API key revoked."})).into_response()},
      Ok(_)=>(StatusCode::NOT_FOUND,Json(json!({"message":"API key not found."}))).into_response(), Err(e)=>db_error(e)
    }
}

async fn webhooks(State(s): State<AppState>, headers: HeaderMap) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };

    match sqlx::query(
        "SELECT id,name,endpoint_url,events,enabled,created_at,updated_at
         FROM webhooks WHERE organization_id=$1 ORDER BY created_at DESC",
    )
    .bind(ctx.organization_id)
    .fetch_all(&s.db)
    .await
    {
        Ok(rows) => Json(
            rows.iter()
                .map(|r| {
                    json!({
                        "id": r.get::<Uuid,_>("id"),
                        "name": r.get::<String,_>("name"),
                        "endpoint_url": r.get::<String,_>("endpoint_url"),
                        "events": r.get::<Value,_>("events"),
                        "enabled": r.get::<bool,_>("enabled"),
                        "created_at": r.get::<chrono::DateTime<chrono::Utc>,_>("created_at"),
                        "updated_at": r.get::<chrono::DateTime<chrono::Utc>,_>("updated_at")
                    })
                })
                .collect::<Vec<_>>(),
        )
        .into_response(),
        Err(e) => db_error(e),
    }
}

async fn create_webhook(
    State(s): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<WebhookInput>,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if let Err(c) = require_write(&ctx, &headers) {
        return c.into_response();
    }

    let name = input.name.trim();
    let endpoint = input.endpoint_url.trim();
    if name.is_empty() || endpoint.is_empty() {
        return bad("Webhook name and endpoint URL are required.");
    }

    if !(endpoint.starts_with("https://")
        || endpoint.starts_with("http://127.0.0.1")
        || endpoint.starts_with("http://localhost"))
    {
        return bad("Webhook endpoint must use HTTPS outside local development.");
    }

    let id = Uuid::new_v4();
    let secret = format!("whsec_{}_{}", id.simple(), Uuid::new_v4().simple());
    let hint = secret
        .chars()
        .rev()
        .take(6)
        .collect::<String>()
        .chars()
        .rev()
        .collect::<String>();

    if let Err(e) = sqlx::query(
        "INSERT INTO webhooks(id,organization_id,name,endpoint_url,signing_secret_hash,
         signing_secret_hint,events) VALUES($1,$2,$3,$4,$5,$6,$7)",
    )
    .bind(id)
    .bind(ctx.organization_id)
    .bind(name)
    .bind(endpoint)
    .bind(token_hash(&secret))
    .bind(&hint)
    .bind(json!(input.events))
    .execute(&s.db)
    .await
    {
        return db_error(e);
    }

    audit(
        &s.db,
        ctx.organization_id,
        ctx.user_id,
        "developer.webhook.created",
        "webhook",
        Some(id),
        json!({"name":name}),
    )
    .await;

    Json(json!({
        "id":id,
        "name":name,
        "endpoint_url":endpoint,
        "events":input.events,
        "signing_secret":secret,
        "message":"Copy the signing secret now. It will not be shown again."
    }))
    .into_response()
}

async fn webhook_detail(
    State(s): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };

    match sqlx::query(
        "SELECT id,name,endpoint_url,events,enabled,signing_secret_hint,created_at,updated_at
         FROM webhooks WHERE id=$1 AND organization_id=$2",
    )
    .bind(id)
    .bind(ctx.organization_id)
    .fetch_optional(&s.db)
    .await
    {
        Ok(Some(r)) => Json(json!({
            "id":r.get::<Uuid,_>("id"),
            "name":r.get::<String,_>("name"),
            "endpoint_url":r.get::<String,_>("endpoint_url"),
            "events":r.get::<Value,_>("events"),
            "enabled":r.get::<bool,_>("enabled"),
            "signing_secret_hint":r.get::<String,_>("signing_secret_hint"),
            "created_at":r.get::<chrono::DateTime<chrono::Utc>,_>("created_at"),
            "updated_at":r.get::<chrono::DateTime<chrono::Utc>,_>("updated_at")
        }))
        .into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(json!({"message":"Webhook not found."})),
        )
            .into_response(),
        Err(e) => db_error(e),
    }
}

async fn delete_webhook(
    State(s): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if let Err(c) = require_write(&ctx, &headers) {
        return c.into_response();
    }

    match sqlx::query("DELETE FROM webhooks WHERE id=$1 AND organization_id=$2")
        .bind(id)
        .bind(ctx.organization_id)
        .execute(&s.db)
        .await
    {
        Ok(r) if r.rows_affected() == 1 => {
            audit(
                &s.db,
                ctx.organization_id,
                ctx.user_id,
                "developer.webhook.deleted",
                "webhook",
                Some(id),
                json!({}),
            )
            .await;
            Json(json!({"ok":true})).into_response()
        }
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(json!({"message":"Webhook not found."})),
        )
            .into_response(),
        Err(e) => db_error(e),
    }
}

async fn webhook_deliveries(
    State(s): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
) -> Response {
    let _ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };

    let exists = sqlx::query("SELECT 1 FROM webhooks WHERE id=$1 AND organization_id=$2")
        .bind(id)
        .fetch_optional(&s.db)
        .await;

    if !matches!(exists, Ok(Some(_))) {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({"message":"Webhook not found."})),
        )
            .into_response();
    }

    match sqlx::query(
        "SELECT id,event_type,event_id,status,status_code,response_ms,created_at
         FROM webhook_deliveries WHERE webhook_id=$1 ORDER BY created_at DESC LIMIT 100",
    )
    .bind(id)
    .fetch_all(&s.db)
    .await
    {
        Ok(rows) => Json(
            rows.iter()
                .map(|r| {
                    json!({
                        "id":r.get::<Uuid,_>("id"),
                        "event_type":r.get::<String,_>("event_type"),
                        "event_id":r.get::<String,_>("event_id"),
                        "status":r.get::<String,_>("status"),
                        "status_code":r.get::<Option<i32>,_>("status_code"),
                        "response_ms":r.get::<Option<i32>,_>("response_ms"),
                        "created_at":r.get::<chrono::DateTime<chrono::Utc>,_>("created_at")
                    })
                })
                .collect::<Vec<_>>(),
        )
        .into_response(),
        Err(e) => db_error(e),
    }
}

async fn organization_team(State(s): State<AppState>, headers: HeaderMap) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };

    match sqlx::query(
        "SELECT u.id,u.email,u.display_name,m.role,m.created_at
         FROM memberships m JOIN users u ON u.id=m.user_id
         WHERE m.organization_id=$1 ORDER BY
           CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'operator' THEN 2 ELSE 3 END,
           m.created_at",
    )
    .bind(ctx.organization_id)
    .fetch_all(&s.db)
    .await
    {
        Ok(rows) => Json(
            rows.iter()
                .map(|r| {
                    json!({
                        "id": r.get::<Uuid,_>("id"),
                        "email": r.get::<String,_>("email"),
                        "display_name": r.get::<String,_>("display_name"),
                        "role": r.get::<String,_>("role"),
                        "created_at": r.get::<chrono::DateTime<chrono::Utc>,_>("created_at"),
                        "current": r.get::<Uuid,_>("id") == ctx.user_id
                    })
                })
                .collect::<Vec<_>>(),
        )
        .into_response(),
        Err(e) => db_error(e),
    }
}

async fn organization_invitations(State(s): State<AppState>, headers: HeaderMap) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };

    match sqlx::query(
        "SELECT id,email,role,expires_at,accepted_at,created_at
         FROM organization_invites
         WHERE organization_id=$1
         ORDER BY created_at DESC",
    )
    .bind(ctx.organization_id)
    .fetch_all(&s.db)
    .await
    {
        Ok(rows) => Json(rows.iter().map(|r| json!({
            "id": r.get::<Uuid,_>("id"),
            "email": r.get::<String,_>("email"),
            "role": r.get::<String,_>("role"),
            "expires_at": r.get::<chrono::DateTime<chrono::Utc>,_>("expires_at"),
            "accepted_at": r.try_get::<chrono::DateTime<chrono::Utc>,_>("accepted_at").ok(),
            "created_at": r.get::<chrono::DateTime<chrono::Utc>,_>("created_at"),
            "status": if r.try_get::<chrono::DateTime<chrono::Utc>,_>("accepted_at").ok().is_some() {
                "accepted"
            } else {
                "pending"
            }
        })).collect::<Vec<_>>()).into_response(),
        Err(e) => db_error(e),
    }
}

async fn revoke_organization_invitation(
    State(s): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if let Err(c) = require_write(&ctx, &headers) {
        return c.into_response();
    }

    let result = sqlx::query(
        "DELETE FROM organization_invites
         WHERE id=$1 AND organization_id=$2 AND accepted_at IS NULL",
    )
    .bind(id)
    .bind(ctx.organization_id)
    .execute(&s.db)
    .await;

    match result {
        Ok(result) if result.rows_affected() == 1 => {
            audit(
                &s.db,
                ctx.organization_id,
                ctx.user_id,
                "organization.invite.revoked",
                "organization_invite",
                Some(id),
                json!({}),
            )
            .await;
            Json(json!({"ok":true,"message":"Invitation revoked."})).into_response()
        }
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(json!({"ok":false,"message":"Pending invitation not found."})),
        )
            .into_response(),
        Err(e) => db_error(e),
    }
}

async fn platform_status(State(s): State<AppState>, headers: HeaderMap) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    let tenants = scalar_count(&s.db, "SELECT count(*) FROM tenants t JOIN projects p ON p.id=t.project_id WHERE p.organization_id=$1", ctx.organization_id).await;
    let nodes = scalar_count(
        &s.db,
        "SELECT count(*) FROM nodes WHERE organization_id=$1",
        ctx.organization_id,
    )
    .await;
    let policies = scalar_count(
        &s.db,
        "SELECT count(*) FROM policies WHERE organization_id=$1",
        ctx.organization_id,
    )
    .await;
    let deployments = scalar_count(&s.db, "SELECT count(*) FROM deployments WHERE organization_id=$1 AND status NOT IN ('healthy','rolled_back')", ctx.organization_id).await;

    Json(json!({
        "organization_id": ctx.organization_id,
        "role": ctx.role,
        "tenants": tenants,
        "nodes": nodes,
        "policies": policies,
        "active_deployments": deployments,
        "control_plane": "healthy",
        "proxima_enforcement": "independent",
        "offline_behavior": "engine_continues_enforcement"
    }))
    .into_response()
}

async fn control_plane_overview(State(s): State<AppState>, headers: HeaderMap) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    let tenant_count = scalar_count(&s.db, "SELECT count(*) FROM tenants t JOIN projects p ON p.id=t.project_id WHERE p.organization_id=$1", ctx.organization_id).await;
    let policy_count = scalar_count(
        &s.db,
        "SELECT count(*) FROM policies WHERE organization_id=$1",
        ctx.organization_id,
    )
    .await;
    let node_count = scalar_count(
        &s.db,
        "SELECT count(*) FROM nodes WHERE organization_id=$1",
        ctx.organization_id,
    )
    .await;
    let active_deployments = scalar_count(&s.db, "SELECT count(*) FROM deployments WHERE organization_id=$1 AND status NOT IN ('healthy','rolled_back')", ctx.organization_id).await;
    let latest_verification = sqlx::query("SELECT status FROM verification_results WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 1").bind(ctx.organization_id).fetch_optional(&s.db).await.ok().flatten();
    let trend_rows = sqlx::query("SELECT date_trunc('day',created_at) AS timestamp,count(*)::bigint AS value FROM verification_results WHERE organization_id=$1 GROUP BY 1 ORDER BY 1 DESC LIMIT 30").bind(ctx.organization_id).fetch_all(&s.db).await.unwrap_or_default();
    let tenant_rows = sqlx::query("SELECT t.id,t.name,t.status FROM tenants t JOIN projects p ON p.id=t.project_id WHERE p.organization_id=$1 ORDER BY t.created_at DESC LIMIT 12").bind(ctx.organization_id).fetch_all(&s.db).await.unwrap_or_default();
    let node_rows = sqlx::query("SELECT id,name,region,environment,status,version FROM nodes WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 12").bind(ctx.organization_id).fetch_all(&s.db).await.unwrap_or_default();
    let audit_rows = sqlx::query("SELECT id,action,resource_type,resource_id,created_at FROM audit_events WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 10").bind(ctx.organization_id).fetch_all(&s.db).await.unwrap_or_default();
    let verification_state = latest_verification
        .as_ref()
        .map(|r| r.get::<String, _>("status").to_uppercase())
        .unwrap_or_else(|| "NO RUNS".into());
    Json(json!({
        "organization_id": ctx.organization_id,
        "role": ctx.role,
        "metrics": {"tenants":tenant_count,"policies":policy_count,"nodes":node_count,"active_deployments":active_deployments},
        "protection": {
            "tenantIsolation": if tenant_count > 0 {"ENFORCED"} else {"READY"},
            "policyEnforcement": if policy_count > 0 {"CONFIGURED"} else {"READY"},
            "verification": verification_state,
            "databaseProtection": "CONNECTED"
        },
        "verificationTrend": trend_rows.iter().rev().map(|r| json!({"timestamp":r.get::<chrono::DateTime<chrono::Utc>,_>("timestamp"),"value":r.get::<i64,_>("value")})).collect::<Vec<_>>(),
        "tenants": tenant_rows.iter().map(|r| json!({"id":r.get::<Uuid,_>("id"),"name":r.get::<String,_>("name"),"status":r.get::<String,_>("status")})).collect::<Vec<_>>(),
        "nodes": node_rows.iter().map(|r| json!({"id":r.get::<Uuid,_>("id"),"name":r.get::<String,_>("name"),"region":r.get::<String,_>("region"),"environment":r.get::<String,_>("environment"),"status":r.get::<String,_>("status"),"version":r.get::<String,_>("version")})).collect::<Vec<_>>(),
        "recentActivity": audit_rows.iter().map(|r| json!({"id":r.get::<Uuid,_>("id"),"type":r.get::<String,_>("action"),"message":format!("{} {}",r.get::<String,_>("resource_type"),r.get::<Option<Uuid>,_>("resource_id").map(|v|v.to_string()).unwrap_or_default()),"timestamp":r.get::<chrono::DateTime<chrono::Utc>,_>("created_at"),"href":"/app/audit"})).collect::<Vec<_>>()
    })).into_response()
}

async fn change_password(
    State(s): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<PasswordChangeInput>,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if let Err(c) = require_csrf(&ctx, &headers) {
        return c.into_response();
    }
    if input.new_password.len() < 12 {
        return bad("New password must be at least 12 characters.");
    }

    let hash: String = match sqlx::query_scalar("SELECT password_hash FROM users WHERE id=$1")
        .bind(ctx.user_id)
        .fetch_one(&s.db)
        .await
    {
        Ok(v) => v,
        Err(e) => return db_error(e),
    };
    if !verify_password(&input.current_password, &hash) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({"ok":false,"message":"Current password is incorrect."})),
        )
            .into_response();
    }

    let new_hash = match hash_password(&input.new_password) {
        Ok(v) => v,
        Err(_) => return internal("Password hashing failed."),
    };
    let token = match cookie(&headers, "proxima_session") {
        Some(v) => v,
        None => return unauthorized(),
    };

    if let Err(e) = sqlx::query("UPDATE users SET password_hash=$1 WHERE id=$2")
        .bind(&new_hash)
        .bind(ctx.user_id)
        .execute(&s.db)
        .await
    {
        return db_error(e);
    }
    if let Err(e) = sqlx::query("DELETE FROM sessions WHERE user_id=$1 AND token_hash<>$2")
        .bind(ctx.user_id)
        .bind(token_hash(&token))
        .execute(&s.db)
        .await
    {
        return db_error(e);
    }

    audit(
        &s.db,
        ctx.organization_id,
        ctx.user_id,
        "auth.password.changed",
        "user",
        Some(ctx.user_id),
        json!({}),
    )
    .await;
    create_notification(
        &s.db,
        ctx.user_id,
        Some(ctx.organization_id),
        "security",
        "Password changed",
        "Your password was changed successfully.",
        Some("/app/settings"),
    )
    .await;
    Json(json!({"ok":true,"message":"Password changed. Other active sessions have been signed out."}))
        .into_response()
}

async fn settings(State(s): State<AppState>, headers: HeaderMap) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    let user = match sqlx::query(
        "SELECT id,email,display_name,preferences,pending_email FROM users WHERE id=$1",
    )
    .bind(ctx.user_id)
    .fetch_optional(&s.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => return unauthorized(),
        Err(e) => return db_error(e),
    };
    let organization = match sqlx::query(
        "SELECT o.id,o.name,o.slug,m.role FROM organizations o JOIN memberships m
         ON m.organization_id=o.id WHERE o.id=$1 AND m.user_id=$2",
    )
    .bind(ctx.organization_id)
    .bind(ctx.user_id)
    .fetch_optional(&s.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => return unauthorized(),
        Err(e) => return db_error(e),
    };
    let organizations = match sqlx::query(
        "SELECT o.id,o.name,o.slug,m.role FROM organizations o JOIN memberships m
         ON m.organization_id=o.id WHERE m.user_id=$1 ORDER BY o.created_at",
    )
    .bind(ctx.user_id)
    .fetch_all(&s.db)
    .await
    {
        Ok(r) => r,
        Err(e) => return db_error(e),
    };

    Json(json!({
        "user": {
            "id": user.get::<Uuid,_>("id"),
            "email": user.get::<String,_>("email"),
            "display_name": user.get::<String,_>("display_name"),
            "pending_email": user.get::<Option<String>,_>("pending_email")
        },
        "organization": {
            "id": organization.get::<Uuid,_>("id"),
            "name": organization.get::<String,_>("name"),
            "slug": organization.get::<String,_>("slug"),
            "role": organization.get::<String,_>("role")
        },
        "organizations": organizations.iter().map(|r| json!({
            "id": r.get::<Uuid,_>("id"),
            "name": r.get::<String,_>("name"),
            "slug": r.get::<String,_>("slug"),
            "role": r.get::<String,_>("role")
        })).collect::<Vec<_>>(),
        "preferences": user.get::<Value,_>("preferences")
    }))
    .into_response()
}

async fn update_settings(
    State(s): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<SettingsPatchInput>,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if let Err(c) = require_csrf(&ctx, &headers) {
        return c.into_response();
    }

    if let Some(display_name) = input.display_name.as_deref() {
        let display_name = display_name.trim();
        if display_name.is_empty() || display_name.len() > 120 {
            return bad("Display name must be between 1 and 120 characters.");
        }
        if let Err(e) = sqlx::query("UPDATE users SET display_name=$1 WHERE id=$2")
            .bind(display_name)
            .bind(ctx.user_id)
            .execute(&s.db)
            .await
        {
            return db_error(e);
        }
    }

    if let Some(org_name) = input.organization_name.as_deref() {
        let org_name = org_name.trim();
        if org_name.is_empty() || org_name.len() > 120 {
            return bad("Organization name must be between 1 and 120 characters.");
        }
        let current: String = match sqlx::query_scalar("SELECT name FROM organizations WHERE id=$1")
            .bind(ctx.organization_id)
            .fetch_one(&s.db)
            .await
        {
            Ok(v) => v,
            Err(e) => return db_error(e),
        };
        if org_name != current {
            if !matches!(ctx.role.as_str(), "owner" | "admin") {
                return (
                    StatusCode::FORBIDDEN,
                    Json(json!({"ok":false,"message":"Only organization owners and admins can change the organization name."})),
                )
                    .into_response();
            }
            let slug = slugify(org_name);
            if let Err(e) = sqlx::query("UPDATE organizations SET name=$1,slug=$2 WHERE id=$3")
                .bind(org_name)
                .bind(&slug)
                .bind(ctx.organization_id)
                .execute(&s.db)
                .await
            {
                return unique_error(e);
            }
            audit(
                &s.db,
                ctx.organization_id,
                ctx.user_id,
                "organization.updated",
                "organization",
                Some(ctx.organization_id),
                json!({"field":"name"}),
            )
            .await;
        }
    }

    if let Some(preferences) = input.preferences {
        let theme = preferences
            .get("theme")
            .and_then(Value::as_str)
            .unwrap_or("light");
        if !matches!(theme, "light" | "dark") {
            return bad("Theme must be light or dark.");
        }
        let notifications = preferences
            .get("notifications")
            .cloned()
            .unwrap_or_else(|| json!({}));
        for key in ["security", "product", "billing"] {
            if let Some(value) = notifications.get(key) {
                if !value.is_boolean() {
                    return bad("Notification preferences must be boolean values.");
                }
            }
        }
        let normalized = json!({
            "theme": theme,
            "notifications": {
                "security": notifications.get("security").and_then(Value::as_bool).unwrap_or(true),
                "product": notifications.get("product").and_then(Value::as_bool).unwrap_or(true),
                "billing": notifications.get("billing").and_then(Value::as_bool).unwrap_or(true)
            }
        });
        if let Err(e) = sqlx::query("UPDATE users SET preferences=$1 WHERE id=$2")
            .bind(normalized)
            .bind(ctx.user_id)
            .execute(&s.db)
            .await
        {
            return db_error(e);
        }
    }

    audit(
        &s.db,
        ctx.organization_id,
        ctx.user_id,
        "settings.updated",
        "settings",
        None,
        json!({}),
    )
    .await;
    settings(State(s), headers).await
}

async fn switch_organization(
    State(s): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<SwitchOrganizationInput>,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if let Err(c) = require_csrf(&ctx, &headers) {
        return c.into_response();
    }
    let membership =
        match sqlx::query("SELECT role FROM memberships WHERE user_id=$1 AND organization_id=$2")
            .bind(ctx.user_id)
            .bind(input.organization_id)
            .fetch_optional(&s.db)
            .await
        {
            Ok(Some(r)) => r,
            Ok(None) => {
                return (
                    StatusCode::FORBIDDEN,
                    Json(json!({"ok":false,"message":"You do not belong to that organization."})),
                )
                    .into_response()
            }
            Err(e) => return db_error(e),
        };
    let token = match cookie(&headers, "proxima_session") {
        Some(v) => v,
        None => return unauthorized(),
    };
    if let Err(e) =
        sqlx::query("UPDATE sessions SET organization_id=$1 WHERE token_hash=$2 AND user_id=$3")
            .bind(input.organization_id)
            .bind(token_hash(&token))
            .bind(ctx.user_id)
            .execute(&s.db)
            .await
    {
        return db_error(e);
    }
    audit(
        &s.db,
        input.organization_id,
        ctx.user_id,
        "organization.switched",
        "organization",
        Some(input.organization_id),
        json!({"role":membership.get::<String,_>("role")}),
    )
    .await;
    create_notification(
        &s.db,
        ctx.user_id,
        Some(input.organization_id),
        "workspace",
        "Organization switched",
        "You are now working in a different organization.",
        Some("/app"),
    )
    .await;
    Json(json!({"ok":true,"organization_id":input.organization_id})).into_response()
}

async fn change_email(
    State(s): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<ChangeEmailInput>,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if let Err(c) = require_csrf(&ctx, &headers) {
        return c.into_response();
    }
    if input.new_email.trim().is_empty() || !input.new_email.contains('@') {
        return bad("Enter a valid email address.");
    }

    let password_hash =
        match sqlx::query_scalar::<_, String>("SELECT password_hash FROM users WHERE id=$1")
            .bind(ctx.user_id)
            .fetch_one(&s.db)
            .await
        {
            Ok(v) => v,
            Err(e) => return db_error(e),
        };
    if !verify_password(&input.current_password, &password_hash) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({"ok":false,"message":"Current password is incorrect."})),
        )
            .into_response();
    }

    let email = input.new_email.trim().to_lowercase();
    if let Ok(Some(_)) = sqlx::query("SELECT id FROM users WHERE lower(email)=lower($1) AND id<>$2")
        .bind(&email)
        .bind(ctx.user_id)
        .fetch_optional(&s.db)
        .await
    {
        return (
            StatusCode::CONFLICT,
            Json(json!({"ok":false,"message":"That email address is already in use."})),
        )
            .into_response();
    }

    let code = format!("{:06}", Uuid::new_v4().as_u128() % 1_000_000);
    let display_name =
        match sqlx::query_scalar::<_, String>("SELECT display_name FROM users WHERE id=$1")
            .bind(ctx.user_id)
            .fetch_one(&s.db)
            .await
        {
            Ok(v) => v,
            Err(e) => return db_error(e),
        };

    if let Err(e) = sqlx::query(
        "UPDATE users SET pending_email=$1,pending_email_token_hash=$2,
         pending_email_expires_at=now()+interval '15 minutes' WHERE id=$3",
    )
    .bind(&email)
    .bind(token_hash(&code))
    .bind(ctx.user_id)
    .execute(&s.db)
    .await
    {
        return db_error(e);
    }

    if let Err(e) = production::send_template_email(
        &email,
        "091dbdb2-21ed-444f-a209-6f44e55d192d",
        json!({"DISPLAY_NAME":display_name,"CODE":code}),
    )
    .await
    {
        tracing::error!(%e, "email change verification delivery failed");
        return service_unavailable(
            "The verification email could not be sent. Check the Resend configuration.",
        );
    }

    audit(
        &s.db,
        ctx.organization_id,
        ctx.user_id,
        "auth.email_change.requested",
        "user",
        Some(ctx.user_id),
        json!({"email_changed":true}),
    )
    .await;

    Json(json!({
        "ok":true,
        "message":format!("A verification code was sent to {}.", email)
    }))
    .into_response()
}

async fn confirm_email_change(
    State(s): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<ConfirmEmailInput>,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if let Err(c) = require_csrf(&ctx, &headers) {
        return c.into_response();
    }

    let code = input.code.trim();
    if code.len() != 6 || !code.chars().all(|c| c.is_ascii_digit()) {
        return bad("Enter the 6-digit verification code.");
    }

    let row = match sqlx::query(
        "SELECT pending_email,pending_email_token_hash,pending_email_expires_at
         FROM users WHERE id=$1",
    )
    .bind(ctx.user_id)
    .fetch_optional(&s.db)
    .await
    {
        Ok(Some(v)) => v,
        Ok(None) => return unauthorized(),
        Err(e) => return db_error(e),
    };

    let email: Option<String> = row.get("pending_email");
    let expected: Option<Vec<u8>> = row.get("pending_email_token_hash");
    let expires: Option<chrono::DateTime<chrono::Utc>> = row.get("pending_email_expires_at");
    let (Some(email), Some(expected), Some(expires)) = (email, expected, expires) else {
        return bad("There is no pending email change.");
    };

    if expires <= chrono::Utc::now() || token_hash(code) != expected {
        return bad("The verification code is invalid or expired.");
    }

    if let Ok(Some(_)) = sqlx::query("SELECT id FROM users WHERE lower(email)=lower($1) AND id<>$2")
        .bind(&email)
        .bind(ctx.user_id)
        .fetch_optional(&s.db)
        .await
    {
        return (
            StatusCode::CONFLICT,
            Json(json!({"ok":false,"message":"That email address is already in use."})),
        )
            .into_response();
    }

    if let Err(e) = sqlx::query(
        "UPDATE users SET email=$1,email_verified_at=now(),
         pending_email=NULL,pending_email_token_hash=NULL,pending_email_expires_at=NULL
         WHERE id=$2",
    )
    .bind(&email)
    .bind(ctx.user_id)
    .execute(&s.db)
    .await
    {
        return db_error(e);
    }

    audit(
        &s.db,
        ctx.organization_id,
        ctx.user_id,
        "auth.email_changed",
        "user",
        Some(ctx.user_id),
        json!({}),
    )
    .await;

    Json(json!({
        "ok":true,
        "email":email,
        "message":"Email address updated and verified."
    }))
    .into_response()
}

async fn notifications(State(s): State<AppState>, headers: HeaderMap) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };

    match sqlx::query(
        "SELECT id,type,title,message,href,read_at,created_at FROM notifications
         WHERE user_id=$1 AND (organization_id IS NULL OR organization_id=$2)
         ORDER BY created_at DESC LIMIT 100",
    )
    .bind(ctx.user_id)
    .bind(ctx.organization_id)
    .fetch_all(&s.db)
    .await
    {
        Ok(rows) => Json(json!({
            "notifications": rows.iter().map(|r| json!({
                "id":r.get::<Uuid,_>("id"),
                "type":r.get::<String,_>("type"),
                "title":r.get::<String,_>("title"),
                "message":r.get::<String,_>("message"),
                "href":r.get::<Option<String>,_>("href"),
                "read":r.get::<Option<chrono::DateTime<chrono::Utc>>, _>("read_at").is_some(),
                "created_at":r.get::<chrono::DateTime<chrono::Utc>,_>("created_at")
            })).collect::<Vec<_>>()
        }))
        .into_response(),
        Err(e) => db_error(e),
    }
}

async fn mark_notification_read(
    State(s): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if let Err(c) = require_csrf(&ctx, &headers) {
        return c.into_response();
    }

    match sqlx::query(
        "UPDATE notifications SET read_at=COALESCE(read_at,now())
         WHERE id=$1 AND user_id=$2",
    )
    .bind(id)
    .bind(ctx.user_id)
    .execute(&s.db)
    .await
    {
        Ok(_) => Json(json!({"ok":true})).into_response(),
        Err(e) => db_error(e),
    }
}

async fn mark_all_notifications_read(State(s): State<AppState>, headers: HeaderMap) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if let Err(c) = require_csrf(&ctx, &headers) {
        return c.into_response();
    }

    match sqlx::query("UPDATE notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL")
        .bind(ctx.user_id)
        .execute(&s.db)
        .await
    {
        Ok(_) => Json(json!({"ok":true})).into_response(),
        Err(e) => db_error(e),
    }
}

async fn delete_account(State(s): State<AppState>, headers: HeaderMap) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if let Err(c) = require_write(&ctx, &headers) {
        return c.into_response();
    }
    if ctx.role != "owner" {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"ok":false,"message":"Only the organization owner can delete this account."})),
        )
            .into_response();
    }

    let shared_orgs: i64 = match sqlx::query_scalar(
        "SELECT count(*) FROM memberships m
         WHERE m.organization_id IN (SELECT organization_id FROM memberships WHERE user_id=$1)
           AND m.user_id<>$1",
    )
    .bind(ctx.user_id)
    .fetch_one(&s.db)
    .await
    {
        Ok(v) => v,
        Err(e) => return db_error(e),
    };
    if shared_orgs > 0 {
        return (
            StatusCode::CONFLICT,
            Json(json!({"ok":false,"message":"Account deletion is blocked while another member still depends on one of your organizations. Transfer ownership or remove other members first."})),
        )
            .into_response();
    }

    let non_owner_memberships: i64 = match sqlx::query_scalar(
        "SELECT count(*) FROM memberships WHERE user_id=$1 AND role<>'owner'",
    )
    .bind(ctx.user_id)
    .fetch_one(&s.db)
    .await
    {
        Ok(v) => v,
        Err(e) => return db_error(e),
    };
    if non_owner_memberships > 0 {
        return (
            StatusCode::CONFLICT,
            Json(json!({"ok":false,"message":"Account deletion requires ownership of every organization on this account. Leave or transfer any organization where you are not the owner first."})),
        )
            .into_response();
    }

    let active_billing: i64 = match sqlx::query_scalar(
        "SELECT count(*) FROM billing_accounts b
         WHERE b.organization_id IN (SELECT organization_id FROM memberships WHERE user_id=$1)
           AND b.status NOT IN ('inactive','canceled')",
    )
    .bind(ctx.user_id)
    .fetch_one(&s.db)
    .await
    {
        Ok(v) => v,
        Err(e) => return db_error(e),
    };
    if active_billing > 0 {
        return (
            StatusCode::CONFLICT,
            Json(json!({"ok":false,"message":"Cancel active organization billing before deleting the account."})),
        )
            .into_response();
    }

    if let Err(e) = sqlx::query(
        "DELETE FROM organizations
         WHERE id IN (SELECT organization_id FROM memberships WHERE user_id=$1)",
    )
    .bind(ctx.user_id)
    .execute(&s.db)
    .await
    {
        return db_error(e);
    }
    if let Err(e) = sqlx::query("DELETE FROM users WHERE id=$1")
        .bind(ctx.user_id)
        .execute(&s.db)
        .await
    {
        return db_error(e);
    }
    let mut response_headers = HeaderMap::new();
    response_headers.insert(
        header::SET_COOKIE,
        HeaderValue::from_static("proxima_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict"),
    );
    (
        response_headers,
        Json(json!({"ok":true,"message":"Account deleted."})),
    )
        .into_response()
}

async fn organizations(State(s): State<AppState>, headers: HeaderMap) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    match sqlx::query(
        "SELECT o.id,o.name,o.slug,m.role FROM organizations o
         JOIN memberships m ON m.organization_id=o.id WHERE m.user_id=$1 ORDER BY o.created_at",
    )
    .bind(ctx.user_id)
    .fetch_all(&s.db)
    .await
    {
        Ok(rows) => Json(
            rows.iter()
                .map(|r| {
                    json!({
                        "id": r.get::<Uuid,_>("id"), "name": r.get::<String,_>("name"),
                        "slug": r.get::<String,_>("slug"), "role": r.get::<String,_>("role")
                    })
                })
                .collect::<Vec<_>>(),
        )
        .into_response(),
        Err(e) => db_error(e),
    }
}

async fn create_organization(
    State(s): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<NameInput>,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if let Err(c) = require_write(&ctx, &headers) {
        return c.into_response();
    }

    let name = input.name.trim();
    if name.is_empty() || name.len() > 120 {
        return bad("Organization name must be between 1 and 120 characters.");
    }
    let id = Uuid::new_v4();
    let slug = slugify(name);
    if slug.is_empty() {
        return bad("Organization name must contain at least one letter or number.");
    }
    if let Err(e) = sqlx::query("INSERT INTO organizations(id,name,slug) VALUES($1,$2,$3)")
        .bind(id)
        .bind(name)
        .bind(&slug)
        .execute(&s.db)
        .await
    {
        return unique_error(e);
    }
    if let Err(e) =
        sqlx::query("INSERT INTO memberships(user_id,organization_id,role) VALUES($1,$2,'owner')")
            .bind(ctx.user_id)
            .bind(id)
            .execute(&s.db)
            .await
    {
        return db_error(e);
    }

    if let Err(e) = sqlx::query(
        "INSERT INTO projects(organization_id,name,slug) VALUES($1,'Production','production')",
    )
    .bind(id)
    .execute(&s.db)
    .await
    {
        return db_error(e);
    }

    if let Err(e) = sqlx::query(
        "INSERT INTO organization_entitlements(organization_id) VALUES($1) ON CONFLICT DO NOTHING",
    )
    .bind(id)
    .execute(&s.db)
    .await
    {
        return db_error(e);
    }

    audit(
        &s.db,
        id,
        ctx.user_id,
        "organization.created",
        "organization",
        Some(id),
        json!({}),
    )
    .await;
    create_notification(
        &s.db,
        ctx.user_id,
        Some(id),
        "workspace",
        "Organization created",
        &format!("“{}” is ready with its own Production project.", name),
        Some("/app"),
    )
    .await;
    Json(json!({"id":id,"name":name,"slug":slug})).into_response()
}

async fn tenants(State(s): State<AppState>, headers: HeaderMap) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    match sqlx::query(
        "SELECT t.id,t.name,t.slug,t.status,t.isolation_mode,p.name AS project
         FROM tenants t JOIN projects p ON p.id=t.project_id
         WHERE p.organization_id=$1 ORDER BY t.created_at DESC"
    ).bind(ctx.organization_id).fetch_all(&s.db).await {
        Ok(rows) => Json(rows.iter().map(|r| json!({
            "id":r.get::<Uuid,_>("id"), "name":r.get::<String,_>("name"),
            "slug":r.get::<String,_>("slug"), "status":r.get::<String,_>("status"),
            "isolation_mode":r.get::<String,_>("isolation_mode"), "project":r.get::<String,_>("project")
        })).collect::<Vec<_>>()).into_response(),
        Err(e) => db_error(e),
    }
}

async fn create_tenant(
    State(s): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<TenantInput>,
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

    let project = match sqlx::query(
        "SELECT id FROM projects WHERE organization_id=$1 ORDER BY created_at LIMIT 1",
    )
    .bind(ctx.organization_id)
    .fetch_optional(&s.db)
    .await
    {
        Ok(Some(row)) => row.get::<Uuid, _>("id"),
        Ok(None) => {
            return (
                StatusCode::CONFLICT,
                Json(Message {
                    ok: false,
                    message: "Create a project before creating tenants.".into(),
                }),
            )
                .into_response()
        }
        Err(e) => return db_error(e),
    };

    if let Err(response) = production::enforce_capacity(&s.db, ctx.organization_id, "tenants").await
    {
        return response;
    }

    let id = Uuid::new_v4();
    let mode = input
        .isolation_mode
        .unwrap_or_else(|| "enforced-proxy".into());
    match sqlx::query(
        "INSERT INTO tenants(id,project_id,name,slug,isolation_mode) VALUES($1,$2,$3,$4,$5)",
    )
    .bind(id)
    .bind(project)
    .bind(&input.name)
    .bind(&input.slug)
    .bind(&mode)
    .execute(&s.db)
    .await
    {
        Ok(_) => {
            audit(
                &s.db,
                ctx.organization_id,
                ctx.user_id,
                "tenant.created",
                "tenant",
                Some(id),
                json!({"isolation_mode":mode}),
            )
            .await;
            Json(json!({"id":id,"name":input.name,"slug":input.slug,"isolation_mode":mode,"status":"active"})).into_response()
        }
        Err(e) => unique_error(e),
    }
}

async fn policies(State(s): State<AppState>, headers: HeaderMap) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    match sqlx::query(
        "SELECT id,name,version,status,document,to_char(updated_at,'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS updated_at
         FROM policies WHERE organization_id=$1 ORDER BY updated_at DESC"
    ).bind(ctx.organization_id).fetch_all(&s.db).await {
        Ok(rows) => Json(rows.iter().map(|r| json!({
            "id":r.get::<Uuid,_>("id"), "name":r.get::<String,_>("name"),
            "version":r.get::<i32,_>("version"), "status":r.get::<String,_>("status"),
            "document":r.get::<Value,_>("document"), "updated_at":r.get::<String,_>("updated_at")
        })).collect::<Vec<_>>()).into_response(),
        Err(e) => db_error(e),
    }
}

async fn create_policy(
    State(s): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<PolicyInput>,
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
    if let Err(response) =
        production::require_feature(&s.db, ctx.organization_id, "policy_management").await
    {
        return response;
    }

    let id = Uuid::new_v4();
    match sqlx::query(
        "INSERT INTO policies(id,organization_id,name,version,status,document,created_by)
         VALUES($1,$2,$3,$4,'draft',$5,$6)",
    )
    .bind(id)
    .bind(ctx.organization_id)
    .bind(&input.name)
    .bind(input.version)
    .bind(&input.document)
    .bind(ctx.user_id)
    .execute(&s.db)
    .await
    {
        Ok(_) => {
            audit(
                &s.db,
                ctx.organization_id,
                ctx.user_id,
                "policy.created",
                "policy",
                Some(id),
                json!({"version":input.version}),
            )
            .await;
            Json(json!({"id":id,"status":"draft"})).into_response()
        }
        Err(e) => unique_error(e),
    }
}

async fn nodes(State(s): State<AppState>, headers: HeaderMap) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    match sqlx::query(
        "SELECT id,name,environment,region,status,version,
         to_char(last_seen_at,'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS last_seen_at
         FROM nodes WHERE organization_id=$1 ORDER BY created_at DESC"
    ).bind(ctx.organization_id).fetch_all(&s.db).await {
        Ok(rows) => Json(rows.iter().map(|r| json!({
            "id":r.get::<Uuid,_>("id"), "name":r.get::<String,_>("name"),
            "environment":r.get::<String,_>("environment"), "region":r.get::<String,_>("region"),
            "status":r.get::<String,_>("status"), "version":r.get::<String,_>("version"),
            "last_seen_at":r.get::<Option<String>,_>("last_seen_at")
        })).collect::<Vec<_>>()).into_response(),
        Err(e) => db_error(e),
    }
}

async fn create_node(
    State(s): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<NodeInput>,
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

    if let Err(response) = production::enforce_capacity(&s.db, ctx.organization_id, "nodes").await {
        return response;
    }

    let environment = input
        .environment
        .clone()
        .unwrap_or_else(|| "production".into());
    if environment.eq_ignore_ascii_case("private") {
        if let Err(response) =
            production::require_feature(&s.db, ctx.organization_id, "private_deployment").await
        {
            return response;
        }
    }
    if let Err(response) =
        production::enforce_environment_capacity(&s.db, ctx.organization_id, &environment).await
    {
        return response;
    }

    let id = Uuid::new_v4();
    let token = format!("{}-{}", Uuid::new_v4(), Uuid::new_v4());
    let token_hash_value = token_hash(&token);
    match sqlx::query(
        "INSERT INTO nodes(id,organization_id,name,environment,region,status,enrollment_token_hash)
         VALUES($1,$2,$3,$4,$5,'pending',$6)",
    )
    .bind(id)
    .bind(ctx.organization_id)
    .bind(&input.name)
    .bind(&environment)
    .bind(input.region.unwrap_or_else(|| "auto".into()))
    .bind(token_hash_value)
    .execute(&s.db)
    .await
    {
        Ok(_) => {
            audit(
                &s.db,
                ctx.organization_id,
                ctx.user_id,
                "node.created",
                "node",
                Some(id),
                json!({}),
            )
            .await;
            Json(json!({
                "id":id, "name":input.name, "status":"pending",
                "enrollment_token":token,
                "warning":"Store this token once. It is not returned again."
            }))
            .into_response()
        }
        Err(e) => unique_error(e),
    }
}

async fn start_enrollment(
    State(s): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if let Err(c) = require_write(&ctx, &headers) {
        return c.into_response();
    }

    match sqlx::query(
        "UPDATE nodes SET status='enrolling',updated_at=now()
         WHERE id=$1 AND organization_id=$2 RETURNING id,name,status",
    )
    .bind(id)
    .bind(ctx.organization_id)
    .fetch_optional(&s.db)
    .await
    {
        Ok(Some(row)) => {
            audit(
                &s.db,
                ctx.organization_id,
                ctx.user_id,
                "node.enrollment.started",
                "node",
                Some(id),
                json!({}),
            )
            .await;
            Json(json!({"id":row.get::<Uuid,_>("id"),"name":row.get::<String,_>("name"),"status":row.get::<String,_>("status")})).into_response()
        }
        Ok(None) => StatusCode::NOT_FOUND.into_response(),
        Err(e) => db_error(e),
    }
}

async fn deployments(State(s): State<AppState>, headers: HeaderMap) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    match sqlx::query(
        "SELECT id,node_id,version,desired_state,observed_state,status FROM deployments
         WHERE organization_id=$1 ORDER BY created_at DESC"
    ).bind(ctx.organization_id).fetch_all(&s.db).await {
        Ok(rows) => Json(rows.iter().map(|r| json!({
            "id":r.get::<Uuid,_>("id"), "node_id":r.get::<Uuid,_>("node_id"),
            "version":r.get::<String,_>("version"), "desired_state":r.get::<String,_>("desired_state"),
            "observed_state":r.get::<String,_>("observed_state"), "status":r.get::<String,_>("status")
        })).collect::<Vec<_>>()).into_response(),
        Err(e) => db_error(e),
    }
}

async fn create_deployment(
    State(s): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<DeploymentInput>,
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

    if let Err(response) =
        production::require_feature(&s.db, ctx.organization_id, "fleet_controls").await
    {
        return response;
    }

    let id = Uuid::new_v4();
    match sqlx::query(
        "INSERT INTO deployments(id,organization_id,node_id,version,desired_state,observed_state,status,created_by)
         SELECT $1,$2,id,$3,$4,'unknown','queued',$5 FROM nodes WHERE id=$6 AND organization_id=$2"
    ).bind(id).bind(ctx.organization_id).bind(&input.version).bind(&input.desired_state)
    .bind(ctx.user_id).bind(input.node_id).execute(&s.db).await {
        Ok(result) if result.rows_affected() == 1 => {
            audit(&s.db, ctx.organization_id, ctx.user_id, "deployment.created", "deployment", Some(id), json!({"version":input.version})).await;
            Json(json!({"id":id,"status":"queued"})).into_response()
        }
        Ok(_) => StatusCode::NOT_FOUND.into_response(),
        Err(e) => db_error(e),
    }
}

async fn verifications(State(s): State<AppState>, headers: HeaderMap) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    match sqlx::query(
        "SELECT id,tenant_id,kind,status,evidence FROM verification_results
         WHERE organization_id=$1 ORDER BY created_at DESC"
    ).bind(ctx.organization_id).fetch_all(&s.db).await {
        Ok(rows) => Json(rows.iter().map(|r| json!({
            "id":r.get::<Uuid,_>("id"), "tenant_id":r.get::<Option<Uuid>,_>("tenant_id"),
            "kind":r.get::<String,_>("kind"), "status":r.get::<String,_>("status"),
            "evidence":r.get::<Value,_>("evidence")
        })).collect::<Vec<_>>()).into_response(),
        Err(e) => db_error(e),
    }
}

async fn create_verification(
    State(s): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<VerificationInput>,
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

    if input.kind.starts_with("advanced") {
        if let Err(response) =
            production::require_feature(&s.db, ctx.organization_id, "advanced_verification").await
        {
            return response;
        }
    }

    let id = Uuid::new_v4();
    match sqlx::query(
        "INSERT INTO verification_results(id,organization_id,tenant_id,kind,status,evidence,created_by)
         VALUES($1,$2,$3,$4,$5,$6,$7)"
    ).bind(id).bind(ctx.organization_id).bind(input.tenant_id).bind(&input.kind)
    .bind(&input.status).bind(&input.evidence).bind(ctx.user_id).execute(&s.db).await {
        Ok(_) => {
            audit(&s.db, ctx.organization_id, ctx.user_id, "verification.recorded", "verification", Some(id), json!({"kind":input.kind,"status":input.status})).await;
            Json(json!({"id":id,"status":input.status})).into_response()
        }
        Err(e) => db_error(e),
    }
}

async fn audit_events(State(s): State<AppState>, headers: HeaderMap) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    match sqlx::query(
        "SELECT id,action,resource_type,resource_id,metadata,
         to_char(created_at,'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS created_at
         FROM audit_events WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 250"
    ).bind(ctx.organization_id).fetch_all(&s.db).await {
        Ok(rows) => Json(rows.iter().map(|r| json!({
            "id":r.get::<Uuid,_>("id"), "action":r.get::<String,_>("action"),
            "resource_type":r.get::<String,_>("resource_type"),
            "resource_id":r.get::<Option<Uuid>,_>("resource_id"),
            "metadata":r.get::<Value,_>("metadata"), "created_at":r.get::<String,_>("created_at")
        })).collect::<Vec<_>>()).into_response(),
        Err(e) => db_error(e),
    }
}

async fn support(State(s): State<AppState>, headers: HeaderMap) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    match sqlx::query(
        "SELECT id,subject,message,priority,status,
         to_char(created_at,'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS created_at
         FROM support_requests WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100"
    ).bind(ctx.organization_id).fetch_all(&s.db).await {
        Ok(rows) => Json(rows.iter().map(|r| json!({
            "id":r.get::<Uuid,_>("id"), "subject":r.get::<String,_>("subject"),
            "message":r.get::<String,_>("message"), "priority":r.get::<String,_>("priority"),
            "status":r.get::<String,_>("status"), "created_at":r.get::<String,_>("created_at")
        })).collect::<Vec<_>>()).into_response(),
        Err(e) => db_error(e),
    }
}

async fn create_support(
    State(s): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<SupportInput>,
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

    let priority = input.priority.unwrap_or_else(|| "normal".into());
    if matches!(priority.as_str(), "high" | "urgent") {
        if let Err(response) =
            production::require_feature(&s.db, ctx.organization_id, "priority_support").await
        {
            return response;
        }
    }

    let id = Uuid::new_v4();
    match sqlx::query(
        "INSERT INTO support_requests(id,organization_id,user_id,subject,message,priority,status)
         VALUES($1,$2,$3,$4,$5,$6,'open')",
    )
    .bind(id)
    .bind(ctx.organization_id)
    .bind(ctx.user_id)
    .bind(&input.subject)
    .bind(&input.message)
    .bind(&priority)
    .execute(&s.db)
    .await
    {
        Ok(_) => {
            audit(
                &s.db,
                ctx.organization_id,
                ctx.user_id,
                "support.requested",
                "support_request",
                Some(id),
                json!({}),
            )
            .await;
            Json(json!({"id":id,"status":"open"})).into_response()
        }
        Err(e) => db_error(e),
    }
}

async fn create_session(
    db: &PgPool,
    user_id: Uuid,
    organization_id: Uuid,
) -> Result<(String, String), sqlx::Error> {
    let token = format!("{}.{}", Uuid::new_v4(), Uuid::new_v4());
    let csrf = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO sessions(id,user_id,organization_id,token_hash,csrf_token,expires_at)
         VALUES($1,$2,$3,$4,$5,now()+interval '12 hours')",
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(organization_id)
    .bind(token_hash(&token))
    .bind(&csrf)
    .execute(db)
    .await?;
    Ok((token, csrf))
}

async fn authenticate(s: &AppState, headers: &HeaderMap) -> Result<AuthContext, StatusCode> {
    let token = cookie(headers, "proxima_session").ok_or(StatusCode::UNAUTHORIZED)?;
    let row = sqlx::query(
        "SELECT s.user_id,s.organization_id,s.csrf_token,m.role
         FROM sessions s JOIN memberships m
         ON m.user_id=s.user_id AND m.organization_id=s.organization_id
         WHERE s.token_hash=$1 AND s.expires_at>now()",
    )
    .bind(token_hash(&token))
    .fetch_optional(&s.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::UNAUTHORIZED)?;

    Ok(AuthContext {
        user_id: row.get("user_id"),
        organization_id: row.get("organization_id"),
        csrf: row.get("csrf_token"),
        role: row.get("role"),
    })
}

fn require_csrf(ctx: &AuthContext, headers: &HeaderMap) -> Result<(), StatusCode> {
    let supplied = headers
        .get("x-csrf-token")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if supplied == ctx.csrf {
        Ok(())
    } else {
        Err(StatusCode::FORBIDDEN)
    }
}

fn require_write(ctx: &AuthContext, headers: &HeaderMap) -> Result<(), StatusCode> {
    let supplied = headers
        .get("x-csrf-token")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if supplied != ctx.csrf {
        return Err(StatusCode::FORBIDDEN);
    }
    if matches!(ctx.role.as_str(), "owner" | "admin" | "operator") {
        Ok(())
    } else {
        Err(StatusCode::FORBIDDEN)
    }
}

fn auth_response(
    s: &AppState,
    user: Uuid,
    organization: Uuid,
    csrf: String,
    token: String,
) -> Response {
    let secure = if s.secure_cookie { "; Secure" } else { "" };
    let cookie = format!(
        "proxima_session={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200{secure}"
    );
    let mut headers = HeaderMap::new();
    headers.insert(
        header::SET_COOKIE,
        HeaderValue::from_str(&cookie).expect("valid session cookie"),
    );
    (
        headers,
        Json(AuthOutput {
            user_id: user,
            organization_id: organization,
            csrf_token: csrf,
        }),
    )
        .into_response()
}

fn hash_password(password: &str) -> Result<String, argon2::password_hash::Error> {
    Ok(Argon2::default()
        .hash_password(password.as_bytes())?
        .to_string())
}

fn verify_password(password: &str, hash: &str) -> bool {
    PasswordHash::new(hash)
        .ok()
        .map(|parsed| {
            Argon2::default()
                .verify_password(password.as_bytes(), &parsed)
                .is_ok()
        })
        .unwrap_or(false)
}

fn token_hash(token: &str) -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    hasher.finalize().to_vec()
}

fn cookie(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(header::COOKIE)?
        .to_str()
        .ok()?
        .split(';')
        .find_map(|part| {
            let mut pair = part.trim().splitn(2, '=');
            if pair.next()? == name {
                Some(pair.next()?.to_string())
            } else {
                None
            }
        })
}

fn slugify(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

pub(crate) async fn create_notification(
    db: &PgPool,
    user_id: Uuid,
    organization_id: Option<Uuid>,
    notification_type: &str,
    title: &str,
    message: &str,
    href: Option<&str>,
) {
    let _ = sqlx::query(
        "INSERT INTO notifications(id,user_id,organization_id,type,title,message,href)
         VALUES($1,$2,$3,$4,$5,$6,$7)",
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(organization_id)
    .bind(notification_type)
    .bind(title)
    .bind(message)
    .bind(href)
    .execute(db)
    .await;
}

async fn scalar_count(db: &PgPool, sql: &str, organization_id: Uuid) -> i64 {
    sqlx::query_scalar::<_, i64>(sql)
        .bind(organization_id)
        .fetch_one(db)
        .await
        .unwrap_or(0)
}

async fn audit(
    db: &PgPool,
    org: Uuid,
    user: Uuid,
    action: &str,
    resource_type: &str,
    resource_id: Option<Uuid>,
    metadata: Value,
) {
    let _ = sqlx::query(
        "INSERT INTO audit_events(organization_id,user_id,action,resource_type,resource_id,metadata)
         VALUES($1,$2,$3,$4,$5,$6)"
    ).bind(org).bind(user).bind(action).bind(resource_type).bind(resource_id).bind(metadata).execute(db).await;
}

fn bad(message: &str) -> Response {
    (
        StatusCode::BAD_REQUEST,
        Json(Message {
            ok: false,
            message: message.into(),
        }),
    )
        .into_response()
}

fn unauthorized() -> Response {
    (
        StatusCode::UNAUTHORIZED,
        Json(Message {
            ok: false,
            message: "Invalid credentials.".into(),
        }),
    )
        .into_response()
}

fn internal(message: &str) -> Response {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(Message {
            ok: false,
            message: message.into(),
        }),
    )
        .into_response()
}

fn db_error(e: sqlx::Error) -> Response {
    error!(%e, "control-plane database error");
    internal("Control-plane database error.")
}

fn unique_error(e: sqlx::Error) -> Response {
    if let sqlx::Error::Database(db) = &e {
        if db.constraint().is_some() {
            return (
                StatusCode::CONFLICT,
                Json(Message {
                    ok: false,
                    message: "A resource with that identity already exists.".into(),
                }),
            )
                .into_response();
        }
    }
    db_error(e)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slugify_is_stable() {
        assert_eq!(slugify("Acme Production!"), "acme-production");
        assert_eq!(slugify("  Tenant_A  "), "tenant-a");
    }

    #[test]
    fn token_hash_is_deterministic() {
        assert_eq!(token_hash("abc"), token_hash("abc"));
        assert_ne!(token_hash("abc"), token_hash("abd"));
    }

    #[test]
    fn password_hash_round_trip() {
        let hash = hash_password("correct horse battery staple").unwrap();
        assert!(verify_password("correct horse battery staple", &hash));
        assert!(!verify_password("wrong password", &hash));
    }
}
