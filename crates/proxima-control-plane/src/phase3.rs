use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use hmac::{Hmac, Mac};
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::Sha256;
use sqlx::{
    postgres::{PgConnectOptions, PgRow, PgSslMode},
    Connection, Row,
};
use std::{collections::HashMap, env};
use uuid::Uuid;

use super::{
    audit, authenticate, bad, db_error, require_admin, require_write, token_hash, AppState,
    AuthContext,
};

type HmacSha256 = Hmac<Sha256>;

#[derive(Deserialize)]
pub(crate) struct IntegrationInput {
    pub name: String,
    pub project_id: Option<Uuid>,
    pub configuration: Option<Value>,
}
#[derive(Deserialize)]
pub(crate) struct ModeInput {
    pub mode: String,
}
#[derive(Deserialize)]
pub(crate) struct EnvironmentInput {
    pub key: String,
    pub name: Option<String>,
    pub configuration: Option<Value>,
}
#[derive(Deserialize)]
pub(crate) struct DatabaseInput {
    pub environment_id: Uuid,
    pub host: String,
    pub port: u16,
    pub database_name: String,
    pub username: String,
    pub password: String,
    pub tls_mode: String,
}
#[derive(Deserialize)]
pub(crate) struct ContextInput {
    pub integration_id: Uuid,
    pub environment_id: Uuid,
    pub tenant_id: Uuid,
    pub ttl_seconds: Option<i64>,
}
#[derive(Deserialize)]
pub(crate) struct PolicyBindingInput {
    pub tenant_id: Uuid,
    pub policy_id: Uuid,
}
#[derive(Deserialize)]
pub(crate) struct MigrationInput {
    pub integration_id: Option<Uuid>,
    pub source_environment: String,
    pub target_environment: String,
    pub tenant_keys: Option<Vec<String>>,
}
#[derive(Deserialize)]
pub(crate) struct RoleInput {
    pub role: String,
}
#[derive(Deserialize)]
pub(crate) struct BypassInput {
    pub reason: String,
    pub duration_seconds: Option<i64>,
}
#[derive(Deserialize)]
pub(crate) struct InviteTokenQuery {
    pub token: String,
}

fn encryption_key() -> Result<String, Response> {
    match env::var("AGATA_SECRET_ENCRYPTION_KEY") {
        Ok(v) if v.len() >= 32 => Ok(v),
        _ => Err((StatusCode::SERVICE_UNAVAILABLE,Json(json!({"ok":false,"error":"secret_encryption_unavailable","message":"AGATA_SECRET_ENCRYPTION_KEY must be configured with at least 32 characters."}))).into_response())
    }
}
async fn encrypt_secret(db: &sqlx::PgPool, value: &str) -> Result<Vec<u8>, Response> {
    let key = encryption_key()?;
    sqlx::query_scalar("SELECT pgp_sym_encrypt($1,$2,'cipher-algo=aes256')")
        .bind(value)
        .bind(key)
        .fetch_one(db)
        .await
        .map_err(db_error)
}
async fn decrypt_secret(db: &sqlx::PgPool, value: &[u8]) -> Result<String, Response> {
    let key = encryption_key()?;
    sqlx::query_scalar("SELECT pgp_sym_decrypt($1,$2)")
        .bind(value)
        .bind(key)
        .fetch_one(db)
        .await
        .map_err(db_error)
}
fn mode_valid(v: &str) -> bool {
    matches!(v, "development" | "shadow" | "enforcement" | "maintenance")
}
fn tls_valid(v: &str) -> bool {
    matches!(v, "disable" | "require" | "verify-ca" | "verify-full")
}
async fn scoped_environment(
    db: &sqlx::PgPool,
    ctx: &AuthContext,
    id: Uuid,
) -> Result<PgRow, Response> {
    sqlx::query("SELECT id,organization_id,key,name,mode,status,configuration,deployment_state,verification_state,bypass_until FROM environments WHERE id=$1 AND organization_id=$2")
        .bind(id).bind(ctx.organization_id).fetch_optional(db).await.map_err(db_error)?
        .ok_or_else(||(StatusCode::NOT_FOUND,Json(json!({"ok":false,"message":"Environment not found in the active organization."}))).into_response())
}
async fn scoped_integration(
    db: &sqlx::PgPool,
    ctx: &AuthContext,
    id: Uuid,
) -> Result<PgRow, Response> {
    sqlx::query("SELECT id,organization_id,project_id,name,status,mode,configuration,created_at,updated_at FROM integrations WHERE id=$1 AND organization_id=$2")
        .bind(id).bind(ctx.organization_id).fetch_optional(db).await.map_err(db_error)?
        .ok_or_else(||(StatusCode::NOT_FOUND,Json(json!({"ok":false,"message":"Integration not found in the active organization."}))).into_response())
}

