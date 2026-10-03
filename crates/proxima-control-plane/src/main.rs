use axum::{extract::{Path, State}, http::{header, HeaderMap, HeaderValue, StatusCode}, response::{IntoResponse, Response}, routing::{get, post}, Json, Router};
use argon2::{password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString}, Argon2};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{env, fs, net::SocketAddr, path::PathBuf, sync::Arc, time::{SystemTime, UNIX_EPOCH}};
use tokio::sync::RwLock;
use tower_http::{cors::{Any, CorsLayer}, trace::TraceLayer};
use uuid::Uuid;

#[derive(Clone)]
struct AppState {
    store: Arc<RwLock<Store>>,
    path: PathBuf,
    api_key: Option<String>,
    secure_cookies: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Store {
    schema_version: u32,
    users: Vec<User>,
    sessions: Vec<Session>,
    organizations: Vec<Organization>,
    projects: Vec<Project>,
    tenants: Vec<Tenant>,
    policies: Vec<Policy>,
    nodes: Vec<Node>,
    audit: Vec<AuditEvent>,
}
#[derive(Debug, Serialize, Deserialize, Clone)]
struct User { id: Uuid, email: String, password_hash: String, created_at: u64 }
#[derive(Debug, Serialize, Deserialize, Clone)]
struct Session { id: Uuid, user_id: Uuid, verifier_hash: String, created_at: u64, expires_at: u64 }
#[derive(Debug, Serialize, Deserialize, Clone)]
struct Organization { id: Uuid, name: String, slug: String, created_at: u64 }
#[derive(Debug, Serialize, Deserialize, Clone)]
struct Project { id: Uuid, organization_id: Uuid, name: String, environment: String, created_at: u64 }
#[derive(Debug, Serialize, Deserialize, Clone)]
struct Tenant { id: Uuid, project_id: Uuid, name: String, status: String, region: String, created_at: u64 }
#[derive(Debug, Serialize, Deserialize, Clone)]
struct Policy { id: Uuid, project_id: Uuid, name: String, mode: String, version: u64, status: String, created_at: u64 }
#[derive(Debug, Serialize, Deserialize, Clone)]
struct Node { id: Uuid, project_id: Uuid, name: String, status: String, version: String, region: String, last_seen: u64 }
#[derive(Debug, Serialize, Deserialize, Clone)]
struct AuditEvent { id: Uuid, actor: String, action: String, resource: String, resource_id: String, outcome: String, created_at: u64 }

impl Default for Store {
    fn default() -> Self {
        let now = now();
        let org_id = Uuid::new_v4();
        let project_id = Uuid::new_v4();
        Self {
            schema_version: 1,
            users: vec![],
            sessions: vec![],
            organizations: vec![Organization { id: org_id, name: "Acme Platform".into(), slug: "acme-platform".into(), created_at: now }],
            projects: vec![Project { id: project_id, organization_id: org_id, name: "Production".into(), environment: "production".into(), created_at: now }],
            tenants: vec![
                Tenant { id: Uuid::new_v4(), project_id, name: "Northstar".into(), status: "protected".into(), region: "eu-west-1".into(), created_at: now },
                Tenant { id: Uuid::new_v4(), project_id, name: "Atlas".into(), status: "protected".into(), region: "us-east-1".into(), created_at: now },
                Tenant { id: Uuid::new_v4(), project_id, name: "Orbit".into(), status: "protected".into(), region: "ap-south-1".into(), created_at: now },
            ],
            policies: vec![Policy { id: Uuid::new_v4(), project_id, name: "Tenant Boundary / Production".into(), mode: "enforce".into(), version: 1, status: "active".into(), created_at: now }],
            nodes: vec![Node { id: Uuid::new_v4(), project_id, name: "proxima-prod-01".into(), status: "healthy".into(), version: "0.1.0".into(), region: "eu-west-1".into(), last_seen: now }],
            audit: vec![],
        }
    }
}

#[derive(Debug, Deserialize)] struct Credentials { email: String, password: String }
#[derive(Debug, Deserialize)] struct CreateTenant { name: String, region: String }
#[derive(Debug, Deserialize)] struct CreatePolicy { name: String, mode: String }
#[derive(Debug, Serialize)] struct Message { message: String }
#[derive(Debug, Serialize)] struct AuthResponse { user_id: Uuid, email: String }

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt().with_env_filter(env::var("RUST_LOG").unwrap_or_else(|_| "proxima_control_plane=info".into())).init();
    let path = PathBuf::from(env::var("PROXIMA_CONTROL_PLANE_STATE").unwrap_or_else(|_| "proxima-control-plane.json".into()));
    let store = load_store(&path)?;
    let state = AppState {
        store: Arc::new(RwLock::new(store)),
        path,
        api_key: env::var("PROXIMA_CONTROL_PLANE_API_KEY").ok().filter(|v| !v.is_empty()),
        secure_cookies: env::var("PROXIMA_CONTROL_PLANE_SECURE_COOKIES").map(|v| v == "true").unwrap_or(false),
    };
    let app = Router::new()
        .route("/api/v1/health", get(health))
        .route("/api/v1/overview", get(overview))
        .route("/api/v1/tenants", get(tenants).post(create_tenant))
        .route("/api/v1/policies", get(policies).post(create_policy))
        .route("/api/v1/nodes", get(nodes))
        .route("/api/v1/audit", get(audit))
        .route("/api/v1/auth/signup", post(signup))
        .route("/api/v1/auth/login", post(login))
        .route("/api/v1/auth/logout", post(logout))
        .route("/api/v1/auth/me", get(me))
        .route("/api/v1/tenants/{id}", get(tenant))
        .layer(CorsLayer::new().allow_origin([
            "http://127.0.0.1:9080".parse::<HeaderValue>().unwrap(),
            "http://localhost:9080".parse::<HeaderValue>().unwrap(),
        ]).allow_credentials(true).allow_methods(Any).allow_headers(Any))
        .layer(TraceLayer::new_for_http())
        .with_state(state);
    let addr: SocketAddr = env::var("PROXIMA_CONTROL_PLANE_LISTEN_ADDR").unwrap_or_else(|_| "127.0.0.1:9090".into()).parse()?;
    tracing::info!(%addr, "Proxima control plane listening");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

async fn health() -> impl IntoResponse {
    Json(serde_json::json!({"status":"healthy","service":"proxima-control-plane","control_plane":true}))
}

async fn overview(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(r) = authorize(&state, &headers).await { return r; }
    let s = state.store.read().await;
    Json(serde_json::json!({
        "engine_boundary": "independent",
        "control_plane": "healthy",
        "policy_enforcement": "data-plane-owned",
        "offline_enforcement": true,
        "organizations": s.organizations.len(),
        "projects": s.projects.len(),
        "tenants": s.tenants.len(),
        "policies": s.policies.len(),
        "nodes": s.nodes.len(),
        "healthy_nodes": s.nodes.iter().filter(|n| n.status == "healthy").count(),
        "audit_events": s.audit.len()
    })).into_response()
}

async fn tenants(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(r) = authorize(&state, &headers).await { return r; }
    Json(state.store.read().await.tenants.clone()).into_response()
}

async fn tenant(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<Uuid>) -> Response {
    if let Err(r) = authorize(&state, &headers).await { return r; }
    match state.store.read().await.tenants.iter().find(|t| t.id == id).cloned() {
        Some(t) => Json(t).into_response(),
        None => (StatusCode::NOT_FOUND, Json(Message { message: "tenant not found".into() })).into_response(),
    }
}

async fn create_tenant(State(state): State<AppState>, headers: HeaderMap, Json(input): Json<CreateTenant>) -> Response {
    if let Err(r) = authorize(&state, &headers).await { return r; }
    if input.name.trim().is_empty() || input.region.trim().is_empty() {
        return (StatusCode::BAD_REQUEST, Json(Message { message: "name and region are required".into() })).into_response();
    }
    let mut s = state.store.write().await;
    let project_id = s.projects.first().map(|p| p.id).unwrap();
    let t = Tenant { id: Uuid::new_v4(), project_id, name: input.name.trim().into(), status: "protected".into(), region: input.region.trim().into(), created_at: now() };
    s.tenants.push(t.clone());
    record(&mut s, "operator", "tenant.created", "tenant", t.id.to_string(), "success");
    persist(&state, &s);
    Json(t).into_response()
}

async fn policies(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(r) = authorize(&state, &headers).await { return r; }
    Json(state.store.read().await.policies.clone()).into_response()
}

async fn create_policy(State(state): State<AppState>, headers: HeaderMap, Json(input): Json<CreatePolicy>) -> Response {
    if let Err(r) = authorize(&state, &headers).await { return r; }
    if input.name.trim().is_empty() { return (StatusCode::BAD_REQUEST, Json(Message { message: "policy name is required".into() })).into_response(); }
    let mut s = state.store.write().await;
    let project_id = s.projects.first().map(|p| p.id).unwrap();
    let version = s.policies.iter().map(|p| p.version).max().unwrap_or(0) + 1;
    let p = Policy { id: Uuid::new_v4(), project_id, name: input.name.trim().into(), mode: input.mode.trim().into(), version, status: "active".into(), created_at: now() };
    s.policies.push(p.clone());
    record(&mut s, "operator", "policy.created", "policy", p.id.to_string(), "success");
    persist(&state, &s);
    Json(p).into_response()
}

async fn nodes(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(r) = authorize(&state, &headers).await { return r; }
    Json(state.store.read().await.nodes.clone()).into_response()
}

async fn audit(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(r) = authorize(&state, &headers).await { return r; }
    Json(state.store.read().await.audit.clone()).into_response()
}

async fn signup(State(state): State<AppState>, Json(input): Json<Credentials>) -> Response {
    let email = input.email.trim().to_ascii_lowercase();
    if !email.contains('@') || input.password.len() < 15 {
        return (StatusCode::BAD_REQUEST, Json(Message { message: "Use a valid email and a passphrase of at least 15 characters.".into() })).into_response();
    }
    let mut s = state.store.write().await;
    if s.users.iter().any(|u| u.email == email) {
        return (StatusCode::CONFLICT, Json(Message { message: "An account with that email already exists.".into() })).into_response();
    }
    let salt = SaltString::generate(&mut argon2::password_hash::rand_core::OsRng);
    let hash = match Argon2::default().hash_password(input.password.as_bytes(), &salt) {
        Ok(h) => h.to_string(),
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Message { message: "Password hashing failed.".into() })).into_response(),
    };
    let user = User { id: Uuid::new_v4(), email: email.clone(), password_hash: hash, created_at: now() };
    s.users.push(user.clone());
    record(&mut s, "signup", "user.created", "user", user.id.to_string(), "success");
    persist(&state, &s);
    drop(s);
    issue_session(&state, user).await
}

