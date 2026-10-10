import os
import unittest
from types import SimpleNamespace as Obj
from unittest.mock import Mock, patch
from backend.app import app

class StoreDirectoryTests(unittest.TestCase):
    def setUp(self):
        self.http=app.test_client()
        self.client=Mock()
        for patcher in (patch.dict(app.config, TESTING=True, SECRET_KEY='test-secret'),
                        patch.dict(os.environ, ADMIN_EMAIL='admin@example.com',ADMIN_PASSWORD='pass'),
                        patch('backend.app.connect_admin',return_value=self.client)):
            patcher.start(); self.addCleanup(patcher.stop)

    def user(self, index, status='Pending Approval'):
        metadata={}
        application={'storeName':f'Store {index}', 'ownerName':'Ama', 'region':'Greater Accra','city':'Accra','categories':['Phones']}
        if status != 'Pending Approval':
            metadata={'role':'Store Manager' if status=='Approved' else 'Customer',
                      'store_id':str(index),'store_review':{'status':status,'application':application}}
        return Obj(id=str(index), email=f'owner{index}@example.com',created_at='2026-10-07T12:00:00Z',
                   user_metadata={'store_application':application},app_metadata=metadata)

    def login(self):
        self.http.post('/api/auth/login',json={'email':'admin@example.com','password':'pass'})

    def test_directory_rejects_non_admin(self):
        self.assertEqual(self.http.get('/api/auth/admin/store-directory').status_code,403)
        self.client.auth.admin.list_users.assert_not_called()

    def test_totals_cover_all_auth_pages_and_filters_do_not_change_totals(self):
        self.login()
        users=[self.user(i,'Approved') for i in range(100)] + [self.user(100), self.user(101,'Rejected')]
        self.client.auth.admin.list_users.side_effect=lambda page,per_page: users[(page-1)*per_page:page*per_page]
        result=self.http.get('/api/auth/admin/store-directory?status=Pending+Approval').json
        self.assertEqual(result['summary'],{'total':102,'active':100,'pending':1,'rejected':1})
        self.assertEqual(result['total_matches'],1)
        self.assertEqual(result['stores'][0]['id'],'100')
        self.assertEqual(self.client.auth.admin.list_users.call_count,2)
        page=self.http.get('/api/auth/admin/store-directory?page=2&status=Active').json
        self.assertEqual(len(page['stores']),20)
        self.assertEqual(page['page'],2)

    def test_current_profile_and_no_customer_or_private_fields(self):
        self.login()
        store=self.user(1,'Approved')
        store.app_metadata['store_profile']={'storeName':'Updated Name','region':'Ashanti','city':'Kumasi','contactEmail':'contact@example.com',
                                            'logo':{'id':'logo','url':'https://imagedelivery.net/hash/logo/public','upload_token':'private'}}
        store.user_metadata['password']='private'
        customer=Obj(id='customer',email='customer@example.com',app_metadata={},user_metadata={})
        self.client.auth.admin.list_users.return_value=[store,customer]
        result=self.http.get('/api/auth/admin/store-directory?q=updated&region=Ashanti').json
        self.assertEqual(result['summary']['total'],1)
        self.assertEqual(result['stores'][0]['storeName'],'Updated Name')
        self.assertEqual(result['stores'][0]['contactEmail'],'contact@example.com')
        self.assertNotIn('private',str(result))
        self.assertEqual(result['regions'],['Ashanti'])

    def test_empty_directory_invalid_page_and_missing_key(self):
        self.login()
        self.client.auth.admin.list_users.return_value=[]
        response=self.http.get('/api/auth/admin/store-directory')
        self.assertEqual(response.json['summary']['total'],0)
        self.assertEqual(response.json['stores'],[])
        self.assertEqual(self.http.get('/api/auth/admin/store-directory?page=bad').status_code,400)
        with patch('backend.app.connect_admin',side_effect=RuntimeError('Configure server key')):
            self.assertEqual(self.http.get('/api/auth/admin/store-directory').status_code,503)

if __name__=='__main__': unittest.main()
