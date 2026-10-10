import os
import unittest
from copy import deepcopy
from types import SimpleNamespace as Obj
from unittest.mock import Mock, patch
from uuid import uuid4
from backend.app import app
from backend.admin_operations import MODULES
from backend.test_store_products import Query


class AdminOperationsTests(unittest.TestCase):
    def setUp(self):
        self.http=app.test_client(); self.client=Mock()
        self.store=str(uuid4()); self.customer=str(uuid4()); self.agent=str(uuid4()); self.product=str(uuid4()); self.application=str(uuid4()); self.payment=str(uuid4())
        self.users=[Obj(id=self.store,email='store@example.test',created_at='2026-10-01T00:00:00Z',app_metadata={'role':'Store Manager','store_id':self.store,
            'store_review':{'status':'Approved','application':{'storeName':'Real Store','region':'Ashanti'}},'store_profile':{'storeName':'Current Store','region':'Ashanti'}},user_metadata={}),
            Obj(id=self.customer,email='customer@example.test',created_at='2026-10-01T00:00:00Z',email_confirmed_at='2026-10-01T00:00:00Z',app_metadata={'role':'Customer'},user_metadata={'firstName':'Ama','phone':'0241234567','region':'Greater Accra','ghanaCard':'PRIVATE_DOCUMENT','password':'PRIVATE_DOCUMENT'}),
            Obj(id=self.agent,email='agent@example.test',created_at='2026-10-01T00:00:00Z',app_metadata={'role':'Field Agent','field_agent_store':self.store},user_metadata={'firstName':'Kojo'})]
        self.tables={name:Obj(rows=[],error=None,race=False) for name in ('store_products','store_categories','customer_applications','application_payments','store_field_agents','agent_settlements','agent_settlement_items','subscription_orders','application_events','store_admin_events','platform_admin_events')}
        self.tables['store_products'].rows=[dict(id=self.product,store_id=self.store,name='Stored Phone',sku='SKU-1',category='Phones',status='Active',stock=2,price=1000,prices={'hire_purchase':1400,'layaway':1100,'swap':1200},created_at='2026-10-02T00:00:00Z',payment_options={'payNow':True},swap={},description='Saved description')]
        self.tables['store_categories'].rows=[dict(id=str(uuid4()),store_id=self.store,name='Phones',status='Active',created_at='2026-10-02T00:00:00Z')]
        self.tables['customer_applications'].rows=[dict(id=self.application,store_id=self.store,customer_id=self.customer,product_id=self.product,reference='APP-REAL',kind='hire_purchase',status='Approved',total=1400,paid=200,deposit=200,fulfilled=False,swap_credit=0,created_at='2026-10-03T00:00:00Z',snapshot={'productName':'Stored Phone','price':1400,'documents':'PRIVATE_DOCUMENT'},terms={'months':3,'frequency':'Monthly','installments':3},details={'fullName':'Ama','email':'customer@example.test','phone':'0241234567','ghanaCard':'PRIVATE_DOCUMENT','guarantors':'PRIVATE_DOCUMENT','documents':'PRIVATE_DOCUMENT'})]
        self.tables['application_payments'].rows=[dict(id=self.payment,store_id=self.store,customer_id=self.customer,application_id=self.application,reference='RECEIPT-REAL',amount=200,method='Cash',recorded_by=self.agent,created_at='2026-10-04T00:00:00Z')]
        self.tables['store_field_agents'].rows=[dict(id=self.agent,store_id=self.store,email='agent@example.test',status='Active',profile={'fullName':'Kojo','region':'Ashanti','area':'Kumasi','ghanaCard':'PRIVATE_DOCUMENT','guarantorPhone':'PRIVATE_DOCUMENT'},created_at='2026-10-01T00:00:00Z')]
        self.tables['application_events'].rows=[dict(id=str(uuid4()),store_id=self.store,application_id=self.application,actor_id=self.customer,event='Submitted',message='Real application submitted',created_at='2026-10-03T00:00:00Z')]
        self.tables['store_admin_events'].rows=[dict(id=str(uuid4()),store_id=self.store,action='restore',actor='admin@example.test',reason='Real admin reason',created_at='2026-10-04T00:00:00Z')]
        self.tables['subscription_orders'].rows=[dict(reference='SUB-REAL',store_id=self.store,plan_name='Saved Plan',amount_minor=5000,currency='GHS',environment='test',status='Paid',paid_at='2026-10-04T00:00:00Z',created_at='2026-10-01T00:00:00Z')]
        self.client.auth.admin.list_users.side_effect=lambda page,per_page:self.users[(page-1)*per_page:page*per_page]
        self.client.table.side_effect=lambda name:Query(self.tables[name])
        self.client.rpc.return_value.execute.return_value=Obj(data={'id':str(uuid4()),'reference':'AST-REAL','amount':200})
        for patcher in (patch.dict(app.config,TESTING=True,SECRET_KEY='test-admin-operations'),patch.dict(os.environ,ADMIN_EMAIL='admin@example.test',ADMIN_PASSWORD='pass'),patch('backend.app.connect_admin',return_value=self.client)):
            patcher.start();self.addCleanup(patcher.stop)

    def login(self):
        self.assertEqual(self.http.post('/api/auth/login',json={'email':'admin@example.test','password':'pass'}).status_code,200)

    def get(self,module,query=''):
        return self.http.get('/api/auth/admin/operations/'+module+query)

    def test_each_page_requires_verified_admin_session(self):
        for module in MODULES: self.assertEqual(self.get(module).status_code,403,module)
        with self.http.session_transaction() as session: session['role']='Admin'
        self.assertEqual(self.get('customers').status_code,403)
        self.assertEqual(self.http.post('/api/auth/admin/agent-settlements',json={}).status_code,403)
        self.client.auth.admin.list_users.assert_not_called();self.client.rpc.assert_not_called()

    def test_01_customers_are_registered_accounts_with_real_balances(self):
        self.login();data=self.get('customers').json
        self.assertEqual(data['total'],1);row=data['items'][0]
        self.assertEqual((row['name'],row['applications'],row['paid'],row['balance']),('Ama',1,200,1200))
        self.assertEqual(self.get('customers','?id='+self.customer).json['record']['related'][0]['rows'][0]['reference'],'APP-REAL')

    def test_configured_admin_is_excluded_without_a_supabase_role(self):
        administrator=deepcopy(self.users[1]); administrator.id=str(uuid4()); administrator.email=' ADMIN@example.TEST '; administrator.app_metadata={}
        self.users.append(administrator)
        self.login()
        result=self.get('customers').json
        self.assertEqual(result['total'],1)
        self.assertEqual(result['summary'][0]['value'],1)
        self.assertEqual(self.get('customers','?id='+administrator.id).status_code,404)
        search=self.http.get('/api/auth/admin/search?q=admin@example.test&scope=customers').json
        self.assertEqual(search['total'],0)

    def test_trusted_store_markers_exclude_legacy_accounts_without_roles(self):
        for metadata in ({'store_id':self.store},{'store_profile':{'storeName':'Legacy store'}},{'store_lifecycle':{'action':'delete','revision':1}},
                         {'store_review':{'status':'Suspended'}},{'store_staff':{'status':'Disabled'}},{'field_agent_store':self.store},{'role':'Admin'}):
            account=deepcopy(self.users[1]);account.id=str(uuid4());account.app_metadata=metadata;self.users.append(account)
        self.login();result=self.get('customers').json
        self.assertEqual(result['total'],1)
        self.assertEqual(result['items'][0]['id'],self.customer)

    def test_editable_role_does_not_reclassify_a_customer(self):
        self.users[1].user_metadata['role']='Admin'
        self.login()
        self.assertEqual(self.get('customers').json['items'][0]['id'],self.customer)

    def test_02_products_display_all_stored_prices_and_stock(self):
        self.login();row=self.get('products').json['items'][0]
        self.assertEqual([row[key] for key in ('cash','hirePurchase','layaway','swap','stock')],[1000,1400,1100,1200,2])
        self.assertEqual(row['storeName'],'Current Store')

    def test_03_categories_count_only_products_in_the_matching_store(self):
        self.login();self.tables['store_products'].rows.append({**self.tables['store_products'].rows[0],'id':'other','store_id':str(uuid4()),'stock':99})
        row=self.get('categories').json['items'][0]
        self.assertEqual((row['products'],row['stock']),(1,2))

    def test_04_applications_join_actual_receipts_in_details(self):
        self.login();row=self.get('applications').json['items'][0]
        self.assertEqual(row['reference'],'APP-REAL')
        details=self.get('applications','?id='+self.application).json['record']
        self.assertEqual(details['related'][0]['rows'][0]['reference'],'RECEIPT-REAL')

    def test_05_swap_overview_filters_by_swap_kind(self):
        self.login();self.assertEqual(self.get('swap-overview').json['total'],0)
        self.tables['customer_applications'].rows[0].update(kind='swap',swap_credit=300)
        self.assertEqual(self.get('swap-overview').json['items'][0]['swapCredit'],300)

    def test_06_active_purchases_exclude_pending_and_cancelled_requests(self):
        self.login();self.assertEqual(self.get('active-purchases').json['total'],1)
        self.tables['customer_applications'].rows[0]['status']='Pending'
        self.assertEqual(self.get('active-purchases').json['total'],0)

    def test_07_layaway_uses_persisted_plan_amounts(self):
        self.login();self.assertEqual(self.get('layaway-plans').json['total'],0)
        self.tables['customer_applications'].rows[0]['kind']='layaway'
        self.assertEqual(self.get('layaway-plans').json['items'][0]['deposit'],200)

    def test_08_agents_are_actual_accounts_with_safe_profile_fields(self):
        self.login();row=self.get('collection-agents').json['items'][0]
        self.assertEqual((row['name'],row['area']),('Kojo','Kumasi'))

    def test_09_settlements_derive_from_unsettled_agent_recorded_receipts(self):
        self.login();row=self.get('agent-settlements').json['items'][0]
        self.assertEqual((row['receipts'],row['unsettled']),(1,200))
        self.tables['agent_settlement_items'].rows=[dict(id='item',settlement_id='settlement',payment_id=self.payment)]
        self.tables['agent_settlements'].rows=[dict(id='settlement',agent_id=self.agent,store_id=self.store,amount=200,reference='AST-REAL',method='Cash',actor='admin@example.test',reason='Received cash',created_at='2026-10-04T00:00:00Z')]
        row=self.get('agent-settlements').json['items'][0]
        self.assertEqual((row['unsettled'],row['settled'],row['settlements']),(0,200,1))

    def test_10_transactions_preserve_types_and_money_units(self):
        self.login();data=self.get('transactions').json
        self.assertEqual({row['kind']:row['total'] for row in data['items']},{'Customer payment':200,'Store subscription':50})
        self.assertEqual(self.get('transactions','?status=Paid').json['total'],1)

    def test_11_audit_events_keep_actual_actor_reason_and_source(self):
        self.login();data=self.get('audit-logs').json
        self.assertEqual(data['total'],2)
        event=next(row for row in data['items'] if row['kind']=='Store administration')
        self.assertEqual((event['actor'],event['action'],event['reason']),('admin@example.test','restore','Real admin reason'))

    def test_private_documents_and_credentials_never_appear_in_any_module(self):
        self.login()
        for module in MODULES:
            response=self.get(module);self.assertEqual(response.status_code,200,module)
            self.assertNotIn('PRIVATE_DOCUMENT',response.get_data(as_text=True),module)
            for row in response.json['items']:
                response=self.get(module,'?id='+row['id'])
                self.assertNotIn('PRIVATE_DOCUMENT',response.get_data(as_text=True),module)

    def test_all_auth_and_database_pages_are_used_for_filters_and_totals(self):
        self.login();original=self.tables['store_products'].rows[0]
        self.tables['store_products'].rows=[{**original,'id':str(uuid4()),'name':f'Phone {index}'} for index in range(502)]
        response=self.get('products','?q=Phone+501').json
        self.assertEqual(response['total'],1)
        self.assertEqual(response['summary'][0]['value'],502)
        self.assertEqual(len(self.get('products','?page=2').json['items']),20)
        self.users.extend([Obj(id=str(uuid4()),email=f'user{index}@example.test',app_metadata={},user_metadata={},created_at='2026-10-01') for index in range(102)])
        self.assertEqual(self.get('customers').json['total'],103)

    def test_csv_exports_all_filtered_records_and_neutralizes_formulas(self):
        self.login();product=self.tables['store_products'].rows[0];product['name']='=HYPERLINK("example")'
        response=self.get('products','?format=csv')
        self.assertEqual(response.status_code,200)
        self.assertIn("'=HYPERLINK",response.get_data(as_text=True))
        self.assertIn('text/csv',response.content_type)
        self.assertNotIn('details',response.get_data(as_text=True))

    def test_filters_dates_missing_tables_and_unknown_records(self):
        self.login()
        for query in ('?page=0','?page=bad','?since=not-a-date','?since=2026-10-05&until=2026-10-01'):
            self.assertEqual(self.get('products',query).status_code,400)
        self.assertEqual(self.get('products','?since=2026-10-03').json['total'],0)
        self.assertEqual(self.get('applications','?store='+str(uuid4())).json['total'],0)
        self.assertEqual(self.get('products','?id=missing').status_code,404)
        self.assertEqual(self.get('unknown').status_code,404)
        self.tables['store_products'].error='PGRST205'
        self.assertEqual(self.get('products').status_code,503)

    def test_remittance_requires_confirmation_and_uses_trusted_actor(self):
        self.login();payload=dict(agentId=self.agent,paymentIds=[self.payment],requestId=str(uuid4()),expectedTotal=200,method='Cash',reason='Cash received',confirmedReceived=True,actor='forged')
        endpoint='/api/auth/admin/agent-settlements'
        self.assertEqual(self.http.post(endpoint,json={**payload,'confirmedReceived':False}).status_code,400)
        self.client.rpc.assert_not_called()
        self.assertEqual(self.http.post(endpoint,json=payload).status_code,200)
        self.assertEqual(self.client.rpc.call_args.args[1]['p_actor'],'admin@example.test')
        self.assertEqual(self.http.post(endpoint,json=payload,headers={'Origin':'https://elsewhere.example'}).status_code,403)

    def test_missing_settlement_tables_keep_existing_records_without_inventing_balances(self):
        self.login();self.tables['agent_settlements'].error='PGRST205';self.tables['agent_settlement_items'].error='PGRST205'
        for module in ('agent-settlements','transactions','audit-logs'):
            response=self.get(module)
            self.assertEqual(response.status_code,200)
            self.assertTrue(response.json['warnings'])
            self.assertIsNone(response.json['summary'][-1]['value'])
        row=self.get('agent-settlements').json['items'][0]
        self.assertEqual(row['receipts'],1)
        self.assertIsNone(row['unsettled'])
        self.assertEqual(self.get('transactions').json['total'],2)
        self.assertEqual(self.get('audit-logs').json['total'],2)


if __name__=='__main__': unittest.main()
