//! Low-allocation engine telemetry and Prometheus text exposition.
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};

#[derive(Debug, Default)]
pub struct EngineMetrics {
    active_connections: AtomicU64,
    accepted_connections: AtomicU64,
    rejected_connections: AtomicU64,
    completed_connections: AtomicU64,
    failed_connections: AtomicU64,
    client_bytes_total: AtomicU64,
    upstream_bytes_total: AtomicU64,
    unauthorized_violations: AtomicU64,
    breaker_trips: AtomicU64,
    breaker_open: AtomicBool,
}

impl EngineMetrics {
    pub fn connection_started(&self) { self.accepted_connections.fetch_add(1, Ordering::Relaxed); self.active_connections.fetch_add(1, Ordering::Relaxed); }
    pub fn connection_finished(&self, failed: bool, client_bytes: u64, upstream_bytes: u64) {
        self.active_connections.fetch_sub(1, Ordering::Relaxed);
        self.completed_connections.fetch_add(1, Ordering::Relaxed);
        if failed { self.failed_connections.fetch_add(1, Ordering::Relaxed); }
        self.client_bytes_total.fetch_add(client_bytes, Ordering::Relaxed);
        self.upstream_bytes_total.fetch_add(upstream_bytes, Ordering::Relaxed);
    }
    pub fn connection_rejected(&self) { self.rejected_connections.fetch_add(1, Ordering::Relaxed); }
    pub fn unauthorized_violation(&self) { self.unauthorized_violations.fetch_add(1, Ordering::Relaxed); }
    pub fn trip_breaker(&self) -> bool {
        let changed = !self.breaker_open.swap(true, Ordering::AcqRel);
        if changed { self.breaker_trips.fetch_add(1, Ordering::Relaxed); }
        changed
    }
    pub fn reset_breaker(&self) { self.breaker_open.store(false, Ordering::Release); }
    pub fn breaker_is_open(&self) -> bool { self.breaker_open.load(Ordering::Acquire) }
    pub fn prometheus(&self) -> String {
        let values = [
            ("proxima_active_connections", self.active_connections.load(Ordering::Relaxed)),
            ("proxima_accepted_connections_total", self.accepted_connections.load(Ordering::Relaxed)),
            ("proxima_rejected_connections_total", self.rejected_connections.load(Ordering::Relaxed)),
            ("proxima_completed_connections_total", self.completed_connections.load(Ordering::Relaxed)),
            ("proxima_failed_connections_total", self.failed_connections.load(Ordering::Relaxed)),
            ("proxima_client_bytes_total", self.client_bytes_total.load(Ordering::Relaxed)),
            ("proxima_upstream_bytes_total", self.upstream_bytes_total.load(Ordering::Relaxed)),
            ("proxima_unauthorized_violations_total", self.unauthorized_violations.load(Ordering::Relaxed)),
            ("proxima_breaker_trips_total", self.breaker_trips.load(Ordering::Relaxed)),
        ];
        let mut output = String::from("# HELP proxima_active_connections Current active PostgreSQL proxy connections.\n# TYPE proxima_active_connections gauge\n");
        output.push_str(&format!("proxima_active_connections {}\n", values[0].1));
        for (name, value) in values.iter().skip(1) {
            output.push_str(&format!("# TYPE {name} counter\n{name} {value}\n"));
        }
        output.push_str("# HELP proxima_breaker_open Whether the security circuit breaker is open.\n# TYPE proxima_breaker_open gauge\n");
        output.push_str(&format!("proxima_breaker_open {}\n", u8::from(self.breaker_is_open())));
        output
    }
}

#[cfg(test)]
mod tests {
    use super::EngineMetrics;
    #[test]
    fn connection_lifecycle_is_counted() {
        let metrics = EngineMetrics::default();
        metrics.connection_started();
        metrics.connection_finished(false, 12, 20);
        let text = metrics.prometheus();
        assert!(text.contains("proxima_active_connections 0"));
        assert!(text.contains("proxima_client_bytes_total 12"));
        assert!(text.contains("proxima_upstream_bytes_total 20"));
    }
    #[test]
    fn breaker_is_idempotent_and_observable() {
        let metrics = EngineMetrics::default();
        assert!(!metrics.breaker_is_open());
        assert!(metrics.trip_breaker());
        assert!(!metrics.trip_breaker());
        assert!(metrics.prometheus().contains("proxima_breaker_trips_total 1"));
        metrics.reset_breaker();
        assert!(!metrics.breaker_is_open());
    }
}

/// Serve the metrics endpoint on a dedicated listener. Keep this address private
/// or protect it with the deployment's network policy.
pub async fn serve(addr: std::net::SocketAddr, metrics: std::sync::Arc<EngineMetrics>) -> std::io::Result<()> {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;
    let listener = TcpListener::bind(addr).await?;
    loop {
        let (mut stream, _) = listener.accept().await?;
        let metrics = metrics.clone();
        tokio::spawn(async move {
            let mut request = [0u8; 2048];
            let n = match tokio::time::timeout(std::time::Duration::from_secs(2), stream.read(&mut request)).await {
                Ok(Ok(n)) => n,
                _ => return,
            };
            let first_line = std::str::from_utf8(&request[..n]).unwrap_or("").lines().next().unwrap_or("");
            let (status, body, content_type) = if first_line.starts_with("GET /metrics ") {
                ("200 OK", metrics.prometheus(), "text/plain; version=0.0.4; charset=utf-8")
            } else if first_line.starts_with("GET /health ") {
                ("200 OK", "ok\n".to_string(), "text/plain; charset=utf-8")
            } else {
                ("404 Not Found", "not found\n".to_string(), "text/plain; charset=utf-8")
            };
            let response = format!("HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\nX-Content-Type-Options: nosniff\r\n\r\n{body}", body.len());
            let _ = stream.write_all(response.as_bytes()).await;
            let _ = stream.shutdown().await;
        });
    }
}
