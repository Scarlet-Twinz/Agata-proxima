# External SaaS Integration v2

Phase 34 turns the existing three-tenant harness into an external-application acceptance gate.

Required topology:

```
Customer application
        |
        v
   Proxima Engine
        |
        v
   PostgreSQL
```

Acceptance sequence:

1. Put a real application behind Proxima.
2. Create at least three tenants.
3. Run authenticated tenant A/B/C traffic.
4. Attempt cross-tenant reads and writes.
5. Exercise prepared statements and transactions.
6. Rotate or expire tenant credentials.
7. Disable the control plane.
8. Repeat tenant-boundary attacks.
9. Restore management connectivity.
10. Compare audit and verification evidence with the actual attack results.

A successful harness run is necessary but does not substitute for the external deployment itself.
