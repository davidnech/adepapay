"""Admin-only store reviews, persisted atomically with the role in Auth app_metadata."""
import hashlib
import json
from datetime import datetime, timezone
from threading import Lock
from uuid import UUID

from flask import jsonify, request

FIELDS = ('storeName', 'registeredName', 'registrationNumber', 'storeType',
          'officeClassification', 'ownerName', 'phone', 'region', 'city', 'reference')
decision_lock = Lock()


def application_data(user):
    if user.app_metadata.get('store_staff') is not None or user.app_metadata.get('role') == 'Field Agent':
        return None
    review = user.app_metadata.get('store_review', {})
    if not isinstance(review, dict):
        review = {}
    source = review.get('application') or user.user_metadata.get('store_application')
    if not isinstance(source, dict):
        return None
    data = {key: str(source.get(key, ''))[:300] for key in FIELDS}
    categories = source.get('categories', [])
    data['categories'] = [item[:150] for item in categories if isinstance(item, str)][:100] if isinstance(categories, list) else []
    version = hashlib.sha256(json.dumps({'application': data, 'review': review}, sort_keys=True).encode()).hexdigest()
    return dict(id=user.id, email=user.email, **data,
                status=review.get('status', 'Pending Approval'),
                reason=review.get('reason', ''), reviewed_at=review.get('reviewed_at'),
                reviewer=review.get('reviewer'), version=version)


def register_store_approvals(app, connect_admin, authorized):
    def client_or_error():
        if not authorized():
            return None, (jsonify(error='Administrator sign-in is required.'), 403)
        try:
            return connect_admin(), None
        except RuntimeError as error:
            return None, (jsonify(error=str(error)), 503)

    @app.get('/api/auth/admin/stores')
    def list_store_applications():
        client, error = client_or_error()
        if error:
            return error
        try:
            page = int(request.args.get('page', '1'))
            if page < 1 or page > 100000:
                raise ValueError()
        except ValueError:
            return jsonify(error='Invalid page number.'), 400
        if request.args.get('scope')=='all':
            users=[]; batch=1; seen=set()
            while True:
                loaded=client.auth.admin.list_users(page=batch,per_page=100)
                for user in loaded:
                    if user.id not in seen: users.append(user); seen.add(user.id)
                if len(loaded)<100: break
                batch+=1
            applications=[row for user in users if (row:=application_data(user)) is not None]
            query=request.args.get('q','').strip().casefold(); status=request.args.get('status','All')
            if len(query)>200 or status not in ('All','Pending Approval','Approved','Rejected','Suspended','Deleted'):
                return jsonify(error='Choose valid approval filters.'),400
            applications=[row for row in applications if (status=='All' or row['status']==status) and (not query or query in ' '.join(str(row.get(key,'')) for key in ('storeName','ownerName','email','reference')).casefold())]
            applications.sort(key=lambda row:row['id'])
            total=len(applications); page=min(page,max(1,(total+19)//20))
            return jsonify(applications=applications[(page-1)*20:page*20],page=page,total=total,has_more=page*20<total)
        users = client.auth.admin.list_users(page=page, per_page=50)
        applications = [row for user in users if (row := application_data(user)) is not None]
        return jsonify(applications=applications, page=page, has_more=len(users) == 50)

    @app.get('/api/auth/admin/stores/<user_id>')
    def get_store_application(user_id):
        client,error=client_or_error()
        if error: return error
        try: UUID(user_id)
        except ValueError: return jsonify(error='Invalid store application ID.'),400
        user=client.auth.admin.get_user_by_id(user_id).user
        application=application_data(user) if user else None
        if application is None: return jsonify(error='Store application not found.'),404
        return jsonify(application=application)

    @app.post('/api/auth/admin/stores/<user_id>/decision')
    def decide_store_application(user_id):
        client, error = client_or_error()
        if error:
            return error
        try:
            UUID(user_id)
        except ValueError:
            return jsonify(error='Invalid application ID.'), 400
        data = request.get_json()
        if not isinstance(data, dict) or data.get('decision') not in ('approve', 'reject'):
            return jsonify(error='Choose approve or reject.'), 400
        reason = data.get('reason', '')
        if not isinstance(reason, str) or len(reason) > 2000 or (data['decision'] == 'reject' and not reason.strip()):
            return jsonify(error='Provide a rejection reason of up to 2000 characters.'), 400
        with decision_lock:
            user = client.auth.admin.get_user_by_id(user_id).user
            row = application_data(user)
            if row is None:
                return jsonify(error='No store application exists for this account.'), 404
            if row['status'] != 'Pending Approval' or data.get('version') != row['version']:
                return jsonify(error='This application changed or was already reviewed. Refresh the list.'), 409
            if user.app_metadata.get('role', 'Customer') not in ('Customer', 'Store Manager'):
                return jsonify(error='This account has another privileged role and cannot be converted here.'), 409
            approved = data['decision'] == 'approve'
            if approved and any(not row[key].strip() for key in FIELDS):
                return jsonify(error='The application is incomplete and cannot be approved.'), 400
            snapshot = {key: row[key] for key in (*FIELDS, 'categories')}
            metadata = {**user.app_metadata, 'role': 'Store Manager' if approved else 'Customer',
                        'store_id': user.id if approved else None,
                        'store_review': {'status': 'Approved' if approved else 'Rejected',
                                         'reason': reason.strip(),
                                         'reviewed_at': datetime.now(timezone.utc).isoformat(),
                                         'reviewer': authorized(), 'application': snapshot}}
            result = client.auth.admin.update_user_by_id(user.id, {'app_metadata': metadata})
            return jsonify(application=application_data(result.user))
