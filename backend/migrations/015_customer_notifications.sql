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
