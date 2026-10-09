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
grep -q 'store_or_mode_mismatch' "$provider"
grep -q 'checkout_plan_variant_mismatch' "$provider"
grep -q 'validate_store_and_variant' "$provider"
grep -q 'products/{product_id}' "$provider"
grep -q 'checkout_nonce' "$provider"
grep -q 'variants_configured' "$provider"
grep -q 'test_mode_configured' "$provider"
grep -q '"integrations":integrations' "$provider"
grep -q '"verifications_per_month":verifications' "$provider"
grep -q '"team_seats":team_seats' "$provider"
grep -q '"api_keys":api_keys' "$provider"
grep -q '"api_requests_per_minute":api_requests' "$provider"
grep -q 'subscription_payment_recovered' "$provider"
grep -q 'subscription_payment_refunded' "$provider"
grep -q 'billing_events' "$provider"
grep -q "provider='lemonsqueezy'" "$provider"
grep -q 'lemonsqueezy_subscription_id' "$migration"
grep -q 'LEMONSQUEEZY_STARTER_VARIANT_ID' .env.example
grep -q 'LEMONSQUEEZY_GROWTH_VARIANT_ID' .env.example
grep -q 'LEMONSQUEEZY_SCALE_VARIANT_ID' .env.example
grep -q 'LEMONSQUEEZY_STORE_ID' .env.example
grep -q 'LEMONSQUEEZY_API_KEY' crates/proxima-control-plane/.env.example
grep -q 'LEMONSQUEEZY_WEBHOOK_SECRET' crates/proxima-control-plane/.env.example
! grep -Eqi 'PAYSTACK_|PAYSTACK_SECRET_KEY|STRIPE_' .env.example crates/proxima-control-plane/.env.example control-plane/openapi.json
! grep -Eqi 'paystack|stripe' crates/proxima-control-plane/src/production.rs
grep -q 'lemonsqueezy_credentials' "$production"

echo "PASS: Phase 3.21 Lemon Squeezy billing contract"
