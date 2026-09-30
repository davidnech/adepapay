import { useState, useEffect, useRef } from 'react'
import { formatCurrency, isValidGhanaPhoneNumber } from '../lib/localization'
import { authenticateFieldAgent } from '../lib/fieldAgents'

type PageState = 'idle' | 'loading' | 'success' | 'error'
type DemoAccount = {
  role: 'Customer' | 'Store Manager' | 'Field Agent' | 'Admin'
  identifier: string
  password: string
  hint: string
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: 'Customer',
    identifier: 'emmanuel.customer@adepapay.com',
    password: 'AdepaPay123!',
    hint: 'Customer Portal',
  },
  {
    role: 'Store Manager',
    identifier: 'emmanuel.store@adepapay.com',
    password: 'AdepaPay123!',
    hint: 'Store Manager Portal',
  },
  {
    role: 'Field Agent',
    identifier: 'kofi.agent@adepapay.com',
    password: 'Agent123!',
    hint: 'Field Agent Portal',
  },
  {
    role: 'Admin',
    identifier: 'emmanuel.admin@adepapay.com',
    password: 'AdepaPay123!',
    hint: 'Admin Portal',
  },
]

// ─── Floating label input ─────────────────────────────────────────────────────
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

// ─── Social button ────────────────────────────────────────────────────────────
function SocialBtn({ provider, disabled }: { provider: 'google' | 'apple'; disabled?: boolean }) {
  const isGoogle = provider === 'google'
  return (
    <button
      disabled={disabled}
      className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ borderColor: '#E5E7EB', color: '#374151' }}
    >
      {isGoogle ? (
        <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      ) : (
        <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09z"/>
          <path d="M15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z"/>
        </svg>
      )}
      Continue with {isGoogle ? 'Google' : 'Apple'}
    </button>
  )
}

