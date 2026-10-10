import unittest
from copy import deepcopy
from types import SimpleNamespace as Obj
from backend import test_store_profile
from backend.store_rules import DEFAULTS, rules_for


class StoreRulesTests(unittest.TestCase):
    setUp = test_store_profile.StoreProfileTests.setUp

    def save(self, values=None, **extra):
        return self.http.post('/api/auth/store/rules', json={
            'version': rules_for(self.user)['version'],
            'values': deepcopy(DEFAULTS) if values is None else values, **extra})

    def test_all_tabs_persist_and_version_is_real(self):
        initial = self.http.get('/api/auth/store/rules').json['rules']
        self.assertEqual(initial['revision'], 0)
        self.assertIsNone(initial['publishedAt'])
        values = deepcopy(initial['values'])
        values.update(minimumDeposit=25.5, delivery='Pickup only', returnConditions='Keep your receipt.',
                      earlySettlement=False, clauses=['First clause.', 'Second clause.'])
        values['conduct']['verifiedIdentity'] = False
        previous = deepcopy(self.user.app_metadata)
        response = self.save(values, store_id='another-store', revision=99)
        self.assertEqual(response.status_code, 200)
        result = response.json['rules']
        self.assertEqual(result['values'], values)
        self.assertEqual(result['revision'], 1)
        self.assertTrue(result['publishedAt'])
        self.assertNotEqual(result['version'], initial['version'])
        self.assertEqual(self.http.get('/api/auth/store/rules').json['rules'], result)
        for key, value in previous.items():
            self.assertEqual(self.user.app_metadata[key], value)
        self.assertEqual(self.user.app_metadata['store_rules']['publishedBy'], 'owner-1')
        self.assertEqual(self.save(values).json['rules']['revision'], 2)

    def test_invalid_values_do_not_save(self):
        for change in ({'minimumDeposit': 101}, {'lateFee': -1}, {'gracePeriod': 1.5},
                       {'minimumDuration': 13, 'maximumDuration': 12}, {'returns': True},
                       {'warranty': '12'}, {'earlySettlement': 'true'}, {'delivery': ''},
                       {'returnConditions': 'x' * 3001}, {'conduct': {}}, {'clauses': []},
                       {'clauses': [' ']}, {'clauses': ['x' * 1001]}, {'clauses': ['x'] * 31},
                       {'clauses': ['x' * 1000] * 20}):
            with self.subTest(change=change):
                self.assertEqual(self.save({**deepcopy(DEFAULTS), **change}).status_code, 400)
        self.admin.auth.admin.update_user_by_id.assert_not_called()

    def test_stale_edit_does_not_overwrite_published_rules(self):
        version = rules_for(self.user)['version']
        self.assertEqual(self.save().status_code, 200)
        self.assertEqual(self.save(version=version).status_code, 409)
        self.assertEqual(self.admin.auth.admin.update_user_by_id.call_count, 1)

    def test_staff_permission_and_store_scope(self):
        staff = Obj(id='staff-1', app_metadata={'store_staff': {
            'store_id': self.user.id, 'status': 'Active', 'permissions': ['products']}}, user_metadata={})
        self.service.auth.get_user.return_value = Obj(user=staff)
        self.admin.auth.admin.get_user_by_id.return_value = Obj(user=self.user)
        self.assertEqual(self.http.get('/api/auth/store/rules').status_code, 403)
        self.assertEqual(self.save().status_code, 403)
        staff.app_metadata['store_staff']['permissions'] = ['shop-rules']
        self.assertEqual(self.http.get('/api/auth/store/rules').status_code, 200)
        self.assertEqual(self.save(store_id='forged-store').status_code, 200)
        self.assertEqual(self.admin.auth.admin.update_user_by_id.call_args.args[0], self.user.id)
        self.assertEqual(self.user.app_metadata['store_rules']['publishedBy'], staff.id)
        staff.app_metadata['store_staff']['status'] = 'Disabled'
        self.assertEqual(self.save().status_code, 401)

    def test_unapproved_and_unauthenticated_denied(self):
        self.user.app_metadata['store_review']['status'] = 'Rejected'
        self.assertEqual(self.http.get('/api/auth/store/rules').status_code, 403)
        self.assertEqual(self.save().status_code, 403)
        self.http.delete_cookie('adepa_access', path='/api/auth')
        self.assertEqual(self.http.get('/api/auth/store/rules').status_code, 401)
        self.assertEqual(self.save().status_code, 401)


if __name__ == '__main__':
    unittest.main()
