use hmac::{Hmac, Mac};
use ring::aead::{Aad, LessSafeKey, Nonce, UnboundKey, AES_256_GCM};
use ring::rand::{SecureRandom, SystemRandom};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sqlx::{PgPool, Row};
use std::{
    env,
    net::{IpAddr, SocketAddr},
    time::Duration,
};
use tracing::error;
use uuid::Uuid;

type HmacSha256 = Hmac<Sha256>;

fn encryption_key() -> Option<[u8; 32]> {
    let configured = env::var("AGATA_WEBHOOK_ENCRYPTION_KEY").ok()?;
    if configured.trim().len() < 32 {
        return None;
    }
    let digest = Sha256::digest(configured.as_bytes());
    let mut key = [0u8; 32];
    key.copy_from_slice(&digest);
    Some(key)
}

pub(crate) fn encryption_key_configured() -> bool {
    encryption_key().is_some()
}

pub(crate) fn encrypt_secret(secret: &str) -> anyhow::Result<Vec<u8>> {
    let key_bytes = encryption_key().ok_or_else(|| {
        anyhow::anyhow!(
            "AGATA_WEBHOOK_ENCRYPTION_KEY must be configured with at least 32 characters"
        )
    })?;
    let unbound = UnboundKey::new(&AES_256_GCM, &key_bytes)
        .map_err(|_| anyhow::anyhow!("Webhook encryption key is invalid"))?;
    let key = LessSafeKey::new(unbound);
    let mut nonce_bytes = [0u8; 12];
    SystemRandom::new()
        .fill(&mut nonce_bytes)
        .map_err(|_| anyhow::anyhow!("Could not generate webhook encryption nonce"))?;
    let nonce = Nonce::assume_unique_for_key(nonce_bytes);
    let mut ciphertext = secret.as_bytes().to_vec();
    key.seal_in_place_append_tag(nonce, Aad::empty(), &mut ciphertext)
        .map_err(|_| anyhow::anyhow!("Could not encrypt webhook signing secret"))?;
    let mut result = nonce_bytes.to_vec();
    result.extend(ciphertext);
    Ok(result)
}

fn decrypt_secret(ciphertext: &[u8]) -> anyhow::Result<String> {
    if ciphertext.len() < 12 + 16 {
        anyhow::bail!("Stored webhook signing secret is invalid");
    }
    let key_bytes = encryption_key()
        .ok_or_else(|| anyhow::anyhow!("AGATA_WEBHOOK_ENCRYPTION_KEY is not configured"))?;
    let key = LessSafeKey::new(
        UnboundKey::new(&AES_256_GCM, &key_bytes)
            .map_err(|_| anyhow::anyhow!("Webhook encryption key is invalid"))?,
    );
    let nonce_bytes: [u8; 12] = ciphertext[..12]
        .try_into()
        .map_err(|_| anyhow::anyhow!("Stored webhook nonce is invalid"))?;
    let mut body = ciphertext[12..].to_vec();
    let plaintext = key
        .open_in_place(
            Nonce::assume_unique_for_key(nonce_bytes),
            Aad::empty(),
            &mut body,
        )
        .map_err(|_| anyhow::anyhow!("Could not decrypt webhook signing secret"))?;
    String::from_utf8(plaintext.to_vec())
        .map_err(|_| anyhow::anyhow!("Webhook signing secret is not UTF-8"))
}

pub(crate) async fn enqueue_audit_event(
    db: &PgPool,
    organization_id: Uuid,
    actor_id: Uuid,
    action: &str,
    resource_type: &str,
    resource_id: Option<Uuid>,
    metadata: Value,
    event_id: Uuid,
    created_at: chrono::DateTime<chrono::Utc>,
) {
    let event = json!({
        "id": event_id,
        "type": action,
        "created_at": created_at,
        "organization_id": organization_id,
        "actor_id": actor_id,
        "resource": { "type": resource_type, "id": resource_id },
        "data": metadata
    });
    let result = sqlx::query(
        "INSERT INTO webhook_deliveries
           (id, webhook_id, event_type, event_id, status, payload, next_attempt_at)
         SELECT gen_random_uuid(), w.id, $2, $3, 'queued', $4, now()
           FROM webhooks w
          WHERE w.organization_id=$1 AND w.enabled IS TRUE
            AND (w.events @> jsonb_build_array($2::text) OR w.events @> '[\"*\"]'::jsonb)
         ON CONFLICT DO NOTHING",
    )
    .bind(organization_id)
    .bind(action)
    .bind(event_id.to_string())
    .bind(event)
    .execute(db)
    .await;
    if let Err(err) = result {
        error!(%err, event_type = action, "failed to enqueue webhook event");
    }
}

