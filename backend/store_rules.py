"""Store-scoped rules and terms, persisted in trusted Auth metadata."""
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
import math
from flask import g, jsonify, request

NUMBER_FIELDS = {
    'minimumDeposit': ('Minimum deposit', 0, 100, False),
    'minimumDuration': ('Minimum duration', 1, 120, True),
    'maximumDuration': ('Maximum duration', 1, 120, True),
    'gracePeriod': ('Grace period', 0, 365, True),
    'lateFee': ('Late payment charge', 0, 100, False),
    'returns': ('Return window', 0, 365, True),
    'warranty': ('Warranty', 0, 120, True),
}
TOGGLES = ('earlySettlement', 'autoDebit', 'allowReschedule', 'requireGuarantors')
CONDUCT = {
    'verifiedIdentity': 'Customer information must match verified Ghana Card records.',
    'deliveryIdentification': 'Delivery requires customer or authorized representative identification.',
    'reportIssues': 'Customers must notify the store promptly about defects or delivery issues.',
    'respectfulConduct': 'Abusive, fraudulent, or threatening conduct may result in a store-level ban.',
}
DEFAULTS = {
    'minimumDeposit': 20, 'minimumDuration': 3, 'maximumDuration': 12,
    'gracePeriod': 3, 'lateFee': 2, 'returns': 7, 'warranty': 12,
    'delivery': '2–5 business days',
    'earlySettlement': True, 'autoDebit': False, 'allowReschedule': False, 'requireGuarantors': True,
    'returnConditions': 'Products must be unused, in original packaging, and returned with the receipt. Faulty products are assessed before replacement or refund.',
    'conduct': {key: True for key in CONDUCT},
    'clauses': [
        'The customer must pay the required deposit before the product is released.',
        'Monthly installments must be paid on or before the agreed due date.',
        'Ownership transfers only after the final installment and all charges are settled.',
        'Late or missed payments may result in account restrictions and recovery action.',
        'Products remain subject to the store return policy and manufacturer warranty.',
    ],
}


def rules_for(user):
    saved = user.app_metadata.get('store_rules', {})
    return {
        'values': deepcopy(saved.get('values', DEFAULTS)),
        'revision': saved.get('revision', 0), 'publishedAt': saved.get('publishedAt'),
        'version': hashlib.sha256(json.dumps(saved, sort_keys=True).encode()).hexdigest(),
        'conductLabels': CONDUCT,
    }


def validate_rules(values):
    if not isinstance(values, dict) or set(values) != set(DEFAULTS):
        raise ValueError('Provide all shop rules and payment terms.')
    cleaned = {}
    for key, (label, minimum, maximum, integer) in NUMBER_FIELDS.items():
        value = values[key]
        if type(value) not in (int, float) or not math.isfinite(value) or not minimum <= value <= maximum or (integer and value != int(value)):
            raise ValueError(f'{label} must be {"a whole number " if integer else ""}between {minimum} and {maximum}.')
        cleaned[key] = int(value) if integer else value
    if cleaned['minimumDuration'] > cleaned['maximumDuration']:
        raise ValueError('Maximum duration must be at least the minimum duration.')
    for key in TOGGLES:
        if type(values[key]) is not bool:
            raise ValueError('Choose a valid payment rule setting.')
        cleaned[key] = values[key]
    for key, limit in (('delivery', 300), ('returnConditions', 3000)):
        value = values[key]
        if not isinstance(value, str) or not value.strip() or len(value) > limit:
            raise ValueError(f'Enter {key} using 1–{limit} characters.')
        cleaned[key] = value.strip()
    conduct = values['conduct']
    if not isinstance(conduct, dict) or set(conduct) != set(CONDUCT) or any(type(value) is not bool for value in conduct.values()):
        raise ValueError('Choose valid customer conduct rules.')
    cleaned['conduct'] = conduct.copy()
    clauses = values['clauses']
    if not isinstance(clauses, list) or not 1 <= len(clauses) <= 30:
        raise ValueError('Provide between 1 and 30 agreement clauses.')
    if any(not isinstance(value, str) or not value.strip() or len(value) > 1000 for value in clauses):
        raise ValueError('Each agreement clause must contain 1–1000 characters.')
    cleaned['clauses'] = [value.strip() for value in clauses]
    if len(json.dumps(cleaned).encode()) > 16000:
        raise ValueError('Please shorten the terms to fit within 16 KB.')
    return cleaned


def register_store_rules(app, owner, connect_admin):
    @app.route('/api/auth/store/rules', methods=['GET', 'POST'])
    def store_rules():
        user, error = owner()
        if error:
            return error
        current = rules_for(user)
        if request.method == 'GET':
            return jsonify(rules=current)
        request.max_content_length = 64 * 1024
        data = request.get_json()
        if not isinstance(data, dict):
            raise ValueError('Provide your shop rules.')
        if data.get('version') != current['version']:
            return jsonify(error='These rules changed. Reload the saved version before publishing again.'), 409
        values = validate_rules(data.get('values'))
        try:
            client = connect_admin()
        except RuntimeError:
            return jsonify(error='Saving shop rules is not configured. Contact the administrator.'), 503
        saved = {'values': values, 'revision': current['revision'] + 1,
                 'publishedAt': datetime.now(timezone.utc).isoformat(), 'publishedBy': g.store_actor.id}
        result = client.auth.admin.update_user_by_id(user.id, {
            'app_metadata': {**user.app_metadata, 'store_rules': saved}})
        return jsonify(rules=rules_for(result.user))
