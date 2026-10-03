# External SaaS Acceptance

The acceptance harness for a real SaaS deployment is deliberately separate from unit and CI tests.

Required topology:

Real SaaS application -> Proxima -> PostgreSQL

Minimum acceptance:

- three independent tenants;
- normal CRUD;
- transactions and rollback;
- prepared statements;
- application connection pooling;
- concurrent traffic;
- client TLS and upstream TLS;
- restart/reconnect behavior;
- deliberate A -> B, B -> C and C -> A read/write attempts;
- all cross-tenant attempts denied;
- legitimate same-tenant operations succeed.

Run the two-tenant regression with `bash tools/proxima-verify.sh`, then the three-tenant matrix with `bash tools/proxima-verify-3tenant.sh`.

This repository does not claim external SaaS proof until a real application has completed that acceptance matrix. That final evidence is intentionally a deployment test, not something CI can fake.
