"""Fresh server-rendered public documents, using the catalogue's privacy allowlist.

HTML, visible prices and JSON-LD share one request snapshot. No price cache or
user-agent detection: humans and crawlers receive the same public response.
"""
import hashlib
import json
import math
import os
import re
import unicodedata
from decimal import Decimal, ROUND_HALF_UP
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlencode, urlsplit
from xml.etree import ElementTree as ET

import httpx
from flask import Response, current_app, redirect, render_template, request
from postgrest.exceptions import APIError
from supabase_auth.errors import AuthApiError

if __package__:
    from .db import connect_admin
    from .public_catalogue import snapshot
    from .store_rules import DEFAULTS
else:
    from db import connect_admin
    from public_catalogue import snapshot
    from store_rules import DEFAULTS

ORIGIN = 'https://adepapay.com'
LEGAL_DOCUMENTS = json.loads((Path(__file__).resolve().parents[1] / 'content' / 'legal-documents.json').read_text(encoding='utf-8'))
ABOUT_DOCUMENT = json.loads((Path(__file__).resolve().parents[1] / 'content' / 'about-adepapay.json').read_text(encoding='utf-8'))
PAGE_SIZE = 12
SITEMAP_SIZE = 1000  # Safely below the protocol's 50,000 URLs / 50 MB per file.
STATIC = {
 '/': ('AdepaPay Ghana | Hire Purchase, Layaway & Device Swap', 'Discover products and participating stores in Ghana. Compare cash prices and available hire purchase, layaway and device swap options.', []),
 '/stores': ('Stores in Ghana | AdepaPay', 'Browse approved, currently participating AdepaPay stores and their published products, categories and contact details.', []),
 '/products': ('Products & Prices in Ghana | AdepaPay', 'Browse published products, cash prices in GHS, stock availability and store-specific payment options on AdepaPay.', []),
 '/categories': ('Shop Product Categories in Ghana | AdepaPay', 'Explore categories drawn from the current published inventory of participating AdepaPay stores.', []),
 '/services': ('Shopping & Payment Options in Ghana | AdepaPay', 'Understand cash purchases, hire purchase, layaway and device swap before choosing an eligible product and reviewing its store terms.', [
  ('Choose an available option', 'Each participating store chooses which options it offers for each product. Cash, hire purchase, layaway and swap totals may differ. Read the listing and the agreed application price.'),
  ('Review before applying', 'Store staff review applications; approval is not guaranteed. Review the price, deposit, frequency, duration, collection timing and published terms before submitting.')]),
 '/hire-purchase': ('Hire Purchase in Ghana | Buy in Installments | AdepaPay', 'Find eligible hire purchase products in Ghana and understand store approval, deposits, monthly installments and collection requirements.', [
  ('How hire purchase works', 'Choose an eligible product, sign in and submit the required customer details and documents. The store reviews the application. Approval reserves stock while availability lasts.'),
  ('Deposit, installments and total payable', 'The hire purchase listing price is the total product price for that option, not the monthly installment. The application quote sets the minimum deposit and permitted duration using the store rules. Hire purchase schedules are monthly; the remaining balance is split across the agreed installments with rounding that preserves the total.'),
  ('Collection and ownership', 'The store can confirm handover only after approval and receipt of the required deposit. Review the accepted ownership clauses: the default agreement transfers ownership after the final installment and all agreed charges, but published store terms must be checked.'),
  ('Fees, cancellations and refunds', 'The workflow records payments confirmed by authorized store staff. Automatic debit, automatic late-fee collection and automatic refunds are not implemented. Eligible unpaid, unfulfilled applications may be cancelled; paid cancellations and refunds need discussion with the store.'),
  ('Who can apply?', 'Customer registration requires an adult account and SMS verification. Applications require identity information and supporting documents; guarantor requirements depend on the store. Approval is a store decision, not automatic identity verification.')]),
 '/layaway': ('Layaway Shopping in Ghana | Pay Before Collection | AdepaPay', 'Explore eligible layaway products in Ghana. Understand deposits, store-specific daily, weekly or monthly schedules and full payment before collection.', [
  ('Reserve and pay toward your product', 'Apply for a product offering layaway. The store reviews the request and reserves stock on approval. The layaway price is the total product price, separate from the cash or hire purchase price.'),
  ('Deposit and schedule', 'Each product can specify a percentage or fixed deposit, duration, minimum installment and permitted payment frequencies. The quote applies those settings. Daily, weekly and monthly frequencies are available only where configured; the implemented schedules use thirty daily or four weekly installments per requested month.'),
  ('When can I collect?', 'Layaway handover requires approval and the full agreed amount recorded as paid. Paying the deposit does not permit early collection.'),
  ('Cancellation, returns and ownership', 'Eligible unpaid, unfulfilled requests can be cancelled. The platform does not issue automatic refunds. Review the store agreement for paid cancellation, return, warranty and ownership arrangements before committing.')]),
 '/device-swap': ('Device Swap in Ghana | Trade-In & Top-Up | AdepaPay', 'Browse swap-eligible products in Ghana. Submit your device details, review a store valuation and pay an agreed top-up before exchange.', [
  ('Apply with your current device', 'Choose a swap-enabled product and submit the device details, serial number, condition and required documents. The store assesses the device and makes an offer; neither eligibility nor valuation is guaranteed.'),
  ('Replacement price, credit and top-up', 'The swap listing amount is the replacement product price for the swap option. It is not a guaranteed trade-in credit or a fixed top-up. The store offers a credit; the amount payable is the agreed replacement price minus the accepted credit.'),
  ('Offer acceptance and exchange', 'Review the offer before accepting. Accepted, valid offers reserve stock while available. The full agreed top-up must be recorded as paid before staff confirm the physical exchange.'),
  ('Condition, expiry and cancellations', 'Stores configure accepted device categories, minimum condition, offer validity and instructions. Check the offer expiry and store terms. Eligible unpaid, unfulfilled requests may be cancelled; the platform does not automate refunds.')]),
 '/merchants': ('Become an AdepaPay Merchant in Ghana', 'Register your store, verify your phone and submit an application for admin approval. Publish products with accurate prices and available purchase options.', [
  ('Register and verify', 'Provide the store and business details requested by registration, choose your product categories and verify the contact phone by SMS. A successful registration creates an application pending administrator approval; it does not immediately grant Store Manager access.'),
  ('Approval and subscriptions', 'Approved owners receive Store Manager access. Public catalogue participation also requires an active store subscription. Review current plans and checkout in the store billing page; do not assume registration includes a free subscription.'),
  ('Publish your catalogue', 'Maintain your public store profile, business contact information, opening hours and product photographs. Products have a cash price and separate hire purchase, layaway and swap prices. Only active products of approved, currently participating stores appear publicly.'),
  ('Manage applications and payment records', 'Review requests, agree customer-specific prices where appropriate, record received payments and arrange handover. The platform does not guarantee approval, pay merchants upfront or remove merchant risk.')]),
 '/about': ('About AdepaPay | Ghana Shopping Marketplace', 'Learn how AdepaPay connects customers with participating stores in Ghana for product discovery, applications and agreed purchase plans.', [
  ('A marketplace for participating stores', 'AdepaPay helps customers in Ghana discover approved stores and published products. Stores set their available purchase options and commercial terms.'),
  ('From application to handover', 'Customers track store decisions, agreed plans and payments recorded by authorized staff. Store approval is not a guarantee of a product or transaction outcome.')]),
 '/contact': ('Contact & Support | AdepaPay Ghana', 'Find the right contact for an AdepaPay store, order or platform support request.', [
  ('Questions about a store or order', 'Use the selling store’s published contact details. Keep your application reference and payment receipt available. Do not share passwords, payment PINs or identity documents in general chat.'),
  ('Platform support', 'Sign in and use Help & Support to send a private request. Customers, store managers and field agents can read staff replies in their accounts. No 24/7 human response time is promised.')]),
 '/help': ('Help with Applications & Payments | AdepaPay', 'Get help with product applications, store decisions, payment records, receipts and support on AdepaPay.', [
  ('Apply for an eligible product', 'Open a listing and select an available option. Sign in, provide required details and documents, review the actual quote and store terms, then submit.'),
  ('Track your request', 'Use My Applications or My Swaps for decisions and My Payment Plans for schedules. Payment History and Receipts show payments confirmed by authorized store staff.'),
  ('Missing payment records', 'The purchase workflow does not automatically charge your wallet or bank account. Contact the store if an external payment is missing; do not send it again simply because a page has not updated.')]),
 '/faq': ('Shopping Questions & Answers | AdepaPay', 'Answers about hire purchase, layaway, device swaps, store approval and payment records in Ghana.', [
  ('Are applications automatically approved?', 'No. The receiving store reviews the request and availability. Stock reservation follows approval or acceptance of a valid swap offer.'),
  ('How does hire purchase differ from layaway?', 'Hire purchase can permit handover after approval and the deposit. Layaway requires full payment before handover. Read the store agreement for the specific product.'),
  ('Is the swap price the top-up?', 'No. It is the replacement product price for the swap option. The assessed, accepted trade-in credit determines the final top-up.'),
  ('Are public ratings guaranteed?', 'No. The application supports ratings from completed purchases. This public catalogue does not invent ratings or use sample testimonials as customer reviews.')]),
 '/privacy': ('Privacy Policy | AdepaPay', 'Read the AdepaPay Privacy Policy from Bridgeway Technology Limited.', []),
 '/terms': ('Terms and Conditions | AdepaPay', 'Read the AdepaPay Terms and Conditions from Bridgeway Technology Limited.', []),
}
SERVICES = {'hire-purchase':('hirePurchase','hire_purchase'), 'layaway':('layaway','layaway'), 'device-swap':('swap','swap')}
PRIVATE = {'login','register','store-registration','account','checkout','payment','application','forgot-password'}
PRIVATE_PREFIXES = {'customer','store','admin','agent'}


