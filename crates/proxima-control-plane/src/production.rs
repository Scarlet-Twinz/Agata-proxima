use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::{Html, IntoResponse, Response},
    Json,
};
use hmac::{Hmac, Mac};
use reqwest::Client;
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::Sha256;
use sqlx::Row;
use std::{collections::HashMap, env};
use uuid::Uuid;

use super::{
    audit, authenticate, bad, db_error, hash_password, internal, require_write, token_hash,
    AppState,
};

type HmacSha256 = Hmac<Sha256>;

#[derive(Deserialize)]
pub(crate) struct CheckoutInput {
    pub price_id: Option<String>,
}

#[derive(Deserialize)]
pub(crate) struct InviteInput {
    pub organization_id: Uuid,
    pub email: String,
    pub role: Option<String>,
}

#[derive(Deserialize)]
pub(crate) struct VerifyInput {
    pub token: String,
}

#[derive(Deserialize)]
pub(crate) struct PasswordResetRequest {
    pub email: String,
}

#[derive(Deserialize)]
pub(crate) struct PasswordResetConfirm {
    pub token: String,
    pub password: String,
}

#[derive(Deserialize)]
pub(crate) struct BillingEventQuery {
    pub event: Option<String>,
}

pub(crate) async fn billing_status(State(s): State<AppState>, headers: HeaderMap) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };

    match sqlx::query(
        "SELECT stripe_customer_id,stripe_subscription_id,stripe_price_id,plan_key,status,
                current_period_end,cancel_at_period_end
         FROM billing_accounts WHERE organization_id=$1",
    )
    .bind(ctx.organization_id)
    .fetch_optional(&s.db)
    .await
    {
        Ok(Some(row)) => Json(json!({
            "configured": true,
            "customer_id": row.get::<Option<String>,_>("stripe_customer_id"),
            "subscription_id": row.get::<Option<String>,_>("stripe_subscription_id"),
            "price_id": row.get::<Option<String>,_>("stripe_price_id"),
            "plan": row.get::<String,_>("plan_key"),
            "status": row.get::<String,_>("status"),
            "current_period_end": row.get::<Option<chrono::DateTime<chrono::Utc>>,_>("current_period_end"),
            "cancel_at_period_end": row.get::<bool,_>("cancel_at_period_end")
        }))
        .into_response(),
        Ok(None) => Json(json!({
            "configured": false,
            "plan": "unconfigured",
            "status": "inactive",
            "message": "Stripe is integrated; configure an Agata Stripe Price ID before checkout."
        }))
        .into_response(),
        Err(e) => db_error(e),
    }
}

