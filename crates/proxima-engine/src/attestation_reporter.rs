//! Hourly signed telemetry delivery to the authenticated control plane.
use std::{env, sync::Arc, time::Duration};

use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};
use serde_json::{json, Value};
use tokio::time::{interval, MissedTickBehavior};
use tracing::{error, info, warn};

use crate::{breaker::PeerCircuitBreaker, monitor::EngineMetrics};

#[derive(Clone)]
struct ReporterConfig {
    base_url: String,
    api_key: String,
    organization_id: String,
    node_id: String,
    signing_key: Vec<u8>,
    signing_key_id: String,
}

impl ReporterConfig {
    fn from_env() -> Result<Option<Self>, String> {
        let base_url = env::var("PROXIMA_CONTROL_PLANE_URL").unwrap_or_default();
        let api_key = env::var("PROXIMA_CONTROL_PLANE_API_KEY").unwrap_or_default();
        let organization_id = env::var("PROXIMA_ORGANIZATION_ID").unwrap_or_default();
        let node_id = env::var("PROXIMA_NODE_ID").unwrap_or_default();
        let signing_key_id = env::var("PROXIMA_ATTESTATION_SIGNING_KEY_ID").unwrap_or_default();
        let signing_key = env::var("PROXIMA_ATTESTATION_SIGNING_KEY").unwrap_or_default();
        let any_configured = [
            !base_url.is_empty(), !api_key.is_empty(), !organization_id.is_empty(),
            !node_id.is_empty(), !signing_key_id.is_empty(), !signing_key.is_empty(),
        ].into_iter().any(|value| value);
        if !any_configured {
            return Ok(None);
        }
        if [base_url.as_str(), api_key.as_str(), organization_id.as_str(),
            node_id.as_str(), signing_key_id.as_str(), signing_key.as_str()]
            .iter().any(|value| value.trim().is_empty()) {
            return Err("attestation reporting requires PROXIMA_CONTROL_PLANE_URL, PROXIMA_CONTROL_PLANE_API_KEY, PROXIMA_ORGANIZATION_ID, PROXIMA_NODE_ID, PROXIMA_ATTESTATION_SIGNING_KEY_ID and PROXIMA_ATTESTATION_SIGNING_KEY together".into());
        }
        if !is_canonical_uuid(&organization_id) {
            return Err("PROXIMA_ORGANIZATION_ID must be a canonical UUID".into());
        }
        if node_id.trim().is_empty() || node_id.len() > 200 {
            return Err("PROXIMA_NODE_ID must contain 1-200 characters".into());
        }
        if signing_key.len() < 32 {
            return Err("PROXIMA_ATTESTATION_SIGNING_KEY must contain at least 32 bytes".into());
        }
        let url = reqwest::Url::parse(&base_url)
            .map_err(|error| format!("invalid PROXIMA_CONTROL_PLANE_URL: {error}"))?;
        if url.scheme() != "https" && !matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "::1")) {
            return Err("attestation reporting requires HTTPS except for localhost development".into());
        }
        Ok(Some(Self { base_url: base_url.trim_end_matches('/').to_string(), api_key,
            organization_id, node_id, signing_key: signing_key.into_bytes(), signing_key_id }))
    }
}

pub async fn run(
    metrics: Arc<EngineMetrics>,
    breaker: Arc<PeerCircuitBreaker>,
    force_rls_active: bool,
    tls_termination_enforced: bool,
) {
    let config = match ReporterConfig::from_env() {
        Ok(Some(config)) => config,
        Ok(None) => {
            info!("attestation reporting disabled; configure the complete PROXIMA_* attestation contract to enable it");
            return;
        }
        Err(error) => {
            error!(%error, "attestation reporter configuration invalid");
            return;
        }
    };
    let client = match reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(15))
        .build() {
        Ok(client) => client,
        Err(error) => {
            error!(%error, "cannot initialize attestation HTTP client");
            return;
        }
    };
    info!(node_id = %config.node_id, "hourly security attestation reporting enabled");
    let mut ticker = interval(Duration::from_secs(3600));
    ticker.set_missed_tick_behavior(MissedTickBehavior::Skip);
    // Do not emit an immediate partial-hour block at startup.
    ticker.tick().await;
    let mut previous_queries = metrics.total_processed_queries();
    let mut previous_sessions = metrics.authenticated_tenant_sessions();
    let mut previous_violations = metrics.blocked_unauthorized_violations();
    loop {
        ticker.tick().await;
        let current_queries = metrics.total_processed_queries();
        let current_sessions = metrics.authenticated_tenant_sessions();
        let current_violations = metrics.blocked_unauthorized_violations();
        let summary = (
            current_queries.saturating_sub(previous_queries),
            current_sessions.saturating_sub(previous_sessions),
            current_violations.saturating_sub(previous_violations),
        );
        previous_queries = current_queries;
        previous_sessions = current_sessions;
        previous_violations = current_violations;
        if let Err(error) = submit_epoch(
            &client, &config, summary.0, summary.1, summary.2,
            force_rls_active, tls_termination_enforced, breaker.any_peer_blocked(),
        ).await {
            warn!(%error, "security attestation epoch was not accepted; evidence will not be represented as verified");
        }
    }
}

