ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verification_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{"theme":"light","notifications":{"security":true,"product":true,"billing":true}}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_users_email_verification
  ON users(email_verification_token_hash, email_verification_expires_at);
