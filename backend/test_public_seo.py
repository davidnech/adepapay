"""Initial HTML, live catalogue/schema parity, indexation and publication boundaries."""
import json
import os
import re
import tempfile
import unittest
from html import unescape
from copy import deepcopy
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from urllib.parse import urlsplit
from xml.etree import ElementTree as ET

from flask import Flask
from flask.testing import FlaskClient
from backend.frontend import register_frontend
from backend.public_catalogue import snapshot
from backend.public_seo import STATIC, product_path, store_path, category_path
from backend import test_public_catalogue


class ProductionClient(FlaskClient):
    def open(self,*args,**kwargs):
        kwargs.setdefault('base_url','https://adepapay.com')
        return super().open(*args,**kwargs)


class PublicSeoTests(unittest.TestCase):
    def setUp(self):
        test_public_catalogue.PublicCatalogueTests.setUp(self)
        self.product.update(sku='PHONE-123',updated_at='2026-10-01T10:00:00Z',
            prices={'hire_purchase':180,'layaway':150,'swap':160})
        self.product['payment_options']['layaway']=True
        self.product['layaway']={'depositType':'Percentage','deposit':10,'duration':6,'frequencies':['Monthly']}
        self.user.app_metadata['store_profile']['updatedAt']='2026-09-30T10:00:00Z'
        self.directory=tempfile.TemporaryDirectory();self.addCleanup(self.directory.cleanup)
        self.dist=Path(self.directory.name)
        (self.dist/'index.html').write_text('<html><script type="module" src="/assets/main.js"></script><link rel="stylesheet" href="/assets/main.css"><div id="root"></div></html>',encoding='utf-8')
        self.public_app=Flask(__name__,template_folder=str(Path(__file__).parent/'templates'))
        self.public_app.config['TESTING']=True
        self.public_app.test_client_class=ProductionClient
        register_frontend(self.public_app,self.dist)
        self.http=self.public_app.test_client()
        for p in (patch('backend.public_seo.connect_admin',return_value=self.admin),
                  patch.dict(os.environ,APP_ORIGIN='https://adepapay.com',SEO_INDEXING='true')):
            p.start();self.addCleanup(p.stop)

    def paths(self):
        stores,products=snapshot(self.admin)
        return store_path(stores[0]),product_path(products[0]),category_path(products[0]['category'])

    def test_home_preserves_landing_design_and_live_prices_without_javascript(self):
        response=self.http.get('/')
        self.assertEqual(response.status_code,200)
        html=unescape(response.get_data(as_text=True))
        for text in ('Buy in Installments.', 'Pay Ahead.', 'Trade Up.', 'Featured Stores',
                     'Featured Products', 'How AdepaPay Works', 'Why Choose AdepaPay?',
                     'Frequently Asked Questions', 'Grow Your Business', 'Next Product?',
                     'Bridgeway Technology Limited', 'data-cookie-settings'):
            self.assertIn(text,html)
        self.assertEqual(len(re.findall(r'<h1\b',html)),1)
        self.assertEqual(html.count('<summary class="cursor-pointer'),6)
        for price in ('123.45','180.00','150.00','160.00'):
            self.assertIn('GH\u20b5'+price,html)
        for url in (*self.paths()[:2],'/about','/privacy','/terms','/register','/store-registration','/services'):
            self.assertIn(f'href="{url}"',html)
        self.assertLess(html.index('Featured Stores'),html.index('home-about-title'))
        self.product['prices']['layaway']=175
        self.assertIn('GH\u20b5175.00',self.http.get('/').get_data(as_text=True))

    def graph(self,response):
        match=re.search(r'<script type="application/ld\+json">(.*?)</script>',response.get_data(as_text=True),re.S)
        return json.loads(match.group(1))['@graph']

    def product_node(self,response):
        return next(n for n in self.graph(response) if n['@type']=='Product')

    def test_public_routes_have_initial_content_unique_metadata_and_canonicals(self):
        titles=[];descriptions=[]
        for path in [*STATIC,*self.paths()]:
            with self.subTest(path=path):
                response=self.http.get(path);self.assertEqual(response.status_code,200)
                html=response.get_data(as_text=True)
                self.assertIn('<h1',html);self.assertIn('data-public-content',html)
                self.assertIn('lang="en-GH"',html)
                self.assertIn(f'href="https://adepapay.com{path}"',html)
                self.assertEqual(response.headers['X-Robots-Tag'],'index,follow')
                self.assertEqual(response.headers['Cache-Control'],'no-store')
                self.assertIn('property="og:title"',html);self.assertIn('name="twitter:card"',html)
                self.assertTrue(self.graph(response))
                titles.append(re.search(r'<title>(.*?)</title>',html).group(1))
                descriptions.append(re.search(r'name="description" content="(.*?)"',html).group(1))
        self.assertEqual(len(titles),len(set(titles)))
        self.assertEqual(len(descriptions),len(set(descriptions)))

    def test_cash_cedis_schema_and_distinct_plan_totals_deposits(self):
        _,path,_=self.paths();response=self.http.get(path);html=response.get_data(as_text=True)
        node=self.product_node(response)
        self.assertEqual(node['offers']['price'],'123.45')
        self.assertEqual(node['offers']['priceCurrency'],'GHS')
        self.assertEqual(node['sku'],'PHONE-123')
        for value in ('GHS 123.45','GHS 180.00','GHS 150.00','GHS 160.00','GHS 36.00','GHS 15.00','Monthly'):
            self.assertIn(value,html)
        for field in ('gtin','brand','aggregateRating','priceValidUntil','shippingDetails','hasMerchantReturnPolicy'):
            self.assertNotIn(field,json.dumps(node))
        self.product['payment_options']['payNow']=False
        self.assertNotIn('offers',self.product_node(self.http.get(path)))

    def test_price_stock_description_changes_are_fresh_in_html_and_schema(self):
        _,path,_=self.paths();self.http.get(path)
        self.product.update(price=299.99,stock=0,description='Updated product description',updated_at='2026-10-02T11:00:00Z')
        response=self.http.get(path);html=response.get_data(as_text=True);node=self.product_node(response)
        self.assertIn('GHS 299.99',html);self.assertIn('Updated product description',html)
        self.assertEqual(node['offers']['price'],'299.99')
        self.assertEqual(node['offers']['availability'],'https://schema.org/OutOfStock')
        self.assertNotIn('Sign in to apply',html)
        self.assertIn(path,self.http.get('/sitemaps/products-1.xml').get_data(as_text=True))
        self.assertIn('2026-10-02T11:00:00Z',self.http.get('/sitemaps/products-1.xml').get_data(as_text=True))

    def test_privacy_and_store_publication_boundaries(self):
        store,product,_=self.paths()
        for path in ('/',store,product,'/sitemap.xml','/sitemaps/stores-1.xml'):
            html=self.http.get(path).get_data(as_text=True)
            for secret in ('PRIVATE OWNER','private-owner@example.com','PRIVATE RULE','PRIVATE PRODUCT','raw_app_meta_data','identityDocuments'):
                self.assertNotIn(secret,html)
        for state in ('Suspended','Deleted','Rejected','Pending Approval'):
            self.user.app_metadata['store_review']['status']=state
            self.assertEqual(self.http.get(store).status_code,404)
            self.assertEqual(self.http.get(product).status_code,404)
            self.assertNotIn(product,self.http.get('/sitemap.xml').get_data(as_text=True))
        self.user.app_metadata['store_review']['status']='Approved'
        self.user.app_metadata['store_subscription']['paid_until']='2020-01-01T00:00:00Z'
        self.assertEqual(self.http.get(store).status_code,404)

    def test_archived_product_removed_and_new_publication_discovered(self):
        _,path,_=self.paths();self.product['status']='Archived'
        self.assertEqual(self.http.get(path).status_code,404)
        self.assertEqual(self.http.get('/sitemaps/products-1.xml').status_code,404)
        self.product['status']='Active'
        self.products.rows.append({**self.product,'id':'new-product','name':'Freshly published phone'})
        html=self.http.get('/products').get_data(as_text=True)
        self.assertIn('Freshly published phone',html)
        self.assertIn('/products/new-product/freshly-published-phone',self.http.get('/sitemaps/products-1.xml').get_data(as_text=True))

    def test_slug_rename_redirect_and_unknown_http_status(self):
        store,product,_=self.paths();self.product['name']='New product name'
        response=self.http.get(product);self.assertEqual(response.status_code,301)
        self.assertTrue(response.headers['Location'].endswith('/new-product-name'))
        self.user.app_metadata['store_profile']['storeName']='Renamed store'
        self.assertEqual(self.http.get(store).status_code,301)
        for path in ('/missing-page','/products/missing/phone','/stores/missing/store','/categories/missing'):
            response=self.http.get(path);self.assertEqual(response.status_code,404)
            self.assertIn('noindex',response.headers['X-Robots-Tag'])

    def test_search_filter_and_pagination_indexation(self):
        self.products.rows.extend([{**self.product,'id':f'p-{i}','name':f'Phone {i}'} for i in range(15)])
        response=self.http.get('/products?page=2');html=response.get_data(as_text=True)
        self.assertEqual(response.status_code,200);self.assertEqual(response.headers['X-Robots-Tag'],'index,follow')
        self.assertIn('rel="canonical" href="https://adepapay.com/products?page=2"',html)
        self.assertIn('href="/products"',html)
        normalized=self.http.get('/products?page=02&page=3').get_data(as_text=True)
        self.assertIn('rel="canonical" href="https://adepapay.com/products?page=2"',normalized)
        for path in ('/products?q=phone','/products?sort=price-low','/stores?region=Greater+Accra','/products?service=device-swap'):
            response=self.http.get(path);self.assertEqual(response.status_code,200)
            self.assertEqual(response.headers['X-Robots-Tag'],'noindex,follow')
        self.assertEqual(self.http.get('/products?page=99').status_code,404)
        self.assertEqual(self.http.get('/products?page=0').status_code,404)

    def test_sitemap_every_url_is_canonical_public_success_and_has_real_lastmod(self):
        ns={'s':'http://www.sitemaps.org/schemas/sitemap/0.9'}
        response=self.http.get('/sitemap.xml');self.assertEqual(response.status_code,200)
        total=0
        for loc in ET.fromstring(response.data).findall('.//s:loc',ns):
            section=self.http.get(urlsplit(loc.text).path)
            self.assertEqual(section.status_code,200)
            for url in ET.fromstring(section.data).findall('s:url',ns):
                total+=1;target=url.find('s:loc',ns).text
                self.assertTrue(target.startswith('https://adepapay.com/'))
                document=self.http.get(urlsplit(target).path)
                self.assertEqual(document.status_code,200)
                self.assertEqual(document.headers['X-Robots-Tag'],'index,follow')
                self.assertNotIn('?',target);self.assertNotIn('#',target)
        self.assertEqual(total,len(STATIC)+3)
        product_xml=self.http.get('/sitemaps/products-1.xml').get_data(as_text=True)
        self.assertIn('2026-10-01T10:00:00Z',product_xml);self.assertIn('image:loc',product_xml)
        self.assertNotIn('lastmod',self.http.get('/sitemaps/static-1.xml').get_data(as_text=True))

    def test_preview_and_explicit_production_gate(self):
        for settings in ({'APP_ORIGIN':'https://preview.onrender.com'},{'SEO_INDEXING':'false'}):
            with patch.dict(os.environ,settings):
                self.assertEqual(self.http.get('/').headers['X-Robots-Tag'],'noindex,follow')
                self.assertEqual(self.http.get('/sitemap.xml').status_code,404)
                self.assertNotIn('Sitemap:',self.http.get('/robots.txt').get_data(as_text=True))
        self.assertIn('Sitemap: https://adepapay.com/sitemap.xml',self.http.get('/robots.txt').get_data(as_text=True))
        self.assertEqual(self.http.get('/',base_url='https://preview.onrender.com').headers['X-Robots-Tag'],'noindex,follow')
        self.assertEqual(self.http.get('/sitemap.xml',base_url='https://preview.onrender.com').status_code,404)

    def test_private_shell_noindex_and_database_failure_is_not_empty_success(self):
        for path in ('/login','/account','/admin/dashboard','/customer/dashboard','/store/products'):
            response=self.http.get(path);self.assertEqual(response.status_code,200)
            self.assertEqual(response.headers['X-Robots-Tag'],'noindex,follow')
            self.assertNotIn('PRIVATE',response.get_data(as_text=True))
            response.close()
        self.products.error='PGRST205'
        for path in ('/','/products','/sitemap.xml'):
            self.assertEqual(self.http.get(path).status_code,503)

    def test_html_and_jsonld_escape_untrusted_store_and_product_text(self):
        self.product['description']='</script><script>alert("unsafe")</script>'
        _,path,_=self.paths();response=self.http.get(path);html=response.get_data(as_text=True)
        self.assertNotIn('<script>alert',html)
        self.assertIn('&lt;script&gt;',html)
        self.assertEqual(self.product_node(response)['description'],self.product['description'])

    def test_sitemap_splitting(self):
        self.products.rows.extend([{**self.product,'id':f'p-{i}'} for i in range(1001)])
        xml=self.http.get('/sitemap.xml').get_data(as_text=True)
        self.assertIn('/sitemaps/products-2.xml',xml)
        root=ET.fromstring(self.http.get('/sitemaps/products-2.xml').data)
        self.assertEqual(len(root),2)

    def test_new_store_publication_and_case_insensitive_categories(self):
        owner=deepcopy(self.user);owner.id='new-store';owner.app_metadata['store_id']=owner.id
        owner.app_metadata['store_profile']['storeName']='Newly published store'
        owner.app_metadata['store_review']['status']='Pending Approval'
        self.admin.auth.admin.list_users.return_value=[self.user,owner]
        self.products.rows.append({**self.product,'id':'new-phone','store_id':owner.id,'category':'phones'})
        self.assertNotIn('new-store',self.http.get('/sitemaps/stores-1.xml').get_data(as_text=True))
        owner.app_metadata['store_review']['status']='Approved'
        self.assertIn('new-store/newly-published-store',self.http.get('/sitemaps/stores-1.xml').get_data(as_text=True))
        categories=ET.fromstring(self.http.get('/sitemaps/categories-1.xml').data)
        self.assertEqual(len(categories),1)
        self.assertIn('2 published products',self.http.get(category_path('Phones')).get_data(as_text=True))

    def test_responsive_images_are_safe_and_opt_in(self):
        _,path,_=self.paths()
        self.assertNotIn('srcset=',self.http.get(path).get_data(as_text=True))
        with patch.dict(os.environ,CF_IMAGES_RESPONSIVE='true'):
            response=self.http.get(path);html=response.get_data(as_text=True)
            self.assertIn('srcset=',html);self.assertIn('w=320,fit=scale-down,format=auto,quality=80 320w',html)
            self.assertEqual(self.product_node(response)['image'],['https://imagedelivery.net/hash/phone/public'])

    def test_genuine_rating_summary_visible_and_matches_product_markup(self):
        self.admin.rpc.return_value.execute.return_value=SimpleNamespace(data={'stores':[{'id':self.user.id,'rating':4.5,'count':2}], 'products':[{'id':self.product['id'],'rating':4.5,'count':2}]})
        store,path,_=self.paths();response=self.http.get(path)
        self.assertIn('4.5 / 5',response.get_data(as_text=True))
        self.assertEqual(self.product_node(response)['aggregateRating']['ratingCount'],2)
        self.assertIn('4.5 / 5',self.http.get(store).get_data(as_text=True))

    def test_policy_pages_serve_all_imported_document_content_without_database(self):
        from backend.public_seo import LEGAL_DOCUMENTS
        with patch('backend.public_seo.load_catalogue') as catalogue:
            for slug,document in LEGAL_DOCUMENTS.items():
                response=self.http.get('/'+slug)
                self.assertEqual(response.status_code,200)
                html=unescape(response.get_data(as_text=True))
                for block in document['blocks']:
                    for text in block.get('items',[block.get('text','')]):
                        self.assertIn(text,html)
                self.assertIn('Bridgeway Technology Limited',html)
                self.assertIn('Read the '+('Terms and Conditions' if slug=='privacy' else 'Privacy Policy'),html)
            catalogue.assert_not_called()

    def test_about_document_and_home_links_are_present_in_initial_html(self):
        from backend.public_seo import ABOUT_DOCUMENT
        with patch('backend.public_seo.load_catalogue') as catalogue:
            response=self.http.get('/about');self.assertEqual(response.status_code,200)
            html=unescape(response.get_data(as_text=True))
            self.assertIn(ABOUT_DOCUMENT['subtitle'],html)
            for section in ABOUT_DOCUMENT['sections']:
                self.assertIn(section['title'],html)
                for text in section['paragraphs']+section['items']:
                    for part in text.split(' — ',1):self.assertIn(part,html)
            catalogue.assert_not_called()
        home=self.http.get('/').get_data(as_text=True)
        self.assertIn('Discover AdepaPay',home)
        self.assertIn('id="home-about-title"',home)
        self.assertGreaterEqual(home.count('href="/about"'),3)


if __name__=='__main__': unittest.main()