def slug(value):
    normalized = unicodedata.normalize('NFKD', str(value)).encode('ascii','ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+','-',normalized).strip('-')[:80] or 'listing'


def store_path(row): return '/stores/' + str(row['id']) + '/' + slug(row['name'])
def product_path(row): return '/products/' + str(row['id']) + '/' + slug(row['name'])
def category_path(name): return '/categories/' + slug(name) + '-' + hashlib.sha256(name.casefold().encode()).hexdigest()[:8]
def inventory_categories(products):
    names={}
    for name in sorted({p['category'] for p in products}): names.setdefault(category_path(name),name)
    return sorted(names.values(),key=str.casefold)
def absolute(path): return ORIGIN + path
def money(value): return format(Decimal(str(value)).quantize(Decimal('.01'),rounding=ROUND_HALF_UP), '.2f')


def index_allowed():
    # Explicit production opt-in plus a production APP_ORIGIN prevents preview indexing.
    return (os.getenv('SEO_INDEXING','false').lower() == 'true'
        and os.getenv('APP_ORIGIN','').strip().rstrip('/') == ORIGIN
        and request.host.split(':')[0].lower()=='adepapay.com')


def json_ld(nodes):
    return json.dumps({'@context':'https://schema.org','@graph':nodes},ensure_ascii=False).replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026')


