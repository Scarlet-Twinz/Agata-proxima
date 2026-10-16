# Agata Proxima — Deployment Architecture

**Status: deployment architecture documented; production hosting and live acceptance are not approved or verified.** This document describes the required topology and acceptance sequence without selecting a hosting provider. A host-specific configuration file in the repository is not authorization to deploy. Do not deploy to Vercel for production unless the owner explicitly approves it.

## Target topology

Keep the frontend, Control Plane, database, and enforcement Engine as separate trust and operational boundaries.

- **Frontend:** build the React application in `frontend/` with `npm ci`, `npm run lint`, and `npm run build`. Select a host whose terms and plan permit the intended commercial use.
- **Control Plane:** build the Rust service using `crates/proxima-control-plane/Dockerfile` or the repository's root container configuration. Expose only the required HTTPS API and health endpoints.
- **Database:** use a dedicated managed PostgreSQL database for production Control Plane data. Require TLS, restrict network access, configure automated backups/PITR, and prove recovery in an isolated restore test.
- **Engine:** deploy separately in the environment where it can securely reach the protected PostgreSQL service. The Engine remains the data-plane enforcement authority; the Control Plane manages configuration and operations but must not become a bypass around Engine enforcement.

The production domain, hosting provider, database provider, and secret store must be selected and verified before deployment. Use `<approved-domain>` and `<approved-api-domain>` as placeholders in planning until the owner confirms the actual public hostnames.

## Routing, sessions, and identity

The browser should use a tested, consistent public origin for authenticated API calls and email lifecycle links. Configure the chosen frontend host or reverse proxy to route the required API and lifecycle paths to the Control Plane.

- Preserve HTTP-only, Secure cookies and the implemented CSRF protections.
- Ensure the Microsoft Entra OIDC callback uses the exact registered HTTPS redirect URI.
- Do not cache authenticated API responses, token-bearing email lifecycle routes, or identity callbacks.
- Do not switch the frontend to direct cross-origin API calls unless cookie, CSRF, CORS, and OIDC behavior are deliberately redesigned and retested.
- Verify that unknown frontend routes reach the React Router entry point without masking API errors.
- Confirm the API health endpoint directly and through the public frontend origin.

## Deployment sequence

### 1. Select and prepare hosting

1. Confirm the provider and plan allow the intended commercial workload.
2. Confirm the actual domain ownership and DNS zone before adding records.
3. Choose a frontend host and a container host, or one approved platform that supports both workloads safely.
4. Record the exact provider-generated DNS targets. Never guess A, AAAA, CNAME, or TXT values.
5. Store deployment configuration in the appropriate environment settings and credentials in a secret store.

### 2. Provision PostgreSQL

1. Create a production database dedicated to Agata Proxima Control Plane data. Do not use the developer laptop or local Docker Compose database for production.
2. Require TLS and restrict database network access and credentials.
3. Configure automated backups and point-in-time recovery where supported.
4. Maintain a separate database for restore drills. Never test recovery by overwriting the live database.
5. Apply the repository's versioned migrations in order through migration `0024`; inspect migration logs and readiness before accepting traffic.
6. Record the tested recovery point objective (RPO), recovery time objective (RTO), and restore evidence.

### 3. Deploy the Control Plane

Build from the repository's Control Plane Dockerfile:

```text
crates/proxima-control-plane/Dockerfile
```

Configure the platform's runtime port and health check for `/api/v1/health`. Use the platform-provided `PORT` unless a deliberate bind override is required.

Set the following values through the selected host's runtime configuration or secret store, as applicable:

- `PROXIMA_CONTROL_DATABASE_URL` — production PostgreSQL connection string.
- `PROXIMA_COOKIE_SECURE=true` — required for public HTTPS sessions.
- `AGATA_PUBLIC_BASE_URL=https://<approved-domain>` — the verified public origin.
- `RESEND_API_KEY` and the sender/template settings documented in the [transactional email runbook](phase3-23-resend-transactional-email.md).
- `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_WEBHOOK_SECRET_HASH`, and `FLUTTERWAVE_ENVIRONMENT=production` only after live provider acceptance is approved.
- `FLUTTERWAVE_STARTER_PLAN_ID`, `FLUTTERWAVE_GROWTH_PLAN_ID`, `FLUTTERWAVE_SCALE_PLAN_ID`, and the expected USD amounts documented in the [Flutterwave billing runbook](flutterwave-billing.md).
- `PROXIMA_OIDC_CLIENT_ID` and `PROXIMA_OIDC_CLIENT_SECRET` after the Microsoft Entra app registration and callback are configured.

Do not commit secrets, place secret values in public build variables, or paste credentials into documentation or chat. Keep development, staging, and production credentials separate.

### 4. Deploy the Engine

1. Deploy the Engine separately from the management Control Plane.
2. Configure the required upstream PostgreSQL connection, TLS validation, tenant-context validation, and signing keys using the documented runtime contract.
3. Restrict management and metrics endpoints to the intended network.
4. Verify that Engine enforcement continues safely when the Control Plane is unavailable.
5. Run PostgreSQL-backed isolation and adversarial verification tests against the exact deployed Engine and database configuration.

### 5. Deploy the frontend and configure routing

1. Build the frontend with `npm ci`, `npm run lint`, and `npm run build`.
2. Configure the selected host or reverse proxy to route API, identity callback, and email lifecycle paths as required by the application.
3. Configure only the public runtime values needed by the frontend. Never expose Control Plane credentials or provider secrets in client-side environment variables.
4. Verify login, CSRF protection, recovery, invitation acceptance, organization mapping, and sign-out through the real public origin.
5. Confirm that static assets, documentation routes, and unknown routes behave correctly and that API errors are not rewritten into HTML success responses.

### 6. Accept billing, identity, and email

- **Flutterwave:** configure the webhook at `https://<approved-api-domain>/api/v1/webhooks/flutterwave`. Verify the account, distinct plan identifiers, USD amounts, server-side transaction verification, webhook hash, duplicate delivery, and failure paths. Do not enable paid checkout until the live round trip is accepted.
- **Microsoft Entra:** register the exact callback URI for the approved public origin, configure the client ID/secret securely, bind the expected Entra tenant to the correct Agata organization, and test a real sign-in end to end.
- **Transactional email:** verify the sending domain, configure the production sender and API key in the secret store, and test verification, password reset, invitation, and support workflows in the deployed environment.

Use the current provider-specific runbooks for detailed configuration. Historical provider migration files are retained only for migration integrity; they are not current deployment instructions.

## Production acceptance checklist

Do not direct customers to the deployment until each applicable item has evidence:

- [ ] Public domain ownership, DNS, TLS, and hosting plan are verified.
- [ ] Production database migrations apply in order and readiness is healthy.
- [ ] Backup/PITR is enabled and an isolated restore drill records RPO/RTO.
- [ ] Engine tenant-isolation and adversarial tests pass against the deployed configuration.
- [ ] API routing, cookies, CSRF, OIDC callback, recovery, and invitation flows pass end to end.
- [ ] Flutterwave checkout, transaction verification, signed webhook, currency/amount, duplicate delivery, failure, and entitlement transitions pass in the intended live environment.
- [ ] Transactional email delivery and support routing are verified.
- [ ] Monitoring, alert delivery, incident ownership, rollback, and restore procedures are tested.
- [ ] Security claims match implemented controls and the available evidence; no compliance claim is inferred from a PDF or CI result alone.

Repository CI is necessary but does not establish provider approval, deployed security, live billing, public DNS, or production recovery readiness.
