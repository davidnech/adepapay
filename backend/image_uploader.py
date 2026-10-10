"""Reusable Cloudflare Images uploader. Credentials never leave the backend."""
import io
import os
import warnings
import logging
from urllib.parse import urlsplit, quote

import httpx
from PIL import Image, UnidentifiedImageError
from werkzeug.utils import secure_filename

MAX_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_FORMATS = {'JPEG': 'image/jpeg', 'PNG': 'image/png', 'GIF': 'image/gif', 'WEBP': 'image/webp'}

class ImageUploadError(Exception):
    pass


def upload_image(file, owner_id, private=False):
    if file is None or not file.filename:
        raise ValueError('Choose an image to upload.')
    content = file.stream.read(MAX_IMAGE_BYTES + 1)
    if not content or len(content) > MAX_IMAGE_BYTES:
        raise ValueError('Choose an image smaller than 5 MB.')
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(content)) as picture:
                mime = ALLOWED_FORMATS.get(picture.format)
                if not mime or picture.width * picture.height > 25_000_000:
                    raise ValueError('Use a JPEG, PNG, GIF or WebP image up to 25 megapixels.')
                picture.verify()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise ValueError('This file is not a valid supported image.') from None
    account, token, delivery = (os.getenv(name, '').strip() for name in ('CF_ACCOUNT_ID', 'CF_IMAGES_TOKEN', 'CF_HASH'))
    variant = os.getenv('CF_IMAGES_VARIANT', 'public')
    if not all((account, token, delivery)):
        raise ImageUploadError('Image uploads are not configured on the server.')
    try:
        with httpx.Client(timeout=60) as client:
            response = client.post(f'https://api.cloudflare.com/client/v4/accounts/{account}/images/v2/direct_upload',
                                   headers={'Authorization': f'Bearer {token}'},
                                   files={'creator': (None, owner_id), 'requireSignedURLs': (None, 'true' if private else 'false')})
            payload = response.json()
            if not response.is_success or not payload.get('success'):
                logging.getLogger(__name__).warning('Cloudflare upload authorization failed: HTTP %s', response.status_code)
                if response.status_code in (401, 403):
                    raise ImageUploadError('Cloudflare rejected the Images token or account permissions. Contact the administrator.')
                if response.status_code == 429:
                    raise ImageUploadError('The image service is busy. Wait a moment and try again.')
                raise ImageUploadError('Cloudflare could not prepare the upload. Please retry or contact the administrator.')
            target = payload['result']['uploadURL']
            parsed = urlsplit(target)
            if parsed.scheme != 'https' or parsed.hostname != 'upload.imagedelivery.net':
                raise ImageUploadError('Cloudflare returned an invalid upload destination.')
            image_id = payload['result']['id']
            response = client.post(target, files={'file': (secure_filename(file.filename), content, mime)})
            payload = response.json()
            if not response.is_success or not payload.get('success'):
                raise ImageUploadError('Cloudflare could not store the image. Please try again.')
    except (httpx.HTTPError, KeyError, ValueError):
        raise ImageUploadError('The image service is unavailable. Please try again.') from None
    return {'id': image_id, 'url': f'https://imagedelivery.net/{delivery}/{image_id}/{variant}'}


def download_private_image(image_id):
    account, token = os.getenv('CF_ACCOUNT_ID', '').strip(), os.getenv('CF_IMAGES_TOKEN', '').strip()
    if not account or not token:
        raise ImageUploadError('Private image access is not configured.')
    try:
        response = httpx.get(f'https://api.cloudflare.com/client/v4/accounts/{account}/images/v1/{quote(image_id, safe="")}/blob',
                             headers={'Authorization': f'Bearer {token}'}, timeout=60)
        mime = response.headers.get('content-type', '').split(';')[0]
        if not response.is_success or mime not in ALLOWED_FORMATS.values() or len(response.content)>MAX_IMAGE_BYTES:
            raise ImageUploadError('Cannot load the private image. Check Cloudflare Images read permissions.')
        return response.content, mime
    except httpx.HTTPError:
        raise ImageUploadError('The image service is unavailable. Retry shortly.') from None
