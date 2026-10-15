    if !response.status().is_success() { return Err("Flutterwave transaction verification failed".into()); }
    let body:Value=response.json().await.map_err(|e|e.to_string())?;
    let data=body.get("data").cloned().unwrap_or(Value::Null);
    let returned_id=data.get("id")
        .map(|v| v.as_str().map(str::to_owned).unwrap_or_else(||v.to_string()))
        .ok_or("Flutterwave did not return a transaction ID")?;
    if returned_id != transaction_id {
        return Err("Flutterwave transaction ID did not match".into());
    }
    let amount=data.get("amount").and_then(Value::as_f64).ok_or("No amount returned by Flutterwave")?;
    let expected=flutterwave_amount_usd(plan).ok_or("NGN plan amount is not configured")? as f64;
    if data.get("status").and_then(Value::as_str)!=Some("successful") || data.get("tx_ref").and_then(Value::as_str)!=Some(reference) || data.get("currency").and_then(Value::as_str)!=Some("USD") || (amount-expected).abs()>0.000001 { return Err("Payment status, reference, USD currency, or exact amount did not match".into()); }
    Ok(body)
}
pub(crate) async fn billing_verify(State(s): State<AppState>,headers: HeaderMap,Query(q): Query<std::collections::HashMap<String,String>>) -> Response {
    let ctx=match authenticate(&s,&headers).await {Ok(v)=>v,Err(c)=>return c.into_response()}; if let Err(c)=require_admin(&ctx,&headers){return c.into_response();}
    let reference=match q.get("reference").filter(|v|!v.trim().is_empty()){Some(v)=>v.trim(),None=>return bad("Flutterwave transaction reference is required.")};
    let transaction_id=match q.get("transaction_id").filter(|v|!v.trim().is_empty()){Some(v)=>v.trim(),None=>return bad("Flutterwave transaction ID is required.")};
    let row=match sqlx::query("SELECT organization_id,plan_key,plan_code FROM billing_transactions WHERE provider='flutterwave' AND reference=$1 AND organization_id=$2").bind(reference).bind(ctx.organization_id).fetch_optional(&s.db).await {Ok(Some(v))=>v,Ok(None)=>return (StatusCode::NOT_FOUND,Json(json!({"ok":false,"error":"unknown_local_transaction"}))).into_response(),Err(e)=>return db_error(e)};
    let plan:String=row.get("plan_key"); let plan_id:String=row.get::<Option<String>,_>("plan_code").unwrap_or_default(); let org:Uuid=row.get("organization_id");
    let verified=match verify_flutterwave_transaction(transaction_id,reference,&plan).await {Ok(v)=>v,Err(e)=>return (StatusCode::PAYMENT_REQUIRED,Json(json!({"ok":false,"verified":false,"message":e}))).into_response()};
    if let Err(e)=sqlx::query("UPDATE billing_transactions SET status='success',provider_checkout_id=$1,payload=$2,updated_at=now() WHERE provider='flutterwave' AND reference=$3 AND organization_id=$4").bind(transaction_id).bind(&verified).bind(reference).bind(org).execute(&s.db).await{return db_error(e);}
    if let Err(e)=sqlx::query("INSERT INTO billing_accounts(organization_id,provider,flutterwave_customer_id,flutterwave_plan_id,plan_key,status,cancel_at_period_end,updated_at) VALUES($1,'flutterwave',$2,$3,$4,'active',false,now()) ON CONFLICT(organization_id) DO UPDATE SET provider='flutterwave',flutterwave_customer_id=COALESCE(EXCLUDED.flutterwave_customer_id,billing_accounts.flutterwave_customer_id),flutterwave_plan_id=EXCLUDED.flutterwave_plan_id,plan_key=EXCLUDED.plan_key,status='active',cancel_at_period_end=false,updated_at=now()").bind(org).bind(verified.pointer("/data/customer/id").map(|v| v.to_string().trim_matches('"').to_owned())).bind(plan_id).bind(&plan).execute(&s.db).await{return db_error(e);}
    if let Err(e)=apply_entitlements(&s.db,org,&plan).await{ tracing::error!(error=%e,"Payment verified but entitlement update failed"); return internal("Payment verified but entitlement update failed."); }
    Json(json!({"ok":true,"provider":"flutterwave","reference":reference,"status":"success","plan":plan,"verified":true})).into_response()
}
pub(crate) async fn portal(State(s):State<AppState>,headers:HeaderMap)->Response { let ctx=match authenticate(&s,&headers).await{Ok(v)=>v,Err(c)=>return c.into_response()}; if let Err(c)=require_admin(&ctx,&headers){return c.into_response();} (StatusCode::NOT_IMPLEMENTED,Json(json!({"ok":false,"provider":"flutterwave","error":"subscription_portal_unavailable","message":"Contact Agata Proxima support to manage or cancel this subscription."}))).into_response() }
pub(crate) async fn flutterwave_webhook(State(s):State<AppState>,headers:HeaderMap,body:String)->Response {
    if !verify_flutterwave_hash(&headers){return StatusCode::UNAUTHORIZED.into_response();} let event:Value=match serde_json::from_str(&body){Ok(v)=>v,Err(_)=>return StatusCode::BAD_REQUEST.into_response()}; let data=event.get("data").cloned().unwrap_or(Value::Null);
    let txid=data.get("id").and_then(Value::as_i64).map(|v|v.to_string()).or_else(||data.get("id").and_then(Value::as_str).map(str::to_owned)).unwrap_or_default(); let reference=data.get("tx_ref").and_then(Value::as_str).unwrap_or_default(); if txid.is_empty()||reference.is_empty(){return StatusCode::BAD_REQUEST.into_response();}
    let event_id=event.get("id").and_then(Value::as_str).map(str::to_owned).unwrap_or_else(||format!("{txid}:{reference}")); let event_type=event.get("event").and_then(Value::as_str).unwrap_or("charge.completed");
    let claimed=match sqlx::query("INSERT INTO billing_events(provider,provider_event_id,event_type,payload,status,processing_started_at,attempt_count) VALUES('flutterwave',$1,$2,$3,'processing',now(),1) ON CONFLICT(provider,provider_event_id) DO UPDATE SET status='processing',processing_started_at=now(),attempt_count=billing_events.attempt_count+1,payload=EXCLUDED.payload,event_type=EXCLUDED.event_type WHERE billing_events.status NOT IN ('processed','ignored') AND (billing_events.processing_started_at IS NULL OR billing_events.processing_started_at<now()-interval '1 minute') RETURNING id").bind(&event_id).bind(event_type).bind(&event).fetch_optional(&s.db).await{Ok(v)=>v.is_some(),Err(e)=>return db_error(e)}; if !claimed{return Json(json!({"received":true,"duplicate":true})).into_response();}
    let row=match sqlx::query("SELECT organization_id,plan_key,plan_code FROM billing_transactions WHERE provider='flutterwave' AND reference=$1").bind(reference).fetch_optional(&s.db).await {
      Ok(Some(v))=>v,
      Ok(None) => {
            let _ = sqlx::query(
                "UPDATE billing_events SET status='ignored',processed_at=now(),processing_started_at=NULL WHERE provider='flutterwave' AND provider_event_id=$1"
            )
            .bind(&event_id)
            .execute(&s.db)
            .await;

            return Json(json!({
                "received": true,
                "ignored": "unknown_reference"
            })).into_response();
        },
        Err(e) => return db_error(e)
    };
    let org:Uuid=row.get("organization_id");let plan:String=row.get("plan_key");let plan_id:String=row.get::<Option<String>,_>("plan_code").unwrap_or_default(); let verified=match verify_flutterwave_transaction(&txid,reference,&plan).await{Ok(v)=>v,Err(_)=>return StatusCode::PAYMENT_REQUIRED.into_response()};
    if let Err(e)=sqlx::query("INSERT INTO billing_transactions(organization_id,provider,reference,provider_checkout_id,plan_key,plan_code,amount,currency,status,metadata,payload,created_at,updated_at) VALUES($4,'flutterwave',$3,$1,$5,$6,$7,'USD','success',$8,$2,now(),now()) ON CONFLICT(provider,reference) DO UPDATE SET status='success',provider_checkout_id=EXCLUDED.provider_checkout_id,payload=EXCLUDED.payload,updated_at=now()").bind(&txid).bind(&verified).bind(reference).bind(org).bind(&plan).bind(&plan_id).bind({
        match flutterwave_amount_usd(&plan) {
            Some(amount) => amount,
            None => return service_unavailable("Flutterwave USD amount is missing."),
        }
    }).bind(&event).execute(&s.db).await{return db_error(e);}
    if let Err(e)=sqlx::query("INSERT INTO billing_accounts(organization_id,provider,flutterwave_customer_id,flutterwave_plan_id,plan_key,status,cancel_at_period_end,updated_at) VALUES($1,'flutterwave',$2,$3,$4,'active',false,now()) ON CONFLICT(organization_id) DO UPDATE SET provider='flutterwave',flutterwave_customer_id=COALESCE(EXCLUDED.flutterwave_customer_id,billing_accounts.flutterwave_customer_id),flutterwave_plan_id=EXCLUDED.flutterwave_plan_id,plan_key=EXCLUDED.plan_key,status='active',cancel_at_period_end=false,updated_at=now()").bind(org).bind(verified.pointer("/data/customer/id").map(|v| v.to_string().trim_matches('"').to_owned())).bind(plan_id).bind(&plan).execute(&s.db).await{return db_error(e);}
    if let Err(e)=apply_entitlements(&s.db,org,&plan).await{ tracing::error!(error=%e,"Payment verified but entitlement update failed"); return internal("Payment verified but entitlement update failed."); }
    if let Err(e)=sqlx::query("UPDATE billing_events SET status='processed',processed_at=now(),processing_started_at=NULL WHERE provider='flutterwave' AND provider_event_id=$1").bind(&event_id).execute(&s.db).await{return db_error(e);}
    let details = format!("Your {plan} plan payment was verified and the workspace entitlements were updated.");
    send_billing_notice(&s.db, org, &event_id, "Flutterwave payment confirmed", &details).await;
    Json(json!({"received":true,"verified":true})).into_response()
}

pub(crate) async fn send_verification_email(
    db: &sqlx::PgPool,
    user_id: Uuid,
    email: &str,
    display_name: &str,
) -> anyhow::Result<()> {
    let bytes = *Uuid::new_v4().as_bytes();
    let value = u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) % 1_000_000;
    let code = format!("{value:06}");

    sqlx::query(
        "UPDATE users SET email_verification_token_hash=$1,
         email_verification_expires_at=now()+interval '15 minutes',
         email_verification_attempts=0 WHERE id=$2",
    )
    .bind(token_hash(&code))
    .bind(user_id)
    .execute(db)
    .await?;
