use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use hmac::{Hmac, Mac};
use reqwest::Client;
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sqlx::Row;
use std::env;
use uuid::Uuid;

use super::{AppState, authenticate, bad, db_error, require_admin};
use crate::production;

type HmacSha256 = Hmac<Sha256>;

#[derive(Deserialize)]
pub(crate) struct CheckoutInput { pub price_id: Option<String> }

fn setting(key: &str) -> Option<String> {
    env::var(key).ok().map(|v| v.trim().to_owned()).filter(|v| !v.is_empty())
}
fn expected_price(plan: &str) -> Option<i64> {
    match plan { "starter" => Some(14_900), "growth" => Some(49_900), "scale" => Some(119_900), _ => None }
}
fn variant_key(plan: &str) -> Option<&'static str> {
    match plan {
        "starter" => Some("LEMONSQUEEZY_STARTER_VARIANT_ID"),
        "growth" => Some("LEMONSQUEEZY_GROWTH_VARIANT_ID"),
        "scale" => Some("LEMONSQUEEZY_SCALE_VARIANT_ID"),
        _ => None,
    }
}
fn plan_for_variant(id: &str) -> Option<&'static str> {
    ["starter", "growth", "scale"].into_iter().find(|p| {
        variant_key(p).and_then(setting).as_deref() == Some(id)
    })
}
fn configured_variants_unique() -> bool {
    let values: Vec<String> = ["starter", "growth", "scale"].into_iter()
        .filter_map(|p| variant_key(p).and_then(setting)).collect();
    values.len() == 3 && values.iter().all(|v| !v.is_empty())
        && values[0] != values[1] && values[0] != values[2] && values[1] != values[2]
}
fn signature_valid(body: &[u8], signature: &str, secret: &str) -> bool {
    let mut mac = match HmacSha256::new_from_slice(secret.as_bytes()) { Ok(v) => v, Err(_) => return false };
    mac.update(body);
    let expected = hex::encode(mac.finalize().into_bytes());
    let a = signature.trim().as_bytes();
    let b = expected.as_bytes();
    if a.len() != b.len() { return false; }
    a.iter().zip(b).fold(0u8, |diff, (x,y)| diff | (x ^ y)) == 0
}
fn provider_error(status: reqwest::StatusCode, body: &str) -> Response {
    tracing::error!(%status, response_body = %body, "Lemon Squeezy API request failed");
    (StatusCode::SERVICE_UNAVAILABLE, Json(json!({"ok":false,"message":"Lemon Squeezy request failed."}))).into_response()
}

pub(crate) async fn plans() -> Response {
    let catalog = [
        ("free","Free",0_i32,"Evaluation and small proofs of concept"),
        ("starter","Starter",149_i32,"First production SaaS deployments"),
        ("growth","Growth",499_i32,"Multi-tenant production workloads"),
        ("scale","Scale",1199_i32,"Larger fleets and security operations"),
        ("enterprise","Enterprise",0_i32,"Contracted enterprise deployments"),
    ];
    let variants_ok = configured_variants_unique();
    let plans = catalog.iter().map(|(key,name,monthly_usd,description)| {
        let checkout_available = ["starter","growth","scale"].contains(key) && variants_ok
            && setting("LEMONSQUEEZY_STORE_ID").is_some();
        json!({"key":key,"name":name,"monthly_usd":monthly_usd,"description":description,
            "provider":"lemonsqueezy","checkout_available":checkout_available,
            "limits":{},"features":{}})
    }).collect::<Vec<_>>();
    Json(json!({"currency":"usd","billing_interval":"month","provider":"lemonsqueezy","plans":plans})).into_response()
}

pub(crate) async fn billing_status(State(s): State<AppState>, headers: HeaderMap) -> Response {
    let ctx = match authenticate(&s,&headers).await { Ok(v)=>v, Err(c)=>return c.into_response() };
    match sqlx::query("SELECT lemonsqueezy_customer_id,lemonsqueezy_subscription_id,lemonsqueezy_variant_id,plan_key,status,current_period_end,cancel_at_period_end FROM billing_accounts WHERE organization_id=$1")
        .bind(ctx.organization_id).fetch_optional(&s.db).await {
        Ok(Some(row)) => Json(json!({"configured":true,"provider":"lemonsqueezy",
            "customer_id":row.get::<Option<String>,_>("lemonsqueezy_customer_id"),
            "subscription_id":row.get::<Option<String>,_>("lemonsqueezy_subscription_id"),
            "variant_id":row.get::<Option<String>,_>("lemonsqueezy_variant_id"),
            "plan":row.get::<String,_>("plan_key"),"status":row.get::<String,_>("status"),
            "current_period_end":row.get::<Option<chrono::DateTime<chrono::Utc>>,_>("current_period_end"),
            "cancel_at_period_end":row.get::<bool,_>("cancel_at_period_end")})).into_response(),
        Ok(None)=>Json(json!({"configured":false,"provider":"lemonsqueezy","plan":"free","status":"active"})).into_response(),
        Err(e)=>db_error(e)
    }
}

