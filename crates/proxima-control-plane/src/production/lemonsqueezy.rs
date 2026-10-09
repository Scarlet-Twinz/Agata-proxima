use super::{apply_entitlements, authenticate, bad, db_error, external_error, require_admin, service_unavailable, AppState};
use axum::{extract::{Query, State}, http::{HeaderMap, StatusCode}, response::{IntoResponse, Response}, Json};
use hmac::{Hmac, Mac};
use reqwest::Client;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sqlx::Row;
use std::{env, collections::HashMap};
use uuid::Uuid;

type HmacSha256 = Hmac<sha2::Sha256>;

fn configured_variant(plan: &str) -> Option<String> {
    let key = match plan {
        "starter" => "LEMONSQUEEZY_STARTER_VARIANT_ID",
        "growth" => "LEMONSQUEEZY_GROWTH_VARIANT_ID",
        "scale" => "LEMONSQUEEZY_SCALE_VARIANT_ID",
        _ => return None,
    };
    env::var(key).ok().filter(|v| !v.trim().is_empty())
}
fn plan_for_variant(id: &str) -> Option<&'static str> {
    ["starter", "growth", "scale"].into_iter().find(|p| configured_variant(p).as_deref() == Some(id))
}
fn configured() -> bool {
    env::var("LEMONSQUEEZY_API_KEY").map(|v| !v.trim().is_empty()).unwrap_or(false)
        && env::var("LEMONSQUEEZY_STORE_ID").map(|v| !v.trim().is_empty()).unwrap_or(false)
        && ["starter","growth","scale"].iter().all(|p| configured_variant(p).is_some())
        && {
            let ids: Vec<String> = ["starter","growth","scale"].iter().filter_map(|p| configured_variant(p)).collect();
            ids.len() == 3 && ids.iter().collect::<std::collections::HashSet<_>>().len() == 3
        }
}
fn api_client() -> anyhow::Result<Client> {
    Ok(Client::builder().timeout(std::time::Duration::from_secs(15)).build()?)
}
fn api_headers(req: reqwest::RequestBuilder, key: &str) -> reqwest::RequestBuilder {
    req.bearer_auth(key).header("Accept", "application/vnd.api+json").header("Content-Type", "application/vnd.api+json")
}

fn expected_monthly_price(plan: &str) -> Option<i64> {
    match plan {
        "starter" => Some(14_900),
        "growth" => Some(49_900),
        "scale" => Some(119_900),
        _ => None,
    }
}

async fn validate_store_and_variant(client: &Client, key: &str, store_id: &str, variant_id: &str, plan: &str) -> Result<(), &'static str> {
    let store_response = api_headers(client.get(format!("https://api.lemonsqueezy.com/v1/stores/{store_id}")), key)
        .send().await.map_err(|_| "Lemon Squeezy store could not be checked.")?;
    if !store_response.status().is_success() { return Err("Lemon Squeezy store ID or API key is invalid."); }
    let store: Value = store_response.json().await.map_err(|_| "Lemon Squeezy store response was invalid.")?;
    if store.pointer("/data/attributes/currency").and_then(Value::as_str) != Some("USD") {
        return Err("The configured Lemon Squeezy store must use USD as its currency.");
    }

    let variant_response = api_headers(client.get(format!("https://api.lemonsqueezy.com/v1/variants/{variant_id}")), key)
        .send().await.map_err(|_| "Lemon Squeezy variant could not be checked.")?;
    if !variant_response.status().is_success() { return Err("The configured Lemon Squeezy variant is unavailable."); }
    let variant: Value = variant_response.json().await.map_err(|_| "Lemon Squeezy variant response was invalid.")?;
    let attrs = variant.pointer("/data/attributes").ok_or("Lemon Squeezy variant attributes are missing.")?;
    if attrs.get("status").and_then(Value::as_str) != Some("published") {
        return Err("The configured Lemon Squeezy variant must be published.");
    }
    let expected_test_mode = env::var("LEMONSQUEEZY_TEST_MODE").map(|v| v.eq_ignore_ascii_case("true")).unwrap_or(true);
    if attrs.get("test_mode").and_then(Value::as_bool) != Some(expected_test_mode) {
        return Err("Lemon Squeezy variant mode does not match LEMONSQUEEZY_TEST_MODE.");
    }

    let prices_url = format!("https://api.lemonsqueezy.com/v1/prices?filter%5Bvariant_id%5D={variant_id}");
    let prices_response = api_headers(client.get(prices_url), key).send().await
        .map_err(|_| "Lemon Squeezy price could not be checked.")?;
    if !prices_response.status().is_success() { return Err("Lemon Squeezy price lookup failed."); }
    let prices: Value = prices_response.json().await.map_err(|_| "Lemon Squeezy price response was invalid.")?;
    let price = prices.get("data").and_then(Value::as_array).and_then(|v|v.first())
        .ok_or("The configured Lemon Squeezy variant has no price.")?;
    let price_attrs = price.get("attributes").ok_or("Lemon Squeezy price attributes are missing.")?;
    if price_attrs.get("category").and_then(Value::as_str) != Some("subscription")
        || price_attrs.get("scheme").and_then(Value::as_str) != Some("standard")
        || price_attrs.get("unit_price").and_then(Value::as_i64) != expected_monthly_price(plan)
        || price_attrs.get("renewal_interval_unit").and_then(Value::as_str) != Some("month")
        || price_attrs.get("renewal_interval_quantity").and_then(Value::as_i64) != Some(1)
        || price_attrs.get("setup_fee_enabled").and_then(Value::as_bool) == Some(true)
    {
        return Err("The Lemon Squeezy variant must be a standard monthly USD subscription at the exact Agata plan price with no setup fee.");
    }
    Ok(())
}

