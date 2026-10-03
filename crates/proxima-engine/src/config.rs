use std::env;
use std::io;
use std::net::SocketAddr;
use std::time::Duration;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TlsMode { Disabled, Required }

impl TlsMode {
    fn from_env(name: &str, default: Self) -> io::Result<Self> {
        match env::var(name) {
            Ok(value) => match value.to_ascii_lowercase().as_str() {
                "disabled" | "off" => Ok(Self::Disabled),
                "required" | "on" => Ok(Self::Required),
                _ => Err(io::Error::new(io::ErrorKind::InvalidInput, format!("{name} must be disabled or required"))),
            },
            Err(_) => Ok(default),
        }
    }
}

#[derive(Debug, Clone)]
pub struct Config {
    pub listen_addr: SocketAddr,
    pub upstream_addr: String,
    pub tenant_signing_key: Option<String>,
    pub tenant_role_prefix: String,
    pub upstream_connect_timeout: Duration,
    pub tls_handshake_timeout: Duration,
    pub max_connections: usize,
    pub client_tls_mode: TlsMode,
    pub client_tls_cert_file: Option<String>,
    pub client_tls_key_file: Option<String>,
    pub upstream_tls_mode: TlsMode,
    pub upstream_tls_server_name: Option<String>,
    pub upstream_tls_ca_file: Option<String>,
}

impl Config {
    pub fn from_env() -> io::Result<Self> {
        let listen_addr = env::var("PROXIMA_LISTEN_ADDR").unwrap_or_else(|_| "127.0.0.1:6432".to_string()).parse()
            .map_err(|error| io::Error::new(io::ErrorKind::InvalidInput, format!("invalid PROXIMA_LISTEN_ADDR: {error}")))?;
        let upstream_addr = env::var("PROXIMA_UPSTREAM_ADDR").unwrap_or_else(|_| "127.0.0.1:5432".to_string());
        if upstream_addr.trim().is_empty() { return Err(io::Error::new(io::ErrorKind::InvalidInput, "PROXIMA_UPSTREAM_ADDR cannot be empty")); }

        let tenant_role_prefix = env::var("PROXIMA_TENANT_ROLE_PREFIX").unwrap_or_else(|_| "proxima_tenant_".to_string());
        if tenant_role_prefix.is_empty() || !tenant_role_prefix.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'_') {
            return Err(io::Error::new(io::ErrorKind::InvalidInput, "PROXIMA_TENANT_ROLE_PREFIX must contain only ASCII letters, digits, and underscores"));
        }

        let tenant_signing_key = match env::var("PROXIMA_TENANT_SIGNING_KEY") {
            Ok(value) if value.trim().is_empty() => None,
            Ok(value) if value.len() < 32 => return Err(io::Error::new(io::ErrorKind::InvalidInput, "PROXIMA_TENANT_SIGNING_KEY must be at least 32 bytes")),
            Ok(value) => Some(value),
            Err(_) => None,
        };

        let upstream_connect_timeout_ms = parse_positive_u64("PROXIMA_UPSTREAM_CONNECT_TIMEOUT_MS", 10_000)?;
        let tls_handshake_timeout_ms = parse_positive_u64("PROXIMA_TLS_HANDSHAKE_TIMEOUT_MS", 10_000)?;
        let max_connections = env::var("PROXIMA_MAX_CONNECTIONS").unwrap_or_else(|_| "1024".to_string()).parse::<usize>()
            .map_err(|error| io::Error::new(io::ErrorKind::InvalidInput, format!("invalid PROXIMA_MAX_CONNECTIONS: {error}")))?;
        if max_connections == 0 { return Err(io::Error::new(io::ErrorKind::InvalidInput, "PROXIMA_MAX_CONNECTIONS must be greater than zero")); }

