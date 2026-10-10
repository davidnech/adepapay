import unittest
from copy import deepcopy
from types import SimpleNamespace as Obj
from uuid import uuid4
from postgrest.exceptions import APIError
from backend import test_store_profile
from backend.test_store_products import Query


class CatalogueQuery(Query):
    def execute(self):
        if self.action=='insert' and not self.database.error:
            fields=('name',) if 'name' in self.values else ('reference','serial_number')
            if any(row['store_id']==self.values['store_id'] and any(self.values.get(key) and str(row.get(key,'')).lower()==str(self.values[key]).lower() for key in fields) for row in self.database.rows):
                raise APIError({'code':'23505','message':'Duplicate','details':'','hint':''})
            row={**deepcopy(self.values),'id':str(uuid4()),'revision':1}
            self.database.rows.append(row)
            return Obj(data=[deepcopy(row)],count=1)
        return super().execute()


class CatalogueTests(unittest.TestCase):
    def setUp(self):
        test_store_profile.StoreProfileTests.setUp(self)
        self.categories=Obj(rows=[],error=None,race=False)
        self.trade=Obj(rows=[],error=None,race=False)
        self.products=Obj(rows=[{'id':str(uuid4()),'store_id':self.user.id,'category':'Phones','name':'Phone','stock':3,'status':'Active','price':100}],error=None,race=False)
        self.admin.table.side_effect=lambda name: CatalogueQuery({'store_categories':self.categories,'store_trade_inventory':self.trade,'store_products':self.products}[name])
        self.category={'name':'Phones','description':'Mobile devices','status':'Active'}
        self.device={'device':'Test phone','reference':'ti-123','serial_number':'IMEI-1','source_reference':'receipt-1','condition':'Good','acquisition_value':'123.45','received_on':'2026-01-01','status':'HELD_FOR_SWAP','notes':'Received for inspection'}

    def save_category(self,data=None):
        return self.http.post('/api/auth/store/categories',json=data or self.category)

    def save_trade(self,data=None):
        return self.http.post('/api/auth/store/trade-inventory',json=data or self.device)

    def test_categories_create_counts_edit_archive_and_duplicates(self):
        response=self.save_category({**self.category,'store_id':'forged'})
        self.assertEqual(response.status_code,201)
        row=response.json['item']
        self.assertEqual(row['store_id'],self.user.id)
        data=self.http.get('/api/auth/store/categories').json
        self.assertEqual(data['categories'][0]['product_count'],1)
        self.assertEqual(data['categories'][0]['stock_units'],3)
        self.assertEqual(data['categories'][0]['active_products'],1)
        self.assertEqual(self.save_category({**self.category,'name':'phones'}).status_code,409)
        response=self.save_category({**row,'status':'Archived'})
        self.assertEqual(response.json['item']['revision'],2)
        self.assertEqual(self.http.get('/api/auth/store/category-options').json['categories'],[{'name':'Phones','status':'Archived'}])

    def test_receive_inspect_resell_persist_and_lock(self):
        row=self.save_trade().json['item']
        self.assertEqual(row['reference'],'TI-123')
        self.assertEqual(self.save_trade({**row,'status':'RESOLD','resale_value':200}).status_code,400)
        row=self.save_trade({**row,'status':'AVAILABLE'}).json['item']
        self.assertEqual(self.save_trade({**row,'status':'RESOLD','resale_value':0}).status_code,400)
        row=self.save_trade({**row,'status':'RESOLD','resale_value':200}).json['item']
        self.assertEqual(row['resale_value'],200)
        self.assertTrue(row['sold_at'])
        self.assertEqual(self.http.get('/api/auth/store/trade-inventory').json['items'],[row])
        self.assertEqual(self.save_trade({**row,'notes':'Overwritten'}).status_code,400)

    def test_validation_and_duplicates(self):
        for change in ({'received_on':'2099-01-01'},{'received_on':'2026-02-30'},{'acquisition_value':-1},{'acquisition_value':'NaN'},{'status':'AVAILABLE'},{'reference':'bad reference'},{'condition':'Unknown'}):
            self.assertEqual(self.save_trade({**self.device,**change}).status_code,400)
        self.save_trade()
        self.assertEqual(self.save_trade().status_code,409)
        self.assertEqual(self.save_trade({**self.device,'reference':'TI-456'}).status_code,409)

    def test_isolation_permissions_and_options_access(self):
        category=self.save_category().json['item']
        device=self.save_trade().json['item']
        self.categories.rows[0]['store_id']='other-store'
        self.trade.rows[0]['store_id']='other-store'
        self.products.rows[0]['store_id']='other-store'
        self.assertEqual(self.http.get('/api/auth/store/categories').json['categories'],[])
        self.assertEqual(self.http.get('/api/auth/store/categories').json['products'],[])
        self.assertEqual(self.http.get('/api/auth/store/trade-inventory').json['items'],[])
        self.assertEqual(self.save_category(category).status_code,404)
        self.assertEqual(self.save_trade(device).status_code,404)
        staff=Obj(id='staff-1',app_metadata={'store_staff':{'store_id':self.user.id,'status':'Active','permissions':['products']}})
        self.service.auth.get_user.return_value=Obj(user=staff)
        self.admin.auth.admin.get_user_by_id.return_value=Obj(user=self.user)
        self.assertEqual(self.http.get('/api/auth/store/category-options').status_code,200)
        self.assertEqual(self.save_category().status_code,403)
        self.assertEqual(self.save_trade().status_code,403)
        staff.app_metadata['store_staff']['permissions']=['categories','trade-in-inventory']
        self.assertEqual(self.save_category().status_code,201)
        self.assertEqual(self.save_trade().status_code,201)
        self.http.delete_cookie('adepa_access',path='/api/auth')
        self.assertEqual(self.save_trade().status_code,401)

    def test_stale_and_concurrent_edits(self):
        for save,database in ((self.save_category,self.categories),(self.save_trade,self.trade)):
            row=save().json['item']
            self.assertEqual(save({**row,'revision':0}).status_code,409)
            database.race=True
            self.assertEqual(save(row).status_code,409)

    def test_product_category_creation_is_persisted_scoped_and_create_only(self):
        response=self.http.post('/api/auth/store/category-options',json={**self.category,'store_id':'forged-store'})
        self.assertEqual(response.status_code,201)
        self.assertEqual(response.json['item']['store_id'],self.user.id)
        self.assertEqual(self.http.get('/api/auth/store/category-options').json['categories'],[{'name':'Phones','status':'Active'}])
        self.assertEqual(self.http.post('/api/auth/store/category-options',json=response.json['item']).status_code,400)
        self.assertEqual(self.http.post('/api/auth/store/category-options',json={**self.category,'status':'Archived'}).status_code,400)
        self.assertEqual(self.http.post('/api/auth/store/category-options',json={**self.category,'name':' phones '}).status_code,409)

    def test_product_staff_can_add_categories_without_category_management_permission(self):
        self.admin.auth.admin.get_user_by_id.return_value=Obj(user=self.user)
        staff=Obj(id='staff-1',app_metadata={'role':'Store Manager','store_staff':{'store_id':self.user.id,'status':'Active','permissions':['products']}})
        self.service.auth.get_user.return_value=Obj(user=staff)
        self.assertEqual(self.http.post('/api/auth/store/category-options',json=self.category).status_code,201)
        self.assertEqual(self.http.post('/api/auth/store/categories',json=self.category).status_code,403)
        staff.app_metadata['store_staff']['permissions']=['customers']
        self.assertEqual(self.http.post('/api/auth/store/category-options',json={**self.category,'name':'Other'}).status_code,403)

    def test_missing_migration(self):
        self.categories.error='PGRST205'
        response=self.http.get('/api/auth/store/categories')
        self.assertEqual(response.status_code,503)
        self.assertIn('003_categories_trade_inventory.sql',response.json['error'])


if __name__=='__main__': unittest.main()
