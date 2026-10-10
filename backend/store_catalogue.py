"""Category management and manually received trade-in stock."""
from datetime import datetime, timezone
from uuid import UUID
import re
import httpx
from flask import jsonify, request
from postgrest.exceptions import APIError
try:
    from .store_products import text_field, number, choice
    from .store_promotions import day
except ImportError:
    from store_products import text_field, number, choice
    from store_promotions import day


def all_rows(client, table, store_id, columns='*'):
    rows = []
    offset = 0
    while True:
        batch = client.table(table).select(columns).eq('store_id', store_id).order('id').range(offset, offset+499).execute().data
        rows.extend(batch)
        if len(batch)<500:
            return rows
        offset += 500


def trade_values(data, previous):
    if previous and previous['status']=='RESOLD':
        raise ValueError('Resold inventory is read-only.')
    values = {key: text_field(data, key, limit, required) for key, limit, required in (
        ('reference', 60, True), ('device', 160, True), ('serial_number', 100, False),
        ('source_reference', 100, False), ('notes', 3000, False))}
    values['reference'] = values['reference'].upper()
    if not re.fullmatch(r'[A-Z0-9][A-Z0-9._-]*', values['reference']):
        raise ValueError('Reference must use letters, numbers, dots, hyphens or underscores.')
    values.update(condition=choice(data, 'condition', ('Like New','Excellent','Good','Fair','Needs Repair')),
        acquisition_value=number(data, 'acquisition_value', 0, 9999999999.99), received_on=day(data, 'received_on'))
    if values['received_on']>datetime.now(timezone.utc).date().isoformat():
        raise ValueError('Received date cannot be in the future.')
    status = choice(data, 'status', ('HELD_FOR_SWAP','AVAILABLE','RESOLD'))
    allowed = {'HELD_FOR_SWAP': ('HELD_FOR_SWAP','AVAILABLE'), 'AVAILABLE': ('AVAILABLE','HELD_FOR_SWAP','RESOLD')}
    if not previous and status!='HELD_FOR_SWAP' or previous and status not in allowed[previous['status']]:
        raise ValueError('Receive the device as Held, complete checks before making it Available, then record resale.')
    values.update(status=status, resale_value=None, sold_at=None)
    if status=='RESOLD':
        values.update(resale_value=number(data, 'resale_value', .01, 9999999999.99), sold_at=datetime.now(timezone.utc).isoformat())
    return values


def register_store_catalogue(app, owner, connect_admin):
    @app.route('/api/auth/store/categories', methods=['GET','POST'])
    @app.route('/api/auth/store/category-options', methods=['GET','POST'])
    @app.route('/api/auth/store/trade-inventory', methods=['GET','POST'])
    def store_catalogue():
        store, error = owner()
        if error:
            return error
        trade = request.path.endswith('/trade-inventory')
        table = 'store_trade_inventory' if trade else 'store_categories'
        try:
            try:
                client = connect_admin()
            except RuntimeError:
                return jsonify(error='Store data access is not configured. Contact the administrator.'),503
            if request.method=='GET':
                rows=all_rows(client,table,store.id)
                if trade:
                    return jsonify(items=rows)
                if request.path.endswith('/category-options'):
                    return jsonify(categories=[{'name':row['name'],'status':row['status']} for row in rows])
                products=all_rows(client,'store_products',store.id,'id,name,category,stock,status,price,prices')
                return jsonify(categories=[{**row, 'product_count':sum(p['category']==row['name'] for p in products),
                    'stock_units':sum(p['stock'] for p in products if p['category']==row['name']),
                    'active_products':sum(p['category']==row['name'] and p['status']=='Active' for p in products)} for row in rows], products=products)
            data=request.get_json()
            if not isinstance(data,dict):
                raise ValueError('Provide valid record details.')
            if request.path.endswith('/category-options') and (data.get('id') or data.get('status')!='Active'):
                raise ValueError('Only new active categories can be added from the product form. Manage existing categories on the Categories page.')
            previous=None
            if data.get('id'):
                try:
                    item_id=str(UUID(str(data['id'])))
                except ValueError:
                    raise ValueError('Invalid record ID.') from None
                rows=client.table(table).select('*').eq('store_id',store.id).eq('id',item_id).limit(1).execute().data
                if not rows:
                    return jsonify(error='Record not found in your store.'),404
                previous=rows[0]
                if type(data.get('revision')) is not int or data['revision']!=previous['revision']:
                    return jsonify(error='This record changed. Refresh before editing again.'),409
            values=trade_values(data,previous) if trade else {
                'name':text_field(data,'name',100), 'description':text_field(data,'description',1000,False),
                'status':choice(data,'status',('Active','Archived'))}
            if previous:
                values.update(revision=previous['revision']+1,updated_at=datetime.now(timezone.utc).isoformat())
                result=client.table(table).update(values).eq('store_id',store.id).eq('id',previous['id']).eq('revision',previous['revision']).execute().data
                if not result:
                    return jsonify(error='This record changed. Refresh before editing again.'),409
            else:
                result=client.table(table).insert({**values,'store_id':store.id}).execute().data
            return jsonify(item=result[0]),200 if previous else 201
        except APIError as error:
            app.logger.warning('Catalogue request failed: code=%s',error.code)
            if error.code in ('42P01','PGRST205') or str(error.code)=='404':
                return jsonify(error='Run backend/migrations/003_categories_trade_inventory.sql after migrations 001 and 002 in Supabase SQL Editor, then refresh.'),503
            if error.code=='23505':
                return jsonify(error='This category name, inventory reference or serial number already exists in your store.'),409
            return jsonify(error='The database could not complete this request. Refresh before retrying.'),503
        except httpx.HTTPError:
            return jsonify(error='Cannot reach the store database. Refresh before retrying.'),503
