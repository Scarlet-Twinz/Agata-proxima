use crate::protocol::{
    parse_backend_frame, parse_frontend_frame, parse_startup_packet, BackendMessage, StartupPacket,
    AUTHENTICATION_TAG, AUTH_OK, ERROR_RESPONSE_TAG, READY_FOR_QUERY_TAG,
};
use crate::tenant::{TenantContext, TenantTokenVerifier};
use crate::transport::BoxedIo;
use std::io;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tracing::debug;

const MAX_STARTUP_PACKET: usize = 16 * 1024 * 1024;
const TENANT_TOKEN_PARAMETER: &str = "proxima_tenant_token";
const POSTGRES_IDENTIFIER_MAX_BYTES: usize = 63;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EstablishedSession {
    pub tenant_context: Option<TenantContext>,
}

pub async fn establish(
    mut client: BoxedIo,
    mut upstream: BoxedIo,
    verifier: Option<&TenantTokenVerifier>,
    tenant_role_prefix: &str,
) -> io::Result<(BoxedIo, BoxedIo, EstablishedSession)> {
    let startup = read_startup(&mut client).await?;
    match startup{
  StartupPacket::Startup{protocol_version,parameters}=>{
   let(startup,tenant_context)=prepare_startup(protocol_version,parameters,verifier,tenant_role_prefix)?;
   debug!(tenant_bound=tenant_context.is_some(),"PostgreSQL startup packet received");
   forward_startup(&mut upstream,&startup).await?;
   broker_startup_authentication(&mut client,&mut upstream).await?;
   Ok((client,upstream,EstablishedSession{tenant_context}))
  }
  StartupPacket::SslRequest=>Err(io::Error::new(io::ErrorKind::PermissionDenied,"SSLRequest reached the session layer; Proxima must terminate TLS before tenant enforcement")),
  StartupPacket::CancelRequest{process_id,secret_key}=>{forward_startup(&mut upstream,&StartupPacket::CancelRequest{process_id,secret_key}).await?;Ok((client,upstream,EstablishedSession{tenant_context:None}))}
  StartupPacket::Unknown{..}=>Err(io::Error::new(io::ErrorKind::InvalidData,"unsupported PostgreSQL startup packet"))
 }
}

fn prepare_startup(
    protocol_version: i32,
    parameters: Vec<(String, String)>,
    verifier: Option<&TenantTokenVerifier>,
    tenant_role_prefix: &str,
) -> io::Result<(StartupPacket, Option<TenantContext>)> {
    let mut tenant_token = None;
    let mut forwarded = Vec::with_capacity(parameters.len());
    for (key, value) in parameters {
        if key == TENANT_TOKEN_PARAMETER {
            if tenant_token.replace(value).is_some() {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    "duplicate Proxima tenant token",
                ));
            }
        } else if key == "options" {
            let (clean, option_token) = extract_tenant_token_from_options(&value)?;
            if let Some(token) = option_token {
                if tenant_token.replace(token).is_some() {
                    return Err(io::Error::new(
                        io::ErrorKind::InvalidData,
                        "duplicate Proxima tenant token",
                    ));
                }
            }
            if !clean.is_empty() {
                forwarded.push((key, clean));
            }
        } else {
            forwarded.push((key, value));
        }
    }
    let tenant_context = match verifier {
        Some(v) => {
            let token = tenant_token.ok_or_else(|| {
                io::Error::new(
                    io::ErrorKind::PermissionDenied,
                    "Proxima tenant token is required",
                )
            })?;
            Some(v.verify_now(&token).map_err(|e| {
                io::Error::new(
                    io::ErrorKind::PermissionDenied,
                    format!("invalid Proxima tenant token: {e}"),
                )
            })?)
        }
        None => None,
    };
    if let Some(context) = tenant_context.as_ref() {
        let role = format!("{tenant_role_prefix}{}", context.tenant_id);
        if role.len() > POSTGRES_IDENTIFIER_MAX_BYTES {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "tenant role name exceeds PostgreSQL identifier limit",
            ));
        }
        forwarded.retain(|(key, _)| key != "user");
        forwarded.push(("user".into(), role));
    }
    Ok((
        StartupPacket::Startup {
            protocol_version,
            parameters: forwarded,
        },
        tenant_context,
    ))
}