class Assets(HTMLParser):
    def __init__(self):
        super().__init__(); self.styles=[]; self.scripts=[]; self.preloads=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='script' and a.get('type')=='module' and a.get('src','').startswith('/assets/'):
            self.scripts.append(a['src'])
        if tag=='link' and a.get('href','').startswith('/assets/'):
            if a.get('rel')=='stylesheet': self.styles.append(a['href'])
            if a.get('rel')=='modulepreload': self.preloads.append(a['href'])


def assets(dist):
    parser=Assets(); parser.feed((dist/'index.html').read_text(encoding='utf-8')); return parser


def responsive_srcset(url):
    # Flexible variants must first be enabled on the existing Cloudflare account.
    # The original, stable public variant remains the fallback and schema image.
    if os.getenv('CF_IMAGES_RESPONSIVE','false').lower()!='true': return ''
    parsed=urlsplit(url)
    parts=parsed.path.strip('/').rsplit('/',1)
    if parsed.scheme!='https' or parsed.hostname!='imagedelivery.net' or len(parts)!=2 or parsed.query: return ''
    base='https://imagedelivery.net/'+parts[0]+'/'
    return ', '.join(f'{base}w={width},fit=scale-down,format=auto,quality=80 {width}w' for width in (320,640,960,1280))


def identity():
    return [
      {'@type':'Organization','@id':ORIGIN+'/#organization','name':'AdepaPay','url':ORIGIN+'/', 'logo':absolute('/images/adepa_pay_logo.png')},
      {'@type':'WebSite','@id':ORIGIN+'/#website','url':ORIGIN+'/', 'name':'AdepaPay','inLanguage':'en-GH','publisher':{'@id':ORIGIN+'/#organization'}},
    ]


