# Agata Proxima — Product Vision and Engineering Roadmap

> **Purpose:** This document defines the product direction, technical principles, acceptance criteria, and engineering roadmap for Agata Proxima. It consolidates the product proposal, the four pillars, engineering recommendations, launch considerations, known caveats, and the existing execution checkpoints 3.51–3.70.
>
> **This document is a plan, not proof of implementation.** A feature is not complete merely because it appears in planning or documentation. Mark it complete only when repository evidence and the relevant tests or operational checks support that status.

**Repository:** `Scarlet-Twinz/Agata-proxima`  
**Canonical roadmap:** `AGATA PROXIMA — FINAL PRODUCTION ROADMAP`, checkpoints **3.51–3.70**  
**Working principle:** Preserve verified work; inspect before changing; do not rewrite or duplicate existing systems unnecessarily; do not mark production acceptance from local CI alone.

---

## 1. Executive vision

Build a credible, developer-friendly security infrastructure platform for multi-tenant applications, initially centered on PostgreSQL and a Rust/Tokio data-plane engine. The product’s central promise is to make tenant isolation an infrastructure boundary that can be enforced, tested, observed, and evidenced—not merely an application-code convention.

The intended product combines:

1. **Proxima Engine** — self-hosted PostgreSQL protocol/data-plane security boundary.
2. **Proxima Monitor** — operational metrics, observability, dashboards and integrations.
3. **Proxima Breaker** — carefully bounded defensive responses to malformed traffic and suspicious authentication behavior.
4. **Proxima Attest** — cryptographically verifiable, tamper-evident security evidence and reports.
5. **Proxima Verify** — repeatable isolation and adversarial verification tooling.
6. **Proxima Cloud / Control Plane** — hosted or separately operated management for organizations, policies, deployments, audit, monitoring and fleet management.
7. **Commercial platform** — entitlements, billing, identity/SSO, support, onboarding, offboarding and customer operations.

The goal is not to claim that the product is magically secure, unique in the world, or automatically compliant. The goal is to demonstrate specific security properties, explain their boundaries, publish reproducible evidence, and deliver an operationally reliable product that developers can adopt and businesses can trust.

## 2. Product purpose and problem statement

### The problem

Multi-tenant SaaS systems can leak data when a request, query, background job, migration, administrative tool or raw SQL path forgets to apply the correct tenant constraint. Application-level checks and ORM middleware are useful but can be inconsistently applied. A database-facing infrastructure boundary can add a defense layer when it is correctly designed and configured.

### Intended value

- Reduce reliance on every application route remembering a tenant filter.
- Verify tenant identity and bind sessions to an appropriately restricted PostgreSQL role/context.
- Use PostgreSQL Row-Level Security (RLS), including FORCE RLS where appropriate, as a defense-in-depth mechanism.
- Fail safely when authentication, tenant context, TLS or required policy state is invalid.
- Make security-relevant events visible and actionable.
- Provide evidence that customers can inspect and independently verify.
- Make adoption practical through documentation, examples, deployment paths, stable APIs and understandable failure behavior.

### Threat-model boundary

Proxima should not claim to eliminate every possible data leak. The threat model must explicitly identify trusted components, untrusted clients, database roles, privileged operators, key compromise, host compromise, control-plane compromise, bypass paths, migrations, backups, administrative access and denial-of-service risks. State which threats the engine mitigates, which it does not, and what configuration customers must maintain.

## 3. Product pillars — detailed requirements

### Pillar 1 — Proxima Engine (core enforcement)

**Purpose:** Intercept PostgreSQL client traffic and enforce the configured identity/tenant boundary before allowing normal query traffic to proceed.

