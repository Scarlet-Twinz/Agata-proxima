# Agata Proxima Entitlement Matrix

Launch pricing is approved at **Free / $79 Starter / $249 Growth / $799 Scale / Enterprise Custom**.

The fundamental Proxima Engine security boundary is available on every plan. Commercial differentiation is based on capacity, operational controls, retention, identity, support and deployment requirements.

## Launch matrix

| Capability | Free | Starter $79 | Growth $249 | Scale $799 | Enterprise |
|---|---:|---:|---:|---:|---|
| Proxima Engine enforcement | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tenant-context validation | ✓ | ✓ | ✓ | ✓ | ✓ |
| Session binding | ✓ | ✓ | ✓ | ✓ | ✓ |
| PostgreSQL RLS enforcement | ✓ | ✓ | ✓ | ✓ | ✓ |
| Control-plane-independent enforcement | ✓ | ✓ | ✓ | ✓ | ✓ |
| Nodes | 1 | 2 | 5 | 15 | Custom |
| Tenants | 3 | 25 | 100 | 500 | Custom |
| Environments | 1 | 2 | 5 | Custom | Custom |
| Policy versioning | ✓ | ✓ | ✓ | ✓ | ✓ |
| Basic verification | ✓ | ✓ | ✓ | ✓ | ✓ |
| Advanced verification/evidence | — | — | ✓ | ✓ | ✓ |
| Fleet/deployment controls | — | Basic | ✓ | Advanced | Advanced |
| Audit retention | 7 days | 30 days | 180 days | 1 year | Custom |
| Organization invitations | — | ✓ | ✓ | ✓ | ✓ |
| Email support | — | ✓ | ✓ | ✓ | ✓ |
| Priority support | — | — | ✓ | ✓ | ✓ |
| Microsoft Entra OIDC | — | — | Optional | ✓ | ✓ |
| SAML compatibility | — | — | — | — | Available |
| Dedicated/private deployment | — | — | — | Optional | ✓ |
| Custom SLA | — | — | — | — | ✓ |
| Security/compliance requirements | Standard | Standard | Advanced | Advanced | Custom |

## Enforcement rule

Plan entitlements must never weaken or disable the Engine's core isolation behavior.

For example, a Free-plan tenant must not become less isolated because it has exceeded a commercial limit. The system should reject the operation that exceeds the entitlement, while continuing to enforce existing tenant isolation.

## Metering dimensions

The first implementation should meter:

- active Proxima nodes;
- active tenants;
- configured environments;
- audit-retention policy;
- advanced verification usage;
- enterprise identity features;
- deployment/fleet operations.

Do not meter individual SQL queries or deliberately degrade the security boundary.

## Upgrade behavior

When an organization upgrades:

1. Stripe subscription changes.
2. Stripe webhook updates the organization's billing state.
3. Entitlement resolution reads the verified plan.
4. Newly unlocked capacity becomes available.
5. An audit event records the plan transition.

## Downgrade behavior

Downgrades must be safe.

If the current state exceeds the destination plan's limits:

- do not delete tenants;
- do not disable isolation;
- do not silently delete nodes;
- mark the organization as **over entitlement**;
- block creation of additional resources beyond the destination limit;
- allow the customer to reduce capacity or upgrade again;
- surface the exact remediation required.

This prevents billing changes from becoming destructive security events.

## Billing source of truth

Stripe is authoritative for payment/subscription lifecycle.

Agata's database is authoritative for:

- organization membership;
- current cached billing state;
- resolved entitlements;
- audit history.

Webhook events are idempotent and append-only in `billing_events`.

## Free plan

Free is an Agata entitlement, not a Stripe subscription.

A newly created organization receives:

```
plan = free
billing_status = active
```

until it upgrades.

## Stripe catalog

Do not reuse unrelated products.

Create only:

- Agata Proxima Starter — $79/month
- Agata Proxima Growth — $249/month
- Agata Proxima Scale — $799/month

Enterprise remains custom.

Annual pricing can be added after launch validation.
