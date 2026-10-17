"""VireSend signup verification. No passwords or plaintext codes are persisted."""
import hashlib
import hmac
import math
import os
import re
import secrets
from datetime import datetime, timezone
from uuid import uuid4

import httpx
from flask import jsonify, request, current_app
from itsdangerous import URLSafeTimedSerializer, BadSignature
from postgrest.exceptions import APIError
from supabase_auth.errors import AuthApiError

COOKIE = 'adepa_signup_sms'
SENDER = 'Adepapay'
# The documented www host redirects this POST to the apex host. Call the
# verified canonical API directly: redirects may fail or strip Authorization.
SMS_SEND_URL = 'https://viresender.com/v1/sms/send'


class SMSVerificationError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def require_verified_user(user):
    metadata = user.app_metadata or {}
    if metadata.get('sms_verification_required') is True:
        raise AuthApiError('Verify your phone number before signing in.', 403, 'phone_not_verified')


def canonical_phone(value):
    phone = re.sub(r'[\s()-]', '', value)
    if phone.startswith('+'):
        phone = phone[1:]
    if phone.startswith('0'):
        phone = '233' + phone[1:]
    if not re.fullmatch(r'233[235]\d{8}', phone):
        raise ValueError('Enter a valid Ghanaian phone number.')
    return phone


def configured():
    if not os.getenv('VIRESEND_API_KEY', '').strip():
        raise SMSVerificationError('SMS verification is not configured. Add VIRESEND_API_KEY on the server.', 503)
    if not current_app.secret_key:
        raise SMSVerificationError('SMS verification requires FLASK_SECRET_KEY on the server.', 503)


def serializer():
    return URLSafeTimedSerializer(current_app.secret_key, salt='signup-sms-v1')


def digest(value):
    key = current_app.secret_key
    if isinstance(key, str):
        key = key.encode()
    return hmac.new(key, value.encode(), hashlib.sha256).hexdigest()


def code_digest(identifier, code):
    return digest('code:' + identifier + ':' + code)


def rpc(client, name, data):
    try:
        return client.rpc(name, data).execute().data
    except APIError as error:
        message = str(error.message)
        allowed = ('Wait 60 seconds', 'Too many SMS requests', 'Too many incorrect codes',
                   'SMS resend limit', 'Start registration again', 'Verify your phone',
                   'Registration could not be completed')
        if message.startswith(allowed):
            raise SMSVerificationError(message, 429 if message.startswith(('Wait', 'Too many', 'SMS resend')) else 400) from None
        raise SMSVerificationError('SMS verification storage is unavailable. Apply migration 017_signup_sms.sql, then retry.', 503) from None


def send_sms(phone, message):
    configured()
    try:
        response = httpx.post(SMS_SEND_URL,
            headers={'Authorization': 'Bearer ' + os.environ['VIRESEND_API_KEY'].strip(),
                     'Content-Type': 'application/json'},
            json={'to': phone, 'message': message, 'sender_id': SENDER}, timeout=15)
        response.raise_for_status()
        result = response.json()
        if not isinstance(result, dict) or result.get('success') is not True:
            raise SMSVerificationError('The SMS provider did not accept the message. Please request another code.', 502)
    except httpx.HTTPStatusError as error:
        status = error.response.status_code
        # Never log provider bodies/headers: they may contain the key or OTP.
        current_app.logger.warning('VireSend SMS rejected: HTTP %s', status)
        if status in (401, 403):
            message = 'VireSend rejected authentication. Check VIRESEND_API_KEY and SMS permissions on the server.'
        elif status == 402:
            message = 'VireSend could not send the message. Check your SMS wallet balance.'
        elif status == 429:
            message = 'VireSend is limiting SMS requests. Wait before requesting another code.'
        elif 300 <= status < 400:
            message = 'VireSend redirected the SMS endpoint. Contact support to check the server integration.'
        else:
            message = f'VireSend rejected the SMS request (HTTP {status}). Contact support to check the SMS settings.'
        raise SMSVerificationError(message, 502) from None
    except (httpx.HTTPError, ValueError):
        current_app.logger.warning('VireSend SMS request could not be confirmed.')
        raise SMSVerificationError('The SMS could not be confirmed. If a code arrives, use it; otherwise request another code.', 502) from None


def challenge_cookie():
    try:
        value = serializer().loads(request.cookies.get(COOKIE, ''), max_age=1800)
        if not isinstance(value, dict) or not isinstance(value.get('id'), str) or not isinstance(value.get('secret'), str):
            return None
        return value
    except BadSignature:
        return None


def load_challenge(client, token):
    if not token:
        return None
    try:
        rows = client.table('signup_sms_challenges').select('*').eq('id', token['id']).eq('secret_hash', digest('secret:' + token['secret'])).limit(1).execute().data
        return rows[0] if rows else None
    except APIError:
        raise SMSVerificationError('SMS verification storage is unavailable. Apply migration 017_signup_sms.sql, then retry.', 503) from None


