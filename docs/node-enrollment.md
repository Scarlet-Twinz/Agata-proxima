# Secure Node Enrollment and Identity

This guide describes the node registration and one-time bootstrap flow in Agata Proxima, including the Command Center, Control Plane API, Engine environment, identity persistence, token rotation and common failures.

## How enrollment works

1. An authorized organization member registers a node in **App → Nodes**.
2. The Control Plane returns a node UUID and a one-time enrollment token. The token is shown only when created.
3. The operator supplies the node UUID, enrollment endpoint and token to the Engine process environment.
4. On startup, the Engine calls `POST /api/v1/nodes/enroll`. The Control Plane checks the token hash, expiry, single-use state and node UUID.
5. The Control Plane generates a 32-byte node signing credential, encrypts it using AES-256-GCM with the configured enrollment encryption key, and returns it once.
6. The Engine validates the response and saves the node identity JSON at its configured identity path. Later starts reuse that identity rather than consuming another token.

The Control Plane manages enrollment and inventory; the Engine remains the runtime PostgreSQL enforcement component.

## Prerequisites

- A running Control Plane and its PostgreSQL database.
- A signed-in user with write permission in the intended organization.
- `PROXIMA_NODE_ENROLLMENT_ENCRYPTION_KEY` configured on the Control Plane.
- The Proxima Engine binary built from this repository.
- A private, reachable Control Plane URL from the node host.
- A separate tenant-context signing key when tenant enforcement is required.

## 1. Configure the Control Plane encryption key

The key must decode from exactly **64 hexadecimal characters (32 bytes)**. Generate a random value and store it in the deployment secret store. Do not reuse the tenant-context signing key or the generated node signing credential.

PowerShell generation example:

```powershell
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$env:PROXIMA_NODE_ENROLLMENT_ENCRYPTION_KEY = [BitConverter]::ToString($bytes).Replace("-", "").ToLowerInvariant()
$rng.Dispose()
```

Bash generation example:

```bash
openssl rand -hex 32
```

The Bash command prints the key; transfer it directly to your secret manager. For local development, make the variable available to the Control Plane process before startup or load it through the local environment configuration used by that startup. For Docker Compose, configure the local environment source used by Compose. Never commit `.env` or the generated key.

The key encrypts node credentials at rest in the Control Plane database. If it is missing or invalid, enrollment fails rather than storing an unencrypted signing key.

## 2. Register a node

1. Sign in to the Agata Proxima Command Center.
2. Open **Nodes**.
3. Enter a descriptive name, environment (`production`, `staging`, or `development`) and region (or `auto`).
4. Select **Register node**.
5. Copy the displayed node ID and enrollment configuration immediately. The token is a secret and cannot be retrieved later from the list endpoint.

The UI prepares these PowerShell variables with values for the new node:

```powershell
$env:PROXIMA_NODE_ID = "<node-uuid>"
$env:PROXIMA_NODE_ENROLLMENT_URL = "https://<control-plane-host>/api/v1/nodes/enroll"
$env:PROXIMA_NODE_ENROLLMENT_TOKEN = "<one-time-enrollment-token>"
```

For local development, the URL can be `http://127.0.0.1:8080/api/v1/nodes/enroll`. Use HTTPS for a remote or production Control Plane.

## 3. Start the Engine

Run the Engine in the same PowerShell session where the variables are set, or inject them into the Engine process through a service manager or secret store. Do not use `setx` for the one-time token.

```powershell
$env:PROXIMA_NODE_ID = "<node-uuid>"
$env:PROXIMA_NODE_ENROLLMENT_URL = "https://<control-plane-host>/api/v1/nodes/enroll"
$env:PROXIMA_NODE_ENROLLMENT_TOKEN = "<one-time-enrollment-token>"

# Set these to your actual listener and PostgreSQL target.
$env:PROXIMA_LISTEN_ADDR = "127.0.0.1:6432"
$env:PROXIMA_UPSTREAM_ADDR = "127.0.0.1:5432"

# Separate key used by the trusted server-side tenant-token signer.
# Required when signed tenant-context enforcement is enabled.
$env:PROXIMA_TENANT_SIGNING_KEY = "<tenant-context-signing-secret-at-least-32-bytes>"

cargo run -p proxima-engine
```

