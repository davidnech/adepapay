"""Store membership and permissions are trusted only from Supabase app_metadata."""
import hashlib
import json
import os
import re
from flask import jsonify, request
try:
    from .subscription_access import subscription_info
except ImportError:
    from subscription_access import subscription_info

PAGES = {
    'dashboard':'Dashboard', 'store-profile':'Store Profile', 'store-settings':'Store Settings',
    'shop-rules':'Shop Rules & Terms', 'products':'Products', 'promotions':'Promotions & Codes',
    'categories':'Categories', 'customers':'Customers', 'applications':'Customer Applications',
    'swap-management':'Swap Management', 'trade-in-inventory':'Trade-in Inventory',
    'active-purchases':'Active Purchases', 'layaway-plans':'Layaway Plans',
    'collection-agents':'Field Agents', 'agent-settlements':'Agent Accounts',
    'payments':'Payments', 'reports':'Reports', 'notifications':'Notifications', 'support':'Help and Support',
}

class StoreAccessError(Exception):
    def __init__(self, message, status=403):
        super().__init__(message)
        self.status=status


def is_owner(user):
    return user.app_metadata.get('role') == 'Store Manager' and user.app_metadata.get('store_id') == user.id and user.app_metadata.get('store_review',{}).get('status') == 'Approved'


def resolve_store(user, connect_admin, page=None):
    membership=user.app_metadata.get('store_staff')
    if membership is None:
        if not is_owner(user): raise StoreAccessError('An approved store account is required.')
        if page is not None and not subscription_info(user)['active']: raise StoreAccessError('Subscribe to activate your store workspace.',402)
        return user
    if not isinstance(membership,dict) or membership.get('status') != 'Active':
        raise StoreAccessError('Your staff account is disabled. Contact the store owner.',401)
    permissions=membership.get('permissions',[])
    if not isinstance(permissions,list) or any(key not in PAGES for key in permissions):
        raise StoreAccessError('Your staff permissions are invalid. Contact the store owner.',401)
    if page is not None and page not in permissions:
        raise StoreAccessError('You do not have permission to access this page.')
    store_id=membership.get('store_id')
    if not store_id or store_id==user.id:
        raise StoreAccessError('Your store membership is invalid.',401)
    owner=connect_admin().auth.admin.get_user_by_id(store_id).user
    if not owner or not is_owner(owner):
        raise StoreAccessError('This store is no longer approved for access.',401)
    if page is not None and not subscription_info(owner)['active']: raise StoreAccessError('The store owner must renew the subscription.',402)
    return owner


def staff_row(user):
    member=user.app_metadata.get('store_staff',{})
    return {'id':user.id,'email':user.email,'name':member.get('name',''), 'phone':member.get('phone',''),
            'title':member.get('title','Staff'),'permissions':member.get('permissions',[]),
            'status':member.get('status','Disabled'), 'lastSignIn':str(getattr(user,'last_sign_in_at','') or ''),
            'version':hashlib.sha256(json.dumps(member,sort_keys=True).encode()).hexdigest()}


def register_store_team(app, owner, connect_admin):
    @app.route('/api/auth/store/team', methods=['GET','POST'])
    def store_team():
        store,error=owner()
        if error: return error
        try:
            client=connect_admin()
        except RuntimeError:
            return jsonify(error='Staff management is not configured. Contact the administrator.'),503
        if request.method=='GET':
            rows=[]; page=1
            while True:
                users=client.auth.admin.list_users(page=page,per_page=100)
                rows.extend(staff_row(user) for user in users if isinstance(user.app_metadata.get('store_staff'),dict) and user.app_metadata['store_staff'].get('store_id')==store.id)
                if len(users)<100: break
                page+=1
            return jsonify(users=rows,pages=PAGES,owner={'name':store.user_metadata.get('firstName','Store Owner'),'email':store.email})
        data=request.get_json()
        if not isinstance(data,dict): raise ValueError('Enter the staff account details.')
        member={}
        for key in ('name','phone','title'):
            value=data.get(key,'')
            if not isinstance(value,str) or len(value)>100 or (key!='phone' and not value.strip()):
                raise ValueError('Name and role title are required (maximum 100 characters).')
            member[key]=value.strip()
        if member['phone'] and not re.fullmatch(r'(?:\+233|233|0)[235]\d{8}',re.sub(r'[\s()-]','',member['phone'])):
            raise ValueError('Enter a valid Ghanaian phone number.')
        permissions=data.get('permissions')
        if not isinstance(permissions,list) or any(not isinstance(key,str) or key not in PAGES for key in permissions):
            raise ValueError('Choose valid page permissions. Roles & Users is owner-only.')
        if data.get('status') not in ('Active','Disabled'): raise ValueError('Choose Active or Disabled.')
        member.update(store_id=store.id,status=data['status'],permissions=list(dict.fromkeys(permissions)))
        target=data.get('id')
        if target:
            if not isinstance(target,str) or target==store.id:
                raise StoreAccessError('The store owner account cannot be changed here.')
            user=client.auth.admin.get_user_by_id(target).user
            existing=user.app_metadata.get('store_staff',{})
            if not isinstance(existing,dict) or existing.get('store_id')!=store.id:
                raise StoreAccessError('This user does not belong to your store.')
            if data.get('version')!=staff_row(user)['version']:
                return jsonify(error='This staff account changed. Refresh before editing again.'),409
            result=client.auth.admin.update_user_by_id(target,{'app_metadata':{**user.app_metadata,'role':'Store Manager','store_staff':member}})
        else:
            email=data.get('email',''); password=data.get('password','')
            if not isinstance(email,str) or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email.strip()):
                raise ValueError('Enter a valid staff email.')
            if email.strip().lower()==os.getenv('ADMIN_EMAIL','').strip().lower():
                raise ValueError('This email is reserved.')
            if not isinstance(password,str) or not 8<=len(password)<=256:
                raise ValueError('Choose a password between 8 and 256 characters.')
            result=client.auth.admin.create_user({'email':email.strip().lower(),'password':password,'email_confirm':True,
                    'user_metadata':{'firstName':member['name']},'app_metadata':{'role':'Store Manager','store_staff':member}})
        return jsonify(user=staff_row(result.user)),200 if target else 201
