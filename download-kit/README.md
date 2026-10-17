# Agata Proxima Integration Starter Kit

This integration kit contains implementation examples for connecting a server-side application to the Agata Proxima control-plane API and receiving signed Agata webhooks. It is an example bundle, not a published npm SDK, standalone CLI binary, Terraform provider or an already-deployed ChatGPT/MCP integration.

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

- `node/agata-client.mjs`: small server-side fetch client.
- `node/example.mjs`: health, plan catalogue and tenant-list example.
- `cli/agata.ps1`: PowerShell API smoke commands.
- `cli/agata.sh`: Bash API smoke commands.
- `webhooks/receiver-example.mjs`: raw-body HMAC-SHA256 signature verification example.
- `integrations/supabase-edge-function.example.ts` and `integrations/supabase-membership.sql`: authenticated Edge Function with a trusted organization-membership check and the matching RLS-protected membership table.
- `integrations/firebase-admin.example.ts` and `integrations/firebase-membership.rules`: Firebase ID-token verification, trusted organization-membership lookup and a server-side Agata API request.
- `terraform/README.md`: provider design and acceptance checklist; no Terraform provider binary is included.
- `chatgpt-mcp/server.mjs`: runnable Streamable HTTP MCP server example with three read-only tools; it must be deployed and protected before connecting to ChatGPT.
- `github-actions/agata-smoke.yml`: copyable workflow template for running the API smoke checks from GitHub Actions.
- `vercel/README.md`: Vercel environment, secret-handling and deployment acceptance steps.
- `chatgpt-mcp/README.md`: install, test and deploy the MCP example; production ChatGPT configuration requires an HTTPS endpoint and supported authentication.

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
7. Keep logs sanitized and rotate credentials after any exposure.

The API and webhook contracts in the deployed environment remain authoritative. Run the tests against the target version before using examples for operational automation.
