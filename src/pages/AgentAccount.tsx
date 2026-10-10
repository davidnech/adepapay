import { useEffect, useState, type FormEvent } from 'react'
import SupportInbox from './SupportInbox'

type Account = { agent: { email: string; status: string; profile: { fullName: string; phone: string; region: string; area: string; address: string; profilePhoto?: { url: string } } }; storeName: string }
const button = 'rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold disabled:opacity-50'
export default function AgentAccount({ onLogout }: { onLogout: () => void }) {
  const [data, setData] = useState<Account | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reload, setReload] = useState(0)
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    let active = true
    setError('')
    fetch('/api/auth/agent/me', { credentials: 'same-origin', signal: AbortSignal.timeout(20000) }).then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Unable to load account.'); return result }).then(result => { if (active) setData(result) }).catch(error => { if (active) setError(error.message) })
    return () => { active = false }
  }, [reload])
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (saving) return
    setError(''); setNotice('')
    if (password !== confirmation) { setError('Passwords do not match.'); return }
    setSaving(true)
    try {
      const response = await fetch('/api/auth/agent/me', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, password }), signal: AbortSignal.timeout(30000) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to update password.')
      setCurrentPassword(''); setPassword(''); setConfirmation(''); setNotice('Password updated. Use your new password next time you sign in.')
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to update password.') }
    finally { setSaving(false) }
  }
  return <main className="min-h-screen bg-slate-50 p-5 sm:p-10"><div className="mx-auto max-w-4xl space-y-6"><header className="flex flex-wrap justify-between gap-4"><div><p className="text-sm font-semibold text-blue-700">AdepaPay · Field Agent</p><h1 className="mt-2 text-2xl font-bold">{data ? `Welcome, ${data.agent.profile.fullName}` : 'Your agent account'}</h1></div><div className="flex gap-2"><button className={button} onClick={() => setReload(value => value + 1)}>Refresh</button><button className={button} onClick={onLogout}>Sign out</button></div></header>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}{notice && <p role="status" className="rounded-xl bg-green-50 p-4 text-green-800">{notice}</p>}
    {data ? <><section className="rounded-2xl border border-slate-200 bg-white p-6">{data.agent.profile.profilePhoto && <img src={data.agent.profile.profilePhoto.url} alt="Your profile" className="mb-4 h-24 w-24 rounded-full object-cover" />}<dl className="grid gap-4 sm:grid-cols-2">{[['Store',data.storeName],['Email',data.agent.email],['Status',data.agent.status],['Phone',data.agent.profile.phone],['Region',data.agent.profile.region],['Assigned area',data.agent.profile.area]].map(([label,value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words font-semibold">{value}</dd></div>)}</dl></section><p className="text-sm text-slate-500">Your login and profile are active. Customer assignments, collections and settlements will appear here when those services are connected.</p>
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold">Change password</h2><fieldset disabled={saving} className="mt-5 space-y-4">{([['Current password',currentPassword,setCurrentPassword],['New password',password,setPassword],['Confirm new password',confirmation,setConfirmation]] as const).map(([label,value,setValue],index) => <label key={label} className="block text-sm font-semibold">{label}<input required type={show ? 'text' : 'password'} minLength={index ? 8 : undefined} maxLength={256} autoComplete={index ? 'new-password' : 'current-password'} value={value} onChange={event => setValue(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3" /></label>)}<div className="flex gap-3"><button type="button" className={button} onClick={() => setShow(value => !value)}>{show ? 'Hide passwords' : 'Show passwords'}</button><button className={`${button} bg-blue-600 text-white`}>{saving ? 'Updating...' : 'Update password'}</button></div></fieldset></form></> : !error && <p role="status">Loading your profile...</p>}
    {data && <SupportInbox />}
    </div></main>
}