pub(crate) async fn checkout(
    State(s): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<CheckoutInput>,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if let Err(c) = require_write(&ctx, &headers) {
        return c.into_response();
    }

    let secret = match env::var("STRIPE_SECRET_KEY") {
        Ok(v) if !v.is_empty() => v,
        _ => return service_unavailable("Stripe secret is not configured."),
    };
    let price_id = input
        .price_id
        .or_else(|| env::var("AGATA_STRIPE_PRICE_ID").ok())
        .filter(|v| !v.trim().is_empty())
        .unwrap_or_default();
    if price_id.is_empty() {
        return service_unavailable("AGATA_STRIPE_PRICE_ID is not configured.");
    }

    let user = match sqlx::query("SELECT email FROM users WHERE id=$1")
        .bind(ctx.user_id)
        .fetch_one(&s.db)
        .await
    {
        Ok(row) => row.get::<String,_>("email"),
        Err(e) => return db_error(e),
    };

    let client = Client::new();
    let billing = sqlx::query(
        "SELECT stripe_customer_id FROM billing_accounts WHERE organization_id=$1",
    )
    .bind(ctx.organization_id)
    .fetch_optional(&s.db)
    .await;

    let existing_customer = match billing {
        Ok(Some(row)) => row.get::<Option<String>,_>("stripe_customer_id"),
        Ok(None) => None,
        Err(e) => return db_error(e),
    };

    let customer_id = match existing_customer {
        Some(id) => id,
        None => {
            let response = match client
                .post("https://api.stripe.com/v1/customers")
                .bearer_auth(&secret)
                .form(&[
                    ("email", user.as_str()),
                    ("description", "Agata Proxima organization"),
                    ("metadata[organization_id]", &ctx.organization_id.to_string()),
                ])
                .send()
                .await
            {
                Ok(r) => r,
                Err(e) => return external_error(e),
            };
            if !response.status().is_success() {
                return stripe_error(response).await;
            }
            let body: Value = match response.json().await {
                Ok(v) => v,
                Err(e) => return external_error(e),
            };
            let id = body.get("id").and_then(Value::as_str).unwrap_or_default().to_string();
            if id.is_empty() {
                return service_unavailable("Stripe did not return a customer ID.");
            }
            if let Err(e) = sqlx::query(
                "INSERT INTO billing_accounts(organization_id,stripe_customer_id,status)
                 VALUES($1,$2,'pending')
                 ON CONFLICT (organization_id) DO UPDATE SET stripe_customer_id=EXCLUDED.stripe_customer_id",
            )
            .bind(ctx.organization_id)
            .bind(&id)
            .execute(&s.db)
            .await
            {
                return db_error(e);
            }
            id
        }
    };

    let base_url = env::var("AGATA_PUBLIC_BASE_URL")
        .unwrap_or_else(|_| "http://127.0.0.1:8080".into())
        .trim_end_matches('/')
        .to_string();

    let response = match client
        .post("https://api.stripe.com/v1/checkout/sessions")
        .bearer_auth(&secret)
        .form(&[
            ("mode", "subscription"),
            ("customer", customer_id.as_str()),
            ("line_items[0][price]", price_id.as_str()),
            ("line_items[0][quantity]", "1"),
            ("success_url", &format!("{base_url}/app?billing=success")),
            ("cancel_url", &format!("{base_url}/app?billing=cancelled")),
            ("client_reference_id", &ctx.organization_id.to_string()),
            ("metadata[organization_id]", &ctx.organization_id.to_string()),
            ("subscription_data[metadata][organization_id]", &ctx.organization_id.to_string()),
        ])
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => return external_error(e),
    };

    if !response.status().is_success() {
        return stripe_error(response).await;
    }

    let body: Value = match response.json().await {
        Ok(v) => v,
        Err(e) => return external_error(e),
    };
    let url = body.get("url").and_then(Value::as_str).unwrap_or_default();
    if url.is_empty() {
        return service_unavailable("Stripe did not return a checkout URL.");
    }

    audit(
        &s.db,
        ctx.organization_id,
        ctx.user_id,
        "billing.checkout.created",
        "billing",
        None,
        json!({"price_id":price_id}),
    )
    .await;

    Json(json!({"ok":true,"checkout_url":url})).into_response()
}

pub(crate) async fn portal(State(s): State<AppState>, headers: HeaderMap) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if let Err(c) = require_write(&ctx, &headers) {
        return c.into_response();
    }

    let secret = match env::var("STRIPE_SECRET_KEY") {
        Ok(v) if !v.is_empty() => v,
        _ => return service_unavailable("Stripe secret is not configured."),
    };
    let customer_id = match sqlx::query(
        "SELECT stripe_customer_id FROM billing_accounts WHERE organization_id=$1",
    )
    .bind(ctx.organization_id)
    .fetch_optional(&s.db)
    .await
    {
        Ok(Some(row)) => row.get::<Option<String>,_>("stripe_customer_id"),
        Ok(None) => None,
        Err(e) => return db_error(e),
    };
    let customer_id = match customer_id {
        Some(v) => v,
        None => return bad("No Stripe customer exists for this organization yet."),
    };

    let base_url = env::var("AGATA_PUBLIC_BASE_URL")
        .unwrap_or_else(|_| "http://127.0.0.1:8080".into())
        .trim_end_matches('/')
        .to_string();

    let response = match Client::new()
        .post("https://api.stripe.com/v1/billing_portal/sessions")
        .bearer_auth(&secret)
        .form(&[
            ("customer", customer_id.as_str()),
            ("return_url", &format!("{base_url}/app?billing=portal")),
        ])
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => return external_error(e),
    };

    if !response.status().is_success() {
        return stripe_error(response).await;
    }
    let body: Value = match response.json().await {
        Ok(v) => v,
        Err(e) => return external_error(e),
    };
    let url = body.get("url").and_then(Value::as_str).unwrap_or_default();
    if url.is_empty() {
        return service_unavailable("Stripe did not return a portal URL.");
    }
    Json(json!({"ok":true,"portal_url":url})).into_response()
}

