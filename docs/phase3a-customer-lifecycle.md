# Phase 3A — Customer lifecycle acceptance

Phase 3A is the customer-facing foundation from 3.0 through 3.20. This document is the implementation contract, not a claim that external production deployment has already occurred.

## Routing boundaries

- Public website: public routes and public documentation.
- Authentication: login, signup, recovery, verification, invitations.
- Command Center: authenticated organization-scoped management UI.
- Customer lifecycle: project → environment → integration → tenant → verification.
- Proxima Engine: runtime data-plane authority for tenant isolation.
- PostgreSQL: protected data store behind the Engine.
- Resend: transactional email transport and domain authentication.
- Paystack: Phase 3B billing provider; not part of Phase 3A runtime authority.

## 3.0 Baseline and repository control

The Phase 3A branch is isolated from main. Acceptance requires repository quality checks, frontend lint/build, migration validation, API contract validation, and explicit review of external-only gates.

## 3.1 Organization lifecycle

Organizations are authenticated and organization-scoped. Signup creates the initial organization and owner membership. Additional organizations can be created by authorized users and receive an entitlement record.

## 3.2 Team and access

Memberships are organization-scoped with owner/admin/operator/viewer roles. Invitations are organization-scoped, expiring, and auditable.

## 3.3 Project model

Projects are explicit customer resources. Creating a project automatically creates its canonical Production environment. Tenants remain attached to projects rather than being global resources.

## 3.4 Environment model

Environments are first-class project resources with development, staging, and production kinds. Existing projects are backfilled with Production. Environment state is persisted and organization-scoped.

## 3.5 PostgreSQL

PostgreSQL remains the customer data store. Agata does not replace the customer's application database model. Proxima is the protected connection boundary.

## 3.6 Tenant model

Tenants are project-scoped and isolated by the Proxima enforcement boundary. Tenant inventory is organization-scoped in the Control Plane.

## 3.7 Identity to tenant context

Customer authentication remains the customer's responsibility. Proxima receives signed tenant context at the database boundary and binds it to the protected session.

## 3.8 Customer integration model

An integration installation is a first-class Control Plane resource tied to a project and optional environment.

## 3.9 SDK / middleware integration

The customer keeps application and business logic. Integration modes are explicitly represented as Engine, SDK, or Proxy. The repository documentation defines the tenant-context boundary without requiring a customer to rebuild authentication.

## 3.10 Integration modes

- Engine: Proxima runs as the database enforcement boundary.
- SDK: the application uses an integration library to establish trusted context before protected operations.
- Proxy: the application connects through a dedicated Proxima database boundary.

The exact runtime implementation for each mode must be validated against the customer's actual stack before production acceptance.

## 3.11 Migration strategy

Development → staging → canary → production is the required promotion path. Existing applications should first prove positive and negative tenant isolation without changing business authorization.

## 3.12 Integration contract

The canonical contract is:

Customer application → Agata integration → Proxima Engine → PostgreSQL.

The Control Plane manages desired state and evidence but is not a per-query runtime dependency.

## 3.13 Proxima enforcement

The Engine remains the runtime authority. A Control Plane outage must not disable an already-running Engine's local tenant boundary.

## 3.14 Policy engine

Policies remain organization-scoped, versioned, auditable resources. Enforcement decisions are owned by the Engine boundary.

## 3.15 Verification engine

Verification results are stored as evidence with pass/fail/review/running states. Production acceptance requires actual three-tenant execution, not a UI status.

## 3.16 Audit evidence

Administrative and verification actions are written to organization-scoped audit history. Evidence must be attributable to a resource and actor where applicable.

## 3.17 Control Plane ↔ Proxima contract

The Control Plane expresses desired state, enrollment, deployment, verification, audit, and customer management. The Engine enforces runtime isolation independently.

## 3.18 Command Center

The Command Center is an authenticated client of the API. It must not manufacture telemetry. Empty/error states are explicit. Project, environment, and integration lifecycle pages are separate routes rather than a single overloaded page.

## 3.19 Developer Portal

The authenticated developer area exposes integration quickstart, tenant-context guidance, API reference, webhooks, SDK/CLI/Terraform documentation, and environment/integration lifecycle navigation.

## 3.20 Reference Customer SaaS

The repository includes a three-tenant reference SaaS and acceptance harness. A repository test is not a substitute for a real external runtime acceptance. Production acceptance still requires A/B/C traffic, cross-tenant attacks, prepared statements, transactions, connection reuse, credential rotation, Engine restart, Control Plane outage, and evidence comparison.

## External completion boundary

The following are intentionally external and cannot be honestly marked complete from repository changes alone:

1. Production hosting and public HTTPS.
2. agataproxima.com DNS.
3. Resend DNS verification and real email delivery.
4. A real customer database connection through Proxima.
5. A real external SaaS acceptance run.
6. Independent security assessment.

Those gates belong to operational acceptance and are never represented as fake green repository state.