fn extract_tenant_token_from_options(value: &str) -> io::Result<(String, Option<String>)> {
    let mut tokens = value.split_whitespace();
    let mut output: Vec<String> = Vec::new();
    let mut tenant_token = None;
    while let Some(token) = tokens.next() {
        if token == "-c" {
            let assignment = tokens.next().ok_or_else(|| {
                io::Error::new(io::ErrorKind::InvalidData, "options contains incomplete -c")
            })?;
            if let Some(v) = assignment.strip_prefix("proxima_tenant_token=") {
                if v.is_empty() {
                    return Err(io::Error::new(
                        io::ErrorKind::InvalidData,
                        "Proxima tenant token in options is empty",
                    ));
                }
                if tenant_token.replace(v.to_owned()).is_some() {
                    return Err(io::Error::new(
                        io::ErrorKind::InvalidData,
                        "duplicate Proxima tenant token",
                    ));
                }
                continue;
            }
            output.push("-c".to_owned());
            output.push(assignment.to_owned());
        } else if let Some(v) = token.strip_prefix("proxima_tenant_token=") {
            if v.is_empty() {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    "Proxima tenant token in options is empty",
                ));
            }
            if tenant_token.replace(v.to_owned()).is_some() {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    "duplicate Proxima tenant token",
                ));
            }
            continue;
        } else {
            output.push(token.to_owned());
        }
    }
    Ok((output.join(" "), tenant_token))
}

async fn broker_startup_authentication(
    client: &mut BoxedIo,
    upstream: &mut BoxedIo,
) -> io::Result<()> {
    let mut authenticated = false;
    loop {
        let frame = read_backend_frame(upstream).await?;
        client.write_all(&frame).await?;
        let message = parse_backend_frame(&frame)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?
            .ok_or_else(|| {
                io::Error::new(io::ErrorKind::UnexpectedEof, "incomplete backend frame")
            })?
            .0;
        if message.tag == ERROR_RESPONSE_TAG {
            return Err(io::Error::new(
                io::ErrorKind::PermissionDenied,
                "PostgreSQL authentication/startup failed",
            ));
        }
        if message.tag == AUTHENTICATION_TAG {
            match parse_authentication_code(&message)? {
                AUTH_OK => authenticated = true,
                3 | 5 | 7 | 8 | 9 | 10 | 11 => {
                    let response = read_frontend_frame(client).await?;
                    upstream.write_all(&response).await?;
                }
                12 => {}
                other => {
                    return Err(io::Error::new(
                        io::ErrorKind::Unsupported,
                        format!("unsupported PostgreSQL authentication method: {other}"),
                    ))
                }
            }
        }
        if message.tag == READY_FOR_QUERY_TAG {
            if !authenticated {
                return Err(io::Error::new(
                    io::ErrorKind::PermissionDenied,
                    "PostgreSQL session became ready without AuthenticationOk",
                ));
            }
            return Ok(());
        }
    }
}
fn parse_authentication_code(message: &BackendMessage) -> io::Result<i32> {
    if message.payload.len() < 4 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "truncated PostgreSQL authentication message",
        ));
    }
    Ok(i32::from_be_bytes(message.payload[..4].try_into().unwrap()))
}
async fn read_backend_frame(stream: &mut BoxedIo) -> io::Result<Vec<u8>> {
    let mut h = [0u8; 5];
    stream.read_exact(&mut h).await?;
    let l = i32::from_be_bytes(h[1..5].try_into().unwrap());
    if !(4..=MAX_STARTUP_PACKET as i32).contains(&l) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("invalid backend frame length: {l}"),
        ));
    }
    let mut f = vec![0u8; 5 + l as usize - 4];
    f[..5].copy_from_slice(&h);
    stream.read_exact(&mut f[5..]).await?;
    Ok(f)
}
async fn read_frontend_frame(stream: &mut BoxedIo) -> io::Result<Vec<u8>> {
    let mut h = [0u8; 5];
    stream.read_exact(&mut h).await?;
    let l = i32::from_be_bytes(h[1..5].try_into().unwrap());
    if !(4..=MAX_STARTUP_PACKET as i32).contains(&l) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("invalid frontend frame length: {l}"),
        ));
    }
    let mut f = vec![0u8; 5 + l as usize - 4];
    f[..5].copy_from_slice(&h);
    stream.read_exact(&mut f[5..]).await?;
    parse_frontend_frame(&f)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?
        .ok_or_else(|| io::Error::new(io::ErrorKind::UnexpectedEof, "incomplete frontend frame"))?;
    Ok(f)
}
async fn read_startup(stream: &mut BoxedIo) -> io::Result<StartupPacket> {
    let mut lb = [0u8; 4];
    stream.read_exact(&mut lb).await?;
    let l = u32::from_be_bytes(lb) as usize;
    if !(8..=MAX_STARTUP_PACKET).contains(&l) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("invalid PostgreSQL startup length: {l}"),
        ));
    }
    let mut p = vec![0u8; l];
    p[..4].copy_from_slice(&lb);
    stream.read_exact(&mut p[4..]).await?;
    parse_startup_packet(&p)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?
        .map(|(s, _)| s)
        .ok_or_else(|| io::Error::new(io::ErrorKind::UnexpectedEof, "incomplete startup packet"))
}
async fn forward_startup(stream: &mut BoxedIo, startup: &StartupPacket) -> io::Result<()> {
    match startup {
        StartupPacket::CancelRequest {
            process_id,
            secret_key,
        } => {
            let mut p = Vec::with_capacity(16);
            p.extend_from_slice(&16i32.to_be_bytes());
            p.extend_from_slice(&crate::protocol::CANCEL_REQUEST_CODE.to_be_bytes());
            p.extend_from_slice(&process_id.to_be_bytes());
            p.extend_from_slice(&secret_key.to_be_bytes());
            stream.write_all(&p).await
        }
        StartupPacket::Startup {
            protocol_version,
            parameters,
        } => {
            let mut b = Vec::new();
            b.extend_from_slice(&protocol_version.to_be_bytes());
            for (k, v) in parameters {
                b.extend_from_slice(k.as_bytes());
                b.push(0);
                b.extend_from_slice(v.as_bytes());
                b.push(0);
            }
            b.push(0);
            let l = i32::try_from(b.len() + 4).map_err(|_| {
                io::Error::new(io::ErrorKind::InvalidInput, "startup packet too large")
            })?;
            let mut p = Vec::with_capacity(l as usize);
            p.extend_from_slice(&l.to_be_bytes());
            p.extend_from_slice(&b);
            stream.write_all(&p).await
        }
        _ => Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "unsupported startup forwarding",
        )),
    }
}


