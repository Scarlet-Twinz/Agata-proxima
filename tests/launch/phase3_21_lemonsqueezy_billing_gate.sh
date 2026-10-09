#!/usr/bin/env bash
set -euo pipefail

main="crates/proxima-control-plane/src/main.rs"
billing="crates/proxima-control-plane/src/billing_lemonsqueezy.rs"
production="crates/proxima-control-plane/src/production.rs"
migration="crates/proxima-control-plane/migrations/0017_lemonsqueezy_billing.sql"
env_example=".env.example"
control_env="crates/proxima-control-plane/.env.example"

test -f "$billing"
test -f "$migration"
grep -q '0017_lemonsqueezy_billing.sql' "$main"
grep -q '"/api/v1/webhooks/lemonsqueezy"' "$main"
grep -q '"/api/v1/billing/checkout"' "$main"
grep -q 'billing_lemonsqueezy::billing_status' "$main"
grep -q 'x-signature' "$billing"
grep -q 'HmacSha256' "$billing"
grep -q 'signature_valid' "$billing"
grep -q 'ON CONFLICT(provider,provider_event_id)' "$billing"
grep -q 'subscription_payment_failed' "$billing"
grep -q 'subscription_cancelled' "$billing"
grep -q 'apply_entitlements' "$billing"
grep -q 'LEMONSQUEEZY_WEBHOOK_SECRET' "$billing"
grep -q 'LEMONSQUEEZY_STARTER_VARIANT_ID' "$billing"
grep -q 'LEMONSQUEEZY_GROWTH_VARIANT_ID' "$billing"
grep -q 'LEMONSQUEEZY_SCALE_VARIANT_ID' "$billing"
grep -q 'lemonsqueezy_subscription_id' "$migration"
grep -q 'provider SET DEFAULT' "$migration"

for file in "$env_example" "$control_env"; do
  grep -q '^LEMONSQUEEZY_API_KEY=' "$file"
  grep -q '^LEMONSQUEEZY_STORE_ID=' "$file"
  grep -q '^LEMONSQUEEZY_STARTER_VARIANT_ID=' "$file"
  grep -q '^LEMONSQUEEZY_GROWTH_VARIANT_ID=' "$file"
  grep -q '^LEMONSQUEEZY_SCALE_VARIANT_ID=' "$file"
  grep -q '^LEMONSQUEEZY_WEBHOOK_SECRET=' "$file"
done

! grep -q 'webhooks/paystack' "$main"
! grep -q 'PAYSTACK_SECRET_KEY' "$env_example"
! grep -q 'AGATA_PAYSTACK_' "$env_example"
! grep -q 'STRIPE_' "$env_example"

echo "PASS: Phase 3.21 Lemon Squeezy billing contract"
