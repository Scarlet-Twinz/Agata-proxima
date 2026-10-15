//! Low-allocation engine telemetry and Prometheus text exposition.
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use std::io;
use std::net::SocketAddr;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

#[derive(Debug, Default)]
pub struct EngineMetrics {
    active_connections: AtomicU64,
    total_processed_queries: AtomicU64,
    authenticated_tenant_sessions: AtomicU64,
    accepted_connections: AtomicU64,
    rejected_connections: AtomicU64,
    completed_connections: AtomicU64,
    failed_connections: AtomicU64,
    client_bytes_total: AtomicU64,
    upstream_bytes_total: AtomicU64,
    unauthorized_violations: AtomicU64,
    breaker_trips: AtomicU64,
    breaker_open: AtomicBool,
    simple_query_latency_count: AtomicU64,
    simple_query_latency_sum_nanos: AtomicU64,
    simple_query_latency_buckets: [AtomicU64; 9],
}

impl EngineMetrics {
    /// Record an end-to-end simple-query round trip from the frontend Query
    /// message to PostgreSQL's ReadyForQuery response.
    pub fn observe_simple_query_latency(&self, elapsed: Duration) {
        const BUCKETS_NANOS: [u64; 9] = [
            1_000_000,
            5_000_000,
            10_000_000,
            25_000_000,
            50_000_000,
            100_000_000,
            250_000_000,
            500_000_000,
            1_000_000_000,
        ];
        let nanos = elapsed.as_nanos().min(u64::MAX as u128) as u64;
        self.simple_query_latency_count.fetch_add(1, Ordering::Relaxed);
        self.simple_query_latency_sum_nanos.fetch_add(nanos, Ordering::Relaxed);
        for (index, bound) in BUCKETS_NANOS.iter().enumerate() {
            if nanos <= *bound {
                self.simple_query_latency_buckets[index].fetch_add(1, Ordering::Relaxed);
            }
        }
    }

    pub fn query_processed(&self) {
        self.total_processed_queries.fetch_add(1, Ordering::Relaxed);
    }

    pub fn tenant_session_authenticated(&self) {
        self.authenticated_tenant_sessions.fetch_add(1, Ordering::Relaxed);
    }

    pub fn total_processed_queries(&self) -> u64 {
        self.total_processed_queries.load(Ordering::Relaxed)
    }

    pub fn authenticated_tenant_sessions(&self) -> u64 {
        self.authenticated_tenant_sessions.load(Ordering::Relaxed)
    }

    pub fn blocked_unauthorized_violations(&self) -> u64 {
        self.unauthorized_violations.load(Ordering::Relaxed)
    }

    pub fn connection_started(&self) {
        self.accepted_connections.fetch_add(1, Ordering::Relaxed);
        self.active_connections.fetch_add(1, Ordering::Relaxed);
    }

    pub fn connection_finished(
        &self,
        failed: bool,
        client_bytes: u64,
        upstream_bytes: u64,
    ) {
        self.active_connections.fetch_sub(1, Ordering::Relaxed);
        self.completed_connections.fetch_add(1, Ordering::Relaxed);
        if failed {
            self.failed_connections.fetch_add(1, Ordering::Relaxed);
        }
        self.client_bytes_total
            .fetch_add(client_bytes, Ordering::Relaxed);
        self.upstream_bytes_total
            .fetch_add(upstream_bytes, Ordering::Relaxed);
    }

    pub fn connection_rejected(&self) {
        self.rejected_connections.fetch_add(1, Ordering::Relaxed);
    }

    pub fn unauthorized_violation(&self) {
        self.unauthorized_violations
            .fetch_add(1, Ordering::Relaxed);
    }

    pub fn trip_breaker(&self) -> bool {
        let changed = !self.breaker_open.swap(true, Ordering::AcqRel);
        if changed {
            self.breaker_trips.fetch_add(1, Ordering::Relaxed);
        }
        changed
    }

    pub fn set_breaker_open(&self, open: bool) {
        self.breaker_open.store(open, Ordering::Release);
    }

    pub fn breaker_trip_event(&self) {
        self.breaker_trips.fetch_add(1, Ordering::Relaxed);
    }

    pub fn reset_breaker(&self) {
        self.breaker_open.store(false, Ordering::Release);
    }

    pub fn breaker_is_open(&self) -> bool {
        self.breaker_open.load(Ordering::Acquire)
    }

