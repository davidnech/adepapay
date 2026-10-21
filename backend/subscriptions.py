"""Prepaid store membership: Paystack Inline checkout, verified exactly once."""
import hashlib
import hmac
import os
import re
from functools import wraps
from urllib.parse import urlsplit, quote
from uuid import UUID, uuid4
import httpx
from flask import jsonify, request, g
from postgrest.exceptions import APIError
from supabase_auth.errors import AuthApiError
try:
    from .session_cookies import access_token
    from .store_team import resolve_store, StoreAccessError
    from .subscription_access import subscription_info
    from .store_directory import directory_row
except ImportError:
    from session_cookies import access_token
    from store_team import resolve_store, StoreAccessError
    from subscription_access import subscription_info
    from store_directory import directory_row


def paystack_key():
    key=os.getenv('PAYSTACK_SECRET_KEY','').strip()
    if not key.startswith(('sk_test_','sk_live_')): raise RuntimeError('Set PAYSTACK_SECRET_KEY in .env and restart the backend.')
    return key


def paystack_public_key():
    secret=paystack_key()
    public=os.getenv('PAYSTACK_PUBLIC_KEY','').strip()
    prefix='pk_test_' if secret.startswith('sk_test_') else 'pk_live_'
    if not public.startswith(prefix) or len(public)<=len(prefix):
        raise RuntimeError('Set PAYSTACK_PUBLIC_KEY and PAYSTACK_SECRET_KEY from the same Paystack account and mode, then restart the backend.')
    return public


def checkout_configured():
    try: paystack_public_key(); return True
    except RuntimeError: return False


def gateway(method,path,payload=None):
    response=httpx.request(method,'https://api.paystack.co'+path,headers={'Authorization':'Bearer '+paystack_key()},json=payload,timeout=20)
    try: data=response.json()
    except ValueError: raise RuntimeError('Paystack returned an unreadable response. Please retry shortly.') from None
    if not response.is_success or not isinstance(data,dict) or data.get('status') is not True or not isinstance(data.get('data'),dict):
        raise RuntimeError('Paystack could not complete this request. Check your payment configuration or retry shortly.')
    return data['data']


def all_rows(client,table):
    result=[]
    while True:
        rows=client.table(table).select('*').order('created_at').range(len(result),len(result)+499).execute().data
        result.extend(rows)
        if len(rows)<500: return result


def verify_payment(client,reference):
    rows=client.table('subscription_orders').select('*').eq('reference',reference).limit(1).execute().data
    if not rows: raise ValueError('Unknown subscription payment reference.')
    order=rows[0]
    if order['status']=='Paid': return {'paid':True}
    data=gateway('GET','/transaction/verify/'+quote(reference,safe=''))
    if data.get('status')!='success': return {'paid':False,'status':data.get('status','pending')}
    if data.get('reference')!=reference or type(data.get('amount')) is not int or data.get('amount')!=order['amount_minor'] or data.get('currency')!=order['currency'] or data.get('domain')!=order['environment'] or str(data.get('customer',{}).get('email','')).lower()!=order['email'].lower():
        raise ValueError('Verified payment does not match this subscription order. Contact support.')
    if not data.get('id') or not data.get('paid_at'): raise ValueError('Payment verification returned incomplete details.')
    client.rpc('activate_store_subscription',dict(p_reference=reference,p_transaction=str(data['id']),p_amount=data['amount'],p_currency=data['currency'],p_email=data['customer']['email'],p_environment=data['domain'],p_paid_at=data['paid_at'])).execute()
    return {'paid':True}


