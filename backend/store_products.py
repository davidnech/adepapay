"""Product catalogue backed by a store-scoped Postgres table."""
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import re
from uuid import UUID
from flask import jsonify, request
from itsdangerous import URLSafeTimedSerializer, BadSignature
from postgrest.exceptions import APIError
import httpx

TABLE = 'store_products'
PAYMENTS = ('payNow', 'hirePurchase', 'layaway')


def text_field(data, key, limit, required=True):
    value = data.get(key, '')
    if not isinstance(value, str) or len(value) > limit or (required and not value.strip()):
        raise ValueError(f'Enter a valid {key} (maximum {limit} characters).')
    return value.strip()


def number(data, key, minimum, maximum, integer=False):
    raw = data.get(key)
    if isinstance(raw, bool) or not isinstance(raw, (str, int, float)) or len(str(raw)) > 30:
        raise ValueError(f'Enter a valid {key}.')
    try:
        value = Decimal(str(raw))
        if not value.is_finite() or not Decimal(str(minimum)) <= value <= Decimal(str(maximum)) or value != value.quantize(Decimal('1' if integer else '.01')):
            raise InvalidOperation
    except InvalidOperation:
        raise ValueError(f'{key} must be between {minimum} and {maximum}, using {"whole numbers" if integer else "at most two decimal places"}.') from None
    return int(value) if integer else float(value)


def choice(data, key, choices):
    value = data.get(key)
    if value not in choices:
        raise ValueError(f'Choose a valid {key}.')
    return value


def boolean(data, key):
    if type(data.get(key)) is not bool:
        raise ValueError(f'Choose a valid {key} setting.')
    return data[key]


def clean_product(data, previous, store_id, secret):
    values = {key: text_field(data, key, limit, required) for key, limit, required in (
        ('name', 160, True), ('sku', 60, True), ('category', 100, True), ('description', 3000, False))}
    values['sku'] = values['sku'].upper()
    if not re.fullmatch(r'[A-Z0-9][A-Z0-9._-]*', values['sku']):
        raise ValueError('SKU must use letters, numbers, dots, underscores or hyphens.')
    values.update(condition=choice(data, 'condition', ('New', 'Used')),
                  status=choice(data, 'status', ('Active', 'Draft', 'Archived')),
                  price=number(data, 'price', .01, 9999999999.99), stock=number(data, 'stock', 0, 1000000, True))
    options = data.get('payment_options')
    if not isinstance(options, dict) or set(options) != set(PAYMENTS):
        raise ValueError('Choose valid payment options.')
    values['payment_options'] = {key: boolean(options, key) for key in PAYMENTS}
    if not any(values['payment_options'].values()):
        raise ValueError('Choose at least one payment option.')
    swap = data.get('swap')
    layaway = data.get('layaway')
    if not isinstance(swap, dict) or not isinstance(layaway, dict):
        raise ValueError('Provide swap and layaway settings.')
    values['swap'] = {'enabled': boolean(swap, 'enabled')}
    prices = data.get('prices', {})
    if not isinstance(prices, dict):
        raise ValueError('Enter valid purchase option prices.')
    values['prices'] = {}
    for key, enabled in (('hire_purchase', options['hirePurchase']), ('layaway', options['layaway']), ('swap', values['swap']['enabled'])):
        if enabled or key in prices:
            values['prices'][key] = number(prices, key, .01, 9999999999.99)
    if values['swap']['enabled']:
        values['swap'].update(categories=text_field(swap, 'categories', 300),
            minimumCondition=choice(swap, 'minimumCondition', ('Like New', 'Excellent', 'Good', 'Fair')),
            validityDays=number(swap, 'validityDays', 1, 365, True), instructions=text_field(swap, 'instructions', 1000, False))
    values['layaway'] = {}
    if options['layaway']:
        deposit_type = choice(layaway, 'depositType', ('Percentage', 'Fixed amount'))
        deposit = number(layaway, 'deposit', 10 if deposit_type == 'Percentage' else .01,
                         80 if deposit_type == 'Percentage' else values['prices']['layaway'])
        frequencies = layaway.get('frequencies')
        if not isinstance(frequencies, list) or not frequencies or any(item not in ('Daily', 'Weekly', 'Monthly') for item in frequencies):
            raise ValueError('Choose at least one valid layaway payment frequency.')
        values['layaway'] = dict(depositType=deposit_type, deposit=deposit,
            duration=number(layaway, 'duration', 1, 24, True),
            minimumInstallment=number(layaway, 'minimumInstallment', .01, values['prices']['layaway']),
            gracePeriod=number(layaway, 'gracePeriod', 0, 365, True), maxMissed=number(layaway, 'maxMissed', 0, 100, True),
            agentCollection=boolean(layaway, 'agentCollection'), frequencies=list(dict.fromkeys(frequencies)))
        for key in ('reservationRules', 'cancellationPolicy', 'refundPolicy'):
            values['layaway'][key] = text_field(layaway, key, 1000)
    images = data.get('images')
    if not isinstance(images, list) or not 1 <= len(images) <= 5:
        raise ValueError('Upload between one and five product images.')
    signer = URLSafeTimedSerializer(secret, salt='image-upload')
    stored_images = previous.get('images', []) if previous else []
    cleaned = []
    for image in images:
        try:
            if not isinstance(image, dict):
                raise ValueError()
            candidate = {'id': image['id'], 'url': image['url']}
            if candidate not in stored_images:
                proof = signer.loads(image['upload_token'], max_age=86400)
                if proof.get('owner') != store_id or proof.get('purpose') != 'products' or candidate != {'id': proof['id'], 'url': proof['url']}:
                    raise ValueError()
            if candidate in cleaned:
                raise ValueError()
            cleaned.append(candidate)
        except (BadSignature, KeyError, TypeError, ValueError):
            raise ValueError('Upload each product image through the image uploader before saving. Upload receipts expire after 24 hours.') from None
    values['images'] = cleaned
    return values


