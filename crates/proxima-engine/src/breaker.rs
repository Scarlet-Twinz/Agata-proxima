//! Explicit fail-closed circuit-breaker policy. A trip is never silently reset.
use std::io;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BreakerMode { Disabled, FailClosed }

impl BreakerMode {
    pub fn from_env() -> io::Result<Self> {
        let value = std::env::var("PROXIMA_SECURITY_BREAKER")
            .or_else(|_| std::env::var("PROXIMA_SECURITY_CIRCUIT_BREAKER"))
            .unwrap_or_else(|_| "fail-closed".to_string());
        match value.trim().to_ascii_lowercase().as_str() {
            "fail-closed" | "closed" | "on" | "true" => Ok(Self::FailClosed),
            "disabled" | "off" | "false" => Ok(Self::Disabled),
            other => Err(io::Error::new(io::ErrorKind::InvalidInput,
                format!("invalid PROXIMA_SECURITY_BREAKER value {other:?}; expected fail-closed or disabled"))),
        }
    }
    pub fn reject_new_connections(self, tripped: bool) -> bool {
        matches!(self, Self::FailClosed) && tripped
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn fail_closed_rejects_only_after_trip() {
        assert!(!BreakerMode::FailClosed.reject_new_connections(false));
        assert!(BreakerMode::FailClosed.reject_new_connections(true));
        assert!(!BreakerMode::Disabled.reject_new_connections(true));
    }
}
