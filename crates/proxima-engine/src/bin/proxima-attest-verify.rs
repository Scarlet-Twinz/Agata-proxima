use proxima_engine::attestation::{AttestationConfig, AttestationLedger};
use std::process::ExitCode;

#[tokio::main]
async fn main() -> ExitCode {
    let config = AttestationConfig::from_env();
    let path = config.ledger_path.clone();
    let ledger = AttestationLedger::new(config);
    match ledger.verify_chain().await {
        Ok(result) if result.valid && result.records > 0 => {
            println!(
                "VALID: {} attestation record(s) verified in {}",
                result.records,
                path.display()
            );
            ExitCode::SUCCESS
        }
        Ok(result) if result.valid => {
            eprintln!("NO RECORDS: there is no signed attestation evidence to verify in {}", path.display());
            ExitCode::from(2)
        }
        Ok(result) => {
            eprintln!(
                "INVALID: {} record(s) verified before failure in {}: {}",
                result.records,
                path.display(),
                result.error.unwrap_or_else(|| "unknown chain failure".into())
            );
            ExitCode::from(2)
        }
        Err(error) => {
            eprintln!("ERROR: could not verify {}: {error}", path.display());
            ExitCode::from(1)
        }
    }
}
