# Render deployment

See [DEPLOY_RENDER.md](../DEPLOY_RENDER.md) for the production Docker service, environment variables, and index migration, and [APP_READINESS.md](../APP_READINESS.md) for verification coverage. Install Python dependencies with `python -m pip install -r requirements.txt` from the repository root. Run `npm run check` for the complete local check suite.

# Supabase authentication

## First-time database setup / missing-table errors

If Products reports that its table is not installed, or the store dashboard reports missing application tables, open **`backend/setup_database.sql`**, copy the entire file, and run it in **Supabase → SQL Editor → New query**. Select the same project used by `SUPABASE_URL` in the root `.env`. This combined setup includes migrations 001-017; do not also run them individually for this setup. Existing business records are retained, while migration 003 may normalize existing product category labels. The final result lists twenty-six tables with non-null `installed_table` values. If SQL reports an error, resolve that error before refreshing the application; each migration rolls back on failure; earlier migrations may already have committed.

Restart the Python backend after successful setup and refresh the app. Authentication uses Supabase's existing Auth schema, so login can work even when these application tables have never been created. A Supabase API key cannot execute this SQL; the current environment does not contain a direct database connection or management credential for applying it automatically. The combined file was validated in isolated PostgreSQL both on an empty schema and on a second run.

Run from the repository root:

```powershell
python -m pip install -r backend/requirements.txt
python -m backend.app
```

Vite forwards `/api` to `http://127.0.0.1:5000`. Keep the backend running alongside the frontend. Restart an existing Vite process if it has not loaded the new proxy configuration.

The root `.env` must contain `SUPABASE_URL` and `SUPABASE_KEY`. Prefer a Supabase publishable/anon key for these user authentication routes. Keys stay on the Python server; never add privileged keys to VITE-prefixed variables.

In Supabase Authentication, enable Email and set the Site URL to the app's actual URL (for local development, usually http://localhost:8443). Email confirmation remains independent of phone verification: when enabled, users must also follow their Supabase confirmation email.

New customer and store registrations require SMS verification. Apply `backend/migrations/017_signup_sms.sql`, add `VIRESEND_API_KEY` and a stable `FLASK_SECRET_KEY` to the root `.env`, then restart the backend. Messages use sender ID `Adepapay`. The account is created only after the six-digit code is verified; a welcome SMS follows registration. Store applications still require admin approval. Existing accounts retain access. Missing SMS configuration prevents new registrations with a clear error.

Challenges persist across workers and restarts, with keyed code hashes, ten-minute expiry, five incorrect attempts, a 60-second resend cooldown, and at most three resends per challenge. Each phone/email can request at most five SMS sends per hour.

Accounts are created in Supabase Authentication > Users (`auth.users`). Registration profile fields are stored in user metadata. Passwords are handled by Supabase Auth and never copied to a public table. User metadata is user-editable and must not be used for authorization or verified KYC.

New users receive the Customer role. Elevated roles are read only from trusted `app_metadata.role`, set administratively on the server, never from the signup request or browser storage. The active customer, store, admin and field-agent workspaces use backend authorization; see APP_READINESS.md for the current verification coverage.

Access and refresh tokens use HttpOnly, SameSite=Lax cookies. Remember me persists cookies for 30 days; otherwise they are browser-session cookies. Sessions are checked on load, focus, and every minute while signed in. Logout revokes the current Supabase session and clears cookies. Password recovery and social/phone login are outside this first release.

For production, serve the Python API under the same origin at `/api`, use HTTPS, set `COOKIE_SECURE=true` and `APP_ORIGIN=https://your-app-domain`, and use a production WSGI server. The Vite development proxy is not part of the production bundle. Apply shared rate limiting to auth routes at the reverse proxy in addition to Supabase's own limits.

Tests (mock Supabase, create no real users):

```powershell
python -m unittest backend.test_auth -v
npm.cmd run build
```

Manual acceptance: register with nationality fixed to Ghana and gender Male or Female, verify the SMS code, confirm the welcome message, sign in (after email confirmation if enabled), reload, and log out. Check that incorrect passwords cannot enter the portal. If an existing account still reports email_not_confirmed after the project setting is changed, confirm that specific existing user with Supabase administrative access; do not bypass password authentication in the application.

## Environment-based administrator

Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and a random `FLASK_SECRET_KEY` in the root `.env`. Restart the Python backend after changing these values. Use the normal login form; matching admin credentials open the Admin portal. The reserved admin email cannot register as a customer.

This administrator is authenticated by the backend environment, not by Supabase Auth. Its signed HttpOnly session supports remember me, reload, and logout. Changing the admin credentials or signing secret invalidates existing admin sessions. Customer authentication continues to use Supabase. Keep `.env` untracked and use a strong admin password before deployment.

Future protected admin APIs must validate this backend session; it is not a Supabase JWT and cannot be used directly for database RLS.

## Store registration

Customer signup links to the existing store application form. `POST /api/auth/store-signup` creates a Supabase Auth user with the application fields under `user_metadata.store_application`. The password goes only to Supabase Auth. No password or application is written to browser storage. The success response supplies a server-generated reference when Supabase returns a session.

Applicants can use the regular login form and see a pending-approval page across reloads. An application does not grant the Store Manager role: only trusted `app_metadata` can grant elevated roles. User-editable application fields never determine approval. The application is stored in Auth metadata for this registration phase, not a separate stores table. The admin Store Approvals page now reads these accounts through the backend and writes decisions to trusted app_metadata.store_review. Approval also assigns the Store Manager role and a stable store_id equal to the owner account UUID.

The email-confirmation setting is shared with customer registration. With Confirm email off, store applicants can sign in immediately. Existing customer accounts are not converted or overwritten; they should sign in rather than register again with the same email.

Manual check: open customer signup, choose Register as a store, enter business details, confirm the password, accept the terms, and submit. Sign in with the new credentials and verify the pending application reference survives reload, then sign out.

## Admin store approvals

Add `SUPABASE_SECRET_KEY` (a Supabase secret key, or use `SUPABASE_SERVICE_ROLE_KEY` for a legacy service_role key) to the root `.env` and restart the backend. Do not use a VITE-prefixed variable. The publishable key cannot list accounts or grant roles. Use the environment administrator login to access Store Approvals.

