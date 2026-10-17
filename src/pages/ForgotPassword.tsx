import { useState, useEffect } from 'react'
import { isValidGhanaPhoneNumber } from '../lib/localization'

type Step = 'contact' | 'otp' | 'reset' | 'success'
type Method = 'email' | 'phone'

const OTP_LEN = 6
const RESEND_CD = 60

function FloatField({
  label, value, onChange, error, type = 'text', disabled = false, children, autoComplete,
}: {
  label: string; value: string; onChange: (v: string) => void; error?: string
  type?: string; disabled?: boolean; children?: React.ReactNode; autoComplete?: string
}) {
  const [focused, setFocused] = useState(false)
  const floated = focused || value.length > 0
  return (
    <div>
      <div className="relative rounded-xl border transition-all duration-200"
        style={{ borderColor: error ? '#F04438' : focused ? '#0B5FFF' : '#E5E7EB', boxShadow: focused ? '0 0 0 3px rgba(11,95,255,0.1)' : 'none', background: disabled ? '#F9FAFB' : '#fff' }}>
        <label className="absolute left-4 transition-all duration-200 pointer-events-none font-medium select-none"
          style={{ top: floated ? '8px' : '50%', transform: floated ? 'none' : 'translateY(-50%)', fontSize: floated ? '10px' : '14px', color: error ? '#F04438' : focused ? '#0B5FFF' : '#9CA3AF' }}>
          {label}
        </label>
        <input type={type} value={value} disabled={disabled} autoComplete={autoComplete}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{ paddingRight: children ? '48px' : '16px' }}
          className="w-full bg-transparent pt-6 pb-2.5 pl-4 text-sm text-gray-900 focus:outline-none rounded-xl disabled:cursor-not-allowed disabled:text-gray-400"/>
        {children && <div className="absolute right-3 top-1/2 -translate-y-1/2">{children}</div>}
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

function PasswordStrength({ pw }: { pw: string }) {
  const score = [/.{8,}/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(r => r.test(pw)).length
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const colors = ['', '#F04438', '#F79009', '#12B76A', '#0B5FFF']
  if (!pw) return null
  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4].map(n => (
          <div key={n} className="flex-1 h-1 rounded-full transition-all duration-300"
            style={{ background: n <= score ? colors[score] : '#E5E7EB' }}/>
        ))}
      </div>
      <p className="text-xs font-medium" style={{ color: colors[score] || '#9CA3AF' }}>{labels[score] || ''}</p>
    </div>
  )
}

