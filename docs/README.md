# Documentation

Use this index to find the right guide for the task. Product documentation focuses on how Agata Proxima is designed and operated; acceptance and production runbooks identify checks that still require explicit evidence.

## Product and architecture

- [Architecture](architecture.md) — major components and trust boundaries.
- [Product vision and roadmap](product/product-vision-and-roadmap.md) — product pillars, design principles, acceptance criteria, and execution checkpoints.
- [Cloud and control plane](cloud.md) — management-plane overview.
- [Connection lifecycle](connection-lifecycle.md) — PostgreSQL connection behavior.

## Setup and integration

- [Usage guide](usage.md) — local setup and common workflows.
- [Developer guide](developer-guide.md) — APIs and developer-facing integration.
- [Customer integration](customer-integration.md) — connecting an existing SaaS application.
- [Secure node enrollment](node-enrollment.md) — registration, bootstrap tokens, identity persistence, and rotation.
- [External SaaS integration](external-saas.md) — integration overview.
- [Webhook development](developer-webhooks.md) — webhook contracts and handling.

## Security and verification

- [Threat model](threat-model.md) — assumptions, risks, and boundaries.
- [Verification](verification.md) — security checks and evidence.
- [Adversarial verification](adversarial-verification.md) — negative and abuse-case testing.
- [Failure engineering](failure-engineering.md) — expected behavior under dependency and runtime failures.
- [TLS](tls.md) — client and upstream database transport security.
- [Security policy](../SECURITY.md) — vulnerability reporting.

## Operations and production

- [Performance engineering](performance.md) — reproducible measurement guidance.
- [Production readiness](production-readiness.md) — readiness criteria.
- [Release readiness](release-readiness.md) — release checks.
- [Production hardening](production-hardening.md) — hardening requirements.
- [Deployment architecture](production/deployment-architecture.md) — deployment topology.
- [Deployment runbook](production/phase55-deployment-runbook.md) — environment and deployment requirements.
- [Operational readiness](production/operational-readiness-runbook.md) — health, backups, recovery, monitoring, and incident response.
- [Four-pillar runbook](production/proxima-four-pillars.md) — Monitor, Breaker, Attest, and verification operations.
- [Launch work map](production/remaining-launch-work-map.md) — remaining launch dependencies and acceptance work.

## Identity and billing

- [Microsoft Entra OIDC](identity/microsoft-entra-oidc.md) — identity-provider configuration and activation gates.
- [Pricing and entitlements](billing/pricing-and-entitlements.md) — monthly prices, plan capacity, and billing acceptance gates.
- [Historical Phase 3.22 entitlement record](billing/phase3-22-entitlement-contract.md) — earlier repository acceptance snapshot; not current provider setup instructions.
- [Flutterwave billing](production/flutterwave-billing.md) — billing configuration and activation gates.
- [Transactional email](production/phase3-23-resend-transactional-email.md) — email delivery setup and verification.

## API reference

- [OpenAPI specification](../control-plane/openapi.json) — machine-readable Control Plane API contract.

**Status note:** Documentation describes intended behavior and verification procedures. Treat a capability as accepted only when the linked implementation, tests, and environment-specific evidence support it.