The page reads the existing Supabase Auth database records; no separate SQL migration is needed. It paginates accounts in batches of 50 and shows store applicants from each batch. Search and status filters operate on the current batch; continue with Next if a batch contains no applicants. Refresh fetches current database state.

Review shows the submitted details. Approval persists a reviewed snapshot, Approved status, reviewer, UTC decision time, Store Manager role, and stable store_id in one Auth Admin update. Rejection requires a reason and persists Rejected status with the Customer role. Decisions are final on this page. User-editable metadata cannot approve an account or overwrite the reviewed snapshot. Already-reviewed and stale requests are rejected. A process-local lock serializes decisions in the current single-process backend; a multi-worker deployment needs transactional review storage for cross-worker concurrency guarantees.

Existing sessions pick up the new role/status during the app's periodic or focus-triggered session check, or immediately on a fresh login. Approved managers open the existing store portal using the returned store ID; its other business data and workflows still require separate database integration. Email notifications, document uploads, and store suspension are not implemented by this approval change.

Validation: `python -m unittest backend.test_auth backend.test_store_approvals -q`.

## Store profile and reusable Cloudflare images

Store Profile now loads the signed-in approved owner's data from Supabase Auth. Contact, location, operating hours, description, public name, logo, and cover edits persist under trusted `app_metadata.store_profile`. Reviewed registration details, account email, role, and store ID remain read-only. Document verification displays Verified temporarily as requested; this does not represent an automated document review. No new SQL migration is required for the current Auth metadata storage.

`backend/image_uploader.py` exports `upload_image(file, owner_id)` using the Cloudflare direct-upload flow from the supplied reference. `src/lib/imageUploader.ts` exports the reusable `uploadImage(file)` browser helper. The protected `/api/auth/images/upload` route currently permits approved store owners; future page permissions can be added explicitly. Cloudflare credentials stay on the server in `CF_ACCOUNT_ID`, `CF_IMAGES_TOKEN`, `CF_HASH`, and `CF_IMAGES_VARIANT` (public). Install backend requirements and restart after configuration changes.

Uploads accept JPEG, PNG, GIF, and WebP up to 5 MB and 25 megapixels, validating image contents before contacting Cloudflare. The upload response contains an owner-bound signed receipt valid for 24 hours; saving the profile verifies this receipt. Uploads are previewed before saving. Cancel discards unsaved profile edits; uploaded files remain in Cloudflare. Removing or replacing an image removes its profile association but does not delete the Cloudflare asset, so another page can safely reuse it. Asset cleanup can be added separately.

Validation: `python -m unittest backend.test_auth backend.test_store_approvals backend.test_store_profile -q`.

## Admin Stores directory

The Stores navigation item uses `/api/auth/admin/store-directory`. It requires the environment administrator session and the existing server-only Supabase key. It reads all Auth account pages before calculating total registered, active (approved Store Manager), pending, and rejected counts. Customer accounts without store applications are excluded. Total registered includes pending and rejected applications.

Search and region/status filters apply across the complete result set; matching stores are returned in pages of 20. The directory uses current saved store profile fields and Cloudflare image URLs, with reviewed application details as defaults. View store shows actual registration, contact, location and verification information. Pending records link to Store Approvals. Refresh retrieves current data. Counts are database-derived and remain global while filters are applied.

This implementation scans the Auth directory on each request for correct totals with the existing data model. At larger scale, migrate stores to an indexed table with database aggregation. No sales, product, suspension or revenue metrics are fabricated; those modules require their own data integration.

## Store Settings

All eight tabs now render separate content. General, Operations, Applications, Inventory, Payments, and Notifications have schema-validated preferences saved by section in `app_metadata.store_settings`, through `/api/auth/store/settings`. Only the authenticated approved store owner can read or save them. Saves preserve other settings sections, profile data and role/approval metadata. Stale versions are rejected. The interface retains drafts when switching tabs and supports discarding the active section's changes.

Security displays current account information and supports logout; Store Management shows approval status and links to Store Profile. No cosmetic security toggles are provided. These saved preferences do not independently enable payment collection, notification sending, automated application processing, or inventory workflows. Those services require their own integration before consuming the preferences.

## Store Roles & Users

Approved owners can create real Supabase Auth staff accounts, search their team, edit role titles and page access, and enable or disable accounts through `/api/auth/store/team`. The owner retains full access and only owners can manage staff. Use Add user, enter the initial password, select pages, and share the credentials securely with the staff member. No invitation email is sent. Staff sign in using the regular login page without email confirmation. Existing accounts are not overwritten.

Membership is saved in trusted `app_metadata.store_staff`, with the owner's store ID, name, phone, role title, Active/Disabled status, and permitted page IDs. Passwords are handled by Supabase Auth and never stored in metadata or browser storage. No new environment variables or SQL migration are needed; the existing server-only Supabase admin key is required.

Staff see only assigned pages in desktop and mobile navigation, and unassigned page content is blocked. Profile, settings, image uploads, and team APIs check current membership and permissions on the server. Authorized profile/settings actions operate on the store owner's data; Security shows the staff member's own sign-in information. Disabled staff or staff of a no-longer-approved store cannot establish or retain an application session. Changes refresh in the interface on focus or the existing 60-second session check; connected API permissions are checked on every request. Staff accounts are excluded from store approvals and store directory counts.

Other business pages retain their existing functionality; this change does not connect prototype inventory, payments, or reporting data. Future APIs for those pages must also use `resolve_store` with their page permission. Team listing currently scans Supabase Auth users, and metadata version checks reject stale sequential edits; transactional membership storage is recommended when moving to multiple backend workers or a large user directory.

Validation: `python -m unittest discover -s backend -p "test_*.py" -q`, plus the frontend build. Manual check: create a staff user with only Products and Reports, sign in as that user, verify the sidebar, then change permissions or disable the account from the owner's session.

## Shop Rules & Payment Terms

`GET/POST /api/auth/store/rules` loads and saves all three tabs in trusted `app_metadata.store_rules` on the store owner's account. Approved owners and active staff with `shop-rules` permission can access it. The client cannot select another store. No new environment variables or migration are required.

Payment percentages, durations, delivery timeframe, payment rule switches, return/warranty periods, return conditions, conduct selections, and editable agreement clauses all persist. Suggested defaults remain unpublished until Save & Publish succeeds. Successful saves increment the revision and record the UTC publication time and actor ID. Sequential stale edits are rejected; reload the saved version before retrying. As with existing metadata-backed settings, these version checks are not a database transaction for simultaneous writes.

