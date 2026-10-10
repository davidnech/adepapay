-- AdepaPay database setup: migrations 001 through 017.
-- Run this entire file in the Supabase SQL Editor for the project matching SUPABASE_URL.
-- Creates missing schema and updates application functions; does not delete business records.
-- Existing product category labels may be normalized by migration 003.
-- Each migration has a transaction. Stop and resolve any SQL error before continuing.
begin;

-- SOURCE: 001_store_products.sql
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

-- SOURCE: 002_store_promotions.sql
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

-- SOURCE: 003_categories_trade_inventory.sql
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

-- SOURCE: 004_field_agents.sql
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

-- SOURCE: 005_customer_applications.sql
-- Apply after migrations 001-004. Money is GHS with two decimal places.

create table if not exists public.customer_applications (
 id uuid primary key default gen_random_uuid(),
 reference text not null unique,
 request_id uuid not null,
 customer_id uuid not null references auth.users(id),
 store_id uuid not null references auth.users(id),
 product_id uuid not null references public.store_products(id),
 kind text not null check(kind in ('hire_purchase','layaway','swap')),
 status text not null default 'Pending' check(status in ('Pending','Offered','Approved','Completed','Rejected','Cancelled')),
 details jsonb not null,
 snapshot jsonb not null,
 terms jsonb not null,
 total numeric(12,2) not null check(total>=0),
 deposit numeric(12,2) not null check(deposit>=0 and deposit<=total),
 paid numeric(12,2) not null default 0 check(paid>=0 and paid<=total),
 swap_credit numeric(12,2) not null default 0 check(swap_credit>=0),
 offer_expires_at timestamptz,
 fulfilled boolean not null default false,
 approved_at timestamptz,
 decision_reason text not null default '',
 revision integer not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(customer_id,request_id)
);
create unique index if not exists one_open_customer_application on public.customer_applications(customer_id,product_id,kind) where status in ('Pending','Offered','Approved');
create index if not exists applications_store on public.customer_applications(store_id,created_at desc);
create index if not exists applications_customer on public.customer_applications(customer_id,created_at desc);
create table if not exists public.application_payments (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique,
 application_id uuid not null references public.customer_applications(id),
 store_id uuid not null references auth.users(id),
 customer_id uuid not null references auth.users(id),
 amount numeric(12,2) not null check(amount>0),
 method text not null check(method in ('Cash','Mobile Money','Bank Transfer')),
 reference text not null,
 recorded_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 unique(store_id,reference)
);
create table if not exists public.application_events (
 id uuid primary key default gen_random_uuid(),
 application_id uuid not null references public.customer_applications(id),
 customer_id uuid not null references auth.users(id),
 store_id uuid not null references auth.users(id),
 actor_id uuid not null references auth.users(id),
 event text not null,
 message text not null,
 created_at timestamptz not null default now()
);
create index if not exists payments_customer_created on public.application_payments(customer_id,created_at desc);
create index if not exists payments_store_created on public.application_payments(store_id,created_at desc);
create index if not exists events_customer_created on public.application_events(customer_id,created_at desc);
create index if not exists events_store_created on public.application_events(store_id,created_at desc);
create or replace function public.submit_customer_application(p_record jsonb, p_product_revision integer)
returns jsonb language plpgsql set search_path=public as $$
declare p public.store_products; a public.customer_applications;
begin
 select * into a from public.customer_applications where customer_id=(p_record->>'customer_id')::uuid and request_id=(p_record->>'request_id')::uuid;
 if found then return to_jsonb(a); end if;
 select * into p from public.store_products where id=(p_record->>'product_id')::uuid for update;
 if not found or p.store_id<>(p_record->>'store_id')::uuid or p.status<>'Active' or p.stock<1 then raise exception 'Product unavailable'; end if;
 if p.revision<>p_product_revision then raise exception 'Product changed; reload the product before submitting'; end if;
 insert into public.customer_applications(reference,request_id,customer_id,store_id,product_id,kind,details,snapshot,terms,total,deposit)
 values(p_record->>'reference',(p_record->>'request_id')::uuid,(p_record->>'customer_id')::uuid,p.store_id,p.id,p_record->>'kind',p_record->'details',p_record->'snapshot',p_record->'terms',(p_record->>'total')::numeric,(p_record->>'deposit')::numeric)
 returning * into a;
 insert into public.application_events(application_id,customer_id,store_id,actor_id,event,message)
 values(a.id,a.customer_id,a.store_id,a.customer_id,'Submitted','Application submitted for store review.');
 return to_jsonb(a);
end $$;

