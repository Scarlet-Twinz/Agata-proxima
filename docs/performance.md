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


## Reproducible comparison harness

Run `benchmarks/proxima-benchmark.sh` from the repository root after installing
`pgbench`, `psql`, Python 3, and `rustc`. Set `DIRECT_DATABASE_URL` and
`PROXIMA_DATABASE_URL` to equivalent PostgreSQL databases and run:

```bash
DIRECT_DATABASE_URL='postgres://…' \
PROXIMA_DATABASE_URL='postgres://…' \
BENCH_DURATION=60 BENCH_CLIENTS=32 BENCH_JOBS=4 \
bash benchmarks/proxima-benchmark.sh
```

The harness warms both paths, uses the same pgbench workload and client/job
settings, and writes timestamped text and JSON artifacts under
`artifacts/benchmarks` by default. Keep generated artifacts out of source
control unless intentionally publishing a reviewed benchmark report.

This first harness deliberately reports only the aggregate statistics pgbench
actually emits. It does **not** claim p50/p95/p99, memory, CPU, or a universal
overhead percentage. Tail percentiles require transaction-level logs with a
validated parser; resource costs require host/container sampling. For a publishable
comparison, use identical data/schema, PostgreSQL version, host, TLS policy,
connection limits and authentication path, and repeat each scenario at several
concurrency levels. Report the full environment and raw artifacts.
