import hashlib
import hmac
import json
import os
import unittest
from copy import deepcopy
from types import SimpleNamespace as Obj
from unittest.mock import Mock, patch
from uuid import uuid4
from backend.app import app, public_user
from backend.subscriptions import verify_payment
from backend.subscription_access import subscription_info
from backend.store_team import resolve_store, StoreAccessError
from backend.public_catalogue import public_store
from backend.test_store_products import Query


class BillingQuery(Query):
    def execute(self):
        if self.action=='insert':
            row={**deepcopy(self.values),'id':str(uuid4()),'revision':1,'created_at':'2026-10-09T12:00:00Z','status':self.values.get('status','Pending')}
            self.database.rows.append(row)
            return Obj(data=[deepcopy(row)])
        return super().execute()


class SubscriptionTests(unittest.TestCase):
    def setUp(self):
        self.http=app.test_client(); self.client=Mock(); self.auth=Mock()
        self.owner=Obj(id=str(uuid4()),email='owner@example.test',user_metadata={},app_metadata={'role':'Store Manager','store_review':{'status':'Approved','application':{'storeName':'Test Store'}}})
        self.owner.app_metadata['store_id']=self.owner.id
        self.auth.auth.get_user.return_value=Obj(user=self.owner)
        self.client.auth.admin.get_user_by_id.return_value=Obj(user=self.owner)
        self.client.auth.admin.list_users.return_value=[self.owner]
        self.plan={'id':str(uuid4()),'name':'Monthly','amount_minor':12500,'duration_days':30,'enabled':True,'revision':1}
        self.tables={name:Obj(rows=[],error=None,race=False) for name in ('subscription_plans','subscription_orders')}
        self.tables['subscription_plans'].rows=[self.plan]
        self.client.table.side_effect=lambda name:BillingQuery(self.tables[name])
        for p in (patch.dict(app.config,TESTING=True,SECRET_KEY='test-secret'),patch.dict(os.environ,PAYSTACK_SECRET_KEY='sk_test_fixture',PAYSTACK_PUBLIC_KEY='pk_test_fixture',APP_ORIGIN='http://localhost',ADMIN_EMAIL='admin@example.test',ADMIN_PASSWORD='pass'),patch('backend.app.connect_admin',return_value=self.client),patch('backend.app.connect_db',return_value=self.auth)):
            p.start();self.addCleanup(p.stop)
        self.http.set_cookie('adepa_access','token',path='/api/auth')

    def order(self):
        row={'reference':'SUB-'+uuid4().hex,'store_id':self.owner.id,'plan_name':'Monthly','plan_id':self.plan['id'],'amount_minor':12500,'duration_days':30,'currency':'GHS','email':self.owner.email,'environment':'test','status':'Pending'}
        self.tables['subscription_orders'].rows.append(row)
        return row

    def payment(self,row):
        return {'status':'success','reference':row['reference'],'amount':row['amount_minor'],'currency':'GHS','domain':'test','customer':{'email':self.owner.email},'id':123,'paid_at':'2026-10-09T12:00:00Z'}

    def test_unpaid_expired_owner_staff_and_public_access(self):
        self.assertFalse(public_user(self.owner)['subscription']['active'])
        self.assertEqual(self.http.get('/api/auth/store/products').status_code,402)
        self.assertEqual(self.http.get('/api/auth/store/billing').status_code,200)
        self.assertIsNone(public_store(self.owner))
        for until in ('2020-01-01T00:00:00Z','bad'):
            self.owner.app_metadata['store_subscription']={'paid_until':until,'environment':'test'}
            self.assertFalse(subscription_info(self.owner)['active'])
        staff=Obj(id='staff',app_metadata={'store_staff':{'status':'Active','permissions':['products'],'store_id':self.owner.id}})
        with self.assertRaises(StoreAccessError): resolve_store(staff,lambda:self.client,page='products')
        self.auth.auth.get_user.return_value=Obj(user=staff)
        self.assertFalse(self.http.get('/api/auth/store/billing').json['canPay'])
        self.assertEqual(self.http.post('/api/auth/store/billing/checkout',json={'planId':self.plan['id'],'revision':1}).status_code,403)

    def test_checkout_uses_server_price_email_reference_and_mode(self):
        with patch('backend.subscriptions.gateway') as gateway:
            response=self.http.post('/api/auth/store/billing/checkout',json={'planId':self.plan['id'],'revision':1,'amount':1,'email':'attacker@example.test','store_id':'other'})
            gateway.assert_not_called()
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json['key'],'pk_test_fixture')
        self.assertEqual(response.json['amount'],12500)
        self.assertEqual(response.json['email'],self.owner.email)
        self.assertNotIn('sk_test_fixture',response.get_data(as_text=True))
        self.assertEqual(self.tables['subscription_orders'].rows[0]['store_id'],self.owner.id)
        self.assertEqual(self.tables['subscription_orders'].rows[0]['reference'],response.json['reference'])
        self.client.rpc.assert_not_called()

    def test_public_key_required_and_mode_must_match(self):
        for public in ('','pk_live_fixture','sk_test_accidental_secret'):
            with patch.dict(os.environ,PAYSTACK_PUBLIC_KEY=public):
                self.assertFalse(self.http.get('/api/auth/store/billing').json['configured'])
                response=self.http.post('/api/auth/store/billing/checkout',json={'planId':self.plan['id'],'revision':1})
                self.assertEqual(response.status_code,503)
                self.assertNotIn('sk_test_accidental_secret',response.get_data(as_text=True))
        self.assertEqual(self.tables['subscription_orders'].rows,[])

    def test_stale_plan_and_disabled_plan_rejected(self):
        self.assertEqual(self.http.post('/api/auth/store/billing/checkout',json={'planId':self.plan['id'],'revision':0}).status_code,409)
        self.plan['enabled']=False
        self.assertEqual(self.http.post('/api/auth/store/billing/checkout',json={'planId':self.plan['id'],'revision':1}).status_code,400)

    def test_payment_verification_rejects_mismatched_fields(self):
        row=self.order(); verified=self.payment(row)
        for change in ({'amount':1},{'currency':'USD'},{'domain':'live'},{'customer':{'email':'other@example.test'}},{'reference':'forged'}):
            with patch('backend.subscriptions.gateway',return_value={**verified,**change}):
                with self.assertRaises(ValueError): verify_payment(self.client,row['reference'])
        self.client.rpc.assert_not_called()
        with patch('backend.subscriptions.gateway',return_value={**verified,'status':'failed'}): self.assertFalse(verify_payment(self.client,row['reference'])['paid'])
        with patch('backend.subscriptions.gateway',return_value=verified): self.assertTrue(verify_payment(self.client,row['reference'])['paid'])
        self.client.rpc.assert_called_once()
        row['status']='Paid'
        with patch('backend.subscriptions.gateway') as gateway:
            self.assertTrue(verify_payment(self.client,row['reference'])['paid']);gateway.assert_not_called()

    def test_verify_is_store_scoped_and_webhook_requires_valid_signature(self):
        row=self.order(); row['store_id']='other'
        self.assertEqual(self.http.post('/api/auth/store/billing/verify',json={'reference':row['reference']}).status_code,403)
        body=json.dumps({'event':'charge.success','data':{'reference':row['reference']}})
        self.assertEqual(self.http.post('/api/paystack/webhook',data=body,content_type='application/json').status_code,401)
        signature=hmac.new(b'sk_test_fixture',body.encode(),hashlib.sha512).hexdigest()
        with patch('backend.subscriptions.gateway',return_value=self.payment(row)):
            result=self.http.post('/api/paystack/webhook',data=body,content_type='application/json',headers={'x-paystack-signature':signature})
        self.assertEqual(result.status_code,200)

    def test_admin_plans_and_live_test_separation(self):
        self.assertEqual(self.http.get('/api/auth/admin/subscriptions').status_code,403)
        self.http.post('/api/auth/login',json={'email':'admin@example.test','password':'pass'})
        result=self.http.post('/api/auth/admin/subscriptions',json={'name':'Annual','amount_minor':20000,'duration_days':365,'enabled':True})
        self.assertEqual(result.status_code,200)
        self.assertEqual(self.http.post('/api/auth/admin/subscriptions',json={'name':'Bad','amount_minor':True,'duration_days':30,'enabled':True}).status_code,400)
        self.owner.app_metadata['store_subscription']={'paid_until':'2099-01-01T00:00:00Z','environment':'test'}
        self.assertTrue(subscription_info(self.owner)['active'])
        with patch.dict(os.environ,PAYSTACK_SECRET_KEY='sk_live_fixture'): self.assertFalse(subscription_info(self.owner)['active'])
        report=self.http.get('/api/auth/admin/subscriptions').json
        self.assertEqual(report['paidRevenue'],0)

    def test_unapproved_and_suspended_cannot_checkout(self):
        for status in ('Pending Approval','Suspended','Deleted'):
            self.owner.app_metadata['store_review']['status']=status
            self.assertEqual(self.http.get('/api/auth/store/billing').status_code,403)


if __name__=='__main__': unittest.main()
