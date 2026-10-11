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
grep -q 'RESEND_TEMPLATE_BILLING_UPDATE_ID' "$production"
grep -q 'AGATA_SUPPORT_INBOX_EMAIL' "$production"
grep -q 'api/v1/public/support-requests' "$frontend"
grep -q 'request_id' "$frontend"
grep -q 'RESEND_FROM_NO_REPLY_EMAIL' "$env_example"
grep -q 'RESEND_FROM_SUPPORT_EMAIL' "$env_example"
grep -q 'RESEND_FROM_SECURITY_EMAIL' "$env_example"
grep -q 'RESEND_FROM_BILLING_EMAIL' "$env_example"
grep -q 'RESEND_FROM_NOTIFICATIONS_EMAIL' "$env_example"
grep -q 'AGATA_SUPPORT_INBOX_EMAIL=' "$env_example"
grep -q 'RESEND_TEMPLATE_VERIFY_EMAIL_ID' "$env_example"
grep -q 'RESEND_TEMPLATE_PASSWORD_RESET_ID' "$env_example"
grep -q 'RESEND_TEMPLATE_ORGANIZATION_INVITATION_ID' "$env_example"
grep -q 'RESEND_TEMPLATE_NEW_LOGIN_ALERT_ID' "$env_example"
grep -q 'RESEND_TEMPLATE_SUPPORT_REQUEST_RECEIVED_ID' "$env_example"
grep -q 'RESEND_TEMPLATE_BILLING_UPDATE_ID' "$env_example"
! grep -Eq '091dbdb2-21ed-444f-a209-6f44e55d192d|d3c046c7-fef6-42f0-931e-d92b6f96cfdf|0757a210-a372-4a5a-8fca-e642c2fed3da|2740537f-79d4-44a1-bbf8-f7913c0be3a0|3ca9fee8-01cd-4d6c-ae75-e0ff7b54034c|0500c270-e1ab-474f-b3d4-288831b73049' "$main" "$production"
python -m json.tool control-plane/openapi.json >/dev/null

echo "PASS: Phase 3.23 transactional email contract"
