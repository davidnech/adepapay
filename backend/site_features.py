"""Public homepage and opt-in analytics. Never collect Auth IDs, IPs or URL queries."""
import hashlib
import hmac
import re
from uuid import UUID, uuid4
import httpx
from flask import jsonify, request
from itsdangerous import URLSafeTimedSerializer, BadSignature
from postgrest.exceptions import APIError
from supabase_auth.errors import AuthApiError
try:
    from .public_catalogue import snapshot
except ImportError:
    from public_catalogue import snapshot

CONSENT='adepa_consent'
VISITOR='adepa_visitor'
AGE=180*86400
PAGES={'home','services','browse-stores','store-details','browse-products','register','store-registration','login','forgot-password','info'}


def rank_features(stores,products,ratings):
    for name,rows in [('stores',stores),('products',products)]:
        scores={row['id']:row for row in ratings.get(name,[])}
        for row in rows:
            rating=scores.get(row['id'])
            row.update(rating=float(rating['rating']) if rating else None,ratingCount=int(rating['count']) if rating else 0)
    stores.sort(key=lambda row:(-(row['rating'] or 0),-row['ratingCount'],-(row['productCount'] or 0),row['name'].casefold(),row['id']))
    products=[row for row in products if row['inStock']]
    # Unrated products fall back to newest listings, without manufacturing ratings.
    products=sorted([r for r in products if r['ratingCount']],key=lambda r:(-r['rating'],-r['ratingCount'],r['id']))+sorted([r for r in products if not r['ratingCount']],key=lambda r:(r['createdAt'],r['id']),reverse=True)
    return stores[:6],products[:6]


