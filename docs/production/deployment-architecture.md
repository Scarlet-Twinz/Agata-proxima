# Agata Proxima — Deployment Architecture and First Production Path

Status: **prepared in the repository, not deployed**. No hosting service, domain record, database, provider secret or paid plan has been created or changed by this document.

## Recommended topology

Use the following first deployment path to preserve the existing React frontend and Rust Control Plane without requiring a custom multi-process container:

- **Frontend:** Vercel project with Root Directory set to `frontend`; attach `agataproxima.com`.
- **Control Plane:** Railway service built from `crates/proxima-control-plane/Dockerfile`; attach `api.agataproxima.com`.
- **Database:** a separate managed PostgreSQL project, with TLS, access restrictions, automated recovery capability and a production connection string. Neon is one compatible option; verify its current restore window and usage costs before selecting a plan.
- **Engine:** deploy separately to the customer/database environment where it can securely reach the protected PostgreSQL service. Do not treat the Control Plane host as the Engine's trust boundary.

This is a recommendation, not a claim that these accounts or resources already exist. **Do not use Vercel Hobby for the commercial production SaaS:** Vercel's current Terms limit Hobby to personal or non-commercial use. Use Vercel Pro (currently listed at $20/month) or select a different host whose terms permit commercial deployment. Railway Hobby has a $5/month base subscription and usage charges beyond included credit; Neon usage depends on compute, storage and recovery retention. These are provider list prices checked on 9 October 2026, not a quote for your exact workload. Review current prices and required payment methods before enabling paid services.

## Why the API is proxied through the frontend origin

Browser sessions use HTTP-only cookies and CSRF protection. OIDC callback and email lifecycle links must also return through a consistent public origin. The frontend's `frontend/vercel.json` therefore proxies:

- `/api/*` to `https://api.agataproxima.com/api/*`;
- `/docs/openapi.json` to the Control Plane;
- `/verify-email`, `/reset-password` and `/accept-invite` to the Control Plane;
- all other missing static paths to `/index.html` for React Router.

The API and token-bearing email routes explicitly disable Vercel external-rewrite caching. Do not change the API client to call the API subdomain directly unless cookie, CSRF, CORS and OIDC behavior are deliberately reworked and retested.

## Deployment order

### 1. Create the managed PostgreSQL database

1. Create a new database dedicated to Agata Proxima Control Plane data. Do not point the service at the laptop's Docker Compose database.
2. Require TLS and use the provider's application connection string. Keep database network access and credentials restricted.
3. If using Neon, start with a development project only for non-production acceptance. Before production, choose the restore-history window and service plan appropriate to the required RPO/RTO, and check current usage-based pricing.
4. Keep a separate test database for restore drills. Never test restoration by overwriting the live database.

### 2. Deploy the Control Plane container

Create a Railway service connected to `Scarlet-Twinz/Agata-proxima`, with repository root as the build context and the custom Dockerfile path:

```text
crates/proxima-control-plane/Dockerfile
```

Configure the healthcheck path as `/api/v1/health`. The container now supports the platform-provided `PORT`; leave `PROXIMA_CONTROL_BIND` unset unless you intentionally override the bind address.

Configure these service variables in the provider's secret/configuration UI:

- `PROXIMA_CONTROL_DATABASE_URL` — managed PostgreSQL connection string.
- `PROXIMA_COOKIE_SECURE=true`.
- `AGATA_PUBLIC_BASE_URL=https://agataproxima.com`.
- `RESEND_API_KEY`, the five purpose-specific `RESEND_FROM_*_EMAIL` identities, all six `RESEND_TEMPLATE_*_ID` values, and `AGATA_SUPPORT_INBOX_EMAIL` after the sending domain is verified. Keep the API key server-side; the support inbox must be an actually monitored mailbox. `RESEND_FROM_EMAIL` is only a compatibility fallback.
- Lemon Squeezy API key, store ID, three monthly variant IDs and webhook signing secret in the Control Plane secret store.
- `PROXIMA_OIDC_CLIENT_ID` and `PROXIMA_OIDC_CLIENT_SECRET` after Microsoft Entra registration. The current implementation derives and validates the issuer from the organization's configured Entra tenant ID; there is no separate `PROXIMA_OIDC_ISSUER` runtime variable.

