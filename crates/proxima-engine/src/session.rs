use crate::protocol::{parse_startup_packet, StartupPacket};
use std::io;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tracing::debug;

const MAX_STARTUP_PACKET: usize = 16 * 1024 * 1024;

pub async fn establish(
    mut client: TcpStream,
    mut upstream: TcpStream,
) -> io::Result<(TcpStream, TcpStream)> {
    let startup = read_startup(&mut client).await?;

    match &startup {
        StartupPacket::Startup { parameters, .. } => {
            debug!(
                parameter_count = parameters.len(),
                "PostgreSQL startup packet received"
            );
            forward_startup(&mut upstream, &startup).await?;
        }
        StartupPacket::SslRequest => {
            upstream.write_all(&encode_startup(&startup)?).await?;
            let mut response = [0u8; 1];
            upstream.read_exact(&mut response).await?;
            client.write_all(&response).await?;

            // TLS turns the PostgreSQL protocol into an encrypted byte stream.
            // Proxima does not claim to inspect or enforce tenant policy inside
            // an end-to-end TLS tunnel until explicit TLS termination is added.
            if response[0] == b'S' {
                return Ok((client, upstream));
            }

            let startup = read_startup(&mut client).await?;
            forward_startup(&mut upstream, &startup).await?;
        }
        StartupPacket::CancelRequest { .. } => {
            forward_startup(&mut upstream, &startup).await?;
            return Ok((client, upstream));
        }
        StartupPacket::Unknown { .. } => {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "unsupported PostgreSQL startup packet",
            ));
        }
    }

    Ok((client, upstream))
}

async fn read_startup(stream: &mut TcpStream) -> io::Result<StartupPacket> {
    let mut length_bytes = [0u8; 4];
    stream.read_exact(&mut length_bytes).await?;

    let length = u32::from_be_bytes(length_bytes) as usize;
    if !(8..=MAX_STARTUP_PACKET).contains(&length) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("invalid PostgreSQL startup length: {length}"),
        ));
    }

    let mut packet = vec![0u8; length];
    packet[..4].copy_from_slice(&length_bytes);
    stream.read_exact(&mut packet[4..]).await?;

    parse_startup_packet(&packet)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error.to_string()))?
        .map(|(startup, _)| startup)
        .ok_or_else(|| io::Error::new(io::ErrorKind::UnexpectedEof, "incomplete startup packet"))
}

async fn forward_startup(stream: &mut TcpStream, startup: &StartupPacket) -> io::Result<()> {
    stream.write_all(&encode_startup(startup)?).await
}

fn encode_startup(startup: &StartupPacket) -> io::Result<Vec<u8>> {
    match startup {
        StartupPacket::SslRequest => Ok(8i32
            .to_be_bytes()
            .into_iter()
            .chain(crate::protocol::SSL_REQUEST_CODE.to_be_bytes())
            .collect()),
        StartupPacket::CancelRequest {
            process_id,
            secret_key,
        } => {
            let mut packet = Vec::with_capacity(16);
            packet.extend_from_slice(&16i32.to_be_bytes());
            packet.extend_from_slice(&crate::protocol::CANCEL_REQUEST_CODE.to_be_bytes());
            packet.extend_from_slice(&process_id.to_be_bytes());
            packet.extend_from_slice(&secret_key.to_be_bytes());
            Ok(packet)
        }
        StartupPacket::Startup {
            protocol_version,
            parameters,
        } => {
            let mut body = Vec::new();
            body.extend_from_slice(&protocol_version.to_be_bytes());

            for (key, value) in parameters {
                body.extend_from_slice(key.as_bytes());
                body.push(0);
                body.extend_from_slice(value.as_bytes());
                body.push(0);
            }
            body.push(0);

            let length = body.len() + 4;
            let length = i32::try_from(length)
                .map_err(|_| io::Error::new(io::ErrorKind::InvalidInput, "startup packet too large"))?;

            let mut packet = Vec::with_capacity(length as usize);
            packet.extend_from_slice(&length.to_be_bytes());
            packet.extend_from_slice(&body);
            Ok(packet)
        }
        StartupPacket::Unknown { .. } => Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "cannot encode unknown startup packet",
        )),
    }
}
