create table if not exists public.purchase_ratings (
 application_id uuid primary key references public.customer_applications(id),
 customer_id uuid not null references auth.users(id),
 store_id uuid not null references auth.users(id),
 product_id uuid not null references public.store_products(id),
 store_score integer not null check(store_score between 1 and 5),
 product_score integer not null check(product_score between 1 and 5),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists ratings_store on public.purchase_ratings(store_id);
create index if not exists ratings_product on public.purchase_ratings(product_id);
create or replace function public.save_purchase_rating(p_application uuid,p_customer uuid,p_store_score integer,p_product_score integer)
returns jsonb language plpgsql set search_path=public as $$
declare a public.customer_applications; r public.purchase_ratings;
begin
 select * into a from public.customer_applications where id=p_application and customer_id=p_customer and status='Completed';
 if not found then raise exception 'Only your completed purchases can be rated'; end if;
 insert into public.purchase_ratings(application_id,customer_id,store_id,product_id,store_score,product_score)
 values(a.id,a.customer_id,a.store_id,a.product_id,p_store_score,p_product_score)
 on conflict(application_id) do update set store_score=excluded.store_score,product_score=excluded.product_score,updated_at=now()
 returning * into r;
 return to_jsonb(r);
end $$;
create or replace function public.public_rating_summary()
returns jsonb language sql stable set search_path=public as $$
 select jsonb_build_object(
 'stores',coalesce((select jsonb_agg(x) from (select store_id as id,round(avg(store_score),2) as rating,count(*) as count from purchase_ratings group by store_id) x),'[]'::jsonb),
 'products',coalesce((select jsonb_agg(x) from (select product_id as id,round(avg(product_score),2) as rating,count(*) as count from purchase_ratings group by product_id) x),'[]'::jsonb));
$$;
create table if not exists public.site_pageviews (
 id uuid primary key,
 visitor_hash text not null check(length(visitor_hash)=64),
 page text not null check(page in ('home','services','browse-stores','store-details','browse-products','register','store-registration','login','forgot-password','info')),
 device text not null check(device in ('Mobile','Tablet','Desktop')),
 source text not null check(length(source)<=253),
 created_at timestamptz not null default now()
);
create index if not exists pageviews_created on public.site_pageviews(created_at);
create index if not exists pageviews_visitor_created on public.site_pageviews(visitor_hash,created_at);
create or replace function public.record_site_pageview(p_id uuid,p_visitor text,p_page text,p_device text,p_source text)
returns boolean language plpgsql set search_path=public as $$
begin
 -- Bound repeated collection from an individual browser; no IP or account data.
 perform pg_advisory_xact_lock(hashtextextended(p_visitor,0));
 if (select count(*) from site_pageviews where visitor_hash=p_visitor and created_at>now()-interval '1 minute')>=30 then return false; end if;
 insert into site_pageviews(id,visitor_hash,page,device,source) values(p_id,p_visitor,p_page,p_device,p_source) on conflict(id) do nothing;
 delete from site_pageviews where created_at<now()-interval '90 days';
 return true;
end $$;
create or replace function public.site_traffic_summary(p_days integer)
returns jsonb language plpgsql stable set search_path=public as $$
declare since timestamptz;
begin
 if p_days not in (7,30,90) then raise exception 'Choose 7, 30 or 90 days'; end if;
 since:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'-make_interval(days=>p_days-1);
 return jsonb_build_object(
 'pageviews',(select count(*) from site_pageviews where created_at>=since),
 'visitors',(select count(distinct visitor_hash) from site_pageviews where created_at>=since),
 'pages',coalesce((select jsonb_agg(x) from (select page as label,count(*) as count from site_pageviews where created_at>=since group by page order by count(*) desc,page) x),'[]'::jsonb),
 'devices',coalesce((select jsonb_agg(x) from (select device as label,count(*) as count from site_pageviews where created_at>=since group by device order by count(*) desc,device) x),'[]'::jsonb),
 'sources',coalesce((select jsonb_agg(x) from (select source as label,count(*) as count from site_pageviews where created_at>=since group by source order by count(*) desc,source limit 20) x),'[]'::jsonb),
 'daily',coalesce((select jsonb_agg(x) from (select to_char(day,'YYYY-MM-DD') as date,(select count(*) from site_pageviews where created_at>=day and created_at<day+interval '1 day') as views from generate_series(since,date_trunc('day',now() at time zone 'UTC') at time zone 'UTC',interval '1 day') day order by day) x),'[]'::jsonb));
end $$;
alter table public.purchase_ratings enable row level security;
alter table public.site_pageviews enable row level security;
revoke all on public.purchase_ratings,public.site_pageviews from public,anon,authenticated;
grant select,insert,update on public.purchase_ratings to service_role;
grant select,insert,delete on public.site_pageviews to service_role;
revoke execute on function public.save_purchase_rating(uuid,uuid,integer,integer),public.public_rating_summary(),public.record_site_pageview(uuid,text,text,text,text),public.site_traffic_summary(integer) from public,anon,authenticated;
grant execute on function public.save_purchase_rating(uuid,uuid,integer,integer),public.public_rating_summary(),public.record_site_pageview(uuid,text,text,text,text),public.site_traffic_summary(integer) to service_role;
