# Historical record — previous billing provider

**Superseded. Do not use this document to configure active billing.** The current implementation uses Paddle Billing.

The old Lemon Squeezy integration was replaced in the repository. This file remains only as a historical pointer so earlier phase references do not silently imply that the old provider is still active.

For current configuration, price IDs, Sandbox checkout, signed webhook validation, customer portal and production activation gates, use [Paddle Billing Integration](paddle-billing.md).

The historical database migration `0017_lemonsqueezy_billing.sql` remains in the migration sequence because deployed databases may have applied it. Do not delete or rewrite historical migrations to make the provider switch appear cleaner. Migration `0020_paddle_billing.sql` adds Paddle's current storage fields and changes the default for new billing records without rewriting historical provider values.

No Paddle business approval, live domain verification, payment, deployment or production activation is implied by this document.
