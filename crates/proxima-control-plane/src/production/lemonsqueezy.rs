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
    let mut matches = ["starter", "growth", "scale"]
        .into_iter()
        .filter(|plan| configured_variant(plan).as_deref() == Some(id));
    let plan = matches.next()?;
    if matches.next().is_some() {
        return None;
    }
    Some(plan)
}
pub(crate) fn variants_configured() -> bool {
    let ids: Vec<String> = ["starter","growth","scale"].iter().filter_map(|p| configured_variant(p)).collect();
    ids.len() == 3 && ids.iter().collect::<std::collections::HashSet<_>>().len() == 3
}

pub(crate) fn test_mode_configured() -> bool {
    env::var("LEMONSQUEEZY_TEST_MODE")
        .map(|value| matches!(value.trim().to_ascii_lowercase().as_str(), "true" | "false"))
        .unwrap_or(true)
}

fn configured() -> bool {
    env::var("LEMONSQUEEZY_API_KEY").map(|v| !v.trim().is_empty()).unwrap_or(false)
        && env::var("LEMONSQUEEZY_WEBHOOK_SECRET").map(|v| !v.trim().is_empty()).unwrap_or(false)
        && env::var("LEMONSQUEEZY_STORE_ID").map(|v| !v.trim().is_empty()).unwrap_or(false)
        && variants_configured()
        && test_mode_configured()
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

    let product_id = attrs.get("product_id").and_then(Value::as_i64)
        .ok_or("Lemon Squeezy variant does not identify its product.")?;
    let product_response = api_headers(client.get(format!("https://api.lemonsqueezy.com/v1/products/{product_id}")), key)
        .send().await.map_err(|_| "Lemon Squeezy product could not be checked.")?;
    if !product_response.status().is_success() {
        return Err("The configured Lemon Squeezy product is unavailable.");
    }
    let product: Value = product_response.json().await.map_err(|_| "Lemon Squeezy product response was invalid.")?;
    if product.pointer("/data/attributes/store_id").and_then(Value::as_i64)
        != store_id.parse::<i64>().ok() {
        return Err("The configured Lemon Squeezy variant does not belong to the configured store.");
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
        let integrations=super::plan_integration_limit(key);
        let verifications=super::plan_verification_limit(key);
        let team_seats=super::plan_team_seat_limit(key);
        let api_keys=super::plan_api_key_limit(key);
        let api_requests=super::plan_api_requests_per_minute(key);
        json!({"key":key,"name":name,"monthly_usd":monthly_usd,"description":description,"provider":"lemonsqueezy","variant_id":configured_variant(key),"checkout_available":configured() && ["starter","growth","scale"].contains(*key),"limits":{"nodes":nodes,"tenants":tenants,"environments":environments,"integrations":integrations,"verifications_per_month":verifications,"team_seats":team_seats,"api_keys":api_keys,"api_requests_per_minute":api_requests,"audit_retention_days":retention},"support_level":super::plan_support_level(key),"features":{"advanced_verification":advanced,"fleet_controls":fleet,"priority_support":priority,"entra_oidc":entra,"private_deployment":private_deployment,"policy_management":*key!="free"}})
    }).collect::<Vec<_>>();
    Json(json!({"currency":"usd","billing_interval":"month","provider":"lemonsqueezy","plans":plans})).into_response()
}

