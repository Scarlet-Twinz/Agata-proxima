# Agata Proxima — Remaining Launch Work Map

This map follows the completed Phase 3.22-A–H repository gates. It separates code work that can be completed in GitHub from tasks that require the founder's Lemon Squeezy/Entra accounts or a real production environment. It does not mark an external task complete because documentation or code exists.

## Completed repository work

- [x] Restore canonical monthly prices: Free $0, Starter $149, Growth $499, Scale $1,199, Enterprise custom.
- [x] Implement Phase 3.22-A–H entitlement controls and acceptance gates.
- [x] Add Lemon Squeezy provider-plan preflight: plan code, USD currency, monthly interval and exact amount must match before checkout starts.
- [x] Verify transaction amount, currency, organization and plan code before paid entitlements are applied.
- [x] Add regression tests for wrong amount/currency/provider plan and prevent the callback from displaying successful billing completion unless the local transaction is verified.
- [x] Add the practical usage guide at `docs/usage.md` and public route `/docs/usage`.
- [x] Add production operations guidance and on-demand health/backup scripts.
- [x] Update the OpenAPI contract and developer billing documentation to Lemon Squeezy.

CI verifies repository implementation and regression gates; external account setup and runtime acceptance remain separate launch requirements.

## Remaining work and acceptance criteria

| Track | Primary owner | Dependency | Definition of done |
|---|---|---|---|
| Lemon Squeezy USD account and plan setup | Founder/account owner, then repository verification | Lemon Squeezy business approval; USD payout account if USD settlement is required | USD collections enabled; USD settlement account verified; three Agata plan codes point to monthly USD plans at $149/$499/$1,199; test checkout → signed webhook → correct entitlement; test renewal failure/recovery/cancellation. |
| Microsoft Entra SSO | Founder creates app registration; repository/deployment work completes integration | Public HTTPS Control Plane callback URL | Multitenant Web app registered; exact callback set; client ID and secret safely configured; organization Entra tenant ID bound; real login creates the correct Agata session and audit event. The UI start flow exists, but SSO is not production-accepted until the real end-to-end test passes. |
| Production hosting and database | Account owner creates the selected provider resources; repository deployment preparation is ready | Stable public backend URL and managed database | Follow `docs/production/deployment-architecture.md`: Vercel Pro (or another host whose terms permit commercial use) frontend at `agataproxima.com`, Control Plane container at `api.agataproxima.com`, separate managed PostgreSQL, same-origin API proxy, TLS, restricted access, migrations 0001–0015 and smoke tests. No provider resources have been created yet. |
| Production email | Founder/domain owner plus deployment configuration | Agata-owned domain and Resend access | Sending domain DNS is verified; production sender and API key configured in secret store; verification, password reset and invitations are delivered in a real test. |
| Operational readiness | Repository scripts/runbooks plus hosting configuration | Production deployment and database | Health/readiness probes alert correctly; automated backups/PITR enabled; restore drill to an isolated database records RPO/RTO; alerting and rollback are tested. |
| External SaaS/security acceptance | Engineering + security reviewer | Deployed Control Plane, Engine and customer-like test app | Three-tenant acceptance verifies tenant-local operations, rejects cross-tenant reads/writes, checks expired context, and records evidence; load testing and independent security assessment are completed. |
| Launch sign-off | Founder and engineering | All tracks above | No critical open launch gates; runbooks and incident ownership are clear; production launch checklist has evidence for every item. |

## Lemon Squeezy setup sequence

1. Complete Lemon Squeezy business activation and request international payments if not already enabled.
2. Confirm whether the business needs payouts in USD or only wants to charge international customers. Lemon Squeezy documents different payout requirements for those cases.
3. If USD payouts are required for a Nigeria-based business, obtain and verify the required Zenith Bank USD domiciliary account in Lemon Squeezy.
4. In Lemon Squeezy, create or inspect only the three Agata Proxima monthly USD plans. Do not reuse unrelated plans.
5. Configure the three plan-code environment variables in the deployment secret store.
6. Deploy the code with the new plan preflight and run a real payment round trip before allowing customers to subscribe.

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

The repo now includes a container `PORT` fallback, Vercel routing configuration, CI validation for the proxy routes, a manual readiness workflow, a scheduled liveness probe and on-demand backup/health scripts. These are prepared repository controls; DNS, hosting resources, database backup settings, alerts, restore evidence and rollback still need real-environment configuration and acceptance.

## Launch rule

Do not declare production ready while any required external acceptance item is unchecked. Keep the Engine as the data-plane authority and never bypass it to recover Control Plane availability.
