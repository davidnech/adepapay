"""Same-origin authentication API. Run: python -m backend.app"""
import os
import re
import hashlib
import hmac
from uuid import uuid4
from datetime import timedelta
from datetime import date
from urllib.parse import urlsplit

import httpx
from flask import Flask, jsonify, request, session as admin_session
from supabase_auth.errors import AuthApiError, AuthRetryableError
if __package__:
    from .sms_verification import (register_sms_verification, start_or_resume,
        complete_signup, clear_challenge, require_verified_user)
    from .frontend import register_frontend
    from .admin_workspace import register_admin_workspace
    from .admin_platform import register_admin_platform
    from .admin_operations import register_admin_operations
    from .db import connect_db, connect_admin
    from .store_approvals import register_store_approvals
    from .store_profile import register_store_profile
    from .store_directory import register_store_directory
    from .store_team import resolve_store, StoreAccessError
    from .field_agents import resolve_agent
    from .public_catalogue import register_public_catalogue
    from .site_features import register_site_features
    from .subscriptions import register_subscriptions
    from .subscription_access import subscription_info
else:
    from sms_verification import (register_sms_verification, start_or_resume,
        complete_signup, clear_challenge, require_verified_user)
    from frontend import register_frontend
    from admin_workspace import register_admin_workspace
    from admin_platform import register_admin_platform
    from admin_operations import register_admin_operations
    # Direct script execution puts backend/ itself on Python's import path.
    from db import connect_db, connect_admin
    from store_approvals import register_store_approvals
    from store_profile import register_store_profile
    from store_directory import register_store_directory
    from store_team import resolve_store, StoreAccessError
    from field_agents import resolve_agent
    from public_catalogue import register_public_catalogue
    from site_features import register_site_features
    from subscriptions import register_subscriptions
    from subscription_access import subscription_info

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024
app.config.update(
    SECRET_KEY=os.getenv('FLASK_SECRET_KEY'),
    SESSION_COOKIE_NAME='adepa_admin',
    SESSION_COOKIE_PATH='/api/auth',
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_SECURE=os.getenv('COOKIE_SECURE', 'false').lower() == 'true',
    PERMANENT_SESSION_LIFETIME=timedelta(days=30),
)
ACCESS, REFRESH, REMEMBER = 'adepa_access', 'adepa_refresh', 'adepa_remember'


def admin_credentials():
    return os.getenv('ADMIN_EMAIL', '').strip().lower(), os.getenv('ADMIN_PASSWORD', '')


def admin_version():
    email, password = admin_credentials()
    # A credential change invalidates existing admin sessions after restart.
    return hmac.new(app.secret_key.encode(), (email + '\0' + password).encode(), hashlib.sha256).hexdigest()


def admin_user():
    email, _ = admin_credentials()
    return {'id': 'environment-admin', 'email': email, 'name': 'Administrator', 'role': 'Admin'}


def authorized_admin():
    email, password = admin_credentials()
    version = admin_session.get('admin_version')
    if app.secret_key and email and password and isinstance(version, str) and hmac.compare_digest(version, admin_version()):
        return email
    return None


def clear_cookies(response):
    for name in (ACCESS, REFRESH, REMEMBER):
        response.delete_cookie(name, path='/api/auth')
    return response


def set_cookies(response, session, remember=False):
    if not session:
        return response
    for name, value in ((ACCESS, session.access_token), (REFRESH, session.refresh_token),
                        (REMEMBER, '1' if remember else '0')):
        response.set_cookie(name, value, httponly=True, samesite='Lax',
                            secure=os.getenv('COOKIE_SECURE', 'false').lower() == 'true',
                            path='/api/auth', max_age=30 * 86400 if remember else None)
    return response


