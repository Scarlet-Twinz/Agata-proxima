ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_verification_token_hash bytea,
  ADD COLUMN IF NOT EXISTS email_verification_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS password_reset_token_hash bytea,
  ADD COLUMN IF NOT EXISTS password_reset_expires_at timestamptz;

CREATE TABLE IF NOT EXISTS billing_accounts (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  stripe_price_id text,
  plan_key text NOT NULL DEFAULT 'unconfigured',
  status text NOT NULL DEFAULT 'inactive',
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'received',
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE TABLE IF NOT EXISTS organization_invites (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invited_by uuid REFERENCES users(id) ON DELETE SET NULL,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','operator','viewer')),
  token_hash bytea NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);

CREATE INDEX IF NOT EXISTS idx_billing_status ON billing_accounts(status);
CREATE INDEX IF NOT EXISTS idx_invites_email ON organization_invites(email);