fn public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => {
            let o = ip.octets();
            !(ip.is_private()
                || ip.is_loopback()
                || ip.is_link_local()
                || ip.is_unspecified()
                || ip.is_broadcast()
                || ip.is_multicast()
                || o[0] == 0
                || o[0] == 100 && (64..=127).contains(&o[1])
                || o[0] == 192 && o[1] == 0
                || o[0] == 192 && o[1] == 0 && o[2] == 2
                || o[0] == 198 && (o[1] == 18 || o[1] == 19 || o[1] == 51 && o[2] == 100)
                || o[0] == 203 && o[1] == 0 && o[2] == 113)
        }
        IpAddr::V6(ip) => {
            if let Some(v4) = ip.to_ipv4_mapped() {
                return public_ip(IpAddr::V4(v4));
            }
            let segments = ip.segments();
            !(ip.is_loopback()
                || ip.is_unspecified()
                || ip.is_multicast()
                || segments[0] & 0xfe00 == 0xfc00
                || segments[0] & 0xffc0 == 0xfe80
                || segments[0] == 0x2001 && segments[1] == 0x0db8
                || segments[0] & 0xe000 != 0x2000)
        }
    }
}

async fn pinned_client(url: &reqwest::Url) -> anyhow::Result<reqwest::Client> {
    let scheme = url.scheme();
    let host = url
        .host_str()
        .ok_or_else(|| anyhow::anyhow!("Webhook URL has no host"))?;
    let local_http_allowed =
        env::var("AGATA_WEBHOOK_ALLOW_LOCAL_HTTP").ok().as_deref() == Some("true");
    if scheme != "https"
        && !(scheme == "http"
            && local_http_allowed
            && matches!(host, "localhost" | "127.0.0.1" | "::1"))
    {
        anyhow::bail!("Webhook destinations must use HTTPS");
    }
    if url.username() != "" || url.password().is_some() {
        anyhow::bail!("Webhook URL must not contain embedded credentials");
    }
    if scheme == "http" && local_http_allowed {
        return Ok(reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .connect_timeout(Duration::from_secs(4))
            .timeout(Duration::from_secs(10))
            .build()?);
    }
    let port = url
        .port_or_known_default()
        .ok_or_else(|| anyhow::anyhow!("Webhook URL port is invalid"))?;
    let resolved: Vec<SocketAddr> = if let Ok(ip) = host.parse::<IpAddr>() {
        vec![SocketAddr::new(ip, port)]
    } else {
        tokio::net::lookup_host((host, port)).await?.collect()
    };
    if resolved.is_empty() || resolved.iter().any(|addr| !public_ip(addr.ip())) {
        anyhow::bail!("Webhook destination resolves to a non-public address");
    }
    let mut builder = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(4))
        .timeout(Duration::from_secs(10));
    builder = builder.resolve(host, resolved[0]);
    Ok(builder.build()?)
}

fn signature(secret: &str, timestamp: i64, body: &[u8]) -> anyhow::Result<String> {
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes())?;
    mac.update(timestamp.to_string().as_bytes());
    mac.update(b".");
    mac.update(body);
    Ok(hex::encode(mac.finalize().into_bytes()))
}

pub(crate) async fn validate_endpoint(endpoint: &str) -> anyhow::Result<()> {
    let url = reqwest::Url::parse(endpoint)?;
    let _client = pinned_client(&url).await?;
    Ok(())
}