**Design and behavior to verify:**
- Correct PostgreSQL startup and SSLRequest negotiation handling.
- Client-side TLS termination through Rustls when configured, with clear behavior for plaintext and required TLS.
- Upstream PostgreSQL TLS configured with trusted CA and hostname verification when verify-full is selected.
- Versioned tenant-token validation using the implemented HMAC-SHA256/token scheme; no secrets in logs.
- Correct tenant identity/context binding to an appropriate PostgreSQL role/session.
- PostgreSQL authentication and startup exchange is brokered correctly; normal query stream starts only after a ready session.
- RLS policies and role permissions are independently verified, including attempts to bypass filters, use raw SQL, switch roles, change session state or access another tenant.
- Safe handling of malformed, oversized, truncated and unexpected protocol frames.
- Bounded connection, frame and resource usage; cancellation and cleanup on disconnect.
- Clear startup/configuration errors and secure defaults.
- Engine enforcement must not silently depend on the control plane being reachable. Preserve the documented authority boundary: the control plane manages intent; the engine enforces the security boundary.
- No claim of complete isolation until direct, integration and adversarial tests support it.

**Acceptance evidence:**
- Unit/property tests for parsing, token validation and connection state transitions.
- Real PostgreSQL integration test(s).
- Independent RLS verification script, including cross-tenant negative cases.
- Adversarial verification harness and regression tests.
- TLS success/failure tests and explicit behavior for required TLS modes.
- Failure-engineering tests for database/control-plane unavailability.
- Documented threat model, assumptions and known limitations.

### Pillar 2 — Proxima Monitor (metrics and observability)

**Purpose:** Let an operator understand engine behavior and diagnose problems through standard telemetry.

**Candidate implementation:**
- A Prometheus-compatible `/metrics` endpoint, preferably bound to a separately configured management/metrics listener rather than exposed unintentionally to the public network.
- Useful counters/gauges/histograms, for example:
  - `proxima_active_connections`
  - `proxima_connections_total`
  - `proxima_query_processing_time_seconds` (histogram; use a unit-bearing metric name)
  - `proxima_blocked_tenant_violations_total`
  - `proxima_authentication_failures_total`
  - `proxima_malformed_frames_total`
  - `proxima_upstream_connection_errors_total`
  - `proxima_policy_enforcement_failures_total`
- Keep metric labels bounded: do not use tenant IDs, user IDs, raw SQL, tokens, IPs or other high-cardinality/sensitive values as labels.
- Separate health/readiness from business/security metrics.
- Document Prometheus scraping and a sample Grafana dashboard.
- Provide structured, redacted security events and correlation identifiers.
- Establish a clear metrics authentication/network exposure policy.
- Measure instrumentation overhead rather than promising “zero overhead.”

**Acceptance evidence:** endpoint format tests, metric correctness tests, bounded-label review, sample scrape, and measured overhead under a repeatable workload.

### Pillar 3 — Proxima Breaker (defensive response / circuit breaker)

**Purpose:** Protect availability and security when the engine sees defined protocol abuse or suspicious authentication behavior.

**Required design decisions before implementation:**
- Define concrete trigger thresholds and windows for malformed frames, oversized frames, repeated invalid credentials/tokens and other abuse signals.
- Distinguish a per-connection rejection from a source-level or service-level breaker. Do not let one bad client automatically disable healthy tenants globally.
- Define breaker states, transitions, cool-down, recovery, operator override and audit events.
- Decide which actions are automatic, which require operator approval, and how to prevent an attacker from deliberately tripping the breaker.
- Prefer narrowly scoped isolation and rate limits. “Fail-closed” should mean rejecting operations whose required security decision cannot be made safely, not indiscriminately shutting down unrelated workloads.
- Use an explicit, validated configuration setting only after its semantics are specified. A proposed setting such as `PROXIMA_SECURITY_BREAKER=fail-closed` must not be treated as implemented until the code and tests confirm it.
- Emit append-only security audit events with enough context to investigate but without secrets or sensitive SQL payloads.
- Alert the control plane when available; preserve local enforcement if the control plane is unavailable.

**Acceptance evidence:** deterministic state-machine tests, threshold-boundary tests, false-positive/recovery tests, abuse simulations, resource-exhaustion tests, audit-event tests and failure-mode documentation.

### Pillar 4 — Proxima Attest (cryptographic security evidence)

