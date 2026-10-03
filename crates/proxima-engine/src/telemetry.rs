use std::io;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tracing::error;

#[derive(Clone)]
pub struct Telemetry {
    inner: Arc<Metrics>,
}

struct Metrics {
    accepted: AtomicU64,
    active: AtomicU64,
    rejected: AtomicU64,
    tls_sessions: AtomicU64,
    authenticated: AtomicU64,
    auth_failures: AtomicU64,
    upstream_failures: AtomicU64,
}

impl Telemetry {
    pub fn new() -> Self {
        Self { inner: Arc::new(Metrics {
            accepted: AtomicU64::new(0),
            active: AtomicU64::new(0),
            rejected: AtomicU64::new(0),
            tls_sessions: AtomicU64::new(0),
            authenticated: AtomicU64::new(0),
            auth_failures: AtomicU64::new(0),
            upstream_failures: AtomicU64::new(0),
        })}
    }

    pub fn accepted(&self) -> ActiveConnection {
        self.inner.accepted.fetch_add(1, Ordering::Relaxed);
        self.inner.active.fetch_add(1, Ordering::Relaxed);
        ActiveConnection { metrics: self.clone() }
    }

    pub fn rejected(&self) { self.inner.rejected.fetch_add(1, Ordering::Relaxed); }
    pub fn tls_session(&self) { self.inner.tls_sessions.fetch_add(1, Ordering::Relaxed); }
    pub fn authenticated(&self) { self.inner.authenticated.fetch_add(1, Ordering::Relaxed); }
    pub fn auth_failure(&self) { self.inner.auth_failures.fetch_add(1, Ordering::Relaxed); }
    pub fn upstream_failure(&self) { self.inner.upstream_failures.fetch_add(1, Ordering::Relaxed); }

    fn json(&self, tls: bool, upstream_tls: bool, enforcement: bool) -> String {
        format!(
            "{{\"status\":\"ok\",\"engine\":\"healthy\",\"postgresql\":\"configured\",\"tls\":{},\"upstream_tls\":{},\"tenant_enforcement\":{},\"active_connections\":{},\"accepted_connections\":{},\"rejected_connections\":{},\"tls_sessions\":{},\"authenticated_sessions\":{},\"auth_failures\":{},\"upstream_failures\":{}}}",
            tls,
            upstream_tls,
            enforcement,
            self.inner.active.load(Ordering::Relaxed),
            self.inner.accepted.load(Ordering::Relaxed),
            self.inner.rejected.load(Ordering::Relaxed),
            self.inner.tls_sessions.load(Ordering::Relaxed),
            self.inner.authenticated.load(Ordering::Relaxed),
            self.inner.auth_failures.load(Ordering::Relaxed),
            self.inner.upstream_failures.load(Ordering::Relaxed),
        )
    }
}

pub struct ActiveConnection { metrics: Telemetry }
impl Drop for ActiveConnection {
    fn drop(&mut self) { self.metrics.inner.active.fetch_sub(1, Ordering::Relaxed); }
}

pub async fn serve(
    addr: SocketAddr,
    telemetry: Telemetry,
    tls: bool,
    upstream_tls: bool,
    enforcement: bool,
) -> io::Result<()> {
    let listener = TcpListener::bind(addr).await?;
    tracing::info!(listen=%addr, "Proxima telemetry endpoint listening");
    loop {
        let (mut stream, _) = listener.accept().await?;
        let metrics = telemetry.clone();
        tokio::spawn(async move {
            if let Err(err) = handle(&mut stream, &metrics, tls, upstream_tls, enforcement).await {
                error!(error=%err, "telemetry request failed");
            }
        });
    }
}

async fn handle(
    stream: &mut tokio::net::TcpStream,
    telemetry: &Telemetry,
    tls: bool,
    upstream_tls: bool,
    enforcement: bool,
) -> io::Result<()> {
    let mut buf = [0u8; 2048];
    let n = stream.read(&mut buf).await?;
    let request = String::from_utf8_lossy(&buf[..n]);
    let path = request.lines().next().and_then(|line| line.split_whitespace().nth(1)).unwrap_or("/");
    let (status, body, content_type): (&str, String, &str) = match path {
        "/healthz" => ("200 OK", "{\"status\":\"ok\"}".to_owned(), "application/json"),
        "/readyz" => ("200 OK", "{\"status\":\"ready\"}".to_owned(), "application/json"),
        "/metrics" => ("200 OK", telemetry.json(tls, upstream_tls, enforcement), "application/json"),
        _ => ("404 Not Found", "{\"status\":\"not_found\"}".to_owned(), "application/json"),
    };
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nAccess-Control-Allow-Origin: *\r\nCache-Control: no-store\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    stream.write_all(response.as_bytes()).await
}
