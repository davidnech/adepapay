import { useEffect, useRef, useState } from 'react'
import { loadPaystack } from '../lib/paystack'
import { billingRequest, billingButton as button, billingDate as date, price, type Plan, type Order } from '../lib/billingApi'
type Billing = { subscription: { active: boolean; paidUntil: string | null; plan: string | null }; plans: Plan[]; orders: Order[]; canPay: boolean; configured: boolean; storeName: string }

export default function StoreBilling({ onContinue, onLogout, embedded = false }: { onContinue: () => void; onLogout?: () => void; embedded?: boolean }) {
  const Container = embedded ? 'section' : 'main'
  const [data, setData] = useState<Billing | null>(null), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [reload, setReload] = useState(0)
  const callback = useRef(false)
  useEffect(() => { let active = true; setError(''); billingRequest('store/billing').then(value => { if (active) setData(value) }).catch(e => { if (active) setError(e.message) }); return () => { active = false } }, [reload])
  const verify = async (reference: string) => {
    setBusy(true); setError(''); setNotice('')
    try { const result = await billingRequest('store/billing/verify', { reference }); setNotice(result.paid ? 'Payment verified. Subscription status refreshed.' : 'Payment is not confirmed yet. Wait a moment and check again.'); setReload(v => v + 1) }
    catch (e) { setError(e instanceof Error ? e.message : 'Payment verification failed.') }
    finally { setBusy(false) }
  }
  useEffect(() => {
    const reference = new URLSearchParams(location.search).get('reference')
    if (data?.canPay && reference && !callback.current) { callback.current = true; void verify(reference) }
  }, [data])
  const pay = async (plan: Plan) => {
    setBusy(true); setError('')
    try {
      const Paystack = await loadPaystack()
      const result = await billingRequest('store/billing/checkout', { planId: plan.id, revision: plan.revision })
      let completed = false
      new Paystack().newTransaction({
        key: result.key, email: result.email, amount: result.amount, currency: result.currency,
        reference: result.reference, metadata: result.metadata,
        onSuccess: () => { if (completed) return; completed = true; void verify(result.reference) },
        onCancel: () => { if (completed) return; completed = true; setBusy(false); setNotice('Checkout closed. If you paid, use Check payment to verify it.'); setReload(v => v + 1) },
        onError: () => { if (completed) return; completed = true; setBusy(false); setError('Paystack could not open checkout. Check the keys and try again.') },
      })
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to open checkout.'); setBusy(false) }
  }
  return <Container className="mx-auto min-h-screen max-w-6xl space-y-6 bg-slate-50 p-5 text-slate-900 sm:p-8">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-blue-600">AdepaPay for stores</p><h1 className="mt-2 text-3xl font-bold">Store subscription</h1><p className="mt-2 text-slate-500">{data?.storeName || 'Your store workspace'}</p></div><div className="flex gap-2"><button className={button} disabled={busy} onClick={() => setReload(v => v + 1)}>Refresh</button>{onLogout && <button className={button} onClick={onLogout}>Sign out</button>}</div></header>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}{notice && <p role="status" className="rounded-xl bg-blue-50 p-4 text-blue-800">{notice}</p>}
    {!data ? <p>Loading subscription…</p> : <>
      <section className="rounded-2xl bg-slate-900 p-6 text-white"><p className="text-sm text-slate-300">{data.subscription.active ? 'Active subscription' : 'Subscription required'}</p><h2 className="mt-2 text-2xl font-bold">{data.subscription.plan || 'Activate your store'}</h2><p className="mt-3 text-sm text-slate-300">{data.subscription.active ? `Paid access until ${date(data.subscription.paidUntil)}.` : 'An approved store needs a paid subscription before its owner, staff and agents can use the workspace or publish listings.'}</p>{data.subscription.active && <button className={`${button} mt-5 text-slate-900`} disabled={busy} onClick={onContinue}>Open workspace</button>}</section>
      {!data.canPay ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-5">Ask your store owner to pay or renew the subscription. Only the owner can access checkout.</p> : <>
        <div><h2 className="text-xl font-bold">Choose a paid term</h2><p className="mt-2 text-sm text-slate-500">Secure checkout with Paystack. These plans renew manually; there are no automatic charges. Renewing early adds time to your existing paid term. All plans provide store workspace access.</p></div>
        {!data.configured && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">Payments are not configured yet. Please contact the administrator.</p>}
        <div className="grid gap-4 md:grid-cols-3">{data.plans.map(plan => <section key={plan.id} className="rounded-2xl border border-slate-200 bg-white p-6"><h3 className="text-lg font-bold">{plan.name}</h3><p className="mt-4 text-3xl font-bold">{price(plan.amount_minor)}</p><p className="mt-2 text-sm text-slate-500">{plan.duration_days} days of store access</p><button className={`${button} mt-6 w-full !bg-blue-600 text-white`} disabled={busy || !data.configured} onClick={() => void pay(plan)}>{busy ? 'Please wait…' : 'Subscribe with Paystack'}</button></section>)}</div>
        {!data.plans.length && <p className="rounded-xl border bg-white p-5">No subscription plans are available yet. The administrator needs to publish a plan.</p>}
      </>}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><h2 className="p-5 text-lg font-bold">Recent payments</h2><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr>{['Reference', 'Plan', 'Amount', 'Status', 'Created', 'Action'].map(h => <th className="p-4" key={h}>{h}</th>)}</tr></thead><tbody>{data.orders.map(order => <tr key={order.reference} className="border-t"><td className="max-w-52 break-all p-4">{order.reference}</td><td className="p-4">{order.plan_name}</td><td className="p-4">{price(order.amount_minor)}</td><td className="p-4">{order.status}</td><td className="p-4">{date(order.created_at)}</td><td className="p-4">{order.status !== 'Paid' && data.canPay && <button className={button} disabled={busy} onClick={() => void verify(order.reference)}>Check payment</button>}</td></tr>)}</tbody></table></div>{!data.orders.length && <p className="p-5 text-slate-500">No payments yet.</p>}<p className="p-5 text-xs text-slate-500">Latest 50 payment attempts. A pending attempt does not prove that a charge occurred.</p></section>
    </>}
  </Container>
}
