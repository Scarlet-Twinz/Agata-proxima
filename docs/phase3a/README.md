# Phase 3A — Customer Integration Foundation

Phase 3A is the customer-integration foundation for Agata Proxima. It is not a cosmetic dashboard milestone.

The contract covers organization lifecycle, team access, integrations, environments, PostgreSQL connection safety, tenant context, customer integration modes, migration planning, the integration contract, Proxima enforcement, policies, verification, audit evidence, the control-plane boundary, the real Command Center, the Developer Portal and the external SaaS reference workload.

## Production invariants

- Organization is the first security boundary.
- Every customer resource is resolved through the authenticated organization context.
- Production, staging and development are explicit environment identities.
- Customer database passwords are encrypted at rest and never returned by APIs.
- Integration credentials are one-time secrets; only hashes and prefixes persist.
- Environment credentials are distinct and organization-scoped.
- Tenant context is short-lived, signed, organization-bound and replay-protected.
- The control plane records intent/evidence; Proxima Engine remains the runtime enforcement authority.
- Audit evidence is organization-scoped and carries a correlation identifier.
- No secret belongs in frontend code, logs, audit metadata, source control or API responses after one-time issuance.

## Acceptance

Repository CI proves build, tests, lint, migration application, OpenAPI validity, RLS verification, operational-script syntax and the existing launch gates.

External acceptance still requires real customer infrastructure and real external services. Repository code never substitutes for DNS, email-provider verification, real customer PostgreSQL, or a real multi-tenant deployment.
