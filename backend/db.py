"""Request-local clients prevent one user's session leaking into another request."""
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import Client, ClientOptions, create_client

load_dotenv(Path(__file__).resolve().parents[1] / '.env')

def connect_db() -> Client:
    url, key = os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_KEY')
    if not url or not key:
        raise RuntimeError('Configure SUPABASE_URL and SUPABASE_KEY in .env')
    client = create_client(url, key, options=ClientOptions(
        auto_refresh_token=False, persist_session=False,
    ))
    # Every portal's authentication lookup enforces the trusted signup marker.
    # A caller with a direct Supabase signup token cannot bypass SMS verification.
    if __package__:
        from .sms_verification import require_verified_user
    else:
        from sms_verification import require_verified_user
    original_get_user = client.auth.get_user
    def verified_get_user(*args, **kwargs):
        result = original_get_user(*args, **kwargs)
        if result and result.user:
            require_verified_user(result.user)
        return result
    client.auth.get_user = verified_get_user
    return client


def connect_admin() -> Client:
    """Privileged client used only after backend authorization."""
    key = os.getenv('SUPABASE_SECRET_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    if not key:
        raise RuntimeError(
            'Store approvals require a Supabase secret or service_role key. '
            'Add SUPABASE_SECRET_KEY to the project-root .env (beside package.json), '
            'save the file, and restart the Python backend. '
            'The publishable SUPABASE_KEY used for customer login cannot approve stores.'
        )
    return create_client(os.environ['SUPABASE_URL'], key, options=ClientOptions(
        auto_refresh_token=False, persist_session=False,
    ))
