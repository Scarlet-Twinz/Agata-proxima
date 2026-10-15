//! Explicit fail-closed circuit-breaker policy.
use std::{
    collections::HashMap,
    io,
    net::IpAddr,
    sync::Mutex,
    time::{Duration, Instant},
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BreakerMode {
    Disabled,
    FailClosed,
}

impl BreakerMode {
    pub fn from_env() -> io::Result<Self> {
        let value = std::env::var("PROXIMA_SECURITY_BREAKER")
            .or_else(|_| std::env::var("PROXIMA_SECURITY_CIRCUIT_BREAKER"))
            .unwrap_or_else(|_| "fail-closed".to_string());
        match value.trim().to_ascii_lowercase().as_str() {
            "fail-closed" | "closed" | "on" | "true" => Ok(Self::FailClosed),
            "disabled" | "off" | "false" => Ok(Self::Disabled),
            other => Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                format!(
                    "invalid PROXIMA_SECURITY_BREAKER value {other:?}; expected fail-closed or disabled"
                ),
            )),
        }
    }

    pub fn reject_new_connections(self, tripped: bool) -> bool {
        matches!(self, Self::FailClosed) && tripped
    }
}

#[derive(Debug)]
struct PeerState {
    failures: u32,
    window_started: Instant,
    blocked_until: Option<Instant>,
}

#[derive(Debug)]
pub struct PeerCircuitBreaker {
    mode: BreakerMode,
    threshold: u32,
    failure_window: Duration,
    block_duration: Duration,
    peers: Mutex<HashMap<IpAddr, PeerState>>,
}

impl PeerCircuitBreaker {
    pub fn from_env() -> io::Result<Self> {
        let mode = BreakerMode::from_env()?;
        let threshold = std::env::var("PROXIMA_SECURITY_BREAKER_THRESHOLD")
            .unwrap_or_else(|_| "5".to_string())
            .parse::<u32>()
            .map_err(|error| {
                io::Error::new(
                    io::ErrorKind::InvalidInput,
                    format!("invalid PROXIMA_SECURITY_BREAKER_THRESHOLD: {error}"),
                )
            })?;
        if threshold == 0 {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "PROXIMA_SECURITY_BREAKER_THRESHOLD must be greater than zero",
            ));
        }

        let failure_window_secs = std::env::var("PROXIMA_SECURITY_BREAKER_WINDOW_SECS")
            .unwrap_or_else(|_| "60".to_string())
            .parse::<u64>()
            .map_err(|error| {
                io::Error::new(
                    io::ErrorKind::InvalidInput,
                    format!("invalid PROXIMA_SECURITY_BREAKER_WINDOW_SECS: {error}"),
                )
            })?;
        let block_duration_secs = std::env::var("PROXIMA_SECURITY_BREAKER_BLOCK_SECS")
            .unwrap_or_else(|_| "60".to_string())
            .parse::<u64>()
            .map_err(|error| {
                io::Error::new(
                    io::ErrorKind::InvalidInput,
                    format!("invalid PROXIMA_SECURITY_BREAKER_BLOCK_SECS: {error}"),
                )
            })?;
        if failure_window_secs == 0 || block_duration_secs == 0 {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "breaker window and block duration must be greater than zero",
            ));
        }

        Ok(Self {
            mode,
            threshold,
            failure_window: Duration::from_secs(failure_window_secs),
            block_duration: Duration::from_secs(block_duration_secs),
            peers: Mutex::new(HashMap::new()),
        })
    }

    pub fn is_blocked(&self, peer: IpAddr) -> bool {
        if matches!(self.mode, BreakerMode::Disabled) {
            return false;
        }
        let now = Instant::now();
        let Ok(mut peers) = self.peers.lock() else {
            return true;
        };
        if let Some(state) = peers.get_mut(&peer) {
            if let Some(until) = state.blocked_until {
                if now < until {
                    return true;
                }
                state.blocked_until = None;
                state.failures = 0;
                state.window_started = now;
            }
        }
        false
    }

    /// Record a malformed or unauthorized handshake. Returns true only on the
    /// transition that opens this peer's circuit, never for unrelated peers.
    pub fn record_failure(&self, peer: IpAddr) -> bool {
        if matches!(self.mode, BreakerMode::Disabled) {
            return false;
        }
        let now = Instant::now();
        let Ok(mut peers) = self.peers.lock() else {
            return false;
        };
        let state = peers.entry(peer).or_insert(PeerState {
            failures: 0,
            window_started: now,
            blocked_until: None,
        });
        if state.blocked_until.is_some_and(|until| now < until) {
            return false;
        }
        if now.duration_since(state.window_started) > self.failure_window {
            state.failures = 0;
            state.window_started = now;
        }
        state.failures = state.failures.saturating_add(1);
        if state.failures >= self.threshold {
            state.blocked_until = Some(now + self.block_duration);
            return true;
        }
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn breaker_is_scoped_to_a_peer_and_trips_at_threshold() {
        let breaker = PeerCircuitBreaker {
            mode: BreakerMode::FailClosed,
            threshold: 2,
            failure_window: Duration::from_secs(60),
            block_duration: Duration::from_secs(60),
            peers: Mutex::new(HashMap::new()),
        };
        let a: IpAddr = "192.0.2.1".parse().unwrap();
        let b: IpAddr = "192.0.2.2".parse().unwrap();
        assert!(!breaker.record_failure(a));
        assert!(breaker.record_failure(a));
        assert!(breaker.is_blocked(a));
        assert!(!breaker.is_blocked(b));
    }

    #[test]
    fn fail_closed_rejects_only_after_trip() {
        assert!(!BreakerMode::FailClosed.reject_new_connections(false));
        assert!(BreakerMode::FailClosed.reject_new_connections(true));
        assert!(!BreakerMode::Disabled.reject_new_connections(true));
    }
}
