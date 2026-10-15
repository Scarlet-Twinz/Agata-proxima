-- Retain legacy Paddle fields for historical rows; new billing uses provider='flutterwave'.
ALTER TABLE billing_accounts ADD COLUMN IF NOT EXISTS flutterwave_customer_id text;
ALTER TABLE billing_accounts ADD COLUMN IF NOT EXISTS flutterwave_subscription_id text;
ALTER TABLE billing_accounts ADD COLUMN IF NOT EXISTS flutterwave_plan_id text;
CREATE INDEX IF NOT EXISTS billing_accounts_flutterwave_subscription_idx ON billing_accounts(flutterwave_subscription_id) WHERE flutterwave_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS billing_transactions_flutterwave_reference_idx ON billing_transactions(reference) WHERE provider='flutterwave';
