import { useEffect, useState } from "react"
import { applicationRequest } from "../lib/applicationsApi"
type Status = { databaseConnected: boolean; setupComplete: boolean; services: { name: string; ready: boolean }[]; checkedAt: string }
export default function AdminConnectionStatus() {
  const [data, setData] = useState<Status | null>(null), [error, setError] = useState(""), [open, setOpen] = useState(false), [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    applicationRequest("admin/status").then(result => { if (active) { setData(result); setError("") } }).catch(error => { if (active) { setData(null); setError(error.message) } })
    return () => { active = false }
  }, [reload])
  useEffect(() => { const refresh = () => { if (!document.hidden) setReload(value => value + 1) }; const timer = window.setInterval(refresh, 60000); window.addEventListener("focus", refresh); return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh) } }, [])
  return <div className="relative hidden lg:block"><button type="button" aria-expanded={open} aria-label="Database connection and setup status" onClick={() => setOpen(value => !value)} className={`rounded-full border px-3 py-2 text-xs font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : data?.setupComplete ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{error ? "Database unavailable" : !data ? "Checking database..." : data.setupComplete ? "Database connected" : "Database connected · Setup needed"}</button>{open && <section className="absolute right-0 top-full z-[60] mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"><h3 className="text-sm font-bold">Database readiness</h3>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}{data?.services.map(row => <p key={row.name} className="mt-3 flex justify-between gap-2 text-xs"><span>{row.name}</span><span className={row.ready ? "text-emerald-700" : "text-amber-800"}>{row.ready ? "Connected" : "Migration needed"}</span></p>)}{data && <p className="mt-4 text-xs text-slate-500">Checked {new Date(data.checkedAt).toLocaleString()}</p>}<div className="mt-4 flex gap-2"><button className="rounded-lg border border-slate-200 px-3 py-2 text-xs" onClick={() => setReload(value => value + 1)}>Check again</button><button className="rounded-lg border border-slate-200 px-3 py-2 text-xs" onClick={() => setOpen(false)}>Close</button></div></section>}</div>
}
