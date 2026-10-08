use hmac::{Hmac, Mac};
use sha2::Sha256;
use std::collections::HashMap;
use std::fmt;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

type HmacSha256 = Hmac<Sha256>;

const V1: &str = "v1";
const V2: &str = "v2";
const MAX_COMPONENT_LENGTH: usize = 128;
const SIGNATURE_HEX_LENGTH: usize = 64;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TenantContext {
    pub tenant_id: String,
    pub expires_at: u64,
    pub organization_id: Option<String>,
    pub environment_id: Option<String>,
    pub integration_id: Option<String>,
    pub jti: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TenantTokenError {
    InvalidFormat,
    UnsupportedVersion,
    InvalidTenantId,
    InvalidContextComponent,
    InvalidExpiry,
    Expired,
    InvalidSignature,
    ReplayDetected,
}

impl fmt::Display for TenantTokenError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidFormat => write!(f, "invalid Proxima tenant token format"),
            Self::UnsupportedVersion => write!(f, "unsupported Proxima tenant token version"),
            Self::InvalidTenantId => write!(f, "invalid tenant identifier"),
            Self::InvalidContextComponent => write!(f, "invalid tenant context component"),
            Self::InvalidExpiry => write!(f, "invalid tenant token expiry"),
            Self::Expired => write!(f, "tenant token has expired"),
            Self::InvalidSignature => write!(f, "invalid tenant token signature"),
            Self::ReplayDetected => write!(f, "tenant context replay detected"),
        }
    }
}

impl std::error::Error for TenantTokenError {}

#[derive(Clone)]
pub struct TenantTokenVerifier {
    secret: Vec<u8>,
    replay_cache: Arc<Mutex<HashMap<String, u64>>>,
}

impl TenantTokenVerifier {
    pub fn new(secret: impl AsRef<[u8]>) -> Result<Self, TenantTokenError> {
        let secret = secret.as_ref();
        if secret.len() < 32 {
            return Err(TenantTokenError::InvalidSignature);
        }

        Ok(Self {
            secret: secret.to_vec(),
            replay_cache: Arc::new(Mutex::new(HashMap::new())),
        })
    }

    pub fn verify(
        &self,
        token: &str,
        now_unix_seconds: u64,
    ) -> Result<TenantContext, TenantTokenError> {
        let parts: Vec<&str> = token.split('.').collect();
        match parts.first().copied() {
            Some(V1) => self.verify_v1(&parts, now_unix_seconds),
            Some(V2) => self.verify_v2(&parts, now_unix_seconds),
            _ => Err(TenantTokenError::UnsupportedVersion),
        }
    }

    fn verify_v1(
        &self,
        parts: &[&str],
        now_unix_seconds: u64,
    ) -> Result<TenantContext, TenantTokenError> {
        if parts.len() != 4 {
            return Err(TenantTokenError::InvalidFormat);
        }

        let tenant_id = parts[1];
        validate_tenant_id(tenant_id)?;
        let expires_at = parse_expiry(parts[2])?;
        ensure_not_expired(expires_at, now_unix_seconds)?;

        let expected = sign_payload(&self.secret, &parts[..3].join("."));
        if !constant_time_hex_eq(&expected, parts[3]) {
            return Err(TenantTokenError::InvalidSignature);
        }

        Ok(TenantContext {
            tenant_id: tenant_id.to_owned(),
            expires_at,
            organization_id: None,
            environment_id: None,
            integration_id: None,
            jti: None,
        })
    }

    fn verify_v2(
        &self,
        parts: &[&str],
        now_unix_seconds: u64,
    ) -> Result<TenantContext, TenantTokenError> {
        if parts.len() != 8 {
            return Err(TenantTokenError::InvalidFormat);
        }

        let organization_id = parts[1];
        let tenant_id = parts[2];
        let environment_id = parts[3];
        let integration_id = parts[4];
        let expires_at = parse_expiry(parts[5])?;
        let jti = parts[6];

        validate_context_component(organization_id)?;
        validate_tenant_id(tenant_id)?;
        validate_context_component(environment_id)?;
        validate_context_component(integration_id)?;
        validate_context_component(jti)?;
        ensure_not_expired(expires_at, now_unix_seconds)?;

        let expected = sign_payload(&self.secret, &parts[..7].join("."));
        if !constant_time_hex_eq(&expected, parts[7]) {
            return Err(TenantTokenError::InvalidSignature);
        }

        self.consume_jti(jti, expires_at, now_unix_seconds)?;

        Ok(TenantContext {
            tenant_id: tenant_id.to_owned(),
            expires_at,
            organization_id: Some(organization_id.to_owned()),
            environment_id: Some(environment_id.to_owned()),
            integration_id: Some(integration_id.to_owned()),
            jti: Some(jti.to_owned()),
        })
    }

