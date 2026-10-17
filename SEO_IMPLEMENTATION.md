# AdepaPay SEO implementation — 10 October 2026

## Implemented behavior and rendering

Production identity is `https://adepapay.com`, language `en-GH`, currency GHS.
Flask now renders meaningful public HTML using Jinja before sending the response.
React hydrates that exact escaped document and adds cookie preferences and optional
AI chat. This fits the existing Flask/React deployment without another hosting
service or a crawler-only rendering path. Humans and crawlers receive the same
content. Private account workspaces retain React and their authenticated APIs.

Public catalogue HTML and Product JSON-LD use one fresh request snapshot. HTML
and sitemaps send `Cache-Control: no-store`; hashed JS/CSS retain immutable caching.
New publication and changes appear on the next request, without a rebuild or
scheduled regeneration. Renamed store/product slugs redirect permanently to the
current canonical URL while retaining the database ID. Unavailable records and
unknown public routes return real 404s; database failures return 503 rather than
empty successful listings. Suspended, deleted, rejected, pending, staff-owned and
unsubscribed stores are excluded by the existing catalogue publication rules.

Shared metadata includes unique titles/descriptions, absolute canonicals, robots,
Open Graph, Twitter cards, relevant sharing images, language and existing favicon.
Organization/WebSite identity and breadcrumbs use stable connected IDs. Products
use actual descriptions, photographs, SKU, condition and full enabled cash offers.
Cash-disabled products have no invented cash Offer. Genuine completed-purchase
rating summaries appear visibly and supply matching Product aggregate ratings;
absent/unavailable ratings are omitted. Store schema is Organization rather than
an assumed physical LocalBusiness. No invented GTIN, brand, reviews, legal address,
social profiles, shipping fees, return markup or price expiry is supplied.

## Files

| File | Purpose |
| --- | --- |
| `backend/public_seo.py` | Shared metadata/schema, routes, fresh data, index controls, sitemap and robots |
| `backend/templates/public_document.html` | Public initial HTML, native navigation, category/store/product/service content |
| `backend/frontend.py` | Production routing, public rendering, private shells, proper missing-page responses |
| `backend/public_catalogue.py` | Existing privacy allowlist extended with public SKU, timestamps and published option policies |
| `backend/store_profile.py` | Maintains an actual public-profile modification timestamp |
| `backend/app.py` | API/error response noindex headers |
| `backend/test_public_seo.py`, `backend/test_frontend.py` | Publication, freshness, price/schema, pagination, privacy, routing and sitemap regression checks |
| `src/components/PublicDocument.tsx`, `src/main.tsx` | Exact-document hydration; public/account bundle separation |
| `src/App.tsx` | Direct account entry, lazy portal/billing/agent chunks, corrected merchant domain |
| `src/components/SiteExperience.tsx` | Public consent/analytics initialization and chat loaded on request |
| `src/pages/PublicInformation.tsx` | Privacy copy aligned with chat behavior |
| `src/index.css`, `index.html` | Server-template Tailwind scanning, native fonts, private-shell robots/language |
| `Dockerfile` | Includes templates if the alternative Docker build is used |
| `render.yaml`, `render.env.example`, `DEPLOY_RENDER.md` | Production/preview indexing controls and deployment instructions |

No SEO database migration is needed. Existing product, subscription, promotion,
rules and verified-rating migrations must already be applied.

## Public route coverage

All successful public routes below have initial content, canonical and social
metadata. Indexing requires the production environment gate and a request to the actual adepapay.com hostname. Render fallback domains remain noindex even when production variables are copied.

