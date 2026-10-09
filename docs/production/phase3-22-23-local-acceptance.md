# Local acceptance — Phase 3.22/3.23 (Entra SSO + Resend)

This checklist is for running the existing code locally after pulling the
`phase3-23-resend-transactional-email` branch. It does not claim that an
external Microsoft sign-in or a real Resend delivery has passed merely because
CI passes.

## 1. Pull the branch

```powershell
git fetch origin
git switch phase3-23-resend-transactional-email
git pull --ff-only origin phase3-23-resend-transactional-email
```

If the branch is not present locally, use
`git switch --track origin/phase3-23-resend-transactional-email`.

## 2. Prepare a private local environment

Copy the root `.env.example` to `.env.local` (the latter is git-ignored).
Keep secrets only in `.env.local` and never commit or paste them into issues.

Set these values in `.env.local`:

- `AGATA_PUBLIC_BASE_URL=http://127.0.0.1:8080`
- `PROXIMA_OIDC_CLIENT_ID=<Application (client) ID from Entra>`
- `PROXIMA_OIDC_CLIENT_SECRET=<the Secret VALUE, stored locally>`
- `RESEND_API_KEY=<Resend API key, stored locally>`
- `RESEND_FROM_NO_REPLY_EMAIL=Agata Proxima <no-reply@agataproxima.com>`
- `RESEND_FROM_SUPPORT_EMAIL=Agata Proxima Support <support@agataproxima.com>`
- `RESEND_FROM_SECURITY_EMAIL=Agata Proxima Security <security@agataproxima.com>`
- `RESEND_FROM_BILLING_EMAIL=Agata Proxima Billing <billing@agataproxima.com>`
- `RESEND_FROM_NOTIFICATIONS_EMAIL=Agata Proxima <notifications@agataproxima.com>`
- `AGATA_SUPPORT_INBOX_EMAIL=anthonyemmanuella297@gmail.com`

Retain the six `RESEND_TEMPLATE_*_ID` values from the checked-in example.
Do not replace them with template names or paste API keys into source code.

## 3. Entra redirect URI

For local sign-in, the Entra app registration must include the exact Web redirect
URI `http://127.0.0.1:8080/api/v1/auth/oidc/callback`. Keep the production URI
`https://agataproxima.com/api/v1/auth/oidc/callback` registered as well. Do not
change tenant/account-type settings merely to make a test pass. The configured
tenant ID sent to `POST /api/v1/organization/oidc/entra` must be the Entra
Directory (tenant) ID in UUID format.

## 4. Run static checks and tests

From the repository root in PowerShell:

```powershell
cargo fmt --all -- --check
cargo check --workspace --all-targets
cargo test --workspace --all-targets
cargo clippy --workspace --all-targets --all-features -- -D warnings
bash tests/launch/phase3_23_resend_email_gate.sh
bash tests/launch/phase3_22_23_oidc_email_contract.sh
python -m json.tool control-plane/openapi.json
```

The two shell gates are repository-contract checks; they do not simulate a
Microsoft identity provider, verify a real tenant, or send mail.

## 5. Runtime acceptance sequence

1. Start PostgreSQL and the Control Plane using the repository's existing local
   workflow; confirm migrations through `0016_public_support_requests.sql`
   apply without errors.
2. Sign in with an owner/admin user whose organization has the `entra_oidc`
   feature entitlement.
3. Configure the organization's Entra connection with
   `POST /api/v1/organization/oidc/entra`, using the Directory (tenant) ID.
4. Open `GET /api/v1/auth/oidc/start?organization_slug=<organization-slug>`.
   Confirm the returned `authorization_url` includes the configured client ID,
   exact redirect URI, state, nonce, and OpenID scopes. Complete a real sign-in
   and confirm the callback creates the expected session.
5. Confirm an invalid/expired state and an invalid nonce/token are rejected.
6. Exercise verification, password reset, invitation, new-login alert, and the
   public support form. Check the Resend event status and the destination inbox.
7. Submit the support form repeatedly and verify rate limiting. Temporarily use
   an invalid Resend key only in a local test environment and confirm failed
   delivery is surfaced rather than reported as delivered.
8. Confirm `AGATA_SUPPORT_INBOX_EMAIL` points to an inbox you actually monitor.
   Resend domain verification enables sending; it does not create an inbound
   mailbox. Receiving remains a separate configuration.

## What counts as passed

- **CI passed:** formatting/build/tests/lints and repository contract checks pass.
- **Runtime passed:** database migrations and local API behavior pass.
- **External acceptance passed:** real Entra login and real Resend delivery are
  observed end-to-end.

Do not label the final category passed until it has actually been exercised.
