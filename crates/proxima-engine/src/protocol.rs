use bytes::{Buf, Bytes, BytesMut};
use std::fmt;
use std::io;

pub const SSL_REQUEST_CODE: i32 = 80877103;
pub const CANCEL_REQUEST_CODE: i32 = 80877102;
pub const PROTOCOL_3_0: i32 = 196608;

const MAX_FRAME_LENGTH: usize = 16 * 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StartupPacket {
    Startup {
        protocol_version: i32,
        parameters: Vec<(String, String)>,
    },
    SslRequest,
    CancelRequest {
        process_id: i32,
        secret_key: i32,
    },
    Unknown {
        code: i32,
        payload: Bytes,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FrontendMessage {
    pub tag: u8,
    pub payload: Bytes,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FrameError {
    Incomplete,
    InvalidLength(i32),
    FrameTooLarge(usize),
}

impl fmt::Display for FrameError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Incomplete => write!(f, "incomplete PostgreSQL frame"),
            Self::InvalidLength(length) => write!(f, "invalid PostgreSQL frame length: {length}"),
            Self::FrameTooLarge(length) => {
                write!(f, "PostgreSQL frame exceeds maximum length: {length}")
            }
        }
    }
}

impl std::error::Error for FrameError {}

pub fn parse_startup_packet(input: &[u8]) -> Result<Option<(StartupPacket, usize)>, FrameError> {
    if input.len() < 4 {
        return Ok(None);
    }

    let length = i32::from_be_bytes(input[0..4].try_into().unwrap());
    if length < 8 {
        return Err(FrameError::InvalidLength(length));
    }
    let length = length as usize;
    if length > MAX_FRAME_LENGTH {
        return Err(FrameError::FrameTooLarge(length));
    }
    if input.len() < length {
        return Ok(None);
    }

    let mut body = &input[4..length];
    let code = body.get_i32();

    let packet = match code {
        SSL_REQUEST_CODE if length == 8 => StartupPacket::SslRequest,
        CANCEL_REQUEST_CODE if length == 16 => StartupPacket::CancelRequest {
            process_id: body.get_i32(),
            secret_key: body.get_i32(),
        },
        PROTOCOL_3_0 => {
            let mut parameters = Vec::new();
            while body.has_remaining() {
                let key =
                    read_cstring(&mut body).ok_or(FrameError::InvalidLength(length as i32))?;
                if key.is_empty() {
                    break;
                }
                let value =
                    read_cstring(&mut body).ok_or(FrameError::InvalidLength(length as i32))?;
                parameters.push((key, value));
            }
            StartupPacket::Startup {
                protocol_version: code,
                parameters,
            }
        }
        _ => StartupPacket::Unknown {
            code,
            payload: Bytes::copy_from_slice(body),
        },
    };

    Ok(Some((packet, length)))
}

pub fn parse_frontend_frame(input: &[u8]) -> Result<Option<(FrontendMessage, usize)>, FrameError> {
    if input.len() < 5 {
        return Ok(None);
    }

    let tag = input[0];
    let length = i32::from_be_bytes(input[1..5].try_into().unwrap());

    if length < 4 {
        return Err(FrameError::InvalidLength(length));
    }

    let length = length as usize;
    if length > MAX_FRAME_LENGTH {
        return Err(FrameError::FrameTooLarge(length));
    }

    let total = 1usize
        .checked_add(length)
        .ok_or(FrameError::FrameTooLarge(length))?;

    if input.len() < total {
        return Ok(None);
    }

    Ok(Some((
        FrontendMessage {
            tag,
            payload: Bytes::copy_from_slice(&input[5..total]),
        },
        total,
    )))
}

fn read_cstring(input: &mut &[u8]) -> Option<String> {
    let nul = input.iter().position(|byte| *byte == 0)?;
    let value = std::str::from_utf8(&input[..nul]).ok()?.to_owned();
    *input = &input[nul + 1..];
    Some(value)
}