| Route | Initial content / schema | Indexation |
| --- | --- | --- |
| `/` | Real catalogue counts, recent products/stores, service links; site identity | Index |
| `/stores`, `/stores?page=2` | Approved participating stores; crawlable pagination | Index, self-canonical |
| `/stores/<id>/<slug>` | Public profile, contact, categories, products, genuine rating summary; Organization/breadcrumbs | Index while public |
| `/products`, `/products?page=2` | Real names, cash prices, availability, links; crawlable pagination | Index, self-canonical |
| `/products/<id>/<slug>` | Actual product, four option prices where enabled, deposit/rules/policies, seller; Product/Offer/breadcrumbs | Index while public, including out of stock |
| `/categories` | Categories from actual inventory | Index |
| `/categories/<slug>-<hash>` | Category introduction and actual matching inventory; pagination/breadcrumbs | Index; case-insensitive category deduplication |
| `/services` | Implemented shopping options and review workflow | Index |
| `/hire-purchase` | Deposit, monthly schedule, approval, collection, ownership and cancellation explanation | Index |
| `/layaway` | Product settings, frequencies, full payment before collection, cancellation explanation | Index |
| `/device-swap` | Assessment, replacement price, credit, top-up, acceptance and handover explanation | Index |
| `/merchants` | SMS registration, approval, paid access, publishing and management; registration link | Index |
| `/about`, `/contact`, `/help`, `/faq` | Factual platform information and private support entry; no FAQ rich-result promise | Index |
| `/privacy`, `/terms` | Current data, cookie/chat behavior and purchase-agreement explanations | Index |
| Search, filter and sort URLs | Matching real results; self-canonical filtered URLs | Noindex, follow; excluded from sitemap |
| `/login`, `/register`, `/account`, customer/store/admin/agent workspaces | Generic private shell; data requires authenticated role-scoped APIs | Noindex; excluded from sitemap |
| Unknown public URL / removed product | Useful error document | 404, noindex |
| Catalogue database unavailable | Temporary error document | 503, noindex; retry hint |

Public navigation uses actual anchors rather than fragment-only page changes.
Service pages link to matching filtered inventory; products link to categories
and sellers; stores link to products. Account application CTAs retain the actual
product reference through login and the existing private hash routing.

## Sitemaps and updates

`/sitemap.xml` indexes dynamically generated `/sitemaps/static-1.xml`,
`/sitemaps/stores-1.xml`, `/sitemaps/products-1.xml`,
`/sitemaps/categories-1.xml` and subsequent numbered parts. Groups split at
1,000 entries. The application permits at most five uploaded product images;
image sitemap entries reference stable public Cloudflare delivery URLs.
There is no article sitemap because no genuine editorial publication model was found.

Sitemap entities use the same publication predicate and canonical helpers as
rendered pages. Private routes, filters, redirects and unpublished records are
excluded. Meaningful maintained timestamps come from product/promotion updates,
profile changes and published rules; missing timestamps are omitted. Static
pages do not pretend to have today's modification date. Categories inherit
known inventory modification times. Ratings and scheduled campaign transitions
have no separate public modification timestamp; content stays fresh, but exact
last-change reporting for those events needs additional maintained event data.

