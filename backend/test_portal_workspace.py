"""Verify account/store boundaries and persisted inbox markers."""
import unittest
from copy import deepcopy
from types import SimpleNamespace as Obj
from unittest.mock import patch
from uuid import uuid4
from backend import test_customer_applications
from backend.test_store_products import Query


class InboxQuery(Query):
    def upsert(self,values,**kwargs):
        self.values=values; self.action='upsert'; return self
    def execute(self):
        if self.action=='upsert':
            for value in self.values:
                key='user_id' if 'user_id' in value else 'actor'
                if not any(row[key]==value[key] and row['notification_key']==value['notification_key'] for row in self.database.rows):
                    self.database.rows.append(dict(value,id=str(uuid4()),created_at='2026-10-10T00:00:00Z'))
            return Obj(data=deepcopy(self.values))
        return super().execute()


class PortalWorkspaceTests(unittest.TestCase):
    record=test_customer_applications.CustomerApplicationsTests.record
    def setUp(self):
        test_customer_applications.CustomerApplicationsTests.setUp(self)
        for name in ('customer_notification_reads','admin_notification_reads','support_tickets','support_messages','store_categories','store_trade_inventory','store_field_agents','agent_settlements','agent_settlement_items'):
            self.databases[name]=Obj(rows=[],error=None,race=False)
        self.admin.table.side_effect=lambda name:InboxQuery(self.databases[name])
        self.admin.auth.admin.list_users.return_value=[]
        catalogue=([dict(id=self.store.id,name='Published Shop',region='Greater Accra',city='Accra',description='Electronics',categories=['Phones'])],
            [dict(id=self.product['id'],name='Published Phone',storeName='Published Shop',category='Phones',condition='New',description='Smart device',currentPrice=1000,prices={'swap':950})])
        patcher=patch('backend.portal_workspace.snapshot',return_value=catalogue);patcher.start();self.addCleanup(patcher.stop)
        self.row=self.record(reference='APP-OWN',snapshot={'productName':'Saved handset','storeName':'Own Store'})
        self.record(customer_id='another-customer',store_id='another-store',reference='APP-PRIVATE',details={'fullName':'Secret person','phone':'PRIVATE-PHONE','documents':{}},snapshot={'productName':'Private handset'})
        self.event=dict(id=str(uuid4()),application_id=self.row['id'],customer_id=self.customer.id,store_id=self.store.id,event='Approved',message='Approved by store',created_at='2026-10-10T00:00:00Z')
        self.databases['application_events'].rows=[self.event,dict(self.event,id=str(uuid4()),application_id='other-application',customer_id='another-customer',store_id='another-store',message='PRIVATE-MESSAGE')]
        self.ticket=dict(id=str(uuid4()),user_id=self.customer.id,subject='My request',category='Payments',status='Open',created_at='2026-10-10T00:00:00Z')
        self.databases['support_tickets'].rows=[self.ticket,dict(self.ticket,id='other-ticket',user_id='another-customer',subject='PRIVATE-SUPPORT')]
        self.databases['support_messages'].rows=[dict(id=str(uuid4()),ticket_id=self.ticket['id'],sender='Admin',body='Receipt investigation',created_at='2026-10-10T01:00:00Z'),dict(id='other-message',ticket_id='other-ticket',sender='Admin',body='PRIVATE-REPLY',created_at='2026-10-10T01:00:00Z')]

    def get(self,path): return self.http.get('/api/auth/'+path)
    def test_endpoints_require_authentication_and_role(self):
        for path in ('store/search?q=saved','store/agent-accounts'):
            self.assertEqual(self.get(path).status_code,403)
        self.service.auth.get_user.return_value=Obj(user=self.store)
        self.assertEqual(self.get('customer/search?q=saved').status_code,403)
        self.assertEqual(self.get('customer/notifications').status_code,403)
        self.http.delete_cookie('adepa_access',path='/api/auth')
        for path in ('customer/search?q=saved','store/search?q=saved','customer/notifications','store/agent-accounts'):
            self.assertEqual(self.get(path).status_code,401)

    def test_customer_search_only_own_and_published_records(self):
        result=self.get('customer/search?q=saved')
        self.assertEqual(result.status_code,200,result.json)
        self.assertEqual(result.json['items'][0]['id'],self.row['id'])
        for text in ('private','Secret person','PRIVATE-PHONE'):
            self.assertEqual(self.get('customer/search?q='+text.replace(' ','%20')).json['total'],0)
        self.assertEqual(self.get('customer/search?q=Published').json['total'],2)
        self.assertEqual(self.get('customer/search?q=investigation').json['items'][0]['id'],self.ticket['id'])

    def test_store_search_enforces_scope_subscription_and_staff_pages(self):
        self.service.auth.get_user.return_value=Obj(user=self.store)
        self.assertEqual(self.get('store/search?q=saved').json['items'][0]['id'],self.row['id'])
        self.assertEqual(self.get('store/search?q=private').json['total'],0)
        staff=Obj(id=str(uuid4()),app_metadata={'role':'Store Manager','store_staff':dict(store_id=self.store.id,status='Active',permissions=['products'])})
        self.service.auth.get_user.return_value=Obj(user=staff)
        self.assertEqual(self.get('store/search?q=saved').json['total'],0)
        self.assertEqual(self.get('store/search?q=Phone').json['items'][0]['id'],self.product['id'])
        self.assertEqual(self.get('store/agent-accounts').status_code,403)
        self.store.app_metadata['store_review']['status']='Suspended'
        self.assertEqual(self.get('store/search?q=Phone').status_code,401)

    def test_customer_notifications_links_and_user_read_scope(self):
        data=self.get('customer/notifications').json
        self.assertEqual(data['unread'],2)
        self.assertNotIn('PRIVATE',str(data))
        self.assertEqual({row['target'] for row in data['items']},{'support','my-applications'})
        key=data['items'][0]['id']
        self.databases['customer_notification_reads'].rows=[dict(id='other-marker',user_id='another-customer',notification_key=key,created_at='2026-10-10T00:00:00Z')]
        self.assertEqual(self.get('customer/notifications').json['unread'],2)
        result=self.http.post('/api/auth/customer/notifications',json=dict(action='read',ids=[key],user_id='forged'))
        self.assertEqual(result.status_code,200)
        self.assertEqual(self.get('customer/notifications').json['unread'],1)
        self.assertEqual(self.databases['customer_notification_reads'].rows[-1]['user_id'],self.customer.id)
        self.assertEqual(self.http.post('/api/auth/customer/notifications',json=dict(action='read',ids=['forged'])).status_code,400)
        self.assertEqual(self.http.post('/api/auth/customer/notifications',json=dict(action='read_all')).status_code,200)
        self.assertEqual(self.get('customer/notifications').json['unread'],0)

    def test_missing_dedicated_table_uses_isolated_legacy_namespace(self):
        self.databases['customer_notification_reads'].error='PGRST205'
        key='event:'+self.event['id']
        self.databases['admin_notification_reads'].rows=[dict(actor='customer:another-customer',notification_key=key),dict(actor='admin@example.test',notification_key=key)]
        self.assertEqual(self.get('customer/notifications').json['unread'],2)
        result=self.http.post('/api/auth/customer/notifications',json=dict(action='read',ids=[key]))
        self.assertEqual(result.status_code,200)
        self.assertEqual(self.get('customer/notifications').json['unread'],1)
        self.assertEqual(self.databases['admin_notification_reads'].rows[-1]['actor'],'customer:'+self.customer.id)

    def test_missing_both_tables_returns_setup_error(self):
        self.databases['customer_notification_reads'].error='PGRST205'
        self.databases['admin_notification_reads'].error='PGRST205'
        result=self.get('customer/notifications')
        self.assertEqual(result.status_code,503)

    def test_payments_search_references_without_cross_customer_leak(self):
        payment=dict(id=str(uuid4()),application_id=self.row['id'],customer_id=self.customer.id,store_id=self.store.id,reference='RECEIPT-SAVED',method='Cash',amount=20,created_at='2026-10-10T00:00:00Z')
        self.databases['application_payments'].rows=[payment,dict(payment,id='other-payment',customer_id='another-customer',store_id='another-store',reference='PRIVATE-RECEIPT')]
        result=self.get('customer/search?q=RECEIPT-SAVED').json
        self.assertEqual(result['items'][0]['page'],'payment-history');self.assertEqual(result['items'][0]['id'],self.row['id'])
        self.assertEqual(self.get('customer/search?q=PRIVATE-RECEIPT').json['total'],0)

    def test_search_paginates_all_owned_rows_and_rejects_invalid_input(self):
        for index in range(510): self.record(reference=f'APP-BATCH-{index}')
        result=self.get('customer/search?q=APP-BATCH&page=26').json
        self.assertEqual(result['total'],510);self.assertEqual(len(result['items']),10)
        for suffix in ('q=a','q=saved&page=0','q=saved&page=wrong','q='+('a'*201)):
            self.assertEqual(self.get('customer/search?'+suffix).status_code,400)

    def test_store_product_detail_cannot_open_other_store_product(self):
        self.service.auth.get_user.return_value=Obj(user=self.store)
        self.assertEqual(self.get('store/products?record='+self.product['id']).status_code,200)
        other=dict(self.product,id=str(uuid4()),store_id='another-store');self.databases['store_products'].rows.append(other)
        self.assertEqual(self.get('store/products?record='+other['id']).status_code,404)

    def test_agent_ledger_uses_actual_receipts_and_scoped_settlements(self):
        self.service.auth.get_user.return_value=Obj(user=self.store)
        agent=dict(id=str(uuid4()),store_id=self.store.id,profile={'fullName':'Saved Agent','ghanaCard':'PRIVATE-DOCUMENT'},email='agent@test.example',status='Active',created_at='2026-10-10T00:00:00Z')
        self.databases['store_field_agents'].rows=[agent,dict(agent,id='other-agent',store_id='another-store')]
        payment=dict(id=str(uuid4()),store_id=self.store.id,recorded_by=agent['id'],reference='Receipt A',amount=40,method='Cash',created_at='2026-10-10T00:00:00Z')
        self.databases['application_payments'].rows=[payment,dict(payment,id='unsettled',amount=15),dict(payment,id='other-store',store_id='another-store',amount=999)]
        settlement=dict(id=str(uuid4()),store_id=self.store.id,agent_id=agent['id'],reference='Saved remittance',amount=40,method='Cash',created_at='2026-10-10T00:00:00Z')
        self.databases['agent_settlements'].rows=[settlement]
        self.databases['agent_settlement_items'].rows=[dict(id=str(uuid4()),settlement_id=settlement['id'],payment_id=payment['id'],created_at='2026-10-10T00:00:00Z')]
        result=self.get('store/agent-accounts')
        self.assertEqual(result.status_code,200,result.json)
        self.assertEqual(len(result.json['items']),1)
        self.assertEqual(result.json['items'][0]['collected'],55)
        self.assertEqual(result.json['items'][0]['unsettled'],15)
        self.assertNotIn('PRIVATE-DOCUMENT',result.get_data(as_text=True))


if __name__=='__main__': unittest.main()