pub fn encode_frontend_frame(tag: u8, payload: &[u8]) -> io::Result<Bytes> {
    let length = payload
        .len()
        .checked_add(4)
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "payload too large"))?;

    if length > MAX_FRAME_LENGTH {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "payload exceeds Proxima frame limit",
        ));
    }

    let length = u32::try_from(length)
        .map_err(|_| io::Error::new(io::ErrorKind::InvalidInput, "frame length overflow"))?;

    let mut output = BytesMut::with_capacity(1 + 4 + payload.len());
    output.extend_from_slice(&[tag]);
    output.extend_from_slice(&length.to_be_bytes());
    output.extend_from_slice(payload);
    Ok(output.freeze())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_postgres_startup_packet() {
        let mut packet = Vec::new();
        packet.extend_from_slice(&[0, 0, 0, 33]);
        packet.extend_from_slice(&PROTOCOL_3_0.to_be_bytes());
        packet.extend_from_slice(b"user\0alice\0database\0app\0\0");

        let (startup, consumed) = parse_startup_packet(&packet).unwrap().unwrap();

        assert_eq!(consumed, packet.len());
        assert_eq!(
            startup,
            StartupPacket::Startup {
                protocol_version: PROTOCOL_3_0,
                parameters: vec![
                    ("user".into(), "alice".into()),
                    ("database".into(), "app".into())
                ]
            }
        );
    }

    #[test]
    fn recognizes_ssl_request() {
        let packet = [0, 0, 0, 8, 8, 4, 21, 22];

        let (startup, consumed) = parse_startup_packet(&packet).unwrap().unwrap();
        assert_eq!(startup, StartupPacket::SslRequest);
        assert_eq!(consumed, 8);
    }

    #[test]
    fn recognizes_cancel_request() {
        let mut packet = Vec::new();
        packet.extend_from_slice(&16i32.to_be_bytes());
        packet.extend_from_slice(&CANCEL_REQUEST_CODE.to_be_bytes());
        packet.extend_from_slice(&42i32.to_be_bytes());
        packet.extend_from_slice(&99i32.to_be_bytes());

        let (startup, _) = parse_startup_packet(&packet).unwrap().unwrap();
        assert_eq!(
            startup,
            StartupPacket::CancelRequest {
                process_id: 42,
                secret_key: 99
            }
        );
    }

    #[test]
    fn incomplete_startup_is_not_an_error() {
        let packet = [0, 0, 0, 33, 0];
        assert_eq!(parse_startup_packet(&packet).unwrap(), None);
    }

    #[test]
    fn rejects_short_startup_length() {
        let packet = [0, 0, 0, 4, 0, 0, 0, 0];
        assert_eq!(
            parse_startup_packet(&packet),
            Err(FrameError::InvalidLength(4))
        );
    }

    #[test]
    fn parses_frontend_message() {
        let frame = [b'Q', 0, 0, 0, 11, b'S', b'E', b'L', b'E', b'C', b'T', 0];
        let (message, consumed) = parse_frontend_frame(&frame).unwrap().unwrap();

        assert_eq!(message.tag, b'Q');
        assert_eq!(&message.payload[..], b"SELECT\0");
        assert_eq!(consumed, frame.len());
    }

    #[test]
    fn frontend_frame_waits_for_complete_payload() {
        let frame = [b'Q', 0, 0, 0, 11, b'S'];
        assert_eq!(parse_frontend_frame(&frame).unwrap(), None);
    }

    #[test]
    fn rejects_invalid_frontend_length() {
        let frame = [b'Q', 0, 0, 0, 3, 0];
        assert_eq!(
            parse_frontend_frame(&frame),
            Err(FrameError::InvalidLength(3))
        );
    }

    #[test]
    fn encodes_frontend_frame() {
        let frame = encode_frontend_frame(b'Q', b"SELECT").unwrap();
        assert_eq!(&frame[..], b"Q\0\0\0\nSELECT");
    }
}
