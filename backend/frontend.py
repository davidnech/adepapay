"""Serve the built SPA and API from the same origin in production."""
import os
from pathlib import Path

from flask import abort, jsonify, send_from_directory
from werkzeug.utils import safe_join


def register_frontend(app, directory=None):
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
        response = send_from_directory(dist, 'index.html')
        response.headers['Cache-Control'] = 'no-cache'
        return response