create or replace function public.act_on_customer_application(p_id uuid,p_scope_id uuid,p_customer boolean,p_actor uuid,p_revision integer,p_action text,p_data jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare a public.customer_applications; p public.store_products; amount numeric; receipt public.application_payments; msg text; reserve_stock boolean:=false;
begin
 select * into a from public.customer_applications where id=p_id and (case when p_customer then customer_id=p_scope_id else store_id=p_scope_id end) for update;
 if not found then raise exception 'Application not found'; end if;
 if p_action='payment' and not p_customer then
   select * into receipt from public.application_payments where request_id=(p_data->>'request_id')::uuid;
   if found then
     if receipt.application_id<>a.id or receipt.amount<>(p_data->>'amount')::numeric or receipt.method<>(p_data->>'method') or receipt.reference<>(p_data->>'reference') then raise exception 'Payment request already used'; end if;
     return to_jsonb(a);
   end if;
 end if;
 if a.revision<>p_revision then raise exception 'Application changed; refresh before trying again'; end if;
 if p_customer and p_action not in ('cancel','accept') then raise exception 'Action not permitted'; end if;
 if p_action='approve' and not p_customer then
   if a.kind='swap' or a.status<>'Pending' then raise exception 'Application cannot be approved in this state'; end if;
   reserve_stock:=true; a.status:='Approved'; msg:='Store approved the application.';
 elsif p_action='offer' and not p_customer then
   if a.kind<>'swap' or a.status not in ('Pending','Offered') then raise exception 'Swap cannot receive an offer in this state'; end if;
   amount:=(p_data->>'credit')::numeric;
   if amount<0 or amount>(a.snapshot->>'price')::numeric then raise exception 'Invalid swap credit'; end if;
   a.swap_credit:=amount; a.total:=(a.snapshot->>'price')::numeric-amount; a.deposit:=a.total;
   a.status:='Offered'; a.offer_expires_at:=now()+make_interval(days=>coalesce((a.terms->>'offerDays')::integer,7));
   a.decision_reason:=p_data->>'reason'; msg:='Store sent a swap offer. Review the credit and balance before accepting.';
 elsif p_action='accept' and p_customer then
   if a.status<>'Offered' or a.kind<>'swap' or a.offer_expires_at<now() then raise exception 'Swap offer is unavailable or expired'; end if;
   reserve_stock:=true; a.status:='Approved'; msg:='Customer accepted the swap offer.';
 elsif p_action='reject' and not p_customer then
   if a.status not in ('Pending','Offered') or length(btrim(coalesce(p_data->>'reason','')))<3 then raise exception 'Provide a reason for rejecting a pending application'; end if;
   a.status:='Rejected'; a.decision_reason:=p_data->>'reason'; msg:='Application rejected: '||a.decision_reason;
 elsif p_action='cancel' then
   if a.status not in ('Pending','Offered','Approved') or a.paid>0 or a.fulfilled then raise exception 'Only unpaid, unfulfilled applications can be cancelled'; end if;
   if a.status='Approved' then update public.store_products set stock=stock+1,revision=revision+1,updated_at=now() where id=a.product_id; end if;
   a.status:='Cancelled'; msg:='Application cancelled.';
 elsif p_action='payment' and not p_customer then
   if a.status<>'Approved' then raise exception 'Only approved plans can receive payments'; end if;
   amount:=(p_data->>'amount')::numeric;
   if amount<=0 or amount<>round(amount,2) or amount>a.total-a.paid then raise exception 'Payment must be positive and cannot exceed the balance'; end if;
   insert into public.application_payments(request_id,application_id,store_id,customer_id,amount,method,reference,recorded_by)
   values((p_data->>'request_id')::uuid,a.id,a.store_id,a.customer_id,amount,p_data->>'method',p_data->>'reference',p_actor);
   a.paid:=a.paid+amount; msg:='Store confirmed a payment of GHS '||amount::text||'.';
 elsif p_action='fulfill' and not p_customer then
   if a.status<>'Approved' or a.fulfilled or a.paid<a.deposit or (a.kind in ('layaway','swap') and a.paid<a.total) then raise exception 'Required payment must be confirmed before handover'; end if;
   if a.kind='swap' then
     if coalesce((p_data->>'device_received')::boolean,false)=false then raise exception 'Confirm physical receipt of the trade-in device'; end if;
     insert into public.store_trade_inventory(store_id,reference,device,serial_number,source_reference,condition,acquisition_value,received_on,notes,status)
     values(a.store_id,'SWAP-'||a.reference,a.details->>'device',coalesce(a.details->>'serial',''),a.reference,a.details->>'deviceCondition',a.swap_credit,current_date,'Received on completed customer exchange.','HELD_FOR_SWAP');
   end if;
   a.fulfilled:=true; msg:='Store confirmed product handover.';
 else raise exception 'Action not permitted';
 end if;
 if reserve_stock then
   select * into p from public.store_products where id=a.product_id for update;
   if p.status<>'Active' or p.stock<1 then raise exception 'Product is no longer available'; end if;
   update public.store_products set stock=stock-1,revision=revision+1,updated_at=now() where id=a.product_id;
   a.approved_at:=now();
 end if;
 if a.status='Approved' and a.fulfilled and a.paid=a.total then a.status:='Completed'; end if;
 update public.customer_applications set status=a.status,total=a.total,deposit=a.deposit,paid=a.paid,swap_credit=a.swap_credit,
 offer_expires_at=a.offer_expires_at,decision_reason=a.decision_reason,fulfilled=a.fulfilled,approved_at=a.approved_at,revision=revision+1,updated_at=now()
 where id=a.id returning * into a;
 insert into public.application_events(application_id,customer_id,store_id,actor_id,event,message)
 values(a.id,a.customer_id,a.store_id,p_actor,p_action,msg);
 return to_jsonb(a);
end $$;

alter table public.customer_applications enable row level security;
alter table public.application_payments enable row level security;
alter table public.application_events enable row level security;
revoke all on public.customer_applications,public.application_payments,public.application_events from public,anon,authenticated;
grant select,insert,update on public.customer_applications to service_role;
grant select,insert on public.application_payments,public.application_events to service_role;
revoke execute on function public.submit_customer_application(jsonb,integer),public.act_on_customer_application(uuid,uuid,boolean,uuid,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.submit_customer_application(jsonb,integer),public.act_on_customer_application(uuid,uuid,boolean,uuid,integer,text,jsonb) to service_role;

-- SOURCE: 006_homepage_ratings_analytics.sql
create table if not exists public.purchase_ratings (
 application_id uuid primary key references public.customer_applications(id),
 customer_id uuid not null references auth.users(id),
 store_id uuid not null references auth.users(id),
 product_id uuid not null references public.store_products(id),
 store_score integer not null check(store_score between 1 and 5),
 product_score integer not null check(product_score between 1 and 5),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists ratings_store on public.purchase_ratings(store_id);
create index if not exists ratings_product on public.purchase_ratings(product_id);
create or replace function public.save_purchase_rating(p_application uuid,p_customer uuid,p_store_score integer,p_product_score integer)
returns jsonb language plpgsql set search_path=public as $$
declare a public.customer_applications; r public.purchase_ratings;
begin
 select * into a from public.customer_applications where id=p_application and customer_id=p_customer and status='Completed';
 if not found then raise exception 'Only your completed purchases can be rated'; end if;
 insert into public.purchase_ratings(application_id,customer_id,store_id,product_id,store_score,product_score)
 values(a.id,a.customer_id,a.store_id,a.product_id,p_store_score,p_product_score)
 on conflict(application_id) do update set store_score=excluded.store_score,product_score=excluded.product_score,updated_at=now()
 returning * into r;
 return to_jsonb(r);
end $$;
create or replace function public.public_rating_summary()
returns jsonb language sql stable set search_path=public as $$
 select jsonb_build_object(
 'stores',coalesce((select jsonb_agg(x) from (select store_id as id,round(avg(store_score),2) as rating,count(*) as count from purchase_ratings group by store_id) x),'[]'::jsonb),
 'products',coalesce((select jsonb_agg(x) from (select product_id as id,round(avg(product_score),2) as rating,count(*) as count from purchase_ratings group by product_id) x),'[]'::jsonb));
$$;
create table if not exists public.site_pageviews (
 id uuid primary key,
 visitor_hash text not null check(length(visitor_hash)=64),
 page text not null check(page in ('home','services','browse-stores','store-details','browse-products','register','store-registration','login','forgot-password','info')),
 device text not null check(device in ('Mobile','Tablet','Desktop')),
 source text not null check(length(source)<=253),
 created_at timestamptz not null default now()
);
create index if not exists pageviews_created on public.site_pageviews(created_at);
create index if not exists pageviews_visitor_created on public.site_pageviews(visitor_hash,created_at);
create or replace function public.record_site_pageview(p_id uuid,p_visitor text,p_page text,p_device text,p_source text)
returns boolean language plpgsql set search_path=public as $$
begin
 -- Bound repeated collection from an individual browser; no IP or account data.
 perform pg_advisory_xact_lock(hashtextextended(p_visitor,0));
 if (select count(*) from site_pageviews where visitor_hash=p_visitor and created_at>now()-interval '1 minute')>=30 then return false; end if;
 insert into site_pageviews(id,visitor_hash,page,device,source) values(p_id,p_visitor,p_page,p_device,p_source) on conflict(id) do nothing;
 delete from site_pageviews where created_at<now()-interval '90 days';
 return true;
end $$;
create or replace function public.site_traffic_summary(p_days integer)
returns jsonb language plpgsql stable set search_path=public as $$
declare since timestamptz;
begin
 if p_days not in (7,30,90) then raise exception 'Choose 7, 30 or 90 days'; end if;
 since:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'-make_interval(days=>p_days-1);
 return jsonb_build_object(
 'pageviews',(select count(*) from site_pageviews where created_at>=since),
 'visitors',(select count(distinct visitor_hash) from site_pageviews where created_at>=since),
 'pages',coalesce((select jsonb_agg(x) from (select page as label,count(*) as count from site_pageviews where created_at>=since group by page order by count(*) desc,page) x),'[]'::jsonb),
 'devices',coalesce((select jsonb_agg(x) from (select device as label,count(*) as count from site_pageviews where created_at>=since group by device order by count(*) desc,device) x),'[]'::jsonb),
 'sources',coalesce((select jsonb_agg(x) from (select source as label,count(*) as count from site_pageviews where created_at>=since group by source order by count(*) desc,source limit 20) x),'[]'::jsonb),
 'daily',coalesce((select jsonb_agg(x) from (select to_char(day,'YYYY-MM-DD') as date,(select count(*) from site_pageviews where created_at>=day and created_at<day+interval '1 day') as views from generate_series(since,date_trunc('day',now() at time zone 'UTC') at time zone 'UTC',interval '1 day') day order by day) x),'[]'::jsonb));
end $$;
alter table public.purchase_ratings enable row level security;
alter table public.site_pageviews enable row level security;
revoke all on public.purchase_ratings,public.site_pageviews from public,anon,authenticated;
grant select,insert,update on public.purchase_ratings to service_role;
grant select,insert,delete on public.site_pageviews to service_role;
revoke execute on function public.save_purchase_rating(uuid,uuid,integer,integer),public.public_rating_summary(),public.record_site_pageview(uuid,text,text,text,text),public.site_traffic_summary(integer) from public,anon,authenticated;
grant execute on function public.save_purchase_rating(uuid,uuid,integer,integer),public.public_rating_summary(),public.record_site_pageview(uuid,text,text,text,text),public.site_traffic_summary(integer) to service_role;

-- SOURCE: 007_admin_store_management.sql
-- Apply after 001-006. Archives retain records referenced by customer purchases.
create table if not exists public.deleted_stores (
 store_id uuid primary key references auth.users(id),
 profile jsonb not null,
 deleted_at timestamptz not null default now(),
 deleted_by text not null,
 reason text not null
);
create table if not exists public.deleted_store_products (
 product_id uuid primary key references public.store_products(id),
 store_id uuid not null references public.deleted_stores(store_id),
 product jsonb not null,
 deleted_at timestamptz not null default now()
);
create index if not exists deleted_products_store on public.deleted_store_products(store_id);
create table if not exists public.store_admin_events (
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references auth.users(id),
 action text not null,
 actor text not null,
 reason text not null,
 created_at timestamptz not null default now()
);
alter table public.deleted_stores enable row level security;
alter table public.deleted_store_products enable row level security;
alter table public.store_admin_events enable row level security;
revoke all on public.deleted_stores,public.deleted_store_products,public.store_admin_events from public,anon,authenticated;
grant select on public.deleted_stores,public.deleted_store_products,public.store_admin_events to service_role;

create or replace function public.admin_store_action(p_store uuid,p_action text,p_reason text,p_actor text,p_revision integer,p_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m jsonb; application jsonb; state text; rev integer; next_state text;
begin
 select coalesce(raw_app_meta_data,'{}'::jsonb),coalesce(raw_app_meta_data->'store_review'->'application',raw_user_meta_data->'store_application') into m,application from auth.users where id=p_store for update;
 if not found or coalesce(m->>'role','Customer') not in ('Customer','Store Manager') or application is null or m ? 'store_staff' then
   raise exception 'Store not found or not available for management';
 end if;
 state:=coalesce(m->'store_review'->>'status','Pending Approval');
 rev:=coalesce((m->'store_lifecycle'->>'revision')::integer,0);
 if state is distinct from p_status or rev<>p_revision then raise exception 'Store changed; refresh before trying again'; end if;
 if length(btrim(p_reason))<3 or length(p_reason)>2000 or coalesce(p_actor,'')='' then raise exception 'A reason and administrator identity are required'; end if;
 if p_action='suspend' and state='Approved' then next_state:='Suspended';
 elsif p_action='reactivate' and state='Suspended' then next_state:='Approved';
 elsif p_action='delete' and state in ('Approved','Suspended','Pending Approval','Rejected') then
   next_state:='Deleted';
   -- Retain a snapshot and archive the originals, preserving purchase foreign keys.
   insert into public.deleted_stores(store_id,profile,deleted_by,reason)
     values(p_store,m||jsonb_build_object('store_application',application),p_actor,btrim(p_reason));
   perform id from public.store_products where store_id=p_store for update;
   insert into public.deleted_store_products(product_id,store_id,product)
     select id,store_id,to_jsonb(p) from public.store_products p where store_id=p_store;
   update public.store_products set status='Archived',revision=revision+1,updated_at=now() where store_id=p_store;
 else raise exception 'This action is not available for the current store status'; end if;
 m:=jsonb_set(m,'{store_review}',coalesce(m->'store_review','{}'::jsonb)||jsonb_build_object('status',next_state,'application',application));
 m:=jsonb_set(m,'{store_lifecycle}',jsonb_build_object('revision',rev+1,'action',p_action,'reason',btrim(p_reason),'actor',p_actor,'at',now()));
 update auth.users set raw_app_meta_data=m,updated_at=now() where id=p_store;
 insert into public.store_admin_events(store_id,action,actor,reason) values(p_store,p_action,p_actor,btrim(p_reason));
 return jsonb_build_object('status',next_state,'revision',rev+1);
end $$;
revoke execute on function public.admin_store_action(uuid,text,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.admin_store_action(uuid,text,text,text,integer,text) to service_role;

-- An in-flight profile/settings save must not overwrite a newer admin action.
create or replace function public.guard_store_admin_revision() returns trigger
language plpgsql set search_path='' as $$
begin
 if coalesce((old.raw_app_meta_data->'store_lifecycle'->>'revision')::integer,0)>coalesce((new.raw_app_meta_data->'store_lifecycle'->>'revision')::integer,0) then
   raise exception 'Store changed; refresh before saving';
 end if;
 return new;
end $$;
drop trigger if exists guard_store_admin_revision on auth.users;
create trigger guard_store_admin_revision before update of raw_app_meta_data on auth.users for each row execute function public.guard_store_admin_revision();

-- Close races between an already-authorized request and suspension/deletion.
create or replace function public.guard_store_lifecycle() returns trigger
language plpgsql security definer set search_path='' as $$
declare state text;
begin
 select raw_app_meta_data->'store_review'->>'status' into state from auth.users where id=new.store_id for share;
 if state in ('Suspended','Deleted') then
   if tg_table_name='store_products' and tg_op='UPDATE' then
     if state='Suspended' and new.status='Archived' and exists(select 1 from public.deleted_store_products where product_id=new.id) and (to_jsonb(new)-'status'-'revision'-'updated_at')=(to_jsonb(old)-'status'-'revision'-'updated_at') then return new; end if;
     -- Unpaid cancellations may return reserved stock; catalogue edits remain blocked.
     if (to_jsonb(new)-'stock'-'revision'-'updated_at')=(to_jsonb(old)-'stock'-'revision'-'updated_at') and new.stock>=old.stock then return new; end if;
   elsif tg_table_name='customer_applications' and tg_op='UPDATE' then
     if new.status='Cancelled' and old.paid=0 and not old.fulfilled then return new; end if;
   end if;
   raise exception 'This store is suspended or deleted';
 end if;
 return new;
end $$;
drop trigger if exists guard_product_store on public.store_products;
create trigger guard_product_store before insert or update on public.store_products for each row execute function public.guard_store_lifecycle();
drop trigger if exists guard_application_store on public.customer_applications;
create trigger guard_application_store before insert or update on public.customer_applications for each row execute function public.guard_store_lifecycle();
revoke execute on function public.guard_store_lifecycle(),public.guard_store_admin_revision() from public,anon,authenticated;

-- SOURCE: 008_traffic_engagement.sql
alter table public.site_pageviews add column if not exists active_seconds integer not null default 0;
alter table public.site_pageviews add column if not exists scroll_seconds integer not null default 0;
alter table public.site_pageviews add column if not exists scroll_depth integer not null default 0;
grant update(active_seconds,scroll_seconds,scroll_depth) on public.site_pageviews to service_role;
create or replace function public.record_site_engagement(p_id uuid,p_visitor text,p_seconds integer,p_scroll_seconds integer,p_depth integer)
returns boolean language plpgsql set search_path=public as $$
begin
 if p_seconds not between 0 and 3600 or p_scroll_seconds not between 0 and p_seconds or p_depth not between 0 and 100 then raise exception 'Invalid engagement'; end if;
 update public.site_pageviews set
 active_seconds=greatest(active_seconds,least(p_seconds,extract(epoch from now()-created_at)::integer+5)),
 scroll_seconds=greatest(scroll_seconds,least(p_scroll_seconds,extract(epoch from now()-created_at)::integer+5)),
 scroll_depth=greatest(scroll_depth,p_depth)
 where id=p_id and visitor_hash=p_visitor and created_at>now()-interval '1 day';
 return found;
end $$;
create or replace function public.site_engagement_summary(p_days integer)
returns jsonb language plpgsql stable set search_path=public as $$
declare since timestamptz;
begin
 if p_days not in (7,30,90) then raise exception 'Invalid reporting period'; end if;
 since:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'-make_interval(days=>p_days-1);
 return jsonb_build_object(
 'activeSeconds',(select coalesce(sum(active_seconds),0) from site_pageviews where created_at>=since),
 'scrollSeconds',(select coalesce(sum(scroll_seconds),0) from site_pageviews where created_at>=since),
 'averageActiveSeconds',(select coalesce(round(avg(active_seconds),1),0) from site_pageviews where created_at>=since),
 'averageScrollDepth',(select coalesce(round(avg(scroll_depth),1),0) from site_pageviews where created_at>=since),
 'engagedViews',(select count(*) from site_pageviews where created_at>=since and active_seconds>=10),
 'pages',coalesce((select jsonb_agg(x) from (select page,count(*) as views,round(avg(active_seconds),1) as seconds,round(avg(scroll_depth),1) as depth,sum(scroll_seconds) as scrolling from site_pageviews where created_at>=since group by page order by count(*) desc) x),'[]'::jsonb));
end $$;
revoke execute on function public.record_site_engagement(uuid,text,integer,integer,integer),public.site_engagement_summary(integer) from public,anon,authenticated;
grant execute on function public.record_site_engagement(uuid,text,integer,integer,integer),public.site_engagement_summary(integer) to service_role;

-- SOURCE: 009_store_subscriptions.sql
create table if not exists public.subscription_plans (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(name) between 1 and 100),
 amount_minor integer not null check(amount_minor between 100 and 100000000),
 duration_days integer not null check(duration_days between 1 and 366),
 enabled boolean not null default false,
 revision integer not null default 1,
 created_at timestamptz not null default now()
);
create table if not exists public.subscription_orders (
 reference text primary key,
 store_id uuid not null references auth.users(id),
 plan_id uuid not null references public.subscription_plans(id),
 plan_name text not null,
 amount_minor integer not null check(amount_minor>0),
 currency text not null default 'GHS' check(currency='GHS'),
 duration_days integer not null check(duration_days between 1 and 366),
 email text not null,
 environment text not null check(environment in ('test','live')),
 status text not null default 'Pending' check(status in ('Pending','Paid')),
 checkout_url text,
 transaction_id text unique,
 paid_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists subscription_orders_store on public.subscription_orders(store_id,created_at desc);
create table if not exists public.store_subscriptions (
 store_id uuid primary key references auth.users(id),
 paid_until timestamptz not null,
 plan_name text not null,
 reference text not null references public.subscription_orders(reference),
 environment text not null check(environment in ('test','live')),
 updated_at timestamptz not null default now()
);
alter table public.subscription_plans enable row level security;
alter table public.subscription_orders enable row level security;
alter table public.store_subscriptions enable row level security;
revoke all on public.subscription_plans,public.subscription_orders,public.store_subscriptions from public,anon,authenticated;
grant select,insert,update on public.subscription_plans,public.subscription_orders to service_role;
grant select on public.store_subscriptions to service_role;

create or replace function public.activate_store_subscription(p_reference text,p_transaction text,p_amount integer,p_currency text,p_email text,p_environment text,p_paid_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.subscription_orders; expiry timestamptz; previous timestamptz; m jsonb; old_environment text;
begin
 select * into o from public.subscription_orders where reference=p_reference;
 if not found then raise exception 'Unknown subscription reference'; end if;
 select raw_app_meta_data into m from auth.users where id=o.store_id for update;
 select * into o from public.subscription_orders where reference=p_reference for update;
 if p_amount is distinct from o.amount_minor or p_currency is distinct from o.currency or lower(p_email) is distinct from lower(o.email) or p_environment is distinct from o.environment or coalesce(p_transaction,'')='' then raise exception 'Payment does not match subscription order'; end if;
 if o.status='Paid' then
   if o.transaction_id<>p_transaction then raise exception 'Transaction mismatch'; end if;
   return jsonb_build_object('alreadyPaid',true);
 end if;
 if p_paid_at is null or p_paid_at>now()+interval '5 minutes' or p_paid_at<o.created_at-interval '5 minutes' then raise exception 'Invalid payment date'; end if;
 select paid_until,environment into previous,old_environment from public.store_subscriptions where store_id=o.store_id;
 if old_environment='live' and o.environment='test' then raise exception 'Use a separate database project for test payments'; end if;
 if old_environment is distinct from o.environment then previous:=null; end if;
 expiry:=greatest(coalesce(previous,p_paid_at),p_paid_at)+make_interval(days=>o.duration_days);
 update public.subscription_orders set status='Paid',paid_at=p_paid_at,transaction_id=p_transaction where reference=o.reference;
 insert into public.store_subscriptions(store_id,paid_until,plan_name,reference,environment) values(o.store_id,expiry,o.plan_name,o.reference,o.environment)
 on conflict(store_id) do update set paid_until=excluded.paid_until,plan_name=excluded.plan_name,reference=excluded.reference,environment=excluded.environment,updated_at=now();
 update auth.users set raw_app_meta_data=jsonb_set(coalesce(m,'{}'::jsonb),'{store_subscription}',jsonb_build_object('paid_until',expiry,'plan_name',o.plan_name,'reference',o.reference,'environment',o.environment)),updated_at=now() where id=o.store_id;
 return jsonb_build_object('paidUntil',expiry,'alreadyPaid',false);
end $$;
revoke execute on function public.activate_store_subscription(text,text,integer,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.activate_store_subscription(text,text,integer,text,text,text,timestamptz) to service_role;

-- Profile/settings writes cannot replace the payment service's subscription state.
create or replace function public.protect_subscription_metadata() returns trigger language plpgsql security definer set search_path='' as $$
declare s public.store_subscriptions;
begin
 select * into s from public.store_subscriptions where store_id=new.id;
 if found then
   new.raw_app_meta_data:=jsonb_set(coalesce(new.raw_app_meta_data,'{}'::jsonb),'{store_subscription}',jsonb_build_object('paid_until',s.paid_until,'plan_name',s.plan_name,'reference',s.reference,'environment',s.environment));
 else new.raw_app_meta_data:=coalesce(new.raw_app_meta_data,'{}'::jsonb)-'store_subscription';
 end if;
 return new;
end $$;
drop trigger if exists protect_subscription_metadata on auth.users;
create trigger protect_subscription_metadata before insert or update of raw_app_meta_data on auth.users for each row execute function public.protect_subscription_metadata();
revoke execute on function public.protect_subscription_metadata() from public,anon,authenticated;

-- New applications/offer acceptance must still be paid at the moment of writing.
create or replace function public.require_subscription_for_application() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' or (new.status='Approved' and old.status='Offered') then
   perform id from auth.users where id=new.store_id for share;
   if not exists(select 1 from public.store_subscriptions where store_id=new.store_id and paid_until>now()) then raise exception 'This store requires an active subscription'; end if;
 end if;
 return new;
end $$;
drop trigger if exists require_subscription_for_application on public.customer_applications;
create trigger require_subscription_for_application before insert or update on public.customer_applications for each row execute function public.require_subscription_for_application();
revoke execute on function public.require_subscription_for_application() from public,anon,authenticated;

notify pgrst, 'reload schema';
commit;

-- SOURCE: 010_restore_deleted_stores.sql
-- Apply after 001-009. Restore archives without overwriting stock or purchase history.
begin;
create or replace function public.admin_store_action(p_store uuid,p_action text,p_reason text,p_actor text,p_revision integer,p_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m jsonb; application jsonb; state text; rev integer; next_state text; archived_profile jsonb;
begin
 select coalesce(raw_app_meta_data,'{}'::jsonb),coalesce(raw_app_meta_data->'store_review'->'application',raw_user_meta_data->'store_application') into m,application from auth.users where id=p_store for update;
 if not found or coalesce(m->>'role','Customer') not in ('Customer','Store Manager') or application is null or m ? 'store_staff' then
   raise exception 'Store not found or not available for management';
 end if;
 state:=coalesce(m->'store_review'->>'status','Pending Approval');
 rev:=coalesce((m->'store_lifecycle'->>'revision')::integer,0);
 if state is distinct from p_status or p_revision is null or rev<>p_revision then raise exception 'Store changed; refresh before trying again'; end if;
 if p_reason is null or length(btrim(p_reason))<3 or length(p_reason)>2000 or coalesce(btrim(p_actor),'')='' then raise exception 'A reason and administrator identity are required'; end if;
 if p_action='suspend' and state='Approved' then next_state:='Suspended';
 elsif p_action='reactivate' and state='Suspended' then next_state:='Approved';
 elsif p_action='delete' and state in ('Approved','Suspended','Pending Approval','Rejected') then
   next_state:='Deleted';
   insert into public.deleted_stores(store_id,profile,deleted_by,reason)
     values(p_store,m||jsonb_build_object('store_application',application),p_actor,btrim(p_reason));
   perform id from public.store_products where store_id=p_store for update;
   insert into public.deleted_store_products(product_id,store_id,product)
     select id,store_id,to_jsonb(p) from public.store_products p where store_id=p_store;
   update public.store_products set status='Archived',revision=revision+1,updated_at=now() where store_id=p_store;
 elsif p_action='restore' and state='Deleted' then
   select profile into archived_profile from public.deleted_stores where store_id=p_store for update;
   if not found then raise exception 'The store archive is missing; restoration is unavailable'; end if;
   next_state:=coalesce(archived_profile->'store_review'->>'status','Pending Approval');
   if next_state not in ('Approved','Suspended','Pending Approval','Rejected') then
     raise exception 'The archived store status is invalid';
   end if;
   perform id from public.store_products where store_id=p_store for update;
 else raise exception 'This action is not available for the current store status'; end if;
 m:=jsonb_set(m,'{store_review}',coalesce(m->'store_review','{}'::jsonb)||jsonb_build_object('status',next_state,'application',application));
 m:=jsonb_set(m,'{store_lifecycle}',jsonb_build_object('revision',rev+1,'action',p_action,'reason',btrim(p_reason),'actor',p_actor,'at',now()));
 update auth.users set raw_app_meta_data=m,updated_at=now() where id=p_store;
 if p_action='restore' then
   -- Restore only publication status. Cancellations may have returned stock since deletion.
   update public.store_products p set status=a.product->>'status',revision=p.revision+1,updated_at=now()
     from public.deleted_store_products a where a.store_id=p_store and a.product_id=p.id and p.store_id=p_store;
   delete from public.deleted_store_products where store_id=p_store;
   delete from public.deleted_stores where store_id=p_store;
 end if;
 insert into public.store_admin_events(store_id,action,actor,reason) values(p_store,p_action,p_actor,btrim(p_reason));
 return jsonb_build_object('status',next_state,'revision',rev+1);
end $$;
revoke execute on function public.admin_store_action(uuid,text,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.admin_store_action(uuid,text,text,text,integer,text) to service_role;

create or replace function public.guard_store_lifecycle() returns trigger
language plpgsql security definer set search_path='' as $$
declare state text; lifecycle_action text;
begin
 select raw_app_meta_data->'store_review'->>'status',raw_app_meta_data->'store_lifecycle'->>'action' into state,lifecycle_action from auth.users where id=new.store_id for share;
 if state in ('Suspended','Deleted') then
   if tg_table_name='store_products' and tg_op='UPDATE' then
     if state='Suspended' and exists(select 1 from public.deleted_store_products where product_id=new.id and store_id=new.store_id
       and (new.status='Archived' or (lifecycle_action='restore' and old.status='Archived' and new.status=product->>'status')))
       and (to_jsonb(new)-'status'-'revision'-'updated_at')=(to_jsonb(old)-'status'-'revision'-'updated_at') then return new; end if;
     if (to_jsonb(new)-'stock'-'revision'-'updated_at')=(to_jsonb(old)-'stock'-'revision'-'updated_at') and new.stock>=old.stock then return new; end if;
   elsif tg_table_name='customer_applications' and tg_op='UPDATE' then
     if new.status='Cancelled' and old.paid=0 and not old.fulfilled then return new; end if;
   end if;
   raise exception 'This store is suspended or deleted';
 end if;
 return new;
end $$;
revoke execute on function public.guard_store_lifecycle() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;

-- SOURCE: 011_purchase_option_prices.sql
-- Apply after 001-010. Existing products keep their prices until edited.
begin;
alter table public.store_products add column if not exists prices jsonb not null default '{}'::jsonb;
update public.store_products set prices=jsonb_build_object('hire_purchase',price,'layaway',price,'swap',price)||prices
 where not (prices ? 'hire_purchase' and prices ? 'layaway' and prices ? 'swap');

create or replace function public.act_on_customer_application(p_id uuid,p_scope_id uuid,p_customer boolean,p_actor uuid,p_revision integer,p_action text,p_data jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare a public.customer_applications; p public.store_products; amount numeric; receipt public.application_payments; msg text; reserve_stock boolean:=false;
begin
 select * into a from public.customer_applications where id=p_id and (case when p_customer then customer_id=p_scope_id else store_id=p_scope_id end) for update;
 if not found then raise exception 'Application not found'; end if;
 if p_action='payment' and not p_customer then
   select * into receipt from public.application_payments where request_id=(p_data->>'request_id')::uuid;
   if found then
     if receipt.application_id<>a.id or receipt.amount<>(p_data->>'amount')::numeric or receipt.method<>(p_data->>'method') or receipt.reference<>(p_data->>'reference') then raise exception 'Payment request already used'; end if;
     return to_jsonb(a);
   end if;
 end if;
 if a.revision<>p_revision then raise exception 'Application changed; refresh before trying again'; end if;
 if p_customer and p_action not in ('cancel','accept') then raise exception 'Action not permitted'; end if;
 if p_action='approve' and not p_customer then
   if a.kind='swap' or a.status<>'Pending' then raise exception 'Application cannot be approved in this state'; end if;
   reserve_stock:=true; a.status:='Approved'; msg:='Store approved the application.';
 elsif p_action='adjust_price' and not p_customer then
   if a.status not in ('Pending','Offered') or a.paid<>0 or a.fulfilled then raise exception 'Price can only change during application review before approval or payment'; end if;
   amount:=(p_data->>'price')::numeric;
   if amount is null or amount<0.01 or amount>9999999999.99 or amount<>round(amount,2) then raise exception 'Enter a valid price using at most two decimal places'; end if;
   if length(btrim(coalesce(p_data->>'reason','')))<3 or length(p_data->>'reason')>1000 then raise exception 'Provide a reason for adjusting the price'; end if;
   msg:='Store changed this application price from GHS '||(a.snapshot->>'price')||' to GHS '||amount::text||'. Reason: '||btrim(p_data->>'reason');
   a.snapshot:=a.snapshot||jsonb_build_object('originalPrice',coalesce(a.snapshot->'originalPrice',a.snapshot->'price'),'price',amount);
   if a.kind='swap' then
     a.swap_credit:=0; a.deposit:=amount; a.status:='Pending'; a.offer_expires_at:=null;
     msg:=msg||' A new swap offer is required.';
   else
     a.deposit:=least(amount,round(a.deposit*amount/nullif(a.total,0),2));
   end if;
   a.total:=amount;
 elsif p_action='offer' and not p_customer then
   if a.kind<>'swap' or a.status not in ('Pending','Offered') then raise exception 'Swap cannot receive an offer in this state'; end if;
   amount:=(p_data->>'credit')::numeric;
   if amount<0 or amount>(a.snapshot->>'price')::numeric then raise exception 'Invalid swap credit'; end if;
   a.swap_credit:=amount; a.total:=(a.snapshot->>'price')::numeric-amount; a.deposit:=a.total;
   a.status:='Offered'; a.offer_expires_at:=now()+make_interval(days=>coalesce((a.terms->>'offerDays')::integer,7));
   a.decision_reason:=p_data->>'reason'; msg:='Store sent a swap offer. Review the credit and balance before accepting.';
 elsif p_action='accept' and p_customer then
   if a.status<>'Offered' or a.kind<>'swap' or a.offer_expires_at<now() then raise exception 'Swap offer is unavailable or expired'; end if;
   reserve_stock:=true; a.status:='Approved'; msg:='Customer accepted the swap offer.';
 elsif p_action='reject' and not p_customer then
   if a.status not in ('Pending','Offered') or length(btrim(coalesce(p_data->>'reason','')))<3 then raise exception 'Provide a reason for rejecting a pending application'; end if;
   a.status:='Rejected'; a.decision_reason:=p_data->>'reason'; msg:='Application rejected: '||a.decision_reason;
 elsif p_action='cancel' then
   if a.status not in ('Pending','Offered','Approved') or a.paid>0 or a.fulfilled then raise exception 'Only unpaid, unfulfilled applications can be cancelled'; end if;
   if a.status='Approved' then update public.store_products set stock=stock+1,revision=revision+1,updated_at=now() where id=a.product_id; end if;
   a.status:='Cancelled'; msg:='Application cancelled.';
 elsif p_action='payment' and not p_customer then
   if a.status<>'Approved' then raise exception 'Only approved plans can receive payments'; end if;
   amount:=(p_data->>'amount')::numeric;
   if amount<=0 or amount<>round(amount,2) or amount>a.total-a.paid then raise exception 'Payment must be positive and cannot exceed the balance'; end if;
   insert into public.application_payments(request_id,application_id,store_id,customer_id,amount,method,reference,recorded_by)
   values((p_data->>'request_id')::uuid,a.id,a.store_id,a.customer_id,amount,p_data->>'method',p_data->>'reference',p_actor);
   a.paid:=a.paid+amount; msg:='Store confirmed a payment of GHS '||amount::text||'.';
 elsif p_action='fulfill' and not p_customer then
   if a.status<>'Approved' or a.fulfilled or a.paid<a.deposit or (a.kind in ('layaway','swap') and a.paid<a.total) then raise exception 'Required payment must be confirmed before handover'; end if;
   if a.kind='swap' then
     if coalesce((p_data->>'device_received')::boolean,false)=false then raise exception 'Confirm physical receipt of the trade-in device'; end if;
     insert into public.store_trade_inventory(store_id,reference,device,serial_number,source_reference,condition,acquisition_value,received_on,notes,status)
     values(a.store_id,'SWAP-'||a.reference,a.details->>'device',coalesce(a.details->>'serial',''),a.reference,a.details->>'deviceCondition',a.swap_credit,current_date,'Received on completed customer exchange.','HELD_FOR_SWAP');
   end if;
   a.fulfilled:=true; msg:='Store confirmed product handover.';
 else raise exception 'Action not permitted';
 end if;
 if reserve_stock then
   select * into p from public.store_products where id=a.product_id for update;
   if p.status<>'Active' or p.stock<1 then raise exception 'Product is no longer available'; end if;
   update public.store_products set stock=stock-1,revision=revision+1,updated_at=now() where id=a.product_id;
   a.approved_at:=now();
 end if;
 if a.status='Approved' and a.fulfilled and a.paid=a.total then a.status:='Completed'; end if;
 update public.customer_applications set snapshot=a.snapshot,status=a.status,total=a.total,deposit=a.deposit,paid=a.paid,swap_credit=a.swap_credit,
 offer_expires_at=a.offer_expires_at,decision_reason=a.decision_reason,fulfilled=a.fulfilled,approved_at=a.approved_at,revision=revision+1,updated_at=now()
 where id=a.id returning * into a;
 insert into public.application_events(application_id,customer_id,store_id,actor_id,event,message)
 values(a.id,a.customer_id,a.store_id,p_actor,p_action,msg);
 return to_jsonb(a);
end $$;

notify pgrst,'reload schema';
commit;

-- SOURCE: 012_store_notifications.sql
-- Apply after 001-011. Read state is private to each owner/staff account.
begin;
create table if not exists public.store_notification_reads (
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references auth.users(id),
 user_id uuid not null references auth.users(id),
 notification_key text not null check(length(notification_key) between 1 and 200),
 read_at timestamptz not null default now(),
 unique(store_id,user_id,notification_key)
);
alter table public.store_notification_reads enable row level security;
revoke all on public.store_notification_reads from public,anon,authenticated;
grant select,insert,update on public.store_notification_reads to service_role;
notify pgrst,'reload schema';
commit;

-- SOURCE: 013_admin_agent_settlements.sql
-- Apply after 001-012. Remittances reference real agent-recorded payment receipts.
begin;
create table if not exists public.agent_settlements (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique,
 reference text not null unique,
 store_id uuid not null references auth.users(id),
 agent_id uuid not null references public.store_field_agents(id),
 amount numeric(12,2) not null check(amount>0),
 method text not null check(method in ('Cash','Mobile Money','Bank Transfer')),
 reason text not null check(length(btrim(reason)) between 3 and 1000),
 actor text not null check(length(btrim(actor))>0),
 created_at timestamptz not null default now()
);
create table if not exists public.agent_settlement_items (
 id uuid primary key default gen_random_uuid(),
 settlement_id uuid not null references public.agent_settlements(id),
 payment_id uuid not null unique references public.application_payments(id)
);
create index if not exists agent_settlements_store on public.agent_settlements(store_id,created_at desc);
create index if not exists agent_settlements_agent on public.agent_settlements(agent_id,created_at desc);
alter table public.agent_settlements enable row level security;
alter table public.agent_settlement_items enable row level security;
revoke all on public.agent_settlements,public.agent_settlement_items from public,anon,authenticated;
grant select on public.agent_settlements,public.agent_settlement_items to service_role;

create or replace function public.admin_settle_agent(p_agent uuid,p_payments uuid[],p_request uuid,p_expected numeric,p_method text,p_reason text,p_actor text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare agent public.store_field_agents; settlement public.agent_settlements; total numeric; payment_count integer; saved_ids uuid[];
begin
 select * into agent from public.store_field_agents where id=p_agent for update;
 if not found then raise exception 'Agent not found'; end if;
 if p_request is null or p_expected is null or p_expected<=0 or p_expected>9999999999.99 or p_expected<>round(p_expected,2)
    or p_method is null or p_method not in ('Cash','Mobile Money','Bank Transfer')
    or p_reason is null or length(btrim(p_reason)) not between 3 and 1000 or coalesce(btrim(p_actor),'')='' then
   raise exception 'Provide a valid confirmed remittance, reason and administrator identity';
 end if;
 if coalesce(cardinality(p_payments),0)=0 or cardinality(p_payments)>1000 or exists(select 1 from unnest(p_payments) id where id is null)
    or cardinality(p_payments)<>(select count(distinct id) from unnest(p_payments) id) then raise exception 'Choose distinct unsettled payments'; end if;
 select * into settlement from public.agent_settlements where request_id=p_request;
 if found then
   select array_agg(payment_id order by payment_id) into saved_ids from public.agent_settlement_items where settlement_id=settlement.id;
   if settlement.agent_id<>p_agent or settlement.amount<>p_expected or settlement.method<>p_method or settlement.reason<>btrim(p_reason)
      or settlement.actor<>p_actor or saved_ids<>(select array_agg(id order by id) from unnest(p_payments) id) then raise exception 'Settlement request already used'; end if;
   return to_jsonb(settlement);
 end if;
 perform id from public.application_payments where id=any(p_payments) order by id for update;
 select count(*),sum(amount) into payment_count,total from public.application_payments
   where id=any(p_payments) and store_id=agent.store_id and recorded_by=agent.id;
 if payment_count<>cardinality(p_payments) then raise exception 'Payments must belong to this agent and store'; end if;
 if exists(select 1 from public.agent_settlement_items where payment_id=any(p_payments)) then raise exception 'A selected payment was already settled; refresh this account'; end if;
 if total<>p_expected then raise exception 'Settlement amount changed; refresh this account'; end if;
 insert into public.agent_settlements(request_id,reference,store_id,agent_id,amount,method,reason,actor)
   values(p_request,'AST-'||p_request::text,agent.store_id,agent.id,total,p_method,btrim(p_reason),p_actor) returning * into settlement;
 insert into public.agent_settlement_items(settlement_id,payment_id) select settlement.id,id from unnest(p_payments) id;
 return to_jsonb(settlement);
end $$;
revoke execute on function public.admin_settle_agent(uuid,uuid[],uuid,numeric,text,text,text) from public,anon,authenticated;
grant execute on function public.admin_settle_agent(uuid,uuid[],uuid,numeric,text,text,text) to service_role;
notify pgrst,'reload schema';
commit;

-- SOURCE: 014_admin_platform.sql
-- Migration 014: Admin platform settings and support.
-- Apply after 001-013. Platform configuration, private support and admin inbox.
begin;
create table if not exists public.platform_settings (
 id boolean primary key default true check(id),
 values jsonb not null default '{}'::jsonb,
 revision integer not null default 0,
 updated_at timestamptz not null default now(),
 updated_by text not null default ''
);
insert into public.platform_settings(id) values(true) on conflict do nothing;
create table if not exists public.platform_admin_events (
 id uuid primary key default gen_random_uuid(), action text not null,
 actor text not null, reference text not null, message text not null,
 created_at timestamptz not null default now()
);
create table if not exists public.support_tickets (
 id uuid primary key, user_id uuid not null references auth.users(id),
 email text not null, name text not null, role text not null,
 subject text not null check(length(subject) between 3 and 200),
 category text not null check(category in ('Account','Payments','Applications','Store','Technical','Other')),
 status text not null default 'Open' check(status in ('Open','In Progress','Resolved','Closed')),
 revision integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists support_ticket_owner on public.support_tickets(user_id,created_at);
create table if not exists public.support_messages (
 id uuid primary key, ticket_id uuid not null references public.support_tickets(id),
 sender text not null check(sender in ('User','Admin')),
 actor text not null, body text not null check(length(body) between 1 and 5000),
 created_at timestamptz not null default now()
);
create index if not exists support_message_ticket on public.support_messages(ticket_id,created_at);
create table if not exists public.admin_notification_reads (
 actor text not null, notification_key text not null,
 read_at timestamptz not null default now(), primary key(actor,notification_key)
);
alter table public.platform_settings enable row level security;
alter table public.platform_admin_events enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.admin_notification_reads enable row level security;
revoke all on public.platform_settings,public.platform_admin_events,public.support_tickets,public.support_messages,public.admin_notification_reads from public,anon,authenticated;
grant select on public.platform_settings,public.platform_admin_events,public.support_tickets,public.support_messages to service_role;
grant select,insert,update on public.admin_notification_reads to service_role;

create or replace function public.admin_save_platform_settings(p_values jsonb,p_revision integer,p_actor text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare saved public.platform_settings;
begin
 select * into saved from public.platform_settings where id=true for update;
 if p_revision is null or saved.revision<>p_revision then raise exception 'Settings changed; refresh before saving'; end if;
 if jsonb_typeof(p_values)<>'object' or coalesce(btrim(p_actor),'')='' then raise exception 'Settings and administrator identity are required'; end if;
 update public.platform_settings set values=p_values,revision=revision+1,updated_at=now(),updated_by=p_actor where id=true returning * into saved;
 insert into public.platform_admin_events(action,actor,reference,message) values('Settings updated',p_actor,'platform','Platform settings saved');
 return to_jsonb(saved);
end $$;

create or replace function public.support_create_ticket(p_id uuid,p_user uuid,p_email text,p_name text,p_role text,p_subject text,p_category text,p_body text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ticket public.support_tickets; initial text;
begin
 -- Serialize per-account rate limits and idempotent retries.
 perform id from auth.users where id=p_user for update;
 if not found then raise exception 'Account not found'; end if;
 select * into ticket from public.support_tickets where id=p_id;
 if found then
   select body into initial from public.support_messages where id=p_id and ticket_id=ticket.id;
   if ticket.user_id<>p_user or ticket.subject<>btrim(p_subject) or ticket.category<>p_category or initial is distinct from btrim(p_body) then raise exception 'Support request identifier already used'; end if;
   return to_jsonb(ticket);
 end if;
 if coalesce((select values->>'supportEnabled' from public.platform_settings where id=true),'true')='false' then raise exception 'New support requests are temporarily paused'; end if;
 if (select count(*) from public.support_tickets where user_id=p_user and created_at>now()-interval '1 hour')>=10 then raise exception 'Too many requests; please try again later'; end if;
 if p_id is null or p_subject is null or length(btrim(p_subject)) not between 3 and 200 or p_category is null
   or p_category not in ('Account','Payments','Applications','Store','Technical','Other') or p_body is null or length(btrim(p_body)) not between 1 and 5000
   or coalesce(btrim(p_email),'')='' or coalesce(btrim(p_name),'')='' or p_role not in ('Customer','Store Manager','Field Agent') then raise exception 'Provide valid support details'; end if;
 insert into public.support_tickets(id,user_id,email,name,role,subject,category) values(p_id,p_user,p_email,p_name,p_role,btrim(p_subject),p_category) returning * into ticket;
 insert into public.support_messages(id,ticket_id,sender,actor,body) values(p_id,p_id,'User',p_email,btrim(p_body));
 return to_jsonb(ticket);
end $$;

create or replace function public.support_update_ticket(p_ticket uuid,p_request uuid,p_user uuid,p_actor text,p_body text,p_revision integer,p_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ticket public.support_tickets; saved public.support_messages; sender_role text;
begin
 select * into ticket from public.support_tickets where id=p_ticket for update;
 if not found or (p_user is not null and ticket.user_id<>p_user) then raise exception 'Support request not found'; end if;
 sender_role:=case when p_user is null then 'Admin' else 'User' end;
 if coalesce(btrim(p_actor),'')='' or p_request is null then raise exception 'A sender and request identifier are required'; end if;
 if p_body is not null then
   select * into saved from public.support_messages where id=p_request;
   if found then
     if saved.ticket_id<>p_ticket or saved.actor<>p_actor or saved.sender<>sender_role or saved.body<>btrim(p_body) then raise exception 'Reply identifier already used'; end if;
     return to_jsonb(ticket);
   end if;
 end if;
 if p_revision is null or ticket.revision<>p_revision then raise exception 'Support request changed; refresh before replying'; end if;
 if p_user is not null and p_status is not null then raise exception 'Only administrators can change support status'; end if;
 if p_status is not null and p_status not in ('Open','In Progress','Resolved','Closed') then raise exception 'Choose a valid support status'; end if;
 if p_body is null and p_status is null then raise exception 'Provide a reply or status'; end if;
 if p_body is not null then
   if length(btrim(p_body)) not between 1 and 5000 then raise exception 'Enter a reply of 1-5000 characters'; end if;
   insert into public.support_messages(id,ticket_id,sender,actor,body) values(p_request,p_ticket,sender_role,p_actor,btrim(p_body));
 end if;
 update public.support_tickets set status=coalesce(p_status,case when p_user is not null then 'Open' when p_body is not null and status='Open' then 'In Progress' else status end),revision=revision+1,updated_at=now() where id=p_ticket returning * into ticket;
 if p_user is null then
   insert into public.platform_admin_events(action,actor,reference,message) values(case when p_body is null then 'Support status updated' else 'Support reply sent' end,p_actor,p_ticket::text,'Support request: '||ticket.status);
 end if;
 return to_jsonb(ticket);
end $$;
revoke execute on function public.admin_save_platform_settings(jsonb,integer,text),public.support_create_ticket(uuid,uuid,text,text,text,text,text,text),public.support_update_ticket(uuid,uuid,uuid,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.admin_save_platform_settings(jsonb,integer,text),public.support_create_ticket(uuid,uuid,text,text,text,text,text,text),public.support_update_ticket(uuid,uuid,uuid,text,text,integer,text) to service_role;
notify pgrst,'reload schema';
commit;

-- SOURCE: 015_customer_notifications.sql
-- Apply after migrations 001-014. Read markers belong to the authenticated customer.
begin;
create table if not exists public.customer_notification_reads (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 notification_key text not null check(length(notification_key) between 1 and 200),
 created_at timestamptz not null default now(),
 unique(user_id,notification_key)
);
alter table public.customer_notification_reads enable row level security;
revoke all on public.customer_notification_reads from public,anon,authenticated;
grant select,insert,update on public.customer_notification_reads to service_role;
-- Preserve customer reads recorded through the migration-014 compatibility path.
insert into public.customer_notification_reads(user_id,notification_key,created_at)
 select u.id,r.notification_key,r.read_at from public.admin_notification_reads r
 join auth.users u on r.actor='customer:'||u.id::text
 on conflict(user_id,notification_key) do nothing;
notify pgrst,'reload schema';
commit;

-- SOURCE: 016_performance_indexes.sql
-- Apply after the complete setup through migration 015.
-- Existing scope/date and unique indexes are retained; these cover additional
-- product filters, ordered catalogue pages, relation lookups and settlements.
-- Run before launch or during a quiet period: standard index builds lock writes.
begin;
set local lock_timeout = '10s';
create index if not exists products_store_status_created
 on public.store_products(store_id,status,created_at desc,id);
create index if not exists products_active_store_id
 on public.store_products(store_id,id) where status='Active';
create index if not exists products_active_store_stock
 on public.store_products(store_id,stock) where status='Active';
create index if not exists categories_store_id
 on public.store_categories(store_id,id);
create index if not exists trade_inventory_store_id
 on public.store_trade_inventory(store_id,id);
create index if not exists field_agents_store_id
 on public.store_field_agents(store_id,id);
create index if not exists applications_product
 on public.customer_applications(product_id);
create index if not exists payments_application_created
 on public.application_payments(application_id,created_at desc,id);
create index if not exists events_application_created
 on public.application_events(application_id,created_at desc,id);
create index if not exists settlement_items_settlement_id
 on public.agent_settlement_items(settlement_id,id);
create index if not exists support_tickets_user_id
 on public.support_tickets(user_id,id);
create index if not exists support_messages_ticket_order
 on public.support_messages(ticket_id,created_at,id);
commit;

-- SOURCE: 017_signup_sms.sql
-- Apply after 016. Codes are HMAC digests; passwords are never stored here.
begin;
create table if not exists public.signup_sms_challenges (
 id uuid primary key,
 phone text not null check(phone ~ '^233[235][0-9]{8}$'),
 email text not null,
 purpose text not null check(purpose in ('customer','store')),
 secret_hash text not null check(secret_hash ~ '^[0-9a-f]{64}$'),
 code_hash text check(code_hash ~ '^[0-9a-f]{64}$'),
 status text not null default 'Pending' check(status in ('Pending','Verified','Completed')),
 attempts integer not null default 0,
 send_count integer not null default 1,
 created_at timestamptz not null default now(),
 last_sent_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '10 minutes',
 verified_at timestamptz,
 completed_at timestamptz,
 user_id uuid references auth.users(id)
);
create index if not exists signup_sms_phone_created on public.signup_sms_challenges(phone,created_at desc);
create index if not exists signup_sms_email_created on public.signup_sms_challenges(email,created_at desc);
alter table public.signup_sms_challenges enable row level security;
revoke all on public.signup_sms_challenges from public,anon,authenticated;
grant select on public.signup_sms_challenges to service_role;

create or replace function public.signup_sms_begin(p_id uuid,p_phone text,p_email text,p_purpose text,p_secret text,p_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare row public.signup_sms_challenges;
begin
 perform pg_advisory_xact_lock(hashtextextended('signup-sms-phone:'||p_phone,0));
 perform pg_advisory_xact_lock(hashtextextended('signup-sms-email:'||p_email,0));
 if exists(select 1 from public.signup_sms_challenges where (phone=p_phone or email=p_email) and last_sent_at>now()-interval '60 seconds') then
   raise exception 'Wait 60 seconds before requesting another code';
 end if;
 if (select coalesce(sum(send_count),0) from public.signup_sms_challenges where (phone=p_phone or email=p_email) and last_sent_at>now()-interval '1 hour')>=5 then
   raise exception 'Too many SMS requests; try again in an hour';
 end if;
 -- Retain only recent unfinished verification attempts, limiting stored PII.
 delete from public.signup_sms_challenges where created_at<now()-interval '1 day' and status<>'Completed';
 insert into public.signup_sms_challenges(id,phone,email,purpose,secret_hash,code_hash)
 values(p_id,p_phone,p_email,p_purpose,p_secret,p_code) returning * into row;
 return to_jsonb(row);
end $$;

create or replace function public.signup_sms_resend(p_id uuid,p_secret text,p_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare row public.signup_sms_challenges; target_phone text; target_email text;
begin
 select phone,email into target_phone,target_email from public.signup_sms_challenges where id=p_id and secret_hash=p_secret;
 if not found then raise exception 'Start registration again to request a code'; end if;
 perform pg_advisory_xact_lock(hashtextextended('signup-sms-phone:'||target_phone,0));
 perform pg_advisory_xact_lock(hashtextextended('signup-sms-email:'||target_email,0));
 select * into row from public.signup_sms_challenges where id=p_id and secret_hash=p_secret for update;
 if row.status='Completed' or row.created_at<now()-interval '30 minutes' then raise exception 'Start registration again to request a code'; end if;
 if row.attempts>=5 then raise exception 'Too many incorrect codes; start registration again'; end if;
 if row.send_count>=4 then raise exception 'SMS resend limit reached; start registration again'; end if;
 if exists(select 1 from public.signup_sms_challenges where (phone=target_phone or email=target_email) and last_sent_at>now()-interval '60 seconds') then raise exception 'Wait 60 seconds before requesting another code'; end if;
 if (select coalesce(sum(send_count),0) from public.signup_sms_challenges where (phone=target_phone or email=target_email) and last_sent_at>now()-interval '1 hour')>=5 then raise exception 'Too many SMS requests; try again in an hour'; end if;
 update public.signup_sms_challenges set code_hash=p_code,status='Pending',verified_at=null,
   send_count=send_count+1,last_sent_at=now(),expires_at=least(now()+interval '10 minutes',created_at+interval '30 minutes')
   where id=p_id returning * into row;
 return to_jsonb(row);
end $$;

create or replace function public.signup_sms_verify(p_id uuid,p_secret text,p_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare row public.signup_sms_challenges;
begin
 select * into row from public.signup_sms_challenges where id=p_id and secret_hash=p_secret for update;
 if not found then return jsonb_build_object('verified',false,'error','Start registration again to request a code'); end if;
 if row.status='Completed' then return jsonb_build_object('verified',false,'error','This registration has already been completed'); end if;
 if row.expires_at<=now() then return jsonb_build_object('verified',false,'error','This code has expired. Request another code'); end if;
 if row.attempts>=5 then return jsonb_build_object('verified',false,'error','Too many incorrect codes; start registration again'); end if;
 if row.code_hash is distinct from p_code then
   update public.signup_sms_challenges set attempts=attempts+1 where id=p_id;
   return jsonb_build_object('verified',false,'error',case when row.attempts+1>=5 then 'Too many incorrect codes; start registration again' else 'Incorrect code. Please try again' end);
 end if;
 update public.signup_sms_challenges set status='Verified',verified_at=coalesce(verified_at,now()),
   expires_at=least(now()+interval '10 minutes',created_at+interval '30 minutes') where id=p_id;
 return jsonb_build_object('verified',true);
end $$;

create or replace function public.signup_sms_complete(p_id uuid,p_secret text,p_user uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare row public.signup_sms_challenges; metadata jsonb;
begin
 select * into row from public.signup_sms_challenges where id=p_id and secret_hash=p_secret for update;
 if not found then raise exception 'Verify your phone before completing registration'; end if;
 if row.status='Completed' and row.user_id=p_user then
   select raw_app_meta_data into metadata from auth.users where id=p_user;
   return metadata;
 end if;
 if row.status<>'Verified' or row.expires_at<=now() then raise exception 'Verify your phone before completing registration'; end if;
 select coalesce(raw_app_meta_data,'{}'::jsonb) into metadata from auth.users where id=p_user and lower(email)=row.email for update;
 if not found then raise exception 'Registration could not be completed. Try signing in instead'; end if;
 metadata:=metadata||jsonb_build_object('sms_verification_required',false,'sms_verification',jsonb_build_object('phone',row.phone,'verified_at',row.verified_at));
 update auth.users set raw_app_meta_data=metadata where id=p_user;
 update public.signup_sms_challenges set status='Completed',completed_at=now(),user_id=p_user,code_hash=null where id=p_id;
 return metadata;
end $$;

-- Existing accounts are preserved. New self-registered accounts must verify SMS,
-- including accounts created directly through Supabase's public signup endpoint.
create or replace function public.require_new_signup_sms() returns trigger
language plpgsql set search_path='' as $$
begin
 if coalesce(new.raw_app_meta_data->>'role','Customer')='Customer' then
   new.raw_app_meta_data:=coalesce(new.raw_app_meta_data,'{}'::jsonb)||jsonb_build_object('sms_verification_required',true);
 end if;
 return new;
end $$;
drop trigger if exists require_new_signup_sms on auth.users;
create trigger require_new_signup_sms before insert on auth.users for each row execute function public.require_new_signup_sms();
revoke execute on function public.require_new_signup_sms(),public.signup_sms_begin(uuid,text,text,text,text,text),public.signup_sms_resend(uuid,text,text),public.signup_sms_verify(uuid,text,text),public.signup_sms_complete(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.signup_sms_begin(uuid,text,text,text,text,text),public.signup_sms_resend(uuid,text,text),public.signup_sms_verify(uuid,text,text),public.signup_sms_complete(uuid,text,uuid) to service_role;
notify pgrst,'reload schema';
commit;

-- Successful setup returns each table name with its installed relation.
select name as required_table, to_regclass('public.' || name) as installed_table
from unnest(array['store_products','store_promotion_settings','store_categories','store_trade_inventory','store_field_agents','customer_applications','application_payments','application_events','purchase_ratings','site_pageviews','deleted_stores','deleted_store_products','store_admin_events','subscription_plans','subscription_orders','store_subscriptions','store_notification_reads','agent_settlements','agent_settlement_items','platform_settings','platform_admin_events','support_tickets','support_messages','admin_notification_reads','customer_notification_reads','signup_sms_challenges']) as name;

