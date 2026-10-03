create extension if not exists pgcrypto;

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists organization_members (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','operator','viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  environment text not null check (environment in ('development','staging','production')),
  created_at timestamptz not null default now()
);

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  region text not null,
  status text not null default 'protected',
  created_at timestamptz not null default now()
);

create table if not exists policies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  mode text not null check (mode in ('enforce','audit','disabled')),
  version bigint not null default 1,
  status text not null default 'active',
  bundle_digest text,
  created_at timestamptz not null default now()
);

create table if not exists fleet_nodes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  region text not null,
  version text not null,
  status text not null default 'enrolling',
  last_seen_at timestamptz,
  enrolled_at timestamptz not null default now()
);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text not null,
  outcome text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table projects enable row level security;
alter table tenants enable row level security;
alter table policies enable row level security;
alter table fleet_nodes enable row level security;
alter table audit_events enable row level security;

create policy organizations_member_select on organizations for select to authenticated
using (exists (select 1 from organization_members m where m.organization_id=organizations.id and m.user_id=auth.uid()));

create policy members_self_select on organization_members for select to authenticated
using (user_id=auth.uid());

create policy projects_member_select on projects for select to authenticated
using (exists (select 1 from organization_members m where m.organization_id=projects.organization_id and m.user_id=auth.uid()));

create policy tenants_member_select on tenants for select to authenticated
using (exists (select 1 from projects p join organization_members m on m.organization_id=p.organization_id where p.id=tenants.project_id and m.user_id=auth.uid()));

create policy policies_member_select on policies for select to authenticated
using (exists (select 1 from projects p join organization_members m on m.organization_id=p.organization_id where p.id=policies.project_id and m.user_id=auth.uid()));

create policy fleet_member_select on fleet_nodes for select to authenticated
using (exists (select 1 from projects p join organization_members m on m.organization_id=p.organization_id where p.id=fleet_nodes.project_id and m.user_id=auth.uid()));

create policy audit_member_select on audit_events for select to authenticated
using (exists (select 1 from organization_members m where m.organization_id=audit_events.organization_id and m.user_id=auth.uid()));
