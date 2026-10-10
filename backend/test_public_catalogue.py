import unittest
from copy import deepcopy
from types import SimpleNamespace as Obj
from backend import test_store_profile
from backend.test_store_products import Query


class PublicQuery(Query):
    def in_(self,key,values):
        self.filters.append(lambda row: row[key] in values)
        return self


class PublicCatalogueTests(unittest.TestCase):
    def setUp(self):
        test_store_profile.StoreProfileTests.setUp(self)
        self.http.delete_cookie('adepa_access',path='/api/auth')
        self.user.email='private-owner@example.com'
        self.user.app_metadata['store_profile']={'storeName':'Live Shop','region':'Greater Accra','city':'Accra','description':'Real store',
            'logo':{'url':'https://imagedelivery.net/hash/logo/public'},'contactEmail':'sales@example.com','website':'https://shop.example.com'}
        self.user.app_metadata['store_review']['application']['ownerName']='PRIVATE OWNER NAME'
        self.user.app_metadata['store_rules']={'revision':1,'values':{'clauses':['Published clause'],'internalSecret':'PRIVATE RULE'}}
        self.admin.auth.admin.list_users.return_value=[self.user]
        self.product={'id':'product-1','store_id':self.user.id,'name':'Real phone','category':'Phones','description':'A useful phone',
            'condition':'New','price':123.45,'stock':3,'status':'Active','images':[{'url':'https://imagedelivery.net/hash/phone/public'}],
            'payment_options':{'payNow':True,'hirePurchase':True,'layaway':False},'swap':{'enabled':True},'layaway':{},
            'created_at':'2026-01-01T00:00:00Z','internal_secret':'PRIVATE PRODUCT'}
        self.products=Obj(rows=[self.product],error=None,race=False)
        self.promotions=Obj(rows=[],error=None,race=False)
        self.admin.table.side_effect=lambda table: PublicQuery(self.products if table=='store_products' else self.promotions)

    def test_anonymous_browsing_real_counts_and_public_fields_only(self):
        response=self.http.get('/api/public/stores')
        self.assertEqual(response.status_code,200)
        store=response.json['items'][0]
        self.assertEqual(store['name'],'Live Shop')
        self.assertEqual(store['productCount'],1)
        self.assertEqual(store['categories'],['Phones'])
        self.assertEqual(store['terms'],{'clauses':['Published clause']})
        product_response=self.http.get('/api/public/products')
        self.assertEqual(product_response.json['items'][0]['currentPrice'],123.45)
        payload=str(response.json)+str(product_response.json)
        for secret in ('PRIVATE','private-owner@example.com','app_metadata','user_metadata','store_review'):
            self.assertNotIn(secret,payload)
        self.assertEqual(response.headers['Cache-Control'],'no-store')

    def test_hide_unapproved_stores_inactive_products_and_private_images(self):
        rejected=deepcopy(self.user); rejected.id='rejected'; rejected.app_metadata['store_id']='rejected'; rejected.app_metadata['store_review']['status']='Rejected'
        self.admin.auth.admin.list_users.return_value=[self.user,rejected]
        self.products.rows.extend([{**self.product,'id':'draft','status':'Draft'}, {**self.product,'id':'archived','status':'Archived'}, {**self.product,'id':'rejected-product','store_id':'rejected'}])
        self.product['images'].append({'url':'/api/auth/store/agent-image?agent=private'})
        response=self.http.get('/api/public/products')
        self.assertEqual(response.json['total'],1)
        self.assertEqual(len(response.json['items'][0]['images']),1)
        self.assertEqual(self.http.get('/api/public/stores/rejected').status_code,404)
        self.user.app_metadata['store_review']['status']='Rejected'
        self.assertEqual(self.http.get('/api/public/products').json['total'],0)

    def test_filters_sort_and_pagination(self):
        self.products.rows.extend([{**self.product,'id':f'p-{index}','name':f'Laptop {index}','category':'Laptops','price':index+200,'stock':0,'condition':'Used'} for index in range(15)])
        self.assertEqual(len(self.http.get('/api/public/products').json['items']),12)
        self.assertEqual(len(self.http.get('/api/public/products?page=2').json['items']),4)
        self.assertEqual(self.http.get('/api/public/products?category=Phones&inStock=true&payment=hirePurchase').json['total'],1)
        self.assertEqual(self.http.get('/api/public/products?q=Laptop&min=210&max=214&condition=Used').json['total'],5)
        self.assertEqual(self.http.get('/api/public/products?sort=price-high').json['items'][0]['currentPrice'],214)
        self.assertEqual(self.http.get('/api/public/products?store=another-store').json['total'],0)
        self.assertEqual(self.http.get('/api/public/stores?region=Ashanti').json['total'],0)
        self.assertEqual(self.http.get('/api/public/stores?q=Live&category=Phones').json['total'],1)

    def test_campaign_discount_is_server_calculated_codes_never_exposed(self):
        campaign={'name':'Phone offer','enabled':True,'startsAt':'2000-01-01','endsAt':'2099-12-31','scope':'Selected products','productIds':['product-1'],'discountPercent':10}
        self.promotions.rows=[{'store_id':self.user.id,'public_enabled':True,'campaigns':[campaign,{**campaign,'discountPercent':50,'productIds':['someone-else']}], 'codes':[{'code':'PRIVATE-CODE'}]}]
        response=self.http.get('/api/public/products')
        product=response.json['items'][0]
        self.assertEqual(product['currentPrice'],111.11)
        self.assertEqual(product['promotion']['percent'],10)
        self.assertNotIn('PRIVATE-CODE',str(response.json))
        self.promotions.rows[0]['public_enabled']=False
        self.assertEqual(self.http.get('/api/public/products').json['items'][0]['currentPrice'],123.45)
        self.promotions.rows[0]['public_enabled']=True
        campaign['endsAt']='2001-01-01'
        self.assertIsNone(self.http.get('/api/public/products').json['items'][0]['promotion'])


    def test_swap_filter_only_returns_enabled_products(self):
        self.products.rows.append({**self.product,'id':'no-swap','swap':{'enabled':False}})
        response=self.http.get('/api/public/products?swap=true')
        self.assertEqual([item['id'] for item in response.json['items']],['product-1'])
        self.assertEqual(self.http.get('/api/public/products?product=no-swap').json['items'][0]['id'],'no-swap')
        self.assertEqual(self.http.get('/api/public/products?product=missing').json['items'],[])

    def test_option_prices_and_price_filters_use_selected_method(self):
        self.product['prices']={'hire_purchase':180,'layaway':150,'swap':160}
        product=self.http.get('/api/public/products').json['items'][0]
        self.assertEqual(product['prices'],self.product['prices'])
        self.assertEqual(self.http.get('/api/public/products?payment=hirePurchase&min=170').json['total'],1)
        self.assertEqual(self.http.get('/api/public/products?payment=hirePurchase&max=170').json['total'],0)
        self.assertEqual(self.http.get('/api/public/products?swap=true&min=155').json['total'],1)

    def test_live_edits_and_stock_are_visible_next_request(self):
        self.assertEqual(self.http.get('/api/public/products').json['items'][0]['name'],'Real phone')
        self.product.update(name='Updated phone',stock=0)
        product=self.http.get('/api/public/products').json['items'][0]
        self.assertEqual(product['name'],'Updated phone')
        self.assertFalse(product['inStock'])
        self.user.app_metadata['store_profile']['storeName']='Renamed store'
        self.assertEqual(self.http.get('/api/public/stores/owner-1').json['store']['name'],'Renamed store')

    def test_bad_filters_and_missing_database(self):
        for query in ('page=0','min=NaN','min=-1','min=10&max=1','sort=fake','payment=fake'):
            self.assertEqual(self.http.get('/api/public/products?'+query).status_code,400)
        self.products.error='PGRST205'
        response=self.http.get('/api/public/products')
        self.assertEqual(response.status_code,503)
        self.assertNotIn('SECRET_KEY',str(response.json))

    def test_featured_snapshot_tolerates_only_missing_optional_schema(self):
        from backend.public_catalogue import snapshot
        self.products.error='PGRST205';self.promotions.error='PGRST205'
        missing={}
        stores,products=snapshot(self.admin,missing=missing)
        self.assertEqual(len(stores),1)
        self.assertEqual(products,[])
        self.assertEqual(missing,{'products':True,'promotions':True})
        self.products.error=None
        stores,products=snapshot(self.admin,missing={})
        self.assertEqual(products[0]['currentPrice'],123.45)

    def test_auth_and_database_pagination(self):
        customer=Obj(id='customer',app_metadata={},user_metadata={})
        self.admin.auth.admin.list_users.side_effect=[[customer]*100,[self.user]]
        self.products.rows=[{**self.product,'id':f'p-{index}'} for index in range(501)]
        response=self.http.get('/api/public/products')
        self.assertEqual(response.json['total'],501)
        self.assertEqual(self.admin.auth.admin.list_users.call_count,2)


if __name__=='__main__': unittest.main()
