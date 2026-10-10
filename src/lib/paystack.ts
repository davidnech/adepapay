type InlineOptions = {
  key: string; email: string; amount: number; currency: string; reference: string
  metadata?: Record<string, string>
  onSuccess: () => void; onCancel: () => void; onError: (error: { message?: string }) => void
}
type PaystackConstructor = new () => { newTransaction: (options: InlineOptions) => void }
declare global { interface Window { PaystackPop?: PaystackConstructor } }
let loading: Promise<PaystackConstructor> | null = null

export function loadPaystack(): Promise<PaystackConstructor> {
  if (window.PaystackPop) return Promise.resolve(window.PaystackPop)
  if (loading) return loading
  loading = new Promise<PaystackConstructor>((resolve, reject) => {
    const script = document.createElement('script')
    const fail = () => { window.clearTimeout(timer); script.remove(); loading = null; reject(new Error('Paystack could not load. Check your connection and retry.')) }
    const timer = window.setTimeout(fail, 20000)
    script.src = 'https://js.paystack.co/v2/inline.js'
    script.async = true
    script.onerror = fail
    script.onload = () => {
      if (!window.PaystackPop) { fail(); return }
      window.clearTimeout(timer)
      resolve(window.PaystackPop)
    }
    document.head.appendChild(script)
  })
  return loading
}
