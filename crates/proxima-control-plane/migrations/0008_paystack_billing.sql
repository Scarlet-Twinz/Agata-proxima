-- Paystack billing migration.
-- Keep historical migrations immutable; this migration converts existing billing state safely.

ALTER TABLE billing_accounts
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'paystack',
  ADD COLUMN IF NOT EXISTS paystack_customer_code text,
  ADD COLUMN IF NOT EXISTS paystack_subscription_code text,
  ADD COLUMN IF NOT EXISTS paystack_plan_code text;

ALTER TABLE billing_accounts
  DROP COLUMN IF EXISTS stripe_customer_id,
  DROP COLUMN IF EXISTS stripe_subscription_id,
  DROP COLUMN IF EXISTS stripe_price_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_accounts_paystack_customer
  ON billing_accounts(paystack_customer_code)
  WHERE paystack_customer_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_accounts_paystack_subscription
  ON billing_accounts(paystack_subscription_code)
  WHERE paystack_subscription_code IS NOT NULL;

ALTER TABLE billing_events
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'paystack',
  ADD COLUMN IF NOT EXISTS provider_event_id text;

UPDATE billing_events
SET provider_event_id = CONCAT('legacy-', id::text)
WHERE provider_event_id IS NULL;

ALTER TABLE billing_events
  DROP CONSTRAINT IF EXISTS billing_events_stripe_event_id_key;

ALTER TABLE billing_events
  DROP COLUMN IF EXISTS stripe_event_id;

ALTER TABLE billing_events
  ALTER COLUMN provider_event_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_events_provider_event
  ON billing_events(provider, provider_event_id);

CREATE TABLE IF NOT EXISTS billing_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'paystack',
  reference text NOT NULL,
  transaction_id bigint,
  plan_key text NOT NULL,
  plan_code text,
  amount bigint,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'initialized',
  refund_status text,
  metadata jsonb,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, reference)
);

CREATE INDEX IF NOT EXISTS idx_billing_transactions_org
  ON billing_transactions(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_transactions_status
  ON billing_transactions(status);

CREATE INDEX IF NOT EXISTS idx_billing_transactions_reference
  ON billing_transactions(reference);
