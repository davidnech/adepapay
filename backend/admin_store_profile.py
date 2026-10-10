"""Administrator-only store profiles and atomic lifecycle actions."""
from uuid import UUID
from functools import wraps
from flask import jsonify, request
from postgrest.exceptions import APIError


def read_rows(client, table, store_id, columns='*', order='id'):
    rows = []
    while True:
        batch = client.table(table).select(columns).eq('store_id', store_id).order(order).range(len(rows), len(rows)+499).execute().data
        rows.extend(batch)
        if len(batch) < 500:
            return rows


def register_admin_store_profile(app, connect_admin, authorized, directory_row):
    def guarded(fn):
        @wraps(fn)
        def wrapped(*args, **kwargs):
            try:
                response = app.make_response(fn(*args, **kwargs))
                response.headers['Cache-Control'] = 'private, no-store'
                return response
            except RuntimeError as error:
                return jsonify(error=str(error)), 503
            except APIError as error:
                app.logger.warning('Admin store database request failed: code=%s', error.code)
                return jsonify(error='The store database request failed. Refresh and retry; check the backend logs if it persists.'), 502
        return wrapped

    @app.get('/api/auth/admin/store-directory/<store_id>')
    @guarded
    def admin_store_profile(store_id):
        if not authorized():
            return jsonify(error='Administrator sign-in is required.'), 403
        UUID(store_id)
        client = connect_admin()
        user = client.auth.admin.get_user_by_id(store_id).user
        store = directory_row(user) if user else None
        if not store:
            return jsonify(error='Store not found.'), 404
        store['lifecycle'] = user.app_metadata.get('store_lifecycle', {})
        warnings = []

        def section(table, columns='*', order='id'):
            try:
                return read_rows(client, table, store_id, columns, order)
            except APIError as error:
                if error.code not in ('PGRST205', '42P01'):
                    raise
                warnings.append(f'{table} is unavailable. Run backend/setup_database.sql in Supabase SQL Editor.')
                return None

        products = section('store_products', 'id,name,sku,category,price,prices,stock,status,images,created_at')
        applications = section('customer_applications', 'id,customer_id,reference,kind,status,total,paid,fulfilled,details,created_at')
        agents = section('store_field_agents', 'id,email,status,profile,created_at')
        ratings = section('purchase_ratings', 'application_id,store_score,product_score,created_at', 'application_id')
        events = section('store_admin_events', 'id,action,actor,reason,created_at', 'created_at')
        customers = {}
        for item in applications or []:
            details = item.pop('details', {})
            customer = customers.setdefault(item['customer_id'], dict(id=item['customer_id'], name=details.get('fullName', ''),
                email=details.get('email', ''), phone=details.get('phone', ''), applications=0, paid=0, outstanding=0))
            customer['applications'] += 1
            customer['paid'] += float(item['paid'])
            if item['status'] in ('Approved', 'Completed'):
                customer['outstanding'] += float(item['total'])-float(item['paid'])
        # Never expose identity documents, guarantors, upload tokens or passwords.
        agent_rows = [dict(id=a['id'], email=a['email'], status=a['status'], name=a['profile'].get('fullName',''),
                           phone=a['profile'].get('phone',''), area=a['profile'].get('area','')) for a in agents or []]
        archived_products = None
        if store['status'] == 'Deleted':
            archived_products = section('deleted_store_products', 'product_id,product,deleted_at', 'product_id')
            if archived_products is not None:
                products = [{key: item['product'].get(key) for key in ('id','name','sku','category','price','prices','stock','status','images','created_at')} for item in archived_products]
        return jsonify(store=store, products=products, customers=list(customers.values()) if applications is not None else None,
                       applications=applications, agents=agent_rows if agents is not None else None, ratings=ratings,
                       events=events, warnings=warnings,
                       summary=dict(products=len(products) if products is not None else None,
                           customers=len(customers) if applications is not None else None,
                           agents=len(agents) if agents is not None else None,
                           activeAgents=sum(a['status']=='Active' for a in agents) if agents is not None else None,
                           applications=len(applications) if applications is not None else None,
                           rating=round(sum(r['store_score'] for r in ratings)/len(ratings),2) if ratings else None,
                           ratingCount=len(ratings) if ratings is not None else None))

    @app.post('/api/auth/admin/store-directory/<store_id>/action')
    @guarded
    def admin_store_action(store_id):
        actor = authorized()
        if not actor:
            return jsonify(error='Administrator sign-in is required.'), 403
        UUID(store_id)
        data = request.get_json()
        if not isinstance(data, dict) or data.get('action') not in ('suspend','reactivate','delete','restore'):
            return jsonify(error='Choose a valid store action.'), 400
        reason = data.get('reason', '')
        revision = data.get('revision')
        if not isinstance(reason,str) or not 3 <= len(reason.strip()) <= 2000 or type(revision) is not int or revision < 0:
            return jsonify(error='Provide a reason (3–2000 characters) and reload the store before trying again.'), 400
        client = connect_admin()
        user = client.auth.admin.get_user_by_id(store_id).user
        store = directory_row(user) if user else None
        if not store:
            return jsonify(error='Store not found.'), 404
        if data['action'] == 'delete' and data.get('confirmation') != store['storeName']:
            return jsonify(error='Type the exact store name to confirm deletion.'), 400
        try:
            result = client.rpc('admin_store_action', dict(p_store=store_id,p_action=data['action'],p_reason=reason.strip(),
                p_actor=actor,p_revision=revision,p_status=data.get('status',''))).execute().data
        except APIError as error:
            if error.code in ('PGRST202','PGRST205','42P01'):
                return jsonify(error='Run migrations 007_admin_store_management.sql and 010_restore_deleted_stores.sql in Supabase SQL Editor to enable store actions.'), 503
            if error.code == 'P0001':
                return jsonify(error=error.message), 409
            raise
        return jsonify(result=result)
