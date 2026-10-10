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
