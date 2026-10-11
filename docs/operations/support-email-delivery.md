# Support email delivery and team seats

## Support notification recipients

The control plane stores public support requests before attempting email delivery. It then submits a staff notification to `AGATA_SUPPORT_INBOX_EMAIL`.

For a support alias that forwards through an email-routing provider, an optional independent delivery copy can be configured with:

```dotenv
AGATA_SUPPORT_INBOX_EMAIL=support@your-domain.example
AGATA_SUPPORT_NOTIFICATION_FALLBACK_EMAIL=your-verified-inbox@example.com
AGATA_PUBLIC_BASE_URL=https://your-public-site.example
```

Replace the example addresses and URL with your own values. Do not commit real recipient addresses or secrets to the repository. Configure the values in the local `.env.local` for development and in the deployment's environment settings for production. The fallback is optional; when configured, it receives its own notification so a later bounce at the primary forwarding address does not prevent the backup copy from being attempted. If both recipient settings point to the same address, the application avoids sending a duplicate.

The support notification status in the app means that the email provider accepted the submission; it does not guarantee final delivery. Check the email provider's delivery events and the routing provider's activity when a message bounces.

The public support email includes a clickable support link only when `AGATA_PUBLIC_BASE_URL` is a public HTTPS URL. Localhost URLs are deliberately omitted from emailed notifications because they would point to the recipient's own computer.

## Team-seat entitlement

The team-seat quota is enforced by the control plane. The current default/free entitlement has one seat, Starter has five, Growth has fifteen, Scale has fifty, and Enterprise is effectively unlimited. Active members and unexpired pending invitations count toward the limit.

When a workspace has reached its team-seat limit, the invitation API returns a payment-required response with the `plan_limit_reached` code. The dashboard should direct the administrator to Billing → Plans instead of displaying a generic request-validation error.
