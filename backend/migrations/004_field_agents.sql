create table if not exists public.store_field_agents (
  id uuid primary key references auth.users(id) on delete restrict,
  store_id uuid not null references auth.users(id) on delete restrict,
  email text not null,
  profile jsonb not null,
  status text not null default 'Active' check (status in ('Active','Suspended')),
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists field_agents_store on public.store_field_agents(store_id);
alter table public.store_field_agents enable row level security;
revoke all on public.store_field_agents from public, anon, authenticated;
grant select, insert, update on public.store_field_agents to service_role;
