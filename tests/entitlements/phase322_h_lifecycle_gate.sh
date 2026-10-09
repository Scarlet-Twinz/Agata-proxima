#!/usr/bin/env bash
set -euo pipefail

fail() { echo "FAIL: $1" >&2; exit 1; }
pass() { echo "PASS: $1"; }

root="crates/proxima-control-plane/migrations"
test_db="proxima_lifecycle_regression_test"
: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=proxima}"
: "${PGPASSWORD:=proxima-dev-only}"
export PGHOST PGPORT PGUSER PGPASSWORD

psql -v ON_ERROR_STOP=1 -d postgres -c "DROP DATABASE IF EXISTS ${test_db}" >/dev/null
psql -v ON_ERROR_STOP=1 -d postgres -c "CREATE DATABASE ${test_db}" >/dev/null
for migration in "${root}"/*.sql; do
  psql -v ON_ERROR_STOP=1 -d "${test_db}" -f "${migration}" >/dev/null
done

org_a="a6000000-0000-4000-8000-000000000001"
org_b="a6000000-0000-4000-8000-000000000002"
org_c="a6000000-0000-4000-8000-000000000003"
org_d="a6000000-0000-4000-8000-000000000004"
user_a="b6000000-0000-4000-8000-000000000001"
user_b="b6000000-0000-4000-8000-000000000002"
project_a="c6000000-0000-4000-8000-000000000001"
project_b="c6000000-0000-4000-8000-000000000002"

psql -v ON_ERROR_STOP=1 -d "${test_db}" <<SQL
INSERT INTO users(id,email,display_name,password_hash) VALUES
 ('${user_a}','owner-a@example.test','Owner A','test-hash'),
 ('${user_b}','owner-b@example.test','Owner B','test-hash');
INSERT INTO organizations(id,name,slug) VALUES
 ('${org_a}','Downgrade A','downgrade-a'),
 ('${org_b}','Lifecycle B','lifecycle-b'),
 ('${org_c}','Lifecycle C','lifecycle-c'),
 ('${org_d}','Lifecycle D','lifecycle-d');
INSERT INTO projects(id,organization_id,name,slug) VALUES
 ('${project_a}','${org_a}','Production','production'),
 ('${project_b}','${org_a}','Staging','staging');
UPDATE organization_entitlements
   SET plan_key='scale',billing_status='active',node_limit=15,tenant_limit=500,
       environment_limit=50,integration_limit=100,verification_limit_monthly=100000,
       team_seat_limit=50,api_key_limit=100,api_requests_per_minute=5000,audit_retention_days=365
 WHERE organization_id='${org_a}';
INSERT INTO memberships(user_id,organization_id,role) VALUES
 ('${user_a}','${org_a}','owner'),
 ('${user_b}','${org_a}','operator');
INSERT INTO nodes(id,organization_id,name,environment,region) VALUES
 ('d6000000-0000-4000-8000-000000000001','${org_a}','node-prod','production','auto'),
 ('d6000000-0000-4000-8000-000000000002','${org_a}','node-stage','staging','auto');
INSERT INTO tenants(id,project_id,name,slug) VALUES
 ('e6000000-0000-4000-8000-000000000001','${project_a}','tenant-1','tenant-1'),
 ('e6000000-0000-4000-8000-000000000002','${project_a}','tenant-2','tenant-2'),
 ('e6000000-0000-4000-8000-000000000003','${project_a}','tenant-3','tenant-3'),
 ('e6000000-0000-4000-8000-000000000004','${project_a}','tenant-4','tenant-4');
INSERT INTO webhooks(id,organization_id,name,endpoint_url,signing_secret_hash,signing_secret_hint,events,enabled) VALUES
 ('f6000000-0000-4000-8000-000000000001','${org_a}','hook-1','https://example.test/1',decode(repeat('1',64),'hex'),'hint-1','[]'::jsonb,true),
 ('f6000000-0000-4000-8000-000000000002','${org_a}','hook-2','https://example.test/2',decode(repeat('2',64),'hex'),'hint-2','[]'::jsonb,true);
INSERT INTO api_keys(id,organization_id,created_by,name,key_prefix,key_hash) VALUES
 ('96000000-0000-4000-8000-000000000001','${org_a}','${user_a}','key-1','aga_h1',decode(repeat('3',64),'hex')),
 ('96000000-0000-4000-8000-000000000002','${org_a}','${user_a}','key-2','aga_h2',decode(repeat('4',64),'hex'));
INSERT INTO organization_invites(id,organization_id,invited_by,email,role,token_hash,expires_at) VALUES
 ('97000000-0000-4000-8000-000000000001','${org_a}','${user_a}','pending@example.test','viewer',decode(repeat('5',64),'hex'),now()+interval '7 days');

INSERT INTO billing_accounts(organization_id,plan_key,status,current_period_end,cancel_at_period_end)
VALUES
 ('${org_b}','growth','attention',now()+interval '20 days',false),
 ('${org_c}','growth','non-renewing',now()-interval '1 day',true),
 ('${org_d}','growth','attention',now()+interval '20 days',false);
UPDATE organization_entitlements SET billing_status='past_due',billing_grace_until=now()-interval '1 minute' WHERE organization_id='${org_b}';
UPDATE organization_entitlements SET billing_status='active',billing_grace_until=NULL WHERE organization_id='${org_c}';
UPDATE organization_entitlements SET billing_status='past_due',billing_grace_until=now()+interval '2 days' WHERE organization_id='${org_d}';
SQL

# Downgrade to Free without deleting or revoking any existing resource.
psql -v ON_ERROR_STOP=1 -d "${test_db}" <<'SQL'
UPDATE organization_entitlements
   SET plan_key='free',billing_status='active',billing_grace_until=NULL,
       node_limit=1,tenant_limit=3,environment_limit=1,integration_limit=1,
       verification_limit_monthly=100,team_seat_limit=1,api_key_limit=1,
       api_requests_per_minute=60,audit_retention_days=7
 WHERE organization_id='a6000000-0000-4000-8000-000000000001';
UPDATE nodes SET environment='production'
 WHERE id='d6000000-0000-4000-8000-000000000002';
UPDATE tenants SET project_id='c6000000-0000-4000-8000-000000000002'
 WHERE id='e6000000-0000-4000-8000-000000000004';
UPDATE webhooks SET enabled=false
 WHERE id='f6000000-0000-4000-8000-000000000002';
UPDATE api_keys SET revoked_at=now()
 WHERE id='96000000-0000-4000-8000-000000000002';
SQL

counts=$(psql -v ON_ERROR_STOP=1 -d "${test_db}" -Atc "SELECT (SELECT count(*) FROM nodes WHERE organization_id='${org_a}')||':'||(SELECT count(*) FROM tenants t JOIN projects p ON p.id=t.project_id WHERE p.organization_id='${org_a}')||':'||(SELECT count(*) FROM webhooks WHERE organization_id='${org_a}')||':'||(SELECT count(*) FROM api_keys WHERE organization_id='${org_a}')||':'||(SELECT count(*) FROM memberships WHERE organization_id='${org_a}')")
[[ "$counts" == "2:4:2:2:2" ]] || fail "downgrade deleted resources or memberships; observed counts ${counts}"
pass "downgrade preserves existing resources and memberships while remediation edits remain possible"

# New capacity must be blocked after downgrade.
psql -v ON_ERROR_STOP=1 -d "${test_db}" <<'SQL'
DO $$
DECLARE message_text text;
BEGIN
  BEGIN
    INSERT INTO nodes(id,organization_id,name,environment,region)
    VALUES ('d6000000-0000-4000-8000-000000000003',
            'a6000000-0000-4000-8000-000000000001','node-over-limit','production','auto');
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS message_text = MESSAGE_TEXT;
  END;
  IF message_text IS NULL OR message_text NOT LIKE 'AGATA_PLAN_LIMIT: nodes%' THEN
    RAISE EXCEPTION 'Downgraded node creation was not blocked: %', message_text;
  END IF;
END $$;
DO $$
DECLARE message_text text;
BEGIN
  BEGIN
    INSERT INTO tenants(id,project_id,name,slug)
    VALUES ('e6000000-0000-4000-8000-000000000005',
            'c6000000-0000-4000-8000-000000000001','tenant-5','tenant-5');
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS message_text = MESSAGE_TEXT;
  END;
  IF message_text IS NULL OR message_text NOT LIKE 'AGATA_PLAN_LIMIT: tenants%' THEN
    RAISE EXCEPTION 'Downgraded tenant creation was not blocked: %', message_text;
  END IF;
END $$;
DO $$
DECLARE message_text text;
BEGIN
  BEGIN
    INSERT INTO webhooks(id,organization_id,name,endpoint_url,signing_secret_hash,signing_secret_hint,events,enabled)
    VALUES ('f6000000-0000-4000-8000-000000000003',
            'a6000000-0000-4000-8000-000000000001','hook-3','https://example.test/3',
            decode(repeat('6',64),'hex'),'hint-3','[]'::jsonb,true);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS message_text = MESSAGE_TEXT;
  END;
  IF message_text IS NULL OR message_text NOT LIKE 'AGATA_PLAN_LIMIT: integrations%' THEN
    RAISE EXCEPTION 'Downgraded integration creation was not blocked: %', message_text;
  END IF;
END $$;
DO $$
DECLARE message_text text;
BEGIN
  BEGIN
    INSERT INTO api_keys(id,organization_id,created_by,name,key_prefix,key_hash)
    VALUES ('96000000-0000-4000-8000-000000000003',
            'a6000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001',
            'key-3','aga_h3',decode(repeat('7',64),'hex'));
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS message_text = MESSAGE_TEXT;
  END;
  IF message_text IS NULL OR message_text NOT LIKE 'AGATA_PLAN_LIMIT: api_keys%' THEN
    RAISE EXCEPTION 'Downgraded API-key creation was not blocked: %', message_text;
  END IF;
END $$;
DO $$
DECLARE message_text text;
BEGIN
  BEGIN
    INSERT INTO organization_invites(id,organization_id,invited_by,email,role,token_hash,expires_at)
    VALUES ('97000000-0000-4000-8000-000000000002',
            'a6000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001',
            'another-pending@example.test','viewer',decode(repeat('8',64),'hex'),now()+interval '7 days');
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS message_text = MESSAGE_TEXT;
  END;
  IF message_text IS NULL OR message_text NOT LIKE 'AGATA_PLAN_LIMIT: team_seats%' THEN
    RAISE EXCEPTION 'Downgraded invitation creation was not blocked: %', message_text;
  END IF;
END $$;
SQL
pass "downgrade blocks new over-limit resources while allowing disable/revoke/remediation"

# Past-due grace and non-renewing period end are reconciled without immediate disruption.
psql -v ON_ERROR_STOP=1 -d "${test_db}" -c "SELECT proxima_reconcile_billing_lifecycle()" >/dev/null
status_b=$(psql -v ON_ERROR_STOP=1 -d "${test_db}" -Atc "SELECT e.billing_status||':'||b.status FROM organization_entitlements e JOIN billing_accounts b USING(organization_id) WHERE e.organization_id='${org_b}'")
status_c=$(psql -v ON_ERROR_STOP=1 -d "${test_db}" -Atc "SELECT e.billing_status||':'||b.status FROM organization_entitlements e JOIN billing_accounts b USING(organization_id) WHERE e.organization_id='${org_c}'")
status_d=$(psql -v ON_ERROR_STOP=1 -d "${test_db}" -Atc "SELECT e.billing_status||':'||b.status FROM organization_entitlements e JOIN billing_accounts b USING(organization_id) WHERE e.organization_id='${org_d}'")
[[ "$status_b" == "unpaid:unpaid" ]] || fail "expired payment grace was not reconciled: ${status_b}"
[[ "$status_c" == "canceled:canceled" ]] || fail "expired non-renewing subscription was not canceled: ${status_c}"
[[ "$status_d" == "past_due:attention" ]] || fail "active grace period was prematurely expired: ${status_d}"
pass "payment-failure grace and non-renewing period end are reconciled correctly"

# Event claiming: processed events are terminal, active claims are not stolen,
# and stale processing claims can be retried after five minutes.
psql -v ON_ERROR_STOP=1 -d "${test_db}" <<'SQL'
INSERT INTO billing_events(provider,provider_event_id,event_type,payload,status,attempt_count)
VALUES ('paystack','charge.success:42','charge.success','{}'::jsonb,'processed',1),
       ('paystack','invoice.payment_failed:43','invoice.payment_failed','{}'::jsonb,'processing',1),
       ('paystack','subscription.enable:44','subscription.enable','{}'::jsonb,'processing',1);
UPDATE billing_events SET processing_started_at=now()
 WHERE provider_event_id='invoice.payment_failed:43';
UPDATE billing_events SET processing_started_at=now()-interval '6 minutes'
 WHERE provider_event_id='subscription.enable:44';
INSERT INTO billing_events(provider,provider_event_id,event_type,payload,status)
VALUES ('paystack','subscription.enable:42','subscription.enable','{}'::jsonb,'processed');
SQL
processed_claim=$(psql -v ON_ERROR_STOP=1 -d "${test_db}" -Atqc "INSERT INTO billing_events(provider,provider_event_id,event_type,payload,status,processing_started_at,attempt_count) VALUES('paystack','charge.success:42','charge.success','{}'::jsonb,'processing',now(),1) ON CONFLICT(provider,provider_event_id) DO UPDATE SET status='processing',processing_started_at=now(),attempt_count=billing_events.attempt_count+1,payload=EXCLUDED.payload,event_type=EXCLUDED.event_type WHERE billing_events.status NOT IN ('processed','ignored') AND (billing_events.processing_started_at IS NULL OR billing_events.processing_started_at < now()-interval '5 minutes') RETURNING id")
active_claim=$(psql -v ON_ERROR_STOP=1 -d "${test_db}" -Atqc "INSERT INTO billing_events(provider,provider_event_id,event_type,payload,status,processing_started_at,attempt_count) VALUES('paystack','invoice.payment_failed:43','invoice.payment_failed','{}'::jsonb,'processing',now(),1) ON CONFLICT(provider,provider_event_id) DO UPDATE SET status='processing',processing_started_at=now(),attempt_count=billing_events.attempt_count+1,payload=EXCLUDED.payload,event_type=EXCLUDED.event_type WHERE billing_events.status NOT IN ('processed','ignored') AND (billing_events.processing_started_at IS NULL OR billing_events.processing_started_at < now()-interval '5 minutes') RETURNING id")
stale_claim=$(psql -v ON_ERROR_STOP=1 -d "${test_db}" -Atqc "INSERT INTO billing_events(provider,provider_event_id,event_type,payload,status,processing_started_at,attempt_count) VALUES('paystack','subscription.enable:44','subscription.enable','{}'::jsonb,'processing',now(),1) ON CONFLICT(provider,provider_event_id) DO UPDATE SET status='processing',processing_started_at=now(),attempt_count=billing_events.attempt_count+1,payload=EXCLUDED.payload,event_type=EXCLUDED.event_type WHERE billing_events.status NOT IN ('processed','ignored') AND (billing_events.processing_started_at IS NULL OR billing_events.processing_started_at < now()-interval '5 minutes') RETURNING id")
[[ -z "$processed_claim" ]] || fail "processed webhook event was claimed again"
[[ -z "$active_claim" ]] || fail "recent in-progress webhook event was claimed concurrently"
[[ -n "$stale_claim" ]] || fail "stale webhook event was not eligible for retry"
type_count=$(psql -v ON_ERROR_STOP=1 -d "${test_db}" -Atc "SELECT count(*) FROM billing_events WHERE provider='paystack' AND provider_event_id IN ('charge.success:42','subscription.enable:42')")
[[ "$type_count" == "2" ]] || fail "different event types with the same provider object ID collided"
pass "webhook idempotency, in-progress claims, and stale retry behavior are enforced"

grep -Fq 'transaction_plan_mismatch' crates/proxima-control-plane/src/production.rs || fail "verified transaction plan mismatch is not rejected"
grep -Fq 'transaction_amount_mismatch' crates/proxima-control-plane/src/production.rs || fail "verified transaction amount mismatch is not rejected"
grep -Fq 'transaction_currency_mismatch' crates/proxima-control-plane/src/production.rs || fail "verified transaction currency mismatch is not rejected"
grep -Fq 'webhook_plan_amount_or_currency_mismatch' crates/proxima-control-plane/src/production.rs || fail "webhook plan amount/currency mismatch is not rejected"
grep -Fq 'webhook_plan_code_mismatch' crates/proxima-control-plane/src/production.rs || fail "webhook plan code mismatch is not rejected"
grep -Fq 'expected_paystack_amount_usd' crates/proxima-control-plane/src/production.rs || fail "canonical USD plan amounts are not enforced"
grep -Fq 'paystack_provider_plan_matches_catalog' crates/proxima-control-plane/src/production.rs || fail "Paystack provider plan is not checked before checkout"
grep -Fq 'paystack_plan_configuration_mismatch' crates/proxima-control-plane/src/production.rs || fail "checkout does not fail closed on provider plan mismatch"
grep -Fq 'paystack_success_payload_must_match_usd_amount_and_plan' crates/proxima-control-plane/src/production.rs || fail "USD amount/currency regression tests are missing"
grep -Fq 'paystack_provider_plan_must_match_catalog_before_checkout' crates/proxima-control-plane/src/production.rs || fail "provider plan configuration regression tests are missing"
grep -Fq 'configured_paystack_plan_codes_unique' crates/proxima-control-plane/src/production.rs || fail "missing or duplicate Paystack plan codes are not rejected"
grep -Fq 'paystack_plan_codes_must_be_present_and_unique' crates/proxima-control-plane/src/production.rs || fail "plan-code uniqueness regression tests are missing"
grep -Fq 'unknown_local_transaction' crates/proxima-control-plane/src/production.rs || fail "verification does not require a server-stored transaction"
grep -Fq 'billing_grace_until=COALESCE(billing_grace_until,now()+interval' crates/proxima-control-plane/src/production.rs || fail "payment failure does not establish a fixed grace window"
grep -Fq 'mark_paystack_event_ignored' crates/proxima-control-plane/src/production.rs || fail "unknown webhook states are not handled safely"
grep -Fq 'include_str!("' crates/proxima-control-plane/src/main.rs || fail "startup migration wiring missing"
grep -Fq '0015_billing_lifecycle_downgrade.sql' crates/proxima-control-plane/src/main.rs || fail "lifecycle migration is not applied on startup"
grep -Fq 'production::reconcile_billing_lifecycle' crates/proxima-control-plane/src/main.rs || fail "billing lifecycle reconciler is not scheduled"

echo "PASS: Phase 3.22-H lifecycle and adversarial regression checks"
