import os
import unittest
from types import SimpleNamespace as Obj
from unittest.mock import Mock, patch
from uuid import uuid4
from postgrest.exceptions import APIError
from backend.app import app
from backend.site_features import rank_features, CONSENT, VISITOR


class SiteFeaturesTests(unittest.TestCase):
    def setUp(self):
        self.http=app.test_client();self.admin=Mock()
        self.admin.rpc.return_value.execute.return_value=Obj(data=True)
        for patcher in (patch.dict(app.config,TESTING=True,SECRET_KEY='site-test-secret',SESSION_COOKIE_SECURE=False),patch.dict(os.environ,ADMIN_EMAIL='admin@example.test',ADMIN_PASSWORD='test-only-password'),patch('backend.app.connect_admin',return_value=self.admin)):
            patcher.start();self.addCleanup(patcher.stop)

    def choice(self,analytics=False,chat=False):
        return self.http.post('/api/public/consent',json={'analytics':analytics,'chat':chat})

    def event(self,**changes):
        return self.http.post('/api/public/traffic',json={'id':str(uuid4()),'page':'home','device':'Desktop','source':'example.com',**changes})

    def test_cookie_choice_persists_and_revoke_removes_visitor(self):
        self.assertIsNone(self.http.get('/api/public/consent').json['consent'])
        self.assertEqual(self.choice(True,True).status_code,200)
        cookie=self.http.get_cookie(CONSENT)
        self.assertTrue(cookie.http_only)
        self.assertEqual(cookie.same_site,'Lax')
        self.assertEqual(cookie.max_age,180*86400)
        self.assertEqual(self.http.get('/api/public/consent').json['consent'],{'analytics':True})
        visitor=self.http.get_cookie(VISITOR).value
        self.choice(True,False)
        self.assertEqual(self.http.get_cookie(VISITOR).value,visitor)
        self.choice(False,False)
        self.assertIsNone(self.http.get_cookie(VISITOR))
        self.assertEqual(self.http.get('/api/public/consent').json['consent'],{'analytics':False})

    def test_no_tracking_without_valid_analytics_consent(self):
        self.assertEqual(self.event().status_code,403)
        self.choice(False,True)
        self.assertEqual(self.event().status_code,403)
        self.http.set_cookie(CONSENT,'forged-cookie')
        self.assertEqual(self.event().status_code,403)
        self.admin.rpc.assert_not_called()

    def test_allowlist_hash_and_no_raw_personal_data(self):
        self.choice(True)
        self.assertEqual(self.event(email='private@example.test',url='https://example.test/?secret=private',ip='192.0.2.1').status_code,200)
        name,params=self.admin.rpc.call_args.args
        self.assertEqual(name,'record_site_pageview')
        self.assertEqual(len(params['p_visitor']),64)
        self.assertNotIn(self.http.get_cookie(VISITOR).value,str(params))
        self.assertEqual(set(params),{'p_id','p_visitor','p_page','p_device','p_source'})
        for changes in ({'page':'portal'},{'page':[]},{'page':'customer/my-applications'},{'source':'https://example.com/?email=secret'},{'device':'fingerprint'},{'id':'not-uuid'}):
            self.assertEqual(self.event(**changes).status_code,400)
        self.admin.rpc.return_value.execute.return_value=Obj(data=False)
        self.assertEqual(self.event().status_code,429)

    def test_origin_and_invalid_preferences(self):
        self.assertEqual(self.http.post('/api/public/consent',json={'analytics':True},headers={'Origin':'https://untrusted.example'}).status_code,403)
        for value in ([],{}, {'analytics':'true','chat':False}):
            self.assertEqual(self.http.post('/api/public/consent',json=value).status_code,400)
        self.assertEqual(self.http.post('/api/public/consent',data={'analytics':'true'}).status_code,415)

    def test_engagement_requires_consent_and_bounded_measurements(self):
        data={'id':str(uuid4()),'seconds':12,'scrollSeconds':3,'depth':80}
        self.assertEqual(self.http.post('/api/public/engagement',json=data).status_code,403)
        self.choice(True)
        self.assertEqual(self.http.post('/api/public/engagement',json=data).status_code,200)
        name,params=self.admin.rpc.call_args.args
        self.assertEqual(name,'record_site_engagement')
        self.assertEqual(params['p_seconds'],12)
        self.assertEqual(len(params['p_visitor']),64)
        for changes in ({'seconds':True},{'seconds':3601},{'scrollSeconds':13},{'depth':101},{'seconds':-1},{'id':'bad'}):
            self.assertEqual(self.http.post('/api/public/engagement',json={**data,**changes}).status_code,400)
        self.choice(False)
        self.assertEqual(self.http.post('/api/public/engagement',json=data).status_code,403)

    def test_engagement_report_and_registered_accounts_are_admin_only(self):
        self.assertEqual(self.http.get('/api/auth/admin/engagement').status_code,401)
        self.http.post('/api/auth/login',json={'email':'admin@example.test','password':'test-only-password'})
        self.admin.rpc.return_value.execute.return_value=Obj(data={'activeSeconds':35})
        self.admin.auth.admin.list_users.side_effect=[list(range(100)),[101]]
        result=self.http.get('/api/auth/admin/engagement?days=7')
        self.assertEqual(result.json['registeredAccounts'],101)
        self.assertEqual(result.json['engagement']['activeSeconds'],35)
        self.assertEqual(self.http.get('/api/auth/admin/engagement?days=0').status_code,400)

    def test_admin_only_aggregates_and_range_validation(self):
        self.assertEqual(self.http.get('/api/auth/admin/traffic').status_code,401)
        self.http.post('/api/auth/login',json={'email':'admin@example.test','password':'test-only-password'})
        self.admin.rpc.return_value.execute.return_value=Obj(data={'pageviews':7,'visitors':3,'pages':[],'daily':[],'devices':[],'sources':[]})
        result=self.http.get('/api/auth/admin/traffic?days=7')
        self.assertEqual(result.status_code,200)
        self.assertEqual(result.json['report']['visitors'],3)
        self.admin.rpc.assert_called_with('site_traffic_summary',{'p_days':7})
        self.assertEqual(self.http.get('/api/auth/admin/traffic?days=999').status_code,400)
        self.admin.rpc.return_value.execute.side_effect=APIError({'code':'PGRST202','message':'Missing function','details':'','hint':''})
        self.assertIn('006_',self.http.get('/api/auth/admin/traffic').json['error'])

    def test_featured_real_ratings_ties_no_fake_stars_and_stock(self):
        stores=[{'id':'a','name':'A','productCount':20},{'id':'b','name':'B','productCount':1},{'id':'c','name':'C','productCount':5}]
        products=[{'id':key,'inStock':stock,'createdAt':date} for key,stock,date in [('old',True,'2025'),('new',True,'2026'),('rated',True,'2024'),('soldout',False,'2026')]]
        ratings={'stores':[{'id':'a','rating':4.5,'count':1},{'id':'b','rating':4.5,'count':10}],'products':[{'id':'rated','rating':4.9,'count':2},{'id':'soldout','rating':5,'count':5}]}
        selected_stores,selected_products=rank_features(stores,products,ratings)
        self.assertEqual([row['id'] for row in selected_stores],['b','a','c'])
        self.assertIsNone(selected_stores[2]['rating'])
        self.assertEqual([row['id'] for row in selected_products],['rated','new','old'])
        with patch('backend.site_features.snapshot',return_value=(stores,products)):
            self.admin.rpc.return_value.execute.return_value=Obj(data=ratings)
            response=self.http.get('/api/public/featured')
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json['stores'][0]['id'],'b')
        self.assertNotIn('customer_id',str(response.json))

    def test_missing_ratings_do_not_hide_existing_catalogue(self):
        stores=[{'id':'store','name':'Existing shop','productCount':1}]
        products=[{'id':'product','inStock':True,'createdAt':'2026'}]
        self.admin.rpc.return_value.execute.side_effect=APIError({'code':'PGRST202','message':'Missing function','details':'','hint':''})
        with patch('backend.site_features.snapshot',return_value=(stores,products)):
            result=self.http.get('/api/public/featured')
        self.assertEqual(result.status_code,200)
        self.assertEqual(result.json['products'][0]['id'],'product')
        self.assertFalse(result.json['ratingsAvailable'])

    def test_missing_product_schema_preserves_approved_stores(self):
        def partial(client,missing):
            missing['products']=True;missing['promotions']=True
            return [{'id':'store','name':'Existing shop','productCount':0}],[]
        self.admin.rpc.return_value.execute.return_value=Obj(data={'stores':[],'products':[]})
        with patch('backend.site_features.snapshot',side_effect=partial):
            result=self.http.get('/api/public/featured')
        self.assertEqual(result.status_code,200)
        self.assertEqual(result.json['stores'][0]['name'],'Existing shop')
        self.assertIsNone(result.json['stores'][0]['productCount'])
        self.assertIn('products',result.json['errors'])


if __name__=='__main__':unittest.main()
