import io
import unittest
from copy import deepcopy
from types import SimpleNamespace as Obj
from unittest.mock import patch
from uuid import uuid4
from itsdangerous import URLSafeTimedSerializer
from postgrest.exceptions import APIError
from backend import test_store_profile
from backend.app import app


class Query:
    """Small in-memory table double to exercise filtering and atomic revision checks."""
    def __init__(self, database):
        self.database = database
        self.filters = []
        self.values = None
        self.action = 'select'
        self.start, self.end = 0, 100000

    def select(self, *args, **kwargs): return self
    def eq(self, key, value): self.filters.append(lambda row: row[key] == value); return self
    def gt(self, key, value): self.filters.append(lambda row: row[key] > value); return self
    def lte(self, key, value): self.filters.append(lambda row: row[key] <= value); return self
    def order(self, *args, **kwargs): return self
    def range(self, start, end): self.start, self.end = start, end; return self
    def limit(self, limit): self.end = limit - 1; return self
    def insert(self, values): self.values = values; self.action = 'insert'; return self
    def update(self, values): self.values = values; self.action = 'update'; return self
    def execute(self):
        if self.database.error:
            raise APIError({'code': self.database.error, 'message': 'Test database error', 'details': '', 'hint': ''})
        if self.action == 'insert':
            if any(row['store_id'] == self.values['store_id'] and row['sku'] == self.values['sku'] for row in self.database.rows):
                raise APIError({'code': '23505', 'message': 'Duplicate', 'details': '', 'hint': ''})
            row = {**deepcopy(self.values), 'id': str(uuid4()), 'revision': 1, 'created_at': '2026-10-08T12:00:00Z'}
            self.database.rows.append(row)
            return Obj(data=[deepcopy(row)], count=1)
        if self.action == 'update' and self.database.race:
            for row in self.database.rows: row['revision'] += 1
        rows = [row for row in self.database.rows if all(check(row) for check in self.filters)]
        if self.action == 'update':
            for row in rows: row.update(deepcopy(self.values))
        return Obj(data=deepcopy(rows[self.start:self.end+1]), count=len(rows))