async fn login(State(state): State<AppState>, Json(input): Json<Credentials>) -> Response {
    let email = input.email.trim().to_ascii_lowercase();
    let s = state.store.read().await;
    let user = match s.users.iter().find(|u| u.email == email).cloned() {
        Some(u) => u,
        None => return (StatusCode::UNAUTHORIZED, Json(Message { message: "Invalid credentials.".into() })).into_response(),
    };
    let parsed = match PasswordHash::new(&user.password_hash) {
        Ok(p) => p,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(Message { message: "Credential store is invalid.".into() })).into_response(),
    };
    if Argon2::default().verify_password(input.password.as_bytes(), &parsed).is_err() {
        return (StatusCode::UNAUTHORIZED, Json(Message { message: "Invalid credentials.".into() })).into_response();
    }
    drop(s);
    issue_session(&state, user).await
}

async fn issue_session(state: &AppState, user: User) -> Response {
    let raw = format!("{}{}", Uuid::new_v4(), Uuid::new_v4());
    let hash = hash_token(&raw);
    let session = Session { id: Uuid::new_v4(), user_id: user.id, verifier_hash: hash, created_at: now(), expires_at: now() + 604800 };
    let mut s = state.store.write().await;
    s.sessions.retain(|x| x.expires_at > now());
    s.sessions.push(session);
    record(&mut s, "auth", "auth.session_created", "user", user.id.to_string(), "success");
    persist(state, &s);
    let secure = if state.secure_cookies { "; Secure" } else { "" };
    let cookie = format!("proxima_session={raw}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800{secure}");
    let mut headers = HeaderMap::new();
    headers.insert(header::SET_COOKIE, cookie.parse().unwrap());
    (headers, Json(AuthResponse { user_id: user.id, email: user.email })).into_response()
}