pub(crate) async fn plans() -> Response {
    let catalog = [("free","Free",0_i32,"Evaluation and small proofs of concept"),("starter","Starter",149_i32,"First production SaaS deployments"),("growth","Growth",499_i32,"Multi-tenant production workloads"),("scale","Scale",1199_i32,"Larger fleets and security operations"),("enterprise","Enterprise",0_i32,"Contracted enterprise deployments")];
    let plans = catalog.iter().map(|(key,name,monthly_usd,description)| {
        let (nodes,tenants,environments,retention,advanced,fleet,priority,entra,private_deployment)=super::plan_limits(key);
        json!({"key":key,"name":name,"monthly_usd":monthly_usd,"description":description,"provider":"lemonsqueezy","variant_id":configured_variant(key),"checkout_available":configured() && ["starter","growth","scale"].contains(key),"limits":{"nodes":nodes,"tenants":tenants,"environments":environments,"audit_retention_days":retention},"support_level":super::plan_support_level(key),"features":{"advanced_verification":advanced,"fleet_controls":fleet,"priority_support":priority,"entra_oidc":entra,"private_deployment":private_deployment,"policy_management":key!=&"free"}})
    }).collect::<Vec<_>>();
    Json(json!({"currency":"usd","billing_interval":"month","provider":"lemonsqueezy","plans":plans})).into_response()
}

pub(crate) async fn billing_status(State(s): State<AppState>, headers: HeaderMap) -> Response {
    let ctx = match authenticate(&s,&headers).await { Ok(v)=>v,Err(c)=>return c.into_response() };
    match sqlx::query("SELECT lemonsqueezy_customer_id,lemonsqueezy_subscription_id,lemonsqueezy_variant_id,plan_key,status,current_period_end,cancel_at_period_end FROM billing_accounts WHERE organization_id=$1")
        .bind(ctx.organization_id).fetch_optional(&s.db).await {
        Ok(Some(r)) => Json(json!({"configured":true,"provider":"lemonsqueezy","customer_id":r.get::<Option<String>,_>("lemonsqueezy_customer_id"),"subscription_id":r.get::<Option<String>,_>("lemonsqueezy_subscription_id"),"variant_id":r.get::<Option<String>,_>("lemonsqueezy_variant_id"),"plan":r.get::<String,_>("plan_key"),"status":r.get::<String,_>("status"),"current_period_end":r.get::<Option<chrono::DateTime<chrono::Utc>>,_>("current_period_end"),"cancel_at_period_end":r.get::<bool,_>("cancel_at_period_end")})).into_response(),
        Ok(None) => Json(json!({"configured":false,"provider":"lemonsqueezy","plan":"free","status":"active"})).into_response(),
        Err(e) => db_error(e)
    }
}

