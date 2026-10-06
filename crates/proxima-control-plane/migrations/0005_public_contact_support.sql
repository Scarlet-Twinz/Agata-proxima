CREATE TABLE IF NOT EXISTS public_contact_requests (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  company text,
  category text NOT NULL CHECK (
    category IN (
      'general',
      'sales',
      'technical',
      'security',
      'billing',
      'partnership',
      'support'
    )
  ),
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'in_progress', 'resolved', 'closed')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)
