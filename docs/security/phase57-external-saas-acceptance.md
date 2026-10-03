# Phase 57 — External SaaS Acceptance

The reference application under tests/external-saas/reference-app is an independent application process. It deliberately does not reproduce Proxima's tenant-isolation implementation.

## Acceptance topology

SaaS HTTP client
      |
External SaaS reference app
      |
X-Proxima-Tenant-Token
      |
Proxima Engine
      |
PostgreSQL

## Required evidence
Run the reference application against a real running Engine and verify:
- tenant A creates and reads A data;
- tenant B creates and reads B data;
- tenant C creates and reads C data;
- A cannot read B;
- B cannot read C;
- C cannot read A;
- expired tenant context is rejected;
- the external application does not need to understand PostgreSQL RLS internals.

The repository contains the acceptance harness and CI syntax gates. A real runtime acceptance result is still a deployment test and must not be claimed until it has actually been executed.
