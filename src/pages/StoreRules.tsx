import { useEffect, useState, type FormEvent } from 'react'

const numericFields = {
  minimumDeposit: { label: 'Minimum deposit (%)', min: 0, max: 100, step: 0.01 },
  minimumDuration: { label: 'Minimum duration (months)', min: 1, max: 120, step: 1 },
  maximumDuration: { label: 'Maximum duration (months)', min: 1, max: 120, step: 1 },
  gracePeriod: { label: 'Payment grace period (days)', min: 0, max: 365, step: 1 },
  lateFee: { label: 'Late payment charge (%)', min: 0, max: 100, step: 0.01 },
  returns: { label: 'Return window (days)', min: 0, max: 365, step: 1 },
  warranty: { label: 'Standard warranty (months)', min: 0, max: 120, step: 1 },
} as const
const toggleLabels = {
  earlySettlement: 'Allow early settlement without penalty',
  autoDebit: 'Allow customer-authorized automatic debit',
  allowReschedule: 'Allow payment rescheduling after review',
  requireGuarantors: 'Require two verified guarantors',
} as const
type NumericKey = keyof typeof numericFields
type Values = Record<NumericKey, number | string> & Record<keyof typeof toggleLabels, boolean> & {
  delivery: string; returnConditions: string; conduct: Record<string, boolean>; clauses: string[]
}
type Rules = { values: Values; version: string; revision: number; publishedAt: string | null; conductLabels: Record<string, string> }
const button = 'rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold disabled:opacity-50'
const input = 'mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm'
const card = 'rounded-2xl border border-slate-200 bg-white p-5 sm:p-6'
async function rulesRequest(data?: unknown): Promise<Rules> {
  const response = await fetch('/api/auth/store/rules', {
    method: data ? 'POST' : 'GET', credentials: 'same-origin',
    headers: data ? { 'Content-Type': 'application/json' } : {},
    body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(30000),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.rules) throw new Error(result?.error || 'Unable to load or save shop rules. Please retry.')
  return result.rules
}

export default function StoreRulesPage() {
  const [saved, setSaved] = useState<Rules | null>(null)
  const [draft, setDraft] = useState<Values | null>(null)
  const [tab, setTab] = useState('payment')
  const [preview, setPreview] = useState(false)
  const [newClause, setNewClause] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reload, setReload] = useState(0)
  const dirty = !!saved && JSON.stringify(saved.values) !== JSON.stringify(draft)
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    rulesRequest().then(result => {
      if (active) { setSaved(result); setDraft(result.values); setNewClause(''); setNotice('') }
    }).catch(error => { if (active) setError(error.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reload])
  const change = <K extends keyof Values,>(key: K, value: Values[K]) => {
    setDraft(current => current ? { ...current, [key]: value } : current); setNotice('')
  }
  const publish = async (event: FormEvent) => {
    event.preventDefault()
    if (!saved || !draft || saving) return
    setError(''); setNotice('')
    if (newClause.trim()) { setError('Add the pending clause or clear its text before publishing.'); setTab('agreement'); setPreview(false); return }
    const values = { ...draft }
    for (const key of Object.keys(numericFields) as NumericKey[]) {
      const value = Number(draft[key]); const spec = numericFields[key]
      if (String(draft[key]).trim() === '' || !Number.isFinite(value) || value < spec.min || value > spec.max || (spec.step === 1 && !Number.isInteger(value))) {
        setError(`Enter a valid ${spec.label.toLowerCase()} between ${spec.min} and ${spec.max}.`); return
      }
      values[key] = value
    }
    if (Number(values.minimumDuration) > Number(values.maximumDuration)) { setError('Maximum duration must be at least the minimum duration.'); return }
    if (!values.delivery.trim() || !values.returnConditions.trim() || !values.clauses.length || values.clauses.some(value => !value.trim())) {
      setError('Enter the delivery timeframe, return conditions, and at least one non-empty agreement clause.'); return
    }
    setSaving(true)
    try {
      const result = await rulesRequest({ version: saved.version, values })
      setSaved(result); setDraft(result.values); setNotice(`Shop rules saved as version ${result.revision}.`)
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to save shop rules.') }
    finally { setSaving(false) }
  }
  const field = (key: NumericKey) => <label key={key} className="text-sm font-semibold">{numericFields[key].label}
    <input type="number" required min={numericFields[key].min} max={numericFields[key].max} step={numericFields[key].step} value={draft?.[key] ?? ''} onChange={event => change(key, event.target.value)} className={input} />
  </label>
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-bold">Shop Rules & Payment Terms</h2><p className="mt-1 text-sm text-slate-500">Manage your shop's payment terms, return policy, and agreement clauses.</p></div>
      <button className={button} disabled={loading || saving} onClick={() => {
        if ((dirty || newClause.trim()) && !window.confirm('Discard unsaved edits and reload the saved rules?')) return
        setReload(value => value + 1)
      }}>Reload saved rules</button>
    </div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
    {loading ? <p role="status">Loading shop rules...</p> : saved && draft && <>
      <div className="grid gap-4 sm:grid-cols-3">{[
        ['Terms version', saved.revision ? `v${saved.revision}` : 'Not published'],
        ['Last published', saved.publishedAt ? new Date(saved.publishedAt).toLocaleString() : 'Not yet published'],
        ['Editor status', dirty || newClause.trim() ? 'Unsaved changes' : saved.revision ? 'Saved' : 'Suggested defaults'],
      ].map(([label, value]) => <div key={label} className={card}><p className="text-sm text-slate-500">{label}</p><p className="mt-2 font-bold">{value}</p></div>)}</div>
      <p className="text-sm text-slate-500">Saving records your shop policy. Automatic debit, agreement generation, and customer acceptance are not activated by these settings.</p>
      <form onSubmit={publish} noValidate><fieldset disabled={saving} className="space-y-6">
        <div className="flex flex-wrap justify-between gap-3"><div className="flex flex-wrap gap-2">{[['payment', 'Payment Terms'], ['shop', 'Shop Rules'], ['agreement', 'Agreement Clauses']].map(([id, label]) => <button type="button" key={id} aria-pressed={!preview && tab === id} className={`${button} ${!preview && tab === id ? 'bg-slate-950 text-white' : 'bg-white'}`} onClick={() => { setTab(id); setPreview(false) }}>{label}</button>)}</div>
          <div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={() => setPreview(value => !value)}>{preview ? 'Back to editing' : 'Preview Customer Version'}</button><button type="submit" disabled={!dirty && saved.revision > 0} className={`${button} bg-blue-600 text-white`}>{saving ? 'Saving...' : 'Save & Publish'}</button></div>
        </div>
        {preview ? <article className={`${card} space-y-6`}>
          <div><h3 className="text-xl font-bold">Shop terms preview</h3><p className="mt-1 text-sm text-slate-500">Preview of the current editor contents{dirty || !saved.revision ? ' — not yet published' : ''}.</p></div>
          <section><h4 className="font-bold">Payment terms and shop policy</h4><dl className="mt-3 grid gap-3 sm:grid-cols-2">{(Object.keys(numericFields) as NumericKey[]).map(key => <div key={key}><dt className="text-sm text-slate-500">{numericFields[key].label}</dt><dd>{draft[key]}</dd></div>)}<div><dt className="text-sm text-slate-500">Delivery timeframe</dt><dd>{draft.delivery}</dd></div></dl></section>
          <ul className="list-disc space-y-2 pl-5 text-sm">{(Object.keys(toggleLabels) as (keyof typeof toggleLabels)[]).map(key => <li key={key}>{toggleLabels[key]}: {draft[key] ? 'Yes' : 'No'}</li>)}</ul>
          <section><h4 className="font-bold">Return conditions</h4><p className="mt-2 whitespace-pre-wrap break-words text-sm">{draft.returnConditions}</p></section>
          <section><h4 className="font-bold">Customer conduct and fulfillment</h4><ul className="mt-2 list-disc space-y-2 pl-5 text-sm">{Object.entries(saved.conductLabels).filter(([key]) => draft.conduct[key]).map(([key, label]) => <li key={key}>{label}</li>)}</ul></section>
          <section><h4 className="font-bold">Agreement clauses</h4><ol className="mt-2 list-decimal space-y-3 pl-5 text-sm">{draft.clauses.map((clause, index) => <li key={index} className="whitespace-pre-wrap break-words">{clause}</li>)}</ol></section>
        </article> : tab === 'payment' ? <div className="grid gap-6 xl:grid-cols-2">
          <section className={card}><h3 className="text-lg font-bold">Hire-purchase payment terms</h3><div className="mt-5 grid gap-4 sm:grid-cols-2">{(['minimumDeposit', 'minimumDuration', 'maximumDuration', 'gracePeriod', 'lateFee'] as NumericKey[]).map(field)}<label className="text-sm font-semibold">Delivery timeframe<input value={draft.delivery} maxLength={300} onChange={event => change('delivery', event.target.value)} className={input} /></label></div></section>
          <section className={`${card} space-y-4`}><h3 className="text-lg font-bold">Payment rules</h3>{(Object.keys(toggleLabels) as (keyof typeof toggleLabels)[]).map(key => <label key={key} className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm"><input type="checkbox" checked={draft[key]} onChange={event => change(key, event.target.checked)} className="mt-1 accent-blue-600" />{toggleLabels[key]}</label>)}</section>
        </div> : tab === 'shop' ? <div className="grid gap-6 xl:grid-cols-2">
          <section className={card}><h3 className="text-lg font-bold">Returns and warranty</h3><div className="mt-5 grid gap-4 sm:grid-cols-2">{field('returns')}{field('warranty')}</div><label className="mt-5 block text-sm font-semibold">Return conditions<textarea rows={5} maxLength={3000} value={draft.returnConditions} onChange={event => change('returnConditions', event.target.value)} className={input} /></label></section>
          <section className={`${card} space-y-4`}><h3 className="text-lg font-bold">Customer conduct and fulfillment</h3>{Object.entries(saved.conductLabels).map(([key, label]) => <label key={key} className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm"><input type="checkbox" checked={draft.conduct[key]} onChange={event => change('conduct', { ...draft.conduct, [key]: event.target.checked })} className="mt-1 accent-blue-600" />{label}</label>)}</section>
        </div> : <section className={`${card} space-y-4`}>
          <h3 className="text-lg font-bold">Agreement clauses ({draft.clauses.length}/30)</h3>
          {draft.clauses.map((clause, index) => <div key={index} className="flex items-start gap-3"><label className="min-w-0 flex-1 text-sm font-semibold">Clause {index + 1}<textarea rows={3} maxLength={1000} value={clause} onChange={event => change('clauses', draft.clauses.map((value, i) => i === index ? event.target.value : value))} className={input} /></label><button type="button" aria-label={`Remove clause ${index + 1}`} className={`${button} mt-7 text-red-600`} onClick={() => change('clauses', draft.clauses.filter((_, i) => i !== index))}>Remove</button></div>)}
          <div className="flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 text-sm font-semibold">New clause<textarea rows={2} maxLength={1000} value={newClause} onChange={event => setNewClause(event.target.value)} className={input} /></label><button type="button" disabled={!newClause.trim() || draft.clauses.length >= 30} className={button} onClick={() => { change('clauses', [...draft.clauses, newClause.trim()]); setNewClause('') }}>Add Clause</button></div>
        </section>}
        <div className="flex justify-end"><button type="button" disabled={!dirty && !newClause.trim()} className={button} onClick={() => {
          if (!window.confirm('Discard your unsaved changes?')) return
          setDraft(saved.values); setNewClause(''); setError(''); setNotice('')
        }}>Discard changes</button></div>
      </fieldset></form>
    </>}
  </div>
}
