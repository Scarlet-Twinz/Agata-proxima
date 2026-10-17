# Developer platform operations

## Environments: when to create one

An environment is a named stage inside one organization, such as development, staging or production. Create it when you have a real separate stage or node group to register. You do **not** need an environment just to create an API key.

The environment registry is used by node registration and provides consistent stage metadata. It does not provision a new API deployment, database, network or secret store. API keys and webhook subscriptions remain organization-scoped. A service account can be associated with an environment for ownership/context, but that association is not an isolation boundary.

Recommended setup:
1. Create the environment records you actually use (for example, `development`, `staging`, `production`).
2. Configure each runtime's `AGATA_API_BASE_URL` to the real Control Plane origin for that stage.
3. Create a service account for each backend integration, optionally associating it with a stage.
4. Create an API key and link it to the service account.
5. Store the key in that runtime's server-side secret store; never put it in frontend variables.
6. Register nodes against the correct environment and test the actual runtime path.

Disabling a service account blocks authentication for its linked keys. Deleting a service account revokes its linked keys. Deleting an environment may be refused while registered nodes reference it; disable it instead.

## Webhook encryption key

The Control Plane requires `AGATA_WEBHOOK_ENCRYPTION_KEY` to encrypt webhook signing secrets at rest. Generate a random value locally, then store it in the local `.env` file or the deployment secret manager. Never commit the generated value.

PowerShell example:

```powershell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$env:AGATA_WEBHOOK_ENCRYPTION_KEY = [Convert]::ToBase64String($bytes)
$env:AGATA_WEBHOOK_ENCRYPTION_KEY
```

Copy the printed value into your local `.env` as `AGATA_WEBHOOK_ENCRYPTION_KEY=...`, then restart the Control Plane so it receives the setting. In production, configure the equivalent secret in the deployment platform rather than a checked-in file.

**Keep this key stable and backed up.** Existing encrypted webhook secrets depend on it; changing it without a planned secret re-encryption/rotation process can make existing signing secrets unreadable. After configuration, create a test webhook, copy its one-time signing secret into the receiver's secret store, send a real audit event, and verify signature validation, delivery status, retries and secret rotation.

## SDK, CLI and Terraform release status

- JavaScript SDK source: `packages/javascript-sdk/`; run `npm test` and `npm pack`. It is not yet published to npm. A reviewed `sdk-v*` tag and authorized `NPM_TOKEN` are required for release.
- CLI: `download-kit/cli/bin/agata.mjs`; source install through the integration kit. It can list resources, manage environments and perform webhook lifecycle operations. API-key and service-account administration stays in the authenticated dashboard.
- Terraform provider source: `terraform-provider-agata/`; the current `agata_environment` resource is not yet published to the Terraform Registry. It manages environment records only; it does not provision infrastructure or secrets.

CI verifies source and tests. Registry publication is a separate reviewed release action.
