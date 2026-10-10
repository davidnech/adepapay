"""Account-scoped portal search, customer inbox and store agent ledger."""
from decimal import Decimal
from flask import jsonify, request
from postgrest.exceptions import APIError
try:
    from .store_team import resolve_store, PAGES, StoreAccessError
    from .subscription_access import subscription_info
    from .public_catalogue import snapshot
except ImportError:
    from store_team import resolve_store, PAGES, StoreAccessError
    from subscription_access import subscription_info
    from public_catalogue import snapshot


def support_activity(client, user_id, rows_for):
    feed=[]
    for ticket in rows_for(client,'support_tickets','user_id',user_id):
        for message in rows_for(client,'support_messages','ticket_id',ticket['id']):
            if message['sender']=='Admin':
                feed.append(dict(id='support:'+message['id'],category='Support',title=ticket['subject'],
                    message=message['body'],createdAt=message['created_at'],target='support',record=ticket['id']))
    return feed


def register_portal_workspace(app, actor, owner, connect_admin, rows_for, guarded):
    def store_context():
        user=actor(False); store=resolve_store(user,connect_admin)
        if not subscription_info(store)['active']: raise StoreAccessError('Renew the store subscription to use this workspace.',402)
        member=user.app_metadata.get('store_staff')
        allowed=set(member['permissions']) if member else set(PAGES)|{'team-access','subscriptions'}
        return user,store,allowed

    @app.get('/api/auth/<portal>/search')
    @guarded
    def portal_search(portal):
        if portal not in ('customer','store'): return jsonify(error='Unknown portal.'),404
        if portal=='customer': user=actor()
        else: user,store,allowed=store_context()
        q=request.args.get('q','').strip().casefold()
        if not 2<=len(q)<=200: raise ValueError('Enter 2–200 characters to search.')
        try: page=int(request.args.get('page','1'))
        except ValueError: raise ValueError('Choose a valid search page.') from None
        if not 1<=page<=100000: raise ValueError('Choose a valid search page.')
        client=connect_admin(); items=[]
        def add(kind,title,description,target,record='',query='',keywords=''):
            if q in f'{title} {description} {keywords}'.casefold():
                items.append(dict(kind=kind,title=str(title),description=str(description),page=target,id=str(record),query=str(query)))
        if portal=='customer':
            scope=user.id; key='customer_id'
            navigation={'dashboard':'Account overview','stores':'Browse stores','products':'Browse products','my-applications':'My applications','my-swaps':'My swaps','hire-purchase-application':'Hire purchase application','layaway-plans':'Apply for layaway','my-purchases':'My purchases','my-payment-plans':'My payment plans','payment-history':'Payment history','receipts':'Receipts','notifications':'Notifications','profile':'Profile','settings':'Settings','support':'Help and support'}
            stores,products=snapshot(client)
            for row in stores:
                add('Store',row['name'],f"{row['region']} {row['city']} {row['description']}",'stores',row['id'],keywords=' '.join(row['categories']))
            for row in products:
                add('Product',row['name'],f"{row['storeName']} · {row['category']} · {row['condition']}",'products',row['id'],keywords=f"{row['description']} {row['currentPrice']} {row['prices']}")
            application_page='my-applications'; allowed=set(navigation)
        else:
            scope=store.id; key='store_id'
            navigation={key:label for key,label in PAGES.items() if key in allowed}
            navigation.update({key:label for key,label in [('team-access','Team access'),('subscriptions','Subscription')] if key in allowed})
            application_page=next((p for p in ('applications','swap-management','layaway-plans','active-purchases','payments','customers','dashboard') if p in allowed),None)
            for table,target,kind,fields in (
                ('store_products','products','Product',('name','sku','category','description','status')),
                ('store_categories','categories','Category',('name','description','status')),
                ('store_trade_inventory','trade-in-inventory','Trade-in device',('device','reference','serial_number','source_reference','status')),
                ('store_field_agents','collection-agents','Agent',('email','status'))):
                if target not in allowed: continue
                for row in rows_for(client,table,'store_id',scope):
                    values=[str(row.get(field,'')) for field in fields]
                    title=row.get('profile',{}).get('fullName') or values[0]
                    add(kind,title,' · '.join(values),target,row['id'],query=title,keywords=str(row.get('profile',{})) if kind=='Agent' else str(row.get('prices',{})))
            if 'promotions' in allowed:
                for saved in client.table('store_promotion_settings').select('*').eq('store_id',scope).execute().data:
                    for row in saved.get('campaigns',[])+saved.get('codes',[]):
                        title=row.get('name') or row.get('code','Promotion')
                        add('Promotion',title,'Promotion settings','promotions',row.get('id',''),query=title,keywords=str(row))
            if 'agent-settlements' in allowed:
                for row in rows_for(client,'store_field_agents','store_id',scope):
                    name=row['profile'].get('fullName','Agent')
                    add('Agent account',name,row['email'],'agent-settlements',row['id'])
            if 'team-access' in allowed:
                auth_page=1
                while True:
                    batch=client.auth.admin.list_users(page=auth_page,per_page=100)
                    for account in batch:
                        member=account.app_metadata.get('store_staff')
                        if isinstance(member,dict) and member.get('store_id')==scope:
                            add('Team member',member.get('name','Staff'),f"{account.email} · {member.get('title','')} · {member.get('status','')}",'team-access',account.id,query=member.get('name',''),keywords=member.get('phone',''))
                    if len(batch)<100: break
                    auth_page+=1
        for target,label in navigation.items(): add('Page',label,'Open workspace page',target)
        applications=rows_for(client,'customer_applications',key,scope) if application_page else []
        indexed={row['id']:row for row in applications}
        for row in applications:
            target=application_page
            if portal=='store':
                if target=='swap-management' and row['kind']!='swap': continue
                if target=='layaway-plans' and row['kind']!='layaway': continue
                if target=='active-purchases' and row['status'] not in ('Approved','Completed'): continue
            detail=row.get('details',{}); saved=row.get('snapshot',{})
            add('Application',row['reference'],f"{saved.get('productName','')} · {saved.get('storeName','')} · {row['status']}",target,row['id'],keywords=f"{detail.get('fullName','')} {detail.get('phone','')} {detail.get('email','')} {row['kind']}")
        if portal=='customer' or 'payments' in allowed:
            for payment in rows_for(client,'application_payments',key,scope):
                row=indexed.get(payment['application_id'])
                if row:
                    add('Payment',payment['reference'],f"{row['reference']} · {payment['method']} · GHS {payment['amount']}",'payment-history' if portal=='customer' else 'payments',row['id'],keywords=payment['id'])
        if 'support' in allowed:
            for row in rows_for(client,'support_tickets','user_id',user.id):
                messages=rows_for(client,'support_messages','ticket_id',row['id'])
                add('Support',row['subject'],f"{row['category']} · {row['status']}",'support',row['id'],keywords=row['id']+' '+' '.join(message['body'] for message in messages))
        if 'notifications' in allowed:
            for event in rows_for(client,'application_events',key,scope):
                add('Notification','Application activity',event['message'],'notifications',query=event['message'])
            for entry in support_activity(client,user.id,rows_for):
                add('Notification',entry['title'],entry['message'],'notifications',query=entry['title'])
        page=min(page,max(1,(len(items)+19)//20))
        return jsonify(items=items[(page-1)*20:page*20],total=len(items),page=page,pageSize=20,warnings=[])

    @app.route('/api/auth/customer/notifications',methods=['GET','POST'])
    @guarded
    def customer_notifications():
        user=actor(); client=connect_admin()
        applications=rows_for(client,'customer_applications','customer_id',user.id)
        indexed={row['id']:row for row in applications}
        feed=[]
        for event in rows_for(client,'application_events','customer_id',user.id):
            row=indexed.get(event['application_id'])
            if row: feed.append(dict(id='event:'+event['id'],category='Payments' if event.get('event')=='payment' else 'Applications',title=row['reference'],message=event['message'],createdAt=event['created_at'],target='payment-history' if event.get('event')=='payment' else 'my-applications',record=row['id']))
        feed.extend(support_activity(client,user.id,rows_for))
        feed.sort(key=lambda row:(row['createdAt'],row['id']),reverse=True)
        # Existing installations can persist customer markers in the shared inbox
        # table from migration 014 until the dedicated table in 015 is installed.
        # Admin actors are verified email addresses; customer actors use UUIDs in
        # a separate namespace, so their markers cannot overlap.
        legacy_actor='customer:'+user.id
        legacy=False
        try:
            seen={row['notification_key'] for row in rows_for(client,'customer_notification_reads','user_id',user.id)}
        except APIError as error:
            if error.code not in ('PGRST205','42P01'): raise
            legacy=True
            seen=set(); offset=0
            while True:
                batch=client.table('admin_notification_reads').select('notification_key').eq('actor',legacy_actor).order('notification_key').range(offset,offset+499).execute().data
                seen.update(row['notification_key'] for row in batch)
                if len(batch)<500: break
                offset+=500
        try:
            if request.method=='POST':
                request.max_content_length=65536; data=request.get_json()
                if not isinstance(data,dict) or data.get('action') not in ('read','read_all'): raise ValueError('Choose mark read or mark all read.')
                available={row['id'] for row in feed}
                selected=list(available) if data['action']=='read_all' else data.get('ids')
                if not isinstance(selected,list) or (not selected and data['action']=='read') or any(not isinstance(key,str) or key not in available for key in selected): raise ValueError('These notifications are unavailable. Refresh the inbox.')
                for offset in range(0,len(selected),500):
                    if legacy:
                        client.table('admin_notification_reads').upsert([dict(actor=legacy_actor,notification_key=key) for key in set(selected[offset:offset+500])],on_conflict='actor,notification_key').execute()
                    else:
                        client.table('customer_notification_reads').upsert([dict(user_id=user.id,notification_key=key) for key in set(selected[offset:offset+500])],on_conflict='user_id,notification_key').execute()
                return jsonify(saved=True)
        except APIError as error:
            if error.code in ('PGRST205','42P01'): return jsonify(error='Apply migration 015_customer_notifications.sql in Supabase SQL Editor to enable the customer inbox.'),503
            raise
        return jsonify(items=[dict(row,read=row['id'] in seen) for row in feed],unread=sum(row['id'] not in seen for row in feed))

    @app.get('/api/auth/store/agent-accounts')
    @guarded
    def agent_accounts():
        store,error=owner('agent-settlements')
        if error: return error
        client=connect_admin()
        def rows(table): return rows_for(client,table,'store_id',store.id)
        agents=rows('store_field_agents'); payments=rows('application_payments'); settlements=rows('agent_settlements')
        settled=set()
        for entry in settlements:
            offset=0
            while True:
                batch=client.table('agent_settlement_items').select('payment_id').eq('settlement_id',entry['id']).order('id').range(offset,offset+499).execute().data
                settled.update(row['payment_id'] for row in batch)
                if len(batch)<500: break
                offset+=500
        accounts=[]
        for agent in agents:
            receipts=[row for row in payments if row['recorded_by']==agent['id']]
            history=[row for row in settlements if row['agent_id']==agent['id']]
            accounts.append(dict(id=agent['id'],name=agent['profile'].get('fullName','Agent'),email=agent['email'],status=agent['status'],
                collected=float(sum((Decimal(str(row['amount'])) for row in receipts),Decimal(0))),
                unsettled=float(sum((Decimal(str(row['amount'])) for row in receipts if row['id'] not in settled),Decimal(0))),
                receipts=[{key:row[key] for key in ('id','reference','amount','method','created_at')} for row in receipts],
                settlements=[{key:row[key] for key in ('id','reference','amount','method','created_at')} for row in history]))
        return jsonify(items=accounts)
