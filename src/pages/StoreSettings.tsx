import { useEffect, useState } from 'react'

type Value = string | number | boolean
type Field = { key: string; label: string; type: string; options?: string[]; min?: number; max?: number; maxLength?: number }
type Settings = { sections: Record<string, Record<string, Value>>; schema: Record<string, Field[]>; versions: Record<string, string>; account: { email: string; role: string; storeId: string; status: string; lastSignIn: string } }
const tabs = ['General', 'Operations', 'Applications', 'Inventory', 'Payments', 'Notifications', 'Security', 'Store Management']
const description: Record<string, string> = {
  General: 'Language, time zone and receipt preferences.', Operations: 'Set your preferred fulfilment method and preparation times.',
  Applications: 'Set preferences for reviewing customer applications.', Inventory: 'Choose stock and product defaults.',
  Payments: 'Record payment preferences. Saving these does not enable payment collection or change bank details.',
  Notifications: 'Choose which application, payment and stock alerts appear in your notification inbox.',
  Security: 'Review your authenticated account and sign out securely.', 'Store Management': 'View your approved store account and manage its profile.',
}
const button = 'rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold disabled:opacity-50'
async function settingsRequest(body?: unknown): Promise<Settings> {
  const response = await fetch('/api/auth/store/settings', { method: body ? 'POST' : 'GET', credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) })
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.settings) throw new Error(result?.error || 'Unable to load or save settings. Please retry.')
  return result.settings
}
export default function StoreSettingsPage({ onProfile, onLogout }: { onProfile: () => void; onLogout: () => void }) {
  const [active, setActive] = useState('General')
  const [data, setData] = useState<Settings | null>(null)
  const [draft, setDraft] = useState<Settings['sections']>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    settingsRequest().then(result => { if (active) { setData(result); setDraft(result.sections) } })
      .catch(error => { if (active) setError(error.message || 'Unable to load settings.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reload])
  const dirty = (section: string) => JSON.stringify(draft[section]) !== JSON.stringify(data?.sections[section])
  const changeTab = (tab: string) => { setActive(tab); setError(''); setNotice('') }
  const save = async () => {
    if (!data || saving) return
    const section = active
    setSaving(true); setError(''); setNotice('')
    try {
      const result = await settingsRequest({ section, values: draft[section], version: data.versions[section] })
      setData(current => current ? { ...current, sections: { ...current.sections, [section]: result.sections[section] }, versions: { ...current.versions, [section]: result.versions[section] } } : result)
      setDraft(current => ({ ...current, [section]: result.sections[section] }))
      setNotice(`${section} preferences saved.`); window.dispatchEvent(new Event("store-notifications-changed"))
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to save settings.') }
    finally { setSaving(false) }
  }
  if (loading) return <p role="status" className="p-8">Loading store settings...</p>
  if (!data) return <div role="alert" className="rounded-xl bg-red-50 p-6"><p>{error}</p><button className={`${button} mt-4`} onClick={() => setReload(value => value + 1)}>Retry</button></div>
  return <div className="space-y-6"><div><h2 className="text-2xl font-bold">Store Settings</h2><p className="mt-1 text-sm text-slate-500">Manage your store's saved preferences and account information.</p></div>
    <div role="tablist" aria-label="Store settings sections" className="flex gap-2 overflow-x-auto pb-2">{tabs.map((tab, index) => <button key={tab} id={`settings-tab-${index}`} role="tab" aria-selected={active === tab} aria-controls={`settings-panel-${index}`} tabIndex={active === tab ? 0 : -1} disabled={saving} onClick={() => changeTab(tab)} onKeyDown={event => { const target = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1; if (target >= 0) { event.preventDefault(); changeTab(tabs[target]); document.getElementById(`settings-tab-${target}`)?.focus() } }} className={`${button} shrink-0 ${active === tab ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`}>{tab}{data.sections[tab] && dirty(tab) ? ' *' : ''}</button>)}</div>
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <section key={active} role="tabpanel" id={`settings-panel-${tabs.indexOf(active)}`} aria-labelledby={`settings-tab-${tabs.indexOf(active)}`} className="rounded-2xl border border-slate-200 bg-white p-6">
      <h3 className="text-xl font-bold">{active} Settings</h3><p className="mt-2 text-sm text-slate-500">{description[active]}</p>
      {data.schema[active] ? <form onSubmit={event => { event.preventDefault(); void save() }}>
        <fieldset disabled={saving} className="mt-6 grid gap-5 sm:grid-cols-2">{data.schema[active].map(field => <label key={`${active}-${field.key}`} className="block rounded-xl border border-slate-200 p-4"><span className="text-sm font-semibold">{field.label}</span>{field.type === 'boolean' ? <input type="checkbox" checked={Boolean(draft[active][field.key])} onChange={event => setDraft({ ...draft, [active]: { ...draft[active], [field.key]: event.target.checked } })} className="float-right h-5 w-5 accent-blue-600" /> : field.type === 'select' ? <select value={String(draft[active][field.key])} onChange={event => setDraft({ ...draft, [active]: { ...draft[active], [field.key]: event.target.value } })} className="mt-3 w-full rounded-lg border border-slate-200 p-2 text-sm">{field.options?.map(option => <option key={option}>{option}</option>)}</select> : <input type={field.type === 'number' ? 'number' : 'text'} value={String(draft[active][field.key])} min={field.min} max={field.max} step={field.type === 'number' ? 1 : undefined} required={field.type === 'number'} maxLength={field.maxLength} onChange={event => setDraft({ ...draft, [active]: { ...draft[active], [field.key]: field.type === 'number' && event.target.value !== '' ? Number(event.target.value) : event.target.value } })} className="mt-3 w-full rounded-lg border border-slate-200 p-2 text-sm" />}</label>)}</fieldset>
        <p className="mt-5 text-xs text-slate-500">These preferences are saved for your store. Automatic processing uses them only when the related service is enabled.</p><div className="mt-6 flex flex-wrap items-center gap-3"><button type="submit" disabled={saving || !dirty(active)} className={`${button} bg-blue-600 text-white`}>{saving ? 'Saving...' : `Save ${active}`}</button><button type="button" disabled={saving || !dirty(active)} className={button} onClick={() => { setDraft({ ...draft, [active]: data.sections[active] }); setError(''); setNotice('') }}>Discard changes</button>{dirty(active) && <span className="text-xs text-amber-700">Unsaved changes are kept when switching tabs.</span>}</div>
      </form> : active === 'Security' ? <div className="mt-6 space-y-4"><dl className="grid gap-4 sm:grid-cols-2">{[['Sign-in email', data.account.email], ['Account role', data.account.role], ['Last sign-in', data.account.lastSignIn ? new Date(data.account.lastSignIn).toLocaleString() : 'Not available']].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold">{value}</dd></div>)}</dl><p className="text-sm text-slate-500">Password changes and two-factor authentication are not available on this page yet.</p><button className={button} onClick={onLogout}>Sign out of this session</button></div> : <div className="mt-6 space-y-4"><dl className="grid gap-4 sm:grid-cols-2"><div><dt className="text-xs text-slate-500">Store ID</dt><dd className="mt-1 break-all text-sm font-semibold">{data.account.storeId}</dd></div><div><dt className="text-xs text-slate-500">Approval status</dt><dd className="mt-1 text-sm font-semibold text-emerald-700">{data.account.status}</dd></div></dl><button className={`${button} bg-blue-600 text-white`} onClick={onProfile}>Edit store profile</button><p className="text-sm text-slate-500">Contact the administrator for ownership or approval changes.</p></div>}
    </section>
  </div>
}
