# Agata Proxima Pricing Proposal

This document records the canonical launch-price schedule for Agata Proxima. The founder has directed that the previous $149 / $499 / $1,199 monthly prices be restored in the repository. This document does not itself create or modify Paddle products; before live checkout, verify the Agata-specific monthly USD price IDs and amounts in Paddle.

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

## Paddle Billing boundary

Only Agata Proxima products should be created in the connected Paddle account. Do not modify, rename, reuse or attach Agata customers to unrelated products.

The Free plan does not need a recurring Paddle price. The initial Paddle catalog should contain these monthly USD recurring prices:

- Agata Proxima Starter — $149/month
- Agata Proxima Growth — $499/month
- Agata Proxima Scale — $1,199/month

Configure the corresponding Paddle **price IDs** (`pri_...`) as `PADDLE_STARTER_PRICE_ID`, `PADDLE_GROWTH_PRICE_ID`, and `PADDLE_SCALE_PRICE_ID`. The API validates that each price is active, monthly, USD, unique, and matches the canonical price. Enterprise remains sales-led/custom until a contract-specific billing workflow is defined.

Do not enable live checkout based only on this document. Verify Paddle business and checkout-domain approval, the production API key/client token/notification secret, the three price IDs, and the complete signed webhook/payment lifecycle before activating production billing. See `docs/production/paddle-billing.md`.
