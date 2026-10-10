"""Persistent platform settings, private support, admin inbox and platform reports."""
import csv
import io
import re
from datetime import date, datetime, timezone
from decimal import Decimal
from functools import wraps
from uuid import UUID
from flask import jsonify, request, Response
from postgrest.exceptions import APIError
try:
    from .admin_operations import Records, table_rows, csv_cell, amount
    from .store_approvals import application_data
    from .store_insights import build_report
except ImportError:
    from admin_operations import Records, table_rows, csv_cell, amount
    from store_approvals import application_data
    from store_insights import build_report

SCHEMA_NOTICE='Apply backend/migrations/014_admin_platform.sql in Supabase SQL Editor to enable settings, support and saved notification read status.'
CATEGORIES=['Account','Payments','Applications','Store','Technical','Other']
STATUSES=['Open','In Progress','Resolved','Closed']
DEFAULTS=dict(platformName='AdepaPay',supportEmail='',supportPhone='',announcement='',supportEnabled=True,
              notifySupport=True,notifyStores=True,notifyApplications=True,notifyAgents=True,notifyPayments=True,notifyStock=True,lowStockThreshold=5,reportDays=30)


def object_data():
    data=request.get_json()
    if not isinstance(data,dict): raise ValueError('Provide valid request details.')
    return data


def text_value(value,label,minimum=0,maximum=5000):
    if not isinstance(value,str) or not minimum<=len(value.strip())<=maximum: raise ValueError(f'Enter {label} of {minimum}-{maximum} characters.')
    return value.strip()


def settings(client,optional=False):
    try: rows=client.table('platform_settings').select('*').eq('id',True).execute().data
    except APIError as error:
        if not optional or error.code not in ('PGRST205','42P01'): raise
        return dict(values=dict(DEFAULTS),revision=None,updated_at=None,updated_by='',available=False)
    if not rows: raise RuntimeError(SCHEMA_NOTICE)
    return dict(rows[0],values={**DEFAULTS,**rows[0]['values']},available=True)


def clean_settings(values):
    if not isinstance(values,dict) or set(values)!=set(DEFAULTS): raise ValueError('Provide all platform settings.')
    result={}
    for key,default in DEFAULTS.items():
        value=values[key]
        if type(default) is bool:
            if type(value) is not bool: raise ValueError('Choose enabled or disabled.')
        elif type(default) is int:
            if type(value) is not int or not (0<=value<=10000 if key=='lowStockThreshold' else value in (7,30,90)): raise ValueError('Choose a valid threshold or report period.')
        else:
            value=text_value(value,key,1 if key=='platformName' else 0,1000 if key=='announcement' else 200)
            if key=='supportEmail' and value and not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',value): raise ValueError('Enter a valid support email.')
        result[key]=value
    return result


def optional_rows(records,table):
    try: return records.table(table)
    except APIError as error:
        if error.code not in ('PGRST205','42P01'): raise
        if SCHEMA_NOTICE not in records.warnings: records.warnings.append(SCHEMA_NOTICE)
        return None


