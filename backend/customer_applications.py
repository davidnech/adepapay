"""Customer applications, store decisions, recorded payments and private documents."""
import calendar
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID, uuid4
import re
import hashlib
import json
import httpx
from flask import g, jsonify, request, Response
from itsdangerous import URLSafeTimedSerializer, BadSignature
from postgrest.exceptions import APIError
from supabase_auth.errors import AuthApiError
try:
    from .session_cookies import access_token
    from .subscription_access import subscription_info
    from .store_insights import register_store_insights
except ImportError:
    from session_cookies import access_token
    from subscription_access import subscription_info
    from store_insights import register_store_insights

try:
    from .store_team import StoreAccessError, is_owner
    from .store_products import number, text_field
    from .store_rules import DEFAULTS
    from .image_uploader import upload_image, download_private_image, ImageUploadError
except ImportError:
    from store_team import StoreAccessError, is_owner
    from store_products import number, text_field
    from store_rules import DEFAULTS
    from image_uploader import upload_image, download_private_image, ImageUploadError

KINDS=('hire_purchase','layaway','swap')
PERMISSIONS={'dashboard':'dashboard','reports':'reports','applications':'applications','layaway':'layaway-plans','swap':'swap-management','purchases':'active-purchases','payments':'payments','customers':'customers','notifications':'notifications'}
PROFILE_FIELDS=('firstName','middleName','lastName','phone','region','city','address','gender','dob')


def identifier(value):
    try: return str(UUID(str(value)))
    except (ValueError,TypeError): raise ValueError('Invalid record reference.') from None


def rows_for(client,table,key,value):
    rows=[]; offset=0
    while True:
        batch=client.table(table).select('*').eq(key,value).order('created_at',desc=True).order('id').range(offset,offset+499).execute().data
        rows.extend(batch)
        if len(batch)<500: return rows
        offset+=500


def money(value): return Decimal(str(value)).quantize(Decimal('.01'),rounding=ROUND_HALF_UP)


def quote_digest(quote):
    # Stock revisions may change independently; commercial terms must be reviewed again.
    return hashlib.sha256(json.dumps({k:v for k,v in quote.items() if k!='productRevision'},sort_keys=True).encode()).hexdigest()


def quote_for(client,product_id,kind):
    if kind not in KINDS: raise ValueError('Choose hire purchase, layaway or swap.')
    rows=client.table('store_products').select('*').eq('id',identifier(product_id)).limit(1).execute().data
    if not rows or rows[0]['status']!='Active' or rows[0]['stock']<1: raise ValueError('This product is currently unavailable.')
    product=rows[0]
    store=client.auth.admin.get_user_by_id(product['store_id']).user
    if not store or not is_owner(store) or not subscription_info(store)['active']: raise ValueError('This store is not currently available for new applications.')
    if kind=='swap':
        if not product['swap'].get('enabled'): raise ValueError('Swaps are not offered for this product.')
    elif not product['payment_options'].get('hirePurchase' if kind=='hire_purchase' else 'layaway'):
        raise ValueError('This payment option is not offered for this product.')
    settings=store.app_metadata.get('store_rules',{})
    rules={**DEFAULTS,**settings.get('values',{})}
    promotions=client.table('store_promotion_settings').select('public_enabled,campaigns').eq('store_id',store.id).limit(1).execute().data
    percent=0
    today=datetime.now(timezone.utc).date().isoformat()
    if promotions and promotions[0]['public_enabled']:
        for campaign in promotions[0]['campaigns']:
            if campaign['enabled'] and campaign['startsAt']<=today<=campaign['endsAt'] and (campaign['scope']=='All products' or campaign['scope']=='Category' and product['category'] in campaign['categories'] or campaign['scope']=='Selected products' and product['id'] in campaign['productIds']):
                percent=max(percent,campaign['discountPercent'])
    price=money(money(product.get('prices',{}).get(kind,product['price']))*(100-Decimal(str(percent)))/100)
    config=product.get('layaway',{})
    minimum=money(price*Decimal(str(rules['minimumDeposit']))/100)
    min_months,max_months=int(rules['minimumDuration']),int(rules['maximumDuration'])
    frequencies=['Monthly']
    if kind=='layaway':
        minimum=money(price*Decimal(str(config['deposit']))/100) if config['depositType']=='Percentage' else money(config['deposit'])
        min_months,max_months=1,int(config['duration']); frequencies=config['frequencies']
    if kind=='swap': minimum=price; min_months=max_months=1
    return {'productId':product['id'],'productRevision':product['revision'],'storeId':store.id,
        'productName':product['name'],'storeName':store.app_metadata.get('store_profile',{}).get('storeName') or store.app_metadata['store_review']['application'].get('storeName',''),
        'price':float(price),'minimumDeposit':float(min(minimum,price)),'minMonths':min_months,'maxMonths':max_months,
        'frequencies':frequencies,'guarantorsRequired':kind=='hire_purchase' and rules['requireGuarantors'],
        'rules':rules,'rulesRevision':settings.get('revision',0),'layaway':config if kind=='layaway' else {},
        'swap':product.get('swap',{}) if kind=='swap' else {},'kind':kind}