def product_schema(product,store):
    url=absolute(product_path(product))
    node={'@type':'Product','@id':url+'#product','url':url,'name':product['name'],'description':product['description'],
          'image':product['images'],'category':product['category'],
          'itemCondition':'https://schema.org/'+('NewCondition' if product['condition']=='New' else 'UsedCondition')}
    if product.get('sku'): node['sku']=product['sku']
    if product.get('ratingCount'):
        node['aggregateRating']={'@type':'AggregateRating','ratingValue':product['rating'],'ratingCount':product['ratingCount'],'bestRating':5,'worstRating':1}
    # A cash offer is the full current cash price, never an installment/deposit.
    # Products without a cash offer still have useful Product markup, without invented offers.
    if product['paymentOptions']['payNow']:
        node['offers']={'@type':'Offer','url':url,'price':money(product['currentPrice']),'priceCurrency':'GHS',
          'availability':'https://schema.org/'+('InStock' if product['inStock'] else 'OutOfStock'),
          'itemCondition':node['itemCondition'],'seller':{'@id':absolute(store_path(store))+'#store'}}
    return node


def store_schema(store):
    url=absolute(store_path(store)); node={'@type':'Organization','@id':url+'#store','url':url,'name':store['name'],'description':store['description']}
    if store.get('logo'): node['logo']=store['logo']
    # Public operating model alone cannot establish a legal/local business address.
    # Organization is intentionally used for online and physical participants alike.
    if store.get('phone'): node['telephone']=store['phone']
    if store.get('contactEmail'): node['email']=store['contactEmail']
    return node


def breadcrumb(entries):
    return {'@type':'BreadcrumbList','itemListElement':[{'@type':'ListItem','position':i+1,'name':name,'item':absolute(path)} for i,(name,path) in enumerate(entries)]}


def page_response(dist,ctx,status=200):
    ctx.setdefault('sections',[]); ctx.setdefault('products',[]); ctx.setdefault('stores',[]); ctx.setdefault('categories',[])
    ctx.setdefault('crumbs',[('Home','/')]); ctx.setdefault('nodes',[])
    ctx.setdefault('description','Explore participating stores and shopping options on AdepaPay in Ghana.')
    ctx.setdefault('image',absolute('/images/adepa_pay_logo.png'))
    ctx.setdefault('indexable',True)
    ctx['robots']='index,follow' if ctx['indexable'] and status==200 and index_allowed() else 'noindex,follow'
    ctx['canonical']=absolute(ctx['path'])
    ctx['schema']=json_ld(identity()+ctx['nodes']+[breadcrumb(ctx['crumbs'])]) if status==200 else None
    ctx['site_page']={'home':'home','products':'browse-products','stores':'browse-stores','store':'store-details'}.get(ctx['kind'],'services' if ctx['path'] in ('/services','/hire-purchase','/layaway','/device-swap') else 'info')
    rendered=render_template('public_document.html',**ctx,about_document=ABOUT_DOCUMENT,assets=assets(dist),origin=ORIGIN,store_path=store_path,
        product_path=product_path,category_path=category_path,money=money,responsive_srcset=responsive_srcset,verification=os.getenv('GOOGLE_SITE_VERIFICATION',''))
    response=Response(rendered,status=status,mimetype='text/html')
    response.headers['Cache-Control']='no-store'
    response.headers['X-Robots-Tag']=ctx['robots']
    response.headers['Content-Language']='en-GH'
    if status==503: response.headers['Retry-After']='60'
    return response


def public_error(dist,status,title):
    return page_response(dist,dict(kind='error',path=request.path,title=title+' | AdepaPay',heading=title,indexable=False,
        sections=[('Continue browsing','Use the public navigation to find a current product or store. Private and removed records are not publicly available.')]),status)


def load_catalogue():
    client=connect_admin();stores,products=snapshot(client)
    try:
        ratings=client.rpc('public_rating_summary',{}).execute().data
        if isinstance(ratings,dict):
            for key,rows in (('stores',stores),('products',products)):
                scores={r['id']:r for r in ratings.get(key,[]) if isinstance(r,dict) and r.get('id')}
                for row in rows:
                    score=scores.get(row['id'])
                    if score and isinstance(score.get('count'),int) and score['count']>0 and isinstance(score.get('rating'),(int,float)) and 1<=score['rating']<=5:
                        row.update(rating=score['rating'],ratingCount=score['count'])
    except (APIError,httpx.HTTPError):
        current_app.logger.warning('Public rating summaries are unavailable; ratings omitted.')
    return stores,products


