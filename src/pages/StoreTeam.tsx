import { useEffect, useState, type FormEvent } from 'react'

type Member = { id?: string; version?: string; name: string; email: string; phone: string; title: string; permissions: string[]; status: string; lastSignIn?: string }
type Team = { users: Member[]; pages: Record<string, string>; owner: { name: string; email: string } }
const blank: Member = { name: '', email: '', phone: '', title: 'Staff', permissions: [], status: 'Active' }
const button = 'rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold disabled:opacity-50'
const input = 'mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm disabled:bg-slate-50'
async function teamRequest(data?: unknown) {
  const response = await fetch('/api/auth/store/team', { method: data ? 'POST' : 'GET', credentials: 'same-origin',
    headers: data ? { 'Content-Type': 'application/json' } : {}, body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(30000) })
  const result = await response.json().catch(() => null)
  if (!response.ok || !result) throw new Error(result?.error || 'Unable to load or save your team. Please retry.')
  return result
}
export default function StoreTeamPage({ initialRecord = "", initialQuery = "", onRecordChange }: { initialRecord?: string; initialQuery?: string; onRecordChange?: (record: string) => void }) {
  const [team, setTeam] = useState<Team | null>(null)
  const [editor, setEditor] = useState<Member | null>(null)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    teamRequest().then(result => { if (active) setTeam(result) }).catch(error => { if (active) setError(error.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reload])
  useEffect(() => { setQuery(initialQuery) }, [initialQuery])
  useEffect(() => { setEditor(team?.users.find(member => member.id === initialRecord) || null) }, [team, initialRecord])
  const edit = (member: Member) => { setEditor({ ...member, permissions: [...member.permissions] }); setPassword(''); setConfirmation(''); setError(''); setNotice('') }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!editor || saving) return
    if (!editor.id && password !== confirmation) { setError('Passwords do not match.'); return }
    setSaving(true); setError('')
    try {
      const result = await teamRequest({ ...editor, ...(!editor.id ? { password } : {}) })
      setTeam(current => current ? { ...current, users: editor.id ? current.users.map(user => user.id === editor.id ? result.user : user) : [...current.users, result.user] } : current)
      setNotice(editor.id ? 'Staff access updated.' : 'Staff account created. Share the login email and password with this person securely. No invitation email was sent.')
      setEditor(null); onRecordChange?.(""); setPassword(''); setConfirmation('')
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to save staff account.') }
    finally { setSaving(false) }
  }
  const visible = team?.users.filter(user => `${user.name} ${user.email} ${user.title} ${user.status}`.toLowerCase().includes(query.toLowerCase())) || []
  return <div className="space-y-6"><div className="flex flex-wrap justify-between gap-4"><div><h2 className="text-2xl font-bold">Roles & Users</h2><p className="mt-1 text-sm text-slate-500">Create staff accounts and choose the pages each person can access.</p></div><div className="flex gap-2"><button className={button} disabled={loading || saving} onClick={() => setReload(value => value + 1)}>Refresh</button><button className={`${button} bg-blue-600 text-white`} disabled={!team || loading} onClick={() => edit(blank)}>Add user</button></div></div>
    {notice && <p role="status" className="rounded-xl bg-green-50 p-4 text-sm text-green-800">{notice}</p>}
    {error && !editor && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {loading ? <p role="status">Loading team...</p> : team && <>
      <div className="grid gap-4 sm:grid-cols-3">{[['Team members', team.users.length + 1], ['Active staff', team.users.filter(user => user.status === 'Active').length], ['Disabled staff', team.users.filter(user => user.status === 'Disabled').length]].map(([label, count]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{count}</p></div>)}</div>
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm"><b>{team.owner.name} · Store Owner</b><p className="mt-1">{team.owner.email}</p><p className="mt-2 text-blue-800">The owner has full store access. Only the owner can manage Roles & Users.</p></div>
      <input aria-label="Search team" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, email, role or status" className={input} />
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{['User', 'Role title', 'Pages', 'Status', 'Action'].map(label => <th key={label} className="p-4">{label}</th>)}</tr></thead><tbody>{visible.map(user => <tr key={user.id} className="border-t border-slate-100"><td className="p-4 font-semibold">{user.name}<p className="text-xs font-normal text-slate-500">{user.email}</p></td><td className="p-4">{user.title}</td><td className="max-w-80 p-4 text-xs text-slate-600">{user.permissions.map(key => team.pages[key]).join(', ') || 'No pages assigned'}</td><td className="p-4">{user.status}</td><td className="p-4"><button className={button} onClick={() => edit(user)}>Edit access</button></td></tr>)}</tbody></table>{visible.length === 0 && <p className="p-8 text-center text-slate-500">No staff accounts match. Add a user to build your team.</p>}</div>
    </>}
    {editor && team && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4"><form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="team-editor-title" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl"><h3 id="team-editor-title" className="text-xl font-bold">{editor.id ? 'Edit staff access' : 'Create staff account'}</h3><fieldset disabled={saving} className="mt-5 space-y-5"><div className="grid gap-4 sm:grid-cols-2">{(['name', 'email', 'phone', 'title'] as const).map(key => <label key={key} className="text-sm font-semibold capitalize">{key === 'title' ? 'Role title' : key}<input type={key === 'email' ? 'email' : 'text'} required={key !== 'phone'} maxLength={key === 'email' ? 254 : 100} disabled={key === 'email' && !!editor.id} value={editor[key]} onChange={event => setEditor({ ...editor, [key]: event.target.value })} className={input} /></label>)}<label className="text-sm font-semibold">Status<select value={editor.status} onChange={event => setEditor({ ...editor, status: event.target.value })} className={input}><option>Active</option><option>Disabled</option></select></label>{!editor.id && <><label className="text-sm font-semibold">Initial password<input type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} required minLength={8} maxLength={256} className={input} /></label><label className="text-sm font-semibold">Confirm password<input type="password" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} required className={input} /></label></>}</div>
      <div><h4 className="font-bold">Page access</h4><p className="mt-1 text-xs text-slate-500">Only selected pages appear in this user's sidebar. A role title does not grant access. No selection means no page access.</p><div className="mt-3 flex gap-3"><button type="button" className={button} onClick={() => setEditor({ ...editor, permissions: Object.keys(team.pages) })}>Select all</button><button type="button" className={button} onClick={() => setEditor({ ...editor, permissions: [] })}>Clear</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{Object.entries(team.pages).map(([key, label]) => <label key={key} className="flex gap-3 rounded-xl border border-slate-200 p-3 text-sm"><input type="checkbox" checked={editor.permissions.includes(key)} onChange={event => setEditor({ ...editor, permissions: event.target.checked ? [...editor.permissions, key] : editor.permissions.filter(value => value !== key) })} className="accent-blue-600" />{label}</label>)}</div></div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-3"><button type="button" className={button} onClick={() => { setEditor(null); onRecordChange?.(""); setPassword(''); setConfirmation(''); setError('') }}>Cancel</button><button type="submit" className={`${button} bg-blue-600 text-white`}>{saving ? 'Saving...' : editor.id ? 'Save access' : 'Create user'}</button></div>
    </fieldset></form></div>}
  </div>
}
