# Agata Proxima JavaScript SDK

Server-side SDK for Node.js 22+. Source package is in this directory. It wraps the versioned Agata Proxima Control Plane API, including environment and webhook operations.

## Install

The package source is ready for packaging, but is **not yet published to npm**. From this directory, build a tarball:

```bash
npm pack
npm install ./agata-proxima-sdk-0.1.0.tgz
```

After a reviewed `sdk-v*` release tag is published and the repository's `NPM_TOKEN` secret is configured, the release workflow publishes `@agata-proxima/sdk`. Until then, use the source package or tarball.

## Configure

Set these values in a server environment or secret manager. Never put an API key in frontend/browser code or commit it to Git.

```powershell
$env:AGATA_API_BASE_URL = "https://your-control-plane-origin"
$env:AGATA_API_KEY = "aga_your_key"
```

```js
import { AgataClient } from "@agata-proxima/sdk";
const agata = new AgataClient();
console.log(await agata.health());
console.log(await agata.listEnvironments());
```

You may also pass `baseUrl`, `apiKey`, `fetchImpl`, and `timeoutMs` to the constructor. API authorization remains enforced by the server. API keys cannot create or revoke other API keys; those actions require an authenticated dashboard session with the appropriate role.

## Environment and webhook example

```js
const stage = await agata.createEnvironment({
  name: "Staging",
  slug: "staging",
  description: "Pre-production verification",
});
const webhook = await agata.createWebhook({
  name: "Audit receiver",
  endpoint_url: "https://your-app.example/webhooks/agata",
  events: ["*"],
});
// Store webhook.signing_secret in your secret manager immediately.
// The full secret is only returned at creation/rotation.
const deliveries = await agata.listWebhookDeliveries(webhook.id);
```

Methods cover health/session/plans; tenant, policy, node, deployment and verification resources; audit events; environment create/list/update/delete; webhook create/list/get/delete; delivery history/retry; signing-secret rotation; and enable/disable. All organization and permission checks remain server-side.

## Verify

```bash
npm test
npm run check
```