pub(crate) async fn integrations(State(s): State<AppState>, headers: HeaderMap) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    match sqlx::query("SELECT id,name,status,mode,project_id,configuration,created_at,updated_at,deactivated_at FROM integrations WHERE organization_id=$1 ORDER BY created_at DESC").bind(ctx.organization_id).fetch_all(&s.db).await{
        Ok(rows)=>Json(rows.iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"name":r.get::<String,_>("name"),"status":r.get::<String,_>("status"),"mode":r.get::<String,_>("mode"),"project_id":r.get::<Option<Uuid>,_>("project_id"),"configuration":r.get::<Value,_>("configuration"),"created_at":r.get::<chrono::DateTime<chrono::Utc>,_>("created_at"),"updated_at":r.get::<chrono::DateTime<chrono::Utc>,_>("updated_at"),"deactivated_at":r.get::<Option<chrono::DateTime<chrono::Utc>>,_>("deactivated_at")})).collect::<Vec<_>>()).into_response(),
        Err(e)=>db_error(e)
    }
}
pub(crate) async fn create_integration(
    State(s): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<IntegrationInput>,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if let Err(c) = require_admin(&ctx, &headers) {
        return c.into_response();
    };
    let name = input.name.trim();
    if name.is_empty() || name.len() > 120 {
        return bad("Integration name must be between 1 and 120 characters.");
    };
    if let Some(pid) = input.project_id {
        if !matches!(
            sqlx::query("SELECT 1 FROM projects WHERE id=$1 AND organization_id=$2")
                .bind(pid)
                .bind(ctx.organization_id)
                .fetch_optional(&s.db)
                .await,
            Ok(Some(_))
        ) {
            return bad("The selected project does not belong to the active organization.");
        }
    }
    let id = Uuid::new_v4();
    let cfg = input.configuration.unwrap_or_else(|| json!({}));
    if let Err(e)=sqlx::query("INSERT INTO integrations(id,organization_id,project_id,name,configuration,created_by) VALUES($1,$2,$3,$4,$5,$6)").bind(id).bind(ctx.organization_id).bind(input.project_id).bind(name).bind(cfg).bind(ctx.user_id).execute(&s.db).await{return super::unique_error(e)}
    let secret = format!("aga_int_{}_{}", id.simple(), Uuid::new_v4().simple());
    let prefix = secret.chars().take(16).collect::<String>();
    if let Err(e)=sqlx::query("INSERT INTO integration_credentials(id,integration_id,key_prefix,key_hash) VALUES($1,$2,$3,$4)").bind(Uuid::new_v4()).bind(id).bind(&prefix).bind(token_hash(&secret)).execute(&s.db).await{return db_error(e)}
    audit(
        &s.db,
        ctx.organization_id,
        ctx.user_id,
        "integration.created",
        "integration",
        Some(id),
        json!({"mode":"development"}),
    )
    .await;
    Json(json!({"id":id,"name":name,"status":"active","mode":"development","credential":secret,"message":"Store this integration credential securely. It is shown once and is never returned again."})).into_response()
}
pub(crate) async fn rotate_integration_credential(
    State(s): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if let Err(c) = require_admin(&ctx, &headers) {
        return c.into_response();
    };
    if let Err(e) = scoped_integration(&s.db, &ctx, id).await {
        return e;
    };
    let secret = format!("aga_int_{}_{}", id.simple(), Uuid::new_v4().simple());
    let prefix = secret.chars().take(16).collect::<String>();
    let mut tx = match s.db.begin().await {
        Ok(v) => v,
        Err(e) => return db_error(e),
    };
    if let Err(e)=sqlx::query("UPDATE integration_credentials SET active=false,revoked_at=now() WHERE integration_id=$1 AND active=true").bind(id).execute(&mut *tx).await{return db_error(e)}
    if let Err(e)=sqlx::query("INSERT INTO integration_credentials(id,integration_id,key_prefix,key_hash) VALUES($1,$2,$3,$4)").bind(Uuid::new_v4()).bind(id).bind(&prefix).bind(token_hash(&secret)).execute(&mut *tx).await{return db_error(e)}
    if let Err(e) = tx.commit().await {
        return db_error(e);
    }
    audit(
        &s.db,
        ctx.organization_id,
        ctx.user_id,
        "integration.credential.rotated",
        "integration",
        Some(id),
        json!({}),
    )
    .await;
    Json(json!({"ok":true,"credential":secret,"message":"The new integration credential is shown once."})).into_response()
}
pub(crate) async fn revoke_integration_credential(
    State(s): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if let Err(c) = require_admin(&ctx, &headers) {
        return c.into_response();
    };
    if let Err(e) = scoped_integration(&s.db, &ctx, id).await {
        return e;
    };
    match sqlx::query("UPDATE integration_credentials SET active=false,revoked_at=now() WHERE integration_id=$1 AND active=true").bind(id).execute(&s.db).await{
        Ok(_)=>{audit(&s.db,ctx.organization_id,ctx.user_id,"integration.credential.revoked","integration",Some(id),json!({})).await;Json(json!({"ok":true})).into_response()},
        Err(e)=>db_error(e)
    }
}
pub(crate) async fn deactivate_integration(
    State(s): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if let Err(c) = require_admin(&ctx, &headers) {
        return c.into_response();
    };
    if let Err(e) = scoped_integration(&s.db, &ctx, id).await {
        return e;
    };
    match sqlx::query("UPDATE integrations SET status='inactive',deactivated_at=now(),updated_at=now() WHERE id=$1 AND organization_id=$2 AND status='active'").bind(id).bind(ctx.organization_id).execute(&s.db).await{
        Ok(r) if r.rows_affected()==1=>{audit(&s.db,ctx.organization_id,ctx.user_id,"integration.deactivated","integration",Some(id),json!({})).await;Json(json!({"ok":true})).into_response()},
        Ok(_)=>(StatusCode::NOT_FOUND,Json(json!({"ok":false,"message":"Active integration not found."}))).into_response(),
        Err(e)=>db_error(e)
    }
}

