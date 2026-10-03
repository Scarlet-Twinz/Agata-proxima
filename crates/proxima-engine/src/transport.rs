use std::io;
use std::sync::Arc;

use rustls::pki_types::{CertificateDer, PrivateKeyDer, ServerName};
use rustls::{ClientConfig, RootCertStore, ServerConfig};
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt, ReadBuf};
use tokio::net::TcpStream;
use tokio::time::{timeout, Duration};
use tokio_rustls::{TlsAcceptor, TlsConnector};

pub trait ProximaIo: AsyncRead + AsyncWrite + Unpin + Send {}
impl<T> ProximaIo for T where T: AsyncRead + AsyncWrite + Unpin + Send {}
pub type BoxedIo = Box<dyn ProximaIo>;

pub fn boxed<T: ProximaIo + 'static>(stream: T) -> BoxedIo { Box::new(stream) }

fn pem_certs(path: &str) -> io::Result<Vec<CertificateDer<'static>>> {
    let file = std::fs::File::open(path)?;
    let mut reader = std::io::BufReader::new(file);
    rustls_pemfile::certs(&mut reader).collect::<Result<Vec<_>, _>>()
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, format!("invalid certificate PEM: {e}")))
}

fn pem_key(path: &str) -> io::Result<PrivateKeyDer<'static>> {
    let file = std::fs::File::open(path)?;
    let mut reader = std::io::BufReader::new(file);
    rustls_pemfile::private_key(&mut reader)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, format!("invalid private key PEM: {e}")))?
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "private key PEM contains no private key"))
}

pub fn server_config(cert_path: &str, key_path: &str) -> io::Result<Arc<ServerConfig>> {
    let certs = pem_certs(cert_path)?;
    let key = pem_key(key_path)?;
    if certs.is_empty() {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "TLS certificate chain is empty"));
    }
    let config = ServerConfig::builder()
        .with_no_client_auth()
        .with_single_cert(certs, key)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, format!("invalid TLS certificate/key: {e}")))?;
    Ok(Arc::new(config))
}

pub fn client_config(ca_path: &str) -> io::Result<Arc<ClientConfig>> {
    let certs = pem_certs(ca_path)?;
    if certs.is_empty() {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "upstream CA bundle is empty"));
    }
    let mut roots = RootCertStore::empty();
    for cert in certs {
        roots.add(cert).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, format!("invalid upstream CA certificate: {e}")))?;
    }
    Ok(Arc::new(ClientConfig::builder().with_root_certificates(roots).with_no_client_auth()))
}

pub async fn accept_postgres_tls(
    mut stream: TcpStream,
    acceptor: TlsAcceptor,
    timeout_duration: Duration,
) -> io::Result<BoxedIo> {
    let mut request = [0u8; 8];
    timeout(timeout_duration, stream.read_exact(&mut request)).await
        .map_err(|_| io::Error::new(io::ErrorKind::TimedOut, "client TLS negotiation timed out"))??;

    if i32::from_be_bytes(request[..4].try_into().unwrap()) != 8
        || i32::from_be_bytes(request[4..].try_into().unwrap()) != crate::protocol::SSL_REQUEST_CODE
    {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "TLS-required Proxima listener requires a PostgreSQL SSLRequest"));
    }

    stream.write_all(b"S").await?;
    let tls = timeout(timeout_duration, acceptor.accept(stream)).await
        .map_err(|_| io::Error::new(io::ErrorKind::TimedOut, "client TLS handshake timed out"))?
        .map_err(|e| io::Error::new(io::ErrorKind::PermissionDenied, format!("client TLS handshake failed: {e}")))?;
    Ok(boxed(tls))
}

pub async fn connect_postgres_tls(
    mut stream: TcpStream,
    connector: TlsConnector,
    server_name: ServerName<'static>,
    timeout_duration: Duration,
) -> io::Result<BoxedIo> {
    let mut request = Vec::with_capacity(8);
    request.extend_from_slice(&8i32.to_be_bytes());
    request.extend_from_slice(&crate::protocol::SSL_REQUEST_CODE.to_be_bytes());
    stream.write_all(&request).await?;

    let mut response = [0u8; 1];
    timeout(timeout_duration, stream.read_exact(&mut response)).await
        .map_err(|_| io::Error::new(io::ErrorKind::TimedOut, "upstream TLS negotiation timed out"))??;
    if response[0] != b'S' {
        return Err(io::Error::new(io::ErrorKind::PermissionDenied, "PostgreSQL upstream refused TLS"));
    }

    let tls = timeout(timeout_duration, connector.connect(server_name, stream)).await
        .map_err(|_| io::Error::new(io::ErrorKind::TimedOut, "upstream TLS handshake timed out"))?
        .map_err(|e| io::Error::new(io::ErrorKind::PermissionDenied, format!("upstream TLS handshake failed: {e}")))?;
    Ok(boxed(tls))
}

pub fn connector(config: Arc<ClientConfig>) -> TlsConnector { TlsConnector::from(config) }
pub fn acceptor(config: Arc<ServerConfig>) -> TlsAcceptor { TlsAcceptor::from(config) }
