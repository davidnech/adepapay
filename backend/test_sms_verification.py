"""Exercise the real registration handshake without sending SMS or creating users."""
import os
import unittest
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace as Obj
from unittest.mock import Mock, patch
from uuid import uuid4

import httpx
from supabase_auth.errors import AuthApiError
from backend.app import app, ACCESS
from backend.sms_verification import COOKIE, canonical_phone, require_verified_user
from backend.test_store_products import Query


class SMSClient:
    def __init__(self):
        self.database = Obj(rows=[], error=None, race=False)
        self.calls = []

    def table(self, name):
        assert name == 'signup_sms_challenges'
        return Query(self.database)

    def rpc(self, name, data):
        self.calls.append((name, deepcopy(data)))
        now = datetime.now(timezone.utc)
        if name == 'signup_sms_begin':
            row = dict(id=data['p_id'], phone=data['p_phone'], email=data['p_email'], purpose=data['p_purpose'],
                secret_hash=data['p_secret'], code_hash=data['p_code'], status='Pending', attempts=0, send_count=1,
                created_at=now.isoformat(), last_sent_at=now.isoformat(), expires_at=(now+timedelta(minutes=10)).isoformat())
            self.database.rows.append(row)
            result = deepcopy(row)
        else:
            row = next((row for row in self.database.rows if row['id']==data['p_id'] and row['secret_hash']==data['p_secret']), None)
            if not row:
                result = {'verified': False, 'error': 'Start registration again to request a code'}
            elif name == 'signup_sms_verify':
                valid = row['code_hash']==data['p_code'] and datetime.fromisoformat(row['expires_at'])>now
                if valid:
                    row['status']='Verified'
                result = {'verified': valid, 'error': 'Incorrect or expired code'}
            elif name == 'signup_sms_resend':
                row.update(code_hash=data['p_code'],status='Pending',last_sent_at=now.isoformat(),expires_at=(now+timedelta(minutes=10)).isoformat())
                result = deepcopy(row)
            elif name == 'signup_sms_complete':
                assert row['status']=='Verified'
                row.update(status='Completed',user_id=data['p_user'],code_hash=None)
                result = {'sms_verification_required': False, 'sms_verification': {'phone': row['phone'], 'verified_at': now.isoformat()}}
            else:
                raise AssertionError(name)
        return Obj(execute=lambda: Obj(data=result))


