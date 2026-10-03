# Microsoft Entra ID — Agata Proxima SSO Runbook

## Decision

Agata Proxima's first enterprise SSO integration is **Microsoft Entra ID over OpenID Connect (OIDC)**.

Microsoft's current guidance recommends OIDC for new, modern SaaS development and a multitenant application registration for SaaS ISVs. citeturn2search2turn2search3

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

Microsoft Entra requires the callback to be registered exactly; redirect URIs are a security boundary and must match the request. citeturn3search0turn3search3

Use the authorization-code flow. Do not enable the legacy implicit flow. Microsoft's current guidance recommends authorization code flow for new web applications. citeturn3search5turn3search10

## OIDC configuration

The existing control-plane environment contract reserves:

```env
PROXIMA_OIDC_ISSUER=
PROXIMA_OIDC_CLIENT_ID=
PROXIMA_OIDC_CLIENT_SECRET=
```

For the multitenant Microsoft Entra deployment, the authority is based on the Microsoft identity platform's `organizations` authority. The application must validate the tenant-specific issuer returned during sign-in rather than assuming every customer has the same issuer.

Microsoft publishes discovery metadata, authorization/token endpoints, and JWKS metadata through the OIDC configuration document. citeturn2search0turn2search10

Required scopes for the first implementation:

```
openid profile email
```

## Organization mapping

SSO must not blindly create a Proxima organization from an arbitrary email address.

The production implementation should bind the authenticated Entra tenant ID to a Proxima organization/identity connection. The sequence is:

1. Organization owner enables Entra SSO.
2. Agata stores the expected Entra tenant identifier for that organization.
3. The user completes the Entra authorization-code flow.
4. Agata validates the token issuer, audience, signature, expiry and tenant identity.
5. Agata maps the external subject to the existing Proxima user/membership.
6. If JIT provisioning is enabled for that organization, the user is provisioned with the organization's configured default role.
7. A normal Agata session is created.
8. The event is written to the append-only audit log.

This prevents an authenticated Microsoft account from selecting an arbitrary Agata organization.

## Production credential handling

Do not put the Entra client secret in Git, the browser, Docker image layers, or this chat.

Use the deployment platform's secret store. For production, Microsoft also documents certificates/federated credentials as the stronger credential option for confidential clients. citeturn3search4

## What is deliberately waiting

The runtime SSO callback is **not being declared production-ready before the public deployment exists**.

The remaining activation gates are:

- public HTTPS Control Plane URL;
- production Entra app registration;
- exact production redirect URI;
- tenant-to-organization identity mapping;
- server-side token validation;
- SSO audit events;
- end-to-end login test against a real Entra tenant.

This is intentional. The repository can carry the contract now, but a real identity provider callback cannot be honestly accepted until it has a real registered redirect endpoint.
