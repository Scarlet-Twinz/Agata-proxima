//! Low-allocation process telemetry and Prometheus exposition for the Proxima data plane.
use std::io;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

#[derive(Debug, Default)]
pub struct EngineMetrics {
    active_connections: AtomicU64,
    accepted_connections: AtomicU64,
    rejected_connections: AtomicU64,
    tenant_auth_failures: AtomicU64,
    protocol_violations: AtomicU64,
    connection_duration_micros: AtomicU64,
    closed_connections: AtomicU64,
}

pub struct ConnectionGuard {
    metrics: Arc<EngineMetrics>,
    started: std::time::Instant,
}

impl Drop for ConnectionGuard {
    fn drop(&mut self) {
        self.metrics.active_connections.fetch_sub(1, Ordering::Relaxed);
        self.metrics.closed_connections.fetch_add(1, Ordering::Relaxed);
        self.metrics.connection_duration_micros.fetch_add(
            self.started.elapsed().as_micros().min(u64::MAX as u128) as u64,
            Ordering::Relaxed,
        );
    }
}

impl EngineMetrics {
    pub fn connection_started(self: &Arc<Self>) -> ConnectionGuard {
        self.active_connections.fetch_add(1, Ordering::Relaxed);
        self.accepted_connections.fetch_add(1, Ordering::Relaxed);
        ConnectionGuard { metrics: Arc::clone(self), started: std::time::Instant::now() }
    }

    pub fn connection_rejected(&self) {
        self.rejected_connections.fetch_add(1, Ordering::Relaxed);
    }

    pub fn tenant_auth_failure(&self) {
        self.tenant_auth_failures.fetch_add(1, Ordering::Relaxed);
    }

    pub fn protocol_violation(&self) {
        self.protocol_violations.fetch_add(1, Ordering::Relaxed);
    }

    pub fn render_prometheus(&self) -> String {
        let active = self.active_connections.load(Ordering::Relaxed);
        let accepted = self.accepted_connections.load(Ordering::Relaxed);
        let rejected = self.rejected_connections.load(Ordering::Relaxed);
        let auth_failures = self.tenant_auth_failures.load(Ordering::Relaxed);
        let violations = self.protocol_violations.load(Ordering::Relaxed);
        let closed = self.closed_connections.load(Ordering::Relaxed);
        let duration = self.connection_duration_micros.load(Ordering::Relaxed);
        format!(
            "# HELP proxima_active_connections Current active client connections.\n# TYPE proxima_active_connections gauge\nproxima_active_connections {active}\n\
             # HELP proxima_connections_accepted_total Accepted client connections.\n# TYPE proxima_connections_accepted_total counter\nproxima_connections_accepted_total {accepted}\n\
             # HELP proxima_connections_rejected_total Connections rejected by admission controls.\n# TYPE proxima_connections_rejected_total counter\nproxima_connections_rejected_total {rejected}\n\
             # HELP proxima_tenant_auth_failures_total Tenant authentication failures observed by the engine.\n# TYPE proxima_tenant_auth_failures_total counter\nproxima_tenant_auth_failures_total {auth_failures}\n\
             # HELP proxima_protocol_violations_total Malformed or unsupported PostgreSQL protocol frames.\n# TYPE proxima_protocol_violations_total counter\nproxima_protocol_violations_total {violations}\n\
             # HELP proxima_connections_closed_total Closed client connections.\n# TYPE proxima_connections_closed_total counter\nproxima_connections_closed_total {closed}\n\
             # HELP proxima_connection_duration_seconds_sum Sum of completed connection durations in seconds.\n# TYPE proxima_connection_duration_seconds_sum counter\nproxima_connection_duration_seconds_sum {:.6}\n",
            duration as f64 / 1_000_000.0
        )
    }
}

/// Serve metrics on a dedicated listener. Bind to loopback by default; do not expose
/// this endpoint publicly without an explicit network policy or authenticated proxy.
pub async fn serve_metrics(addr: std::net::SocketAddr, metrics: Arc<EngineMetrics>) -> io::Result<()> {
    let listener = TcpListener::bind(addr).await?;
    tracing::info!(%addr, "Proxima metrics listener ready");
    loop {
        let (mut stream, _) = listener.accept().await?;
        let metrics = Arc::clone(&metrics);
        tokio::spawn(async move {
            let mut request = [0u8; 2048];
            let size = match tokio::time::timeout(std::time::Duration::from_secs(2), stream.read(&mut request)).await {
                Ok(Ok(size)) => size,
                _ => return,
            };
            let line = String::from_utf8_lossy(&request[..size]);
            let path = line.split_whitespace().nth(1).unwrap_or("/");
            let (status, content_type, body) = if path == "/metrics" {
                ("200 OK", "text/plain; version=0.0.4; charset=utf-8", metrics.render_prometheus())
            } else if path == "/health" {
                ("200 OK", "text/plain; charset=utf-8", "ok\n".to_owned())
            } else {
                ("404 Not Found", "text/plain; charset=utf-8", "not found\n".to_owned())
            };
            let header = format!("HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n", body.len());
            let _ = stream.write_all(header.as_bytes()).await;
            let _ = stream.write_all(body.as_bytes()).await;
            let _ = stream.shutdown().await;
        });
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BreakerState { Closed, Open }

/// A monotonic, thread-safe fail-closed breaker. It never auto-resets: reopening requires
/// an explicit operator-controlled reset after the incident has been investigated.
#[derive(Debug, Default)]
pub struct SecurityBreaker {
    open: AtomicBool,
    trips: AtomicU64,
}

impl SecurityBreaker {
    pub fn trip(&self) -> bool {
        let was_open = self.open.swap(true, Ordering::SeqCst);
        if !was_open { self.trips.fetch_add(1, Ordering::Relaxed); }
        !was_open
    }
    pub fn is_open(&self) -> bool { self.open.load(Ordering::SeqCst) }
    pub fn state(&self) -> BreakerState {
        if self.is_open() { BreakerState::Open } else { BreakerState::Closed }
    }
    pub fn trip_count(&self) -> u64 { self.trips.load(Ordering::Relaxed) }
    pub fn reset_after_review(&self) { self.open.store(false, Ordering::SeqCst); }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn breaker_is_latched_and_counts_only_state_transitions() {
        let breaker = SecurityBreaker::default();
        assert_eq!(breaker.state(), BreakerState::Closed);
        assert!(breaker.trip());
        assert!(!breaker.trip());
        assert_eq!(breaker.trip_count(), 1);
        assert_eq!(breaker.state(), BreakerState::Open);
        breaker.reset_after_review();
        assert_eq!(breaker.state(), BreakerState::Closed);
    }

    #[test]
    fn prometheus_output_has_stable_metric_names() {
        let metrics = EngineMetrics::default();
        let rendered = metrics.render_prometheus();
        assert!(rendered.contains("proxima_active_connections 0"));
        assert!(rendered.contains("proxima_protocol_violations_total 0"));
    }

    #[tokio::test]
    async fn connection_guard_tracks_lifecycle() {
        let metrics = Arc::new(EngineMetrics::default());
        {
            let _guard = metrics.connection_started();
            assert!(metrics.render_prometheus().contains("proxima_active_connections 1"));
        }
        let rendered = metrics.render_prometheus();
        assert!(rendered.contains("proxima_active_connections 0"));
        assert!(rendered.contains("proxima_connections_closed_total 1"));
    }
}
