#!/usr/bin/env bash
set -euo pipefail

: "${DIRECT_DATABASE_URL:?Set DIRECT_DATABASE_URL to a pre-initialized pgbench PostgreSQL database}"
: "${PROXIMA_DATABASE_URL:?Set PROXIMA_DATABASE_URL to the same database through Proxima}"
CLIENTS="${PG_BENCH_CLIENTS:-32}"
JOBS="${PG_BENCH_JOBS:-8}"
DURATION="${PG_BENCH_DURATION_SECONDS:-60}"
WARMUP="${PG_BENCH_WARMUP_SECONDS:-10}"
OUTPUT_DIR="${PG_BENCH_OUTPUT_DIR:-benchmark-results/$(date -u +%Y%m%dT%H%M%SZ)}"

for command in pgbench psql rustc; do
  command -v "$command" >/dev/null 2>&1 || { echo "Required command not found: $command" >&2; exit 2; }
done
[[ "$CLIENTS" =~ ^[1-9][0-9]*$ ]] || { echo "PG_BENCH_CLIENTS must be positive" >&2; exit 2; }
[[ "$JOBS" =~ ^[1-9][0-9]*$ ]] || { echo "PG_BENCH_JOBS must be positive" >&2; exit 2; }
[[ "$DURATION" =~ ^[1-9][0-9]*$ ]] || { echo "PG_BENCH_DURATION_SECONDS must be positive" >&2; exit 2; }
[[ "$WARMUP" =~ ^[1-9][0-9]*$ ]] || { echo "PG_BENCH_WARMUP_SECONDS must be positive" >&2; exit 2; }

mkdir -p "$OUTPUT_DIR"
{
  echo "timestamp_utc=$(date -u +%FT%TZ)"
  echo "hostname=$(hostname)"
  echo "kernel=$(uname -sr)"
  echo "rustc=$(rustc --version)"
  echo "pgbench=$(pgbench --version)"
  echo "clients=$CLIENTS"
  echo "jobs=$JOBS"
  echo "duration_seconds=$DURATION"
  echo "warmup_seconds=$WARMUP"
  echo "direct_database_version=$(psql "$DIRECT_DATABASE_URL" -Atqc 'SHOW server_version')"
  echo "proxied_database_version=$(psql "$PROXIMA_DATABASE_URL" -Atqc 'SHOW server_version')"
} | tee "$OUTPUT_DIR/environment.txt"

for target in direct proxied; do
  if [[ "$target" == direct ]]; then url="$DIRECT_DATABASE_URL"; else url="$PROXIMA_DATABASE_URL"; fi
  echo "Warm-up: $target"
  pgbench "$url" --client="$CLIENTS" --jobs="$JOBS" --time="$WARMUP" --no-vacuum >"$OUTPUT_DIR/$target-warmup.txt" 2>&1
  echo "Measured run: $target"
  pgbench "$url" --client="$CLIENTS" --jobs="$JOBS" --time="$DURATION" --report-per-command --log --log-prefix="$OUTPUT_DIR/$target" --no-vacuum >"$OUTPUT_DIR/$target-measured.txt" 2>&1
  python3 scripts/ops/summarize-pgbench.py "$OUTPUT_DIR" "$target" "$DURATION"
done

echo "Benchmark artifacts: $OUTPUT_DIR"
echo "Review throughput, latency percentiles, failed transactions, environment.txt, and run-to-run variance before publishing any claim."
