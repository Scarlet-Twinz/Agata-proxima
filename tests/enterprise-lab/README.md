# Agata Proxima Enterprise Test Lab

> **Status: PLANNED — not implemented or executed yet.** This is a controlled customer simulation for testing the real Agata Proxima Engine and Control Plane. It is not a mock engine and is not proof of production readiness.

## 1. Mission

Build a small fictional SaaS company that depends on the actual Proxima Engine for its PostgreSQL tenant boundary. Use it to test installation, configuration, real tenant traffic, monitoring, attacks, failures, recovery, evidence, and offboarding.

**Test company:** Northstar Service Desk (fictional)  
**Application:** minimal multi-tenant customer-support API  
**Database:** PostgreSQL  
**Security boundary:** actual Proxima Engine binary  
**Management:** actual Control Plane for management scenarios  
**Tenants:** A, B and C with independent credentials and synthetic data  
**First environment:** disposable local Docker Compose setup  
**Next environment:** fresh isolated staging deployment  
**Frontend:** optional; an API/CLI and normal PostgreSQL driver are enough to test the boundary.

Use synthetic data only. Never use production customer data, real secrets, or live payment credentials.

## 2. Business scenario

Northstar Service Desk sells a hosted help-desk service to three customer organizations. Each organization owns tickets and internal notes. Tenant A must never read or modify Tenant B or C records.

| Tenant | Fictional customer | Seed rows | Expected access |
|---|---|---|---|
| A | Acorn Retail | A-001, A-002 | Own rows only |
| B | Bluebird Logistics | B-001, B-002 | Own rows only |
| C | Cedar Health Demo | C-001, C-002 | Own rows only |

Use only fictional ticket data. The demo name is not permission to use real health or personal information.

Minimal protected tables: organizations, tickets, and ticket_notes. Protected tables need appropriate RLS policies and grants. Verify role ownership, superuser and BYPASSRLS risks, FORCE RLS where applicable, and that tenant roles cannot alter context to escape policy.

## 3. Architecture

```text
Tenant A test client ─┐
Tenant B test client ─┼──> Northstar test API/client
Tenant C test client ─┘                |
                                       v
                            Real Proxima Engine
                                       |
                                       v
                       PostgreSQL + tenant roles + RLS

Operator/test runner ──> Real Proxima Control Plane
Metrics and audit events ──> test assertions and saved evidence
```

Application traffic for proxy-security tests must go through Proxima, not directly to PostgreSQL. Direct database access is allowed only for controlled fixture setup/teardown and independent RLS verification. Prevent application clients from using PostgreSQL as an alternate bypass path.

## 4. Repository-first guardrails

Before implementation, inspect the current branch, environment contract, ports, migrations, token format and existing test code. Read docs/verification.md, docs/customer-integration.md, docs/failure-engineering.md, docs/performance.md, docs/production/operational-readiness-runbook.md, and docs/production/phase3b-3-24-40-acceptance.md.

Reuse and extend the existing tools/proxima-verify.sh, tests/postgres/verify_rls.sh, and crates/proxima-engine/tests/postgres_integration.rs. Do not create a second token format or duplicate the security engine. The current verification guide documents the harness inputs; use the actual current contract rather than guessing.

Use disposable resources only. Never commit real passwords, signing keys, tokens, webhook secrets or production environment files. Do not change DNS, production hosting, live billing or production secrets as part of lab work. Do not stub the Engine, database, Control Plane or verification result and then claim an end-to-end pass.

## 5. End-to-end scenario catalogue

### A. Installation and reproducibility
- Clone a named commit in a clean directory and follow documented steps.
- Start the actual services and disposable database.
- Apply schema and seed data.
- Verify Engine, database and Control Plane health.
- Connect a normal PostgreSQL client through Proxima.
- Repeat from a clean disposable environment with no hidden local state.
- Confirm missing secrets and invalid configuration fail safely and clearly.

**Pass:** documented setup is repeatable and uses the real binaries.

### B. Normal tenant workflows
- Each tenant reads its own records.
- Each tenant inserts, updates and deletes permitted records.
- Prepared statements, transactions and rollback work.
- Reused connections cannot inherit the previous tenant's identity/context.
- Engine restart and reconnect preserve isolation.

**Pass:** legitimate operations succeed and row-level results match expected data.

### C. Cross-tenant isolation — release blocking
For A, B and C, attempt access to the other two tenants' records:
- Cross-tenant SELECT by guessed ID.
- Cross-tenant INSERT, UPDATE and DELETE.
- Prepared-statement and transaction variants.
- Missing, invalid, tampered, expired or wrong-version token according to the actual token contract.
- Attempts to change session variables, roles or tenant context.
- Attempts to bypass RLS with tenant credentials.
- Connection reuse across tenant contexts.
- Attempted direct-to-PostgreSQL bypass as an application client.
- Inspect role privileges for superuser, table-owner and BYPASSRLS bypass risks.
- Verify unauthorized rows were neither disclosed nor changed, not merely that an error was returned.

**Pass:** zero cross-tenant disclosure or mutation. Any confirmed disclosure or mutation blocks release.

### D. Protocol and resource robustness
- Malformed/truncated startup packets and frames.
- Oversized frame rejection within safe test limits.
- Invalid TLS negotiation and authentication failures.
- Database refusal, client disconnect and stalled upstream.
- Concurrent clients across all three tenants.
- Connection exhaustion and resource limits.
- No process panic, unbounded memory growth, stale tenant context or secret leakage.

**Pass:** controlled rejection, bounded resources, documented errors and no cross-tenant state contamination.

