# Agata Proxima Terraform Provider

This is a real Terraform provider source module. The initial resource is `agata_environment`, which manages named stages in the authenticated organization through the Control Plane API.

## Status

- Provider source and Go tests are in this repository.
- The provider is not yet published to the Terraform Registry.
- It manages environment records only; it does not provision networks, databases, node runtimes or secrets.
- Service-account write endpoints require a human dashboard session and are intentionally not exposed as Terraform resources in this API-key-based provider.

## Local build and tests

```bash
go mod tidy
go test ./...
go vet ./...
go build .
```

## Configuration

After a reviewed registry release, configure `base_url` with the Control Plane origin and `api_key` with an organization-scoped key. Supply the key through a secret manager and a sensitive Terraform variable; never commit credentials.

See `../download-kit/terraform/README.md` for the HCL example and operational limits.
