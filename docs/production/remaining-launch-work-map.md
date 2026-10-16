# Agata Proxima — Remaining Launch Work Map

This map follows the completed Phase 3.22-A–H repository gates. It separates repository work from tasks that require the founder's Flutterwave/Entra accounts or a real production environment. It does not mark an external task complete because documentation or code exists.

## Completed repository work

- [x] Restore canonical monthly prices: Free $0, Starter $149, Growth $499, Scale $1,199, Enterprise custom.
- [x] Implement Phase 3.22-A–H entitlement controls and acceptance gates.
- [x] Add Flutterwave plan preflight: configured plan IDs and amounts are checked before checkout starts; verified transactions must match the configured USD amount.
- [x] Verify Flutterwave's `verif-hash`, local checkout reference, transaction amount and USD currency before paid entitlements are applied.
- [x] Add regression tests for wrong amount/currency/provider plan and ensure the checkout return does not itself claim payment success; webhook-confirmed local status is authoritative.
- [x] Add the practical usage guide at `docs/usage.md` and public route `/docs/usage`.
- [x] Add production operations guidance and on-demand health/backup scripts.
- [x] Update the billing documentation and environment contract to Flutterwave.

CI verifies repository implementation and regression gates; external account setup and runtime acceptance remain separate launch requirements.

## Remaining work and acceptance criteria

| Track | Primary owner | Dependency | Definition of done |
|---|---|---|---|
| Flutterwave account and plan setup | Founder/account owner, then repository verification | Account approval, live credentials and confirmed USD checkout behavior | Configure `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_WEBHOOK_SECRET_HASH`, `FLUTTERWAVE_ENVIRONMENT=production`, three distinct numeric plan IDs and the canonical USD amounts; verify checkout, transaction verification, webhook hash, duplicate delivery and failure handling. See `docs/production/flutterwave-billing.md`. |
| Microsoft Entra SSO | Founder creates app registration; repository/deployment work completes integration | Public HTTPS Control Plane callback URL | Multitenant Web app registered; exact callback set; client ID and secret safely configured; organization Entra tenant ID bound; real login creates the correct Agata session and audit event. The UI start flow exists, but SSO is not production-accepted until the real end-to-end test passes. |
| Production hosting and database | Account owner creates the selected provider resources; repository deployment preparation is ready | Stable public backend URL and managed database | Follow `docs/production/deployment-architecture.md`: Vercel frontend at `agataproxima.com`, Control Plane container at `api.agataproxima.com`, separate managed PostgreSQL, same-origin API proxy, TLS, restricted access, the ordered migration chain through 0024 and smoke tests. Audit snapshot (2026-10-11): a Vercel project exists under a **Hobby** team and has a READY deployment marked `target=production`, but only the generated `agata-proxima.vercel.app` domain is attached; Vercel SSO protection is enabled for non-custom domains, so this is not a verified public customer URL. Vercel's official [Terms of Service](https://vercel.com/legal/terms) restrict Hobby to personal/non-commercial use; a commercial SaaS launch requires a paid Pro/Enterprise plan or a different host whose terms permit commercial use. No plan upgrade was made. `agataproxima.com` is not attached. The connected Railway workspace showed no projects; backend hosting is not evidenced there. The active Cloudflare zone is on the Free Website plan and currently has email MX/SPF/DKIM/DMARC records only; no apex website or `api` DNS record is present. Managed-database and deployment-secret-store state still require direct verification. |
| Production email | Founder/domain owner plus deployment configuration | Agata-owned domain and Resend access | Sending domain DNS is verified; production sender and API key configured in secret store; verification, password reset and invitations are delivered in a real test. |
| Operational readiness | Repository scripts/runbooks plus hosting configuration | Production deployment and database | Health/readiness probes alert correctly; automated backups/PITR enabled; restore drill to an isolated database records RPO/RTO; alerting and rollback are tested. |
| External SaaS/security acceptance | Engineering + security reviewer | Deployed Control Plane, Engine and customer-like test app | Three-tenant acceptance verifies tenant-local operations, rejects cross-tenant reads/writes, checks expired context, and records evidence; load testing and independent security assessment are completed. |
| Launch sign-off | Founder and engineering | All tracks above | No critical open launch gates; runbooks and incident ownership are clear; production launch checklist has evidence for every item. |

## Flutterwave setup sequence

1. Confirm the Flutterwave account is approved for the intended live payment flow.
2. Configure `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_WEBHOOK_SECRET_HASH`, and `FLUTTERWAVE_ENVIRONMENT=production` in the Control Plane secret store.
3. Configure three distinct numeric plan IDs: `FLUTTERWAVE_STARTER_PLAN_ID`, `FLUTTERWAVE_GROWTH_PLAN_ID`, and `FLUTTERWAVE_SCALE_PLAN_ID`.
4. Set the expected USD amounts: `FLUTTERWAVE_STARTER_AMOUNT_USD=149`, `FLUTTERWAVE_GROWTH_AMOUNT_USD=499`, and `FLUTTERWAVE_SCALE_AMOUNT_USD=1199`.
5. Configure the webhook destination as `https://<api-host>/api/v1/webhooks/flutterwave` and set `FLUTTERWAVE_WEBHOOK_SECRET_HASH` to the expected `verif-hash` value.
6. Exercise checkout, server-side transaction verification, invalid-hash rejection, duplicate event handling and failure paths in the intended environment. Confirm the provider returns USD and the exact configured amount before enabling paid checkout.
7. Use the documented support path for subscription or cancellation requests until a self-service portal is available.

See [the Flutterwave billing runbook](flutterwave-billing.md) for the detailed configuration contract and checklist.

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
