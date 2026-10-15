use bytes::{Buf, BytesMut};
use std::io;
use std::sync::Arc;

use proxima_engine::{
    attestation::{AttestationConfig, AttestationLedger, SecurityState, TelemetrySummary},
    config::{Config, UpstreamTlsMode},
    dashboard,
    metrics::{self, QueryLatencyTracker},
    protocol::SSL_REQUEST_CODE,
    security_breaker::{BreakerConfig, SecurityBreaker},
    session::{establish, BoxedPgStream},
    tenant::TenantTokenVerifier,
    tls::{accept_client_tls, client_acceptor, connect_upstream_tls, upstream_connector},
};
use sha2::{Digest, Sha256};
use std::time::Instant;
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};
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
    let metrics_addr = std::env::var("PROXIMA_METRICS_LISTEN_ADDR")
        .unwrap_or_else(|_| "127.0.0.1:9090".to_string())
        .parse()
        .map_err(|error| {
            io::Error::new(
                io::ErrorKind::InvalidInput,
                format!("invalid PROXIMA_METRICS_LISTEN_ADDR: {error}"),
            )
        })?;
    let metrics_addr_for_task = metrics_addr;
    tokio::spawn(async move {
        if let Err(error) = metrics::serve(metrics_addr_for_task).await {
            error!(%error, "Prometheus metrics listener stopped");
        }
    });
    let breaker = SecurityBreaker::new(BreakerConfig::from_env());
    let security_event_url = std::env::var("PROXIMA_SECURITY_EVENT_INGEST_URL")
        .ok()
        .filter(|url| {
            url.starts_with("https://")
                || url.starts_with("http://127.0.0.1:")
                || url.starts_with("http://localhost:")
        });
    let security_event_token = std::env::var("PROXIMA_SECURITY_EVENT_INGEST_TOKEN")
        .or_else(|_| std::env::var("PROXIMA_ATTESTATION_INGEST_TOKEN"))
        .ok()
        .filter(|token| token.starts_with("aga_"));
    let security_event_client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .ok();
    let attestation_config = AttestationConfig::from_env();
    let attestation_signing_ready = attestation_config.signing_key.is_some();
    let attestation_p99 = std::env::var("PROXIMA_ATTESTATION_P99_OVERHEAD_MS")
        .ok()
        .and_then(|value| value.parse::<f64>().ok())
        .filter(|value| value.is_finite() && *value >= 0.0);
    if attestation_signing_ready && attestation_p99.is_some() {
        let ledger = Arc::new(AttestationLedger::new(attestation_config.clone()));
        let engine_config = config.clone();
        let configured_ingest_url = std::env::var("PROXIMA_ATTESTATION_INGEST_URL")
            .ok()
            .filter(|value| !value.trim().is_empty());
        let ingest_url = configured_ingest_url.clone().filter(|url| {
            url.starts_with("https://")
                || url.starts_with("http://127.0.0.1:")
                || url.starts_with("http://localhost:")
        });
        if configured_ingest_url.is_some() && ingest_url.is_none() {
            error!("attestation ingestion requires HTTPS except for loopback development URLs");
        }
        let ingest_token = std::env::var("PROXIMA_ATTESTATION_INGEST_TOKEN")
            .ok()
            .filter(|value| value.starts_with("aga_"));
        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .ok();
        if ingest_url.is_some() && (ingest_token.is_none() || http_client.is_none()) {
            error!("attestation ingestion URL is configured but a valid API token or HTTPS client is unavailable");
        }
        tokio::spawn(async move {
            let mut interval = tokio::time::interval_at(
                tokio::time::Instant::now() + std::time::Duration::from_secs(3600),
                std::time::Duration::from_secs(3600),
            );
            let mut previous_queries = 0u64;
            let mut previous_tenant_sessions = 0u64;
            let mut previous_violations = 0u64;
            let mut previous_breaker_trips = 0u64;
            loop {
                interval.tick().await;
                let snapshot = metrics::global();
                let current_queries = snapshot.processed_queries();
                let current_tenant_sessions = snapshot.authenticated_tenant_sessions();
                let current_violations = snapshot.blocked_violations();
                let current_breaker_trips = snapshot.breaker_trips();
                let telemetry = TelemetrySummary {
                    total_processed_queries: current_queries.saturating_sub(previous_queries),
                    authenticated_tenant_sessions: current_tenant_sessions
                        .saturating_sub(previous_tenant_sessions),
                    blocked_unauthorized_violations: current_violations
                        .saturating_sub(previous_violations),
                    p99_latency_overhead_ms: attestation_p99.unwrap_or(0.0),
                };
                let state = SecurityState {
                    force_rls_active: std::env::var("PROXIMA_ATTESTATION_FORCE_RLS_ACTIVE")
                        .ok()
                        .as_deref()
                        == Some("true"),
                    tls_termination_enforced: engine_config.require_client_tls
                        && engine_config.tls_cert_file.is_some(),
                    circuit_breaker_tripped: current_breaker_trips > previous_breaker_trips,
                };
                previous_queries = current_queries;
                previous_tenant_sessions = current_tenant_sessions;
                previous_violations = current_violations;
                previous_breaker_trips = current_breaker_trips;
                match ledger.append_hourly(telemetry, state).await {
                    Ok(hash) => {
                        if let (Some(url), Some(token), Some(client)) = (
                            ingest_url.as_deref(),
                            ingest_token.as_deref(),
                            http_client.as_ref(),
                        ) {
                            match ledger.latest_record().await {
                                Ok(Some(record)) => {
                                    match client.post(url)
                                        .bearer_auth(token)
                                        .header("content-type", "application/json")
                                        .body(record)
                                        .send()
                                        .await
                                    {
                                        Ok(response) if response.status().is_success() => {
                                            info!(block_hash = %hash, status = %response.status(), "signed attestation delivered to control plane");
                                        }
                                        Ok(response) => {
                                            error!(block_hash = %hash, status = %response.status(), "control plane rejected signed attestation");
                                        }
                                        Err(error) => {
                                            error!(block_hash = %hash, %error, "could not deliver signed attestation to control plane");
                                        }
                                    }
                                }
                                Ok(None) => error!("attestation ledger append succeeded but latest record was not found"),
                                Err(error) => error!(%error, "could not read latest attestation for delivery"),
                            }
                        }
                    }
                    Err(error) => {
                        error!(%error, "hourly security attestation could not be written")
                    }
                }
            }
        });
        info!("hourly signed attestation ledger enabled");
    } else {
        info!("hourly signed attestation ledger disabled until PROXIMA_ATTESTATION_SIGNING_KEY and measured PROXIMA_ATTESTATION_P99_OVERHEAD_MS are configured");
    }
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
        metrics = %metrics_addr,
        security_breaker = breaker_config_enabled(),
        max_connections = config.max_connections,
        "Agata Proxima engine listening"
    );

    loop {
        tokio::select! {
            accept = listener.accept() => {
                let (client, peer) = accept?;
                metrics::global().connection_accepted();
                if breaker.is_blocked(peer.ip()) {
                    metrics::global().connection_rejected();
                    error!(peer = %peer, "connection rejected by security breaker");
                    drop(client);
                    continue;
                }
                let permit = match connection_limit.clone().try_acquire_owned() {
                    Ok(permit) => permit,
                    Err(_) => {
                        metrics::global().connection_rejected();
                        error!(peer = %peer, "connection limit reached");
                        drop(client);
                        continue;
                    }
                };

                let breaker = breaker.clone();
                let security_event_url = security_event_url.clone();
                let security_event_token = security_event_token.clone();
                let security_event_client = security_event_client.clone();
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

                tokio::spawn(async move {
                    let _permit = permit;
                    if let Err(err) = handle_connection(
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
                    ).await {
                        metrics::global().session_failed();
                        let security_failure = matches!(err.kind(), io::ErrorKind::PermissionDenied | io::ErrorKind::InvalidData);
                        if security_failure {
                            metrics::global().violation_blocked();
                            if breaker.record_violation(peer.ip()) {
                                metrics::global().breaker_tripped();
                                error!(peer = %peer, "security breaker tripped for peer; cooldown enforced");
                                if let (Some(url), Some(token), Some(client)) = (
                                    security_event_url.clone(),
                                    security_event_token.clone(),
                                    security_event_client.clone(),
                                ) {
                                    let node_id = std::env::var("PROXIMA_NODE_ID").unwrap_or_else(|_| "local-node".to_string());
                                    let fingerprint = peer_fingerprint(peer.ip());
                                    tokio::spawn(async move {
                                        send_security_event(client, url, token, node_id, fingerprint).await;
                                    });
                                } else {
                                    error!("security breaker tripped but control-plane event delivery is not configured with an HTTPS endpoint and API token");
                                }
                            }
                        }
                        error!(peer = %peer, error = %err, "connection failed");
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
) -> io::Result<()> {
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

    let session_started_at = Instant::now();
    metrics::global().session_started(session.tenant_context.is_some());
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

    let (mut client_reader, mut client_writer) = tokio::io::split(client);
    let (mut upstream_reader, mut upstream_writer) = tokio::io::split(upstream);
    let query_latency = Arc::new(QueryLatencyTracker::default());
    let copy_result = tokio::try_join!(
        copy_frontend_messages(&mut client_reader, &mut upstream_writer, query_latency.clone()),
        copy_backend_messages(&mut upstream_reader, &mut client_writer, query_latency),
    );
    let duration_micros = session_started_at
        .elapsed()
        .as_micros()
        .min(u64::MAX as u128) as u64;
    match copy_result {
        Ok((client_bytes, upstream_bytes)) => {
            metrics::global().session_finished(client_bytes, upstream_bytes, duration_micros);
            info!(
                peer = %peer,
                client_to_database = client_bytes,
                database_to_client = upstream_bytes,
                "connection closed"
            );
            Ok(())
        }
        Err(error) => {
            metrics::global().session_finished(0, 0, duration_micros);
            Err(error)
        }
    }
}

fn peer_fingerprint(peer: std::net::IpAddr) -> String {
    format!("{:x}", Sha256::digest(peer.to_string().as_bytes()))
}

async fn send_security_event(
    client: reqwest::Client,
    url: String,
    token: String,
    node_id: String,
    peer_fingerprint: String,
) {
    let node_id: String = node_id
        .chars()
        .filter(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.')
        })
        .take(128)
        .collect();
    let observed_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or_default();
    let body = format!(
        "{{\"node_id\":\"{}\",\"event_type\":\"security.breaker.tripped\",\"severity\":\"critical\",\"peer_fingerprint\":\"{}\",\"reason\":\"Repeated PostgreSQL protocol or tenant-authentication violations\",\"observed_at\":{}}}",
        node_id, peer_fingerprint, observed_at
    );
    match client
        .post(url)
        .bearer_auth(token)
        .header("content-type", "application/json")
        .body(body)
        .send()
        .await
    {
        Ok(response) if response.status().is_success() => {
            info!(status = %response.status(), "security breaker event recorded by control plane");
        }
        Ok(response) => {
            error!(status = %response.status(), "control plane rejected security breaker event")
        }
        Err(error) => error!(%error, "security breaker event delivery failed"),
    }
}

async fn copy_backend_messages<R, W>(
    reader: &mut R,
    writer: &mut W,
    query_latency: Arc<QueryLatencyTracker>,
) -> io::Result<u64>
where
    R: AsyncRead + Unpin,
    W: AsyncWrite + Unpin,
{
    let mut buffer = [0u8; 16 * 1024];
    let mut pending = BytesMut::with_capacity(8 * 1024);
    let mut total = 0u64;
    loop {
        let size = reader.read(&mut buffer).await?;
        if size == 0 {
            writer.shutdown().await?;
            return Ok(total);
        }
        writer.write_all(&buffer[..size]).await?;
        total = total.saturating_add(size as u64);
        pending.extend_from_slice(&buffer[..size]);
        loop {
            if pending.len() < 5 { break; }
            let frame_length = i32::from_be_bytes(pending[1..5].try_into().unwrap());
            if frame_length < 4 || frame_length as usize > 16 * 1024 * 1024 {
                pending.clear();
                break;
            }
            let Some(total_length) = (frame_length as usize).checked_add(1) else {
                pending.clear();
                break;
            };
            if pending.len() < total_length { break; }
            if matches!(pending[0], b'C' | b'I' | b's' | b'E') {
                query_latency.finish();
            }
            pending.advance(total_length);
        }
        if pending.len() > 16 * 1024 * 1024 + 5 { pending.clear(); }
    }
}

async fn copy_frontend_messages<R, W>(
    reader: &mut R,
    writer: &mut W,
    query_latency: Arc<QueryLatencyTracker>,
) -> io::Result<u64>
where
    R: AsyncRead + Unpin,
    W: AsyncWrite + Unpin,
{
    let mut buffer = [0u8; 16 * 1024];
    let mut pending = BytesMut::with_capacity(8 * 1024);
    let mut total = 0u64;
    loop {
        let size = reader.read(&mut buffer).await?;
        if size == 0 {
            writer.shutdown().await?;
            return Ok(total);
        }
        writer.write_all(&buffer[..size]).await?;
        total = total.saturating_add(size as u64);
        pending.extend_from_slice(&buffer[..size]);
        loop {
            if pending.len() < 5 {
                break;
            }
            let frame_length = i32::from_be_bytes(pending[1..5].try_into().unwrap());
            if frame_length < 4 || frame_length as usize > 16 * 1024 * 1024 {
                // Preserve wire behavior: observer failures never mutate or suppress forwarded bytes.
                pending.clear();
                break;
            }
            let Some(total_length) = (frame_length as usize).checked_add(1) else {
                pending.clear();
                break;
            };
            if pending.len() < total_length {
                break;
            }
            if matches!(pending[0], b'Q' | b'E') {
                metrics::global().query_processed();
                query_latency.start();
            }
            pending.advance(total_length);
        }
        if pending.len() > 16 * 1024 * 1024 + 5 {
            pending.clear();
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

fn breaker_config_enabled() -> bool {
    let mode = std::env::var("PROXIMA_SECURITY_BREAKER")
        .or_else(|_| std::env::var("PROXIMA_SECURITY_CIRCUIT_BREAKER"))
        .unwrap_or_else(|_| "fail-closed".to_string());
    !matches!(
        mode.trim().to_ascii_lowercase().as_str(),
        "off" | "disabled" | "false" | "0"
    )
}