pub(crate) async fn stripe_webhook(State(s): State<AppState>, headers: HeaderMap, body: String) -> Response {
    let signature = match headers.get("stripe-signature").and_then(|v| v.to_str().ok()) {
        Some(v) => v,
        None => return StatusCode::BAD_REQUEST.into_response(),
    };
    let secret = match env::var("STRIPE_WEBHOOK_SECRET") {
        Ok(v) if !v.is_empty() => v,
        _ => return StatusCode::SERVICE_UNAVAILABLE.into_response(),
    };
    if !verify_stripe_signature(&body, signature, &secret) {
        return StatusCode::UNAUTHORIZED.into_response();
    }

    let event: Value = match serde_json::from_str(&body) {
        Ok(v) => v,
        Err(_) => return StatusCode::BAD_REQUEST.into_response(),
    };
    let event_id = event.get("id").and_then(Value::as_str).unwrap_or_default();
    let event_type = event.get("type").and_then(Value::as_str).unwrap_or_default();
    if event_id.is_empty() || event_type.is_empty() {
        return StatusCode::BAD_REQUEST.into_response();
    }

    let inserted = match sqlx::query(
        "INSERT INTO billing_events(stripe_event_id,event_type,payload)
         VALUES($1,$2,$3) ON CONFLICT (stripe_event_id) DO NOTHING",
    )
    .bind(event_id)
    .bind(event_type)
    .bind(&event)
    .execute(&s.db)
    .await
    {
        Ok(v) => v.rows_affected() == 1,
        Err(e) => return db_error(e),
    };

    if !inserted {
        return Json(json!({"received":true,"duplicate":true})).into_response();
    }

    let object = event.pointer("/data/object").cloned().unwrap_or(Value::Null);
    let customer_id = object.get("customer").and_then(Value::as_str);
    let metadata_org = object.pointer("/metadata/organization_id").and_then(Value::as_str);

    let organization_id = if let Some(value) = metadata_org {
        Uuid::parse_str(value).ok()
    } else if let Some(customer) = customer_id {
        sqlx::query("SELECT organization_id FROM billing_accounts WHERE stripe_customer_id=$1")
            .bind(customer)
            .fetch_optional(&s.db)
            .await
            .ok()
            .flatten()
            .map(|r| r.get::<Uuid,_>("organization_id"))
    } else {
        None
    };

    if let Some(org) = organization_id {
        let subscription_id = object.get("subscription").and_then(Value::as_str)
            .or_else(|| object.get("id").and_then(Value::as_str));
        let status = object.get("status").and_then(Value::as_str).unwrap_or("active");
        let price_id = object.pointer("/items/data/0/price/id").and_then(Value::as_str);
        let cancel_at_period_end = object.get("cancel_at_period_end").and_then(Value::as_bool).unwrap_or(false);
        let period_end = object.get("current_period_end").and_then(Value::as_i64);

        match event_type {
            "checkout.session.completed" | "customer.subscription.created" |
            "customer.subscription.updated" | "customer.subscription.deleted" |
            "invoice.payment_failed" | "invoice.paid" => {
                let normalized_status = if event_type == "customer.subscription.deleted" {
                    "canceled"
                } else if event_type == "invoice.payment_failed" {
                    "past_due"
                } else {
                    status
                };
                if let Err(e) = sqlx::query(
                    "INSERT INTO billing_accounts(
                        organization_id,stripe_customer_id,stripe_subscription_id,stripe_price_id,
                        plan_key,status,current_period_end,cancel_at_period_end,updated_at)
                     VALUES($1,$2,$3,$4,'agata', $5,
                        CASE WHEN $6::bigint IS NULL THEN NULL ELSE to_timestamp($6) END,$7,now())
                     ON CONFLICT (organization_id) DO UPDATE SET
                       stripe_customer_id=COALESCE(EXCLUDED.stripe_customer_id,billing_accounts.stripe_customer_id),
                       stripe_subscription_id=COALESCE(EXCLUDED.stripe_subscription_id,billing_accounts.stripe_subscription_id),
                       stripe_price_id=COALESCE(EXCLUDED.stripe_price_id,billing_accounts.stripe_price_id),
                       plan_key=EXCLUDED.plan_key,status=EXCLUDED.status,
                       current_period_end=EXCLUDED.current_period_end,
                       cancel_at_period_end=EXCLUDED.cancel_at_period_end,updated_at=now()",
                )
                .bind(org)
                .bind(customer_id)
                .bind(subscription_id)
                .bind(price_id)
                .bind(normalized_status)
                .bind(period_end)
                .bind(cancel_at_period_end)
                .execute(&s.db)
                .await {
                    return db_error(e);
                }
            }
            _ => {}
        }

        audit(
            &s.db,
            org,
            Uuid::nil(),
            "billing.webhook.processed",
            "billing_event",
            None,
            json!({"event_id":event_id,"event_type":event_type}),
        )
        .await;
    }

    let _ = sqlx::query(
        "UPDATE billing_events SET status='processed',processed_at=now() WHERE stripe_event_id=$1",
    )
    .bind(event_id)
    .execute(&s.db)
    .await;

    Json(json!({"received":true})).into_response()
}

