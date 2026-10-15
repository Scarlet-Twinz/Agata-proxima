//! Low-overhead engine telemetry and fail-closed abuse circuit breaker.
//!
//! The exporter is intentionally a separate, loopback-bound HTTP listener. It
//! must not share the PostgreSQL wire listener or expose tenant/customer data.
use std::{
    collections::HashMap,
    io,
    net::{IpAddr, SocketAddr},
    sync::{Arc, Mutex},
    sync::atomic::{AtomicBool, AtomicU64, Ordering},
    time::{Duration, Instant},
};
use tokio::{io::{AsyncReadExt, AsyncWriteExt}, net::TcpListener, time::timeout};
use tracing::{info, warn};

const MAX_HTTP_REQUEST: usize = 4096;
const DEFAULT_METRICS_ADDR: &str = "127.0.0.1:9090";

#[derive(Default)]
pub struct EngineMetrics {
    active_connections: AtomicU64,
    accepted_connections: AtomicU64,
    rejected_connections: AtomicU64,
    authenticated_tenant_sessions: AtomicU64,
    blocked_tenant_violations: AtomicU64,
    protocol_errors: AtomicU64,
    upstream_errors: AtomicU64,
    queryless_session_duration_micros: AtomicU64,
    circuit_breaker_trips: AtomicU64,
    tls_sessions: AtomicU64,
    tenant_enforcement_enabled: AtomicBool,
    tls_termination_enabled: AtomicBool,
    breaker_tripped: AtomicBool,
}
pub type SharedMetrics = Arc<EngineMetrics>;

impl EngineMetrics {
    pub fn shared() -> SharedMetrics { Arc::new(Self::default()) }
    pub fn connection_opened(&self) { self.active_connections.fetch_add(1, Ordering::Relaxed); self.accepted_connections.fetch_add(1, Ordering::Relaxed); }
    pub fn connection_closed(&self) { let _ = self.active_connections.fetch_update(Ordering::Relaxed, Ordering::Relaxed, |n| Some(n.saturating_sub(1))); }
    pub fn connection_rejected(&self) { self.rejected_connections.fetch_add(1, Ordering::Relaxed); }
    pub fn tenant_authenticated(&self) { self.authenticated_tenant_sessions.fetch_add(1, Ordering::Relaxed); }
    pub fn tenant_violation_blocked(&self) { self.blocked_tenant_violations.fetch_add(1, Ordering::Relaxed); }
    pub fn protocol_error(&self) { self.protocol_errors.fetch_add(1, Ordering::Relaxed); }
    pub fn upstream_error(&self) { self.upstream_errors.fetch_add(1, Ordering::Relaxed); }
    pub fn tls_session(&self) { self.tls_sessions.fetch_add(1, Ordering::Relaxed); }
    pub fn set_tenant_enforcement(&self, enabled: bool) { self.tenant_enforcement_enabled.store(enabled, Ordering::Relaxed); }
    pub fn set_tls_termination(&self, enabled: bool) { self.tls_termination_enabled.store(enabled, Ordering::Relaxed); }
    pub fn set_breaker_tripped(&self, enabled: bool) {
        let was_tripped = self.breaker_tripped.swap(enabled, Ordering::SeqCst);
        if enabled && !was_tripped { self.circuit_breaker_trips.fetch_add(1, Ordering::Relaxed); }
    }

