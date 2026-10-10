"""Store-scoped reporting and a per-member notification inbox."""
from datetime import date, datetime, timezone
from decimal import Decimal
from flask import g, jsonify, request


def notification_feed(applications, events, products, agents, preferences=None, threshold=5):
    preferences=preferences or {}
    references = {row['id']: row['reference'] for row in applications}
    feed = [dict(id='event:'+row['id'], category='Payments' if row.get('event')=='payment' else 'Applications', title=references.get(row['application_id'], 'Application activity'),
                 message=row['message'], createdAt=row['created_at'], target='payments' if row.get('event')=='payment' else 'applications',record=row['application_id']) for row in events
            if preferences.get('paymentAlerts' if row.get('event')=='payment' else 'applicationAlerts',True)]
    for product in products:
        if preferences.get('stockAlerts',True) and product['status'] == 'Active' and product['stock'] <= threshold:
            feed.append(dict(id=f"product:{product['id']}:{product['revision']}", category='Stock',
                title='Out of stock' if product['stock'] == 0 else 'Low stock',
                message=f"{product['name']}: {product['stock']} units available.", createdAt=product['updated_at'],target='products',record=product['id']))
    for agent in agents:
        feed.append(dict(id=f"agent:{agent['id']}:{agent['revision']}", category='Agents',
            title='Agent account update', message=f"{agent['profile'].get('fullName','Agent')}: {agent['status']}.",
            createdAt=agent['updated_at'],target='collection-agents',record=agent['id']))
    return sorted(feed, key=lambda row: (row['createdAt'], row['id']), reverse=True)


def build_report(applications, payments, products, agents, since=None, until=None):
    def in_period(row):
        day = date.fromisoformat(row['created_at'][:10])
        return (since is None or day >= since) and (until is None or day <= until)

    period_apps = [row for row in applications if in_period(row)]
    period_payments = [row for row in payments if in_period(row)]
    customers = {}
    for row in applications:
        customer = customers.setdefault(row['customer_id'], dict(id=row['customer_id'],
            name=row['details'].get('fullName','Customer'), applications=0, activePlans=0, paid=Decimal(0), outstanding=Decimal(0)))
        customer['applications'] += 1
        customer['paid'] += Decimal(str(row['paid']))
        if row['status'] == 'Approved':
            customer['activePlans'] += 1
            customer['outstanding'] += Decimal(str(row['total']))-Decimal(str(row['paid']))
    for customer in customers.values():
        customer['paid'] = float(customer['paid'])
        customer['outstanding'] = float(customer['outstanding'])
    def counts(rows, key):
        values = {}
        for row in rows:
            values[row[key]] = values.get(row[key],0)+1
        return [dict(label=label,count=count) for label,count in sorted(values.items())]
    daily = {}
    for payment in period_payments:
        day=payment['created_at'][:10]
        daily[day]=daily.get(day,Decimal(0))+Decimal(str(payment['amount']))
    summary = dict(customers=len(customers), periodCustomers=len({row['customer_id'] for row in period_apps}),
        agents=len(agents), activeAgents=sum(row['status']=='Active' for row in agents),
        products=len(products), activeProducts=sum(row['status']=='Active' for row in products),
        completedPurchasesAllTime=sum(row['status']=='Completed' for row in applications),
        stockUnits=sum(row['stock'] for row in products if row['status']=='Active'),
        lowStockProducts=sum(row['status']=='Active' and 0<row['stock']<=5 for row in products),
        outOfStockProducts=sum(row['status']=='Active' and row['stock']==0 for row in products),
        applications=len(period_apps), activePlans=sum(row['status']=='Approved' for row in applications),
        completedPurchases=sum(row['status']=='Completed' for row in period_apps),
        confirmedPayments=float(sum((Decimal(str(row['amount'])) for row in period_payments),Decimal(0))),
        paymentCount=len(period_payments), outstanding=float(sum((Decimal(str(row['total']))-Decimal(str(row['paid'])) for row in applications if row['status']=='Approved'),Decimal(0))))
    return dict(summary=summary, applicationStatuses=counts(period_apps,'status'), applicationTypes=counts(period_apps,'kind'),
        productStatuses=counts(products,'status'), paymentsByDay=[dict(date=day,amount=float(amount)) for day,amount in sorted(daily.items())],
        paymentMethods=[dict(label=method,amount=float(sum((Decimal(str(row['amount'])) for row in period_payments if row['method']==method),Decimal(0)))) for method in sorted({row['method'] for row in period_payments})],
        customers=sorted(customers.values(),key=lambda row:row['name'].casefold()),
        agents=[dict(id=row['id'],name=row['profile'].get('fullName','Agent'),status=row['status'],region=row['profile'].get('region',''),area=row['profile'].get('area','')) for row in agents])


