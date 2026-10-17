# Signup SMS configuration and recovery

Checked 17 October 2026. The documented `https://www.viresender.com` API redirects
to `https://viresender.com`. A credential-free OPTIONS request to `/v1/sms/send`
returned 307; the www balance endpoint returned 301. The previous sender used
www and called `raise_for_status()`, which rejects redirects. It never followed
the redirect to the SMS handler. The sender now calls the verified canonical
HTTPS endpoint directly, preserving POST and its Bearer authentication.

Read-only checks with the project-root local configuration confirmed:

- VireSend canonical balance endpoint: HTTP 200, success true.
- Supabase SMS challenge table: accessible with the backend key.
- All four signup SMS functions: present in the database API schema.
- Local SMS key, Supabase keys and Flask secret: present.

No live SMS was sent and no database records were changed by those checks.
The local checks do not inspect Render's environment or prove carrier delivery.

## SQL

In the correct Supabase project's SQL Editor run `backend/check_signup_sms.sql`.
It checks table existence, RLS, the four function permissions and the signup
trigger. It displays only aggregate recent statuses, without phone numbers,
emails or code/secret hashes. Expected permissions: service_role can execute;
anon/authenticated cannot. The trigger should be enabled (`O`).

If anything is missing, execute the complete contents of
`backend/migrations/017_signup_sms.sql` in the SQL Editor after migrations
001–016. Migration 017 is repeatable and retains existing accounts/challenges.
Do not rerun the full setup just to fix this endpoint change. To request a
schema-cache refresh separately:

```sql
notify pgrst, 'reload schema';
```

Do not disable RLS, grant OTP functions to browser roles, remove verification
markers or delete all challenges to work around delivery failures.

## Environment

Use existing real values in the project-root `.env` for local development,
and separately in Render → service → Environment for the hosted site:

```dotenv
VIRESEND_API_KEY=your_real_viresend_api_key
FLASK_SECRET_KEY=your_existing_stable_flask_secret
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_publishable_or_anon_key
SUPABASE_SECRET_KEY=your_supabase_secret_or_service_role_key
APP_ORIGIN=https://adepapay.com
COOKIE_SECURE=true
```

Keep an existing stable Flask secret; all workers must share it. Changing it
invalidates pending verification cookies/code digests. Keep credentials on the
server, without `VITE_` prefixes. The SMS key is the raw key: do not include
the word `Bearer`. The code adds that prefix. The sender ID is fixed to
`Adepapay`; no sender-ID environment variable is read. No SMS base URL variable
or delivery webhook is required by the current integration. A delivery callback
is separate from a customer entering their six-digit verification code.

For local HTTP development, use the local frontend origin in APP_ORIGIN and
`COOKIE_SECURE=false`. Use true with production HTTPS. Restart the Python
backend after editing `.env`; redeploy the changed code and save/restart Render
after editing its environment. A frontend-only restart does not reload Flask.

## Retest

1. Deploy the changed backend. Begin customer or store registration with a
   Ghanaian mobile number such as the user's own `024…`, `+23324…` or `23324…`.
2. If an earlier request is open, wait 60 seconds and use Resend code. Returning
   to the same pending registration does not automatically send another SMS.
3. Enter the latest six-digit code. Codes expire after ten minutes; a resend
   invalidates the preceding code. Five incorrect attempts lock the challenge;
   resends and the per-phone/email hourly quota also apply.
4. Registration completes only after verification. Stores still require admin
   approval. A welcome SMS is attempted after successful registration.
5. Check VireSend's send logs and Render logs. The updated sender reports safe
   HTTP status messages for redirects, authentication failures, wallet errors,
   provider rate limiting and other rejected requests. It never logs OTPs,
   phone numbers, authorization headers or provider response bodies.

If no send request appears after the deployment, check the browser's response
to `/api/auth/signup` or `/api/auth/store-signup`: invalid form data, missing
server settings, missing database schema or database rate limits can stop the
request before VireSend is contacted. If VireSend accepts a send but it does
not arrive, investigate that SMS ID, recipient routing, sender-ID eligibility
and wallet status with the provider. A successful API response is not proof
that the carrier delivered it.

Validation: 14 focused Python SMS tests pass, including canonical endpoint,
headers, customer/store OTP handshakes, safe provider errors and welcome-SMS
failure behavior. The isolated PostgreSQL SMS test checks migration replay,
permissions, expiry, cooldowns, attempts, binding and completion atomicity.
