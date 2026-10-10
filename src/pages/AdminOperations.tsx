import { useEffect, useState } from "react"
import { applicationKinds, formatMoney } from "../lib/applicationsApi"

export type AdminOperation = "customers" | "products" | "categories" | "applications" | "swap-overview" | "active-purchases" | "layaway-plans" | "collection-agents" | "agent-settlements" | "transactions" | "audit-logs"
type Cell = string | number | boolean | null
type RecordRow = { id: string; [key: string]: unknown; details?: Record<string, Cell>; related?: { title: string; rows: RecordRow[] }[]; paymentIds?: string[] }
type Directory = { warnings?: string[]; items: RecordRow[]; summary: { label: string; value: number | null; money: boolean }[]; facets: { status: string[]; kind: string[]; region: string[]; category: string[]; stores: { id: string; name: string }[] }; page: number; pageSize: number; total: number; generatedAt: string }
const button = "rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
const input = "rounded-xl border border-slate-200 bg-white p-3 text-sm"
const config: Record<AdminOperation, { title: string; description: string; columns: string[] }> = {
  customers: { title: "Customers", description: "Registered customer accounts and their applications, payments and balances.", columns: ["name","email","region","applications","paid","balance","status","createdAt"] },
  products: { title: "Products", description: "Products across all stores, including their four prices and current stock.", columns: ["name","storeName","category","cash","hirePurchase","layaway","swap","stock","status"] },
  categories: { title: "Categories", description: "Each store's saved categories, assigned products and stock.", columns: ["name","storeName","products","stock","status"] },
  applications: { title: "Store Applications", description: "Customer requests submitted to stores for hire purchase, layaway and swap.", columns: ["reference","customerName","storeName","productName","kind","total","paid","balance","status","createdAt"] },
  "swap-overview": { title: "Swap Overview", description: "Customer swap requests, trade-in credit, offers and completed exchanges.", columns: ["reference","customerName","storeName","productName","swapCredit","total","paid","status","createdAt"] },
  "active-purchases": { title: "Active Purchases", description: "Approved and completed purchase plans, recorded payments and remaining balances.", columns: ["reference","customerName","storeName","kind","total","paid","balance","fulfilled","status"] },
  "layaway-plans": { title: "Layaway Plans", description: "Layaway applications, deposits, payment records and product handover.", columns: ["reference","customerName","storeName","productName","deposit","total","paid","balance","status"] },
  "collection-agents": { title: "Collection Agents", description: "Registered field agent accounts, assigned stores, operating areas and current access status.", columns: ["name","email","storeName","region","area","status"] },
  "agent-settlements": { title: "Agent Settlements", description: "Agent-recorded customer payments and confirmed remittances. Balances are derived from recorded receipts.", columns: ["name","storeName","receipts","unsettled","settled","settlements","status"] },
  transactions: { title: "Transactions", description: "Customer payments, subscription checkouts and agent remittances, shown as separate transaction types.", columns: ["reference","kind","name","storeName","total","method","status","createdAt"] },
  "audit-logs": { title: "Audit Logs", description: "Persisted store administration, application activity and agent settlement events.", columns: ["createdAt","actor","action","storeName","kind","reference","reason"] },
}
const labels: Record<string,string> = { name:"Name", storeName:"Store", storeStatus:"Store status", createdAt:"Created", customerName:"Customer", productName:"Product", kind:"Type", total:"Amount", paid:"Paid", balance:"Balance", cash:"Cash price", hirePurchase:"Hire Purchase price", layaway:"Layaway price", swap:"Swap price", swapCredit:"Trade-in credit", fulfilled:"Handed over", receipts:"Recorded payments", unsettled:"Unsettled", settled:"Settled", paymentIds:"Payments", actor:"Actor", reason:"Reason / activity" }
const moneyKeys = new Set(["cash","hirePurchase","layaway","swap","total","paid","balance","deposit","unsettled","settled","swapCredit","productPrice","originalPrice"])
const label = (key: string) => labels[key] || key.replace(/([A-Z])/g," $1").replace(/^./,letter=>letter.toUpperCase())
const display = (key: string, value: unknown) => {
  if (value === undefined || value === null || value === "") return ["unsettled","settled","settlements"].includes(key) ? "Unavailable" : "Not recorded"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (moneyKeys.has(key)) return formatMoney(value as string | number)
  if (key === "kind" && typeof value === "string") return applicationKinds[value as keyof typeof applicationKinds] || value
  if ((key.endsWith("At") || key === "lastSignIn" || key === "bannedUntil") && typeof value === "string") return new Date(value).toLocaleString()
  return String(value)
}
async function request(path: string, body?: object, signal?: AbortSignal) {
  const response = await fetch(`/api/auth/admin/${path}`, { credentials: "same-origin", method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined, signal: signal || AbortSignal.timeout(45000) })
  const result = await response.json().catch(() => null)
  if (!response.ok || !result) throw new Error(result?.error || "Unable to load records. Refresh and retry.")
  return result
}

