CREATE TABLE IF NOT EXISTS public_support_requests (
  id uuid PRIMARY KEY,
  requester_name text NOT NULL,
  requester_email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  topic text NOT NULL DEFAULT 'general',
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'in_progress', 'resolved', 'closed')),
  requester_email_status text NOT NULL DEFAULT 'pending'
    CHECK (requester_email_status IN ('pending', 'sent', 'failed')),
  support_email_status text NOT NULL DEFAULT 'pending'
    CHECK (support_email_status IN ('pending', 'sent', 'failed', 'not_configured')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_support_requests_created
  ON public_support_requests (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_public_support_requests_email_created
  ON public_support_requests (lower(requester_email), created_at DESC);

CREATE TABLE IF NOT EXISTS public_support_rate_limits (
  email_hash bytea PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
