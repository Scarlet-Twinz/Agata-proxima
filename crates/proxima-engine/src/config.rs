use std::env;
use std::io;
use std::net::SocketAddr;
use std::str::FromStr;
use std::time::Duration;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ClientTlsMode {
    Disabled,
    Required,
}

impl FromStr for ClientTlsMode {
    type Err = io::Error;
    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "disabled" => Ok(Self::Disabled),
            "required" => Ok(Self::Required),
            _ => Err(io::Error::new(io::ErrorKind::InvalidInput, "PROXIMA_TLS_MODE must be disabled or required")),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UpstreamTlsMode {
    Disabled,
    VerifyFull,
}

impl FromStr for UpstreamTlsMode {
    type Err = io::Error;
    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "disabled" => Ok(Self::Disabled),
            "verify-full" => Ok(Self::VerifyFull),
            _ => Err(io::Error::new(io::ErrorKind::InvalidInput, "PROXIMA_UPSTREAM_TLS_MODE must be disabled or verify-full")),
        }
    }
}

#[derive(Debug, Clone)]
pub struct Config {
    pub listen_addr: SocketAddr,
    pub admin_addr: SocketAddr,
    pub upstream_addr: String,
    pub tenant_signing_key: Option<String>,
    pub tenant_role_prefix: String,
    pub upstream_connect_timeout: Duration,
    pub max_connections: usize,
    pub client_tls_mode: ClientTlsMode,
    pub client_tls_cert_file: Option<String>,
    pub client_tls_key_file: Option<String>,
    pub upstream_tls_mode: UpstreamTlsMode,
    pub upstream_tls_ca_file: Option<String>,
    pub upstream_tls_server_name: Option<String>,
    pub tls_handshake_timeout: Duration,
}

impl Config {
    pub fn from_env() -> io::Result<Self> {
        let listen_addr = parse_addr("PROXIMA_LISTEN_ADDR", "127.0.0.1:6432")?;
        let admin_addr = parse_addr("PROXIMA_ADMIN_ADDR", "127.0.0.1:9080")?;
        let upstream_addr =
            env::var("PROXIMA_UPSTREAM_ADDR").unwrap_or_else(|_| "127.0.0.1:5432".to_string());
        if upstream_addr.trim().is_empty() {
            return Err(invalid("PROXIMA_UPSTREAM_ADDR cannot be empty"));
        }

        let tenant_role_prefix = env::var("PROXIMA_TENANT_ROLE_PREFIX")
            .unwrap_or_else(|_| "proxima_tenant_".to_string());
        if tenant_role_prefix.is_empty()
            || !tenant_role_prefix.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
        {
            return Err(invalid("PROXIMA_TENANT_ROLE_PREFIX must contain only ASCII letters, digits, and underscores"));
        }

        let tenant_signing_key = match env::var("PROXIMA_TENANT_SIGNING_KEY") {
            Ok(value) if value.trim().is_empty() => None,
            Ok(value) if value.len() < 32 => {
                return Err(invalid("PROXIMA_TENANT_SIGNING_KEY must be at least 32 bytes"));
            }
            Ok(value) => Some(value),
            Err(_) => None,
        };

        let upstream_connect_timeout = duration_ms("PROXIMA_UPSTREAM_CONNECT_TIMEOUT_MS", 10_000)?;
        let tls_handshake_timeout = duration_ms("PROXIMA_TLS_HANDSHAKE_TIMEOUT_MS", 10_000)?;

        let max_connections = env::var("PROXIMA_MAX_CONNECTIONS")
            .unwrap_or_else(|_| "1024".to_string())
            .parse::<usize>()
            .map_err(|e| invalid(&format!("invalid PROXIMA_MAX_CONNECTIONS: {e}")))?;
        if max_connections == 0 {
            return Err(invalid("PROXIMA_MAX_CONNECTIONS must be greater than zero"));
        }

        let client_tls_mode = env::var("PROXIMA_TLS_MODE")
            .unwrap_or_else(|_| "disabled".to_string())
            .parse()?;
        let client_tls_cert_file = optional_env("PROXIMA_TLS_CERT_FILE");
        let client_tls_key_file = optional_env("PROXIMA_TLS_KEY_FILE");
        if client_tls_mode == ClientTlsMode::Required
            && (client_tls_cert_file.is_none() || client_tls_key_file.is_none())
        {
            return Err(invalid("PROXIMA_TLS_CERT_FILE and PROXIMA_TLS_KEY_FILE are required when PROXIMA_TLS_MODE=required"));
        }

        let upstream_tls_mode = env::var("PROXIMA_UPSTREAM_TLS_MODE")
            .unwrap_or_else(|_| "disabled".to_string())
            .parse()?;
        let upstream_tls_ca_file = optional_env("PROXIMA_UPSTREAM_TLS_CA_FILE");
        let upstream_tls_server_name = optional_env("PROXIMA_UPSTREAM_TLS_SERVER_NAME");
        if upstream_tls_mode == UpstreamTlsMode::VerifyFull
            && (upstream_tls_ca_file.is_none() || upstream_tls_server_name.is_none())
        {
            return Err(invalid("PROXIMA_UPSTREAM_TLS_CA_FILE and PROXIMA_UPSTREAM_TLS_SERVER_NAME are required when PROXIMA_UPSTREAM_TLS_MODE=verify-full"));
        }
        if upstream_tls_mode == UpstreamTlsMode::VerifyFull
            && client_tls_mode != ClientTlsMode::Required
        {
            return Err(invalid("PROXIMA_UPSTREAM_TLS_MODE=verify-full requires PROXIMA_TLS_MODE=required"));
        }

        Ok(Self {
            listen_addr,
            admin_addr,
            upstream_addr,
            tenant_signing_key,
            tenant_role_prefix,
            upstream_connect_timeout,
            max_connections,
            client_tls_mode,
            client_tls_cert_file,
            client_tls_key_file,
            upstream_tls_mode,
            upstream_tls_ca_file,
            upstream_tls_server_name,
            tls_handshake_timeout,
        })
    }
}

