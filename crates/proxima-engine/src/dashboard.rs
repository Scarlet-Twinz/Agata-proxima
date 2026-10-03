use crate::config::Config;
use std::io;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

const INDEX: &str = include_str!("../../../dashboard/index.html");
const LOGO: &str = include_str!("../../../dashboard/logo.svg");
const PLATFORM_HOME: &str = include_str!("../../../platform/index.html");
const PLATFORM_LOGIN: &str = include_str!("../../../platform/login.html");
const PLATFORM_SIGNUP: &str = include_str!("../../../platform/signup.html");
const PLATFORM_DOCS: &str = include_str!("../../../platform/docs.html");
const PLATFORM_PRICING: &str = include_str!("../../../platform/pricing.html");
const PLATFORM_SUPPORT: &str = include_str!("../../../platform/support.html");
const PLATFORM_APP: &str = include_str!("../../../platform/app.html");
const PLATFORM_CSS: &str = include_str!("../../../platform/styles.css");
const PLATFORM_JS: &str = include_str!("../../../platform/app.js");
const PLATFORM_LOGO: &str = include_str!("../../../platform/logo.svg");

pub async fn serve(addr: std::net::SocketAddr) -> io::Result<()> {
    let listener = TcpListener::bind(addr).await?;
    tracing::info!(%addr, "Proxima dashboard listening");

    loop {
        let (mut stream, _) = listener.accept().await?;
        tokio::spawn(async move {
            if let Err(error) = handle(&mut stream).await {
                tracing::debug!(%error, "dashboard request failed");
            }
        });
    }
}

async fn handle(stream: &mut tokio::net::TcpStream) -> io::Result<()> {
    let mut request = [0u8; 4096];
    let size = stream.read(&mut request).await?;
    if size == 0 {
        return Ok(());
    }
    let request = String::from_utf8_lossy(&request[..size]);
    let path = request.split_whitespace().nth(1).unwrap_or("/");

    match path {
        "/" => respond(stream, "200 OK", "text/html; charset=utf-8", INDEX).await,
        "/logo.svg" => respond(stream, "200 OK", "image/svg+xml", LOGO).await,
        "/platform/logo.svg" => respond(stream, "200 OK", "image/svg+xml", PLATFORM_LOGO).await,
        "/platform/styles.css" => {
            respond(stream, "200 OK", "text/css; charset=utf-8", PLATFORM_CSS).await
        }
        "/platform/app.js" => {
            respond(
                stream,
                "200 OK",
                "application/javascript; charset=utf-8",
                PLATFORM_JS,
            )
            .await
        }
        "/home" => respond(stream, "200 OK", "text/html; charset=utf-8", PLATFORM_HOME).await,
        "/login" => respond(stream, "200 OK", "text/html; charset=utf-8", PLATFORM_LOGIN).await,
        "/signup" => {
            respond(
                stream,
                "200 OK",
                "text/html; charset=utf-8",
                PLATFORM_SIGNUP,
            )
            .await
        }
        "/docs" => respond(stream, "200 OK", "text/html; charset=utf-8", PLATFORM_DOCS).await,
        "/pricing" => {
            respond(
                stream,
                "200 OK",
                "text/html; charset=utf-8",
                PLATFORM_PRICING,
            )
            .await
        }
        "/support" => {
            respond(
                stream,
                "200 OK",
                "text/html; charset=utf-8",
                PLATFORM_SUPPORT,
            )
            .await
        }
        "/app" => respond(stream, "200 OK", "text/html; charset=utf-8", PLATFORM_APP).await,
        "/health" => respond(stream, "200 OK", "text/plain; charset=utf-8", "ok\n").await,
        "/api/status" => {
            let config = Config::from_env()?;
            let body = format!(
                "{{\"tenant_enforcement\":{},\"client_tls\":{},\"upstream_tls\":{},\"listen_addr\":\"{}\",\"upstream_addr\":\"{}\",\"max_connections\":{}}}",
                config.tenant_signing_key.is_some(),
                config.tls_cert_file.is_some(),
                config.upstream_tls_mode != crate::config::UpstreamTlsMode::Disable,
                config.listen_addr,
                escape_json(&config.upstream_addr),
                config.max_connections
            );
            respond(stream, "200 OK", "application/json; charset=utf-8", &body).await
        }
        _ => {
            respond(
                stream,
                "404 Not Found",
                "text/plain; charset=utf-8",
                "not found\n",
            )
            .await
        }
    }
}

async fn respond(
    stream: &mut tokio::net::TcpStream,
    status: &str,
    content_type: &str,
    body: &str,
) -> io::Result<()> {
    let header = format!(
        "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n",
        body.len()
    );
    stream.write_all(header.as_bytes()).await?;
    stream.write_all(body.as_bytes()).await?;
    stream.shutdown().await
}

fn escape_json(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}
