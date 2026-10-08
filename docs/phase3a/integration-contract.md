# Customer Integration Contract

## Organization

Every integration, environment, database boundary, tenant context, policy binding, migration run and audit event is owned by an organization.

The authenticated session supplies the active organization. Resource APIs must never accept an organization identifier and silently use it to escape the active membership.

## Integration

Create an integration through the authenticated control plane. The API returns the full credential only at creation/rotation time.

Persisted state contains the credential hash and prefix, never the full credential.

Lifecycle:

1. create;
2. configure;
3. rotate;
4. revoke;
5. deactivate;
6. audit.

## Environment

Each organization has explicit Development, Staging and Production environments.

Each environment has:

- stable identity;
- mode;
- status;
- configuration;
- deployment state;
- verification state;
- database boundary;
- environment-bound integration credentials.

Production defaults to enforcement mode. Staging defaults to shadow mode. Development defaults to development mode.

## PostgreSQL

The customer database contract is:

- host;
- port;
- database;
- username;
- password;
- TLS mode.

The control plane validates the connection before reporting it as healthy. Production should use `verify-full`; `disable` is a local-development option only.

Passwords are encrypted with PostgreSQL pgcrypto using `AGATA_SECRET_ENCRYPTION_KEY`. The encryption key is a deployment secret and is not stored in the database.

## Tenant context

The control plane issues a short-lived signed context containing:

- organization;
- tenant;
- environment;
- integration;
- expiration;
- unique request identifier.

The context is HMAC signed with `PROXIMA_CONTEXT_SIGNING_KEY`. Issuances are tracked server-side so replay can be detected.

The control plane is not the data-plane enforcement authority. The Proxima Engine remains authoritative for live tenant enforcement.