pub(crate) async fn environments(State(s): State<AppState>, headers: HeaderMap) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    match sqlx::query("SELECT id,key,name,mode,status,configuration,deployment_state,verification_state,bypass_until FROM environments WHERE organization_id=$1 ORDER BY CASE key WHEN 'development' THEN 0 WHEN 'staging' THEN 1 ELSE 2 END").bind(ctx.organization_id).fetch_all(&s.db).await{
        Ok(rows)=>Json(rows.iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"key":r.get::<String,_>("key"),"name":r.get::<String,_>("name"),"mode":r.get::<String,_>("mode"),"status":r.get::<String,_>("status"),"configuration":r.get::<Value,_>("configuration"),"deployment_state":r.get::<String,_>("deployment_state"),"verification_state":r.get::<String,_>("verification_state"),"bypass_until":r.get::<Option<chrono::DateTime<chrono::Utc>>,_>("bypass_until")})).collect::<Vec<_>>()).into_response(),
        Err(e)=>db_error(e)
    }
}
pub(crate) async fn create_environment(
    State(s): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<EnvironmentInput>,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if let Err(c) = require_admin(&ctx, &headers) {
        return c.into_response();
    };
    if !matches!(input.key.as_str(), "development" | "staging" | "production") {
        return bad("Environment key must be development, staging, or production.");
    }
    let default_mode = match input.key.as_str() {
        "development" => "development",
        "staging" => "shadow",
        "production" => "enforcement",
        _ => unreachable!(),
    };
    let name = input.name.unwrap_or_else(|| match input.key.as_str() {
        "development" => "Development".into(),
        "staging" => "Staging".into(),
        "production" => "Production".into(),
        _ => String::new(),
    });
    let project_id: Option<Uuid> =
        sqlx::query_scalar("SELECT id FROM projects WHERE organization_id=$1 AND slug=$2")
            .bind(ctx.organization_id)
            .bind(&input.key)
            .fetch_optional(&s.db)
            .await
            .unwrap_or(None);
    match sqlx::query("INSERT INTO environments(id,organization_id,project_id,key,name,mode,configuration) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(organization_id,key) DO UPDATE SET name=EXCLUDED.name,configuration=EXCLUDED.configuration,updated_at=now()").bind(Uuid::new_v4()).bind(ctx.organization_id).bind(project_id).bind(&input.key).bind(&name).bind(default_mode).bind(input.configuration.unwrap_or_else(||json!({}))).execute(&s.db).await{
        Ok(_)=>{audit(&s.db,ctx.organization_id,ctx.user_id,"environment.configured","environment",None,json!({"key":input.key})).await;Json(json!({"ok":true})).into_response()},
        Err(e)=>db_error(e)
    }
}
pub(crate) async fn set_environment_mode(
    State(s): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    Json(input): Json<ModeInput>,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if let Err(c) = require_admin(&ctx, &headers) {
        return c.into_response();
    };
    if !mode_valid(&input.mode) {
        return bad("Invalid environment mode.");
    };
    if let Err(e) = scoped_environment(&s.db, &ctx, id).await {
        return e;
    };
    if let Err(e) = sqlx::query(
        "UPDATE environments SET mode=$1,updated_at=now() WHERE id=$2 AND organization_id=$3",
    )
    .bind(&input.mode)
    .bind(id)
    .bind(ctx.organization_id)
    .execute(&s.db)
    .await
    {
        return db_error(e);
    }
    audit(
        &s.db,
        ctx.organization_id,
        ctx.user_id,
        "environment.mode.changed",
        "environment",
        Some(id),
        json!({"mode":input.mode}),
    )
    .await;
    Json(json!({"ok":true})).into_response()
}
pub(crate) async fn request_environment_bypass(
    State(s): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    Json(input): Json<BypassInput>,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if let Err(c) = require_admin(&ctx, &headers) {
        return c.into_response();
    };
    if input.reason.trim().len() < 8 {
        return bad("An explicit bypass reason of at least 8 characters is required.");
    };
    let duration = input.duration_seconds.unwrap_or(900).clamp(60, 3600);
    if let Err(e) = scoped_environment(&s.db, &ctx, id).await {
        return e;
    };
    let until = chrono::Utc::now() + chrono::Duration::seconds(duration);
    if let Err(e)=sqlx::query("UPDATE environments SET mode='maintenance',bypass_until=$1,bypass_authorized_by=$2,updated_at=now() WHERE id=$3 AND organization_id=$4").bind(until).bind(ctx.user_id).bind(id).bind(ctx.organization_id).execute(&s.db).await{return db_error(e)}
    audit(
        &s.db,
        ctx.organization_id,
        ctx.user_id,
        "environment.emergency_bypass.granted",
        "environment",
        Some(id),
        json!({"reason":input.reason.trim(),"expires_at":until}),
    )
    .await;
    Json(json!({"ok":true,"expires_at":until})).into_response()
}

