use std::io;
use std::sync::Arc;

use proxima_engine::{
    config::{Config, UpstreamTlsMode},
    dashboard,
    monitor::EngineMetrics,
    breaker::PeerCircuitBreaker,
    protocol::SSL_REQUEST_CODE,
    session::{establish, BoxedPgStream},
    tenant::TenantTokenVerifier,
    tls::{accept_client_tls, client_acceptor, connect_upstream_tls, upstream_connector},
};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Semaphore;
use tokio::time::timeout;
use tracing::{error, info};

#[tokio::main]
async fn main() -> io::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "proxima_engine=info".to_string()),
        )
        .init();

    let config = Config::from_env()?;
    let metrics = Arc::new(EngineMetrics::default());
    let breaker = Arc::new(PeerCircuitBreaker::from_env()?);
    let force_rls_active = std::env::var("PROXIMA_ATTEST_FORCE_RLS_ACTIVE")
        .map(|value| matches!(value.trim().to_ascii_lowercase().as_str(), "1" | "true" | "yes" | "on"))
        .unwrap_or(false);
    let attestation_metrics = metrics.clone();
    let attestation_breaker = breaker.clone();
    let attestation_tls_enforced = config.require_client_tls;
    tokio::spawn(async move {
        proxima_engine::attestation_reporter::run(
            attestation_metrics,
            attestation_breaker,
            force_rls_active,
            attestation_tls_enforced,
        ).await;
    });
    let metrics_enabled = std::env::var("PROXIMA_METRICS_ENABLED")
        .map(|value| !matches!(value.trim().to_ascii_lowercase().as_str(), "0" | "false" | "no" | "off"))
        .unwrap_or(true);
    if metrics_enabled {
        let metrics_addr = std::env::var("PROXIMA_METRICS_LISTEN_ADDR")
            .unwrap_or_else(|_| "127.0.0.1:9090".to_string())
            .parse()
            .map_err(|error| io::Error::new(io::ErrorKind::InvalidInput, format!("invalid PROXIMA_METRICS_LISTEN_ADDR: {error}")))?;
        let metrics_for_server = metrics.clone();
        tokio::spawn(async move {
            if let Err(error) = proxima_engine::monitor::serve(metrics_addr, metrics_for_server).await {
                error!(%error, "Prometheus metrics server stopped");
            }
        });
        info!(listen = %metrics_addr, "Prometheus metrics endpoint enabled");
    }
    let config_tenant_role_prefix = config.tenant_role_prefix.clone();

    let verifier = config
        .tenant_signing_key
        .as_deref()
        .map(TenantTokenVerifier::new)
        .transpose()
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidInput, error.to_string()))?;

    let client_acceptor = client_acceptor(&config)?;
    let upstream_connector = upstream_connector(&config)?;

    if config.require_client_tls && client_acceptor.is_none() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "client TLS is required but no certificate/key is configured",
        ));
    }

    let listener = TcpListener::bind(config.listen_addr).await?;
    let connection_limit = Arc::new(Semaphore::new(config.max_connections));

    if config.dashboard_enabled {
        let dashboard_addr = config.dashboard_listen_addr;
        tokio::spawn(async move {
            if let Err(error) = dashboard::serve(dashboard_addr).await {
                error!(%error, "dashboard server stopped");
            }
        });
    }

    info!(
        listen = %config.listen_addr,
        upstream = %config.upstream_addr,
        tenant_enforcement = verifier.is_some(),
        client_tls = client_acceptor.is_some(),
        require_client_tls = config.require_client_tls,
        upstream_tls = config.upstream_tls_mode != UpstreamTlsMode::Disable,
        dashboard = config.dashboard_enabled,
        max_connections = config.max_connections,
        "Agata Proxima engine listening"
    );

    loop {
        tokio::select! {
            accept = listener.accept() => {
                let (client, peer) = accept?;
                if breaker.is_blocked(peer.ip()) {
                    metrics.connection_rejected();
                    drop(client);
                    continue;
                }
                let permit = match connection_limit.clone().try_acquire_owned() {
                    Ok(permit) => permit,
                    Err(_) => {
                        error!(peer = %peer, "connection limit reached");
                        metrics.connection_rejected();
                        drop(client);
                        continue;
                    }
                };

                let upstream = config.upstream_addr.clone();
                let verifier = verifier.clone();
                let tenant_role_prefix = config_tenant_role_prefix.clone();
                let upstream_connect_timeout = config.upstream_connect_timeout;
                let client_acceptor = client_acceptor.clone();
                let upstream_connector = upstream_connector.clone();
                let client_tls_timeout = config.tls_handshake_timeout;
                let upstream_tls_timeout = config.upstream_tls_handshake_timeout;
                let require_client_tls = config.require_client_tls;
                let upstream_tls_mode = config.upstream_tls_mode;
                let upstream_tls_server_name = config.upstream_tls_server_name.clone();
                let connection_metrics = metrics.clone();
                let connection_breaker = breaker.clone();
                connection_metrics.connection_started();

                tokio::spawn(async move {
                    let _permit = permit;
                    match handle_connection(
                        client,
                        peer,
                        &upstream,
                        verifier.as_ref(),
                        &tenant_role_prefix,
                        upstream_connect_timeout,
                        client_acceptor.as_ref(),
                        upstream_connector.as_ref(),
                        client_tls_timeout,
                        upstream_tls_timeout,
                        require_client_tls,
                        upstream_tls_mode,
                        upstream_tls_server_name.as_deref(),
                        connection_metrics.clone(),
                    ).await {
                        Ok((client_bytes, upstream_bytes)) => {
                            connection_metrics.connection_finished(false, client_bytes, upstream_bytes);
                        }
                        Err(err) => {
                            if matches!(err.kind(), io::ErrorKind::PermissionDenied | io::ErrorKind::InvalidData) {
                                connection_metrics.unauthorized_violation();
                                if connection_breaker.record_failure(peer.ip()) {
                                    connection_metrics.breaker_trip_event();
                                    error!(peer = %peer, "security breaker opened for peer after repeated malformed or unauthorized handshakes");
                                }
                            }
                            error!(peer = %peer, error = %err, "connection failed");
                            connection_metrics.connection_finished(true, 0, 0);
                        }
                    }
                });
            }
            _ = tokio::signal::ctrl_c() => {
                info!("shutdown signal received");
                break;
            }
        }
    }

    Ok(())
}

