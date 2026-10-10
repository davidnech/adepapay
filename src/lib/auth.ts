export type AuthRole = 'Customer' | 'Store Manager' | 'Field Agent' | 'Admin'
export type AuthUser = { id: string; email: string; name: string; role: AuthRole; subscription?: { active: boolean; paidUntil: string | null; plan: string | null }; staff?: boolean; roleTitle?: string; permissions?: string[]; store_application?: { storeName: string; reference: string; status: string; reason?: string }; store?: { id: string; name: string; reference: string } }
export type SMSVerification = { phone: string; expiresAt: string; resendAfter: number; notice?: string }
type AuthResponse = { user?: AuthUser; confirmation_required?: boolean; application_reference?: string; verification_required?: boolean; verification?: SMSVerification; verified?: boolean; welcome_sms_sent?: boolean }

export class AuthError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

let sessionRequest: Promise<AuthResponse> | null = null
export function authRequest(path: string, data?: unknown): Promise<AuthResponse> {
  if (path !== 'session') return sendRequest(path, data)
  if (!sessionRequest) sessionRequest = sendRequest(path).finally(() => { sessionRequest = null })
  return sessionRequest
}

async function sendRequest(path: string, data?: unknown): Promise<AuthResponse> {
  let response: Response
  try {
    response = await fetch(`/api/auth/${path}`, {
      // Signup/login can include both a Supabase request and an SMS provider request.
      signal: AbortSignal.timeout(['signup', 'store-signup', 'login', 'sms/resend'].includes(path) ? 60000 : 20000),
      method: data === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data),
    })
  } catch {
    throw new Error('Cannot reach the server. Please try again shortly.')
  }
  const result = await response.json().catch(() => null)
  if (!response.ok || !result) {
    throw new AuthError(result?.error || 'The authentication server is unavailable. Please try again shortly.', response.status)
  }
  return result
}
