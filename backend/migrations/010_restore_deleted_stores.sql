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
