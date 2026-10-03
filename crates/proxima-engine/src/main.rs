use proxima_engine::{
    config::{Config, TlsMode},
    session::establish,
    tenant::TenantTokenVerifier,
    telemetry::Telemetry,
    transport::{
        accept_postgres_tls, acceptor, boxed, client_config, connect_postgres_tls, connector,
        server_config, BoxedIo,
    },
};
use std::io;
use std::sync::Arc;
use tokio::io::copy_bidirectional;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Semaphore;
use tokio::time::timeout;
use tracing::{error, info};

#[tokio::main]
async fn main() -> io::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(std::env::var("RUST_LOG").unwrap_or_else(|_| "proxima_engine=info".into()))
        .init();
    let config = Config::from_env()?;
    let verifier = config
        .tenant_signing_key
        .as_deref()
        .map(TenantTokenVerifier::new)
        .transpose()
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidInput, e.to_string()))?;
    let tls_acceptor = match (&config.tls_cert_file, &config.tls_key_file, config.tls_mode) {
        (Some(c), Some(k), TlsMode::Required) => Some(acceptor(server_config(c, k)?)),
        _ => None,
    };
    let upstream_connector = match (
        &config.upstream_tls_ca_file,
        &config.upstream_tls_server_name,
        config.upstream_tls_mode,
    ) {
        (Some(ca), Some(_), TlsMode::Required) => Some(connector(client_config(ca)?)),
        _ => None,
    };
    let telemetry = Telemetry::new();
    let telemetry_server = {
        let telemetry = telemetry.clone();
        let addr = config.telemetry_addr;
        let tls = matches!(config.tls_mode, TlsMode::Required);
        let upstream_tls = matches!(config.upstream_tls_mode, TlsMode::Required);
        let enforcement = verifier.is_some();
        tokio::spawn(async move {
            if let Err(err) = proxima_engine::telemetry::serve(addr, telemetry, tls, upstream_tls, enforcement).await {
                error!(error=%err, "telemetry server stopped");
            }
        })
    };
    let listener = TcpListener::bind(config.listen_addr).await?;
    let limit = Arc::new(Semaphore::new(config.max_connections));
    info!(listen=%config.listen_addr,upstream=%config.upstream_addr,tenant_enforcement=verifier.is_some(),tls=matches!(config.tls_mode,TlsMode::Required),upstream_tls=matches!(config.upstream_tls_mode,TlsMode::Required),max_connections=config.max_connections,telemetry=%config.telemetry_addr,"Agata Proxima engine listening");
    loop {
        tokio::select! {
         accept=listener.accept()=>{let(client,peer)=accept?;let permit=match limit.clone().try_acquire_owned(){Ok(p)=>p,Err(_)=>{error!(peer=%peer,"connection limit reached");telemetry.rejected();drop(client);continue}};
          let config=config.clone();let verifier=verifier.clone();let tls_acceptor=tls_acceptor.clone();let upstream_connector=upstream_connector.clone();let telemetry=telemetry.clone();
          tokio::spawn(async move{let _permit=permit;let active=telemetry.accepted();if let Err(e)=handle_connection(client,peer,config,verifier.as_ref(),tls_acceptor,upstream_connector,telemetry.clone()).await{error!(peer=%peer,error=%e,"connection failed");}drop(active);});
         }
         _=tokio::signal::ctrl_c()=>{info!("shutdown signal received");break}
        }
    }
    telemetry_server.abort();
    Ok(())
}

async fn handle_connection(
    client: TcpStream,
    peer: std::net::SocketAddr,
    config: Config,
    verifier: Option<&TenantTokenVerifier>,
    tls_acceptor: Option<tokio_rustls::TlsAcceptor>,
    upstream_connector: Option<tokio_rustls::TlsConnector>,
    telemetry: Telemetry,
) -> io::Result<()> {
    info!(peer=%peer,"client connected");
    let client: BoxedIo = match (config.tls_mode, tls_acceptor) {
        (TlsMode::Required, Some(a)) => {
            let stream = accept_postgres_tls(client, a, config.tls_handshake_timeout).await?;
            telemetry.tls_session();
            stream
        }
        (TlsMode::Disabled, None) => boxed(client),
        _ => {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "invalid TLS configuration",
            ))
        }
    };
    let upstream_tcp = match timeout(config.upstream_connect_timeout, TcpStream::connect(&config.upstream_addr)).await {
        Ok(Ok(stream)) => stream,
        Ok(Err(err)) => {
            telemetry.upstream_failure();
            return Err(err);
        }
        Err(_) => {
            telemetry.upstream_failure();
            return Err(io::Error::new(io::ErrorKind::TimedOut, "upstream connection timed out"));
        }
    };
    let upstream: BoxedIo = if let Some(connector) = upstream_connector {
        let name = match config.upstream_tls_server_name.clone().unwrap().try_into() {
            Ok(name) => name,
            Err(_) => {
                telemetry.upstream_failure();
                return Err(io::Error::new(io::ErrorKind::InvalidInput, "invalid upstream TLS server name"));
            }
        };
        match connect_postgres_tls(upstream_tcp, connector, name, config.tls_handshake_timeout).await {
            Ok(stream) => stream,
            Err(err) => {
                telemetry.upstream_failure();
                return Err(err);
            }
        }
    } else {
        boxed(upstream_tcp)
    };
    let (mut client, mut upstream, session) =
        establish(client, upstream, verifier, &config.tenant_role_prefix).await?;
    info!(peer=%peer,tenant=session.tenant_context.as_ref().map(|c|c.tenant_id.as_str()).unwrap_or("unbound"),"PostgreSQL session established");
    let (a, b) = copy_bidirectional(&mut client, &mut upstream).await?;
    info!(peer=%peer,client_to_database=a,database_to_client=b,"connection closed");
    Ok(())
}
