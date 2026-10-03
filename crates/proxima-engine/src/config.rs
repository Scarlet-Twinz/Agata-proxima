use std::env;
use std::io;
use std::net::SocketAddr;

#[derive(Debug, Clone)]
pub struct Config {
    pub listen_addr: SocketAddr,
    pub upstream_addr: String,
    pub upstream_user: Option<String>,
    pub upstream_password: Option<String>,
    pub tenant_signing_key: Option<String>,
    pub tenant_role_prefix: String,
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

        let upstream_user = env::var("PROXIMA_UPSTREAM_USER")
            .ok()
            .filter(|value| !value.trim().is_empty());
        let upstream_password = env::var("PROXIMA_UPSTREAM_PASSWORD")
            .ok()
            .filter(|value| !value.is_empty());

        if tenant_signing_key.is_some() && (upstream_user.is_none() || upstream_password.is_none())
        {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "PROXIMA_UPSTREAM_USER and PROXIMA_UPSTREAM_PASSWORD are required when tenant enforcement is enabled",
            ));
        }

        Ok(Self {
            listen_addr,
            upstream_addr,
            upstream_user,
            upstream_password,
            tenant_signing_key,
            tenant_role_prefix,
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
            "PROXIMA_UPSTREAM_USER",
            "PROXIMA_UPSTREAM_PASSWORD",
        ] {
            std::env::remove_var(key);
        }

        let config = Config::from_env().unwrap();
        assert_eq!(config.listen_addr, "127.0.0.1:6432".parse().unwrap());
        assert_eq!(config.upstream_addr, "127.0.0.1:5432");
        assert_eq!(config.upstream_user, None);
        assert_eq!(config.upstream_password, None);
        assert_eq!(config.tenant_signing_key, None);
        assert_eq!(config.tenant_role_prefix, "proxima_tenant_");
    }
}