def paginate(rows):
    page=int(request.args.get('page','1'))
    if not 1<=page<=100000: raise ValueError('Choose a valid page.')
    page=min(page,max(1,(len(rows)+19)//20))
    return dict(items=rows[(page-1)*20:page*20],total=len(rows),page=page,pageSize=20)


def ticket_rows(client,user_id=None):
    rows=[]
    while True:
        query=client.table('support_tickets').select('*')
        if user_id: query=query.eq('user_id',user_id)
        batch=query.order('id').range(len(rows),len(rows)+499).execute().data
        rows.extend(batch)
        if len(batch)<500: return rows


def ticket_detail(client,key,user_id=None):
    query=client.table('support_tickets').select('*').eq('id',key)
    if user_id: query=query.eq('user_id',user_id)
    rows=query.execute().data
    if not rows: return None
    messages=[]
    while True:
        batch=client.table('support_messages').select('*').eq('ticket_id',key).order('created_at').order('id').range(len(messages),len(messages)+499).execute().data
        messages.extend(batch)
        if len(batch)<500: break
    return dict(ticket=rows[0],messages=[{key:row[key] for key in ('id','sender','body','created_at')} for row in messages])


def notification_feed(records,preferences):
    feed=[]
    def add(key,category,title,message,at,target,record=''):
        feed.append(dict(id=key,category=category,title=title,message=message,createdAt=str(at or ''),target=target,record=record))
    if preferences['notifyStores']:
        for user in records.users.values():
            application=application_data(user)
            if application and application['status']=='Pending Approval':
                add('approval:'+user.id+':'+application['version'],'Stores','Store awaiting approval',application['storeName'],getattr(user,'created_at',''),'store-approvals',user.id)
        for event in records.table('store_admin_events'):
            add('store:'+event['id'],'Stores','Store '+event['action'],event['reason'],event['created_at'],'audit-logs','store:'+event['id'])
    if preferences['notifySupport']:
        tickets=optional_rows(records,'support_tickets'); messages=optional_rows(records,'support_messages')
        lookup={row['id']:row for row in tickets or []}
        for message in messages or []:
            if message['sender']=='User' and message['ticket_id'] in lookup:
                ticket=lookup[message['ticket_id']]
                add('support:'+message['id'],'Support',ticket['subject'],ticket['name']+' sent a support message.',message['created_at'],'support',ticket['id'])
    if preferences['notifyPayments']:
        for receipt in records.table('application_payments'):
            add('payment:'+receipt['id'],'Payments','Customer payment recorded',receipt['reference']+' · GHS '+format(Decimal(str(receipt['amount'])),'.2f'),receipt['created_at'],'transactions','payment:'+receipt['id'])
        for order in records.table('subscription_orders'):
            if order['status']=='Paid':
                add('subscription:'+order['reference'],'Payments','Store subscription paid',order['reference']+' · '+order['environment'],order.get('paid_at') or order['created_at'],'transactions','subscription:'+order['reference'])
    if preferences['notifyApplications']:
        for event in records.table('application_events'):
            add('application:'+event['id'],'Applications',event['event'],event['message'],event['created_at'],'applications',event['application_id'])
    if preferences['notifyAgents']:
        for agent in records.table('store_field_agents'):
            add(f"agent:{agent['id']}:{agent['revision']}",'Agents','Agent account updated',agent['profile'].get('fullName','Agent')+' · '+agent['status'],agent['updated_at'],'collection-agents',agent['id'])
    if preferences['notifyStock']:
        for product in records.table('store_products'):
            if product['status']=='Active' and product['stock']<=preferences['lowStockThreshold']:
                add(f"stock:{product['id']}:{product['revision']}",'Stock','Low stock' if product['stock'] else 'Out of stock',f"{product['name']}: {product['stock']} units",product['updated_at'],'products',product['id'])
    return sorted(feed,key=lambda row:(row['createdAt'],row['id']),reverse=True)


def platform_report(records,since=None,until=None,store_id=None):
    def scoped(table): return [row for row in records.table(table) if not store_id or row['store_id']==store_id]
    def period(row):
        day=date.fromisoformat(str(row['created_at'])[:10])
        return (since is None or day>=since) and (until is None or day<=until)
    applications=scoped('customer_applications'); payments=scoped('application_payments'); products=scoped('store_products'); agents=scoped('store_field_agents')
    report=build_report(applications,payments,products,agents,since,until)
    customers,_=records.build('customers')
    stores=[application_data(user) for user in records.users.values() if application_data(user)]
    stores=[row for row in stores if not store_id or row['id']==store_id]
    report['registeredCustomers']=sum(period(dict(created_at=row['createdAt'])) for row in customers) if not store_id else None
    report['registeredCustomersAllTime']=len(customers) if not store_id else None
    report['storeStatuses']=[dict(label=status,count=sum(row['status']==status for row in stores)) for status in sorted({row['status'] for row in stores})]
    report['stores']=len(stores)
    orders=[row for row in scoped('subscription_orders') if period(dict(created_at=row.get('paid_at') or row['created_at']))]
    report['subscriptionPayments']=[dict(environment=environment,count=sum(row['status']=='Paid' for row in orders if row['environment']==environment),
        amount=float(sum((Decimal(str(row['amount_minor']))/100 for row in orders if row['status']=='Paid' and row['environment']==environment),Decimal(0)))) for environment in sorted({row['environment'] for row in orders})]
    settlements=records.optional_settlement_table('agent_settlements')
    report['agentRemittances']=None if settlements is None else float(sum((Decimal(str(row['amount'])) for row in settlements if (not store_id or row['store_id']==store_id) and period(row)),Decimal(0)))
    tickets=optional_rows(records,'support_tickets')
    report['supportStatuses']=None if tickets is None or store_id else [dict(label=status,count=sum(row['status']==status and period(row) for row in tickets)) for status in STATUSES]
    report['byStore']=[]
    for store in stores:
        apps=[row for row in applications if row['store_id']==store['id']]
        receipts=[row for row in payments if row['store_id']==store['id'] and period(row)]
        report['byStore'].append(dict(name=store['storeName'],status=store['status'],customers=len({row['customer_id'] for row in apps}),
            applications=sum(period(row) for row in apps),products=sum(row['store_id']==store['id'] for row in products),agents=sum(row['store_id']==store['id'] for row in agents),
            confirmedPayments=float(sum((Decimal(str(row['amount'])) for row in receipts),Decimal(0))),
            outstanding=float(sum((Decimal(str(row['total']))-Decimal(str(row['paid'])) for row in apps if row['status']=='Approved'),Decimal(0)))))
    return report


def report_csv(report):
    output=io.StringIO(); writer=csv.writer(output)
    writer.writerow(['Section','Metric','Value'])
    for key,value in report['summary'].items(): writer.writerow(['Summary',key,value])
    for key in ('registeredCustomers','registeredCustomersAllTime','stores','agentRemittances'):
        writer.writerow(['Platform',key,report[key] if report[key] is not None else 'Unavailable'])
    for section in ('storeStatuses','applicationStatuses','applicationTypes','productStatuses','paymentsByDay','paymentMethods','subscriptionPayments','supportStatuses','byStore','customers','agents'):
        rows=report[section]
        writer.writerow([]);writer.writerow([section])
        if rows is None: writer.writerow(['Unavailable']); continue
        if not rows: writer.writerow(['No records']); continue
        columns=list(rows[0]);writer.writerow(columns)
        for row in rows: writer.writerow([csv_cell(row.get(key)) for key in columns])
    return '\ufeff'+output.getvalue()


def register_admin_platform(app,connect_admin,connect_db,authorized):
    def guarded(admin=True):
        def decorate(fn):
            @wraps(fn)
            def run(*args,**kwargs):
                if admin and not authorized(): return jsonify(error='Administrator sign-in is required.'),403
                try: return fn(*args,**kwargs)
                except ValueError as error: return jsonify(error=str(error)),400
                except RuntimeError as error: return jsonify(error=str(error)),503
                except APIError as error:
                    app.logger.warning('Platform database failure: code=%s',error.code)
                    if error.code in ('PGRST205','PGRST202','42P01','42883','42703'): return jsonify(error=SCHEMA_NOTICE),503
                    if error.code in ('P0001','23505'): return jsonify(error=error.message if error.code=='P0001' else 'This request was already saved; refresh.'),409
                    return jsonify(error='Unable to access this page. Please retry.'),502
            return run
        return decorate

    def account():
        token=request.cookies.get('adepa_access')
        if not token: return None
        user=connect_db().auth.get_user(token).user
        if not user: return None
        role=user.app_metadata.get('role','Customer')
        if user.app_metadata.get('store_staff'): role='Store Manager'
        if role not in ('Customer','Store Manager','Field Agent'): return None
        return dict(id=user.id,email=user.email,name=' '.join(str(user.user_metadata.get(key,'')).strip() for key in ('firstName','lastName')).strip() or user.email,role=role)

    @app.route('/api/auth/admin/settings',methods=['GET','POST'])
    @guarded()
    def admin_settings():
        client=connect_admin()
        if request.method=='GET':
            saved=settings(client,True)
            return jsonify(settings=saved,notice=None if saved['available'] else SCHEMA_NOTICE)
        data=object_data(); values=clean_settings(data.get('values')); revision=data.get('revision')
        if type(revision) is not int or revision<0: raise ValueError('Refresh settings before saving.')
        saved=client.rpc('admin_save_platform_settings',dict(p_values=values,p_revision=revision,p_actor=authorized())).execute().data
        return jsonify(settings=dict(saved,available=True),saved=True)

    @app.route('/api/auth/support',methods=['GET','POST'])
    @guarded(False)
    def support():
        user=account()
        if not user: return jsonify(error='Sign in to contact support.'),401
        client=connect_admin()
        if request.method=='POST':
            data=object_data()
            subject=text_value(data.get('subject'),'a subject',3,200); body=text_value(data.get('body'),'a message',1)
            if data.get('category') not in CATEGORIES: raise ValueError('Choose a support category.')
            result=client.rpc('support_create_ticket',dict(p_id=str(UUID(str(data.get('requestId')))),p_user=user['id'],p_email=user['email'],p_name=user['name'],p_role=user['role'],p_subject=subject,p_category=data['category'],p_body=body)).execute().data
            return jsonify(ticket=result),201
        config=settings(client,True)
        rows=ticket_rows(client,user['id']); rows.sort(key=lambda row:(row['updated_at'],row['id']),reverse=True)
        return jsonify(**paginate(rows),categories=CATEGORIES,contact={key:config['values'][key] for key in ('platformName','supportEmail','supportPhone','announcement','supportEnabled')})

    @app.route('/api/auth/support/<key>',methods=['GET','POST'])
    @guarded(False)
    def user_ticket(key):
        user=account()
        if not user: return jsonify(error='Sign in to access support.'),401
        return handle_ticket(str(UUID(key)),user)

    @app.get('/api/auth/admin/support')
    @guarded()
    def admin_support():
        rows=ticket_rows(connect_admin()); summary=[dict(label=status,count=sum(row['status']==status for row in rows)) for status in STATUSES]
        query=text_value(request.args.get('q',''),'a search',0,200).casefold(); status=request.args.get('status'); category=request.args.get('category')
        if status and status not in STATUSES or category and category not in CATEGORIES: raise ValueError('Choose valid support filters.')
        rows=[row for row in rows if (not status or row['status']==status) and (not category or row['category']==category) and (not query or query in ' '.join(str(row[k]) for k in ('subject','name','email','category')).casefold())]
        rows.sort(key=lambda row:(row['updated_at'],row['id']),reverse=True)
        return jsonify(**paginate(rows),summary=summary,categories=CATEGORIES,statuses=STATUSES)

    @app.route('/api/auth/admin/support/<key>',methods=['GET','POST'])
    @guarded()
    def admin_ticket(key): return handle_ticket(str(UUID(key)))

    def handle_ticket(key,user=None):
        client=connect_admin(); detail=ticket_detail(client,key,user['id'] if user else None)
        if detail is None: return jsonify(error='Support request not found.'),404
        if request.method=='POST':
            data=object_data(); body=data.get('body'); status=data.get('status')
            if body is not None: body=text_value(body,'a reply',1)
            if user and status is not None: return jsonify(error='Only administrators can change support status.'),403
            if status is not None and status not in STATUSES: raise ValueError('Choose a valid support status.')
            if body is None and status is None: raise ValueError('Provide a reply or status.')
            revision=data.get('revision')
            if type(revision) is not int or revision<1: raise ValueError('Refresh the support request before replying.')
            client.rpc('support_update_ticket',dict(p_ticket=key,p_request=str(UUID(str(data.get('requestId')))),p_user=user['id'] if user else None,p_actor=user['email'] if user else authorized(),p_body=body,p_revision=revision,p_status=status)).execute()
            detail=ticket_detail(client,key,user['id'] if user else None)
        return jsonify(**detail)

    @app.route('/api/auth/admin/notifications',methods=['GET','POST'])
    @guarded()
    def admin_platform_notifications():
        client=connect_admin(); records=Records(client); config=settings(client,True)
        feed=notification_feed(records,config['values'])
        if not config['available'] and SCHEMA_NOTICE not in records.warnings: records.warnings.append(SCHEMA_NOTICE)
        actor=authorized()
        try:
            seen=[]
            while True:
                batch=client.table('admin_notification_reads').select('notification_key').eq('actor',actor).order('notification_key').range(len(seen),len(seen)+499).execute().data
                seen.extend(batch)
                if len(batch)<500: break
            keys={row['notification_key'] for row in seen}; ready=True
        except APIError as error:
            if error.code not in ('PGRST205','42P01'): raise
            keys=set();ready=False
            if SCHEMA_NOTICE not in records.warnings: records.warnings.append(SCHEMA_NOTICE)
        if request.method=='POST':
            if not ready: return jsonify(error=SCHEMA_NOTICE),503
            data=object_data(); all_keys={row['id'] for row in feed}
            if data.get('action') not in ('read','read_all'): raise ValueError('Choose mark read or mark all read.')
            selected=list(all_keys) if data['action']=='read_all' else data.get('ids')
            if not isinstance(selected,list) or (data['action']=='read' and len(selected)>500) or any(not isinstance(key,str) or key not in all_keys for key in selected): raise ValueError('Refresh this notification inbox.')
            for start in range(0,len(selected),500):
                client.table('admin_notification_reads').upsert([dict(actor=actor,notification_key=key) for key in set(selected[start:start+500])],on_conflict='actor,notification_key').execute()
            return jsonify(saved=True)
        feed=[dict(row,read=row['id'] in keys if ready else None) for row in feed]
        unread=sum(not row['read'] for row in feed) if ready else None
        category=request.args.get('category'); query=text_value(request.args.get('q',''),'a search',0,200).casefold()
        filtered=[row for row in feed if (not category or row['category']==category) and (request.args.get('unread')!='1' or row['read'] is False) and (not query or query in (row['title']+' '+row['message']).casefold())]
        return jsonify(**paginate(filtered),unread=unread,readTrackingAvailable=ready,warnings=records.warnings,categories=sorted({row['category'] for row in feed}))

    @app.get('/api/auth/admin/reports')
    @guarded()
    def admin_platform_reports():
        since=date.fromisoformat(request.args['since']) if request.args.get('since') else None
        until=date.fromisoformat(request.args['until']) if request.args.get('until') else None
        if since and until and since>until: raise ValueError('Choose a valid date range.')
        store_id=request.args.get('store'); store_id=str(UUID(store_id)) if store_id else None
        records=Records(connect_admin()); report=platform_report(records,since,until,store_id)
        if request.args.get('format')=='csv':
            return Response(report_csv(report),mimetype='text/csv',headers={'Content-Disposition':'attachment; filename="AdepaPay-platform-report.csv"'})
        stores=[dict(id=row['id'],name=row['storeName']) for user in records.users.values() if (row:=application_data(user))]
        return jsonify(**report,warnings=records.warnings,storeOptions=stores,since=str(since) if since else None,until=str(until) if until else None,generatedAt=datetime.now(timezone.utc).isoformat())
