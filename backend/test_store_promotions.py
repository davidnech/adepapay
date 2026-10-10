import unittest
from copy import deepcopy
from types import SimpleNamespace as Obj
from uuid import uuid4
from postgrest.exceptions import APIError
from backend import test_store_profile
from backend.test_store_products import Query
from backend.store_promotions import with_status


class PromotionQuery(Query):
    def execute(self):
        if self.action == 'insert' and not self.database.error:
            if any(row['store_id'] == self.values['store_id'] for row in self.database.rows):
                raise APIError({'code': '23505', 'message': 'Conflict', 'details': '', 'hint': ''})
            self.database.rows.append(deepcopy(self.values))
            return Obj(data=[deepcopy(self.values)], count=1)
        return super().execute()


class StorePromotionsTests(unittest.TestCase):
    def setUp(self):
        test_store_profile.StoreProfileTests.setUp(self)
        self.database = Obj(rows=[], error=None, race=False)
        self.products = Obj(rows=[{'id': str(uuid4()), 'store_id': self.user.id, 'name': 'Phone', 'category': 'Phones', 'status': 'Active'}], error=None, race=False)
        self.admin.table.side_effect = lambda name: PromotionQuery(self.database) if name == 'store_promotion_settings' else Query(self.products)
        self.campaign = {'name': 'Store sale', 'description': '', 'discountPercent': '10.5', 'scope': 'Selected products', 'productIds': [self.products.rows[0]['id']], 'categories': [], 'startsAt': '2026-01-01', 'endsAt': '2099-12-31', 'enabled': True}
        self.code = {'code': 'save10', 'description': 'Test code', 'discountPercent': 10, 'minimumSpend': '0.01', 'usageLimit': 10, 'usedCount': 999, 'expiresAt': '2099-12-31', 'enabled': True}
        self.data = {'revision': 0, 'public_enabled': True, 'campaigns': [self.campaign], 'codes': [self.code]}

    def save(self, data=None):
        return self.http.post('/api/auth/store/promotions', json=self.data if data is None else data)

    def test_create_reload_edit_pause_delete_and_visibility(self):
        initial = self.http.get('/api/auth/store/promotions').json
        self.assertEqual(initial['settings']['campaigns'], [])
        self.assertEqual(initial['products'][0]['id'], self.products.rows[0]['id'])
        response = self.save({**self.data, 'store_id': 'forged-store'})
        self.assertEqual(response.status_code, 200)
        saved = response.json['settings']
        self.assertEqual(saved['store_id'], self.user.id)
        self.assertEqual(saved['codes'][0]['code'], 'SAVE10')
        self.assertEqual(saved['codes'][0]['usedCount'], 0)
        self.assertEqual(saved['codes'][0]['minimumSpend'], 0.01)
        self.assertEqual(self.http.get('/api/auth/store/promotions').json['settings'], saved)
        saved['campaigns'][0]['enabled'] = False
        saved['codes'][0]['description'] = 'Edited code'
        saved['public_enabled'] = False
        updated = self.save(saved).json['settings']
        self.assertEqual(updated['revision'], 2)
        self.assertEqual(updated['campaigns'][0]['status'], 'Paused')
        self.assertFalse(updated['public_enabled'])
        updated['codes'] = []
        self.assertEqual(self.save(updated).json['settings']['codes'], [])

    def test_validation_duplicates_dates_and_cross_store_eligibility(self):
        for changes in ({'discountPercent': 'NaN'}, {'discountPercent': 91}, {'endsAt': '2025-12-31'},
                        {'startsAt': '2026-02-30'}, {'productIds': [str(uuid4())]},
                        {'scope': 'Category', 'categories': ['Unknown']}, {'enabled': 'yes'}):
            with self.subTest(changes=changes):
                self.assertEqual(self.save({**self.data, 'campaigns': [{**self.campaign, **changes}]}).status_code, 400)
        for changes in ({'code': 'bad code'}, {'usageLimit': 1.5}, {'minimumSpend': -1}, {'expiresAt': 'bad'}):
            self.assertEqual(self.save({**self.data, 'codes': [{**self.code, **changes}]}).status_code, 400)
        self.assertEqual(self.save({**self.data, 'codes': [self.code, {**self.code, 'code': 'SAVE10'}]}).status_code, 400)
        self.assertEqual(self.database.rows, [])

    def test_stale_and_concurrent_saves(self):
        saved = self.save().json['settings']
        self.assertEqual(self.save().status_code, 409)
        self.database.race = True
        self.assertEqual(self.save(saved).status_code, 409)

    def test_store_isolation_and_permissions(self):
        self.save()
        self.database.rows[0]['store_id'] = 'other-store'
        self.products.rows[0]['store_id'] = 'other-store'
        response = self.http.get('/api/auth/store/promotions')
        self.assertEqual(response.json['settings']['codes'], [])
        self.assertEqual(response.json['products'], [])
        self.assertEqual(self.save().status_code, 400)
        staff = Obj(id='staff-1', app_metadata={'store_staff': {'store_id': self.user.id, 'status': 'Active', 'permissions': ['products']}})
        self.service.auth.get_user.return_value = Obj(user=staff)
        self.admin.auth.admin.get_user_by_id.return_value = Obj(user=self.user)
        self.assertEqual(self.http.get('/api/auth/store/promotions').status_code, 403)
        self.assertEqual(self.save().status_code, 403)
        staff.app_metadata['store_staff']['permissions'] = ['promotions']
        self.assertEqual(self.save({**self.data, 'campaigns': []}).status_code, 200)
        staff.app_metadata['store_staff']['status'] = 'Disabled'
        self.assertEqual(self.http.get('/api/auth/store/promotions').status_code, 401)

    def test_usage_is_server_owned_and_redeemed_codes_preserved(self):
        self.save()
        self.database.rows[0]['codes'][0]['usedCount'] = 3
        saved = self.http.get('/api/auth/store/promotions').json['settings']
        saved['codes'][0]['usedCount'] = 0
        result = self.save(saved).json['settings']
        self.assertEqual(result['codes'][0]['usedCount'], 3)
        self.assertEqual(self.save({**result, 'codes': []}).status_code, 400)
        result['codes'][0]['usageLimit'] = 2
        self.assertEqual(self.save(result).status_code, 400)

    def test_status_dates_and_limits(self):
        base = {'campaigns': [{**self.campaign, 'startsAt': '2098-01-01'}], 'codes': [{**self.code, 'usedCount': 10}]}
        self.assertEqual(with_status(base)['campaigns'][0]['status'], 'Scheduled')
        self.assertEqual(with_status(base)['codes'][0]['status'], 'Exhausted')
        base['campaigns'][0]['startsAt'] = '2000-01-01'
        base['campaigns'][0]['endsAt'] = '2001-01-01'
        base['codes'][0]['expiresAt'] = '2001-01-01'
        self.assertEqual(with_status(base)['campaigns'][0]['status'], 'Expired')
        self.assertEqual(with_status(base)['codes'][0]['status'], 'Expired')

    def test_missing_schema_and_unauthenticated(self):
        self.database.error = 'PGRST205'
        response = self.http.get('/api/auth/store/promotions')
        self.assertEqual(response.status_code, 503)
        self.assertIn('002_store_promotions.sql', response.json['error'])
        self.http.delete_cookie('adepa_access', path='/api/auth')
        self.assertEqual(self.save().status_code, 401)


if __name__ == '__main__': unittest.main()
