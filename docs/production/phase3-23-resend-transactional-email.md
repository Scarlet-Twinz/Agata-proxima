# Phase 3.23 — Resend Transactional Email

## Repository implementation

- Purpose-specific sender routing is implemented in the Control Plane for no-reply, support, security, billing, and notifications.
- Signup verification, password recovery, organization invitation, and new-login security email flows use the appropriate sender role.
- The public support/contact form submits to `POST /api/v1/public/support-requests`; the backend validates and persists requests before attempting email delivery.
- Public submissions have field-length/topic/email validation, a hidden honeypot, and an atomic per-email rate limit.
- Requester-confirmation and support-team-notification outcomes are stored and returned to the frontend. The UI does not claim a message was delivered when delivery failed.
- A versioned migration creates public support request and rate-limit tables.
- The production readiness response exposes sender-identity and support-inbox configuration checks.
- The Resend email runbook describes DNS, sender identity, deployment, and acceptance steps.

## Runtime configuration

Set these in the **Control Plane service's server-side environment/secrets**, not in Vercel's public frontend variables:

- `RESEND_API_KEY`
- `RESEND_FROM_NO_REPLY_EMAIL=Agata Proxima <no-reply@agataproxima.com>`
- `RESEND_FROM_SUPPORT_EMAIL=Agata Proxima Support <support@agataproxima.com>`
- `RESEND_FROM_SECURITY_EMAIL=Agata Proxima Security <security@agataproxima.com>`
- `RESEND_FROM_BILLING_EMAIL=Agata Proxima Billing <billing@agataproxima.com>`
- `RESEND_FROM_NOTIFICATIONS_EMAIL=Agata Proxima <notifications@agataproxima.com>`
- `AGATA_SUPPORT_INBOX_EMAIL=<an actually monitored inbox>`
- `AGATA_PUBLIC_BASE_URL=https://agataproxima.com` once the HTTPS production deployment is active.

The connected Resend account reports `agataproxima.com` as verified with sending enabled. DKIM and SPF report verified. DMARC still requires a separate authoritative DNS check. The account currently has no Resend Inbox configured and domain receiving is disabled; this change does not modify MX records.

## External acceptance still required

1. Verify or publish the DMARC record in the domain's authoritative DNS without overwriting any existing policy.
2. Choose the real monitored support destination and set `AGATA_SUPPORT_INBOX_EMAIL`. If the desired destination is `support@agataproxima.com` itself, configure inbound email with a mailbox provider or Resend Receiving first; a verified sending domain does not create an inbox.
3. Configure the sender variables and Resend API key in the deployed Control Plane's secret/configuration settings.
4. Deploy the branch after CI passes, then verify the production readiness endpoint.
5. Test real delivery for verification, password recovery, invitations, new-login alerts, and public support requests. Confirm Resend delivery state and check the actual destination inbox.
6. Test support mail failure and repeated submissions. Confirm the request remains stored and delivery statuses accurately show sent/failed/not configured.
7. Confirm the production links route to the live HTTPS site, not localhost or a preview deployment.

## Completion rule

Repository code is not the same as production acceptance. Phase 3.23 should only be marked fully accepted after the CI checks pass and the live DNS, deployed secret configuration, inbox routing, and real-message tests above are verified.
