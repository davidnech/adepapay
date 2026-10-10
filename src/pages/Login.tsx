import { useState, useEffect, useRef } from 'react'
import { authRequest, type AuthUser, type SMSVerification } from '../lib/auth'
import OTPVerification from './OTPVerification'
type PageState = 'idle' | 'loading' | 'success' | 'error'

function FloatField({
  label, value, onChange, error, type = 'text', disabled = false,
  children, autoComplete, inputRef,
}: {
  label: string; value: string; onChange: (v: string) => void; error?: string
  type?: string; disabled?: boolean; children?: React.ReactNode; autoComplete?: string; inputRef?: React.RefObject<HTMLInputElement | null>
}) {
  const [focused, setFocused] = useState(false)
  const floated = focused || value.length > 0

  return (
    <div>
      <div
        className="relative rounded-xl border transition-all duration-200"
        style={{
          borderColor: error ? '#F04438' : focused ? '#0B5FFF' : '#E5E7EB',
          boxShadow: focused ? '0 0 0 3px rgba(11,95,255,0.1)' : 'none',
          background: disabled ? '#F9FAFB' : '#fff',
        }}
      >
        <label
          className="absolute left-4 transition-all duration-200 pointer-events-none font-medium select-none"
          style={{
            top: floated ? '8px' : '50%',
            transform: floated ? 'none' : 'translateY(-50%)',
            fontSize: floated ? '10px' : '14px',
            color: error ? '#F04438' : focused ? '#0B5FFF' : '#9CA3AF',
          }}
        >
          {label}
        </label>
        <input
          ref={inputRef}
          type={type}
          value={value}
          disabled={disabled}
          autoComplete={autoComplete}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ paddingRight: children ? '48px' : '16px' }}
          className="w-full bg-transparent pt-6 pb-2.5 pl-4 text-sm text-gray-900 focus:outline-none rounded-xl disabled:cursor-not-allowed disabled:text-gray-400"
        />
        {children && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{children}</div>
        )}
      </div>
      {error && (
        <p className="mt-1.5 text-xs font-medium flex items-center gap-1" style={{ color: '#F04438' }}>
          <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
          </svg>
          {error}
        </p>
      )}
    </div>
  )
}

