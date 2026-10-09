-- Forward-only Lemon Squeezy billing migration. Historical provider data is retained.
ALTER TABLE billing_accounts
  ADD COLUMN IF NOT EXISTS lemonsqueezy_customer_id text,
  ADD COLUMN IF NOT EXISTS lemonsqueezy_subscription_id text,
  ADD COLUMN IF NOT EXISTS lemonsqueezy_variant_id text,
  ADD COLUMN IF NOT EXISTS lemonsqueezy_customer_portal_url text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_accounts_lemonsqueezy_customer
  ON billing_accounts(lemonsqueezy_customer_id) WHERE lemonsqueezy_customer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_accounts_lemonsqueezy_subscription
  ON billing_accounts(lemonsqueezy_subscription_id) WHERE lemonsqueezy_subscription_id IS NOT NULL;

-- Preserve legacy provider identifiers and records for audit/history. New billing events
-- and transactions are written under provider='lemonsqueezy'.
