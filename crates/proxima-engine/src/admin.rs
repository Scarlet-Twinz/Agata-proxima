use axum::{extract::State, http::header, response::{Html, IntoResponse}, routing::get, Json, Router};
use serde::Serialize;
use std::sync::Arc;
use std::time::Instant;
use tokio::net::TcpListener;

#[derive(Default)]
pub struct RuntimeMetrics {
    started_at: std::sync::OnceLock<Instant>,
    active_connections: std::sync::atomic::AtomicUsize,
    total_connections: std::sync::atomic::AtomicUsize,
    rejected_connections: std::sync::atomic::AtomicUsize,
    tls_sessions: std::sync::atomic::AtomicUsize,
}

impl RuntimeMetrics {
    pub fn start(&self) {
        let _ = self.started_at.set(Instant::now());
    }

    pub fn connection_opened(&self, tls: bool) {
        self.active_connections
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        self.total_connections
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        if tls {
            self.tls_sessions
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        }
    }

    pub fn connection_closed(&self) {
        self.active_connections
            .fetch_sub(1, std::sync::atomic::Ordering::Relaxed);
    }

    pub fn rejected(&self) {
        self.rejected_connections
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    }
}

#[derive(Clone)]
pub struct AdminState {
    pub metrics: Arc<RuntimeMetrics>,
    pub tls_active: bool,
    pub tenant_enforcement: bool,
    pub upstream_tls: bool,
    pub upstream_addr: String,
}

#[derive(Serialize)]
struct Status {
    service: &'static str,
    status: &'static str,
    tenant_enforcement: bool,
    tls_active: bool,
    upstream_tls: bool,
    upstream: String,
    active_connections: usize,
    total_connections: usize,
    rejected_connections: usize,
    tls_sessions: usize,
    uptime_seconds: u64,
    verification: &'static str,
}

pub async fn serve(addr: std::net::SocketAddr, state: AdminState) -> std::io::Result<()> {
    let app = Router::new()
        .route("/", get(index))
        .route("/assets/proxima-ap-mark.svg", get(mark))
        .route("/api/health", get(health))
        .route("/api/status", get(status))
        .with_state(state);

    let listener = TcpListener::bind(addr).await?;
    tracing::info!(admin = %addr, "Proxima dashboard listening");
    axum::serve(listener, app)
        .await
        .map_err(|e| std::io::Error::other(e.to_string()))
}

async fn index() -> Html<&'static str> {
    Html(include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../dashboard/index.html"
    )))
}

async fn mark() -> impl IntoResponse {
    (
        [(header::CONTENT_TYPE, "image/svg+xml")],
        include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../dashboard/assets/proxima-ap-mark.svg"
        )),
    )
}

async fn health() -> &'static str {
    "ok"
}

async fn status(State(state): State<AdminState>) -> Json<Status> {
    let uptime_seconds = state
        .metrics
        .started_at
        .get()
        .map(|start| start.elapsed().as_secs())
        .unwrap_or(0);

    Json(Status {
        service: "agata-proxima",
        status: "healthy",
        tenant_enforcement: state.tenant_enforcement,
        tls_active: state.tls_active,
        upstream_tls: state.upstream_tls,
        upstream: state.upstream_addr.clone(),
        active_connections: state
            .metrics
            .active_connections
            .load(std::sync::atomic::Ordering::Relaxed),
        total_connections: state
            .metrics
            .total_connections
            .load(std::sync::atomic::Ordering::Relaxed),
        rejected_connections: state
            .metrics
            .rejected_connections
            .load(std::sync::atomic::Ordering::Relaxed),
        tls_sessions: state
            .metrics
            .tls_sessions
            .load(std::sync::atomic::Ordering::Relaxed),
        uptime_seconds,
        verification: "verification gates are CI-backed",
    })
}