Preview Customer Version renders current editor contents, including unsaved edits, without publishing. Discard changes restores the last loaded/saved values; Reload retrieves the latest version with confirmation before discarding edits. The page no longer displays fabricated active agreement counts. Publication stores the shop policy only: payment execution, customer-facing delivery of terms, agreement snapshots and customer acceptance still require integration with their respective modules. Existing agreement records are not changed.

Validation includes persistence across all tabs, numeric/text limits, stale versions, metadata preservation, owner/staff permissions and store scoping in `backend/test_store_rules.py`.

## Store Products

One-time setup: run `backend/migrations/001_store_products.sql` in the SQL Editor of the same Supabase project as `SUPABASE_URL`. The Data API must be enabled with the public schema exposed. Restart the Python backend. No additional API keys are needed: the existing server-only Supabase key and Cloudflare Images configuration are reused. API credentials do not permit creating database tables, so the migration must be applied through SQL Editor or a database administration connection.

The store Products page uses `GET/POST /api/auth/store/products`. Products live in `public.store_products`, not Auth metadata. The table enables RLS and denies direct anon/authenticated access; Flask verifies current approved store membership and Products permission before using the server key. Every read and update includes the resolved store ID. SKUs are unique per store, and atomic revision filters reject concurrent edits. Products can be created, viewed, edited, made Active/Draft, or Archived; archive retains the record. Search, status filters, pagination and global store counts use database queries. Low stock means active products with 1–5 units; out of stock means active products with zero units.

Product fields include description, condition, price in GHS, stock, payment options, swap terms and layaway settings. Numeric ranges, precision, policies and images are validated server-side. Products require one to five images. The existing reusable `uploadImage` helper accepts a third purpose argument (`products`); its endpoint checks Products permission and returns a signed receipt bound to the store and upload purpose. New image URLs cannot be supplied directly. Saved records contain Cloudflare image IDs and URLs, never base64 image data or upload receipts. Uploads show transfer progress and then processing status. Images can be removed from the draft or selected as the cover. Removing/replacing an image or cancelling a draft does not delete the Cloudflare asset.

Manual check after migration: add a product with images, reload, edit its price/stock, change its cover image, test filters, then archive it. Sign in as Products-only staff and confirm upload/edit works while unrelated pages remain restricted. Customer catalogue, checkout, stock reservation and swap/layaway processing remain separate modules; storing their product options does not execute those workflows. Categories currently accept text until category management is connected.

Validation: `python -m unittest discover -s backend -p "test_*.py" -q`, `npm.cmd run build`, and a targeted TypeScript check for `StoreProducts.tsx` and `imageUploader.ts`. Product tests use an in-memory database double and mocked Cloudflare calls; a live create/edit/upload check requires the table migration and running app.

## Promotions & Codes

Run `backend/migrations/002_store_promotions.sql` in the same Supabase project, after the products migration, and restart the backend. `GET/POST /api/auth/store/promotions` stores offers in `public.store_promotion_settings`, one revisioned configuration per store. RLS and revoked anon/authenticated grants require access through the backend, which checks the signed-in owner's approval or staff `promotions` permission. Submitted store IDs never select the target store. Atomic revision checks prevent overwriting a concurrent save, and first-save conflicts return a refresh message.

The page supports creating/editing campaigns and codes, pause/enable, confirmed deletion, searching, code generation/copying, and the public availability setting. All-product, category and selected-product eligibility use the real store catalogue and UUIDs; the server validates ownership. Discounts are 1–90 percent with two-decimal precision, minimum spend is GHS, and date ranges are inclusive UTC (Ghana time). Status distinguishes paused, scheduled, active, expired, and exhausted offers. Codes are normalized to uppercase and unique within the store. Configuration currently supports up to 100 campaigns and 100 codes per store.

Usage counts start at zero and are preserved server-side; clients cannot invent or reset redemptions. Redeemed codes cannot be deleted or renamed, and limits cannot fall below recorded use. The old browser-local promotion data is not migrated or treated as authoritative. The separate prototype customer catalogue/checkout still uses its existing demo helpers; this change activates merchant offer management, not checkout discount application or redemption. Before enabling real checkout, integrate server-side eligibility, pricing, and atomic usage accounting with a verified order/payment, including the public availability flag. No live redemption count is simulated by this page.

Tests cover persistence, eligibility, ownership, staff permissions, duplicate codes, date/numeric validation, stale/concurrent saves, and protected usage counts. To verify after migration, create a campaign using a saved product, create a code, reload, edit, pause and delete an unused offer. Confirm another store cannot see the records.

## Categories and Trade-in Inventory

Apply `backend/migrations/003_categories_trade_inventory.sql` after 001 and 002, then restart Flask. This creates `store_categories` and `store_trade_inventory` with RLS and server-only table grants. The migration backfills categories from current product names, normalizes casing, and installs transactional triggers: product saves create/canonicalize categories; category renames update product category labels and category-scoped promotion selections, incrementing affected revisions so stale editors cannot undo the rename. Duplicate category names are prevented case-insensitively per store. Archived categories retain their products but reject new assignments; restore the category to Active before adding products to it.

Categories (`/api/auth/store/categories`) supports add, edit/rename, archive/restore, search, status filtering, real product/stock counts, and viewing assigned products. It requires `categories` permission. The product editor reads names from `/api/auth/store/category-options`, authorized separately with `products` permission, and allows new category names that the database creates when saving the product. Counts include archived/draft products, with a separate active-product count. Both catalogue endpoints fetch database batches to avoid Supabase's default row limit; the UI currently filters the complete returned store dataset in memory.

Trade-in Inventory (`/api/auth/store/trade-inventory`) requires `trade-in-inventory` permission. Staff can manually record a received device, inventory reference, optional serial/IMEI and source reference, condition, acquisition amount in GHS, received date and inspection notes. New entries start Held; inspected devices can become Available, return to Held, or move from Available to Resold with a positive resale amount. Resale records get a server timestamp and become read-only. References and non-empty serial numbers are unique per store. Search, status filters and stock totals use saved records. All writes enforce store ownership and atomic revision checks.

This page does not import the prototype Swap Management applications, verify manually entered source references, take payments, or automatically create resale product listings. Those integrations remain separate. The previous demo trade-in inventory is not treated as received stock.

