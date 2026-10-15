//! Deterministic hash-chain primitives for security-state attestation.
//! Hash chaining detects edits and reordering; deployments must additionally sign
//! block hashes with a separately managed private key before claiming authenticity.
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, PartialEq)]
pub struct TelemetrySummary {
    pub total_processed_queries: u64,
    pub authenticated_tenant_sessions: u64,
    pub blocked_unauthorized_violations: u64,
    pub p99_latency_overhead_ms: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SecurityState {
    pub force_rls_active: bool,
    pub tls_termination_enforced: bool,
    pub circuit_breaker_tripped: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct AttestationBlock {
    pub attestation_version: u32,
    pub organization_id: String,
    pub node_id: String,
    pub epoch_timestamp_start: u64,
    pub epoch_timestamp_end: u64,
    pub telemetry_summary: TelemetrySummary,
    pub security_state: SecurityState,
    pub previous_block_hash: String,
    pub block_hash_signature: String,
}

impl AttestationBlock {
    pub fn new(
        organization_id: String,
        node_id: String,
        start: u64,
        end: u64,
        telemetry_summary: TelemetrySummary,
        security_state: SecurityState,
        previous_block_hash: String,
    ) -> Result<Self, &'static str> {
        if organization_id.trim().is_empty() || node_id.trim().is_empty() {
            return Err("organization_id and node_id are required");
        }
        if end <= start {
            return Err("epoch_timestamp_end must be > epoch_timestamp_start");
        }
        let mut block = Self {
            attestation_version: 1,
            organization_id,
            node_id,
            epoch_timestamp_start: start,
            epoch_timestamp_end: end,
            telemetry_summary,
            security_state,
            previous_block_hash,
            block_hash_signature: String::new(),
        };
        block.block_hash_signature = block.calculate_hash();
        Ok(block)
    }
    pub fn calculate_hash(&self) -> String {
        let canonical = format!(
            "{}\n{}\n{}\n{}\n{}\n{}\n{}\n{}\n{}\n{}\n{}\n{}\n{}\n{}",
            self.attestation_version,
            self.organization_id,
            self.node_id,
            self.epoch_timestamp_start,
            self.epoch_timestamp_end,
            self.telemetry_summary.total_processed_queries,
            self.telemetry_summary.authenticated_tenant_sessions,
            self.telemetry_summary.blocked_unauthorized_violations,
            self.telemetry_summary
                .p99_latency_overhead_ms
                .unwrap_or(0.0),
            self.security_state.force_rls_active,
            self.security_state.tls_termination_enforced,
            self.security_state.circuit_breaker_tripped,
            self.previous_block_hash,
            "agata-proxima-attestation-v1"
        );
        hex_lower(&Sha256::digest(canonical.as_bytes()))
    }
    pub fn verify(&self) -> bool {
        self.epoch_timestamp_end > self.epoch_timestamp_start
            && self.block_hash_signature == self.calculate_hash()
    }
}

/// Sign the canonical block hash with a separately managed HMAC key.
/// HMAC is appropriate for a trusted deployment boundary where the same secret
/// is provisioned to the node and verifier; use asymmetric signatures when
/// verifiers must not possess a signing-capable secret.
pub fn sign_hash_hmac(block_hash: &str, key: &[u8]) -> Result<String, &'static str> {
    if key.len() < 32 {
        return Err("attestation HMAC key must be at least 32 bytes");
    }
    let mut mac =
        Hmac::<Sha256>::new_from_slice(key).map_err(|_| "invalid attestation HMAC key")?;
    mac.update(block_hash.as_bytes());
    Ok(hex_lower(&mac.finalize().into_bytes()))
}

pub fn verify_hash_hmac(block_hash: &str, signature_hex: &str, key: &[u8]) -> bool {
    if key.len() < 32 {
        return false;
    }
    let Ok(signature) = decode_hex(signature_hex) else {
        return false;
    };
    let Ok(mut mac) = Hmac::<Sha256>::new_from_slice(key) else {
        return false;
    };
    mac.update(block_hash.as_bytes());
    mac.verify_slice(&signature).is_ok()
}

fn decode_hex(value: &str) -> Result<Vec<u8>, ()> {
    let (pairs, remainder) = value.as_bytes().as_chunks::<2>();
    if !remainder.is_empty() {
        return Err(());
    }
    pairs
        .iter()
        .map(|pair| {
            let high = (pair[0] as char).to_digit(16).ok_or(())?;
            let low = (pair[1] as char).to_digit(16).ok_or(())?;
            Ok(((high << 4) | low) as u8)
        })
        .collect()
}

fn hex_lower(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push(HEX[(byte >> 4) as usize] as char);
        out.push(HEX[(byte & 15) as usize] as char);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn attestation_is_verifiable_and_tamper_evident() {
        let mut block = AttestationBlock::new(
            "org".into(),
            "node".into(),
            100,
            200,
            TelemetrySummary {
                total_processed_queries: 10,
                authenticated_tenant_sessions: 4,
                blocked_unauthorized_violations: 1,
                p99_latency_overhead_ms: Some(2.0),
            },
            SecurityState {
                force_rls_active: true,
                tls_termination_enforced: true,
                circuit_breaker_tripped: false,
            },
            "genesis".into(),
        )
        .unwrap();
        assert!(block.verify());
        block.telemetry_summary.total_processed_queries += 1;
        assert!(!block.verify());
    }

    #[test]
    fn rejects_empty_epoch() {
        assert!(AttestationBlock::new(
            "org".into(),
            "node".into(),
            200,
            200,
            TelemetrySummary {
                total_processed_queries: 0,
                authenticated_tenant_sessions: 0,
                blocked_unauthorized_violations: 0,
                p99_latency_overhead_ms: None,
            },
            SecurityState {
                force_rls_active: false,
                tls_termination_enforced: false,
                circuit_breaker_tripped: false,
            },
            String::new(),
        )
        .is_err());
    }

    #[test]
    fn hmac_signature_detects_tampering() {
        let key = b"01234567890123456789012345678901";
        let signature = sign_hash_hmac("block-hash", key).unwrap();
        assert!(verify_hash_hmac("block-hash", &signature, key));
        assert!(!verify_hash_hmac("different-hash", &signature, key));
    }

    #[test]
    fn rejects_invalid_epoch() {
        assert!(AttestationBlock::new(
            "org".into(),
            "node".into(),
            201,
            200,
            TelemetrySummary {
                total_processed_queries: 0,
                authenticated_tenant_sessions: 0,
                blocked_unauthorized_violations: 0,
                p99_latency_overhead_ms: None,
            },
            SecurityState {
                force_rls_active: false,
                tls_termination_enforced: false,
                circuit_breaker_tripped: false,
            },
            String::new(),
        )
        .is_err());
    }
}
