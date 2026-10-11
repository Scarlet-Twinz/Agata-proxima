#!/usr/bin/env bash
set -euo pipefail

production="crates/proxima-control-plane/src/production.rs"
main="crates/proxima-control-plane/src/main.rs"
env_example=".env.example"
control_env="crates/proxima-control-plane/.env.example"

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

# Sender identities and template IDs must be present in both environment examples.
for file in "$env_example" "$control_env"; do
  grep -q '^RESEND_API_KEY=' "$file"
  grep -q '^AGATA_SUPPORT_INBOX_EMAIL=' "$file"
  grep -q '^RESEND_FROM_NO_REPLY_EMAIL=' "$file"
  grep -q '^RESEND_FROM_SUPPORT_EMAIL=' "$file"
  grep -q '^RESEND_FROM_SECURITY_EMAIL=' "$file"
  grep -q '^RESEND_FROM_BILLING_EMAIL=' "$file"
  grep -q '^RESEND_FROM_NOTIFICATIONS_EMAIL=' "$file"
  grep -q '^RESEND_TEMPLATE_VERIFY_EMAIL_ID=' "$file"
  grep -q '^RESEND_TEMPLATE_PASSWORD_RESET_ID=' "$file"
  grep -q '^RESEND_TEMPLATE_ORGANIZATION_INVITATION_ID=' "$file"
  grep -q '^RESEND_TEMPLATE_NEW_LOGIN_ALERT_ID=' "$file"
  grep -q '^RESEND_TEMPLATE_SUPPORT_REQUEST_RECEIVED_ID=' "$file"
  grep -q '^RESEND_TEMPLATE_BILLING_UPDATE_ID=' "$file"
done

# Examples must not contain a non-empty Entra secret or a personal support destination.
if grep -Eq '^PROXIMA_OIDC_CLIENT_SECRET=.+$' "$env_example" "$control_env"; then
  echo "ERROR: environment examples must not contain a real Entra client secret" >&2
  exit 1
fi
if grep -q 'anthonyemmanuella297@gmail.com' "$env_example" "$control_env"; then
  echo "ERROR: environment examples must not contain a personal support destination" >&2
  exit 1
fi

echo "PASS: Phase 3.22/3.23 Entra OIDC and Resend configuration contract"
