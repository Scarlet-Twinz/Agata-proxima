# Agata Proxima

**Security infrastructure for multi-tenant applications.**

Agata Proxima is being developed to make PostgreSQL tenant isolation an infrastructure boundary that can be enforced, tested, monitored, and audited. The core data plane is written in Rust; the repository also contains a management control plane, a React frontend, verification tooling, and operational documentation.

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
- Docker with Docker Compose
- Node.js and npm for frontend work
- PostgreSQL for database integration and verification tests

### Run the control plane locally

From the repository root:

```bash
docker compose up -d control-postgres
cargo run -p proxima-control-plane
```

By default, the Command Center listens at `http://127.0.0.1:8080`. The actual address can be changed through `PROXIMA_CONTROL_BIND`.

### Run the engine

In a separate terminal:

```bash
cargo run
```

The local operator dashboard, when enabled, defaults to `http://127.0.0.1:9080`. Configure the required database and security environment variables for your setup before connecting real workloads.

### Run the frontend

```bash
cd frontend
npm install
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
