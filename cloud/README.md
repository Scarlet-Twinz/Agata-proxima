# Proxima Cloud boundary

Proxima Cloud is the hosted control plane. It is intentionally separate from the self-hosted Engine.

## Control-plane responsibilities

- organizations and users;
- engine registration;
- fleet inventory;
- policy distribution;
- verification history;
- audit events;
- deployment health;
- alerts;
- usage and billing metadata.

## Data-plane rule

The Cloud service must never become a hidden dependency for tenant enforcement. An Engine deployment must remain capable of enforcing its local policy without a live Cloud connection.

## Initial API contract

    POST /v1/engines/register
    GET  /v1/engines
    GET  /v1/engines/{engine_id}
    GET  /v1/engines/{engine_id}/health

    GET  /v1/policies
    PUT  /v1/policies/{policy_id}

    POST /v1/verifications
    GET  /v1/verifications
    GET  /v1/verifications/{verification_id}

    GET  /v1/audit

The actual service is not claimed to exist yet. The next implementation must provide authenticated organization isolation, signed engine enrollment, durable storage, API authorization, audit integrity and a deployed service before Phase 24 can be marked DONE.
