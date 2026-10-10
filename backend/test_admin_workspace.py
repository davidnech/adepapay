import unittest
from copy import deepcopy
from types import SimpleNamespace as Obj
from uuid import uuid4
from backend import test_admin_platform


class AdminWorkspaceTests(unittest.TestCase):
    def setUp(self):
        test_admin_platform.PlatformTests.setUp(self)
        self.plan=str(uuid4())
        self.tables['subscription_plans']=Obj(rows=[dict(id=self.plan,name='Saved Plan',enabled=True,amount_minor=5000,duration_days=30)],error=None,race=False)
        self.client.auth.admin.get_user_by_id.return_value=Obj(user=self.users[0])

    login=test_admin_platform.PlatformTests.login

    def test_admin_account_without_role_is_excluded_from_dashboard_and_reports(self):
        administrator=deepcopy(self.users[1]);administrator.id=str(uuid4());administrator.email='admin@example.test';administrator.app_metadata={}
        self.users.append(administrator);self.login()
        self.assertEqual(self.http.get('/api/auth/admin/dashboard').json['totals']['customers'],1)
        self.assertEqual(self.http.get('/api/auth/admin/reports').json['registeredCustomersAllTime'],1)

    def test_workspace_endpoints_require_verified_admin(self):
        for path in ('dashboard','search?q=phone','status'):
            self.assertEqual(self.http.get('/api/auth/admin/'+path).status_code,403)
        with self.http.session_transaction() as session: session['role']='Admin'
        self.assertEqual(self.http.get('/api/auth/admin/search?q=phone').status_code,403)
        self.client.auth.admin.list_users.assert_not_called()

    def test_dashboard_uses_customer_store_application_payment_records(self):
        self.login();response=self.http.get('/api/auth/admin/dashboard')
        self.assertEqual(response.status_code,200);data=response.json
        self.assertEqual(data['totals']['customers'],1);self.assertEqual(data['totals']['stores'],1);self.assertEqual(data['totals']['activeStores'],1)
        self.assertEqual(data['totals']['products'],1);self.assertEqual(data['totals']['agents'],1);self.assertEqual(data['totals']['applications'],1)
        self.assertEqual(data['totals']['customerPayments'],200);self.assertEqual(data['totals']['outstanding'],1200)
        self.assertEqual(data['attention'][2]['count'],2);self.assertEqual(data['attention'][3]['count'],1)
        self.assertEqual(data['recentApplications'][0]['id'],self.application)
        self.assertEqual(data['recentStores'][0]['name'],'Current Store')
        self.assertNotIn('PRIVATE_DOCUMENT',response.get_data(as_text=True))

    def test_dashboard_missing_optional_tables_is_explicit(self):
        self.login()
        for table in ('platform_settings','platform_admin_events','support_tickets','agent_settlements'): self.tables[table].error='PGRST205'
        data=self.http.get('/api/auth/admin/dashboard').json
        self.assertIsNone(data['attention'][2]['count']);self.assertTrue(data['warnings'])
        self.assertEqual(data['totals']['customerPayments'],200)

    def test_search_matches_real_records_and_returns_working_detail_targets(self):
        self.login();response=self.http.get('/api/auth/admin/search?q=Stored%20Phone')
        self.assertEqual(response.status_code,200);data=response.json
        self.assertEqual(data['total'],2)
        self.assertEqual({row['page'] for row in data['items']},{'products','applications'})
        self.assertNotIn('PRIVATE_DOCUMENT',response.get_data(as_text=True))
        for row in data['items']:
            self.assertEqual(self.http.get('/api/auth/admin/operations/'+row['page']+'?id='+row['id']).status_code,200)
        support=self.http.get('/api/auth/admin/search?q=Payment%20question').json
        self.assertEqual(support['items'][0]['page'],'support');self.assertEqual(support['items'][0]['id'],self.ticket)
        self.assertEqual(self.http.get('/api/auth/admin/support/'+support['items'][0]['id']).status_code,200)
        plans=self.http.get('/api/auth/admin/search?q=Saved%20Plan&scope=subscriptions').json
        self.assertEqual(plans['items'][0]['id'],self.plan)

    def test_search_filters_paginate_complete_tables_and_rejects_invalid_input(self):
        self.login();template=deepcopy(self.tables['store_products'].rows[0])
        self.tables['store_products'].rows=[dict(template,id=str(uuid4()),sku='SKU-'+str(index),name='Phone '+str(index)) for index in range(502)]
        self.tables['store_products'].rows[-1]['name']='Needle last product'
        result=self.http.get('/api/auth/admin/search?q=Needle&scope=products').json
        self.assertEqual(result['total'],1);self.assertEqual(result['items'][0]['id'],self.tables['store_products'].rows[-1]['id'])
        result=self.http.get('/api/auth/admin/search?q=Phone&scope=products&page=2').json
        self.assertEqual(result['total'],502);self.assertEqual(len(result['items']),20);self.assertEqual(result['page'],2)
        for query in ('q=x','q='+('x'*201),'q=phone&scope=unknown','q=phone&page=0'):
            self.assertEqual(self.http.get('/api/auth/admin/search?'+query).status_code,400)

    def test_search_missing_support_uses_existing_sources_with_notice(self):
        self.login();self.tables['support_tickets'].error='PGRST205'
        response=self.http.get('/api/auth/admin/search?q=Phone')
        self.assertEqual(response.status_code,200);self.assertEqual(response.json['total'],3);self.assertTrue(response.json['warnings'])

    def test_database_status_reports_real_readiness_without_private_data(self):
        self.login();self.assertTrue(self.http.get('/api/auth/admin/status').json['setupComplete'])
        self.tables['support_tickets'].error='PGRST205'
        response=self.http.get('/api/auth/admin/status');self.assertTrue(response.json['databaseConnected']);self.assertFalse(response.json['setupComplete'])
        self.assertFalse(next(row for row in response.json['services'] if row['name']=='Support')['ready'])
        self.assertNotIn('PRIVATE_DOCUMENT',response.get_data(as_text=True))

    def test_approval_filters_cover_all_auth_pages_and_details_are_private(self):
        self.login();self.users.extend([Obj(id=str(uuid4()),email='filler@example.test',app_metadata={},user_metadata={}) for _ in range(101)])
        last=deepcopy(self.users[0]);last.id=str(uuid4());last.app_metadata['store_profile']['storeName']='Different profile';last.app_metadata['store_review']['application']['storeName']='Needle application'
        self.users.append(last)
        data=self.http.get('/api/auth/admin/stores?scope=all&q=Needle').json
        self.assertEqual(data['total'],1);self.assertEqual(data['applications'][0]['id'],last.id)
        detail=self.http.get('/api/auth/admin/stores/'+self.store)
        self.assertEqual(detail.status_code,200);self.assertNotIn('PRIVATE_DOCUMENT',detail.get_data(as_text=True))
        self.assertEqual(self.http.get('/api/auth/admin/stores/invalid').status_code,400)
        self.assertEqual(self.http.get('/api/auth/admin/stores?scope=all&status=Fake').status_code,400)

    def test_notifications_link_to_the_actual_target_record(self):
        self.login();data=self.http.get('/api/auth/admin/notifications').json
        for row in data['items']:
            if row['target']=='support': response=self.http.get('/api/auth/admin/support/'+row['record'])
            elif row['target']=='store-approvals': response=self.http.get('/api/auth/admin/stores/'+row['record'])
            else: response=self.http.get('/api/auth/admin/operations/'+row['target']+'?id='+row['record'])
            self.assertEqual(response.status_code,200,row)