pub(crate) async fn checkout(State(s): State<AppState>, headers: HeaderMap, Json(input): Json<CheckoutInput>) -> Response {
    let ctx = match authenticate(&s,&headers).await { Ok(v)=>v, Err(c)=>return c.into_response() };
    if let Err(c)=require_admin(&ctx,&headers) { return c.into_response(); }
    let api_key = match setting("LEMONSQUEEZY_API_KEY") { Some(v)=>v, None=>return production::service_unavailable("Lemon Squeezy API key is not configured.") };
    let store_id = match setting("LEMONSQUEEZY_STORE_ID") { Some(v)=>v, None=>return production::service_unavailable("Lemon Squeezy store ID is not configured.") };
    if !configured_variants_unique() { return production::service_unavailable("Configure three distinct Lemon Squeezy variant IDs before checkout."); }
    let requested = match input.price_id.as_deref() { Some(v)=>v.trim(), None=>return bad("Select a plan before checkout.") };
    let plan = if ["starter","growth","scale"].contains(&requested) { requested } else {
        match plan_for_variant(requested) { Some(p)=>p, None=>return bad("Select a valid Agata Proxima monthly plan.") }
    };
    let variant_id = match variant_key(plan).and_then(setting) { Some(v)=>v, None=>return production::service_unavailable("The selected plan variant is not configured.") };
    let expected_price = match expected_price(plan) { Some(v)=>v, None=>return bad("Unsupported paid plan.") };
    let variant_response = match Client::new().get(format!("https://api.lemonsqueezy.com/v1/variants/{variant_id}"))
        .bearer_auth(&api_key).header("Accept","application/vnd.api+json").send().await {
        Ok(r)=>r, Err(e)=>{tracing::error!(%e,"Lemon Squeezy variant lookup failed");return production::service_unavailable("Could not validate the configured plan price.")}
    };
    if !variant_response.status().is_success() { let status=variant_response.status(); let body=variant_response.text().await.unwrap_or_default(); return provider_error(status,&body); }
    let variant:Value=match variant_response.json().await {Ok(v)=>v,Err(e)=>{tracing::error!(%e,"invalid Lemon Squeezy variant response");return production::service_unavailable("Invalid plan response.")}};
    let attributes=variant.pointer("/data/attributes").cloned().unwrap_or(Value::Null);
    if attributes.get("price").and_then(Value::as_i64)!=Some(expected_price)
        || attributes.get("interval").and_then(Value::as_str)!=Some("month")
        || attributes.get("interval_count").and_then(Value::as_i64)!=Some(1)
        || attributes.get("is_subscription").and_then(Value::as_bool)!=Some(true) {
        return (StatusCode::SERVICE_UNAVAILABLE,Json(json!({"ok":false,"error":"lemonsqueezy_variant_mismatch","message":"Configured variant must match the selected monthly USD plan."}))).into_response();
    }
    let email = match sqlx::query("SELECT email FROM users WHERE id=$1").bind(ctx.user_id).fetch_one(&s.db).await {
        Ok(r)=>r.get::<String,_>("email"), Err(e)=>return db_error(e)
    };
    let base = setting("AGATA_PUBLIC_BASE_URL").unwrap_or_else(||"http://127.0.0.1:8080".into()).trim_end_matches('/').to_owned();
    let checkout_payload = json!({
        "data": {"type":"checkouts","attributes":{
            "checkout_data":{"email":email,"custom":{"organization_id":ctx.organization_id.to_string(),"plan":plan}},
            "product_options":{"redirect_url":format!("{base}/app?billing=return"),"receipt_button_text":"Return to Agata Proxima","receipt_link_url":format!("{base}/app")},
            "checkout_options":{"embed":false}
        },"relationships":{"store":{"data":{"type":"stores","id":store_id}},
            "variant":{"data":{"type":"variants","id":variant_id}}}}
    });
    let response = match Client::new().post("https://api.lemonsqueezy.com/v1/checkouts")
        .bearer_auth(api_key).header("Accept","application/vnd.api+json")
        .header("Content-Type","application/vnd.api+json").json(&checkout_payload).send().await {
            Ok(r)=>r, Err(e)=>{tracing::error!(%e,"Lemon Squeezy checkout request failed");return production::service_unavailable("Lemon Squeezy checkout request failed.")}
        };
    if !response.status().is_success() { let status=response.status(); let body=response.text().await.unwrap_or_default(); return provider_error(status,&body); }
    let body:Value=match response.json().await { Ok(v)=>v, Err(e)=>{tracing::error!(%e,"invalid Lemon Squeezy checkout response");return production::service_unavailable("Lemon Squeezy returned an invalid checkout response.")} };
    let url=body.pointer("/data/attributes/url").and_then(Value::as_str).unwrap_or_default();
    if !(url.starts_with("https://") && url.contains("lemonsqueezy.com")) { return production::service_unavailable("Lemon Squeezy did not return a valid hosted checkout URL."); }
    let reference=body.pointer("/data/id").and_then(Value::as_str).unwrap_or_default();
    if reference.is_empty() { return production::service_unavailable("Lemon Squeezy did not return a checkout identifier."); }
    if let Err(e)=sqlx::query("INSERT INTO billing_transactions(organization_id,provider,reference,plan_key,plan_code,currency,status,metadata,created_at,updated_at) VALUES($1,'lemonsqueezy',$2,$3,$4,'USD','initialized',$5,now(),now()) ON CONFLICT(provider,reference) DO NOTHING")
        .bind(ctx.organization_id).bind(reference).bind(plan).bind(&variant_id).bind(&body).execute(&s.db).await { return db_error(e); }
    Json(json!({"ok":true,"provider":"lemonsqueezy","checkout_url":url,"reference":reference,"plan":plan})).into_response()
}

