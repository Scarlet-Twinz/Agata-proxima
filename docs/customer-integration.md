# Customer Integration — Agata Proxima

Agata Proxima sits underneath an existing multi-tenant application rather than replacing it.

## 1. Integration boundary

Existing SaaS → Proxima Engine → PostgreSQL

The application keeps its normal PostgreSQL driver. The important change is the database endpoint: the application's PostgreSQL connection points at Proxima.

For libpq-compatible clients, tenant context is carried in PostgreSQL startup options as:

    -c proxima_tenant_token=<signed-token>

The token is verified before the normal query stream begins. Proxima removes the private option before forwarding startup to PostgreSQL.

## 2. What customers own
- Application and business authorization.
- Tenant identity source.
- PostgreSQL data.
- Self-hosted infrastructure when using the Engine.

Proxima owns the infrastructure boundary: tenant-context verification, connection/session binding, PostgreSQL role selection, TLS boundary, lifecycle safety, verification and audit evidence.

## 3. Control Plane is not the runtime security dependency
The Control Plane provides organizations, tenants, policies, node enrollment, deployments, verification, audit, support and billing.

A running Engine does not call the Control Plane for every database query. If management services become unavailable, an already-running Engine continues enforcing its local tenant boundary.

## 4. Typical onboarding
1. Create an Agata Proxima workspace.
2. Register a Proxima node.
3. Store the one-time enrollment token.
4. Configure the Engine beside PostgreSQL.
5. Configure tenant signing material.
6. Point the application's database connection at Proxima.
7. Issue tenant-bound connection context.
8. Run the three-tenant verification suite.
9. Promote the node after evidence is clean.

## 5. Production topology
Control Plane → desired state → Proxima Engine nodes → PostgreSQL tenant data.

Identity, policies, fleet, audit and billing are management concerns. The Engine is the enforcement boundary.

## 6. What applications do not need to rebuild
Applications do not need to duplicate the complete Proxima protocol boundary, PostgreSQL startup handling, connection lifecycle protections or database-role routing.

Proxima is an infrastructure boundary, not a substitute for application authorization.

## 7. External SaaS acceptance
Before a real deployment is called production-accepted, run tenant A/B/C traffic, cross-tenant reads and writes, transactions, prepared statements, connection reuse, credential expiry/rotation, Engine restart, Control Plane outage and audit/evidence comparison.

The repository contains the acceptance architecture and harness; a real customer application still has to be exercised through it.