class StoreProductsTests(unittest.TestCase):
    def setUp(self):
        test_store_profile.StoreProfileTests.setUp(self)
        self.database = Obj(rows=[], error=None, race=False)
        self.admin.table.side_effect = lambda name: Query(self.database)
        image = {'id': 'image-1', 'url': 'https://imagedelivery.net/test/image-1/public'}
        image['upload_token'] = URLSafeTimedSerializer(app.secret_key, salt='image-upload').dumps({
            'owner': self.user.id, 'purpose': 'products', **image})
        self.data = {'name': 'Test phone', 'sku': 'phone-1', 'category': 'Phones', 'description': 'Test product',
            'condition': 'New', 'price': '150.25', 'stock': '4', 'status': 'Active', 'images': [image],
            'payment_options': {'payNow': True, 'hirePurchase': False, 'layaway': False},
            'swap': {'enabled': False}, 'layaway': {}}

    def save(self, data=None):
        return self.http.post('/api/auth/store/products', json=self.data if data is None else data)

    def test_create_reload_edit_archive_and_stats(self):
        result = self.save({**self.data, 'store_id': 'forged-store', 'revision': 88})
        self.assertEqual(result.status_code, 201)
        product = result.json['product']
        self.assertEqual(product['store_id'], self.user.id)
        self.assertEqual(product['revision'], 1)
        self.assertEqual(product['price'], 150.25)
        self.assertNotIn('upload_token', product['images'][0])
        listing = self.http.get('/api/auth/store/products').json
        self.assertEqual(listing['products'], [product])
        self.assertEqual(listing['stats'], {'total': 1, 'active': 1, 'lowStock': 1, 'outOfStock': 0})
        updated = self.save({**product, 'stock': 0, 'status': 'Archived'}).json['product']
        self.assertEqual(updated['revision'], 2)
        self.assertEqual(updated['status'], 'Archived')
        self.assertEqual(self.http.get('/api/auth/store/products?status=Active').json['products'], [])

    def test_cross_store_and_staff_permissions(self):
        product = self.save().json['product']
        self.database.rows[0]['store_id'] = 'other-store'
        self.assertEqual(self.http.get('/api/auth/store/products').json['total'], 0)
        self.assertEqual(self.save(product).status_code, 404)
        staff = Obj(id='staff-1', app_metadata={'store_staff': {'store_id': self.user.id, 'status': 'Active', 'permissions': ['reports']}})
        self.service.auth.get_user.return_value = Obj(user=staff)
        self.admin.auth.admin.get_user_by_id.return_value = Obj(user=self.user)
        self.assertEqual(self.save().status_code, 403)
        self.assertEqual(self.http.get('/api/auth/store/products').status_code, 403)
        staff.app_metadata['store_staff']['permissions'] = ['products']
        self.assertEqual(self.save().status_code, 201)
        self.assertEqual(self.database.rows[-1]['store_id'], self.user.id)

    def test_stale_and_concurrent_updates_and_duplicate_sku(self):
        product = self.save().json['product']
        self.assertEqual(self.save().status_code, 409)
        self.assertEqual(self.save({**product, 'revision': 0}).status_code, 409)
        self.database.race = True
        self.assertEqual(self.save({**product, 'name': 'Overwrite'}).status_code, 409)
        self.assertEqual(self.database.rows[0]['name'], 'Test phone')

    def test_validation_rejects_bad_prices_stock_images_and_options(self):
        for key, value in [('price', 'NaN'), ('price', 'Infinity'), ('price', '1.001'), ('price', 0),
                           ('stock', 1.5), ('stock', True), ('sku', 'bad sku'), ('images', []),
                           ('images', self.data['images'] * 6), ('images', [{'id': 'x', 'url': 'https://evil.test'}]),
                           ('payment_options', {'payNow': False, 'hirePurchase': False, 'layaway': False})]:
            with self.subTest(key=key, value=value):
                self.assertEqual(self.save({**self.data, key: value}).status_code, 400)
        self.assertEqual(self.database.rows, [])

    def test_smallest_price_and_stock_boundaries(self):
        response = self.save({**self.data, 'price': '0.01', 'stock': 0})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json['product']['price'], 0.01)
        self.assertEqual(self.http.get('/api/auth/store/products').json['stats']['outOfStock'], 1)

    def test_upload_receipts_bound_to_store_purpose_url_and_expiry(self):
        for change in ({'owner': 'other-store'}, {'purpose': 'store-profile'}):
            image = deepcopy(self.data['images'][0])
            image['upload_token'] = URLSafeTimedSerializer(app.secret_key, salt='image-upload').dumps({
                'owner': self.user.id, 'purpose': 'products', 'id': image['id'], 'url': image['url'], **change})
            self.assertEqual(self.save({**self.data, 'images': [image]}).status_code, 400)
        image = {**self.data['images'][0], 'url': 'https://evil.test'}
        self.assertEqual(self.save({**self.data, 'images': [image]}).status_code, 400)
        with patch('itsdangerous.timed.time.time', return_value=0):
            image = deepcopy(self.data['images'][0])
            image['upload_token'] = URLSafeTimedSerializer(app.secret_key, salt='image-upload').dumps({
                'owner': self.user.id, 'purpose': 'products', 'id': image['id'], 'url': image['url']})
        self.assertEqual(self.save({**self.data, 'images': [image]}).status_code, 400)

    def test_products_only_staff_can_upload_without_profile_permission(self):
        staff = Obj(id='staff-1', app_metadata={'store_staff': {'store_id': self.user.id, 'status': 'Active', 'permissions': ['products']}})
        self.service.auth.get_user.return_value = Obj(user=staff)
        self.admin.auth.admin.get_user_by_id.return_value = Obj(user=self.user)
        with patch('backend.store_profile.upload_image', return_value={'id': 'cloud-image', 'url': 'https://imagedelivery.net/test/cloud-image/public'}) as uploader:
            result = self.http.post('/api/auth/images/upload?purpose=products', data={'image': (io.BytesIO(b'image'), 'photo.jpg')}, headers={'X-Requested-With': 'AdepaPay'})
            self.assertEqual(result.status_code, 200)
            self.assertEqual(uploader.call_args.args[1], self.user.id)
            self.assertEqual(self.save({**self.data, 'images': [result.json['image']]}).status_code, 201)
        self.assertEqual(self.http.post('/api/auth/images/upload', headers={'X-Requested-With': 'AdepaPay'}).status_code, 403)
        staff.app_metadata['store_staff']['permissions'] = []
        self.assertEqual(self.http.post('/api/auth/images/upload?purpose=products', headers={'X-Requested-With': 'AdepaPay'}).status_code, 403)

    def test_swap_layaway_persist_and_validate(self):
        data = deepcopy(self.data)
        data['payment_options']['layaway'] = True
        data['prices'] = {'layaway': 175.50, 'swap': 160}
        data['swap'] = {'enabled': True, 'categories': 'Phones', 'minimumCondition': 'Good', 'validityDays': 7, 'instructions': 'Inspect first.'}
        data['layaway'] = {'depositType': 'Percentage', 'deposit': 20, 'duration': 12, 'minimumInstallment': 10,
            'gracePeriod': 3, 'maxMissed': 3, 'agentCollection': True, 'frequencies': ['Weekly'],
            'reservationRules': 'Reserve on deposit.', 'cancellationPolicy': 'Contact store.', 'refundPolicy': 'Contact store.'}
        product = self.save(data).json['product']
        self.assertEqual(product['layaway'], data['layaway'])
        self.assertEqual(product['swap'], data['swap'])
        self.assertEqual(product['prices'], data['prices'])
        for change in ({'deposit': 81}, {'duration': 25}, {'frequencies': []}, {'depositType': 'Fixed amount', 'deposit': 999}):
            self.assertEqual(self.save({**product, 'layaway': {**data['layaway'], **change}}).status_code, 400)

    def test_enabled_options_require_valid_distinct_prices(self):
        data={**self.data,'payment_options':{'payNow':True,'hirePurchase':True,'layaway':False},'prices':{'hire_purchase':200}}
        self.assertEqual(self.save(data).json['product']['prices']['hire_purchase'],200)
        for prices in ({},{'hire_purchase':0},{'hire_purchase':-1},{'hire_purchase':'NaN'},{'hire_purchase':1.111}):
            self.assertEqual(self.save({**data,'prices':prices}).status_code,400)

    def test_all_four_prices_persist_before_options_are_enabled(self):
        prices={'hire_purchase':200,'layaway':175,'swap':160}
        product=self.save({**self.data,'prices':prices}).json['product']
        self.assertEqual(product['price'],150.25)
        self.assertEqual(product['prices'],prices)
        updated=self.save({**product,'payment_options':{**product['payment_options'],'hirePurchase':True}}).json['product']
        self.assertEqual(updated['prices'],prices)

    def test_missing_schema_and_session_errors(self):
        self.database.error = 'PGRST205'
        response = self.http.get('/api/auth/store/products')
        self.assertEqual(response.status_code, 503)
        self.assertIn('001_store_products.sql', response.json['error'])
        self.http.delete_cookie('adepa_access', path='/api/auth')
        self.assertEqual(self.save().status_code, 401)


if __name__ == '__main__': unittest.main()
