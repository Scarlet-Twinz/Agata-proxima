use crate::auth::{
    authenticate_upstream, drain_until_ready, send_authentication_ok, send_set_role,
};
use crate::protocol::{parse_startup_packet, StartupPacket};
use crate::tenant::{TenantContext, TenantTokenVerifier};
use std::io;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tracing::debug;

const MAX_STARTUP_PACKET: usize = 16 * 1024 * 1024;
const TENANT_TOKEN_PARAMETER: &str = "proxima_tenant_token";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EstablishedSession {
    pub tenant_context: Option<TenantContext>,
}

pub async fn establish(
    mut client: TcpStream,
    mut upstream: TcpStream,
    verifier: Option<&TenantTokenVerifier>,
    upstream_user: Option<&str>,
    upstream_password: Option<&str>,
) -> io::Result<(TcpStream, TcpStream, EstablishedSession)> {
    let startup = read_startup(&mut client).await?;

    match startup {
        StartupPacket::Startup {
            protocol_version,
            parameters,
        } => {
            let (startup, tenant_context) = prepare_startup(
                protocol_version,
                parameters,
                verifier,
                upstream_user,
            )?;

            debug!(
                tenant_bound = tenant_context.is_some(),
                "PostgreSQL startup packet received"
            );

            forward_startup(&mut upstream, &startup).await?;

            if let Some(context) = tenant_context.as_ref() {
                let user = upstream_user.ok_or_else(|| {
                    io::Error::new(
                        io::ErrorKind::InvalidInput,
                        "upstream user is required for tenant enforcement",
                    )
                })?;
                let password = upstream_password.ok_or_else(|| {
                    io::Error::new(
                        io::ErrorKind::InvalidInput,
                        "upstream password is required for tenant enforcement",
                    )
                })?;

                authenticate_upstream(&mut upstream, user, password).await?;
                send_authentication_ok(&mut client).await?;

                let ready =
                    crate::auth::forward_startup_until_ready(&mut upstream, &mut client).await?;
                let role = tenant_role(tenant_role_prefix, &context.tenant_id)?;
                send_set_role(&mut upstream, &role).await?;
                drain_until_ready(&mut upstream).await?;
                client.write_all(&ready).await?;
            }

            Ok((client, upstream, EstablishedSession { tenant_context }))
        }
        StartupPacket::SslRequest => {
            upstream
                .write_all(&encode_startup(&StartupPacket::SslRequest)?)
                .await?;
            let mut response = [0u8; 1];
            upstream.read_exact(&mut response).await?;
            client.write_all(&response).await?;

            if response[0] == b'S' {
                if verifier.is_some() {
                    return Err(io::Error::new(
                        io::ErrorKind::PermissionDenied,
                        "Proxima tenant enforcement requires TLS termination; end-to-end TLS is opaque to the policy layer",
                    ));
                }
                return Ok((
                    client,
                    upstream,
                    EstablishedSession {
                        tenant_context: None,
                    },
                ));
            }

            let startup = read_startup(&mut client).await?;
            match startup {
                StartupPacket::Startup {
                    protocol_version,
                    parameters,
                } => {
                    let (startup, tenant_context) =
                        prepare_startup(protocol_version, parameters, verifier, upstream_user)?;
                    forward_startup(&mut upstream, &startup).await?;

                    if let Some(context) = tenant_context.as_ref() {
                        let user = upstream_user.ok_or_else(|| {
                            io::Error::new(
                                io::ErrorKind::InvalidInput,
                                "upstream user is required for tenant enforcement",
                            )
                        })?;
                        let password = upstream_password.ok_or_else(|| {
                            io::Error::new(
                                io::ErrorKind::InvalidInput,
                                "upstream password is required for tenant enforcement",
                            )
                        })?;

                        authenticate_upstream(&mut upstream, user, password).await?;
                        send_authentication_ok(&mut client).await?;

                        let ready =
                            crate::auth::forward_startup_until_ready(&mut upstream, &mut client)
                                .await?;
                        let role = tenant_role(tenant_role_prefix, &context.tenant_id)?;
                        send_set_role(&mut upstream, &role).await?;
                        drain_until_ready(&mut upstream).await?;
                        client.write_all(&ready).await?;
                    }

                    Ok((client, upstream, EstablishedSession { tenant_context }))
                }
                other => Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    format!("expected PostgreSQL startup after SSL rejection, got {other:?}"),
                )),
            }
        }
        StartupPacket::CancelRequest {
            process_id,
            secret_key,
        } => {
            forward_startup(
                &mut upstream,
                &StartupPacket::CancelRequest {
                    process_id,
                    secret_key,
                },
            )
            .await?;
            Ok((
                client,
                upstream,
                EstablishedSession {
                    tenant_context: None,
                },
            ))
        }
        StartupPacket::Unknown { .. } => Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "unsupported PostgreSQL startup packet",
        )),
    }
}