    pub fn prometheus(&self) -> String {
        let values = [
            (
                "proxima_active_connections",
                self.active_connections.load(Ordering::Relaxed),
            ),
            (
                "proxima_accepted_connections_total",
                self.accepted_connections.load(Ordering::Relaxed),
            ),
            (
                "proxima_rejected_connections_total",
                self.rejected_connections.load(Ordering::Relaxed),
            ),
            (
                "proxima_completed_connections_total",
                self.completed_connections.load(Ordering::Relaxed),
            ),
            (
                "proxima_failed_connections_total",
                self.failed_connections.load(Ordering::Relaxed),
            ),
            (
                "proxima_client_bytes_total",
                self.client_bytes_total.load(Ordering::Relaxed),
            ),
            (
                "proxima_upstream_bytes_total",
                self.upstream_bytes_total.load(Ordering::Relaxed),
            ),
            (
                "proxima_unauthorized_violations_total",
                self.unauthorized_violations.load(Ordering::Relaxed),
            ),
            (
                "proxima_breaker_trips_total",
                self.breaker_trips.load(Ordering::Relaxed),
            ),
        ];
        let mut output = String::from(
            "# HELP proxima_active_connections Current active PostgreSQL proxy connections.\n",
        );
        output.push_str("# TYPE proxima_active_connections gauge\n");
        output.push_str(&format!(
            "proxima_active_connections {}\n",
            values[0].1
        ));
        output.push_str("# HELP proxima_processed_queries_total PostgreSQL simple Query and extended Execute messages forwarded.\n");
        output.push_str("# TYPE proxima_processed_queries_total counter\n");
        output.push_str(&format!(
            "proxima_processed_queries_total {}\n",
            self.total_processed_queries()
        ));
        output.push_str("# HELP proxima_authenticated_tenant_sessions_total Established sessions with verified tenant context.\n");
        output.push_str("# TYPE proxima_authenticated_tenant_sessions_total counter\n");
        output.push_str(&format!(
            "proxima_authenticated_tenant_sessions_total {}\n",
            self.authenticated_tenant_sessions()
        ));
        const BUCKETS_MS: [u64; 9] = [1, 5, 10, 25, 50, 100, 250, 500, 1000];
        output.push_str("# HELP proxima_simple_query_latency_seconds End-to-end simple Query round-trip latency through Proxima.\n");
        output.push_str("# TYPE proxima_simple_query_latency_seconds histogram\n");
        for (index, bound) in BUCKETS_MS.iter().enumerate() {
            output.push_str(&format!(
                "proxima_simple_query_latency_seconds_bucket{{le=\\"{}\\"}} {}\n",
                bound,
                self.simple_query_latency_buckets[index].load(Ordering::Relaxed)
            ));
        }
        output.push_str(&format!(
            "proxima_simple_query_latency_seconds_bucket{{le=\\"+Inf\\"}} {}\n",
            self.simple_query_latency_count.load(Ordering::Relaxed)
        ));
        output.push_str(&format!(
            "proxima_simple_query_latency_seconds_sum {}\n",
            self.simple_query_latency_sum_nanos.load(Ordering::Relaxed) as f64 / 1_000_000_000.0
        ));
        output.push_str(&format!(
            "proxima_simple_query_latency_seconds_count {}\n",
            self.simple_query_latency_count.load(Ordering::Relaxed)
        ));
        for (name, value) in values.iter().skip(1) {
            output.push_str(&format!("# TYPE {name} counter\n{name} {value}\n"));
        }
        output.push_str(
            "# HELP proxima_breaker_open Whether the security circuit breaker is open.\n",
        );
        output.push_str("# TYPE proxima_breaker_open gauge\n");
        output.push_str(&format!(
            "proxima_breaker_open {}\n",
            u8::from(self.breaker_is_open())
        ));
        output
    }
}

/// Serve metrics on a dedicated listener. Keep this address private or protect
/// it with the deployment's network policy.
pub async fn serve(addr: SocketAddr, metrics: Arc<EngineMetrics>) -> io::Result<()> {
    let listener = TcpListener::bind(addr).await?;
    loop {
        let (mut stream, _) = listener.accept().await?;
        let metrics = metrics.clone();
        tokio::spawn(async move {
            let mut request = [0u8; 2048];
            let n = match tokio::time::timeout(Duration::from_secs(2), stream.read(&mut request))
                .await
            {
                Ok(Ok(n)) => n,
                _ => return,
            };
            let first_line = std::str::from_utf8(&request[..n])
                .unwrap_or("")
                .lines()
                .next()
                .unwrap_or("");
            let (status, body, content_type) = if first_line.starts_with("GET /metrics ") {
                (
                    "200 OK",
                    metrics.prometheus(),
                    "text/plain; version=0.0.4; charset=utf-8",
                )
            } else if first_line.starts_with("GET /health ") {
                ("200 OK", "ok\n".to_string(), "text/plain; charset=utf-8")
            } else {
                (
                    "404 Not Found",
                    "not found\n".to_string(),
                    "text/plain; charset=utf-8",
                )
            };
            let response = format!(
                "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\nX-Content-Type-Options: nosniff\r\n\r\n{body}",
                body.len()
            );
            let _ = stream.write_all(response.as_bytes()).await;
            let _ = stream.shutdown().await;
        });
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
        metrics.observe_simple_query_latency(Duration::from_millis(7));
        let text = metrics.prometheus();
        assert!(text.contains("proxima_active_connections 0"));
        assert!(text.contains("proxima_client_bytes_total 12"));
        assert!(text.contains("proxima_upstream_bytes_total 20"));
        assert!(text.contains("proxima_simple_query_latency_seconds_bucket{le=\"10\"} 1"));
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
