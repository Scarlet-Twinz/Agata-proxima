# Proxima Control-Plane Red-Team Matrix

Phase 37 attacks the management plane without treating the control plane as the enforcement authority.

## Identity
- credential stuffing / repeated login
- session fixation
- expired session replay
- session token theft simulation
- CSRF without the session token
- cross-organization resource ID substitution
- viewer attempting owner/admin/operator writes

## Tenant boundary
- tenant ID substitution
- organization ID substitution
- policy ID substitution
- node ID substitution
- deployment node substitution
- verification record substitution

## Fleet
- enrollment-token reuse
- enrollment-token disclosure
- revoked node action
- stale node heartbeat
- deployment desired/observed divergence

## Audit
- audit record organization crossing
- missing actor identity
- malformed metadata
- evidence status spoofing

## Data plane
- control plane unavailable while Engine is serving traffic
- stale control-plane policy while Engine is enforcing last known valid state
- cross-tenant PostgreSQL query through an Engine session

A red-team run is successful only when the attack produces a deterministic deny/fail-closed result or a documented, explicitly accepted operational outcome.
