"""Profile routes scoped to the authenticated, approved store owner."""
import hashlib
import json
import re
from datetime import datetime, timezone
from urllib.parse import urlsplit
from flask import jsonify, request, g
from itsdangerous import URLSafeTimedSerializer, BadSignature
from supabase_auth.errors import AuthApiError

try:
    from .image_uploader import upload_image, ImageUploadError
    from .store_settings import register_store_settings
    from .store_rules import register_store_rules
    from .store_products import register_store_products
    from .store_promotions import register_store_promotions
    from .store_catalogue import register_store_catalogue
    from .field_agents import register_field_agents
    from .customer_applications import register_customer_applications
    from .store_team import resolve_store, register_store_team
except ImportError:
    from image_uploader import upload_image, ImageUploadError
    from store_settings import register_store_settings
    from store_rules import register_store_rules
    from store_products import register_store_products
    from store_promotions import register_store_promotions
    from store_catalogue import register_store_catalogue
    from field_agents import register_field_agents
    from customer_applications import register_customer_applications
    from store_team import resolve_store, register_store_team

EDITABLE = ('storeName', 'phone', 'contactEmail', 'region', 'city', 'operatingLocation',
            'nearestLandmark', 'gpsAddress', 'openingHours', 'description', 'website')


def profile_for(user):
    reviewed = user.app_metadata.get('store_review', {}).get('application', {})
    saved = user.app_metadata.get('store_profile', {})
    fields = {key: str(saved.get(key, reviewed.get(key, ''))) for key in EDITABLE}
    fields['contactEmail'] = str(saved.get('contactEmail', user.email or ''))
    version = hashlib.sha256(json.dumps(saved, sort_keys=True).encode()).hexdigest()
    return dict(fields, id=user.app_metadata['store_id'], email=user.email,
                registeredName=reviewed.get('registeredName', ''),
                registrationNumber=reviewed.get('registrationNumber', ''),
                ownerName=reviewed.get('ownerName', ''), storeType=reviewed.get('storeType', ''),
                officeClassification=reviewed.get('officeClassification', ''),
                categories=reviewed.get('categories', []), verification='Verified',
                logo=saved.get('logo'), cover=saved.get('cover'), version=version)


