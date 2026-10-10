"""Database-backed administrative directories, financial oversight and audit history."""
import csv
import io
import os
from datetime import date, datetime, timezone
from decimal import Decimal
from functools import wraps
from uuid import UUID
from flask import Response, jsonify, request
from postgrest.exceptions import APIError
try:
    from .store_approvals import application_data
except ImportError:
    from store_approvals import application_data

MODULES = ('customers','products','categories','applications','swap-overview','active-purchases',
           'layaway-plans','collection-agents','agent-settlements','transactions','audit-logs')


def table_rows(client, table, columns='*', order='id'):
    rows=[]
    while True:
        batch=client.table(table).select(columns).order(order).range(len(rows),len(rows)+499).execute().data
        rows.extend(batch)
        if len(batch)<500: return rows


def auth_users(client):
    result={}; page=1
    while True:
        batch=client.auth.admin.list_users(page=page,per_page=100)
        for user in batch: result[user.id]=user
        if len(batch)<100: return list(result.values())
        page+=1


def value_date(value):
    return str(value or '')


def amount(value):
    return float(Decimal(str(value or 0)))


def account_name(user):
    if not user: return ''
    metadata=user.user_metadata or {}
    return ' '.join(str(metadata.get(key,'')).strip() for key in ('firstName','middleName','lastName')).strip() or str(metadata.get('fullName') or user.email or user.id)


def is_registered_customer(user):
    """Classify directory rows using server configuration and trusted metadata.

    Administrator sign-in is configured separately from Supabase Auth, so its
    matching Auth record may have no role. Legacy store lifecycle records can
    also retain their store identity without a complete review application.
    This filter does not grant permissions or trust editable registration roles.
    """
    admin_email=os.getenv('ADMIN_EMAIL','').strip().lower()
    if admin_email and str(user.email or '').strip().lower()==admin_email: return False
    metadata=user.app_metadata or {}
    if metadata.get('role','Customer')!='Customer': return False
    if metadata.get('store_staff') is not None or metadata.get('field_agent_store'): return False
    if metadata.get('store_id') or metadata.get('store_profile') or metadata.get('store_lifecycle'): return False
    review=metadata.get('store_review')
    if isinstance(review,dict) and review.get('status'): return False
    return application_data(user) is None


def metric(label, value, money=False):
    return dict(label=label,value=value,money=money)


