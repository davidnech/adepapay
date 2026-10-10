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
