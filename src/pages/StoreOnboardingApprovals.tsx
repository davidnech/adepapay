import { useEffect, useState } from "react"

type Application = {
  id: string; email: string; storeName: string; registeredName: string; ownerName: string
  registrationNumber: string; storeType: string; officeClassification: string; phone: string
  region: string; city: string; categories: string[]; reference: string
  status: string; reason: string; reviewed_at?: string; reviewer?: string; version: string
}
const button = "rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-50"

async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/auth/admin/stores${path}`, {
    method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok || !result) throw new Error(result?.error || 'Unable to reach store approvals. Please retry.')
  return result
}

export default function StoreOnboardingApprovalsPage({ onApplicationsChange, initialRecord = "", onRecordChange }: { onApplicationsChange?: () => void; initialRecord?: string; onRecordChange?: (record: string) => void }) {
  const [applications, setApplications] = useState<Application[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [selected, setSelected] = useState<Application | null>(null)
  const [decision, setDecision] = useState<'approve' | 'reject'>('approve')
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reload, setReload] = useState(0)
  const [search, setSearch] = useState("")
  const [total, setTotal] = useState(0)
  useEffect(() => { const timer = window.setTimeout(() => { setSearch(query); setPage(1) }, 300); return () => window.clearTimeout(timer) }, [query])
  useEffect(() => {
    if (!initialRecord) { setSelected(null); return }
    let active = true
    setSelected(null); setError("")
    api<{ application: Application }>(`/${encodeURIComponent(initialRecord)}`).then(result => { if (active) { setSelected(result.application); setReason(''); setConfirmed(false); setDecision('approve') } }).catch(error => { if (active) setError(error.message) })
    return () => { active = false }
  }, [initialRecord, reload])
  const selectRecord = (row: Application | null) => { setSelected(row); onRecordChange?.(row?.id || "") }

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    api<{ applications: Application[]; has_more: boolean; total: number; page: number }>(`?${new URLSearchParams({ scope: 'all', page: String(page), q: search, status: filter })}`)
      .then(result => { if (active) { setApplications(result.applications); setHasMore(result.has_more); setTotal(result.total); setPage(result.page) } })
      .catch(error => { if (active) { setApplications([]); setError(error instanceof Error ? error.message : 'Unable to load applications.') } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page, search, filter, reload])

  const visible = applications

  const submit = async () => {
    if (!selected || saving) return
    if (!confirmed) { setError('Confirm that you reviewed the application.'); return }
    if (decision === 'reject' && !reason.trim()) { setError('Provide a reason for rejecting this application.'); return }
    setSaving(true)
    setError('')
    try {
      const result = await api<{ application: Application }>(`/${selected.id}/decision`, { decision, reason, version: selected.version })
      setApplications(rows => rows.map(row => row.id === result.application.id ? result.application : row))
      selectRecord(null)
      setNotice(`${result.application.storeName}: ${result.application.status}. The decision has been saved.`)
      onApplicationsChange?.()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The decision could not be saved. Refresh to check its status.')
    } finally { setSaving(false) }
  }

  return <div className="space-y-6">
    <div className="flex items-start justify-between gap-4"><div><h2 className="text-2xl font-bold">Store Approvals</h2><p className="mt-1 text-sm text-slate-500">Review registered stores and decide whether to enable store manager access.</p></div><button className={button} disabled={loading || saving} onClick={() => { selectRecord(null); setReload(value => value + 1); onApplicationsChange?.() }}>Refresh</button></div>
    {notice && <p role="status" className="rounded-xl bg-green-50 p-4 text-green-800">{notice}</p>}
    {error && !selected && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
    <div className="flex flex-wrap gap-3"><input aria-label="Search all store applications" placeholder="Search store, owner, email or reference" value={query} onChange={event => setQuery(event.target.value)} className="min-w-60 flex-1 rounded-xl border border-slate-200 p-3 text-sm" /><select aria-label="Application status" value={filter} onChange={event => { setFilter(event.target.value); setPage(1) }} className="rounded-xl border border-slate-200 p-3 text-sm">{['All', 'Pending Approval', 'Approved', 'Rejected', 'Suspended', 'Deleted'].map(status => <option key={status}>{status}</option>)}</select></div>
    {loading ? <p role="status">Loading applications...</p> : <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{['Store', 'Owner', 'Location', 'Status', 'Action'].map(label => <th key={label} className="p-4">{label}</th>)}</tr></thead><tbody>{visible.map(row => <tr key={row.id} className="border-t border-slate-100"><td className="p-4 font-semibold">{row.storeName}<div className="max-w-56 break-all text-xs font-normal text-slate-400">{row.reference}</div></td><td className="p-4">{row.ownerName}<div className="text-xs text-slate-500">{row.email}</div></td><td className="p-4">{row.city}, {row.region}</td><td className="p-4">{row.status}</td><td className="p-4"><button className={button} onClick={() => { selectRecord(row); setReason(''); setConfirmed(false); setDecision('approve'); setError('') }}>{row.status === 'Pending Approval' ? 'Review' : 'View decision'}</button></td></tr>)}</tbody></table>{visible.length === 0 && <p className="p-8 text-center text-slate-500">No matching store applications.</p>}</div>}
    <div className="flex items-center justify-between gap-3 text-sm text-slate-500"><span>Page {page} · Search and filters apply to this page.</span><div className="flex gap-2"><button className={button} disabled={page === 1 || loading} onClick={() => setPage(value => value - 1)}>Previous</button><button className={button} disabled={!hasMore || loading} onClick={() => setPage(value => value + 1)}>Next</button></div></div>
    {selected && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4"><section role="dialog" aria-modal="true" aria-labelledby="store-review-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl"><div className="flex justify-between gap-4"><h3 id="store-review-title" className="text-xl font-bold">{selected.storeName}</h3><button className={button} disabled={saving} onClick={() => selectRecord(null)}>Close</button></div><p className="mt-2 text-sm text-slate-500">{selected.status}</p><dl className="mt-5 grid gap-4 sm:grid-cols-2">{[['Registered business', selected.registeredName], ['Registration number', selected.registrationNumber], ['Owner', selected.ownerName], ['Email', selected.email], ['Phone', selected.phone], ['Store type', selected.storeType], ['Office', selected.officeClassification], ['Location', `${selected.city}, ${selected.region}`], ['Categories', selected.categories.join(', ')], ['Reference', selected.reference]].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{value || 'Not provided'}</dd></div>)}</dl>
    {selected.status !== 'Pending Approval' ? <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm"><p>{selected.reason || 'No additional note.'}</p><p className="mt-2 text-slate-500">Reviewed by {selected.reviewer} {selected.reviewed_at ? `on ${new Date(selected.reviewed_at).toLocaleString()}` : ''}</p></div> : <fieldset disabled={saving} className="mt-6 space-y-4 border-t border-slate-200 pt-5"><label className="block text-sm font-semibold">Decision<select value={decision} onChange={event => setDecision(event.target.value as 'approve' | 'reject')} className="mt-2 w-full rounded-xl border border-slate-200 p-3"><option value="approve">Approve store</option><option value="reject">Reject application</option></select></label><label className="block text-sm font-semibold">{decision === 'reject' ? 'Rejection reason (required)' : 'Message to store (optional)'}<textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={2000} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 p-3" /></label><label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I have reviewed these details and confirm this decision.</label>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<button className={`${button} bg-blue-600 text-white`} disabled={saving || !confirmed} onClick={submit}>{saving ? 'Saving...' : decision === 'approve' ? 'Approve store' : 'Reject application'}</button></fieldset>}
    </section></div>}
  </div>
}