pub(crate) async fn database_connections(
    State(s): State<AppState>,
    headers: HeaderMap,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    match sqlx::query("SELECT d.id,d.environment_id,e.key,d.host,d.port,d.database_name,d.username,d.tls_mode,d.status,d.last_health_at,d.last_error FROM database_connections d JOIN environments e ON e.id=d.environment_id WHERE d.organization_id=$1 ORDER BY e.key").bind(ctx.organization_id).fetch_all(&s.db).await{
        Ok(rows)=>Json(rows.iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"environment_id":r.get::<Uuid,_>("environment_id"),"environment":r.get::<String,_>("key"),"host":r.get::<String,_>("host"),"port":r.get::<i32,_>("port"),"database":r.get::<String,_>("database_name"),"username":r.get::<String,_>("username"),"tls_mode":r.get::<String,_>("tls_mode"),"status":r.get::<String,_>("status"),"last_health_at":r.get::<Option<chrono::DateTime<chrono::Utc>>,_>("last_health_at"),"last_error":r.get::<Option<String>,_>("last_error")})).collect::<Vec<_>>()).into_response(),
        Err(e)=>db_error(e)
    }
}
async fn validate_database_values(
    host: &str,
    port: u16,
    database: &str,
    username: &str,
    password: &str,
    tls_mode: &str,
) -> Result<(), String> {
    if !tls_valid(tls_mode)
        || host.trim().is_empty()
        || database.trim().is_empty()
        || username.trim().is_empty()
        || password.is_empty()
    {
        return Err(
            "Database connection parameters are incomplete or the TLS mode is unsupported.".into(),
        );
    }
    let ssl = match tls_mode {
        "disable" => PgSslMode::Disable,
        "require" => PgSslMode::Require,
        "verify-ca" => PgSslMode::VerifyCa,
        "verify-full" => PgSslMode::VerifyFull,
        _ => return Err("Unsupported TLS mode.".into()),
    };
    let options = PgConnectOptions::new()
        .host(host.trim())
        .port(port)
        .database(database.trim())
        .username(username.trim())
        .password(password)
        .ssl_mode(ssl);
    match tokio::time::timeout(
        std::time::Duration::from_secs(8),
        sqlx::PgConnection::connect_with(&options),
    )
    .await
    {
        Ok(Ok(mut conn)) => match sqlx::query("SELECT 1").execute(&mut conn).await {
            Ok(_) => Ok(()),
            Err(e) => Err(format!("Database health query failed: {e}")),
        },
        Ok(Err(e)) => Err(format!("Database connection rejected: {e}")),
        Err(_) => Err("Database connection timed out.".into()),
    }
}
pub(crate) async fn create_database_connection(
    State(s): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<DatabaseInput>,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if let Err(c) = require_admin(&ctx, &headers) {
        return c.into_response();
    };
    if let Err(e) = scoped_environment(&s.db, &ctx, input.environment_id).await {
        return e;
    };
    let encrypted = match encrypt_secret(&s.db, &input.password).await {
        Ok(v) => v,
        Err(e) => return e,
    };
    let validation = validate_database_values(
        &input.host,
        input.port,
        &input.database_name,
        &input.username,
        &input.password,
        &input.tls_mode,
    )
    .await;
    let (status, last_error) = match validation {
        Ok(()) => ("connected", None),
        Err(m) => (
            if m.contains("rejected") {
                "rejected"
            } else {
                "failure"
            },
            Some(m),
        ),
    };
    let id = Uuid::new_v4();
    match sqlx::query("INSERT INTO database_connections(id,organization_id,environment_id,host,port,database_name,username,password_ciphertext,tls_mode,status,last_health_at,last_error) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CASE WHEN $10='connected' THEN now() ELSE NULL END,$11) ON CONFLICT(environment_id) DO UPDATE SET host=EXCLUDED.host,port=EXCLUDED.port,database_name=EXCLUDED.database_name,username=EXCLUDED.username,password_ciphertext=EXCLUDED.password_ciphertext,tls_mode=EXCLUDED.tls_mode,status=EXCLUDED.status,last_health_at=EXCLUDED.last_health_at,last_error=EXCLUDED.last_error,updated_at=now()").bind(id).bind(ctx.organization_id).bind(input.environment_id).bind(&input.host).bind(i32::from(input.port)).bind(&input.database_name).bind(&input.username).bind(encrypted).bind(&input.tls_mode).bind(status).bind(&last_error).execute(&s.db).await{
        Ok(_)=>{audit(&s.db,ctx.organization_id,ctx.user_id,"database.connection.configured","database_connection",Some(id),json!({"environment_id":input.environment_id,"tls_mode":input.tls_mode,"status":status})).await;Json(json!({"ok":status=="connected","id":id,"status":status,"error":last_error})).into_response()},
        Err(e)=>db_error(e)
    }
}
pub(crate) async fn validate_database_connection(
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
    };
    let row=match sqlx::query("SELECT host,port,database_name,username,password_ciphertext,tls_mode FROM database_connections WHERE id=$1 AND organization_id=$2").bind(id).bind(ctx.organization_id).fetch_optional(&s.db).await{Ok(Some(v))=>v,Ok(None)=>return (StatusCode::NOT_FOUND,Json(json!({"ok":false,"message":"Database connection not found."}))).into_response(),Err(e)=>return db_error(e)};
    let secret = match decrypt_secret(
        &s.db,
        row.get::<Vec<u8>, _>("password_ciphertext").as_slice(),
    )
    .await
    {
        Ok(v) => v,
        Err(e) => return e,
    };
    match validate_database_values(
        &row.get::<String, _>("host"),
        row.get::<i32, _>("port") as u16,
        &row.get::<String, _>("database_name"),
        &row.get::<String, _>("username"),
        &secret,
        &row.get::<String, _>("tls_mode"),
    )
    .await
    {
        Ok(()) => {
            let _=sqlx::query("UPDATE database_connections SET status='connected',last_health_at=now(),last_error=NULL,updated_at=now() WHERE id=$1 AND organization_id=$2").bind(id).bind(ctx.organization_id).execute(&s.db).await;
            Json(json!({"ok":true,"status":"connected"})).into_response()
        }
        Err(m) => {
            let status = if m.contains("rejected") {
                "rejected"
            } else {
                "failure"
            };
            let _=sqlx::query("UPDATE database_connections SET status=$1,last_health_at=now(),last_error=$2,updated_at=now() WHERE id=$3 AND organization_id=$4").bind(status).bind(&m).bind(id).bind(ctx.organization_id).execute(&s.db).await;
            Json(json!({"ok":false,"status":status,"message":m})).into_response()
        }
    }
}

