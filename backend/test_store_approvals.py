import os
import unittest
from types import SimpleNamespace as Obj
from unittest.mock import Mock, patch
from supabase_auth.errors import AuthApiError

from backend.app import app, public_user
from backend.store_approvals import application_data

class StoreApprovalTests(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        self.http = app.test_client()
        self.settings = patch.dict(app.config, SECRET_KEY='test-store-secret')
        self.settings.start()
        self.addCleanup(self.settings.stop)
        self.env = patch.dict(os.environ, ADMIN_EMAIL='admin@example.com', ADMIN_PASSWORD='test-pass')
        self.env.start()
        self.addCleanup(self.env.stop)
        self.client = Mock()
        self.connection = patch('backend.app.connect_admin', return_value=self.client)
        self.connection.start()
        self.addCleanup(self.connection.stop)
        self.user = Obj(id='11111111-1111-4111-8111-111111111111', email='owner@example.com',
                        app_metadata={'provider': 'email'}, user_metadata={'firstName': 'Ama', 'store_application': {
                            'storeName': 'Real Store', 'registeredName': 'Real Store Ltd', 'registrationNumber': 'REG-123',
                            'storeType': 'Physical store', 'officeClassification': 'Main head office', 'ownerName': 'Ama',
                            'phone': '0241234567', 'region': 'Greater Accra', 'city': 'Accra', 'reference': 'BPS-123',
                            'categories': ['Phones'], 'status': 'Approved', 'password': 'must-not-be-returned'}})
        self.client.auth.admin.get_user_by_id.return_value = Obj(user=self.user)
        def update(user_id, values):
            self.user.app_metadata = values['app_metadata']
            return Obj(user=self.user)
        self.client.auth.admin.update_user_by_id.side_effect = update

    def login(self):
        self.assertEqual(self.http.post('/api/auth/login', json={'email': 'admin@example.com', 'password': 'test-pass'}).status_code, 200)

    def decide(self, decision='approve', **changes):
        return self.http.post(f'/api/auth/admin/stores/{self.user.id}/decision', json={
            'decision': decision, 'reason': '', 'version': application_data(self.user)['version'], **changes})

    def test_anonymous_and_customer_cannot_access_admin_data(self):
        self.assertEqual(self.http.get('/api/auth/admin/stores').status_code, 403)
        self.assertEqual(self.decide().status_code, 403)
        with self.http.session_transaction() as session:
            session['role'] = 'Admin'
        self.assertEqual(self.http.get('/api/auth/admin/stores').status_code, 403)
        self.client.auth.admin.list_users.assert_not_called()
        self.client.auth.admin.update_user_by_id.assert_not_called()

    def test_list_returns_only_store_profiles_and_ignores_untrusted_approval(self):
        self.login()
        customer = Obj(id='customer', email='customer@example.com', app_metadata={}, user_metadata={})
        self.client.auth.admin.list_users.return_value = [customer, self.user]
        result = self.http.get('/api/auth/admin/stores?page=2')
        self.assertEqual(result.status_code, 200)
        self.assertEqual(len(result.json['applications']), 1)
        row = result.json['applications'][0]
        self.assertEqual(row['status'], 'Pending Approval')
        self.assertNotIn('password', row)
        self.client.auth.admin.list_users.assert_called_once_with(page=2, per_page=50)

    def test_approval_persists_role_store_id_and_reviewed_snapshot(self):
        self.login()
        result = self.decide()
        self.assertEqual(result.status_code, 200)
        self.assertEqual(self.user.app_metadata['role'], 'Store Manager')
        self.assertEqual(self.user.app_metadata['store_id'], self.user.id)
        self.assertEqual(self.user.app_metadata['provider'], 'email')
        self.assertEqual(result.json['application']['reviewer'], 'admin@example.com')
        self.assertNotIn('password', self.user.app_metadata['store_review']['application'])
        self.user.user_metadata['store_application']['storeName'] = 'Unreviewed change'
        restored = public_user(self.user)
        self.assertEqual(restored['store']['name'], 'Real Store')
        self.assertNotIn('store_application', restored)
        self.assertEqual(self.decide().status_code, 409)

    def test_rejection_requires_reason_and_is_visible_to_owner(self):
        self.login()
        self.assertEqual(self.decide('reject').status_code, 400)
        response = self.decide('reject', reason='Business registration could not be verified.')
        self.assertEqual(response.status_code, 200)
        owner = public_user(self.user)
        self.assertEqual(owner['role'], 'Customer')
        self.assertEqual(owner['store_application']['status'], 'Rejected')
        self.assertIn('could not be verified', owner['store_application']['reason'])

    def test_changed_application_rejected_before_write(self):
        self.login()
        self.assertEqual(self.decide(version='outdated').status_code, 409)
        self.client.auth.admin.update_user_by_id.assert_not_called()

    def test_missing_key_and_cross_origin_mutations(self):
        self.login()
        with patch('backend.app.connect_admin', side_effect=RuntimeError('Configure server key')):
            self.assertEqual(self.http.get('/api/auth/admin/stores').status_code, 503)
        response = self.http.post(f'/api/auth/admin/stores/{self.user.id}/decision', json={'decision': 'approve'}, headers={'Origin': 'https://evil.example'})
        self.assertEqual(response.status_code, 403)
        self.client.auth.admin.update_user_by_id.assert_not_called()

    def test_existing_privileged_account_cannot_be_overwritten(self):
        self.login()
        self.user.app_metadata['role'] = 'Admin'
        self.assertEqual(self.decide().status_code, 409)
        self.client.auth.admin.update_user_by_id.assert_not_called()

    def test_rejected_supabase_key_reports_configuration_error_without_logging_out(self):
        self.login()
        for status in (401, 403):
            self.client.auth.admin.list_users.side_effect = AuthApiError('Sensitive upstream details', status, None)
            with self.assertLogs(app.logger, level='WARNING') as logs:
                response = self.http.get('/api/auth/admin/stores')
            self.assertEqual(response.status_code, 503)
            self.assertIn('Supabase rejected the server admin key', response.json['error'])
            self.assertNotIn('Sensitive upstream details', response.json['error'])
            self.assertNotIn('Sensitive upstream details', str(logs.output))
            self.assertEqual(self.http.get('/api/auth/session').json['user']['role'], 'Admin')

    def test_upstream_rate_limit_and_missing_account_have_specific_errors(self):
        self.login()
        for status in (429, 404):
            self.client.auth.admin.list_users.side_effect = AuthApiError('upstream', status, None)
            with self.assertLogs(app.logger, level='WARNING'):
                self.assertEqual(self.http.get('/api/auth/admin/stores').status_code, status)

if __name__ == '__main__':
    unittest.main()