pub(crate) async fn billing_verify(State(s): State<AppState>, headers: HeaderMap, Query(q): Query<std::collections::HashMap<String,String>>) -> Response {
    let ctx=match authenticate(&s,&headers).await {Ok(v)=>v,Err(c)=>return c.into_response()};
    if let Err(c)=require_admin(&ctx,&headers){return c.into_response();}
    let reference=match q.get("reference"){Some(v) if !v.trim().is_empty()=>v.trim(),_=>return bad("Lemon Squeezy checkout reference is required.")};
    match sqlx::query("SELECT status,plan_key FROM billing_transactions WHERE provider='lemonsqueezy' AND reference=$1 AND organization_id=$2")
        .bind(reference).bind(ctx.organization_id).fetch_optional(&s.db).await {
        Ok(Some(r))=>Json(json!({"ok":true,"provider":"lemonsqueezy","reference":reference,"status":r.get::<String,_>("status"),"plan":r.get::<String,_>("plan_key"),"verified_by":"signed_webhook"})).into_response(),
        Ok(None)=>(StatusCode::NOT_FOUND,Json(json!({"ok":false,"error":"unknown_local_transaction"}))).into_response(),
        Err(e)=>db_error(e)
    }
}

pub(crate) async fn portal(State(s): State<AppState>, headers: HeaderMap) -> Response {
    let ctx=match authenticate(&s,&headers).await {Ok(v)=>v,Err(c)=>return c.into_response()};
    if let Err(c)=require_admin(&ctx,&headers){return c.into_response();}
    let api_key=match setting("LEMONSQUEEZY_API_KEY"){Some(v)=>v,None=>return production::service_unavailable("Lemon Squeezy API key is not configured.")};
    let subscription=match sqlx::query("SELECT lemonsqueezy_subscription_id FROM billing_accounts WHERE organization_id=$1")
        .bind(ctx.organization_id).fetch_optional(&s.db).await {
        Ok(Some(r))=>r.get::<Option<String>,_>("lemonsqueezy_subscription_id"),
        Ok(None)=>None,Err(e)=>return db_error(e)
    };
    let subscription=match subscription {Some(v)=>v,None=>return bad("No Lemon Squeezy subscription exists for this organization yet.")};
    let response=match Client::new().get(format!("https://api.lemonsqueezy.com/v1/subscriptions/{subscription}"))
        .bearer_auth(api_key).header("Accept","application/vnd.api+json").send().await {
        Ok(r)=>r,Err(e)=>{tracing::error!(%e,"Lemon Squeezy portal lookup failed");return production::service_unavailable("Could not load the subscription management link.")}
    };
    if !response.status().is_success(){let status=response.status();let body=response.text().await.unwrap_or_default();return provider_error(status,&body);}
    let body:Value=match response.json().await{Ok(v)=>v,Err(e)=>{tracing::error!(%e,"invalid subscription response");return production::service_unavailable("Invalid subscription response.")}};
    match body.pointer("/data/attributes/urls/customer_portal").and_then(Value::as_str) {
        Some(url) if url.starts_with("https://")=>Json(json!({"ok":true,"provider":"lemonsqueezy","portal_url":url})).into_response(),
        _=>production::service_unavailable("Lemon Squeezy did not return a customer portal URL.")
    }
}

