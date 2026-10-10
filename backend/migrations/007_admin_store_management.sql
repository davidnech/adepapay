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