pub(crate) async fn checkout(State(s):State<AppState>,headers:HeaderMap,Json(input):Json<super::CheckoutInput>)->Response {
    let ctx=match authenticate(&s,&headers).await {Ok(v)=>v,Err(c)=>return c.into_response()};
    if let Err(c)=require_admin(&ctx,&headers) {return c.into_response();}
    if !configured() { return service_unavailable("Lemon Squeezy checkout is not configured. Configure the API key, store ID, and three unique monthly USD variant IDs."); }
    let requested=input.price_id.as_deref().unwrap_or("").trim();
    let plan=if ["starter","growth","scale"].contains(&requested) {requested} else { match plan_for_variant(requested) {Some(v)=>v,None=>return bad("Select a valid Agata Proxima monthly plan.")} };
    let variant=configured_variant(plan).unwrap();
    let store=env::var("LEMONSQUEEZY_STORE_ID").unwrap();
    let key=env::var("LEMONSQUEEZY_API_KEY").unwrap();
    let email=match sqlx::query("SELECT email FROM users WHERE id=$1").bind(ctx.user_id).fetch_one(&s.db).await {Ok(r)=>r.get::<String,_>("email"),Err(e)=>return db_error(e)};
    let client=match api_client(){Ok(c)=>c,Err(e)=>return external_error(e)};
    if let Err(message)=validate_store_and_variant(&client,&key,&store,&variant,plan).await {
        return service_unavailable(message);
    }
    let response=match api_headers(client.post("https://api.lemonsqueezy.com/v1/checkouts"),&key)
        .json(&json!({
            "data": {
                "type": "checkouts",
                "attributes": {
                    "checkout_data": {
                        "email": email,
                        "custom": {
                            "organization_id": ctx.organization_id.to_string(),
                            "plan": plan
                        }
                    },
                    "product_options": {
                        "redirect_url": format!("{}/app?billing=return", env::var("AGATA_PUBLIC_BASE_URL").unwrap_or_else(|_| "http://127.0.0.1:8080".into()).trim_end_matches('/'))
                    }
                },
                "relationships": {
                    "store": { "data": { "type": "stores", "id": store } },
                    "variant": { "data": { "type": "variants", "id": variant } }
                }
            }
        }))
        .send().await {Ok(v)=>v,Err(e)=>return external_error(e)};
    if !response.status().is_success() {return (StatusCode::BAD_GATEWAY,Json(json!({"ok":false,"error":"lemonsqueezy_checkout_creation_failed","message":"Lemon Squeezy could not create a checkout. Verify the test-mode store and variant configuration."}))).into_response();}
    let body:Value=match response.json().await {Ok(v)=>v,Err(e)=>return external_error(e)};
    let url=body.pointer("/data/attributes/url").and_then(Value::as_str).unwrap_or("");
    if url.is_empty() || !url.starts_with("https://") {return service_unavailable("Lemon Squeezy did not return a secure checkout URL.");}
    let reference=body.pointer("/data/id").and_then(Value::as_str).unwrap_or("").to_string();
    if reference.is_empty(){return service_unavailable("Lemon Squeezy did not return a checkout identifier.");}
    if let Err(e)=sqlx::query("INSERT INTO billing_transactions(organization_id,provider,reference,plan_key,plan_code,currency,status,metadata,payload,created_at,updated_at) VALUES($1,'lemonsqueezy',$2,$3,$4,'USD','initialized',$5,$6,now(),now()) ON CONFLICT(provider,reference) DO NOTHING")
        .bind(ctx.organization_id).bind(&reference).bind(plan).bind(&variant).bind(json!({"organization_id":ctx.organization_id.to_string(),"plan":plan})).bind(&body).execute(&s.db).await {return db_error(e);}
    super::audit(&s.db,ctx.organization_id,ctx.user_id,"billing.checkout.created","billing_transaction",None,json!({"provider":"lemonsqueezy","checkout_id":reference,"plan":plan,"variant_id":variant})).await;
    Json(json!({"ok":true,"provider":"lemonsqueezy","checkout_url":url,"reference":reference,"plan":plan})).into_response()
}

