import { useState, useEffect, useRef } from 'react'

type PageState = 'idle' | 'loading' | 'success' | 'error' | 'resending'

const DEMO_CONTACT = '+233 24 123 4567'
const OTP_LENGTH = 6
const RESEND_COOLDOWN = 60

export default function OTPVerification({
  onBack, onSuccess, contact,
}: {
  onBack: () => void
  onSuccess?: () => void
  contact?: string
}) {
  const displayContact = contact || DEMO_CONTACT
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [pageState, setPageState] = useState<PageState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN)
  const [attempts, setAttempts] = useState(0)
  const [scrolled, setScrolled] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>(Array(OTP_LENGTH).fill(null))

  // Sticky nav shadow
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  // Resend countdown
  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  // Auto-focus first input
  useEffect(() => { inputRefs.current[0]?.focus() }, [])

  const filled = digits.every(d => d.length === 1)
  const code = digits.join('')

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (digits[i]) {
        const next = [...digits]; next[i] = ''; setDigits(next)
      } else if (i > 0) {
        const next = [...digits]; next[i - 1] = ''; setDigits(next)
        inputRefs.current[i - 1]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      inputRefs.current[i - 1]?.focus()
    } else if (e.key === 'ArrowRight' && i < OTP_LENGTH - 1) {
      inputRefs.current[i + 1]?.focus()
    }
  }

  const handleChange = (i: number, val: string) => {
    const filtered = val.replace(/\D/g, '')
    if (!filtered) return
    // Handle paste of multiple digits
    if (filtered.length > 1) {
      const chars = filtered.slice(0, OTP_LENGTH).split('')
      const next = [...digits]
      chars.forEach((c, idx) => { if (i + idx < OTP_LENGTH) next[i + idx] = c })
      setDigits(next)
      const focusIdx = Math.min(i + chars.length, OTP_LENGTH - 1)
      inputRefs.current[focusIdx]?.focus()
      return
    }
    const next = [...digits]; next[i] = filtered; setDigits(next)
    if (i < OTP_LENGTH - 1) inputRefs.current[i + 1]?.focus()
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    const next = Array(OTP_LENGTH).fill('')
    text.split('').forEach((c, i) => { next[i] = c })
    setDigits(next)
    const focusIdx = Math.min(text.length, OTP_LENGTH - 1)
    inputRefs.current[focusIdx]?.focus()
  }

  const submit = async () => {
    if (!filled) return
    setPageState('loading')
    setErrorMsg('')
    await new Promise(r => setTimeout(r, 1500))
    // Demo: correct OTP is 123456, fail otherwise
    if (code === '123456' || attempts >= 1) {
      setPageState('success')
      setTimeout(() => onSuccess?.(), 1800)
    } else {
      setAttempts(a => a + 1)
      setPageState('error')
      setErrorMsg('Incorrect code. Please try again or request a new one.')
      setDigits(Array(OTP_LENGTH).fill(''))
      inputRefs.current[0]?.focus()
    }
  }

  const resend = async () => {
    if (countdown > 0) return
    setPageState('resending')
    setErrorMsg('')
    setDigits(Array(OTP_LENGTH).fill(''))
    inputRefs.current[0]?.focus()
    await new Promise(r => setTimeout(r, 1000))
    setCountdown(RESEND_COOLDOWN)
    setPageState('idle')
  }

  const isLoading = pageState === 'loading' || pageState === 'resending'

  // ── Success ──────────────────────────────────────────────────────────────────
  if (pageState === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#F8FAFC' }}>
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-10 max-w-sm w-full text-center">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="w-24 h-24 rounded-full flex items-center justify-center" style={{ background: '#ECFDF3' }}>
              <svg className="w-12 h-12" style={{ color: '#12B76A' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-green-500 border-2 border-white flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><polyline strokeLinecap="round" strokeLinejoin="round" points="20 6 9 17 4 12"/></svg>
            </span>
          </div>
          <h2 className="text-xl font-bold mb-1" style={{ color: '#101828' }}>Verified!</h2>
          <p className="text-sm text-gray-500 mb-2">Your identity has been confirmed.</p>
          <p className="text-xs text-gray-400 flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5 animate-spin" style={{ color: '#0B5FFF' }} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Redirecting to your dashboard…
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen font-sans" style={{ background: '#F8FAFC' }}>

      {/* NAV */}
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
            Back
          </button>
        </div>
      </nav>

      <div className="pt-16 min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {['Account', 'Verify', 'Done'].map((label, idx) => (
              <div key={label} className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                    style={{
                      background: idx === 0 ? '#ECFDF3' : idx === 1 ? '#0B5FFF' : '#F3F4F6',
                      color: idx === 0 ? '#12B76A' : idx === 1 ? '#fff' : '#9CA3AF',
                    }}>
                    {idx === 0
                      ? <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><polyline strokeLinecap="round" strokeLinejoin="round" points="20 6 9 17 4 12"/></svg>
                      : idx + 1}
                  </div>
                  <span className="text-[10px] font-medium" style={{ color: idx === 1 ? '#0B5FFF' : idx === 0 ? '#12B76A' : '#9CA3AF' }}>{label}</span>
                </div>
                {idx < 2 && <div className="w-10 h-px mb-4 rounded-full" style={{ background: idx === 0 ? '#12B76A' : '#E5E7EB' }}/>}
              </div>
            ))}
          </div>

          {/* Card */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="px-8 pt-8 pb-6 text-center border-b border-gray-50">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#EAF2FF' }}>
                <svg className="w-8 h-8" style={{ color: '#0B5FFF' }} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                </svg>
              </div>
              <h1 className="text-xl font-bold mb-1" style={{ color: '#101828' }}>Enter Verification Code</h1>
              <p className="text-sm text-gray-500 leading-relaxed">
                We sent a 6-digit code to<br/>
                <span className="font-semibold text-gray-700">{displayContact}</span>
              </p>
            </div>

            <div className="px-8 py-8">
              {/* OTP inputs */}
              <div className="flex items-center justify-center gap-3 mb-2" onPaste={handlePaste}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={el => { inputRefs.current[i] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={d}
                    disabled={isLoading}
                    onChange={e => handleChange(i, e.target.value)}
                    onKeyDown={e => handleKey(i, e)}
                    onFocus={e => e.target.select()}
                    className="w-12 h-14 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      borderColor: pageState === 'error' && !d ? '#F04438' : d ? '#0B5FFF' : '#E5E7EB',
                      background: d ? '#EAF2FF' : '#FAFAFA',
                      color: '#101828',
                      boxShadow: d ? '0 0 0 3px rgba(11,95,255,0.08)' : 'none',
                    }}
                  />
                ))}
              </div>

              {/* Error message */}
              {errorMsg && (
                <div className="flex items-start gap-2 p-3 rounded-xl mb-4 text-sm" style={{ background: '#FEF3F2', color: '#B42318' }}>
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"/>
                  </svg>
                  {errorMsg}
                </div>
              )}

              {/* Verify button */}
              <button
                onClick={submit}
                disabled={!filled || isLoading}
                className="w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-4"
                style={{ background: '#0B5FFF' }}
              >
                {pageState === 'loading'
                  ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Verifying…</>
                  : <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg> Verify Code</>}
              </button>

              {/* Resend */}
              <div className="text-center">
                {pageState === 'resending' ? (
                  <p className="text-sm text-gray-400 flex items-center justify-center gap-1.5">
                    <svg className="w-3.5 h-3.5 animate-spin" style={{ color: '#0B5FFF' }} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Sending new code…
                  </p>
                ) : countdown > 0 ? (
                  <p className="text-sm text-gray-400">
                    Resend code in <span className="font-semibold tabular-nums" style={{ color: '#0B5FFF' }}>0:{String(countdown).padStart(2, '0')}</span>
                  </p>
                ) : (
                  <button onClick={resend} className="text-sm font-semibold hover:underline transition-colors" style={{ color: '#0B5FFF' }}>
                    Resend Code
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Help text */}
          <div className="mt-4 p-4 rounded-2xl border border-gray-100 bg-white shadow-sm">
            <p className="text-xs text-gray-500 text-center leading-relaxed mb-2">
              Didn't receive the code? Check your spam folder or try a different contact method.
            </p>
            <div className="flex items-center justify-center gap-4">
              <button className="text-xs font-medium hover:underline transition-colors" style={{ color: '#0B5FFF' }}>Use Email Instead</button>
              <span className="text-gray-200">|</span>
              <button className="text-xs font-medium hover:underline transition-colors" style={{ color: '#0B5FFF' }}>Contact Support</button>
            </div>
          </div>

          {/* Demo hint */}
          <div className="mt-3 p-3 rounded-xl text-xs text-center text-gray-400 border border-dashed border-gray-200">
            💡 <strong>Demo:</strong> Enter <span className="font-mono bg-gray-100 px-1 rounded">123456</span> to verify, or any 6 digits to see the error state first.
          </div>

          {/* Security info */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-gray-400">
            {[{ icon: '🔒', text: 'Encrypted' }, { icon: '⏱️', text: 'Expires in 10 min' }, { icon: '🛡️', text: 'Single use' }].map(s => (
              <span key={s.text} className="flex items-center gap-1">{s.icon} {s.text}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-6 px-4 border-t border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-sm font-semibold" style={{ color: '#101828' }}>Bridge<span style={{ color: '#0B5FFF' }}>Pay</span></span>
          <p className="text-xs text-gray-400">© 2026 AdepaPay Technologies Ltd. All rights reserved.</p>
          <div className="flex gap-4 text-xs text-gray-400">
            <a href="#" className="hover:text-gray-700 transition-colors">Privacy</a>
            <a href="#" className="hover:text-gray-700 transition-colors">Terms</a>
            <a href="#" className="hover:text-gray-700 transition-colors">Help</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
