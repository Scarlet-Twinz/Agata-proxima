use std::env;
use std::io;
use std::net::SocketAddr;

use tokio::io::copy_bidirectional;
use tokio::net::{TcpListener, TcpStream};
use tracing::{error, info};

#[tokio::main]
async fn main() -> io::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            env::var("RUST_LOG").unwrap_or_else(|_| "proxima_engine=info".to_string()),
        )
        .init();

    let listen_addr = env::var("PROXIMA_LISTEN_ADDR")
        .unwrap_or_else(|_| "127.0.0.1:6432".to_string());

    let upstream_addr = env::var("PROXIMA_UPSTREAM_ADDR")
        .unwrap_or_else(|_| "127.0.0.1:5432".to_string());

    let listener = TcpListener::bind(&listen_addr).await?;

    info!(
        listen = %listen_addr,
        upstream = %upstream_addr,
        "Agata Proxima engine listening"
    );

    loop {
        let (client, peer) = listener.accept().await?;
        let upstream = upstream_addr.clone();

        tokio::spawn(async move {
            if let Err(err) = handle_connection(client, peer, &upstream).await {
                error!(peer = %peer, error = %err, "connection failed");
            }
        });
    }
}

async fn handle_connection(
    mut client: TcpStream,
    peer: SocketAddr,
    upstream_addr: &str,
) -> io::Result<()> {
    info!(peer = %peer, "client connected");

    let mut upstream = TcpStream::connect(upstream_addr).await?;

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