The tenant-context signing key is separate from the Control Plane enrollment encryption key and the generated node signing key. The Engine reads configuration from its process environment; do not assume the Engine automatically loads a plain `.env` file.

After startup, remove the one-time token from the parent PowerShell session:

```powershell
Remove-Item Env:PROXIMA_NODE_ENROLLMENT_TOKEN -ErrorAction SilentlyContinue
```

## 4. Identity persistence and subsequent starts

By default, the Engine stores identity at:

- Windows: `%LOCALAPPDATA%\AgataProxima\node-identity.json`, when `LOCALAPPDATA` exists.
- Other environments: `data/node-identity.json`.

Set `PROXIMA_NODE_IDENTITY_PATH` to choose another location. The parent directory is created on successful enrollment. Protect the file as a credential: it contains the node ID, organization ID and generated signing key.

An existing identity file is loaded before enrollment variables are considered. When enrolling a different node on the same host, set `PROXIMA_NODE_IDENTITY_PATH` to a different file; do not overwrite or delete an identity you still need.

## API reference

| Method and endpoint | Purpose | Authentication |
|---|---|---|
| `GET /api/v1/nodes` | List nodes for the active organization | Session |
| `POST /api/v1/nodes` | Register a node and issue a one-time token | Session, write permission, CSRF |
| `POST /api/v1/nodes/{id}/enrollment-token` | Rotate an unused eligible token | Session, write permission, CSRF |
| `POST /api/v1/nodes/{id}/enrollment` | Mark an organization-owned node as enrolling | Session, write permission, CSRF |
| `POST /api/v1/nodes/enroll` | Consume the token and bootstrap node identity | One-time token in JSON body |

### Register a node

```json
{
  "organization_id": "<organization-uuid-from-your-session>",
  "name": "production-node-01",
  "environment": "production",
  "region": "auto"
}
```

`organization_id` and `name` are required. `environment` defaults to `production`; `region` defaults to `auto`. The successful response includes `id`, `name`, `status: "pending"` and `enrollment_token`. Store the token immediately; subsequent list calls never return it.

### Bootstrap request

The Engine sends this body to `POST /api/v1/nodes/enroll`:

```json
{
  "node_id": "<node-uuid>",
  "enrollment_token": "<one-time-token>"
}
```

The successful response contains `ok`, `node_id`, `organization_id`, `name`, `status`, and `signing_key` (a hex-encoded 32-byte key). The Engine validates the response before persisting the identity.

### Token rotation

Use `POST /api/v1/nodes/{id}/enrollment-token` if the original token is lost or expires before use. The replacement expires after 30 minutes and is returned once. Rotation is allowed only while the node is pending/enrolling, its token is unconsumed, and no signing credential has been stored. An already-enrolled identity cannot be replaced through this endpoint.

### Expected failures

- **401 from bootstrap:** the UUID/token pair is wrong, expired, already consumed, or the node is no longer pending. Register a new node or rotate an eligible unused token.
- **503 / credential encryption error:** configure `PROXIMA_NODE_ENROLLMENT_ENCRYPTION_KEY` as 64 hex characters representing 32 bytes, then restart the Control Plane.
- **Missing Engine variable:** set `PROXIMA_NODE_ID`, `PROXIMA_NODE_ENROLLMENT_URL`, and `PROXIMA_NODE_ENROLLMENT_TOKEN` together.
- **Old identity loads:** set `PROXIMA_NODE_IDENTITY_PATH` to a new path for the new node.
- **Connection failure:** verify URL, DNS, port/proxy routing, TLS certificate and the `/api/v1/nodes/enroll` path.

## CLI and automation

This repository does not provide a separate `proxima-node enroll` CLI binary. The supported bootstrap entry point is Engine startup: `cargo run -p proxima-engine` or the built Engine executable with the same environment variables. Use the authenticated HTTP API for registration and token rotation. Keep tokens out of command history, CI logs, screenshots and shell transcripts.

For signed evidence and its verifier, see [Monitor, Breaker, Attest, and Verify](production/proxima-four-pillars.md). For the full HTTP contract, see [the OpenAPI document](../control-plane/openapi.json) and [the developer guide](developer-guide.md).
