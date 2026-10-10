import { adminHref } from "../lib/adminNavigation"
import { useEffect, useState } from 'react'
import type { Store } from './AdminStores'

type Product = { id: string; name: string; sku: string; category: string; price: number; prices?: { hire_purchase?: number; layaway?: number; swap?: number }; stock: number; status: string }
type Customer = { id: string; name: string; email: string; phone: string; applications: number; paid: number; outstanding: number }
type Agent = { id: string; name: string; email: string; phone: string; area: string; status: string }
type Application = { id: string; reference: string; kind: string; status: string; total: number; paid: number; created_at: string }
type Rating = { application_id: string; store_score: number; product_score: number; created_at: string }
type Event = { id: string; action: string; actor: string; reason: string; created_at: string }
type Profile = { store: Store; products: Product[] | null; customers: Customer[] | null; agents: Agent[] | null; applications: Application[] | null; ratings: Rating[] | null; events: Event[] | null; warnings: string[]; summary: { products: number | null; customers: number | null; agents: number | null; activeAgents: number | null; applications: number | null; rating: number | null; ratingCount: number | null } }
const button = 'rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50'
const money = (value: number) => new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(value)
const date = (value?: string) => value ? new Date(value).toLocaleString() : 'Not provided'
const tabs = ['Overview', 'Products', 'Customers', 'Applications', 'Field agents', 'Ratings', 'Activity'] as const
type Tab = typeof tabs[number]
type Action = 'suspend' | 'reactivate' | 'delete' | 'restore'
async function requestProfile(path: string, body?: object, signal?: AbortSignal) {
  const response = await fetch(`/api/auth/admin/store-directory/${path}`, { method: body ? 'POST' : 'GET', credentials: 'same-origin', signal: signal || AbortSignal.timeout(30000), headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data) throw new Error(data?.error || 'Unable to load the store. Please retry.')
  return data
}

export default function AdminStoreProfile({ storeId, onBack }: { storeId: string; onBack: () => void }) {
  const [data, setData] = useState<Profile | null>(null)
  const [tab, setTab] = useState<Tab>('Overview')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const [action, setAction] = useState<Action | null>(null)
  const [reason, setReason] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 30000)
    setLoading(true); setError('')
    requestProfile(storeId, undefined, controller.signal).then(result => { if (active) setData(result) })
      .catch(error => { if (active) { setData(null); setError(error.name === 'AbortError' ? 'Loading timed out. Please retry.' : error.message) } })
      .finally(() => { window.clearTimeout(timer); if (active) setLoading(false) })
    return () => { active = false; controller.abort(); window.clearTimeout(timer) }
  }, [storeId, reload])
  useEffect(() => { setTab('Overview'); setPage(1); setSearch(''); setAction(null); setNotice('') }, [storeId])
  const changeTab = (value: Tab) => { setTab(value); setPage(1); setSearch('') }
  const startAction = (value: Action) => { setAction(value); setReason(''); setConfirmation(''); setActionError('') }
  const submit = async () => {
    if (!data || !action) return
    setBusy(true); setActionError('')
    try {
      await requestProfile(`${storeId}/action`, { action, reason, confirmation, revision: data.store.lifecycle?.revision || 0, status: data.store.status === 'Active' ? 'Approved' : data.store.status })
      setNotice(action === 'delete' ? 'Store and products moved to Deleted Stores.' : action === 'suspend' ? 'Store suspended. Marketplace and store access are disabled.' : action === 'restore' ? 'Store restored to its status before deletion. Product statuses have been restored.' : 'Store reactivated.')
      setAction(null); setReload(value => value + 1)
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Action failed. Refresh the profile before retrying.') }
    finally { setBusy(false) }
  }
  const store = data?.store
  let headings: string[] = [], rows: { id: string; cells: string[] }[] = [], unavailable = false
  if (data) {
    if (tab === 'Products') { headings = ['Product', 'SKU', 'Category', 'Cash price', 'Hire Purchase price', 'Layaway price', 'Swap price', 'Stock', store?.status === 'Deleted' ? 'Status at deletion' : 'Status']; unavailable = data.products === null; rows = (data.products || []).map(p => ({ id: p.id, cells: [p.name, p.sku, p.category, money(p.price), money(p.prices?.hire_purchase ?? p.price), money(p.prices?.layaway ?? p.price), money(p.prices?.swap ?? p.price), String(p.stock), p.status] })) }
    if (tab === 'Customers') { headings = ['Customer', 'Email', 'Phone', 'Applications', 'Paid', 'Outstanding']; unavailable = data.customers === null; rows = (data.customers || []).map(c => ({ id: c.id, cells: [c.name, c.email, c.phone, String(c.applications), money(c.paid), money(c.outstanding)] })) }
    if (tab === 'Applications') { headings = ['Reference', 'Plan', 'Status', 'Total', 'Paid', 'Created']; unavailable = data.applications === null; rows = (data.applications || []).map(a => ({ id: a.id, cells: [a.reference, a.kind.replace('_', ' '), a.status, money(a.total), money(a.paid), date(a.created_at)] })) }
    if (tab === 'Field agents') { headings = ['Name', 'Email', 'Phone', 'Area', 'Status']; unavailable = data.agents === null; rows = (data.agents || []).map(a => ({ id: a.id, cells: [a.name, a.email, a.phone, a.area, a.status] })) }
    if (tab === 'Ratings') { headings = ['Purchase', 'Store rating', 'Product rating', 'Submitted']; unavailable = data.ratings === null; rows = (data.ratings || []).map(r => ({ id: r.application_id, cells: [data.applications?.find(a => a.id === r.application_id)?.reference || r.application_id, `${r.store_score} / 5`, `${r.product_score} / 5`, date(r.created_at)] })) }
    if (tab === 'Activity') { headings = ['Action', 'Administrator', 'Reason', 'Date']; unavailable = data.events === null; rows = (data.events || []).slice().reverse().map(e => ({ id: e.id, cells: [e.action, e.actor, e.reason, date(e.created_at)] })) }
  }
  const filtered = rows.filter(row => row.cells.join(' ').toLowerCase().includes(search.toLowerCase()))
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 20)))
  return <div className="space-y-6">
    <div className="flex flex-wrap justify-between gap-3"><button className={button} onClick={onBack}>← Back to stores</button><button disabled={loading || busy} className={button} onClick={() => setReload(value => value + 1)}>Refresh profile</button></div>
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{notice}</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
    {loading ? <p role="status" className="p-8">Loading store profile…</p> : data && store && <>
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
        {store.cover ? <img src={store.cover} alt="Store cover" className="h-44 w-full object-cover sm:h-56" /> : <div className="h-32 bg-gradient-to-r from-blue-950 via-blue-800 to-sky-600" />}
        <div className="p-6"><div className="flex flex-wrap items-start justify-between gap-5"><div className="flex items-center gap-4">{store.logo && <img src={store.logo} alt="Store logo" className="h-20 w-20 rounded-2xl border border-slate-200 object-cover" />}<div><p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Admin / Stores / Profile</p><h2 className="mt-2 text-2xl font-bold sm:text-3xl">{store.storeName}</h2><p className="mt-1 text-sm text-slate-500">{[store.city, store.region].filter(Boolean).join(', ') || 'Location not provided'}</p></div></div><span className={`rounded-full px-4 py-2 text-sm font-semibold ${store.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{store.status}</span></div>
        <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-slate-600">{store.description || 'No store description provided.'}</p>
        <div className="mt-5 flex flex-wrap gap-2">{store.status === 'Pending Approval' && <a className={`${button} text-blue-700`} href={adminHref("store-approvals", store.id)}>Review store application</a>}{store.status === 'Active' && <button className={`${button} text-amber-800`} onClick={() => startAction('suspend')}>Suspend store</button>}{store.status === 'Suspended' && <button className={`${button} text-emerald-700`} onClick={() => startAction('reactivate')}>Reactivate store</button>}{store.status === 'Deleted' && <button className={`${button} text-emerald-700`} onClick={() => startAction('restore')}>Restore store</button>}{store.status !== 'Deleted' && <button className={`${button} text-red-700`} onClick={() => startAction('delete')}>Delete store</button>}</div>
        {store.status === 'Deleted' && <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">Archived on {date(store.lifecycle?.at)}. Products below show their saved state at deletion. Customer applications and payment history are retained.</p>}
        {store.lifecycle?.reason && <p className="mt-4 text-sm text-slate-600"><strong>Latest admin reason:</strong> {store.lifecycle.reason}</p>}
        </div>
      </section>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['Store rating', data.summary.rating === null ? (data.summary.ratingCount === null ? 'Unavailable' : 'Not rated') : `${data.summary.rating.toFixed(1)} / 5`, data.summary.ratingCount === null ? 'Ratings unavailable' : `${data.summary.ratingCount} verified purchase ratings`], ['Customers', data.summary.customers ?? '—', 'Unique customers with applications'], ['Field agents', data.summary.agents ?? '—', `${data.summary.activeAgents ?? '—'} agents marked active`], [store.status === 'Deleted' ? 'Archived products' : 'Products', data.summary.products ?? '—', `${data.summary.applications ?? '—'} customer applications`]].map(([label, value, hint]) => <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p><p className="mt-2 text-xs text-slate-500">{hint}</p></div>)}</div>
      {data.warnings.length > 0 && <div role="alert" className="space-y-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{data.warnings.map(warning => <p key={warning}>{warning}</p>)}</div>}
      <nav aria-label="Store profile sections" className="flex gap-2 overflow-x-auto">{tabs.map(value => <button key={value} aria-current={tab === value ? 'page' : undefined} className={`${button} whitespace-nowrap ${tab === value ? '!bg-blue-600 text-white' : ''}`} onClick={() => changeTab(value)}>{value}</button>)}</nav>
      {tab === 'Overview' ? <section className="rounded-2xl border border-slate-200 bg-white p-6"><h3 className="text-lg font-bold">Store and registration details</h3><dl className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{[['Store ID', store.storeId], ['Reference', store.reference], ['Owner', store.ownerName], ['Account email', store.email], ['Contact email', store.contactEmail], ['Phone', store.phone], ['Registered name', store.registeredName], ['Registration number', store.registrationNumber], ['Store type', store.storeType], ['Office classification', store.officeClassification], ['Categories', store.categories.join(', ')], ['Region', store.region], ['City', store.city], ['Operating address', store.operatingLocation], ['Nearest landmark', store.nearestLandmark], ['GhanaPost GPS', store.gpsAddress], ['Opening hours', store.openingHours], ['Website', store.website], ['Document verification', store.verification], ['Registered on', date(store.createdAt)]].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold">{value || 'Not provided'}</dd></div>)}</dl></section> : <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="flex flex-wrap items-center justify-between gap-3 p-5"><h3 className="font-bold">{tab} {!unavailable && `(${rows.length})`}</h3><input aria-label={`Search ${tab.toLowerCase()}`} placeholder={`Search ${tab.toLowerCase()}`} value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} className="rounded-xl border border-slate-300 p-3 text-sm" /></div>{unavailable ? <p className="p-6 text-amber-800">This section is unavailable. Apply the database setup shown above and refresh.</p> : <><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{headings.map(h => <th key={h} className="p-4">{h}</th>)}</tr></thead><tbody>{filtered.slice((currentPage - 1) * 20, currentPage * 20).map(row => <tr key={row.id} className="border-t border-slate-100">{row.cells.map((cell, i) => <td key={i} className="max-w-sm break-words p-4">{cell || '—'}</td>)}</tr>)}</tbody></table></div>{!filtered.length && <p className="p-8 text-center text-slate-500">{search ? 'No matching records.' : 'No records yet.'}</p>}<div className="flex items-center justify-between border-t border-slate-100 p-4 text-sm"><p>{filtered.length} records · Page {currentPage}</p><div className="flex gap-2"><button className={button} disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><button className={button} disabled={currentPage * 20 >= filtered.length} onClick={() => setPage(currentPage + 1)}>Next</button></div></div></>}</section>}
    </>}
    {action && store && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4"><section role="dialog" aria-modal="true" aria-labelledby="store-action-title" className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"><h3 id="store-action-title" className="text-xl font-bold">{action === 'delete' ? 'Delete store' : action === 'suspend' ? 'Suspend store' : action === 'restore' ? 'Restore store' : 'Reactivate store'}: {store.storeName}</h3><p className="text-sm text-slate-600">{action === 'delete' ? 'This moves the store and all products into Deleted Stores. Store access and new applications stop. Customer and payment records remain available for review. An administrator can restore the store later.' : action === 'suspend' ? 'This hides the store and its products from the marketplace and blocks owner, staff and agent access. Existing plans are retained. You can reactivate the store later.' : action === 'restore' ? 'This restores the store to its status before deletion and restores previous product statuses. Pending, rejected or suspended stores keep that status. Current stock, customer applications and payments are retained.' : 'This restores store access and makes its active products available again.'}</p>{(action === 'suspend' || action === 'delete') && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Existing plans cannot receive store payments or fulfilment while access is disabled. Review open applications before continuing.</p>}<label className="block text-sm font-semibold">Reason<textarea autoFocus value={reason} onChange={e => setReason(e.target.value)} maxLength={2000} rows={3} disabled={busy} className="mt-2 w-full rounded-xl border border-slate-300 p-3" /></label>{action === 'delete' && <label className="block text-sm font-semibold">Type “{store.storeName}” to confirm<input value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={busy} className="mt-2 w-full rounded-xl border border-slate-300 p-3" /></label>}{actionError && <p role="alert" className="text-sm text-red-700">{actionError}</p>}<div className="flex justify-end gap-3"><button className={button} disabled={busy} onClick={() => setAction(null)}>Cancel</button><button className={`${button} !bg-slate-900 text-white`} disabled={busy || reason.trim().length < 3 || (action === 'delete' && confirmation !== store.storeName)} onClick={() => void submit()}>{busy ? 'Saving…' : 'Confirm'}</button></div></section></div>}
  </div>
}
