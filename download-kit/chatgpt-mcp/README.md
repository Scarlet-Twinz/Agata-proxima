# ChatGPT / MCP connector starter

This folder now contains a runnable, stateless Streamable HTTP MCP server example. It exposes three read-only tools: `agata_health`, `agata_list_plans`, and `agata_list_tenants`. It is a starter implementation, not an already deployed Agata service or a pre-connected ChatGPT app.

## 1. Install and configure

Use Node.js 22 or newer. For the hosted Agata Proxima service, use `https://api.agataproxima.com`; for a self-hosted deployment, use that deployment’s API origin. From the extracted kit root:

```bash
npm install
export AGATA_API_BASE_URL="https://api.agataproxima.com"
export AGATA_API_KEY="aga_LOAD_FROM_A_SECRET_STORE"
export AGATA_MCP_ACCESS_TOKEN="GENERATE_A_RANDOM_SECRET_AT_LEAST_32_CHARACTERS"
npm run mcp
```

PowerShell:

```powershell
$env:AGATA_API_BASE_URL = "https://api.agataproxima.com"
$env:AGATA_API_KEY = "aga_LOAD_FROM_A_SECRET_STORE"
$env:AGATA_MCP_ACCESS_TOKEN = "GENERATE_A_RANDOM_SECRET_AT_LEAST_32_CHARACTERS"
npm run mcp
```

The Agata API key remains server-side. The separate MCP access token protects this example endpoint. Do not commit either secret or expose them in browser variables.

## 2. Verify locally

```bash
curl http://127.0.0.1:8787/healthz
```

The MCP endpoint is `http://127.0.0.1:8787/mcp` for local protocol testing. Calls to `/mcp` without the configured bearer token must return `401`. Use the MCP Inspector or another MCP client configured with the bearer token to enumerate and call the three read-only tools.

## 3. Connect ChatGPT

ChatGPT cannot reach a developer's `localhost`. Deploy the MCP server to a publicly reachable HTTPS endpoint first, set both secrets in the hosting provider's secret manager, and test its TLS certificate and authorization boundary. Then add the HTTPS `/mcp` endpoint in the ChatGPT connector/app configuration available to your account and configure its supported authentication method. For a production connector, prefer the supported OAuth flow or a managed authenticated gateway; do not assume a static bearer token is accepted by every ChatGPT connector configuration.

## Security boundary

- The Agata API key is an organization-scoped server credential; use a dedicated least-privilege key.
- The example exposes read-only tools only. Add no mutation tools without schema validation, permission checks, confirmation and audit handling.
- Put the MCP endpoint behind HTTPS, rate limits and appropriate access controls before exposing it publicly.
- Test valid access, missing/invalid credentials, expired/revoked credentials and cross-organization denial.
- Never connect an assistant directly to PostgreSQL or pass browser session cookies to the model.
