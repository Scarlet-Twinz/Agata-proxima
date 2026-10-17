# Terraform integration

A real provider implementation now lives in `terraform-provider-agata/`. Its first supported managed resource is `agata_environment`, backed by the Control Plane's environment CRUD API. It does not create a database, network, deployment, secret store or organization.

## Current release status

- Provider source and automated Go tests are in this repository.
- The provider is **not yet published to the Terraform Registry**. Do not reference a registry version until a reviewed release has been built and published.
- Provider scope is deliberately limited to supported API operations. Service-account creation/update/delete currently requires an authenticated human session, so the API-key-based Terraform provider does not pretend to manage service accounts.
- Terraform cannot delete an environment that is still referenced by registered nodes; disable it instead.

## Provider configuration after registry release

Keep credentials in environment variables or a secret manager, never committed in Terraform files or state:

```hcl
terraform {
  required_providers {
    agata = {
      source  = "scarlet-twinz/agata"
      version = "~> 0.1"
    }
  }
}

provider "agata" {
  base_url = var.agata_base_url
  api_key  = var.agata_api_key
}

resource "agata_environment" "staging" {
  name        = "Staging"
  slug        = "staging"
  description = "Pre-production acceptance testing"
  status      = "active"
}
```

Use variables marked sensitive and supply their values from your CI secret store. The API key must have the permissions required to manage environments.

## Build and test the provider from source

```bash
cd terraform-provider-agata
go mod tidy
go test ./...
go vet ./...
go build .
```

Registry publication is a separate release operation and is not triggered by pull requests.

## Before production adoption

1. Run the provider tests and acceptance tests against a disposable organization.
2. Verify that the API origin points to the intended control plane.
3. Verify the plan and environment quotas for that organization.
4. Inspect the Terraform plan before applying destructive changes.
5. Keep API keys out of source control and rotate/revoke them when no longer needed.
