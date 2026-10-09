-- Lemon Squeezy billing provider transition.
-- Historical Paystack/Stripe records are intentionally retained for auditability.
ALTER TABLE billing_accounts
  ADD COLUMN IF NOT EXISTS lemonsqueezy_customer_id text,
  ADD COLUMN IF NOT EXISTS lemonsqueezy_subscription_id text,
  ADD COLUMN IF NOT EXISTS lemonsqueezy_variant_id text,
  ADD COLUMN IF NOT EXISTS lemonsqueezy_customer_portal_url text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_accounts_lemonsqueezy_customer
  ON billing_accounts(lemonsqueezy_customer_id)
  WHERE lemonsqueezy_customer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_accounts_lemonsqueezy_subscription
  ON billing_accounts(lemonsqueezy_subscription_id)
  WHERE lemonsqueezy_subscription_id IS NOT NULL;

ALTER TABLE billing_transactions
  ADD COLUMN IF NOT EXISTS provider_checkout_id text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_transactions_provider_checkout
  ON billing_transactions(provider, provider_checkout_id)
  WHERE provider_checkout_id IS NOT NULL;

-- Future records use Lemon Squeezy; existing provider values are not rewritten.
ALTER TABLE billing_accounts ALTER COLUMN provider SET DEFAULT 'lemonsqueezy';
ALTER TABLE billing_transactions ALTER COLUMN provider SET DEFAULT 'lemonsqueezy';
ALTER TABLE billing_events ALTER COLUMN provider SET DEFAULT 'lemonsqueezy';