export default function Login({
  onBack, onBrowseStores, onBrowseProducts, onRegister, onLogin,
}: {
  onBack: () => void
  onBrowseStores: () => void
  onBrowseProducts: () => void
  onRegister: () => void
  onLogin: (user: AuthUser) => void
}) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [remember, setRemember] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({})
  const [pageState, setPageState] = useState<PageState>('idle')
  const [serverError, setServerError] = useState('')
  const [activeRole, setActiveRole] = useState<AuthUser | null>(null)
  const [verification, setVerification] = useState<SMSVerification | null>(null)
  const pwRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (pageState !== 'success' || !activeRole) return
    const redirectTimer = window.setTimeout(() => onLogin(activeRole), 900)
    return () => window.clearTimeout(redirectTimer)
  }, [pageState, activeRole, onLogin])

  // Detect caps lock on the password field
  useEffect(() => {
    const el = pwRef.current
    if (!el) return
    const handler = (e: KeyboardEvent) => setCapsLock(e.getModifierState('CapsLock'))
    el.addEventListener('keyup', handler)
    el.addEventListener('keydown', handler)
    return () => { el.removeEventListener('keyup', handler); el.removeEventListener('keydown', handler) }
  }, [])

  const validate = () => {
    const errs: typeof errors = {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier.trim())) errs.identifier = 'Enter a valid email address'
    if (!password) errs.password = 'Password is required'
    return errs
  }

  const finishLogin = async () => {
    const result = await authRequest('login', { email: identifier.trim(), password, remember })
    if (result.verification_required && result.verification) {
      setVerification(result.verification)
      setPageState('idle')
      return
    }
    if (!result.user) throw new Error('Sign in failed. Please try again.')
    setVerification(null)
    setActiveRole(result.user)
    setPageState('success')
  }
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pageState === 'loading') return
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setPageState('loading')
    try {
      await finishLogin()
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Sign in failed. Please try again.')
      setPageState('error')
    }
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (verification) return <OTPVerification verification={verification} onVerified={finishLogin} onBack={() => { setVerification(null); setPageState('idle') }} />
  if (pageState === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#F8FAFC' }}>
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-10 max-w-sm w-full text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 relative"
            style={{ background: '#ECFDF3' }}>
            <svg className="w-10 h-10" style={{ color: '#12B76A' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-white animate-pulse"/>
          </div>
          <h2 className="text-xl font-bold mb-1" style={{ color: '#101828' }}>Login Successful!</h2>
          <p className="text-sm text-gray-500 mb-2">You are signed in to your {activeRole?.store_application ? 'store applicant' : activeRole?.role ?? 'selected'} account.</p>
          <p className="text-xs font-semibold mb-6" style={{ color: '#0B5FFF' }}>
            {activeRole ? `${activeRole.store_application ? "Store application" : activeRole.role} workspace ready` : 'AdepaPay workspace ready'}
          </p>
          {/* Spinner */}
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
            <svg className="w-4 h-4 animate-spin" style={{ color: '#0B5FFF' }} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Loading your dashboard
          </div>
        </div>
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (pageState === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#F8FAFC' }}>
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-10 max-w-sm w-full text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ background: '#FEF3F2' }}>
            <svg className="w-10 h-10" style={{ color: '#F04438' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-1" style={{ color: '#101828' }}>Unable to Sign In</h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            {serverError}
          </p>
          <button onClick={() => setPageState('idle')}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white mb-3 hover:opacity-90 transition-all"
            style={{ background: '#0B5FFF' }}>
            Try Again
          </button>
        </div>
      </div>
    )
  }

  const isLoading = pageState === 'loading'

  return (
    <div className="login-scene relative min-h-screen overflow-hidden bg-[#06142b] px-4 py-8 font-sans">
      <div className="login-grid absolute inset-0" />
      <div className="login-orb login-orb-one" />
      <div className="login-orb login-orb-two" />
      <div className="login-orb login-orb-three" />

      <button onClick={onBack} className="absolute left-5 top-5 z-20 flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white/80 backdrop-blur-xl transition hover:bg-white/15 hover:text-white">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Back home
      </button>

      <main className="relative z-10 flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="w-full max-w-md">
          <div className="rounded-[30px] border border-white/60 bg-white/95 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-8">
            <div className="text-center">
              <button type="button" onClick={onBack} className="inline-flex">
                <img src="/images/adepa_pay_logo.png" alt="AdepaPay" className="mx-auto h-16 w-auto object-contain" />
              </button>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Welcome back</h1>
              <p className="mt-1 text-sm text-slate-500">Sign in securely to your account</p>
            </div>

            <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
              <FloatField label="Email address" type="email" value={identifier} onChange={setIdentifier} error={errors.identifier} disabled={isLoading} autoComplete="username" />
              <div>
                <FloatField label="Password" value={password} onChange={setPassword} error={errors.password} type={showPw ? 'text' : 'password'} disabled={isLoading} autoComplete="current-password" inputRef={pwRef}>
                  <button type="button" onClick={() => setShowPw(!showPw)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label={showPw ? 'Hide password' : 'Show password'}>
                    {showPw ? <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7M9.9 4.2A10.7 10.7 0 0112 4c5 0 9 4 10 8a11.8 11.8 0 01-2.1 4.1M6.6 6.6A11 11 0 002 12c1 4 5 8 10 8 1.5 0 2.9-.4 4.1-1" /></svg> : <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>}
                  </button>
                </FloatField>
                {capsLock && <p className="mt-1.5 text-xs font-medium text-amber-600">Caps Lock is on</p>}
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex cursor-pointer items-center gap-2 text-slate-600"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-4 w-4 rounded accent-blue-600" />Remember me</label>
              </div>

              <button type="submit" disabled={isLoading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70">
                {isLoading ? <><svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/></svg>Signing in…</> : 'Sign in'}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-slate-500">New to AdepaPay? <button type="button" onClick={onRegister} className="font-bold text-blue-600 hover:text-blue-700">Create an account</button></p>
            <div className="mt-5 flex items-center justify-center gap-2 border-t border-slate-100 pt-5 text-[11px] font-medium text-slate-400"><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/></svg>Secure account sign in</div>
          </div>
          <p className="mt-5 text-center text-xs text-white/45">© 2026 AdepaPay · Secure flexible payments</p>
        </div>
      </main>
    </div>
  )

}
