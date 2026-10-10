"""Public, allowlisted views of approved stores and active products."""
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from urllib.parse import urlsplit
import httpx
from flask import jsonify, request
from postgrest.exceptions import APIError
from supabase_auth.errors import AuthApiError
try:
    from .subscription_access import subscription_info
except ImportError:
    from subscription_access import subscription_info

try:
    from .store_team import is_owner
    from .store_rules import DEFAULTS
except ImportError:
    from store_team import is_owner
    from store_rules import DEFAULTS


def image_url(value):
    url=value.get('url') if isinstance(value,dict) else None
    return url if isinstance(url,str) and url.startswith('https://imagedelivery.net/') else None


def public_store(user):
    if not is_owner(user) or not subscription_info(user)['active'] or user.app_metadata.get('store_staff') is not None:
        return None
    profile=user.app_metadata.get('store_profile',{})
    reviewed=user.app_metadata['store_review'].get('application',{})
    saved_rules=user.app_metadata.get('store_rules',{})
    values=saved_rules.get('values',{})
    website=profile.get('website','')
    if not isinstance(website,str) or urlsplit(website).scheme not in ('http','https'):
        website=''
    # Do not return Auth email, owner names, registration documents or raw metadata.
    return {'id':user.id,'name':profile.get('storeName') or reviewed.get('storeName','Store'),
        'description':profile.get('description',''),'region':profile.get('region') or reviewed.get('region',''),
        'city':profile.get('city') or reviewed.get('city',''),'address':profile.get('operatingLocation',''),
        'phone':profile.get('phone') or reviewed.get('phone',''),'contactEmail':profile.get('contactEmail',''),
        'website':website,'openingHours':profile.get('openingHours',''),'gpsAddress':profile.get('gpsAddress',''),
        'logo':image_url(profile.get('logo')),'cover':image_url(profile.get('cover')),
        'approved':True,'createdAt':str(getattr(user,'created_at','') or ''),
        'categories':[],'productCount':0,
        'terms':{key:values[key] for key in DEFAULTS if key in values} if saved_rules.get('revision') else None,
        'termsRevision':saved_rules.get('revision',0)}


def snapshot(client, missing=None):
    stores={}
    page=1
    while True:
        users=client.auth.admin.list_users(page=page,per_page=100)
        for user in users:
            store=public_store(user)
            if store: stores[user.id]=store
        if len(users)<100: break
        page+=1
    products=[]
    promotions={}
    ids=list(stores)
    for start in range(0,len(ids),100):
        batch=ids[start:start+100]
        offset=0
        while True:
            try:
                rows=client.table('store_products').select('id,store_id,name,category,description,condition,price,prices,stock,images,payment_options,swap,layaway,created_at').in_('store_id',batch).eq('status','Active').order('id').range(offset,offset+499).execute().data
            except APIError as error:
                if missing is None or error.code not in ('PGRST205','42P01'): raise
                missing['products']=True
                break
            products.extend(rows)
            if len(rows)<500: break
            offset+=500
        try:
            rows=client.table('store_promotion_settings').select('store_id,public_enabled,campaigns').in_('store_id',batch).execute().data
        except APIError as error:
            if missing is None or error.code not in ('PGRST205','42P01'): raise
            missing['promotions']=True
            rows=[]
        promotions.update({row['store_id']:row for row in rows})
    today=datetime.now(timezone.utc).date().isoformat()
    public_products=[]
    for product in products:
        store=stores.get(product['store_id'])
        if not store: continue
        campaigns=promotions.get(store['id'],{})
        eligible=[]
        if campaigns.get('public_enabled'):
            for campaign in campaigns.get('campaigns',[]):
                if not campaign.get('enabled') or not campaign['startsAt']<=today<=campaign['endsAt']: continue
                if campaign['scope']=='All products' or campaign['scope']=='Category' and product['category'] in campaign.get('categories',[]) or campaign['scope']=='Selected products' and product['id'] in campaign.get('productIds',[]):
                    eligible.append(campaign)
        campaign=max(eligible,key=lambda c:c['discountPercent'],default=None)
        price=Decimal(str(product['price']))
        percent=Decimal(str(campaign['discountPercent'])) if campaign else Decimal(0)
        current=(price*(100-percent)/100).quantize(Decimal('.01'),rounding=ROUND_HALF_UP)
        public_products.append({
            'id':product['id'],'storeId':store['id'],'storeName':store['name'],'name':product['name'],
            'category':product['category'],'description':product['description'],'condition':product['condition'],
            'price':float(price),'currentPrice':float(current),'inStock':product['stock']>0,
            'prices':{key:float((Decimal(str(product.get('prices',{}).get(key,product['price'])))*(100-percent)/100).quantize(Decimal('.01'),rounding=ROUND_HALF_UP)) for key in ('hire_purchase','layaway','swap')},
            'images':[url for item in product['images'] if (url:=image_url(item))],
            'paymentOptions':{key:bool(product['payment_options'].get(key)) for key in ('payNow','hirePurchase','layaway')},
            'swapAvailable':product.get('swap',{}).get('enabled') is True,
            'createdAt':product['created_at'],
            'promotion':{'name':campaign['name'],'percent':float(percent),'endsAt':campaign['endsAt']} if campaign else None})
        store['productCount']+=1
        if product['category'] not in store['categories']: store['categories'].append(product['category'])
    return list(stores.values()),public_products