def register_site_features(app,connect_admin,authorized_admin):
    def signer(): return URLSafeTimedSerializer(app.secret_key,salt='site-consent-v1')
    def consent():
        try:
            value=signer().loads(request.cookies.get(CONSENT,''),max_age=AGE)
            if value.get('version')!=1: return None
            return value
        except (BadSignature,ValueError,TypeError): return None
    def cookie(response,name,value):
        response.set_cookie(name,value,max_age=AGE,httponly=True,secure=app.config.get('SESSION_COOKIE_SECURE',False),samesite='Lax',path='/')

    @app.route('/api/public/consent',methods=['GET','POST'])
    def cookie_consent():
        if request.method=='GET':
            value=consent()
            return jsonify(consent={'analytics':value['analytics']} if value else None)
        request.max_content_length=2048
        data=request.get_json()
        if not isinstance(data,dict) or type(data.get('analytics')) is not bool:
            return jsonify(error='Choose your cookie preferences.'),400
        value={'version':1,'analytics':data['analytics']}
        response=jsonify(consent={'analytics':data['analytics']})
        cookie(response,CONSENT,signer().dumps(value))
        if value['analytics']:
            existing=request.cookies.get(VISITOR,'')
            try: visitor=str(UUID(existing))
            except ValueError: visitor=str(uuid4())
            cookie(response,VISITOR,visitor)
        else: response.delete_cookie(VISITOR,path='/')
        return response

    @app.post('/api/public/traffic')
    def traffic():
        value=consent()
        if not value or value.get('analytics') is not True: return jsonify(error='Analytics consent is required.'),403
        request.max_content_length=2048
        data=request.get_json()
        try:
            visitor=str(UUID(request.cookies.get(VISITOR,'')))
            event=str(UUID(data.get('id','')))
        except (ValueError,AttributeError,TypeError): return jsonify(error='Invalid analytics event.'),400
        if not isinstance(data.get('page'),str) or data['page'] not in PAGES or data.get('device') not in ('Mobile','Tablet','Desktop'):
            return jsonify(error='Invalid analytics event.'),400
        source=data.get('source','Direct')
        if not isinstance(source,str) or len(source)>253 or not re.fullmatch(r'[A-Za-z0-9.-]+',source): return jsonify(error='Invalid referral source.'),400
        digest=hmac.new(app.secret_key.encode(),('site-visitor:'+visitor).encode(),hashlib.sha256).hexdigest()
        try:
            result=connect_admin().rpc('record_site_pageview',{'p_id':event,'p_visitor':digest,'p_page':data['page'],'p_device':data['device'],'p_source':source.lower()}).execute().data
            return jsonify(recorded=result),200 if result else 429
        except (APIError,RuntimeError,httpx.HTTPError): return jsonify(error='Traffic collection is unavailable.'),503

    @app.post('/api/public/engagement')
    def engagement():
        value=consent()
        if not value or value.get('analytics') is not True: return jsonify(error='Analytics consent is required.'),403
        request.max_content_length=2048
        data=request.get_json()
        try:
            visitor=str(UUID(request.cookies.get(VISITOR,'')))
            event=str(UUID(data.get('id','')))
            seconds,scroll,depth=(data.get(key) for key in ('seconds','scrollSeconds','depth'))
            if any(type(x) is not int for x in (seconds,scroll,depth)) or not (0<=scroll<=seconds<=3600 and 0<=depth<=100): raise ValueError()
        except (ValueError,AttributeError,TypeError): return jsonify(error='Invalid engagement event.'),400
        digest=hmac.new(app.secret_key.encode(),('site-visitor:'+visitor).encode(),hashlib.sha256).hexdigest()
        try:
            result=connect_admin().rpc('record_site_engagement',{'p_id':event,'p_visitor':digest,'p_seconds':seconds,'p_scroll_seconds':scroll,'p_depth':depth}).execute().data
            return jsonify(recorded=result)
        except (APIError,RuntimeError,httpx.HTTPError): return jsonify(error='Engagement collection is unavailable.'),503

    @app.get('/api/auth/admin/engagement')
    def engagement_report():
        if not authorized_admin(): return jsonify(error='Administrator access required.'),401
        try: days=int(request.args.get('days','30'))
        except ValueError: return jsonify(error='Choose a valid date range.'),400
        if days not in (7,30,90): return jsonify(error='Choose 7, 30 or 90 days.'),400
        try:
            client=connect_admin()
            report=client.rpc('site_engagement_summary',{'p_days':days}).execute().data
            users=0; page=1
            while True:
                batch=client.auth.admin.list_users(page=page,per_page=100)
                users+=len(batch)
                if len(batch)<100: break
                page+=1
            return jsonify(engagement=report,registeredAccounts=users)
        except (APIError,RuntimeError,httpx.HTTPError): return jsonify(error='Engagement reports are unavailable. Apply migration 008_traffic_engagement.sql.'),503

    @app.get('/api/auth/admin/traffic')
    def traffic_report():
        if not authorized_admin(): return jsonify(error='Administrator access required.'),401
        try: days=int(request.args.get('days','30'))
        except ValueError: return jsonify(error='Choose a valid date range.'),400
        if days not in (7,30,90): return jsonify(error='Choose 7, 30 or 90 days.'),400
        try: return jsonify(report=connect_admin().rpc('site_traffic_summary',{'p_days':days}).execute().data)
        except (APIError,RuntimeError,httpx.HTTPError): return jsonify(error='Traffic reports are unavailable. Apply migration 006_homepage_ratings_analytics.sql.'),503

    @app.get('/api/public/featured')
    def featured():
        try:
            client=connect_admin();missing={}
            stores,products=snapshot(client,missing=missing)
            ratings_available=True
            try: ratings=client.rpc('public_rating_summary',{}).execute().data
            except APIError as error:
                if error.code not in ('PGRST202','PGRST205','42P01','42883'): raise
                ratings={'stores':[],'products':[]};ratings_available=False
            if missing:
                app.logger.warning('Featured catalogue schema unavailable: %s',','.join(sorted(missing)))
            if missing.get('products'):
                for store in stores: store['productCount']=None
            selected_stores,selected_products=rank_features(stores,products,ratings)
            errors={}
            if missing.get('products'): errors['products']='Products are not available yet. The administrator needs to finish setting up the product catalogue.'
            return jsonify(stores=selected_stores,products=selected_products,ratingsAvailable=ratings_available,errors=errors,counts={'stores':len(stores),'products':None if missing.get('products') else len(products)})
        except (APIError,RuntimeError,AuthApiError,httpx.HTTPError) as error:
            app.logger.warning('Featured listings request failed: type=%s code=%s',type(error).__name__,getattr(error,'code','unavailable'))
            return jsonify(error='Featured listings are temporarily unavailable. Please retry.'),503
