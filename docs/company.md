# Agata Proxima

## Company thesis

Multi-tenant SaaS applications should not have to depend on thousands of repeated application-level security decisions to maintain customer data boundaries.

Agata Proxima is being built as infrastructure for that boundary.

## Product family

### Proxima Engine

The self-hosted data-plane component between an application and PostgreSQL.

### Proxima Verify

Automated adversarial verification of tenant isolation and policy behavior.

### Proxima Cloud

The hosted control plane for policy management, deployments, observability, audit, verification results, and fleet operations.

## Long-term product principle

The product is not a SQL string rewriting service.

The objective is a trustworthy security boundary with explicit identity, policy, enforcement, and verification semantics.

## Business model direction

The engine can remain available for self-hosted adoption while the hosted control plane provides the commercial management layer.

Pricing will be validated with real users rather than assumed before product-market evidence exists.
