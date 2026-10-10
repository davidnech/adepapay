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
