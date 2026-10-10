"""API authorization, private support ownership, report scopes and real inbox sources."""
import unittest
from copy import deepcopy
from types import SimpleNamespace as Obj
from unittest.mock import Mock, patch
from uuid import uuid4
from backend.app import app
from backend.admin_platform import DEFAULTS
from backend import test_admin_operations
from backend.test_store_products import Query


class PlatformTests(unittest.TestCase):
    # Reuse the realistic store/customer/receipt fixture, not the inherited tests.
    def setUp(self):
        test_admin_operations.AdminOperationsTests.setUp(self)
        self.db=Mock(); self.db.auth.get_user.return_value=Obj(user=self.users[1])
        patcher=patch('backend.app.connect_db',return_value=self.db);patcher.start();self.addCleanup(patcher.stop)
        self.ticket=str(uuid4()); self.other=str(uuid4())
        self.tables.update({key:Obj(rows=[],error=None,race=False) for key in ('platform_settings','support_tickets','support_messages','admin_notification_reads')})
        self.config=dict(id=True,values=deepcopy(DEFAULTS),revision=2,updated_at='2026-10-04T00:00:00Z',updated_by='admin@example.test')
        self.tables['platform_settings'].rows=[self.config]
        ticket=dict(id=self.ticket,user_id=self.customer,email='customer@example.test',name='Ama',role='Customer',subject='Payment question',category='Payments',status='Open',revision=1,created_at='2026-10-03T00:00:00Z',updated_at='2026-10-03T00:00:00Z')
        self.tables['support_tickets'].rows=[ticket,dict(ticket,id=self.other,user_id=str(uuid4()),email='other@example.test',subject='Private other request')]
        self.tables['support_messages'].rows=[dict(id=self.ticket,ticket_id=self.ticket,sender='User',actor='customer@example.test',body='Please check receipt',created_at='2026-10-03T00:00:00Z'),dict(id=str(uuid4()),ticket_id=self.other,sender='User',actor='other@example.test',body='Other private body',created_at='2026-10-03T00:00:00Z')]
        for table in ('store_products','store_field_agents'):
            for row in self.tables[table].rows: row.update(revision=1,updated_at='2026-10-04T00:00:00Z')
        self.client.rpc.return_value.execute.return_value=Obj(data=deepcopy(self.config))

    def login(self):
        self.assertEqual(self.http.post('/api/auth/login',json={'email':'admin@example.test','password':'pass'}).status_code,200)

    def user_login(self): self.http.set_cookie('adepa_access','verified-customer-token')

    def test_platform_admin_routes_require_verified_session(self):
        for page in ('settings','support','notifications','reports'):
            self.assertEqual(self.http.get('/api/auth/admin/'+page).status_code,403)
        self.assertEqual(self.http.post('/api/auth/admin/settings',json={}).status_code,403)
        self.assertEqual(self.http.get('/api/auth/support').status_code,401)

    def test_settings_validation_revision_and_server_actor(self):
        self.login(); response=self.http.get('/api/auth/admin/settings')
        self.assertEqual(response.status_code,200);self.assertEqual(response.json['settings']['revision'],2)
        for values in ({},dict(DEFAULTS,reportDays=31),dict(DEFAULTS,notifySupport='true'),dict(DEFAULTS,lowStockThreshold=True),dict(DEFAULTS,supportEmail='invalid')):
            self.assertEqual(self.http.post('/api/auth/admin/settings',json=dict(values=values,revision=2)).status_code,400)
        self.assertEqual(self.http.post('/api/auth/admin/settings',json=dict(values=DEFAULTS,revision=True)).status_code,400)
        response=self.http.post('/api/auth/admin/settings',json=dict(values=DEFAULTS,revision=2,actor='forged'))
        self.assertEqual(response.status_code,200)
        self.assertEqual(self.client.rpc.call_args.args[1]['p_actor'],'admin@example.test')

    def test_missing_settings_readable_but_not_claimed_saved(self):
        self.login();self.tables['platform_settings'].error='PGRST205'
        result=self.http.get('/api/auth/admin/settings').json
        self.assertFalse(result['settings']['available']);self.assertIsNone(result['settings']['revision']);self.assertIn('014',result['notice'])

    def test_users_only_receive_their_own_support_and_messages(self):
        self.user_login(); result=self.http.get('/api/auth/support')
        self.assertEqual(result.status_code,200);self.assertEqual(result.json['total'],1)
        self.assertNotIn('other@example.test',result.get_data(as_text=True))
        detail=self.http.get('/api/auth/support/'+self.ticket)
        self.assertEqual(detail.status_code,200);self.assertEqual(detail.json['messages'][0]['body'],'Please check receipt')
        self.assertNotIn('actor',detail.json['messages'][0])
        self.assertEqual(self.http.get('/api/auth/support/'+self.other).status_code,404)
        self.assertEqual(self.http.post('/api/auth/support/'+self.other,json={'body':'Forged'}).status_code,404)

    def test_support_creation_uses_verified_account_and_rejects_forged_role(self):
        self.user_login(); payload=dict(subject='Help with payment',body='Saved receipt question',category='Payments',requestId=str(uuid4()),userId=self.other,role='Admin',email='forged')
        response=self.http.post('/api/auth/support',json=payload)
        self.assertEqual(response.status_code,201);params=self.client.rpc.call_args.args[1]
        self.assertEqual(params['p_user'],self.customer);self.assertEqual(params['p_email'],'customer@example.test');self.assertEqual(params['p_role'],'Customer')
        for change in (dict(category='Fake'),dict(body=''),dict(subject='a'),dict(requestId='invalid')):
            self.assertEqual(self.http.post('/api/auth/support',json=dict(payload,**change)).status_code,400)

    def test_reply_ownership_and_status_permissions(self):
        self.user_login();payload=dict(body='Follow up',revision=1,requestId=str(uuid4()))
        self.assertEqual(self.http.post('/api/auth/support/'+self.ticket,json=dict(payload,status='Resolved')).status_code,403)
        self.assertEqual(self.http.post('/api/auth/support/'+self.ticket,json=payload).status_code,200)
        self.assertEqual(self.client.rpc.call_args.args[1]['p_user'],self.customer)
        self.login();response=self.http.post('/api/auth/admin/support/'+self.ticket,json=dict(payload,status='Resolved',actor='forged'))
        self.assertEqual(response.status_code,200);params=self.client.rpc.call_args.args[1]
        self.assertIsNone(params['p_user']);self.assertEqual(params['p_actor'],'admin@example.test');self.assertEqual(params['p_status'],'Resolved')
        self.assertEqual(self.http.post('/api/auth/admin/support/'+self.ticket,json=dict(payload,revision=True)).status_code,400)

    def test_admin_support_filters_and_summaries(self):
        self.login();data=self.http.get('/api/auth/admin/support?q=Private').json
        self.assertEqual(data['total'],1);self.assertEqual(data['summary'][0]['count'],2)
        self.assertEqual(self.http.get('/api/auth/admin/support?status=Closed').json['total'],0)
        self.assertEqual(self.http.get('/api/auth/admin/support?status=Fake').status_code,400)
        self.assertEqual(self.http.get('/api/auth/admin/support/'+self.other).status_code,200)

    def test_notification_sources_preferences_and_persisted_actor_reads(self):
        self.login();data=self.http.get('/api/auth/admin/notifications').json
        self.assertEqual(set(data['categories']),{'Stores','Support','Payments','Applications','Agents','Stock'})
        self.assertTrue(all(row['read'] is False for row in data['items']))
        key=data['items'][0]['id'];self.tables['admin_notification_reads'].rows=[dict(actor='other',notification_key=key),dict(actor='admin@example.test',notification_key=key)]
        result=self.http.get('/api/auth/admin/notifications').json
        self.assertEqual(result['unread'],data['unread']-1)
        self.config['values']['notifySupport']=False
        self.assertNotIn('Support',self.http.get('/api/auth/admin/notifications').json['categories'])
        self.assertEqual(self.http.post('/api/auth/admin/notifications',json=dict(action='read',ids=['forged'])).status_code,400)
        class Reads(Query):
            def upsert(inner,values,**kwargs):
                self.saved_reads=values;return inner
        self.client.table.side_effect=lambda name:Reads(self.tables[name]) if name=='admin_notification_reads' else Query(self.tables[name])
        self.assertEqual(self.http.post('/api/auth/admin/notifications',json=dict(action='read',ids=[key],actor='forged')).status_code,200)
        self.assertEqual(self.saved_reads[0]['actor'],'admin@example.test')

    def test_missing_read_tracking_shows_unavailable_not_false_unread_count(self):
        self.login();self.tables['admin_notification_reads'].error='PGRST205'
        data=self.http.get('/api/auth/admin/notifications').json
        self.assertIsNone(data['unread']);self.assertFalse(data['readTrackingAvailable']);self.assertTrue(data['warnings'])
        self.assertEqual(self.http.post('/api/auth/admin/notifications',json={'action':'read_all'}).status_code,503)

    def test_platform_reports_period_store_scopes_and_financial_units(self):
        self.login();data=self.http.get('/api/auth/admin/reports?since=2026-10-04&until=2026-10-04').json
        self.assertEqual(data['registeredCustomersAllTime'],1);self.assertEqual(data['registeredCustomers'],0)
        self.assertEqual(data['summary']['applications'],0);self.assertEqual(data['summary']['confirmedPayments'],200)
        self.assertEqual(data['subscriptionPayments'],[dict(environment='test',count=1,amount=50)])
        self.assertEqual(data['agentRemittances'],0);self.assertEqual(data['byStore'][0]['outstanding'],1200)
        self.assertNotIn('PRIVATE_DOCUMENT',str(data))
        scoped=self.http.get('/api/auth/admin/reports?store='+str(uuid4())).json
        self.assertEqual(scoped['summary']['confirmedPayments'],0);self.assertEqual(scoped['summary']['products'],0);self.assertIsNone(scoped['registeredCustomersAllTime'])
        self.assertEqual(self.http.get('/api/auth/admin/reports?since=2026-10-05&until=2026-10-04').status_code,400)

    def test_report_missing_optional_ledgers_and_csv(self):
        self.login();self.tables['support_tickets'].error='PGRST205';self.tables['agent_settlements'].error='PGRST205'
        data=self.http.get('/api/auth/admin/reports').json
        self.assertIsNone(data['supportStatuses']);self.assertIsNone(data['agentRemittances']);self.assertEqual(len(data['warnings']),2)
        self.tables['customer_applications'].rows[0]['details']['fullName']='=FORMULA()'
        response=self.http.get('/api/auth/admin/reports?format=csv');self.assertEqual(response.status_code,200)
        self.assertIn("'=FORMULA()",response.get_data(as_text=True));self.assertIn('subscriptionPayments',response.get_data(as_text=True))

    def test_platform_mutations_reject_cross_origin(self):
        self.login()
        self.assertEqual(self.http.post('/api/auth/admin/settings',json={},headers={'Origin':'https://untrusted.example'}).status_code,403)


