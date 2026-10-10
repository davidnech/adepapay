import { useEffect, useState, type FormEvent } from "react"
import { authRequest, type SMSVerification } from "../lib/auth"

export default function OTPVerification({ verification, onVerified, onBack }: {
  verification: SMSVerification
  onVerified: () => Promise<void>
  onBack: () => void
}) {
  const [details, setDetails] = useState(verification)
  const [code, setCode] = useState("")
  const [countdown, setCountdown] = useState(verification.resendAfter)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(verification.notice || "")
  const [finishing, setFinishing] = useState(false)
  useEffect(() => {
    setDetails(verification)
    setCountdown(verification.resendAfter)
    setCode("")
    setError(verification.notice || "")
  }, [verification])
  useEffect(() => {
    if (countdown <= 0) return
    const timer = window.setTimeout(() => setCountdown(value => Math.max(0, value - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [countdown])
  const verify = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !/^\d{6}$/.test(code)) return
    setBusy(true); setError("")
    try {
      const result = await authRequest("sms/verify", { code })
      if (!result.verified) throw new Error("The code could not be verified.")
      setFinishing(true)
      await onVerified()
    } catch (error) {
      setError(error instanceof Error ? error.message : "Verification failed. Please try again.")
    } finally { setBusy(false); setFinishing(false) }
  }
  const resend = async () => {
    if (busy || countdown > 0) return
    setBusy(true); setError("")
    try {
      const result = await authRequest("sms/resend", {})
      if (!result.verification) throw new Error("A new code could not be requested.")
      setDetails(result.verification); setCountdown(result.verification.resendAfter)
      setCode(""); setError(result.verification.notice || "")
    } catch (error) {
      setError(error instanceof Error ? error.message : "A new code could not be requested.")
    } finally { setBusy(false) }
  }
  return <main className="grid min-h-screen place-items-center bg-slate-50 px-5 py-10"><section className="w-full max-w-md space-y-5 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
    <img src="/images/adepa_pay_logo.png" alt="AdepaPay" className="mx-auto h-24 object-contain" />
    <h1 className="text-2xl font-bold text-slate-900">Verify your phone number</h1>
    <p className="text-sm leading-6 text-slate-600">Enter the six-digit code requested for <strong>{details.phone}</strong>. SMS messages come from <strong>Adepapay</strong>. Your registration is completed after verification.</p>
    <p className="text-xs text-slate-500">This code expires at {new Date(details.expiresAt).toLocaleTimeString()}. Never share your code.</p>
    <form onSubmit={verify} className="space-y-4">
      <label className="block text-sm font-semibold text-slate-700">Verification code<input aria-label="Verification code" type="text" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} value={code} disabled={busy} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className="mt-2 w-full rounded-xl border border-slate-300 p-4 text-center text-2xl tracking-[0.4em] focus:border-blue-500 focus:outline-none" /></label>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button disabled={busy || code.length !== 6} className="w-full rounded-xl bg-blue-600 p-3 font-semibold text-white disabled:opacity-50">{finishing ? "Completing registration..." : busy ? "Please wait..." : "Verify and continue"}</button>
    </form>
    <button onClick={() => void resend()} disabled={busy || countdown > 0} className="w-full rounded-xl border border-slate-300 p-3 text-sm font-semibold disabled:opacity-50">{countdown > 0 ? `Resend code in ${countdown}s` : "Resend code"}</button>
    <button onClick={onBack} disabled={busy} className="w-full p-2 text-sm font-semibold text-blue-700 disabled:opacity-50">Back to your details</button>
  </section></main>
}
