#!/usr/bin/env bash
set -euo pipefail

main="crates/proxima-control-plane/src/main.rs"
production="crates/proxima-control-plane/src/production.rs"
frontend="frontend/src/pages/public/SupportRequest.tsx"
env_example=".env.example"

test -f crates/proxima-control-plane/migrations/0016_public_support_requests.sql
test -f docs/production/phase3-23-resend-transactional-email.md
grep -q '0016_public_support_requests.sql' "$main"
grep -q '"/api/v1/public/support-requests"' "$main"
grep -q 'async fn create_public_support_request' "$main"
grep -q 'public_support_rate_limits' "$main"
grep -q 'requester_email_status' "$main"
grep -q 'support_email_status' "$main"
grep -q 'send_template_email_as' "$production"
grep -q 'RESEND_FROM_NO_REPLY_EMAIL' "$production"
grep -q 'RESEND_FROM_SUPPORT_EMAIL' "$production"
grep -q 'RESEND_FROM_SECURITY_EMAIL' "$production"
grep -q 'RESEND_FROM_BILLING_EMAIL' "$production"
grep -q 'RESEND_FROM_NOTIFICATIONS_EMAIL' "$production"
grep -q '0500c270-e1ab-474f-b3d4-288831b73049' "$production"
grep -q 'AGATA_SUPPORT_INBOX_EMAIL' "$production"
grep -q 'api/v1/public/support-requests' "$frontend"
grep -q 'request_id' "$frontend"
grep -q 'RESEND_FROM_NO_REPLY_EMAIL' "$env_example"
grep -q 'RESEND_FROM_SUPPORT_EMAIL' "$env_example"
grep -q 'RESEND_FROM_SECURITY_EMAIL' "$env_example"
grep -q 'RESEND_FROM_BILLING_EMAIL' "$env_example"
grep -q 'RESEND_FROM_NOTIFICATIONS_EMAIL' "$env_example"
grep -q 'AGATA_SUPPORT_INBOX_EMAIL=' "$env_example"
python -m json.tool control-plane/openapi.json >/dev/null

echo "PASS: Phase 3.23 transactional email contract"