fn parse_addr(name: &str, default: &str) -> io::Result<SocketAddr> {
    env::var(name)
        .unwrap_or_else(|_| default.to_string())
        .parse()
        .map_err(|e| invalid(&format!("invalid {name}: {e}")))
}

fn optional_env(name: &str) -> Option<String> {
    env::var(name).ok().filter(|value| !value.trim().is_empty())
}

fn duration_ms(name: &str, default: u64) -> io::Result<Duration> {
    let value = env::var(name)
        .unwrap_or_else(|_| default.to_string())
        .parse::<u64>()
        .map_err(|e| invalid(&format!("invalid {name}: {e}")))?;
    if value == 0 {
        return Err(invalid(&format!("{name} must be greater than zero")));
    }
    Ok(Duration::from_millis(value))
}

fn invalid(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidInput, message)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn clear() {
        for key in [
            "PROXIMA_LISTEN_ADDR", "PROXIMA_ADMIN_ADDR", "PROXIMA_UPSTREAM_ADDR",
            "PROXIMA_TENANT_SIGNING_KEY", "PROXIMA_UPSTREAM_CONNECT_TIMEOUT_MS",
            "PROXIMA_MAX_CONNECTIONS", "PROXIMA_TLS_MODE", "PROXIMA_TLS_CERT_FILE",
            "PROXIMA_TLS_KEY_FILE", "PROXIMA_UPSTREAM_TLS_MODE", "PROXIMA_UPSTREAM_TLS_CA_FILE",
            "PROXIMA_UPSTREAM_TLS_SERVER_NAME", "PROXIMA_TLS_HANDSHAKE_TIMEOUT_MS",
        ] {
            std::env::remove_var(key);
        }
    }

    #[test]
    fn defaults_are_valid() {
        clear();
        let config = Config::from_env().unwrap();
        assert_eq!(config.listen_addr, "127.0.0.1:6432".parse().unwrap());
        assert_eq!(config.admin_addr, "127.0.0.1:9080".parse().unwrap());
        assert_eq!(config.upstream_tls_mode, UpstreamTlsMode::Disabled);
        assert_eq!(config.client_tls_mode, ClientTlsMode::Disabled);
        assert_eq!(config.tls_handshake_timeout, Duration::from_secs(10));
    }

    #[test]
    fn required_client_tls_needs_credentials() {
        clear();
        std::env::set_var("PROXIMA_TLS_MODE", "required");
        assert!(Config::from_env().is_err());
    }

    #[test]
    fn verify_full_upstream_needs_ca_and_name() {
        clear();
        std::env::set_var("PROXIMA_UPSTREAM_TLS_MODE", "verify-full");
        assert!(Config::from_env().is_err());
    }
}
