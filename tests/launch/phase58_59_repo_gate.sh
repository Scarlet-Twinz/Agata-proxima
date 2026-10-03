#!/usr/bin/env bash
set -euo pipefail

grep -q 'control_plane_coupling.*non_authoritative' crates/proxima-control-plane/src/main.rs || { echo 'FAIL: control-plane non-authoritative health contract missing' >&2; exit 1; }
grep -q 'engine_continues_enforcement' crates/proxima-control-plane/src/main.rs || { echo 'FAIL: engine independence contract missing' >&2; exit 1; }
echo 'PASS: Phase 58-59 repository gate'
