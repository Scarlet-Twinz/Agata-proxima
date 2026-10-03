use std::io;
use std::sync::Arc;
use std::time::Duration;

use proxima_engine::{config::Config, session::establish, tenant::TenantTokenVerifier};
use tokio::io::copy_bidirectional;
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
    let tenant_role_password = config.tenant_role_password.clone();
    let max_connections = config.max_connections;
    let startup_timeout = Duration::from_millis(config.startup_timeout_ms);
    let connection_slots = Arc::new(Semaphore::new(max_connections));

    let verifier = config
        .tenant_signing_key
        .as_deref()
        .map(TenantTokenVerifier::new)
        .transpose()
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidInput, error.to_string()))?;

    let listener = TcpListener::bind(config.listen_addr).await?;

    info!(
        listen = %config.listen_addr,
        upstream = %config.upstream_addr,
        tenant_enforcement = verifier.is_some(),
        "Agata Proxima engine listening"
    );

    loop {
        let (client, peer) = listener.accept().await?;
        let upstream = config.upstream_addr.clone();
        let verifier = verifier.clone();
        let tenant_role_prefix = config_tenant_role_prefix.clone();
        let tenant_role_password = tenant_role_password.clone();
        let startup_timeout = startup_timeout;
        let connection_slots = connection_slots.clone();

        let permit = match connection_slots.try_acquire_owned() {
            Ok(permit) => permit,
            Err(_) => {
                error!(peer = %peer, "connection rejected: Proxima connection limit reached");
                continue;
            }
        };

        tokio::spawn(async move {
            let _permit = permit;
            if let Err(err) = handle_connection(
                client,
                peer,
                &upstream,
                verifier.as_ref(),
                &tenant_role_prefix,
                tenant_role_password.as_deref(),
            )
            .await
            {
                error!(peer = %peer, error = %err, "connection failed");
            }
        });
    }
}

async fn handle_connection(
    client: TcpStream,
    peer: std::net::SocketAddr,
    upstream_addr: &str,
    verifier: Option<&TenantTokenVerifier>,
    tenant_role_prefix: &str,
    tenant_role_password: Option<&str>,
) -> io::Result<()> {
    info!(peer = %peer, "client connected");

    let upstream = TcpStream::connect(upstream_addr).await?;
    let (mut client, mut upstream, session) = timeout(
        startup_timeout,
        establish(
            client,
            upstream,
            verifier,
            tenant_role_prefix,
            tenant_role_password,
        ),
    )
    .await
    .map_err(|_| {
        io::Error::new(
            io::ErrorKind::TimedOut,
            "PostgreSQL startup/authentication exceeded Proxima startup timeout",
        )
    })??;

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
