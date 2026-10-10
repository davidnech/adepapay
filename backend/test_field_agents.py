import io
import unittest
from copy import deepcopy
from types import SimpleNamespace as Obj
from unittest.mock import patch
from uuid import uuid4
from postgrest.exceptions import APIError
from supabase_auth.errors import AuthApiError
from backend import test_store_profile
from backend.test_store_products import Query
from backend.app import app, public_user
from backend.store_approvals import application_data


class AgentQuery(Query):
    def execute(self):
        if self.action=='insert' and not self.database.error:
            if self.database.reject_insert:
                raise APIError({'code':'23514','message':'Rejected','details':'','hint':''})
            row={**deepcopy(self.values),'revision':1}
            self.database.rows.append(row)
            return Obj(data=[deepcopy(row)],count=1)
        return super().execute()


class FieldAgentTests(unittest.TestCase):
    def setUp(self):
        test_store_profile.StoreProfileTests.setUp(self)
        self.database=Obj(rows=[],error=None,race=False,reject_insert=False)
        self.admin.table.side_effect=lambda name: AgentQuery(self.database)
        self.agent=Obj(id=str(uuid4()),email='agent@example.com',user_metadata={},app_metadata={'role':'Field Agent','field_agent_store':self.user.id})
        self.admin.auth.admin.create_user.return_value=Obj(user=self.agent)
        self.admin.auth.admin.update_user_by_id.side_effect=None
        self.admin.auth.admin.update_user_by_id.return_value=Obj(user=self.agent)
        self.data={'email':self.agent.email,'password':'TestAgentPassword123!','status':'Active','profile':{
            'fullName':'Ama Agent','phone':'0241234567','region':'Greater Accra','area':'Accra','address':'Test address'}}

    def create(self): return self.http.post('/api/auth/store/agents',json=self.data)

    def login_agent(self):
        self.service.auth.get_user.return_value=Obj(user=self.agent)
        self.admin.auth.admin.get_user_by_id.return_value=Obj(user=self.user)
        self.service.auth.sign_in_with_password.return_value=Obj(user=self.agent,session=Obj(access_token='agent-access',refresh_token='agent-refresh'))

    def test_create_real_login_without_storing_password(self):
        response=self.create()
        self.assertEqual(response.status_code,201)
        self.assertNotIn(self.data['password'],str(response.json))
        self.assertNotIn(self.data['password'],str(self.database.rows))
        values=self.admin.auth.admin.create_user.call_args.args[0]
        self.assertTrue(values['email_confirm'])
        self.assertEqual(values['app_metadata'],self.agent.app_metadata)
        self.login_agent()
        login=self.http.post('/api/auth/login',json={'email':self.agent.email,'password':self.data['password']})
        self.assertEqual(login.status_code,200)
        self.assertEqual(login.json['user']['id'],self.agent.id)
        self.assertEqual(login.json['user']['role'],'Field Agent')
        self.assertEqual(login.json['user']['name'],'Ama Agent')
        self.assertEqual(self.http.get_cookie('adepa_access',path='/api/auth').value,'agent-access')
        self.assertEqual(self.http.get('/api/auth/agent/me').json['agent']['id'],self.agent.id)
        self.assertIsNone(application_data(self.agent))

    def test_suspension_blocks_login_and_existing_session(self):
        self.create(); self.login_agent()
        self.database.rows[0]['status']='Suspended'
        self.assertEqual(self.http.post('/api/auth/login',json={'email':self.agent.email,'password':self.data['password']}).status_code,401)
        self.http.set_cookie('adepa_access','old-access',path='/api/auth')
        self.assertEqual(self.http.get('/api/auth/session').status_code,401)
        self.http.set_cookie('adepa_access','old-access',path='/api/auth')
        self.assertEqual(self.http.get('/api/auth/agent/me').status_code,401)

    def test_manager_reset_only_own_agent_and_no_password_readback(self):
        row=self.create().json['agent']
        self.admin.auth.admin.get_user_by_id.return_value=Obj(user=self.agent)
        payload={'id':row['id'],'revision':row['revision'],'action':'password','password':'NewPassword123!'}
        response=self.http.post('/api/auth/store/agents',json=payload)
        self.assertEqual(response.status_code,200)
        self.assertEqual(self.admin.auth.admin.update_user_by_id.call_args.args,(self.agent.id,{'password':'NewPassword123!'}))
        self.assertNotIn('NewPassword123!',str(response.json))
        self.database.rows[0]['store_id']='other-store'
        self.assertEqual(self.http.post('/api/auth/store/agents',json=payload).status_code,404)

    def test_own_password_requires_current_password_and_ignores_target_id(self):
        self.create(); self.login_agent()
        data={'currentPassword':'CurrentPassword123!','password':'NewPassword123!','id':'owner-1'}
        self.service.auth.sign_in_with_password.side_effect=AuthApiError('Invalid credentials',400,'invalid_credentials')
        self.assertEqual(self.http.post('/api/auth/agent/me',json=data).status_code,400)
        self.admin.auth.admin.update_user_by_id.assert_not_called()
        self.service.auth.sign_in_with_password.side_effect=None
        self.assertEqual(self.http.post('/api/auth/agent/me',json=data).status_code,200)
        self.assertEqual(self.admin.auth.admin.update_user_by_id.call_args.args[0],self.agent.id)
        self.assertEqual(self.service.auth.sign_in_with_password.call_args.args[0]['email'],self.agent.email)

    def test_private_upload_save_preview_and_ownership(self):
        with patch('backend.store_profile.upload_image',return_value={'id':'private-image','url':'https://imagedelivery.net/test/private-image/public'}) as upload:
            response=self.http.post('/api/auth/images/upload?purpose=collection-agents',data={'image':(io.BytesIO(b'image'),'photo.jpg')},headers={'X-Requested-With':'AdepaPay'})
        self.assertEqual(response.status_code,200)
        self.assertTrue(upload.call_args.kwargs['private'])
        image=response.json['image']
        self.assertTrue(image['url'].startswith('/api/auth/store/agent-image?ticket='))
        self.data['profile']['ghanaCardFront']=image
        row=self.create().json['agent']
        self.assertNotIn('upload_token',str(self.database.rows))
        with patch('backend.field_agents.download_private_image',return_value=(b'image','image/jpeg')) as download:
            self.assertEqual(self.http.get(image['url']).status_code,200)
            self.assertEqual(self.http.get(row['profile']['ghanaCardFront']['url']).status_code,200)
            self.user.id='other-store'; self.user.app_metadata['store_id']='other-store'
            self.assertEqual(self.http.get(image['url']).status_code,403)
            self.assertEqual(self.http.get(row['profile']['ghanaCardFront']['url']).status_code,404)
            self.assertEqual(download.call_count,2)

    def test_permissions_and_staff_cannot_target_owner_password(self):
        staff=Obj(id='staff-1',app_metadata={'store_staff':{'store_id':self.user.id,'status':'Active','permissions':['products']}})
        self.service.auth.get_user.return_value=Obj(user=staff)
        self.admin.auth.admin.get_user_by_id.return_value=Obj(user=self.user)
        self.assertEqual(self.create().status_code,403)
        staff.app_metadata['store_staff']['permissions']=['collection-agents']
        row=self.create().json['agent']
        # Even a corrupted table association cannot reset a store owner's login.
        response=self.http.post('/api/auth/store/agents',json={'id':row['id'],'revision':1,'action':'password','password':'NewPassword123!'})
        self.assertEqual(response.status_code,403)
        self.login_agent()
        self.assertEqual(self.http.get('/api/auth/store/agents').status_code,403)

    def test_profile_stale_update_and_validation(self):
        row=self.create().json['agent']
        row['status']='Suspended'
        self.assertEqual(self.http.post('/api/auth/store/agents',json=row).status_code,200)
        self.assertEqual(self.http.post('/api/auth/store/agents',json=row).status_code,409)
        self.data['password']='short'
        self.assertEqual(self.create().status_code,400)
        self.data['password']='TestAgentPassword123!'
        self.data['profile']['ghanaCardFront']={'id':'forged','url':'https://evil.test'}
        self.assertEqual(self.create().status_code,400)

    def test_missing_table_and_insert_rejection_do_not_leave_provisioned_login(self):
        self.database.error='PGRST205'
        self.assertEqual(self.create().status_code,503)
        self.admin.auth.admin.create_user.assert_not_called()
        self.database.error=None; self.database.reject_insert=True
        self.assertEqual(self.create().status_code,503)
        self.admin.auth.admin.delete_user.assert_called_once_with(self.agent.id)


if __name__=='__main__': unittest.main()
