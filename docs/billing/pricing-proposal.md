# Agata Proxima Pricing Proposal

This document records the canonical launch-price schedule for Agata Proxima. The founder has directed that the previous $149 / $499 / $1,199 monthly prices be restored in the repository. This document does not itself create or modify Lemon Squeezy plans; before live checkout, verify the existing Agata-specific plan codes and amounts in the Lemon Squeezy account.

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
- 1 active webhook integration
- 100 verification runs per UTC calendar month
- 1 team seat
- development/evaluation use
- basic verification
- 7-day management/audit retention
- community support

### Starter — $149/month

- 2 nodes
- 25 tenants
- 2 environments
- 5 active webhook integrations
- 1,000 verification runs per UTC calendar month
- 5 team seats
- 5 active API keys and 300 authenticated API requests/minute
- production deployment
- policy versioning
- verification evidence
- 30-day audit retention
- email support

### Growth — $499/month

- 5 nodes
- 100 tenants
- 5 environments
- 20 active webhook integrations
- 10,000 verification runs per UTC calendar month
- 15 team seats
- 25 active API keys and 1,000 authenticated API requests/minute
- fleet/deployment controls
- advanced verification
- 180-day audit retention
- priority support
- organization-level identity controls

### Scale — $1,199/month

- 15 nodes
- 500 tenants
- 50 environments
- 100 active webhook integrations
- 100,000 verification runs per UTC calendar month
- 50 team seats
- 100 active API keys and 5,000 authenticated API requests/minute
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

## Lemon Squeezy boundary

Only Agata Proxima products should be created in the connected Lemon Squeezy account.

Do not modify, rename, reuse or attach Agata customers to the existing unrelated Nexora product.

The Free plan does not need a Lemon Squeezy recurring Plan.

The first Lemon Squeezy catalog should contain:

- Agata Proxima Starter — $149/month
- Agata Proxima Growth — $499/month
- Agata Proxima Scale — $1,199/month

Enterprise remains sales-led/custom until a contract-specific billing workflow is defined.

Do not change the live Lemon Squeezy catalog based only on this document. The repository catalogue is now canonical at $149 / $499 / $1,199 per month; verify the actual provider plans, USD settlement eligibility and webhook/payment flow before enabling production checkout.
