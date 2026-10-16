# Product Proposal Review and Evidence Notes

This document records the source proposal's product and engineering ideas, alongside review notes that distinguish proposed capabilities from verified implementation and evidence.

**Scope:** This is a structured summary of the proposal's ideas, not the original source document. Treat its suggested metrics, performance targets, security claims, pricing, and launch outcomes as proposals unless independently validated.

## Source proposal, grouped by topic

### A. Prometheus/Grafana telemetry (source pages 1, 5, 8)

The proposal recommends adding a native Prometheus-format `/metrics` endpoint to the Rust engine and making runtime metrics available to Grafana or Datadog. Example metric names proposed in the proposal:

- `proxima_active_connections`
- `proxima_query_processing_time_ms`
- `proxima_blocked_tenant_violations_total`

The proposal states the repository has a local operator dashboard at `http://127.0.0.1:9080` and frames metrics integration as a way to demonstrate production-engineering maturity.

**Review note:** A local dashboard does not establish that a Prometheus endpoint exists. Verify the current code first. Prefer unit-correct metric names (for example, seconds for a latency histogram), bounded labels, and a deliberate network/authentication exposure policy. Do not promise zero overhead without measurement.

### B. Reproducible benchmark matrix (source page 1)

The proposal recommends filling `docs/performance.md` with reproducible direct-PostgreSQL versus Proxima-throughput comparisons, using a tool such as `pgbench`. It proposes publishing latency, throughput and memory numbers and gives illustrative targets of under 1 ms networking latency and under 20 MB memory use.

**Review note:** Those figures are aspirational claims from the source, not measured results. Record environment, exact commands, PostgreSQL configuration, concurrency, dataset, repetitions, commit SHA, p50/p95/p99 latency, throughput, CPU, memory and errors. Publish the measurements actually observed, even when they miss the proposed targets.

### C. Security circuit breaker / fail-closed behavior (source pages 1–2, 5, 8)

The proposal proposes a configuration flag. It uses two names in different passages:

- `PROXIMA_SECURITY_CIRCUIT_BREAKER=fail-closed`
- `PROXIMA_SECURITY_BREAKER=fail-closed`

The proposed behavior is to detect a rapid spike of unauthorized tenant tokens or malformed/oversized PostgreSQL binary frames, reject traffic or isolate an affected scope, notify the control plane and write a critical append-only audit event.

**Review note:** Neither variable should be assumed to exist until the repository proves it. Select one name only if the feature is approved. Define triggers, scope, thresholds, breaker state transitions, cool-down, recovery, audit behavior and operator controls. A single malicious client must not be able to disable unrelated tenants or cause a global outage. Fail-closed behavior must be scoped to the security decision that cannot be made safely.

### D. Proxima Attest / cryptographic compliance evidence (source pages 3–4, 6, 9)

The proposal proposes an hourly cryptographic attestation generated from the engine's internal state. It suggests proving claims such as tenant-token verification, no global/unisolated database context and no isolation-rule bypass. It proposes a signed append-only ledger, a dashboard download and a PDF certificate for auditors.

The proposal's diagram describes the following four pillars:

1. Proxima Engine (Rust/Tokio): tenant token validation, TLS, tenant role binding and FORCE RLS.
2. Proxima Monitor: a metrics endpoint and Prometheus/Grafana integration.
3. Proxima Breaker: detection of malformed or oversized frames and fail-closed defensive action.
4. Proxima Attest: hourly state snapshot, SHA-256 block signature/hash and a PDF compliance report.

**Review note:** A SHA-256 hash is not a digital signature. Hash chaining can make edits detectable but does not independently prove that the underlying observations are truthful or complete. Use an explicit signature scheme, protected signing keys, key IDs, rotation/revocation, an independent verifier, coverage/gap reporting and tamper-detection tests. A report can support an audit; it cannot by itself guarantee that a customer passes SOC 2, HIPAA, FedRAMP or another compliance assessment.

### E. Market problem and positioning (source pages 6–7)

The proposal frames the central problem as accidental cross-tenant data exposure caused by application code forgetting tenant filters. It contrasts the idea with:

- PgBouncer and Odyssey, described in the proposal as connection-pooling tools that do not provide Proxima's proposed tenant-context enforcement.
- ORM middleware such as Prisma/Sequelize, described as relying on application-layer behavior.
- Enterprise database-isolation offerings, described in the proposal as more expensive/heavier.

It proposes positioning Proxima as a lightweight, developer-friendly PostgreSQL security boundary that can be deployed with Docker and helps teams avoid relying only on repeated application-level tenant filters.

**Review note:** These are the source's positioning statements, not verified competitive research. Compare the actual feature set with PostgreSQL RLS, database proxies/gateways, policy tools and cloud-native alternatives. Avoid claims that there are no competitors or that nobody else has built similar technology.

### F. Open-core and commercial model (source pages 3, 7–9)

The proposal proposes an open-core strategy: keep the core engine available to developers while charging for enterprise control-plane features, management, dashboard functionality and compliance evidence. It mentions pricing examples including Growth at $490/month and Scale at $1,190/month, and elsewhere references other pricing tiers.

**Review note:** Treat all PDF pricing as illustrative until tested with real customers and aligned with actual costs, provider constraints, packaging and support obligations. Licensing and the exact open-source/commercial split remain explicit decisions.

### G. Launch and community strategy (source pages 1–9)

The proposal recommends updating the README, completing performance and security documentation, preparing a Hacker News launch, making a Show HN submission, publishing architecture material and encouraging developers to share the project organically.

The proposal recommends a public launch supported by technical materials and reproducible evidence, including latency, connection pooling, memory use, and security-boundary explanations.

**Review note:** Treat launch attention and revenue as uncertain outcomes. Build launch readiness around a reproducible demo, accurate README, transparent benchmark results, security verification, clear limitations, working deployment, support and pilot feedback. Do not claim production readiness merely because the codebase is large or CI passes.

## Additional statements in the proposal that require careful treatment

The proposal includes broad claims about market position, performance, isolation guarantees, regulatory compliance, adoption, and revenue. Treat these as hypotheses, not established facts. Public product, security, compliance, sales, and investor materials should use specific, testable language tied to a threat model and supporting evidence.

## How to use this file

- Use this file to remember what the source proposal proposed.
- Use `product-vision-and-roadmap.md` as the product and engineering roadmap.
- Use the Final Production Roadmap checkpoints 3.51–3.70 as the sole execution map.
- For every source idea, inspect the current repository before implementing it, record what already exists, add only the missing work, and attach explicit acceptance tests.
