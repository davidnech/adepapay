"""Real agent accounts and protected profile records."""
import os
import re
from datetime import datetime, timezone
from uuid import UUID
from flask import g, jsonify, request, Response
from itsdangerous import URLSafeTimedSerializer, BadSignature
from postgrest.exceptions import APIError
from supabase_auth.errors import AuthApiError
try:
    from .session_cookies import access_token
    from .subscription_access import subscription_info
except ImportError:
    from session_cookies import access_token
    from subscription_access import subscription_info

try:
    from .store_team import StoreAccessError, is_owner
    from .store_catalogue import all_rows
    from .image_uploader import download_private_image, ImageUploadError
except ImportError:
    from store_team import StoreAccessError, is_owner
    from store_catalogue import all_rows
    from image_uploader import download_private_image, ImageUploadError

TABLE='store_field_agents'
TEXT_FIELDS=('fullName','phone','ghanaCard','address','digitalAddress','region','area',
    'nextOfKinName','nextOfKinRelationship','nextOfKinPhone','nextOfKinAddress',
    'fatherName','fatherPhone','motherName','motherPhone','guarantorName','guarantorRelationship',
    'guarantorPhone','guarantorGhanaCard','guarantorAddress','guarantorDigitalAddress')
SLOTS=('profilePhoto','ghanaCardFront','ghanaCardBack')


def password_value(value):
    if not isinstance(value,str) or not 8<=len(value)<=256:
        raise ValueError('Choose a password between 8 and 256 characters.')
    return value


def resolve_agent(user, connect_admin):
    store_id=user.app_metadata.get('field_agent_store')
    if user.app_metadata.get('role')!='Field Agent' or not isinstance(store_id,str):
        raise StoreAccessError('An active field agent account is required.',401)
    client=connect_admin()
    rows=client.table(TABLE).select('*').eq('id',user.id).eq('store_id',store_id).limit(1).execute().data
    if not rows or rows[0]['status']!='Active':
        raise StoreAccessError('Your agent account is suspended or unavailable. Contact the store manager.',401)
    store=client.auth.admin.get_user_by_id(store_id).user
    if not store or not is_owner(store) or not subscription_info(store)['active']:
        raise StoreAccessError('This store needs approval and an active subscription. Contact the store owner.',401)
    return rows[0], store


def profile_values(data, previous, store_id, secret):
    if not isinstance(data,dict): raise ValueError('Enter the agent profile details.')
    clean={}
    for key in TEXT_FIELDS:
        value=data.get(key,'')
        if not isinstance(value,str) or len(value)>300:
            raise ValueError(f'Enter a valid {key}, up to 300 characters.')
        clean[key]=value.strip()
    if any(not clean[key] for key in ('fullName','phone','region','area','address')):
        raise ValueError('Name, phone, region, area and residential address are required.')
    for key in ('phone','nextOfKinPhone','fatherPhone','motherPhone','guarantorPhone'):
        if clean[key] and not re.fullmatch(r'(?:\+233|233|0)[235]\d{8}',re.sub(r'[\s()-]','',clean[key])):
            raise ValueError(f'Enter a valid Ghanaian number for {key}.')
    for key in ('ghanaCard','guarantorGhanaCard'):
        clean[key]=clean[key].upper()
        if clean[key] and not re.fullmatch(r'GHA-\d{9}-\d',clean[key]): raise ValueError('Use Ghana Card format GHA-123456789-0.')
    for key in ('digitalAddress','guarantorDigitalAddress'):
        clean[key]=clean[key].upper()
        if clean[key] and not re.fullmatch(r'[A-Z]{2}-\d{3}-\d{4}',clean[key]): raise ValueError('Use GhanaPost GPS format GA-123-4567.')
    signer=URLSafeTimedSerializer(secret,salt='image-upload')
    for slot in SLOTS:
        image=data.get(slot)
        if image is None:
            clean[slot]=None
            continue
        try:
            if not isinstance(image,dict): raise ValueError()
            image_id=image['id']
            if previous.get(slot,{} ) and image_id==previous[slot]['id']:
                clean[slot]={'id':image_id}
                continue
            proof=signer.loads(image['upload_token'],max_age=86400)
            if proof.get('owner')!=store_id or proof.get('purpose')!='collection-agents' or proof.get('id')!=image_id:
                raise ValueError()
            clean[slot]={'id':image_id}
        except (BadSignature,KeyError,TypeError,ValueError):
            raise ValueError('Upload the agent image again before saving. Upload receipts expire after 24 hours.') from None
    return clean


