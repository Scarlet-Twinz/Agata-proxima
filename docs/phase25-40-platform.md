# Agata Proxima — Phases 25–40

Release train: platform foundation / verification gate

This release moves Proxima from a hardened engine plus operator dashboard into a product-shaped management and deployment platform.

## Non-negotiable invariant

**The Proxima Engine is the enforcement authority for the live data plane.**

The control plane can publish policy, observe fleet state, and coordinate deployment. It cannot become a per-query authorization dependency.

If the control plane is unavailable:
- existing engine sessions continue according to their local lifecycle rules;
- tenant enforcement remains local;
- PostgreSQL remains behind the same boundary;
- the engine records degraded control-plane health;
- new policy/configuration is accepted only after local validation.

This follows the control/enforcement separation used in zero-trust architectures: the management/control layer configures enforcement points, while the enforcement point controls the live resource path.

## Phase gates

25 — Production Deployment Architecture: containerized engine and control-plane images, explicit ports, read-only roots, non-root users, health checks, persistent control-plane state, and a development compose topology.

26 — Control Plane Foundation: authenticated API, durable local development state, OpenAPI contract, health and overview endpoints.

27 — Organization & Tenant Management: organizations, projects, environments and tenant lifecycle are explicit domain objects. The production schema includes membership and tenant ownership boundaries.

28 — Fleet / Node Identity: fleet nodes have stable UUIDs, project association, region, version, status and last-seen state. Production enrollment is reserved for the signed enrollment channel.

29 — Policy Management Plane: policies have versions, modes and status. The control plane manages policy intent while the engine remains the enforcement authority.

30 — Audit & Security Event Plane: tenant, policy, authentication and fleet actions produce structured audit events. Production schema is organization-scoped.

31 — Proxima API: the API is versioned under /api/v1 and documented in control-plane/openapi.json.

32 — Dashboard → Control Plane: the Proxima console reads the control-plane API and presents tenants, policies, fleet and audit state. Authentication uses server-side sessions rather than browser localStorage credentials.

33 — Deployment Lifecycle: enroll → validate → configure → healthy → running → update → rollback → retire.

34 — External SaaS Integration v2: the existing three-tenant harness remains the verification foundation. A real external application is an acceptance gate outside the repository until deployed and connected.

35 — Failure Engineering: control-plane loss, database loss, stale policy, certificate expiry, partial deployment and node disappearance are treated as security properties.

36 — Performance Engineering: measure throughput, concurrent sessions, connection overhead, memory per connection, policy evaluation and recovery time. No unmeasured performance number is a product claim.

37 — Security Red Team: attack browser/authentication, API authorization, fleet identity, policy distribution, parsing, tenant binding, TLS, PostgreSQL roles and RLS.

38 — Production Readiness: secrets, TLS, backups, recovery, observability, dependency updates, rate limits, session controls, quotas, audit retention and incident response.

39 — Developer Experience: product homepage, architecture, pricing, support, authentication and console surfaces are now present alongside API contracts.

40 — Private Beta Foundation: the product surface is ready for controlled evaluation with claims limited to capabilities that are implemented and testable.

## Intentionally not claimed

The hosted production cloud, external identity provider, managed billing, Gmail/Resend support workflow, production fleet enrollment, and a real external SaaS deployment are not represented as completed merely because their UI or contracts exist. Each requires its own integration and acceptance gate.
