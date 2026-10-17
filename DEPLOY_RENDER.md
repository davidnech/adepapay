# Deploy AdepaPay to Render

This repository deploys as **one Python 3 web service**: Gunicorn runs Flask, which
serves the built React frontend and `/api` from the same HTTPS origin. Cookies,
customer/store/admin navigation, and payment callbacks therefore use one domain.
The existing database remains in Supabase; no Render PostgreSQL service is needed.

## 1. Prepare Supabase

Before deployment, run `node scripts/check-public-assets.mjs`. Images under
`public` must be real images, not Git LFS pointer text. If it lists missing
assets, restore the original images from a backup into those exact paths.
The Git attributes now store public assets in ordinary Git, avoiding a separate
LFS upload. Commit restored files along with `.gitattributes`. The local
`Updatesand fixes` planning folder is excluded from Git and the Docker context.
Ignoring files in Docker alone does not fix a failing Git checkout.

The October 2026 asset repair recovered the existing AdepaPay brand PNG embedded
in the intact favicon SVG. The website and touch/manifest icons use that mark;
the missing phone images were replaced by `payment-options-phone.svg`. Old LFS
pointer files were removed. The lost original phone graphics can be restored
later if available; the current build does not need them.

For an existing database with setup through migration 015, run
`backend/migrations/016_performance_indexes.sql` in the Supabase SQL Editor.
Then run `backend/migrations/017_signup_sms.sql` for SMS verification.
For a new database, run `backend/setup_database.sql`, which includes 001–017.
Back up the database before running the full setup against an existing project.

Migration 016 adds twelve indexes for product status/stock filters, public
catalogue pagination, category/agent/trade inventory pages, application relations,
payment/event histories, settlements, and support queries. It retains the
existing customer/store date indexes and unique constraints. It is safe to rerun.
Standard index creation briefly blocks writes, so apply before launch or during
a quiet period; if the 10-second lock timeout is reached, retry later. The SQL
must succeed before the indexes can improve queries. No live database changes
are performed by the build or application startup.

Indexes do not accelerate records filtered in Python after fetching all rows or
Supabase Auth user listings. Large admin reports/search still need server-side
pagination/aggregation as the dataset grows.

## 2. Create the service

Commit the deployment files and application source to your Git repository,
including `package-lock.json`, `public`, and `.figma/make/site.json`.
In Render, choose **New → Blueprint**, connect that repository, and select
`render.yaml` at the repository root. It defines a free Python web service with
`/healthz` as its health check. Select a paid instance in Render if needed for
your production availability and capacity requirements.

For manual setup, select **Python 3**, branch `main`, leave Root Directory blank,
and enter:

| Field | Value |
| --- | --- |
| Build Command | `pip install -r requirements.txt && npm ci --include=dev && npm run build` |
| Start Command | `gunicorn --config gunicorn.conf.py backend.wsgi:app` |
| Health Check Path | `/healthz` |

The repository pins Python 3.13 and Node 22 in `.python-version` and
`.node-version`. Render's native Python runtime includes Node/npm, so the same
build installs Python dependencies and compiles React. Render supplies `PORT`;
Gunicorn binds `0.0.0.0` on that port.

To switch an existing Docker service, open **Settings → Build → Source → Edit**,
choose the same repository, set runtime to **Python 3**, enter the commands above,
and deploy. For a Blueprint-managed service, push the updated `render.yaml` and
sync the Blueprint. Keep the existing environment variables, correcting
`APP_ORIGIN` to the actual public HTTPS URL before redeploying.

## 3. Set environment variables

Use `render.env.example` as a reference and enter actual values in Render's
Environment settings. The local `.env` remains private and is not committed.

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | Your existing Supabase project URL |
| `SUPABASE_KEY` | Its publishable/anon authentication key |
| `SUPABASE_SECRET_KEY` | Its server-only secret/service-role key |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Your administrator credentials |
| `FLASK_SECRET_KEY` | Stable random secret; the Blueprint generates it |
| `APP_ORIGIN` | `https://adepapay.com` on production; actual HTTPS origin on previews; no path |
| `SEO_INDEXING` | `true` only on production after the custom domain works; `false` on previews |
| `GOOGLE_SITE_VERIFICATION` | Optional actual URL-prefix verification token; domain verification uses DNS instead |
| `COOKIE_SECURE` | `true` |
| `VIRESEND_API_KEY` | Server-only VireSend key; required for new registrations |
| `CF_ACCOUNT_ID`, `CF_IMAGES_TOKEN`, `CF_HASH` | Existing Cloudflare Images upload/delivery configuration |
| `CF_IMAGES_VARIANT` | Existing delivery variant, normally `public` |
| `CF_IMAGES_RESPONSIVE` | `true` only after enabling Flexible variants in Cloudflare Images; otherwise `false` |
| `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY` | Matching Paystack keys; required for subscription checkout |

