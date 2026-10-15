#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST_DIRECT:?Set PGHOST_DIRECT to the direct PostgreSQL host}"
: "${PGPORT_DIRECT:?Set PGPORT_DIRECT to the direct PostgreSQL port}"
: "${PGUSER:?Set PGUSER to the benchmark database user}"
: "${PGDATABASE:?Set PGDATABASE to a dedicated benchmark database}"

PGHOST_PROXIMA="${PGHOST_PROXIMA:-127.0.0.1}"
PGPORT_PROXIMA="${PGPORT_PROXIMA:-6432}"
CLIENTS="${CLIENTS:-32}"
JOBS="${JOBS:-4}"
DURATION_SECONDS="${DURATION_SECONDS:-60}"
OUTPUT_DIR="${OUTPUT_DIR:-bench-results/$(date -u +%Y%m%dT%H%M%SZ)}"
mkdir -p "$OUTPUT_DIR"

command -v pgbench >/dev/null || { echo "pgbench is required (install PostgreSQL client tools)." >&2; exit 2; }
command -v python3 >/dev/null || { echo "python3 is required." >&2; exit 2; }

cat > "$OUTPUT_DIR/metadata.txt" <<EOF
timestamp_utc=$(date -u +%FT%TZ)
pgbench_version=$(pgbench --version)
direct_host=$PGHOST_DIRECT
direct_port=$PGPORT_DIRECT
proxima_host=$PGHOST_PROXIMA
proxima_port=$PGPORT_PROXIMA
database=$PGDATABASE
clients=$CLIENTS
jobs=$JOBS
duration_seconds=$DURATION_SECONDS
tls_mode=${PROXIMA_BENCH_TLS_MODE:-record-in-notes}
workload=pgbench built-in select-only (-S)
EOF

run_case() {
  local label="$1" host="$2" port="$3"
  echo "Running $label benchmark..."
  local log_prefix="$OUTPUT_DIR/$label-tx"
  local -a cmd=(pgbench -h "$host" -p "$port" -U "$PGUSER" -d "$PGDATABASE"
    -S -c "$CLIENTS" -j "$JOBS" -T "$DURATION_SECONDS" -P 5 -r -l
    --log-prefix="$log_prefix")
  if [[ "$label" == "proxima" && -n "${PROXIMA_BENCH_PGOPTIONS:-}" ]]; then
    PGOPTIONS="$PROXIMA_BENCH_PGOPTIONS" "${cmd[@]}" 2>&1 | tee "$OUTPUT_DIR/$label.txt"
  else
    env -u PGOPTIONS "${cmd[@]}" 2>&1 | tee "$OUTPUT_DIR/$label.txt"
  fi
}

run_case direct "$PGHOST_DIRECT" "$PGPORT_DIRECT"
run_case proxima "$PGHOST_PROXIMA" "$PGPORT_PROXIMA"

python3 - "$OUTPUT_DIR" <<'PY'
import csv
import glob
import json
import os
import statistics
import sys

root = sys.argv[1]
result = {}
for label in ("direct", "proxima"):
    durations = []
    files = glob.glob(os.path.join(root, f"{label}-tx*"))
    for path in files:
        with open(path, encoding="utf-8", errors="replace") as stream:
            for line in stream:
                row = line.split()
                # pgbench transaction logs record duration in microseconds in column 4.
                if len(row) >= 4:
                    try:
                        durations.append(int(row[3]) / 1000.0)
                    except ValueError:
                        continue
    durations.sort()
    def percentile(p):
        if not durations:
            return None
        index = max(0, min(len(durations) - 1, int((len(durations) - 1) * p)))
        return round(durations[index], 3)
    result[label] = {
        "logged_transactions": len(durations),
        "latency_ms": {
            "p50": percentile(0.50),
            "p95": percentile(0.95),
            "p99": percentile(0.99),
            "mean": round(statistics.mean(durations), 3) if durations else None,
        },
        "raw_output": f"{label}.txt",
    }
direct_p99 = result["direct"]["latency_ms"]["p99"]
proxima_p99 = result["proxima"]["latency_ms"]["p99"]
result["p99_overhead_ms"] = round(proxima_p99 - direct_p99, 3) if direct_p99 is not None and proxima_p99 is not None else None
result["note"] = "Values are observed measurements for this run, not an SLA. Review raw pgbench output and metadata."
with open(os.path.join(root, "summary.json"), "w", encoding="utf-8") as stream:
    json.dump(result, stream, indent=2)
    stream.write("\n")
print(json.dumps(result, indent=2))
PY

echo "Benchmark artifacts saved to: $OUTPUT_DIR"
echo "Run this script multiple times under the same conditions before drawing conclusions."