class Records:
    def __init__(self,client):
        self.client=client; self.users={user.id:user for user in auth_users(client)}; self.cache={}; self.warnings=[]

    def optional_settlement_table(self,name):
        try: return self.table(name)
        except APIError as error:
            if error.code not in ('PGRST205','42P01'): raise
            warning='Agent settlements are unavailable until migration 013_admin_agent_settlements.sql is applied in Supabase SQL Editor.'
            if warning not in self.warnings: self.warnings.append(warning)
            return None

    def table(self,name):
        if name not in self.cache:
            self.cache[name]=table_rows(self.client,name,order='reference' if name=='subscription_orders' else 'id')
        return self.cache[name]

    def store(self,store_id):
        user=self.users.get(store_id)
        if not user: return dict(storeId=store_id,storeName='',storeStatus='',region='')
        profile=user.app_metadata.get('store_profile',{})
        application=application_data(user) or {}
        return dict(storeId=store_id,storeName=profile.get('storeName') or application.get('storeName',''),
                    storeStatus=application.get('status',''),region=profile.get('region') or application.get('region',''))

    def application(self,row):
        details=row.get('details',{}); snapshot=row.get('snapshot',{})
        return dict(id=row['id'],reference=row['reference'],customerId=row['customer_id'],customerName=details.get('fullName') or account_name(self.users.get(row['customer_id'])),
            **self.store(row['store_id']),productId=row['product_id'],productName=snapshot.get('productName',''),kind=row['kind'],status=row['status'],
            total=amount(row['total']),paid=amount(row['paid']),balance=amount(row['total'])-amount(row['paid']),deposit=amount(row['deposit']),
            swapCredit=amount(row.get('swap_credit')),fulfilled=bool(row.get('fulfilled')),createdAt=value_date(row['created_at']),
            details=dict(reference=row['reference'],customer=details.get('fullName',''),email=details.get('email',''),phone=details.get('phone',''),
                product=snapshot.get('productName',''),applicationType=row['kind'],status=row['status'],productPrice=amount(snapshot.get('price')),
                originalPrice=snapshot.get('originalPrice'),total=amount(row['total']),paid=amount(row['paid']),deposit=amount(row['deposit']),
                swapCredit=amount(row.get('swap_credit')),months=row.get('terms',{}).get('months'),frequency=row.get('terms',{}).get('frequency'),
                installments=row.get('terms',{}).get('installments'),fulfilled=bool(row.get('fulfilled')),approvedAt=row.get('approved_at'),
                offerExpiresAt=row.get('offer_expires_at'),decisionReason=row.get('decision_reason','')))

    def build(self,module):
        if module=='customers':
            applications=self.table('customer_applications'); rows=[]
            by_customer={}
            for application in applications: by_customer.setdefault(application['customer_id'],[]).append(application)
            for user in self.users.values():
                if not is_registered_customer(user): continue
                metadata=user.user_metadata or {}; linked=by_customer.get(user.id,[])
                ban=getattr(user,'banned_until',None)
                try: banned=bool(ban) and datetime.fromisoformat(str(ban).replace('Z','+00:00'))>datetime.now(timezone.utc)
                except (ValueError,TypeError): banned=False
                confirmed=bool(getattr(user,'email_confirmed_at',None))
                status='Suspended' if banned else 'Active' if confirmed else 'Unconfirmed'
                rows.append(dict(id=user.id,name=account_name(user),email=user.email or '',phone=metadata.get('phone',''),region=metadata.get('region',''),
                    status=status,applications=len(linked),paid=sum(amount(row['paid']) for row in linked),balance=sum(amount(row['total'])-amount(row['paid']) for row in linked if row['status']=='Approved'),
                    createdAt=value_date(getattr(user,'created_at',None)),details=dict(name=account_name(user),email=user.email or '',phone=metadata.get('phone',''),
                        region=metadata.get('region',''),city=metadata.get('city',''),emailConfirmed=confirmed,lastSignIn=value_date(getattr(user,'last_sign_in_at',None)),bannedUntil=value_date(ban)),
                    related=[dict(title='Customer applications',rows=[self.application(row) for row in linked])]))
            return rows,[metric('Registered customers',len(rows)),metric('Active',sum(row['status']=='Active' for row in rows)),metric('Unconfirmed email',sum(row['status']=='Unconfirmed' for row in rows)),metric('Suspended',sum(row['status']=='Suspended' for row in rows))]
        if module=='products':
            rows=[]
            for product in self.table('store_products'):
                prices=product.get('prices',{})
                rows.append(dict(id=product['id'],**self.store(product['store_id']),name=product['name'],sku=product['sku'],category=product['category'],status=product['status'],stock=product['stock'],
                    cash=amount(product['price']),hirePurchase=amount(prices.get('hire_purchase',product['price'])),layaway=amount(prices.get('layaway',product['price'])),swap=amount(prices.get('swap',product['price'])),
                    createdAt=value_date(product['created_at']),details=dict(description=product.get('description',''),condition=product.get('condition',''),
                        payNow=product.get('payment_options',{}).get('payNow',False),hirePurchaseAvailable=product.get('payment_options',{}).get('hirePurchase',False),
                        layawayAvailable=product.get('payment_options',{}).get('layaway',False),swapAvailable=product.get('swap',{}).get('enabled',False),revision=product.get('revision'))))
            return rows,[metric('Products',len(rows)),metric('Active',sum(row['status']=='Active' for row in rows)),metric('Draft',sum(row['status']=='Draft' for row in rows)),metric('Stock units',sum(row['stock'] for row in rows if row['status']=='Active'))]
        if module=='categories':
            products=self.table('store_products'); rows=[]
            for category in self.table('store_categories'):
                assigned=[product for product in products if product['store_id']==category['store_id'] and product['category']==category['name']]
                rows.append(dict(id=category['id'],**self.store(category['store_id']),name=category['name'],status=category['status'],products=len(assigned),stock=sum(product['stock'] for product in assigned),
                    createdAt=value_date(category['created_at']),details=dict(name=category['name'],status=category['status']),
                    related=[dict(title='Products in this category',rows=[dict(id=p['id'],name=p['name'],status=p['status'],stock=p['stock'],total=amount(p['price'])) for p in assigned])]))
            return rows,[metric('Store categories',len(rows)),metric('Active',sum(row['status']=='Active' for row in rows)),metric('Archived',sum(row['status']=='Archived' for row in rows))]
        if module in ('applications','swap-overview','active-purchases','layaway-plans'):
            source=self.table('customer_applications')
            if module=='swap-overview': source=[row for row in source if row['kind']=='swap']
            if module=='layaway-plans': source=[row for row in source if row['kind']=='layaway']
            if module=='active-purchases': source=[row for row in source if row['status'] in ('Approved','Completed')]
            payments=self.table('application_payments'); rows=[]
            for application in source:
                row=self.application(application)
                row['related']=[dict(title='Recorded payments',rows=[dict(id=p['id'],reference=p['reference'],total=amount(p['amount']),method=p['method'],createdAt=p['created_at']) for p in payments if p['application_id']==application['id']])]
                rows.append(row)
            return rows,[metric('Plans' if module!='applications' else 'Applications',len(rows)),metric('Awaiting decision',sum(row['status'] in ('Pending','Offered') for row in rows)),metric('Active plans',sum(row['status']=='Approved' for row in rows)),metric('Completed',sum(row['status']=='Completed' for row in rows)),metric('Outstanding',sum(row['balance'] for row in rows if row['status']=='Approved'),True)]
        if module=='collection-agents':
            rows=[]
            for agent in self.table('store_field_agents'):
                profile=agent.get('profile',{})
                rows.append(dict(id=agent['id'],**{**self.store(agent['store_id']),'region':profile.get('region','')},name=profile.get('fullName',''),email=agent['email'],phone=profile.get('phone',''),status=agent['status'],area=profile.get('area',''),
                    createdAt=value_date(agent['created_at']),details=dict(name=profile.get('fullName',''),email=agent['email'],phone=profile.get('phone',''),region=profile.get('region',''),area=profile.get('area',''),updatedAt=agent.get('updated_at'))))
            return rows,[metric('Field agents',len(rows)),metric('Active',sum(row['status']=='Active' for row in rows)),metric('Suspended',sum(row['status']=='Suspended' for row in rows))]
        if module=='agent-settlements':
            agents=self.table('store_field_agents'); payments=self.table('application_payments')
            settlements=self.optional_settlement_table('agent_settlements'); items=self.optional_settlement_table('agent_settlement_items')
            ready=settlements is not None and items is not None
            settled={row['payment_id'] for row in items or []}; rows=[]
            for agent in agents:
                receipts=[row for row in payments if row['recorded_by']==agent['id'] and row['store_id']==agent['store_id']]
                pending=[row for row in receipts if row['id'] not in settled]
                history=[row for row in settlements or [] if row['agent_id']==agent['id'] and row['store_id']==agent['store_id']]
                rows.append(dict(id=agent['id'],**self.store(agent['store_id']),name=agent.get('profile',{}).get('fullName',''),status=agent['status'],
                    receipts=len(receipts),unsettled=amount(sum((Decimal(str(row['amount'])) for row in pending),Decimal(0))) if ready else None,settled=amount(sum((Decimal(str(row['amount'])) for row in history),Decimal(0))) if ready else None,settlements=len(history) if ready else None,
                    createdAt=value_date(agent['created_at']),paymentIds=[row['id'] for row in pending] if ready else [],details=dict(agent=agent.get('profile',{}).get('fullName',''),email=agent['email'],recordedPayments=len(receipts)),
                    related=[dict(title='Unsettled recorded payments' if ready else 'Recorded agent payments',rows=[dict(id=row['id'],reference=row['reference'],total=amount(row['amount']),method=row['method'],createdAt=row['created_at']) for row in pending]),
                        dict(title='Settlement history',rows=[dict(id=row['id'],reference=row['reference'],total=amount(row['amount']),method=row['method'],actor=row['actor'],reason=row['reason'],createdAt=row['created_at']) for row in history])]))
            return rows,[metric('Agent accounts',len(rows)),metric('Unsettled',sum(row['unsettled'] for row in rows) if ready else None,True),metric('Settled',sum(row['settled'] for row in rows) if ready else None,True),metric('Settlements',len(settlements) if ready else None)]
        if module=='transactions':
            applications={row['id']:row for row in self.table('customer_applications')}; rows=[]
            for payment in self.table('application_payments'):
                application=applications.get(payment['application_id'],{})
                rows.append(dict(id='payment:'+payment['id'],**self.store(payment['store_id']),reference=payment['reference'],kind='Customer payment',status='Recorded',
                    name=account_name(self.users.get(payment['customer_id'])),total=amount(payment['amount']),method=payment['method'],createdAt=value_date(payment['created_at']),
                    details=dict(applicationReference=application.get('reference',''),recordedBy=account_name(self.users.get(payment['recorded_by'])),method=payment['method'])))
            for order in self.table('subscription_orders'):
                rows.append(dict(id='subscription:'+order['reference'],**self.store(order['store_id']),reference=order['reference'],kind='Store subscription',status=order['status'],
                    name=order['plan_name'],total=amount(order['amount_minor'])/100,method='Paystack',createdAt=value_date(order.get('paid_at') or order['created_at']),
                    details=dict(plan=order['plan_name'],environment=order['environment'],transactionId=order.get('transaction_id'),paidAt=order.get('paid_at'),currency=order['currency'])))
            settlements=self.optional_settlement_table('agent_settlements')
            for settlement in settlements or []:
                rows.append(dict(id='settlement:'+settlement['id'],**self.store(settlement['store_id']),reference=settlement['reference'],kind='Agent remittance',status='Settled',
                    name=account_name(self.users.get(settlement['agent_id'])),total=amount(settlement['amount']),method=settlement['method'],createdAt=value_date(settlement['created_at']),
                    details=dict(actor=settlement['actor'],reason=settlement['reason'])))
            return rows,[metric('Transactions',len(rows)),metric('Customer payments',sum(row['total'] for row in rows if row['kind']=='Customer payment'),True),
                metric('Paid subscriptions',sum(row['total'] for row in rows if row['kind']=='Store subscription' and row['status']=='Paid'),True),metric('Agent remittances',sum(row['total'] for row in rows if row['kind']=='Agent remittance') if settlements is not None else None,True)]
        rows=[]
        try: platform_events=self.table('platform_admin_events')
        except APIError as error:
            if error.code not in ('PGRST205','42P01'): raise
            platform_events=[]
            self.warnings.append('Platform settings and support audit events require migration 014_admin_platform.sql.')
        for event in platform_events:
            rows.append(dict(id='platform:'+event['id'],storeId='',storeName='',storeStatus='',region='',kind='Platform administration',reference=event['reference'],action=event['action'],actor=event['actor'],reason=event['message'],createdAt=value_date(event['created_at'])))
        for event in self.table('store_admin_events'):
            rows.append(dict(id='store:'+event['id'],**self.store(event['store_id']),kind='Store administration',reference=event['store_id'],action=event['action'],actor=event['actor'],reason=event['reason'],createdAt=value_date(event['created_at'])))
        for event in self.table('application_events'):
            rows.append(dict(id='application:'+event['id'],**self.store(event['store_id']),kind='Application activity',reference=event['application_id'],action=event['event'],actor=account_name(self.users.get(event['actor_id'])) or event['actor_id'],reason=event['message'],createdAt=value_date(event['created_at'])))
        settlements=self.optional_settlement_table('agent_settlements')
        for settlement in settlements or []:
            rows.append(dict(id='settlement:'+settlement['id'],**self.store(settlement['store_id']),kind='Agent settlement',reference=settlement['reference'],action='Settlement recorded',actor=settlement['actor'],reason=settlement['reason'],createdAt=value_date(settlement['created_at'])))
        return rows,[metric('Recorded events',len(rows)),metric('Store actions',sum(row['kind']=='Store administration' for row in rows)),metric('Application events',sum(row['kind']=='Application activity' for row in rows)),metric('Agent settlements',sum(row['kind']=='Agent settlement' for row in rows) if settlements is not None else None)]