def listing_page(dist,path,kind,stores,products,category=None):
    args=request.args
    try: page=int(args.get('page','1'))
    except ValueError: return public_error(dist,404,'Page not found')
    if page<1: return public_error(dist,404,'Page not found')
    q=args.get('q','').strip()[:160]; rows=stores if kind=='stores' else products
    if q: rows=[r for r in rows if q.casefold() in (r['name']+' '+r['description']).casefold()]
    for key in ('category','store','condition','region'):
        if args.get(key):
            fields={'category':'category','store':'storeId','condition':'condition','region':'region'}
            rows=[r for r in rows if (args[key] in r.get('categories',[]) if key=='category' and kind=='stores' else r.get(fields[key])==args[key])]
    if kind!='stores':
        for service,(flag,_) in SERVICES.items():
            if args.get('service')==service:
                rows=[p for p in rows if p['swapAvailable']] if flag=='swap' else [p for p in rows if p['paymentOptions'][flag]]
        if args.get('inStock')=='true': rows=[p for p in rows if p['inStock']]
        if args.get('sort') in ('price-low','price-high'): rows=sorted(rows,key=lambda p:(p['currentPrice'],p['id']),reverse=args['sort']=='price-high')
        else: rows=sorted(rows,key=lambda p:(p['name'].casefold(),p['id']))
    else: rows=sorted(rows,key=lambda s:(s['name'].casefold(),s['id']))
    total=len(rows); pages=max(1,math.ceil(total/PAGE_SIZE))
    if page>pages: return public_error(dist,404,'Page not found')
    # Unknown/filter parameters are noindex and self-canonical; do not pretend
    # materially different filtered results are equivalent to the base listing.
    filtered=bool(set(args)-{'page'})
    query=[(k,v) for k in sorted(args) if k!='page' for v in args.getlist(k)]
    if page>1: query.append(('page',str(page)));query.sort()
    canonical=path+('?' + urlencode(query) if query else '')
    title,description,_=STATIC.get(path,(f'{category} Products in Ghana | AdepaPay',f'Browse {category} from currently participating stores in Ghana. Compare published prices and available purchase options.',[]))
    heading=category or ('Stores in Ghana' if kind=='stores' else 'Products & prices in Ghana')
    if page>1: title=f'{heading} – Page {page} | AdepaPay'
    if q: title=f'Search results for {q} | AdepaPay';heading=f'Search results for {q}'
    pager=[]
    for number in sorted({1,page-1,page,page+1,pages}):
        if 1<=number<=pages:
            params=[(k,v) for k,v in query if k!='page']
            if number>1: params.append(('page',str(number)))
            pager.append((number,path+('?' + urlencode(params) if params else '')))
    ctx=dict(kind=kind,path=canonical,title=title,heading=heading,description=description,indexable=not filtered,
        page=page,pages=pages,pager=pager,total=total,q=q,filter_fields=[(k,v) for k,v in query if k not in ('q','page')],
        products=rows[(page-1)*PAGE_SIZE:page*PAGE_SIZE] if kind!='stores' else [],
        stores=rows[(page-1)*PAGE_SIZE:page*PAGE_SIZE] if kind=='stores' else [],
        categories=inventory_categories(products),
        crumbs=[('Home','/'),('Categories','/categories'),(category,path)] if category else [('Home','/'),(heading,path)])
    return page_response(dist,ctx)