def register_store_profile(app, connect_db, connect_admin, set_cookies):
    def owner(required_page=None):
        token = request.cookies.get('adepa_access')
        if not token:
            return None, (jsonify(error='Sign in to your store account.'), 401)
        client = connect_db()
        try:
            user = client.auth.get_user(token).user
        except AuthApiError as error:
            if error.status not in (401, 403) and error.code != 'bad_jwt':
                raise
            refresh = request.cookies.get('adepa_refresh')
            if not refresh:
                return None, (jsonify(error='Your session expired. Please sign in again.'), 401)
            try:
                result = client.auth.refresh_session(refresh)
            except AuthApiError:
                return None, (jsonify(error='Your session expired. Please sign in again.'), 401)
            user = result.user
            g.profile_session = result.session
        g.store_actor = user
        page = {'/api/auth/store/profile': 'store-profile', '/api/auth/images/upload': 'store-profile',
                '/api/auth/store/settings': 'store-settings', '/api/auth/store/team': 'team-access',
                '/api/auth/store/rules': 'shop-rules', '/api/auth/store/products': 'products',
                '/api/auth/store/promotions': 'promotions', '/api/auth/store/categories': 'categories',
                '/api/auth/store/category-options': 'products',
                '/api/auth/store/trade-inventory': 'trade-in-inventory',
                '/api/auth/store/agents': 'collection-agents', '/api/auth/store/agent-image': 'collection-agents'}.get(request.path)
        if request.path == '/api/auth/images/upload':
            page = request.args.get('purpose', 'store-profile')
            if page not in ('store-profile', 'products', 'collection-agents'):
                raise ValueError('Choose a valid image upload purpose.')
        user = resolve_store(user, connect_admin, page=required_page or page or 'owner-only')
        return user, None

    register_store_team(app, owner, connect_admin)

    register_store_settings(app, owner, connect_admin)
    register_store_rules(app, owner, connect_admin)
    register_store_products(app, owner, connect_admin)
    register_store_promotions(app, owner, connect_admin)
    register_store_catalogue(app, owner, connect_admin)
    register_field_agents(app, owner, connect_db, connect_admin)
    register_customer_applications(app, owner, connect_db, connect_admin)

    @app.after_request
    def refresh_profile_session(response):
        if response.status_code != 401 and getattr(g, 'profile_session', None):
            set_cookies(response, g.profile_session, request.cookies.get('adepa_remember') == '1')
        return response

    @app.route('/api/auth/store/profile', methods=['GET', 'POST'])
    def store_profile():
        user, error = owner()
        if error:
            return error
        if request.method == 'GET':
            return jsonify(profile=profile_for(user))
        data = request.get_json()
        if not isinstance(data, dict):
            raise ValueError('Expected profile details.')
        if data.get('version') != profile_for(user)['version']:
            return jsonify(error='Your profile changed. Reload before saving again.'), 409
        saved = {}
        for key in EDITABLE:
            value = data.get(key, '')
            limit = 2000 if key == 'description' else 300
            if not isinstance(value, str) or len(value) > limit:
                raise ValueError(f'Please shorten {key} to {limit} characters.')
            saved[key] = value.strip()
        if any(not saved[key] for key in ('storeName', 'phone', 'contactEmail', 'region', 'city')):
            raise ValueError('Store name, phone, email, region and city are required.')
        if not re.fullmatch(r'(?:\+233|233|0)[235]\d{8}', re.sub(r'[\s()-]', '', saved['phone'])):
            raise ValueError('Enter a valid Ghanaian phone number.')
        if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', saved['contactEmail']):
            raise ValueError('Enter a valid contact email.')
        if saved['website']:
            url = urlsplit(saved['website'])
            if url.scheme not in ('http', 'https') or not url.hostname or url.username or url.password:
                raise ValueError('Enter a website URL beginning with https:// or http://.')
        previous = user.app_metadata.get('store_profile', {})
        signer = URLSafeTimedSerializer(app.secret_key, salt='image-upload')
        for slot in ('logo', 'cover'):
            image = data.get(slot)
            if image is None:
                saved[slot] = None
            elif image == previous.get(slot):
                saved[slot] = image
            else:
                try:
                    proof = signer.loads(image['upload_token'], max_age=86400)
                    if proof['owner'] != user.id:
                        raise BadSignature('Wrong owner')
                    saved[slot] = {'id': proof['id'], 'url': proof['url']}
                except (BadSignature, KeyError, TypeError):
                    raise ValueError('Please upload this image again before saving.') from None
        try:
            admin = connect_admin()
        except RuntimeError:
            return jsonify(error='Store profile saving is not configured. Contact the administrator.'), 503
        saved['updatedAt'] = datetime.now(timezone.utc).isoformat()
        result = admin.auth.admin.update_user_by_id(user.id, {'app_metadata': {**user.app_metadata, 'store_profile': saved}})
        return jsonify(profile=profile_for(result.user))

    @app.post('/api/auth/images/upload')
    def image_upload():
        user, error = owner()
        if error:
            return error
        try:
            if request.args.get('purpose') == 'collection-agents':
                image = upload_image(request.files.get('image'), user.id, private=True)
            else:
                image = upload_image(request.files.get('image'), user.id)
        except ImageUploadError as error:
            return jsonify(error=str(error)), 502
        image['upload_token'] = URLSafeTimedSerializer(app.secret_key, salt='image-upload').dumps({
            'owner': user.id, 'purpose': request.args.get('purpose', 'store-profile'), **image})
        if request.args.get('purpose') == 'collection-agents':
            image['url'] = '/api/auth/store/agent-image?ticket=' + image['upload_token']
        return jsonify(image=image)