pub(crate) async fn deliver_one(db: &PgPool) -> anyhow::Result<bool> {
    let Some(key) = encryption_key() else {
        return Ok(false);
    };
    let _ = key;
    let mut tx = db.begin().await?;
    let row = sqlx::query(
        "SELECT d.id,d.webhook_id,d.event_type,d.event_id,d.payload,d.attempt_count,
                w.endpoint_url,w.signing_secret_ciphertext
           FROM webhook_deliveries d JOIN webhooks w ON w.id=d.webhook_id
          WHERE (d.status IN ('queued','failed') OR (d.status='delivering' AND d.last_attempt_at < now()-interval '2 minutes'))
            AND d.attempt_count < d.max_attempts AND d.next_attempt_at <= now() AND w.enabled IS TRUE
          ORDER BY d.created_at LIMIT 1 FOR UPDATE OF d SKIP LOCKED"
    ).fetch_optional(&mut *tx).await?;
    let Some(row) = row else {
        tx.rollback().await?;
        return Ok(false);
    };
    let id: Uuid = row.get("id");
    let webhook_id: Uuid = row.get("webhook_id");
    let event_type: String = row.get("event_type");
    let event_id: String = row.get("event_id");
    let payload: Value = row.get("payload");
    let endpoint: String = row.get("endpoint_url");
    let encrypted: Option<Vec<u8>> = row.get("signing_secret_ciphertext");
    let attempts: i32 = row.get::<i32, _>("attempt_count") + 1;
    sqlx::query("UPDATE webhook_deliveries SET status='delivering',attempt_count=$2,last_attempt_at=now(),last_error=NULL WHERE id=$1")
        .bind(id).bind(attempts).execute(&mut *tx).await?;
    tx.commit().await?;

    let Some(encrypted) = encrypted else {
        sqlx::query("UPDATE webhook_deliveries SET status='dead_letter',last_error='Webhook signing secret must be rotated before delivery' WHERE id=$1")
            .bind(id).execute(db).await?;
        return Ok(true);
    };

    let result = async {
        let secret = decrypt_secret(&encrypted)?;
        let url = reqwest::Url::parse(&endpoint)?;
        let client = pinned_client(&url).await?;
        let body = serde_json::to_vec(&payload)?;
        let timestamp = chrono::Utc::now().timestamp();
        let signed = signature(&secret, timestamp, &body)?;
        let started = std::time::Instant::now();
        let mut response = client
            .post(url)
            .header("Content-Type", "application/json")
            .header("User-Agent", "AgataProxima-Webhooks/1.0")
            .header("X-Agata-Event", &event_type)
            .header("X-Agata-Event-Id", &event_id)
            .header("X-Agata-Delivery-Id", id.to_string())
            .header("X-Agata-Signature", format!("t={timestamp},v1={signed}"))
            .body(body)
            .send()
            .await?;
        let status = response.status();
        let mut response_body = Vec::with_capacity(512);
        while response_body.len() < 512 {
            let Some(chunk) = response.chunk().await? else {
                break;
            };
            let remaining = 512 - response_body.len();
            response_body.extend_from_slice(&chunk[..chunk.len().min(remaining)]);
        }
        let excerpt = String::from_utf8_lossy(&response_body).into_owned();
        let elapsed = started.elapsed().as_millis().min(i32::MAX as u128) as i32;
        Ok::<_, anyhow::Error>((
            status.as_u16() as i32,
            elapsed,
            excerpt,
            status.is_success(),
        ))
    }
    .await;

    match result {
        Ok((status_code, response_ms, excerpt, success)) => {
            if success {
                sqlx::query("UPDATE webhook_deliveries SET status='delivered',status_code=$2,response_ms=$3,response_excerpt=$4,delivered_at=now(),last_error=NULL WHERE id=$1")
                    .bind(id).bind(status_code).bind(response_ms).bind(excerpt).execute(db).await?;
            } else {
                schedule_failure(
                    db,
                    id,
                    attempts,
                    Some(status_code),
                    Some(response_ms),
                    &format!("Endpoint returned HTTP {status_code}"),
                    Some(&excerpt),
                )
                .await?;
            }
        }
        Err(err) => {
            schedule_failure(db, id, attempts, None, None, &err.to_string(), None).await?;
        }
    }
    let _ = webhook_id;
    Ok(true)
}

async fn schedule_failure(
    db: &PgPool,
    id: Uuid,
    attempts: i32,
    status_code: Option<i32>,
    response_ms: Option<i32>,
    message: &str,
    excerpt: Option<&str>,
) -> anyhow::Result<()> {
    let delay_seconds = match attempts {
        1 => 5,
        2 => 30,
        3 => 120,
        4 => 600,
        5 => 1800,
        _ => 3600,
    };
    let status = if attempts >= 8 {
        "dead_letter"
    } else {
        "failed"
    };
    let safe_message: String = message.chars().take(500).collect();
    sqlx::query(
        "UPDATE webhook_deliveries SET status=$2,status_code=$3,response_ms=$4,
          response_excerpt=$5,last_error=$6,
          next_attempt_at=CASE WHEN $2='failed' THEN now()+($7 * interval '1 second') ELSE next_attempt_at END
         WHERE id=$1"
    ).bind(id).bind(status).bind(status_code).bind(response_ms).bind(excerpt).bind(safe_message)
     .bind(delay_seconds).execute(db).await?;
    Ok(())
}

pub(crate) async fn worker_tick(db: &PgPool) {
    for _ in 0..25 {
        match deliver_one(db).await {
            Ok(true) => {}
            Ok(false) => break,
            Err(err) => {
                error!(%err, "webhook delivery worker failed");
                break;
            }
        }
    }
}

pub(crate) fn signing_secret_hint(secret: &str) -> String {
    secret
        .chars()
        .rev()
        .take(6)
        .collect::<String>()
        .chars()
        .rev()
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn signatures_are_deterministic_and_payload_sensitive() {
        let a = signature("test-secret", 123, b"{\"ok\":true}").unwrap();
        assert_eq!(a, signature("test-secret", 123, b"{\"ok\":true}").unwrap());
        assert_ne!(a, signature("test-secret", 123, b"{\"ok\":false}").unwrap());
        assert_ne!(a, signature("other-secret", 123, b"{\"ok\":true}").unwrap());
    }

    #[test]
    fn rejects_non_public_addresses() {
        for ip in [
            "127.0.0.1",
            "10.0.0.1",
            "192.168.1.1",
            "169.254.169.254",
            "8.8.8.8",
        ] {
            let parsed: IpAddr = ip.parse().unwrap();
            assert_eq!(public_ip(parsed), ip == "8.8.8.8");
        }
    }

    #[test]
    fn secret_hint_does_not_reveal_full_secret() {
        assert_eq!(signing_secret_hint("whsec_abcdef"), "abcdef");
    }
}