Validation: backend suite, Vite build, and targeted TypeScript checks. The backend tests cover counts, permissions, isolation, duplicate records, lifecycle transitions, stale/concurrent edits and invalid values using table doubles. Migration triggers require a live SQL check after installation: create a product with a new category, rename that category and confirm product/promotion selections update, archive it and confirm new assignments fail, then restore it. Test receipt → Available → Resold and reload the page to verify persistence.

## Field agents and agent login

Apply `backend/migrations/004_field_agents.sql` in Supabase SQL Editor and restart Flask. The Field Agents page now uses `/api/auth/store/agents` and a real `store_field_agents` table. Approved owners and staff with `collection-agents` permission may register agents, view/edit profiles, suspend/reactivate them, and reset their passwords. Email is immutable after creation. Supabase Auth creates the login with confirmed email and trusted `Field Agent` role plus `field_agent_store`; the table stores the associated store, profile, status and revision. Client-supplied store IDs, roles and usage metadata are ignored. Passwords are sent only to Supabase Auth and are never stored in the profile table or browser storage, returned in API responses, or readable from the management page.

Agents use the regular email/password sign-in form. The server resolves their own database profile on login and each session request, verifies Active status and the store's current approval, and returns the Field Agent role. The application routes them to `AgentAccount.tsx` with their real profile; the demo agent ID fallback and local-password portal are no longer used for authenticated agents. `/api/auth/agent/me` identifies the agent from the HttpOnly session, never a submitted ID. It supports password changes after reauthenticating the current password. Manager password resets verify the target is a Field Agent belonging to their store. Suspension blocks new application logins and authenticated agent requests; the existing periodic/focus session check removes the open portal. Password reset does not promise immediate revocation of every already-issued Supabase access token; suspend the account to block application access immediately.

The reusable image uploader accepts `collection-agents` purpose. Profile and Ghana Card images upload with Cloudflare `requireSignedURLs=true`; stored profile images contain only image IDs. Authenticated proxy routes serve uploaded previews and saved documents only after store/agent ownership checks. The existing `CF_IMAGES_TOKEN` must permit Images upload and reading the original image (the Images download/blob API). Do not configure a delivery variant to bypass signed-URL requirements for private images. No new Cloudflare environment variables are needed. Receipts expire in 24 hours, and removing/replacing images does not delete the Cloudflare asset. No base64 image data is saved in the database or browser storage.

Account provisioning checks table availability before creating a login. Explicit database insert failures attempt to delete only the newly-created Auth account; if cleanup fails or the network fails ambiguously, inspect Supabase Auth and `store_field_agents` before retrying rather than deleting an existing agent account. Existing emails are not overwritten. No invitation email is sent; share the initial/reset credentials securely. Agents can change the password from their account page.

Customer assignment, collection recording and settlements still need their database integration; their old demo data is not imported into agent profiles and no collection totals are fabricated. Tests use mocked Supabase/Auth/Cloudflare responses. After migration, verify a new agent registration with private images, sign in in a separate browser session, change the password, test the old/new passwords, suspend and reactivate the agent, and check manager reset. Confirm an agent cannot open store management routes or another agent's documents.

## Public and customer browsing

The public Browse Stores, Browse Products, Store Details, and customer workspace browse pages share `Marketplace.tsx`. They use anonymous read-only `/api/public/stores`, `/api/public/products`, and `/api/public/stores/<id>` endpoints. No new migration is needed; existing `001_store_products.sql` and `002_store_promotions.sql` must be applied and accessible through the Supabase Data API. Restart Flask after updating the code. The read-only live check during this implementation returned PGRST205 for both catalogue tables, so these migrations still need to be applied to the configured project (or its schema cache repaired if the tables already exist).

Only approved store owners and Active product listings are included. Out-of-stock active listings remain visible unless In stock only is selected. Public responses explicitly allowlist business profile fields and product details; they never return Auth email as a fallback, private owner/agent metadata, registration documents, raw Auth users, or promo-code definitions. Store contact email is published only from the saved store profile. Category facets and counts come from active products. Saved Cloudflare product/profile images and published shop terms are used; no demo ratings, sales totals, monthly payments, or reviews are invented.

Search, category, region, store, condition, payment option, price range, stock filters, sorting and 12-item pagination operate on the backend snapshot. Active publicly enabled campaigns are matched by scope and the highest applicable percentage is applied server-side with two-decimal GHS rounding. Discounts are not stacked. Promo codes are not exposed or redeemed. Product details include an image gallery and links to the store's real contact information; checkout and financing applications remain separate integrations. Store pages show saved business hours as text rather than claiming the store is currently open.

The interface refetches on load, filter changes, Refresh, window focus, and every 60 seconds while visible. This is polling, not a Supabase Realtime subscription. Each backend request fetches fresh approved stores and catalogue rows in batches. For a large marketplace, replace Auth directory scanning with indexed public store records and database-side filtering/aggregation, keeping the same allowlisted response contract.

Validation: `backend/test_public_catalogue.py` covers anonymous access, field privacy, approval and listing visibility, pagination beyond default API limits, discounts, filters, price validation, and changed records. After applying migrations, approve a store and create an Active product, then open Browse Stores/Products both signed out and as a customer. Edit its price/stock, refresh the catalogue, and confirm the change appears; switch it to Draft and confirm it disappears.

## Customer applications and store decisions

**Database setup required:** in the Supabase project matching the root `.env` `SUPABASE_URL`, run migrations `001_store_products.sql`, `002_store_promotions.sql`, `003_categories_trade_inventory.sql`, `004_field_agents.sql`, then `005_customer_applications.sql` in SQL Editor. Existing completed migrations may be skipped. Restart `python backend/app.py` after updating. The read-only schema check on 2026-10-09 returned `PGRST205` for products, promotions, applications and payments in the configured project. These tables are not currently exposed there. If they already exist in another project, confirm that the URL and server key reference that project. API keys cannot execute database DDL; do not replace the key with a randomly generated string. No new environment variables are needed.

Customers can open product details from Browse Stores/Products or an application-type page, select hire purchase, layaway or swap, review current terms and submit to that product's store. Only approved stores and active in-stock products with that option enabled qualify. The backend calculates current public campaign pricing and validates deposits, duration, frequency, guarantors, consent and private document ownership. Signed quotes bind the reviewed terms to the customer; changed pricing or terms require another review. Submitted customer/store IDs, totals and privileged roles are ignored. Applications preserve the accepted product price and rules snapshot. Identity images use the shared Cloudflare uploader in private mode; only the customer or permitted staff at the receiving store can retrieve them.

