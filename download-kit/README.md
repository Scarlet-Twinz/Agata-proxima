# Agata Proxima Integration Starter Kit

This integration kit contains a server-side JavaScript API client, a Node.js CLI, request examples and integration templates for the Agata Proxima Control Plane. The CLI supports read operations plus explicit environment and webhook lifecycle commands; it is source-distributed, not a precompiled standalone binary. The separately packaged SDK source is in packages/javascript-sdk/. A Terraform provider source is in terraform-provider-agata/; it is not yet published to the Terraform Registry. The MCP server is an example that must be deployed and protected.

## Requirements

- Node.js 22 or newer for the Node examples.
- An Agata Proxima control-plane API origin for the target environment.
- An organization-scoped API key created by an authorized user. The key is shown only at creation time and begins with `aga_`.
- Synthetic test data and a non-production environment for acceptance tests.

## Configure

Set these environment variables in your terminal or secret manager:

- `AGATA_API_BASE_URL`: control-plane origin, for the hosted service, `https://api.agataproxima.com`; use your deployed API origin for a self-hosted installation.
- `AGATA_API_KEY`: organization-scoped API key; keep it server-side.

Do not put `AGATA_API_KEY` in a browser variable, commit it to Git, or include it in logs.

## Contents

- `node/agata-client.mjs`: server-side client with JSON handling, request timeouts, HTTP error details and methods for tenants, policies, nodes, deployments, verification records, audit, service-account inventory, webhook lifecycle and environment registry CRUD.
- `node/example.mjs`: health, plan catalogue and tenant-list example.
- `cli/agata.ps1`: PowerShell API smoke commands.
- `cli/agata.sh`: Bash API smoke commands.
- `webhooks/receiver-example.mjs`: raw-body HMAC-SHA256 signature verification, timestamp checks, a 1 MiB request limit and process-local duplicate suppression. Its in-memory deduplication resets on restart; use a durable unique delivery record before production business processing.
- `integrations/supabase-edge-function.example.ts` and `integrations/supabase-membership.sql`: authenticated Edge Function with a trusted organization-membership check and the matching RLS-protected membership table.
- `integrations/firebase-admin.example.ts` and `integrations/firebase-membership.rules`: Firebase ID-token verification, trusted organization-membership lookup and a server-side Agata API request.
- `terraform/README.md`: supported Terraform provider resource scope, source build/test instructions and release limitations.
- `chatgpt-mcp/server.mjs`: runnable Streamable HTTP MCP server example with three read-only tools; it must be deployed and protected before connecting to ChatGPT.
- `github-actions/agata-smoke.yml`: copyable workflow template for running the API smoke checks from GitHub Actions.
- `vercel/README.md`: Vercel environment, secret-handling and deployment acceptance steps.
- `chatgpt-mcp/README.md`: install, test and deploy the MCP example; production ChatGPT configuration requires an HTTPS endpoint and supported authentication.

## Run the CLI

```bash
npm ci
npm run cli -- --help
npm run cli -- environments list
npm run cli -- webhooks list
```

Environment and webhook write commands are explicit and still pass through server-side authorization. API-key and service-account administration remains in the authenticated dashboard.

## JavaScript SDK

The package source is in `../packages/javascript-sdk/`. Run `npm test` there. The package is not yet published; a reviewed `sdk-v*` tag and authorized `NPM_TOKEN` are required for the release workflow.

## Run the Node example

```bash
node node/example.mjs
```

## Acceptance checklist

1. Confirm `/api/v1/health` returns `status: ok`.
2. Confirm `/api/v1/billing/plans` returns the plan catalogue.
3. Call an authenticated endpoint and confirm the key is scoped to the expected organization.
4. Confirm an invalid or revoked key returns 401.
5. Confirm a caller cannot access another organization's resources.
6. Test webhook signatures with a valid body, altered body, invalid signature, duplicate delivery ID and timestamp outside the accepted tolerance.
7. Create a development or staging environment in Developer → Environments, list it through the API/CLI, disable it, re-enable it, and confirm a node cannot be registered into a disabled environment.
8. Keep logs sanitized and rotate credentials after any exposure.

The API and webhook contracts in the deployed environment remain authoritative. Run the tests against the target version before using examples for operational automation.
