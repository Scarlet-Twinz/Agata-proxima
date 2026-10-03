# Connection Lifecycle Hardening

Security invariant:

> Tenant A state must never survive into Tenant B's PostgreSQL session.

Proxima uses one PostgreSQL connection/session per accepted client connection. It does not pool physical database sessions between tenants.

Rules:

- tenant context is verified before PostgreSQL query relay;
- missing, duplicate, expired or tampered tenant context fails closed;
- connection admission is bounded before upstream allocation;
- upstream connection and TLS handshakes are bounded;
- authentication errors terminate the session;
- a configured maximum session duration terminates long-lived stuck sessions;
- connection permits and active telemetry state are released when the task exits;
- prepared statements and portals remain inside the already-bound PostgreSQL session;
- direct PostgreSQL access must be blocked by deployment;
- shutdown stops new work and aborts the telemetry listener after the main listener exits.

Future physical connection pooling must reset all tenant-sensitive PostgreSQL session state before reuse and re-verify the next tenant. It must never reuse a tenant-bound database principal for another tenant.
