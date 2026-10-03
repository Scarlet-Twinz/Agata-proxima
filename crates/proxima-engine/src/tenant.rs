use hmac::{Hmac, Mac};
use sha2::Sha256;
use std::fmt;
use std::time::{SystemTime, UNIX_EPOCH};

type HmacSha256 = Hmac<Sha256>;

const VERSION: &str = "v1";
const MAX_TENANT_ID_LENGTH: usize = 128;
const SIGNATURE_HEX_LENGTH: usize = 64;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TenantContext {
    pub tenant_id: String,
    pub expires_at: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TenantTokenError {
    InvalidFormat,
    UnsupportedVersion,
    InvalidTenantId,
    InvalidExpiry,
    Expired,
    InvalidSignature,
}

impl fmt::Display for TenantTokenError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidFormat => write!(f, "invalid Proxima tenant token format"),
            Self::UnsupportedVersion => write!(f, "unsupported Proxima tenant token version"),
            Self::InvalidTenantId => write!(f, "invalid tenant identifier"),
            Self::InvalidExpiry => write!(f, "invalid tenant token expiry"),
            Self::Expired => write!(f, "tenant token has expired"),
            Self::InvalidSignature => write!(f, "invalid tenant token signature"),
        }
    }
}

impl std::error::Error for TenantTokenError {}

#[derive(Clone)]
pub struct TenantTokenVerifier {
    secret: Vec<u8>,
}

impl TenantTokenVerifier {
    pub fn new(secret: impl AsRef<[u8]>) -> Result<Self, TenantTokenError> {
        let secret = secret.as_ref();
        if secret.len() < 32 {
            return Err(TenantTokenError::InvalidSignature);
        }

        Ok(Self {
            secret: secret.to_vec(),
        })
    }

    pub fn verify(
        &self,
        token: &str,
        now_unix_seconds: u64,
    ) -> Result<TenantContext, TenantTokenError> {
        let mut parts = token.split('.');
        let version = parts.next().ok_or(TenantTokenError::InvalidFormat)?;
        let tenant_id = parts.next().ok_or(TenantTokenError::InvalidFormat)?;
        let expiry = parts.next().ok_or(TenantTokenError::InvalidFormat)?;
        let signature = parts.next().ok_or(TenantTokenError::InvalidFormat)?;

        if parts.next().is_some() {
            return Err(TenantTokenError::InvalidFormat);
        }

        if version != VERSION {
            return Err(TenantTokenError::UnsupportedVersion);
        }

        validate_tenant_id(tenant_id)?;

        let expires_at = expiry
            .parse::<u64>()
            .map_err(|_| TenantTokenError::InvalidExpiry)?;

        if now_unix_seconds >= expires_at {
            return Err(TenantTokenError::Expired);
        }

        let expected = sign_payload(&self.secret, version, tenant_id, expires_at);
        if !constant_time_hex_eq(&expected, signature) {
            return Err(TenantTokenError::InvalidSignature);
        }

        Ok(TenantContext {
            tenant_id: tenant_id.to_owned(),
            expires_at,
        })
    }

    pub fn verify_now(&self, token: &str) -> Result<TenantContext, TenantTokenError> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| TenantTokenError::InvalidExpiry)?
            .as_secs();

        self.verify(token, now)
    }

    #[cfg(test)]
    fn sign_for_test(&self, tenant_id: &str, expires_at: u64) -> String {
        validate_tenant_id(tenant_id).unwrap();
        format!(
            "{VERSION}.{tenant_id}.{expires_at}.{}",
            sign_payload(&self.secret, VERSION, tenant_id, expires_at)
        )
    }
}

fn validate_tenant_id(tenant_id: &str) -> Result<(), TenantTokenError> {
    if tenant_id.is_empty()
        || tenant_id.len() > MAX_TENANT_ID_LENGTH
        || !tenant_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
    {
        return Err(TenantTokenError::InvalidTenantId);
    }

    Ok(())
}

fn sign_payload(secret: &[u8], version: &str, tenant_id: &str, expires_at: u64) -> String {
    let payload = format!("{version}.{tenant_id}.{expires_at}");
    let mut mac = HmacSha256::new_from_slice(secret).expect("HMAC accepts keys of any length");
    mac.update(payload.as_bytes());

    let mut output = String::with_capacity(SIGNATURE_HEX_LENGTH);
    for byte in mac.finalize().into_bytes() {
        output.push_str(&format!("{byte:02x}"));
    }
    output
}

fn constant_time_hex_eq(expected: &str, actual: &str) -> bool {
    if actual.len() != expected.len() {
        return false;
    }

    let mut difference = 0u8;
    for (left, right) in expected.bytes().zip(actual.bytes()) {
        difference |= left ^ right;
    }

    difference == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    fn verifier() -> TenantTokenVerifier {
        TenantTokenVerifier::new(b"01234567890123456789012345678901").unwrap()
    }

    #[test]
    fn verifies_signed_tenant_context() {
        let verifier = verifier();
        let token = verifier.sign_for_test("tenant_a", 2_000);

        assert_eq!(
            verifier.verify(&token, 1_000).unwrap(),
            TenantContext {
                tenant_id: "tenant_a".into(),
                expires_at: 2_000
            }
        );
    }

    #[test]
    fn rejects_tampered_tenant_id() {
        let verifier = verifier();
        let token = verifier.sign_for_test("tenant_a", 2_000);
        let tampered = token.replacen("tenant_a", "tenant_b", 1);

        assert_eq!(
            verifier.verify(&tampered, 1_000),
            Err(TenantTokenError::InvalidSignature)
        );
    }

    #[test]
    fn rejects_expired_token() {
        let verifier = verifier();
        let token = verifier.sign_for_test("tenant_a", 2_000);

        assert_eq!(
            verifier.verify(&token, 2_000),
            Err(TenantTokenError::Expired)
        );
    }

    #[test]
    fn rejects_weak_signing_secret() {
        assert_eq!(
            TenantTokenVerifier::new("too-short"),
            Err(TenantTokenError::InvalidSignature)
        );
    }

    #[test]
    fn rejects_invalid_tenant_identifier() {
        let verifier = verifier();

        assert_eq!(
            verifier.verify("v1.tenant.a.00", 0),
            Err(TenantTokenError::InvalidTenantId)
        );
    }

    #[test]
    fn rejects_extra_token_parts() {
        let verifier = verifier();
        assert_eq!(
            verifier.verify("v1.tenant_a.2000.00.extra", 1000),
            Err(TenantTokenError::InvalidFormat)
        );
    }
}