    fn consume_jti(
        &self,
        jti: &str,
        expires_at: u64,
        now_unix_seconds: u64,
    ) -> Result<(), TenantTokenError> {
        let mut cache = self
            .replay_cache
            .lock()
            .map_err(|_| TenantTokenError::InvalidSignature)?;

        cache.retain(|_, expiry| *expiry > now_unix_seconds);
        if cache.contains_key(jti) {
            return Err(TenantTokenError::ReplayDetected);
        }
        cache.insert(jti.to_owned(), expires_at);
        Ok(())
    }

    pub fn verify_now(&self, token: &str) -> Result<TenantContext, TenantTokenError> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| TenantTokenError::InvalidExpiry)?
            .as_secs();

        self.verify(token, now)
    }

    #[cfg(test)]
    pub(crate) fn sign_for_test(&self, tenant_id: &str, expires_at: u64) -> String {
        validate_tenant_id(tenant_id).unwrap();
        let payload = format!("{V1}.{tenant_id}.{expires_at}");
        format!("{payload}.{}", sign_payload(&self.secret, &payload))
    }

    #[cfg(test)]
    pub(crate) fn sign_v2_for_test(
        &self,
        organization_id: &str,
        tenant_id: &str,
        environment_id: &str,
        integration_id: &str,
        expires_at: u64,
        jti: &str,
    ) -> String {
        validate_context_component(organization_id).unwrap();
        validate_tenant_id(tenant_id).unwrap();
        validate_context_component(environment_id).unwrap();
        validate_context_component(integration_id).unwrap();
        validate_context_component(jti).unwrap();
        let payload = format!(
            "{V2}.{organization_id}.{tenant_id}.{environment_id}.{integration_id}.{expires_at}.{jti}"
        );
        format!("{payload}.{}", sign_payload(&self.secret, &payload))
    }
}

fn validate_tenant_id(tenant_id: &str) -> Result<(), TenantTokenError> {
    if tenant_id.is_empty()
        || tenant_id.len() > MAX_COMPONENT_LENGTH
        || !tenant_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
    {
        return Err(TenantTokenError::InvalidTenantId);
    }

    Ok(())
}

fn validate_context_component(value: &str) -> Result<(), TenantTokenError> {
    if value.is_empty()
        || value.len() > MAX_COMPONENT_LENGTH
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
    {
        return Err(TenantTokenError::InvalidContextComponent);
    }
    Ok(())
}

fn parse_expiry(value: &str) -> Result<u64, TenantTokenError> {
    value
        .parse::<u64>()
        .map_err(|_| TenantTokenError::InvalidExpiry)
}

fn ensure_not_expired(expires_at: u64, now_unix_seconds: u64) -> Result<(), TenantTokenError> {
    if now_unix_seconds >= expires_at {
        return Err(TenantTokenError::Expired);
    }
    Ok(())
}

fn sign_payload(secret: &[u8], payload: &str) -> String {
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
                expires_at: 2_000,
                organization_id: None,
                environment_id: None,
                integration_id: None,
                jti: None,
            }
        );
    }

    #[test]
    fn verifies_v2_customer_context() {
        let verifier = verifier();
        let token = verifier.sign_v2_for_test(
            "org_a",
            "tenant_a",
            "environment_a",
            "integration_a",
            2_000,
            "jti_a",
        );

        assert_eq!(
            verifier.verify(&token, 1_000).unwrap(),
            TenantContext {
                tenant_id: "tenant_a".into(),
                expires_at: 2_000,
                organization_id: Some("org_a".into()),
                environment_id: Some("environment_a".into()),
                integration_id: Some("integration_a".into()),
                jti: Some("jti_a".into()),
            }
        );
    }

    #[test]
    fn rejects_v2_replay() {
        let verifier = verifier();
        let token = verifier.sign_v2_for_test(
            "org_a",
            "tenant_a",
            "environment_a",
            "integration_a",
            2_000,
            "jti_replay",
        );

        assert!(verifier.verify(&token, 1_000).is_ok());
        assert_eq!(
            verifier.verify(&token, 1_001),
            Err(TenantTokenError::ReplayDetected)
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
        assert!(matches!(
            TenantTokenVerifier::new("too-short"),
            Err(TenantTokenError::InvalidSignature)
        ));
    }

    #[test]
    fn rejects_invalid_tenant_identifier() {
        let verifier = verifier();

        assert_eq!(
            verifier.verify("v1.bad!.2000.00", 0),
            Err(TenantTokenError::InvalidTenantId)
        );
    }

    #[test]
    fn rejects_invalid_v2_context_component() {
        let verifier = verifier();
        let token = "v2.org_a.tenant_a.bad!.integration_a.2000.jti_a.00";
        assert_eq!(
            verifier.verify(token, 1_000),
            Err(TenantTokenError::InvalidContextComponent)
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
