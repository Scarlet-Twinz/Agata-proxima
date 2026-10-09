# Agata Proxima Usage Guide

This is the practical operating guide for the repository-backed product. It covers local development, organizations and tenants, verification, team access, billing, SSO, and the boundary between local development and production.

> **Honest status:** Phase 3.22-A–H repository gates have passed. Live Paystack, Microsoft Entra SSO, production email, hosted database operations and runtime external-SaaS acceptance remain external acceptance tasks.

## 1. Know which database you are using

The local Compose file defines two separate PostgreSQL services:

- `postgres` (host port 5432): Engine development database.
- `control-postgres` (host port 55443 by default): Control Plane database for users, organizations, tenants, billing state, audit and platform resources.

When you run these services in Docker Desktop on your laptop, the database is local to that machine even if you access it through VS Code. The repository alone cannot prove whether a separate hosted production database exists. Do not use your laptop's database as production.

## 2. Start local development (Windows PowerShell)

Prerequisites: Docker Desktop, Git and the stable Rust toolchain.

From the repository root:

```powershell
docker compose up -d control-postgres
$env:PROXIMA_CONTROL_DATABASE_URL = "postgres://proxima_control:proxima-control-dev@127.0.0.1:55443/proxima_control"
$env:PROXIMA_CONTROL_BIND = "127.0.0.1:8080"
$env:PROXIMA_COOKIE_SECURE = "false"
cargo run -p proxima-control-plane
```

The Control Plane applies the repository migrations at startup. The local development password and `PROXIMA_COOKIE_SECURE=false` are for local use only; never expose this configuration publicly.

- App: `http://127.0.0.1:8080`
- Health: `http://127.0.0.1:8080/api/v1/health`
- Configuration/readiness report: `http://127.0.0.1:8080/api/v1/production/readiness`
- OpenAPI: `http://127.0.0.1:8080/docs/openapi.json`

Stop the local database with `docker compose stop control-postgres`. Do not run volume-deleting Compose commands or reset scripts against a database containing data you need.

## 3. Create an account and workspace

Open `/signup`. Signup accepts `email`, `password` (at least 12 characters), optional `name`, and optional `organization`. The first user becomes the organization owner. Signup requires working email verification through Resend; configure a valid API key and verified sender before testing signup. If verification email delivery fails, workspace creation may be rolled back rather than silently bypassing verification.

The API session is held in the HTTP-only `proxima_session` cookie. For state-changing API calls, retrieve the current CSRF token from `GET /api/v1/session` and send it as `x-csrf-token`. Do not expose session cookies, CSRF tokens, passwords or provider secrets in source control, screenshots, issues or logs.

## 4. Manage your platform

The versioned API lives under `/api/v1`.

| Task | Endpoint |
|---|---|
| Current session | `GET /api/v1/session` |
| Organizations | `GET/POST /api/v1/organizations` |
| Tenants | `GET/POST /api/v1/tenants` |
| Policies | `GET/POST /api/v1/policies` |
| Nodes | `GET/POST /api/v1/nodes` |
| Deployments | `GET/POST /api/v1/deployments` |
| Verification evidence | `GET/POST /api/v1/verifications` |
| Audit | `GET /api/v1/audit` |
| Support requests | `GET/POST /api/v1/support` |
| API keys | `GET/POST /api/v1/developer/api-keys` |
| Webhooks | `GET/POST /api/v1/developer/webhooks` |

Resource creation requires the real `organization_id` from your session/organization response. The current request fields are:

- Tenant: `organization_id`, `name`, `slug`, optional `isolation_mode`.
- Policy: `organization_id`, `name`, `version`, `document` (JSON).
- Node: `organization_id`, `name`, optional `environment` and `region`.
- Deployment: `organization_id`, `node_id`, `version`, `desired_state`.
- Verification: `organization_id`, optional `tenant_id`, `kind`, `status`, `evidence` (JSON).
- Webhook: `name`, `endpoint_url`, `events` (array).

Node registration may return a one-time enrollment token. Store it securely immediately. Never use another organization's ID or expose the PostgreSQL upstream as a bypass around Proxima.

## 5. Use the correct integration sequence

1. Establish application-user identity and a trusted tenant identifier.
2. Create the matching tenant in Agata Proxima.
3. Configure Proxima Engine, PostgreSQL roles and row-level security.
4. Generate signed tenant context through a trusted server-side path.
5. Point the application at Proxima, not an alternate untrusted database endpoint.
6. Test tenant-local reads/writes and deliberate cross-tenant failures.
7. Inspect verification evidence and audit history.
8. Promote only after the deployment-specific tests pass.

The Engine is the data-plane enforcement authority. The Control Plane manages configuration and evidence; it is not called for every query.

## 6. Run verification

From the repository root:

```powershell
cargo fmt --all -- --check
cargo check --workspace --all-targets
cargo test --workspace --all-targets
cargo clippy --workspace --all-targets --all-features -- -D warnings
bash tests/postgres/verify_rls.sh
```

The PostgreSQL test requires a configured local PostgreSQL environment. For a deployed integration, follow `docs/verification.md` and `tests/external-saas/README.md`. Passing local CI is not proof that a real external SaaS deployment has passed runtime acceptance.

## 7. Team access

- `GET /api/v1/organization/team`
- `GET/POST /api/v1/organization/invitations`
- `DELETE /api/v1/organization/invitations/{id}`

Invitation requests include `organization_id`, `email`, and an optional role. Invitations expire after seven days and must be accepted by the signed-in user with the matching email. Active memberships and unexpired pending invitations reserve seats; the server enforces the limit.