// ─── Right panel illustration ─────────────────────────────────────────────────
function RightPanel({ onRegister }: { onRegister: () => void }) {
  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Hero illustration card */}
      <div className="relative rounded-3xl overflow-hidden flex-1 min-h-[340px]"
        style={{ background: 'linear-gradient(145deg, #0B5FFF 0%, #1E3A8A 60%, #101828 100%)' }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at center,rgba(255,255,255,0.6) 1px,transparent 1px)', backgroundSize: '22px 22px' }}/>
        <div className="absolute top-6 right-6 w-40 h-40 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)' }}/>

        <div className="relative z-10 p-8 flex flex-col h-full">
          {/* Stacked cards mockup */}
          <div className="flex-1 flex items-center justify-center">
            <div className="relative w-52">
              {/* Back card */}
              <div className="absolute -bottom-3 left-4 right-0 h-24 rounded-2xl opacity-40"
                style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)' }}/>
              {/* Middle card */}
              <div className="absolute -bottom-1.5 left-2 right-0 h-24 rounded-2xl opacity-60"
                style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)' }}/>
              {/* Main card */}
              <div className="relative bg-white/95 rounded-2xl shadow-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: '#0B5FFF' }}>
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1"/>
                      </svg>
                    </div>
                    <span className="text-xs font-bold" style={{ color: '#0B5FFF' }}>AdepaPay</span>
                  </div>
                  <div className="flex gap-0.5">
                    <div className="w-4 h-4 rounded-full bg-yellow-400 opacity-80"/>
                    <div className="w-4 h-4 rounded-full bg-yellow-500 -ml-2"/>
                  </div>
                </div>
                <div className="mb-3">
                  <div className="text-[9px] text-gray-400 font-medium mb-0.5">Next Payment</div>
                  <div className="text-xl font-bold text-gray-900">{formatCurrency(50667)}</div>
                  <div className="text-[10px] text-gray-400">iPhone 15 Pro Max · Due Apr 15</div>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: '42%', background: 'linear-gradient(90deg,#0B5FFF,#4A90FF)' }}/>
                </div>
                <div className="flex justify-between text-[9px] text-gray-400 mt-1">
                  <span>5 of 12 payments</span>
                  <span>42% complete</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-1.5">
                  <div className="text-center p-1.5 rounded-lg bg-gray-50">
                    <div className="text-[9px] text-gray-400">Paid</div>
                    <div className="text-xs font-bold" style={{ color: '#12B76A' }}>{formatCurrency(253335)}</div>
                  </div>
                  <div className="text-center p-1.5 rounded-lg bg-gray-50">
                    <div className="text-[9px] text-gray-400">Remaining</div>
                    <div className="text-xs font-bold" style={{ color: '#0B5FFF' }}>{formatCurrency(354669)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom text */}
          <div className="mt-6">
            <p className="text-white font-semibold text-base mb-1">Everything in one place.</p>
            <p className="text-blue-200 text-sm leading-relaxed">Track payments, browse products, and manage your hire purchase plans — all from your AdepaPay dashboard.</p>
            <button onClick={onRegister} className="mt-4 text-sm font-semibold underline underline-offset-2 text-blue-200 hover:text-white transition-colors">
              Don't have an account? Create one →
            </button>
          </div>
        </div>
      </div>

      {/* Trust cards */}
      {[
        { icon: '🔒', title: 'Secure Login', desc: 'Your account is protected with 256-bit encryption and modern security standards.' },
        { icon: '✅', title: 'Trusted Marketplace', desc: 'Only verified merchants are approved to sell through AdepaPay.' },
        { icon: '💳', title: 'Flexible Hire Purchase', desc: 'Access all your purchases, repayments and applications in one dashboard.' },
      ].map(t => (
        <div key={t.title} className="flex gap-3 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <span className="text-2xl flex-shrink-0">{t.icon}</span>
          <div>
            <h4 className="font-semibold text-sm text-gray-900 mb-0.5">{t.title}</h4>
            <p className="text-xs text-gray-500 leading-relaxed">{t.desc}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Login({
  onBack, onBrowseStores, onBrowseProducts, onRegister, onLogin,
}: {
  onBack: () => void
  onBrowseStores: () => void
  onBrowseProducts: () => void
  onRegister: () => void
  onLogin: (role: DemoAccount['role']) => void
}) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [remember, setRemember] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({})
  const [pageState, setPageState] = useState<PageState>('idle')
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeDemoRole, setActiveDemoRole] = useState<DemoAccount['role'] | null>(null)
  const pwRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  useEffect(() => {
    if (pageState !== 'success' || !activeDemoRole) return
    const redirectTimer = window.setTimeout(() => onLogin(activeDemoRole), 900)
    return () => window.clearTimeout(redirectTimer)
  }, [pageState, activeDemoRole, onLogin])

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
    if (!identifier.trim()) {
      errs.identifier = 'Mobile number or email is required'
    } else if (
      identifier.includes('@')
        ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)
        : !isValidGhanaPhoneNumber(identifier)
    ) {
      errs.identifier = identifier.includes('@') ? 'Enter a valid email address' : 'Enter a valid Ghanaian phone number'
    }
    if (!password) errs.password = 'Password is required'
    else if (password.length < 6) errs.password = 'Password is too short'
    return errs
  }

  const staticDemoAccount = DEMO_ACCOUNTS.find(
    (account) =>
      account.identifier.toLowerCase() === identifier.trim().toLowerCase() &&
      account.password === password,
  )
  const matchingAgent = authenticateFieldAgent(identifier, password)
  const matchingDemoAccount = staticDemoAccount ?? (matchingAgent ? {
    role: 'Field Agent' as const,
    identifier: matchingAgent.email,
    password: matchingAgent.password,
    hint: 'Field Agent Portal',
  } : undefined)

  const fillDemoAccount = (account: DemoAccount) => {
    setIdentifier(account.identifier)
    setPassword(account.password)
    setActiveDemoRole(account.role)
    setErrors({})
    setPageState('idle')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setPageState('loading')
    await new Promise(r => setTimeout(r, 1600))
    if (matchingDemoAccount) {
      if (matchingAgent) sessionStorage.setItem('adepapay-agent-id', matchingAgent.id)
      else if (matchingDemoAccount.role === 'Field Agent') sessionStorage.setItem('adepapay-agent-id', 'AGT-0018')
      setActiveDemoRole(matchingDemoAccount.role)
      setPageState('success')
    } else {
      setActiveDemoRole(null)
      setPageState('error')
    }
  }

  const NAV_LINKS = ['Home', 'Browse Stores', 'Browse Products', 'How It Works']

  // ── Success ────────────────────────────────────────────────────────────────
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
          <p className="text-sm text-gray-500 mb-2">Demo credentials accepted for the {activeDemoRole ?? 'selected'} account.</p>
          <p className="text-xs font-semibold mb-6" style={{ color: '#0B5FFF' }}>
            {activeDemoRole ? `${activeDemoRole} workspace ready` : 'AdepaPay workspace ready'}
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
            The email or password you entered is incorrect. Please check your credentials and try again.
          </p>
          <button onClick={() => setPageState('idle')}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white mb-3 hover:opacity-90 transition-all"
            style={{ background: '#0B5FFF' }}>
            Try Again
          </button>
          <button className="w-full py-3 rounded-xl text-sm font-semibold border-2 hover:bg-blue-50 transition-all"
            style={{ borderColor: '#0B5FFF', color: '#0B5FFF' }}>
            Forgot Password?
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

            <div className="mt-6 grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1.5">
              {DEMO_ACCOUNTS.map((account) => {
                const active = activeDemoRole === account.role
                return <button key={account.role} type="button" onClick={() => fillDemoAccount(account)} disabled={isLoading} className={`rounded-xl px-2 py-2.5 text-[11px] font-bold transition ${active ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>{account.role}</button>
              })}
            </div>

            <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
              <FloatField label="Email or mobile number" value={identifier} onChange={setIdentifier} error={errors.identifier} disabled={isLoading} autoComplete="username" />
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
                <button type="button" className="font-semibold text-blue-600 hover:text-blue-700">Forgot password?</button>
              </div>

              <button type="submit" disabled={isLoading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70">
                {isLoading ? <><svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/></svg>Signing in…</> : 'Sign in'}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-slate-500">New to AdepaPay? <button type="button" onClick={onRegister} className="font-bold text-blue-600 hover:text-blue-700">Create an account</button></p>
            <div className="mt-5 flex items-center justify-center gap-2 border-t border-slate-100 pt-5 text-[11px] font-medium text-slate-400"><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/></svg>Protected with bank-grade encryption</div>
          </div>
          <p className="mt-5 text-center text-xs text-white/45">© 2026 AdepaPay · Secure flexible payments</p>
        </div>
      </main>
    </div>
  )

  return (
    <div className="min-h-screen font-sans" style={{ background: '#F8FAFC' }}>

      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-30 transition-all duration-300"
        style={{ background: scrolled ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.9)', backdropFilter: 'blur(16px)', borderBottom: scrolled ? '1px solid rgba(0,0,0,0.06)' : '1px solid transparent', boxShadow: scrolled ? '0 4px 24px rgba(0,0,0,0.06)' : 'none' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <button onClick={onBack} className="flex items-center gap-3 flex-shrink-0">
            <img src="/images/adepa_pay_logo.png" alt="AdepaPay" className="h-30 w-auto object-contain" />
          </button>

          <div className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map(link => (
              <a key={link} href="#"
                className="px-3.5 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                onClick={
                  link === 'Home' ? (e) => { e.preventDefault(); onBack() }
                  : link === 'Browse Stores' ? (e) => { e.preventDefault(); onBrowseStores() }
                  : link === 'Browse Products' ? (e) => { e.preventDefault(); onBrowseProducts() }
                  : undefined
                }>
                {link}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-2">
            <span className="text-sm text-gray-500">New to AdepaPay?</span>
            <button onClick={onRegister}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all"
              style={{ background: '#0B5FFF' }}>
              Create Account
            </button>
          </div>

          <button className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              {mobileMenuOpen
                ? <><line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round"/><line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round"/></>
                : <><line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round"/><line x1="3" y1="6" x2="21" y2="6" strokeLinecap="round"/><line x1="3" y1="18" x2="21" y2="18" strokeLinecap="round"/></>}
            </svg>
          </button>
        </div>

        <div className="md:hidden overflow-hidden transition-all duration-300 bg-white border-t border-gray-100"
          style={{ maxHeight: mobileMenuOpen ? '280px' : '0' }}>
          <div className="px-4 py-4 flex flex-col gap-1">
            {NAV_LINKS.map(link => (
              <a key={link} href="#" className="px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors">{link}</a>
            ))}
            <div className="pt-3 border-t border-gray-100">
              <button onClick={onRegister} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#0B5FFF' }}>Create Account</button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── MAIN ─────────────────────────────────────────────────────────── */}
      <div className="pt-16 min-h-screen flex flex-col">
        <div className="flex-1 flex items-center">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid lg:grid-cols-[480px_1fr] gap-10 items-start">

              {/* ── LOGIN CARD ───────────────────────────────────────────── */}
              <div className="w-full">
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                  {/* Card header */}
                  <div className="px-8 pt-8 pb-6 border-b border-gray-50">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: '#EAF2FF' }}>
                        <svg className="w-6 h-6" style={{ color: '#0B5FFF' }} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                        </svg>
                      </div>
                      <div>
                        <h1 className="text-xl font-bold" style={{ color: '#101828' }}>Welcome Back</h1>
                        <p className="text-xs text-gray-400">Sign in to your AdepaPay account</p>
                      </div>
                    </div>

                    {/* Social login */}
                    <div className="grid grid-cols-2 gap-3">
                      <SocialBtn provider="google" disabled={isLoading}/>
                      <SocialBtn provider="apple" disabled={isLoading}/>
                    </div>
                  </div>

                  <div className="px-8 py-5 border-b border-gray-50 bg-slate-50/70">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: '#0B5FFF' }}>Demo Access</p>
                        <p className="mt-1 text-sm font-semibold text-gray-900">Autofill login for each AdepaPay user type</p>
                      </div>
                      <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                        Shared password
                      </span>
                    </div>
                    <div className="grid gap-2.5 sm:grid-cols-3">
                      {DEMO_ACCOUNTS.map((account) => {
                        const isActive = activeDemoRole === account.role
                        return (
                          <button
                            key={account.role}
                            type="button"
                            onClick={() => fillDemoAccount(account)}
                            disabled={isLoading}
                            className="rounded-2xl border px-4 py-3 text-left transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                            style={{
                              borderColor: isActive ? '#0B5FFF' : '#DDE4F0',
                              background: isActive ? 'rgba(11,95,255,0.06)' : '#FFFFFF',
                              boxShadow: isActive ? '0 10px 24px rgba(11,95,255,0.12)' : '0 6px 18px rgba(15,23,42,0.04)',
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-gray-900">{account.role}</span>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                Demo
                              </span>
                            </div>
                            <p className="mt-1 text-xs font-medium text-gray-500">{account.hint}</p>
                            <p className="mt-2 truncate text-[11px] text-gray-400">{account.identifier}</p>
                          </button>
                        )
                      })}
                    </div>
                    <p className="mt-3 text-xs text-gray-500">
                      Password for all demo users: <span className="font-semibold text-gray-700">AdepaPay123!</span>
                    </p>
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-3 px-8 py-4">
                    <div className="flex-1 h-px bg-gray-100"/>
                    <span className="text-xs text-gray-400 font-medium">or sign in with email</span>
                    <div className="flex-1 h-px bg-gray-100"/>
                  </div>

                  {/* Form */}
                  <form onSubmit={submit} className="px-8 pb-8 space-y-4" noValidate>
                    <FloatField
                      label="Mobile Number or Email Address"
                      value={identifier}
                      onChange={setIdentifier}
                      error={errors.identifier}
                      disabled={isLoading}
                      autoComplete="username"
                    />

                    <div>
                      <FloatField
                        label="Password"
                        value={password}
                        onChange={setPassword}
                        error={errors.password}
                        type={showPw ? 'text' : 'password'}
                        disabled={isLoading}
                        autoComplete="current-password"
                        inputRef={pwRef}
                      >
                        {/* Eye toggle — wired to actual input via state */}
                        <button type="button" onClick={() => setShowPw(!showPw)}
                          className="text-gray-400 hover:text-gray-600 transition-colors p-1">
                          {showPw
                            ? <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                            : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                          }
                        </button>
                      </FloatField>

                      {/* Caps lock warning */}
                      {capsLock && (
                        <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium" style={{ color: '#F79009' }}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"/>
                          </svg>
                          Caps Lock is on
                        </div>
                      )}
                    </div>

                    {/* Remember me + forgot */}
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <div
                          onClick={() => setRemember(!remember)}
                          className="w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-200 flex-shrink-0"
                          style={{ borderColor: remember ? '#0B5FFF' : '#D1D5DB', background: remember ? '#0B5FFF' : '#fff' }}
                        >
                          {remember && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><polyline strokeLinecap="round" strokeLinejoin="round" points="20 6 9 17 4 12"/></svg>}
                        </div>
                        <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors select-none">Remember me</span>
                      </label>
                      <a href="#" className="text-sm font-semibold hover:underline transition-colors" style={{ color: '#0B5FFF' }}>
                        Forgot Password?
                      </a>
                    </div>

                    {/* Sign in button */}
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      style={{ background: '#0B5FFF' }}
                    >
                      {isLoading ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                          Signing you in…
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
                          </svg>
                          Sign In
                        </>
                      )}
                    </button>

                    {/* Register link */}
                    <p className="text-center text-sm text-gray-500">
                      Don't have an account?{' '}
                      <button type="button" onClick={onRegister} className="font-semibold hover:underline transition-colors" style={{ color: '#0B5FFF' }}>
                        Create Account
                      </button>
                    </p>
                  </form>
                </div>

                {/* Security panel */}
                <div className="mt-4 p-4 rounded-2xl border border-gray-100 bg-white shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#0B5FFF' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                    </svg>
                    <span className="text-xs font-bold text-gray-700">Security Notice</span>
                  </div>
                  <ul className="space-y-1.5">
                    {[
                      'Your login session is secured with 256-bit SSL encryption.',
                      'Never share your password with anyone.',
                      'AdepaPay will never ask for your password by phone or email.',
                    ].map(tip => (
                      <li key={tip} className="flex items-start gap-2 text-xs text-gray-500">
                        <svg className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: '#12B76A' }} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <polyline strokeLinecap="round" strokeLinejoin="round" points="20 6 9 17 4 12"/>
                        </svg>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-3 rounded-xl border border-dashed border-gray-200 bg-white p-3 text-center text-xs text-gray-500">
                  Use any demo account above to autofill the login form instantly.
                </div>
              </div>

              {/* ── RIGHT PANEL ─────────────────────────────────────────── */}
              <div className="hidden lg:block sticky top-24">
                <RightPanel onRegister={onRegister}/>
              </div>
            </div>

            {/* ── BENEFITS ────────────────────────────────────────────────── */}
            <section className="mt-16">
              <div className="text-center mb-8">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#0B5FFF' }}>Your Dashboard</p>
                <h2 className="text-2xl font-bold" style={{ color: '#101828' }}>Everything waiting for you inside</h2>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { icon: '📦', title: 'Manage Your Purchases', desc: 'View all active and completed hire purchase agreements in one place.' },
                  { icon: '📊', title: 'Track Installments', desc: 'See upcoming due dates, payment progress, and ownership milestones.' },
                  { icon: '🧾', title: 'View Payment History', desc: 'Full history of every payment made, with date and amount details.' },
                  { icon: '⬇️', title: 'Download Receipts', desc: 'Generate and download payment receipts for any transaction instantly.' },
                  { icon: '🏪', title: 'Browse Verified Stores', desc: 'Discover new stores and products directly from your dashboard.' },
                  { icon: '🔔', title: 'Receive Notifications', desc: 'Get alerts for payment due dates, approvals, and new offers.' },
                ].map(b => (
                  <div key={b.title} className="card-lift bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex gap-4 items-start">
                    <span className="text-3xl flex-shrink-0">{b.icon}</span>
                    <div>
                      <h3 className="font-semibold text-sm text-gray-900 mb-1">{b.title}</h3>
                      <p className="text-xs text-gray-500 leading-relaxed">{b.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Security strip */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 py-5 px-8 rounded-2xl border border-gray-100 bg-white">
              {[
                { icon: '🔒', text: '256-bit SSL' },
                { icon: '🛡️', text: 'Ghana DPA Aligned' },
                { icon: '✅', text: 'Verified Platform' },
                { icon: '🏦', text: 'Bank-Grade Security' },
              ].map(s => (
                <div key={s.text} className="flex items-center gap-2 text-sm font-medium text-gray-500">
                  <span>{s.icon}</span>{s.text}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── FOOTER ─────────────────────────────────────────────────────── */}
        <footer className="py-12 px-4 sm:px-6 lg:px-8" style={{ background: '#101828' }}>
          <div className="max-w-7xl mx-auto">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <img src="/images/adepa_pay_logo.png" alt="AdepaPay" className="h-33 w-auto object-contain" />
                </div>
                <p className="text-sm text-gray-400 leading-relaxed mb-4">Ghana's premier hire purchase marketplace.</p>
                <div className="flex gap-2">
                  <input type="email" placeholder="Your email" className="flex-1 px-3 py-2 rounded-xl text-xs bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"/>
                  <button className="px-3 py-2 rounded-xl text-xs font-semibold text-white" style={{ background: '#0B5FFF' }}>Go</button>
                </div>
              </div>
              {[
                { title: 'Company',  links: ['About', 'Browse Stores', 'Products', 'How It Works'] },
                { title: 'Support',  links: ['Help Center', 'Privacy Policy', 'Terms & Conditions', 'FAQs'] },
                { title: 'Contact',  links: ['hello@adepapay.com', '+233 30 200 0000', 'Accra, Ghana', 'Twitter / X'] },
              ].map(col => (
                <div key={col.title}>
                  <h4 className="text-sm font-semibold text-white mb-3">{col.title}</h4>
                  <ul className="space-y-2">{col.links.map(l => <li key={l}><a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">{l}</a></li>)}</ul>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-gray-500">© 2026 AdepaPay Technologies Ltd. All rights reserved.</p>
              <div className="flex gap-2">
                {['F','I','L','X'].map(s => <a key={s} href="#" className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-800 text-gray-400 hover:bg-blue-600 hover:text-white transition-all text-xs font-bold">{s}</a>)}
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* Mobile sticky sign-in bar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 md:hidden bg-white border-t border-gray-200 px-4 py-3 shadow-2xl">
        <button onClick={submit as unknown as React.MouseEventHandler}
          disabled={isLoading}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-70"
          style={{ background: '#0B5FFF' }}>
          {isLoading
            ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Signing in…</>
            : 'Sign In'}
        </button>
      </div>
    </div>
  )
}
