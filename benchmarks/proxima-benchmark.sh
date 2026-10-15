#!/usr/bin/env bash
# Reproducible direct-PostgreSQL vs Proxima pgbench comparison.
# Requires pgbench, psql, Python 3, and two explicitly configured connection URLs.
set -euo pipefail

: "${BENCH_DURATION:=60}"
: "${BENCH_CLIENTS:=32}"
: "${BENCH_JOBS:=4}"
: "${BENCH_REPORT_DIR:=artifacts/benchmarks}"
: "${BENCH_WARMUP_SECONDS:=10}"
: "${DIRECT_DATABASE_URL:?Set DIRECT_DATABASE_URL to the direct PostgreSQL endpoint}"
: "${PROXIMA_DATABASE_URL:?Set PROXIMA_DATABASE_URL to the Proxima endpoint}"

for value in "$BENCH_DURATION" "$BENCH_CLIENTS" "$BENCH_JOBS" "$BENCH_WARMUP_SECONDS"; do
  [[ "$value" =~ ^[1-9][0-9]*$ ]] || { echo "Benchmark numeric settings must be positive integers." >&2; exit 2; }
done
command -v pgbench >/dev/null || { echo "pgbench is required." >&2; exit 2; }
command -v psql >/dev/null || { echo "psql is required." >&2; exit 2; }
command -v python3 >/dev/null || { echo "python3 is required." >&2; exit 2; }

mkdir -p "$BENCH_REPORT_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
report="$BENCH_REPORT_DIR/proxima-benchmark-$timestamp.txt"
json="$BENCH_REPORT_DIR/proxima-benchmark-$timestamp.json"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

{
  echo "Agata Proxima reproducible pgbench report"
  echo "timestamp_utc=$timestamp"
  echo "hostname=$(hostname)"
  echo "kernel=$(uname -sr)"
  echo "rustc=$(rustc --version 2>/dev/null || echo unavailable)"
  echo "pgbench=$(pgbench --version)"
  echo "postgres_direct=$(psql "$DIRECT_DATABASE_URL" -Atqc 'select version()' | head -n1)"
  echo "postgres_proxima=$(psql "$PROXIMA_DATABASE_URL" -Atqc 'select version()' | head -n1)"
  echo "clients=$BENCH_CLIENTS jobs=$BENCH_JOBS duration_seconds=$BENCH_DURATION warmup_seconds=$BENCH_WARMUP_SECONDS"
  echo "NOTE: endpoints must use equivalent database, schema, dataset, TLS policy and authentication workload."
} | tee "$report"

for target in direct proxima; do
  if [[ "$target" == direct ]]; then url="$DIRECT_DATABASE_URL"; else url="$PROXIMA_DATABASE_URL"; fi
  echo "=== $target warm-up ===" | tee -a "$report"
  pgbench "$url" --client="$BENCH_CLIENTS" --jobs="$BENCH_JOBS" --time="$BENCH_WARMUP_SECONDS" --no-vacuum --progress=0 >"$work/$target-warmup.log" 2>&1
  echo "=== $target measured run ===" | tee -a "$report"
  pgbench "$url" --client="$BENCH_CLIENTS" --jobs="$BENCH_JOBS" --time="$BENCH_DURATION" --no-vacuum --progress=0 --log --log-prefix="$work/$target" >"$work/$target.log" 2>&1
  cat "$work/$target.log" | tee -a "$report"
done

python3 - "$work" "$json" "$report" <<'PY'
import glob, json, os, re, sys
work, output, report = sys.argv[1:]
results = {}
for target in ("direct", "proxima"):
    logs = glob.glob(os.path.join(work, target + ".*.log")) + glob.glob(os.path.join(work, target + ".log"))
    text = "\n".join(open(path, encoding="utf-8", errors="replace").read() for path in logs)
    def number(pattern):
        match = re.search(pattern, text, re.I)
        return float(match.group(1).replace(",", "")) if match else None
    results[target] = {
        "transactions_per_second": number(r"\b(?:tps|transactions per second)\s*=\s*([0-9,.]+)"),
        "average_latency_ms": number(r"latency average\s*=\s*([0-9,.]+)\s*ms"),
        "latency_stddev_ms": number(r"latency stddev\s*=\s*([0-9,.]+)\s*ms"),
        "raw_log_files": len(logs),
    }
payload = {
    "schema_version": 1,
    "method": "pgbench built-in default workload; identical options per endpoint",
    "results": results,
    "limitations": [
        "This harness reports pgbench's aggregate latency and throughput, not p50/p95/p99.",
        "Run on an isolated host with equivalent datasets and repeat at multiple client counts.",
        "CPU/RAM and tail-latency claims require an external system sampler and transaction log analysis.",
        "No result is a public SLA without reproducible environment details and repeated trials."
    ]
}
with open(output, "w", encoding="utf-8") as f:
    json.dump(payload, f, indent=2)
    f.write("\n")
with open(report, "a", encoding="utf-8") as f:
    f.write("\nStructured results: " + output + "\n")
print(json.dumps(payload, indent=2))
PY
echo "Benchmark artifacts written to $report and $json"
