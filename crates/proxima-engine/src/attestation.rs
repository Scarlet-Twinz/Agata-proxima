use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};
use std::io;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::io::AsyncWriteExt;
use tokio::sync::Mutex;

type HmacSha256 = Hmac<Sha256>;

#[derive(Clone, Debug)]
pub struct AttestationConfig {
    pub ledger_path: PathBuf,
    pub signing_key: Option<Vec<u8>>,
    pub organization_id: String,
    pub node_id: String,
}

impl AttestationConfig {
    pub fn from_env() -> Self {
        Self {
            ledger_path: std::env::var("PROXIMA_ATTESTATION_LEDGER_PATH").map(PathBuf::from).unwrap_or_else(|_| PathBuf::from("data/proxima-attestations.jsonl")),
            signing_key: std::env::var("PROXIMA_ATTESTATION_SIGNING_KEY").ok().filter(|v| v.len() >= 32).map(String::into_bytes),
            organization_id: std::env::var("PROXIMA_ORGANIZATION_ID").unwrap_or_else(|_| "unconfigured".into()),
            node_id: std::env::var("PROXIMA_NODE_ID").unwrap_or_else(|_| "local-node".into()),
        }
    }
}

pub struct AttestationLedger {
    config: AttestationConfig,
    lock: Mutex<()>,
}

impl AttestationLedger {
    pub fn new(config: AttestationConfig) -> Self { Self { config, lock: Mutex::new(()) } }

    pub async fn append_hourly(&self, telemetry: TelemetrySummary, state: SecurityState) -> io::Result<String> {
        let _guard = self.lock.lock().await;
        if self.config.signing_key.is_none() {
            return Err(io::Error::new(io::ErrorKind::PermissionDenied, "PROXIMA_ATTESTATION_SIGNING_KEY must be at least 32 bytes before signing attestations"));
        }
        let end = unix_now()?;
        let start = end.saturating_sub(3600);
        let previous_hash = previous_hash(&self.config.ledger_path).await?;
        let canonical = format!(
            "attestation_version=1\norganization_id={}\nnode_id={}\nepoch_timestamp_start={}\nepoch_timestamp_end={}\ntotal_processed_queries={}\nauthenticated_tenant_sessions={}\nblocked_unauthorized_violations={}\np99_latency_overhead_ms={}\nforce_rls_active={}\ntls_termination_enforced={}\ncircuit_breaker_tripped={}\nprevious_block_hash={}\n",
            safe(&self.config.organization_id), safe(&self.config.node_id), start, end,
            telemetry.total_processed_queries, telemetry.authenticated_tenant_sessions,
            telemetry.blocked_unauthorized_violations, telemetry.p99_latency_overhead_ms,
            state.force_rls_active, state.tls_termination_enforced, state.circuit_breaker_tripped, previous_hash
        );
        let digest = hex_sha256(canonical.as_bytes());
        let mut mac = HmacSha256::new_from_slice(self.config.signing_key.as_deref().unwrap_or_default())
            .map_err(|_| io::Error::new(io::ErrorKind::InvalidInput, "invalid attestation signing key"))?;
        mac.update(digest.as_bytes());
        let signature = hex_bytes(&mac.finalize().into_bytes());
        let record = format!("{{\"attestation_version\":1,\"organization_id\":\"{}\",\"node_id\":\"{}\",\"epoch_timestamp_start\":{},\"epoch_timestamp_end\":{},\"telemetry_summary\":{{\"total_processed_queries\":{},\"authenticated_tenant_sessions\":{},\"blocked_unauthorized_violations\":{},\"p99_latency_overhead_ms\":{}}},\"security_state\":{{\"force_rls_active\":{},\"tls_termination_enforced\":{},\"circuit_breaker_tripped\":{}}},\"previous_block_hash\":\"{}\",\"canonical_payload\":\"{}\",\"block_hash\":\"{}\",\"block_hash_signature\":\"{}\"}}\n",
            json_escape(&self.config.organization_id), json_escape(&self.config.node_id), start, end,
            telemetry.total_processed_queries, telemetry.authenticated_tenant_sessions,
            telemetry.blocked_unauthorized_violations, telemetry.p99_latency_overhead_ms,
            state.force_rls_active, state.tls_termination_enforced, state.circuit_breaker_tripped,
            previous_hash, json_escape(&canonical), digest, signature
        );
        if let Some(parent) = self.config.ledger_path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }
        let mut file = tokio::fs::OpenOptions::new().create(true).append(true).open(&self.config.ledger_path).await?;
        file.write_all(record.as_bytes()).await?;
        file.sync_all().await?;
        Ok(digest)
    }

    pub async fn verify_chain(&self) -> io::Result<ChainVerification> {
        let _guard = self.lock.lock().await;
        let content = match tokio::fs::read_to_string(&self.config.ledger_path).await {
            Ok(content) => content,
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(ChainVerification { valid: true, records: 0, error: None }),
            Err(error) => return Err(error),
        };
        let mut previous = "GENESIS".to_string();
        let mut count = 0usize;
        for (index, line) in content.lines().enumerate() {
            let expected_prev = format!("\"previous_block_hash\":\"{}\"", previous);
            if !line.contains(&expected_prev) {
                return Ok(ChainVerification { valid: false, records: count, error: Some(format!("chain link mismatch at line {}", index + 1)) });
            }
            let Some(hash) = json_field(line, "block_hash") else {
                return Ok(ChainVerification { valid: false, records: count, error: Some(format!("missing block hash at line {}", index + 1)) });
            };
            let Some(payload) = json_field(line, "canonical_payload") else {
                return Ok(ChainVerification { valid: false, records: count, error: Some(format!("missing canonical payload at line {}", index + 1)) });
            };
            if hex_sha256(json_unescape(&payload).as_bytes()) != hash {
                return Ok(ChainVerification { valid: false, records: count, error: Some(format!("payload hash mismatch at line {}", index + 1)) });
            }
            if !record_matches_payload(line, &json_unescape(&payload))
                || json_field(line, "organization_id").as_deref() != Some(safe(&self.config.organization_id).as_str())
                || json_field(line, "node_id").as_deref() != Some(safe(&self.config.node_id).as_str())
            {
                return Ok(ChainVerification { valid: false, records: count, error: Some(format!("record fields mismatch at line {}", index + 1)) });
            }
            let Some(signature) = json_field(line, "block_hash_signature") else {
                return Ok(ChainVerification { valid: false, records: count, error: Some(format!("missing signature at line {}", index + 1)) });
            };
            if let Some(key) = self.config.signing_key.as_deref() {
                let mut mac = HmacSha256::new_from_slice(key).map_err(|_| io::Error::new(io::ErrorKind::InvalidInput, "invalid signing key"))?;
                mac.update(hash.as_bytes());
                if hex_bytes(&mac.finalize().into_bytes()) != signature {
                    return Ok(ChainVerification { valid: false, records: count, error: Some(format!("signature mismatch at line {}", index + 1)) });
                }
            } else {
                return Ok(ChainVerification { valid: false, records: count, error: Some("signing key is not configured".into()) });
            }
            previous = hash;
            count += 1;
        }
        Ok(ChainVerification { valid: true, records: count, error: None })
    }
}

