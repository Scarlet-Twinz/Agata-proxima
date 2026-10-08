# Phase 3A Error Catalog

| Error | Meaning | Required action |
|---|---|---|
| `401` | No valid authenticated session | Sign in again |
| `403` | CSRF, role or organization-boundary violation | Correct the authenticated context; never bypass the check |
| `404` | Resource is not owned by the active organization | Switch to the correct organization or use the correct resource |
| `409` | Resource identity already exists | Use the existing organization-scoped identity |
| `422`-style validation response | Input or external connection validation failed | Correct the configuration and retry |
| `503` | Required production secret/service is unavailable | Configure the deployment contract; do not hardcode a fallback secret |
| `subscription_inactive` | Billing entitlement does not permit the operation | Restore the organization's active entitlement |
| `plan_limit_reached` | Organization entitlement capacity is exhausted | Upgrade or remove unused capacity |
| `proxima_boundary_denied` | Runtime enforcement rejected the request | Treat the decision as authoritative runtime security evidence |
| `replay detected` | A short-lived tenant context was already consumed | Issue a fresh context; do not retry the old credential |

Secrets, passwords, raw integration credentials and encryption keys must never be included in these error responses.
