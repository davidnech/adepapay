import unittest
from copy import deepcopy
from types import SimpleNamespace as Obj
from uuid import uuid4
from backend import test_customer_applications
from backend.test_store_products import Query


class InboxQuery(Query):
    def upsert(self, values, **kwargs):
        self.values=values; self.action='upsert'; return self

    def execute(self):
        if self.action=='upsert':
            for value in self.values:
                key=tuple(value[field] for field in ('store_id','user_id','notification_key'))
                row=next((row for row in self.database.rows if tuple(row[field] for field in ('store_id','user_id','notification_key'))==key),None)
                if row is None: self.database.rows.append(deepcopy(value))
            return Obj(data=deepcopy(self.values))
        return super().execute()


class StoreInsightsTests(unittest.TestCase):
    record=test_customer_applications.CustomerApplicationsTests.record

    def setUp(self):
        test_customer_applications.CustomerApplicationsTests.setUp(self)
        self.service.auth.get_user.return_value=Obj(user=self.store)
        for name in ('store_field_agents','store_notification_reads','support_tickets','support_messages'):
            self.databases[name]=Obj(rows=[],error=None,race=False)
        self.admin.table.side_effect=lambda name:InboxQuery(self.databases[name])
        self.databases['store_products'].rows[0]['updated_at']='2026-10-09T11:00:00Z'
        self.agent=dict(id=str(uuid4()),store_id=self.store.id,email='agent@example.test',status='Active',revision=1,
            created_at='2026-10-01T00:00:00Z',updated_at='2026-10-09T00:00:00Z',
            profile={'fullName':'Kojo','region':'Ashanti','area':'Kumasi','ghanaCard':'PRIVATE-DOCUMENT','guarantorPhone':'PRIVATE-DOCUMENT'})
        self.databases['store_field_agents'].rows=[self.agent]

    def event(self, row, store_id=None):
        event=dict(id=str(uuid4()),application_id=row['id'],store_id=store_id or self.store.id,
            customer_id=row['customer_id'],event='Submitted',message='New customer application',created_at='2026-10-09T10:00:00Z')
        self.databases['application_events'].rows.append(event)
        return event

    def test_reports_cover_store_operations_and_filter_period(self):
        first=self.record(status='Approved',paid=100)
        self.record(status='Cancelled',created_at='2026-09-01T00:00:00Z')
        self.record(store_id='other-store',customer_id='other-customer',paid=10000)
        self.databases['application_payments'].rows=[dict(id='payment',store_id=self.store.id,created_at='2026-10-09T12:00:00Z',amount=100,method='Cash'),
            dict(id='old-payment',store_id=self.store.id,created_at='2026-09-01T12:00:00Z',amount=40,method='Mobile Money'),
            dict(id='other-payment',store_id='other-store',created_at='2026-10-09T12:00:00Z',amount=999,method='Cash')]
        self.databases['store_field_agents'].rows.append({**self.agent,'id':'other-agent','store_id':'other-store'})
        response=self.http.get('/api/auth/store/reports?since=2026-10-01&until=2026-10-10')
        self.assertEqual(response.status_code,200)
        summary=response.json['summary']
        for key,value in dict(customers=1,agents=1,activeAgents=1,products=1,stockUnits=2,applications=1,
            activePlans=1,outstanding=900,confirmedPayments=100,paymentCount=1).items():
            self.assertEqual(summary[key],value,key)
        self.assertEqual(response.json['customers'][0]['applications'],2)
        self.assertNotIn('PRIVATE-DOCUMENT',response.get_data(as_text=True))
        self.assertNotIn('ghanaCard',response.get_data(as_text=True))
        self.assertEqual(self.http.get('/api/auth/store/reports').json['summary']['confirmedPayments'],140)
        for query in ('since=bad','since=2026-10-10&until=2026-10-01'):
            self.assertEqual(self.http.get('/api/auth/store/reports?'+query).status_code,400)

    def test_notifications_are_scoped_and_reads_persist_per_member(self):
        row=self.record(); event=self.event(row); self.event(row,'other-store')
        inbox=self.http.get('/api/auth/store/notifications')
        self.assertEqual(inbox.status_code,200)
        self.assertEqual(inbox.json['unread'],3)
        self.assertEqual({row['category'] for row in inbox.json['items']},{'Applications','Stock','Agents'})
        key='event:'+event['id']
        response=self.http.post('/api/auth/store/notifications',json={'action':'read','ids':[key],'user_id':'forged','store_id':'forged'})
        self.assertEqual(response.status_code,200)
        saved=self.databases['store_notification_reads'].rows[0]
        self.assertEqual(saved['user_id'],self.store.id)
        self.assertEqual(saved['store_id'],self.store.id)
        self.assertEqual(self.http.get('/api/auth/store/notifications').json['unread'],2)
        self.assertEqual(self.http.post('/api/auth/store/notifications',json={'action':'read','ids':['event:other-store']}).status_code,400)
        self.assertEqual(self.http.post('/api/auth/store/notifications',json={'action':'read_all'}).status_code,200)
        self.assertEqual(self.http.get('/api/auth/store/notifications').json['unread'],0)
        staff=Obj(id=str(uuid4()),app_metadata={'store_staff':{'store_id':self.store.id,'status':'Active','permissions':['notifications']}})
        self.service.auth.get_user.return_value=Obj(user=staff)
        self.assertEqual(self.http.get('/api/auth/store/notifications').json['unread'],3,'staff member has independent read state')

    def test_permissions_customer_and_missing_schema(self):
        self.service.auth.get_user.return_value=Obj(user=self.customer)
        self.assertEqual(self.http.get('/api/auth/store/reports').status_code,403)
        self.assertEqual(self.http.get('/api/auth/store/notifications').status_code,403)
        staff=Obj(id=str(uuid4()),app_metadata={'store_staff':{'store_id':self.store.id,'status':'Active','permissions':['reports']}})
        self.service.auth.get_user.return_value=Obj(user=staff)
        self.assertEqual(self.http.get('/api/auth/store/reports').status_code,200)
        self.assertEqual(self.http.get('/api/auth/store/notifications').status_code,403)
        self.service.auth.get_user.return_value=Obj(user=self.store)
        self.databases['store_notification_reads'].error='PGRST205'
        response=self.http.get('/api/auth/store/notifications')
        self.assertEqual(response.status_code,503)
        self.assertIn('012_store_notifications.sql',response.json['error'])

    def test_disabled_staff_and_cross_origin_reads_are_blocked(self):
        staff=Obj(id=str(uuid4()),app_metadata={'store_staff':{'store_id':self.store.id,'status':'Disabled','permissions':['reports','notifications']}})
        self.service.auth.get_user.return_value=Obj(user=staff)
        self.assertEqual(self.http.get('/api/auth/store/reports').status_code,401)
        self.assertEqual(self.http.get('/api/auth/store/notifications').status_code,401)
        self.service.auth.get_user.return_value=Obj(user=self.store)
        self.assertEqual(self.http.post('/api/auth/store/notifications',json={'action':'read_all'},headers={'Origin':'https://other.example'}).status_code,403)

    def test_new_stock_update_becomes_unread_without_reopening_old_alert(self):
        self.http.post('/api/auth/store/notifications',json={'action':'read_all'})
        self.assertEqual(self.http.get('/api/auth/store/notifications').json['unread'],0)
        self.databases['store_products'].rows[0]['revision']=2
        self.databases['store_products'].rows[0]['stock']=0
        inbox=self.http.get('/api/auth/store/notifications').json
        self.assertEqual(inbox['unread'],1)
        self.assertEqual(next(row for row in inbox['items'] if not row['read'])['title'],'Out of stock')

    def test_saved_preferences_control_payment_application_and_stock_alerts(self):
        row=self.record(); event=self.event(row)
        self.databases['application_events'].rows.append(dict(event,id=str(uuid4()),event='payment',message='Payment received'))
        self.store.app_metadata['store_settings']={'Notifications':{'applicationAlerts':False,'paymentAlerts':True,'stockAlerts':True},'Inventory':{'lowStockThreshold':1}}
        data=self.http.get('/api/auth/store/notifications').json
        self.assertEqual({entry['category'] for entry in data['items']},{'Agents','Payments'})
        self.assertEqual(next(entry for entry in data['items'] if entry['category']=='Payments')['target'],'payments')
        self.store.app_metadata['store_settings']['Notifications']['paymentAlerts']=False
        self.assertNotIn('Payments',{entry['category'] for entry in self.http.get('/api/auth/store/notifications').json['items']})

    def test_support_replies_belong_to_the_member_and_blocked_targets_are_hidden(self):
        ticket=str(uuid4())
        self.databases['support_tickets'].rows=[dict(id=ticket,user_id=self.store.id,subject='My request',created_at='2026-10-10T00:00:00Z')]
        self.databases['support_messages'].rows=[dict(id=str(uuid4()),ticket_id=ticket,sender='Admin',body='Private owner reply',created_at='2026-10-10T01:00:00Z')]
        data=self.http.get('/api/auth/store/notifications').json
        self.assertEqual(next(entry for entry in data['items'] if entry['category']=='Support')['record'],ticket)
        staff=Obj(id=str(uuid4()),app_metadata={'role':'Store Manager','store_staff':dict(store_id=self.store.id,status='Active',permissions=['notifications'])})
        self.service.auth.get_user.return_value=Obj(user=staff)
        data=self.http.get('/api/auth/store/notifications').json
        self.assertNotIn('Private owner reply',str(data))
        self.assertTrue(all(entry['target'] is None for entry in data['items']))

if __name__=='__main__': unittest.main()