pub(crate) async fn webhook(State(s): State<AppState>, headers: HeaderMap, body: String) -> Response {
    let signature=match headers.get("x-signature").and_then(|v|v.to_str().ok()){Some(v)=>v,None=>return StatusCode::BAD_REQUEST.into_response()};
    let secret=match setting("LEMONSQUEEZY_WEBHOOK_SECRET"){Some(v)=>v,None=>return StatusCode::SERVICE_UNAVAILABLE.into_response()};
    if !signature_valid(body.as_bytes(),signature,&secret){return StatusCode::UNAUTHORIZED.into_response();}
    let event:Value=match serde_json::from_str(&body){Ok(v)=>v,Err(_)=>return StatusCode::BAD_REQUEST.into_response()};
    let event_type=event.pointer("/meta/event_name").and_then(Value::as_str).unwrap_or_default();
    if event_type.is_empty(){return StatusCode::BAD_REQUEST.into_response();}
    let data=event.get("data").cloned().unwrap_or(Value::Null);
    let attrs=data.get("attributes").cloned().unwrap_or(Value::Null);
    let event_id=data.get("id").and_then(Value::as_str).unwrap_or_default();
    if event_id.is_empty(){return StatusCode::BAD_REQUEST.into_response();}
    let event_key=format!("{event_type}:{event_id}:{}",hex::encode(Sha256::digest(body.as_bytes())));
    let claimed=match sqlx::query("INSERT INTO billing_events(provider,provider_event_id,event_type,payload,status,processing_started_at,attempt_count) VALUES('lemonsqueezy',$1,$2,$3,'processing',now(),1) ON CONFLICT(provider,provider_event_id) DO UPDATE SET status='processing',processing_started_at=now(),attempt_count=billing_events.attempt_count+1,payload=EXCLUDED.payload,event_type=EXCLUDED.event_type WHERE billing_events.status NOT IN ('processed','ignored') AND (billing_events.processing_started_at IS NULL OR billing_events.processing_started_at < now()-interval '5 minutes') RETURNING id")
        .bind(&event_key).bind(event_type).bind(&event).fetch_optional(&s.db).await {Ok(v)=>v.is_some(),Err(e)=>return db_error(e)};
    if !claimed{return Json(json!({"received":true,"duplicate":true})).into_response();}
    let custom_org=event.pointer("/meta/custom_data/organization_id").and_then(Value::as_str).and_then(|v|Uuid::parse_str(v).ok())
        .or_else(||attrs.pointer("/checkout_data/custom/organization_id").and_then(Value::as_str).and_then(|v|Uuid::parse_str(v).ok()));
    let subscription_id=data.get("id").and_then(Value::as_str).unwrap_or_default();
    let customer_id=attrs.get("customer_id").and_then(|v|if v.is_string(){v.as_str().map(str::to_owned)}else{v.as_i64().map(|n|n.to_string())});
    let variant_id=attrs.get("variant_id").and_then(|v|if v.is_string(){v.as_str().map(str::to_owned)}else{v.as_i64().map(|n|n.to_string())});
    let resolved_org=if let Some(org)=custom_org {Some(org)} else if !subscription_id.is_empty() {
        match sqlx::query("SELECT organization_id FROM billing_accounts WHERE provider='lemonsqueezy' AND lemonsqueezy_subscription_id=$1")
            .bind(subscription_id).fetch_optional(&s.db).await {Ok(v)=>v.map(|r|r.get::<Uuid,_>("organization_id")),Err(e)=>return db_error(e)}
    } else {None};
    let org=match resolved_org {Some(v)=>v,None=>{
        let _=sqlx::query("UPDATE billing_events SET status='ignored',processed_at=now(),processing_started_at=NULL WHERE provider='lemonsqueezy' AND provider_event_id=$1").bind(&event_key).execute(&s.db).await;
        return Json(json!({"received":true,"ignored":"organization_not_resolved"})).into_response()
    }};
    let plan=variant_id.as_deref().and_then(plan_for_variant);
    let status=attrs.get("status").and_then(Value::as_str).unwrap_or_default();
    let period_end=attrs.get("renews_at").or_else(||attrs.get("ends_at")).and_then(Value::as_str)
        .and_then(|v|chrono::DateTime::parse_from_rfc3339(v).ok()).map(|v|v.with_timezone(&chrono::Utc));
    match event_type {
        "subscription_created"|"subscription_updated"|"subscription_resumed"|"subscription_payment_success" => {
            let plan=match plan {Some(p)=>p,None=>{
                let _=sqlx::query("UPDATE billing_events SET status='ignored',processed_at=now(),processing_started_at=NULL WHERE provider='lemonsqueezy' AND provider_event_id=$1").bind(&event_key).execute(&s.db).await;
                return Json(json!({"received":true,"ignored":"unknown_variant"})).into_response()
            }};
            let active=matches!(status,"active"|"on_trial"|"paused");
            if !active { return Json(json!({"received":true,"ignored":"subscription_not_active"})).into_response(); }
            if let Err(e)=sqlx::query("INSERT INTO billing_accounts(organization_id,provider,lemonsqueezy_customer_id,lemonsqueezy_subscription_id,lemonsqueezy_variant_id,plan_key,status,current_period_end,cancel_at_period_end,updated_at) VALUES($1,'lemonsqueezy',$2,$3,$4,$5,'active',$6,false,now()) ON CONFLICT(organization_id) DO UPDATE SET provider='lemonsqueezy',lemonsqueezy_customer_id=COALESCE(EXCLUDED.lemonsqueezy_customer_id,billing_accounts.lemonsqueezy_customer_id),lemonsqueezy_subscription_id=EXCLUDED.lemonsqueezy_subscription_id,lemonsqueezy_variant_id=EXCLUDED.lemonsqueezy_variant_id,plan_key=EXCLUDED.plan_key,status='active',current_period_end=COALESCE(EXCLUDED.current_period_end,billing_accounts.current_period_end),cancel_at_period_end=false,updated_at=now()")
                .bind(org).bind(customer_id).bind(subscription_id).bind(variant_id).bind(plan).bind(period_end).execute(&s.db).await{return db_error(e);}
            if let Err(e)=production::apply_entitlements(&s.db,org,plan).await{return db_error(e);}
        },
        "subscription_cancelled"|"subscription_expired" => {
            if let Err(e)=sqlx::query("UPDATE billing_accounts SET status='canceled',cancel_at_period_end=false,updated_at=now() WHERE organization_id=$1 AND provider='lemonsqueezy'").bind(org).execute(&s.db).await{return db_error(e);}
            if let Err(e)=sqlx::query("UPDATE organization_entitlements SET billing_status='canceled',billing_grace_until=NULL,updated_at=now() WHERE organization_id=$1").bind(org).execute(&s.db).await{return db_error(e);}
        },
        "subscription_payment_failed" => {
            if let Err(e)=sqlx::query("UPDATE billing_accounts SET status='attention',updated_at=now() WHERE organization_id=$1 AND provider='lemonsqueezy' AND status NOT IN ('canceled','unpaid')").bind(org).execute(&s.db).await{return db_error(e);}
            if let Err(e)=sqlx::query("UPDATE organization_entitlements SET billing_status='past_due',billing_grace_until=COALESCE(billing_grace_until,now()+interval '7 days'),updated_at=now() WHERE organization_id=$1 AND billing_status NOT IN ('canceled','unpaid')").bind(org).execute(&s.db).await{return db_error(e);}
        },
        _ => {}
    }
    if let Err(e)=sqlx::query("UPDATE billing_events SET status='processed',processed_at=now(),processing_started_at=NULL WHERE provider='lemonsqueezy' AND provider_event_id=$1").bind(&event_key).execute(&s.db).await{return db_error(e);}
    Json(json!({"received":true,"processed":true})).into_response()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn webhook_signature_round_trip() {
        let body = br#"{"meta":{"event_name":"subscription_created"}}"#;
        let secret = "unit-test-secret";
        let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(body);
        let signature = hex::encode(mac.finalize().into_bytes());
        assert!(signature_valid(body,&signature,secret));
        assert!(!signature_valid(body,&signature,"wrong-secret"));
        assert!(!signature_valid(body,"00",secret));
    }
    #[test] fn plans_have_expected_usd_monthly_prices() {
        assert_eq!(expected_price("starter"), Some(14_900));
        assert_eq!(expected_price("growth"), Some(49_900));
        assert_eq!(expected_price("scale"), Some(119_900));
        assert_eq!(expected_price("free"), None);
    }
}
