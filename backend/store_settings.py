"""Validated store preferences, including in-app notification controls."""
import hashlib
import json
from flask import g, jsonify, request

SECTIONS = {
    'General': [('language','Language','select','English',['English']), ('timezone','Time zone','select','Africa/Accra',['Africa/Accra']), ('receiptFooter','Receipt footer','text','Thank you for shopping with us.',300)],
    'Operations': [('fulfillment','Preferred fulfilment','select','Store pickup',['Store pickup','Delivery','Pickup and delivery']), ('leadDays','Preparation time (days)','number',1,[0,30]), ('pickupInstructions','Pickup instructions','text','',1000)],
    'Applications': [('reviewOrder','Preferred review order','select','Oldest first',['Oldest first','Newest first']), ('reviewDays','Target review time (days)','number',2,[1,30]), ('reviewNote','Default review note','text','',1000)],
    'Inventory': [('lowStockThreshold','Low stock threshold','number',5,[0,10000]), ('skuPrefix','SKU prefix','text','',30), ('showOutOfStock','Prefer showing out-of-stock products','boolean',True,None)],
    'Payments': [('preferredMethod','Preferred payment method','select','Mobile money',['Mobile money','Bank transfer','Cash at store']), ('paymentInstructions','Payment instructions','text','',1000)],
    'Notifications': [('applicationAlerts','New application alerts','boolean',True,None), ('paymentAlerts','Payment alerts','boolean',True,None), ('stockAlerts','Low stock alerts','boolean',True,None), ('digest','Preferred summary frequency','select','Daily',['Daily','Weekly','Off'])],
}


def settings_for(user, actor=None):
    actor = actor or user
    stored = user.app_metadata.get('store_settings', {})
    sections = {name: {field[0]: stored.get(name, {}).get(field[0],field[3]) for field in fields} for name,fields in SECTIONS.items()}
    return {'sections': sections, 'schema': {name: [{'key':key,'label':label,'type':kind,'options':constraint if kind=='select' else None,'min':constraint[0] if kind=='number' else None,'max':constraint[1] if kind=='number' else None,'maxLength':constraint if kind=='text' else None} for key,label,kind,default,constraint in fields] for name,fields in SECTIONS.items()},
            'versions': {name: hashlib.sha256(json.dumps(stored.get(name,{}),sort_keys=True).encode()).hexdigest() for name in SECTIONS},
            'account': {'email':actor.email,'role':actor.app_metadata.get('store_staff',{}).get('title') or actor.app_metadata.get('role'),'storeId':user.app_metadata.get('store_id'),
                        'status':user.app_metadata.get('store_review',{}).get('status'), 'lastSignIn':str(getattr(actor,'last_sign_in_at','') or '')}}


def register_store_settings(app, owner, connect_admin):
    @app.route('/api/auth/store/settings', methods=['GET','POST'])
    def store_settings():
        user,error=owner()
        if error: return error
        if request.method=='GET': return jsonify(settings=settings_for(user, g.store_actor))
        data=request.get_json()
        if not isinstance(data,dict) or data.get('section') not in SECTIONS:
            raise ValueError('Choose a valid settings section.')
        section=data['section']
        if data.get('version') != settings_for(user)['versions'][section]:
            return jsonify(error='These settings changed. Reload the page before saving.'),409
        values=data.get('values')
        allowed={field[0] for field in SECTIONS[section]}
        if not isinstance(values,dict) or set(values)!=allowed:
            raise ValueError('Provide all settings for this section.')
        cleaned={}
        for key,label,kind,default,constraint in SECTIONS[section]:
            value=values[key]
            valid=(kind=='boolean' and type(value)==bool or
                   kind=='number' and type(value)==int and constraint[0]<=value<=constraint[1] or
                   kind=='select' and isinstance(value,str) and value in constraint or
                   kind=='text' and isinstance(value,str) and len(value)<=constraint)
            if not valid: raise ValueError(f'Enter a valid value for {label}.')
            cleaned[key]=value.strip() if isinstance(value,str) else value
        try: client=connect_admin()
        except RuntimeError: return jsonify(error='Settings saving is not configured. Contact the administrator.'),503
        stored={**user.app_metadata.get('store_settings',{}),section:cleaned}
        result=client.auth.admin.update_user_by_id(user.id,{'app_metadata':{**user.app_metadata,'store_settings':stored}})
        return jsonify(settings=settings_for(result.user, g.store_actor))
