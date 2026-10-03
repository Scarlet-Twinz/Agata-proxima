use std::io;

use proxima_engine::{config::Config, session::establish};
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
    let listener = TcpListener::bind(config.listen_addr).await?;

    info!(
        listen = %config.listen_addr,
        upstream = %config.upstream_addr,
        "Agata Proxima engine listening"
    );

    loop {
        let (client, peer) = listener.accept().await?;
        let upstream = config.upstream_addr.clone();

        tokio::spawn(async move {
            if let Err(err) = handle_connection(client, peer, &upstream).await {
                error!(peer = %peer, error = %err, "connection failed");
            }
        });
    }
}

async fn handle_connection(
    client: TcpStream,
    peer: std::net::SocketAddr,
    upstream_addr: &str,
) -> io::Result<()> {
    info!(peer = %peer, "client connected");

    let upstream = TcpStream::connect(upstream_addr).await?;
    let (mut client, mut upstream) = establish(client, upstream).await?;

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
