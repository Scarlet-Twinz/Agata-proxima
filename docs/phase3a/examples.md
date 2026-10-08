# Phase 3A Integration Examples

## Environment variables

Use deployment configuration, not source-code constants:

```text
AGATA_PUBLIC_BASE_URL=https://<your-agata-domain>
AGATA_SECRET_ENCRYPTION_KEY=<deployment-secret>
PROXIMA_CONTEXT_SIGNING_KEY=<deployment-secret>
RESEND_API_KEY=<provider-secret>
RESEND_FROM_EMAIL=<verified-sender>
```

## Customer application flow

```text
Customer application
        |
        | authenticated Agata integration credential
        v
Agata Control Plane
        |
        | organization + environment + tenant context
        v
Proxima enforcement boundary
        |
        v
Customer PostgreSQL
```

The customer's application remains responsible for its own authentication, business logic and application behavior. Agata supplies the integration, tenant isolation, policy, verification and enforcement boundary.
