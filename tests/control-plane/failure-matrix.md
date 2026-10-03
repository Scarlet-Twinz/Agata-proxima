# Proxima Failure Matrix

These drills validate the central Phase 35 rule: management availability is not permission to weaken data-plane enforcement.

| Drill | Injected failure | Expected result |
|---|---|---|
| CP-01 | Stop control plane | Existing Engine keeps tenant enforcement |
| CP-02 | Control DB unavailable | Management API becomes degraded/unavailable; Engine remains authoritative |
| CP-03 | Node loses control-plane connection | Existing local policy continues until an explicit safe lifecycle action |
| CP-04 | Policy publish interrupted | Last known valid enforcement state remains active |
| CP-05 | Certificate failure | TLS requirement fails closed when configured as required |
| CP-06 | Upstream PostgreSQL unavailable | Connection fails safely; no tenant context is broadened |
| CP-07 | Session expires | Management request returns 401; data-plane sessions are unaffected |
| CP-08 | Audit store unavailable | Management action must not silently claim durable evidence was written |

A production deployment must attach measured recovery times and evidence to every row before the private-beta gate is considered complete.