pub(crate) async fn billing_verify(State(s):State<AppState>,headers:HeaderMap,Query(q):Query<HashMap<String,String>>)->Response {
    let ctx=match authenticate(&s,&headers).await {Ok(v)=>v,Err(c)=>return c.into_response()};
    if let Err(c)=require_admin(&ctx,&headers){return c.into_response();}
    let id=match q.get("reference").or_else(||q.get("checkout_id")) {Some(v) if !v.trim().is_empty()=>v.trim(),_=>return bad("Lemon Squeezy checkout identifier is required.")};
    match sqlx::query("SELECT status,plan_key FROM billing_transactions WHERE provider='lemonsqueezy' AND reference=$1 AND organization_id=$2").bind(id).bind(ctx.organization_id).fetch_optional(&s.db).await {
        Ok(Some(r))=>Json(json!({"ok":true,"verified":r.get::<String,_>("status")=="success","provider":"lemonsqueezy","reference":id,"status":r.get::<String,_>("status"),"plan":r.get::<String,_>("plan_key"),"note":"Subscription activation is confirmed by the signed webhook, not by the browser redirect."})).into_response(),
        Ok(None)=>(StatusCode::NOT_FOUND,Json(json!({"ok":false,"error":"unknown_local_checkout"}))).into_response(),
        Err(e)=>db_error(e)
    }
}

pub(crate) async fn portal(State(s):State<AppState>,headers:HeaderMap)->Response {
    let ctx=match authenticate(&s,&headers).await {Ok(v)=>v,Err(c)=>return c.into_response()};
    if let Err(c)=require_admin(&ctx,&headers){return c.into_response();}
    let url=match sqlx::query("SELECT lemonsqueezy_customer_portal_url FROM billing_accounts WHERE organization_id=$1 AND provider='lemonsqueezy'").bind(ctx.organization_id).fetch_optional(&s.db).await {
        Ok(Some(r))=>r.get::<Option<String>,_>("lemonsqueezy_customer_portal_url"),Ok(None)=>None,Err(e)=>return db_error(e)
    };
    match url {Some(v) if v.starts_with("https://")=>Json(json!({"ok":true,"provider":"lemonsqueezy","portal_url":v})).into_response(),_=>bad("No customer portal URL is available yet. Open the subscription management link from your Lemon Squeezy customer receipt or wait for the first subscription webhook.")}
}

fn valid_signature(body:&str, signature:&str, secret:&str)->bool {
    let Ok(mut mac)=HmacSha256::new_from_slice(secret.as_bytes()) else{return false};
    mac.update(body.as_bytes());
    let Ok(received) = hex::decode(signature.trim()) else { return false; };
    mac.verify_slice(&received).is_ok()
}

