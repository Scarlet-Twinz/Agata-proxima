#!/usr/bin/env bash
set -euo pipefail

root_env=".env.example"
control_env="crates/proxima-control-plane/.env.example"
main="crates/proxima-control-plane/src/main.rs"
production="crates/proxima-control-plane/src/production.rs"
migration="crates/proxima-control-plane/migrations/0020_paddle_billing.sql"
ui="frontend/src/pages/console/NestedResource.tsx"

for key in PADDLE_API_KEY PADDLE_CLIENT_TOKEN PADDLE_WEBHOOK_SECRET PADDLE_STARTER_PRICE_ID PADDLE_GROWTH_PRICE_ID PADDLE_SCALE_PRICE_ID PADDLE_ENVIRONMENT; do
  grep -q "$key" "$root_env"
  grep -q "$key" "$control_env"
done

grep -q 'https://api.paddle.com' "$production"
! grep -q 'https://sandbox-api.paddle.com' "$production"
grep -q 'prices/{price_id}' "$production"
grep -q '/transactions' "$production"
grep -q 'enable_checkout' "$production"
grep -q 'verify_paddle_signature' "$production"
grep -q 'Paddle-Signature' "$production"
grep -q 'abs_diff(chrono::Utc::now().timestamp()) > 5' "$production"
grep -q "provider='paddle'" "$production"
grep -q 'portal-sessions' "$production"
grep -q 'paddle_webhook' "$main"
grep -q '/api/v1/webhooks/paddle' "$main"
grep -q 'paddle_price_id' "$migration"
grep -q "provider SET DEFAULT 'paddle'" "$migration"
grep -q 'openPaddleCheckout' "$ui"
grep -q 'Paddle Checkout opened' "$ui"
grep -q 'docs/production/paddle-billing.md' README.md
! grep -q 'LEMON_SQUEEZY_' "$root_env"
! grep -q 'LEMON_SQUEEZY_' "$control_env"
! grep -q 'lemonsqueezy_webhook' "$main"
! grep -q '/api/v1/webhooks/lemonsqueezy' "$main"

grep -q 'PADDLE_ENVIRONMENT=production' "$root_env"
grep -q 'PADDLE_ENVIRONMENT=production' "$control_env"
echo "PASS: Paddle Live-only environment, checkout, webhook and migration contract"
