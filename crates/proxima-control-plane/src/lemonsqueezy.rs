use hmac::{Hmac, Mac};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::env;

type HmacSha256 = Hmac<Sha256>;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct LemonSqueezyConfig {
    pub api_key: String,
    pub webhook_secret: String,
    pub store_id: String,
    pub starter_variant_id: String,
    pub growth_variant_id: String,
    pub scale_variant_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum ConfigError {
    Missing(&'static str),
    DuplicateVariantIds,
}

impl LemonSqueezyConfig {
    pub(crate) fn from_env() -> Result<Self, ConfigError> {
        fn required(name: &'static str) -> Result<String, ConfigError> {
            env::var(name)
                .ok()
                .map(|value| value.trim().to_owned())
                .filter(|value| !value.is_empty())
                .ok_or(ConfigError::Missing(name))
        }

        let config = Self {
            api_key: required("LEMONSQUEEZY_API_KEY")?,
            webhook_secret: required("LEMONSQUEEZY_WEBHOOK_SECRET")?,
            store_id: required("LEMONSQUEEZY_STORE_ID")?,
            starter_variant_id: required("LEMONSQUEEZY_STARTER_VARIANT_ID")?,
            growth_variant_id: required("LEMONSQUEEZY_GROWTH_VARIANT_ID")?,
            scale_variant_id: required("LEMONSQUEEZY_SCALE_VARIANT_ID")?,
        };
        let ids = [
            config.starter_variant_id.as_str(),
            config.growth_variant_id.as_str(),
            config.scale_variant_id.as_str(),
        ];
        if ids[0] == ids[1] || ids[0] == ids[2] || ids[1] == ids[2] {
            return Err(ConfigError::DuplicateVariantIds);
        }
        Ok(config)
    }

    pub(crate) fn plan_for_variant(&self, variant_id: &str) -> Option<&'static str> {
        match variant_id {
            id if id == self.starter_variant_id => Some("starter"),
            id if id == self.growth_variant_id => Some("growth"),
            id if id == self.scale_variant_id => Some("scale"),
            _ => None,
        }
    }

    pub(crate) fn variant_for_plan(&self, plan: &str) -> Option<&str> {
        match plan {
            "starter" => Some(&self.starter_variant_id),
            "growth" => Some(&self.growth_variant_id),
            "scale" => Some(&self.scale_variant_id),
            _ => None,
        }
    }
}

/// Verify the HMAC-SHA256 signature over the exact raw webhook body.
/// Do not parse/re-serialize JSON before verification.
pub(crate) fn verify_webhook_signature(raw_body: &[u8], supplied_hex: &str, secret: &str) -> bool {
    let Ok(mut mac) = HmacSha256::new_from_slice(secret.as_bytes()) else {
        return false;
    };
    mac.update(raw_body);
    let Ok(signature) = hex::decode(supplied_hex.trim()) else {
        return false;
    };
    mac.verify_slice(&signature).is_ok()
}

pub(crate) fn webhook_event_id(payload: &Value) -> Option<&str> {
    payload.pointer("/meta/event_id").and_then(Value::as_str)
}

pub(crate) fn webhook_event_name(payload: &Value) -> Option<&str> {
    payload.pointer("/meta/event_name").and_then(Value::as_str)
}

pub(crate) fn subscription_id(payload: &Value) -> Option<&str> {
    payload.pointer("/data/id").and_then(Value::as_str)
}

pub(crate) fn subscription_variant_id(payload: &Value) -> Option<String> {
    payload
        .pointer("/data/attributes/variant_id")
        .and_then(Value::as_u64)
        .map(|id| id.to_string())
        .or_else(|| {
            payload
                .pointer("/data/attributes/variant_id")
                .and_then(Value::as_str)
                .map(str::to_owned)
        })
}

pub(crate) fn normalize_subscription_status(status: &str) -> Option<&'static str> {
    match status {
        "active" | "on_trial" => Some("active"),
        "past_due" | "paused" => Some("past_due"),
        "cancelled" | "expired" | "unpaid" => Some("canceled"),
        _ => None,
    }
}

pub(crate) fn payload_sha256(raw_body: &[u8]) -> String {
    hex::encode(Sha256::digest(raw_body))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn signature_matches_raw_body_and_rejects_modified_body() {
        let body = br#"{"meta":{"event_name":"subscription_created","event_id":"evt_123"}}"#;
        let secret = "local-test-webhook-secret";
        let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(body);
        let signature = hex::encode(mac.finalize().into_bytes());

        assert!(verify_webhook_signature(body, &signature, secret));
        assert!(!verify_webhook_signature(
            br#"{"meta":{"event_name":"subscription_cancelled","event_id":"evt_123"}}"#,
            &signature,
            secret
        ));
        assert!(!verify_webhook_signature(body, "not-hex", secret));
    }

    #[test]
    fn parses_webhook_envelope_fields_without_guessing() {
        let payload = serde_json::json!({
            "meta": {"event_name":"subscription_created","event_id":"evt_123"},
            "data": {"id":"sub_456","attributes":{"variant_id":12345}}
        });
        assert_eq!(webhook_event_id(&payload), Some("evt_123"));
        assert_eq!(webhook_event_name(&payload), Some("subscription_created"));
        assert_eq!(subscription_id(&payload), Some("sub_456"));
        assert_eq!(subscription_variant_id(&payload).as_deref(), Some("12345"));
        assert_eq!(webhook_event_name(&serde_json::json!({})), None);
    }

    #[test]
    fn maps_subscription_lifecycle_conservatively() {
        assert_eq!(normalize_subscription_status("active"), Some("active"));
        assert_eq!(normalize_subscription_status("on_trial"), Some("active"));
        assert_eq!(normalize_subscription_status("past_due"), Some("past_due"));
        assert_eq!(normalize_subscription_status("cancelled"), Some("canceled"));
        assert_eq!(normalize_subscription_status("expired"), Some("canceled"));
        assert_eq!(normalize_subscription_status("unknown_future_status"), None);
    }

    #[test]
    fn payload_digest_is_stable_and_hex_encoded() {
        assert_eq!(
            payload_sha256(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }
}
