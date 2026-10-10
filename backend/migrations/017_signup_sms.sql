-- Apply after 016. Codes are HMAC digests; passwords are never stored here.
begin;
create table if not exists public.signup_sms_challenges (
 id uuid primary key,
 phone text not null check(phone ~ '^233[235][0-9]{8}$'),
 email text not null,
 purpose text not null check(purpose in ('customer','store')),
 secret_hash text not null check(secret_hash ~ '^[0-9a-f]{64}$'),
 code_hash text check(code_hash ~ '^[0-9a-f]{64}$'),
 status text not null default 'Pending' check(status in ('Pending','Verified','Completed')),
 attempts integer not null default 0,
 send_count integer not null default 1,
 created_at timestamptz not null default now(),
 last_sent_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '10 minutes',
 verified_at timestamptz,
 completed_at timestamptz,
 user_id uuid references auth.users(id)
);
create index if not exists signup_sms_phone_created on public.signup_sms_challenges(phone,created_at desc);
create index if not exists signup_sms_email_created on public.signup_sms_challenges(email,created_at desc);
alter table public.signup_sms_challenges enable row level security;
revoke all on public.signup_sms_challenges from public,anon,authenticated;
grant select on public.signup_sms_challenges to service_role;

create or replace function public.signup_sms_begin(p_id uuid,p_phone text,p_email text,p_purpose text,p_secret text,p_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare row public.signup_sms_challenges;
begin
 perform pg_advisory_xact_lock(hashtextextended('signup-sms-phone:'||p_phone,0));
 perform pg_advisory_xact_lock(hashtextextended('signup-sms-email:'||p_email,0));
 if exists(select 1 from public.signup_sms_challenges where (phone=p_phone or email=p_email) and last_sent_at>now()-interval '60 seconds') then
   raise exception 'Wait 60 seconds before requesting another code';
 end if;
 if (select coalesce(sum(send_count),0) from public.signup_sms_challenges where (phone=p_phone or email=p_email) and last_sent_at>now()-interval '1 hour')>=5 then
   raise exception 'Too many SMS requests; try again in an hour';
 end if;
 -- Retain only recent unfinished verification attempts, limiting stored PII.
 delete from public.signup_sms_challenges where created_at<now()-interval '1 day' and status<>'Completed';
 insert into public.signup_sms_challenges(id,phone,email,purpose,secret_hash,code_hash)
 values(p_id,p_phone,p_email,p_purpose,p_secret,p_code) returning * into row;
 return to_jsonb(row);
end $$;

create or replace function public.signup_sms_resend(p_id uuid,p_secret text,p_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare row public.signup_sms_challenges; target_phone text; target_email text;
begin
 select phone,email into target_phone,target_email from public.signup_sms_challenges where id=p_id and secret_hash=p_secret;
 if not found then raise exception 'Start registration again to request a code'; end if;
 perform pg_advisory_xact_lock(hashtextextended('signup-sms-phone:'||target_phone,0));
 perform pg_advisory_xact_lock(hashtextextended('signup-sms-email:'||target_email,0));
 select * into row from public.signup_sms_challenges where id=p_id and secret_hash=p_secret for update;
 if row.status='Completed' or row.created_at<now()-interval '30 minutes' then raise exception 'Start registration again to request a code'; end if;
 if row.attempts>=5 then raise exception 'Too many incorrect codes; start registration again'; end if;
 if row.send_count>=4 then raise exception 'SMS resend limit reached; start registration again'; end if;
 if exists(select 1 from public.signup_sms_challenges where (phone=target_phone or email=target_email) and last_sent_at>now()-interval '60 seconds') then raise exception 'Wait 60 seconds before requesting another code'; end if;
 if (select coalesce(sum(send_count),0) from public.signup_sms_challenges where (phone=target_phone or email=target_email) and last_sent_at>now()-interval '1 hour')>=5 then raise exception 'Too many SMS requests; try again in an hour'; end if;
 update public.signup_sms_challenges set code_hash=p_code,status='Pending',verified_at=null,
   send_count=send_count+1,last_sent_at=now(),expires_at=least(now()+interval '10 minutes',created_at+interval '30 minutes')
   where id=p_id returning * into row;
 return to_jsonb(row);
end $$;

create or replace function public.signup_sms_verify(p_id uuid,p_secret text,p_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare row public.signup_sms_challenges;
begin
 select * into row from public.signup_sms_challenges where id=p_id and secret_hash=p_secret for update;
 if not found then return jsonb_build_object('verified',false,'error','Start registration again to request a code'); end if;
 if row.status='Completed' then return jsonb_build_object('verified',false,'error','This registration has already been completed'); end if;
 if row.expires_at<=now() then return jsonb_build_object('verified',false,'error','This code has expired. Request another code'); end if;
 if row.attempts>=5 then return jsonb_build_object('verified',false,'error','Too many incorrect codes; start registration again'); end if;
 if row.code_hash is distinct from p_code then
   update public.signup_sms_challenges set attempts=attempts+1 where id=p_id;
   return jsonb_build_object('verified',false,'error',case when row.attempts+1>=5 then 'Too many incorrect codes; start registration again' else 'Incorrect code. Please try again' end);
 end if;
 update public.signup_sms_challenges set status='Verified',verified_at=coalesce(verified_at,now()),
   expires_at=least(now()+interval '10 minutes',created_at+interval '30 minutes') where id=p_id;
 return jsonb_build_object('verified',true);
end $$;

create or replace function public.signup_sms_complete(p_id uuid,p_secret text,p_user uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare row public.signup_sms_challenges; metadata jsonb;
begin
 select * into row from public.signup_sms_challenges where id=p_id and secret_hash=p_secret for update;
 if not found then raise exception 'Verify your phone before completing registration'; end if;
 if row.status='Completed' and row.user_id=p_user then
   select raw_app_meta_data into metadata from auth.users where id=p_user;
   return metadata;
 end if;
 if row.status<>'Verified' or row.expires_at<=now() then raise exception 'Verify your phone before completing registration'; end if;
 select coalesce(raw_app_meta_data,'{}'::jsonb) into metadata from auth.users where id=p_user and lower(email)=row.email for update;
 if not found then raise exception 'Registration could not be completed. Try signing in instead'; end if;
 metadata:=metadata||jsonb_build_object('sms_verification_required',false,'sms_verification',jsonb_build_object('phone',row.phone,'verified_at',row.verified_at));
 update auth.users set raw_app_meta_data=metadata where id=p_user;
 update public.signup_sms_challenges set status='Completed',completed_at=now(),user_id=p_user,code_hash=null where id=p_id;
 return metadata;
end $$;

-- Existing accounts are preserved. New self-registered accounts must verify SMS,
-- including accounts created directly through Supabase's public signup endpoint.
create or replace function public.require_new_signup_sms() returns trigger
language plpgsql set search_path='' as $$
begin
 if coalesce(new.raw_app_meta_data->>'role','Customer')='Customer' then
   new.raw_app_meta_data:=coalesce(new.raw_app_meta_data,'{}'::jsonb)||jsonb_build_object('sms_verification_required',true);
 end if;
 return new;
end $$;
drop trigger if exists require_new_signup_sms on auth.users;
create trigger require_new_signup_sms before insert on auth.users for each row execute function public.require_new_signup_sms();
revoke execute on function public.require_new_signup_sms(),public.signup_sms_begin(uuid,text,text,text,text,text),public.signup_sms_resend(uuid,text,text),public.signup_sms_verify(uuid,text,text),public.signup_sms_complete(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.signup_sms_begin(uuid,text,text,text,text,text),public.signup_sms_resend(uuid,text,text),public.signup_sms_verify(uuid,text,text),public.signup_sms_complete(uuid,text,uuid) to service_role;
notify pgrst,'reload schema';
commit;
