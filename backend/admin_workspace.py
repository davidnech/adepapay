"""Live admin landing page, cross-directory search and database readiness."""
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import jsonify, request
from postgrest.exceptions import APIError
try:
    from .admin_operations import Records, amount
    from .admin_platform import platform_report, optional_rows, settings, SCHEMA_NOTICE
    from .store_directory import directory_row
except ImportError:
    from admin_operations import Records, amount
    from admin_platform import platform_report, optional_rows, settings, SCHEMA_NOTICE
    from store_directory import directory_row

SEARCH_MODULES=('customers','products','categories','applications','collection-agents','transactions','audit-logs')
SEARCH_KEYS=('id','name','email','phone','reference','customerName','productName','storeName','sku','category','region','area','action','actor','reason')


def search_records(records,query,scope='all'):
    results=[]
    def add(kind,key,title,description,page,searchable):
        if scope not in ('all',page): return
        if query.casefold() not in searchable.casefold(): return
        results.append(dict(kind=kind,id=key,title=title,description=description,page=page))
    for user in records.users.values():
        store=directory_row(user)
        if store:
            add('Store',store['id'],store['storeName'],store['status']+' · '+store['email'],'stores',
                ' '.join(str(store.get(key,'')) for key in ('id','storeName','ownerName','registeredName','reference','email','phone','region')))
    for module in SEARCH_MODULES:
        if scope not in ('all',module,'swap-overview','layaway-plans','active-purchases','agent-settlements'): continue
        rows,_=records.build(module)
        for row in rows:
            page=module
            if module=='applications':
                page='swap-overview' if row['kind']=='swap' else 'layaway-plans' if row['kind']=='layaway' else 'applications'
                if scope in ('applications','active-purchases'):
                    if scope=='active-purchases' and row['status'] not in ('Approved','Completed'): continue
                    page=scope
            elif module=='collection-agents' and scope=='agent-settlements': page=scope
            title=str(row.get('name') or row.get('reference') or row.get('action') or row['id'])
            description=' · '.join(str(row.get(key,'')) for key in ('customerName','productName','storeName','status','kind') if row.get(key))
            add({'customers':'Customer','products':'Product','categories':'Category','applications':'Application','collection-agents':'Field agent','transactions':'Transaction','audit-logs':'Audit event'}[module],row['id'],title,description,page,
                ' '.join(str(row.get(key,'')) for key in SEARCH_KEYS))
    if scope in ('all','support'):
        for ticket in optional_rows(records,'support_tickets') or []:
            add('Support request',ticket['id'],ticket['subject'],ticket['name']+' · '+ticket['status'],'support',
                ' '.join(str(ticket[key]) for key in ('id','subject','name','email','category')))
    if scope in ('all','subscriptions'):
        for plan in records.table('subscription_plans'):
            add('Subscription plan',plan['id'],plan['name'],'Published' if plan['enabled'] else 'Unpublished','subscriptions',plan['id']+' '+plan['name'])
    # Stable ordering puts exact references/names first, then groups results.
    return sorted(results,key=lambda row:(row['title'].casefold()!=query.casefold(),row['kind'],row['title'].casefold(),row['id']))


