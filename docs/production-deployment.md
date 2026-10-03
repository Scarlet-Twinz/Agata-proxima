# Production Deployment Model

## Components

- Proxima Engine: data-plane enforcement point.
- Proxima Control Plane: management API.
- PostgreSQL: protected resource.
- External identity provider: recommended for production user authentication.
- Secret manager: production secrets and key rotation.
- Durable PostgreSQL control-plane store: production state and audit.
- Observability: metrics, logs and alerts.

## Network separation

Customer application → Proxima Engine → PostgreSQL.

Operator → Control Plane → signed/configured management channel → Engine.

The control plane must never be inserted into the PostgreSQL query path.

## Upgrade model

Validate the new engine/configuration, stage rollout, health-check, shift traffic, verify tenant isolation, retain rollback artifacts, and record the deployment audit event.

## Security posture

Production must enable TLS, authenticated management access, durable backups, least-privilege database roles, non-root containers, read-only roots where compatible, secret rotation and explicit audit retention.