export default function AdminOperations({ page: module, initialRecord = "", initialQuery = "", onRecordChange }: { page: AdminOperation; initialRecord?: string; initialQuery?: string; onRecordChange?: (record: string) => void }) {
  const meta = config[module]
  const [data,setData] = useState<Directory | null>(null), [loading,setLoading] = useState(true), [error,setError] = useState("")
  const [query,setQuery] = useState(initialQuery), [search,setSearch] = useState(initialQuery), [page,setPage] = useState(1), [reload,setReload] = useState(0)
  const [filters,setFilters] = useState<Record<string,string>>({})
  const [record,setRecord] = useState<RecordRow | null>(null), [selected,setSelected] = useState<string | null>(initialRecord || null), [detailLoading,setDetailLoading] = useState(false), [detailError,setDetailError] = useState("")
  useEffect(() => { setSelected(initialRecord || null); setSettling(false) }, [initialRecord])
  useEffect(() => { setQuery(initialQuery); setSearch(initialQuery); setPage(1) }, [initialQuery])
  const selectRecord = (value: string | null) => { setSelected(value); onRecordChange?.(value || "") }
  const [exporting,setExporting] = useState(false), [settling,setSettling] = useState(false), [busy,setBusy] = useState(false), [notice,setNotice] = useState("")
  const [method,setMethod] = useState("Cash"), [reason,setReason] = useState(""), [confirmed,setConfirmed] = useState(false), [requestId,setRequestId] = useState("")
  useEffect(() => { const timer=window.setTimeout(()=>{ setSearch(query); setPage(1) },300); return ()=>window.clearTimeout(timer) },[query])
  const params = new URLSearchParams({ page:String(page),q:search,...filters }).toString()
  useEffect(() => {
    const controller = new AbortController(); let active=true
    setLoading(true); setError("")
    request(`operations/${module}?${params}`,undefined,AbortSignal.any([controller.signal,AbortSignal.timeout(45000)]))
      .then(result=>{ if(active)setData(result) }).catch(error=>{ if(active){setData(null);setError(error.message)} }).finally(()=>{if(active)setLoading(false)})
    return ()=>{active=false;controller.abort()}
  },[module,params,reload])
  useEffect(() => {
    if (!selected) {setRecord(null);return}
    const controller=new AbortController(); let active=true
    setDetailLoading(true);setDetailError("");setRecord(null)
    request(`operations/${module}?id=${encodeURIComponent(selected)}`,undefined,AbortSignal.any([controller.signal,AbortSignal.timeout(45000)]))
      .then(result=>{if(active)setRecord(result.record)}).catch(error=>{if(active)setDetailError(error.message)}).finally(()=>{if(active)setDetailLoading(false)})
    return ()=>{active=false;controller.abort()}
  },[module,selected,reload])
  useEffect(() => { const refresh=()=>{if(!document.hidden && !busy)setReload(value=>value+1)};window.addEventListener("focus",refresh);return()=>window.removeEventListener("focus",refresh) },[busy])
  const filter = (key:string,value:string) => {setFilters(current=>({...current,[key]:value}));setPage(1)}
  const exportRows = async () => {
    setExporting(true);setError("")
    try {
      const response=await fetch(`/api/auth/admin/operations/${module}?${params}&format=csv`,{credentials:"same-origin",signal:AbortSignal.timeout(60000)})
      if(!response.ok){const result=await response.json();throw new Error(result.error || "Export failed")}
      const url=URL.createObjectURL(await response.blob());const link=document.createElement("a");link.href=url;link.download=`AdepaPay-${module}.csv`;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000)
    } catch(error){setError(error instanceof Error?error.message:"Unable to export records.")}
    finally{setExporting(false)}
  }
  const settle = async () => {
    if(!record || busy)return
    setBusy(true);setDetailError("")
    try {
      const result=await request("agent-settlements",{agentId:record.id,paymentIds:record.paymentIds,expectedTotal:record.unsettled,requestId,method,reason,confirmedReceived:confirmed})
      setNotice(`Settlement ${result.settlement.reference} saved.`);setSettling(false);selectRecord(null);setReload(value=>value+1)
    } catch(error){setDetailError(error instanceof Error?error.message:"Settlement failed. Refresh the account before trying again.")}
    finally{setBusy(false)}
  }
  const table = (rows:RecordRow[],columns:string[]) => <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{columns.map(key=><th key={key} className="whitespace-nowrap p-4">{label(key)}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id} className="border-t border-slate-100">{columns.map(key=><td key={key} className="max-w-72 break-words p-4">{display(key,row[key])}</td>)}</tr>)}</tbody></table></div>
  return <div className="space-y-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-bold">{meta.title}</h2><p className="mt-1 text-sm text-slate-500">{meta.description}</p></div><div className="flex gap-2"><button className={button} disabled={loading || exporting} onClick={()=>setReload(value=>value+1)}>Refresh</button><button className={`${button} !bg-blue-600 text-white`} disabled={loading || !data || exporting} onClick={()=>void exportRows()}>{exporting?"Exporting...":"Export CSV"}</button></div></div>
    {notice&&<p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{notice}</p>}{error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
    {data?.warnings?.map(warning=><p key={warning} role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{warning}</p>)}
    {data&&<><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{data.summary.map(metric=><div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{metric.label}</p><p className="mt-2 text-2xl font-bold">{loading?"...":metric.value === null ? "Unavailable" : metric.money?formatMoney(metric.value):metric.value}</p></div>)}</div><p className="text-xs text-slate-500">Totals cover all records for this page. Filters apply to the list and CSV export.</p></>}
    <div className="flex flex-wrap gap-3"><input aria-label="Search records" placeholder="Search name, reference, store or email" value={query} onChange={event=>setQuery(event.target.value)} className={`${input} min-w-60 flex-1`} />{data&&(["status","kind","region","category"] as const).filter(key=>data.facets[key]?.length).map(key=><select key={key} aria-label={`Filter ${label(key)}`} className={input} value={filters[key]||""} onChange={event=>filter(key,event.target.value)}><option value="">All {key === "kind" ? "types" : key === "status" ? "statuses" : key === "category" ? "categories" : "regions"}</option>{data.facets[key].map(value=><option key={value} value={value}>{display(key,value)}</option>)}</select>)}{data&&data.facets.stores.length>0&&<select aria-label="Filter store" className={input} value={filters.store||""} onChange={event=>filter("store",event.target.value)}><option value="">All stores</option>{data.facets.stores.map(store=><option key={store.id} value={store.id}>{store.name||store.id}</option>)}</select>}<label className="text-xs text-slate-500">From<input aria-label="From date" type="date" className={`${input} ml-2`} value={filters.since||""} onChange={event=>filter("since",event.target.value)} /></label><label className="text-xs text-slate-500">To<input aria-label="To date" type="date" className={`${input} ml-2`} value={filters.until||""} onChange={event=>filter("until",event.target.value)} /></label><button className={button} onClick={()=>{setQuery("");setSearch("");setFilters({});setPage(1)}}>Clear filters</button></div>
    {loading?<p role="status">Loading {meta.title.toLowerCase()}...</p>:data&&<><div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{meta.columns.map(key=><th key={key} className="whitespace-nowrap p-4">{label(key)}</th>)}<th className="p-4">Details</th></tr></thead><tbody>{data.items.map(row=><tr key={row.id} className="border-t border-slate-100">{meta.columns.map(key=><td key={key} className="max-w-72 break-words p-4">{display(key,row[key])}</td>)}<td className="p-4"><button className={`${button} whitespace-nowrap`} onClick={()=>{selectRecord(row.id);setSettling(false)}}>View record</button></td></tr>)}</tbody></table>{!data.items.length&&<p className="p-8 text-center text-slate-500">No records match your filters.</p>}</div><div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500"><span>{data.total} records · Page {data.page} of {Math.max(1,Math.ceil(data.total/data.pageSize))}</span><div className="flex gap-2"><button className={button} disabled={data.page<=1} onClick={()=>setPage(data.page-1)}>Previous</button><button className={button} disabled={data.page*data.pageSize>=data.total} onClick={()=>setPage(data.page+1)}>Next</button></div></div><p className="text-xs text-slate-400">Updated {new Date(data.generatedAt).toLocaleString()}</p></>}
    {selected&&<div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4"><section role="dialog" aria-modal="true" aria-labelledby="admin-record-title" className="max-h-[90vh] w-full max-w-5xl space-y-5 overflow-y-auto rounded-3xl bg-white p-6"><div className="flex justify-between gap-4"><h3 id="admin-record-title" className="text-xl font-bold">{meta.title} · Record details</h3><button disabled={busy} className={button} onClick={()=>{selectRecord(null);setSettling(false)}}>Close</button></div>{detailLoading&&<p role="status">Loading record...</p>}{detailError&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{detailError}</p>}{record&&<><dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Object.entries({...Object.fromEntries(Object.entries(record).filter(([key])=>!["details","related","paymentIds"].includes(key))),...record.details}).map(([key,value])=><div key={key}><dt className="text-xs text-slate-500">{label(key)}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm font-medium">{display(key,value)}</dd></div>)}</dl>{typeof record.storeId==="string"&&/^[0-9a-f-]{36}$/i.test(record.storeId)&&<a className={`${button} inline-block text-blue-700`} href={`#admin-store/${record.storeId}`} onClick={()=>selectRecord(null)}>View store</a>}{record.related?.map(section=><section key={section.title} className="overflow-hidden rounded-xl border border-slate-200"><h4 className="p-4 font-bold">{section.title}</h4>{section.rows.length?table(section.rows,Object.keys(section.rows[0]).filter(key=>!["details","related","id","customerId","productId","storeId"].includes(key))):<p className="p-4 text-sm text-slate-500">No records.</p>}</section>)}{module==="agent-settlements"&&Number(record.unsettled)>0&&!settling&&<button className={`${button} !bg-blue-600 text-white`} onClick={()=>{setSettling(true);setMethod("Cash");setReason("");setConfirmed(false);setRequestId(crypto.randomUUID())}}>Record received remittance</button>}{settling&&<form className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50 p-5" onSubmit={event=>{event.preventDefault();void settle()}}><h4 className="font-bold">Confirm remittance of {formatMoney(record.unsettled as number)}</h4><p className="text-sm">This closes the listed unsettled payment receipts after the agent has remitted them.</p><fieldset disabled={busy} className="space-y-4"><select aria-label="Remittance method" className={input} value={method} onChange={event=>setMethod(event.target.value)}>{["Cash","Mobile Money","Bank Transfer"].map(value=><option key={value}>{value}</option>)}</select><label className="block text-sm">Reason / receipt reference<textarea required minLength={3} maxLength={1000} className={`${input} mt-2 w-full`} value={reason} onChange={event=>setReason(event.target.value)} /></label><label className="flex gap-2 text-sm"><input type="checkbox" required checked={confirmed} onChange={event=>setConfirmed(event.target.checked)} />I verified that this remittance was received.</label><div className="flex gap-2"><button type="button" className={button} onClick={()=>setSettling(false)}>Cancel</button><button className={`${button} !bg-blue-600 text-white`} disabled={!confirmed||reason.trim().length<3}>{busy?"Saving...":"Save settlement"}</button></div></fieldset></form>}</>}</section></div>}
  </div>
}
