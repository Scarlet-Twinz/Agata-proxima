-- Forward-only Lemon Squeezy billing migration.
-- Keep old Paystack/Stripe migrations immutable and preserve historical provider records.

ALTER TABLE billing_accounts
  ADD COLUMN IF NOT EXISTS lemonsqueezy_customer_id text,
  ADD COLUMN IF NOT EXISTS lemonsqueezy_subscription_id text,
  ADD COLUMN IF NOT EXISTS lemonsqueezy_variant_id text;

ALTER TABLE billing_accounts
  ALTER COLUMN provider SET DEFAULT 'lemonsqueezy';

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_accounts_lemonsqueezy_customer
  ON billing_accounts(lemonsqueezy_customer_id)
  WHERE lemonsqueezy_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_accounts_lemonsqueezy_subscription
  ON billing_accounts(lemonsqueezy_subscription_id)
  WHERE lemonsqueezy_subscription_id IS NOT NULL;

ALTER TABLE billing_transactions
  ALTER COLUMN provider SET DEFAULT 'lemonsqueezy';

ALTER TABLE billing_events
  ALTER COLUMN provider SET DEFAULT 'lemonsqueezy';

CREATE INDEX IF NOT EXISTS idx_billing_transactions_lemonsqueezy_subscription
  ON billing_transactions(provider, reference, organization_id);
