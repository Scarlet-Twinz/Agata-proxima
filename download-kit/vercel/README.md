# Vercel integration

Use Vercel to host the frontend and/or server-side integration endpoints. The browser frontend may use `VITE_API_BASE_URL` for the public API origin. Never place `AGATA_API_KEY`, database credentials, webhook signing keys, or OAuth client secrets in `VITE_*` variables: Vite bundles those variables into browser assets.

## Configure

1. Import the application repository into Vercel and set the correct root directory for the frontend.
2. Configure `VITE_API_BASE_URL` for Preview and Production separately.
3. Store any server-side `AGATA_API_BASE_URL` and `AGATA_API_KEY` in server-only environment variables for a backend route or function; do not use the frontend-prefixed names for secrets.
4. Configure the API CORS allowlist, cookie domain/SameSite/Secure settings, HTTPS domain and identity-provider callback URLs for the actual deployment.
5. Run the frontend build, then test login, session persistence, organization-scoped reads, and denied access using a non-production organization.
6. Deploy the MCP example separately if using ChatGPT; configure its public HTTPS endpoint and authentication before adding it to a ChatGPT connector.

Vercel does not automatically connect an Agata account, create API credentials, or deploy the MCP server simply because this starter kit is downloaded. Those steps require the customer's project access and environment configuration.
