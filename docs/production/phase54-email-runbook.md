# Phase 3.23 — Resend Transactional Email Runbook

Agata Proxima uses Resend for transactional email. The custom sending domain `agataproxima.com` is present in the connected Resend account and currently reports **verified** with sending enabled. Resend reports its DKIM and SPF records as verified. DMARC is not exposed in the domain detail returned by Resend and must be checked separately in DNS.

## Sender identities

Configure these server-side environment variables to use the five purpose-specific sender identities:

| Environment variable | Sender identity | Use |
|---|---|---|
| `RESEND_FROM_NO_REPLY_EMAIL` | `Agata Proxima <no-reply@agataproxima.com>` | Verification and password recovery |
| `RESEND_FROM_SUPPORT_EMAIL` | `Agata Proxima Support <support@agataproxima.com>` | Public support/contact requests |
| `RESEND_FROM_SECURITY_EMAIL` | `Agata Proxima Security <security@agataproxima.com>` | New-login and account-security alerts |
| `RESEND_FROM_BILLING_EMAIL` | `Agata Proxima Billing <billing@agataproxima.com>` | Billing lifecycle notices |
| `RESEND_FROM_NOTIFICATIONS_EMAIL` | `Agata Proxima <notifications@agataproxima.com>` | Organization invitations and general notifications |

`RESEND_FROM_EMAIL` remains a compatibility fallback for local development. Production readiness requires the purpose-specific identities.

## Required configuration

1. Keep `RESEND_API_KEY` in the Control Plane's server-side secret store only.
2. Set the five sender environment variables above on the deployed Control Plane service.
3. Set `AGATA_PUBLIC_BASE_URL=https://agataproxima.com` only when the public HTTPS deployment is live.
4. Set `AGATA_SUPPORT_INBOX_EMAIL` to an inbox that the support operator can actually read. Do not set it to `support@agataproxima.com` until inbound mail is configured for that address.
5. Verify the DNS records shown in Resend for the exact domain. The current account reports DKIM and SPF as verified.
6. Publish a DMARC TXT record at `_dmarc.agataproxima.com` after checking the domain's existing DNS policy. Do not overwrite an existing DMARC policy blindly; begin with an appropriate monitoring policy and review aggregate reports before enforcement.
7. Keep tracking settings intentional. Open/click tracking are currently disabled in Resend, which is appropriate for security-sensitive transactional messages.

## Implemented flows

- Email verification code (15-minute expiry and limited attempts).
- Password recovery link (30-minute expiry).
- Organization invitation (7-day expiry).
- New-login security alert (best-effort; does not block sign-in).
- Public support/contact submission: persisted server-side, rate-limited by normalized-email hash, requester confirmation attempted, and a staff notification attempted.
- Delivery statuses for public support confirmation and staff notification are persisted so the UI does not claim both emails were sent when they were not.

## Test and acceptance sequence

1. Confirm the domain is verified in Resend and SPF/DKIM are green.
2. Verify DMARC separately in the authoritative DNS zone.
3. Set the API key, all five sender identities, public HTTPS base URL, and the support inbox in the production secret store.
4. Deploy the Control Plane and confirm `GET /api/v1/production/readiness` reports the email checks as true. Overall readiness also includes billing and SSO configuration.
5. Submit a public support request using a real test mailbox. Confirm the response contains a request ID, the row is stored, the requester confirmation is delivered, and the support inbox receives the internal notification.
6. Test the form's invalid-input and repeated-submission limits. Verify that a Resend failure is reflected in stored status and user-facing copy.
7. Test signup verification, password recovery, organization invitation, and login security alert against real mailboxes.
8. Inspect Resend email logs for delivery/bounce status. A successful API response means Resend accepted the message; it does not prove final inbox placement.

## Security rules

- Never put Resend API keys in Git, browser code, public Vercel variables, documentation, or chat.
- Do not log full public support message bodies or email credentials.
- Public support requests are stored before notification attempts. Mail failure must not delete the support request or be represented as successful delivery.
- The support inbox destination must be an actual monitored mailbox. Resend sending-domain verification alone does not create an inbox or enable inbound receiving.