pub(crate) async fn issue_context(
    State(s): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<ContextInput>,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if let Err(c) = require_write(&ctx, &headers) {
        return c.into_response();
    };
    if let Err(e) = scoped_integration(&s.db, &ctx, input.integration_id).await {
        return e;
    };
    if let Err(e) = scoped_environment(&s.db, &ctx, input.environment_id).await {
        return e;
    };
    let tenant =
        match sqlx::query("SELECT id,status FROM tenants WHERE id=$1 AND organization_id=$2")
            .bind(input.tenant_id)
            .bind(ctx.organization_id)
            .fetch_optional(&s.db)
            .await
        {
            Ok(Some(v)) => v,
            Ok(None) => return (
                StatusCode::NOT_FOUND,
                Json(json!({"ok":false,"message":"Tenant not found in the active organization."})),
            )
                .into_response(),
            Err(e) => return db_error(e),
        };
    if tenant.get::<String, _>("status") != "active" {
        return bad("Tenant is not active.");
    }
    let ttl = input.ttl_seconds.unwrap_or(300).clamp(30, 900);
    let exp = chrono::Utc::now().timestamp() + ttl;
    let jti = Uuid::new_v4().to_string();
    let key =
        match env::var("PROXIMA_CONTEXT_SIGNING_KEY") {
            Ok(v) if v.len() >= 32 => v,
            _ => return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(
                    json!({"ok":false,"message":"PROXIMA_CONTEXT_SIGNING_KEY is not configured."}),
                ),
            )
                .into_response(),
        };
    let payload = format!(
        "v2.{}.{}.{}.{}.{}.{}",
        ctx.organization_id, input.tenant_id, input.environment_id, input.integration_id, exp, jti
    );
    let mut mac = HmacSha256::new_from_slice(key.as_bytes()).expect("valid HMAC key");
    mac.update(payload.as_bytes());
    let signature = hex::encode(mac.finalize().into_bytes());
    let token = format!("{}.{}", payload, signature);
    if let Err(e)=sqlx::query("INSERT INTO tenant_context_issuances(jti_hash,organization_id,integration_id,environment_id,tenant_id,expires_at) VALUES($1,$2,$3,$4,$5,to_timestamp($6))").bind(token_hash(&jti)).bind(ctx.organization_id).bind(input.integration_id).bind(input.environment_id).bind(input.tenant_id).bind(exp).execute(&s.db).await{return db_error(e)}
    audit(&s.db,ctx.organization_id,ctx.user_id,"tenant_context.issued","tenant",Some(input.tenant_id),json!({"integration_id":input.integration_id,"environment_id":input.environment_id,"expires_at":exp})).await;
    Json(json!({"ok":true,"token":token,"expires_at":exp,"tenant_id":input.tenant_id,"organization_id":ctx.organization_id,"environment_id":input.environment_id,"integration_id":input.integration_id})).into_response()
}
pub(crate) async fn verify_context(
    State(s): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if let Err(c) = require_write(&ctx, &headers) {
        return c.into_response();
    };
    let token = body.get("token").and_then(Value::as_str).unwrap_or("");
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 8 || parts[0] != "v2" {
        return bad("Invalid tenant context format.");
    };
    let org = match Uuid::parse_str(parts[1]) {
        Ok(v) => v,
        Err(_) => return bad("Invalid organization in tenant context."),
    };
    let tenant = match Uuid::parse_str(parts[2]) {
        Ok(v) => v,
        Err(_) => return bad("Invalid tenant in tenant context."),
    };
    let env_id = match Uuid::parse_str(parts[3]) {
        Ok(v) => v,
        Err(_) => return bad("Invalid environment in tenant context."),
    };
    let integration = match Uuid::parse_str(parts[4]) {
        Ok(v) => v,
        Err(_) => return bad("Invalid integration in tenant context."),
    };
    let exp = match parts[5].parse::<i64>() {
        Ok(v) => v,
        Err(_) => return bad("Invalid expiration."),
    };
    let jti = parts[6];
    if org != ctx.organization_id {
        return StatusCode::FORBIDDEN.into_response();
    }
    let key = match env::var("PROXIMA_CONTEXT_SIGNING_KEY") {
        Ok(v) if v.len() >= 32 => v,
        _ => return StatusCode::SERVICE_UNAVAILABLE.into_response(),
    };
    let payload = parts[..7].join(".");
    let mut mac = HmacSha256::new_from_slice(key.as_bytes()).expect("valid HMAC key");
    mac.update(payload.as_bytes());
    let expected = hex::encode(mac.finalize().into_bytes());
    if expected != parts[7] {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"ok":false,"message":"Tenant context signature is invalid."})),
        )
            .into_response();
    }
    if exp <= chrono::Utc::now().timestamp() {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"ok":false,"message":"Tenant context has expired."})),
        )
            .into_response();
    }
    let row=match sqlx::query("SELECT consumed_at,expires_at FROM tenant_context_issuances WHERE jti_hash=$1 AND organization_id=$2 AND tenant_id=$3 AND environment_id=$4 AND integration_id=$5").bind(token_hash(jti)).bind(ctx.organization_id).bind(tenant).bind(env_id).bind(integration).fetch_optional(&s.db).await{Ok(Some(v))=>v,Ok(None)=>return (StatusCode::FORBIDDEN,Json(json!({"ok":false,"message":"Tenant context was not issued by this organization."}))).into_response(),Err(e)=>return db_error(e)};
    if row.get::<chrono::DateTime<chrono::Utc>, _>("expires_at") <= chrono::Utc::now() {
        return StatusCode::FORBIDDEN.into_response();
    }
    if row
        .get::<Option<chrono::DateTime<chrono::Utc>>, _>("consumed_at")
        .is_some()
    {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"ok":false,"message":"Tenant context replay detected."})),
        )
            .into_response();
    }
    if let Err(e)=sqlx::query("UPDATE tenant_context_issuances SET consumed_at=now() WHERE jti_hash=$1 AND consumed_at IS NULL").bind(token_hash(jti)).execute(&s.db).await{return db_error(e)}
    Json(json!({"ok":true,"decision":"PASS","organization_id":org,"tenant_id":tenant,"environment_id":env_id,"integration_id":integration,"expires_at":row.get::<chrono::DateTime<chrono::Utc>,_>("expires_at")})).into_response()
}

