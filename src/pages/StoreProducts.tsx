import ProductCategoryPicker from "../components/ProductCategoryPicker"
import ProductPrices from "../components/ProductPrices"
import { useEffect, useRef, useState, type FormEvent } from 'react'
import uploadImage, { type UploadedImage, type UploadProgress } from '../lib/imageUploader'

type Product = {
  id?: string; revision?: number; name: string; sku: string; category: string; description: string
  condition: string; price: string | number; stock: string | number; status: string; images: UploadedImage[]
  prices?: { hire_purchase?: string | number; layaway?: string | number; swap?: string | number }
  payment_options: { payNow: boolean; hirePurchase: boolean; layaway: boolean }
  swap: { enabled: boolean; categories?: string; minimumCondition?: string; validityDays?: string | number; instructions?: string }
  layaway: { depositType?: string; deposit?: string | number; duration?: string | number; minimumInstallment?: string | number; gracePeriod?: string | number; maxMissed?: string | number; agentCollection?: boolean; reservationRules?: string; cancellationPolicy?: string; refundPolicy?: string; frequencies?: string[] }
}
type Catalogue = { products: Product[]; total: number; page: number; pageSize: number; stats: { total: number; active: number; lowStock: number; outOfStock: number } }
const blank: Product = { name: '', sku: '', category: '', description: '', condition: 'New', price: '', prices: {}, stock: '0', status: 'Draft', images: [], payment_options: { payNow: true, hirePurchase: false, layaway: false }, swap: { enabled: false }, layaway: {} }
const swapDefaults = { categories: '', minimumCondition: 'Fair', validityDays: 7, instructions: '' }
const layawayDefaults = { depositType: 'Percentage', deposit: 20, duration: 12, minimumInstallment: 50, gracePeriod: 3, maxMissed: 3, agentCollection: false, reservationRules: '', cancellationPolicy: '', refundPolicy: '', frequencies: ['Weekly', 'Monthly'] }
const button = 'rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold disabled:opacity-50'
const input = 'mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm disabled:bg-slate-50'
const paymentLabels = { payNow: 'Pay Now', hirePurchase: 'Hire Purchase', layaway: 'Layaway' }
const money = (value: string | number) => new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(Number(value))
const stockLabel = (p: Product) => p.status !== 'Active' ? p.status : Number(p.stock) === 0 ? 'Out of Stock' : Number(p.stock) <= 5 ? 'Low Stock' : 'Active'
async function api(path: string, data?: unknown) {
  const response = await fetch(`/api/auth/store/products${path}`, { method: data ? 'POST' : 'GET', credentials: 'same-origin', headers: data ? { 'Content-Type': 'application/json' } : {}, body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(30000) })
  const result = await response.json().catch(() => null)
  if (!response.ok || !result) throw new Error(result?.error || 'Unable to load or save products. Refresh before retrying.')
  return result
}

