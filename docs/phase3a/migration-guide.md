# Customer Migration Guide

Use the following sequence for an existing application:

1. Create the organization-owned integration.
2. Configure Development.
3. Configure and validate the Development PostgreSQL boundary.
4. Discover existing tenants.
5. Map every source tenant to an Agata tenant.
6. Validate policy compatibility.
7. Run preflight.
8. Configure Staging.
9. Validate Staging PostgreSQL.
10. Run positive and negative verification.
11. Perform a canary.
12. Move to Production enforcement only after the verification evidence is acceptable.

## Rollback principle

Do not mutate the source environment merely to begin migration.

A failed preflight or canary must leave the source environment usable. Rollback returns the integration to the previously verified environment/mode and preserves the audit trail.

## Preflight

The migration preflight checks:

- source environment exists;
- target environment exists;
- active tenants exist;
- target PostgreSQL is connected.

The report is persisted with the migration run and recorded in organization-scoped audit evidence.
