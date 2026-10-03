use std::env;
use std::io;
use std::net::SocketAddr;

#[derive(Debug, Clone)]
pub struct Config {
    pub listen_addr: SocketAddr,
    pub upstream_addr: String,
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

        Ok(Self {
            listen_addr,
            upstream_addr,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_are_valid() {
        let config = Config::from_env().unwrap();
        assert_eq!(config.listen_addr, "127.0.0.1:6432".parse().unwrap());
        assert_eq!(config.upstream_addr, "127.0.0.1:5432");
    }
}
