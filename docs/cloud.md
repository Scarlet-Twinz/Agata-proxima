# Proxima Cloud

Proxima Cloud is the hosted control plane above the self-hosted Engine and Verify components.

## Control-plane contract

The first cloud API surface is intentionally read-heavy:

- GET /api/v1/overview — engine health and fleet summary.
- GET /api/v1/connections — active/rejected/TLS session counters.
- GET /api/v1/security — enforcement and verification posture.
- GET /api/v1/verification — latest verification result and timestamp.
- GET /api/v1/audit — security events without secrets or SQL payloads.

Write operations must be authenticated and scoped to an organization. Tenant signing keys, database credentials and TLS private keys never belong in browser code.

## Product split

**Engine** is the data plane. It sits in the database path.

**Verify** is the adversarial verification plane. It proves the deployment's tenant-isolation invariant.

**Cloud** is the control plane. It manages fleets, policy versions, verification history, audit records, organizations and alerts.

The local dashboard now consumes the Engine telemetry boundary and is intentionally shaped so the same view can later consume these Cloud endpoints.

## Hosted-security rule

The Cloud control plane must never become a hidden bypass around the Engine. Database traffic remains on the Engine path; Cloud manages and observes the path.

The hosted service itself is not claimed as production-deployed by this repository yet. Its contract is defined so the data-plane security boundary remains independently verifiable.