        let client_tls_mode = TlsMode::from_env("PROXIMA_CLIENT_TLS_MODE", TlsMode::Disabled)?;
        let client_tls_cert_file = optional_env("PROXIMA_CLIENT_TLS_CERT_FILE");
        let client_tls_key_file = optional_env("PROXIMA_CLIENT_TLS_KEY_FILE");
        if client_tls_mode == TlsMode::Required && (client_tls_cert_file.is_none() || client_tls_key_file.is_none()) {
            return Err(io::Error::new(io::ErrorKind::InvalidInput, "client TLS required mode needs PROXIMA_CLIENT_TLS_CERT_FILE and PROXIMA_CLIENT_TLS_KEY_FILE"));
        }
        if client_tls_cert_file.is_some() ^ client_tls_key_file.is_some() {
            return Err(io::Error::new(io::ErrorKind::InvalidInput, "client TLS certificate and key must be configured together"));
        }

        let upstream_tls_mode = TlsMode::from_env("PROXIMA_UPSTREAM_TLS_MODE", TlsMode::Disabled)?;
        let upstream_tls_server_name = optional_env("PROXIMA_UPSTREAM_TLS_SERVER_NAME");
        let upstream_tls_ca_file = optional_env("PROXIMA_UPSTREAM_TLS_CA_FILE");
        if upstream_tls_mode == TlsMode::Required && (upstream_tls_server_name.is_none() || upstream_tls_ca_file.is_none()) {
            return Err(io::Error::new(io::ErrorKind::InvalidInput, "upstream TLS required mode needs PROXIMA_UPSTREAM_TLS_SERVER_NAME and PROXIMA_UPSTREAM_TLS_CA_FILE"));
        }

        Ok(Self {
            listen_addr, upstream_addr, tenant_signing_key, tenant_role_prefix,
            upstream_connect_timeout: Duration::from_millis(upstream_connect_timeout_ms),
            tls_handshake_timeout: Duration::from_millis(tls_handshake_timeout_ms),
            max_connections, client_tls_mode, client_tls_cert_file, client_tls_key_file,
            upstream_tls_mode, upstream_tls_server_name, upstream_tls_ca_file,
        })
    }
}

fn optional_env(name: &str) -> Option<String> { env::var(name).ok().filter(|value| !value.trim().is_empty()) }

fn parse_positive_u64(name: &str, default: u64) -> io::Result<u64> {
    let value = env::var(name).unwrap_or_else(|_| default.to_string()).parse::<u64>()
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidInput, format!("invalid {name}: {error}")))?;
    if value == 0 { return Err(io::Error::new(io::ErrorKind::InvalidInput, format!("{name} must be greater than zero"))); }
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn defaults_are_valid() {
        for key in ["PROXIMA_LISTEN_ADDR","PROXIMA_UPSTREAM_ADDR","PROXIMA_TENANT_SIGNING_KEY","PROXIMA_UPSTREAM_CONNECT_TIMEOUT_MS","PROXIMA_TLS_HANDSHAKE_TIMEOUT_MS","PROXIMA_MAX_CONNECTIONS","PROXIMA_CLIENT_TLS_MODE","PROXIMA_CLIENT_TLS_CERT_FILE","PROXIMA_CLIENT_TLS_KEY_FILE","PROXIMA_UPSTREAM_TLS_MODE","PROXIMA_UPSTREAM_TLS_SERVER_NAME","PROXIMA_UPSTREAM_TLS_CA_FILE"] { std::env::remove_var(key); }
        let config = Config::from_env().unwrap();
        assert_eq!(config.listen_addr, "127.0.0.1:6432".parse().unwrap());
        assert_eq!(config.upstream_addr, "127.0.0.1:5432");
        assert_eq!(config.tenant_signing_key, None);
        assert_eq!(config.tenant_role_prefix, "proxima_tenant_");
        assert_eq!(config.upstream_connect_timeout, Duration::from_secs(10));
        assert_eq!(config.tls_handshake_timeout, Duration::from_secs(10));
        assert_eq!(config.max_connections, 1024);
        assert_eq!(config.client_tls_mode, TlsMode::Disabled);
        assert_eq!(config.upstream_tls_mode, TlsMode::Disabled);
    }
    #[test]
    fn parses_tls_modes() {
        assert_eq!(TlsMode::from_env("PROXIMA_MISSING_TLS_MODE", TlsMode::Required).unwrap(), TlsMode::Required);
    }
}
