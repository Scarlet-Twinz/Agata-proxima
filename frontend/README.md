# Agata Proxima Frontend

The Agata Proxima frontend is the public product surface and authenticated control-plane client for the tenant-isolation platform.

## Stack

- React + TypeScript
- Vite
- React Router
- TanStack Query
- Lucide React
- Native CSS design system
- Rust/Axum control-plane API

## Local development

From the repository root:

    cd frontend
    npm install
    npm run dev

The Vite development server proxies /api and authentication utility routes to the local Rust control plane at 127.0.0.1:8080.

## Production build

    cd frontend
    npm run build

## Public information architecture

The public surface uses separate destinations for Product, Solutions, Pricing, Security, Developer Platform, Documentation, Changelog, Company, Trust, Status, Contact, Support, FAQ and Legal.

Developer documentation is separated from the marketing surface so integration guides, API references and tooling documentation can evolve independently.

## Source of truth

The backend contract lives in the Rust control plane and control-plane/openapi.json. Public developer documentation must not advertise SDKs, CLI commands, Terraform providers or webhook contracts that are not actually present in the repository.

## Configuration

See .env.example for browser-safe configuration. Never place server credentials, database credentials or API secrets in the frontend environment.
