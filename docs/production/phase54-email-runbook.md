# Phase 54 — Production Email Runbook

Agata Proxima already has transactional email contracts for verification, password reset and organization invitations.

Production activation is intentionally gated on an Agata-owned sending domain.

## Activation sequence
1. Purchase the dedicated Agata Proxima email domain.
2. Add it to Resend.
3. Publish the exact SPF/DKIM records Resend provides.
4. Verify the domain.
5. Set RESEND_API_KEY.
6. Set RESEND_FROM_EMAIL to an address on the verified Agata domain.
7. Keep the API key server-side only.
8. Test verification, password reset and organization invitation delivery.
9. Confirm delivery and failure handling before customer onboarding.

The repository deliberately leaves RESEND_FROM_EMAIL blank until this step.

## Security rule
Never put the Resend API key in Git, browser JavaScript, Docker image source, documentation examples, or chat.

## Acceptance
Email production is accepted only when a real verified domain sends all three transactional flows successfully and failures are observable in logs.
