# Agata Proxima Frontend

The frontend is the React and TypeScript workspace for the Agata Proxima public site, authentication flows and customer dashboard. It uses Vite for local development and production builds.

## Requirements

- Node.js 24
- npm
- A running Agata Proxima Control Plane, or the configured API origin for the environment you are testing

## Install and run

From this directory:

```bash
npm ci
npm run dev
```

The local Vite server serves the frontend. For a local Control Plane on `http://127.0.0.1:8080`, set `VITE_API_BASE_URL=http://127.0.0.1:8080` in `.env.local` when using a separate API origin. Leave the variable empty when the frontend is served through a same-origin API proxy.

## Quality checks

```bash
npm run build
npm run lint
```

From the repository root, run the public content, route and dashboard acceptance checks:

```bash
node scripts/verify-public-content.mjs
node scripts/verify-public-dashboard.mjs
```

## Authentication and secrets

Human sign-in uses the HTTP-only `proxima_session` cookie and a CSRF token for state-changing requests. The “Keep me signed in” choice controls the server session lifetime. Do not put API keys, database passwords, webhook secrets or OAuth client secrets in `VITE_*` variables: Vite bundles those values into browser-accessible code.

## Local Docker troubleshooting

Run these commands from the repository root:

```bash
docker compose ps -a
docker compose logs --tail=200 proxima-control control-postgres
docker compose exec control-postgres pg_isready -U proxima_control -d proxima_control
curl -fsS http://127.0.0.1:8080/api/v1/health
```

The Control Plane database is exposed on host port `55443` by default. If logs are empty, inspect `docker compose ps -a` first; a service that never created a container has no logs. See [the usage guide](../docs/usage.md) for the complete operating workflow.
