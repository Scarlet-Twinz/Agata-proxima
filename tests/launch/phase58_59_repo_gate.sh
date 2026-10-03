#!/usr/bin/env bash
set -euo pipefail

fail() { echo "FAIL: $1" >&2; exit 1; }
pass() { echo "PASS: $1"; }

test -f crates/proxima-control-plane/migrations/0004_oidc.sql || fail "OIDC migration missing"
test -f docs/phase51-57-final-verification.md || fail "Phase 51-57 verification record missing"
test -f docs/production-readiness.md || fail "production readiness record missing"
test -f tests/external-saas/verify_reference_app.sh || fail "external SaaS acceptance fixture missing"

grep -q 'AGATA_STRIPE_STARTER_PRICE_ID' .env.example || fail "Starter Stripe Price contract missing"
grep -q 'AGATA_STRIPE_GROWTH_PRICE_ID' .env.example || fail "Growth Stripe Price contract missing"
grep -q 'AGATA_STRIPE_SCALE_PRICE_ID' .env.example || fail "Scale Stripe Price contract missing"
! grep -q 'AGATA_STRIPE_PRICE_ID=' .env.example || fail "legacy generic Stripe Price variable remains"

grep -q 'checkout_url' crates/proxima-control-plane/src/production.rs || fail "checkout response contract missing"
grep -q 'portal_url' crates/proxima-control-plane/src/production.rs || fail "portal response contract missing"
grep -q 'd.checkout_url' crates/proxima-control-plane/web/app.html || fail "Billing UI checkout response handling missing"
grep -q 'd.portal_url' crates/proxima-control-plane/web/app.html || fail "Billing UI portal response handling missing"

grep -q 'plan_limit_reached' crates/proxima-control-plane/src/production.rs || fail "capacity enforcement missing"
grep -q 'feature_not_in_plan' crates/proxima-control-plane/src/production.rs || fail "feature enforcement missing"
grep -q 'enforce_environment_capacity' crates/proxima-control-plane/src/main.rs || fail "environment capacity enforcement missing"
grep -q 'priority_support' crates/proxima-control-plane/src/main.rs || fail "priority support enforcement missing"

grep -q 'identity.entra.configured' crates/proxima-control-plane/src/production.rs || fail "Entra audit event missing"
grep -q 'Microsoft Entra identity boundary validation failed' crates/proxima-control-plane/src/production.rs || fail "Entra boundary validation missing"
grep -q 'oidc_login_states' crates/proxima-control-plane/migrations/0004_oidc.sql || fail "OIDC state storage missing"
grep -q 'user_identities' crates/proxima-control-plane/migrations/0004_oidc.sql || fail "OIDC identity mapping missing"

grep -q 'control_plane_coupling.*non_authoritative' crates/proxima-control-plane/src/main.rs || fail "control-plane non-authoritative health contract missing"
grep -q 'engine_continues_enforcement' crates/proxima-control-plane/src/main.rs || fail "engine independence contract missing"

grep -q 'X-Proxima-Tenant-Token' tests/external-saas/reference-app/server.js || fail "external SaaS tenant-token boundary missing"
grep -q 'External SaaS reference application acceptance: PASS' tests/external-saas/verify_reference_app.sh || fail "external SaaS acceptance result contract missing"

echo "Phase 58-59 repository launch gate"
pass "repository contracts present"
pass "billing response/UI contract aligned"
pass "plan capacity and feature enforcement present"
pass "Entra identity boundary present"
pass "external SaaS acceptance fixture present"
pass "engine-first authority contract present"
echo "PASS: Phase 58-59 repository gate"