fn prepare_startup(
    protocol_version: i32,
    parameters: Vec<(String, String)>,
    verifier: Option<&TenantTokenVerifier>,
    upstream_user: Option<&str>,
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
        } else {
            forwarded.push((key, value));
        }
    }

    let tenant_context = match verifier {
        Some(verifier) => {
            let token = tenant_token.ok_or_else(|| {
                io::Error::new(
                    io::ErrorKind::PermissionDenied,
                    "Proxima tenant token is required",
                )
            })?;

            Some(verifier.verify_now(&token).map_err(|error| {
                io::Error::new(
                    io::ErrorKind::PermissionDenied,
                    format!("invalid Proxima tenant token: {error}"),
                )
            })?)
        }
        None => None,
    };

    if tenant_context.is_some() {
        let user = upstream_user.ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::InvalidInput,
                "upstream user is required when tenant enforcement is enabled",
            )
        })?;
        forwarded.retain(|(key, _)| key != "user");
        forwarded.push(("user".to_owned(), user.to_owned()));
    }

    Ok((
        StartupPacket::Startup {
            protocol_version,
            parameters: forwarded,
        },
        tenant_context,
    ))
}

fn tenant_role(prefix: &str, tenant_id: &str) -> io::Result<String> {
    let role = format!("{prefix}{tenant_id}");
    if role.is_empty() || role.len() > 63 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "derived PostgreSQL tenant role exceeds the 63-byte identifier limit",
        ));
    }

    if !role
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
    {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "derived PostgreSQL tenant role contains invalid identifier characters",
        ));
    }

    Ok(role)
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
            let length = i32::try_from(length).map_err(|_| {
                io::Error::new(io::ErrorKind::InvalidInput, "startup packet too large")
            })?;

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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tenant::TenantTokenVerifier;

    fn verifier() -> TenantTokenVerifier {
        TenantTokenVerifier::new(b"01234567890123456789012345678901").unwrap()
    }

    #[test]
    fn extracts_and_rewrites_tenant_startup() {
        let verifier = verifier();
        let token = verifier.sign_for_test("tenant_a", u64::MAX);
        let (startup, context) = prepare_startup(
            crate::protocol::PROTOCOL_3_0,
            vec![
                ("user".into(), "client".into()),
                (TENANT_TOKEN_PARAMETER.into(), token),
            ],
            Some(&verifier),
            Some("proxima_gateway"),
        )
        .unwrap();

        assert_eq!(context.unwrap().tenant_id, "tenant_a");
        assert_eq!(
            startup,
            StartupPacket::Startup {
                protocol_version: crate::protocol::PROTOCOL_3_0,
                parameters: vec![("user".into(), "proxima_gateway".into())],
            }
        );
    }

    #[test]
    fn rejects_missing_token_when_enforcement_is_enabled() {
        let verifier = verifier();
        let error = prepare_startup(
            crate::protocol::PROTOCOL_3_0,
            vec![("user".into(), "client".into())],
            Some(&verifier),
            Some("proxima_gateway"),
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::PermissionDenied);
    }

    #[test]
    fn rejects_duplicate_tokens() {
        let verifier = verifier();
        let token = verifier.sign_for_test("tenant_a", u64::MAX);
        let error = prepare_startup(
            crate::protocol::PROTOCOL_3_0,
            vec![
                (TENANT_TOKEN_PARAMETER.into(), token.clone()),
                (TENANT_TOKEN_PARAMETER.into(), token),
            ],
            Some(&verifier),
            "proxima_tenant_",
            Some("proxima_gateway"),
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
    }

    #[test]
    fn rejects_tenant_role_over_identifier_limit() {
        let tenant = "a".repeat(63);
        assert!(tenant_role("proxima_", &tenant).is_err());
    }
}
