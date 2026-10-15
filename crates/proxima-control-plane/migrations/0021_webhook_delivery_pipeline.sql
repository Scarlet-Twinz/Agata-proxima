-- Durable outbound webhook delivery pipeline.
ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS signing_secret_ciphertext bytea;
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0);
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 8 CHECK (max_attempts BETWEEN 1 AND 20);
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS last_error text;
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS response_excerpt text;

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_due
  ON webhook_deliveries(status, next_attempt_at, created_at)
  WHERE status IN ('queued', 'failed');

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event
  ON webhook_deliveries(webhook_id, event_id);

UPDATE webhook_deliveries
   SET status='dead_letter', last_error='Legacy delivery had no persisted payload; create a new event to deliver it.'
 WHERE status='queued' AND payload='{}'::jsonb;