pub(crate) async fn bind_policy(
    State(s): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<PolicyBindingInput>,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if let Err(c) = require_write(&ctx, &headers) {
        return c.into_response();
    };
    let policy = match sqlx::query(
        "SELECT id,version,status FROM policies WHERE id=$1 AND organization_id=$2",
    )
    .bind(input.policy_id)
    .bind(ctx.organization_id)
    .fetch_optional(&s.db)
    .await
    {
        Ok(Some(v)) => v,
        Ok(None) => return bad("Policy not found in the active organization."),
        Err(e) => return db_error(e),
    };
    let tenant = match sqlx::query("SELECT status FROM tenants WHERE id=$1 AND organization_id=$2")
        .bind(input.tenant_id)
        .bind(ctx.organization_id)
        .fetch_optional(&s.db)
        .await
    {
        Ok(Some(v)) => v,
        Ok(None) => return bad("Tenant not found in the active organization."),
        Err(e) => return db_error(e),
    };
    if tenant.get::<String, _>("status") != "active" {
        return bad("Tenant is not active.");
    }
    match sqlx::query("INSERT INTO tenant_policy_bindings(tenant_id,policy_id,organization_id) VALUES($1,$2,$3) ON CONFLICT(tenant_id) DO UPDATE SET policy_id=EXCLUDED.policy_id").bind(input.tenant_id).bind(input.policy_id).bind(ctx.organization_id).execute(&s.db).await{
        Ok(_)=>{audit(&s.db,ctx.organization_id,ctx.user_id,"policy.bound","tenant",Some(input.tenant_id),json!({"policy_id":input.policy_id,"version":policy.get::<i32,_>("version"),"status":policy.get::<String,_>("status")})).await;Json(json!({"ok":true})).into_response()},
        Err(e)=>db_error(e)
    }
}

pub(crate) async fn migrations(State(s): State<AppState>, headers: HeaderMap) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    match sqlx::query("SELECT id,integration_id,source_environment,target_environment,status,compatibility_report,rollback_plan,created_at,updated_at FROM migration_runs WHERE organization_id=$1 ORDER BY created_at DESC").bind(ctx.organization_id).fetch_all(&s.db).await{
        Ok(rows)=>Json(rows.iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"integration_id":r.get::<Option<Uuid>,_>("integration_id"),"source_environment":r.get::<String,_>("source_environment"),"target_environment":r.get::<String,_>("target_environment"),"status":r.get::<String,_>("status"),"compatibility_report":r.get::<Value,_>("compatibility_report"),"rollback_plan":r.get::<Value,_>("rollback_plan"),"created_at":r.get::<chrono::DateTime<chrono::Utc>,_>("created_at"),"updated_at":r.get::<chrono::DateTime<chrono::Utc>,_>("updated_at")})).collect::<Vec<_>>()).into_response(),
        Err(e)=>db_error(e)
    }
}
pub(crate) async fn create_migration(
    State(s): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<MigrationInput>,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if let Err(c) = require_admin(&ctx, &headers) {
        return c.into_response();
    };
    if input.source_environment == input.target_environment {
        return bad("Source and target environments must differ.");
    };
    let valid = ["development", "staging", "production"];
    if !valid.contains(&input.source_environment.as_str())
        || !valid.contains(&input.target_environment.as_str())
    {
        return bad("Migration environments must be development, staging, or production.");
    };
    if let Some(id) = input.integration_id {
        if let Err(e) = scoped_integration(&s.db, &ctx, id).await {
            return e;
        }
    }
    let id = Uuid::new_v4();
    let keys = input.tenant_keys.unwrap_or_default();
    let report = json!({"tenant_discovery":{"requested":keys.len(),"mapped":0},"compatibility":{"status":"pending"},"preflight":{"status":"not_run"}});
    let rollback = json!({"required_steps":["keep source environment unchanged","verify tenant mappings before canary","revert integration mode to source on failure"],"safe":true});
    if let Err(e)=sqlx::query("INSERT INTO migration_runs(id,organization_id,integration_id,source_environment,target_environment,compatibility_report,rollback_plan,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)").bind(id).bind(ctx.organization_id).bind(input.integration_id).bind(&input.source_environment).bind(&input.target_environment).bind(report).bind(rollback).bind(ctx.user_id).execute(&s.db).await{return db_error(e)}
    for key in keys {
        let _=sqlx::query("INSERT INTO migration_tenant_maps(id,migration_id,source_key) VALUES($1,$2,$3) ON CONFLICT(migration_id,source_key) DO NOTHING").bind(Uuid::new_v4()).bind(id).bind(&key).execute(&s.db).await;
    }
    audit(
        &s.db,
        ctx.organization_id,
        ctx.user_id,
        "migration.created",
        "migration",
        Some(id),
        json!({"source":input.source_environment,"target":input.target_environment}),
    )
    .await;
    Json(json!({"ok":true,"id":id,"status":"draft"})).into_response()
}
pub(crate) async fn migration_preflight(
    State(s): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if let Err(c) = require_admin(&ctx, &headers) {
        return c.into_response();
    };
    let row=match sqlx::query("SELECT source_environment,target_environment FROM migration_runs WHERE id=$1 AND organization_id=$2").bind(id).bind(ctx.organization_id).fetch_optional(&s.db).await{Ok(Some(v))=>v,Ok(None)=>return (StatusCode::NOT_FOUND,Json(json!({"ok":false,"message":"Migration run not found."}))).into_response(),Err(e)=>return db_error(e)};
    let source = row.get::<String, _>("source_environment");
    let target = row.get::<String, _>("target_environment");
    let source_exists = sqlx::query(
        "SELECT 1 FROM environments WHERE organization_id=$1 AND key=$2 AND status='active'",
    )
    .bind(ctx.organization_id)
    .bind(&source)
    .fetch_optional(&s.db)
    .await
    .ok()
    .flatten()
    .is_some();
    let target_exists = sqlx::query(
        "SELECT 1 FROM environments WHERE organization_id=$1 AND key=$2 AND status='active'",
    )
    .bind(ctx.organization_id)
    .bind(&target)
    .fetch_optional(&s.db)
    .await
    .ok()
    .flatten()
    .is_some();
    let tenant_count: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM tenants WHERE organization_id=$1 AND status='active'",
    )
    .bind(ctx.organization_id)
    .fetch_one(&s.db)
    .await
    .unwrap_or(0);
    let db_count:i64=sqlx::query_scalar("SELECT count(*) FROM database_connections d JOIN environments e ON e.id=d.environment_id WHERE d.organization_id=$1 AND e.key=$2 AND d.status='connected'").bind(ctx.organization_id).bind(&target).fetch_one(&s.db).await.unwrap_or(0);
    let passed = source_exists && target_exists && tenant_count > 0 && db_count > 0;
    let report = json!({"checks":{"source_environment":source_exists,"target_environment":target_exists,"active_tenants_available":tenant_count>0,"target_database_connected":db_count>0},"active_tenants":tenant_count,"target_database_connections":db_count,"status":if passed{"PASS"}else{"BLOCKED AS EXPECTED"}});
    let status = if passed { "verified" } else { "failed" };
    if let Err(e)=sqlx::query("UPDATE migration_runs SET status=$1,compatibility_report=$2,updated_at=now() WHERE id=$3 AND organization_id=$4").bind(status).bind(&report).bind(id).bind(ctx.organization_id).execute(&s.db).await{return db_error(e)}
    audit(
        &s.db,
        ctx.organization_id,
        ctx.user_id,
        "migration.preflight",
        "migration",
        Some(id),
        report.clone(),
    )
    .await;
    Json(json!({"ok":passed,"status":report["status"],"report":report})).into_response()
}

