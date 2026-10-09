# Agata Proxima Pricing Proposal

This document records the restored launch-price schedule for Agata Proxima. Do not create or modify Paystack Plans until the configured account plans are checked against these amounts and the founder confirms the live catalog.

## Recommended launch pricing

| Plan | Monthly | Position |
|---|---:|---|
| Free | $0 | Evaluation, development and small proofs of concept |
| Starter | $149 | First production SaaS deployments |
| Growth | $499 | Multi-tenant SaaS teams running meaningful production workloads |
| Scale | $1,199 | Larger fleets and security/operations teams |
| Enterprise | Custom | Contracted enterprise deployments |

### Why not $29?

Current comparable infrastructure/security products show lower self-serve anchors around $29–$49 and more operational/security-oriented offerings around $149–$199+ before enterprise features. Examples include BoundaryCI at $49, InferaDB at $29, CSPM.io at $199 base for managed deployment, and security platforms with $149/$499 tiers. These are not direct substitutes for Proxima, but they provide useful market anchors.

Proxima should not compete by being the cheapest infrastructure boundary. Its value proposition is that tenant isolation is enforced below the application layer, with verification, fleet management, audit evidence and a control plane around that boundary.

## Entitlement philosophy

The security boundary is not paywalled.

Every plan uses the same fundamental Proxima Engine enforcement model:

- tenant-context validation;
- session binding;
- PostgreSQL role/RLS enforcement;
- TLS boundary;
- lifecycle hardening;
- control-plane independence.

Plans differ primarily by scale and operations:

### Free

- 1 Proxima node
- 3 tenants
- 1 environment
- development/evaluation use
- basic verification
- 7-day management/audit retention
- community support

### Starter — $149/month

- 2 nodes
- 25 tenants
- production deployment
- 2 environments
- policy versioning
- verification evidence
- 30-day audit retention
- email support

### Growth — $499/month

- 5 nodes
- 100 tenants
- 5 environments
- fleet/deployment controls
- advanced verification
- 180-day audit retention
- priority support
- organization-level identity controls

### Scale — $1,199/month

- 15 nodes
- 500 tenants
- larger environments
- advanced fleet operations
- 1-year audit retention
- enterprise identity features
- priority operational support

### Enterprise — Custom

- custom node/tenant capacity
- dedicated or private deployment options
- Microsoft Entra OIDC and later SAML compatibility
- custom audit retention
- security/compliance requirements
- SLA and support terms
- negotiated deployment/data-residency requirements

## Billing model

Launch with simple flat-rate recurring subscriptions.

Do not introduce per-seat billing initially. Proxima's value is tied more naturally to protected infrastructure, tenant capacity and operational scale than to the number of human users.

A future usage/overage model can be added after real customer usage data exists.

## Annual billing

After the monthly plans are validated, add annual billing at approximately two months free:

- Starter: $1,490/year
- Growth: $4,990/year
- Scale: $11,990/year

These annual figures are intentionally simple rather than aggressively discounted.

## Paystack boundary

Only Agata Proxima products should be created in the connected Paystack account.

Do not modify, rename, reuse or attach Agata customers to the existing unrelated Nexora product.

The Free plan does not need a Paystack recurring Plan.

The first Paystack catalog should contain:

- Agata Proxima Starter — $149/month
- Agata Proxima Growth — $499/month
- Agata Proxima Scale — $1,199/month

Enterprise remains sales-led/custom until a contract-specific billing workflow is defined.

No Paystack Plans should be created from this document until the founder confirms the plan limits and launch prices.