Do not store any secret in Git, Vercel's public build variables, or this documentation. The Control Plane applies its versioned database migrations at startup; verify migration logs and readiness after the first deploy.

### 3. Attach the API hostname

1. In the backend host, add the custom domain `api.agataproxima.com`.
2. Copy the exact DNS record/value shown by the host into the DNS zone managed by WhoGoHost.
3. Wait for the host to verify the domain and provision HTTPS.
4. Check `https://api.agataproxima.com/api/v1/health` directly before moving on.

Do not invent a CNAME target; copy the one provided by the actual host dashboard.

### 4. Deploy the frontend to Vercel

1. Import `Scarlet-Twinz/Agata-proxima` into the Vercel team.
2. Set Root Directory to `frontend`, with the normal Vite build command `npm run build` and output directory `dist`.
3. Keep `VITE_API_BASE_URL` unset/empty so authenticated requests use same-origin `/api/v1` paths and the rewrites in `frontend/vercel.json`.
4. Attach `agataproxima.com` to the Vercel project and apply only the DNS records Vercel displays.
5. Test the homepage, direct refresh of `/docs/usage`, sign-up, login, email links and the API health proxy.

The API hostname must be live before the frontend is promoted. Do not send customers to a deployment while the rewrite destination is unavailable.

### 5. Finish SSO and Lemon Squeezy provider setup

- **SSO:** set the Microsoft Entra Web redirect URI to `https://agataproxima.com/api/v1/auth/oidc/callback`, matching the frontend-origin proxy. Set the exact public base URL and provider credentials in the Control Plane's secret store, then test a real login.
- **Lemon Squeezy:** configure `https://api.agataproxima.com/api/v1/webhooks/lemonsqueezy` only after the Control Plane is deployed. Confirm the three variants match USD monthly plans of $149, $499 and $1,199. Test checkout, signed webhook, duplicate delivery, renewal failure/recovery and cancellation in test mode before enabling live payments.
- **Email:** verify the Agata-owned Resend sending domain and test verification, password-reset and invitation delivery.

### 6. Turn on monitoring and recovery

1. In GitHub repository Settings → Secrets and variables → Actions, add repository secret `AGATA_PUBLIC_BASE_URL` with value `https://agataproxima.com`. This is a public URL, not a secret credential, but the workflow reads it from the repository secret store for controlled configuration.
2. Open Actions → **Production smoke monitoring** and run it manually. It must pass liveness and the full readiness check before launch.
3. The scheduled workflow checks liveness every 15 minutes once the URL is configured. It does not replace a managed database monitor or independent uptime alerting.
4. Enable database backups/PITR according to the selected provider and record retention.
5. Run `scripts/ops/backup-control-plane.sh` from a protected operator environment when a custom-format logical backup is required. Keep the dump in approved encrypted storage, not in GitHub logs or a public artifact.
6. Restore a backup to an isolated database and record actual RPO and RTO. Test rollback to a known-good application image.

## Acceptance gate

The production deployment is not accepted until all of the following are evidenced:

- frontend and API domains resolve over HTTPS;
- frontend API proxy, cookie session and CSRF flow work through `agataproxima.com`;
- production Control Plane uses the managed database, not localhost or the laptop;
- migrations 0001–0016 are applied and schema state is verified;
- `/api/v1/production/readiness` returns `ready`;
- Lemon Squeezy test-mode checkout and signed webhook round-trip passes;
- real Entra SSO and Resend verification, recovery, invitation, security, billing, and support delivery tests pass;
- database restore drill and alerting/rollback checks pass;
- external three-tenant SaaS isolation acceptance and load/security checks pass.

A green GitHub Actions run proves repository checks. It does not prove DNS, external credentials, payment settlement, a hosted database, or production recovery until those live tests have actually run.
