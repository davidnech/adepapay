import { useEffect, useState, type FormEvent } from 'react'

type Offer = {
  id?: string; description: string; discountPercent: number | string; enabled: boolean; status?: string
  name?: string; scope?: string; categories?: string[]; productIds?: string[]; startsAt?: string; endsAt?: string
  code?: string; minimumSpend?: number | string; usageLimit?: number | string; usedCount?: number; expiresAt?: string
}
type Settings = { revision: number; public_enabled: boolean; campaigns: Offer[]; codes: Offer[] }
type Product = { id: string; name: string; category: string; status: string }
type Kind = 'campaigns' | 'codes'
const button = 'rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold disabled:opacity-50'
const input = 'mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm'
const codeValue = () => `SAVE-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`
const today = () => new Date().toISOString().slice(0, 10)
const nextMonth = () => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
async function requestSettings(data?: Settings): Promise<{ settings: Settings; products: Product[] }> {
  const response = await fetch('/api/auth/store/promotions', { method: data ? 'POST' : 'GET', credentials: 'same-origin', headers: data ? { 'Content-Type': 'application/json' } : {}, body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(30000) })
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.settings) throw new Error(result?.error || 'Unable to load or save promotions. Refresh before retrying.')
  return result
}

export default function StorePromotionsPage({ storeId, initialRecord = "", initialQuery = "", onRecordChange }: { storeId?: string; initialRecord?: string; initialQuery?: string; onRecordChange?: (record: string) => void }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [tab, setTab] = useState<Kind>('campaigns')
  const [editor, setEditor] = useState<{ kind: Kind; offer: Offer } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    requestSettings().then(result => { if (active) { setSettings(result.settings); setProducts(result.products) } })
      .catch(error => { if (active) { setError(error.message); setSettings(null) } }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reload, storeId])
  useEffect(() => { setSearch(initialQuery) }, [initialQuery])
  useEffect(() => {
    if (!initialRecord) { setEditor(null); return }
    for (const kind of ["campaigns", "codes"] as Kind[]) { const offer = settings?.[kind].find(offer => offer.id === initialRecord); if (offer) { setTab(kind); setEditor({ kind, offer }); return } }
  }, [initialRecord, settings])
  const persist = async (next: Settings, message: string) => {
    if (saving) return false
    setSaving(true); setError(''); setNotice('')
    try { const result = await requestSettings(next); setSettings(result.settings); setNotice(message); return true }
    catch (error) { setError(error instanceof Error ? error.message : 'Unable to save promotions.'); return false }
    finally { setSaving(false) }
  }
  const create = (kind: Kind) => {
    setError(''); setNotice('')
    setEditor({ kind, offer: kind === 'campaigns'
      ? { name: '', description: '', discountPercent: 10, scope: 'All products', categories: [], productIds: [], startsAt: today(), endsAt: nextMonth(), enabled: true }
      : { code: codeValue(), description: '', discountPercent: 10, minimumSpend: 0, usageLimit: 100, expiresAt: nextMonth(), enabled: true } })
  }
  const saveOffer = async (offer: Offer) => {
    if (!settings || !editor) return
    const next = offer.id ? settings[editor.kind].map(item => item.id === offer.id ? offer : item) : [...settings[editor.kind], offer]
    if (await persist({ ...settings, [editor.kind]: next }, 'Offer saved.')) { setEditor(null); onRecordChange?.("") }
  }
  const remove = async (offer: Offer) => {
    if (!settings || !window.confirm(`Delete ${offer.name || offer.code}? This removes the saved offer.`)) return
    await persist({ ...settings, [tab]: settings[tab].filter(item => item.id !== offer.id) }, 'Offer deleted.')
  }
  const copy = async (code: string) => {
    try { await navigator.clipboard.writeText(code); setNotice(`Copied ${code}.`) }
    catch { setError('Could not copy automatically. Select and copy the code manually.') }
  }
  const visible = settings?.[tab].filter(item => `${item.name || item.code} ${item.description} ${item.status}`.toLowerCase().includes(search.toLowerCase())) || []
  return <div className="space-y-6">
    <div className="flex flex-wrap justify-between gap-4"><div><h2 className="text-2xl font-bold">Promotions & Codes</h2><p className="mt-1 text-sm text-slate-500">Manage store discounts and promotional codes.</p></div><div className="flex flex-wrap gap-2"><button disabled={loading || saving} className={button} onClick={() => setReload(value => value + 1)}>Refresh</button><button disabled={!settings || loading || saving} className={button} onClick={() => create('codes')}>Generate code</button><button disabled={!settings || loading || saving} className={`${button} bg-blue-600 text-white`} onClick={() => create('campaigns')}>New promotion</button></div></div>
    {error && !editor && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
    {loading ? <p role="status">Loading promotions...</p> : settings && <>
      <div className="rounded-2xl bg-blue-950 p-5 text-white"><label className="flex items-center justify-between gap-4 font-semibold">Enable public promotions<input type="checkbox" checked={settings.public_enabled} disabled={saving} onChange={event => void persist({ ...settings, public_enabled: event.target.checked }, 'Promotion availability saved.')} className="h-5 w-5" /></label><p className="mt-2 text-sm text-blue-100">Save whether offers should be available on your public catalogue. Customer checkout and redemption integration is still pending.</p></div>
      <div className="grid gap-4 sm:grid-cols-3">{[['Active promotions', settings.public_enabled ? settings.campaigns.filter(item => item.status === 'Active').length : 0], ['Active codes', settings.public_enabled ? settings.codes.filter(item => item.status === 'Active').length : 0], ['Recorded redemptions', settings.codes.reduce((sum, item) => sum + (item.usedCount || 0), 0)]].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>)}</div>
      <div className="flex flex-wrap items-center gap-3">{(['campaigns', 'codes'] as Kind[]).map(kind => <button key={kind} aria-pressed={tab === kind} className={`${button} ${tab === kind ? 'bg-blue-50 text-blue-700' : ''}`} onClick={() => { setTab(kind); setSearch('') }}>{kind === 'campaigns' ? 'Product promotions' : 'Promo codes'}</button>)}<input aria-label="Search offers" placeholder="Search name, code, or status" value={search} onChange={event => setSearch(event.target.value)} className="min-w-48 flex-1 rounded-xl border border-slate-200 p-3 text-sm" /></div>
      <div className="space-y-3">{visible.map(offer => <article key={offer.id} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><h3 className="break-words font-bold">{offer.name || offer.code} <span className="text-blue-700">· {offer.discountPercent}% off</span></h3><p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-500">{offer.description}</p><p className="mt-2 text-sm">{offer.status}{!settings.public_enabled ? ' · Public promotions disabled' : ''}</p>
        {tab === 'campaigns' ? <><p className="mt-1 text-xs text-slate-500">{offer.startsAt} through {offer.endsAt} · {offer.scope}</p><p className="mt-1 text-xs text-slate-500">{offer.scope === 'Category' ? offer.categories?.join(', ') : offer.scope === 'Selected products' ? offer.productIds?.map(id => products.find(product => product.id === id)?.name || 'Unavailable product').join(', ') : ''}</p></> : <p className="mt-1 text-xs text-slate-500">Minimum spend: GHS {Number(offer.minimumSpend).toFixed(2)} · Used {offer.usedCount}/{offer.usageLimit} · Expires {offer.expiresAt}</p>}
      </div><div className="flex flex-wrap gap-2">{offer.code && <button className={button} onClick={() => void copy(offer.code!)}>Copy code</button>}<button disabled={saving} className={button} onClick={() => { setError(''); setEditor({ kind: tab, offer: structuredClone(offer) }) }}>Edit</button><button disabled={saving} className={button} onClick={() => void persist({ ...settings, [tab]: settings[tab].map(item => item.id === offer.id ? { ...item, enabled: !item.enabled } : item) }, 'Offer status saved.')}>{offer.enabled ? 'Pause' : 'Enable'}</button><button disabled={saving || !!offer.usedCount} className={`${button} text-red-600`} onClick={() => void remove(offer)}>Delete</button></div></div></article>)}{!visible.length && <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">No offers found. Create an offer to get started.</p>}</div>
      <p className="text-xs text-slate-500">Dates use Ghana time (UTC); the end date is inclusive. Discounts are saved as percentages. Usage counts cannot be changed here.</p>
    </>}
    {editor && <OfferEditor key={`${editor.kind}-${editor.offer.id || 'new'}`} kind={editor.kind} offer={editor.offer} products={products} saving={saving} error={error} onSave={saveOffer} onClose={() => { setEditor(null); setError('') }} />}
  </div>
}

