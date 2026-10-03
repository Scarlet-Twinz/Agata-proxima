# External SaaS Integration Harness

This directory is the bridge between the verified engine and a real SaaS deployment.

The harness expects a PostgreSQL database with three isolated tenant identities:

- tenant_a
- tenant_b
- tenant_c

The intended deployment is:

```
SaaS application -> Proxima -> PostgreSQL
```

The verification sequence is:

1. normal tenant A traffic;
2. normal tenant B traffic;
3. normal tenant C traffic;
4. A attempts B;
5. B attempts C;
6. C attempts A;
7. prepared statements;
8. transactions and rollback;
9. connection reuse inside one tenant;
10. reconnect under a different tenant;
11. TLS-enabled traffic;
12. deliberate invalid/expired tenant context.

The repository harness proves the protocol and database boundary. A real external SaaS deployment is a separate acceptance gate and must be executed against a real application environment.
