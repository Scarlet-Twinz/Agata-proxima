use proxima_engine::transport::{accept_postgres_tls, acceptor, client_config, connect_postgres_tls, connector, server_config};
use rcgen::generate_simple_self_signed;
use rustls::pki_types::ServerName;
use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::time::{timeout, Duration};

fn fixture_paths() -> (std::path::PathBuf, std::path::PathBuf) {
    let stamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    let dir = std::env::temp_dir().join(format!("proxima-tls-{stamp}"));
    fs::create_dir_all(&dir).unwrap();
    (dir.join("cert.pem"), dir.join("key.pem"))
}

#[tokio::test]
async fn client_tls_termination_accepts_postgres_ssl_request() {
    let cert = generate_simple_self_signed(vec!["localhost".to_string()]).unwrap();
    let (cert_path, key_path) = fixture_paths();
    fs::write(&cert_path, cert.cert.pem()).unwrap();
    fs::write(&key_path, cert.signing_key.serialize_pem()).unwrap();

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let acceptor = acceptor(server_config(cert_path.to_str().unwrap(), key_path.to_str().unwrap()).unwrap());
    let ca = client_config(cert_path.to_str().unwrap()).unwrap();
    let connector = connector(ca);

    let server = tokio::spawn(async move {
        let (tcp, _) = listener.accept().await.unwrap();
        let mut tls = accept_postgres_tls(tcp, acceptor, Duration::from_secs(2)).await.unwrap();
        let mut buf = [0u8; 4];
        tls.read_exact(&mut buf).await.unwrap();
        assert_eq!(&buf, b"ping");
    });

    let tcp = tokio::net::TcpStream::connect(addr).await.unwrap();
    let mut client = connect_postgres_tls(
        tcp,
        connector,
        ServerName::try_from("localhost".to_string()).unwrap(),
        Duration::from_secs(2),
    ).await.unwrap();
    client.write_all(b"ping").await.unwrap();
    timeout(Duration::from_secs(3), server).await.unwrap().unwrap();

    let _ = fs::remove_file(cert_path);
    let _ = fs::remove_file(key_path);
}

#[test]
fn invalid_tls_material_fails_closed() {
    assert!(server_config("/does/not/exist", "/does/not/exist").is_err());
    assert!(client_config("/does/not/exist").is_err());
}

#[tokio::test]
async fn upstream_tls_rejects_hostname_mismatch() {
    let cert = generate_simple_self_signed(vec!["localhost".to_string()]).unwrap();
    let (cert_path, key_path) = fixture_paths();
    fs::write(&cert_path, cert.cert.pem()).unwrap();
    fs::write(&key_path, cert.signing_key.serialize_pem()).unwrap();

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let acceptor = acceptor(server_config(cert_path.to_str().unwrap(), key_path.to_str().unwrap()).unwrap());
    let connector = connector(client_config(cert_path.to_str().unwrap()).unwrap());

    let server = tokio::spawn(async move {
        let (tcp, _) = listener.accept().await.unwrap();
        let _ = accept_postgres_tls(tcp, acceptor, Duration::from_secs(2)).await;
    });

    let tcp = tokio::net::TcpStream::connect(addr).await.unwrap();
    let result = connect_postgres_tls(
        tcp,
        connector,
        ServerName::try_from("wrong.example".to_string()).unwrap(),
        Duration::from_secs(2),
    ).await;
    assert!(result.is_err());
    timeout(Duration::from_secs(3), server).await.unwrap().unwrap();

    let _ = fs::remove_file(cert_path);
    let _ = fs::remove_file(key_path);
}