**Purpose:** Produce integrity-protected evidence of defined enforcement events and verification outcomes that customers can validate independently.

**Attestation design goals:**
- Periodic (the proposal suggests hourly) evidence snapshots.
- An append-only or tamper-evident ledger of relevant security metadata.
- Signed evidence that can be exported and displayed in the management dashboard.
- A readable report/PDF for customer security reviews.

**Required corrections and engineering requirements:**
- A SHA-256 hash by itself is not a digital signature and does not prove that the data being hashed is truthful. Use a well-defined signature scheme and protected signing keys; hash chaining can provide tamper evidence, not absolute immutability.
- Define the exact claims each evidence record can support. A report must not assert “zero violations” unless the system can account for all relevant operations and explicitly describe coverage gaps.
- Include time window, engine/version, policy/version, evidence schema version, sequence number, previous-record hash, signer/key ID, signature algorithm, verification status and coverage/limitations as appropriate.
- Define key creation, storage, rotation, revocation, backup, access control and compromise response.
- Provide a standalone verifier or documented verification procedure, not merely a green badge in the dashboard.
- Record missing telemetry, restarts, gaps, clock uncertainty and periods in which the engine was not observing traffic.
- Prevent tenant data, credentials, raw SQL or secrets from leaking into reports.
- Keep customer-specific evidence access isolated.
- PDF export is a presentation layer over verifiable evidence; it is not itself proof of compliance.
- Do not promise that downloading this report automatically passes SOC 2, HIPAA, FedRAMP or any audit. These frameworks have broader requirements and require qualified assessment.

**Acceptance evidence:** schema and versioning contract, signed test fixtures, signature verification by an independent verifier, tampering detection tests, key-rotation tests, gap detection, access-control tests and sample report review.

### Pillar 5 — Proxima Verify (recommended product pillar)

**Purpose:** Make security claims reproducible for developers, maintainers, prospective customers and auditors.

- Provide repeatable local verification commands.
- Test tenant A against tenant B, invalid/expired/malformed tokens, RLS bypass attempts, connection reuse, session contamination, role escalation and unexpected disconnects.
- Publish machine-readable output and clear exit codes.
- Separate local tests from tests that require a real PostgreSQL instance or a deployed environment.
- Ensure each security fix gains a regression test.
- Provide a threat-model-to-test mapping so each stated claim points to evidence.

The repository already describes a `tools/proxima-verify.sh` harness and PostgreSQL verification. Audit the actual implementation first; extend what exists rather than building a duplicate verifier.

### Pillar 6 — Control Plane, Cloud and operator experience

- Organization, membership, tenant and environment management.
- Policy authoring/versioning and deployment intent.
- Node enrollment and fleet status.
- Verification evidence, append-only audit events and support requests.
- Secure authentication, authorization and Microsoft Entra OIDC where fully configured.
- Clear health/readiness and operational dashboards.
- Billing and entitlements enforced server-side, with provider webhooks verified and idempotent.
- The engine must continue enforcing its local security boundary if the control plane is unavailable.
- No dashboard or API should display a state as “healthy,” “verified,” “compliant” or “live” unless the status is backed by the actual source of truth.

Audit existing routes, schemas, frontend flows and migrations before modifying them. Avoid duplicating capabilities that already exist.

## 4. Additional recommendations I want included

These recommendations extend the proposal. They are proposed work, not claims of current implementation.

### A. Reproducible benchmark suite
- Compare direct PostgreSQL traffic with traffic through Proxima under the same environment and workload.
- Record CPU, memory, throughput, error rate and p50/p95/p99 latency.
- Include connection reuse/pooling behavior, short and long queries, concurrency levels, cold/warm conditions and realistic client behavior.
- Record machine/OS, Rust build profile, PostgreSQL version/configuration, dataset, commands, repetitions and commit SHA.
- Use tools such as pgbench only with documented settings. “10,000 concurrent queries” must not be treated as a sensible default without validating the actual test design and resource limits.
- Publish measured results, including unfavorable results. Do not pre-commit to “less than 1 ms overhead,” “under 20 MB memory,” or any other target before measuring it.
- Add a performance regression budget only after a baseline is trustworthy.

