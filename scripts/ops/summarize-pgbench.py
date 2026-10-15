#!/usr/bin/env python3
"""Summarize pgbench --log transaction latency logs using nearest-rank percentiles."""
import csv
import glob
import math
import os
import sys

if len(sys.argv) != 4:
    raise SystemExit("usage: summarize-pgbench.py OUTPUT_DIR TARGET DURATION_SECONDS")
directory, target, duration_text = sys.argv[1], sys.argv[2], sys.argv[3]
duration = int(duration_text)
if duration <= 0:
    raise SystemExit("duration must be positive")

latencies_us = []
for path in glob.glob(os.path.join(directory, target + "*.log")):
    with open(path, newline="", encoding="utf-8") as handle:
        for row in csv.reader(handle):
            if len(row) < 4:
                continue
            try:
                value = float(row[3])
            except (ValueError, TypeError):
                continue
            if value >= 0:
                latencies_us.append(value)

if not latencies_us:
    raise SystemExit("No pgbench transaction latency records found for " + target)

latencies_us.sort()
def percentile(p):
    index = max(0, math.ceil(p * len(latencies_us)) - 1)
    return latencies_us[index] / 1000.0

summary = (
    "transactions=" + str(len(latencies_us))
    + " throughput_tps=" + format(len(latencies_us) / duration, ".3f")
    + " p50_ms=" + format(percentile(0.50), ".3f")
    + " p95_ms=" + format(percentile(0.95), ".3f")
    + " p99_ms=" + format(percentile(0.99), ".3f")
)
print(summary)
with open(os.path.join(directory, target + "-percentiles.txt"), "w", encoding="utf-8") as output:
    output.write(summary + "\n")
