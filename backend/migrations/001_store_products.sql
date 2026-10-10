-- Run once in the Supabase SQL Editor for the project used by SUPABASE_URL.
-- Access goes through the Flask backend's current store membership checks.

create table if not exists public.store_products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 160),
  sku text not null check (char_length(sku) between 1 and 60),
  category text not null check (char_length(category) between 1 and 100),
  description text not null default '',
  condition text not null check (condition in ('New', 'Used')),
  price numeric(12,2) not null check (price > 0),
  stock integer not null check (stock between 0 and 1000000),
  status text not null check (status in ('Active', 'Draft', 'Archived')),
  images jsonb not null check (jsonb_typeof(images) = 'array' and jsonb_array_length(images) between 1 and 5),
  payment_options jsonb not null,
  swap jsonb not null,
  layaway jsonb not null,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists store_products_store_sku on public.store_products(store_id, lower(sku));
create index if not exists store_products_store_created on public.store_products(store_id, created_at desc, id);
alter table public.store_products enable row level security;
revoke all on public.store_products from public, anon, authenticated;
grant select, insert, update on public.store_products to service_role;