pub(crate) async fn send_verification_email(
    db: &sqlx::PgPool,
    user_id: Uuid,
    email: &str,
    display_name: &str,
) -> anyhow::Result<()> {
    let token = format!("{}-{}", Uuid::new_v4(), Uuid::new_v4());
    sqlx::query(
        "UPDATE users SET email_verification_token_hash=$1,
         email_verification_expires_at=now()+interval '24 hours' WHERE id=$2",
    )
    .bind(token_hash(&token))
    .bind(user_id)
    .execute(db)
    .await?;

    let base = env::var("AGATA_PUBLIC_BASE_URL")
        .unwrap_or_else(|_| "http://127.0.0.1:8080".into())
        .trim_end_matches('/')
        .to_string();
    let link = format!("{base}/verify-email?token={token}");
    send_email(
        email,
        "Verify your Agata Proxima email",
        &format!(
            "<div style=\"font-family:Inter,Arial,sans-serif;background:#05080c;color:#eef7f8;padding:40px\">
             <h1>Agata Proxima</h1><p>Hello {display_name},</p>
             <p>Confirm this address to activate verified email status for your Proxima workspace.</p>
             <p><a href=\"{link}\" style=\"display:inline-block;padding:12px 18px;background:#71dcff;color:#061015;text-decoration:none;border-radius:8px\">Verify email</a></p>
             <p style=\"color:#8ea0ab\">This link expires in 24 hours.</p></div>"
        ),
    )
    .await
}

pub(crate) async fn verify_email(
    State(s): State<AppState>,
    Query(q): Query<VerifyInput>,
) -> Response {
    let result = sqlx::query(
        "UPDATE users SET email_verified_at=now(),email_verification_token_hash=NULL,
         email_verification_expires_at=NULL
         WHERE email_verification_token_hash=$1
           AND email_verification_expires_at>now()
         RETURNING email",
    )
    .bind(token_hash(&q.token))
    .fetch_optional(&s.db)
    .await;

    match result {
        Ok(Some(row)) => Html(format!(
            "<html><body style=\"background:#05080c;color:#eef7f8;font-family:Arial;padding:60px\">
             <h1>Email verified.</h1><p>{}</p><p><a href=\"/app\">Open Agata Proxima</a></p></body></html>",
            row.get::<String,_>("email")
        ))
        .into_response(),
        Ok(None) => (
            StatusCode::BAD_REQUEST,
            Html("<html><body style=\"background:#05080c;color:#eef7f8;font-family:Arial;padding:60px\"><h1>Verification link expired or invalid.</h1></body></html>"),
        )
            .into_response(),
        Err(e) => db_error(e),
    }
}

pub(crate) async fn reset_password_page(Query(q): Query<VerifyInput>) -> Response {
    let token = q.token.replace('"', "");
    Html(format!(
        "<!doctype html><html><body style=\"background:#05080c;color:#eef7f8;font-family:Arial;padding:60px\">
        <h1>Reset your Agata Proxima password</h1>
        <form id=\"f\"><input id=\"p\" type=\"password\" minlength=\"12\" placeholder=\"New password\" required style=\"padding:12px;width:320px\">
        <button style=\"margin-left:8px;padding:12px\">Reset password</button></form>
        <p id=\"m\"></p>
        <script>
        const token={token:?};
        document.getElementById('f').onsubmit=async(e)=>{{e.preventDefault();const r=await fetch('/api/v1/auth/password-reset/confirm',{{method:'POST',headers:{{'content-type':'application/json'}},body:JSON.stringify({{token,password:document.getElementById('p').value}})}});const j=await r.json();document.getElementById('m').textContent=j.message||'Done';}};
        </script></body></html>"
    ))
    .into_response()
}

