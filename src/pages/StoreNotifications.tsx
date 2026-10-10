import { useEffect, useState } from "react"
import { applicationRequest } from "../lib/applicationsApi"

type Notification = { id: string; category: string; title: string; message: string; createdAt: string; read: boolean; target?: string; record?: string }
type Inbox = { items: Notification[]; unread: number }
const button = "rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-50"

export default function StoreNotifications({ customer = false, onNavigate, initialQuery = "" }: { customer?: boolean; onNavigate?: (page: string, record?: string) => void; initialQuery?: string }) {
  const portal = customer ? "customer" : "store"
  const [data, setData] = useState<Inbox | null>(null)
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("")
  const [reload, setReload] = useState(0), [search, setSearch] = useState(""), [filter, setFilter] = useState("All")
  const [category, setCategory] = useState("All"), [page, setPage] = useState(1)
  useEffect(() => {
    let active = true
    setLoading(true); setError("")
    applicationRequest(`${portal}/notifications`).then(result => {
      if (active) { setData(result); window.dispatchEvent(new Event(`${portal}-notifications-changed`)) }
    }).catch(error => { if (active) { setData(null); setError(error.message) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reload, portal])
  useEffect(() => {
    const refresh = () => { if (!document.hidden) setReload(value => value + 1) }
    const timer = window.setInterval(refresh, 60000)
    window.addEventListener("focus", refresh)
    window.addEventListener("applications-changed", refresh)
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("applications-changed", refresh) }
  }, [])
  useEffect(() => { setSearch(initialQuery); setPage(1) }, [initialQuery])
  const markRead = async (id?: string) => {
    if (busy) return
    setBusy(true); setError("")
    try {
      await applicationRequest(`${portal}/notifications`, id ? { action: "read", ids: [id] } : { action: "read_all" })
      setData(current => current ? { items: current.items.map(item => !id || item.id === id ? { ...item, read: true } : item), unread: id ? current.items.filter(item => !item.read && item.id !== id).length : 0 } : current)
      window.dispatchEvent(new Event(`${portal}-notifications-changed`))
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to mark notifications read.") }
    finally { setBusy(false) }
  }
  const items = (data?.items || []).filter(item => (filter === "All" || !item.read) && (category === "All" || item.category === category) && `${item.title} ${item.message}`.toLowerCase().includes(search.toLowerCase()))
  const pages = Math.max(1, Math.ceil(items.length / 20)), currentPage = Math.min(page, pages)
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-bold">Notifications</h2><p className="mt-1 text-sm text-slate-500">{data ? `${data.unread} unread` : "Store activity"} · {customer ? "Application decisions, payments and support replies." : "Application activity, stock alerts and agent account updates."}</p></div><div className="flex gap-2"><button className={button} disabled={busy || loading || !data?.unread} onClick={() => void markRead()}>Mark all read</button><button className={button} disabled={loading || busy} onClick={() => setReload(value => value + 1)}>Refresh</button></div></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
    <div className="flex flex-wrap gap-3"><input aria-label="Search notifications" className="min-w-48 flex-1 rounded-xl border border-slate-200 p-3 text-sm" placeholder="Search notifications" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} /><select aria-label="Read status" className={button} value={filter} onChange={event => { setFilter(event.target.value); setPage(1) }}>{["All", "Unread"].map(value => <option key={value}>{value}</option>)}</select><select aria-label="Notification category" className={button} value={category} onChange={event => { setCategory(event.target.value); setPage(1) }}>{["All", ...Array.from(new Set((data?.items || []).map(item => item.category)))].map(value => <option key={value}>{value}</option>)}</select></div>
    {loading ? <p role="status">Loading notifications...</p> : data && <div className="space-y-3">{items.slice((currentPage - 1) * 20, currentPage * 20).map(item => <article key={item.id} className={`rounded-2xl border p-5 ${item.read ? "border-slate-200 bg-white" : "border-blue-200 bg-blue-50"}`}><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-semibold text-blue-700">{item.category}{!item.read && " · Unread"}</p><h3 className="mt-1 font-bold">{item.title}</h3></div>{!item.read && <button className={`${button} bg-white`} disabled={busy} onClick={() => void markRead(item.id)}>Mark read</button>}</div><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{item.message}</p>{item.target && onNavigate && <button className={`${button} mt-3 bg-white`} onClick={() => { void markRead(item.id); onNavigate(item.target!, item.record) }}>Open record</button>}<p className="mt-3 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</p></article>)}{!items.length && <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">{filter === "Unread" ? "No unread notifications match your filters." : "No notifications match your filters."}</p>}<div className="flex items-center justify-between gap-3 text-sm"><span>{items.length} notifications · Page {currentPage} of {pages}</span><div className="flex gap-2"><button className={button} disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><button className={button} disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Next</button></div></div></div>}
  </div>
}
