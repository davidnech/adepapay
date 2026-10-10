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
