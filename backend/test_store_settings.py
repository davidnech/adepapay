import unittest
from backend import test_store_profile
from backend.store_settings import settings_for

class StoreSettingsTests(unittest.TestCase):
    setUp = test_store_profile.StoreProfileTests.setUp

    def test_distinct_sections_and_persistence_without_overwriting_other_data(self):
        loaded=self.http.get('/api/auth/store/settings')
        self.assertEqual(loaded.status_code,200)
        settings=loaded.json['settings']
        self.assertNotEqual(set(settings['sections']['General']),set(settings['sections']['Operations']))
        original_review=self.user.app_metadata['store_review'].copy()
        for section,updates in [('Inventory',{'lowStockThreshold':12}),('Operations',{'leadDays':4})]:
            current=settings_for(self.user)
            result=self.http.post('/api/auth/store/settings',json={'section':section,'version':current['versions'][section],
                'values':{**current['sections'][section],**updates}})
            self.assertEqual(result.status_code,200)
        current=self.http.get('/api/auth/store/settings').json['settings']
        self.assertEqual(current['sections']['Inventory']['lowStockThreshold'],12)
        self.assertEqual(current['sections']['Operations']['leadDays'],4)
        self.assertEqual(self.user.app_metadata['store_review'],original_review)
        self.assertEqual(self.user.app_metadata['role'],'Store Manager')

    def test_invalid_values_and_privilege_injection_rejected(self):
        section='Inventory'
        current=settings_for(self.user)
        for changes in ({'lowStockThreshold':-1},{'lowStockThreshold':True},{'showOutOfStock':'yes'}, {'role':'Admin'}, {'skuPrefix':'x'*31}):
            result=self.http.post('/api/auth/store/settings',json={'section':section,'version':current['versions'][section],
                'values':{**current['sections'][section],**changes}})
            self.assertEqual(result.status_code,400)
        self.admin.auth.admin.update_user_by_id.assert_not_called()

    def test_stale_version_and_security_mutation_denied(self):
        current=settings_for(self.user)
        result=self.http.post('/api/auth/store/settings',json={'section':'General','version':'old','values':current['sections']['General']})
        self.assertEqual(result.status_code,409)
        self.assertEqual(self.http.post('/api/auth/store/settings',json={'section':'Security','values':{'role':'Admin'}}).status_code,400)
        self.admin.auth.admin.update_user_by_id.assert_not_called()

    def test_only_approved_owner_can_read_or_save(self):
        self.user.app_metadata['role']='Customer'
        self.assertEqual(self.http.get('/api/auth/store/settings').status_code,403)
        self.assertEqual(self.http.post('/api/auth/store/settings',json={}).status_code,403)
        self.http.delete_cookie('adepa_access',path='/api/auth')
        self.assertEqual(self.http.get('/api/auth/store/settings').status_code,401)

if __name__=='__main__': unittest.main()