def public_user(user):
    if user.app_metadata.get('role') == 'Field Agent':
        agent, store = resolve_agent(user, connect_admin)
        return {'id':user.id,'email':user.email,'name':agent['profile']['fullName'],'role':'Field Agent',
                'store':{'id':store.id,'name':store.app_metadata.get('store_profile',{}).get('storeName') or store.app_metadata['store_review']['application'].get('storeName',''),'reference':''}}
    if user.app_metadata.get('store_staff') is not None:
        owner = resolve_store(user, connect_admin)
        member = user.app_metadata['store_staff']
        application = owner.app_metadata['store_review']['application']
        return {'id': user.id, 'email': user.email, 'name': member['name'], 'role': 'Store Manager',
                'subscription': subscription_info(owner), 'staff': True, 'roleTitle': member['title'], 'permissions': member['permissions'],
                'store': {'id': owner.id, 'name': owner.app_metadata.get('store_profile', {}).get('storeName', application.get('storeName', '')),
                          'reference': application.get('reference', '')}}
    # User-editable metadata must never grant elevated permissions.
    role = user.app_metadata.get('role', 'Customer')
    if role not in ('Customer', 'Store Manager', 'Field Agent', 'Admin'):
        role = 'Customer'
    result = {'id': user.id, 'email': user.email, 'role': role,
              'name': user.user_metadata.get('firstName', '')}
    review = user.app_metadata.get('store_review', {})
    if not isinstance(review, dict):
        review = {}
    application = review.get('application') or user.user_metadata.get('store_application')
    if role == 'Store Manager' and review.get('status') in ('Suspended', 'Deleted'):
        raise StoreAccessError('This store is suspended or deleted. Contact the administrator.', 401)
    if role == 'Store Manager' and review.get('status') == 'Approved' and isinstance(application, dict):
        result['subscription'] = subscription_info(user)
        result['store'] = {'id': user.app_metadata.get('store_id'),
                           'name': str(application.get('storeName', '')),
                           'reference': str(application.get('reference', ''))}
    if role == 'Customer' and isinstance(application, dict):
        # Self-declared applications grant no store privileges or approval.
        result['store_application'] = {
            'storeName': str(application.get('storeName', '')),
            'reference': str(application.get('reference', '')),
            'status': review.get('status', 'Pending Approval'),
            'reason': review.get('reason', ''),
        }
    return result


@app.before_request
def protect_mutations():
    if request.method == 'POST':
        # JSON-only requests plus no CORS prevent cross-origin form submissions.
        image_upload = request.path in ('/api/auth/images/upload','/api/auth/customer/upload')
        if image_upload:
            request.max_content_length = 6 * 1024 * 1024
            if request.headers.get('X-Requested-With') != 'AdepaPay':
                return jsonify(error='Invalid upload request.'), 403
        if not image_upload and not request.is_json:
            return jsonify(error='A JSON request is required.'), 415
        origin = request.headers.get('Origin')
        allowed = os.getenv('APP_ORIGIN')
        if origin and ((allowed and origin.rstrip('/') != allowed.rstrip('/')) or
                       (not allowed and urlsplit(origin).netloc != request.host)):
            return jsonify(error='Request origin is not allowed.'), 403


@app.after_request
def no_cache(response):
    if request.path == '/api' or request.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-store'
    return response


@app.errorhandler(StoreAccessError)
def store_access_error(error):
    response = jsonify(error=str(error))
    response.status_code = error.status
    if error.status == 401:
        clear_cookies(response)
    return response


@app.errorhandler(AuthApiError)
def auth_error(error):
    code = getattr(error, 'code', '')
    if request.path.startswith('/api/auth/admin/'):
        upstream_status = getattr(error, 'status', 0)
        # Record diagnostics without logging keys, passwords, or account data.
        app.logger.warning('Supabase admin API failed: status=%s code=%s', upstream_status, code)
        if upstream_status in (401, 403):
            return jsonify(error=(
                'Supabase rejected the server admin key. Your admin login is valid. '
                'Set SUPABASE_SECRET_KEY to an active secret key from the same Supabase '
                'project as SUPABASE_URL, save .env, and restart the Python backend.'
            )), 503
        if upstream_status == 429:
            return jsonify(error='Supabase is limiting requests. Wait a moment, then refresh store approvals.'), 429
        if upstream_status == 404:
            return jsonify(error='This store account no longer exists. Refresh the application list.'), 404
        return jsonify(error='Supabase could not complete the store approval request. Refresh to check its status before retrying.'), 502
    messages = {
        'phone_not_verified': 'Verify your phone number before signing in.',
        'invalid_credentials': 'The email or password is incorrect.',
        'email_not_confirmed': 'Confirm your email address before signing in.',
        'user_already_exists': 'Unable to register this email. Try signing in instead.',
        'email_exists': 'Unable to register this email. Try signing in instead.',
        'weak_password': 'Choose a stronger password with at least 8 characters.',
        'signup_disabled': 'Registration is currently disabled. Please contact support.',
        'over_email_send_rate_limit': 'Too many emails requested. Please wait before trying again.',
        'over_request_rate_limit': 'Too many attempts. Please wait before trying again.',
    }
    status = 403 if code == 'phone_not_verified' else 429 if getattr(error, 'status', 0) == 429 else 400
    response = jsonify(error=messages.get(code, 'Authentication failed. Check your details and try again.'))
    response.status_code = status
    if request.path.endswith('/session'):
        response.status_code = 401
        clear_cookies(response)
    return response


@app.errorhandler(httpx.HTTPError)
@app.errorhandler(AuthRetryableError)
def unavailable(error):
    return jsonify(error='Authentication is temporarily unavailable. Please try again shortly.'), 503


