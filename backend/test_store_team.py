import unittest
from types import SimpleNamespace as Obj
from unittest.mock import patch
from backend import test_store_profile
from backend.app import public_user
from backend.store_team import StoreAccessError, resolve_store, staff_row
from backend.store_approvals import application_data

class StoreTeamTests(unittest.TestCase):
    setUp=test_store_profile.StoreProfileTests.setUp

    def staff(self, permissions=None, status='Active', store_id='owner-1'):
        return Obj(id='staff-1',email='staff@example.com',user_metadata={},app_metadata={
            'role':'Store Manager','store_staff':{'store_id':store_id,'name':'Ama Staff','phone':'','title':'Sales',
            'permissions':['products'] if permissions is None else permissions,'status':status}})

    def test_create_staff_persists_permissions_without_password_metadata(self):
        def create(values):
            self.assertEqual(values['password'],'SomePassword123!')
            self.assertTrue(values['email_confirm'])
            self.assertEqual(values['app_metadata']['store_staff']['store_id'],'owner-1')
            self.assertNotIn('password',str(values['app_metadata']))
            return Obj(user=Obj(id='staff-1',email=values['email'],app_metadata=values['app_metadata'],user_metadata=values['user_metadata']))
        self.admin.auth.admin.create_user.side_effect=create
        data={'name':'Ama Staff','email':'staff@example.com','password':'SomePassword123!','phone':'','title':'Sales','permissions':['products','reports'],'status':'Active','store_id':'another-store','role':'Admin'}
        result=self.http.post('/api/auth/store/team',json=data)
        self.assertEqual(result.status_code,201)
        self.assertEqual(result.json['user']['permissions'],['products','reports'])
        self.assertNotIn('password',str(result.json))

    def test_team_list_is_store_scoped(self):
        self.admin.auth.admin.list_users.return_value=[self.staff(),self.staff(store_id='another-store'),self.user]
        result=self.http.get('/api/auth/store/team')
        self.assertEqual(result.status_code,200)
        self.assertEqual(len(result.json['users']),1)
        self.assertNotIn('team-access',result.json['pages'])

    def test_owner_can_edit_and_disable_only_their_staff(self):
        staff=self.staff()
        self.admin.auth.admin.get_user_by_id.return_value=Obj(user=staff)
        self.admin.auth.admin.update_user_by_id.side_effect=lambda uid,values: Obj(user=Obj(id=uid,email=staff.email,app_metadata=values['app_metadata']))
        data={**staff_row(staff),'status':'Disabled','permissions':['reports']}
        result=self.http.post('/api/auth/store/team',json=data)
        self.assertEqual(result.status_code,200)
        self.assertEqual(result.json['user']['status'],'Disabled')
        staff.app_metadata['store_staff']['store_id']='other-store'
        self.assertEqual(self.http.post('/api/auth/store/team',json=data).status_code,403)
        self.assertEqual(self.http.post('/api/auth/store/team',json={**data,'id':'owner-1'}).status_code,403)

    def test_staff_login_payload_and_live_revocation(self):
        staff=self.staff(['products','reports'])
        self.admin.auth.admin.get_user_by_id.return_value=Obj(user=self.user)
        result=public_user(staff)
        self.assertTrue(result['staff'])
        self.assertEqual(result['store']['id'],'owner-1')
        self.assertEqual(result['permissions'],['products','reports'])
        self.service.auth.get_user.return_value=Obj(user=staff)
        self.assertEqual(self.http.get('/api/auth/session').status_code,200)
        staff.app_metadata['store_staff']['status']='Disabled'
        response=self.http.get('/api/auth/session')
        self.assertEqual(response.status_code,401)
        self.assertIsNone(self.http.get_cookie('adepa_access',path='/api/auth'))

    def test_staff_password_login_and_disabled_login(self):
        staff=self.staff(['reports'])
        self.admin.auth.admin.get_user_by_id.return_value=Obj(user=self.user)
        self.service.auth.sign_in_with_password.return_value=Obj(user=staff,session=Obj(access_token='staff-access',refresh_token='staff-refresh'))
        credentials={'email':staff.email,'password':'SomePassword123!'}
        response=self.http.post('/api/auth/login',json=credentials)
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json['user']['permissions'],['reports'])
        self.assertEqual(self.http.get_cookie('adepa_access',path='/api/auth').value,'staff-access')
        staff.app_metadata['store_staff']['status']='Disabled'
        self.assertEqual(self.http.post('/api/auth/login',json=credentials).status_code,401)
        self.assertIsNone(self.http.get_cookie('adepa_access',path='/api/auth'))

    def test_staff_cannot_become_store_applicant_through_user_metadata(self):
        staff=self.staff()
        staff.user_metadata['store_application']={'storeName':'Forged Store'}
        self.assertIsNone(application_data(staff))

    def test_permission_checks_protect_profile_settings_upload_and_team(self):
        staff=self.staff(['products'])
        self.service.auth.get_user.return_value=Obj(user=staff)
        self.admin.auth.admin.get_user_by_id.return_value=Obj(user=self.user)
        for path in ('profile','settings','team'):
            self.assertEqual(self.http.get('/api/auth/store/'+path).status_code,403)
            self.assertEqual(self.http.post('/api/auth/store/'+path,json={}).status_code,403)
        self.assertEqual(self.http.post('/api/auth/images/upload',data={},headers={'X-Requested-With':'AdepaPay'}).status_code,403)
        staff.app_metadata['store_staff']['permissions']=['store-profile','store-settings']
        profile=self.http.get('/api/auth/store/profile')
        self.assertEqual(profile.status_code,200)
        self.assertEqual(profile.json['profile']['id'],'owner-1')
        settings=self.http.get('/api/auth/store/settings')
        self.assertEqual(settings.status_code,200)
        self.assertEqual(settings.json['settings']['account']['email'],staff.email)
        self.assertEqual(settings.json['settings']['account']['storeId'],'owner-1')
        staff.app_metadata['store_staff']['permissions']=[]
        self.assertEqual(self.http.get('/api/auth/store/profile').status_code,403)

    def test_owner_approval_and_untrusted_permissions(self):
        staff=self.staff()
        staff.user_metadata={'permissions':['team-access'],'role':'Admin'}
        self.admin.auth.admin.get_user_by_id.return_value=Obj(user=self.user)
        self.assertEqual(public_user(staff)['permissions'],['products'])
        self.user.app_metadata['store_review']['status']='Rejected'
        with self.assertRaises(StoreAccessError): public_user(staff)

    def test_invalid_permissions_and_stale_edits(self):
        data={'name':'Ama','email':'staff@example.com','password':'LongPassword123!','title':'Staff','permissions':['team-access'],'status':'Active'}
        self.assertEqual(self.http.post('/api/auth/store/team',json=data).status_code,400)
        staff=self.staff()
        self.admin.auth.admin.get_user_by_id.return_value=Obj(user=staff)
        self.assertEqual(self.http.post('/api/auth/store/team',json={**staff_row(staff),'version':'stale'}).status_code,409)
        self.admin.auth.admin.create_user.assert_not_called()
        self.admin.auth.admin.update_user_by_id.assert_not_called()

if __name__=='__main__': unittest.main()
