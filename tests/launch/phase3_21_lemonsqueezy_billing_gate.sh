#!/usr/bin/env bash
set -euo pipefail

production="crates/proxima-control-plane/src/production.rs"
main="crates/proxima-control-plane/src/main.rs"
root_env=".env.example"
control_env="crates/proxima-control-plane/.env.example"
migration="crates/proxima-control-plane/migrations/0017_lemonsqueezy_billing.sql"

test -f "$migration"
grep -q '0017_lemonsqueezy_billing.sql' "$main"
grep -q 'LEMON_SQUEEZY_API_KEY' "$root_env"
grep -q 'LEMON_SQUEEZY_STORE_ID' "$root_env"
grep -q 'LEMON_SQUEEZY_STARTER_VARIANT_ID' "$root_env"
grep -q 'LEMON_SQUEEZY_GROWTH_VARIANT_ID' "$root_env"
grep -q 'LEMON_SQUEEZY_SCALE_VARIANT_ID' "$root_env"
grep -q 'LEMON_SQUEEZY_WEBHOOK_SECRET' "$root_env"
grep -q 'LEMON_SQUEEZY_TEST_MODE=true' "$root_env"
grep -q 'LEMON_SQUEEZY_API_KEY' "$control_env"
grep -q 'LEMON_SQUEEZY_WEBHOOK_SECRET' "$control_env"
! grep -q 'PAYSTACK_' "$root_env"
! grep -q 'PAYSTACK_' "$control_env"
! grep -q 'STRIPE_' "$root_env"
! grep -q 'STRIPE_' "$control_env"
grep -q 'https://api.lemonsqueezy.com/v1/checkouts' "$production"
grep -q 'https://api.lemonsqueezy.com/v1/variants/' "$production"
grep -q 'x-signature' "$production"
grep -q 'verify_lemonsqueezy_signature' "$production"
grep -q 'provider=.lemonsqueezy.' "$production"
grep -q 'lemonsqueezy_customer_portal_url' "$production"
grep -q 'checkout_reference' "$production"
grep -q 'subscription_id").and_then(Value::as_i64)' "$production"
grep -q 'billing/lemonsqueezy/callback?reference=' "$production"
grep -q 'subscription_payment_failed' "$production"
grep -q 'Some(14_900)' "$production"
grep -q 'Some(49_900)' "$production"
grep -q 'Some(119_900)' "$production"
! grep -qi 'paystack' "$production"
! grep -qi 'paystack' control-plane/openapi.json
! grep -qi 'paystack' docs/developer-guide.md
! grep -qi 'paystack' docs/production/deployment-architecture.md
! grep -qi 'paystack' docs/production/operational-readiness-runbook.md
! grep -qi 'paystack' README.md
test -f docs/production/phase3-21-lemonsqueezy-billing.md
grep -Fq '/api/v1/billing/checkout' frontend/src/pages/console/NestedResource.tsx
grep -Fq '/api/v1/billing/verify?reference=' frontend/src/pages/console/NestedResource.tsx
grep -Fq 'billing-plan-grid' frontend/src/styles/console.css
! grep -Fqi 'paystack' frontend/src/pages/console/NestedResource.tsx

echo "PASS: Phase 3.21 Lemon Squeezy billing contract"
