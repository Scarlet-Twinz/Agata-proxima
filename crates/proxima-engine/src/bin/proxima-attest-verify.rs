use proxima_engine::attestation::{
    verify_hash_hmac, AttestationBlock, SecurityState, TelemetrySummary,
};
use serde_json::Value;
use std::collections::HashMap;
use std::env;
use std::fs;
use std::process::ExitCode;

struct VerifiedRecord {
    organization_id: String,
    node_id: String,
    epoch_start: u64,
    block_hash: String,
    previous_hash: String,
}

fn required_string<'a>(value: &'a Value, field: &str) -> Result<&'a str, String> {
    value
        .get(field)
        .and_then(Value::as_str)
        .ok_or_else(|| format!("record is missing string field {field}"))
}

fn required_u64(value: &Value, field: &str) -> Result<u64, String> {
    value
        .get(field)
        .and_then(Value::as_u64)
        .ok_or_else(|| format!("record is missing non-negative integer field {field}"))
}

fn verification_key(key_id: &str) -> Result<Vec<u8>, String> {
    if let Ok(keys_json) = env::var("PROXIMA_ATTESTATION_SIGNING_KEYS_JSON") {
        if let Ok(keys) = serde_json::from_str::<HashMap<String, String>>(&keys_json) {
            if let Some(key) = keys.get(key_id).filter(|key| key.len() >= 32) {
                return Ok(key.as_bytes().to_vec());
            }
        }
    }

    let active_key_id = env::var("PROXIMA_ATTESTATION_SIGNING_KEY_ID")
        .map_err(|_| "set PROXIMA_ATTESTATION_SIGNING_KEYS_JSON or active key variables".to_string())?;
    if active_key_id != key_id {
        return Err(format!("no retained verification key is configured for key ID {key_id}"));
    }
    let key = env::var("PROXIMA_ATTESTATION_SIGNING_KEY")
        .map_err(|_| "PROXIMA_ATTESTATION_SIGNING_KEY is not configured".to_string())?;
    if key.len() < 32 {
        return Err("attestation verification key must contain at least 32 bytes".into());
    }
    Ok(key.into_bytes())
}

fn verify_record(value: &Value) -> Result<VerifiedRecord, String> {
    let organization_id = required_string(value, "organization_id")?.to_string();
    let node_id = required_string(value, "node_id")?.to_string();
    let epoch_start = required_u64(value, "epoch_timestamp_start")?;
    let epoch_end = required_u64(value, "epoch_timestamp_end")?;
    let telemetry = TelemetrySummary {
        total_processed_queries: required_u64(value, "total_processed_queries")?,
        authenticated_tenant_sessions: required_u64(value, "authenticated_tenant_sessions")?,
        blocked_unauthorized_violations: required_u64(value, "blocked_unauthorized_violations")?,
        p99_latency_overhead_ms: value
            .get("p99_latency_overhead_ms")
            .and_then(Value::as_f64),
    };
    let security = SecurityState {
        force_rls_active: value
            .get("force_rls_active")
            .and_then(Value::as_bool)
            .ok_or_else(|| "force_rls_active is missing or unknown".to_string())?,
        tls_termination_enforced: value
            .get("tls_termination_enforced")
            .and_then(Value::as_bool)
            .ok_or_else(|| "tls_termination_enforced is missing or unknown".to_string())?,
        circuit_breaker_tripped: value
            .get("circuit_breaker_tripped")
            .and_then(Value::as_bool)
            .ok_or_else(|| "circuit_breaker_tripped is missing or unknown".to_string())?,
    };
    let previous_hash = required_string(value, "previous_block_hash")?.to_string();
    let supplied_hash = value
        .get("block_hash_signature")
        .or_else(|| value.get("block_hash"))
        .and_then(Value::as_str)
        .ok_or_else(|| "record is missing block_hash_signature".to_string())?;
    let algorithm = required_string(value, "signature_algorithm")?;
    if algorithm != "HMAC-SHA256" {
        return Err(format!("unsupported signature algorithm {algorithm}"));
    }
    let key_id = required_string(value, "signing_key_id")?;
    let signature = required_string(value, "signature_hex")?;

    let block = AttestationBlock::new(
        organization_id.clone(),
        node_id.clone(),
        epoch_start,
        epoch_end,
        telemetry,
        security,
        previous_hash.clone(),
    )
    .map_err(|error| error.to_string())?;
    let expected_hash = block.calculate_hash();
    if supplied_hash != expected_hash {
        return Err(format!(
            "block hash mismatch for node {node_id} at epoch {epoch_start}"
        ));
    }
    let key = verification_key(key_id)?;
    if !verify_hash_hmac(&expected_hash, signature, &key) {
        return Err(format!(
            "HMAC signature mismatch for node {node_id} at epoch {epoch_start}"
        ));
    }

    Ok(VerifiedRecord {
        organization_id,
        node_id,
        epoch_start,
        block_hash: expected_hash,
        previous_hash,
    })
}

fn run(path: &str) -> Result<(), String> {
    let raw = fs::read_to_string(path).map_err(|error| format!("read {path}: {error}"))?;
    let document: Value =
        serde_json::from_str(&raw).map_err(|error| format!("parse JSON evidence: {error}"))?;
    let records = document
        .get("attestations")
        .and_then(Value::as_array)
        .ok_or("input JSON must contain an attestations array exported from the console")?;
    if records.is_empty() {
        return Err("no attestation records found; there is no evidence to verify".into());
    }

    let mut verified = records
        .iter()
        .map(verify_record)
        .collect::<Result<Vec<_>, _>>()?;
    verified.sort_by(|left, right| {
        left.organization_id
            .cmp(&right.organization_id)
            .then_with(|| left.node_id.cmp(&right.node_id))
            .then_with(|| left.epoch_start.cmp(&right.epoch_start))
    });

    let mut partial_chain = false;
    let mut previous_by_node = HashMap::<(String, String), String>::new();
    for record in &verified {
        let key = (record.organization_id.clone(), record.node_id.clone());
        match previous_by_node.get(&key) {
            Some(previous_hash) if record.previous_hash != *previous_hash => {
                return Err(format!(
                    "chain link mismatch for node {} at epoch {}",
                    record.node_id, record.epoch_start
                ));
            }
            Some(_) => {}
            None if record.previous_hash.is_empty() => {}
            None => partial_chain = true,
        }
        previous_by_node.insert(key, record.block_hash.clone());
    }

    println!(
        "SIGNATURES VALID: {} attestation record(s) verified.",
        verified.len()
    );
    if partial_chain {
        println!(
            "PARTIAL CHAIN: included links are valid, but one or more predecessor blocks were not included in this export."
        );
    } else {
        println!("FULL CHAIN: the exported records link back to their genesis blocks.");
    }
    Ok(())
}

fn main() -> ExitCode {
    let Some(path) = env::args().nth(1) else {
        eprintln!("usage: proxima-attest-verify <console-export.json>");
        return ExitCode::from(2);
    };
    match run(&path) {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("ATTESTATION VERIFICATION FAILED: {error}");
            ExitCode::from(2)
        }
    }
}