pub(crate) async fn billing_status(State(s): State<AppState>, headers: HeaderMap) -> Response {
    let ctx = match authenticate(&s,&headers).await { Ok(v)=>v,Err(c)=>return c.into_response() };
    match sqlx::query("SELECT lemonsqueezy_customer_id,lemonsqueezy_subscription_id,lemonsqueezy_variant_id,plan_key,status,current_period_end,cancel_at_period_end FROM billing_accounts WHERE organization_id=$1 AND provider='lemonsqueezy'")
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
    let checkout_nonce = Uuid::new_v4().to_string();
    let response=match api_headers(client.post("https://api.lemonsqueezy.com/v1/checkouts"),&key)
        .json(&json!({
            "data": {
                "type": "checkouts",
                "attributes": {
                    "checkout_data": {
                        "email": email,
                        "custom": {
                            "organization_id": ctx.organization_id.to_string(),
                            "plan": plan,
                            "checkout_nonce": checkout_nonce
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
        .bind(ctx.organization_id).bind(&reference).bind(plan).bind(&variant).bind(json!({"organization_id":ctx.organization_id.to_string(),"plan":plan,"checkout_nonce":checkout_nonce})).bind(&body).execute(&s.db).await {return db_error(e);}
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
    let subscription_id=match sqlx::query("SELECT lemonsqueezy_subscription_id FROM billing_accounts WHERE organization_id=$1 AND provider='lemonsqueezy'").bind(ctx.organization_id).fetch_optional(&s.db).await {
        Ok(Some(r))=>r.get::<Option<String>,_>("lemonsqueezy_subscription_id"),Ok(None)=>None,Err(e)=>return db_error(e)
    };
    let subscription_id=match subscription_id {Some(v) if !v.trim().is_empty()=>v,_=>return bad("No Lemon Squeezy subscription exists for this organization yet.")};
    let key=match env::var("LEMONSQUEEZY_API_KEY"){Ok(v) if !v.trim().is_empty()=>v,_=>return service_unavailable("Lemon Squeezy API key is not configured.")};
    let client=match api_client(){Ok(v)=>v,Err(e)=>return external_error(e)};
    let response=match api_headers(client.get(format!("https://api.lemonsqueezy.com/v1/subscriptions/{subscription_id}")),&key).send().await {Ok(v)=>v,Err(e)=>return external_error(e)};
    if !response.status().is_success(){return service_unavailable("Lemon Squeezy could not refresh the customer portal link.");}
    let body:Value=match response.json().await {Ok(v)=>v,Err(e)=>return external_error(e)};
    let attrs=body.pointer("/data/attributes").cloned().unwrap_or(Value::Null);
    let expected_store=env::var("LEMONSQUEEZY_STORE_ID").unwrap_or_default();
    let received_store=attrs.get("store_id").and_then(Value::as_i64).map(|v|v.to_string()).unwrap_or_default();
    let expected_test_mode=env::var("LEMONSQUEEZY_TEST_MODE").map(|v|v.eq_ignore_ascii_case("true")).unwrap_or(true);
    if received_store!=expected_store || attrs.get("test_mode").and_then(Value::as_bool)!=Some(expected_test_mode) {
        return service_unavailable("Lemon Squeezy subscription store or mode does not match this environment.");
    }
    let url=attrs.pointer("/urls/customer_portal").and_then(Value::as_str).unwrap_or("");
    if !url.starts_with("https://"){return service_unavailable("Lemon Squeezy did not return a secure customer portal URL.");}
    Json(json!({"ok":true,"provider":"lemonsqueezy","portal_url":url})).into_response()
}

fn subscription_state(event_type:&str,status:&str,cancelled:bool,period_end:Option<chrono::DateTime<chrono::Utc>>,now:chrono::DateTime<chrono::Utc>)->(&'static str,&'static str,bool) {
    let is_cancelled=cancelled || event_type=="subscription_cancelled" || status=="cancelled";
    if event_type=="subscription_expired" || status=="expired" { return ("canceled","canceled",false); }
    if matches!(event_type,"subscription_payment_success"|"subscription_payment_recovered") {
        return ("active","active",false);
    }
    if event_type=="subscription_payment_refunded" {
        return ("past_due","attention",false);
    }
    if is_cancelled {
        if period_end.is_some_and(|end|end>now) { return ("active","non-renewing",true); }
        return ("canceled","canceled",false);
    }
    if status=="unpaid" {
        return ("unpaid","unpaid",false);
    }
    if event_type=="subscription_payment_failed" || matches!(status,"past_due"|"paused") {
        return ("past_due","attention",false);
    }
    if matches!(status,"active"|"on_trial") {
        return ("active","active",false);
    }
    ("unpaid","attention",false)
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
    let resource_id=data.get("id").and_then(Value::as_str).unwrap_or("");
    let invoice_event=matches!(event_type,"subscription_payment_success"|"subscription_payment_failed"|"subscription_payment_recovered"|"subscription_payment_refunded");
    let attrs_hint=data.get("attributes").cloned().unwrap_or(Value::Null);
    let subscription_id=if invoice_event {
        attrs_hint.get("subscription_id").and_then(|v|v.as_str().map(str::to_owned).or_else(||v.as_i64().map(|n|n.to_string())))
            .or_else(||data.pointer("/relationships/subscription/data/id").and_then(Value::as_str).map(str::to_owned))
            .unwrap_or_default()
    } else { resource_id.to_owned() };
    if event_type.is_empty() || resource_id.is_empty() || (invoice_event && subscription_id.is_empty()){return StatusCode::BAD_REQUEST.into_response();}
    let key=format!("{}:{}",event_type,hex::encode(Sha256::digest(body.as_bytes())));
    let claimed=match sqlx::query("INSERT INTO billing_events(provider,provider_event_id,event_type,payload,status,processing_started_at,attempt_count) VALUES('lemonsqueezy',$1,$2,$3,'processing',now(),1) ON CONFLICT(provider,provider_event_id) DO UPDATE SET status='processing',processing_started_at=now(),attempt_count=billing_events.attempt_count+1,payload=EXCLUDED.payload,event_type=EXCLUDED.event_type WHERE billing_events.status NOT IN ('processed','ignored') AND (billing_events.processing_started_at IS NULL OR billing_events.processing_started_at<now()-interval '5 minutes') RETURNING id")
        .bind(&key).bind(event_type).bind(&event).fetch_optional(&s.db).await {Ok(v)=>v.is_some(),Err(e)=>return db_error(e)};
    if !claimed{return Json(json!({"received":true,"duplicate":true})).into_response();}
    let attrs=data.get("attributes").cloned().unwrap_or(Value::Null);
    let meta=event.get("meta").cloned().unwrap_or(Value::Null);
    let custom=meta.get("custom_data").cloned().unwrap_or(Value::Null);
    let org_from_custom=custom.get("organization_id").and_then(Value::as_str).and_then(|v|Uuid::parse_str(v).ok());
    let incoming_customer_id=attrs.get("customer_id").and_then(Value::as_i64).map(|v|v.to_string());
    let incoming_variant_id=attrs.get("variant_id").and_then(Value::as_i64).map(|v|v.to_string())
        .or_else(||attrs.get("variant_id").and_then(Value::as_str).map(str::to_owned));
    let expected_store=env::var("LEMONSQUEEZY_STORE_ID").unwrap_or_default();
    let expected_test_mode=env::var("LEMONSQUEEZY_TEST_MODE").map(|v|v.eq_ignore_ascii_case("true")).unwrap_or(true);
    let received_store=attrs.get("store_id").and_then(Value::as_i64).map(|v|v.to_string());
    let received_test_mode=attrs.get("test_mode").and_then(Value::as_bool);
    let custom_plan=custom.get("plan").and_then(Value::as_str);
    // Invoice events carry a subscription-invoice resource, not the subscription resource.
    // Resolve them only against a subscription already accepted from a signed subscription event.
    let existing=if invoice_event || org_from_custom.is_none() {
        match sqlx::query("SELECT organization_id,lemonsqueezy_variant_id,plan_key,lemonsqueezy_customer_id,lemonsqueezy_customer_portal_url,status,current_period_end,cancel_at_period_end FROM billing_accounts WHERE provider='lemonsqueezy' AND lemonsqueezy_subscription_id=$1")
            .bind(&subscription_id).fetch_optional(&s.db).await {
            Ok(v)=>v,
            Err(e)=>return db_error(e)
        }
    } else { None };
    if !invoice_event && (received_store.as_deref()!=Some(expected_store.as_str()) || received_test_mode!=Some(expected_test_mode)) {
        let _=sqlx::query("UPDATE billing_events SET status='ignored',processed_at=now(),processing_started_at=NULL WHERE provider='lemonsqueezy' AND provider_event_id=$1").bind(&key).execute(&s.db).await;
        return Json(json!({"received":true,"ignored":"store_or_mode_mismatch"})).into_response();
    }
    if invoice_event && existing.is_none() {
        let _=sqlx::query("UPDATE billing_events SET status='ignored',processed_at=now(),processing_started_at=NULL WHERE provider='lemonsqueezy' AND provider_event_id=$1").bind(&key).execute(&s.db).await;
        return Json(json!({"received":true,"ignored":"invoice_subscription_not_found"})).into_response();
    }
    let existing_org=existing.as_ref().map(|r|r.get::<Uuid,_>("organization_id"));
    let org=match org_from_custom.or(existing_org){Some(v)=>v,None=>{
        let _=sqlx::query("UPDATE billing_events SET status='ignored',processed_at=now(),processing_started_at=NULL WHERE provider='lemonsqueezy' AND provider_event_id=$1").bind(&key).execute(&s.db).await;
        return Json(json!({"received":true,"ignored":"organization_not_resolved"})).into_response();
    }};
    let variant_id=incoming_variant_id.or_else(||existing.as_ref().and_then(|r|r.get::<Option<String>,_>("lemonsqueezy_variant_id")));
    let existing_plan=existing.as_ref().map(|r|r.get::<String,_>("plan_key"));
    let plan=variant_id.as_deref().and_then(plan_for_variant).or_else(||existing_plan.as_deref().and_then(|v|match v{"starter"=>Some("starter"),"growth"=>Some("growth"),"scale"=>Some("scale"),_=>None}));
    if let (Some(expected),Some(received))=(plan,custom_plan) {
        if expected!=received {
            let _=sqlx::query("UPDATE billing_events SET status='ignored',processed_at=now(),processing_started_at=NULL WHERE provider='lemonsqueezy' AND provider_event_id=$1").bind(&key).execute(&s.db).await;
            return Json(json!({"received":true,"ignored":"checkout_plan_variant_mismatch"})).into_response();
        }
    }
    if !invoice_event {
        if let (Some(variant),Some(plan))=(variant_id.as_deref(),plan) {
            if configured_variant(plan).as_deref()!=Some(variant) {
                let _=sqlx::query("UPDATE billing_events SET status='ignored',processed_at=now(),processing_started_at=NULL WHERE provider='lemonsqueezy' AND provider_event_id=$1").bind(&key).execute(&s.db).await;
                return Json(json!({"received":true,"ignored":"variant_plan_mismatch"})).into_response();
            }
        } else {
            let _=sqlx::query("UPDATE billing_events SET status='ignored',processed_at=now(),processing_started_at=NULL WHERE provider='lemonsqueezy' AND provider_event_id=$1").bind(&key).execute(&s.db).await;
            return Json(json!({"received":true,"ignored":"unrecognized_variant"})).into_response();
        }
    }
    let status=attrs.get("status").and_then(Value::as_str).unwrap_or("");
    let renews=attrs.get("renews_at").and_then(Value::as_str).and_then(|v|chrono::DateTime::parse_from_rfc3339(v).ok()).map(|v|v.with_timezone(&chrono::Utc));
    let ends=attrs.get("ends_at").and_then(Value::as_str).and_then(|v|chrono::DateTime::parse_from_rfc3339(v).ok()).map(|v|v.with_timezone(&chrono::Utc));
    let cancelled=attrs.get("cancelled").and_then(Value::as_bool).unwrap_or(false) || event_type=="subscription_cancelled" || status=="cancelled";
    let incoming_portal=attrs.pointer("/urls/customer_portal").and_then(Value::as_str);
    let period_end=if invoice_event { existing.as_ref().and_then(|r|r.get::<Option<chrono::DateTime<chrono::Utc>>,_>("current_period_end")) } else { ends.or(renews) };
    let (effective_status,account_status,cancel_at_period_end)=if invoice_event {
        let prior_status=existing.as_ref().map(|r|r.get::<String,_>("status")).unwrap_or_else(||"active".to_owned());
        let prior_cancel=existing.as_ref().map(|r|r.get::<bool,_>("cancel_at_period_end")).unwrap_or(false);
        if matches!(event_type,"subscription_payment_failed"|"subscription_payment_refunded") {
            ("past_due",if prior_status=="non-renewing"{"non-renewing"}else{"attention"},prior_cancel)
        } else {
            ("active",if prior_status=="non-renewing"{"non-renewing"}else{"active"},prior_cancel)
        }
    } else { subscription_state(event_type,status,cancelled,period_end,chrono::Utc::now()) };
    let customer_id=incoming_customer_id.or_else(||existing.as_ref().and_then(|r|r.get::<Option<String>,_>("lemonsqueezy_customer_id")));
    let portal=incoming_portal.map(str::to_owned).or_else(||existing.as_ref().and_then(|r|r.get::<Option<String>,_>("lemonsqueezy_customer_portal_url")));
    if let Some(plan)=plan {
        if matches!(event_type,"subscription_created"|"subscription_updated"|"subscription_resumed"|"subscription_cancelled"|"subscription_expired"|"subscription_paused"|"subscription_unpaused"|"subscription_payment_success"|"subscription_payment_failed"|"subscription_payment_recovered"|"subscription_payment_refunded") {
            if event_type=="subscription_created" {
                let nonce=match custom.get("checkout_nonce").and_then(Value::as_str) {
                    Some(value) if !value.trim().is_empty()=>value,
                    _=>{
                        let _=sqlx::query("UPDATE billing_events SET status='ignored',processed_at=now(),processing_started_at=NULL WHERE provider='lemonsqueezy' AND provider_event_id=$1").bind(&key).execute(&s.db).await;
                        return Json(json!({"received":true,"ignored":"checkout_nonce_missing"})).into_response();
                    }
                };
                let local_checkout=match sqlx::query("SELECT id FROM billing_transactions WHERE provider='lemonsqueezy' AND organization_id=$1 AND plan_key=$2 AND metadata->>'checkout_nonce'=$3 AND status='initialized'").bind(org).bind(plan).bind(nonce).fetch_optional(&s.db).await {
                    Ok(value)=>value,
                    Err(e)=>return db_error(e)
                };
                if local_checkout.is_none() {
                    let _=sqlx::query("UPDATE billing_events SET status='ignored',processed_at=now(),processing_started_at=NULL WHERE provider='lemonsqueezy' AND provider_event_id=$1").bind(&key).execute(&s.db).await;
                    return Json(json!({"received":true,"ignored":"checkout_transaction_not_found"})).into_response();
                }
            }
            if let Err(e)=sqlx::query("INSERT INTO billing_accounts(organization_id,provider,lemonsqueezy_customer_id,lemonsqueezy_subscription_id,lemonsqueezy_variant_id,lemonsqueezy_customer_portal_url,plan_key,status,current_period_end,cancel_at_period_end,updated_at) VALUES($1,'lemonsqueezy',$2,$3,$4,$5,$6,$7,$8,$9,now()) ON CONFLICT(organization_id) DO UPDATE SET provider='lemonsqueezy',lemonsqueezy_customer_id=COALESCE(EXCLUDED.lemonsqueezy_customer_id,billing_accounts.lemonsqueezy_customer_id),lemonsqueezy_subscription_id=EXCLUDED.lemonsqueezy_subscription_id,lemonsqueezy_variant_id=COALESCE(EXCLUDED.lemonsqueezy_variant_id,billing_accounts.lemonsqueezy_variant_id),lemonsqueezy_customer_portal_url=COALESCE(EXCLUDED.lemonsqueezy_customer_portal_url,billing_accounts.lemonsqueezy_customer_portal_url),plan_key=EXCLUDED.plan_key,status=EXCLUDED.status,current_period_end=COALESCE(EXCLUDED.current_period_end,billing_accounts.current_period_end),cancel_at_period_end=EXCLUDED.cancel_at_period_end,updated_at=now()")
                .bind(org).bind(customer_id).bind(&subscription_id).bind(&variant_id).bind(portal).bind(plan).bind(account_status).bind(period_end).bind(cancel_at_period_end).execute(&s.db).await{return db_error(e);}
            if matches!(effective_status,"active") {if let Err(e)=apply_entitlements(&s.db,org,plan).await{return db_error(e);}}
            else if let Err(e)=sqlx::query("UPDATE organization_entitlements SET billing_status=$1,billing_grace_until=CASE WHEN $1='past_due' THEN now()+interval '7 days' ELSE NULL END,updated_at=now() WHERE organization_id=$2").bind(effective_status).bind(org).execute(&s.db).await{return db_error(e);}
            if event_type=="subscription_created" {
                let order_id=attrs.get("order_id").and_then(Value::as_i64).map(|v|v.to_string());
                if let Err(e)=sqlx::query("UPDATE billing_transactions SET lemonsqueezy_subscription_id=$1,lemonsqueezy_order_id=$2,lemonsqueezy_variant_id=$3,payload=$4,updated_at=now() WHERE provider='lemonsqueezy' AND organization_id=$5 AND plan_key=$6 AND metadata->>'checkout_nonce'=$7 AND status='initialized'")
                    .bind(&subscription_id).bind(order_id).bind(&variant_id).bind(&event).bind(org).bind(plan).bind(custom.get("checkout_nonce").and_then(Value::as_str).unwrap_or("")).execute(&s.db).await{return db_error(e);}
            }
            if invoice_event {
                let next_status=match event_type {"subscription_payment_success"|"subscription_payment_recovered"=>"success","subscription_payment_failed"=>"failed","subscription_payment_refunded"=>"refunded",_=>"initialized"};
                if next_status!="initialized" {
                    if let Err(e)=sqlx::query("UPDATE billing_transactions SET status=$1,payload=$2,updated_at=now() WHERE provider='lemonsqueezy' AND organization_id=$3 AND lemonsqueezy_subscription_id=$4")
                        .bind(next_status).bind(&event).bind(org).bind(&subscription_id).execute(&s.db).await{return db_error(e);}
                }
            }
            let (title, details) = match event_type {
                "subscription_payment_success" | "subscription_payment_recovered" => ("Subscription payment received", "Your Lemon Squeezy subscription payment was received and your plan is active."),
                "subscription_payment_failed" => ("Subscription payment needs attention", "A Lemon Squeezy subscription payment failed. Review your payment method to avoid interruption."),
                "subscription_payment_refunded" => ("Subscription payment refunded", "A subscription payment was refunded. Review your billing page if you believe this is unexpected."),
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
    #[test] fn cancellation_preserves_access_until_paid_period_ends() {
        let now=chrono::DateTime::parse_from_rfc3339("2026-10-09T12:00:00Z").unwrap().with_timezone(&chrono::Utc);
        let future=Some(chrono::DateTime::parse_from_rfc3339("2026-10-20T12:00:00Z").unwrap().with_timezone(&chrono::Utc));
        assert_eq!(subscription_state("subscription_cancelled","cancelled",true,future,now),("active","non-renewing",true));
        assert_eq!(subscription_state("subscription_expired","expired",true,future,now),("canceled","canceled",false));
        assert_eq!(subscription_state("subscription_payment_failed","past_due",false,None,now),("past_due","attention",false));
        assert_eq!(subscription_state("subscription_payment_success","paid",false,None,now),("active","active",false));
        assert_eq!(subscription_state("subscription_payment_recovered","paid",false,None,now),("active","active",false));
        assert_eq!(subscription_state("subscription_payment_refunded","refunded",false,None,now),("past_due","attention",false));
        assert_eq!(subscription_state("subscription_updated","unknown",false,None,now),("unpaid","attention",false));
    }
    #[test] fn plan_mapping_rejects_duplicate_variants() {
        std::env::set_var("LEMONSQUEEZY_STARTER_VARIANT_ID","101");
        std::env::set_var("LEMONSQUEEZY_GROWTH_VARIANT_ID","202");
        std::env::set_var("LEMONSQUEEZY_SCALE_VARIANT_ID","303");
        assert_eq!(plan_for_variant("202"),Some("growth"));
        std::env::set_var("LEMONSQUEEZY_GROWTH_VARIANT_ID","101");
        assert_eq!(plan_for_variant("101"),None);
        std::env::remove_var("LEMONSQUEEZY_STARTER_VARIANT_ID");
        std::env::remove_var("LEMONSQUEEZY_GROWTH_VARIANT_ID");
        std::env::remove_var("LEMONSQUEEZY_SCALE_VARIANT_ID");
    }
}
