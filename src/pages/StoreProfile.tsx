import { useEffect, useRef, useState, type FormEvent } from 'react'
import uploadImage, { type UploadedImage, type UploadProgress } from '../lib/imageUploader'
import { GHANA_REGIONS } from '../lib/localization'

type Profile = {
  id: string; email: string; registeredName: string; registrationNumber: string; ownerName: string
  storeType: string; officeClassification: string; categories: string[]; verification: string; version: string
  storeName: string; phone: string; contactEmail: string; region: string; city: string
  operatingLocation: string; nearestLandmark: string; gpsAddress: string; openingHours: string
  description: string; website: string; logo: UploadedImage | null; cover: UploadedImage | null
}
const fields = [
  ['storeName', 'Public store name'], ['phone', 'Primary phone'], ['contactEmail', 'Contact email'],
  ['city', 'City or town'], ['operatingLocation', 'Operating address'], ['nearestLandmark', 'Nearest landmark'],
  ['gpsAddress', 'GhanaPost GPS'], ['openingHours', 'Opening hours'], ['website', 'Website'],
] as const
const input = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:bg-slate-50'
const button = 'rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-50'

async function profileRequest(profile?: Profile): Promise<Profile> {
  const response = await fetch('/api/auth/store/profile', {
    method: profile ? 'POST' : 'GET', credentials: 'same-origin', signal: AbortSignal.timeout(20000),
    headers: profile ? { 'Content-Type': 'application/json' } : {}, body: profile ? JSON.stringify(profile) : undefined,
  })
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.profile) throw new Error(result?.error || 'Unable to load or save your profile. Please retry.')
  return result.profile
}

