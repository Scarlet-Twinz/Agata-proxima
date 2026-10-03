# Proxima Control Plane

The Proxima Control Plane is the management plane around the hardened Proxima Engine.

It owns organization identity, tenant catalog, policy versions, fleet registration, deployment intent, verification evidence, audit history and support requests.

It does **not** own the database security boundary.

## Run

Start a PostgreSQL instance for the control plane:

```text
PROXIMA_CONTROL_DATABASE_URL=postgres://proxima_control:proxima-control-dev@127.0.0.1:55432/proxima_control
PROXIMA_CONTROL_BIND=127.0.0.1:8080
```

Then:

```bash
cargo run -p proxima-control-plane
```

Open `http://127.0.0.1:8080`.

## Product surfaces

- Public platform homepage
- Sign up
- Sign in
- Command Center
- Tenants
- Policies
- Fleet
- Deployments
- Verification
- Audit
- Security Boundary
- Infrastructure
- Settings
- Developer API
- Support queue

## Failure principle

If the control plane is unavailable, an already-running Proxima Engine does not receive permission to weaken tenant enforcement.

The control plane manages **intent and operations**. The Engine remains the **enforcement authority**.