    pub fn prometheus_text(&self) -> String {
        fn line(out: &mut String, name: &str, help: &str, kind: &str, value: u64) {
            out.push_str(&format!("# HELP {name} {help}\n# TYPE {name} {kind}\n{name} {value}\n"));
        }
        let mut out = String::with_capacity(1600);
        line(&mut out, "proxima_engine_active_connections", "Currently active client sessions.", "gauge", self.active_connections.load(Ordering::Relaxed));
        line(&mut out, "proxima_engine_accepted_connections_total", "Accepted client sessions.", "counter", self.accepted_connections.load(Ordering::Relaxed));
        line(&mut out, "proxima_engine_rejected_connections_total", "Connections rejected by capacity or policy.", "counter", self.rejected_connections.load(Ordering::Relaxed));
        line(&mut out, "proxima_engine_authenticated_tenant_sessions_total", "Sessions authenticated with a tenant token.", "counter", self.authenticated_tenant_sessions.load(Ordering::Relaxed));
        line(&mut out, "proxima_engine_blocked_tenant_violations_total", "Tenant-context violations blocked by the engine.", "counter", self.blocked_tenant_violations.load(Ordering::Relaxed));
        line(&mut out, "proxima_engine_protocol_errors_total", "Malformed or unsupported PostgreSQL protocol sessions.", "counter", self.protocol_errors.load(Ordering::Relaxed));
        line(&mut out, "proxima_engine_upstream_errors_total", "Upstream connection or TLS failures.", "counter", self.upstream_errors.load(Ordering::Relaxed));
        line(&mut out, "proxima_engine_circuit_breaker_trips_total", "Circuit breaker transitions into the tripped state.", "counter", self.circuit_breaker_trips.load(Ordering::Relaxed));
        line(&mut out, "proxima_engine_tls_sessions_total", "Sessions accepted with client TLS.", "counter", self.tls_sessions.load(Ordering::Relaxed));
        out.push_str(&format!("# HELP proxima_engine_tenant_enforcement_enabled Whether tenant token enforcement is configured.\n# TYPE proxima_engine_tenant_enforcement_enabled gauge\nproxima_engine_tenant_enforcement_enabled {}\n", self.tenant_enforcement_enabled.load(Ordering::Relaxed) as u8));
        out.push_str(&format!("# HELP proxima_engine_tls_termination_enabled Whether engine-side client TLS termination is configured.\n# TYPE proxima_engine_tls_termination_enabled gauge\nproxima_engine_tls_termination_enabled {}\n", self.tls_termination_enabled.load(Ordering::Relaxed) as u8));
        out.push_str(&format!("# HELP proxima_engine_breaker_tripped Whether the configured breaker is currently tripped.\n# TYPE proxima_engine_breaker_tripped gauge\nproxima_engine_breaker_tripped {}\n", self.breaker_tripped.load(Ordering::Relaxed) as u8));
        out
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BreakerDecision { Allow, RejectAndTrip, RejectWhileTripped }

#[derive(Debug)]
struct PeerState { failures: u32, window_started: Instant, tripped_until: Option<Instant> }

/// Per-source circuit breaker prevents one noisy source from tripping every
/// tenant. It rejects new sessions only; existing sessions are not interrupted.
pub struct SecurityBreaker {
    enabled: bool,
    threshold: u32,
    window: Duration,
    cooldown: Duration,
    peers: Mutex<HashMap<IpAddr, PeerState>>,
    metrics: SharedMetrics,
}
impl SecurityBreaker {
    pub fn from_env(metrics: SharedMetrics) -> io::Result<Self> {
        let enabled = std::env::var("PROXIMA_SECURITY_BREAKER").unwrap_or_else(|_| "fail-closed".into()) != "disabled";
        let threshold = std::env::var("PROXIMA_SECURITY_BREAKER_THRESHOLD").unwrap_or_else(|_| "8".into()).parse::<u32>().map_err(|e| io::Error::new(io::ErrorKind::InvalidInput, format!("invalid PROXIMA_SECURITY_BREAKER_THRESHOLD: {e}")))?;
        let window_seconds = std::env::var("PROXIMA_SECURITY_BREAKER_WINDOW_SECONDS").unwrap_or_else(|_| "60".into()).parse::<u64>().map_err(|e| io::Error::new(io::ErrorKind::InvalidInput, format!("invalid PROXIMA_SECURITY_BREAKER_WINDOW_SECONDS: {e}")))?;
        let cooldown_seconds = std::env::var("PROXIMA_SECURITY_BREAKER_COOLDOWN_SECONDS").unwrap_or_else(|_| "60".into()).parse::<u64>().map_err(|e| io::Error::new(io::ErrorKind::InvalidInput, format!("invalid PROXIMA_SECURITY_BREAKER_COOLDOWN_SECONDS: {e}")))?;
        if threshold == 0 || window_seconds == 0 || cooldown_seconds == 0 { return Err(io::Error::new(io::ErrorKind::InvalidInput, "breaker threshold, window, and cooldown must be greater than zero")); }
        Ok(Self { enabled, threshold, window: Duration::from_secs(window_seconds), cooldown: Duration::from_secs(cooldown_seconds), peers: Mutex::new(HashMap::new()), metrics })
    }
    pub fn allow(&self, peer: IpAddr) -> BreakerDecision {
        if !self.enabled { return BreakerDecision::Allow; }
        let Ok(mut peers) = self.peers.lock() else { warn!("breaker state lock poisoned; failing closed"); return BreakerDecision::RejectWhileTripped; };
        let now = Instant::now();
        if let Some(state) = peers.get_mut(&peer) {
            if let Some(until) = state.tripped_until {
                if now < until { return BreakerDecision::RejectWhileTripped; }
                state.tripped_until = None; state.failures = 0; state.window_started = now;
            }
            if now.duration_since(state.window_started) > self.window { state.failures = 0; state.window_started = now; }
        }
        BreakerDecision::Allow
    }
    pub fn record_malformed(&self, peer: IpAddr) -> BreakerDecision {
        if !self.enabled { return BreakerDecision::Allow; }
        let Ok(mut peers) = self.peers.lock() else { self.metrics.set_breaker_tripped(true); return BreakerDecision::RejectAndTrip; };
        let now = Instant::now();
        let state = peers.entry(peer).or_insert(PeerState { failures: 0, window_started: now, tripped_until: None });
        if now.duration_since(state.window_started) > self.window { state.failures = 0; state.window_started = now; state.tripped_until = None; }
        if state.tripped_until.is_some_and(|until| now < until) { return BreakerDecision::RejectWhileTripped; }
        state.failures = state.failures.saturating_add(1);
        if state.failures >= self.threshold {
            state.tripped_until = Some(now + self.cooldown);
            self.metrics.set_breaker_tripped(true);
            warn!(source_ip = %peer, failures = state.failures, "security breaker tripped for source");
            BreakerDecision::RejectAndTrip
        } else { BreakerDecision::Allow }
    }
}

/// Start a small, read-only Prometheus text endpoint. Binding defaults to
/// loopback; non-loopback exposure must be an explicit operator decision.
pub async fn serve_metrics(metrics: SharedMetrics) -> io::Result<()> {
    let addr: SocketAddr = std::env::var("PROXIMA_METRICS_LISTEN_ADDR")
        .unwrap_or_else(|_| DEFAULT_METRICS_ADDR.into()).parse()
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidInput, format!("invalid PROXIMA_METRICS_LISTEN_ADDR: {e}")))?;
    let listener = TcpListener::bind(addr).await?;
    info!(%addr, "Prometheus metrics endpoint listening");
    loop {
        let (mut stream, _) = listener.accept().await?;
        let metrics = Arc::clone(&metrics);
        tokio::spawn(async move {
            let mut request = vec![0u8; MAX_HTTP_REQUEST];
            let read = timeout(Duration::from_secs(2), stream.read(&mut request)).await;
            let valid = matches!(read, Ok(Ok(n)) if n > 0 && request[..n].starts_with(b"GET /metrics "));
            let (status, content_type, body) = if valid {
                ("200 OK", "text/plain; version=0.0.4; charset=utf-8", metrics.prometheus_text())
            } else {
                ("404 Not Found", "text/plain; charset=utf-8", "not found\n".to_owned())
            };
            let response = format!("HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\nX-Content-Type-Options: nosniff\r\n\r\n{body}", body.len());
            let _ = timeout(Duration::from_secs(2), async { stream.write_all(response.as_bytes()).await }).await;
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::{IpAddr, Ipv4Addr};

    #[test]
    fn prometheus_metrics_have_stable_names_and_no_tenant_labels() {
        let metrics = EngineMetrics::shared();
        metrics.connection_opened();
        metrics.tenant_authenticated();
        let text = metrics.prometheus_text();
        assert!(text.contains("proxima_engine_active_connections 1"));
        assert!(text.contains("proxima_engine_authenticated_tenant_sessions_total 1"));
        assert!(!text.contains("tenant_id="));
        metrics.connection_closed();
        assert!(metrics.prometheus_text().contains("proxima_engine_active_connections 0"));
    }

    #[test]
    fn breaker_trips_per_peer_and_does_not_cross_trip_other_peers() {
        let metrics = EngineMetrics::shared();
        let breaker = SecurityBreaker { enabled: true, threshold: 2, window: Duration::from_secs(60), cooldown: Duration::from_secs(60), peers: Mutex::new(HashMap::new()), metrics };
        let hostile = IpAddr::V4(Ipv4Addr::new(192, 0, 2, 1));
        let healthy = IpAddr::V4(Ipv4Addr::new(192, 0, 2, 2));
        assert_eq!(breaker.record_malformed(hostile), BreakerDecision::Allow);
        assert_eq!(breaker.record_malformed(hostile), BreakerDecision::RejectAndTrip);
        assert_eq!(breaker.allow(hostile), BreakerDecision::RejectWhileTripped);
        assert_eq!(breaker.allow(healthy), BreakerDecision::Allow);
    }

    #[test]
    fn disabled_breaker_does_not_reject_sources() {
        let metrics = EngineMetrics::shared();
        let breaker = SecurityBreaker { enabled: false, threshold: 1, window: Duration::from_secs(1), cooldown: Duration::from_secs(1), peers: Mutex::new(HashMap::new()), metrics };
        assert_eq!(breaker.record_malformed(IpAddr::V4(Ipv4Addr::LOCALHOST)), BreakerDecision::Allow);
    }
}