export default function StoreProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [saved, setSaved] = useState<Profile | null>(null)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const logoInput = useRef<HTMLInputElement>(null)
  const coverInput = useRef<HTMLInputElement>(null)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({ percent: 0, phase: 'uploading' })
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    profileRequest().then(value => { if (active) { setProfile(value); setSaved(value) } })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : 'Unable to load your store.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reload])
  const upload = async (slot: 'logo' | 'cover', file?: File) => {
    if (!file || uploading) return
    setUploadProgress({ percent: 0, phase: 'uploading' })
    setUploading(slot)
    setError('')
    setNotice('')
    try {
      const image = await uploadImage(file, setUploadProgress)
      setProfile(value => value ? { ...value, [slot]: image } : value)
      setNotice('Image uploaded. Save changes to use it on your store profile.')
    } catch (error) { setError(error instanceof Error ? error.message : 'Upload failed. Please retry.') }
    finally { setUploading(null) }
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!profile || saving || uploading) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const updated = await profileRequest(profile)
      setProfile(updated)
      setSaved(updated)
      setEditing(false)
      setNotice('Your store profile has been saved.')
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to save. Please retry.') }
    finally { setSaving(false) }
  }
  if (loading) return <p role="status" className="p-8">Loading store profile...</p>
  if (!profile) return <div role="alert" className="rounded-2xl bg-red-50 p-6"><p>{error}</p><button onClick={() => setReload(value => value + 1)} className={`${button} mt-4`}>Retry</button></div>
  const disabled = !editing || saving || !!uploading
  return <form onSubmit={submit} className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-bold">Store Profile</h2><p className="mt-1 text-sm text-slate-500">Manage your store information, logo and cover image.</p></div><div className="flex gap-2">{editing ? <><button type="button" disabled={saving || !!uploading} onClick={() => { setProfile(saved); setEditing(false); setError(''); setNotice('') }} className={button}>Cancel</button><button type="submit" disabled={saving || !!uploading} className={`${button} bg-blue-600 text-white`}>{saving ? 'Saving...' : 'Save changes'}</button></> : <button type="button" onClick={() => { setEditing(true); setNotice('') }} className={`${button} bg-blue-600 text-white`}>Edit profile</button>}</div></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-green-50 p-4 text-sm text-green-800">{notice}</p>}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {profile.cover ? <img src={profile.cover.url} alt={`${profile.storeName} cover`} className="h-48 w-full object-cover" /> : <div className="h-48 bg-gradient-to-r from-blue-950 to-blue-600" />}
      <div className="flex items-center gap-5 p-6">{profile.logo ? <img src={profile.logo.url} alt={`${profile.storeName} logo`} className="h-24 w-24 rounded-2xl border border-slate-200 object-cover" /> : <div className="grid h-24 w-24 place-items-center rounded-2xl bg-blue-50 text-3xl font-bold text-blue-700">{profile.storeName.slice(0, 2).toUpperCase()}</div>}<div><h3 className="text-2xl font-bold">{profile.storeName}</h3><p className="mt-1 text-sm text-slate-500">{profile.categories.join(' · ')}</p><p className="mt-2 text-xs font-semibold text-emerald-700">Verified · Active</p></div></div>
      {editing && (
        <div className="grid gap-4 border-t border-slate-100 p-6 sm:grid-cols-2">
          {(['logo', 'cover'] as const).map(slot => {
            const active = uploading === slot
            const processing = uploadProgress.phase === 'processing'
            const ref = slot === 'logo' ? logoInput : coverInput
            return (
              <div key={slot} className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold capitalize">{slot} image</p>
                <input
                  ref={ref}
                  type="file"
                  aria-label={`Choose ${slot} image`}
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  disabled={!!uploading || saving}
                  onChange={event => { void upload(slot, event.target.files?.[0]); event.target.value = '' }}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={!!uploading || saving}
                  onClick={() => ref.current?.click()}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-blue-300 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:border-blue-500 hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {active ? <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" /> : <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m-4 4 4-4 4 4M4 16v4h16v-4" /></svg>}
                  {active ? (processing ? 'Finishing upload...' : 'Uploading...') : `Upload ${slot} image`}
                </button>
                {active && (
                  <div className="mt-3">
                    <p role="status" className="mb-2 text-xs font-medium text-blue-700">
                      {processing ? 'Saving image to Cloudflare...' : `Uploading to server${uploadProgress.percent === null ? '...' : `: ${uploadProgress.percent}%`}`}
                    </p>
                    <div
                      role="progressbar"
                      aria-label={`${slot} image upload`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={!processing && uploadProgress.percent !== null ? uploadProgress.percent : undefined}
                      aria-valuetext={processing ? 'Saving image to Cloudflare' : undefined}
                      className="h-2 overflow-hidden rounded-full bg-blue-100"
                    >
                      <div className={`h-full rounded-full bg-blue-600 transition-[width] duration-200 ${processing || uploadProgress.percent === null ? 'w-full animate-pulse' : ''}`} style={!processing && uploadProgress.percent !== null ? { width: `${uploadProgress.percent}%` } : undefined} />
                    </div>
                  </div>
                )}
                {profile[slot] && <button type="button" className="mt-3 text-xs font-semibold text-red-600" disabled={!!uploading || saving} onClick={() => setProfile({ ...profile, [slot]: null })}>Remove {slot}</button>}
              </div>
            )
          })}
          <p className="text-xs text-slate-500 sm:col-span-2">JPEG, PNG, GIF or WebP. Maximum 5 MB per image.</p>
        </div>
      )}
    </section>
    <fieldset disabled={disabled} className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-6 sm:grid-cols-2"><legend className="px-2 text-lg font-bold">Contact and operating details</legend>{fields.map(([key, label]) => <label key={key} className="text-xs font-semibold text-slate-500">{label}<input value={profile[key]} onChange={event => setProfile({ ...profile, [key]: event.target.value })} type={key === 'contactEmail' ? 'email' : key === 'website' ? 'url' : 'text'} required={['storeName', 'phone', 'contactEmail', 'city'].includes(key)} maxLength={300} className={input} /></label>)}<label className="text-xs font-semibold text-slate-500">Region<select value={profile.region} onChange={event => setProfile({ ...profile, region: event.target.value })} className={input} required><option value="">Choose region</option>{GHANA_REGIONS.map(region => <option key={region}>{region}</option>)}</select></label><label className="text-xs font-semibold text-slate-500 sm:col-span-2">About your store<textarea rows={4} maxLength={2000} value={profile.description} onChange={event => setProfile({ ...profile, description: event.target.value })} className={input} /></label></fieldset>
    <section className="rounded-2xl border border-slate-200 bg-white p-6"><h3 className="text-lg font-bold">Registration and verification</h3><dl className="mt-5 grid gap-4 sm:grid-cols-2">{[['Registered business', profile.registeredName], ['Registration number', profile.registrationNumber], ['Owner', profile.ownerName], ['Account email', profile.email], ['Store type', profile.storeType], ['Office', profile.officeClassification], ['Store ID', profile.id], ['Document verification', profile.verification]].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className={`mt-1 break-words text-sm font-semibold ${label === 'Document verification' ? 'text-emerald-700' : ''}`}>{value || 'Not provided'}</dd></div>)}</dl></section>
  </form>
}
