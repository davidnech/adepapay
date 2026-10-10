import io
import unittest
from copy import deepcopy
from types import SimpleNamespace as Obj
from unittest.mock import Mock, patch
from uuid import uuid4
from itsdangerous import URLSafeTimedSerializer
from backend.app import app
from backend.customer_applications import quote_for, quote_digest, application_values, schedule_for
from backend.store_rules import DEFAULTS
from backend.test_store_products import Query


class CustomerApplicationsTests(unittest.TestCase):
    def setUp(self):
        self.http=app.test_client()
        self.customer=Obj(id=str(uuid4()),email='customer@example.test',user_metadata={'firstName':'Test'},app_metadata={'role':'Customer'})
        self.store=Obj(id=str(uuid4()),email='store@example.test',user_metadata={},app_metadata={'store_subscription':{'paid_until':'2099-01-01T00:00:00+00:00','plan_name':'Test paid plan','environment':'test'},'role':'Store Manager','store_review':{'status':'Approved','application':{'storeName':'My Store'}}})
        self.store.app_metadata['store_id']=self.store.id
        self.service=Mock();self.service.auth.get_user.return_value=Obj(user=self.customer)
        self.admin=Mock();self.admin.auth.admin.get_user_by_id.return_value=Obj(user=self.store)
        self.databases={name:Obj(rows=[],error=None,race=False) for name in ('store_products','store_promotion_settings','customer_applications','application_payments','application_events')}
        self.admin.table.side_effect=lambda name:Query(self.databases[name])
        self.product={'id':str(uuid4()),'store_id':self.store.id,'name':'Phone','price':1000,'status':'Active','stock':2,'revision':1,'category':'Phones','payment_options':{'hirePurchase':True,'layaway':True},'swap':{'enabled':True,'minimumCondition':'Good','validityDays':7,'categories':'Phones'},'layaway':{'deposit':20,'depositType':'Percentage','duration':12,'frequencies':['Monthly','Weekly'],'minimumInstallment':10}}
        self.databases['store_products'].rows=[self.product]
        for name,value in [('backend.app.connect_db',self.service),('backend.app.connect_admin',self.admin)]:
            patcher=patch(name,return_value=value);patcher.start();self.addCleanup(patcher.stop)
        patcher=patch.dict(app.config,TESTING=True,SECRET_KEY='tests-only');patcher.start();self.addCleanup(patcher.stop)
        self.http.set_cookie('adepa_access','token',path='/api/auth')
        docs={slot:{'upload_token':URLSafeTimedSerializer(app.secret_key,salt='customer-document').dumps({'customer':self.customer.id,'purpose':'application','id':slot})} for slot in ('front','back','devicePhoto')}
        self.input={'action':'submit','productId':self.product['id'],'kind':'hire_purchase','requestId':str(uuid4()),'expectedPrice':1000,'fullName':'Test Customer','phone':'0241234567','address':'Accra','ghanaCard':'GHA-123456789-0','employment':'Shop owner','monthlyIncome':2500,'guarantors':[{'name':'Person A','phone':'0241111111','relationship':'Friend','address':'Accra'},{'name':'Person B','phone':'0242222222','relationship':'Sibling','address':'Tema'}],'guarantorConsent':True,'documents':docs,'months':3,'deposit':200,'frequency':'Monthly','acceptedTerms':True,'device':'Old phone','serial':'TEST-DEVICE-001','deviceCondition':'Good'}

    def quote(self,kind='hire_purchase'):
        result=self.http.get(f'/api/auth/customer/quote?product={self.product["id"]}&kind={kind}')
        self.assertEqual(result.status_code,200)
        self.input['quoteToken']=result.json['quote']['token']
        self.input['kind']=kind
        return {k:v for k,v in result.json['quote'].items() if k!='token'}

    def record(self,**extra):
        value={'id':str(uuid4()),'reference':'APP-TEST','request_id':str(uuid4()),'customer_id':self.customer.id,'store_id':self.store.id,'product_id':self.product['id'],'kind':'hire_purchase','status':'Pending','details':{'fullName':'Test','phone':'0241234567','email':self.customer.email,'ghanaCard':'GHA-123456789-0','documents':{'front':{'id':'private-image'}}},'snapshot':{'price':1000},'terms':{'installments':3,'frequency':'Monthly'},'total':1000,'deposit':200,'paid':0,'revision':1,'approved_at':None,'created_at':'2026-10-09T10:00:00Z'}
        value.update(extra);self.databases['customer_applications'].rows.append(value);return value

    def test_quote_and_submission_derive_store_price_and_identity(self):
        self.quote()
        self.admin.rpc.return_value.execute.return_value=Obj(data=self.record())
        result=self.http.post('/api/auth/customer/applications',json={**self.input,'customer_id':'forged','store_id':'forged','total':1})
        self.assertEqual(result.status_code,201)
        name,params=self.admin.rpc.call_args.args
        self.assertEqual(name,'submit_customer_application')
        self.assertEqual(params['p_record']['store_id'],self.store.id)
        self.assertEqual(params['p_record']['customer_id'],self.customer.id)
        self.assertEqual(params['p_record']['total'],1000)
        self.assertEqual(params['p_record']['details']['documents']['front'],{'id':'front'})

    def test_selected_option_price_and_promotions_are_used(self):
        self.product['prices']={'hire_purchase':1500,'layaway':1100,'swap':1250}
        for kind, price in self.product['prices'].items():
            with self.subTest(kind=kind):
                quote=self.quote(kind)
                self.assertEqual(quote['price'],price)
        self.databases['store_promotion_settings'].rows=[{'store_id':self.store.id,'public_enabled':True,'campaigns':[
            {'enabled':True,'startsAt':'2000-01-01','endsAt':'2099-01-01','scope':'All products','discountPercent':10}]}]
        self.assertEqual(self.quote()['price'],1350)

    def test_store_adjustment_is_scoped_validated_and_customers_cannot_adjust(self):
        row=self.record()
        payload={'id':row['id'],'action':'adjust_price','revision':1,'price':900,'reason':'Customer discount'}
        self.assertEqual(self.http.post('/api/auth/customer/applications',json=payload).status_code,403)
        self.service.auth.get_user.return_value=Obj(user=self.store)
        self.admin.rpc.return_value.execute.return_value=Obj(data=row)
        self.assertEqual(self.http.post('/api/auth/store/customer-applications/applications',json=payload).status_code,200)
        params=self.admin.rpc.call_args.args[1]
        self.assertEqual(params['p_action'],'adjust_price')
        self.assertEqual(params['p_data'],{'price':900,'reason':'Customer discount'})
        self.assertEqual(params['p_scope_id'],self.store.id)
        for price in (0,-1,'NaN',99999999999,1.111):
            self.assertEqual(self.http.post('/api/auth/store/customer-applications/applications',json={**payload,'price':price}).status_code,400)
        self.assertEqual(self.http.post('/api/auth/store/customer-applications/payments',json=payload).status_code,403)

    def test_terms_change_and_document_forgery_fail_closed(self):
        quote=self.quote()
        for change in ({'acceptedTerms':False},{'deposit':199},{'months':121},{'ghanaCard':'invalid'},{'phone':'bad'},{'documents':{'front':{'upload_token':'forged'}}},{'guarantorConsent':False},{'quoteToken':'forged'}):
            with self.subTest(change=change):
                result=self.http.post('/api/auth/customer/applications',json={**self.input,**change})
                self.assertEqual(result.status_code,400,result.json)
        self.store.app_metadata['store_rules']={'values':{**DEFAULTS,'minimumDeposit':25},'revision':1}
        result=self.http.post('/api/auth/customer/applications',json={**self.input,'deposit':300})
        self.assertEqual(result.status_code,400)
        self.assertIn('terms changed',result.json['error'])
        self.admin.rpc.assert_not_called()

    def test_layaway_and_swap_product_rules(self):
        quote=self.quote('layaway')
        values=application_values(self.input,quote,self.customer,app.secret_key)
        self.assertEqual(values['terms']['installments'],3)
        self.product['layaway']['minimumInstallment']=500
        quote=self.quote('layaway')
        with self.assertRaisesRegex(ValueError,'below the store minimum'):application_values(self.input,quote,self.customer,app.secret_key)
        quote=self.quote('swap')
        values=application_values(self.input,quote,self.customer,app.secret_key)
        self.assertEqual(values['deposit'],1000)
        self.assertEqual(values['terms']['offerDays'],7)
        with self.assertRaisesRegex(ValueError,'minimum trade-in condition'):application_values({**self.input,'deviceCondition':'Needs Repair'},quote,self.customer,app.secret_key)
        self.product['swap']['enabled']=False
        self.assertEqual(self.http.get(f'/api/auth/customer/quote?product={self.product["id"]}&kind=swap').status_code,400)

    def test_customer_scope_and_forbidden_decisions(self):
        own=self.record();other=self.record(customer_id=str(uuid4()))
        listing=self.http.get('/api/auth/customer/applications')
        self.assertEqual([r['id'] for r in listing.json['applications']],[own['id']])
        self.assertNotIn('private-image',str(listing.json))
        self.assertIn('no-store',listing.headers['Cache-Control'])
        for action in ('approve','payment','reject','fulfill','offer'):
            result=self.http.post('/api/auth/customer/applications',json={'id':own['id'],'revision':1,'action':action})
            self.assertEqual(result.status_code,403)
        result=self.http.post('/api/auth/customer/applications',json={'id':other['id'],'revision':1,'action':'cancel'})
        self.assertEqual(result.status_code,404)
        self.admin.rpc.assert_not_called()

    def test_store_scope_and_staff_page_permissions(self):
        own=self.record();self.record(store_id=str(uuid4()))
        staff=Obj(id=str(uuid4()),email='staff@example.test',user_metadata={},app_metadata={'store_staff':{'store_id':self.store.id,'status':'Active','permissions':['payments']}})
        self.service.auth.get_user.return_value=Obj(user=staff)
        self.assertEqual(self.http.get('/api/auth/store/customer-applications/applications').status_code,403)
        result=self.http.get('/api/auth/store/customer-applications/payments')
        self.assertEqual(len(result.json['applications']),1)
        self.assertNotIn('ghanaCard',result.json['applications'][0]['details'])
        self.assertEqual(result.json['applications'][0]['details']['documents'],{})
        self.assertEqual(self.http.post('/api/auth/store/customer-applications/payments',json={'id':own['id'],'revision':1,'action':'approve'}).status_code,403)
        self.assertEqual(self.http.get('/api/auth/customer/applications').status_code,403)
        self.admin.rpc.return_value.execute.return_value=Obj(data=own)
        values={'id':own['id'],'revision':1,'action':'payment','requestId':str(uuid4()),'amount':100,'method':'Cash','reference':'receipt-01','confirmedReceived':True}
        self.assertEqual(self.http.post('/api/auth/store/customer-applications/payments',json=values).status_code,200)
        params=self.admin.rpc.call_args.args[1]
        self.assertEqual(params['p_scope_id'],self.store.id)
        self.assertEqual(params['p_actor'],staff.id)
        self.assertFalse(params['p_customer'])
        self.assertEqual(self.http.post('/api/auth/store/customer-applications/payments',json={**values,'confirmedReceived':False}).status_code,400)

    def test_private_document_owner_store_and_cross_store_access(self):
        own=self.record()
        with patch('backend.customer_applications.download_private_image',return_value=(b'image','image/jpeg')) as download:
            url=f'/api/auth/customer/document?application={own["id"]}&slot=front'
            self.assertEqual(self.http.get(url).status_code,200)
            self.service.auth.get_user.return_value=Obj(user=self.store)
            self.assertEqual(self.http.get(url+'&view=applications').status_code,200)
            self.store.app_metadata['store_id']=self.store.id=str(uuid4())
            self.assertEqual(self.http.get(url+'&view=applications').status_code,403)
            self.assertEqual(download.call_count,2)

    def test_private_upload_ticket_cannot_be_used_by_another_customer(self):
        with patch('backend.customer_applications.upload_image',return_value={'id':'new-image','url':'unused'}) as upload:
            result=self.http.post('/api/auth/customer/upload?purpose=application',data={'image':(io.BytesIO(b'img'),'id.jpg')},headers={'X-Requested-With':'AdepaPay'})
            self.assertEqual(result.status_code,200)
            self.assertTrue(upload.call_args.kwargs['private'])
        url=result.json['image']['url']
        self.customer.id=str(uuid4())
        with patch('backend.customer_applications.download_private_image') as download:
            self.assertEqual(self.http.get(url).status_code,403)
            download.assert_not_called()

    def test_schedule_exact_pesewas_month_end_and_partial_allocation(self):
        row=self.record(total=100,deposit=20,paid=30,approved_at='2026-01-31T13:00:00Z')
        schedule=schedule_for(row)
        self.assertEqual([r['date'] for r in schedule],['2026-01-31','2026-02-28','2026-03-31','2026-04-30'])
        self.assertEqual([r['amount'] for r in schedule],[20,26.67,26.67,26.66])
        self.assertEqual([r['remaining'] for r in schedule],[0,16.67,26.67,26.66])
        self.assertAlmostEqual(sum(r['remaining'] for r in schedule),70)

    def test_missing_migration_and_no_login(self):
        self.databases['customer_applications'].error='PGRST205'
        result=self.http.get('/api/auth/customer/applications')
        self.assertEqual(result.status_code,503)
        self.assertIn('005_customer_applications.sql',result.json['error'])
        self.http.delete_cookie('adepa_access',path='/api/auth')
        self.assertEqual(self.http.get('/api/auth/customer/account').status_code,401)

    def test_submission_retry_works_when_product_sells_out(self):
        self.quote();existing=self.record(request_id=self.input['requestId'])
        self.product['stock']=0
        result=self.http.post('/api/auth/customer/applications',json=self.input)
        self.assertEqual(result.status_code,200)
        self.assertEqual(result.json['application']['id'],existing['id'])
        self.admin.rpc.assert_not_called()

    def test_profile_updates_cannot_change_role_and_password_requires_current(self):
        def update(uid,values):
            self.assertEqual(uid,self.customer.id)
            if 'user_metadata' in values:self.customer.user_metadata=values['user_metadata']
            return Obj(user=self.customer)
        self.admin.auth.admin.update_user_by_id.side_effect=update
        profile={'firstName':'New','lastName':'Customer','phone':'0241234567','region':'Greater Accra','city':'Accra','address':'Street 1','dob':'2000-01-01','gender':'Female','nationality':'Forged','role':'Admin','receiveUpdates':True}
        response=self.http.post('/api/auth/customer/account',json=profile)
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json['account']['nationality'],'Ghana')
        self.assertEqual(self.customer.app_metadata['role'],'Customer')
        self.assertNotIn('role',self.customer.user_metadata)
        self.service.auth.sign_in_with_password.return_value=Obj(user=self.customer)
        self.assertEqual(self.http.post('/api/auth/customer/account',json={'action':'password','currentPassword':'old-password','password':'new-password'}).status_code,200)
        self.service.auth.sign_in_with_password.assert_called_once_with({'email':self.customer.email,'password':'old-password'})
        self.admin.auth.admin.update_user_by_id.assert_called_with(self.customer.id,{'password':'new-password'})

    def test_rating_uses_authenticated_customer_and_rejects_bad_scores(self):
        application=str(uuid4())
        self.admin.rpc.return_value.execute.return_value=Obj(data={'store_score':5,'product_score':4})
        result=self.http.post('/api/auth/customer/rating',json={'application':application,'storeScore':5,'productScore':4,'customer_id':'forged','store_id':'forged'})
        self.assertEqual(result.status_code,200)
        self.admin.rpc.assert_called_once_with('save_purchase_rating',{'p_application':application,'p_customer':self.customer.id,'p_store_score':5,'p_product_score':4})
        for score in (0,6,4.5,True,'NaN'):
            result=self.http.post('/api/auth/customer/rating',json={'application':application,'storeScore':score,'productScore':4})
            self.assertEqual(result.status_code,400)
        self.service.auth.get_user.return_value=Obj(user=self.store)
        self.assertEqual(self.http.post('/api/auth/customer/rating',json={'application':application,'storeScore':5,'productScore':4}).status_code,403)


if __name__=='__main__':unittest.main()