def register_store_insights(app, store_scope, connect_admin, rows_for, guarded):
    def rows(client, table, store_id):
        return rows_for(client, table, 'store_id', store_id)

    @app.get('/api/auth/store/reports')
    @guarded
    def reports():
        store=store_scope('reports')
        try:
            since=date.fromisoformat(request.args['since']) if request.args.get('since') else None
            until=date.fromisoformat(request.args['until']) if request.args.get('until') else None
            if since and until and since>until: raise ValueError()
        except ValueError:
            return jsonify(error='Choose a valid report date range.'),400
        client=connect_admin()
        report=build_report(rows(client,'customer_applications',store.id),rows(client,'application_payments',store.id),
            rows(client,'store_products',store.id),rows(client,'store_field_agents',store.id),since,until)
        return jsonify(**report, since=since.isoformat() if since else None,until=until.isoformat() if until else None,
            generatedAt=datetime.now(timezone.utc).isoformat())

    @app.route('/api/auth/store/notifications',methods=['GET','POST'])
    @guarded
    def notifications():
        store=store_scope('notifications'); client=connect_admin(); actor=g.store_actor
        settings=store.app_metadata.get('store_settings',{})
        feed=notification_feed(rows(client,'customer_applications',store.id),rows(client,'application_events',store.id),
            rows(client,'store_products',store.id),rows(client,'store_field_agents',store.id),settings.get('Notifications',{}),settings.get('Inventory',{}).get('lowStockThreshold',5))
        try:
            from .portal_workspace import support_activity
        except ImportError:
            from portal_workspace import support_activity
        feed.extend(support_activity(client,actor.id,rows_for))
        feed.sort(key=lambda row:(row['createdAt'],row['id']),reverse=True)
        membership=actor.app_metadata.get('store_staff')
        if membership:
            for item in feed:
                if item['target'] not in membership['permissions']: item['target']=None; item['record']=None
        if request.method=='POST':
            request.max_content_length=64*1024
            data=request.get_json()
            if not isinstance(data,dict) or data.get('action') not in ('read','read_all'):
                return jsonify(error='Choose mark read or mark all read.'),400
            keys={row['id'] for row in feed}
            selected=list(keys) if data['action']=='read_all' else data.get('ids')
            if not isinstance(selected,list) or not selected or any(not isinstance(key,str) or key not in keys for key in selected):
                if data['action']=='read_all' and not selected: return jsonify(saved=True)
                return jsonify(error='These notifications are unavailable. Refresh the inbox.'),400
            for start in range(0,len(selected),500):
                client.table('store_notification_reads').upsert([dict(store_id=store.id,user_id=actor.id,notification_key=key)
                    for key in set(selected[start:start+500])],on_conflict='store_id,user_id,notification_key').execute()
            return jsonify(saved=True)
        seen=client.table('store_notification_reads').select('notification_key').eq('store_id',store.id).eq('user_id',actor.id)
        read_keys=set(); offset=0
        while True:
            batch=seen.order('notification_key').range(offset,offset+499).execute().data
            read_keys.update(row['notification_key'] for row in batch)
            if len(batch)<500: break
            offset+=500
        feed=[dict(row,read=row['id'] in read_keys) for row in feed]
        return jsonify(items=feed,unread=sum(not row['read'] for row in feed))
