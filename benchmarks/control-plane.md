# Proxima Control-Plane Benchmark Contract

Phase 36 does not claim a capacity number until it is measured on a declared environment.

Record at minimum:

- request rate for authenticated reads
- request rate for tenant/policy writes
- p50/p95/p99 management latency
- database connection pool saturation
- memory at 100 / 500 / 1,000 concurrent sessions
- audit-write latency
- node-registration latency
- deployment-queue latency

For each run record:

```text
commit:
runner:
cpu:
memory:
postgres:
dataset:
concurrency:
duration:
results:
```

The benchmark must be run separately from data-plane throughput tests. Proxima Engine latency and control-plane latency are different product measurements.
