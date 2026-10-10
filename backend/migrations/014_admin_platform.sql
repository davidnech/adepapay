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
