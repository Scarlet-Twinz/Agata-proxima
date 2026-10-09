-- Lemon Squeezy billing provider transition.
-- This is an additive migration: historical Paystack/Stripe-era rows are retained for audit
-- and reconciliation. Existing customers are not silently marked as Lemon Squeezy subscribers.
ALTER TABLE billing_accounts
  ADD COLUMN IF NOT EXISTS lemonsqueezy_customer_id text,
  ADD COLUMN IF NOT EXISTS lemonsqueezy_subscription_id text,
  ADD COLUMN IF NOT EXISTS lemonsqueezy_variant_id text,
  ADD COLUMN IF NOT EXISTS lemonsqueezy_store_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_accounts_lemonsqueezy_customer
  ON billing_accounts(lemonsqueezy_customer_id)
  WHERE lemonsqueezy_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_accounts_lemonsqueezy_subscription
  ON billing_accounts(lemonsqueezy_subscription_id)
  WHERE lemonsqueezy_subscription_id IS NOT NULL;

ALTER TABLE billing_transactions
  ADD COLUMN IF NOT EXISTS lemonsqueezy_checkout_id text,
  ADD COLUMN IF NOT EXISTS lemonsqueezy_order_id text,
  ADD COLUMN IF NOT EXISTS lemonsqueezy_subscription_id text,
  ADD COLUMN IF NOT EXISTS lemonsqueezy_variant_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_transactions_lemonsqueezy_order
  ON billing_transactions(lemonsqueezy_order_id)
  WHERE lemonsqueezy_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_billing_transactions_lemonsqueezy_subscription
  ON billing_transactions(lemonsqueezy_subscription_id)
  WHERE lemonsqueezy_subscription_id IS NOT NULL;

-- Lemon Squeezy webhook event IDs remain provider-scoped to support safe retries and
-- preserve idempotency alongside any historical provider events.
CREATE TABLE IF NOT EXISTS lemonsqueezy_webhook_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  event_name text NOT NULL,
  resource_id text,
  payload_sha256 text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_status text NOT NULL DEFAULT 'received'
    CHECK (processing_status IN ('received', 'processing', 'processed', 'failed')),
  failure_reason text
);

CREATE INDEX IF NOT EXISTS idx_lemonsqueezy_webhook_receipts_status_received
  ON lemonsqueezy_webhook_receipts(processing_status, received_at DESC);
