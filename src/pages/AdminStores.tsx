import { useEffect, useState } from 'react'
import AdminStoreProfile from './AdminStoreProfile'

export type Store = {
  id: string; storeId: string | null; storeName: string; registeredName: string; registrationNumber: string
  ownerName: string; email: string; contactEmail: string; phone: string; region: string; city: string
  status: string; categories: string[]; reference: string; createdAt: string; verification: string
  logo: string | null; cover: string | null; storeType: string; officeClassification: string
  operatingLocation: string; nearestLandmark: string; gpsAddress: string; openingHours: string
  description: string; website: string; reason: string
  lifecycle?: { revision?: number; action?: string; reason?: string; actor?: string; at?: string }
}
type Directory = { archived: number; suspended: number; stores: Store[]; summary: { total: number; active: number; pending: number; rejected: number }; regions: string[]; page: number; page_size: number; total_matches: number }
const button = 'rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold disabled:opacity-50'
const statuses = ['All', 'Active', 'Pending Approval', 'Rejected', 'Suspended', 'Deleted']
const tone = (status: string) => status === 'Active' ? 'bg-emerald-50 text-emerald-700' : status === 'Rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'

export default function AdminStoresPage({ onApprovals }: { onApprovals: () => void }) {
  const [data, setData] = useState<Directory | null>(null)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All')
  const [region, setRegion] = useState('')
  const [page, setPage] = useState(1)
  const [reload, setReload] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const storeFromHash = () => /^#admin-store\/([0-9a-f-]{36})$/i.exec(window.location.hash)?.[1] || null
  const [selected, setSelected] = useState<string | null>(storeFromHash)
  useEffect(() => {
    const sync = () => { setSelected(storeFromHash()); setReload(value => value + 1) }
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(query); setPage(1) }, 300)
    return () => window.clearTimeout(timer)
  }, [query])
  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 30000)
    let active = true
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ page: String(page), q: search, status, region })
    fetch(`/api/auth/admin/store-directory?${params}`, { credentials: 'same-origin', signal: controller.signal })
      .then(async response => {
        const result = await response.json().catch(() => null)
        if (!response.ok || !result) throw new Error(result?.error || 'Unable to load stores. Please retry.')
        if (active) setData(result)
      }).catch(error => { if (active) { setData(null); setError(error?.name === 'AbortError' ? 'Loading stores timed out. Please retry.' : error.message || 'Unable to reach the server.') } })
      .finally(() => { window.clearTimeout(timer); if (active) setLoading(false) })
    return () => { active = false; window.clearTimeout(timer); controller.abort() }
  }, [page, search, status, region, reload])
  if (selected) return <AdminStoreProfile storeId={selected} onBack={() => { window.location.hash = 'admin-stores' }} />
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-bold">Stores</h2><p className="mt-1 text-sm text-slate-500">All registered stores and their latest profile details.</p></div><div className="flex gap-2"><button className={button} onClick={onApprovals}>Store approvals</button><button className={`${button} bg-blue-600 text-white`} disabled={loading} onClick={() => setReload(value => value + 1)}>Refresh</button></div></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{([['Total registered', 'total'], ['Active stores', 'active'], ['Pending approval', 'pending'], ['Rejected', 'rejected']] as const).map(([label, key]) => <div key={key} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold">{loading ? '…' : data?.summary[key] ?? '—'}</p></div>)}</div>
    <p className="text-xs text-slate-500">Totals include current registered stores. Deleted stores and their archived products are retained in Deleted Stores.</p>
    <div className="flex flex-wrap gap-2">{statuses.map(value => <button key={value} onClick={() => { setStatus(value); setPage(1) }} className={`${button} ${status === value ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`}>{value === 'Deleted' ? `Deleted Stores (${data?.archived ?? '?'})` : value === 'Suspended' ? `Suspended (${data?.suspended ?? '?'})` : value}</button>)}</div>
    <div className="flex flex-wrap gap-3"><input aria-label="Search stores" placeholder="Search store, owner, email or reference" value={query} onChange={event => setQuery(event.target.value)} className="min-w-56 flex-1 rounded-xl border border-slate-200 p-3 text-sm" /><select aria-label="Filter stores by region" value={region} onChange={event => { setRegion(event.target.value); setPage(1) }} className="rounded-xl border border-slate-200 p-3 text-sm"><option value="">All regions</option>{data?.regions.map(value => <option key={value}>{value}</option>)}</select><button className={button} onClick={() => { setQuery(''); setSearch(''); setStatus('All'); setRegion(''); setPage(1) }}>Clear filters</button></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {loading ? <p role="status" className="p-6">Loading stores...</p> : data && <>
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{['Store', 'Owner / contact', 'Location', 'Status', 'Action'].map(label => <th key={label} className="p-4">{label}</th>)}</tr></thead><tbody>{data.stores.map(store => <tr key={store.id} className="border-t border-slate-100"><td className="p-4"><div className="flex items-center gap-3">{store.logo ? <img src={store.logo} alt="" className="h-11 w-11 rounded-xl object-cover" /> : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 font-bold text-blue-600">{store.storeName.slice(0, 2).toUpperCase()}</span>}<div className="font-semibold">{store.storeName}<p className="mt-1 text-xs font-normal text-slate-500">{store.categories.join(', ')}</p></div></div></td><td className="p-4">{store.ownerName}<p className="text-xs text-slate-500">{store.contactEmail}</p><p className="text-xs text-slate-500">{store.phone}</p></td><td className="p-4">{store.city}<p className="text-xs text-slate-500">{store.region}</p></td><td className="p-4"><span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${tone(store.status)}`}>{store.status}</span></td><td className="p-4"><button className={button} onClick={() => { window.location.hash = `admin-store/${store.id}` }}>View store</button></td></tr>)}</tbody></table>{data.stores.length === 0 && <p className="p-8 text-center text-slate-500">{data.summary.total === 0 ? 'No stores have registered yet.' : 'No stores match your filters.'}</p>}</div>
    <div className="flex items-center justify-between gap-3 text-sm text-slate-500"><p>{data.total_matches} matching stores · Page {data.page} of {Math.max(1, Math.ceil(data.total_matches / data.page_size))}</p><div className="flex gap-2"><button className={button} disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}>Previous</button><button className={button} disabled={data.page * data.page_size >= data.total_matches} onClick={() => setPage(data.page + 1)}>Next</button></div></div>
    </>}
  </div>
}
