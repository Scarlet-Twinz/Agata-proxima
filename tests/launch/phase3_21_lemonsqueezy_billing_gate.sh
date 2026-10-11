#!/usr/bin/env bash
set -euo pipefail
# Compatibility wrapper for historical CI/local commands. The active billing
# contract is Paddle; see tests/launch/paddle_billing_gate.sh.
exec bash tests/launch/paddle_billing_gate.sh "$@"