def application_values(data,quote,user,secret):
    try:
        proof=URLSafeTimedSerializer(secret,salt='application-quote').loads(data.get('quoteToken'),max_age=86400)
        if proof['customer']!=user.id or proof['quote']!=quote_digest(quote): raise ValueError()
    except (BadSignature,ValueError,KeyError,TypeError): raise ValueError('The product terms changed or your quote expired. Reload the quote and review the terms.') from None
    if data.get('acceptedTerms') is not True: raise ValueError('Accept the store terms before applying.')
    if money(number(data,'expectedPrice',0,9999999999.99))!=money(quote['price']): raise ValueError('The price changed. Reload the quote and review it before applying.')
    details={key:text_field(data,key,300,key in ('fullName','phone','address','ghanaCard')) for key in ('fullName','phone','address','ghanaCard','employment','deliveryNote')}
    if not re.fullmatch(r'(?:\+233|233|0)[235]\d{8}',re.sub(r'[\s()-]','',details['phone'])): raise ValueError('Enter a valid Ghanaian phone number.')
    details['ghanaCard']=details['ghanaCard'].upper()
    if not re.fullmatch(r'GHA-\d{9}-\d',details['ghanaCard']): raise ValueError('Use Ghana Card format GHA-123456789-0.')
    details['email']=user.email
    details['acceptedAt']=datetime.now(timezone.utc).isoformat()
    if quote['kind']=='hire_purchase':
        details['monthlyIncome']=number(data,'monthlyIncome',0,9999999999.99)
        if not details['employment']: raise ValueError('Provide employment or income source details.')
    details['guarantors']=[]
    if quote['guarantorsRequired']:
        values=data.get('guarantors')
        if not isinstance(values,list) or len(values)!=2 or data.get('guarantorConsent') is not True: raise ValueError('Provide two guarantors and confirm their consent.')
        for value in values:
            if not isinstance(value,dict): raise ValueError('Enter valid guarantor details.')
            row={key:text_field(value,key,300) for key in ('name','phone','relationship','address')}
            if not re.fullmatch(r'(?:\+233|233|0)[235]\d{8}',re.sub(r'[\s()-]','',row['phone'])): raise ValueError('Enter a valid guarantor phone number.')
            details['guarantors'].append(row)
        if re.sub(r'\D','',details['guarantors'][0]['phone'])[-9:]==re.sub(r'\D','',details['guarantors'][1]['phone'])[-9:]: raise ValueError('Provide two different guarantors.')
    slots=['front','back']
    if quote['kind']=='swap':
        details.update(device=text_field(data,'device',160),serial=text_field(data,'serial',100),deviceCondition=data.get('deviceCondition'))
        if details['deviceCondition'] not in ('Like New','Excellent','Good','Fair','Needs Repair'): raise ValueError('Choose the device condition.')
        conditions=('Like New','Excellent','Good','Fair','Needs Repair')
        if conditions.index(details['deviceCondition'])>conditions.index(quote['swap']['minimumCondition']): raise ValueError('The device does not meet this product\'s minimum trade-in condition.')
        slots.append('devicePhoto')
    details['documents']={}
    supplied=data.get('documents',{})
    if not isinstance(supplied,dict): raise ValueError('Upload your application documents.')
    signer=URLSafeTimedSerializer(secret,salt='customer-document')
    for slot in slots:
        try:
            proof=signer.loads(supplied[slot]['upload_token'],max_age=86400)
            if proof['customer']!=user.id or proof['purpose']!='application': raise ValueError()
            details['documents'][slot]={'id':proof['id']}
        except (BadSignature,ValueError,KeyError,TypeError): raise ValueError('Upload the Ghana Card images and swap device photo before applying.') from None
    months=int(number(data,'months',quote['minMonths'],quote['maxMonths'],True)) if quote['kind']!='swap' else 1
    frequency=data.get('frequency','Monthly')
    if frequency not in quote['frequencies']: raise ValueError('Choose an available payment frequency.')
    deposit=money(number(data,'deposit',quote['minimumDeposit'],quote['price'])) if quote['kind']!='swap' else money(quote['price'])
    count=months if frequency=='Monthly' else months*4 if frequency=='Weekly' else months*30
    if quote['kind']=='layaway' and deposit<money(quote['price']) and (money(quote['price'])-deposit)/count<Decimal(str(quote['layaway']['minimumInstallment'])):
        raise ValueError('The installment would be below the store minimum. Choose a shorter duration or another frequency.')
    return {'reference':'APP-'+uuid4().hex[:12].upper(),'request_id':identifier(data.get('requestId')),
        'customer_id':user.id,'store_id':quote['storeId'],'product_id':quote['productId'],'kind':quote['kind'],'details':details,
        'snapshot':{'productName':quote['productName'],'storeName':quote['storeName'],'price':quote['price'],'rules':quote['rules'],'rulesRevision':quote['rulesRevision'],'layaway':quote['layaway'],'swap':quote['swap']},
        'terms':{'months':months,'frequency':frequency,'installments':count,'offerDays':quote['swap'].get('validityDays',7)},
        'total':quote['price'],'deposit':float(deposit)}