### B. Formal security claims register
Create a table for every public security claim with: claim wording, threat model, prerequisites, evidence/test, limitations, owner and last verification date. Link homepage, README, sales material and compliance reports to the same approved language.

### C. Supply-chain and release integrity
- Pin/review dependencies and run Rust/JavaScript dependency and secret scanning in CI.
- Produce an SBOM for releases where practical.
- Sign or attest release artifacts and document how users verify them.
- Use least-privilege CI credentials and protected release workflows.
- Define vulnerability reporting and patch/release procedures.

### D. Key and secret lifecycle
- Inventory token, webhook, OIDC, billing and attestation keys.
- Define storage, environment separation, rotation, revocation, access auditing and incident response.
- Never commit live secrets or log credentials.
- Add tests for missing, malformed and rotated secrets.

### E. Resilience, capacity and recovery
- Set explicit limits for concurrent connections, frame size, request duration, queues and memory.
- Test backpressure and graceful shutdown.
- Define retry/time-out behavior without retry storms.
- Verify backup and restore procedures for control-plane data.
- Document recovery objectives only after business and operational needs are agreed and tested.
- Make degraded modes explicit, especially database loss, control-plane loss, signer/key failure and telemetry gaps.

### F. Developer adoption and pilot feedback
- Quick-start path with exact prerequisites and a working sample.
- Docker Compose development experience and production deployment guide.
- Clear errors and troubleshooting guide.
- Example integration with a realistic multi-tenant application.
- Pilot acceptance checklist, feedback capture, known-issues list and rollback path.
- Use real feedback to prioritize features rather than building features only for launch attention.

### G. Accessibility, product quality and customer operations
- Test keyboard navigation, labels, contrast, responsive layouts and error states.
- Test sign-up, sign-in, password recovery, SSO, organization creation, invitation, first tenant, first verification, billing, cancellation and offboarding end-to-end.
- Provide support contact, incident communication process, retention/deletion policy and customer data export path where applicable.
- Remove duplicate or broken links only after tracing references and dependencies; preserve useful legacy documents and migration history.

## 5. What the source PDF says versus what is verified

The product strategy combines four technical pillars, operational telemetry, bounded defensive behavior, verifiable security evidence, a developer adoption strategy, and a sustainable commercial model. Performance targets, security claims, pricing, and launch outcomes require independent validation before they are published as facts.

Items requiring explicit design approval and acceptance:
- `/metrics` and metric names such as `proxima_active_connections`, `proxima_query_processing_time_ms`, and `proxima_blocked_tenant_violations_total`.
- The breaker variable `PROXIMA_SECURITY_CIRCUIT_BREAKER=fail-closed` (the proposal also uses `PROXIMA_SECURITY_BREAKER=fail-closed`; choose one documented name only if adopted).
- Hourly attestation snapshots, SHA-256 block hashing, signed reports and PDF certificate export.
- Suggested Growth/Scale prices of $490/month and $1,190/month and other pricing shown in the proposal. These are source-document ideas, not validated pricing decisions.
- Absolute market, performance, security, compliance, adoption, or financial claims. Publish only claims supported by defined tests, measurements, and an explicit threat model.

This roadmap separates planned capabilities, engineering recommendations, and verified implementation status.

## 6. Competitive position and open-source/commercial strategy

An open-core model is one strategic option: make the core engine available to developers while monetizing higher-value management, monitoring, evidence, organizational controls, and enterprise operations. Licensing and pricing require explicit approval; this document does not make those decisions.

Before committing:
- Compare the actual feature set with PostgreSQL RLS, PgBouncer, Odyssey, database gateways/proxies, policy engines and relevant cloud-native approaches.
- Avoid absolute statements such as “no competitors” or “nobody has built this.”
- State what Proxima adds, what existing tools already do well, what it depends on and when it is not the right choice.
- Decide which repository components are open-source and under which license; preserve the actual license terms.
- Test willingness to pay with pilot customers before treating PDF price points as established.
- Publish honest, reproducible technical material rather than promising GitHub stars or Hacker News front-page placement.

