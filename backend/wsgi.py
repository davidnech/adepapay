"""Production entry point: gunicorn backend.wsgi:app."""
import os
from pathlib import Path
from urllib.parse import urlsplit

from werkzeug.middleware.proxy_fix import ProxyFix
from .app import app


def validate_environment():
    required = ('SUPABASE_URL', 'SUPABASE_KEY', 'FLASK_SECRET_KEY',
                'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'APP_ORIGIN')
    missing = [name for name in required if not os.getenv(name, '').strip()]
    if not (os.getenv('SUPABASE_SECRET_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')):
        missing.append('SUPABASE_SECRET_KEY')
    if missing:
        raise RuntimeError('Missing production environment variables: ' + ', '.join(missing))
    origin_value = os.environ['APP_ORIGIN'].strip().rstrip('/')
    origin = urlsplit(origin_value)
    if (origin.scheme != 'https' or not origin.netloc or origin.username or
            origin.path not in ('', '/') or origin.query or origin.fragment):
        raise RuntimeError('Set APP_ORIGIN to the actual HTTPS site URL, for example https://adepapay.onrender.com, without quotes, a page path, or a query string.')
    os.environ['APP_ORIGIN'] = origin_value
    if os.getenv('COOKIE_SECURE', '').lower() != 'true':
        raise RuntimeError('Set COOKIE_SECURE=true for production.')
    dist = Path(os.getenv('FRONTEND_DIST') or Path(__file__).resolve().parents[1] / 'dist')
    if not (dist / 'index.html').is_file():
        raise RuntimeError('Frontend build is missing. Use the Render build command: pip install -r requirements.txt && npm ci --include=dev && npm run build.')


validate_environment()
# Render terminates TLS at its proxy. Trust its scheme header, not host overrides.
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=0, x_proto=1, x_host=0, x_port=0, x_prefix=0)