async fn logout(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Some(token) = cookie(&headers, "proxima_session") {
        let mut s = state.store.write().await;
        s.sessions.retain(|x| x.verifier_hash != hash_token(&token));
        record(&mut s, "auth", "auth.logout", "session", "current".into(), "success");
        persist(&state, &s);
    }
    let secure = if state.secure_cookies { "; Secure" } else { "" };
    let cookie = format!("proxima_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0{secure}");
    let mut h = HeaderMap::new();
    h.insert(header::SET_COOKIE, cookie.parse().unwrap());
    (h, Json(Message { message: "signed out".into() })).into_response()
}

async fn me(State(state): State<AppState>, headers: HeaderMap) -> Response {
    match session_user(&state, &headers).await {
        Some(u) => Json(AuthResponse { user_id: u.id, email: u.email }).into_response(),
        None => (StatusCode::UNAUTHORIZED, Json(Message { message: "not authenticated".into() })).into_response(),
    }
}

async fn authorize(state: &AppState, headers: &HeaderMap) -> Result<(), Response> {
    if let Some(key) = &state.api_key {
        let expected = format!("Bearer {key}");
        if headers.get(header::AUTHORIZATION).and_then(|v| v.to_str().ok()) == Some(expected.as_str()) { return Ok(()); }
    }
    if session_user(state, headers).await.is_some() { return Ok(()); }
    if state.api_key.is_none() && env::var("PROXIMA_CONTROL_PLANE_LOCAL_MODE").unwrap_or_else(|_| "true".into()) == "true" { return Ok(()); }
    Err((StatusCode::UNAUTHORIZED, Json(Message { message: "authentication required".into() })).into_response())
}