def register_store_products(app, owner, connect_admin):
    @app.route('/api/auth/store/products', methods=['GET', 'POST'])
    def store_products():
        store, error = owner()
        if error:
            return error
        try:
            try:
                client = connect_admin()
            except RuntimeError:
                return jsonify(error='Product management is not configured. Contact the administrator.'), 503
            def query():
                return client.table(TABLE).select('*', count='exact').eq('store_id', store.id)
            if request.method == 'GET':
                if request.args.get('record'):
                    try: record=str(UUID(request.args['record']))
                    except ValueError: raise ValueError('Choose a valid product reference.') from None
                    result=query().eq('id',record).limit(1).execute().data
                    if not result: return jsonify(error='Product not found in this store.'),404
                    return jsonify(product=result[0])
                try:
                    page = int(request.args.get('page', '1'))
                    if not 1 <= page <= 100000:
                        raise ValueError()
                except ValueError:
                    raise ValueError('Choose a valid product page.') from None
                search = request.args.get('search', '').strip()
                if len(search) > 100:
                    raise ValueError('Shorten your search to 100 characters.')
                # Remove PostgREST expression delimiters before using a literal search.
                search = re.sub(r'[^\w\s.-]', ' ', search).strip()
                status = request.args.get('status', '')
                listing = query()
                if search:
                    listing = listing.or_(f'name.ilike.%{search}%,sku.ilike.%{search}%,category.ilike.%{search}%')
                if status in ('Active', 'Draft', 'Archived'):
                    listing = listing.eq('status', status)
                elif status == 'Low Stock':
                    listing = listing.eq('status', 'Active').gt('stock', 0).lte('stock', 5)
                elif status == 'Out of Stock':
                    listing = listing.eq('status', 'Active').eq('stock', 0)
                elif status:
                    raise ValueError('Choose a valid product filter.')
                result = listing.order('created_at', desc=True).order('id').range((page-1)*20, page*20-1).execute()
                def count(**filters):
                    statement = client.table(TABLE).select('id', count='exact', head=True).eq('store_id', store.id)
                    for key, value in filters.items():
                        statement = statement.eq(key, value)
                    return statement.execute().count or 0
                low = client.table(TABLE).select('id', count='exact', head=True).eq('store_id', store.id).eq('status', 'Active').gt('stock', 0).lte('stock', 5).execute().count or 0
                return jsonify(products=result.data, total=result.count or 0, page=page, pageSize=20,
                               stats={'total': count(), 'active': count(status='Active'), 'lowStock': low, 'outOfStock': count(status='Active', stock=0)})
            request.max_content_length = 64 * 1024
            data = request.get_json()
            if not isinstance(data, dict):
                raise ValueError('Enter your product details.')
            previous = None
            product_id = data.get('id')
            if product_id:
                try:
                    product_id = str(UUID(str(product_id)))
                except ValueError:
                    raise ValueError('Invalid product ID.') from None
                rows = query().eq('id', product_id).limit(1).execute().data
                if not rows:
                    return jsonify(error='Product not found in your store.'), 404
                previous = rows[0]
                if type(data.get('revision')) is not int or data['revision'] != previous['revision']:
                    return jsonify(error='This product changed. Close the editor and refresh before editing again.'), 409
            values = clean_product(data, previous, store.id, app.secret_key)
            if previous:
                values.update(revision=previous['revision'] + 1, updated_at=datetime.now(timezone.utc).isoformat())
                result = client.table(TABLE).update(values).eq('store_id', store.id).eq('id', product_id).eq('revision', previous['revision']).execute()
                if not result.data:
                    return jsonify(error='This product changed. Refresh before editing again.'), 409
            else:
                values['store_id'] = store.id
                result = client.table(TABLE).insert(values).execute()
            return jsonify(product=result.data[0]), 200 if previous else 201
        except APIError as error:
            app.logger.warning('Product database request failed: code=%s', error.code)
            if error.code in ('PGRST204', '42703'):
                return jsonify(error='Product pricing needs a database update. Run backend/migrations/011_purchase_option_prices.sql in Supabase SQL Editor, then refresh.'), 503
            if error.code in ('42P01', 'PGRST205'):
                return jsonify(error='The products table is not installed. Run backend/migrations/001_store_products.sql in your Supabase SQL Editor, then refresh.'), 503
            if str(error.code) == '404':
                return jsonify(error='The Supabase Data API returned Not Found. Check that the Data API is enabled for this project and run backend/migrations/001_store_products.sql in its SQL Editor.'), 503
            if error.code == '23505':
                return jsonify(error='This SKU already exists in your store. Use a different SKU or edit the existing product.'), 409
            if error.code == '23514':
                return jsonify(error='Check the product values and choose an active category. Archived categories cannot receive new products.'), 400
            if error.code in ('42501', 'PGRST301', 'PGRST302'):
                return jsonify(error='Supabase could not authorize product access. Check the server admin key and product table grants.'), 503
            return jsonify(error='The database could not complete this request. Refresh the catalogue before retrying.'), 502
        except httpx.HTTPError:
            return jsonify(error='Cannot reach the product database. Refresh the catalogue before retrying.'), 503