def timestamp(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00'))


def verification_response(row, token, notice=''):
    now = datetime.now(timezone.utc)
    response = jsonify(verification_required=True, verification={
        'phone': '+233 ' + '••• •• ' + row['phone'][-4:],
        'expiresAt': row['expires_at'],
        'resendAfter': max(0, math.ceil(60 - (now - timestamp(row['last_sent_at'])).total_seconds())),
        'notice': notice,
    })
    response.status_code = 202
    response.set_cookie(COOKIE, serializer().dumps(token), max_age=1800, httponly=True,
                        secure=os.getenv('COOKIE_SECURE', 'false').lower() == 'true',
                        samesite='Lax', path='/api/auth')
    return response


def start_or_resume(client, phone, email, purpose):
    configured()
    phone = canonical_phone(phone)
    token = challenge_cookie()
    row = load_challenge(client, token)
    now = datetime.now(timezone.utc)
    if row and row['phone'] == phone and row['email'] == email and row['purpose'] == purpose:
        if row['status'] == 'Verified' and timestamp(row['expires_at']) > now:
            return row, token, None
        if row['status'] == 'Pending' and timestamp(row['created_at']).timestamp() + 1800 > now.timestamp():
            return None, token, verification_response(row, token)
    identifier = str(uuid4())
    token = {'id': identifier, 'secret': secrets.token_urlsafe(32)}
    code = f'{secrets.randbelow(1000000):06d}'
    row = rpc(client, 'signup_sms_begin', dict(p_id=identifier, p_phone=phone, p_email=email,
              p_purpose=purpose, p_secret=digest('secret:' + token['secret']), p_code=code_digest(identifier, code)))
    notice = ''
    try:
        send_sms(phone, f'Your Adepapay verification code is {code}. It expires in 10 minutes. Do not share this code.')
    except SMSVerificationError as error:
        notice = str(error)
    return None, token, verification_response(row, token, notice)


def complete_signup(client, user, row, token):
    # Supabase may return an obfuscated user for an already registered email.
    if not user or not getattr(user, 'id', None) or getattr(user, 'identities', None) == []:
        raise SMSVerificationError('Unable to register this email. Try signing in instead.')
    metadata = rpc(client, 'signup_sms_complete', dict(p_id=row['id'],
                   p_secret=digest('secret:' + token['secret']), p_user=str(user.id)))
    user.app_metadata = metadata
    welcome = ('Welcome to Adepapay! Your phone is verified and your store application has been received. Store access is pending administrator approval.'
               if row['purpose'] == 'store' else
               'Welcome to Adepapay! Your phone is verified and your customer registration is successful. Sign in to start shopping.')
    sent = True
    try:
        send_sms(row['phone'], welcome)
    except SMSVerificationError:
        sent = False  # A welcome-message failure must not turn a successful signup into a retry.
    return sent


def clear_challenge(response):
    response.delete_cookie(COOKIE, path='/api/auth')
    return response


def register_sms_verification(app, connect_admin):
    @app.errorhandler(SMSVerificationError)
    def sms_error(error):
        return jsonify(error=str(error)), error.status

    @app.post('/api/auth/sms/verify')
    def signup_sms_verify():
        configured()
        data = request.get_json()
        code = data.get('code') if isinstance(data, dict) else None
        if not isinstance(code, str) or not re.fullmatch(r'\d{6}', code):
            raise ValueError('Enter the six-digit code sent to your phone.')
        token = challenge_cookie()
        if not token:
            raise SMSVerificationError('Start registration again to request a code.')
        result = rpc(connect_admin(), 'signup_sms_verify', dict(p_id=token['id'],
                     p_secret=digest('secret:' + token['secret']), p_code=code_digest(token['id'], code)))
        if not result.get('verified'):
            raise SMSVerificationError(result.get('error', 'Unable to verify this code.'),
                                       429 if result.get('error', '').startswith('Too many') else 400)
        return jsonify(verified=True)

    @app.post('/api/auth/sms/resend')
    def signup_sms_resend():
        configured()
        token = challenge_cookie()
        if not token:
            raise SMSVerificationError('Start registration again to request a code.')
        client = connect_admin()
        code = f'{secrets.randbelow(1000000):06d}'
        row = rpc(client, 'signup_sms_resend', dict(p_id=token['id'],
                  p_secret=digest('secret:' + token['secret']), p_code=code_digest(token['id'], code)))
        notice = ''
        try:
            send_sms(row['phone'], f'Your Adepapay verification code is {code}. It expires in 10 minutes. Do not share this code.')
        except SMSVerificationError as error:
            notice = str(error)
        return verification_response(row, token, notice)