export default function StoreProductsPage({ initialRecord = "", initialQuery = "", onRecordChange }: { initialRecord?: string; initialQuery?: string; onRecordChange?: (record: string) => void }) {
  const [data, setData] = useState<Catalogue | null>(null)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [reload, setReload] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editor, setEditor] = useState<{ product: Product; readOnly: boolean } | null>(null)
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    api(`?${new URLSearchParams({ page: String(page), search: query, status })}`).then(result => { if (active) setData(result) })
      .catch(error => { if (active) { setError(error.message); setData(null) } }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page, query, status, reload])
  useEffect(() => { setSearch(initialQuery.slice(0,100)); setQuery(initialQuery.slice(0,100)); setPage(1) }, [initialQuery])
  useEffect(() => {
    let active = true
    if (!initialRecord) { setEditor(null); return }
    api(`?${new URLSearchParams({ record: initialRecord })}`).then(result => { if (active) setEditor({ product: result.product, readOnly: true }) }).catch(error => { if (active) setError(error.message) })
    return () => { active = false }
  }, [initialRecord])
  return <div className="space-y-6">
    <div className="flex flex-wrap justify-between gap-4"><div><h2 className="text-2xl font-bold">Products</h2><p className="mt-1 text-sm text-slate-500">Manage your store catalogue, images, pricing, and inventory.</p></div><div className="flex gap-2"><button className={button} disabled={loading} onClick={() => setReload(value => value + 1)}>Refresh</button><button disabled={!data || loading} className={`${button} bg-blue-600 text-white`} onClick={() => setEditor({ product: structuredClone(blank), readOnly: false })}>Add Product</button></div></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
    {data && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[['Total products', data.stats.total], ['Active listings', data.stats.active], ['Low stock (1–5)', data.stats.lowStock], ['Out of stock', data.stats.outOfStock]].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>)}</div>}
    <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); setQuery(search.trim()); setPage(1) }}><label className="min-w-48 flex-1 text-sm font-semibold">Search<input value={search} maxLength={100} onChange={event => setSearch(event.target.value)} placeholder="Product name, SKU, or category" className={input} /></label><button className={button}>Search</button><label className="text-sm font-semibold">Status<select value={status} onChange={event => { setStatus(event.target.value); setPage(1) }} className={input}><option value="">All statuses</option>{['Active', 'Draft', 'Archived', 'Low Stock', 'Out of Stock'].map(value => <option key={value}>{value}</option>)}</select></label></form>
    {loading ? <p role="status">Loading products...</p> : data && <>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{['Product', 'Category / Condition', 'Payment options', 'Product prices', 'Stock / Status', 'Actions'].map(label => <th key={label} className="p-4">{label}</th>)}</tr></thead><tbody>{data.products.map(product => <tr key={product.id} className="border-t border-slate-100">
        <td className="p-4"><div className="flex items-center gap-3"><img src={product.images[0]?.url} alt={product.name} className="h-16 w-20 rounded-xl border border-slate-200 object-cover" /><div className="max-w-64 break-words"><p className="font-semibold">{product.name}</p><p className="mt-1 text-xs text-slate-500">{product.sku} · {product.images.length} images</p>{product.swap.enabled && <p className="text-xs text-emerald-700">Swap available</p>}</div></div></td>
        <td className="p-4">{product.category}<p className="text-xs text-slate-500">{product.condition}</p></td><td className="p-4">{(Object.keys(paymentLabels) as (keyof typeof paymentLabels)[]).filter(key => product.payment_options[key]).map(key => paymentLabels[key]).join(', ')}</td><td className="min-w-64 p-4"><ProductPrices cash={product.price} prices={product.prices} /></td><td className="p-4">{product.stock}<p className="text-xs text-slate-500">{stockLabel(product)}</p></td><td className="p-4"><div className="flex gap-2"><button className={button} onClick={() => { setEditor({ product, readOnly: true }); onRecordChange?.(product.id || "") }}>View</button><button className={`${button} text-blue-600`} onClick={() => setEditor({ product, readOnly: false })}>Edit</button></div></td>
      </tr>)}</tbody></table>{!data.products.length && <p className="p-8 text-center text-slate-500">{data.stats.total ? 'No products match these filters.' : 'No products yet. Add your first product to start your catalogue.'}</p>}</div>
      <div className="flex items-center justify-between gap-4 text-sm"><span>{data.total} matching products · Page {page} of {Math.max(1, Math.ceil(data.total / data.pageSize))}</span><div className="flex gap-2"><button className={button} disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button><button className={button} disabled={page * data.pageSize >= data.total} onClick={() => setPage(value => value + 1)}>Next</button></div></div>
    </>}
    {editor && <ProductEditor product={editor.product} readOnly={editor.readOnly} onClose={() => { setEditor(null); onRecordChange?.("") }} onSaved={() => { setNotice(editor.product.id ? 'Product updated.' : 'Product added.'); setEditor(null); onRecordChange?.(""); setPage(1); setReload(value => value + 1) }} />}
  </div>
}

