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
