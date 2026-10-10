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
