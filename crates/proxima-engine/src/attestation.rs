//! Tamper-evident attestation records. HMAC authenticates records; the chained SHA-256
//! hash detects reordering, deletion, and alteration. Keep the signing key outside the
//! database and rotate it under an explicit key-version policy.
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};
use std::fmt;

type HmacSha256 = Hmac<Sha256>;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TelemetrySummary {
    pub total_processed_queries: u64,
    pub authenticated_tenant_sessions: u64,
    pub blocked_unauthorized_violations: u64,
    pub p99_latency_overhead_ms: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SecurityState {
    pub force_rls_active: Option<bool>,
    pub tls_termination_enforced: Option<bool>,
    pub circuit_breaker_tripped: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AttestationRecord {
    pub attestation_version: u32,
    pub organization_id: String,
    pub node_id: String,
    pub epoch_timestamp_start: i64,
    pub epoch_timestamp_end: i64,
    pub telemetry_summary: TelemetrySummary,
    pub security_state: SecurityState,
    pub previous_block_hash: String,
    pub block_hash: String,
    pub key_id: String,
    pub block_hash_signature: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AttestationError {
    InvalidKey,
    InvalidInterval,
    InvalidIdentity,
    BrokenChain { index: usize },
    InvalidHash { index: usize },
    InvalidSignature { index: usize },
}

impl fmt::Display for AttestationError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidKey => write!(f, "attestation signing key must contain at least 32 bytes"),
            Self::InvalidInterval => write!(f, "attestation interval is invalid"),
            Self::InvalidIdentity => write!(f, "organization and node identifiers must not be empty"),
            Self::BrokenChain { index } => write!(f, "attestation chain is broken at record {index}"),
            Self::InvalidHash { index } => write!(f, "attestation hash is invalid at record {index}"),
            Self::InvalidSignature { index } => write!(f, "attestation signature is invalid at record {index}"),
        }
    }
}
impl std::error::Error for AttestationError {}

pub struct AttestationSigner { key: Vec<u8>, key_id: String }

impl AttestationSigner {
    pub fn new(key: impl AsRef<[u8]>, key_id: impl Into<String>) -> Result<Self, AttestationError> {
        if key.as_ref().len() < 32 { return Err(AttestationError::InvalidKey); }
        let key_id = key_id.into();
        if key_id.trim().is_empty() { return Err(AttestationError::InvalidIdentity); }
        Ok(Self { key: key.as_ref().to_vec(), key_id })
    }

    pub fn sign(
        &self,
        organization_id: impl Into<String>,
        node_id: impl Into<String>,
        start: i64,
        end: i64,
        telemetry_summary: TelemetrySummary,
        security_state: SecurityState,
        previous_block_hash: impl Into<String>,
    ) -> Result<AttestationRecord, AttestationError> {
        let organization_id = organization_id.into();
        let node_id = node_id.into();
        let previous_block_hash = previous_block_hash.into();
        if organization_id.trim().is_empty() || node_id.trim().is_empty() {
            return Err(AttestationError::InvalidIdentity);
        }
        if start < 0 || end <= start {
            return Err(AttestationError::InvalidInterval);
        }
        let canonical = canonical_payload(
            1, &organization_id, &node_id, start, end, &telemetry_summary,
            &security_state, &previous_block_hash, &self.key_id,
        );
        let block_hash = hex_digest(canonical.as_bytes());
        let block_hash_signature = self.mac(&block_hash);
        Ok(AttestationRecord {
            attestation_version: 1, organization_id, node_id,
            epoch_timestamp_start: start, epoch_timestamp_end: end,
            telemetry_summary, security_state, previous_block_hash,
            block_hash, key_id: self.key_id.clone(), block_hash_signature,
        })
    }

    pub fn verify(&self, records: &[AttestationRecord]) -> Result<(), AttestationError> {
        let mut previous = String::from("GENESIS");
        for (index, record) in records.iter().enumerate() {
            if record.previous_block_hash != previous {
                return Err(AttestationError::BrokenChain { index });
            }
            let canonical = canonical_payload(
                record.attestation_version, &record.organization_id, &record.node_id,
                record.epoch_timestamp_start, record.epoch_timestamp_end,
                &record.telemetry_summary, &record.security_state,
                &record.previous_block_hash, &record.key_id,
            );
            let expected_hash = hex_digest(canonical.as_bytes());
            if !constant_time_eq(expected_hash.as_bytes(), record.block_hash.as_bytes()) {
                return Err(AttestationError::InvalidHash { index });
            }
            let expected_signature = self.mac(&record.block_hash);
            if record.key_id != self.key_id ||
                !constant_time_eq(expected_signature.as_bytes(), record.block_hash_signature.as_bytes()) {
                return Err(AttestationError::InvalidSignature { index });
            }
            previous = record.block_hash.clone();
        }
        Ok(())
    }