async fn submit_epoch(
    client: &reqwest::Client,
    config: &ReporterConfig,
    queries: u64,
    sessions: u64,
    violations: u64,
    force_rls_active: bool,
    tls_termination_enforced: bool,
    breaker_tripped: bool,
) -> Result<(), String> {
    let endpoint = format!("{}/api/v1/attestations", config.base_url);
    let latest: Value = client.get(&endpoint).bearer_auth(&config.api_key).send().await
        .map_err(|error| format!("fetch previous attestation: {error}"))?
        .error_for_status().map_err(|error| format!("attestation read rejected: {error}"))?
        .json().await.map_err(|error| format!("decode previous attestation: {error}"))?;
    let records = latest.get("attestations").and_then(Value::as_array).ok_or("control plane response omitted attestations array")?;
    let previous = records.iter()
        .filter(|record| record.get("node_id").and_then(Value::as_str) == Some(config.node_id.as_str()))
        .max_by_key(|record| record.get("epoch_timestamp_end").and_then(Value::as_i64).unwrap_or(0));
    let previous_hash = previous.and_then(|record| record.get("block_hash_signature"))
        .and_then(Value::as_str).unwrap_or("").to_string();
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)
        .map_err(|error| format!("system clock before Unix epoch: {error}"))?.as_secs() as i64;
    let start = previous.and_then(|record| record.get("epoch_timestamp_end").and_then(Value::as_i64))
        .unwrap_or_else(|| now.saturating_sub(3600));
    if start >= now {
        return Err("system clock has not advanced beyond the previous attestation epoch".into());
    }
    let canonical = format!(
        "{}\n{}\n{}\n{}\n{}\n{}\n{}\n{}\n{}\n{}\n{}\n{}\n{}\n{}",
        1, config.organization_id, config.node_id, start, now, queries, sessions, violations,
        0.0_f64, force_rls_active, tls_termination_enforced, breaker_tripped,
        previous_hash, "agata-proxima-attestation-v1"
    );
    let block_hash = hex_lower(&Sha256::digest(canonical.as_bytes()));
    let mut mac = Hmac::<Sha256>::new_from_slice(&config.signing_key)
        .map_err(|_| "invalid attestation signing key".to_string())?;
    mac.update(block_hash.as_bytes());
    let signature_hex = hex_lower(&mac.finalize().into_bytes());
    let payload = json!({
        "node_id": config.node_id,
        "epoch_timestamp_start": start,
        "epoch_timestamp_end": now,
        "total_processed_queries": queries,
        "authenticated_tenant_sessions": sessions,
        "blocked_unauthorized_violations": violations,
        "p99_latency_overhead_ms": null,
        "force_rls_active": force_rls_active,
        "tls_termination_enforced": tls_termination_enforced,
        "circuit_breaker_tripped": breaker_tripped,
        "previous_block_hash": previous_hash,
        "block_hash": block_hash,
        "signature_hex": signature_hex,
        "signing_key_id": config.signing_key_id,
    });
    client.post(&endpoint).bearer_auth(&config.api_key).json(&payload).send().await
        .map_err(|error| format!("submit attestation: {error}"))?
        .error_for_status().map_err(|error| format!("attestation submission rejected: {error}"))?;
    info!(node_id = %config.node_id, epoch_start = start, epoch_end = now, %block_hash, "signed security attestation accepted");
    Ok(())
}

fn is_canonical_uuid(value: &str) -> bool {
    value.len() == 36
        && value.chars().enumerate().all(|(index, character)| {
            if [8, 13, 18, 23].contains(&index) {
                character == '-'
            } else {
                character.is_ascii_hexdigit()
            }
        })
}

fn hex_lower(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(HEX[(byte >> 4) as usize] as char);
        output.push(HEX[(byte & 15) as usize] as char);
    }
    output
}

#[cfg(test)]
mod tests {
    use super::hex_lower;
    #[test]
    fn hex_encoding_is_lowercase_and_stable() {
        assert_eq!(hex_lower(&[0, 15, 16, 255]), "000f10ff");
    }
}