#[cfg(test)]
mod tests {
    use super::*;
    use crate::tenant::TenantTokenVerifier;

    fn verifier() -> TenantTokenVerifier {
        TenantTokenVerifier::new(b"01234567890123456789012345678901").unwrap()
    }

    #[test]
    fn extracts_and_removes_tenant_token() {
        let v = verifier();
        let token = v.sign_for_test("tenant_a", u64::MAX);
        let (startup, context) = prepare_startup(
            crate::protocol::PROTOCOL_3_0,
            vec![("user".into(), "proxima".into()), (TENANT_TOKEN_PARAMETER.into(), token)],
            Some(&v),
            "proxima_tenant_",
        ).unwrap();
        assert_eq!(context.unwrap().tenant_id, "tenant_a");
        assert_eq!(startup, StartupPacket::Startup {
            protocol_version: crate::protocol::PROTOCOL_3_0,
            parameters: vec![("user".into(), "proxima_tenant_tenant_a".into())],
        });
    }

    #[test]
    fn rejects_missing_token_when_enforcement_is_enabled() {
        let v = verifier();
        let error = prepare_startup(
            crate::protocol::PROTOCOL_3_0,
            vec![("user".into(), "proxima".into())],
            Some(&v),
            "proxima_tenant_",
        ).unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::PermissionDenied);
    }

    #[test]
    fn extracts_token_from_libpq_options() {
        let v = verifier();
        let token = v.sign_for_test("tenant_a", u64::MAX);
        let (options, extracted) = extract_tenant_token_from_options(
            &format!("-c proxima_tenant_token={token} -c statement_timeout=1000"),
        ).unwrap();
        assert_eq!(extracted, Some(token));
        assert_eq!(options, "-c statement_timeout=1000");
    }

    #[test]
    fn rejects_duplicate_option_tokens() {
        let v = verifier();
        let token = v.sign_for_test("tenant_a", u64::MAX);
        let error = extract_tenant_token_from_options(
            &format!("-c proxima_tenant_token={token} proxima_tenant_token={token}"),
        ).unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
    }

    #[test]
    fn rejects_role_names_over_postgres_limit() {
        let v = verifier();
        let token = v.sign_for_test("tenant_a", u64::MAX);
        let error = prepare_startup(
            crate::protocol::PROTOCOL_3_0,
            vec![(TENANT_TOKEN_PARAMETER.into(), token)],
            Some(&v),
            &"x".repeat(63),
        ).unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::InvalidInput);
    }

    #[test]
    fn rejects_duplicate_tokens() {
        let v = verifier();
        let token = v.sign_for_test("tenant_a", u64::MAX);
        let error = prepare_startup(
            crate::protocol::PROTOCOL_3_0,
            vec![(TENANT_TOKEN_PARAMETER.into(), token.clone()), (TENANT_TOKEN_PARAMETER.into(), token)],
            Some(&v),
            "proxima_tenant_",
        ).unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
    }
}
