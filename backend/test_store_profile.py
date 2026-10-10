import io
import unittest
from copy import deepcopy
from types import SimpleNamespace as Obj
from unittest.mock import Mock, patch
from PIL import Image
from werkzeug.datastructures import FileStorage
from backend.app import app
from backend.store_profile import profile_for
from backend.image_uploader import upload_image, ImageUploadError, MAX_IMAGE_BYTES

class StoreProfileTests(unittest.TestCase):
    def setUp(self):
        self.http = app.test_client()
        self.user = Obj(id='owner-1', email='owner@example.com', user_metadata={}, app_metadata={
            'store_subscription': {'paid_until':'2099-01-01T00:00:00+00:00','plan_name':'Test paid plan','environment':'test'},
            'role': 'Store Manager', 'store_id': 'owner-1', 'store_review': {'status': 'Approved', 'application': {
                'storeName': 'My Shop', 'ownerName': 'Ama', 'registeredName': 'My Shop Ltd', 'phone': '0241234567',
                'region': 'Greater Accra', 'city': 'Accra', 'categories': ['Phones']}}})
        self.service = Mock()
        self.service.auth.get_user.return_value = Obj(user=self.user)
        self.admin = Mock()
        def update(uid, values):
            self.assertEqual(uid, 'owner-1')
            self.user.app_metadata = values['app_metadata']
            return Obj(user=self.user)
        self.admin.auth.admin.update_user_by_id.side_effect = update
        for name, value in [('backend.app.connect_db', self.service), ('backend.app.connect_admin', self.admin)]:
            patcher=patch(name,return_value=value); patcher.start(); self.addCleanup(patcher.stop)
        patcher=patch.dict(app.config, TESTING=True, SECRET_KEY='test-secret'); patcher.start(); self.addCleanup(patcher.stop)
        self.http.set_cookie('adepa_access', 'access', path='/api/auth')

    def test_profile_load_save_and_immutable_fields(self):
        result = self.http.get('/api/auth/store/profile')
        self.assertEqual(result.status_code,200)
        self.assertEqual(result.json['profile']['verification'],'Verified')
        data = result.json['profile']
        data.update(storeName='Updated Shop', registeredName='Forged', role='Admin', id='another-user')
        response = self.http.post('/api/auth/store/profile',json=data)
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json['profile']['storeName'],'Updated Shop')
        self.assertEqual(response.json['profile']['registeredName'],'My Shop Ltd')
        self.assertEqual(self.user.app_metadata['role'],'Store Manager')
        self.assertEqual(self.http.get('/api/auth/store/profile').json['profile']['storeName'],'Updated Shop')

    def test_unapproved_and_unauthenticated_denied(self):
        self.user.app_metadata['role']='Customer'
        self.assertEqual(self.http.get('/api/auth/store/profile').status_code,403)
        self.http.delete_cookie('adepa_access',path='/api/auth')
        self.assertEqual(self.http.get('/api/auth/store/profile').status_code,401)
        self.admin.auth.admin.update_user_by_id.assert_not_called()

    def test_validation_and_stale_save(self):
        for changes in ({'phone':'bad'}, {'website':'javascript:alert(1)'}, {'contactEmail':'bad'}, {'logo':{'url':'https://evil.example'}}):
            result=self.http.post('/api/auth/store/profile',json={**profile_for(self.user),**changes})
            self.assertEqual(result.status_code,400)
        self.assertEqual(self.http.post('/api/auth/store/profile',json={**profile_for(self.user),'version':'stale'}).status_code,409)
        self.admin.auth.admin.update_user_by_id.assert_not_called()

    def test_upload_ticket_owner_check_and_save(self):
        with patch('backend.store_profile.upload_image',return_value={'id':'image-1','url':'https://imagedelivery.net/hash/image-1/public'}):
            result=self.http.post('/api/auth/images/upload',data={'image':(io.BytesIO(b'fake'),'image.png')},headers={'X-Requested-With':'AdepaPay'})
        self.assertEqual(result.status_code,200)
        uploaded=result.json['image']
        data=profile_for(self.user)
        data['logo']=uploaded
        response=self.http.post('/api/auth/store/profile',json=data)
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json['profile']['logo']['id'],'image-1')
        self.assertNotIn('upload_token',response.json['profile']['logo'])
        self.user.id='owner-2'; self.user.app_metadata['store_id']='owner-2'; self.user.app_metadata['store_profile']={}
        result=self.http.post('/api/auth/store/profile',json={**profile_for(self.user),'logo':uploaded})
        self.assertEqual(result.status_code,400)

    def test_upload_csrf_and_provider_failure(self):
        self.assertEqual(self.http.post('/api/auth/images/upload',data={}).status_code,403)
        with patch('backend.store_profile.upload_image',side_effect=ImageUploadError('Provider unavailable')):
            result=self.http.post('/api/auth/images/upload',data={},headers={'X-Requested-With':'AdepaPay'})
            self.assertEqual(result.status_code,502)
        self.assertEqual(self.http.post('/api/auth/images/upload',data={},headers={'X-Requested-With':'AdepaPay','Origin':'https://evil.example'}).status_code,403)

class ImageUploaderTests(unittest.TestCase):
    def test_invalid_and_oversized_files_never_call_provider(self):
        with patch('backend.image_uploader.httpx.Client') as client:
            for data in (b'not an image', b'x'*(MAX_IMAGE_BYTES+1)):
                with self.assertRaises(ValueError):
                    upload_image(FileStorage(stream=io.BytesIO(data),filename='fake.png'),'owner')
            client.assert_not_called()

    def test_cloudflare_two_step_upload(self):
        output=io.BytesIO(); Image.new('RGB',(2,2)).save(output,format='PNG'); output.seek(0)
        provider=Mock()
        provider.post.side_effect=[Obj(is_success=True,json=lambda:{'success':True,'result':{'uploadURL':'https://upload.imagedelivery.net/upload-id','id':'image-1'}}),Obj(is_success=True,json=lambda:{'success':True})]
        with patch.dict('os.environ',CF_ACCOUNT_ID='account',CF_IMAGES_TOKEN='server-only',CF_HASH='hash'), patch('backend.image_uploader.httpx.Client') as client:
            client.return_value.__enter__.return_value=provider
            result=upload_image(FileStorage(stream=output,filename='test.png'),'owner')
        self.assertEqual(result['url'],'https://imagedelivery.net/hash/image-1/public')
        self.assertEqual(provider.post.call_count,2)
        authorization = provider.post.call_args_list[0].kwargs
        self.assertNotIn('data', authorization)
        self.assertEqual(authorization['files']['creator'], (None, 'owner'))
        self.assertEqual(authorization['files']['requireSignedURLs'], (None, 'false'))
        import httpx
        request = httpx.Request('POST', 'https://example.test', **authorization)
        self.assertTrue(request.headers['content-type'].startswith('multipart/form-data; boundary='))
        self.assertNotIn('headers',provider.post.call_args.kwargs)

if __name__=='__main__': unittest.main()