function OfferEditor({ kind, offer, products, saving, error, onSave, onClose }: { kind: Kind; offer: Offer; products: Product[]; saving: boolean; error: string; onSave: (offer: Offer) => Promise<void>; onClose: () => void }) {
  const [draft, setDraft] = useState(offer)
  const campaign = kind === 'campaigns'
  const change = (key: keyof Offer, value: unknown) => setDraft(current => ({ ...current, [key]: value }))
  const close = () => { if (!saving && (JSON.stringify(draft) === JSON.stringify(offer) || window.confirm('Discard unsaved offer changes?'))) onClose() }
  const submit = (event: FormEvent) => { event.preventDefault(); if (!saving) void onSave(draft) }
  const field = (key: keyof Offer, label: string, type = 'text', min?: number, max?: number, step = '1') => <label className="text-sm font-semibold" key={key}>{label}<input required type={type} min={min} max={max} step={step} maxLength={key === 'code' ? 40 : 160} value={String(draft[key] ?? '')} onChange={event => change(key, event.target.value)} className={input} /></label>
  const categories = [...new Set(products.map(product => product.category))].sort()
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4"><form role="dialog" aria-modal="true" aria-labelledby="offer-title" onSubmit={submit} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl"><h3 id="offer-title" className="text-xl font-bold">{offer.id ? 'Edit' : 'Create'} {campaign ? 'promotion' : 'promo code'}</h3><fieldset disabled={saving} className="mt-5 space-y-5"><div className="grid gap-4 sm:grid-cols-2">
    {campaign ? field('name', 'Promotion name') : <div>{field('code', 'Promo code')}<button type="button" disabled={!!offer.usedCount} className={`${button} mt-2`} onClick={() => change('code', codeValue())}>Generate new code</button></div>}
    {field('discountPercent', 'Discount (%)', 'number', 1, 90, '.01')}
    {campaign ? <>{field('startsAt', 'Start date', 'date')}{field('endsAt', 'End date', 'date')}<label className="text-sm font-semibold">Eligibility<select value={draft.scope} onChange={event => change('scope', event.target.value)} className={input}>{['All products', 'Category', 'Selected products'].map(scope => <option key={scope}>{scope}</option>)}</select></label></> : <>{field('minimumSpend', 'Minimum spend (GHS)', 'number', 0, 9999999999.99, '.01')}{field('usageLimit', 'Total usage limit', 'number', Math.max(1, offer.usedCount || 0), 1000000)}{field('expiresAt', 'Expiry date', 'date')}</>}
    <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={draft.enabled} onChange={event => change('enabled', event.target.checked)} />Enabled</label>
    <label className="text-sm font-semibold sm:col-span-2">Description<textarea maxLength={1000} rows={3} value={draft.description} onChange={event => change('description', event.target.value)} className={input} /></label>
    </div>
    {campaign && draft.scope !== 'All products' && <div><h4 className="text-sm font-semibold">Select {draft.scope === 'Category' ? 'categories' : 'products'}</h4><div className="mt-2 grid max-h-64 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3 sm:grid-cols-2">{(draft.scope === 'Category' ? categories.map(value => ({ id: value, label: value })) : products.map(product => ({ id: product.id, label: `${product.name} (${product.status})` }))).map(item => {
      const key = draft.scope === 'Category' ? 'categories' : 'productIds'
      const selected = draft[key] || []
      return <label key={item.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(item.id)} onChange={event => change(key, event.target.checked ? [...selected, item.id] : selected.filter(id => id !== item.id))} />{item.label}</label>
    })}{!products.length && <p className="text-sm text-slate-500">Add products to your store before choosing specific products or categories.</p>}</div></div>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-3"><button type="button" className={button} onClick={close}>Cancel</button><button type="submit" className={`${button} bg-blue-600 text-white`}>{saving ? 'Saving...' : 'Save offer'}</button></div>
    </fieldset></form></div>
}
