CREATE INDEX IF NOT EXISTS idx_public_contact_created
ON public_contact_requests(created_at DESC)
