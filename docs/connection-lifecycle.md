# Connection Lifecycle Hardening

Security invariant: Tenant A state must never survive into Tenant B's PostgreSQL session.

Proxima establishes tenant context before PostgreSQL authentication completes. The context is represented upstream by a tenant-specific PostgreSQL role. Query traffic is not parsed for a second tenant identity after the session is established.

Rules:
- no query relay before AuthenticationOk and ReadyForQuery;
- missing, duplicate, expired or tampered tenant context fails closed;
- connection admission is bounded before upstream allocation;
- upstream connection establishment and TLS handshakes are bounded;
- authentication errors terminate the session;
- connection permits are released when the task exits;
- prepared statements and portals stay inside the already-bound database session;
- direct PostgreSQL access must be blocked by deployment.

Future physical connection pooling must reset all tenant-sensitive PostgreSQL session state before reuse and re-verify the next tenant.
