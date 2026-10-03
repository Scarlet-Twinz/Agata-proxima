# Phase 56 — Security Adversarial Gate

The following tests are release gates.

## Identity and authorization
- expired sessions are rejected;
- CSRF-protected writes reject missing or incorrect tokens;
- viewer memberships cannot perform administrative writes;
- organization IDs in request bodies cannot escape the authenticated organization;
- billing checkout accepts only configured Agata Price IDs;
- Stripe webhook signatures are required;
- duplicate webhook events do not duplicate billing state.

## Entitlement bypass
For every plan boundary:
- capacity at the limit is rejected;
- capacity below the limit is accepted;
- downgrade preserves existing resources;
- new resources beyond the lower limit are rejected;
- feature-gated endpoints reject plans without the feature;
- a client cannot enable a feature by changing dashboard JavaScript.

## Data-plane boundary
- tenant A cannot read tenant B;
- expired tenant context is rejected;
- malformed tenant context is rejected;
- replayed or invalid signatures are rejected;
- Engine enforcement continues when Control Plane is unavailable.

## Evidence
A release is not accepted because a dashboard displays green. Each test must produce machine-readable evidence or an explicit pass/fail result.
