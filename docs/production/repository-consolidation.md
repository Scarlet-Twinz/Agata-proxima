# Repository consolidation and branch map

**Canonical integration target:** `main`  
**Canonical public domain:** `agataproxima.com`  
**Active billing provider:** Paddle Live API only  
**Phase numbering:** follow the Final Execution Map; Phase 3B work continues through 3.50 and Phase 3C starts at 3.51.

## One source of truth

Pull request **#91 — Consolidate Phase 3B platform, Paddle Live billing, Entra, and support** was squash-merged to `main` on 2026-10-11 as commit `77495095fb32178722029b51141a8053eab84648`. The reviewed PR head `e7eb28ebfc10c82fb473bf3d9321cc0c42e9a766` passed Frontend workflow run #634, Rust workflow run #1231, and Supply chain security workflow run #34. These checks were on the exact reviewed PR head; the merged tree was verified on `main`.

Do not merge intermediate PRs into one another or treat a green run on an older head as proof that a later code change is green.

## PRs superseded by the consolidated change

#91 is now merged to `main`. The following superseded PRs have been reviewed, commented with the canonical destination, and closed: #90, #88, #87, #86, #85, #84, #83, #82, #81, #80, #79, #77 and #41. Their changed-file lists and unique paths were checked against the consolidated tree. Their branch refs remain preserved; no branch deletion was performed.

- **Closed #90** — Paddle migration, included in #91.
- **Closed #88** — dashboard/API-key/support schema, included in #91.
- **Closed #87** — Entra settings UI; equivalent settings and identity-linking behavior is integrated into the active `NestedResource.tsx` route, and the duplicate root route tree was removed.
- **Closed #86, #85, #84** — environment/Entra onboarding, local acceptance/auth guard, and Axum route fixes are represented in the consolidated tree.
- **Closed #83, #82, #81, #80, #79** — obsolete Lemon Squeezy provider variants. Paddle is active; historical migration 0017 remains for auditability, while provider-specific Lemon Squeezy implementation modules are not active.
- **Closed #77** — Resend transactional email, included in #91.
- **Closed #41** — the older environment/CI guard is superseded by the stricter current repository launch gate.

Do not delete these branch refs as part of PR closure. The squash commit is present on `main`; keep historical refs until the separate legacy-branch review proves their unique behavior is accounted for.

## Legacy PRs that must remain blocked for selective review

These are **not safe to merge wholesale** and must remain visible until their unique behavior is compared and selectively ported:

- **#58 — Phase 3A integrations:** migrations 0008–0011 conflict with current migration history. Preserve the branch; if behavior is required, port it with new forward-only migration numbers after 0020 and rerun migration/security tests.
- **#48 — legacy dashboard/resource documentation fixes:** compare against current active console routes before porting any UI or documentation.
- **#42 — legacy Phase 2.6 static UI:** compare against the active frontend; do not restore duplicate pages or a second router.
- **#31 and #30 — legacy Phase 25–40 platform branches:** port only specific missing behavior after comparing Engine/Control Plane ownership and current migrations.
- **#22 — legacy Phase 18–24 TLS/hardening:** compare against the active Engine and current HTTPS/HSTS implementation before any port.
- **#10 — legacy Phase 7–17 auth hardening:** compare against the current auth/session model before any port.

“Blocked” means the branch may contain useful code but its PR is not accepted as-is. It does not mean the functionality has passed.

## Duplicate/broken-link prevention

- `frontend/src/main.tsx` imports the active router from `frontend/src/app/App.tsx`; the unused root-level `frontend/src/App.tsx` was removed to avoid a second route tree.
- The route-contract gate verifies the public docs/support destinations and workspace settings destinations that previously lacked registrations.
- `scripts/ops/check-doc-links.py` validates repository-local Markdown targets and heading fragments; external production URLs still require verification after deployment.
- Pricing plan labels were checked for duplicate support features.
- The canonical hostnames are `https://agataproxima.com` and `https://api.agataproxima.com`. Do not reintroduce `agata-proxima.com`.

## Production acceptance is a separate gate

Repository CI can prove source-level checks, but cannot prove provider approval, public DNS/TLS, Live Paddle charges/webhooks, managed-database backup/restore, real support inbox delivery, alert delivery, independent red-team review, or a deployment rollback. Track those in [Phase 3B acceptance status](phase3b-3-24-40-acceptance.md); do not mark them passed without external evidence.