def register_subscriptions(app,connect_db,connect_admin,authorized_admin):
    def guarded(fn):
        @wraps(fn)
        def wrapped(*args,**kwargs):
            try: return fn(*args,**kwargs)
            except APIError as error:
                app.logger.warning('Subscription database request failed: code=%s',error.code)
                if error.code in ('PGRST202','PGRST205','42P01'): return jsonify(error='Apply migration 009_store_subscriptions.sql to enable subscriptions.'),503
                if error.code=='P0001': return jsonify(error=error.message),409
                return jsonify(error='Subscription data could not be saved. Refresh and retry.'),502
            except RuntimeError as error: return jsonify(error=str(error)),503
            except httpx.HTTPError: return jsonify(error='Payment service unavailable. Please retry shortly.'),503
        return wrapped

    def billing_actor():
        token=access_token()
        if not token: raise StoreAccessError('Sign in to your store account.',401)
        auth=connect_db()
        try: user=auth.auth.get_user(token).user
        except AuthApiError:
            refresh=request.cookies.get('adepa_refresh')
            if not refresh: raise StoreAccessError('Please sign in again.',401)
            result=auth.auth.refresh_session(refresh); user=result.user; g.profile_session=result.session
        store=resolve_store(user,connect_admin)  # Billing stays available without a paid term.
        return user,store

    @app.get('/api/auth/store/billing')
    @guarded
    def store_billing():
        actor,store=billing_actor();client=connect_admin()
        plans=client.table('subscription_plans').select('*').eq('enabled',True).order('amount_minor').execute().data
        orders=client.table('subscription_orders').select('reference,plan_name,amount_minor,currency,duration_days,status,paid_at,created_at').eq('store_id',store.id).order('created_at',desc=True).limit(50).execute().data
        return jsonify(subscription=subscription_info(store),plans=plans,orders=orders,canPay=actor.id==store.id,configured=checkout_configured(),storeName=store.app_metadata.get('store_profile',{}).get('storeName') or store.app_metadata['store_review']['application'].get('storeName',''))

    @app.post('/api/auth/store/billing/checkout')
    @guarded
    def checkout():
        actor,store=billing_actor()
        if actor.id!=store.id: raise StoreAccessError('Only the store owner can pay for a subscription.')
        data=request.get_json()
        if not isinstance(data,dict): raise ValueError('Choose a subscription plan.')
        plan_id=str(UUID(str(data.get('planId',''))));client=connect_admin()
        plans=client.table('subscription_plans').select('*').eq('id',plan_id).eq('enabled',True).limit(1).execute().data
        if not plans: raise ValueError('This plan is unavailable. Refresh to see current plans.')
        plan=plans[0]
        if data.get('revision')!=plan['revision']: return jsonify(error='This plan changed. Refresh before paying.'),409
        key=paystack_key()
        public_key=paystack_public_key()
        origin=os.getenv('APP_ORIGIN','').rstrip('/')
        url=urlsplit(origin)
        if not url.netloc or url.scheme not in ('https','http') or url.path or url.query or url.fragment or url.username:
            raise RuntimeError('Set APP_ORIGIN to your website origin, then restart the backend.')
        if key.startswith('sk_live_') and url.scheme!='https': raise RuntimeError('Live payments require an HTTPS APP_ORIGIN.')
        reference='SUB-'+uuid4().hex
        order=dict(reference=reference,store_id=store.id,plan_id=plan_id,plan_name=plan['name'],amount_minor=plan['amount_minor'],duration_days=plan['duration_days'],currency='GHS',email=store.email.lower(),environment='test' if key.startswith('sk_test_') else 'live')
        client.table('subscription_orders').insert(order).execute()
        # Inline initializes with the public key; verification uses the secret key.
        # The stored order remains authoritative even if browser options are changed.
        return jsonify(key=public_key,email=order['email'],amount=order['amount_minor'],currency='GHS',reference=reference,
                       metadata={'purpose':'store_subscription','reference':reference})

    @app.post('/api/auth/store/billing/verify')
    @guarded
    def verify():
        actor,store=billing_actor()
        if actor.id!=store.id: raise StoreAccessError('Only the store owner can verify subscription payments.')
        data=request.get_json();reference=data.get('reference','') if isinstance(data,dict) else ''
        if not isinstance(reference,str) or not re.fullmatch(r'SUB-[a-f0-9]{32}',reference): raise ValueError('Invalid subscription reference.')
        client=connect_admin()
        matches=client.table('subscription_orders').select('reference').eq('reference',reference).eq('store_id',store.id).limit(1).execute().data
        if not matches: raise StoreAccessError('This payment does not belong to your store.')
        return jsonify(**verify_payment(client,reference))

    @app.post('/api/paystack/webhook')
    @guarded
    def webhook():
        request.max_content_length=128*1024
        signature=request.headers.get('x-paystack-signature','')
        expected=hmac.new(paystack_key().encode(),request.get_data(),hashlib.sha512).hexdigest()
        if not hmac.compare_digest(expected,signature): return jsonify(error='Invalid signature.'),401
        event=request.get_json()
        if not isinstance(event,dict): raise ValueError('Invalid webhook event.')
        if event.get('event')!='charge.success': return jsonify(received=True)
        data=event.get('data',{});reference=data.get('reference','') if isinstance(data,dict) else ''
        if not isinstance(reference,str) or not re.fullmatch(r'SUB-[a-f0-9]{32}',reference): return jsonify(received=True)
        client=connect_admin()
        if not client.table('subscription_orders').select('reference').eq('reference',reference).limit(1).execute().data: return jsonify(received=True)
        result=verify_payment(client,reference)
        return jsonify(received=result['paid']),200 if result['paid'] else 503

    @app.route('/api/auth/admin/subscriptions',methods=['GET','POST'])
    @guarded
    def admin_subscriptions():
        if not authorized_admin(): raise StoreAccessError('Administrator sign-in is required.')
        client=connect_admin()
        if request.method=='POST':
            data=request.get_json()
            if not isinstance(data,dict): raise ValueError('Enter plan details.')
            name=data.get('name','');amount=data.get('amount_minor');days=data.get('duration_days');enabled=data.get('enabled')
            if not isinstance(name,str) or not 1<=len(name.strip())<=100 or type(amount) is not int or not 100<=amount<=100000000 or type(days) is not int or not 1<=days<=366 or type(enabled) is not bool: raise ValueError('Provide a plan name, price of GHS 1–1,000,000, duration of 1–366 days, and availability.')
            values=dict(name=name.strip(),amount_minor=amount,duration_days=days,enabled=enabled)
            if data.get('id'):
                plan_id=str(UUID(data['id']));revision=data.get('revision')
                if type(revision) is not int: raise ValueError('Refresh the plan before saving.')
                rows=client.table('subscription_plans').update({**values,'revision':revision+1}).eq('id',plan_id).eq('revision',revision).execute().data
                if not rows: return jsonify(error='This plan changed. Refresh and try again.'),409
            else: rows=client.table('subscription_plans').insert(values).execute().data
            return jsonify(plan=rows[0])
        plans=all_rows(client,'subscription_plans');orders=all_rows(client,'subscription_orders')
        rows=[];page=1
        while True:
            users=client.auth.admin.list_users(page=page,per_page=100)
            for user in users:
                store=directory_row(user)
                if store:
                    rows.append(dict(id=user.id,name=store['storeName'],email=user.email,status=store['status'],**subscription_info(user)))
            if len(users)<100: break
            page+=1
        safe_orders=[{key:o.get(key) for key in ('reference','store_id','plan_name','amount_minor','currency','environment','status','paid_at','created_at')} for o in orders]
        return jsonify(plans=plans,stores=rows,orders=safe_orders,configured=checkout_configured(),mode='test' if os.getenv('PAYSTACK_SECRET_KEY','').startswith('sk_test_') else 'live',paidRevenue=sum(o['amount_minor'] for o in orders if o['status']=='Paid' and o['environment']=='live')/100)
