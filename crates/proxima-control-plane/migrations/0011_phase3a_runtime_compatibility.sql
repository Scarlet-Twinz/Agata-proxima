-- Phase 3A runtime compatibility repair for databases created before the
-- customer-integration environment contract was introduced.
--
-- Existing deployments may have a legacy environments.slug column with a
-- NOT NULL constraint and a legacy support priority constraint. Normalize the
-- data/constraints without replacing customer data.

ALTER TABLE public.environments
  ADD COLUMN IF NOT EXISTS slug text;

UPDATE public.environments
SET slug = key
WHERE slug IS NULL
  AND key IS NOT NULL;

ALTER TABLE public.support_requests
  DROP CONSTRAINT IF EXISTS support_requests_priority_check;

UPDATE public.support_requests
SET priority = 'normal'
WHERE priority IS NULL
   OR priority NOT IN ('low','normal','high','urgent');

ALTER TABLE public.support_requests
  ADD CONSTRAINT support_requests_priority_check
  CHECK (priority IN ('low','normal','high','urgent'));

-- Future environment writes always supply slug explicitly. Keep existing
-- databases compatible regardless of whether their legacy slug column is
-- nullable or not.
