-- Read-only checks. Run in the Supabase SQL Editor for the app's project.
-- No phone numbers, emails, OTP digests or browser secrets are selected.
select to_regclass('public.signup_sms_challenges') as sms_table;

select proname as function_name, prosecdef as security_definer,
       has_function_privilege('service_role',p.oid,'EXECUTE') as service_can_execute,
       has_function_privilege('anon',p.oid,'EXECUTE') as anon_can_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') as signed_in_can_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and proname in
 ('signup_sms_begin','signup_sms_resend','signup_sms_verify','signup_sms_complete')
order by proname;
-- Expected: four rows, security_definer/service=true, anon/signed_in=false.

select relrowsecurity as row_level_security
from pg_class where oid=to_regclass('public.signup_sms_challenges');
-- Expected: true.

select tgname,tgenabled
from pg_trigger
where tgrelid='auth.users'::regclass and tgname='require_new_signup_sms';
-- Expected: one row, tgenabled='O' (enabled).

select status,count(*) as challenges,max(last_sent_at) as most_recent_request
from public.signup_sms_challenges
where created_at>now()-interval '24 hours'
group by status;
-- Pending means requested but not verified; it is not proof of SMS delivery.