## 7. Commercial and operational requirements

The business layer must be treated as a set of verifiable workflows:
- Pricing source of truth and displayed currency must match the selected provider’s supported checkout behavior.
- Checkout, subscription creation, webhook signature verification, duplicate/out-of-order event handling, entitlements, cancellation and failed payment flows must be tested.
- Keep provider-specific environment variables and credentials isolated by environment.
- Never treat local configuration or a dashboard screenshot as proof that live international payments are operational.
- Verify Microsoft Entra OIDC redirect/callback, state/nonce validation, account linking and failure paths.
- Verify email delivery, DNS authentication and customer support workflows.
- Ensure subscription and feature entitlements are enforced on the server/control plane, not only hidden in the frontend.
- Confirm production hosting, TLS, database backups, restore, monitoring, error tracking, incident response and support ownership.

**Billing status:** Flutterwave is the current provider integration in the repository. Live activation remains conditional on confirming the production account, USD checkout amount/currency, plan identifiers, signed webhook behavior, and entitlement updates against the [Flutterwave billing runbook](../production/flutterwave-billing.md). Historical provider migrations are retained for migration integrity; they are not instructions for new deployments.

There is also a naming/domain discrepancy to resolve before external publication: repository README says **Agata Proxima** and links/notes have used **agataproxima.com**, while a later user instruction specified **Agata Prozima / AgataProzima.com** without a hyphen. Do not silently rewrite domain references. Inspect actual domain ownership/DNS and obtain one canonical spelling before changing public-facing references. The project name in this roadmap remains “Agata Proxima” as used by the current repository README until the naming decision is reconciled.

## 8. Final Execution Map — checkpoints 3.51–3.70

This is the existing roadmap and remains the sole execution map for the current phase. The four pillars and additional recommendations above must be attached to the appropriate checkpoint rather than creating a competing numbered roadmap.

| Checkpoint | Name | Required outcome / acceptance focus |
|---|---|---|
| **3.51** | Production Health Checks | Confirm real health/readiness semantics, dependency checks, accurate degraded states, and operational checks. |
| **3.52** | Public Website Completion | Ensure all public pages, navigation, links, calls to action and responsive states work. |
| **3.53** | Homepage Final Product Audit | Align product story with implemented capabilities; remove placeholders and unsubstantiated promises. |
| **3.54** | Security & Trust Claims | Audit public claims against threat model, tests, operational reality and limitations. Create/update the security claims register. |
| **3.55** | Legal & Customer Trust | Verify appropriate privacy, terms, data handling, retention/deletion, contact and customer-trust information; do not invent certifications. |
| **3.56** | Incident Response | Document detection, triage, containment, communication, recovery, evidence preservation and post-incident review. Include breaker and key-compromise scenarios. |
| **3.57** | Support | Verify real support contact and a usable request/response process, ownership and escalation path. |
| **3.58** | Onboarding | Test signup/sign-in, organization setup, first tenant, first policy/deployment and first successful verification. |
| **3.59** | Offboarding | Test cancellation, access removal, organization/member removal, credential revocation and customer export/deletion paths. |
| **3.60** | Retention & Deletion | Document and test data categories, retention, deletion, audit-evidence retention, backup expiry and exceptions. |
| **3.61** | API Contract | Validate request/response schemas, authentication/authorization, errors, idempotency and OpenAPI consistency. |
| **3.62** | Versioning | Define API/evidence schema compatibility, deprecation, migration and release/version behavior. |
| **3.63** | UX Journey | Test complete user journeys and empty/loading/error/permission states, accessibility and responsive behavior. |
| **3.64** | External SaaS Acceptance | Verify all required external integrations, callbacks, credentials, webhooks, retries and provider-specific live behavior. |
| **3.65** | Fresh Environment | Reproduce setup from a clean environment using documented steps; validate migrations, secrets/configuration and smoke tests. |
| **3.66** | Pilot Acceptance | Define pilot criteria, onboard real testers, capture results/issues and prove rollback/support readiness. |
| **3.67** | Launch Checklist | Review release artifact, docs, domain, TLS, secrets, backups, monitoring, billing, support, legal/trust and rollback. |
| **3.68** | Smoke Test | Run repeatable end-to-end checks on the intended deployed environment, not just local unit tests. |
| **3.69** | Security Acceptance | Run tenant-isolation/RLS, authentication, TLS, adversarial, dependency and evidence-verification gates; resolve critical/high findings or document a justified block. |
| **3.70** | Final Gate | Make an evidence-based go/no-go decision; record blockers, owners, evidence, approved provider/domain, rollback plan and release commit. |

