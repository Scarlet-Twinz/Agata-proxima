# Agata Proxima — Public Website and Dashboard Overhaul

## Purpose
This package is the consolidated follow-up to the first public/dashboard ZIP. It replaces the earlier package's versions of the same files and adds the fixes discovered during the local lint/build attempt. It is an overlay for the existing repository, not a replacement repository.

## Included source changes
- `frontend/src/pages/public/Home.tsx` — clearer product operating model, public destination map, developer entry points, and provider-neutral Agata API, webhook and verification capabilities; no Resend or Stripe promotion is present on the homepage.
- `frontend/src/pages/public/Docs.tsx` and `PublicDetail.tsx` — organized documentation paths and expanded provider-neutral practical guidance for API contracts, authentication, security, operations, troubleshooting, verification, webhooks, events, SDKs, CLI and Terraform. Exact API payloads or released SDKs are not invented; Resend/Stripe-specific examples have been removed from these updated public pages.
- `frontend/src/pages/console/Overview.tsx` — persistent operating guide linking tenants, policies, deployments, verification, security, and troubleshooting.
- `frontend/src/components/console/ResourceSurface.tsx` — fixes the missing `ArrowLeft` import that caused the reported TypeScript build failure; adds reusable resource workflow guidance and actionable empty/error states; stabilizes the async loading callback and dependencies.
- `frontend/src/pages/console/NestedResource.tsx` — adds explicit list/detail configuration for tenant, policy, node, deployment and audit records, so detail links do not fall through to a generic page; corrects the detail return destination; stabilizes API-key loading.
- `frontend/src/pages/console/TeamManagement.tsx`, `Notifications.tsx`, `SettingsHub.tsx` — refactors initial async loading to avoid synchronous loading-state updates in effects and declares stable effect dependencies, addressing warnings reported by the local lint run.
- `frontend/src/layouts/console/ConsoleLayout.tsx` and the three existing style files — improved dashboard guidance/navigation and responsive public/dashboard presentation.

## Provider and connector scope
- Resend and Stripe were mistakenly added as public integration examples in an earlier draft. They have been removed from the updated homepage and public documentation pages in this package.
- This package does not change existing backend email delivery, authentication, billing or payment-provider implementation.
- The uploaded source snapshot does not contain the backend Rust crates, migrations or deployment environment files required for a complete server-side connector audit. The visible frontend snapshot contains Paddle-specific checkout UI and existing docs with both Paddle and Paystack references, but no Flutterwave reference was found in the supplied snapshot. This is a mismatch to reconcile against the user's current local repository before changing billing code.
- Resend remains present in existing authentication/notification-related code and operational documentation as the email service. This overhaul does not remove that email functionality.

## Checks completed in the packaging environment
- Static route/article audit: **17/17 checks passed**, including all public detail routes, 107 literal internal navigation targets, dynamic console detail configuration, dashboard guidance, and the missing icon import.
- TypeScript parser/syntax check: **101 source files scanned; 0 syntax errors**. This is a syntax check, not full TypeScript type-checking.
- Whitespace source audit: **17 package files checked; 0 trailing-whitespace issues**.

## Checks still required locally
The packaging environment could not install the exact locked frontend dependencies, so a full `npm run lint` and `npm run build` were not independently completed here. The prior local build failed because `ArrowLeft` was missing; this package corrects that import. Run the included verification script in the complete local repository and address any remaining diagnostics before accepting the work.

After automated checks, perform browser/API checks for:
1. Homepage and documentation navigation at desktop and mobile widths.
2. Authenticated dashboard loading, errors, refresh and empty states.
3. Tenant, policy, node, deployment, verification, audit, team-member, API-key and webhook detail routes against the running backend.
4. Authentication/authorization boundaries and links that require an authenticated session.
5. Confirm the provider-neutral public pages contain no unintended provider promotions; audit actual configured services separately from public marketing content.

## Scope and safety
- No commit, push, merge, branch switch, DNS change or deployment is performed by the included scripts.
- No secrets or environment files are included.
- Billing-provider implementation is intentionally unchanged by this package. The uploaded source snapshot shows legacy Paddle/Paystack references; reconcile that snapshot with the current local repository and the user's current Flutterwave decision before any billing changes.
- Phases 3.51–3.70 are not marked production-accepted by this UI package alone. Backend/environment, live provider, security, pilot and final acceptance gates still require their own evidence.