pub(crate) async fn request_password_reset(
    State(s): State<AppState>,
    Json(input): Json<PasswordResetRequest>,
) -> Response {
    let email = input.email.trim().to_lowercase();
    let user = match sqlx::query("SELECT id,display_name FROM users WHERE email=$1 AND status='active'")
        .bind(&email)
        .fetch_optional(&s.db)
        .await
    {
        Ok(v) => v,
        Err(e) => return db_error(e),
    };

    if let Some(row) = user {
        let token = format!("{}-{}", Uuid::new_v4(), Uuid::new_v4());
        if let Err(e) = sqlx::query(
            "UPDATE users SET password_reset_token_hash=$1,password_reset_expires_at=now()+interval '30 minutes'
             WHERE id=$2",
        )
        .bind(token_hash(&token))
        .bind(row.get::<Uuid,_>("id"))
        .execute(&s.db)
        .await {
            return db_error(e);
        }
        let base = env::var("AGATA_PUBLIC_BASE_URL")
            .unwrap_or_else(|_| "http://127.0.0.1:8080".into())
            .trim_end_matches('/')
            .to_string();
        let link = format!("{base}/reset-password?token={token}");
        let html = format!(
            "<div style=\"font-family:Inter,Arial,sans-serif;background:#05080c;color:#eef7f8;padding:40px\">
             <h1>Agata Proxima</h1><p>Hello {},</p><p>A password reset was requested for your workspace.</p>
             <p><a href=\"{link}\" style=\"display:inline-block;padding:12px 18px;background:#71dcff;color:#061015;text-decoration:none;border-radius:8px\">Reset password</a></p>
             <p style=\"color:#8ea0ab\">This link expires in 30 minutes. If you did not request it, ignore this email.</p></div>",
            row.get::<String,_>("display_name")
        );
        if let Err(e) = send_email(&email, "Reset your Agata Proxima password", &html).await {
            tracing::error!(%e, "password reset email failed");
        }
    }

    Json(json!({"ok":true,"message":"If that address exists, a reset email has been sent."})).into_response()
}

pub(crate) async fn reset_password(
    State(s): State<AppState>,
    Json(input): Json<PasswordResetConfirm>,
) -> Response {
    if input.password.len() < 12 {
        return bad("Password must be at least 12 characters.");
    }
    let hash = match hash_password(&input.password) {
        Ok(v) => v,
        Err(_) => return internal("Password hashing failed."),
    };
    let result = match sqlx::query(
        "UPDATE users SET password_hash=$1,password_reset_token_hash=NULL,password_reset_expires_at=NULL
         WHERE password_reset_token_hash=$2 AND password_reset_expires_at>now()
         RETURNING id",
    )
    .bind(hash)
    .bind(token_hash(&input.token))
    .fetch_optional(&s.db)
    .await
    {
        Ok(v) => v,
        Err(e) => return db_error(e),
    };

    match result {
        Some(row) => {
            let user_id: Uuid = row.get("id");
            let _ = sqlx::query("DELETE FROM sessions WHERE user_id=$1")
                .bind(user_id)
                .execute(&s.db)
                .await;
            Json(json!({"ok":true,"message":"Password changed. Sign in again."})).into_response()
        }
        None => bad("Reset link expired or invalid."),
    }
}