def render_public(dist,path):
    if (path.rstrip('/') or '/') in STATIC or path.startswith(('/stores/','/products/','/categories/')):
        if path!='/' and path.endswith('/'): return redirect(path.rstrip('/')+('?' + request.query_string.decode() if request.query_string else ''),301)
        dynamic=path in ('/','/stores','/products','/categories') or path.startswith(('/stores/','/products/','/categories/'))
        try: stores,products=load_catalogue() if dynamic else ([],[])
        except (RuntimeError,APIError,AuthApiError,httpx.HTTPError):
            current_app.logger.warning('Public SEO catalogue is unavailable.')
            return public_error(dist,503,'Catalogue temporarily unavailable')
        if path in ('/stores','/products'): return listing_page(dist,path,path[1:],stores,products)
        if path.startswith('/categories/'):
            category=next((name for name in inventory_categories(products) if category_path(name)==path),None)
            if not category: return public_error(dist,404,'Category not found')
            return listing_page(dist,path,'products',stores,[p for p in products if p['category'].casefold()==category.casefold()],category)
        if path.startswith('/stores/'):
            identifier=path.split('/')[2]; store=next((s for s in stores if s['id']==identifier),None)
            if not store: return public_error(dist,404,'Store not found')
            if path!=store_path(store): return redirect(store_path(store),301)
            selected=[p for p in products if p['storeId']==identifier]
            if request.args: return public_error(dist,404,'Page not found')
            return page_response(dist,dict(kind='store',path=path,heading=store['name'],title=f"{store['name']} – {', '.join(store['categories'][:2]) or 'Store'} in {store['city'] or store['region'] or 'Ghana'} | AdepaPay",
                description=(store['description'] or f"Browse published products from {store['name']} in {store['city'] or 'Ghana'}. See prices, available shopping options and public store contact details.")[:160],
                store=store,image=store.get('cover') or store.get('logo') or absolute('/images/adepa_pay_logo.png'),products=selected[:PAGE_SIZE],more_store_products=len(selected)>PAGE_SIZE,categories=store['categories'],
                nodes=[store_schema(store)],crumbs=[('Home','/'),('Stores','/stores'),(store['name'],path)]))
        if path.startswith('/products/'):
            identifier=path.split('/')[2]; product=next((p for p in products if p['id']==identifier),None)
            if not product: return public_error(dist,404,'Product not found')
            if path!=product_path(product): return redirect(product_path(product),301)
            if request.args: return public_error(dist,404,'Page not found')
            store=next(s for s in stores if s['id']==product['storeId'])
            rules={**DEFAULTS,**(store.get('terms') or {})}; plans=[]
            for service,(flag,price_key) in SERVICES.items():
                if not (product['swapAvailable'] if flag=='swap' else product['paymentOptions'][flag]): continue
                total=Decimal(str(product['prices'][price_key])); plan={'service':service,'total':money(total)}
                if service=='hire-purchase':
                    plan.update(deposit=money(min(total,total*Decimal(str(rules['minimumDeposit']))/100)),duration=f"{rules['minimumDuration']}–{rules['maximumDuration']} months",frequencies=['Monthly'])
                elif service=='layaway':
                    cfg=product.get('layaway',{})
                    if cfg.get('depositType') and cfg.get('deposit') is not None:
                        deposit=total*Decimal(str(cfg['deposit']))/100 if cfg['depositType']=='Percentage' else Decimal(str(cfg['deposit']))
                        plan.update(deposit=money(min(total,deposit)),duration=f"Up to {cfg.get('duration')} months",frequencies=cfg.get('frequencies',[]),minimum_installment=money(cfg.get('minimumInstallment',0)))
                plans.append(plan)
            return page_response(dist,dict(kind='product',path=path,title=f"{product['name']} | Price & Payment Options | AdepaPay",heading=product['name'],
                description=f"{product['name']} from {store['name']} in Ghana. View the current GHS prices, condition, availability and supported purchase options."[:160],
                product=product,store=store,plans=plans,terms=store.get('terms'),image=product['images'][0] if product['images'] else absolute('/images/adepa_pay_logo.png'),
                nodes=[store_schema(store),product_schema(product,store)],crumbs=[('Home','/'),('Products','/products'),(product['category'],category_path(product['category'])),(product['name'],path)]))
        title,description,sections=STATIC[path]
        if path=='/about':
            return page_response(dist,dict(kind='about',path=path,title='About AdepaPay | Bridgeway Technology Limited',heading=ABOUT_DOCUMENT['title'],
                description='Meet AdepaPay, the hire-purchase ecosystem for Ghana operated by Bridgeway Technology Limited. Learn about our platform, users and role.',
                indexable=not request.args,crumbs=[('Home','/'),('About AdepaPay',path)]))
        if path in ('/privacy','/terms'):
            document=LEGAL_DOCUMENTS[path[1:]]
            return page_response(dist,dict(kind='legal',path=path,title=document['title']+' | AdepaPay',heading=document['blocks'][0]['text'],
                description=('Read the AdepaPay Privacy Policy from Bridgeway Technology Limited.' if path=='/privacy' else 'Read the AdepaPay Terms and Conditions from Bridgeway Technology Limited.'),
                legal_document=document, indexable=not request.args,crumbs=[('Home','/'),(document['title'],path)]))
        return page_response(dist,dict(kind='home' if path=='/' else 'categories' if path=='/categories' else 'info',path=path,title=title,
            heading='Shop on your terms in Ghana' if path=='/' else title.split(' | ')[0],description=description,sections=sections,
            products=sorted(products,key=lambda p:(p.get('rating') or 0,p.get('ratingCount') or 0,p['createdAt'],p['id']),reverse=True)[:6] if path=='/' else [],
            stores=sorted(stores,key=lambda s:(-(s.get('rating') or 0),-(s.get('ratingCount') or 0),s['name'].casefold(),s['id']))[:6] if path=='/' else [],
            categories=inventory_categories(products),counts={'stores':len(stores),'products':len(products)},
            indexable=not request.args,crumbs=[('Home','/')] if path=='/' else [('Home','/'),(title.split(' | ')[0],path)]))
    return None


