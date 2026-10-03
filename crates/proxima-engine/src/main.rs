use std::io;
use std::sync::Arc;
use std::time::Duration;

use proxima_engine::{
    admin::{self, AdminState, RuntimeMetrics},
    config::{ClientTlsMode, Config, UpstreamTlsMode},
    session::establish,
    tenant::TenantTokenVerifier,
    tls::{ProximaStream, TlsRuntime},
};
use tokio::io::copy_bidirectional;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Semaphore;
use tokio::time::timeout;
use tracing::{error, info};

#[derive(Clone)]
struct ConnectionContext {
    upstream_addr: String,
    verifier: Option<TenantTokenVerifier>,
    tenant_role_prefix: String,
    upstream_connect_timeout: Duration,
    tls: TlsRuntime,
    metrics: Arc<RuntimeMetrics>,
}

#[tokio::main]
async fn main() -> io::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "proxima_engine=info".to_string()),
        )
        .init();

    let config = Config::from_env()?;
    if config.upstream_tls_mode == UpstreamTlsMode::VerifyFull
        && config.client_tls_mode != ClientTlsMode::Required
    {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "upstream TLS verification requires PROXIMA_TLS_MODE=required so plaintext cannot enter the TLS-only enforcement boundary",
        ));
    }

    let verifier = config
        .tenant_signing_key
        .as_deref()
        .map(TenantTokenVerifier::new)
        .transpose()
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidInput, error.to_string()))?;

    let tls = TlsRuntime::from_config(&config)?;
    let listener = TcpListener::bind(config.listen_addr).await?;
    let connection_limit = Arc::new(Semaphore::new(config.max_connections));
    let metrics = Arc::new(RuntimeMetrics::default());
    metrics.start();

    let admin_state = AdminState {
        metrics: metrics.clone(),
        tls_active: config.client_tls_mode == ClientTlsMode::Required,
        tenant_enforcement: verifier.is_some(),
        upstream_tls: config.upstream_tls_mode == UpstreamTlsMode::VerifyFull,
        upstream_addr: config.upstream_addr.clone(),
    };
    let admin_task = tokio::spawn(admin::serve(config.admin_addr, admin_state));

    let context = ConnectionContext {
        upstream_addr: config.upstream_addr.clone(),
        verifier,
        tenant_role_prefix: config.tenant_role_prefix.clone(),
        upstream_connect_timeout: config.upstream_connect_timeout,
        tls,
        metrics: metrics.clone(),
    };

    info!(
        listen = %config.listen_addr,
        admin = %config.admin_addr,
        upstream = %config.upstream_addr,
        tenant_enforcement = context.verifier.is_some(),
        client_tls = ?config.client_tls_mode,
        upstream_tls = ?config.upstream_tls_mode,
        max_connections = config.max_connections,
        "Agata Proxima engine listening"
    );

    loop {
        tokio::select! {
            accept = listener.accept() => {
                let (client, peer) = accept?;
                let permit = match connection_limit.clone().try_acquire_owned() {
                    Ok(permit) => permit,
                    Err(_) => {
                        context.metrics.rejected();
                        error!(peer = %peer, "connection limit reached");
                        drop(client);
                        continue;
                    }
                };

                let context = context.clone();

                tokio::spawn(async move {
                    let _permit = permit;
                    if let Err(err) = handle_connection(client, peer, context).await {
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

    admin_task.abort();
    Ok(())
}

async fn handle_connection(
    client: TcpStream,
    peer: std::net::SocketAddr,
    context: ConnectionContext,
) -> io::Result<()> {
    info!(peer = %peer, "client connected");

    let (client, client_tls) = if context.tls.client_mode == ClientTlsMode::Required {
        context.tls.accept_client(client).await?
    } else {
        (ProximaStream::Plain(client), false)
    };

    let upstream_tcp = timeout(
        context.upstream_connect_timeout,
        TcpStream::connect(&context.upstream_addr),
    )
    .await
    .map_err(|_| io::Error::new(io::ErrorKind::TimedOut, "upstream connection timed out"))??;

    let upstream = if context.tls.upstream_mode == UpstreamTlsMode::VerifyFull {
        context.tls.connect_upstream(upstream_tcp).await?
    } else {
        ProximaStream::Plain(upstream_tcp)
    };

    context.metrics.connection_opened(client_tls);
    let result = run_session(
        client,
        upstream,
        context.verifier.as_ref(),
        &context.tenant_role_prefix,
        peer,
    )
    .await;
    context.metrics.connection_closed();
    result
}

async fn run_session(
    client: ProximaStream,
    upstream: ProximaStream,
    verifier: Option<&TenantTokenVerifier>,
    tenant_role_prefix: &str,
    peer: std::net::SocketAddr,
) -> io::Result<()> {
    let (mut client, mut upstream, session) =
        establish(client, upstream, verifier, tenant_role_prefix).await?;

    info!(
        peer = %peer,
        tenant = session
            .tenant_context
            .as_ref()
            .map(|context| context.tenant_id.as_str())
            .unwrap_or("unbound"),
        "PostgreSQL session established"
    );

    let (client_bytes, upstream_bytes) = copy_bidirectional(&mut client, &mut upstream).await?;

    info!(
        peer = %peer,
        client_to_database = client_bytes,
        database_to_client = upstream_bytes,
        "connection closed"
    );

    Ok(())
}