def credentials(data):
    email, password = data.get('email'), data.get('password')
    if not isinstance(email, str) or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email.strip()):
        raise ValueError('Enter a valid email address.')
    if not isinstance(password, str) or not password or len(password) > 256:
        raise ValueError('Enter a password of no more than 256 characters.')
    return {'email': email.strip().lower(), 'password': password}


def payload():
    data = request.get_json()
    if not isinstance(data, dict):
        raise ValueError('Expected an object containing your details.')
    return data


@app.errorhandler(ValueError)
def invalid(error):
    return jsonify(error=str(error)), 400


@app.post('/api/auth/signup')
def signup():
    data = payload()
    values = credentials(data)
    if values['email'] == admin_credentials()[0]:
        raise ValueError('This email is reserved. Please sign in instead.')
    if len(values['password']) < 8:
        raise ValueError('Password must contain at least 8 characters.')
    if data.get('agreeTerms') is not True or data.get('agreePrivacy') is not True:
        raise ValueError('Accept the Terms and Privacy Policy to continue.')
    fields = ('firstName', 'middleName', 'lastName', 'dob', 'gender',
              'phone', 'region', 'city', 'address')
    profile = {}
    for field in fields:
        value = data.get(field, '')
        if not isinstance(value, str) or len(value) > 300:
            raise ValueError('Please check your profile details.')
        if field != 'middleName' and not value.strip():
            raise ValueError('Complete all required profile details.')
        profile[field] = value.strip()
    profile['nationality'] = 'Ghana'
    if profile['gender'] not in ('Male', 'Female'):
        raise ValueError('Please select Male or Female.')
    born = date.fromisoformat(profile['dob'])
    today = date.today()
    age = today.year - born.year - ((today.month, today.day) < (born.month, born.day))
    if age < 18 or age > 120:
        raise ValueError('You must be at least 18 years old to register.')
    phone = re.sub(r'[\s()-]', '', profile['phone'])
    if not re.fullmatch(r'(?:\+233|233|0)[235]\d{8}', phone):
        raise ValueError('Enter a valid Ghanaian phone number.')
    profile.update(agreeTerms=True, agreePrivacy=True, receiveUpdates=data.get('receiveUpdates') is True)
    admin = connect_admin()
    challenge, token, pending = start_or_resume(admin, profile['phone'], values['email'], 'customer')
    if pending is not None:
        return pending
    # Supabase stores passwords in Auth, never in a public table or user metadata.
    result = connect_db().auth.sign_up({**values, 'options': {'data': profile}})
    welcome_sent = complete_signup(admin, result.user, challenge, token)
    if result.session and app.secret_key:
        admin_session.clear()
    response = jsonify(confirmation_required=result.session is None, welcome_sms_sent=welcome_sent,
                       user=public_user(result.user) if result.session else None)
    response.status_code = 201
    return clear_challenge(set_cookies(response, result.session))


@app.post('/api/auth/store-signup')
def store_signup():
    data = payload()
    values = credentials(data)
    if values['email'] == admin_credentials()[0]:
        raise ValueError('This email is reserved. Please sign in instead.')
    if len(values['password']) < 8:
        raise ValueError('Password must contain at least 8 characters.')
    if data.get('agreeTerms') is not True:
        raise ValueError('Accept the Terms and Privacy Policy to continue.')
    application = {}
    for field in ('storeName', 'registeredName', 'registrationNumber', 'storeType',
                  'officeClassification', 'ownerName', 'phone', 'region', 'city'):
        value = data.get(field)
        if not isinstance(value, str) or not value.strip() or len(value) > 300:
            raise ValueError('Complete all required store details (maximum 300 characters per field).')
        application[field] = value.strip()
    phone = re.sub(r'[\s()-]', '', application['phone'])
    if not re.fullmatch(r'(?:\+233|233|0)[235]\d{8}', phone):
        raise ValueError('Enter a valid Ghanaian phone number.')
    if application['officeClassification'] not in ('Main head office', 'Branch'):
        raise ValueError('Choose Main head office or Branch.')
    categories = data.get('categories')
    if not isinstance(categories, list) or not 1 <= len(categories) <= 100 or any(
        not isinstance(item, str) or not item.strip() or len(item) > 150 for item in categories
    ):
        raise ValueError('Choose at least one valid product category.')
    application.update(categories=list(dict.fromkeys(item.strip() for item in categories)),
                       reference=f'BPS-{uuid4().hex.upper()}', agreeTerms=True)
    admin = connect_admin()
    challenge, token, pending = start_or_resume(admin, application['phone'], values['email'], 'store')
    if pending is not None:
        return pending
    result = connect_db().auth.sign_up({**values, 'options': {'data': {
        'firstName': application['ownerName'], 'store_application': application,
    }}})
    welcome_sent = complete_signup(admin, result.user, challenge, token)
    if result.session and app.secret_key:
        admin_session.clear()
    response = jsonify(confirmation_required=result.session is None, welcome_sms_sent=welcome_sent,
                       user=public_user(result.user) if result.session else None,
                       application_reference=application['reference'] if result.session else None)
    response.status_code = 201
    return clear_challenge(set_cookies(response, result.session))


