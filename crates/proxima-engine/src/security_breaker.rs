use std::collections::{HashMap, VecDeque};
use std::net::IpAddr;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

#[derive(Debug, Clone)]
pub struct BreakerConfig {
    pub enabled: bool,
    pub failure_threshold: usize,
    pub observation_window: Duration,
    pub cooldown: Duration,
}

impl BreakerConfig {
    pub fn from_env() -> Self {
        let mode = std::env::var("PROXIMA_SECURITY_BREAKER")
            .or_else(|_| std::env::var("PROXIMA_SECURITY_CIRCUIT_BREAKER"))
            .unwrap_or_else(|_| "fail-closed".to_string());
        Self {
            enabled: !matches!(
                mode.trim().to_ascii_lowercase().as_str(),
                "off" | "disabled" | "false" | "0"
            ),
            failure_threshold: std::env::var("PROXIMA_BREAKER_FAILURE_THRESHOLD")
                .ok()
                .and_then(|v| v.parse().ok())
                .filter(|v| *v > 0)
                .unwrap_or(5),
            observation_window: Duration::from_secs(
                std::env::var("PROXIMA_BREAKER_WINDOW_SECONDS")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .filter(|v| *v > 0)
                    .unwrap_or(60),
            ),
            cooldown: Duration::from_secs(
                std::env::var("PROXIMA_BREAKER_COOLDOWN_SECONDS")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .filter(|v| *v > 0)
                    .unwrap_or(300),
            ),
        }
    }
}

const MAX_TRACKED_PEERS: usize = 10_000;

#[derive(Default)]
struct PeerState {
    violations: VecDeque<Instant>,
    blocked_until: Option<Instant>,
    last_seen: Option<Instant>,
}

#[derive(Clone)]
pub struct SecurityBreaker {
    config: BreakerConfig,
    peers: Arc<Mutex<HashMap<IpAddr, PeerState>>>,
}

impl SecurityBreaker {
    pub fn new(config: BreakerConfig) -> Self {
        Self {
            config,
            peers: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn is_blocked(&self, peer: IpAddr) -> bool {
        if !self.config.enabled {
            return false;
        }
        let Ok(mut peers) = self.peers.lock() else {
            return true;
        };
        let Some(state) = peers.get_mut(&peer) else {
            return false;
        };
        state.last_seen = Some(Instant::now());
        match state.blocked_until {
            Some(until) if until > Instant::now() => true,
            Some(_) => {
                state.blocked_until = None;
                state.violations.clear();
                false
            }
            None => false,
        }
    }

    pub fn record_violation(&self, peer: IpAddr) -> bool {
        if !self.config.enabled {
            return false;
        }
        let Ok(mut peers) = self.peers.lock() else {
            return true;
        };
        let now = Instant::now();
        if !peers.contains_key(&peer) && peers.len() >= MAX_TRACKED_PEERS {
            peers.retain(|_, state| {
                state.blocked_until.is_some_and(|until| until > now)
                    || state
                        .violations
                        .back()
                        .is_some_and(|at| now.duration_since(*at) <= self.config.observation_window)
            });
            if peers.len() >= MAX_TRACKED_PEERS {
                if let Some(oldest) = peers
                    .iter()
                    .min_by_key(|(_, state)| state.last_seen.unwrap_or(now))
                    .map(|(ip, _)| *ip)
                {
                    peers.remove(&oldest);
                }
            }
        }
        let state = peers.entry(peer).or_default();
        state.last_seen = Some(now);
        while state
            .violations
            .front()
            .is_some_and(|at| now.duration_since(*at) > self.config.observation_window)
        {
            state.violations.pop_front();
        }
        state.violations.push_back(now);
        if state.violations.len() >= self.config.failure_threshold {
            state.blocked_until = Some(now + self.config.cooldown);
            state.violations.clear();
            true
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::Ipv4Addr;
    #[test]
    fn breaker_blocks_repeated_offenders_only_for_the_cooldown() {
        let breaker = SecurityBreaker::new(BreakerConfig {
            enabled: true,
            failure_threshold: 2,
            observation_window: Duration::from_secs(30),
            cooldown: Duration::from_secs(30),
        });
        let peer = IpAddr::V4(Ipv4Addr::LOCALHOST);
        assert!(!breaker.record_violation(peer));
        assert!(breaker.record_violation(peer));
        assert!(breaker.is_blocked(peer));
        assert!(!breaker.is_blocked(IpAddr::V4(Ipv4Addr::new(127, 0, 0, 2))));
    }

    #[test]
    fn disabled_breaker_never_blocks() {
        let breaker = SecurityBreaker::new(BreakerConfig {
            enabled: false,
            failure_threshold: 1,
            observation_window: Duration::from_secs(1),
            cooldown: Duration::from_secs(1),
        });
        let peer = IpAddr::V4(Ipv4Addr::LOCALHOST);
        assert!(!breaker.record_violation(peer));
        assert!(!breaker.is_blocked(peer));
    }
}
