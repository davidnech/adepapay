export type Plan = { id: string; name: string; amount_minor: number; duration_days: number; enabled: boolean; revision: number }
export type Order = { reference: string; store_id?: string; plan_name: string; amount_minor: number; currency: string; status: string; paid_at: string | null; created_at: string; environment?: string }
export const billingButton = 'rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50'
export const price = (minor: number) => new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(minor / 100)
export const billingDate = (value?: string | null) => value ? new Date(value).toLocaleString() : '—'
export async function billingRequest(path: string, body?: object) {
  const response = await fetch(`/api/auth/${path}`, { method: body ? 'POST' : 'GET', credentials: 'same-origin', signal: AbortSignal.timeout(45000), headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data) throw new Error(data?.error || 'Unable to reach the billing service. Please retry.')
  return data
}