def public_record(row, own=False):
    profile={**row['profile']}
    for slot in SLOTS:
        if profile.get(slot):
            profile[slot]={**profile[slot], 'url':f'/api/auth/agent/image?slot={slot}' if own else f'/api/auth/store/agent-image?agent={row["id"]}&slot={slot}'}
    return {**row,'profile':profile}


def register_field_agents(app, owner, connect_db, connect_admin):
    def actor():
        access=access_token()
        if not access: raise StoreAccessError('Sign in to your agent account.',401)
        client=connect_db()
        try: user=client.auth.get_user(access).user
        except AuthApiError as error:
            if error.status not in (401,403): raise
            refresh=request.cookies.get('adepa_refresh')
            if not refresh: raise StoreAccessError('Please sign in again.',401)
            result=client.auth.refresh_session(refresh)
            user=result.user
            g.profile_session=result.session
        row,store=resolve_agent(user,connect_admin)
        return user,row,store

    @app.errorhandler(APIError)
    def database_error(error):
        app.logger.warning('Database request failed: code=%s',error.code)
        if request.path.startswith('/api/auth/agent') or request.path in ('/api/auth/session','/api/auth/login','/api/auth/store/agents','/api/auth/store/agent-image'):
            return jsonify(error='Agent database access failed. Run backend/migrations/004_field_agents.sql and check the server Supabase key and Data API settings.'),503
        return jsonify(error='Database access is temporarily unavailable.'),503

    @app.route('/api/auth/store/agents',methods=['GET','POST'])
    def agents():
        store,error=owner()
        if error: return error
        client=connect_admin()
        if request.method=='GET':
            return jsonify(agents=[public_record(row) for row in all_rows(client,TABLE,store.id)])
        request.max_content_length=64*1024
        data=request.get_json()
        if not isinstance(data,dict): raise ValueError('Enter the agent details.')
        previous=None
        if data.get('id'):
            try: agent_id=str(UUID(str(data['id'])))
            except ValueError: raise ValueError('Invalid agent ID.') from None
            rows=client.table(TABLE).select('*').eq('store_id',store.id).eq('id',agent_id).limit(1).execute().data
            if not rows: return jsonify(error='Agent not found in your store.'),404
            previous=rows[0]
            if type(data.get('revision')) is not int or data['revision']!=previous['revision']:
                return jsonify(error='This agent changed. Refresh before editing again.'),409
        action=data.get('action','save')
        if action=='password':
            if not previous: raise ValueError('Select an existing agent.')
            target=client.auth.admin.get_user_by_id(previous['id']).user
            if not target or target.app_metadata.get('role')!='Field Agent' or target.app_metadata.get('field_agent_store')!=store.id:
                raise StoreAccessError('This login account is not a field agent of your store.')
            password=password_value(data.get('password'))
            client.auth.admin.update_user_by_id(previous['id'],{'password':password})
            return jsonify(message='Password updated. Share the new password securely with the agent.')
        if action!='save': raise ValueError('Choose a valid agent action.')
        status=data.get('status','Active')
        if status not in ('Active','Suspended'): raise ValueError('Choose Active or Suspended.')
        profile=profile_values(data.get('profile'),previous['profile'] if previous else {},store.id,app.secret_key)
        if previous:
            saved=client.table(TABLE).update({'profile':profile,'status':status,'revision':previous['revision']+1,'updated_at':datetime.now(timezone.utc).isoformat()}).eq('store_id',store.id).eq('id',previous['id']).eq('revision',previous['revision']).execute().data
            if not saved: return jsonify(error='This agent changed. Refresh before editing again.'),409
            return jsonify(agent=public_record(saved[0]))
        email=data.get('email','')
        if not isinstance(email,str) or len(email)>254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email.strip()): raise ValueError('Enter a valid agent email.')
        email=email.strip().lower()
        if email==os.getenv('ADMIN_EMAIL','').strip().lower(): raise ValueError('This email is reserved.')
        password=password_value(data.get('password'))
        # Check the table before creating a login so a missing migration creates no orphan.
        client.table(TABLE).select('id').eq('store_id',store.id).limit(1).execute()
        created=client.auth.admin.create_user({'email':email,'password':password,'email_confirm':True,
            'user_metadata':{'firstName':profile['fullName']},'app_metadata':{'role':'Field Agent','field_agent_store':store.id}}).user
        try:
            saved=client.table(TABLE).insert({'id':created.id,'store_id':store.id,'email':email,'profile':profile,'status':status}).execute().data
        except APIError:
            # An explicit database rejection means the new Auth account can be rolled back.
            try: client.auth.admin.delete_user(created.id)
            except Exception: app.logger.error('Agent provisioning rollback failed; account requires administrator recovery.')
            raise
        return jsonify(agent=public_record(saved[0])),201

    @app.route('/api/auth/agent/me',methods=['GET','POST'])
    def agent_me():
        user,row,store=actor()
        if request.method=='GET':
            return jsonify(agent=public_record(row,own=True),storeName=store.app_metadata.get('store_profile',{}).get('storeName') or store.app_metadata['store_review']['application'].get('storeName',''))
        data=request.get_json()
        if not isinstance(data,dict): raise ValueError('Enter your current and new passwords.')
        current=data.get('currentPassword')
        if not isinstance(current,str) or not current or len(current)>256: raise ValueError('Enter your current password.')
        password=password_value(data.get('password'))
        if password==current: raise ValueError('Choose a different new password.')
        try:
            verified=connect_db().auth.sign_in_with_password({'email':user.email,'password':current})
        except AuthApiError as error:
            if getattr(error,'code','')=='invalid_credentials':
                return jsonify(error='Your current password is incorrect.'),400
            raise
        if not verified.user or verified.user.id!=user.id: raise StoreAccessError('Unable to verify your password.',401)
        # Recheck suspension after reauthentication before changing credentials.
        resolve_agent(verified.user,connect_admin)
        connect_admin().auth.admin.update_user_by_id(user.id,{'password':password})
        return jsonify(message='Your password has been updated.')

    @app.get('/api/auth/store/agent-image')
    @app.get('/api/auth/agent/image')
    def agent_image():
        if request.path=='/api/auth/agent/image':
            _,row,_=actor()
            image=row['profile'].get(request.args.get('slot'))
        else:
            store,error=owner()
            if error: return error
            ticket=request.args.get('ticket')
            if ticket:
                try:
                    proof=URLSafeTimedSerializer(app.secret_key,salt='image-upload').loads(ticket,max_age=86400)
                    if proof.get('owner')!=store.id or proof.get('purpose')!='collection-agents': raise ValueError()
                    image={'id':proof['id']}
                except (BadSignature,ValueError,KeyError): return jsonify(error='Upload preview expired.'),403
            else:
                rows=connect_admin().table(TABLE).select('*').eq('store_id',store.id).eq('id',request.args.get('agent','')).limit(1).execute().data
                image=rows[0]['profile'].get(request.args.get('slot')) if rows else None
        if request.args.get('slot') and request.args['slot'] not in SLOTS: image=None
        if not isinstance(image,dict) or not image.get('id'): return jsonify(error='Image not found.'),404
        try: content,mime=download_private_image(image['id'])
        except ImageUploadError as error: return jsonify(error=str(error)),502
        return Response(content,mimetype=mime,headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'})