## 8. Plans, usage and billing

Canonical monthly prices:

| Plan | Price | Nodes | Tenants | Environments | Active integrations | Verifications/month | Seats |
|---|---:|---:|---:|---:|---:|---:|---:|
| Free | $0 | 1 | 3 | 1 | 1 | 100 | 1 |
| Starter | $149 | 2 | 25 | 2 | 5 | 1,000 | 5 |
| Growth | $499 | 5 | 100 | 5 | 20 | 10,000 | 15 |
| Scale | $1,199 | 15 | 500 | 50 | 100 | 100,000 | 50 |
| Enterprise | Custom | Contract-defined | Contract-defined | Contract-defined | Contract-defined | Contract-defined | Contract-defined |

Billing endpoints:

- `GET /api/v1/billing` — current billing state.
- `GET /api/v1/billing/plans` — plan catalogue and checkout availability.
- `GET /api/v1/billing/entitlements` — limits and usage.
- `POST /api/v1/billing/checkout` — starts paid checkout for Starter, Growth or Scale.
- `POST /api/v1/billing/portal` — obtains a subscription-management URL after subscription exists.
- `GET /api/v1/billing/verify?reference=...` — verifies a stored transaction as an organization admin.

Paystack is the active billing provider. The server uses `PAYSTACK_SECRET_KEY` and `AGATA_PAYSTACK_STARTER_PLAN_CODE`, `AGATA_PAYSTACK_GROWTH_PLAN_CODE`, `AGATA_PAYSTACK_SCALE_PLAN_CODE`. Checkout is configured for USD. The three configured plan codes must be present and unique. Before redirecting a customer, the server retrieves each configured plan from Paystack and requires the exact plan code, USD currency, monthly interval and amount in cents ($149 = 14900, $499 = 49900, $1,199 = 119900). After payment, transaction verification and signed webhook processing check the exact amount, currency and plan before granting paid entitlements.

For a Nigeria-based business, Paystack's current guidance says USD payouts require a verified Zenith Bank USD domiciliary account; international card acceptance can be enabled separately, with local-currency settlement as the default. Do not enable live checkout until Paystack has approved USD payments, the required payout account is verified, all three plan codes match the catalogue, and a real webhook/payment round trip passes. Never commit a secret or paste it into chat. See Paystack's [international payments and USD settlement guide](https://support.paystack.com/en/articles/2130690).

## 9. Where to get SSO

Agata Proxima's SSO provider is **Microsoft Entra ID (OpenID Connect/OIDC)**. It is not a key you get from Paystack. Create an app registration in the Microsoft Entra admin center: **Entra ID → App registrations → New registration**.

For the SaaS app, select **Accounts in any organizational directory (multitenant)** and add a **Web** redirect URI matching the deployed Control Plane exactly:

```text
https://<your-control-plane-host>/api/v1/auth/oidc/callback
```

Local-only callback:

```text
http://127.0.0.1:8080/api/v1/auth/oidc/callback
```

`AGATA_PUBLIC_BASE_URL` must be the browser-facing app origin. In production, route the callback and `/api/v1/*` to the Rust Control Plane under that same origin; otherwise the host-only session cookie and redirect to `/app` may not reach the React frontend.

Record the Application (client) ID and create a client secret. Store the secret only in your deployment secret store. Runtime configuration uses `PROXIMA_OIDC_CLIENT_ID`, `PROXIMA_OIDC_CLIENT_SECRET` and the exact `AGATA_PUBLIC_BASE_URL`. An organization owner/admin configures the customer's Entra tenant ID from **Settings → Advanced configuration → Enterprise identity** (backed by `GET/POST /api/v1/organization/oidc/entra`). On the login page, choose **Continue with SSO**, enter the organization's slug, and continue to Microsoft. The backend resolves that slug to the configured organization before creating OIDC state; it also retains the UUID-based `organization_id` query for administrative/testing workflows.

The UI can now initiate the flow, but successful SSO is not production-accepted until a real Entra registration, exact callback, tenant/organization mapping, session creation and audit event have passed end to end. See `docs/identity/microsoft-entra-oidc.md`.

## 10. Troubleshooting

- **Connection refused:** confirm Docker Desktop is running and `control-postgres` is healthy on host port 55443.
- **Control Plane 503:** check service logs, database connectivity and `/api/v1/production/readiness`.
- **CSRF failure:** refresh `GET /api/v1/session` and send the current `x-csrf-token`.
- **Email not delivered:** check Resend credentials, verified sending domain and sender address.
- **Checkout unavailable:** check the Paystack secret and all plan-code variables; verify the provider plans are USD monthly plans at the canonical prices.
- **SSO failure:** verify client ID/secret, tenant ID, public URL and exact redirect URI. Never log authorization codes, client secrets or ID tokens.
- **Quota reached:** inspect `GET /api/v1/billing/entitlements`; remove unused resources or upgrade. Downgrades preserve existing resources rather than deleting them.

## Related guides

- `docs/developer-guide.md` — API reference.
- `docs/customer-integration.md` — SaaS integration model.
- `docs/verification.md` — security verification.
- `docs/billing/phase3-22-entitlement-contract.md` — A–H completion map and full entitlement contract.
- `docs/production/phase55-deployment-runbook.md` — deployment configuration.
- `docs/production/operational-readiness-runbook.md` — backup, monitoring and incident procedures.
- `control-plane/openapi.json` — machine-readable API contract.
