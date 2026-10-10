import { useEffect, useState, type FormEvent } from 'react'
import uploadImage, { type UploadedImage, type UploadProgress } from '../lib/imageUploader'
import { GHANA_REGIONS } from '../lib/localization'

type Profile = Record<string, string | UploadedImage | null>
type Agent = { id?: string; revision?: number; email: string; status: string; profile: Profile }
const groups = [
  ['Personal details', [['fullName','Full name'],['phone','Phone'],['area','Assigned area'],['address','Residential address'],['digitalAddress','GhanaPost GPS'],['ghanaCard','Ghana Card number']]],
  ['Next of kin', [['nextOfKinName','Name'],['nextOfKinRelationship','Relationship'],['nextOfKinPhone','Phone'],['nextOfKinAddress','Address']]],
  ['Parents (optional)', [['fatherName',"Father's name"],['fatherPhone',"Father's phone"],['motherName',"Mother's name"],['motherPhone',"Mother's phone"]]],
  ['Guarantor', [['guarantorName','Name'],['guarantorRelationship','Relationship'],['guarantorPhone','Phone'],['guarantorGhanaCard','Ghana Card number'],['guarantorAddress','Address'],['guarantorDigitalAddress','GhanaPost GPS']]],
] as const
const slots = { profilePhoto: 'Profile photo', ghanaCardFront: 'Ghana Card front', ghanaCardBack: 'Ghana Card back' }
const button = 'rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold disabled:opacity-50'
const input = 'mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm disabled:bg-slate-50'
async function api(data?: unknown) {
  const response = await fetch('/api/auth/store/agents', { method: data ? 'POST' : 'GET', credentials: 'same-origin', headers: data ? { 'Content-Type': 'application/json' } : {}, body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(45000) })
  const result = await response.json().catch(() => null)
  if (!response.ok || !result) throw new Error(result?.error || 'Unable to load or save agents. Refresh before retrying.')
  return result
}

export default function StoreAgentsPage({ storeId, initialRecord = "", initialQuery = "", onRecordChange }: { storeId: string; initialRecord?: string; initialQuery?: string; onRecordChange?: (record: string) => void }) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [reload, setReload] = useState(0)
  const [editor, setEditor] = useState<{ agent: Agent; mode: 'edit' | 'view' | 'password' } | null>(null)
  useEffect(() => {
    let active = true
    setLoading(true); setLoaded(false); setError('')
    api().then(result => { if (active) { setAgents(result.agents); setLoaded(true) } }).catch(error => { if (active) setError(error.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reload, storeId])
  useEffect(() => { setSearch(initialQuery); setStatus("") }, [initialQuery])
  useEffect(() => { const agent = agents.find(agent => agent.id === initialRecord); setEditor(agent ? { agent, mode: "view" } : null) }, [agents, initialRecord])
  const visible = agents.filter(agent => (!status || agent.status === status) && `${agent.profile.fullName} ${agent.email} ${agent.profile.phone} ${agent.profile.area}`.toLowerCase().includes(search.toLowerCase()))
  return <div className="space-y-6"><div className="flex flex-wrap justify-between gap-4"><div><h2 className="text-2xl font-bold">Field Agents</h2><p className="mt-1 text-sm text-slate-500">Register agents, manage profiles, and control login access.</p></div><div className="flex gap-2"><button className={button} disabled={loading} onClick={() => setReload(value => value + 1)}>Refresh</button><button className={`${button} bg-blue-600 text-white`} disabled={!loaded || loading} onClick={() => setEditor({ agent: { email: '', status: 'Active', profile: {} }, mode: 'edit' })}>Register Field Agent</button></div></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}{notice && <p role="status" className="rounded-xl bg-green-50 p-4 text-sm text-green-800">{notice}</p>}
    {loading ? <p role="status">Loading agents...</p> : loaded && <>
      <div className="grid gap-4 sm:grid-cols-3">{[['Registered agents', agents.length],['Active agents', agents.filter(agent => agent.status === 'Active').length],['Suspended agents', agents.filter(agent => agent.status === 'Suspended').length]].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>)}</div>
      <p className="text-sm text-slate-500">Agents sign in using their registered email and password. Recorded collections and confirmed settlements appear in Agent Accounts.</p>
      <div className="flex gap-3"><input aria-label="Search agents" placeholder="Search name, email, phone or area" value={search} onChange={event => setSearch(event.target.value)} className={input} /><select aria-label="Filter status" value={status} onChange={event => setStatus(event.target.value)} className={input}><option value="">All statuses</option><option>Active</option><option>Suspended</option></select></div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{['Agent','Contact','Region / Area','Status','Actions'].map(label => <th key={label} className="p-4">{label}</th>)}</tr></thead><tbody>{visible.map(agent => { const photo = agent.profile.profilePhoto as UploadedImage | null; return <tr key={agent.id} className="border-t border-slate-100"><td className="p-4"><div className="flex items-center gap-3">{photo && <img src={photo.url} alt="Agent profile" className="h-12 w-12 rounded-full object-cover" />}<span className="font-semibold">{String(agent.profile.fullName)}</span></div></td><td className="p-4">{agent.email}<p className="text-xs text-slate-500">{String(agent.profile.phone)}</p></td><td className="p-4">{String(agent.profile.region)}<p className="text-xs text-slate-500">{String(agent.profile.area)}</p></td><td className="p-4">{agent.status}</td><td className="p-4"><div className="flex flex-wrap gap-2"><button className={button} onClick={() => { setEditor({ agent, mode: 'view' }); onRecordChange?.(agent.id || "") }}>View</button><button className={button} onClick={() => setEditor({ agent, mode: 'edit' })}>Edit / status</button><button className={button} onClick={() => setEditor({ agent, mode: 'password' })}>Reset password</button></div></td></tr>})}</tbody></table>{!visible.length && <p className="p-8 text-center text-slate-500">No agents found.</p>}</div>
    </>}
    {editor && <AgentEditor agent={editor.agent} mode={editor.mode} onClose={() => { setEditor(null); onRecordChange?.("") }} onSaved={message => { setEditor(null); onRecordChange?.(""); setNotice(message); setReload(value => value + 1) }} />}
  </div>
}

