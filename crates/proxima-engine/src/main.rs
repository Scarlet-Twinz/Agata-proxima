use std::io;

use proxima_engine::{
    config::Config,
    session::establish,
    tenant::TenantTokenVerifier,
};
use tokio::io::copy_bidirectional;
use tokio::net::{TcpListener, TcpStream};
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

        tokio::spawn(async move {
            if let Err(err) = handle_connection(
                client,
                peer,
                &upstream,
                verifier.as_ref(),
                &tenant_role_prefix,
            ).await {
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
) -> io::Result<()> {
    info!(peer = %peer, "client connected");

    let upstream = TcpStream::connect(upstream_addr).await?;
    let (mut client, mut upstream, session) =
        establish(client, upstream, verifier).await?;

    info!(
        peer = %peer,
        tenant = session.tenant_context.as_ref().map(|context| context.tenant_id.as_str()).unwrap_or("unbound"),
        "PostgreSQL session established"
    );

    let (client_bytes, upstream_bytes) =
        copy_bidirectional(&mut client, &mut upstream).await?;

    info!(
        peer = %peer,
        client_to_database = client_bytes,
        database_to_client = upstream_bytes,
        "connection closed"
    );

    Ok(())
}
