use std::env;
use std::io;
use std::net::SocketAddr;

#[derive(Debug, Clone)]
pub struct Config {
    pub listen_addr: SocketAddr,
    pub upstream_addr: String,
    pub tenant_role_password: Option<String>,
    pub tenant_signing_key: Option<String>,
    pub tenant_role_prefix: String,
    pub max_connections: usize,
    pub startup_timeout_ms: u64,
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

        let startup_timeout_ms = env::var("PROXIMA_STARTUP_TIMEOUT_MS")
            .unwrap_or_else(|_| "5000".to_string())
            .parse::<u64>()
            .map_err(|error| {
                io::Error::new(
                    io::ErrorKind::InvalidInput,
                    format!("invalid PROXIMA_STARTUP_TIMEOUT_MS: {error}"),
                )
            })?;

        if startup_timeout_ms == 0 {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "PROXIMA_STARTUP_TIMEOUT_MS must be greater than zero",
            ));
        }

        let tenant_role_password = env::var("PROXIMA_TENANT_ROLE_PASSWORD")
            .ok()
            .filter(|value| !value.is_empty());

        if tenant_signing_key.is_some() && tenant_role_password.is_none() {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "PROXIMA_TENANT_ROLE_PASSWORD is required when tenant enforcement is enabled",
            ));
        }

        Ok(Self {
            listen_addr,
            upstream_addr,
            tenant_role_password,
            tenant_signing_key,
            tenant_role_prefix,
            max_connections,
            startup_timeout_ms,
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
            "PROXIMA_TENANT_ROLE_PREFIX",
            "PROXIMA_MAX_CONNECTIONS",
            "PROXIMA_STARTUP_TIMEOUT_MS",
            "PROXIMA_TENANT_ROLE_PASSWORD",
        ] {
            std::env::remove_var(key);
        }

        let config = Config::from_env().unwrap();
        assert_eq!(config.listen_addr, "127.0.0.1:6432".parse().unwrap());
        assert_eq!(config.upstream_addr, "127.0.0.1:5432");
        assert_eq!(config.tenant_role_password, None);
        assert_eq!(config.tenant_signing_key, None);
        assert_eq!(config.tenant_role_prefix, "proxima_tenant_");
        assert_eq!(config.max_connections, 1024);
        assert_eq!(config.startup_timeout_ms, 5000);
    }
}
