# Performance Engineering

Performance claims are measured, not invented.

Required benchmark dimensions:
- connection establishment rate;
- steady-state concurrent sessions;
- p50/p95/p99 connection latency;
- TLS handshake overhead;
- bytes per second through the proxy;
- CPU per session tier;
- memory per session;
- tenant-context verification cost;
- PostgreSQL upstream connection time;
- recovery time after upstream failure.

Run the same workload through direct PostgreSQL, Proxima without TLS, Proxima with client TLS, Proxima with client and upstream TLS, and Proxima with tenant verification plus RLS.

Every result records hardware, Rust version, PostgreSQL version, connection count, payload shape and duration. No benchmark becomes a public SLA until it is reproducible.