pub(crate) async fn webhook(State(s):State<AppState>,headers:HeaderMap,body:String)->Response {
    let signature=match headers.get("x-signature").and_then(|v|v.to_str().ok()){Some(v)=>v,None=>return StatusCode::BAD_REQUEST.into_response()};
    let secret=match env::var("LEMONSQUEEZY_WEBHOOK_SECRET"){Ok(v) if !v.trim().is_empty()=>v,_=>return StatusCode::SERVICE_UNAVAILABLE.into_response()};
    if !valid_signature(&body,signature,&secret){return StatusCode::UNAUTHORIZED.into_response();}
    let event:Value=match serde_json::from_str(&body){Ok(v)=>v,Err(_)=>return StatusCode::BAD_REQUEST.into_response()};
    let event_type=event.pointer("/meta/event_name").and_then(Value::as_str).unwrap_or("");
    let data=event.get("data").cloned().unwrap_or(Value::Null);
    let subscription_id=data.get("id").and_then(Value::as_str).unwrap_or("");
    if event_type.is_empty() || subscription_id.is_empty(){return StatusCode::BAD_REQUEST.into_response();}
    let key=format!("{}:{}",event_type,hex::encode(Sha256::digest(body.as_bytes())));
    let claimed=match sqlx::query("INSERT INTO billing_events(provider,provider_event_id,event_type,payload,status,processing_started_at,attempt_count) VALUES('lemonsqueezy',$1,$2,$3,'processing',now(),1) ON CONFLICT(provider,provider_event_id) DO UPDATE SET status='processing',processing_started_at=now(),attempt_count=billing_events.attempt_count+1,payload=EXCLUDED.payload,event_type=EXCLUDED.event_type WHERE billing_events.status NOT IN ('processed','ignored') AND (billing_events.processing_started_at IS NULL OR billing_events.processing_started_at<now()-interval '5 minutes') RETURNING id")
        .bind(&key).bind(event_type).bind(&event).fetch_optional(&s.db).await {Ok(v)=>v.is_some(),Err(e)=>return db_error(e)};
    if !claimed{return Json(json!({"received":true,"duplicate":true})).into_response();}
    let attrs=data.get("attributes").cloned().unwrap_or(Value::Null);
    let meta=event.get("meta").cloned().unwrap_or(Value::Null);
    let custom=meta.get("custom_data").cloned().unwrap_or(Value::Null);
    let org_from_custom=custom.get("organization_id").and_then(Value::as_str).and_then(|v|Uuid::parse_str(v).ok());
    let customer_id=attrs.get("customer_id").and_then(Value::as_i64).map(|v|v.to_string());
    let variant_id=attrs.get("variant_id").and_then(Value::as_i64).map(|v|v.to_string());
    let plan=variant_id.as_deref().and_then(plan_for_variant);
    let existing_org=if org_from_custom.is_none(){match sqlx::query("SELECT organization_id FROM billing_accounts WHERE provider='lemonsqueezy' AND lemonsqueezy_subscription_id=$1").bind(subscription_id).fetch_optional(&s.db).await{Ok(v)=>v.map(|r|r.get::<Uuid,_>("organization_id")),Err(e)=>return db_error(e)}}else{None};
    let org=match org_from_custom.or(existing_org){Some(v)=>v,None=>{
        let _=sqlx::query("UPDATE billing_events SET status='ignored',processed_at=now(),processing_started_at=NULL WHERE provider='lemonsqueezy' AND provider_event_id=$1").bind(&key).execute(&s.db).await;
        return Json(json!({"received":true,"ignored":"organization_not_resolved"})).into_response();
    }};
    if let (Some(variant),Some(plan))=(variant_id.as_deref(),plan) {
        if configured_variant(plan).as_deref()!=Some(variant){return StatusCode::UNPROCESSABLE_ENTITY.into_response();}
    }
    let status=attrs.get("status").and_then(Value::as_str).unwrap_or("");
    let renews=attrs.get("renews_at").and_then(Value::as_str).and_then(|v|chrono::DateTime::parse_from_rfc3339(v).ok()).map(|v|v.with_timezone(&chrono::Utc));
    let ends=attrs.get("ends_at").and_then(Value::as_str).and_then(|v|chrono::DateTime::parse_from_rfc3339(v).ok()).map(|v|v.with_timezone(&chrono::Utc));
    let cancel=attrs.get("cancelled").and_then(Value::as_bool).unwrap_or(false) || event_type=="subscription_cancelled";
    let portal=attrs.pointer("/urls/customer_portal").and_then(Value::as_str);
    let effective_status=if event_type=="subscription_cancelled" || event_type=="subscription_expired" { "canceled" } else if event_type=="subscription_payment_failed" { "past_due" } else { match status {"active"|"on_trial"=>"active","past_due"|"unpaid"=>"past_due","cancelled"|"expired"=>"canceled",_=>"active"} };
    if let Some(plan)=plan {
        if matches!(event_type,"subscription_created"|"subscription_updated"|"subscription_resumed"|"subscription_cancelled"|"subscription_expired"|"subscription_paused"|"subscription_unpaused"|"subscription_payment_success"|"subscription_payment_failed") {
            if let Err(e)=sqlx::query("INSERT INTO billing_accounts(organization_id,provider,lemonsqueezy_customer_id,lemonsqueezy_subscription_id,lemonsqueezy_variant_id,lemonsqueezy_customer_portal_url,plan_key,status,current_period_end,cancel_at_period_end,updated_at) VALUES($1,'lemonsqueezy',$2,$3,$4,$5,$6,$7,$8,$9,now()) ON CONFLICT(organization_id) DO UPDATE SET provider='lemonsqueezy',lemonsqueezy_customer_id=COALESCE(EXCLUDED.lemonsqueezy_customer_id,billing_accounts.lemonsqueezy_customer_id),lemonsqueezy_subscription_id=EXCLUDED.lemonsqueezy_subscription_id,lemonsqueezy_variant_id=EXCLUDED.lemonsqueezy_variant_id,lemonsqueezy_customer_portal_url=COALESCE(EXCLUDED.lemonsqueezy_customer_portal_url,billing_accounts.lemonsqueezy_customer_portal_url),plan_key=EXCLUDED.plan_key,status=EXCLUDED.status,current_period_end=COALESCE(EXCLUDED.current_period_end,billing_accounts.current_period_end),cancel_at_period_end=EXCLUDED.cancel_at_period_end,updated_at=now()")
                .bind(org).bind(customer_id).bind(subscription_id).bind(variant_id).bind(portal).bind(plan).bind(effective_status).bind(renews.or(ends)).bind(cancel).execute(&s.db).await{return db_error(e);}
            if matches!(effective_status,"active") {if let Err(e)=apply_entitlements(&s.db,org,plan).await{return db_error(e);}}
            else if let Err(e)=sqlx::query("UPDATE organization_entitlements SET billing_status=$1,billing_grace_until=CASE WHEN $1='past_due' THEN now()+interval '7 days' ELSE NULL END,updated_at=now() WHERE organization_id=$2").bind(effective_status).bind(org).execute(&s.db).await{return db_error(e);}
            if let Err(e)=sqlx::query("UPDATE billing_transactions SET status=CASE WHEN $1='subscription_payment_success' THEN 'success' WHEN $1='subscription_payment_failed' THEN 'failed' ELSE status END,payload=$2,updated_at=now() WHERE provider='lemonsqueezy' AND organization_id=$3 AND plan_key=$4 AND status='initialized'").bind(event_type).bind(&event).bind(org).bind(plan).execute(&s.db).await{return db_error(e);}
            let (title, details) = match event_type {
                "subscription_payment_success" => ("Subscription payment received", "Your Lemon Squeezy subscription payment was received and your plan is active."),
                "subscription_payment_failed" => ("Subscription payment needs attention", "A Lemon Squeezy subscription payment failed. Review your payment method to avoid interruption."),
                "subscription_cancelled" => ("Subscription cancelled", "Your Lemon Squeezy subscription was cancelled. Review your billing page for the current access period."),
                "subscription_expired" => ("Subscription expired", "Your Lemon Squeezy subscription has expired."),
                "subscription_created" => ("Subscription activated", "Your Lemon Squeezy subscription is active."),
                _ => ("Subscription updated", "Your Lemon Squeezy subscription details have changed."),
            };
            super::send_billing_notice(&s.db, org, &key, title, details).await;
        }
    }
    if let Err(e)=sqlx::query("UPDATE billing_events SET status='processed',processed_at=now(),processing_started_at=NULL WHERE provider='lemonsqueezy' AND provider_event_id=$1").bind(&key).execute(&s.db).await{return db_error(e);}
    Json(json!({"received":true,"processed":true,"provider":"lemonsqueezy"})).into_response()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn lemon_signature_accepts_valid_raw_body() {
        let body=r#"{"meta":{"event_name":"subscription_created"}}"#;
        let mut mac=HmacSha256::new_from_slice(b"test-secret").unwrap(); mac.update(body.as_bytes());
        let sig=hex::encode(mac.finalize().into_bytes());
        assert!(valid_signature(body,&sig,"test-secret"));
        assert!(!valid_signature(body,&sig,"wrong-secret"));
        assert!(!valid_signature(body,&format!("{sig}00"),"test-secret"));
    }
    #[test] fn plan_mapping_rejects_duplicate_variants() {
        std::env::set_var("LEMONSQUEEZY_STARTER_VARIANT_ID","101");
        std::env::set_var("LEMONSQUEEZY_GROWTH_VARIANT_ID","202");
        std::env::set_var("LEMONSQUEEZY_SCALE_VARIANT_ID","303");
        assert_eq!(plan_for_variant("202"),Some("growth"));
        std::env::set_var("LEMONSQUEEZY_GROWTH_VARIANT_ID","101");
        assert_eq!(plan_for_variant("101"),Some("starter"));
        std::env::remove_var("LEMONSQUEEZY_STARTER_VARIANT_ID");
        std::env::remove_var("LEMONSQUEEZY_GROWTH_VARIANT_ID");
        std::env::remove_var("LEMONSQUEEZY_SCALE_VARIANT_ID");
    }
}
