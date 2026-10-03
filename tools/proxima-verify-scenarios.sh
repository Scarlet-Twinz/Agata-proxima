#!/usr/bin/env bash
set -euo pipefail

echo "Proxima adversarial scenario matrix"
echo "1. Missing tenant context -> reject"
echo "2. Forged tenant context -> reject"
echo "3. Expired tenant context -> reject"
echo "4. Duplicate tenant context -> reject"
echo "5. Tenant A SELECT/INSERT/UPDATE/DELETE -> own rows only"
echo "6. Tenant A -> Tenant B read/write -> deny"
echo "7. Prepared statements -> isolation preserved"
echo "8. Transaction rollback -> no cross-tenant residue"
echo "9. Connection reuse -> tenant context never crosses sessions"
echo "10. TLS plaintext downgrade -> reject"
echo "11. TLS certificate/hostname failure -> reject"
echo "12. Upstream TLS failure -> reject"
echo "13. Oversized/truncated/malformed PostgreSQL frames -> reject"
echo "14. Connection exhaustion -> bounded and observable"
echo "Scenario matrix is executable through CI plus tools/proxima-verify.sh."