function AgentEditor({ agent, mode, onClose, onSaved }: { agent: Agent; mode: 'edit' | 'view' | 'password'; onClose: () => void; onSaved: (message: string) => void }) {
  const [draft, setDraft] = useState<Agent>(() => structuredClone(agent))
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState('')
  const [progress, setProgress] = useState<UploadProgress>({ percent: 0, phase: 'uploading' })
  const [error, setError] = useState('')
  const readOnly = mode === 'view'
  const busy = saving || !!uploading
  const needsPassword = !agent.id || mode === 'password'
  const change = (key: string, value: string | UploadedImage | null) => setDraft(current => ({ ...current, profile: { ...current.profile, [key]: value } }))
  const close = () => {
    if (busy) return
    if (!readOnly && (password || JSON.stringify(agent) !== JSON.stringify(draft)) && !window.confirm('Discard unsaved changes?')) return
    onClose()
  }
  const upload = async (slot: string, file?: File) => {
    if (!file || busy) return
    setUploading(slot); setError(''); setProgress({ percent: 0, phase: 'uploading' })
    try { change(slot, await uploadImage(file, setProgress, 'collection-agents')) }
    catch (error) { setError(error instanceof Error ? error.message : 'Upload failed.') }
    finally { setUploading('') }
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || readOnly) return
    setError('')
    if (needsPassword && password !== confirmation) { setError('Passwords do not match.'); return }
    setSaving(true)
    try {
      await api(mode === 'password' ? { id: agent.id, revision: agent.revision, action: 'password', password } : { ...draft, ...(!agent.id ? { password } : {}) })
      setPassword(''); setConfirmation('')
      onSaved(mode === 'password' ? 'Password reset. Share the new password securely with the agent.' : agent.id ? 'Agent profile and access updated.' : 'Agent registered. They can sign in with their email and password. Share these credentials securely; no invitation email was sent.')
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to save agent.') }
    finally { setSaving(false) }
  }
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4"><div role="dialog" aria-modal="true" aria-labelledby="agent-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6"><div className="flex items-start justify-between gap-3"><h3 id="agent-title" className="text-xl font-bold">{mode === 'password' ? 'Reset agent password' : readOnly ? 'Agent profile' : agent.id ? 'Edit agent' : 'Register field agent'}</h3><button disabled={busy} className={button} onClick={close}>Close</button></div>
    <form onSubmit={submit} className="mt-5 space-y-5"><fieldset disabled={busy || readOnly} className="space-y-6">
      {mode !== 'password' && <><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Sign-in email<input type="email" required maxLength={254} disabled={!!agent.id} autoComplete="off" value={draft.email} onChange={event => setDraft({ ...draft, email: event.target.value })} className={input} /></label><label className="text-sm font-semibold">Account status<select value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value })} className={input}><option>Active</option><option>Suspended</option></select></label></div>
      {groups.map(([title, fields]) => <section key={title} className="rounded-2xl border border-slate-200 p-5"><h4 className="font-bold">{title}</h4><div className="mt-4 grid gap-4 sm:grid-cols-2">{fields.map(([key, label]) => <label key={key} className="text-sm font-semibold">{label}<input maxLength={300} required={['fullName','phone','area','address'].includes(key)} value={String(draft.profile[key] || '')} onChange={event => change(key, event.target.value)} className={input} /></label>)}{title === 'Personal details' && <label className="text-sm font-semibold">Region<select required value={String(draft.profile.region || '')} onChange={event => change('region', event.target.value)} className={input}><option value="">Select region</option>{GHANA_REGIONS.map(region => <option key={region}>{region}</option>)}</select></label>}</div></section>)}
      <section><h4 className="font-bold">Profile and identity images</h4><p className="mt-1 text-xs text-slate-500">Images are private. JPEG, PNG, GIF or WebP up to 5 MB each.</p><div className="mt-4 grid gap-4 sm:grid-cols-3">{Object.entries(slots).map(([slot, label]) => { const image = draft.profile[slot] as UploadedImage | null; return <div key={slot} className="rounded-xl border border-slate-200 p-3"><p className="text-sm font-semibold">{label}</p>{image && <img src={image.url} alt={label} className="mt-2 h-36 w-full rounded-lg object-contain" />}{!readOnly && <><label className={`${button} mt-3 block cursor-pointer border-2 border-blue-300 text-center text-blue-700`}>Upload image<input disabled={busy} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void upload(slot, file) }} /></label>{image && <button type="button" className="mt-2 text-xs text-red-600" onClick={() => change(slot, null)}>Remove image</button>}</>}</div>})}</div></section></>}
      {needsPassword && <section className="space-y-4 rounded-2xl border border-slate-200 p-5"><p className="text-sm text-slate-500">{agent.email || 'Create the agent login password.'}</p><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">New password<input type={show ? 'text' : 'password'} required minLength={8} maxLength={256} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} className={input} /></label><label className="text-sm font-semibold">Confirm password<input type={show ? 'text' : 'password'} required minLength={8} maxLength={256} autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} className={input} /></label></div><div className="flex gap-3"><button type="button" className={button} onClick={() => setShow(value => !value)}>{show ? 'Hide password' : 'Show password'}</button><button type="button" className={button} onClick={() => { const value = `Ap!${crypto.randomUUID()}`; setPassword(value); setConfirmation(value); setShow(true) }}>Generate password</button></div></section>}
      {!readOnly && <div className="flex justify-end gap-3"><button type="button" className={button} onClick={close}>Cancel</button><button className={`${button} bg-blue-600 text-white`}>{saving ? 'Saving...' : mode === 'password' ? 'Reset password' : 'Save agent'}</button></div>}
    </fieldset>{uploading && <div role="status" className="rounded-xl bg-blue-50 p-4 text-sm"><p>{progress.phase === 'processing' ? 'Processing image...' : `Uploading ${progress.percent ?? 0}%`}</p><progress max={100} value={progress.phase === 'uploading' ? progress.percent ?? undefined : undefined} className="mt-2 w-full" /></div>}{error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}</form>
  </div></div>
}
