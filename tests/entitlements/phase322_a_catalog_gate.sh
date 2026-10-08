#!/usr/bin/env bash
set -euo pipefail

fail() { echo "FAIL: $1" >&2; exit 1; }
pass() { echo "PASS: $1"; }

backend="crates/proxima-control-plane/src/production.rs"
pricing="frontend/src/pages/public/Pricing.tsx"
matrix="docs/billing/entitlements.md"
proposal="docs/billing/pricing-proposal.md"
contract="docs/billing/phase3-22-entitlement-contract.md"

for file in "$backend" "$pricing" "$matrix" "$proposal" "$contract"; do
  test -f "$file" || fail "required entitlement contract file missing: $file"
done

grep -Fq '("starter","Starter",79_i32' "$backend" || fail "backend Starter price is not $79"
grep -Fq '("growth","Growth",249_i32' "$backend" || fail "backend Growth price is not $249"
grep -Fq '("scale","Scale",799_i32' "$backend" || fail "backend Scale price is not $799"
grep -Fq 'price:"$79/mo"' "$pricing" || fail "public Starter price is not $79"
grep -Fq 'price:"$249/mo"' "$pricing" || fail "public Growth price is not $249"
grep -Fq 'price:"$799/mo"' "$pricing" || fail "public Scale price is not $799"
grep -Fq 'Free / $79 Starter / $249 Growth / $799 Scale / Enterprise Custom' "$matrix" || fail "entitlement pricing matrix disagrees"
grep -Fq '| Starter | $79 |' "$proposal" || fail "pricing proposal Starter price disagrees"
grep -Fq '| Growth | $249 |' "$proposal" || fail "pricing proposal Growth price disagrees"
grep -Fq '| Scale | $799 |' "$proposal" || fail "pricing proposal Scale price disagrees"
grep -Fq 'server-side enforcement point and tests' "$contract" || fail "entitlement enforcement contract missing"

if grep -Eq '149_i32|499_i32|1199_i32|\$149/mo|\$499/mo|\$1,199/mo' "$backend" "$pricing"; then
  fail "conflicting legacy launch prices remain in backend or public pricing"
fi

pass "canonical pricing agrees across backend, public pricing and billing docs"
pass "Phase 3.22 entitlement contract is present"