Production robots allows public pages/assets and advertises the sitemap.
Filtered/private pages remain crawlable so their noindex response is visible;
authentication is the data protection. Preview HTML is noindex and its sitemaps
are disabled. Splitting, absolute URLs and maintained timestamps follow
[Google's sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

## Financial and content audit

`store_products.price` and option `prices` store cedis. Catalogue and application
quotes use Decimal calculations, including published promotion percentages.
The installment splitter converts to pesewas only to distribute rounding and
preserve the agreed total. No business prices were divided or rewritten.
The test cash price GHS 123.45 remains 123.45 in HTML and Offer markup; its
separate hire-purchase/layaway/swap totals and deposits remain distinct.

Hire purchase is monthly and uses current store deposit/duration rules.
Layaway uses configured deposit, minimum installment, duration and frequencies;
the current scheduler uses 30 daily or four weekly installments per month.
The public page does not invent an installment schedule before the customer
chooses a duration and deposit. Quotes expose the actual count and amounts in
the authenticated application flow. Swap prices are replacement amounts; the
assessed, accepted credit determines the top-up. Customer-specific reviewed
prices remain private. Published late-charge, return, warranty, delivery and
ownership terms are shown where maintained, including product layaway policies
and swap assessment requirements. Automatic debit, late-fee charging and refunds
are not implemented and are not advertised as available.

The new public documents use real counts, names and current prices; no sample
testimonials or ratings are emitted. Unsupported instant approval, guaranteed
outcomes, 24/7 human support, bank-grade security, upfront merchant payment and
zero-risk claims are excluded. Approval is labeled as participation, not a
transaction guarantee. The old merchant illustration domain was corrected.
Missing brand/model/specification fields are not inferred from product names;
merchants can supply factual details in maintained descriptions.

## Validation and performance

- Production Vite build and TypeScript check pass.
- Backend suite: 236 tests, including 15 new public SEO tests.
- Ten isolated database/navigation suites pass; no live database mutation is required.
- SEO tests cover initial HTML, unique metadata, canonical URLs, GHS/deposit
  distinctions, optional genuine ratings, HTML/JSON escaping, price/stock edits,
  newly approved stores/products, archived/suspended exclusions, slug redirects,
  pagination, preview controls, split sitemaps and every fixture sitemap URL.
- Local Edge browser: 16 public routes at 1280×900 and 390×844; no hydration
  errors or horizontal overflow. Images decode, search/navigation work, privacy
  settings work and chat loads only on request. Product content remains useful
  with JavaScript disabled. External product images were mocked for these tests.
- Public entry JS is 199.87 KB, estimated gzip 63.53 KB; CSS 76.03 KB, estimated
  gzip 14.23 KB. The old combined JS was approximately 651 KB. Public pages do
  not request the App or account chunks. Login App and portal/billing/agent
  modules are separate lazy chunks. Gzip sizes are build estimates, not verified
  production transfer sizes.
- Local unthrottled fixture lab LCP: desktop home 428 ms/product 104 ms;
  mobile home 132 ms/product 144 ms. CLS 0 in those runs. These are not field
  CWV, network-throttled mobile scores or measurements of real Supabase latency.
  INP and production LCP/CLS still require real-user/production evaluation.
- Images have descriptive alt text, explicit dimensions, responsive layout,
  lazy loading below the fold and appropriate first-image priority. Native
  fonts eliminate external font loading. Public assets pass the LFS-pointer check.

Responsive `srcset` delivery is implemented behind `CF_IMAGES_RESPONSIVE=true`.
First enable Cloudflare Images → Hosted Images → Delivery → Flexible variants;
otherwise the existing public variants remain intact. Width variants request
scale-down, automatic format and quality 80. Cloudflare documents
[flexible variant activation](https://developers.cloudflare.com/images/optimization/hosted-images/enable-flexible-variants/)
and [automatic format selection](https://developers.cloudflare.com/images/optimization/hosted-images/serve-uploaded-images/).
Real media URLs and account configuration still need deployment validation.

Unresolved facts/limits: no authoritative legal company name, registered public
address or social profiles were found; no invented replacements were added.
Merchants must maintain shipping charges, detailed returns and real identifiers
before stronger shopping integrations. The existing local PNG logo is relatively
large (about 660 KB); obtaining an optimized original brand asset remains useful.
Fresh catalogue reads still enumerate Supabase Auth users and active products;
production latency/load must be measured, especially as inventory grows. A
database public-store projection and query pagination will be needed at scale.
The production domain could not be fetched through the browsing tool during this
audit, so deployed HTTP behavior, media delivery and Google eligibility are not
represented as verified. Local tests use fixtures, not production account changes.

## Deployment and Google actions

1. Commit/push the code, templates and deployment files, including
   `render.env.example`. Keep the real `.env` private. Use the Python 3 Render
   build/start commands in `DEPLOY_RENDER.md`; a Vite-only/static deployment
   will not execute the public renderer.
2. Connect `adepapay.com` to Render with valid HTTPS. Set
   `APP_ORIGIN=https://adepapay.com`, `COOKIE_SECURE=true` and
   **`SEO_INDEXING=true` on production**. The Blueprint intentionally defaults
   indexing to false. Keep false on all staging services. Do not cache HTML at
   a CDN/proxy or override `no-store`. Confirm any www alias redirects to the
   production hostname rather than becoming a separate indexable origin.
3. Confirm `/`, a real store/product/category, `/robots.txt`, `/sitemap.xml` and
   its referenced parts return correct responses. Check initial source, not
   just DevTools DOM. Verify production has `index,follow`; account/search pages
   stay noindex, and an unknown URL is 404. Check actual media and live edits.
4. In Google Search Console add a **Domain property**, entering `adepapay.com`
   without scheme/path. Copy Google's actual TXT value into the DNS provider,
   at `@`/the root as that provider requires. Keep the verification record,
   wait for propagation and click Verify. Follow
   [Google's DNS verification instructions](https://support.google.com/webmasters/answer/9008080?hl=en).
   Optional URL-prefix verification can use the real token in
   `GOOGLE_SITE_VERIFICATION`; it does not replace DNS domain verification.
5. Submit `https://adepapay.com/sitemap.xml` in Search Console → Sitemaps.
   Inspect the homepage, one live store, one in-stock product, one out-of-stock
   product, one category and each service URL with URL Inspection → Test live
   URL. Check Google's selected canonical and request indexing for examples.
6. Run Google's Rich Results Test on real product URLs. The local schema checks
   verify vocabulary/data consistency; they do not certify Google's eligibility.
   Monitor Page indexing, Sitemaps, Product enhancements where available,
   Performance queries and Core Web Vitals. Investigate 404/503, noindex,
   canonical conflicts, price mismatches or blocked images before requesting
   validation again. Compare PageSpeed mobile lab results with field data when
   available; target LCP ≤2.5 s, INP ≤200 ms and CLS ≤0.1.

No DNS changes, Search Console submission, Merchant Center submission or live
deployment were performed. Indexing, sitelinks, rankings and rich results remain
Google decisions.

## Merchant Center assessment

Ghana is currently a beta target, with participation limitations, and GHS is
listed as supported. This does not establish eligibility for this application.
Sources: [beta countries](https://support.google.com/google-ads/answer/7101265?hl=en-SD),
[supported currencies](https://support.google.com/merchants/answer/160637?hl=en).

The current code displays cash offers but implements reviewed applications and
staff-confirmed payments rather than a cart/purchase checkout. Consequently my
assessment is **not ready for a Merchant Center feed**: checkout, delivery and
maintained seller policies must first meet Google's requirements. See
[checkout requirements](https://support.google.com/merchants/answer/9158778?hl=en).
Organic product snippets and direct-purchase merchant listings have different
eligibility; valid Product markup alone does not establish shopping acceptance.
See [Product structured data](https://developers.google.com/search/docs/appearance/structured-data/product).

Google's installment attribute has specified countries/categories; Ghana is not
listed among its supported countries. Do not export deposits or monthly amounts
as cash prices, or assume hire purchase, layaway and swap offers qualify.
Sources: [installment attribute](https://support.google.com/merchants/answer/6324474?hl=en),
[unsupported Shopping content](https://support.google.com/merchants/answer/6150006?hl=en).

If cash checkout, fulfillment/policies and seller permissions are established,
assess an advanced marketplace/multi-client account with Google and integrate
eligible physical-product cash offers using the same public snapshot and
stable IDs. Include genuine brand/identifiers only where known; keep feed, page,
checkout and schema synchronized. Google's
[advanced account guidance](https://support.google.com/google-ads/answer/14089347?hl=en)
covers businesses managing multiple sellers. No external feed was generated or
submitted because the current checkout and eligibility have not been established.