pub(crate) async fn team_resend_invitation(
    State(s): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if let Err(c) = require_admin(&ctx, &headers) {
        return c.into_response();
    };
    let row=match sqlx::query("SELECT email,role FROM organization_invites WHERE id=$1 AND organization_id=$2 AND accepted_at IS NULL AND expires_at>now()").bind(id).bind(ctx.organization_id).fetch_optional(&s.db).await{Ok(Some(v))=>v,Ok(None)=>return (StatusCode::NOT_FOUND,Json(json!({"ok":false,"message":"Pending invitation not found or expired."}))).into_response(),Err(e)=>return db_error(e)};
    let email = row.get::<String, _>("email");
    let role = row.get::<String, _>("role");
    let token = format!("{}-{}", Uuid::new_v4(), Uuid::new_v4());
    if let Err(e)=sqlx::query("UPDATE organization_invites SET token_hash=$1,expires_at=now()+interval '7 days' WHERE id=$2 AND organization_id=$3").bind(token_hash(&token)).bind(id).bind(ctx.organization_id).execute(&s.db).await{return db_error(e)};
    let org = match sqlx::query_scalar::<_, String>("SELECT name FROM organizations WHERE id=$1")
        .bind(ctx.organization_id)
        .fetch_one(&s.db)
        .await
    {
        Ok(v) => v,
        Err(e) => return db_error(e),
    };
    let base = env::var("AGATA_PUBLIC_BASE_URL")
        .unwrap_or_else(|_| "http://127.0.0.1:8080".into())
        .trim_end_matches('/')
        .to_string();
    if let Err(_)=super::production::send_template_email(&email,"0757a210-a372-4a5a-8fca-e642c2fed3da",json!({"ORGANIZATION":org,"ROLE":role,"ACTION_URL":format!("{base}/accept-invite?token={token}")})).await{return super::service_unavailable("Invitation email could not be sent.")};
    audit(
        &s.db,
        ctx.organization_id,
        ctx.user_id,
        "organization.invite.resent",
        "organization_invite",
        Some(id),
        json!({"email":email}),
    )
    .await;
    Json(json!({"ok":true,"expires_in":"7 days"})).into_response()
}
pub(crate) async fn team_reject_invitation(
    State(s): State<AppState>,
    Query(q): Query<InviteTokenQuery>,
    headers: HeaderMap,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    let row=match sqlx::query("SELECT id,organization_id FROM organization_invites WHERE token_hash=$1 AND expires_at>now() AND accepted_at IS NULL AND lower(email)=(SELECT lower(email) FROM users WHERE id=$2)").bind(token_hash(&q.token)).bind(ctx.user_id).fetch_optional(&s.db).await{Ok(Some(v))=>v,Ok(None)=>return bad("Invitation is invalid, expired, or belongs to another email address."),Err(e)=>return db_error(e)};
    let id = row.get::<Uuid, _>("id");
    let org = row.get::<Uuid, _>("organization_id");
    if let Err(e)=sqlx::query("DELETE FROM organization_invites WHERE id=$1 AND organization_id=$2 AND accepted_at IS NULL").bind(id).bind(org).execute(&s.db).await{return db_error(e)};
    audit(
        &s.db,
        org,
        ctx.user_id,
        "organization.invite.rejected",
        "organization_invite",
        Some(id),
        json!({}),
    )
    .await;
    Json(json!({"ok":true})).into_response()
}
pub(crate) async fn team_change_role(
    State(s): State<AppState>,
    Path(member_id): Path<Uuid>,
    headers: HeaderMap,
    Json(input): Json<RoleInput>,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if let Err(c) = require_admin(&ctx, &headers) {
        return c.into_response();
    };
    if !matches!(input.role.as_str(), "admin" | "operator" | "viewer") {
        return bad("Member role must be admin, operator, or viewer.");
    };
    let target =
        match sqlx::query("SELECT role FROM memberships WHERE user_id=$1 AND organization_id=$2")
            .bind(member_id)
            .bind(ctx.organization_id)
            .fetch_optional(&s.db)
            .await
        {
            Ok(Some(v)) => v,
            Ok(None) => {
                return (
                    StatusCode::NOT_FOUND,
                    Json(json!({"ok":false,"message":"Member not found."})),
                )
                .into_response()
            }
            Err(e) => return db_error(e),
        };
    let old = target.get::<String, _>("role");
    if old == "owner" {
        return (StatusCode::FORBIDDEN,Json(json!({"ok":false,"message":"The organization owner cannot be demoted through this workflow."}))).into_response();
    };
    if member_id == ctx.user_id && ctx.role == "admin" && input.role != "admin" {
        return bad("An admin cannot remove their own administrative access.");
    };
    if let Err(e) =
        sqlx::query("UPDATE memberships SET role=$1 WHERE user_id=$2 AND organization_id=$3")
            .bind(&input.role)
            .bind(member_id)
            .bind(ctx.organization_id)
            .execute(&s.db)
            .await
    {
        return db_error(e);
    };
    audit(
        &s.db,
        ctx.organization_id,
        ctx.user_id,
        "organization.member.role_changed",
        "membership",
        Some(member_id),
        json!({"from":old,"to":input.role}),
    )
    .await;
    Json(json!({"ok":true,"role":input.role})).into_response()
}
pub(crate) async fn team_remove_member(
    State(s): State<AppState>,
    Path(member_id): Path<Uuid>,
    headers: HeaderMap,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if let Err(c) = require_admin(&ctx, &headers) {
        return c.into_response();
    };
    if member_id == ctx.user_id {
        return bad("You cannot remove yourself from the active organization.");
    };
    let target=match sqlx::query("SELECT role,email FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.user_id=$1 AND m.organization_id=$2").bind(member_id).bind(ctx.organization_id).fetch_optional(&s.db).await{Ok(Some(v))=>v,Ok(None)=>return (StatusCode::NOT_FOUND,Json(json!({"ok":false,"message":"Member not found."}))).into_response(),Err(e)=>return db_error(e)};
    if target.get::<String, _>("role") == "owner" {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"ok":false,"message":"The organization owner cannot be removed."})),
        )
            .into_response();
    };
    if let Err(e) = sqlx::query("DELETE FROM memberships WHERE user_id=$1 AND organization_id=$2")
        .bind(member_id)
        .bind(ctx.organization_id)
        .execute(&s.db)
        .await
    {
        return db_error(e);
    };
    audit(
        &s.db,
        ctx.organization_id,
        ctx.user_id,
        "organization.member.removed",
        "membership",
        Some(member_id),
        json!({"email":target.get::<String,_>("email")}),
    )
    .await;
    Json(json!({"ok":true})).into_response()
}

