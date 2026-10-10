-- Run after migrations 001 and 002, in the same Supabase SQL Editor.

create table if not exists public.store_categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  description text not null default '',
  status text not null default 'Active' check (status in ('Active', 'Archived')),
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists store_categories_name on public.store_categories(store_id, lower(name));
insert into public.store_categories(store_id, name)
select distinct on (store_id, lower(btrim(category))) store_id, btrim(category)
from public.store_products order by store_id, lower(btrim(category)), category
on conflict do nothing;
-- Normalize pre-existing casing without dropping or recreating products.
update public.store_products p set category=c.name
from public.store_categories c where c.store_id=p.store_id and lower(btrim(p.category))=lower(c.name) and p.category<>c.name;

create or replace function public.sync_product_category() returns trigger
language plpgsql set search_path = public as $$
declare category_row public.store_categories;
begin
  new.category := btrim(new.category);
  insert into public.store_categories(store_id,name) values(new.store_id,new.category) on conflict do nothing;
  select * into category_row from public.store_categories where store_id=new.store_id and lower(name)=lower(new.category) for share;
  if category_row.status='Archived' and pg_trigger_depth()=1 and (TG_OP='INSERT' or new.category is distinct from old.category) then
    raise exception 'Choose an active category' using errcode='23514';
  end if;
  new.category := category_row.name;
  return new;
end $$;
drop trigger if exists sync_product_category on public.store_products;
create trigger sync_product_category before insert or update of category on public.store_products for each row execute function public.sync_product_category();

create or replace function public.rename_store_category() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.name is distinct from old.name then
    update public.store_products set category=new.name, revision=revision+1, updated_at=now()
      where store_id=new.store_id and category=old.name;
    update public.store_promotion_settings s set campaigns=(
      select coalesce(jsonb_agg(case when item->>'scope'='Category' then
        jsonb_set(item,'{categories}',(select coalesce(jsonb_agg(case when value=old.name then new.name else value end),'[]'::jsonb)
          from jsonb_array_elements_text(item->'categories'))) else item end),'[]'::jsonb)
      from jsonb_array_elements(s.campaigns) item), revision=revision+1, updated_at=now()
      where s.store_id=new.store_id;
  end if;
  return new;
end $$;
drop trigger if exists rename_store_category on public.store_categories;
create trigger rename_store_category after update of name on public.store_categories for each row execute function public.rename_store_category();

create table if not exists public.store_trade_inventory (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references auth.users(id) on delete restrict,
  reference text not null,
  device text not null,
  serial_number text not null default '',
  source_reference text not null default '',
  condition text not null check (condition in ('Like New','Excellent','Good','Fair','Needs Repair')),
  acquisition_value numeric(12,2) not null check (acquisition_value>=0),
  received_on date not null,
  notes text not null default '',
  status text not null default 'HELD_FOR_SWAP' check (status in ('HELD_FOR_SWAP','AVAILABLE','RESOLD')),
  resale_value numeric(12,2),
  sold_at timestamptz,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status='RESOLD' and resale_value>0 and sold_at is not null) or (status<>'RESOLD' and resale_value is null and sold_at is null))
);
create unique index if not exists trade_inventory_reference on public.store_trade_inventory(store_id,lower(reference));
create unique index if not exists trade_inventory_serial on public.store_trade_inventory(store_id,lower(serial_number)) where serial_number<>'';
create index if not exists trade_inventory_store on public.store_trade_inventory(store_id,created_at desc);
alter table public.store_categories enable row level security;
alter table public.store_trade_inventory enable row level security;
revoke all on public.store_categories, public.store_trade_inventory from public, anon, authenticated;
grant select, insert, update on public.store_categories, public.store_trade_inventory to service_role;
revoke execute on function public.sync_product_category(), public.rename_store_category() from public, anon, authenticated;
