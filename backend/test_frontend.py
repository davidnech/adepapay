"""Production routing must preserve API isolation and static caching."""
import tempfile
import unittest
from pathlib import Path

from flask import Flask, jsonify
from backend.frontend import register_frontend


class FrontendTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.dist = Path(self.directory.name)
        (self.dist / 'assets').mkdir()
        (self.dist / 'index.html').write_text('<html>Built app</html>', encoding='utf-8')
        (self.dist / 'assets' / 'main-abc.js').write_text('console.log(1)', encoding='utf-8')
        self.app = Flask(__name__)
        self.app.get('/api/example')(lambda: jsonify(data='real API'))
        register_frontend(self.app, self.dist)
        self.http = self.app.test_client()

    def test_spa_routes_and_html_revalidation(self):
        for route in ('/', '/services', '/customer/dashboard'):
            response = self.http.get(route)
            self.assertEqual(response.status_code, 200)
            self.assertIn(b'Built app', response.data)
            self.assertEqual(response.headers['Cache-Control'], 'no-cache')
            response.close()

    def test_assets_cached_and_missing_assets_not_spa(self):
        response = self.http.get('/assets/main-abc.js')
        self.assertEqual(response.status_code, 200)
        self.assertIn('immutable', response.headers['Cache-Control'])
        response.close()
        for route in ('/assets/missing.js', '/images/missing.png', '/.env', '/../outside.txt'):
            self.assertEqual(self.http.get(route).status_code, 404)

    def test_unknown_api_remains_json_404(self):
        self.assertEqual(self.http.get('/api/example').json, {'data': 'real API'})
        response = self.http.get('/api/missing')
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json, {'error': 'API endpoint not found.'})

    def test_health_reports_missing_build(self):
        self.assertEqual(self.http.get('/healthz').status_code, 200)
        (self.dist / 'index.html').unlink()
        self.assertEqual(self.http.get('/healthz').status_code, 503)
        self.assertEqual(self.http.get('/').status_code, 503)

    def test_app_preserves_static_cache_but_never_caches_api(self):
        from backend.app import app
        with app.test_request_context('/api/example'):
            response = app.process_response(app.response_class('private'))
            self.assertEqual(response.headers['Cache-Control'], 'no-store')
        with app.test_request_context('/assets/main-abc.js'):
            response = app.response_class('asset', headers={'Cache-Control': 'public, max-age=31536000, immutable'})
            self.assertIn('immutable', app.process_response(response).headers['Cache-Control'])
