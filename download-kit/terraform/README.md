# Terraform integration

This kit includes an integration design and acceptance checklist, not a published Terraform provider. Do not add a made-up `required_providers` entry for Agata.

For now, automate supported Agata operations using the versioned HTTP API from a Terraform provisioner only when the operation is idempotent and appropriate for your deployment model, or use a separate reviewed provider implementation. Keep credentials in the CI/runner secret store; never put them in committed `.tf` files or Terraform state. Before adopting a provider, require schema/versioning, import and drift behavior, idempotent create/update/delete operations, tenant-scope checks, and acceptance tests against a disposable organization.
