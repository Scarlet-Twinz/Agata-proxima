# External SaaS Acceptance

The first external integration must be a real multi-tenant SaaS application behind Proxima:

Application -> Proxima -> PostgreSQL

Acceptance requires at least three tenants and a normal workload containing CRUD, transactions, prepared statements, pooled connections, concurrent traffic, TLS and restarts.

The application must deliberately attempt A -> B, B -> C and C -> A reads and writes. All cross-tenant attempts must be denied while legitimate same-tenant operations succeed.

This acceptance environment is the evidence required before describing Proxima as proven against a real SaaS workload.