    fn mac(&self, value: &str) -> String {
        let mut mac = HmacSha256::new_from_slice(&self.key).expect("HMAC accepts any key length");
        mac.update(value.as_bytes());
        hex_bytes(&mac.finalize().into_bytes())
    }
}

fn canonical_payload(
    version: u32, organization_id: &str, node_id: &str, start: i64, end: i64,
    telemetry: &TelemetrySummary, state: &SecurityState, previous: &str, key_id: &str,
) -> String {
    // Length-prefix all variable strings to avoid delimiter ambiguity.
    format!(
        "v={version};org={}:{};node={}:{};start={start};end={end};queries={};sessions={};blocked={};p99={};rls={};tls={};breaker={};prev={}:{};key={}:{}",
        organization_id.len(), organization_id, node_id.len(), node_id, telemetry.total_processed_queries,
        telemetry.authenticated_tenant_sessions, telemetry.blocked_unauthorized_violations,
        telemetry.p99_latency_overhead_ms.map(|v| v.to_string()).unwrap_or_else(|| "unknown".into()),
        telemetry.security_bool(state.force_rls_active), telemetry.security_bool(state.tls_termination_enforced),
        state.circuit_breaker_tripped, previous.len(), previous, key_id.len(), key_id,
    )
}
impl TelemetrySummary {
    fn security_bool(&self, value: Option<bool>) -> &'static str {
        match value { Some(true) => "true", Some(false) => "false", None => "unknown" }
    }
}
fn hex_digest(value: &[u8]) -> String { hex_bytes(&Sha256::digest(value)) }
fn hex_bytes(value: &[u8]) -> String {
    let mut out = String::with_capacity(value.len() * 2);
    for byte in value { out.push_str(&format!("{byte:02x}")); }
    out
}
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() { return false; }
    a.iter().zip(b).fold(0u8, |diff, (x, y)| diff | (x ^ y)) == 0
}

#[cfg(test)]
mod tests {
    use super::*;
    fn signer() -> AttestationSigner {
        AttestationSigner::new(b"01234567890123456789012345678901", "test-key-v1").unwrap()
    }
    fn record(signer: &AttestationSigner, previous: &str, start: i64) -> AttestationRecord {
        signer.sign("org-1", "node-1", start, start + 3600,
            TelemetrySummary { total_processed_queries: 42, authenticated_tenant_sessions: 3,
                blocked_unauthorized_violations: 1, p99_latency_overhead_ms: Some(2) },
            SecurityState { force_rls_active: Some(true), tls_termination_enforced: Some(true),
                circuit_breaker_tripped: false }, previous).unwrap()
    }
    #[test]
    fn signs_and_verifies_chained_records() {
        let signer = signer();
        let first = record(&signer, "GENESIS", 100);
        let second = record(&signer, &first.block_hash, 3700);
        assert!(signer.verify(&[first, second]).is_ok());
    }
    #[test]
    fn detects_tampering_and_missing_links() {
        let signer = signer();
        let first = record(&signer, "GENESIS", 100);
        let mut altered = record(&signer, &first.block_hash, 3700);
        altered.telemetry_summary.total_processed_queries += 1;
        assert!(matches!(signer.verify(&[first.clone(), altered]), Err(AttestationError::InvalidHash { index: 1 })));
        let second = record(&signer, "wrong-parent", 3700);
        assert!(matches!(signer.verify(&[first, second]), Err(AttestationError::BrokenChain { index: 1 })));
    }
    #[test]
    fn rejects_weak_keys_and_invalid_intervals() {
        assert!(matches!(AttestationSigner::new("short", "key"), Err(AttestationError::InvalidKey)));
        assert!(matches!(signer().sign("org", "node", 10, 10,
            TelemetrySummary { total_processed_queries: 0, authenticated_tenant_sessions: 0,
                blocked_unauthorized_violations: 0, p99_latency_overhead_ms: None },
            SecurityState { force_rls_active: None, tls_termination_enforced: None, circuit_breaker_tripped: false },
            "GENESIS"), Err(AttestationError::InvalidInterval)));
    }
}
