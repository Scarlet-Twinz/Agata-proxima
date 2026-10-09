# Phase 3B — local email and Microsoft Entra acceptance

This runbook is for local verification only. It does not authorize production deployment, DNS changes, or live billing.

## Secrets and local configuration

The repository ignores `.env` and `.env.*` files (while allowing `.env.example`). Keep actual credentials in a local ignored environment file; never commit them, paste them into issues, or put them in frontend/Vercel variables.

For local Control Plane testing, use the variables from `crates/proxima-control-plane/.env.example` and set the following values in the local environment:

- `PROXIMA_OIDC_CLIENT_ID`: Microsoft Entra **Application (client) ID**.
- `PROXIMA_OIDC_CLIENT_SECRET`: the client secret **Value**. Do not use the Secret ID.
- `AGATA_PUBLIC_BASE_URL`: `http://127.0.0.1:8080` for local-only testing. Use the public HTTPS origin only in a properly configured hosted environment.
- `RESEND_API_KEY`: Resend API key, stored only in the local ignored environment file.
- `AGATA_SUPPORT_INBOX_EMAIL`: the existing monitored mailbox selected by the owner. Do not set this to `support@agataproxima.com` unless that address has an actual receiving mailbox or inbound routing.

Do not copy a production callback URL into a local test and assume the hosted callback is functional. The registered production callback is `https://agataproxima.com/api/v1/auth/oidc/callback`; end-to-end testing against it requires a running, correctly routed HTTPS Control Plane.

## Email DNS status and required owner action

The owner reports that a DMARC TXT record has been created in WhoGoHost:

- Name: `_dmarc`
- Value: `v=DMARC1; p=none;`

This is a monitoring policy. Verify it is publicly visible in authoritative DNS before treating DNS acceptance as complete. Do not create a duplicate DMARC record or change MX records as part of this runbook.

The Resend domain can send mail, but sending verification does not create an inbox. Before acceptance, choose an inbox that is actually monitored and set `AGATA_SUPPORT_INBOX_EMAIL` to that exact address. Confirm a support message can be received and replied to. Do not claim replies work until tested.

The screenshots supplied for the DNS zone also show the apex A record (`@`) set to `127.0.0.1`. This is a loopback address, not a public website target. Do not replace it with a guessed value; update it only after the actual hosting target is known and the owner authorizes DNS changes.

## Acceptance checklist

### Email
- [ ] DMARC record is visible from public DNS.
- [ ] A real monitored support inbox is selected and configured.
- [ ] Sender identity is verified for `no-reply@agataproxima.com`, `support@agataproxima.com`, `security@agataproxima.com`, `billing@agataproxima.com`, and `notifications@agataproxima.com` as used by the implementation.
- [ ] Send and inspect verification, password reset, invitation, new-login alert, billing update, and support confirmation.
- [ ] Verify delivery outcomes and support notification failures are represented accurately.
- [ ] Reply to a support message and confirm the reply reaches the monitored inbox.

### Microsoft Entra SSO
- [ ] Client ID and secret Value are stored only in the local ignored environment file or the backend secret manager.
- [ ] Production Web redirect URI matches `https://agataproxima.com/api/v1/auth/oidc/callback`.
- [ ] Test authorization redirect, callback state/nonce, issuer/audience/signature validation, session creation, organization/tenant mapping, role enforcement, and failure cases.
- [ ] Confirm SSO entitlement is enforced for the correct plans.
- [ ] Do not mark SSO accepted based on app registration alone.

### Guardrails
- [ ] Do not merge the Phase 3.23 pull request until its latest CI passes and review is complete.
- [ ] Do not deploy, modify production credentials, or change DNS as part of local testing.
- [ ] Billing-provider migration and payment acceptance remain separate work; do not enable live billing before Lemon Squeezy configuration and signed webhook tests are complete.
