"""Subscription state is written by the verified-payment transaction only."""
from datetime import datetime, timezone
import os


def subscription_info(user):
    value=user.app_metadata.get('store_subscription',{})
    if not isinstance(value,dict): value={}
    until=value.get('paid_until')
    mode='live' if os.getenv('PAYSTACK_SECRET_KEY','').startswith('sk_live_') else 'test'
    try: active=value.get('environment')==mode and datetime.fromisoformat(until.replace('Z','+00:00'))>datetime.now(timezone.utc)
    except (ValueError,TypeError,AttributeError): active=False
    return dict(active=active,paidUntil=until,plan=value.get('plan_name'))
