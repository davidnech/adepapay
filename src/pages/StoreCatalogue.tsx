import ProductPrices, { type OptionPrices } from "../components/ProductPrices"
import { useEffect, useState, type FormEvent } from 'react'

type Row = Record<string, string | number | null>
type Product = { id: string; name: string; category: string; stock: number; status: string; price: number; prices?: OptionPrices }
const button = 'rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold disabled:opacity-50'
const input = 'mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm disabled:bg-slate-50'
const label = (value: unknown) => String(value ?? '').replace(/_/g, ' ')
const money = (value: unknown) => new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(Number(value || 0))
const statuses = ['HELD_FOR_SWAP', 'AVAILABLE', 'RESOLD']
async function requestData(path: string, data?: Row) {
  const response = await fetch(`/api/auth/store/${path}`, { method: data ? 'POST' : 'GET', credentials: 'same-origin', headers: data ? { 'Content-Type': 'application/json' } : {}, body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(30000) })
  const result = await response.json().catch(() => null)
  if (!response.ok || !result) throw new Error(result?.error || 'Unable to load or save this record. Please retry.')
  return result
}

export default function StoreCataloguePage({ trade = false, initialRecord = "", initialQuery = "", onRecordChange }: { trade?: boolean; initialRecord?: string; initialQuery?: string; onRecordChange?: (record: string) => void }) {
  const path = trade ? 'trade-inventory' : 'categories'
  const [rows, setRows] = useState<Row[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [reload, setReload] = useState(0)
  const [editor, setEditor] = useState<Row | null>(null)
  const [view, setView] = useState<Row | null>(null)
  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setLoaded(false)
    requestData(path).then(result => { if (active) { setRows(trade ? result.items : result.categories); setProducts(result.products || []); setLoaded(true) } })
      .catch(error => { if (active) setError(error.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [path, reload, trade])
  useEffect(() => { setSearch(initialQuery); setStatus("") }, [initialQuery])
  useEffect(() => { setView(rows.find(row => row.id === initialRecord) || null) }, [rows, initialRecord])
  const add = () => {
    setError(''); setNotice('')
    setEditor(trade ? { reference: `TI-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, device: '', serial_number: '', source_reference: '', condition: 'Good', acquisition_value: '', received_on: new Date().toISOString().slice(0, 10), notes: '', status: 'HELD_FOR_SWAP' } : { name: '', description: '', status: 'Active' })
  }
  const save = async (draft: Row) => {
    if (saving) return
    setSaving(true); setError('')
    try { await requestData(path, draft); setEditor(null); setNotice('Record saved.'); setReload(value => value + 1) }
    catch (error) { setError(error instanceof Error ? error.message : 'Unable to save record.') }
    finally { setSaving(false) }
  }
  const visible = rows.filter(row => (!status || row.status === status) && (trade ? `${row.device} ${row.reference} ${row.serial_number} ${row.source_reference}` : `${row.name} ${row.description}`).toLowerCase().includes(search.toLowerCase()))
  const stats = trade ? [['Held for checks', rows.filter(row => row.status === statuses[0]).length], ['Available', rows.filter(row => row.status === statuses[1]).length], ['Resold', rows.filter(row => row.status === statuses[2]).length], ['Stock acquisition value', money(rows.filter(row => row.status !== 'RESOLD').reduce((sum, row) => sum + Number(row.acquisition_value), 0))]] : [['Categories', rows.length], ['Active categories', rows.filter(row => row.status === 'Active').length], ['Products', products.length], ['Stock units', products.reduce((sum, product) => sum + product.stock, 0)]]
  return <div className="space-y-6">
    <div className="flex flex-wrap justify-between gap-4"><div><h2 className="text-2xl font-bold">{trade ? 'Trade-in Inventory' : 'Categories'}</h2><p className="mt-1 text-sm text-slate-500">{trade ? 'Track received devices, inspection status, and resale records.' : 'Organize your products with consistent categories and live stock counts.'}</p></div><div className="flex gap-2"><button className={button} disabled={loading || saving} onClick={() => setReload(value => value + 1)}>Refresh</button><button className={`${button} bg-blue-600 text-white`} disabled={!loaded || loading} onClick={add}>{trade ? 'Receive device' : 'Add category'}</button></div></div>
    {error && !editor && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}{notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
    {loading ? <p role="status">Loading {trade ? 'inventory' : 'categories'}...</p> : loaded && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(([title, value]) => <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{title}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>)}</div>
      <p className="rounded-xl bg-blue-50 p-4 text-sm text-blue-800">{trade ? 'Record devices actually received by the store. Recording resale does not collect a payment or publish a product listing.' : 'Product categories appear here automatically. Renaming a category updates its products and category-based promotions. Archived categories retain their products but cannot receive new assignments.'}</p>
      <div className="flex flex-wrap gap-3"><input aria-label="Search records" value={search} onChange={event => setSearch(event.target.value)} placeholder={trade ? 'Search device, reference, or serial number' : 'Search categories'} className="min-w-48 flex-1 rounded-xl border border-slate-200 p-3 text-sm" /><select aria-label="Filter status" value={status} onChange={event => setStatus(event.target.value)} className="rounded-xl border border-slate-200 p-3 text-sm"><option value="">All statuses</option>{(trade ? statuses : ['Active', 'Archived']).map(value => <option key={value} value={value}>{label(value)}</option>)}</select></div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{(trade ? ['Device / Reference', 'Condition / Received', 'Acquisition / Resale', 'Status', 'Actions'] : ['Category', 'Products', 'Active products', 'Stock units', 'Status', 'Actions']).map(title => <th className="p-4" key={title}>{title}</th>)}</tr></thead><tbody>{visible.map(row => <tr key={row.id} className="border-t border-slate-100">
        {trade ? <><td className="p-4 font-semibold">{row.device}<p className="text-xs font-normal text-slate-500">{row.reference}</p></td><td className="p-4">{row.condition}<p className="text-xs text-slate-500">{row.received_on}</p></td><td className="p-4">{money(row.acquisition_value)}{row.status === 'RESOLD' && <p className="text-xs text-emerald-700">Resold: {money(row.resale_value)}</p>}</td></> : <><td className="max-w-72 p-4"><p className="font-semibold">{row.name}</p><p className="mt-1 break-words text-xs text-slate-500">{row.description}</p></td><td className="p-4">{row.product_count}</td><td className="p-4">{row.active_products}</td><td className="p-4">{row.stock_units}</td></>}
        <td className="p-4"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{label(row.status)}</span></td><td className="p-4"><div className="flex gap-2"><button className={button} onClick={() => { setView(row); onRecordChange?.(String(row.id)) }}>{trade ? 'View' : 'View products'}</button>{row.status !== 'RESOLD' && <button className={`${button} text-blue-600`} onClick={() => { setError(''); setEditor(row) }}>{trade ? 'Update' : 'Edit'}</button>}</div></td>
      </tr>)}</tbody></table>{!visible.length && <p className="p-8 text-center text-slate-500">No matching {trade ? 'devices' : 'categories'} yet.</p>}</div>
    </>}
    {editor && <RecordEditor key={String(editor.id || 'new')} row={editor} trade={trade} saving={saving} error={error} onSave={save} onClose={() => { setEditor(null); setError('') }} />}
    {view && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4"><div role="dialog" aria-modal="true" aria-label="Record details" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6"><div className="flex justify-between gap-4"><h3 className="text-xl font-bold">{trade ? view.device : view.name}</h3><button className={button} onClick={() => { setView(null); onRecordChange?.("") }}>Close</button></div>{trade ? <dl className="mt-5 grid gap-4 sm:grid-cols-2">{['reference','serial_number','source_reference','condition','received_on','status','acquisition_value','resale_value','sold_at','notes'].map(key => <div key={key}><dt className="text-xs capitalize text-slate-500">{label(key)}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{key.endsWith('_value') && view[key] != null ? money(view[key]) : label(view[key]) || 'Not recorded'}</dd></div>)}</dl> : <div className="mt-5 space-y-3">{products.filter(product => product.category === view.name).map(product => <div key={product.id} className="flex justify-between gap-4 rounded-xl border border-slate-200 p-3 text-sm"><div className="font-semibold">{product.name}<p className="font-normal text-slate-500">{product.status} · {money(product.price)}</p><div className="mt-3"><ProductPrices cash={product.price} prices={product.prices} /></div></div><span>{product.stock} in stock</span></div>)}{!products.some(product => product.category === view.name) && <p className="text-sm text-slate-500">No products assigned.</p>}</div>}</div></div>}
  </div>
}

function RecordEditor({ row, trade, saving, error, onSave, onClose }: { row: Row; trade: boolean; saving: boolean; error: string; onSave: (draft: Row) => Promise<void>; onClose: () => void }) {
  const [draft, setDraft] = useState(row)
  const close = () => { if (JSON.stringify(draft) === JSON.stringify(row) || window.confirm('Discard unsaved changes?')) onClose() }
  const field = (key: string, title: string, type = 'text', required = true, maxLength = 100) => <label key={key} className="text-sm font-semibold">{title}<input type={type} required={required} maxLength={maxLength} min={type === 'number' ? key === 'resale_value' ? '.01' : '0' : undefined} max={type === 'number' ? '9999999999.99' : type === 'date' ? new Date().toISOString().slice(0,10) : undefined} step={type === 'number' ? '.01' : undefined} value={draft[key] ?? ''} onChange={event => setDraft({ ...draft, [key]: event.target.value })} className={input} /></label>
  const submit = (event: FormEvent) => { event.preventDefault(); if (!saving) void onSave(draft) }
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4"><form role="dialog" aria-modal="true" aria-labelledby="record-title" onSubmit={submit} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6"><h3 id="record-title" className="text-xl font-bold">{row.id ? 'Edit' : 'Add'} {trade ? 'trade-in device' : 'category'}</h3><fieldset disabled={saving} className="mt-5 space-y-5"><div className="grid gap-4 sm:grid-cols-2">
    {trade ? <>{field('device','Device name','text',true,160)}{field('reference','Inventory reference','text',true,60)}{field('serial_number','Serial number / IMEI','text',false)}{field('source_reference','Swap / receipt reference (optional)','text',false)}{field('acquisition_value','Acquisition value (GHS)','number')}{field('received_on','Date received','date')}<label className="text-sm font-semibold">Condition<select value={String(draft.condition)} onChange={event => setDraft({ ...draft, condition: event.target.value })} className={input}>{['Like New','Excellent','Good','Fair','Needs Repair'].map(value => <option key={value}>{value}</option>)}</select></label></> : field('name','Category name')}
    <label className="text-sm font-semibold">Status<select value={String(draft.status)} onChange={event => setDraft({ ...draft, status: event.target.value })} className={input}>{(trade ? !row.id ? ['HELD_FOR_SWAP'] : row.status === 'AVAILABLE' ? statuses : ['HELD_FOR_SWAP','AVAILABLE'] : ['Active','Archived']).map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
    {trade && draft.status === 'RESOLD' && <>{field('resale_value','Resale amount (GHS)','number')}<p className="text-sm text-amber-800">Saving records the sale now and makes this device read-only. Confirm the resale amount before saving.</p></>}
    <label className="text-sm font-semibold sm:col-span-2">{trade ? 'Inspection notes' : 'Description'}<textarea rows={4} maxLength={trade ? 3000 : 1000} value={String(draft[trade ? 'notes' : 'description'] || '')} onChange={event => setDraft({ ...draft, [trade ? 'notes' : 'description']: event.target.value })} className={input} /></label>
    </div>{error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-3"><button type="button" className={button} onClick={close}>Cancel</button><button type="submit" className={`${button} bg-blue-600 text-white`}>{saving ? 'Saving...' : 'Save record'}</button></div></fieldset></form></div>
}