def csv_cell(value):
    text=str(value if value is not None else '')
    return "'"+text if text.startswith(('=','+','-','@','\t','\r','\n')) else text


def filter_records(rows):
    query=request.args.get('q','').strip().casefold()
    if len(query)>200: raise ValueError('Shorten the search to 200 characters.')
    since=date.fromisoformat(request.args['since']) if request.args.get('since') else None
    until=date.fromisoformat(request.args['until']) if request.args.get('until') else None
    if since and until and since>until: raise ValueError('Choose a valid date range.')
    result=[]
    for row in rows:
        if any(request.args.get(key) and request.args[key]!=str(row.get(field,'')) for key,field in (('status','status'),('store','storeId'),('kind','kind'),('region','region'),('category','category'))): continue
        if query and query not in ' '.join(str(value) for key,value in row.items() if key not in ('related','details','paymentIds')).casefold(): continue
        if since or until:
            try: day=date.fromisoformat(row['createdAt'][:10])
            except ValueError: continue
            if since and day<since or until and day>until: continue
        result.append(row)
    return sorted(result,key=lambda row:(row.get('createdAt',''),row['id']),reverse=True)


def register_admin_operations(app,connect_admin,authorized):
    def guarded(fn):
        @wraps(fn)
        def run(*args,**kwargs):
            if not authorized(): return jsonify(error='Administrator sign-in is required.'),403
            try: return fn(*args,**kwargs)
            except ValueError as error: return jsonify(error=str(error) or 'Choose valid filters.'),400
            except RuntimeError as error: return jsonify(error=str(error)),503
            except APIError as error:
                app.logger.warning('Admin operations database failure: code=%s',error.code)
                if error.code in ('PGRST205','PGRST202','PGRST204','42P01','42703'):
                    return jsonify(error='This page needs database setup. Apply backend/setup_database.sql, including migration 013_admin_agent_settlements.sql, then refresh.'),503
                if error.code in ('P0001','23505'): return jsonify(error=error.message if error.code=='P0001' else 'This payment was already settled. Refresh the agent account.'),409
                return jsonify(error='The database request failed. Refresh and try again.'),502
        return run

    @app.get('/api/auth/admin/operations/<module>')
    @guarded
    def directory(module):
        if module not in MODULES: return jsonify(error='Unknown administrative page.'),404
        page=int(request.args.get('page','1'))
        if not 1<=page<=100000: raise ValueError('Choose a valid page number.')
        records=Records(connect_admin()); rows,summary=records.build(module)
        facets={key:sorted({str(row.get(key,'')) for row in rows if row.get(key)}) for key in ('status','kind','region','category')}
        facets['stores']=[dict(id=key,name=value) for key,value in sorted({row['storeId']:row['storeName'] for row in rows if row.get('storeId')}.items(),key=lambda pair:pair[1].casefold())]
        filtered=filter_records(rows)
        if request.args.get('id'):
            selected=next((row for row in rows if row['id']==request.args['id']),None)
            if selected is None: return jsonify(error='Record not found. Refresh the page.'),404
            return jsonify(record=selected,warnings=records.warnings)
        if request.args.get('format')=='csv':
            excluded=('related','details','paymentIds')
            columns=list(dict.fromkeys(key for row in filtered for key in row if key not in excluded)) or ['id']
            output=io.StringIO(); writer=csv.writer(output); writer.writerow(columns)
            for row in filtered: writer.writerow([csv_cell(row.get(key)) for key in columns])
            return Response('\ufeff'+output.getvalue(),mimetype='text/csv',headers={'Content-Disposition':f'attachment; filename="AdepaPay-{module}.csv"'})
        page=min(page,max(1,(len(filtered)+19)//20))
        return jsonify(items=[{key:value for key,value in row.items() if key not in ('details','related','paymentIds')} for row in filtered[(page-1)*20:page*20]],
                       summary=summary,facets=facets,page=page,pageSize=20,total=len(filtered),warnings=records.warnings,generatedAt=datetime.now(timezone.utc).isoformat())

    @app.post('/api/auth/admin/agent-settlements')
    @guarded
    def settle_agent():
        data=request.get_json()
        if not isinstance(data,dict): raise ValueError('Provide settlement details.')
        agent=str(UUID(str(data.get('agentId')))); request_id=str(UUID(str(data.get('requestId'))))
        if data.get('confirmedReceived') is not True: raise ValueError('Confirm the remittance was received before closing this account.')
        payments=data.get('paymentIds')
        if not isinstance(payments,list) or not payments or len(payments)>1000: raise ValueError('Choose unsettled payment records.')
        ids=[str(UUID(str(value))) for value in payments]
        if len(ids)!=len(set(ids)): raise ValueError('Payment records cannot be repeated.')
        reason=data.get('reason',''); method=data.get('method')
        if not isinstance(reason,str) or not 3<=len(reason.strip())<=1000: raise ValueError('Provide a settlement reason of 3-1000 characters.')
        if method not in ('Cash','Mobile Money','Bank Transfer'): raise ValueError('Choose a settlement method.')
        total=data.get('expectedTotal')
        if isinstance(total,bool) or not isinstance(total,(int,float)): raise ValueError('Refresh the settlement amount before continuing.')
        result=connect_admin().rpc('admin_settle_agent',dict(p_agent=agent,p_payments=ids,p_request=request_id,p_expected=total,p_method=method,p_reason=reason.strip(),p_actor=authorized())).execute().data
        return jsonify(settlement=result)