// ─── Shared nav shell ──────────────────────────────────────────────────────────
function Shell({ onBack, step, children }: { onBack: () => void; step: Step; children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const STEPS: Step[] = ['contact', 'otp', 'reset', 'success']
  const LABELS = ['Find Account', 'Verify', 'New Password', 'Done']
  const current = STEPS.indexOf(step)

  return (
    <div className="min-h-screen font-sans" style={{ background: '#F8FAFC' }}>
      <nav className="fixed top-0 left-0 right-0 z-30 transition-all duration-300"
        style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(16px)', borderBottom: scrolled ? '1px solid rgba(0,0,0,0.06)' : '1px solid transparent', boxShadow: scrolled ? '0 4px 24px rgba(0,0,0,0.06)' : 'none' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#0B5FFF' }}>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/>
              </svg>
            </div>
            <span className="text-lg font-bold" style={{ color: '#101828' }}>Bridge<span style={{ color: '#0B5FFF' }}>Pay</span></span>
          </button>
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
            </svg>
            Back to Login
          </button>
        </div>
      </nav>

      <div className="pt-16 min-h-screen flex flex-col items-center justify-center px-4 py-12">
        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, idx) => (
            <div key={s} className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                  style={{
                    background: idx < current ? '#ECFDF3' : idx === current ? '#0B5FFF' : '#F3F4F6',
                    color: idx < current ? '#12B76A' : idx === current ? '#fff' : '#9CA3AF',
                  }}>
                  {idx < current
                    ? <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><polyline strokeLinecap="round" strokeLinejoin="round" points="20 6 9 17 4 12"/></svg>
                    : idx + 1}
                </div>
                <span className="text-[10px] font-medium" style={{ color: idx < current ? '#12B76A' : idx === current ? '#0B5FFF' : '#9CA3AF' }}>{LABELS[idx]}</span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className="w-10 h-px mb-4 rounded-full transition-all" style={{ background: idx < current ? '#12B76A' : '#E5E7EB' }}/>
              )}
            </div>
          ))}
        </div>

        <div className="w-full max-w-md">{children}</div>
      </div>

      <footer className="py-6 px-4 border-t border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-sm font-semibold" style={{ color: '#101828' }}>Bridge<span style={{ color: '#0B5FFF' }}>Pay</span></span>
          <p className="text-xs text-gray-400">© 2026 <a href="https://bridgewaytec.com" className="underline underline-offset-4 hover:text-gray-700">Bridgeway Technology Limited</a>. All rights reserved.</p>
          <div className="flex gap-4 text-xs text-gray-400">
            <a href="/privacy" className="hover:text-gray-700 transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-gray-700 transition-colors">Terms</a>
            <a href="#" className="hover:text-gray-700 transition-colors">Help</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function ForgotPassword({ onBack, onLogin }: { onBack: () => void; onLogin?: () => void }) {
  const [step, setStep] = useState<Step>('contact')
  const [method, setMethod] = useState<Method>('email')
  const [contact, setContact] = useState('')
  const [contactError, setContactError] = useState('')

  // OTP step
  const [digits, setDigits] = useState<string[]>(Array(OTP_LEN).fill(''))
  const [otpError, setOtpError] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [countdown, setCountdown] = useState(RESEND_CD)
  const [resending, setResending] = useState(false)
  const inputRefs = Array.from({ length: OTP_LEN }, () => null as HTMLInputElement | null)
  const refsArr = { current: inputRefs }

  // Reset step
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pwErrors, setPwErrors] = useState<{ newPw?: string; confirmPw?: string }>({})
  const [pwLoading, setPwLoading] = useState(false)

  // Countdown
  useEffect(() => {
    if (step !== 'otp' || countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [step, countdown])

  // ── Step 1: Contact ──────────────────────────────────────────────────────────
  const submitContact = async () => {
    const val = contact.trim()
    if (!val) { setContactError('This field is required'); return }
    if (method === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { setContactError('Enter a valid email address'); return }
    if (method === 'phone' && !isValidGhanaPhoneNumber(val)) { setContactError('Enter a valid Ghanaian phone number'); return }
    setContactError('')
    setStep('otp')
    setCountdown(RESEND_CD)
  }

  // ── Step 2: OTP ──────────────────────────────────────────────────────────────
  const code = digits.join('')
  const filled = digits.every(d => d.length === 1)

  const handleOtpKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (digits[i]) { const n = [...digits]; n[i] = ''; setDigits(n) }
      else if (i > 0) { const n = [...digits]; n[i - 1] = ''; setDigits(n); refsArr.current[i - 1]?.focus() }
    } else if (e.key === 'ArrowLeft' && i > 0) refsArr.current[i - 1]?.focus()
    else if (e.key === 'ArrowRight' && i < OTP_LEN - 1) refsArr.current[i + 1]?.focus()
  }

  const handleOtpChange = (i: number, val: string) => {
    const f = val.replace(/\D/g, '')
    if (!f) return
    if (f.length > 1) {
      const chars = f.slice(0, OTP_LEN).split('')
      const next = [...digits]; chars.forEach((c, idx) => { if (i + idx < OTP_LEN) next[i + idx] = c }); setDigits(next)
      const fi = Math.min(i + chars.length, OTP_LEN - 1); refsArr.current[fi]?.focus(); return
    }
    const next = [...digits]; next[i] = f; setDigits(next)
    if (i < OTP_LEN - 1) refsArr.current[i + 1]?.focus()
  }

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LEN)
    const next = Array(OTP_LEN).fill(''); text.split('').forEach((c, i) => { next[i] = c }); setDigits(next)
    refsArr.current[Math.min(text.length, OTP_LEN - 1)]?.focus()
  }

  const submitOtp = async () => {
    if (!filled) return
    setOtpLoading(true); setOtpError('')
    await new Promise(r => setTimeout(r, 1400))
    setOtpLoading(false)
    if (code === '123456') { setStep('reset') }
    else { setOtpError('Incorrect code. Please try again.'); setDigits(Array(OTP_LEN).fill('')) }
  }

  const resendOtp = async () => {
    if (countdown > 0) return
    setResending(true); setOtpError(''); setDigits(Array(OTP_LEN).fill(''))
    await new Promise(r => setTimeout(r, 900))
    setResending(false); setCountdown(RESEND_CD)
  }

  // ── Step 3: Reset password ───────────────────────────────────────────────────
  const submitReset = async () => {
    const errs: typeof pwErrors = {}
    if (!newPw) errs.newPw = 'New password is required'
    else if (newPw.length < 8) errs.newPw = 'Password must be at least 8 characters'
    if (!confirmPw) errs.confirmPw = 'Please confirm your password'
    else if (newPw !== confirmPw) errs.confirmPw = 'Passwords do not match'
    if (Object.keys(errs).length) { setPwErrors(errs); return }
    setPwErrors({}); setPwLoading(true)
    await new Promise(r => setTimeout(r, 1500))
    setPwLoading(false); setStep('success')
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <Shell onBack={onBack} step="success">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-10 text-center">
          <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: '#ECFDF3' }}>
            <svg className="w-12 h-12" style={{ color: '#12B76A' }} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: '#101828' }}>Password Reset!</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-8">Your password has been updated successfully. You can now sign in with your new password.</p>
          <button onClick={onLogin ?? onBack}
            className="w-full py-3.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-all mb-3"
            style={{ background: '#0B5FFF' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
            </svg>
            Sign In Now
          </button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell onBack={onBack} step={step}>
      {/* ── STEP 1: Find account ────────────────────────────────────────────── */}
      {step === 'contact' && (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-8 pt-8 pb-6 border-b border-gray-50 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#EAF2FF' }}>
              <svg className="w-8 h-8" style={{ color: '#0B5FFF' }} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
              </svg>
            </div>
            <h1 className="text-xl font-bold mb-1" style={{ color: '#101828' }}>Forgot Your Password?</h1>
            <p className="text-sm text-gray-500 leading-relaxed">No worries — we'll send you a reset code.</p>
          </div>

          <div className="px-8 py-8 space-y-5">
            {/* Method selector */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Send reset code via</p>
              <div className="grid grid-cols-2 gap-2">
                {(['email', 'phone'] as Method[]).map(m => (
                  <button key={m} onClick={() => { setMethod(m); setContact(''); setContactError('') }}
                    className="py-2.5 px-4 rounded-xl border-2 text-sm font-semibold transition-all flex items-center justify-center gap-2"
                    style={{ borderColor: method === m ? '#0B5FFF' : '#E5E7EB', background: method === m ? '#EAF2FF' : '#fff', color: method === m ? '#0B5FFF' : '#6B7280' }}>
                    {m === 'email'
                      ? <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg> Email</>
                      : <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg> SMS</>}
                  </button>
                ))}
              </div>
            </div>

            <FloatField
              label={method === 'email' ? 'Email Address' : 'Mobile Number'}
              value={contact}
              onChange={v => { setContact(v); setContactError('') }}
              error={contactError}
              type={method === 'email' ? 'email' : 'tel'}
              autoComplete={method === 'email' ? 'email' : 'tel'}
            />

            <button onClick={submitContact}
              className="w-full py-3.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all flex items-center justify-center gap-2"
              style={{ background: '#0B5FFF' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
              Send Reset Code
            </button>

            <p className="text-center text-sm text-gray-500">
              Remember your password?{' '}
              <button onClick={onLogin ?? onBack} className="font-semibold hover:underline" style={{ color: '#0B5FFF' }}>Sign In</button>
            </p>
          </div>
        </div>
      )}

      {/* ── STEP 2: OTP ─────────────────────────────────────────────────────── */}
      {step === 'otp' && (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-8 pt-8 pb-6 border-b border-gray-50 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#EAF2FF' }}>
              <svg className="w-8 h-8" style={{ color: '#0B5FFF' }} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
              </svg>
            </div>
            <h1 className="text-xl font-bold mb-1" style={{ color: '#101828' }}>Enter Verification Code</h1>
            <p className="text-sm text-gray-500 leading-relaxed">
              A 6-digit code was sent to<br/>
              <span className="font-semibold text-gray-700">{contact}</span>
            </p>
          </div>

          <div className="px-8 py-8">
            <div className="flex items-center justify-center gap-3 mb-4" onPaste={handleOtpPaste}>
              {digits.map((d, i) => (
                <input key={i}
                  ref={el => { refsArr.current[i] = el }}
                  type="text" inputMode="numeric" maxLength={6}
                  value={d} disabled={otpLoading}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKey(i, e)}
                  onFocus={e => e.target.select()}
                  className="w-11 h-13 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all duration-200 disabled:opacity-50"
                  style={{ height: '52px', borderColor: otpError && !d ? '#F04438' : d ? '#0B5FFF' : '#E5E7EB', background: d ? '#EAF2FF' : '#FAFAFA', color: '#101828', boxShadow: d ? '0 0 0 3px rgba(11,95,255,0.08)' : 'none' }}/>
              ))}
            </div>

            {otpError && (
              <div className="flex items-start gap-2 p-3 rounded-xl mb-4 text-sm" style={{ background: '#FEF3F2', color: '#B42318' }}>
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"/>
                </svg>
                {otpError}
              </div>
            )}

            <button onClick={submitOtp} disabled={!filled || otpLoading}
              className="w-full py-3.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 mb-4 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#0B5FFF' }}>
              {otpLoading
                ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Verifying…</>
                : 'Verify & Continue'}
            </button>

            <div className="text-center">
              {resending ? (
                <p className="text-sm text-gray-400 flex items-center justify-center gap-1.5">
                  <svg className="w-3.5 h-3.5 animate-spin" style={{ color: '#0B5FFF' }} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  Sending…
                </p>
              ) : countdown > 0 ? (
                <p className="text-sm text-gray-400">
                  Resend in <span className="font-semibold tabular-nums" style={{ color: '#0B5FFF' }}>0:{String(countdown).padStart(2, '0')}</span>
                </p>
              ) : (
                <button onClick={resendOtp} className="text-sm font-semibold hover:underline" style={{ color: '#0B5FFF' }}>Resend Code</button>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-50 text-center">
              <button onClick={() => setStep('contact')} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                ← Change contact method
              </button>
            </div>
          </div>

          <div className="px-8 pb-6">
            <div className="p-3 rounded-xl text-xs text-center text-gray-400 border border-dashed border-gray-200">
              💡 <strong>Demo:</strong> Enter <span className="font-mono bg-gray-100 px-1 rounded">123456</span> to continue
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3: New password ─────────────────────────────────────────────── */}
      {step === 'reset' && (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-8 pt-8 pb-6 border-b border-gray-50 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#EAF2FF' }}>
              <svg className="w-8 h-8" style={{ color: '#0B5FFF' }} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
            </div>
            <h1 className="text-xl font-bold mb-1" style={{ color: '#101828' }}>Create New Password</h1>
            <p className="text-sm text-gray-500">Make it strong — you've got this.</p>
          </div>

          <div className="px-8 py-8 space-y-4">
            <div>
              <FloatField label="New Password" value={newPw} onChange={v => { setNewPw(v); setPwErrors(e => ({ ...e, newPw: undefined })) }}
                error={pwErrors.newPw} type={showNew ? 'text' : 'password'} disabled={pwLoading} autoComplete="new-password">
                <button type="button" onClick={() => setShowNew(!showNew)} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
                  {showNew
                    ? <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                    : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>}
                </button>
              </FloatField>
              <PasswordStrength pw={newPw}/>
            </div>

            <FloatField label="Confirm New Password" value={confirmPw} onChange={v => { setConfirmPw(v); setPwErrors(e => ({ ...e, confirmPw: undefined })) }}
              error={pwErrors.confirmPw} type={showConfirm ? 'text' : 'password'} disabled={pwLoading} autoComplete="new-password">
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
                {showConfirm
                  ? <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                  : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>}
              </button>
            </FloatField>

            {/* Requirements */}
            <ul className="grid grid-cols-2 gap-1.5">
              {[
                { label: '8+ characters', ok: newPw.length >= 8 },
                { label: 'Uppercase letter', ok: /[A-Z]/.test(newPw) },
                { label: 'Number', ok: /\d/.test(newPw) },
                { label: 'Special character', ok: /[^A-Za-z0-9]/.test(newPw) },
              ].map(r => (
                <li key={r.label} className="flex items-center gap-1.5 text-xs" style={{ color: r.ok ? '#12B76A' : '#9CA3AF' }}>
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={r.ok ? 3 : 2} viewBox="0 0 24 24">
                    {r.ok ? <polyline strokeLinecap="round" strokeLinejoin="round" points="20 6 9 17 4 12"/> : <circle cx="12" cy="12" r="9"/>}
                  </svg>
                  {r.label}
                </li>
              ))}
            </ul>

            <button onClick={submitReset} disabled={pwLoading}
              className="w-full py-3.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              style={{ background: '#0B5FFF' }}>
              {pwLoading
                ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Updating…</>
                : <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg> Update Password</>}
            </button>
          </div>
        </div>
      )}
    </Shell>
  )
}