class SMSVerificationTests(unittest.TestCase):
    def setUp(self):
        self.http=app.test_client()
        self.admin=SMSClient()
        self.service=Mock()
        self.user=Obj(id=str(uuid4()),email='customer@example.test',app_metadata={'sms_verification_required':True},user_metadata={},identities=[{}])
        self.session=Obj(access_token='access-token',refresh_token='refresh-token')
        def signup(values):
            self.user.email=values['email']
            self.user.user_metadata=values['options']['data']
            return Obj(user=self.user,session=self.session)
        self.service.auth.sign_up.side_effect=signup
        self.provider=Mock()
        self.provider.json.return_value={'success':True,'sms_id':'SMS-TEST','status':'sent'}
        for patcher in (patch.dict(app.config,TESTING=True,SECRET_KEY='sms-test-secret'),
            patch.dict(os.environ,VIRESEND_API_KEY='test-only-key',COOKIE_SECURE='false',ADMIN_EMAIL='admin@example.test'),
            patch('backend.app.connect_db',return_value=self.service),
            patch('backend.app.connect_admin',return_value=self.admin),
            patch('backend.sms_verification.secrets.randbelow',return_value=123456),
            patch('backend.sms_verification.httpx.post',return_value=self.provider)):
            started=patcher.start();self.addCleanup(patcher.stop)
            if isinstance(started,Mock) and patcher.attribute=='post':self.send=started
        self.data=dict(email='customer@example.test',password='Strong123!',firstName='Ama',lastName='Mensah',
            dob='1990-01-01',gender='Female',phone='0241234567',region='Greater Accra',city='Accra',address='12 Road',agreeTerms=True,agreePrivacy=True)

    def begin(self, path='signup', data=None):
        response=self.http.post('/api/auth/'+path,json=data or self.data)
        self.assertEqual(response.status_code,202,response.json)
        self.assertTrue(response.json['verification_required'])
        self.assertIsNone(self.http.get_cookie(ACCESS,path='/api/auth'))
        self.service.auth.sign_up.assert_not_called()
        return response

    def verify(self, code='123456'):
        return self.http.post('/api/auth/sms/verify',json={'code':code})

    def test_customer_code_then_account_creation_and_success_sms(self):
        pending=self.begin()
        cookie=self.http.get_cookie(COOKIE,path='/api/auth')
        self.assertTrue(cookie.http_only);self.assertEqual(cookie.same_site,'Lax')
        for private in ('123456','Strong123!','code_hash','secret_hash','test-only-key'):
            self.assertNotIn(private,str(pending.json))
        row=self.admin.database.rows[0]
        self.assertRegex(row['code_hash'],r'^[0-9a-f]{64}$')
        self.assertNotIn('password',row)
        self.assertEqual(self.verify().status_code,200)
        created=self.http.post('/api/auth/signup',json=self.data)
        self.assertEqual(created.status_code,201,created.json)
        self.assertEqual(created.json['user']['role'],'Customer')
        self.assertTrue(created.json['welcome_sms_sent'])
        self.assertIsNotNone(self.http.get_cookie(ACCESS,path='/api/auth'))
        self.assertIsNone(self.http.get_cookie(COOKIE,path='/api/auth'))
        messages=[call.kwargs['json'] for call in self.send.call_args_list]
        self.assertEqual(self.send.call_args.args[0],'https://viresender.com/v1/sms/send')
        self.assertEqual(self.send.call_args.kwargs['headers']['Content-Type'],'application/json')
        self.assertEqual(len(messages),2)
        self.assertEqual(messages[0]['to'],'233241234567')
        self.assertTrue(all(message['sender_id']=='Adepapay' for message in messages))
        self.assertIn('successful',messages[1]['message'])
        self.assertFalse(self.user.app_metadata['sms_verification_required'])

    def test_store_verification_keeps_store_pending_administrator_approval(self):
        data=dict(email='store@example.test',password='StorePassword123!',storeName='Example Store',registeredName='Example Ltd',
            registrationNumber='REG-1',storeType='Physical store',officeClassification='Main head office',ownerName='Ama',
            phone='+233 24 123 4567',region='Greater Accra',city='Accra',categories=['Phones'],agreeTerms=True)
        self.begin('store-signup',data)
        self.assertEqual(self.verify().status_code,200)
        result=self.http.post('/api/auth/store-signup',json=data)
        self.assertEqual(result.status_code,201,result.json)
        self.assertEqual(result.json['user']['store_application']['status'],'Pending Approval')
        self.assertEqual(result.json['user']['role'],'Customer')
        self.assertIn('pending administrator approval',self.send.call_args.kwargs['json']['message'])

    def test_wrong_code_never_creates_a_login(self):
        self.begin()
        self.assertEqual(self.verify('999999').status_code,400)
        self.begin()  # A retried submit resumes the same challenge without sending again.
        self.assertEqual(self.send.call_count,1)
        self.service.auth.sign_up.assert_not_called()

    def test_code_is_bound_to_registration_phone_email_and_purpose(self):
        self.begin();self.assertEqual(self.verify().status_code,200)
        changed=self.http.post('/api/auth/signup',json={**self.data,'phone':'0201234567'})
        self.assertEqual(changed.status_code,202)
        self.service.auth.sign_up.assert_not_called()

    def test_tampered_cookie_and_invalid_codes_are_rejected(self):
        self.begin()
        for code in ('12345','1234567',123456,None,'abcdef'):
            self.assertEqual(self.verify(code).status_code,400)
        cookie=self.http.get_cookie(COOKIE,path='/api/auth')
        self.http.set_cookie(COOKIE,cookie.value+'tampered',path='/api/auth')
        self.assertEqual(self.verify().status_code,400)
        self.service.auth.sign_up.assert_not_called()

    def test_missing_configuration_fails_closed(self):
        with patch.dict(os.environ,VIRESEND_API_KEY=''):
            self.assertEqual(self.http.post('/api/auth/signup',json=self.data).status_code,503)
        self.service.auth.sign_up.assert_not_called();self.send.assert_not_called()
        self.assertEqual(self.admin.calls,[])

    def test_provider_failure_is_sanitized_and_no_account_is_created(self):
        self.provider.raise_for_status.side_effect=httpx.HTTPError('private provider detail test-only-key')
        result=self.begin()
        self.assertIn('notice',result.json['verification'])
        self.assertNotIn('test-only-key',str(result.json))
        self.service.auth.sign_up.assert_not_called()

    def test_provider_http_errors_explain_action_without_leaking_response(self):
        for status,expected in ((307,'redirected'),(401,'authentication'),(403,'authentication'),
                                (402,'wallet balance'),(429,'limiting'),(500,'HTTP 500')):
            with self.subTest(status=status):
                self.http.delete_cookie(COOKIE,path='/api/auth')
                request=httpx.Request('POST','https://viresender.com/v1/sms/send')
                response=httpx.Response(status,request=request,text='PRIVATE test-only-key 123456')
                self.provider.raise_for_status.side_effect=httpx.HTTPStatusError('PRIVATE provider detail',request=request,response=response)
                result=self.begin()
                self.assertIn(expected,result.json['verification']['notice'])
                for private in ('PRIVATE','test-only-key','123456'):
                    self.assertNotIn(private,str(result.json))
                self.service.auth.sign_up.assert_not_called()

    def test_failed_welcome_sms_does_not_undo_successful_registration(self):
        self.begin();self.verify()
        self.provider.raise_for_status.side_effect=httpx.HTTPError('provider failure')
        result=self.http.post('/api/auth/signup',json=self.data)
        self.assertEqual(result.status_code,201,result.json)
        self.assertFalse(result.json['welcome_sms_sent'])
        self.assertIsNotNone(self.http.get_cookie(ACCESS,path='/api/auth'))

    def test_resend_invalidates_old_code(self):
        self.begin()
        with patch('backend.sms_verification.secrets.randbelow',return_value=654321):
            response=self.http.post('/api/auth/sms/resend',json={})
        self.assertEqual(response.status_code,202)
        self.assertEqual(self.verify('123456').status_code,400)
        self.assertEqual(self.verify('654321').status_code,200)

    def test_interrupted_signup_can_be_completed_from_login(self):
        self.user.user_metadata={'phone':self.data['phone']}
        self.service.auth.sign_in_with_password.return_value=Obj(user=self.user,session=self.session)
        result=self.http.post('/api/auth/login',json=self.data)
        self.assertEqual(result.status_code,202)
        self.assertIsNone(self.http.get_cookie(ACCESS,path='/api/auth'))
        self.verify()
        result=self.http.post('/api/auth/login',json=self.data)
        self.assertEqual(result.status_code,200,result.json)
        self.service.auth.sign_up.assert_not_called()

    def test_unverified_auth_token_cannot_open_session(self):
        self.service.auth.get_user.return_value=Obj(user=self.user)
        self.http.set_cookie(ACCESS,'direct-auth-token',path='/api/auth')
        self.assertEqual(self.http.get('/api/auth/session').status_code,401)
        with self.assertRaises(AuthApiError):
            require_verified_user(Obj(app_metadata={'sms_verification_required':True},user_metadata={'sms_verified':True}))
        require_verified_user(Obj(app_metadata={},user_metadata={}))  # Existing accounts remain valid.

    def test_phone_normalization(self):
        for phone in ('0241234567','+233 24 123 4567','233241234567'):
            self.assertEqual(canonical_phone(phone),'233241234567')

    def test_every_portal_auth_lookup_rejects_an_unverified_signup(self):
        from backend.db import connect_db
        raw_client = Mock()
        raw_client.auth.get_user.return_value = Obj(user=self.user)
        with patch('backend.db.create_client', return_value=raw_client), patch.dict(os.environ,
                SUPABASE_URL='https://example.test', SUPABASE_KEY='fixture-key'):
            guarded = connect_db()
        with self.assertRaises(AuthApiError):
            guarded.auth.get_user('direct-auth-token')
        self.user.app_metadata = {'sms_verification_required':False}
        self.assertIs(guarded.auth.get_user('verified-auth-token').user, self.user)
