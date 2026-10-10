import os
import unittest
from copy import deepcopy
from types import SimpleNamespace as Obj
from unittest.mock import Mock, patch
from postgrest.exceptions import APIError
from backend.app import app, public_user
from backend.store_team import resolve_store, StoreAccessError
from backend.public_catalogue import public_store

STORE = '11111111-1111-4111-8111-111111111111'


class Query:
    def __init__(self, rows): self.rows = rows
    def select(self, value): return self
    def eq(self, key, value):
        self.rows = [row for row in self.rows if row.get(key) == value]
        return self
    def order(self, value): return self
    def range(self, start, end): self.rows = self.rows[start:end+1]; return self
    def execute(self): return Obj(data=deepcopy(self.rows))


class AdminStoreTests(unittest.TestCase):
    def setUp(self):
        self.http = app.test_client()
        self.client = Mock()
        self.user = Obj(id=STORE, email='store@example.test', created_at='2026-10-01', user_metadata={}, app_metadata={
            'role':'Store Manager', 'store_id':STORE, 'store_review':{'status':'Approved','application':{'storeName':'Test Store','categories':[]}}})
        self.client.auth.admin.get_user_by_id.return_value = Obj(user=self.user)
        self.client.auth.admin.list_users.return_value = [self.user]
        self.tables = {'store_products':[], 'customer_applications':[], 'store_field_agents':[], 'purchase_ratings':[], 'store_admin_events':[], 'deleted_store_products':[]}
        self.client.table.side_effect = lambda name: Query(self.tables[name])
        self.client.rpc.return_value.execute.return_value = Obj(data={'status':'Suspended','revision':1})
        for patcher in (patch.dict(app.config, TESTING=True, SECRET_KEY='test-secret'),
                        patch.dict(os.environ, ADMIN_EMAIL='admin@example.test',ADMIN_PASSWORD='pass'),
                        patch('backend.app.connect_admin',return_value=self.client)):
            patcher.start(); self.addCleanup(patcher.stop)

    def login(self): self.http.post('/api/auth/login',json={'email':'admin@example.test','password':'pass'})
    def get(self): return self.http.get('/api/auth/admin/store-directory/'+STORE)
    def action(self, **values):
        return self.http.post('/api/auth/admin/store-directory/'+STORE+'/action',json={
            'action':'suspend','reason':'Admin review','revision':0,'status':'Approved',**values})

    def test_profiles_and_actions_are_admin_only(self):
        self.assertEqual(self.get().status_code,403)
        self.assertEqual(self.action().status_code,403)
        self.client.auth.admin.get_user_by_id.assert_not_called()
        self.client.rpc.assert_not_called()

    def test_live_aggregates_scope_pagination_and_private_fields(self):
        self.login()
        self.tables['store_products'] = [dict(id=str(i),store_id=STORE) for i in range(502)]+[dict(id='other',store_id='other')]
        self.tables['customer_applications'] = [dict(id=str(i),store_id=STORE,customer_id='customer',paid=20,total=100,status='Approved',
            details={'fullName':'Ama','email':'ama@example.test','phone':'0241234567','ghanaCard':'PRIVATE','documents':{'identity':'PRIVATE'}}) for i in range(2)]
        self.tables['store_field_agents'] = [dict(id='agent',store_id=STORE,email='agent@example.test',status='Active',profile={'fullName':'Kojo','password':'PRIVATE','ghanaCard':'PRIVATE'})]
        self.tables['purchase_ratings'] = [dict(application_id='1',store_id=STORE,store_score=4),dict(application_id='2',store_id=STORE,store_score=5)]
        response = self.get()
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json['summary']['products'],502)
        self.assertEqual(response.json['summary']['customers'],1)
        self.assertEqual(response.json['summary']['rating'],4.5)
        self.assertEqual(response.json['summary']['agents'],1)
        self.assertEqual(response.json['customers'][0]['outstanding'],160)
        self.assertNotIn('PRIVATE',response.get_data(as_text=True))
        self.assertIn('no-store',response.headers['Cache-Control'])

    def test_missing_section_is_unavailable_not_zero(self):
        self.login()
        def table(name):
            if name=='purchase_ratings': raise APIError({'code':'PGRST205','message':'Missing','details':None,'hint':None})
            return Query(self.tables[name])
        self.client.table.side_effect=table
        result=self.get().json
        self.assertIsNone(result['ratings'])
        self.assertIsNone(result['summary']['ratingCount'])
        self.assertEqual(result['summary']['products'],0)
        self.assertTrue(result['warnings'])

    def test_actions_validate_confirmation_revision_and_server_actor(self):
        self.login()
        self.assertEqual(self.action(action='delete',confirmation='wrong').status_code,400)
        self.assertEqual(self.action(reason='').status_code,400)
        self.assertEqual(self.action(revision=True).status_code,400)
        self.client.rpc.assert_not_called()
        self.assertEqual(self.action(actor='forged').status_code,200)
        self.assertEqual(self.client.rpc.call_args.args[1]['p_actor'],'admin@example.test')
        self.client.rpc.side_effect=APIError({'code':'P0001','message':'Store changed; refresh','details':None,'hint':None})
        self.assertEqual(self.action().status_code,409)
        self.client.rpc.side_effect=APIError({'code':'PGRST202','message':'Missing','details':None,'hint':None})
        self.assertEqual(self.action().status_code,503)

    def test_archived_store_directory_and_product_snapshot(self):
        self.login()
        self.user.app_metadata['store_review']['status']='Deleted'
        self.tables['deleted_store_products']=[dict(store_id=STORE,product_id='p',product={'id':'p','name':'Archived phone','price':50})]
        response=self.http.get('/api/auth/admin/store-directory')
        self.assertEqual(response.json['stores'],[])
        self.assertEqual(response.json['archived'],1)
        self.assertEqual(self.http.get('/api/auth/admin/store-directory?status=Deleted').json['total_matches'],1)
        self.assertEqual(self.get().json['products'][0]['name'],'Archived phone')

    def test_restore_is_admin_only_and_passes_revision_and_trusted_actor(self):
        self.assertEqual(self.action(action='restore', status='Deleted').status_code,403)
        self.login()
        self.user.app_metadata['store_review']['status']='Deleted'
        self.client.rpc.return_value.execute.return_value=Obj(data={'status':'Approved','revision':5})
        response=self.action(action='restore',status='Deleted',revision=4,actor='forged')
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json['result']['status'],'Approved')
        self.assertEqual(self.client.rpc.call_args.args[1],dict(p_store=STORE,p_action='restore',
            p_reason='Admin review',p_actor='admin@example.test',p_revision=4,p_status='Deleted'))

    def test_suspension_blocks_owner_staff_agents_and_public_store(self):
        from backend.field_agents import resolve_agent
        for status in ('Suspended','Deleted'):
            self.user.app_metadata['store_review']['status']=status
            with self.assertRaises(StoreAccessError): public_user(self.user)
            with self.assertRaises(StoreAccessError): resolve_store(self.user,lambda:self.client)
            self.assertIsNone(public_store(self.user))
            staff=Obj(id='staff',app_metadata={'store_staff':{'status':'Active','permissions':['products'],'store_id':STORE}})
            with self.assertRaises(StoreAccessError): resolve_store(staff,lambda:self.client,page='products')
            agent=Obj(id='agent',app_metadata={'role':'Field Agent','field_agent_store':STORE})
            self.client.table.side_effect=None
            self.client.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value=Obj(data=[{'id':'agent','store_id':STORE,'status':'Active'}])
            with self.assertRaises(StoreAccessError): resolve_agent(agent,lambda:self.client)

    def test_cross_origin_and_unknown_store(self):
        self.login()
        response=self.http.post('/api/auth/admin/store-directory/'+STORE+'/action',json={'action':'delete'},headers={'Origin':'https://evil.example'})
        self.assertEqual(response.status_code,403)
        self.client.auth.admin.get_user_by_id.return_value=Obj(user=None)
        self.assertEqual(self.get().status_code,404)

    def test_suspended_owner_session_is_invalidated(self):
        self.user.app_metadata['store_review']['status']='Suspended'
        auth=Mock()
        auth.auth.get_user.return_value=Obj(user=self.user)
        self.http.set_cookie('adepa_access','old-token',path='/api/auth')
        with patch('backend.app.connect_db',return_value=auth):
            response=self.http.get('/api/auth/session')
        self.assertEqual(response.status_code,401)
        self.assertTrue(any('adepa_access=;' in cookie for cookie in response.headers.getlist('Set-Cookie')))


if __name__=='__main__': unittest.main()
