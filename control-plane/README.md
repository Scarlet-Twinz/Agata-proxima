# Proxima Control Plane

Phase 24 begins with a deliberately narrow control-plane contract. The control plane is not part of the data-plane security path.

The self-hosted Engine remains functional without a cloud account.

The first API surface is:

- GET /api/v1/health
- GET /api/v1/overview
- GET /api/v1/verification
- GET /api/v1/tenants
- GET /api/v1/connections
- GET /api/v1/audit

Authentication, persistent storage, organization isolation and deployment are required before this becomes a hosted service.
