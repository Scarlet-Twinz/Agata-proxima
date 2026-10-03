use rustls::pki_types::{CertificateDer, PrivateKeyDer, PrivatePkcs8KeyDer, ServerName};
use rustls::{ClientConfig, RootCertStore, ServerConfig};
use std::fs::File;
use std::io::{self, BufReader};
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::time::timeout;
use tokio_rustls::{client::TlsStream as ClientTlsStream, server::TlsStream as ServerTlsStream, TlsAcceptor, TlsConnector};

use crate::config::{ClientTlsMode, UpstreamTlsMode};

pub type ClientStream = ServerTlsStream<TcpStream>;
pub type UpstreamStream = ClientTlsStream<TcpStream>;

#[derive(Clone)]
pub struct TlsRuntime {
    pub client_mode: ClientTlsMode,
    pub upstream_mode: UpstreamTlsMode,
    pub client_acceptor: Option<TlsAcceptor>,
    pub upstream_connector: Option<TlsConnector>,
    pub upstream_server_name: Option<String>,
    pub handshake_timeout: Duration,
}

impl TlsRuntime {
    pub fn from_config(config: &crate::config::Config) -> io::Result<Self> {
        let client_acceptor = if config.client_tls_mode == ClientTlsMode::Required {
            let certs = load_certificates(config.client_tls_cert_file.as_deref().ok_or_else(|| {
                invalid("PROXIMA_TLS_CERT_FILE is required when PROXIMA_TLS_MODE=required")
            })?)?;
            let key = load_private_key(config.client_tls_key_file.as_deref().ok_or_else(|| {
                invalid("PROXIMA_TLS_KEY_FILE is required when PROXIMA_TLS_MODE=required")
            })?)?;
            let server = ServerConfig::builder()
                .with_no_client_auth()
                .with_single_cert(certs, key)
                .map_err(|e| invalid(&format!("invalid Proxima TLS certificate/key: {e}")))?;
            Some(TlsAcceptor::from(Arc::new(server)))
        } else {
            None
        };

        let (upstream_connector, upstream_server_name) =
            if config.upstream_tls_mode == UpstreamTlsMode::VerifyFull {
                let ca_file = config
                    .upstream_tls_ca_file
                    .as_deref()
                    .ok_or_else(|| invalid("PROXIMA_UPSTREAM_TLS_CA_FILE is required for verify-full"))?;
                let server_name = config
                    .upstream_tls_server_name
                    .as_deref()
                    .ok_or_else(|| invalid("PROXIMA_UPSTREAM_TLS_SERVER_NAME is required for verify-full"))?
                    .to_owned();
                let roots = load_root_store(ca_file)?;
                let client = ClientConfig::builder()
                    .with_root_certificates(roots)
                    .with_no_client_auth();
                (Some(TlsConnector::from(Arc::new(client))), Some(server_name))
            } else {
                (None, None)
            };

        Ok(Self {
            client_mode: config.client_tls_mode,
            upstream_mode: config.upstream_tls_mode,
            client_acceptor,
            upstream_connector,
            upstream_server_name,
            handshake_timeout: config.tls_handshake_timeout,
        })
    }

    pub async fn accept_client(
        &self,
        mut stream: TcpStream,
    ) -> io::Result<(ClientStream, bool)> {
        let acceptor = self
            .client_acceptor
            .as_ref()
            .ok_or_else(|| invalid("client TLS acceptor is not configured"))?;

        let mut probe = [0u8; 8];
        let n = timeout(self.handshake_timeout, stream.peek(&mut probe))
            .await
            .map_err(|_| timed_out("client TLS negotiation timed out"))??;
        if n < 8 || u32::from_be_bytes(probe[0..4].try_into().unwrap()) != 8
            || u32::from_be_bytes(probe[4..8].try_into().unwrap()) != crate::protocol::SSL_REQUEST_CODE as u32
        {
            return Err(invalid("TLS is required; PostgreSQL SSLRequest was not received"));
        }

        let mut ssl_request = [0u8; 8];
        timeout(self.handshake_timeout, stream.read_exact(&mut ssl_request))
            .await
            .map_err(|_| timed_out("client TLS negotiation timed out"))??;
        stream.write_all(b"S").await?;

        let tls = timeout(self.handshake_timeout, acceptor.accept(stream))
            .await
            .map_err(|_| timed_out("client TLS handshake timed out"))?
            .map_err(|e| invalid(&format!("client TLS handshake failed: {e}")))?;
        Ok((tls, true))
    }

    pub async fn connect_upstream(&self, mut stream: TcpStream) -> io::Result<UpstreamStream> {
        let connector = self
            .upstream_connector
            .as_ref()
            .ok_or_else(|| invalid("upstream TLS connector is not configured"))?;
        let server_name = self
            .upstream_server_name
            .as_deref()
            .ok_or_else(|| invalid("upstream TLS server name is not configured"))?;
        let server_name = ServerName::try_from(server_name.to_owned())
            .map_err(|_| invalid("invalid PROXIMA_UPSTREAM_TLS_SERVER_NAME"))?;

        stream.write_all(&8i32.to_be_bytes()).await?;
        stream
            .write_all(&crate::protocol::SSL_REQUEST_CODE.to_be_bytes())
            .await?;
        stream.flush().await?;
        let mut response = [0u8; 1];
        timeout(self.handshake_timeout, stream.read_exact(&mut response))
            .await
            .map_err(|_| timed_out("upstream TLS negotiation timed out"))??;
        if response[0] != b'S' {
            return Err(invalid("PostgreSQL upstream rejected TLS"));
        }

        timeout(self.handshake_timeout, connector.connect(server_name, stream))
            .await
            .map_err(|_| timed_out("upstream TLS handshake timed out"))?
            .map_err(|e| invalid(&format!("upstream TLS handshake failed: {e}")))
    }
}

fn load_certificates(path: &str) -> io::Result<Vec<CertificateDer<'static>>> {
    let file = File::open(path)?;
    rustls_pemfile::certs(&mut BufReader::new(file))
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| invalid(&format!("failed to read certificate chain: {e}")))
}

fn load_private_key(path: &str) -> io::Result<PrivateKeyDer<'static>> {
    let file = File::open(path)?;
    let mut reader = BufReader::new(file);
    let mut keys = rustls_pemfile::pkcs8_private_keys(&mut reader)
        .collect::<Result<Vec<PrivatePkcs8KeyDer<'static>>, _>>()
        .map_err(|e| invalid(&format!("failed to read PKCS#8 private key: {e}")))?;
    keys.pop()
        .map(PrivateKeyDer::from)
        .ok_or_else(|| invalid("no PKCS#8 private key found"))
}

fn load_root_store(path: &str) -> io::Result<RootCertStore> {
    let certs = load_certificates(path)?;
    let mut roots = RootCertStore::empty();
    for cert in certs {
        roots
            .add(cert)
            .map_err(|e| invalid(&format!("invalid upstream CA certificate: {e}")))?;
    }
    Ok(roots)
}

fn invalid(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidInput, message)
}

fn timed_out(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::TimedOut, message)
}

pub async fn reject_plaintext<S>(mut stream: S) -> io::Result<()>
where
    S: AsyncRead + AsyncWrite + Unpin,
{
    let _ = stream.shutdown().await;
    Err(invalid("plaintext PostgreSQL connections are disabled while TLS is required"))
}
