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

grep -Fq '("starter","Starter",149_i32' "$backend" || fail "backend Starter price is not $149"
grep -Fq '("growth","Growth",499_i32' "$backend" || fail "backend Growth price is not $499"
grep -Fq '("scale","Scale",1199_i32' "$backend" || fail "backend Scale price is not $1,199"
grep -Fq 'price:"$149/mo"' "$pricing" || fail "public Starter price is not $149"
grep -Fq 'price:"$499/mo"' "$pricing" || fail "public Growth price is not $499"
grep -Fq 'price:"$1,199/mo"' "$pricing" || fail "public Scale price is not $1,199"
grep -Fq 'Starter $149 / Growth $499 / Scale $1,199' "$matrix" || fail "entitlement pricing matrix disagrees"
grep -Fq '| Environments | 1 | 2 | 5 | 50 | Contract-defined |' "$matrix" || fail "environment quotas disagree with the canonical contract"
grep -Fq '| Active webhook integrations | 1 | 5 | 20 | 100 | Contract-defined |' "$matrix" || fail "integration quotas disagree with the canonical contract"
grep -Fq '| Verification runs per UTC calendar month | 100 | 1,000 | 10,000 | 100,000 | Contract-defined |' "$matrix" || fail "verification quotas disagree with the canonical contract"
grep -Fq '| Team seats (active members + unexpired pending invitations) | 1 | 5 | 15 | 50 | Contract-defined |' "$matrix" || fail "team seat quotas disagree with the canonical contract"
grep -Fq '| Active API keys | 1 | 5 | 25 | 100 | Contract-defined |' "$matrix" || fail "API key quotas disagree with the canonical contract"
grep -Fq '| Authenticated API requests per minute | 60 | 300 | 1,000 | 5,000 | Contract-defined |' "$matrix" || fail "API rate limits disagree with the canonical contract"
grep -Fq '| Starter | $149 |' "$proposal" || fail "pricing proposal Starter price disagrees"
grep -Fq '| Growth | $499 |' "$proposal" || fail "pricing proposal Growth price disagrees"
grep -Fq '| Scale | $1,199 |' "$proposal" || fail "pricing proposal Scale price disagrees"
grep -Fq 'server-side enforcement point and tests' "$contract" || fail "entitlement enforcement contract missing"
grep -Fq '| Free | $0 |' "$contract" || fail "canonical Free price is missing"
grep -Fq '"starter" => (2, 25, 2, 30' "$backend" || fail "Starter capacity catalogue disagrees with contract"
grep -Fq '"growth" => (5, 100, 5, 180' "$backend" || fail "Growth capacity catalogue disagrees with contract"
grep -Fq '"scale" => (15, 500, 50, 365' "$backend" || fail "Scale capacity catalogue disagrees with contract"
grep -Fq '"enterprise" => (i32::MAX, i32::MAX, i32::MAX' "$backend" || fail "Enterprise contract provisioning baseline missing"

if grep -Eq '(^|[^0-9])(79|249|799)_i32([^0-9]|$)' "$backend" || grep -Fq '$79/mo' "$pricing" || grep -Fq '$249/mo' "$pricing" || grep -Fq '$799/mo' "$pricing"; then
  fail "conflicting superseded launch prices remain in backend or public pricing"
fi

for file in "$matrix" "$proposal" "$contract" "docs/usage.md" "docs/billing/entitlement-matrix.md"; do
  if grep -Eq '\\$79([^0-9]|$)|\\$249([^0-9]|$)|\\$799([^0-9]|$)' "$file"; then
    fail "superseded pricing remains in canonical document: $file"
  fi
done

grep -Fq 'Paystack is the active billing provider' "docs/usage.md" || fail "usage guide does not identify Paystack as the active provider"
grep -Fq 'Microsoft Entra ID (OpenID Connect/OIDC)' "docs/usage.md" || fail "usage guide does not document the SSO provider"

pass "canonical pricing agrees across backend, public pricing and billing docs"
pass "Phase 3.22 entitlement contract is present"