### Pillar-to-checkpoint traceability

- **Engine and tenant isolation:** 3.51, 3.54, 3.61, 3.65, 3.68, 3.69.
- **Monitor and benchmarks:** 3.51, 3.54, 3.56, 3.65, 3.68, 3.70.
- **Breaker and defensive response:** 3.54, 3.56, 3.61, 3.65, 3.68, 3.69.
- **Attest and verifiable evidence:** 3.54, 3.55, 3.56, 3.60, 3.61, 3.62, 3.64, 3.69.
- **Control plane, identity and billing:** 3.51, 3.57–3.65, 3.67–3.70.
- **Developer adoption, docs and pilot:** 3.52, 3.53, 3.57, 3.58, 3.63, 3.65–3.70.
- **Supply chain, secrets, recovery and release integrity:** 3.54–3.56, 3.60, 3.64, 3.65, 3.67–3.70.

## 9. Execution rules and definition of done

1. Start with repository inspection, not speculative edits.
2. Identify the canonical branch and working tree state. Preserve uncommitted and verified work.
3. Inspect existing code, tests, migrations, docs, workflows and deployment configuration before deciding what is missing.
4. Reuse existing components where correct. Avoid duplicate endpoints, competing roadmap files, redundant migrations and dead links.
5. Never copy secrets into documentation, issues, screenshots or logs.
6. Keep development, staging and production configuration separate.
7. For each task, record: current behavior, evidence, gap, implementation, tests, residual risks and status.
8. Distinguish **implemented**, **tested locally**, **CI-passing**, **staging-verified**, and **production-accepted**.
9. Never mark a checkpoint complete from code presence alone. State the command, test, environment and evidence.
10. Use narrow changes and reviewed pull requests. Do not force-reset, blindly rebase, delete legacy branches, or remove referenced files without tracing dependencies and preserving a recovery path.
11. Do not change payment provider, canonical domain, pricing, license, public security claims or production settings based on assumptions.
12. Do not deploy, activate live billing, change DNS or rotate production secrets as an incidental side effect of documentation work.
13. If a task is blocked by missing credentials, external-provider verification or unavailable production environment, document the exact blocker and the evidence still needed.
14. Keep the final go/no-go decision explicit at checkpoint 3.70.

### Status vocabulary

- **NOT AUDITED** — repository evidence has not yet been inspected.
- **PLANNED** — requirement documented; not yet implemented.
- **IMPLEMENTED** — code/configuration exists; testing may still be incomplete.
- **TESTED LOCALLY** — named local tests passed.
- **CI VERIFIED** — relevant CI checks passed for a named commit.
- **STAGING VERIFIED** — verified against a deployed staging environment.
- **PRODUCTION ACCEPTED** — the explicit production acceptance criteria passed with recorded evidence.
- **BLOCKED** — external dependency or unresolved decision prevents acceptance.
- **NOT APPLICABLE** — reason documented and agreed.

Do not pre-fill these statuses without fresh evidence.

## 10. First practical work sequence

