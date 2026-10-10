-- Paddle Billing provider migration.
-- Preserve historical provider records and old provider columns for auditability.
ALTER TABLE billing_accounts
  ADD COLUMN IF NOT EXISTS paddle_customer_id text,
  ADD COLUMN IF NOT EXISTS paddle_subscription_id text,
  ADD COLUMN IF NOT EXISTS paddle_price_id text,
  ADD COLUMN IF NOT EXISTS paddle_customer_portal_url text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_accounts_paddle_customer
  ON billing_accounts(paddle_customer_id)
  WHERE paddle_customer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_accounts_paddle_subscription
  ON billing_accounts(paddle_subscription_id)
  WHERE paddle_subscription_id IS NOT NULL;

-- The provider-specific checkout identifier stores Paddle transaction IDs for new records.
ALTER TABLE billing_transactions
  ADD COLUMN IF NOT EXISTS provider_checkout_id text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_transactions_provider_checkout
  ON billing_transactions(provider, provider_checkout_id)
  WHERE provider_checkout_id IS NOT NULL;

-- New billing records use Paddle. Existing provider values are not rewritten.
ALTER TABLE billing_accounts ALTER COLUMN provider SET DEFAULT 'paddle';
ALTER TABLE billing_transactions ALTER COLUMN provider SET DEFAULT 'paddle';
ALTER TABLE billing_events ALTER COLUMN provider SET DEFAULT 'paddle';