def dashboard_data(records):
    now=datetime.now(timezone.utc); since=(now-timedelta(days=29)).date()
    report=platform_report(records,since,now.date())
    customers,customer_summary=records.build('customers')
    applications,_=records.build('applications'); products,_=records.build('products'); agents,_=records.build('collection-agents')
    transactions,_=records.build('transactions'); events,_=records.build('audit-logs')
    stores=[row for user in records.users.values() if (row:=directory_row(user))]
    tickets=optional_rows(records,'support_tickets')
    preferences=settings(records.client,True)
    if not preferences['available'] and SCHEMA_NOTICE not in records.warnings: records.warnings.append(SCHEMA_NOTICE)
    threshold=preferences['values']['lowStockThreshold']
    def recent(rows,limit=5): return sorted(rows,key=lambda row:(str(row.get('createdAt','')),row['id']),reverse=True)[:limit]
    totals=dict(customers=len(customers),stores=sum(row['status']!='Deleted' for row in stores),activeStores=sum(row['status']=='Active' for row in stores),
        products=len(products),activeProducts=sum(row['status']=='Active' for row in products),agents=len(agents),activeAgents=sum(row['status']=='Active' for row in agents),
        applications=len(applications),activePurchases=sum(row['status']=='Approved' for row in applications),completedPurchases=sum(row['status']=='Completed' for row in applications),
        outstanding=report['summary']['outstanding'],customerPayments=sum(amount(row['amount']) for row in records.table('application_payments')))
    attention=[dict(label='Stores awaiting approval',count=sum(row['status']=='Pending Approval' for row in stores),page='store-approvals'),
        dict(label='Applications awaiting review',count=sum(row['status'] in ('Pending','Offered') for row in applications),page='applications'),
        dict(label='Unresolved support requests',count=sum(row['status'] in ('Open','In Progress') for row in tickets) if tickets is not None else None,page='support'),
        dict(label=f'Active products at or below {threshold} units',count=sum(row['status']=='Active' and row['stock']<=threshold for row in products),page='products')]
    return dict(totals=totals,attention=attention,customerStatuses=customer_summary,storeStatuses=report['storeStatuses'],
        applicationStatuses=report['applicationStatuses'],applicationTypes=report['applicationTypes'],
        period=dict(since=str(since),until=str(now.date()),payments=report['summary']['confirmedPayments'],paymentCount=report['summary']['paymentCount'],applications=report['summary']['applications'],
            paymentsByDay=report['paymentsByDay'],subscriptions=report['subscriptionPayments']),
        recentApplications=[{key:row[key] for key in ('id','reference','customerName','productName','storeName','status','kind','createdAt')} for row in recent(applications)],
        recentTransactions=[{key:row[key] for key in ('id','reference','kind','total','status','createdAt')} for row in recent(transactions)],
        recentStores=[dict(id=row['id'],name=row['storeName'],status=row['status'],createdAt=row['createdAt']) for row in recent(stores)],
        recentActivity=[{key:row[key] for key in ('id','action','actor','kind','reason','createdAt')} for row in recent(events)],
        warnings=list(dict.fromkeys(records.warnings)),generatedAt=now.isoformat())


def register_admin_workspace(app,connect_admin,authorized):
    def guarded(fn):
        @wraps(fn)
        def run(*args,**kwargs):
            if not authorized(): return jsonify(error='Administrator sign-in is required.'),403
            try: return fn(*args,**kwargs)
            except ValueError as error: return jsonify(error=str(error)),400
            except RuntimeError as error: return jsonify(error=str(error)),503
            except APIError as error:
                app.logger.warning('Admin workspace database failure: code=%s',error.code)
                return jsonify(error='Admin data is unavailable. Run backend/setup_database.sql if tables are missing, then refresh.'),503
        return run

    @app.get('/api/auth/admin/dashboard')
    @guarded
    def admin_dashboard(): return jsonify(**dashboard_data(Records(connect_admin())))

    @app.get('/api/auth/admin/search')
    @guarded
    def admin_global_search():
        query=request.args.get('q','').strip()
        if not 2<=len(query)<=200: raise ValueError('Enter a search of 2-200 characters.')
        scope=request.args.get('scope','all')
        if scope not in ('all','stores','support','subscriptions',*SEARCH_MODULES,'swap-overview','layaway-plans','active-purchases','agent-settlements'): raise ValueError('Choose a valid search category.')
        page=int(request.args.get('page','1'))
        if not 1<=page<=100000: raise ValueError('Choose a valid search page.')
        records=Records(connect_admin()); rows=search_records(records,query,scope)
        page=min(page,max(1,(len(rows)+19)//20))
        return jsonify(items=rows[(page-1)*20:page*20],total=len(rows),page=page,pageSize=20,query=query,warnings=list(dict.fromkeys(records.warnings)))

    @app.get('/api/auth/admin/status')
    @guarded
    def admin_database_status():
        client=connect_admin(); checks=[]
        for name,table in (('Catalogue','store_products'),('Applications','customer_applications'),('Payments','application_payments'),('Settings','platform_settings'),('Support','support_tickets'),('Notification reads','admin_notification_reads'),('Agent settlements','agent_settlements')):
            try:
                client.table(table).select('*').limit(1).execute()
                checks.append(dict(name=name,ready=True))
            except APIError as error:
                if error.code not in ('PGRST205','42P01'): raise
                checks.append(dict(name=name,ready=False))
        return jsonify(databaseConnected=True,setupComplete=all(row['ready'] for row in checks),services=checks,checkedAt=datetime.now(timezone.utc).isoformat())
