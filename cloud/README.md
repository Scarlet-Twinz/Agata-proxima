# Proxima Cloud Control Plane

Proxima Cloud is the future hosted control plane for Proxima Engine fleets.

## Boundary

```
Proxima Cloud
  | authenticated control channel
  +--> fleet identity
  +--> policy distribution
  +--> verification history
  +--> audit events
  +--> deployment state
  +--> organization/team access
        |
        v
   Proxima Engine
        |
        v
   PostgreSQL
```

## Required production components

1. Organization and project identity.
2. Engine enrollment with short-lived credentials.
3. Signed policy/configuration bundles.
4. Durable verification results.
5. Append-only audit records.
6. Role-based access control.
7. Secret rotation and revocation.
8. Fleet health and version reporting.
9. Deployment/rollback state.
10. API and UI authentication.

## Current status

This repository contains the contract and local dashboard surface, but does not claim a hosted cloud deployment. Cloud completion requires an authenticated, durable service and a real deployed control plane.
