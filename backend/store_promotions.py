"""Store offer management. Checkout redemption is not performed by these routes."""
from datetime import date, datetime, timezone
import re
from uuid import uuid4
import httpx
from flask import jsonify, request
from postgrest.exceptions import APIError
try:
    from .store_products import number, text_field, boolean, choice
except ImportError:
    from store_products import number, text_field, boolean, choice

TABLE = 'store_promotion_settings'


def day(data, key):
    value = data.get(key)
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
        raise ValueError(f'Enter a valid {key} date.')
    try:
        date.fromisoformat(value)
    except ValueError:
        raise ValueError(f'Enter a valid {key} date.') from None
    return value


def products_for(client, store_id):
    products = []
    start = 0
    while True:
        rows = client.table('store_products').select('id,name,category,status').eq('store_id', store_id).order('id').range(start, start + 499).execute().data
        products.extend(rows)
        if len(rows) < 500:
            return products
        start += 500


def clean_settings(data, previous, products):
    result = {'public_enabled': boolean(data, 'public_enabled')}
    product_ids = {product['id'] for product in products}
    categories = {product['category'] for product in products}
    for kind in ('campaigns', 'codes'):
        items = data.get(kind)
        if not isinstance(items, list) or len(items) > 100:
            raise ValueError('Keep at most 100 promotions and 100 codes per store.')
        existing = {item['id']: item for item in previous[kind]}
        seen = set()
        codes = set()
        cleaned = []
        for item in items:
            if not isinstance(item, dict):
                raise ValueError('Provide valid promotion details.')
            item_id = item.get('id')
            if item_id is not None and (not isinstance(item_id, str) or item_id not in existing):
                raise ValueError('Unknown promotion. Reload before editing.')
            item_id = item_id or str(uuid4())
            if item_id in seen:
                raise ValueError('A promotion cannot appear twice.')
            seen.add(item_id)
            row = {'id': item_id, 'description': text_field(item, 'description', 1000, False),
                   'discountPercent': number(item, 'discountPercent', 1, 90), 'enabled': boolean(item, 'enabled')}
            if kind == 'campaigns':
                row.update(name=text_field(item, 'name', 160), scope=choice(item, 'scope', ('All products', 'Category', 'Selected products')),
                           startsAt=day(item, 'startsAt'), endsAt=day(item, 'endsAt'), categories=[], productIds=[])
                if row['endsAt'] < row['startsAt']:
                    raise ValueError('The promotion end date must be on or after its start date.')
                key = 'categories' if row['scope'] == 'Category' else 'productIds'
                if row['scope'] != 'All products':
                    selected = item.get(key)
                    allowed = categories if key == 'categories' else product_ids
                    if not isinstance(selected, list) or not 1 <= len(selected) <= 100 or any(not isinstance(value, str) or value not in allowed for value in selected):
                        raise ValueError('Select eligible products or categories belonging to this store.')
                    row[key] = list(dict.fromkeys(selected))
            else:
                code = text_field(item, 'code', 40).upper()
                if not re.fullmatch(r'[A-Z0-9][A-Z0-9-]{3,39}', code) or code in codes:
                    raise ValueError('Use a unique code of 4–40 letters, numbers or hyphens.')
                codes.add(code)
                used = existing.get(item_id, {}).get('usedCount', 0)
                if used and code != existing[item_id]['code']:
                    raise ValueError('A redeemed code cannot be renamed. Create a new code instead.')
                row.update(code=code, minimumSpend=number(item, 'minimumSpend', 0, 9999999999.99),
                           usageLimit=number(item, 'usageLimit', max(1, used), 1000000, True),
                           usedCount=used, expiresAt=day(item, 'expiresAt'))
            cleaned.append(row)
        if kind == 'codes' and any(item.get('usedCount', 0) and item['id'] not in seen for item in previous[kind]):
            raise ValueError('Codes with recorded redemptions cannot be deleted. Pause them instead.')
        result[kind] = cleaned
    return result


def with_status(settings):
    today = datetime.now(timezone.utc).date().isoformat()
    result = {**settings}
    result['campaigns'] = [{**row, 'status': 'Paused' if not row['enabled'] else 'Scheduled' if row['startsAt'] > today else 'Expired' if row['endsAt'] < today else 'Active'} for row in settings['campaigns']]
    result['codes'] = [{**row, 'status': 'Paused' if not row['enabled'] else 'Expired' if row['expiresAt'] < today else 'Exhausted' if row['usedCount'] >= row['usageLimit'] else 'Active'} for row in settings['codes']]
    return result


def register_store_promotions(app, owner, connect_admin):
    @app.route('/api/auth/store/promotions', methods=['GET', 'POST'])
    def store_promotions():
        store, error = owner()
        if error:
            return error
        try:
            try:
                client = connect_admin()
            except RuntimeError:
                return jsonify(error='Promotion management is not configured. Contact the administrator.'), 503
            rows = client.table(TABLE).select('*').eq('store_id', store.id).limit(1).execute().data
            current = rows[0] if rows else {'store_id': store.id, 'public_enabled': True, 'campaigns': [], 'codes': [], 'revision': 0, 'updated_at': None}
            products = products_for(client, store.id)
            if request.method == 'GET':
                return jsonify(settings=with_status(current), products=products)
            request.max_content_length = 256 * 1024
            data = request.get_json()
            if not isinstance(data, dict):
                raise ValueError('Provide the promotion settings.')
            if type(data.get('revision')) is not int or data['revision'] != current['revision']:
                return jsonify(error='Promotions changed. Refresh before editing again.'), 409
            values = clean_settings(data, current, products)
            values.update(revision=current['revision'] + 1, updated_at=datetime.now(timezone.utc).isoformat())
            if rows:
                saved = client.table(TABLE).update(values).eq('store_id', store.id).eq('revision', current['revision']).execute().data
                if not saved:
                    return jsonify(error='Promotions changed. Refresh before editing again.'), 409
            else:
                saved = client.table(TABLE).insert({**values, 'store_id': store.id}).execute().data
            return jsonify(settings=with_status(saved[0]))
        except APIError as error:
            app.logger.warning('Promotions database error: code=%s', error.code)
            if error.code in ('42P01', 'PGRST205') or str(error.code) == '404':
                return jsonify(error='Promotion tables are unavailable. Run backend/migrations/001_store_products.sql and 002_store_promotions.sql in Supabase SQL Editor and ensure the Data API is enabled.'), 503
            if error.code == '23505':
                return jsonify(error='Another session saved promotions. Refresh before editing again.'), 409
            return jsonify(error='Unable to save or load promotions. Check the server Supabase key and table permissions, then refresh.'), 503
        except httpx.HTTPError:
            return jsonify(error='Cannot reach the promotions database. Refresh before retrying.'), 503