pub(crate) async fn invite(
    State(s): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<InviteInput>,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(c) => return c.into_response(),
    };
    if ctx.organization_id != input.organization_id {
        return StatusCode::FORBIDDEN.into_response();
    }
    if let Err(c) = require_write(&ctx, &headers) {
        return c.into_response();
    }

    let role = input.role.unwrap_or_else(|| "viewer".into());
    if !matches!(role.as_str(), "admin" | "operator" | "viewer") {
        return bad("Invalid invitation role.");
    }
    let email = input.email.trim().to_lowercase();
    if !email.contains('@') {
        return bad("A valid email is required.");
    }

    let token = format!("{}-{}", Uuid::new_v4(), Uuid::new_v4());
    let id = Uuid::new_v4();
    if let Err(e) = sqlx::query(
        "INSERT INTO organization_invites(id,organization_id,invited_by,email,role,token_hash,expires_at)
         VALUES($1,$2,$3,$4,$5,$6,now()+interval '7 days')
         ON CONFLICT (organization_id,email) DO UPDATE SET
           invited_by=EXCLUDED.invited_by,role=EXCLUDED.role,token_hash=EXCLUDED.token_hash,
           expires_at=EXCLUDED.expires_at,accepted_at=NULL",
    )
    .bind(id).bind(ctx.organization_id).bind(ctx.user_id).bind(&email).bind(&role).bind(token_hash(&token))
    .execute(&s.db).await {
        return db_error(e);
    }

    let base = env::var("AGATA_PUBLIC_BASE_URL").unwrap_or_else(|_| "http://127.0.0.1:8080".into()).trim_end_matches('/').to_string();
    let link = format!("{base}/accept-invite?token={token}");
    let html = format!(
        "<div style=\"font-family:Inter,Arial,sans-serif;background:#05080c;color:#eef7f8;padding:40px\">
         <h1>Agata Proxima</h1><p>You have been invited to a Proxima organization.</p>
         <p>Role: <strong>{role}</strong></p><p><a href=\"{link}\" style=\"display:inline-block;padding:12px 18px;background:#71dcff;color:#061015;text-decoration:none;border-radius:8px\">Accept invitation</a></p>
         <p style=\"color:#8ea0ab\">This invitation expires in 7 days.</p></div>"
    );
    if let Err(e) = send_email(&email, "You have been invited to Agata Proxima", &html).await {
        tracing::error!(%e, "invitation email failed");
    }

    audit(&s.db, ctx.organization_id, ctx.user_id, "organization.invite.created", "organization_invite", Some(id), json!({"email":email,"role":role})).await;
    Json(json!({"ok":true,"id":id,"expires_in":"7 days"})).into_response()
}

pub(crate) async fn accept_invite(
    State(s): State<AppState>,
    Query(q): Query<VerifyInput>,
    headers: HeaderMap,
) -> Response {
    let ctx = match authenticate(&s, &headers).await {
        Ok(v) => v,
        Err(_) => return (
            StatusCode::UNAUTHORIZED,
            Html("<html><body style=\"background:#05080c;color:#eef7f8;font-family:Arial;padding:60px\"><h1>Sign in first.</h1><p>Open the invitation link again after signing in.</p><a href=\"/login\">Sign in</a></body></html>")
        ).into_response(),
    };

    let row = match sqlx::query(
        "SELECT id,organization_id,role FROM organization_invites
         WHERE token_hash=$1 AND expires_at>now() AND accepted_at IS NULL
           AND lower(email)=(SELECT lower(email) FROM users WHERE id=$2)",
    )
    .bind(token_hash(&q.token))
    .bind(ctx.user_id)
    .fetch_optional(&s.db)
    .await
    {
        Ok(v) => v,
        Err(e) => return db_error(e),
    };

    match row {
        Some(row) => {
            let invite_id: Uuid = row.get("id");
            let org: Uuid = row.get("organization_id");
            let role: String = row.get("role");
            if let Err(e) = sqlx::query(
                "INSERT INTO memberships(user_id,organization_id,role) VALUES($1,$2,$3)
                 ON CONFLICT (user_id,organization_id) DO UPDATE SET role=EXCLUDED.role",
            )
            .bind(ctx.user_id).bind(org).bind(&role).execute(&s.db).await {
                return db_error(e);
            }
            let _ = sqlx::query("UPDATE organization_invites SET accepted_at=now() WHERE id=$1")
                .bind(invite_id).execute(&s.db).await;
            audit(&s.db, org, ctx.user_id, "organization.invite.accepted", "organization_invite", Some(invite_id), json!({})).await;
            Html("<html><body style=\"background:#05080c;color:#eef7f8;font-family:Arial;padding:60px\"><h1>Invitation accepted.</h1><p>Your organization access is active.</p><a href=\"/app\">Open Command Center</a></body></html>").into_response()
        }
        None => bad("Invitation expired, invalid, or not addressed to the signed-in user."),
    }
}

