#!/usr/bin/env bash
set -euo pipefail

echo "AGATA PROXIMA PLATFORM"
echo "Starting isolated control-plane PostgreSQL..."
docker compose up -d control-postgres

export PROXIMA_CONTROL_DATABASE_URL="postgres://proxima_control:proxima-control-dev@127.0.0.1:55432/proxima_control"
export PROXIMA_CONTROL_BIND="127.0.0.1:8080"
export PROXIMA_COOKIE_SECURE="false"

echo "Starting Proxima Control Plane on http://127.0.0.1:8080"
cargo run -p proxima-control-plane