function ProductEditor({ product, readOnly, onClose, onSaved }: { product: Product; readOnly: boolean; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState<Product>(() => ({ ...structuredClone(product), prices: { hire_purchase: product.id ? product.price : '', layaway: product.id ? product.price : '', swap: product.id ? product.price : '', ...product.prices }, swap: { ...swapDefaults, ...product.swap }, layaway: { ...layawayDefaults, ...product.layaway } }))
  const initial = useRef(JSON.stringify(draft))
  const fileInput = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState('')
  const [progress, setProgress] = useState<UploadProgress>({ percent: 0, phase: 'uploading' })
  const [error, setError] = useState('')
  const [categorySaving, setCategorySaving] = useState(false)
  const busy = saving || !!uploading || categorySaving
  const close = () => {
    if (busy) return
    if (!readOnly && JSON.stringify(draft) !== initial.current && !window.confirm('Discard unsaved product changes?')) return
    onClose()
  }
  const change = <K extends keyof Product,>(key: K, value: Product[K]) => setDraft(current => ({ ...current, [key]: value }))
  const upload = async (files: File[]) => {
    if (!files.length || busy) return
    if (files.length + draft.images.length > 5) { setError('Choose no more than five images in total.'); return }
    setError('')
    try {
      for (let index = 0; index < files.length; index++) {
        setUploading(`${index + 1}/${files.length}: ${files[index].name}`)
        setProgress({ percent: 0, phase: 'uploading' })
        const image = await uploadImage(files[index], setProgress, 'products')
        setDraft(current => ({ ...current, images: [...current.images, image] }))
      }
    } catch (error) { setError(error instanceof Error ? error.message : 'Upload failed. Retry the image that failed.') }
    finally { setUploading('') }
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (readOnly || busy) return
    setError('')
    if (!draft.images.length) { setError('Upload at least one product image.'); return }
    if (!Object.values(draft.payment_options).some(Boolean)) { setError('Select at least one payment option.'); return }
    setSaving(true)
    try { await api('', draft); onSaved() }
    catch (error) { setError(error instanceof Error ? error.message : 'Unable to save product.') }
    finally { setSaving(false) }
  }
  const layawayField = (key: keyof Product['layaway'], label: string, type = 'text', min?: number, max?: number, step = 1) => <label key={key} className="text-sm font-semibold">{label}<input required type={type} min={min} max={max} step={step} maxLength={1000} value={String(draft.layaway[key] ?? '')} onChange={event => change('layaway', { ...draft.layaway, [key]: event.target.value })} className={input} /></label>
  const optionPrice = (key: 'hire_purchase' | 'layaway' | 'swap', label: string) => <label className="block text-sm font-semibold">{label} price (GHS)<input required type="number" min=".01" max="9999999999.99" step=".01" value={draft.prices?.[key] ?? ''} onChange={event => change('prices', { ...draft.prices, [key]: event.target.value })} className={input} /></label>
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4"><div role="dialog" aria-modal="true" aria-labelledby="product-title" className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
    <div className="flex items-start justify-between gap-4"><div><h3 id="product-title" className="text-xl font-bold">{readOnly ? draft.name : draft.id ? 'Edit product' : 'Add product'}</h3><p className="mt-1 text-sm text-slate-500">Product details, images and purchase options.</p></div><button disabled={busy} className={button} onClick={close}>Close</button></div>
    <form onSubmit={submit} className="mt-6 space-y-6">
      <fieldset disabled={busy || readOnly} className="space-y-6">
        <section><h4 className="font-bold">Product images ({draft.images.length}/5)</h4><p className="mt-1 text-xs text-slate-500">First image is the cover. JPEG, PNG, GIF or WebP, up to 5 MB each.</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">{draft.images.map((image, index) => <div key={image.id} className="space-y-2"><img src={image.url} alt={`${draft.name || 'Product'} image ${index + 1}`} className="aspect-square w-full rounded-xl border border-slate-200 object-cover" /><p className="text-xs font-semibold">{index === 0 ? 'Cover image' : `Image ${index + 1}`}</p>{!readOnly && <div className="flex flex-wrap gap-1">{index > 0 && <button type="button" className="rounded-lg border border-slate-200 p-2 text-xs" onClick={() => change('images', [image, ...draft.images.filter((_, i) => i !== index)])}>Make cover</button>}<button type="button" className="rounded-lg border border-red-200 p-2 text-xs text-red-600" onClick={() => change('images', draft.images.filter((_, i) => i !== index))}>Remove</button></div>}</div>)}</div>
          {!readOnly && <><input ref={fileInput} type="file" multiple accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={event => { const files = Array.from(event.target.files || []); event.target.value = ''; void upload(files) }} /><button type="button" disabled={draft.images.length >= 5} className={`${button} mt-4 border-2 border-blue-300 text-blue-700`} onClick={() => fileInput.current?.click()}>Upload product images</button></>}
        </section>
        <div className="grid gap-4 sm:grid-cols-2">{([
          ['name', 'Product name', 'text', 160], ['sku', 'SKU', 'text', 60], ['stock', 'Stock quantity', 'number', 10],
        ] as const).map(([key, label, type, maxLength]) => <label key={key} className="text-sm font-semibold">{label}<input required type={type} maxLength={maxLength} min={0} max={key === 'stock' ? 1000000 : undefined} step="1" value={draft[key]} onChange={event => change(key, event.target.value)} className={input} /></label>)}
          <ProductCategoryPicker value={draft.category} onChange={value => change("category", value)} readOnly={readOnly} onBusyChange={setCategorySaving} />
          <label className="text-sm font-semibold">Condition<select value={draft.condition} onChange={event => change('condition', event.target.value)} className={input}><option>New</option><option>Used</option></select></label>
          <label className="text-sm font-semibold">Listing status<select value={draft.status} onChange={event => change('status', event.target.value)} className={input}><option>Draft</option><option>Active</option><option>Archived</option></select></label>
          <label className="text-sm font-semibold sm:col-span-2">Description<textarea rows={4} maxLength={3000} value={draft.description} onChange={event => change('description', event.target.value)} className={input} /></label>
        </div>
        <section className="space-y-4 rounded-2xl border border-slate-200 p-5"><h4 className="font-bold">Product prices</h4><p className="text-sm text-slate-500">Enter all four prices. Customers receive the price for their selected purchase option.</p><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">Cash price (GHS)<input required type="number" min=".01" max="9999999999.99" step=".01" value={draft.price} onChange={event => change('price', event.target.value)} className={input} /></label>{optionPrice('hire_purchase', 'Hire purchase')}{optionPrice('layaway', 'Layaway')}{optionPrice('swap', 'Swap')}</div></section>
        <section className="space-y-4 rounded-2xl border border-slate-200 p-5"><h4 className="font-bold">Payment options</h4><div className="flex flex-wrap gap-5">{(Object.keys(paymentLabels) as (keyof typeof paymentLabels)[]).map(key => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.payment_options[key]} onChange={event => change('payment_options', { ...draft.payment_options, [key]: event.target.checked })} />{paymentLabels[key]}</label>)}</div>
          {draft.payment_options.layaway && <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Deposit type<select value={draft.layaway.depositType} onChange={event => change('layaway', { ...draft.layaway, depositType: event.target.value })} className={input}><option>Percentage</option><option>Fixed amount</option></select></label>
            {layawayField('deposit', draft.layaway.depositType === 'Percentage' ? 'Deposit (%)' : 'Deposit (GHS)', 'number', draft.layaway.depositType === 'Percentage' ? 10 : .01, draft.layaway.depositType === 'Percentage' ? 80 : Number(draft.prices?.layaway), .01)}
            {layawayField('duration', 'Duration (months)', 'number', 1, 24)}{layawayField('minimumInstallment', 'Minimum installment (GHS)', 'number', .01, Number(draft.prices?.layaway), .01)}{layawayField('gracePeriod', 'Grace period (days)', 'number', 0, 365)}{layawayField('maxMissed', 'Maximum missed payments', 'number', 0, 100)}
            <div className="space-y-2 text-sm"><p className="font-semibold">Payment frequencies</p>{['Daily', 'Weekly', 'Monthly'].map(value => <label key={value} className="mr-3 inline-flex items-center gap-2"><input type="checkbox" checked={draft.layaway.frequencies?.includes(value) || false} onChange={event => change('layaway', { ...draft.layaway, frequencies: event.target.checked ? [...(draft.layaway.frequencies || []), value] : draft.layaway.frequencies?.filter(item => item !== value) })} />{value}</label>)}</div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.layaway.agentCollection || false} onChange={event => change('layaway', { ...draft.layaway, agentCollection: event.target.checked })} />Allow agent collection</label>
            {layawayField('reservationRules', 'Reservation rules')}{layawayField('cancellationPolicy', 'Cancellation policy')}{layawayField('refundPolicy', 'Refund policy')}
          </div>}
        </section>
        <section className="space-y-4 rounded-2xl border border-slate-200 p-5"><label className="flex items-center gap-3 font-bold"><input type="checkbox" checked={draft.swap.enabled} onChange={event => change('swap', { ...draft.swap, enabled: event.target.checked })} />Allow swap for this product</label>{draft.swap.enabled && <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Accepted categories<input required maxLength={300} value={draft.swap.categories} onChange={event => change('swap', { ...draft.swap, categories: event.target.value })} className={input} /></label><label className="text-sm font-semibold">Minimum condition<select value={draft.swap.minimumCondition} onChange={event => change('swap', { ...draft.swap, minimumCondition: event.target.value })} className={input}>{['Like New', 'Excellent', 'Good', 'Fair'].map(value => <option key={value}>{value}</option>)}</select></label><label className="text-sm font-semibold">Offer validity (days)<input required type="number" min={1} max={365} value={draft.swap.validityDays} onChange={event => change('swap', { ...draft.swap, validityDays: event.target.value })} className={input} /></label><label className="text-sm font-semibold">Swap instructions<textarea maxLength={1000} value={draft.swap.instructions} onChange={event => change('swap', { ...draft.swap, instructions: event.target.value })} className={input} /></label></div>}</section>
      </fieldset>
      {uploading && <div role="status" className="rounded-xl bg-blue-50 p-4 text-sm"><p>{uploading}</p><p className="mt-1">{progress.phase === 'processing' ? 'Processing image...' : `Uploading${progress.percent !== null ? ` ${progress.percent}%` : '...'}`}</p><progress aria-label="Image upload progress" max={100} value={progress.phase === 'uploading' ? progress.percent ?? undefined : undefined} className="mt-2 w-full" /></div>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {!readOnly && <div className="flex justify-end gap-3"><button type="button" disabled={busy} className={button} onClick={close}>Cancel</button><button type="submit" disabled={busy} className={`${button} bg-blue-600 text-white`}>{saving ? 'Saving...' : draft.id ? 'Save changes' : 'Add product'}</button></div>}
    </form>
  </div></div>
}