def schedule_for(row):
    if not row.get('approved_at'): return []
    start=datetime.fromisoformat(row['approved_at'].replace('Z','+00:00')).date()
    total=money(row['total']); deposit=money(row['deposit']); remaining=total-deposit
    count=int(row['terms']['installments']); frequency=row['terms']['frequency']
    installments=[{'date':start.isoformat(),'amount':float(deposit),'label':'Deposit'}] if deposit>0 else []
    cents=int(remaining*100)
    for index in range(1,count+1):
        amount=Decimal(cents//count+(1 if index<=cents%count else 0))/100
        if amount<=0: continue
        if frequency=='Monthly':
            m=start.month-1+index; year=start.year+m//12; month=m%12+1
            due=date(year,month,min(start.day,calendar.monthrange(year,month)[1]))
        else: due=start+timedelta(days=index*(7 if frequency=='Weekly' else 1))
        installments.append({'date':due.isoformat(),'amount':float(amount),'label':f'Installment {index}'})
    paid=money(row['paid'])
    for installment in installments:
        value=money(installment['amount']); used=min(paid,value); paid-=used
        installment['remaining']=float(value-used)
    return installments


def serialize(row,view=None):
    result={**row,'details':{**row['details']},'schedule':schedule_for(row)}
    result['details']['documents']={slot:{'url':f'/api/auth/customer/document?application={row["id"]}&slot={slot}'} for slot in row['details'].get('documents',{})}
    if view and view not in ('applications','layaway','swap','purchases'):
        result['details']={key:result['details'].get(key,'') for key in ('fullName','email','phone')}
        result['details'].update(documents={},guarantors=[])
    return result


def register_customer_applications(app,owner,connect_db,connect_admin):
    def actor(customer=True):
        token=access_token()
        if not token: raise StoreAccessError('Sign in to your customer account to continue.',401)
        client=connect_db()
        try: user=client.auth.get_user(token).user
        except AuthApiError as error:
            if getattr(error,'status',0) not in (401,403): raise
            refresh=request.cookies.get('adepa_refresh')
            if not refresh: raise StoreAccessError('Sign in again to continue.',401)
            result=client.auth.refresh_session(refresh); user=result.user; g.profile_session=result.session
        if not user: raise StoreAccessError('Sign in again to continue.',401)
        if customer and (user.app_metadata.get('role','Customer')!='Customer' or user.app_metadata.get('store_staff') or user.app_metadata.get('field_agent_store')):
            raise StoreAccessError('This feature requires a customer account.')
        return user

    def store_scope(view):
        if view not in PERMISSIONS: raise ValueError('Choose a valid workspace page.')
        store,error=owner(PERMISSIONS[view])
        if error: raise StoreAccessError('Sign in to your store account.',401)
        return store

    def scope_rows(client,scope,key,view):
        rows=rows_for(client,'customer_applications',key,scope)
        if view=='swap': rows=[row for row in rows if row['kind']=='swap']
        elif view=='layaway': rows=[row for row in rows if row['kind']=='layaway']
        return rows

    def guarded(fn):
        from functools import wraps
        @wraps(fn)
        def run(*args,**kwargs):
            try: return fn(*args,**kwargs)
            except APIError as error:
                if request.path == '/api/auth/customer/notifications' and error.code in ('PGRST205','42P01'):
                    return jsonify(error='Customer notifications need database setup. Apply migration 014_admin_platform.sql followed by 015_customer_notifications.sql, or run backend/setup_database.sql.'),503
                if request.path == '/api/auth/store/agent-accounts' and error.code in ('PGRST205','42P01'):
                    return jsonify(error='Agent accounts need database setup. Run backend/setup_database.sql, including the agent settlement tables from migration 013.'),503
                if request.path.endswith('/search') and error.code in ('PGRST205','42P01'):
                    return jsonify(error='Workspace search needs database setup. Run backend/setup_database.sql in Supabase SQL Editor, then refresh.'),503
                if request.path == '/api/auth/store/notifications' and error.code in ('PGRST205','42P01'):
                    return jsonify(error='The notification inbox needs database setup. Apply migrations 001-012, including 012_store_notifications.sql, then refresh.'),503
                if request.path == '/api/auth/store/reports' and error.code in ('PGRST205','42P01'):
                    return jsonify(error='Store reports need the products, agents, application and payment tables. Run backend/setup_database.sql in Supabase SQL Editor, then refresh.'),503
                if error.code in ('PGRST205','PGRST202','42P01') or str(error.code)=='404':
                    if request.path=='/api/auth/customer/rating': return jsonify(error='Ratings are unavailable. Ask the administrator to apply migration 006_homepage_ratings_analytics.sql.'),503
                    return jsonify(error='Application tables are not ready. Ask the administrator to run migration 005_customer_applications.sql after migrations 001–004.'),503
                if error.code=='23505': return jsonify(error='An open application, receipt reference or trade-in device already exists. Refresh to check it.'),409
                if error.code=='P0001': return jsonify(error=error.message),409
                app.logger.warning('Application database error: code=%s',error.code)
                return jsonify(error='The request could not be completed. Refresh before retrying.'),503
            except (httpx.HTTPError,RuntimeError): return jsonify(error='The service is temporarily unavailable. Refresh before retrying.'),503
        return run

    register_store_insights(app,store_scope,connect_admin,rows_for,guarded)
    try:
        from .portal_workspace import register_portal_workspace
    except ImportError:
        from portal_workspace import register_portal_workspace
    register_portal_workspace(app,actor,owner,connect_admin,rows_for,guarded)

    @app.get('/api/auth/customer/quote')
    @guarded
    def quote():
        user=actor()
        value=quote_for(connect_admin(),request.args.get('product'),request.args.get('kind'))
        token=URLSafeTimedSerializer(app.secret_key,salt='application-quote').dumps({'customer':user.id,'quote':quote_digest(value)})
        return jsonify(quote={**value,'token':token})

    @app.route('/api/auth/customer/rating',methods=['GET','POST'])
    @guarded
    def purchase_rating():
        user=actor();client=connect_admin()
        if request.method=='GET':
            rows=client.table('purchase_ratings').select('application_id,store_score,product_score').eq('customer_id',user.id).eq('application_id',identifier(request.args.get('application'))).limit(1).execute().data
            return jsonify(rating=rows[0] if rows else None)
        request.max_content_length=2048
        data=request.get_json()
        if not isinstance(data,dict): raise ValueError('Provide your ratings.')
        result=client.rpc('save_purchase_rating',{'p_application':identifier(data.get('application')),'p_customer':user.id,'p_store_score':number(data,'storeScore',1,5,True),'p_product_score':number(data,'productScore',1,5,True)}).execute().data
        return jsonify(rating=result)

    @app.route('/api/auth/customer/applications',methods=['GET','POST'])
    @app.route('/api/auth/store/customer-applications/<view>',methods=['GET','POST'])
    @guarded
    def applications(view=None):
        client=connect_admin()
        store=store_scope(view) if view else None
        user=g.store_actor if store else actor()
        scope=store.id if store else user.id; key='store_id' if store else 'customer_id'
        if request.method=='GET':
            rows=scope_rows(client,scope,key,view)
            ids={row['id'] for row in rows}
            payments=[p for p in rows_for(client,'application_payments',key,scope) if p['application_id'] in ids]
            events=[e for e in rows_for(client,'application_events',key,scope) if e['application_id'] in ids]
            response=jsonify(applications=[serialize(row,view) for row in rows],payments=payments,events=events)
            response.headers['Cache-Control']='private, no-store'
            return response
        request.max_content_length=64*1024
        data=request.get_json()
        if not isinstance(data,dict): raise ValueError('Provide application details.')
        if not store and data.get('action')=='submit':
            existing=client.table('customer_applications').select('*').eq('customer_id',user.id).eq('request_id',identifier(data.get('requestId'))).limit(1).execute().data
            if existing: return jsonify(application=serialize(existing[0]))
            quote=quote_for(client,data.get('productId'),data.get('kind'))
            values=application_values(data,quote,user,app.secret_key)
            result=client.rpc('submit_customer_application',{'p_record':values,'p_product_revision':quote['productRevision']}).execute().data
            return jsonify(application=serialize(result)),201
        app_id=identifier(data.get('id'))
        matches=client.table('customer_applications').select('*').eq('id',app_id).eq(key,scope).limit(1).execute().data
        if not matches: return jsonify(error='Application not found.'),404
        row=matches[0]; action=data.get('action'); action_data={}
        if type(data.get('revision')) is not int: raise ValueError('Refresh the application before continuing.')
        if store:
            allowed=('payment',) if view=='payments' else ('approve','reject','offer','fulfill','cancel','adjust_price') if view in ('applications','swap','layaway','purchases') else ()
            if action not in allowed: raise StoreAccessError('This page does not permit that action.')
            if view in ('swap','layaway') and row['kind']!=view: raise StoreAccessError('This application belongs to a different workspace page.')
        elif action not in ('cancel','accept'): raise StoreAccessError('Customers cannot approve applications or confirm payments.')
        if action in ('offer','reject'):
            action_data['reason']=text_field(data,'reason',1000)
        if action=='offer': action_data['credit']=number(data,'credit',0,row['snapshot']['price'])
        if action=='adjust_price':
            action_data.update(price=number(data,'price',.01,9999999999.99),reason=text_field(data,'reason',1000))
            if len(action_data['reason'])<3: raise ValueError('Provide a reason of at least 3 characters for this price adjustment.')
        if action=='payment':
            action_data.update(amount=number(data,'amount',.01,9999999999.99),reference=text_field(data,'reference',100),request_id=identifier(data.get('requestId')),method=data.get('method'))
            if action_data['method'] not in ('Cash','Mobile Money','Bank Transfer') or data.get('confirmedReceived') is not True: raise ValueError('Confirm a payment actually received by the store.')
        if action=='fulfill':
            if data.get('handoverConfirmed') is not True: raise ValueError('Confirm that the product has been handed over.')
            action_data['device_received']=data.get('deviceReceived') is True
        result=client.rpc('act_on_customer_application',{'p_id':app_id,'p_scope_id':scope,'p_customer':not bool(store),'p_actor':user.id,'p_revision':data['revision'],'p_action':action,'p_data':action_data}).execute().data
        return jsonify(application=serialize(result,view))

    @app.post('/api/auth/customer/upload')
    @guarded
    def upload():
        user=actor(); purpose=request.args.get('purpose','application')
        if purpose not in ('application','profile'): raise ValueError('Invalid upload purpose.')
        try: image=upload_image(request.files.get('image'),user.id,private=True)
        except ImageUploadError as error: return jsonify(error=str(error)),502
        token=URLSafeTimedSerializer(app.secret_key,salt='customer-document').dumps({'customer':user.id,'purpose':purpose,'id':image['id']})
        return jsonify(image={'id':image['id'],'url':'/api/auth/customer/document?ticket='+token,'upload_token':token})

    @app.get('/api/auth/customer/document')
    @guarded
    def document():
        user=actor(False); slot=request.args.get('slot'); ticket=request.args.get('ticket')
        if ticket:
            try:
                proof=URLSafeTimedSerializer(app.secret_key,salt='customer-document').loads(ticket,max_age=86400)
                if proof['customer']!=user.id: raise ValueError()
                image_id=proof['id']
            except (BadSignature,KeyError,ValueError): return jsonify(error='Image preview expired.'),403
        elif request.args.get('profile')=='self':
            image_id=user.user_metadata.get('customerPhoto',{}).get('id')
        else:
            rows=connect_admin().table('customer_applications').select('*').eq('id',identifier(request.args.get('application'))).limit(1).execute().data
            if not rows: return jsonify(error='Document not found.'),404
            row=rows[0]
            if row['customer_id']!=user.id:
                permission='swap-management' if row['kind']=='swap' else 'applications'
                # The calling workspace supplies its view; permission is independently verified.
                view=request.args.get('view')
                if view in ('applications','layaway','purchases','swap') and (view not in ('layaway','swap') or row['kind']==view): permission=PERMISSIONS[view]
                store,error=owner(permission)
                if error or store.id!=row['store_id']: return jsonify(error='Document access denied.'),403
            image_id=row['details'].get('documents',{}).get(slot,{}).get('id')
        if not image_id: return jsonify(error='Image not found.'),404
        try: content,mime=download_private_image(image_id)
        except ImageUploadError as error: return jsonify(error=str(error)),502
        return Response(content,mimetype=mime,headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'})

    @app.route('/api/auth/customer/account',methods=['GET','POST'])
    @guarded
    def account():
        user=actor(); meta=user.user_metadata
        if request.method=='POST':
            data=request.get_json()
            if not isinstance(data,dict): raise ValueError('Provide your account details.')
            if data.get('action')=='password':
                current=data.get('currentPassword'); new=data.get('password')
                if not isinstance(current,str) or not current or len(current)>256 or not isinstance(new,str) or not 8<=len(new)<=256: raise ValueError('Enter your current password and a new password of at least eight characters.')
                if current==new: raise ValueError('Choose a different new password.')
                verified=connect_db().auth.sign_in_with_password({'email':user.email,'password':current})
                if verified.user.id!=user.id: raise StoreAccessError('Unable to verify your account.',401)
                connect_admin().auth.admin.update_user_by_id(user.id,{'password':new})
                return jsonify(message='Password updated.')
            clean={key:text_field(data,key,300,key in ('firstName','lastName','phone','region','city','address')) for key in PROFILE_FIELDS}
            if not re.fullmatch(r'(?:\+233|233|0)[235]\d{8}',re.sub(r'[\s()-]','',clean['phone'])): raise ValueError('Enter a valid Ghanaian phone number.')
            if clean['gender'] not in ('Male','Female'): raise ValueError('Choose Male or Female.')
            born=date.fromisoformat(clean['dob']); today=datetime.now(timezone.utc).date(); age=today.year-born.year-((today.month,today.day)<(born.month,born.day))
            if not 18<=age<=120: raise ValueError('Customers must be at least 18 years old.')
            clean.update(nationality='Ghana',receiveUpdates=data.get('receiveUpdates') is True)
            photo=data.get('photo')
            if isinstance(photo,dict) and photo.get('upload_token'):
                try:
                    proof=URLSafeTimedSerializer(app.secret_key,salt='customer-document').loads(photo['upload_token'],max_age=86400)
                    if proof['customer']!=user.id or proof['purpose']!='profile': raise ValueError()
                    clean['customerPhoto']={'id':proof['id']}
                except (BadSignature,KeyError,ValueError): raise ValueError('Upload the profile photo again.') from None
            result=connect_admin().auth.admin.update_user_by_id(user.id,{'user_metadata':{**meta,**clean}})
            user=result.user; meta=user.user_metadata
        return jsonify(account={**{key:meta.get(key,'') for key in PROFILE_FIELDS},'email':user.email,'nationality':'Ghana','receiveUpdates':meta.get('receiveUpdates',False),'photoUrl':'/api/auth/customer/document?profile=self' if meta.get('customerPhoto') else None})
