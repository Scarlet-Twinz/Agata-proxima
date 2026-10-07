# @agata-proxima/node

Reference Node/TypeScript integration helper for Agata Proxima.

## Responsibility boundary

The SDK does not authenticate users, decide application authorization, or own tenant identity. The customer application supplies a signed tenant token produced by its trusted server-side integration.

The helper attaches that token to the PostgreSQL connection as the Proxima startup option:

`-c proxima_tenant_token=<signed-token>`

This lets an existing Node/TypeScript application keep its normal PostgreSQL driver while routing the connection through Proxima.

## Security

- Use only from trusted server-side code.
- Never expose signed tenant tokens or signing credentials to browser code.
- Never commit signing material.
- Rotate signing material according to the deployment runbook.
- Treat a failed Proxima verification as a deployment blocker.

The package is a reference integration component; production acceptance still requires the three-tenant external SaaS verification suite.