pub(crate) async fn readiness(State(s): State<AppState>) -> Response {
    let db_ok = sqlx::query("SELECT 1").execute(&s.db).await.is_ok();
    let stripe = env::var("STRIPE_SECRET_KEY").map(|v| !v.is_empty()).unwrap_or(false);
    let stripe_price = env::var("AGATA_STRIPE_PRICE_ID").map(|v| !v.is_empty()).unwrap_or(false);
    let stripe_webhook = env::var("STRIPE_WEBHOOK_SECRET").map(|v| !v.is_empty()).unwrap_or(false);
    let resend = env::var("RESEND_API_KEY").map(|v| !v.is_empty()).unwrap_or(false);
    let from = env::var("RESEND_FROM_EMAIL").map(|v| !v.is_empty()).unwrap_or(false);
    let base = env::var("AGATA_PUBLIC_BASE_URL").map(|v| !v.is_empty()).unwrap_or(false);
    let oidc = env::var("PROXIMA_OIDC_ISSUER").map(|v| !v.is_empty()).unwrap_or(false)
        && env::var("PROXIMA_OIDC_CLIENT_ID").map(|v| !v.is_empty()).unwrap_or(false)
        && env::var("PROXIMA_OIDC_CLIENT_SECRET").map(|v| !v.is_empty()).unwrap_or(false);
    let all = db_ok && stripe && stripe_price && stripe_webhook && resend && from && base && oidc;
    Json(json!({
        "status": if all {"ready"} else {"needs_configuration"},
        "checks":{
            "database":db_ok,
            "stripe_secret":stripe,
            "stripe_price":stripe_price,
            "stripe_webhook":stripe_webhook,
            "resend_api_key":resend,
            "resend_from":from,
            "public_base_url":base,
            "oidc":oidc,
            "engine_remains_authoritative":true
        }
    })).into_response()
}

async fn send_email(to: &str, subject: &str, html: &str) -> anyhow::Result<()> {
    let key = env::var("RESEND_API_KEY")?;
    let from = env::var("RESEND_FROM_EMAIL")
        .unwrap_or_else(|_| "Agata Proxima <noreply@agata.cypheris.name.ng>".into());
    let response = Client::new()
        .post("https://api.resend.com/emails")
        .bearer_auth(key)
        .json(&json!({"from":from,"to":[to],"subject":subject,"html":html}))
        .send()
        .await?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        anyhow::bail!("Resend returned {status}: {body}");
    }
    Ok(())
}

fn verify_stripe_signature(payload: &str, signature: &str, secret: &str) -> bool {
    let mut timestamp = None;
    let mut signatures = Vec::new();
    for part in signature.split(',') {
        let mut pair = part.splitn(2, '=');
        match (pair.next(), pair.next()) {
            (Some("t"), Some(value)) => timestamp = value.parse::<i64>().ok(),
            (Some("v1"), Some(value)) => signatures.push(value.to_string()),
            _ => {}
        }
    }
    let timestamp = match timestamp {
        Some(v) => v,
        None => return false,
    };
    let now = chrono::Utc::now().timestamp();
    if (now - timestamp).abs() > 300 {
        return false;
    }
    let signed = format!("{timestamp}.{payload}");
    let mut mac = match HmacSha256::new_from_slice(secret.as_bytes()) {
        Ok(v) => v,
        Err(_) => return false,
    };
    mac.update(signed.as_bytes());
    let expected = hex::encode(mac.finalize().into_bytes());
    signatures.iter().any(|candidate| constant_time_equal(candidate, &expected))
}

fn constant_time_equal(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.as_bytes().iter().zip(b.as_bytes()) {
        diff |= x ^ y;
    }
    diff == 0
}

async fn stripe_error(response: reqwest::Response) -> Response {
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    tracing::error!(%status, body = %body, "Stripe API error");
    service_unavailable("Stripe request failed.")
}

fn external_error<E: std::fmt::Display>(e: E) -> Response {
    tracing::error!(error = %e, "external integration error");
    service_unavailable("External integration request failed.")
}

fn service_unavailable(message: &str) -> Response {
    (StatusCode::SERVICE_UNAVAILABLE, Json(json!({"ok":false,"message":message}))).into_response()
}
