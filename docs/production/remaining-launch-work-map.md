# Agata Proxima — Remaining Launch Work Map

This map follows the completed Phase 3.22-A–H repository gates. It separates code work that can be completed in GitHub from tasks that require the founder's Paddle/Entra accounts or a real production environment. It does not mark an external task complete because documentation or code exists.

## Completed repository work

- [x] Restore canonical monthly prices: Free $0, Starter $149, Growth $499, Scale $1,199, Enterprise custom.
- [x] Implement Phase 3.22-A–H entitlement controls and acceptance gates.
- [x] Add Paddle price preflight: active price, monthly interval, USD currency and exact amount must match before checkout starts.
- [x] Verify Paddle's timestamped raw-body signature, organization, local checkout reference and configured price before paid entitlements are applied.
- [x] Add regression tests for wrong amount/currency/provider plan and ensure the checkout return does not itself claim payment success; webhook-confirmed local status is authoritative.
- [x] Add the practical usage guide at `docs/usage.md` and public route `/docs/usage`.
- [x] Add production operations guidance and on-demand health/backup scripts.
- [x] Update the billing documentation and environment contract to Paddle.

CI verifies repository implementation and regression gates; external account setup and runtime acceptance remain separate launch requirements.

## Remaining work and acceptance criteria

| Track | Primary owner | Dependency | Definition of done |
|---|---|---|---|
| Paddle account and plan setup | Founder/account owner, then repository verification | Paddle business approval and approved checkout domain | Configure approved Paddle Live API key, client token, notification secret, and three unique active monthly USD Live price IDs (`pri_...`) at $149/$499/$1,199; verify checkout → signed webhook → correct entitlement, duplicate delivery, renewal failure/recovery, cancellation and expiry using Live acceptance procedures that do not create unintended charges. See `docs/production/paddle-billing.md`. |
| Microsoft Entra SSO | Founder creates app registration; repository/deployment work completes integration | Public HTTPS Control Plane callback URL | Multitenant Web app registered; exact callback set; client ID and secret safely configured; organization Entra tenant ID bound; real login creates the correct Agata session and audit event. The UI start flow exists, but SSO is not production-accepted until the real end-to-end test passes. |
| Production hosting and database | Account owner creates the selected provider resources; repository deployment preparation is ready | Stable public backend URL and managed database | Follow `docs/production/deployment-architecture.md`: Vercel frontend at `agataproxima.com`, Control Plane container at `api.agataproxima.com`, separate managed PostgreSQL, same-origin API proxy, TLS, restricted access, migrations 0001–0020 and smoke tests. Audit snapshot (2026-10-11): a Vercel project exists and has a READY deployment marked `target=production`, but only the generated `agata-proxima.vercel.app` domain is attached; Vercel SSO protection is enabled for non-custom domains, so this is not a verified public customer URL. `agataproxima.com` is not attached. The connected Railway workspace showed no projects; backend hosting is not evidenced there. The active Cloudflare zone is on the Free Website plan and currently has email MX/SPF/DKIM/DMARC records only; no apex website or `api` DNS record is present. Managed-database and deployment-secret-store state still require direct verification. |
| Production email | Founder/domain owner plus deployment configuration | Agata-owned domain and Resend access | Sending domain DNS is verified; production sender and API key configured in secret store; verification, password reset and invitations are delivered in a real test. |
| Operational readiness | Repository scripts/runbooks plus hosting configuration | Production deployment and database | Health/readiness probes alert correctly; automated backups/PITR enabled; restore drill to an isolated database records RPO/RTO; alerting and rollback are tested. |
| External SaaS/security acceptance | Engineering + security reviewer | Deployed Control Plane, Engine and customer-like test app | Three-tenant acceptance verifies tenant-local operations, rejects cross-tenant reads/writes, checks expired context, and records evidence; load testing and independent security assessment are completed. |
| Launch sign-off | Founder and engineering | All tracks above | No critical open launch gates; runbooks and incident ownership are clear; production launch checklist has evidence for every item. |

## Paddle setup sequence

1. Complete Paddle business verification and obtain approval for the live checkout domain.
2. Create the Agata Proxima Starter, Growth and Scale products in Paddle, each with an active monthly USD recurring price at $149, $499 and $1,199.
3. Copy each **price ID** (`pri_...`) into the matching `PADDLE_*_PRICE_ID` variable. Product IDs alone are not sufficient for checkout.
4. Configure the approved Paddle Live `PADDLE_API_KEY`, `PADDLE_CLIENT_TOKEN`, `PADDLE_WEBHOOK_SECRET`, three Live `pri_...` price IDs, and `PADDLE_ENVIRONMENT=production` in the Control Plane secret store.
5. After the API is deployed and the Paddle business/domain are approved, configure the Live notification destination at `https://api.agataproxima.com/api/v1/webhooks/paddle`; subscribe to the transaction and subscription lifecycle events documented in `docs/production/paddle-billing.md`.
6. Complete the provider-approved Live acceptance procedure with explicit charge/refund handling; verify signed webhooks, idempotency, correct plan mapping, failure/recovery and cancellation without using Sandbox.
7. Confirm the Live account, checkout domain, credentials and price IDs are approved and independently verified before opening public self-service checkout.

## Microsoft Entra SSO sequence

1. Register the Agata Proxima application in Microsoft Entra ID as a multitenant Web application using [Microsoft's official app-registration guide](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app?tabs=client-secret).
2. Wait until the public Control Plane HTTPS URL is known, then register the exact callback: `https://<control-plane-host>/api/v1/auth/oidc/callback`.
3. Create a client secret and store it only in the deployment secret store.
4. Set `PROXIMA_OIDC_CLIENT_ID`, `PROXIMA_OIDC_CLIENT_SECRET` and `AGATA_PUBLIC_BASE_URL`.
5. Configure the expected customer Entra tenant ID against that customer's Agata organization.
6. Run the real end-to-end login, organization mapping, session and audit acceptance test.
7. Complete a real end-to-end sign-in test before declaring SSO production-ready. The login page now exposes the organization-slug flow, and the Settings → Enterprise identity page configures the tenant mapping; these UI surfaces do not replace provider acceptance.

## Operational approach

The local Compose database is for development. The repository now has a concrete deployment blueprint in `docs/production/deployment-architecture.md`: Vercel serves the React frontend, a container host serves the Rust Control Plane, and a separate managed PostgreSQL database stores production control-plane data. Vercel rewrites authenticated API and email-lifecycle routes through the frontend origin so session cookies and the OIDC callback remain aligned.

The repo now includes a container `PORT` fallback, Vercel routing configuration, CI validation for the proxy routes, a manual readiness workflow, a scheduled liveness probe and on-demand backup/health scripts. Vercel project inspection found generated-domain deployments but no attached `agataproxima.com`; the generated domain is SSO-protected. No Railway project was visible in the connected workspace. DNS, API hosting, managed-database configuration, deployment secrets, database backup settings, alerts, restore evidence and rollback still need direct verification and acceptance.

## Launch rule

Do not declare production ready while any required external acceptance item is unchecked. Keep the Engine as the data-plane authority and never bypass it to recover Control Plane availability.
