#!/usr/bin/env bash
set -euo pipefail

: "${PROXIMA_BASE_URL:?set PROXIMA_BASE_URL to the test application's Proxima endpoint}"
: "${PROXIMA_TENANT_A_TOKEN:?set tenant A token}"
: "${PROXIMA_TENANT_B_TOKEN:?set tenant B token}"
: "${PROXIMA_TENANT_C_TOKEN:?set tenant C token}"

echo "External SaaS acceptance contract loaded."
echo "A real application integration must supply the database schema and workload."
echo "Required attack matrix: A->B, B->C, C->A reads and writes."
echo "PASS requires all six cross-tenant attacks to be denied."
