# Agata Proxima

**Security infrastructure for multi-tenant applications.**

Agata Proxima treats PostgreSQL tenant isolation as an infrastructure boundary that can be enforced, tested, monitored, and audited. The core data plane is written in Rust, alongside a management control plane, React frontend, verification tooling, and operational documentation.

> **Project status:** Active development. Repository code and passing CI do not, by themselves, establish production readiness. Live-provider activation, deployed-environment testing, and final operational acceptance must be verified separately.

## Product capabilities

- **Proxima Engine** — PostgreSQL protocol gateway and tenant-context enforcement.
- **Proxima Verify** — repeatable isolation and adversarial verification.
- **Proxima Monitor** — operational metrics and runtime visibility.
- **Proxima Breaker** — scoped defensive handling for defined protocol and authentication violations.
- **Proxima Attest** — signed, tamper-evident security evidence and report workflows.
- **Control Plane** — organization, tenant, policy, node, deployment, audit, identity, and billing workflows.

Capability names describe the product architecture. See the implementation and acceptance documentation before relying on any security or production claim.

## Get started

### Prerequisites

- Rust toolchain compatible with the workspace
- Docker Desktop with Docker Compose
- Node.js 24 and npm for frontend work
- OpenSSL for generating a local enrollment encryption key, or use the PowerShell command in the usage guide

### Run the control plane locally

From the repository root, start PostgreSQL and configure the local-only environment:

```bash
docker compose up -d control-postgres
export PROXIMA_CONTROL_DATABASE_URL="postgres://proxima_control:proxima-control-dev@127.0.0.1:55443/proxima_control"
export PROXIMA_CONTROL_BIND="127.0.0.1:8080"
export PROXIMA_COOKIE_SECURE="false"
export PROXIMA_NODE_ENROLLMENT_ENCRYPTION_KEY="$(openssl rand -hex 32)"
cargo run -p proxima-control-plane
```

These values are for local development only. Keep the database port bound to localhost, never expose the local password or encryption key, and use the [usage guide](docs/usage.md) for the equivalent Windows PowerShell setup. The Command Center listens at `http://127.0.0.1:8080`.

### Run the engine

In a separate terminal:

```bash
cargo run -p proxima-engine
```

Configure the Engine's PostgreSQL upstream, enrollment URL and one-time enrollment token before starting it. Follow the [node enrollment runbook](docs/node-enrollment.md) and [usage guide](docs/usage.md) before connecting a workload.

### Run the frontend

```bash
cd frontend
npm ci
npm run dev
```

Use the local URL printed by Vite. See the [usage guide](docs/usage.md) for the complete local workflow and configuration details.

## Documentation

Start at the [documentation index](docs/README.md).

| Need | Guide |
|---|---|
| Understand the architecture | [Architecture](docs/architecture.md) |
| Install and run locally | [Usage guide](docs/usage.md) |
| Connect a SaaS application | [Customer integration](docs/customer-integration.md) |
| Use the APIs and developer workflows | [Developer guide](docs/developer-guide.md) |
| Enroll and rotate node credentials | [Secure node enrollment](docs/node-enrollment.md) |
| Understand security assumptions | [Threat model](docs/threat-model.md) |
| Verify tenant isolation | [Verification guide](docs/verification.md) |
| Understand failure behavior | [Failure engineering](docs/failure-engineering.md) |
| Review performance methodology | [Performance engineering](docs/performance.md) |
| Configure Microsoft Entra OIDC | [Identity runbook](docs/identity/microsoft-entra-oidc.md) |
| Review pricing and plan limits | [Pricing and entitlements](docs/billing/pricing-proposal.md) |
| Configure Flutterwave billing | [Billing runbook](docs/production/flutterwave-billing.md) |
| Prepare a deployment | [Deployment runbook](docs/production/phase55-deployment-runbook.md) |
| Review operational readiness | [Operational readiness](docs/production/operational-readiness-runbook.md) |
| Understand product direction | [Product vision and roadmap](docs/product/product-vision-and-roadmap.md) |
| Inspect the API contract | [OpenAPI specification](control-plane/openapi.json) |

## Verification

Run the checks appropriate to your environment. Core Rust workspace checks include:

```bash
cargo fmt --all -- --check
cargo check --workspace --all-targets
cargo test --workspace --all-targets
cargo clippy --workspace --all-targets --all-features -- -D warnings
```

PostgreSQL-backed and deployed-environment checks have additional prerequisites. Follow the [verification guide](docs/verification.md) and the relevant launch gates; do not interpret a successful compile or CI run as production acceptance.

## Security

Please do not publish credentials, access tokens, customer data, or exploitable vulnerability details in public issues. Review [SECURITY.md](SECURITY.md) for the responsible reporting process.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for repository workflow, testing expectations, and pull-request standards.
