# Microsoft Entra ID — Agata Proxima SSO Runbook

## Decision

Agata Proxima's first enterprise SSO integration is **Microsoft Entra ID over OpenID Connect (OIDC)**.

Microsoft's current guidance recommends OIDC for new, modern SaaS development and a multitenant application registration for SaaS ISVs.

SAML is a later compatibility layer for customers whose enterprise identity systems require it. It is not the first implementation.

## Target flow

```
Customer browser
    |
    v
Agata Proxima Control Plane
    |
    | OAuth 2.0 Authorization Code
    v
Microsoft Entra ID
    |
    | authorization code
    v
Agata Proxima callback
    |
    | validated identity + organization mapping
    v
Agata session
```

The Control Plane authenticates the human. The Proxima Engine remains the data-plane enforcement authority.

## App registration

Create one **multitenant Web application** for the Agata Proxima SaaS control plane.

Supported account type:

- Accounts in any organizational directory (multitenant)

Production callback:

```
https://<AGATA_PUBLIC_BASE_URL_HOST>/api/v1/auth/oidc/callback
```

Local development callback can use localhost.

Microsoft Entra requires the callback to be registered exactly; redirect URIs are a security boundary and must match the request.

Use the authorization-code flow. Do not enable the legacy implicit flow.

## OIDC configuration

The runtime configuration uses the app registration's client ID and secret plus the public Control Plane origin:

```env
PROXIMA_OIDC_CLIENT_ID=
PROXIMA_OIDC_CLIENT_SECRET=
AGATA_PUBLIC_BASE_URL=https://<public-control-plane-host>
```

The expected issuer is derived from the organization's configured Entra tenant ID and validated against the signed ID token; there is no separate `PROXIMA_OIDC_ISSUER` runtime setting in the current implementation.

`AGATA_PUBLIC_BASE_URL` must be the browser-facing origin for the app. In production, the frontend and Control Plane API/callback must share that origin (typically by reverse-proxying `/api/v1/*` to the Rust service), because the callback sets a host-only session cookie and redirects to `/app`. Do not configure the frontend on one origin and the callback on an unrelated API origin without an explicit same-origin proxy/cookie design.

For the multitenant Microsoft Entra deployment, the authority is based on the Microsoft identity platform's `organizations` authority. The application must validate the tenant-specific issuer returned during sign-in rather than assuming every customer has the same issuer.

Microsoft publishes discovery metadata, authorization/token endpoints, and JWKS metadata through the OIDC configuration document.

Required scopes for the first implementation:

```
openid profile email
```

## Organization mapping

SSO must not blindly create a Proxima organization from an arbitrary email address.

The production implementation should bind the authenticated Entra tenant ID to a Proxima organization/identity connection. The sequence is:

1. Organization owner enables Entra SSO.
2. Agata stores the expected Entra tenant identifier for that organization.
3. On the login page, the user enters the organization's slug; the SSO start endpoint resolves it to the organization with an enabled Entra connection. The UUID-based `organization_id` query remains available for controlled administrative/testing workflows.
4. The user completes the Entra authorization-code flow.
5. Agata validates the token issuer, audience, signature, expiry and tenant identity.
6. Agata maps the external subject to the existing Proxima user/membership.
7. If JIT provisioning is enabled for that organization, the user is provisioned with the organization's configured default role.
8. A normal Agata session is created.
9. The event is written to the append-only audit log.

This prevents an authenticated Microsoft account from selecting an arbitrary Agata organization.

## Production credential handling

Do not put the Entra client secret in Git, the browser, Docker image layers, or chat.

Use the deployment platform's secret store. For production, Microsoft also documents certificates/federated credentials as the stronger credential option for confidential clients.

## What is deliberately waiting

The login UI can initiate the OIDC flow, but the runtime SSO callback is **not being declared production-ready before the public deployment and real Entra acceptance exist**.

The remaining activation gates are:

- public HTTPS Control Plane URL;
- production Entra app registration;
- exact production redirect URI;
- tenant-to-organization identity mapping;
- server-side token validation;
- SSO audit events;
- end-to-end login test against a real Entra tenant.

This is intentional. The repository can carry the contract now, but a real identity provider callback cannot be honestly accepted until it has a real registered redirect endpoint.

## Primary references

- Microsoft Entra OIDC: https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc
- Microsoft Entra multitenant ISV SSO: https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/plan-sso-integration-isv
- Microsoft Entra redirect URI guidance: https://learn.microsoft.com/en-us/entra/identity-platform/reply-url
