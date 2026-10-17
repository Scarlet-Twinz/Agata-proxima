# Agata Proxima JavaScript SDK

Server-side JavaScript client for the versioned Agata Proxima Control Plane API.

## Requirements

- Node.js 22 or newer.
- An Agata Proxima API origin.
- An organization-scoped API key created in the Agata dashboard.

## Install (after publishing)

```sh
npm install @agata-proxima/sdk
```

## Configure

Keep API credentials on the server. Never expose `AGATA_API_KEY` in browser code or a public frontend environment variable.

```sh
AGATA_API_BASE_URL=https://api.example.com
AGATA_API_KEY=aga_...
```

## Example

```js
import { AgataClient } from "@agata-proxima/sdk";

const agata = new AgataClient();
console.log(await agata.health());
console.log(await agata.listEnvironments());
```

The client supports the versioned endpoints implemented by the control plane. It does not bypass server-side authorization and uses the organization associated with the API key. See the repository's integration starter kit for endpoint-specific examples and webhook verification guidance.

## Publishing

Publishing requires an authorized npm account/token and ownership of the `@agata-proxima` scope. CI should run `npm test` and `npm pack --dry-run` before a maintainer publishes. This repository change does not claim that the package has already been published.
