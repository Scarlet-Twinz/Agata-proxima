use std::env;
use std::io;
use std::net::SocketAddr;
use std::time::Duration;

#[derive(Debug, Clone)]
pub struct Config {
    pub listen_addr: SocketAddr,
    pub upstream_addr: String,
    pub tenant_signing_key: Option<String>,
    pub tenant_role_prefix: String,
    pub upstream_connect_timeout: Duration,
    pub max_connections: usize,
}

impl Config {
    pub fn from_env() -> io::Result<Self> {
        let listen_addr = env::var("PROXIMA_LISTEN_ADDR")
            .unwrap_or_else(|_| "127.0.0.1:6432".to_string())
            .parse()
            .map_err(|error| {
                io::Error::new(
                    io::ErrorKind::InvalidInput,
                    format!("invalid PROXIMA_LISTEN_ADDR: {error}"),
                )
            })?;

        let upstream_addr =
            env::var("PROXIMA_UPSTREAM_ADDR").unwrap_or_else(|_| "127.0.0.1:5432".to_string());

        if upstream_addr.trim().is_empty() {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "PROXIMA_UPSTREAM_ADDR cannot be empty",
            ));
        }

        let tenant_role_prefix = env::var("PROXIMA_TENANT_ROLE_PREFIX")
            .unwrap_or_else(|_| "proxima_tenant_".to_string());

        if tenant_role_prefix.is_empty()
            || !tenant_role_prefix
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
        {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "PROXIMA_TENANT_ROLE_PREFIX must contain only ASCII letters, digits, and underscores",
            ));
        }

        let tenant_signing_key = match env::var("PROXIMA_TENANT_SIGNING_KEY") {
            Ok(value) if value.trim().is_empty() => None,
            Ok(value) if value.len() < 32 => {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidInput,
                    "PROXIMA_TENANT_SIGNING_KEY must be at least 32 bytes",
                ));
            }
            Ok(value) => Some(value),
            Err(_) => None,
        };

        let upstream_connect_timeout_ms = env::var("PROXIMA_UPSTREAM_CONNECT_TIMEOUT_MS")
            .unwrap_or_else(|_| "10000".to_string())
            .parse::<u64>()
            .map_err(|error| {
                io::Error::new(
                    io::ErrorKind::InvalidInput,
                    format!("invalid PROXIMA_UPSTREAM_CONNECT_TIMEOUT_MS: {error}"),
                )
            })?;
        if upstream_connect_timeout_ms == 0 {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "PROXIMA_UPSTREAM_CONNECT_TIMEOUT_MS must be greater than zero",
            ));
        }

        let max_connections = env::var("PROXIMA_MAX_CONNECTIONS")
            .unwrap_or_else(|_| "1024".to_string())
            .parse::<usize>()
            .map_err(|error| {
                io::Error::new(
                    io::ErrorKind::InvalidInput,
                    format!("invalid PROXIMA_MAX_CONNECTIONS: {error}"),
                )
            })?;
        if max_connections == 0 {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "PROXIMA_MAX_CONNECTIONS must be greater than zero",
            ));
        }

        Ok(Self {
            listen_addr,
            upstream_addr,
            tenant_signing_key,
            tenant_role_prefix,
            upstream_connect_timeout: Duration::from_millis(upstream_connect_timeout_ms),
            max_connections,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_are_valid() {
        std::env::remove_var("PROXIMA_LISTEN_ADDR");
        std::env::remove_var("PROXIMA_UPSTREAM_ADDR");
        std::env::remove_var("PROXIMA_TENANT_SIGNING_KEY");
        std::env::remove_var("PROXIMA_UPSTREAM_CONNECT_TIMEOUT_MS");
        std::env::remove_var("PROXIMA_MAX_CONNECTIONS");

        let config = Config::from_env().unwrap();
        assert_eq!(config.listen_addr, "127.0.0.1:6432".parse().unwrap());
        assert_eq!(config.upstream_addr, "127.0.0.1:5432");
        assert_eq!(config.tenant_signing_key, None);
        assert_eq!(config.tenant_role_prefix, "proxima_tenant_");
        assert_eq!(config.upstream_connect_timeout, Duration::from_secs(10));
        assert_eq!(config.max_connections, 1024);
    }
}
