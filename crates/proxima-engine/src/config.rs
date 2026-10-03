use std::env;
use std::io;
use std::net::SocketAddr;

#[derive(Debug, Clone)]
pub struct Config {
    pub listen_addr: SocketAddr,
    pub upstream_addr: String,
    pub tenant_signing_key: Option<String>,
}

impl Config {
    pub fn from_env() -> io::Result<Self> {
        let listen_addr = env::var("PROXIMA_LISTEN_ADDR")
            .unwrap_or_else(|_| "127.0.0.1:6432".to_string())
            .parse()
            .map_err(|error| io::Error::new(io::ErrorKind::InvalidInput, format!("invalid PROXIMA_LISTEN_ADDR: {error}")))?;

        let upstream_addr = env::var("PROXIMA_UPSTREAM_ADDR")
            .unwrap_or_else(|_| "127.0.0.1:5432".to_string());

        if upstream_addr.trim().is_empty() {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "PROXIMA_UPSTREAM_ADDR cannot be empty",
            ));
        }

        let tenant_signing_key = match env::var("PROXIMA_TENANT_SIGNING_KEY") {
            Ok(value) if value.trim().is_empty() => None,
            Ok(value) if value.as_bytes().len() < 32 => {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidInput,
                    "PROXIMA_TENANT_SIGNING_KEY must be at least 32 bytes",
                ));
            }
            Ok(value) => Some(value),
            Err(_) => None,
        };

        Ok(Self {
            listen_addr,
            upstream_addr,
            tenant_signing_key,
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

        let config = Config::from_env().unwrap();
        assert_eq!(config.listen_addr, "127.0.0.1:6432".parse().unwrap());
        assert_eq!(config.upstream_addr, "127.0.0.1:5432");
        assert_eq!(config.tenant_signing_key, None);
    }
}