def register_public_catalogue(app,connect_admin):
    @app.get('/api/public/stores')
    @app.get('/api/public/products')
    @app.get('/api/public/stores/<store_id>')
    def catalogue(store_id=None):
        try:
            page=int(request.args.get('page','1'))
            if not 1<=page<=100000: raise ValueError()
        except ValueError:
            return jsonify(error='Choose a valid page.'),400
        try:
            stores,products=snapshot(connect_admin())
        except (RuntimeError,APIError,AuthApiError,httpx.HTTPError):
            app.logger.warning('Public catalogue data is unavailable.')
            return jsonify(error='The catalogue is temporarily unavailable. Please try again shortly.'),503
        if store_id:
            store=next((row for row in stores if row['id']==store_id),None)
            if not store: return jsonify(error='This store is unavailable or no longer approved.'),404
            return jsonify(store=store)
        query=request.args.get('q','').strip().casefold()
        category=request.args.get('category','')
        region=request.args.get('region','')
        if any(len(value)>160 for value in (query,category,region)):
            return jsonify(error='Please shorten your search.'),400
        facets={'categories':sorted({p['category'] for p in products}),
                'regions':sorted({s['region'] for s in stores if s['region']}),
                'stores':[{'id':s['id'],'name':s['name']} for s in sorted(stores,key=lambda s:s['name'].casefold())]}
        if request.path.endswith('/products'):
            selected_store=request.args.get('store','')
            payment=request.args.get('payment','')
            condition=request.args.get('condition','')
            if payment not in ('','payNow','hirePurchase','layaway') or condition not in ('','New','Used'):
                return jsonify(error='Choose valid product filters.'),400
            bounds=[]
            for key in ('min','max'):
                value=request.args.get(key,'').strip()
                try:
                    bound=Decimal(value) if value else None
                    if bound is not None and (not bound.is_finite() or bound<0 or bound>9999999999.99): raise InvalidOperation()
                except InvalidOperation: return jsonify(error='Enter a valid price range.'),400
                bounds.append(bound)
            minimum,maximum=bounds
            if minimum is not None and maximum is not None and minimum>maximum:
                return jsonify(error='Minimum price cannot exceed maximum price.'),400
            price_kind='swap' if request.args.get('swap')=='true' else {'hirePurchase':'hire_purchase','layaway':'layaway'}.get(payment)
            def selected_price(product):
                return product['prices'][price_kind] if price_kind else product['currentPrice']
            regions={s['id']:s['region'] for s in stores}
            rows=[p for p in products if (not query or query in f"{p['name']} {p['description']} {p['storeName']}".casefold())
                  and (not request.args.get('product') or p['id']==request.args.get('product')) and (not selected_store or p['storeId']==selected_store) and (not category or p['category']==category)
                  and (not region or regions[p['storeId']]==region) and (not payment or p['paymentOptions'][payment])
                  and (request.args.get('swap')!='true' or p['swapAvailable']) and (not condition or p['condition']==condition) and (request.args.get('inStock')!='true' or p['inStock'])
                  and (minimum is None or Decimal(str(selected_price(p)))>=minimum) and (maximum is None or Decimal(str(selected_price(p)))<=maximum)]
            sort=request.args.get('sort','newest')
            if sort not in ('newest','name','price-low','price-high'): return jsonify(error='Choose a valid sort order.'),400
            rows.sort(key=lambda row:(selected_price(row),row['id']) if sort.startswith('price-') else (row['name'].casefold(),row['id']) if sort=='name' else (row['createdAt'],row['id']),reverse=sort in ('newest','price-high'))
        else:
            rows=[s for s in stores if (not query or query in f"{s['name']} {s['description']} {s['city']}".casefold())
                  and (not category or category in s['categories']) and (not region or s['region']==region)]
            sort=request.args.get('sort','name')
            if sort not in ('name','newest','products'): return jsonify(error='Choose a valid sort order.'),400
            rows.sort(key=lambda row:(row['productCount'],row['id']) if sort=='products' else (row['createdAt'],row['id']) if sort=='newest' else (row['name'].casefold(),row['id']),reverse=sort!='name')
        page=min(page,max(1,(len(rows)+11)//12))
        return jsonify(items=rows[(page-1)*12:page*12],total=len(rows),page=page,pageSize=12,facets=facets)
