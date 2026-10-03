# External SaaS Reference Application

This is a deliberately small **real application process** used to exercise Agata Proxima from outside the Proxima repository's internal SQL harness.

Topology:

```
HTTP client / SaaS user
        |
        v
External SaaS reference app
        |
        | PostgreSQL startup option:
        | proxima_tenant_token=<signed token>
        v
Agata Proxima Engine
        |
        v
PostgreSQL
```

The application owns the HTTP/API layer. Proxima owns the database tenant boundary.

## Run

Requirements:

- Node.js 22+
- PostgreSQL reachable through the Proxima Engine
- `DATABASE_URL` pointing at the Engine's PostgreSQL-compatible endpoint

```powershell
$env:DATABASE_URL="postgres://proxima:YOUR_PASSWORD@127.0.0.1:6432/proxima_dev"
npm install
npm start
```

The app listens on `127.0.0.1:8788` by default.

## Tenant context

The reference app accepts the signed tenant context in:

```
X-Proxima-Tenant-Token: <signed-token>
```

It does **not** validate the token itself. That is intentional: the Engine is the security boundary.

A real SaaS should derive this token from its authenticated tenant context and keep the signing key out of the browser.

## Acceptance

From another terminal:

```powershell
$env:PROXIMA_VERIFY_SIGNING_KEY="..."
$env:EXTERNAL_SAAS_URL="http://127.0.0.1:8788"
bash tests/external-saas/verify_reference_app.sh
```

The acceptance script checks:

- A sees A;
- B sees B;
- C sees C;
- A cannot query B;
- B cannot query C;
- C cannot query A;
- invalid/expired tenant context is rejected by the Engine;
- the application itself remains unaware of PostgreSQL RLS details.

Do not expose this reference app publicly. It is a deterministic acceptance fixture, not a production SaaS.
