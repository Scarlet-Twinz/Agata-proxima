# Release Readiness

## Current release boundary

This release is an infrastructure-engine prototype with a verified PostgreSQL session boundary.

It supports:

- signed tenant-context verification;
- tenant-specific PostgreSQL role routing;
- PostgreSQL authentication brokering through SCRAM/password exchanges;
- bounded protocol framing;
- concurrent connection limits;
- upstream connection timeouts;
- graceful shutdown;
- independent RLS verification;
- real proxy-to-PostgreSQL integration tests;
- property-based malformed-frame tests;
- an adversarial verification harness.

## Required deployment conditions

A supported tenant-isolation deployment requires:

1. The tenant signing secret is controlled by the trusted application boundary.
2. Tenant database roles are NOSUPERUSER and NOBYPASSRLS.
3. Tenant roles do not own protected tables unless the deployment deliberately uses FORCE ROW LEVEL SECURITY.
4. PostgreSQL is not directly exposed as an alternate path for untrusted application traffic.
5. End-to-end TLS is not used through the enforcement path unless Proxima's future TLS-terminating mode is deployed.
6. Production secrets are supplied through a secret-management system rather than committed configuration.

## What is deliberately not claimed yet

Proxima does not currently claim:

- transparent policy enforcement inside opaque end-to-end PostgreSQL TLS without TLS termination;
- protection against a database superuser;
- protection when an attacker can bypass Proxima and connect directly with privileged database credentials;
- automatic conversion of arbitrary application schemas into correct tenant policies;
- a hosted control plane.

Those are separate engineering and product boundaries.

## Roadmap after this boundary

The current repository has the TLS termination/upstream trust boundary, lifecycle model, adversarial verification, deployment hardening, and first operator dashboard. Remaining acceptance gates are a real external SaaS deployment and the hosted Proxima Cloud control plane.

The public release should describe the supported security model precisely rather than implying broader guarantees.
