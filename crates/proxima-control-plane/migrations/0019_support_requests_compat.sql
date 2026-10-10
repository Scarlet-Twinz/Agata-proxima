-- Compatibility repair for installations where support_requests predates the
-- current control-plane schema. All additions are idempotent and preserve existing rows.
ALTER TABLE support_requests
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS organization_id uuid,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS subject text NOT NULL DEFAULT 'Legacy support request',
  ADD COLUMN IF NOT EXISTS message text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE support_requests
   SET id = gen_random_uuid()
 WHERE id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_support_requests_id_compat
  ON support_requests(id);

CREATE INDEX IF NOT EXISTS idx_support_org_created
  ON support_requests(organization_id, created_at DESC);
