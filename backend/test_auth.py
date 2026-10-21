import unittest
import os
from types import SimpleNamespace as Obj
from unittest.mock import Mock, patch
from supabase_auth.errors import AuthApiError
from backend.app import app, ACCESS, REFRESH, public_user

class AuthTests(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        self.http = app.test_client()
        self.user = Obj(id='user-1', email='test@example.com', app_metadata={},
                        user_metadata={'firstName': 'Ama', 'role': 'Admin'})
        self.session = Obj(access_token='access-token', refresh_token='refresh-token')
        self.service = Mock()
        self.patch = patch('backend.app.connect_db', return_value=self.service)
        self.patch.start()
        self.addCleanup(self.patch.stop)
        # These tests isolate profile/Auth behavior. The SMS handshake is covered
        # separately by test_sms_verification.py and PostgreSQL transaction tests.
        for target, value in [('backend.app.start_or_resume', ({}, {}, None)),
                              ('backend.app.complete_signup', True)]:
            patcher = patch(target, return_value=value)
            patcher.start()
            self.addCleanup(patcher.stop)
        patcher = patch('backend.app.connect_admin', return_value=Mock())
        patcher.start()
        self.addCleanup(patcher.stop)
        self.data = dict(email='test@example.com', password='Strong123!', firstName='Ama',
                         lastName='Mensah', dob='1990-01-01', gender='Female', nationality='Ghana',
                         phone='0241234567', region='Greater Accra', city='Accra', address='12 Road',
                         agreeTerms=True, agreePrivacy=True, role='Admin')

    def test_signup_confirmation_and_metadata(self):
        self.service.auth.sign_up.return_value = Obj(user=self.user, session=None)
        result = self.http.post('/api/auth/signup', json=self.data)
        self.assertEqual(result.status_code, 201)
        self.assertTrue(result.json['confirmation_required'])
        self.assertIsNone(self.http.get_cookie(ACCESS, path='/api/auth'))
        sent = self.service.auth.sign_up.call_args.args[0]['options']['data']
        self.assertNotIn('password', sent)
        self.assertNotIn('role', sent)
        self.assertEqual(sent['firstName'], 'Ama')

    def test_signup_without_confirmation_sets_session(self):
        self.service.auth.sign_up.return_value = Obj(user=self.user, session=self.session)
        result = self.http.post('/api/auth/signup', json=self.data)
        self.assertFalse(result.json['confirmation_required'])
        self.assertEqual(result.json['user']['role'], 'Customer')
        self.assertTrue(self.http.get_cookie(ACCESS, path='/api/auth').http_only)

    def test_nationality_is_fixed_even_if_request_is_modified(self):
        self.service.auth.sign_up.return_value = Obj(user=self.user, session=self.session)
        result = self.http.post('/api/auth/signup', json={**self.data, 'nationality': 'Other'})
        self.assertEqual(result.status_code, 201)
        profile = self.service.auth.sign_up.call_args.args[0]['options']['data']
        self.assertEqual(profile['nationality'], 'Ghana')

    def test_only_male_and_female_are_accepted(self):
        for gender in ('Other', 'Prefer not to say', ''):
            result = self.http.post('/api/auth/signup', json={**self.data, 'gender': gender})
            self.assertEqual(result.status_code, 400)
        self.service.auth.sign_up.assert_not_called()
        self.service.auth.sign_up.return_value = Obj(user=self.user, session=self.session)
        for gender in ('Male', 'Female'):
            self.assertEqual(self.http.post('/api/auth/signup', json={**self.data, 'gender': gender}).status_code, 201)

    def test_login_remember_and_role(self):
        self.service.auth.sign_in_with_password.return_value = Obj(user=self.user, session=self.session)
        result = self.http.post('/api/auth/login', json={**self.data, 'remember': True})
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json['user']['role'], 'Customer')
        self.assertNotIn('access_token', result.json)
        cookie = self.http.get_cookie(REFRESH, path='/api/auth')
        self.assertEqual(cookie.max_age, 2592000)
        self.assertEqual(cookie.same_site, 'Lax')

    def test_large_store_login_survives_browser_cookie_limit(self):
        # Approved stores accumulate profile/rules metadata in their JWTs.
        token = 'a' * 5116
        self.user.app_metadata = {
            'role': 'Store Manager', 'store_id': self.user.id,
            'store_review': {'status': 'Approved', 'application': {'storeName': 'Test Shop'}},
            'store_subscription': {'paid_until': '2099-01-01T00:00:00+00:00',
                                   'plan_name': 'Test', 'environment': 'test'},
        }
        self.service.auth.sign_in_with_password.return_value = Obj(
            user=self.user, session=Obj(access_token=token, refresh_token='refresh'))
        self.service.auth.get_user.return_value = Obj(user=self.user)
        with patch.dict(os.environ, {'COOKIE_SECURE': 'true'}):
            result = self.http.post('/api/auth/login', json={**self.data, 'remember': True})
        self.assertEqual(result.status_code, 200)
        for header in result.headers.getlist('Set-Cookie'):
            self.assertLess(len(header.encode()), 4093)
        for name in (ACCESS, ACCESS + '.0', ACCESS + '.1'):
            cookie = self.http.get_cookie(name, path='/api/auth')
            self.assertTrue(cookie.http_only)
            self.assertTrue(cookie.secure)
            self.assertEqual(cookie.same_site, 'Lax')
            self.assertEqual(cookie.max_age, 2592000)
        self.assertEqual(self.http.get('/api/auth/session').status_code, 200)
        self.assertEqual(self.http.get('/api/auth/store/profile').status_code, 200)
        with patch('backend.customer_applications.rows_for', return_value=[]):
            dashboard = self.http.get('/api/auth/store/customer-applications/dashboard')
        self.assertEqual(dashboard.status_code, 200)
        self.assertEqual(dashboard.json['applications'], [])
        self.service.auth.get_user.assert_called_with(token)
        self.http.post('/api/auth/logout', json={})
        self.service.auth.set_session.assert_called_once_with(token, 'refresh')
        for name in (ACCESS, ACCESS + '.0', ACCESS + '.1', REFRESH):
            self.assertIsNone(self.http.get_cookie(name, path='/api/auth'))

    def test_refresh_replaces_large_cookie_chunks_and_cleans_up(self):
        self.http.set_cookie(ACCESS, 'expired', path='/api/auth')
        self.http.set_cookie(REFRESH, 'refresh', path='/api/auth')
        self.service.auth.get_user.side_effect = AuthApiError('expired', 401, 'bad_jwt')
        large_token = 'b' * 9000
        self.service.auth.refresh_session.return_value = Obj(
            user=self.user, session=Obj(access_token=large_token, refresh_token='renewed'))
        result = self.http.get('/api/auth/session')
        self.assertEqual(result.status_code, 200)
        self.assertTrue(all(len(h.encode()) < 4093 for h in result.headers.getlist('Set-Cookie')))
        self.service.auth.get_user.side_effect = None
        self.service.auth.get_user.return_value = Obj(user=self.user)
        self.assertEqual(self.http.get('/api/auth/session').status_code, 200)
        self.service.auth.get_user.assert_called_with(large_token)
        self.service.auth.get_user.side_effect = AuthApiError('expired', 401, 'bad_jwt')
        self.service.auth.refresh_session.return_value = Obj(user=self.user, session=self.session)
        self.assertEqual(self.http.get('/api/auth/session').status_code, 200)
        self.assertEqual(self.http.get_cookie(ACCESS, path='/api/auth').value, 'access-token')
        for index in range(3):
            self.assertIsNone(self.http.get_cookie(f'{ACCESS}.{index}', path='/api/auth'))

    def test_incomplete_cookie_chunks_are_rejected_and_cleared(self):
        for marker in ('chunks:2', 'chunks:999999', 'chunks:invalid'):
            self.http.set_cookie(ACCESS, marker, path='/api/auth')
            self.http.set_cookie(ACCESS + '.0', 'partial', path='/api/auth')
            self.assertEqual(self.http.get('/api/auth/session').status_code, 401)
            self.assertIsNone(self.http.get_cookie(ACCESS + '.0', path='/api/auth'))
        self.service.auth.get_user.assert_not_called()

    def test_validation_precedes_supabase(self):
        for changes in ({'email': 'bad'}, {'password': 'short'}, {'agreeTerms': False},
                        {'phone': '123'}, {'dob': '2020-01-01'}, {'role': 'Admin', 'firstName': ''}):
            self.assertEqual(self.http.post('/api/auth/signup', json={**self.data, **changes}).status_code, 400)
        self.service.auth.sign_up.assert_not_called()

    def test_bad_password_and_unconfirmed_email(self):
        for code in ('invalid_credentials', 'email_not_confirmed'):
            self.service.auth.sign_in_with_password.side_effect = AuthApiError('private detail', 400, code)
            result = self.http.post('/api/auth/login', json=self.data)
            self.assertEqual(result.status_code, 400)
            self.assertNotIn('private detail', result.json['error'])
            self.assertIsNone(self.http.get_cookie(ACCESS, path='/api/auth'))

    def test_missing_and_valid_session(self):
        self.assertEqual(self.http.get('/api/auth/session').status_code, 401)
        self.http.set_cookie(ACCESS, 'valid', path='/api/auth')
        self.service.auth.get_user.return_value = Obj(user=self.user)
        result = self.http.get('/api/auth/session')
        self.assertEqual(result.json['user']['id'], 'user-1')
        self.service.auth.get_user.assert_called_once_with('valid')

    def test_expired_session_refresh(self):
        self.http.set_cookie(ACCESS, 'expired', path='/api/auth')
        self.http.set_cookie(REFRESH, 'refresh', path='/api/auth')
        self.service.auth.get_user.side_effect = AuthApiError('expired', 401, 'bad_jwt')
        self.service.auth.refresh_session.return_value = Obj(user=self.user, session=self.session)
        result = self.http.get('/api/auth/session')
        self.assertEqual(result.status_code, 200)
        self.service.auth.refresh_session.assert_called_once_with('refresh')
        self.assertEqual(self.http.get_cookie(ACCESS, path='/api/auth').value, 'access-token')

    def test_revoked_refresh_clears_cookies(self):
        self.http.set_cookie(ACCESS, 'expired', path='/api/auth')
        self.http.set_cookie(REFRESH, 'revoked', path='/api/auth')
        self.service.auth.get_user.side_effect = AuthApiError('expired', 401, 'bad_jwt')
        self.service.auth.refresh_session.side_effect = AuthApiError('revoked', 400, 'refresh_token_not_found')
        self.assertEqual(self.http.get('/api/auth/session').status_code, 401)
        self.assertIsNone(self.http.get_cookie(REFRESH, path='/api/auth'))

    def test_logout_revokes_and_clears(self):
        self.http.set_cookie(ACCESS, 'access', path='/api/auth')
        self.http.set_cookie(REFRESH, 'refresh', path='/api/auth')
        self.assertEqual(self.http.post('/api/auth/logout', json={}).status_code, 200)
        self.service.auth.sign_out.assert_called_once_with({'scope': 'local'})
        self.assertIsNone(self.http.get_cookie(ACCESS, path='/api/auth'))

    def test_cross_origin_and_form_posts_are_blocked(self):
        self.assertEqual(self.http.post('/api/auth/login', json=self.data,
                                       headers={'Origin': 'https://evil.example'}).status_code, 403)
        self.assertEqual(self.http.post('/api/auth/login', data=self.data).status_code, 415)
        self.service.auth.sign_in_with_password.assert_not_called()


    @patch.dict(os.environ, {'ADMIN_EMAIL': 'admin@example.com', 'ADMIN_PASSWORD': '12345'})
    def test_environment_admin_session_lifecycle(self):
        with patch.dict(app.config, SECRET_KEY='test-secret'):
            values = {'email': ' ADMIN@example.com ', 'password': '12345', 'remember': True}
            response = self.http.post('/api/auth/login', json=values)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json['user']['role'], 'Admin')
            cookie = self.http.get_cookie('adepa_admin', path='/api/auth')
            self.assertTrue(cookie.http_only)
            self.assertIsNotNone(cookie.expires)
            self.assertEqual(self.http.get('/api/auth/session').json['user']['role'], 'Admin')
            self.http.post('/api/auth/logout', json={})
            self.assertEqual(self.http.get('/api/auth/session').status_code, 401)
            self.service.auth.sign_in_with_password.assert_not_called()

    @patch.dict(os.environ, {'ADMIN_EMAIL': 'admin@example.com', 'ADMIN_PASSWORD': '12345'})
    def test_admin_wrong_password_and_reserved_signup(self):
        response = self.http.post('/api/auth/login', json={'email': 'admin@example.com', 'password': 'wrong'})
        self.assertEqual(response.status_code, 400)
        self.service.auth.sign_in_with_password.assert_not_called()
        response = self.http.post('/api/auth/signup', json={**self.data, 'email': 'admin@example.com'})
        self.assertEqual(response.status_code, 400)
        self.service.auth.sign_up.assert_not_called()

    @patch.dict(os.environ, {'ADMIN_EMAIL': 'admin@example.com', 'ADMIN_PASSWORD': '12345'})
    def test_admin_rotation_and_tampering(self):
        with patch.dict(app.config, SECRET_KEY='test-secret'):
            values = {'email': 'admin@example.com', 'password': '12345'}
            self.http.post('/api/auth/login', json=values)
            with patch.dict(os.environ, ADMIN_PASSWORD='changed'):
                self.assertEqual(self.http.get('/api/auth/session').status_code, 401)
            self.http.post('/api/auth/login', json=values)
            cookie = self.http.get_cookie('adepa_admin', path='/api/auth')
            self.http.set_cookie('adepa_admin', cookie.value + 'tampered', path='/api/auth')
            self.assertEqual(self.http.get('/api/auth/session').status_code, 401)

    @patch.dict(os.environ, {'ADMIN_EMAIL': 'admin@example.com', 'ADMIN_PASSWORD': '12345'})
    def test_customer_login_replaces_admin_session(self):
        with patch.dict(app.config, SECRET_KEY='test-secret'):
            self.http.post('/api/auth/login', json={'email': 'admin@example.com', 'password': '12345'})
            self.service.auth.sign_in_with_password.return_value = Obj(user=self.user, session=self.session)
            self.http.post('/api/auth/login', json=self.data)
            self.service.auth.get_user.return_value = Obj(user=self.user)
            self.assertEqual(self.http.get('/api/auth/session').json['user']['role'], 'Customer')


    def store_data(self):
        return dict(email='owner@example.com', password='StorePassword123!', storeName='Example Store',
                    registeredName='Example Limited', registrationNumber='REG-001', storeType='Physical store',
                    officeClassification='Main head office', ownerName='Ama Mensah', phone='0241234567',
                    region='Greater Accra', city='Accra', categories=['Phones, tablets & accessories'], agreeTerms=True)

    def test_store_signup_persists_application_without_privileges_or_password(self):
        def signed_up(values):
            self.user.email = values['email']
            self.user.user_metadata = values['options']['data']
            return Obj(user=self.user, session=self.session)
        self.service.auth.sign_up.side_effect = signed_up
        result = self.http.post('/api/auth/store-signup', json={**self.store_data(), 'role': 'Admin', 'status': 'Approved'})
        self.assertEqual(result.status_code, 201)
        self.assertEqual(result.json['user']['role'], 'Customer')
        self.assertEqual(result.json['user']['store_application']['status'], 'Pending Approval')
        self.assertTrue(result.json['application_reference'].startswith('BPS-'))
        stored = self.user.user_metadata['store_application']
        self.assertNotIn('password', stored)
        self.assertNotIn('role', stored)
        self.assertNotIn('status', stored)
        self.service.auth.get_user.return_value = Obj(user=self.user)
        self.assertEqual(self.http.get('/api/auth/session').json['user']['store_application']['storeName'], 'Example Store')

    def test_store_signup_rejects_invalid_details_before_auth(self):
        for change in ({'phone': '123'}, {'categories': []}, {'categories': 'Phones'}, {'agreeTerms': False},
                       {'officeClassification': 'Invalid'}, {'storeName': ''}, {'password': 'short'}):
            result = self.http.post('/api/auth/store-signup', json={**self.store_data(), **change})
            self.assertEqual(result.status_code, 400)
        self.service.auth.sign_up.assert_not_called()

    def test_store_signup_confirmation_and_duplicate(self):
        self.service.auth.sign_up.return_value = Obj(user=self.user, session=None)
        result = self.http.post('/api/auth/store-signup', json=self.store_data())
        self.assertEqual(result.status_code, 201)
        self.assertTrue(result.json['confirmation_required'])
        self.assertIsNone(result.json['application_reference'])
        self.service.auth.sign_up.side_effect = AuthApiError('duplicate', 422, 'user_already_exists')
        self.assertEqual(self.http.post('/api/auth/store-signup', json=self.store_data()).status_code, 400)

    def test_self_declared_approval_does_not_grant_store_access(self):
        self.user.user_metadata = {'role': 'Store Manager', 'store_application': {'status': 'Approved', 'storeName': 'Forged'}}
        result = public_user(self.user)
        self.assertEqual(result['role'], 'Customer')
        self.assertEqual(result['store_application']['status'], 'Pending Approval')

if __name__ == '__main__':
    unittest.main()
