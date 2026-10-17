#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
python3 "$ROOT/scripts/build-integration-starter-kit.py"
unzip -tq "$ROOT/frontend/public/downloads/agata-proxima-integration-starter-kit.zip"
echo "PASS: ZIP integrity check"
