# Deploy AdepaPay to Render

This repository deploys as **one Docker web service**: Gunicorn runs Flask, which
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
are performed by the Docker build or application startup.

Indexes do not accelerate records filtered in Python after fetching all rows or
Supabase Auth user listings. Large admin reports/search still need server-side
pagination/aggregation as the dataset grows.

## 2. Create the service

Commit the deployment files and application source to your Git repository,
including `package-lock.json`, `public`, and `.figma/make/site.json`.
In Render, choose **New → Blueprint**, connect that repository, and select
`render.yaml` at the repository root. It defines a free Docker web service with
`/healthz` as its health check. Select a paid instance in Render if needed for
your production availability and capacity requirements.

Alternatively create a **Web Service**, select **Docker**, use root directory
`.` and Dockerfile path `./Dockerfile`, and set health check `/healthz`. Leave the
Docker Command empty so the image's Gunicorn command is used. Render supplies
`PORT`; Gunicorn binds `0.0.0.0` on that port. Do not run `npm run dev` or
`python backend/app.py` as the production start command.

## 3. Set environment variables

Use `.env.render.example` as a reference and enter actual values in Render's
Environment settings. The local `.env` is excluded from the Docker image.

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | Your existing Supabase project URL |
| `SUPABASE_KEY` | Its publishable/anon authentication key |
| `SUPABASE_SECRET_KEY` | Its server-only secret/service-role key |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Your administrator credentials |
| `FLASK_SECRET_KEY` | Stable random secret; the Blueprint generates it |
| `APP_ORIGIN` | Exact public HTTPS origin, e.g. `https://adepapay.onrender.com`; no path |
| `COOKIE_SECURE` | `true` |
| `VIRESEND_API_KEY` | Server-only VireSend key; required for new registrations |
| `CF_ACCOUNT_ID`, `CF_IMAGES_TOKEN`, `CF_HASH` | Existing Cloudflare Images upload/delivery configuration |
| `CF_IMAGES_VARIANT` | Existing delivery variant, normally `public` |
| `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY` | Matching Paystack keys; required for subscription checkout |

If you use a custom domain, update `APP_ORIGIN` to that domain and use it for
the app. Startup validates required variables and the built frontend; missing
configuration appears in Render logs by variable name without exposing secrets.
Cloudflare image uploads and Paystack checkout require their own valid credentials.
Never prefix server secrets with `VITE_`.

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

For a local Docker production check, fill a private environment file with the
variables above and run:

```sh
docker build -t adepapay .
docker run --rm -p 10000:10000 --env-file .env.render.local adepapay
```

Use a real HTTPS origin for `APP_ORIGIN`; local plain-HTTP login cannot retain
production secure cookies. Windows development continues to use Vite and
`python -m backend.app`; Gunicorn runs inside the Linux image.

Official references: [Render Docker deployment](https://render.com/docs/docker),
[Blueprint configuration](https://render.com/docs/blueprint-spec),
and [Flask with Gunicorn](https://flask.palletsprojects.com/en/stable/deploying/gunicorn/).

## SMS verification

Apply migration 017, set `VIRESEND_API_KEY`, and restart/redeploy the backend.
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