1. Read the repository map and the existing acceptance files for checkpoints 3.51–3.70, plus security verification, performance, failure engineering, production readiness, billing and identity runbooks.
2. Inspect the current branch/commit and working tree. Identify which checkpoint evidence already exists.
3. Build a gap matrix for the four pillars: existing implementation, missing implementation, test evidence, documentation, operational dependency and acceptance owner.
4. Audit metrics and benchmark support before adding either; the README currently says performance documentation should avoid unmeasured SLA claims.
5. Define the threat model and breaker semantics before implementing automatic global responses.
6. Define Attest’s signed evidence schema and independent verification model before building the proposal/export UI.
7. Integrate the missing work into checkpoints 3.51–3.70.
8. Continue the checkpoints in order, preserving existing completed work and documenting blockers.
9. Only after the evidence is ready, prepare the technical launch post and publish measured claims.

## 11. New-chat handoff prompt

Use the following handoff brief when transferring work to another engineer or development session:

> We are continuing the **Agata Proxima** repository, `Scarlet-Twinz/Agata-proxima`. Treat `docs/production/docs/product/product-vision-and-roadmap.md` as the handoff document for the product vision and four pillars, and treat the existing **Final Production Roadmap checkpoints 3.51–3.70 as the sole execution roadmap**.
>
> The vision includes Proxima Engine (Rust/Tokio PostgreSQL tenant-isolation boundary), Proxima Monitor (Prometheus/observability and reproducible benchmarks), Proxima Breaker (scoped defensive circuit breaker), Proxima Attest (signed, independently verifiable tamper-evident evidence), Proxima Verify, and the management/control plane and commercial platform.
>
> First inspect the current repository branch, commit, working tree and existing docs/code/tests. Do not assume this roadmap proves any feature is implemented. Build a checkpoint/pillar gap matrix with evidence. Preserve verified work and avoid duplicate features, destructive Git operations, unapproved provider/domain changes or unmeasured security/performance claims. Distinguish local tests, CI, staging and production acceptance. Do not deploy, change DNS or activate live billing unless explicitly asked.
>
> Planned metrics, defensive breaker behavior, attestation cadence, licensing, and pricing are not accepted merely because they appear in this roadmap. Acceptance requires implemented behavior, relevant automated tests, and environment-specific evidence. Additional recommendations include reproducible benchmarks, a security-claims register, supply-chain/release integrity, key lifecycle controls, resilience and recovery testing, a standalone attestation verifier, and a real pilot acceptance process.
>
> Resume with the next incomplete checkpoint in 3.51–3.70, based on repository evidence, and explain the exact change and acceptance test before making broad changes.

## 12. Decisions still to resolve

- **Canonical product/domain spelling:** current README uses “Agata Proxima” and `agataproxima.com`; a later instruction specified “Agata Prozima” and `AgataProzima.com`. Verify domain ownership and confirm one canonical spelling before public-facing edits.
- **Payment provider:** the current repository implements Flutterwave billing. Live acceptance remains blocked until the real checkout returns the configured USD currency and exact amount, webhook verification succeeds, and the full payment/entitlement lifecycle is tested. See `docs/production/flutterwave-billing.md`.
- **Metrics implementation:** confirm whether a Prometheus exporter already exists; the local operator dashboard is not proof that a Prometheus endpoint exists.
- **Circuit breaker semantics:** decide whether it is per connection, per source, per tenant or service-wide; define safe thresholds and recovery.
- **Attestation trust model:** select signing scheme/key custody, verifier format, evidence coverage and limitations before claiming audit readiness.
- **Open-source/commercial split and pricing:** validate through competitor research and customer interviews; PDF price points are not binding.
- **Pilot customer and target deployment environment:** identify a realistic first deployment and the acceptance evidence it can produce.

## 13. North-star definition of success

Agata Proxima succeeds when an independent developer can understand and deploy it, a security engineer can test its tenant-isolation claims, an operator can observe and safely manage it, and a customer can verify its evidence—while the product behaves predictably under failure and the business can support real customers.

**Build the proof before the promise. Measure before the benchmark claim. Verify before the certificate. Validate with customers before assuming revenue.**
