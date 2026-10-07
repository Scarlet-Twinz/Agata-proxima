$ErrorActionPreference = "Stop"

Write-Host "Resetting ONLY the local Agata Proxima control-plane database..." -ForegroundColor Yellow

docker compose exec -T control-postgres psql -U proxima_control -d proxima_control -v ON_ERROR_STOP=1 -c "TRUNCATE TABLE users, organizations, memberships, projects, tenants, policies, nodes, deployments, verification_results, audit_events, sessions, support_requests, billing_accounts, billing_events, organization_invites, organization_entitlements, organization_oidc_connections, oidc_login_states, user_identities, api_keys, webhooks, webhook_deliveries CASCADE;"

Write-Host ""
Write-Host "Control-plane database reset complete." -ForegroundColor Green
Write-Host "The Proxima engine database was NOT touched." -ForegroundColor Green
Write-Host "You can now create a fresh Agata Proxima account with the same email address." -ForegroundColor Green
