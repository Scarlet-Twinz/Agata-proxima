#!/usr/bin/env bash
set -euo pipefail

main="crates/proxima-control-plane/src/main.rs"
provider="crates/proxima-control-plane/src/production/lemonsqueezy.rs"
production="crates/proxima-control-plane/src/production.rs"
migration="crates/proxima-control-plane/migrations/0017_lemonsqueezy_billing.sql"

test -f "$provider"
test -f "$migration"
grep -q 'production::lemonsqueezy::checkout' "$main"
grep -q 'production::lemonsqueezy::webhook' "$main"
grep -q '"/api/v1/webhooks/lemonsqueezy"' "$main"
! grep -q '"/api/v1/webhooks/paystack"' "$main"
! grep -q '"/api/v1/billing/paystack/callback"' "$main"
grep -q 'LEMONSQUEEZY_API_KEY' "$provider"
grep -q 'LEMONSQUEEZY_WEBHOOK_SECRET' "$provider"
grep -q 'x-signature' "$provider"
grep -q 'verify_slice' "$provider"
grep -q 'billing_events' "$provider"
grep -q "provider='lemonsqueezy'" "$provider"
grep -q 'lemonsqueezy_subscription_id' "$migration"
grep -q 'LEMONSQUEEZY_STARTER_VARIANT_ID' .env.example
grep -q 'LEMONSQUEEZY_GROWTH_VARIANT_ID' .env.example
grep -q 'LEMONSQUEEZY_SCALE_VARIANT_ID' .env.example
grep -q 'LEMONSQUEEZY_STORE_ID' .env.example
grep -q 'LEMONSQUEEZY_API_KEY' crates/proxima-control-plane/.env.example
grep -q 'LEMONSQUEEZY_WEBHOOK_SECRET' crates/proxima-control-plane/.env.example
grep -q 'lemonsqueezy_credentials' "$production"

echo "PASS: Phase 3.21 Lemon Squeezy billing contract"
