"""Keep metadata-heavy Supabase JWTs below browsers' per-cookie size limit."""
import os
import re

from flask import request

ACCESS, REFRESH, REMEMBER = 'adepa_access', 'adepa_refresh', 'adepa_remember'
CHUNK_SIZE = 3000
MAX_CHUNKS = 16
CHUNK_PREFIX = 'chunks:'


def access_token():
    value = request.cookies.get(ACCESS)
    if not value or not value.startswith(CHUNK_PREFIX):
        return value
    count = value[len(CHUNK_PREFIX):]
    if len(count) > 2 or not count.isascii() or not count.isdigit() or not 2 <= int(count) <= MAX_CHUNKS:
        return None
    parts = [request.cookies.get(f'{ACCESS}.{index}') for index in range(int(count))]
    if any(not part or len(part) > CHUNK_SIZE for part in parts):
        return None
    # The reconstructed JWT still goes through Supabase authentication.
    return ''.join(parts)


def chunk_names():
    return [name for name in request.cookies if re.fullmatch(r'adepa_access\.\d+', name)]


def clear_cookies(response):
    for name in (ACCESS, REFRESH, REMEMBER, *chunk_names()):
        response.delete_cookie(name, path='/api/auth')
    return response


def set_cookies(response, session, remember=False):
    if not session:
        return response
    token = session.access_token
    values = {ACCESS: token, REFRESH: session.refresh_token, REMEMBER: '1' if remember else '0'}
    if len(token) > CHUNK_SIZE:
        parts = [token[start:start + CHUNK_SIZE] for start in range(0, len(token), CHUNK_SIZE)]
        if len(parts) > MAX_CHUNKS:
            raise ValueError('Your session is too large. Contact the administrator.')
        values[ACCESS] = f'{CHUNK_PREFIX}{len(parts)}'
        values.update({f'{ACCESS}.{index}': part for index, part in enumerate(parts)})
    for name in chunk_names():
        if name not in values:
            response.delete_cookie(name, path='/api/auth')
    for name, value in values.items():
        response.set_cookie(name, value, httponly=True, samesite='Lax',
                            secure=os.getenv('COOKIE_SECURE', 'false').lower() == 'true',
                            path='/api/auth', max_age=30 * 86400 if remember else None)
    return response
