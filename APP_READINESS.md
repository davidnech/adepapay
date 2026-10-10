# App verification — 10 October 2026

The active public pages and customer, store and admin workspaces were audited
against their backend routes. Informational pages contain explanatory copy;
catalogues, accounts, purchases, reports and notifications load backend records.

## Checks completed

| Check | Result and scope |
| --- | --- |
| TypeScript | Full project `tsc --noEmit` passed |
| Production build | Vite build passed |
| Backend | 221 tests passed, with isolated Supabase doubles |
| Database/navigation | Ten suites passed, including real PostgreSQL RPC execution in PGlite |
| Live public/admin | 26 read endpoints returned HTTP 200; administrator login used configured credentials |
| Live customer/store | 28 read endpoints returned HTTP 200 against existing Supabase records; only the local authentication lookup was substituted |
| Browser | 72 page checks passed: 15 public pages/views, 16 customer routes, 21 store routes, 20 admin routes |

Browser checks used the production bundle in Microsoft Edge and responses
captured from real Flask endpoints with isolated test databases. They checked
rendering without JavaScript exceptions, backend request coverage, public
catalogue search, portal search, notification buttons, mobile portal navigation
and public navigation at tablet width. They did not use customer/store passwords.

Database tests exercise permissions, account/store isolation, application
submission and review, all supported purchase types, negotiated customer prices,
stock reservation and return, payment idempotency, handover, verified ratings,
subscriptions, settlements, support ownership, notification markers, stale
revisions, atomic delete/restore and preserved purchase references.

SMS signup was additionally checked in Edge for both customer and store forms,
using the real Flask registration endpoints with isolated Auth/database/SMS
providers. Both flows reject an incorrect code, accept the correct code, preserve
the original signup details and display registration success; store approval
remains pending. No live account was created and no SMS was sent by these tests.

## Connected page coverage

| Area | Connected features |
| --- | --- |
| Public | Featured stores/products, browse/filter/search, store/product details, customer registration, store applications and login |
| Customer | Dashboard, stores/products, applications, swaps, hire purchase/layaway, purchases, plans, payment history, receipts, profile/settings, notifications and support |
| Store | Dashboard, subscriptions, profile/settings, staff access, rules, products/prices/categories, promotions, customers, applications, swaps/trade inventory, purchases, layaway, agents/accounts, payments, reports, notifications and support |
| Admin | Traffic, dashboard, store approvals/directory/restoration, subscriptions, customers, products, categories, applications, swaps, purchases, layaway, agents/settlements, transactions, reports, notifications, settings, audit logs and support |

The audit removed unused demo portal implementations and the fallback demo store
identifier. It fixed TypeScript errors, public navigation at tablet widths,
mobile navigation labels and nested billing-page landmarks. Missing migration
files 001–014 were restored from the combined setup. A stale subscription test's
expected table count was updated to the current 26-table schema.

Customer and store signups now require real VireSend SMS verification, with
sender ID `Adepapay`, persistent hashed challenges, expiry, resend and attempt
limits, and a welcome SMS after registration. Existing accounts retain access.
Social login and password recovery are not exposed as working features. Customer
purchase payments are recorded after authorized staff confirm receipt; they
do not automatically debit a customer's account. Paystack checkout is for store
subscriptions.

## Before publishing

1. Apply `backend/migrations/015_customer_notifications.sql` and then
   `016_performance_indexes.sql` in Supabase if not already applied. The live
   audit found the dedicated migration-015 table missing; customer notifications
   currently work through the tested migration-014 compatibility storage.
   Apply `017_signup_sms.sql` and configure `VIRESEND_API_KEY` before accepting
   new registrations. SMS tests use isolated providers; no live SMS was sent.
2. Follow `DEPLOY_RENDER.md`, enter production environment variables and set
   `APP_ORIGIN` to the exact HTTPS domain. The live database indexes were not
   changed by this audit.
3. Paystack was configured in test mode during the audit. Configure matching
   live keys and the webhook for real subscription payments. Image credentials
   were present, but no live files were uploaded or real payments charged.
4. After deployment, check `/healthz`, log in with an actual account for each
   role, and verify secure cookies, an upload and the intended payment flow.
   Docker/Render runtime execution was not available in this Windows workspace.

## Repeatable local checks

From the repository root, install dependencies, then run:

```sh
python -m pip install -r requirements.txt
npm ci
npm run check
```

`npm run check` runs TypeScript, the production build, Python backend tests and
all isolated database/navigation suites. It does not modify the live database.
The browser and live read audit above were additional checks, not part of this
command. Passing checks establish the stated coverage, rather than guaranteeing
every possible production interaction.