async fn session_user(state: &AppState, headers: &HeaderMap) -> Option<User> {
    let token = cookie(headers, "proxima_session")?;
    let hash = hash_token(&token);
    let s = state.store.read().await;
    let session = s.sessions.iter().find(|x| x.verifier_hash == hash && x.expires_at > now())?;
    s.users.iter().find(|u| u.id == session.user_id).cloned()
}

fn cookie(headers: &HeaderMap, name: &str) -> Option<String> {
    let raw = headers.get(header::COOKIE)?.to_str().ok()?;
    raw.split(';').map(str::trim).find_map(|part| {
        let (k, v) = part.split_once('=')?;
        (k == name).then(|| v.to_string())
    })
}
fn hash_token(value: &str) -> String { format!("{:x}", Sha256::digest(value.as_bytes())) }
fn record(s: &mut Store, actor: &str, action: &str, resource: &str, resource_id: String, outcome: &str) {
    s.audit.push(AuditEvent { id: Uuid::new_v4(), actor: actor.into(), action: action.into(), resource: resource.into(), resource_id, outcome: outcome.into(), created_at: now() });
    if s.audit.len() > 5000 { let drain = s.audit.len() - 5000; s.audit.drain(0..drain); }
}
fn persist(state: &AppState, store: &Store) {
    if let Ok(json) = serde_json::to_vec_pretty(store) {
        let tmp = state.path.with_extension("tmp");
        if fs::write(&tmp, json).is_ok() { let _ = fs::rename(tmp, &state.path); }
    }
}
fn load_store(path: &PathBuf) -> Result<Store, Box<dyn std::error::Error>> {
    if path.exists() { return Ok(serde_json::from_slice(&fs::read(path)?)?); }
    let store = Store::default();
    if let Some(parent) = path.parent() { if !parent.as_os_str().is_empty() { fs::create_dir_all(parent)?; } }
    fs::write(path, serde_json::to_vec_pretty(&store)?)?;
    Ok(store)
}
fn now() -> u64 { SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() }

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn token_hash_is_stable() { assert_eq!(hash_token("abc"), hash_token("abc")); assert_ne!(hash_token("abc"), hash_token("def")); }
    #[test] fn default_store_has_three_tenants() { assert_eq!(Store::default().tenants.len(), 3); }
}
