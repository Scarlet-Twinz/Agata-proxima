#!/usr/bin/env bash
set -euo pipefail

production="crates/proxima-control-plane/src/production.rs"
main="crates/proxima-control-plane/src/main.rs"

# Microsoft Entra OIDC security invariants.
grep -q '"/api/v1/auth/oidc/start"' "$main"
grep -q '"/api/v1/auth/oidc/callback"' "$main"
grep -q 'oidc_login_states' "$production"
grep -q 'state_hash' "$production"
grep -q 'expires_at>now()' "$production"
grep -q 'expected_nonce' "$production"
grep -q 'Algorithm::RS256' "$production"
grep -q 'set_audience' "$production"
grep -q 'set_issuer' "$production"
grep -q 'PROXIMA_OIDC_CLIENT_SECRET' "$production"
grep -q 'PROXIMA_OIDC_CLIENT_ID' "$production"
grep -q 'fn oidc_redirect_uri' "$production"
grep -q '"/api/v1/auth/oidc/link/start"' "$main"
grep -q 'entra_link_start' "$production"
grep -q 'linking_user_id' "$production"
grep -q 'sso_link_email_mismatch' "$production"
grep -q 'sso_identity_already_linked' "$production"

# Runtime configuration contract: validate variable names in source, never require tracked env files.
for key in RESEND_API_KEY AGATA_SUPPORT_INBOX_EMAIL RESEND_FROM_NO_REPLY_EMAIL RESEND_FROM_SUPPORT_EMAIL RESEND_FROM_SECURITY_EMAIL RESEND_FROM_BILLING_EMAIL RESEND_FROM_NOTIFICATIONS_EMAIL RESEND_TEMPLATE_VERIFY_EMAIL_ID RESEND_TEMPLATE_PASSWORD_RESET_ID RESEND_TEMPLATE_ORGANIZATION_INVITATION_ID RESEND_TEMPLATE_NEW_LOGIN_ALERT_ID RESEND_TEMPLATE_SUPPORT_REQUEST_RECEIVED_ID RESEND_TEMPLATE_BILLING_UPDATE_ID; do
  grep -Fq "$key" "$production" || { echo "ERROR: runtime email configuration missing: $key" >&2; exit 1; }
done
! grep -Eq 'PROXIMA_OIDC_CLIENT_SECRET[[:space:]]*=[[:space:]]*[^[:space:]]+' "$production" || { echo "ERROR: a literal Entra secret assignment is present in source" >&2; exit 1; }
! grep -q 'anthonyemmanuella297@gmail.com' "$production" "$main" || { echo "ERROR: a personal support destination is hardcoded in source" >&2; exit 1; }
test ! -e .env.example
test ! -e crates/proxima-control-plane/.env.example

echo "PASS: Phase 3.22/3.23 Entra OIDC and Resend configuration contract"