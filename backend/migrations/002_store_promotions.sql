-- Run in the same Supabase project as 001_store_products.sql.

create table if not exists public.store_promotion_settings (
  store_id uuid primary key references auth.users(id) on delete restrict,
  public_enabled boolean not null default true,
  campaigns jsonb not null default '[]' check (jsonb_typeof(campaigns) = 'array'),
  codes jsonb not null default '[]' check (jsonb_typeof(codes) = 'array'),
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.store_promotion_settings enable row level security;
revoke all on public.store_promotion_settings from public, anon, authenticated;
grant select, insert, update on public.store_promotion_settings to service_role;
