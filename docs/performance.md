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

## Repeatable direct-versus-proxy run

Use `tests/performance/benchmark-proxy.sh` against a pre-initialized pgbench database. The direct and proxied URLs must address the same PostgreSQL database, credentials/roles, dataset and server configuration. The script uses pgbench's read-only select-only workload; it does not initialize or vacuum the database. Run it against a dedicated benchmark database, never a production workload. It records environment metadata, saves separate warm-up and measured runs, and derives p50/p95/p99 transaction latency from pgbench raw logs.

Example:

```bash
export DIRECT_DATABASE_URL='postgresql://bench_user:...@db-host:5432/bench'
export PROXIMA_DATABASE_URL='postgresql://bench_user:...@proxy-host:5432/bench'
export PG_BENCH_CLIENTS=32
export PG_BENCH_JOBS=8
export PG_BENCH_WARMUP_SECONDS=10
export PG_BENCH_DURATION_SECONDS=60
bash tests/performance/benchmark-proxy.sh
```

Run multiple repetitions at several concurrency levels (for example 1, 8, 32, 64 and 128 clients) and retain raw artifacts. Include TLS and tenant-token/RLS configurations as separate test cases. Do not compare runs made with different database versions, datasets, machine sizes or server settings. A single run is not an SLA and this harness does not claim to generate production performance numbers automatically.
