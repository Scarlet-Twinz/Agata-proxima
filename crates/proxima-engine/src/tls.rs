use crate::config::{Config, TlsMode};
use rustls::pki_types::{CertificateDer, PrivateKeyDer, ServerName};
use rustls::{ClientConfig, RootCertStore, ServerConfig};
use rustls_pemfile::{certs, private_key};
use std::fs::File;
use std::io::{self, BufReader};
use std::sync::Arc;
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::time::timeout;
use tokio_rustls::{TlsAcceptor, TlsConnector, TlsStream};

const SSL_REQUEST_CODE: i32 = 80877103;

pub type PgTlsStream = TlsStream<TcpStream>;

pub trait PgIo: AsyncRead + AsyncWrite + Unpin + Send {}
impl<T> PgIo for T where T: AsyncRead + AsyncWrite + Unpin + Send {}

pub fn client_acceptor(config: &Config) -> io::Result<Option<TlsAcceptor>> {
    if config.client_tls_mode == TlsMode::Disabled { return Ok(None); }
    let cert_file = config.client_tls_cert_file.as_ref().ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "client TLS certificate is not configured"))?;
    let key_file = config.client_tls_key_file.as_ref().ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "client TLS key is not configured"))?;
    let certs = load_certs(cert_file)?;
    let key = load_key(key_file)?;
    let server = ServerConfig::builder().with_no_client_auth().with_single_cert(certs, key)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidInput, format!("invalid client TLS certificate/key: {error}")))?;
    Ok(Some(TlsAcceptor::from(Arc::new(server))))
}

pub async fn accept_client_tls(mut stream: TcpStream, acceptor: &TlsAcceptor, handshake_timeout: std::time::Duration) -> io::Result<PgTlsStream> {
    let mut startup = [0u8; 8];
    stream.read_exact(&mut startup).await?;
    let length = i32::from_be_bytes(startup[..4].try_into().unwrap());
    let code = i32::from_be_bytes(startup[4..].try_into().unwrap());
    if length != 8 || code != SSL_REQUEST_CODE {
        return Err(io::Error::new(io::ErrorKind::PermissionDenied, "TLS is required: PostgreSQL client did not send SSLRequest"));
    }
    stream.write_all(b"S").await?;
    stream.flush().await?;
    timeout(handshake_timeout, acceptor.accept(stream)).await
        .map_err(|_| io::Error::new(io::ErrorKind::TimedOut, "client TLS handshake timed out"))?
        .map_err(|error| io::Error::new(io::ErrorKind::PermissionDenied, format!("client TLS handshake failed: {error}")))
}

pub async fn connect_upstream(addr: &str, mode: TlsMode, server_name: Option<&str>, ca_file: Option<&str>, connect_timeout: std::time::Duration, handshake_timeout: std::time::Duration) -> io::Result<Box<dyn PgIo>> {
    let mut stream = timeout(connect_timeout, TcpStream::connect(addr)).await
        .map_err(|_| io::Error::new(io::ErrorKind::TimedOut, "upstream connection timed out"))??;
    if mode == TlsMode::Disabled { return Ok(Box::new(stream)); }

    stream.write_all(&8i32.to_be_bytes()).await?;
    stream.write_all(&SSL_REQUEST_CODE.to_be_bytes()).await?;
    stream.flush().await?;
    let mut response = [0u8; 1];
    stream.read_exact(&mut response).await?;
    if response[0] != b'S' { return Err(io::Error::new(io::ErrorKind::PermissionDenied, "upstream PostgreSQL server did not accept TLS; refusing downgrade")); }

    let server_name = server_name.ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "upstream TLS server name is required"))?;
    let server_name = ServerName::try_from(server_name.to_string()).map_err(|_| io::Error::new(io::ErrorKind::InvalidInput, "invalid upstream TLS server name"))?;
    let ca_file = ca_file.ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "upstream TLS CA file is required"))?;
    let mut roots = RootCertStore::empty();
    let mut reader = BufReader::new(File::open(ca_file)?);
    let parsed: Vec<CertificateDer<'static>> = certs(&mut reader).collect::<Result<_, _>>()
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidInput, format!("invalid upstream CA PEM: {error}")))?;
    let (added, _) = roots.add_parsable_certificates(parsed);
    if added == 0 { return Err(io::Error::new(io::ErrorKind::InvalidInput, "upstream TLS CA file contained no usable certificates")); }

    let client = ClientConfig::builder().with_root_certificates(roots).with_no_client_auth();
    let connector = TlsConnector::from(Arc::new(client));
    let tls = timeout(handshake_timeout, connector.connect(server_name, stream)).await
        .map_err(|_| io::Error::new(io::ErrorKind::TimedOut, "upstream TLS handshake timed out"))?
        .map_err(|error| io::Error::new(io::ErrorKind::PermissionDenied, format!("upstream TLS handshake failed: {error}")))?;
    Ok(Box::new(tls))
}

fn load_certs(path: &str) -> io::Result<Vec<CertificateDer<'static>>> {
    let mut reader = BufReader::new(File::open(path)?);
    certs(&mut reader).collect::<Result<_, _>>()
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidInput, format!("invalid TLS certificate PEM: {error}")))
}

fn load_key(path: &str) -> io::Result<PrivateKeyDer<'static>> {
    let mut reader = BufReader::new(File::open(path)?);
    private_key(&mut reader)?.ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "TLS key file contains no private key"))
}

pub fn validate_tls_config(config: &Config) -> io::Result<()> {
    if config.client_tls_mode == TlsMode::Required { let _ = client_acceptor(config)?; }
    if config.upstream_tls_mode == TlsMode::Required && config.upstream_tls_server_name.as_deref().unwrap_or_default().is_empty() {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "upstream TLS server name is empty"));
    }
    Ok(())
}