If you use a custom domain, update `APP_ORIGIN` to that domain and use it for
the app. Startup validates required variables and the built frontend; missing
configuration appears in Render logs by variable name without exposing secrets.
Cloudflare image uploads and Paystack checkout require their own valid credentials.
Never prefix server secrets with `VITE_`.

Public pages are rendered by Flask using fresh catalogue data before React
hydrates them. Vite preview alone serves the private SPA shell and does not
exercise production SEO. See `SEO_IMPLEMENTATION.md` for route coverage,
verification results, sitemap behavior and Google Search Console instructions.
Do not cache public HTML at a proxy: price and stock updates rely on `no-store`.

If startup reports an invalid `APP_ORIGIN`, enter only the exact public site URL,
such as `https://adepapay.onrender.com`. Use the URL assigned to your service.
Do not use localhost, include quotes, or append `/api`, `/login`, or another page
path. `COOKIE_SECURE` must be `true`. A runtime switch does not fix invalid
environment variables.

Set Supabase Authentication's **Site URL** to your deployed HTTPS URL. Preserve
your current email provider/confirmation configuration until the application
supports any changed verification flow. If enabling Paystack, configure its
webhook to `https://your-domain/api/paystack/webhook`
and use the matching environment's keys.

## 4. Verify the deployed app

Check `/healthz` returns `{"status":"ok"}`. This verifies the process and built
frontend, without issuing a database query on every health probe. Then verify:

- Home page images and direct page refreshes load.
- Admin, store, and customer logins work and retain their sessions.
- Products, applications, notifications, search, and reports load real records.
- Uploads and subscription checkout work with their configured providers.
- Customer and store signups require an SMS code and receive a welcome SMS from Adepapay.

Built `/assets/` files receive one-year immutable browser caching. HTML is
revalidated so deployments load new asset filenames; API responses remain
`no-store` so authenticated business data is not cached.

Use a real HTTPS origin for `APP_ORIGIN`; local plain-HTTP login cannot retain
production secure cookies. Windows development continues to use Vite and
`python -m backend.app`; Gunicorn runs on Render's Linux Python runtime.
The Dockerfile remains available as an alternative but is unused by the Python
service configuration.

Official references: [Render Flask deployment](https://render.com/docs/deploy-flask),
[changing runtimes](https://render.com/docs/native-runtimes#changing-a-services-runtime),
[Blueprint configuration](https://render.com/docs/blueprint-spec),
and [Flask with Gunicorn](https://flask.palletsprojects.com/en/stable/deploying/gunicorn/).

## SMS verification

Apply migration 017, set `VIRESEND_API_KEY`, and restart/redeploy the backend.
The sender calls `https://viresender.com/v1/sms/send` directly. The documented
`www.viresender.com` host redirects to this canonical host; the previous sender
rejected that redirect before delivery. A read-only balance check confirmed
the canonical host accepts the locally configured key. This does not prove
SMS delivery or confirm the separate Render environment configuration.
Use `backend/check_signup_sms.sql` for read-only schema/permission checks and
`SMS_SETUP.md` for troubleshooting. Webhook configuration is not required for
the implemented code-entry verification flow.
The sender ID is fixed to `Adepapay`. Codes expire after ten minutes, with a
60-second resend cooldown, five incorrect attempts, up to three resends per
challenge, and five sends per phone/email per hour. Challenges last at most
30 minutes and store keyed hashes. Keep `FLASK_SECRET_KEY` stable across workers
and restarts. No SMS key, password or plaintext verification code is stored in
the challenge table or exposed to the browser.

Existing accounts retain access. New Supabase accounts require trusted SMS
verification before portal APIs permit access. Store verification still leaves
the application pending admin approval. Supabase email confirmation settings
apply independently. A failed welcome SMS does not undo successful registration.
Configure shared auth rate limiting at the proxy in addition to these limits.
