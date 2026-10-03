use std::env;
use std::io;
use std::net::SocketAddr;
use std::time::Duration;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TlsMode {
    Disabled,
    Required,
}

impl TlsMode {
    fn from_env(value: &str) -> io::Result<Self> {
        match value {
            "disabled" => Ok(Self::Disabled),
            "required" => Ok(Self::Required),
            other => Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                format!("invalid TLS mode: {other}"),
            )),
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
    pub tls_mode: TlsMode,
    pub tls_cert_file: Option<String>,
    pub tls_key_file: Option<String>,
    pub upstream_tls_mode: TlsMode,
    pub upstream_tls_ca_file: Option<String>,
    pub upstream_tls_server_name: Option<String>,
}

impl Config {
    pub fn from_env() -> io::Result<Self> {
        let listen_addr = env::var("PROXIMA_LISTEN_ADDR")
            .unwrap_or_else(|_| "127.0.0.1:6432".into())
            .parse()
            .map_err(|e| {
                io::Error::new(
                    io::ErrorKind::InvalidInput,
                    format!("invalid PROXIMA_LISTEN_ADDR: {e}"),
                )
            })?;
        let upstream_addr =
            env::var("PROXIMA_UPSTREAM_ADDR").unwrap_or_else(|_| "127.0.0.1:5432".into());
        if upstream_addr.trim().is_empty() {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "PROXIMA_UPSTREAM_ADDR cannot be empty",
            ));
        }

        let tenant_role_prefix =
            env::var("PROXIMA_TENANT_ROLE_PREFIX").unwrap_or_else(|_| "proxima_tenant_".into());
        if tenant_role_prefix.is_empty()
            || !tenant_role_prefix
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'_')
        {
            return Err(io::Error::new(io::ErrorKind::InvalidInput, "PROXIMA_TENANT_ROLE_PREFIX must contain only ASCII letters, digits, and underscores"));
        }

        let tenant_signing_key = match env::var("PROXIMA_TENANT_SIGNING_KEY") {
            Ok(v) if v.trim().is_empty() => None,
            Ok(v) if v.len() < 32 => {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidInput,
                    "PROXIMA_TENANT_SIGNING_KEY must be at least 32 bytes",
                ))
            }
            Ok(v) => Some(v),
            Err(_) => None,
        };

        let upstream_connect_timeout_ms = env::var("PROXIMA_UPSTREAM_CONNECT_TIMEOUT_MS")
            .unwrap_or_else(|_| "10000".into())
            .parse::<u64>()
            .map_err(|e| {
                io::Error::new(
                    io::ErrorKind::InvalidInput,
                    format!("invalid PROXIMA_UPSTREAM_CONNECT_TIMEOUT_MS: {e}"),
                )
            })?;
        if upstream_connect_timeout_ms == 0 {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "PROXIMA_UPSTREAM_CONNECT_TIMEOUT_MS must be greater than zero",
            ));
        }

        let tls_handshake_timeout_ms = env::var("PROXIMA_TLS_HANDSHAKE_TIMEOUT_MS")
            .unwrap_or_else(|_| "10000".into())
            .parse::<u64>()
            .map_err(|e| {
                io::Error::new(
                    io::ErrorKind::InvalidInput,
                    format!("invalid PROXIMA_TLS_HANDSHAKE_TIMEOUT_MS: {e}"),
                )
            })?;
        if tls_handshake_timeout_ms == 0 {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "PROXIMA_TLS_HANDSHAKE_TIMEOUT_MS must be greater than zero",
            ));
        }

        let max_connections = env::var("PROXIMA_MAX_CONNECTIONS")
            .unwrap_or_else(|_| "1024".into())
            .parse::<usize>()
            .map_err(|e| {
                io::Error::new(
                    io::ErrorKind::InvalidInput,
                    format!("invalid PROXIMA_MAX_CONNECTIONS: {e}"),
                )
            })?;
        if max_connections == 0 {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "PROXIMA_MAX_CONNECTIONS must be greater than zero",
            ));
        }

        let tls_mode =
            TlsMode::from_env(&env::var("PROXIMA_TLS_MODE").unwrap_or_else(|_| "disabled".into()))?;
        let upstream_tls_mode = TlsMode::from_env(
            &env::var("PROXIMA_UPSTREAM_TLS_MODE").unwrap_or_else(|_| "disabled".into()),
        )?;
        let tls_cert_file = env::var("PROXIMA_TLS_CERT_FILE")
            .ok()
            .filter(|v| !v.trim().is_empty());
        let tls_key_file = env::var("PROXIMA_TLS_KEY_FILE")
            .ok()
            .filter(|v| !v.trim().is_empty());
        let upstream_tls_ca_file = env::var("PROXIMA_UPSTREAM_TLS_CA_FILE")
            .ok()
            .filter(|v| !v.trim().is_empty());
        let upstream_tls_server_name = env::var("PROXIMA_UPSTREAM_TLS_SERVER_NAME")
            .ok()
            .filter(|v| !v.trim().is_empty());

        if tls_mode == TlsMode::Required && (tls_cert_file.is_none() || tls_key_file.is_none()) {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "PROXIMA_TLS_MODE=required requires PROXIMA_TLS_CERT_FILE and PROXIMA_TLS_KEY_FILE",
            ));
        }
        if upstream_tls_mode == TlsMode::Required
            && (upstream_tls_ca_file.is_none() || upstream_tls_server_name.is_none())
        {
            return Err(io::Error::new(io::ErrorKind::InvalidInput, "PROXIMA_UPSTREAM_TLS_MODE=required requires PROXIMA_UPSTREAM_TLS_CA_FILE and PROXIMA_UPSTREAM_TLS_SERVER_NAME"));
        }

        Ok(Self {
            listen_addr,
            upstream_addr,
            tenant_signing_key,
            tenant_role_prefix,
            upstream_connect_timeout: Duration::from_millis(upstream_connect_timeout_ms),
            tls_handshake_timeout: Duration::from_millis(tls_handshake_timeout_ms),
            max_connections,
            tls_mode,
            tls_cert_file,
            tls_key_file,
            upstream_tls_mode,
            upstream_tls_ca_file,
            upstream_tls_server_name,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn defaults_are_valid() {
        for key in [
            "PROXIMA_LISTEN_ADDR",
            "PROXIMA_UPSTREAM_ADDR",
            "PROXIMA_TENANT_SIGNING_KEY",
            "PROXIMA_UPSTREAM_CONNECT_TIMEOUT_MS",
            "PROXIMA_MAX_CONNECTIONS",
            "PROXIMA_TLS_MODE",
            "PROXIMA_TLS_CERT_FILE",
            "PROXIMA_TLS_KEY_FILE",
            "PROXIMA_TLS_HANDSHAKE_TIMEOUT_MS",
            "PROXIMA_UPSTREAM_TLS_MODE",
            "PROXIMA_UPSTREAM_TLS_CA_FILE",
            "PROXIMA_UPSTREAM_TLS_SERVER_NAME",
        ] {
            std::env::remove_var(key);
        }
        let c = Config::from_env().unwrap();
        assert_eq!(c.listen_addr, "127.0.0.1:6432".parse().unwrap());
        assert_eq!(c.tls_mode, TlsMode::Disabled);
        assert_eq!(c.upstream_tls_mode, TlsMode::Disabled);
    }
    #[test]
    fn required_tls_needs_material() {
        std::env::set_var("PROXIMA_TLS_MODE", "required");
        std::env::remove_var("PROXIMA_TLS_CERT_FILE");
        std::env::remove_var("PROXIMA_TLS_KEY_FILE");
        assert!(Config::from_env().is_err());
        std::env::remove_var("PROXIMA_TLS_MODE");
    }
    #[test]
    fn required_upstream_tls_needs_trust_configuration() {
        std::env::set_var("PROXIMA_UPSTREAM_TLS_MODE", "required");
        std::env::remove_var("PROXIMA_UPSTREAM_TLS_CA_FILE");
        std::env::remove_var("PROXIMA_UPSTREAM_TLS_SERVER_NAME");
        assert!(Config::from_env().is_err());
        std::env::remove_var("PROXIMA_UPSTREAM_TLS_MODE");
    }
}