### E. TLS and secret lifecycle
- Required client TLS rejects plaintext; valid TLS succeeds.
- Invalid CA and wrong upstream hostname fail when verification is required.
- Handshake timeout is bounded.
- Rotate tenant signing material using the supported procedure.
- Old/revoked tokens fail where expected.
- Logs and artifacts contain no credentials or key material.

**Pass:** actual supported TLS/rotation modes work. Unsupported or untestable modes remain BLOCKED, not inferred as passing.

### F. Failure engineering
- PostgreSQL outage and recovery.
- Engine restart during active traffic.
- Control Plane outage while an already-running Engine handles valid requests.
- Control Plane recovery and management-state reconciliation.
- Invalid policy publication and previous-policy behavior.
- Node disappearance and stale-health reporting.
- Resource/dependency failures in the disposable environment.
- No stale tenant session reused after failures.

**Pass:** behavior matches docs/failure-engineering.md; a dependency failure does not silently become an authorization bypass.

### G. Monitoring, audit and Attest
- Health/readiness reflects actual dependencies.
- If a real Prometheus endpoint exists, scrape it and validate metric values against controlled traffic.
- Verify security counters/events correspond to actual decisions.
- Ensure labels/logs do not leak tenant identifiers unnecessarily, secrets, raw SQL or personal data.
- If Proxima Attest is implemented, generate evidence from real events and independently verify its signature.
- Tamper with a disposable evidence copy and verify detection.
- Ensure gaps/restarts/unobserved periods are not reported as zero violations.
- Verify one tenant cannot read another tenant's evidence.
- Reports must not claim a report alone guarantees SOC 2, HIPAA, FedRAMP or other compliance.

**Pass:** only existing, independently tested capabilities are marked PASS. Missing Monitor, Breaker or Attest implementation remains a recorded gap.

### H. Control Plane and customer lifecycle
- Create organization, users, tenants and node using supported flows.
- Verify organization-scoped authorization and role permissions.
- Publish/version a policy and verify actual Engine behavior.
- Inspect audit and verification evidence.
- Attempt unauthorized cross-organization API calls.
- Offboard a tenant: revoke credentials/access and verify no access remains; follow the actual export/deletion policy.
- Test server-side entitlements where relevant, using sandbox billing only.

**Pass:** authorization is enforced by the server/control plane, not merely by hidden frontend buttons.

### I. Performance
- Establish direct PostgreSQL baseline in the test environment.
- Repeat identical workloads through Proxima in supported TLS modes.
- Measure connection rate, concurrency, throughput, p50/p95/p99 latency, CPU, memory, errors and recovery time.
- Include prepared statements and realistic payloads.
- Save exact commands, environment versions, workload and commit SHA; repeat runs.

**Pass:** report actual measurements. Do not predeclare a latency or memory target without a baseline. Performance success does not substitute for security tests.

### J. Fresh staging and launch evidence
- Deploy a named commit into an isolated staging environment.
- Reproduce migrations from a clean database.
- Verify TLS, routing, secrets and service authentication.
- Run relevant scenarios against real deployed services.
- Configure monitoring and prove alerts arrive.
- Verify backup and perform an isolated restore drill.
- Exercise rollback and record recovery.
- Record external-provider, domain, SSO, support and billing blockers.
- Produce explicit evidence-backed GO/NO-GO with owners and release commit.

**Pass:** staging acceptance is distinct from production acceptance. Production must be tested separately.

## 6. Evidence record

For each scenario record: ID/title, timestamp/timezone, branch and commit SHA, OS/runtime/Rust/PostgreSQL versions, exact command, configuration template version, expected and observed result, PASS/FAIL/BLOCKED/NOT RUN, exit code, sanitized log excerpt, artifact path, defect link and retest commit.

Suggested local evidence layout:

```text
artifacts/enterprise-test-lab/<commit-sha>/
  environment.md
  summary.md
  isolation/
  protocol/
  failure-engineering/
  telemetry-attestation/
  performance/
  staging/
```

Keep secret-bearing logs out of Git. Commit only sanitized summaries and stable fixtures.

## 7. Release gates

**Gate 1 — Local integration:** Rust format/check/test/clippy, RLS verification, real proxy integration, property tests, Proxima Verify against the real Engine, all cross-tenant negative cases, and no unresolved critical/high security defect.

**Gate 2 — Clean environment:** fresh clone setup, no untracked-state dependency, verified migration/config failure behavior, safe disposable teardown.

**Gate 3 — Staging:** real deployed Engine, Control Plane and database; isolation, TLS, management, audit, failure/recovery, monitoring/alerts and backup/restore evidence.

**Gate 4 — Production decision:** actual production environment verified separately; external providers, domain, SSO, support, billing and operations reconciled against canonical runbooks; no release-blocking security issue; limitations and rollback documented. Record GO or NO-GO with evidence.

Passing this lab is necessary evidence, not an automatic guarantee of enterprise suitability or regulatory compliance. A real pilot and customer-specific review remain required.

## 8. Build sequence

1. Audit the actual branch, source tree, environment contract and existing harnesses.
2. Create a disposable Docker Compose environment using the real Engine, PostgreSQL and Control Plane where appropriate.
3. Add synthetic Northstar schema and seed fixtures.
4. Reuse the existing RLS script, integration test and Proxima Verify harness under one repeatable entry point.
5. Add missing cross-tenant, connection-reuse and lifecycle scenarios.
6. Add failure/TLS tests supported by the real implementation.
7. Capture evidence and machine-readable PASS/FAIL/BLOCKED/NOT RUN summaries.
8. Run locally, fix failures, then repeat in fresh staging.
9. Map results into existing checkpoints 3.51–3.70.
10. Make the final launch decision from evidence, not confidence, feature count or CI status alone.

**Do not mark this lab as built or passed until actual files exist, real binaries have been exercised, and evidence is recorded.**