@app.post('/api/auth/login')
def login():
    data = payload()
    values = credentials(data)
    email, password = admin_credentials()
    if email and values['email'] == email:
        if not password or not hmac.compare_digest(values['password'].encode(), password.encode()):
            return jsonify(error='The email or password is incorrect.'), 400
        if not app.secret_key:
            return jsonify(error='Admin login is not configured on the server.'), 503
        admin_session.clear()
        admin_session['admin_version'] = admin_version()
        admin_session.permanent = data.get('remember') is True
        return clear_cookies(jsonify(user=admin_user()))
    result = connect_db().auth.sign_in_with_password(values)
    if result.user.app_metadata.get('sms_verification_required') is True:
        # Resume accounts whose signup was interrupted after Auth creation.
        profile = result.user.user_metadata or {}
        application = profile.get('store_application')
        purpose = 'store' if isinstance(application, dict) else 'customer'
        phone = application.get('phone', '') if purpose == 'store' else profile.get('phone', '')
        admin = connect_admin()
        challenge, token, pending = start_or_resume(admin, phone, values['email'], purpose)
        if pending is not None:
            return pending
        complete_signup(admin, result.user, challenge, token)
    require_verified_user(result.user)
    if app.secret_key:
        admin_session.clear()
    return clear_challenge(set_cookies(jsonify(user=public_user(result.user)), result.session, data.get('remember') is True))


@app.get('/api/auth/session')
def session():
    version = admin_session.get('admin_version')
    if version:
        email, password = admin_credentials()
        if email and password and hmac.compare_digest(str(version), admin_version()):
            return jsonify(user=admin_user())
        admin_session.clear()
        return clear_cookies(jsonify(user=None)), 401
    access, refresh = request.cookies.get(ACCESS), request.cookies.get(REFRESH)
    if not access:
        return clear_cookies(jsonify(user=None)), 401
    client = connect_db()
    try:
        user = client.auth.get_user(access).user
        require_verified_user(user)
        return jsonify(user=public_user(user))
    except AuthApiError as error:
        if getattr(error, 'status', 0) not in (401, 403) and getattr(error, 'code', '') != 'bad_jwt':
            raise
        if not refresh:
            return clear_cookies(jsonify(user=None)), 401
        renewed = client.auth.refresh_session(refresh)
        require_verified_user(renewed.user)
        return set_cookies(jsonify(user=public_user(renewed.user)), renewed.session,
                           request.cookies.get(REMEMBER) == '1')


@app.post('/api/auth/logout')
def logout():
    if app.secret_key:
        admin_session.clear()
    access, refresh = request.cookies.get(ACCESS), request.cookies.get(REFRESH)
    if access and refresh:
        try:
            client = connect_db()
            client.auth.set_session(access, refresh)
            client.auth.sign_out({'scope': 'local'})
        except AuthApiError:
            pass  # Already-expired sessions must still be removable.
    return clear_cookies(jsonify(user=None))


register_store_approvals(app, lambda: connect_admin(), authorized_admin)
register_store_directory(app, lambda: connect_admin(), authorized_admin)
register_admin_operations(app, lambda: connect_admin(), authorized_admin)
register_admin_platform(app, lambda: connect_admin(), lambda: connect_db(), authorized_admin)
register_admin_workspace(app, lambda: connect_admin(), authorized_admin)
register_subscriptions(app, lambda: connect_db(), lambda: connect_admin(), authorized_admin)
register_public_catalogue(app, lambda: connect_admin())
register_site_features(app, lambda: connect_admin(), authorized_admin)


register_store_profile(app, lambda: connect_db(), lambda: connect_admin(), set_cookies)


@app.errorhandler(413)
def upload_too_large(error):
    if request.path == '/api/auth/customer/applications':
        return jsonify(error='The application is too large. Shorten the text fields.'),413
    if request.path == '/api/auth/store/agents':
        return jsonify(error='The agent profile is too large. Shorten the text fields.'), 413
    if request.path == '/api/auth/store/promotions':
        return jsonify(error='The promotion settings are too large. Shorten descriptions or remove unused offers.'), 413
    if request.path == '/api/auth/store/products':
        return jsonify(error='The product details are too large. Shorten the description and policies.'), 413
    if request.path == '/api/auth/store/rules':
        return jsonify(error='The rules are too long. Shorten the return conditions and agreement clauses.'), 413
    return jsonify(error='The upload is too large. Choose an image smaller than 5 MB.'), 413


register_sms_verification(app, lambda: connect_admin())
register_frontend(app)


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=int(os.getenv('BACKEND_PORT', '5000')))
