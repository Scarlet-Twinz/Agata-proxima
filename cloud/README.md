# Proxima Cloud Control Plane Architecture

This document defines the hosted control-plane architecture for Proxima Engine fleets and the acceptance requirements for a customer-facing deployment.

## Responsibility boundary

```text
Hosted Control Plane
  ├── authenticated control channel
  ├── fleet identity and enrollment
  ├── policy distribution
  ├── verification history
  ├── audit events
  ├── deployment state
  └── organization and team access
          |
          v
     Proxima Engine
          |
          v
      PostgreSQL
```

## Required service capabilities

1. Organization and project identity with enforced tenant scope.
2. Engine enrollment using short-lived, single-use credentials.
3. Signed policy and configuration bundles.
4. Durable verification results.
5. Append-only, organization-scoped audit records.
6. Role-based access control and session protection.
7. Credential rotation and revocation.
8. Fleet health and version reporting.
9. Deployment and rollback state.
10. API and dashboard authentication.
11. Database migrations, backups and recovery procedures.
12. Operational health, readiness and alerting.

## Deployment acceptance

Before exposing a hosted endpoint to customers, verify authentication and authorization, persistent storage, organization isolation, secure cookie and TLS configuration, credential lifecycle, migration recovery, engine enrollment, and denied cross-organization access. Record the tested environment and evidence for each check.

The Control Plane manages intent and operations. The Proxima Engine remains the data-plane enforcement authority; control-plane availability must never weaken an already-running Engine's tenant enforcement.