#[allow(clippy::too_many_arguments)]
async fn handle_connection(
    mut client: TcpStream,
    peer: std::net::SocketAddr,
    upstream_addr: &str,
    verifier: Option<&TenantTokenVerifier>,
    tenant_role_prefix: &str,
    upstream_connect_timeout: std::time::Duration,
    client_acceptor: Option<&tokio_rustls::TlsAcceptor>,
    upstream_connector: Option<&tokio_rustls::TlsConnector>,
    client_tls_timeout: std::time::Duration,
    upstream_tls_timeout: std::time::Duration,
    require_client_tls: bool,
    upstream_tls_mode: UpstreamTlsMode,
    upstream_tls_server_name: Option<&str>,
    metrics: Arc<EngineMetrics>,
) -> io::Result<(u64, u64)> {
    info!(peer = %peer, "client connected");

    let client_is_tls = client_wants_tls(&client).await?;
    let client: BoxedPgStream = if client_is_tls {
        let acceptor = client_acceptor.ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::PermissionDenied,
                "client requested TLS but Proxima TLS termination is disabled",
            )
        })?;
        let mut request = [0u8; 8];
        client.read_exact(&mut request).await?;
        client.write_all(b"S").await?;
        Box::new(accept_client_tls(acceptor, client, client_tls_timeout).await?)
    } else {
        if require_client_tls {
            return Err(io::Error::new(
                io::ErrorKind::PermissionDenied,
                "plaintext PostgreSQL connection rejected because TLS is required",
            ));
        }
        Box::new(client)
    };

    let upstream_tcp = timeout(upstream_connect_timeout, TcpStream::connect(upstream_addr))
        .await
        .map_err(|_| io::Error::new(io::ErrorKind::TimedOut, "upstream connection timed out"))??;

    let upstream: BoxedPgStream = if upstream_tls_mode != UpstreamTlsMode::Disable {
        let connector = upstream_connector.ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::InvalidInput,
                "upstream TLS connector is not configured",
            )
        })?;
        let server_name = upstream_tls_server_name.ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::InvalidInput,
                "upstream TLS server name is required",
            )
        })?;
        let tls = connect_upstream_tls(connector, upstream_tcp, server_name, upstream_tls_timeout)
            .await?;
        Box::new(tls)
    } else {
        Box::new(upstream_tcp)
    };

    let (mut client, mut upstream, session) =
        establish(client, upstream, verifier, tenant_role_prefix).await?;

    let authenticated_tenant = session.tenant_context.is_some();
    if authenticated_tenant {
        metrics.tenant_session_authenticated();
    }
    info!(
        peer = %peer,
        tenant = session
            .tenant_context
            .as_ref()
            .map(|context| context.tenant_id.as_str())
            .unwrap_or("unbound"),
        client_tls = client_is_tls,
        upstream_tls = upstream_tls_mode != UpstreamTlsMode::Disable,
        "PostgreSQL session established"
    );

    let (mut client_read, mut client_write) = tokio::io::split(client);
    let (mut upstream_read, mut upstream_write) = tokio::io::split(upstream);
    let client_to_upstream = copy_client_messages(
        &mut client_read,
        &mut upstream_write,
        metrics.clone(),
    );
    let upstream_to_client = tokio::io::copy(&mut upstream_read, &mut client_write);
    let (client_bytes, upstream_bytes) = tokio::try_join!(client_to_upstream, upstream_to_client)?;

    info!(
        peer = %peer,
        client_to_database = client_bytes,
        database_to_client = upstream_bytes,
        "connection closed"
    );
    Ok((client_bytes, upstream_bytes))
}