Store Customer Applications, Layaway Plans, Swap Management, Active Purchases, Payments, Customers, Notifications, Dashboard and application Reports now read these records. Customer Dashboard, My Applications, My Swaps, My Payment Plans, My Purchases, Payment History, Receipts and Notifications share those records. Profile/photo edits and password changes persist through Supabase Auth. Lists refresh on focus, manual Refresh and every 60 seconds; this is polling, not a Realtime subscription. Existing staff page permissions apply at the API, including a separate Payments permission for payment recording. Dashboard, payment, notification, report and customer-list responses omit identity documents and guarantor/employment details.

The transactional workflow is:

1. Submission creates a Pending application; stock remains available until approval.
2. Hire purchase/layaway approval reserves one unit atomically. Rejection requires a reason. Cancelling an unpaid, unfulfilled approved application restores the unit. Paid cancellations/refunds require separate store handling and cannot silently remove received money.
3. A swap receives a store credit offer with an expiry. The customer reviews and accepts it before stock is reserved. The customer pays the remaining balance; staff then confirm device receipt and product handover. The trade-in automatically enters the store inventory once.
4. In Payments, staff choose an approved application under **Record a received payment**, enter the actual amount/method/reference and confirm receipt. Payment requests are idempotent, references are unique within a store, and overpayments are rejected. Customers see the updated balance and can download a receipt for each confirmed payment.
5. Hire purchase can be handed over after its deposit is paid and stays active until paid in full. Layaway and swap require full payment before handover. Handover plus full payment marks the application Completed. Actions and payments appear in the activity history and Notifications.

Payments are **store-confirmed records**, not a payment gateway: no account is charged, no debit instructions are created and no funds are moved. Automatic late fees, SMS/email delivery, agent collections, refunds and promo-code redemption are not implemented by this workflow. Amounts and schedules use GHS/pesewas; monthly due dates preserve the approval day, clamping at month end. Weekly schedules use four installments per requested month and daily schedules use thirty. Installment rounding preserves the exact total. Store review is not automated identity verification.

