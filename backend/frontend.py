"""Serve public HTML, the private SPA and APIs from one production origin."""
import os
from pathlib import Path

from flask import abort, jsonify, send_from_directory
from werkzeug.utils import safe_join
if __package__:
    from .public_seo import render_public, public_error, robots_response, sitemap_response, PRIVATE, PRIVATE_PREFIXES
else:
    from public_seo import render_public, public_error, robots_response, sitemap_response, PRIVATE, PRIVATE_PREFIXES


def register_frontend(app, directory=None, public_pages=True):
    dist = Path(directory or os.getenv('FRONTEND_DIST') or
                Path(__file__).resolve().parents[1] / 'dist').resolve()

    @app.get('/healthz')
    def health():
        ready = (dist / 'index.html').is_file()
        response = jsonify(status='ok' if ready else 'unavailable')
        response.headers['Cache-Control'] = 'no-store'
        return response, 200 if ready else 503

    @app.get('/')
    @app.get('/<path:filename>')
    def frontend(filename=''):
        if filename == 'api' or filename.startswith('api/'):
            return jsonify(error='API endpoint not found.'), 404
        if public_pages and filename == 'robots.txt': return robots_response()
        if public_pages and (filename == 'sitemap.xml' or filename.startswith('sitemaps/')): return sitemap_response('/'+filename)
        # Never serve hidden files or traverse outside the built frontend.
        if any(part.startswith('.') for part in filename.split('/')):
            abort(404)
        target = safe_join(str(dist), filename)
        if target is None:
            abort(404)
        if filename and Path(target).is_file():
            response = send_from_directory(dist, filename)
            response.headers['Cache-Control'] = (
                'public, max-age=31536000, immutable' if filename.startswith('assets/')
                else 'no-cache'
            )
            return response
        if filename.startswith('assets/') or Path(filename).suffix:
            abort(404)
        if not (dist / 'index.html').is_file():
            return jsonify(error='Frontend build is unavailable.'), 503
        if public_pages:
            public = render_public(dist,'/'+filename)
            if public is not None: return public
        first=filename.split('/')[0]
        private = first in PRIVATE or first in PRIVATE_PREFIXES
        if filename and not private and not (not public_pages and filename == 'services'):
            return public_error(dist,404,'Page not found') if public_pages else (jsonify(error='Page not found.'),404)
        response = send_from_directory(dist, 'index.html')
        response.headers['Cache-Control'] = 'no-cache'
        response.headers['X-Robots-Tag'] = 'noindex,follow'
        return response