def sitemap_entries(stores,products):
    categories=inventory_categories(products)
    entries={
      'static':[{'loc':absolute(path)} for path in STATIC],
      'stores':[{'loc':absolute(store_path(s)),'lastmod':s.get('updatedAt'),'images':[v for v in (s.get('logo'),s.get('cover')) if v]} for s in stores],
      'products':[{'loc':absolute(product_path(p)),'lastmod':p.get('updatedAt'),'images':p['images']} for p in products],
      'categories':[{'loc':absolute(category_path(name)),'lastmod':max(filter(None,(p.get('updatedAt') for p in products if p['category'].casefold()==name.casefold())),default=None)} for name in categories],
    }
    return entries


def sitemap_response(path):
    if not index_allowed(): return Response('Sitemaps are disabled on this non-indexing deployment.',404,mimetype='text/plain')
    try: entries=sitemap_entries(*load_catalogue())
    except (RuntimeError,APIError,AuthApiError,httpx.HTTPError): return Response('Catalogue temporarily unavailable.',503,headers={'Retry-After':'60'},mimetype='text/plain')
    ns='http://www.sitemaps.org/schemas/sitemap/0.9'; image_ns='http://www.google.com/schemas/sitemap-image/1.1'
    ET.register_namespace('',ns); ET.register_namespace('image',image_ns)
    if path=='/sitemap.xml':
        root=ET.Element('{'+ns+'}sitemapindex')
        for group,rows in entries.items():
            for part in range(math.ceil(len(rows)/SITEMAP_SIZE)):
                item=ET.SubElement(root,'{'+ns+'}sitemap'); ET.SubElement(item,'{'+ns+'}loc').text=absolute(f'/sitemaps/{group}-{part+1}.xml')
    else:
        match=re.fullmatch(r'/sitemaps/(static|stores|products|categories)-([1-9][0-9]*)\.xml',path)
        if not match: return Response('Sitemap not found.',404,mimetype='text/plain')
        group,part=match.groups(); rows=entries[group][(int(part)-1)*SITEMAP_SIZE:int(part)*SITEMAP_SIZE]
        if not rows: return Response('Sitemap not found.',404,mimetype='text/plain')
        root=ET.Element('{'+ns+'}urlset')
        for row in rows:
            item=ET.SubElement(root,'{'+ns+'}url'); ET.SubElement(item,'{'+ns+'}loc').text=row['loc']
            if row.get('lastmod'): ET.SubElement(item,'{'+ns+'}lastmod').text=row['lastmod']
            for image in row.get('images',[])[:1000]:
                child=ET.SubElement(item,'{'+image_ns+'}image'); ET.SubElement(child,'{'+image_ns+'}loc').text=image
    return Response(ET.tostring(root,encoding='utf-8',xml_declaration=True),mimetype='application/xml',headers={'Cache-Control':'no-store'})


def robots_response():
    # Private routes still need noindex responses when crawled; authentication is security.
    text='User-agent: *\nAllow: /\n'
    if index_allowed(): text+='Sitemap: '+absolute('/sitemap.xml')+'\n'
    return Response(text,mimetype='text/plain',headers={'Cache-Control':'no-store'})
