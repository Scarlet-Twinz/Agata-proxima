-- Run in the Supabase SQL editor. Provision membership rows only from a trusted
-- administrative/server-side workflow; never let a browser user assign their own role.
create table if not exists public.agata_organization_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  agata_organization_id uuid not null,
  role text not null check (role in ('owner', 'admin', 'operator', 'viewer')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  primary key (user_id, agata_organization_id)
);

alter table public.agata_organization_memberships enable row level security;
revoke insert, update, delete on public.agata_organization_memberships from anon, authenticated;
grant select on public.agata_organization_memberships to authenticated;

drop policy if exists "users read own Agata membership" on public.agata_organization_memberships;
create policy "users read own Agata membership"
  on public.agata_organization_memberships
  for select to authenticated
  using (auth.uid() = user_id);

-- Insert or revoke membership rows from a trusted admin/server workflow.
-- Set AGATA_ORGANIZATION_ID and AGATA_API_KEY together in Edge Function secrets;
-- the key must be scoped to that exact Agata organization.