#[derive(Clone, Copy, Debug, Default)]
pub struct TelemetrySummary {
    pub total_processed_queries: u64,
    pub authenticated_tenant_sessions: u64,
    pub blocked_unauthorized_violations: u64,
    pub p99_latency_overhead_ms: f64,
}

#[derive(Clone, Copy, Debug, Default)]
pub struct SecurityState {
    pub force_rls_active: bool,
    pub tls_termination_enforced: bool,
    pub circuit_breaker_tripped: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChainVerification {
    pub valid: bool,
    pub records: usize,
    pub error: Option<String>,
}

async fn previous_hash(path: &Path) -> io::Result<String> {
    match tokio::fs::read_to_string(path).await {
        Ok(content) => Ok(content.lines().last().and_then(|line| json_field(line, "block_hash")).unwrap_or_else(|| "GENESIS".into())),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok("GENESIS".into()),
        Err(error) => Err(error),
    }
}

fn record_matches_payload(record: &str, canonical: &str) -> bool {
    for line in canonical.lines() {
        let Some((key, value)) = line.split_once('=') else { return false; };
        let expected = match key {
            "organization_id" | "node_id" | "previous_block_hash" => format!("\"{key}\":\"{value}\""),
            _ => format!("\"{key}\":{value}"),
        };
        if !record.contains(&expected) { return false; }
    }
    true
}

fn json_unescape(value: &str) -> String {
    let mut output = String::with_capacity(value.len());
    let mut chars = value.chars();
    while let Some(ch) = chars.next() {
        if ch == '\\' {
            match chars.next() {
                Some('n') => output.push('\n'),
                Some('r') => output.push('\r'),
                Some('\\') => output.push('\\'),
                Some('"') => output.push('"'),
                Some(other) => { output.push('\\'); output.push(other); }
                None => output.push('\\'),
            }
        } else {
            output.push(ch);
        }
    }
    output
}

fn json_field<'a>(line: &'a str, field: &str) -> Option<String> {
    let marker = format!("\"{field}\":\"");
    let start = line.find(&marker)? + marker.len();
    let end = line[start..].find('"')? + start;
    Some(line[start..end].to_string())
}
fn safe(value: &str) -> String { value.chars().filter(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.')).take(128).collect() }
fn json_escape(value: &str) -> String { value.replace('\\', "\\\\").replace('"', "\\\"").replace('\n', "\\n").replace('\r', "\\r") }
fn hex_sha256(input: &[u8]) -> String { let digest = Sha256::digest(input); hex_bytes(&digest) }
fn hex_bytes(bytes: &[u8]) -> String { bytes.iter().map(|byte| format!("{byte:02x}")).collect() }
fn unix_now() -> io::Result<u64> { Ok(SystemTime::now().duration_since(UNIX_EPOCH).map_err(|_| io::Error::other("system clock before UNIX epoch"))?.as_secs()) }

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn signed_records_chain_and_detect_tampering() {
        let path = std::env::temp_dir().join(format!("proxima-attest-{}.jsonl", std::process::id()));
        let _ = tokio::fs::remove_file(&path).await;
        let ledger = AttestationLedger::new(AttestationConfig {
            ledger_path: path.clone(),
            signing_key: Some(b"01234567890123456789012345678901".to_vec()),
            organization_id: "org-test".into(), node_id: "node-test".into(),
        });
        ledger.append_hourly(TelemetrySummary::default(), SecurityState::default()).await.unwrap();
        assert_eq!(ledger.verify_chain().await.unwrap(), ChainVerification { valid: true, records: 1, error: None });
        tokio::fs::write(&path, "{\"previous_block_hash\":\"GENESIS\",\"block_hash\":\"forged\",\"block_hash_signature\":\"bad\"}\n").await.unwrap();
        assert!(!ledger.verify_chain().await.unwrap().valid);
        let _ = tokio::fs::remove_file(path).await;
    }
}