/// Count PostgreSQL simple-query (Q) and extended Execute (E) frontend
/// messages while forwarding the original byte stream unchanged.
async fn copy_client_messages<R, W>(
    reader: &mut R,
    writer: &mut W,
    metrics: Arc<EngineMetrics>,
) -> io::Result<u64>
where
    R: tokio::io::AsyncRead + Unpin,
    W: tokio::io::AsyncWrite + Unpin,
{
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let mut buffer = [0u8; 16 * 1024];
    let mut frame_type: Option<u8> = None;
    let mut length_bytes = [0u8; 4];
    let mut length_read = 0usize;
    let mut payload_remaining = 0u32;
    let mut total_bytes = 0u64;

    loop {
        let read = reader.read(&mut buffer).await?;
        if read == 0 {
            writer.shutdown().await?;
            return Ok(total_bytes);
        }
        writer.write_all(&buffer[..read]).await?;
        total_bytes = total_bytes.saturating_add(read as u64);

        for byte in &buffer[..read] {
            if payload_remaining > 0 {
                payload_remaining -= 1;
                continue;
            }
            if frame_type.is_none() {
                frame_type = Some(*byte);
                length_read = 0;
                continue;
            }
            length_bytes[length_read] = *byte;
            length_read += 1;
            if length_read == 4 {
                let length = u32::from_be_bytes(length_bytes);
                if length < 4 || length > 64 * 1024 * 1024 {
                    // Telemetry parser fails open: it never changes forwarded
                    // bytes or protocol handling. Reset so subsequent frames
                    // can still be observed after malformed input.
                    frame_type = None;
                    length_read = 0;
                    continue;
                }
                if matches!(frame_type, Some(b'Q' | b'E')) {
                    metrics.query_processed();
                }
                payload_remaining = length - 4;
                frame_type = None;
                length_read = 0;
            }
        }
    }
}

async fn client_wants_tls(client: &TcpStream) -> io::Result<bool> {
    let mut probe = [0u8; 8];
    let n = timeout(std::time::Duration::from_secs(10), async {
        loop {
            let n = client.peek(&mut probe).await?;
            if n >= 8 || n == 0 {
                break Ok::<usize, io::Error>(n);
            }
            tokio::task::yield_now().await;
        }
    })
    .await
    .map_err(|_| {
        io::Error::new(
            io::ErrorKind::TimedOut,
            "waiting for PostgreSQL startup packet timed out",
        )
    })??;

    if n < 8 {
        return Ok(false);
    }

    let length = i32::from_be_bytes(probe[..4].try_into().unwrap());
    let code = i32::from_be_bytes(probe[4..8].try_into().unwrap());
    Ok(length == 8 && code == SSL_REQUEST_CODE)
}