pub(crate) async fn audit_search(
    State(s): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<HashMap<String, String>>,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    let term = query.get("q").cloned().unwrap_or_default();
    let action = query.get("action").cloned().unwrap_or_default();
    let tenant = query.get("tenant_id").and_then(|v| Uuid::parse_str(v).ok());
    let rows = if !term.is_empty() {
        sqlx::query("SELECT id,action,resource_type,resource_id,metadata,created_at,correlation_id,decision,verification_result,failure_reason,tenant_id,integration_id,environment_id,policy_id FROM audit_events WHERE organization_id=$1 AND (action ILIKE $2 OR resource_type ILIKE $2 OR metadata::text ILIKE $2) ORDER BY created_at DESC LIMIT 200").bind(ctx.organization_id).bind(format!("%{}%",term)).fetch_all(&s.db).await
    } else if !action.is_empty() {
        sqlx::query("SELECT id,action,resource_type,resource_id,metadata,created_at,correlation_id,decision,verification_result,failure_reason,tenant_id,integration_id,environment_id,policy_id FROM audit_events WHERE organization_id=$1 AND action=$2 ORDER BY created_at DESC LIMIT 200").bind(ctx.organization_id).bind(action).fetch_all(&s.db).await
    } else if let Some(tid) = tenant {
        sqlx::query("SELECT id,action,resource_type,resource_id,metadata,created_at,correlation_id,decision,verification_result,failure_reason,tenant_id,integration_id,environment_id,policy_id FROM audit_events WHERE organization_id=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT 200").bind(ctx.organization_id).bind(tid).fetch_all(&s.db).await
    } else {
        sqlx::query("SELECT id,action,resource_type,resource_id,metadata,created_at,correlation_id,decision,verification_result,failure_reason,tenant_id,integration_id,environment_id,policy_id FROM audit_events WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 200").bind(ctx.organization_id).fetch_all(&s.db).await
    };
    match rows{
        Ok(rows)=>Json(rows.iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"action":r.get::<String,_>("action"),"resource_type":r.get::<String,_>("resource_type"),"resource_id":r.get::<Option<Uuid>,_>("resource_id"),"metadata":r.get::<Value,_>("metadata"),"created_at":r.get::<chrono::DateTime<chrono::Utc>,_>("created_at"),"correlation_id":r.get::<String,_>("correlation_id"),"decision":r.get::<Option<String>,_>("decision"),"verification_result":r.get::<Option<String>,_>("verification_result"),"failure_reason":r.get::<Option<String>,_>("failure_reason"),"tenant_id":r.get::<Option<Uuid>,_>("tenant_id"),"integration_id":r.get::<Option<Uuid>,_>("integration_id"),"environment_id":r.get::<Option<Uuid>,_>("environment_id"),"policy_id":r.get::<Option<Uuid>,_>("policy_id")})).collect::<Vec<_>>()).into_response(),
        Err(e)=>db_error(e)
    }
}

pub(crate) async fn ensure_organization_environments(
    db: &sqlx::PgPool,
    organization_id: Uuid,
) -> Result<(), sqlx::Error> {
    for (key, name, mode) in [
        ("development", "Development", "development"),
        ("staging", "Staging", "shadow"),
        ("production", "Production", "enforcement"),
    ] {
        let project_id: Option<Uuid> =
            sqlx::query_scalar("SELECT id FROM projects WHERE organization_id=$1 AND slug=$2")
                .bind(organization_id)
                .bind(key)
                .fetch_optional(db)
                .await?;
        let project_id = match project_id {
            Some(v) => v,
            None => {
                let id = Uuid::new_v4();
                sqlx::query(
                    "INSERT INTO projects(id,organization_id,name,slug) VALUES($1,$2,$3,$4)",
                )
                .bind(id)
                .bind(organization_id)
                .bind(name)
                .bind(key)
                .execute(db)
                .await?;
                id
            }
        };
        sqlx::query("INSERT INTO environments(id,organization_id,project_id,key,name,mode) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(organization_id,key) DO NOTHING").bind(Uuid::new_v4()).bind(organization_id).bind(project_id).bind(key).bind(name).bind(mode).execute(db).await?;
    }
    Ok(())
}