Verification: `python -m unittest discover -s backend -p "test_*.py"`, `npm.cmd run test:applications`, `npm.cmd run build`. The SQL test uses [PGlite](https://pglite.dev/docs/) to run all five migrations and the real transaction functions locally with isolated fixtures; it never connects to the production project. API tests cover scoping, page permissions, quote changes, private uploads/documents, profile/password persistence and exact schedules. Live end-to-end verification requires the migrations and configured Cloudflare service.

After setup, use two browser sessions: create a customer application, review it as its store, approve, record a deposit/payment, confirm handover and refresh the customer's plans/receipts. Repeat for layaway and a swap offer/acceptance. Check the stock count and resulting trade-in inventory; verify a different store cannot see the application. Use test accounts and mark a payment received only when it actually was.

## Live homepage, purchase ratings, cookies and traffic

Run **`backend/migrations/006_homepage_ratings_analytics.sql`** in Supabase SQL Editor after migrations 001–005, then restart the backend. This creates `purchase_ratings`, `site_pageviews`, and server-only transaction/aggregation functions. No new environment variables are required. The migration has been tested in isolated PostgreSQL, but has not been applied to the configured Supabase project by this update.

Homepage Featured Stores and Featured Products use `/api/public/featured` and the existing allowlisted catalogue. Store/product buttons open the selected database record. Only approved stores and Active products are eligible; featured products must be in stock. Highest average rating ranks first, with rating count as a tiebreaker. Until ratings exist, stores fall back to active-product count and products to newest listings, labelled **Not rated yet**. Sample stores, product offers, testimonials, volume counters and fake activity toast are no longer displayed as live data. Remaining decorative workspace illustrations are labelled examples. Services links filter eligible products; footer help, about, contact, privacy and usage-information links now open content, and the final call-to-action buttons navigate correctly.

Customers can rate the store and product from the details of a Completed purchase in their workspace. `GET/POST /api/auth/customer/rating` resolves the authenticated customer; the database function verifies completed-purchase ownership and derives store/product IDs from the application. Scores are integers 1–5, with one editable rating per completed purchase. Store managers cannot manufacture ratings. Public results contain only aggregate scores and counts, without customer details or review documents.

`GET/POST /api/public/consent` stores a signed, HttpOnly, SameSite=Lax preference cookie for 180 days. Essential sign-in cookies remain independent. Visitors can Accept all, Decline optional, or separately select Traffic analytics and AI chat. **Cookie settings** remains available across the app. Analytics acceptance creates a random HttpOnly visitor cookie; refusal/withdrawal removes it. Cookie Secure follows the existing `COOKIE_SECURE` production configuration. Choices persist across reloads; optional features remain disabled when preferences cannot be loaded.

Only analytics-consenting visitors generate `/api/public/traffic` requests for allowlisted public page names. Private workspaces are excluded. Stored fields are an event UUID, keyed hash of a random browser identifier, page label, screen-size category, referral hostname and server timestamp. No Auth IDs, email, IP address, full URL/query string or chat text is stored in this analytics table. Repeated event IDs do not duplicate views, and recording is capped at 30 events per browser identifier per minute. Browsers can clear identifiers and scripted clients can manufacture events: these totals are estimated traffic, not audited people or fraud-resistant marketing attribution. Use perimeter rate limiting in a public deployment. Records older than 90 days are removed on subsequent successful collection; schedule independent retention cleanup if deletion must occur during periods without traffic. Withdrawing consent stops future collection; existing records remain under retention.

The administrator's **Website Traffic** page uses `/api/auth/admin/traffic`, protected by the environment-admin session. It shows consented page views, distinct browsers, a daily bar chart, public-page totals, device categories and top referral hostnames for 7/30/90-day UTC periods. Only aggregate results are returned. Zero data shows an empty state; missing tables/functions show a setup error.

The demo chatbot is replaced by the supplied Chatbit embed: `window.cbConfig.chatId = "7bc20488-a6cf-4ebc-b6b3-dc10788bc520"`, followed by `https://app.chatbit.co/embed.min.js`. It loads once after AI-chat consent or **Enable AI chat**, across homepage and linked pages, with retry on script-load failure. No passwords, account fields or application documents are explicitly passed to Chatbit by the integration. Users are told that chat is a third-party service and not to include secrets/documents. Revoking chat consent reloads the page to remove the widget and its listeners; this does not delete messages already sent to the provider. Training content and bot responses are managed in the owner's Chatbit account; embedding the widget does not upload the earlier knowledge-base text.

Validation includes Flask tests for consent persistence, forged/missing consent, field allowlists, admin authorization, rating scopes, featured ranking and record links; `npm.cmd run test:applications` executes all six migrations and exercises rating eligibility plus traffic aggregation, deduplication, limits and retention. Browser checks use the real local Flask consent routes and fixture catalogue/analytics data, with Chatbit's script intercepted to verify the exact configuration, single load, opt-in and withdrawal without contacting the provider. A live deployment check still requires migration 006 and a working Chatbit account.


### Homepage follow-up: independent chat and partial catalogue availability

Chatbit now loads automatically once per page, independently of analytics consent. It is no longer included in the cookie-preference API or UI, and changing cookie preferences does not reload or disable the chatbot. Existing signed preference cookies remain readable; their old chat field is ignored. The earlier chat-consent instructions above are superseded by this behavior.

The read-only Supabase check on this update returned PGRST205 for store_products, store_promotion_settings and purchase_ratings, and PGRST202 for public_rating_summary. Featured listings now tolerate missing ratings and promotion schema: available approved stores/products still render without manufactured scores or discounts. Missing product schema returns approved stores with an unknown product count and a specific product-setup message. Authentication/network failures still produce an error and are logged with a safe error code.

Apply migrations 001?006 in order if they have not been applied, in the project matching SUPABASE_URL, and restart Flask. If the tables already exist elsewhere, correct the project configuration instead. This code change does not create missing live database tables through a public API key.


## Admin store profiles and Deleted Stores

Apply `migrations/007_admin_store_management.sql` after 001-006 (or run the updated combined `setup_database.sql`). Restart Flask. Admin Stores > View store opens a dedicated profile with a bookmarkable `#admin-store/<id>` URL, overview, products, unique application customers, application history, field agents, verified-purchase ratings and admin activity. Counts include all fetched database pages. Missing sections report setup errors instead of inventing totals. Customer documents, identity numbers, guarantors and agent credentials are excluded.

Suspend/reactivate requires an audit reason. Deleting requires the exact store name and archives the store metadata and complete product snapshots into `deleted_stores` and `deleted_store_products` in one transaction. Product originals are marked Archived to preserve purchase foreign keys; payment and customer histories are not erased. Deleted stores are excluded from the regular list and accessible in its Deleted Stores tab. Admins can open a deleted store and choose Restore store with an audit reason. Apply `migrations/010_restore_deleted_stores.sql` after 001-009 to enable restoration on an existing database. Restoration returns the store to its pre-deletion review status and restores product publication statuses while preserving current stock, revisions, customer applications and payments. Active archive rows are removed after restoration so the store can be deleted again; admin events retain the deletion and restoration history. There is no permanent deletion endpoint. Suspended/deleted owners, staff and agents cannot use store APIs; their stores/products disappear from the marketplace. Existing unpaid plans may still be cancelled by their customers, but new submissions, acceptance, payments and fulfilment are blocked. Administrators should resolve open obligations before deletion; suspension can be reversed.

Lifecycle RPCs are executable only by the service role after Flask admin authorization and same-origin checks. Database row locks, revision checks and triggers prevent stale state changes and product/application writes racing suspension/deletion. Audit actors come from the authenticated server session. Migration 007 does not suspend or delete any existing store by itself.

Validate store management with `python -m unittest backend.test_admin_store_profile -v` and `node backend/test_admin_store_transactions.mjs`. The SQL test runs the combined setup twice and tests real transactions in isolated PostgreSQL; no live records are changed.


## Website traffic and engagement

Apply `migrations/008_traffic_engagement.sql` after 001-007. Website Traffic now loads live pageview and engagement reports for 7, 30 or 90 days. Pageview totals remain independent of the engagement migration, with a visible setup error if that section is unavailable. Registered accounts is the all-time count of Supabase Auth accounts (including stores, customers, staff and agents), not a count of identified website visitors. Unique visitors are consented pseudonymous browsers.

Accepted analytics enables public-page events and 15-second engagement heartbeats. The browser counts active time only when visible and active within 30 seconds; scroll time estimates recent scrolling and depth records the maximum visible percentage. Route changes, hiding a tab and leaving the page attempt a final flush. Time is capped at one hour per page visit; the server also bounds it by elapsed wall time. Events are bound to the consenting browser hash, and duplicate/out-of-order heartbeats cannot increase counts twice or reduce depth. Private workspaces are excluded. Declining/revoking consent stops collection; Chatbit remains independent. Metrics are estimates, not a user identification or fraud-detection system. Abrupt exits, blocking, and idle reading can undercount. Retention remains 90 days.

## Paystack prepaid store subscriptions

Apply `migrations/009_store_subscriptions.sql` after 001-008, or run the updated `setup_database.sql`. This changes approved stores to require a verified paid term; existing accounts have no free or grandfathered access. Owners can still sign in to billing, choose a plan and check payment attempts. Staff see an owner-payment notice, and agents cannot enter an unpaid store. Store APIs, marketplace listings and new applications require active paid access. Existing customer history remains readable; store operations require renewal.

Set these entries in the project-root `.env`, then restart Flask:

```dotenv
PAYSTACK_PUBLIC_KEY=your_paystack_public_key
PAYSTACK_SECRET_KEY=your_paystack_secret_key
APP_ORIGIN=https://your-website.example
```

Use an actual `sk_test_...` key for testing and `sk_live_...` for live payments. Checkout uses Paystack Inline v2. Set both public and secret keys from the same Paystack account and mode (`pk_test_` with `sk_test_`, or `pk_live_` with `sk_live_`). Only the public key and server-priced order options are returned to the browser. The secret key stays on Flask for verification and webhook authentication. Never put the secret in a `VITE_` variable. Keep `APP_ORIGIN` equal to the frontend origin, with no path; live checkout requires HTTPS. Existing `.env` values were preserved and empty Paystack public/secret key settings were added if absent.

In Paystack Dashboard > Settings > API Keys & Webhooks, set the webhook URL for the matching test/live mode to:

```
https://your-website.example/api/paystack/webhook
```

The deployment must forward that path to Flask. Paystack cannot reach localhost; use a publicly reachable HTTPS test deployment for end-to-end webhook testing. Inline opens payment on the subscription page. Its success callback asks Flask to verify the original server-generated reference; the callback alone never grants access. Legacy redirect returns at `APP_ORIGIN/?billing=return` are still supported. They can also use Check payment on a pending attempt if a callback/webhook was missed.

Admin > Store Subscriptions > Create plan: enter a name, price in GHS, duration in days and publish it. No invented prices or enabled plans are seeded. Edit/unpublish affects new checkout attempts, while previously initialized quotes and paid terms keep their original terms. Plans all provide the same store workspace access. These are prepaid subscriptions renewed manually through checkout, NOT automatically recurring Paystack plan subscriptions. Early renewal extends the paid term. There is no automatic cancellation, refund or dispute administration in this release; those require an explicit payment reconciliation workflow before changing paid access.

The backend stores a server-priced order before the Inline popup opens, verifies successful status/reference/amount/currency/email/test-live domain against that order, and grants access only through a restricted transactional database function. Callback and signed `charge.success` webhooks use the same verification path. Signatures are HMAC-SHA512 over the unmodified request body. Duplicate events are idempotent; provider/database failures return an error for retry. Admin suspension/deletion overrides paid access. Payment state cannot be overwritten by stale profile updates. Payment tokens/card details are not stored.

Test and live paid terms are separated: a test payment never unlocks a store when using a live key, and test orders cannot overwrite a live subscription. Use a separate Supabase project for testing after accepting real payments. Admin revenue excludes test transactions. Pending attempts are not claimed as paid or failed without authoritative verification.

Official references: [Paystack Inline v2](https://paystack.com/docs/developer-tools/inlinejs/), [verification](https://paystack.com/docs/payments/verify-payments/), [webhook signatures and retries](https://paystack.com/docs/payments/webhooks/). Run `python -m unittest discover -s backend -p 'test_*.py' -q` and `node backend/test_subscription_transactions.mjs` for isolated checks. Actual Paystack checkout/webhook delivery requires your keys and a reachable test deployment; automated tests use fixtures and never charge real accounts.

## Purchase option prices and application price adjustments

Apply `migrations/011_purchase_option_prices.sql` after 001-010, then restart the Python backend. The combined setup includes this migration. Existing products inherit their current cash price for each purchase option. In Products, enter all four prices together: cash, hire purchase, layaway and swap. Prices are saved even for options that are currently disabled. Customers receive the price for the purchase option they select. Promotions apply to the chosen option price; customer quotes and submissions use the server-calculated price. Layaway deposit and minimum instalment validation use the layaway price.

During store application review, choose **Change price for this customer** and provide a reason. Only Pending/Offered, unpaid, unfulfilled applications can be adjusted. The change applies to that application only, preserves its original quoted price in the snapshot, proportionally adjusts the requested deposit, recalculates the payment schedule, and creates a customer-visible activity event. Swap adjustments withdraw any previous offer and clear its credit; send a new offer before the customer can accept. Approved/paid plans cannot be repriced through review. The SQL RPC checks store/customer scope, current revision, amount precision, and review state atomically.

## Store notifications and operational reports

Apply `migrations/012_store_notifications.sql` after 001-011, then restart the backend. Store managers have a live Notifications inbox for application activity, current low/out-of-stock alerts and agent account updates. Read status persists per owner/staff account in `store_notification_reads`. Mark read and Mark all read validate current store membership, the notifications permission and store-scoped notification keys. The menu and bell show unread totals, refreshed on focus and every minute. In-app activity is displayed; this does not send email or SMS.

Store Reports uses the reports permission and aggregates all store-scoped pages of products, field agents, customer applications and confirmed payments. Current totals cover unique customers who applied to the store, current agent/product statuses, stock units, active plans and outstanding balances. Selected-period figures use application submission dates and payment receipt dates; completed plans in the period are plans submitted in that period which are currently completed. Tables cover application statuses/types, product statuses, daily payments, payment methods, customers and agents. CSV export preserves the selected period. Reports expose customer names and financial aggregates, plus agent names/areas, without identity documents, guarantors or credentials.

## Database-backed admin operations

Customers, Products, Categories, Store Applications, Swap Overview, Active Purchases, Layaway Plans, Collection Agents, Agent Settlements, Transactions and Audit Logs use `/api/auth/admin/operations/<page>`. Every endpoint validates the environment administrator session before reading the service-role database client. Search, status/type/store/region/category filters, date ranges, totals, pagination, record details and CSV export use real Auth accounts and table records across all database pages. No local demo records are used by these eleven pages. CSV export includes all filtered records, not just the visible page, and neutralizes spreadsheet formulas.

Customers are registered Customer-role accounts excluding store applicants, staff and agents. Product views show saved cash/hire purchase/layaway/swap prices. Categories are scoped by store plus category name. Application pages use customer applications and their confirmed receipts; active purchases includes Approved and Completed plans. Agent directory profiles exclude identity documents, guarantors and upload credentials. Audit Logs displays persisted store admin events, application events and settlement events; unlogged historical actions are not fabricated. These directories provide platform oversight and record details; store owners continue to perform catalogue edits and application decisions through the store APIs.

Apply `migrations/013_admin_agent_settlements.sql` after 001-012 to enable the settlement ledger. The Agent Settlements page derives balances only from `application_payments` whose `recorded_by` matches a registered field agent in the same store. Local-browser collections from the older demo are not real receipts and are not imported as money. Administrators can record a received remittance against the displayed receipts. The atomic RPC locks the agent and receipts, checks amount/scope, prevents duplicate settlement, preserves the original payments, records the actual administrator email, and supports idempotent retries. Transactions shows customer receipts, subscription orders and agent remittances as separate sources; remittances are not added to customer revenue a second time.

Until migration 013 is applied, the settlement-dependent pages show a setup notice. Existing agent accounts, customer receipts, subscription orders and audit events remain visible; settlement totals show Unavailable and recording remittances remains disabled.

Validation: `python -m unittest backend.test_admin_operations`, `node backend/test_admin_settlements.mjs`, `node backend/test_admin_store_transactions.mjs`, targeted TypeScript checks and Vite build. The database checks use isolated PostgreSQL and never change live customer or financial records.

## Admin settings, support, notifications and reports

Apply `migrations/014_admin_platform.sql` after 001-013, or use the complete setup file. Settings are stored in `platform_settings` and saved with an atomic revision check and audit event. Editable controls are support identity/contact/announcement, accepting new requests, six admin inbox event categories, low-stock threshold and default report days. Support identity is shown on the signed-in support page; inbox preferences control actual events and report days initialize Reports. These controls do not configure external email/SMS providers or change payment gateway credentials.

Customers and store managers have Help & Support in their portal; field agents have the same inbox on their account page. `/api/auth/support` and `/api/auth/support/<ticket>` authenticate the actual account and return only its own tickets. Subject, category and message are stored; admins use `/api/auth/admin/support` to search/filter, read conversations, reply and change statuses. Replies are visible inside the recipient account. User replies reopen resolved requests. New requests are limited to ten per account per hour; pausing requests does not prevent existing conversations. Ticket/reply request UUIDs support retries without duplicate messages; stale revisions require refreshing. No external email or SMS is sent.

`/api/auth/admin/notifications` derives events from real pending store approvals, store admin actions, user support messages, application events, recorded receipts, paid subscriptions, agent profiles and stock revisions. Read keys are saved per administrator email in `admin_notification_reads`; unread counts appear in the sidebar and header. Search, category, unread filter, pagination, mark read and mark all read work on the backend. If migration 014 is missing, existing events are still shown with a setup notice and read tracking is unavailable.

`/api/auth/admin/reports` aggregates all table/Auth pages. It covers platform customer registrations, stores/statuses, customers who applied, products/stock, agents, applications/types/statuses, active/completed purchases, current outstanding balances, daily customer receipts/payment methods, paid subscriptions split by test/live environment, separate agent remittances, support statuses and store performance. Dates filter application submission, registration, ticket creation and payment receipt dates; current inventory/agent/plan totals remain current. Store filtering scopes business records and hides platform-only registration/support figures. CSV includes all sections and records. Migration 013/014-dependent figures show Unavailable when their tables are missing. Settings/support changes also appear in Audit Logs.

Validation: `python -m unittest backend.test_admin_platform backend.test_admin_operations`, `node backend/test_admin_platform.mjs`, targeted TypeScript checks and Vite build. PostgreSQL tests verify private grants, atomic audit writes, stale updates, ownership, idempotent retries, status permissions, support pause/rate limits and persisted reads in an isolated database.

## Connected admin dashboard and navigation

The admin landing page uses `/api/auth/admin/dashboard` for current customers, stores, products, field agents, applications, purchase balances, customer receipts, 30-day receipt totals, paid subscriptions by environment, attention counts and recent records. Links open the actual matching record or directory. Totals are derived from the same Auth users and store/customer tables used by their portals; no dashboard trends, risk scores or financial amounts are manufactured.

Header search calls `/api/auth/admin/search?q=...&scope=...&page=...`. It searches all Auth/database pages for stores, customers, products, categories, customer applications, field agents, customer/subscription/remittance transactions, support tickets, subscription plans and recorded audit events. The response contains only permitted names/references and destination IDs. Search requires the verified admin session, validates lengths/scopes/pages and returns 20 matches at a time. Search includes archived records for administrator oversight. Keyboard arrows/Enter select results and Escape closes them.

Admin page and record URLs use `#admin/<page>?record=<id>`; existing `#admin-store/<uuid>` and `#admin-stores` URLs remain supported. Sidebar links, record drawers, notification targets, browser Back/Forward and refresh restore the selected page/record. The header Help button opens Support, the account button opens Settings, and the bell opens Notifications with the saved unread count. Notification View actions open their specific receipt/application/product/agent/ticket/review. Store-approval filters use `scope=all` and search complete Auth pagination; `/api/auth/admin/stores/<uuid>` opens an individual review directly.

`/api/auth/admin/status` verifies actual table reads before reporting database readiness in the header. Missing migrations are shown explicitly. Existing catalogue, account and payment records remain available where possible. There is no new migration for dashboard/search; migrations 013/014 are still required for settlement writes, platform settings, private support and notification read tracking.

Validation: `python -m unittest backend.test_admin_workspace`, `node backend/test_admin_navigation.mjs`, the complete Python suite, targeted TypeScript checks and production build. API tests verify authorization, shared data/totals, private fields, complete pagination, scoped search, real notification destinations and missing-schema readiness.


Customer and store portal navigation and search
---------------------------------------------

Both workspaces now preserve page and record links using `#customer/...` and
`#store/...`. Browser Back, Forward and refresh preserve those links. Staff
routes and search sources are restricted to their verified store permissions.
Header search uses `/api/auth/customer/search` or `/api/auth/store/search` and
paginates all matching accessible records. Customer results include the live
published catalogue and their own applications, receipts, support conversations
and notifications. Store results include their catalogue, categories, customers,
applications, receipts, trade-in devices, agents, agent accounts, promotions,
team members, support and workspace pages, subject to page permissions.

Customer notifications use real application/payment events and platform support
replies, with durable per-customer read markers. Store notifications link to real
records, include replies to that member's support requests, and respect saved
application/payment/stock preferences and the low stock threshold. Header badges
refresh after changes, on focus and every minute.

Existing migration-014 installations support customer read markers immediately
through a `customer:<authenticated UUID>` namespace in `admin_notification_reads`;
these do not overlap verified administrator email actors. Optional migration
`015_customer_notifications.sql` installs the dedicated customer read table and
copies those markers without deleting the existing records. The complete
`setup_database.sql` includes this migration and is repeatable.

Store Agent Accounts now reads actual store-owned agent payment receipts,
settlement items and administrator-confirmed remittances. It does not create
local/demo collections. Swap settings are configured through persisted product
swap options; legacy `#store/swap-settings` links open Products. The customer and
store workspaces no longer mount the demo swap provider.

Validation: `python -m unittest discover -s backend -p "test_*.py" -q`,
`node backend/test_portal_navigation.mjs`, and `npm run build`. The portal test
exercises actual route code, PostgreSQL permissions, repeatable migration and
legacy read-marker backfill. Backend tests cover cross-account/store isolation,
restricted staff search, subscription/lifecycle checks, receipts, agent ledger
balances and both notification read storage paths.
