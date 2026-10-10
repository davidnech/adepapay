"""Admin directory built from all registered store accounts, not one Auth page."""
from flask import jsonify, request

try:
    from .store_approvals import application_data
    from .admin_store_profile import register_admin_store_profile
except ImportError:
    from store_approvals import application_data
    from admin_store_profile import register_admin_store_profile


def directory_row(user):
    application = application_data(user)
    if application is None:
        return None
    profile = user.app_metadata.get('store_profile', {})
    if not isinstance(profile, dict):
        profile = {}
    status = application['status']
    status = 'Active' if status == 'Approved' and user.app_metadata.get('role') == 'Store Manager' else status
    result = {**application, 'status': status, 'storeId': user.app_metadata.get('store_id'),
              'createdAt': str(getattr(user, 'created_at', '') or ''),
              'verification': 'Verified' if status == 'Active' else 'Not verified'}
    for key in ('storeName', 'phone', 'region', 'city', 'description', 'website', 'openingHours',
                'operatingLocation', 'nearestLandmark', 'gpsAddress'):
        result[key] = str(profile.get(key, result.get(key, '')))
    result['contactEmail'] = str(profile.get('contactEmail', user.email or ''))
    for slot in ('logo', 'cover'):
        value = profile.get(slot)
        url = value.get('url') if isinstance(value, dict) else None
        result[slot] = url if isinstance(url, str) and url.startswith('https://imagedelivery.net/') else None
    return result


def register_store_directory(app, connect_admin, authorized):
    register_admin_store_profile(app, connect_admin, authorized, directory_row)
    @app.get('/api/auth/admin/store-directory')
    def store_directory():
        if not authorized():
            return jsonify(error='Administrator sign-in is required.'), 403
        try:
            page = int(request.args.get('page', '1'))
            if page < 1:
                raise ValueError()
        except ValueError:
            return jsonify(error='Invalid page number.'), 400
        try:
            client = connect_admin()
        except RuntimeError as error:
            return jsonify(error=str(error)), 503
        rows, seen = [], set()
        batch = 1
        while True:
            users = client.auth.admin.list_users(page=batch, per_page=100)
            for user in users:
                if user.id not in seen:
                    seen.add(user.id)
                    row = directory_row(user)
                    if row is not None:
                        rows.append(row)
            if len(users) < 100:
                break
            batch += 1
        archived = sum(row['status'] == 'Deleted' for row in rows)
        suspended = sum(row['status'] == 'Suspended' for row in rows)
        summary = {'total': len(rows) - archived, 'active': sum(row['status'] == 'Active' for row in rows),
                   'pending': sum(row['status'] == 'Pending Approval' for row in rows),
                   'rejected': sum(row['status'] == 'Rejected' for row in rows)}
        regions = sorted({row['region'] for row in rows if row['region']})
        query = request.args.get('q', '').strip().casefold()
        status = request.args.get('status', 'All')
        region = request.args.get('region', '')
        filtered = [row for row in rows if
                    ((status == 'All' and row['status'] != 'Deleted') or row['status'] == status) and
                    (not region or row['region'] == region) and
                    (not query or query in ' '.join(str(row.get(key, '')) for key in
                     ('storeName', 'registeredName', 'ownerName', 'email', 'reference', 'storeId')).casefold())]
        filtered.sort(key=lambda row: (row['createdAt'], row['id']), reverse=True)
        page_size = 20
        page = min(page, max(1, (len(filtered) + page_size - 1) // page_size))
        return jsonify(stores=filtered[(page - 1) * page_size:page * page_size], summary=summary,
                       archived=archived, suspended=suspended,
                       regions=regions, page=page, page_size=page_size, total_matches=len(filtered))
