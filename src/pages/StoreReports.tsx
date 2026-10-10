import { useEffect, useState } from "react"
import { applicationRequest, applicationKinds, formatMoney } from "../lib/applicationsApi"

type Count = { label: string; count: number }
type Report = {
  summary: Record<string, number>; generatedAt: string
  applicationStatuses: Count[]; applicationTypes: Count[]; productStatuses: Count[]
  paymentsByDay: { date: string; amount: number }[]; paymentMethods: { label: string; amount: number }[]
  customers: { id: string; name: string; applications: number; activePlans: number; paid: number; outstanding: number }[]
  agents: { id: string; name: string; status: string; region: string; area: string }[]
}
const button = "rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
const metrics: [string, string, boolean?][] = [["completedPurchasesAllTime", "Completed purchases"], ["customers", "Total customers"], ["agents", "Field agents"], ["activeAgents", "Active agents"], ["products", "Total products"], ["activeProducts", "Active products"], ["stockUnits", "Stock units available"], ["lowStockProducts", "Low stock products"], ["outOfStockProducts", "Out of stock products"], ["activePlans", "Active purchase plans"], ["outstanding", "Current outstanding balance", true]]
const periodMetrics: [string, string, boolean?][] = [["applications", "Applications submitted"], ["periodCustomers", "Customers who applied"], ["completedPurchases", "Completed plans submitted in period"], ["confirmedPayments", "Payments received", true], ["paymentCount", "Payments recorded"]]
const isoDate = (value: Date) => value.toISOString().slice(0, 10)
const startDate = (days: number) => { const day = new Date(); day.setUTCDate(day.getUTCDate() - days + 1); return isoDate(day) }

function Table({ title, headings, rows }: { title: string; headings: string[]; rows: (string | number)[][] }) {
  const [page, setPage] = useState(1)
  const pages = Math.max(1, Math.ceil(rows.length / 20)), currentPage = Math.min(page, pages)
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><h3 className="p-5 font-bold">{title}</h3><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{headings.map(label => <th key={label} className="p-4">{label}</th>)}</tr></thead><tbody>{rows.slice((currentPage - 1) * 20, currentPage * 20).map((row, index) => <tr key={index} className="border-t border-slate-100">{row.map((value, cell) => <td key={cell} className="p-4">{value}</td>)}</tr>)}</tbody></table></div>{!rows.length && <p className="p-6 text-sm text-slate-500">No records for this report.</p>}{pages > 1 && <div className="flex items-center justify-between p-4 text-sm"><span>Page {currentPage} of {pages}</span><div className="flex gap-2"><button className={button} disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><button className={button} disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Next</button></div></div>}</section>
}

export default function StoreReports() {
  const [data, setData] = useState<Report | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(true)
  const [since, setSince] = useState(startDate(30)), [until, setUntil] = useState(isoDate(new Date())), [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true); setError("")
    if (since && until && since > until) { setError("The start date must be before the end date."); setLoading(false); return }
    const params = new URLSearchParams({ since, until })
    applicationRequest(`store/reports?${params}`).then(result => { if (active) setData(result) })
      .catch(error => { if (active) { setData(null); setError(error.message) } }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [since, until, reload])
  useEffect(() => {
    const refresh = () => { if (!document.hidden) setReload(value => value + 1) }
    window.addEventListener("focus", refresh); window.addEventListener("applications-changed", refresh)
    return () => { window.removeEventListener("focus", refresh); window.removeEventListener("applications-changed", refresh) }
  }, [])
  const exportReport = () => {
    if (!data || loading || error) return
    const rows: (string | number)[][] = [["Section", "Metric / name", "Value", "Additional details"], ["Period", "Start", since || "All time"], ["Period", "End", until || "All time"], ["Report", "Generated at", data.generatedAt], ...metrics.map(([key,label]) => ["Current totals",label,data.summary[key]]), ...periodMetrics.map(([key,label]) => ["Selected period",label,data.summary[key]]), ...data.applicationStatuses.map(row => ["Application status",row.label,row.count]), ...data.applicationTypes.map(row => ["Application type",row.label,row.count]), ...data.productStatuses.map(row => ["Product status",row.label,row.count]), ...data.paymentsByDay.map(row => ["Payments received (GHS)",row.date,row.amount]), ...data.paymentMethods.map(row => ["Payment method (GHS)",row.label,row.amount]), ...data.customers.map(row => ["Customer",row.name,row.applications,`Active plans: ${row.activePlans}; Paid GHS: ${row.paid}; Outstanding GHS: ${row.outstanding}`]), ...data.agents.map(row => ["Field agent",row.name,row.status,`${row.region} / ${row.area}`])]
    const cell = (value: string | number) => { const text = String(value); return `"${(/^[=+@\-\t\r\n]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"` }
    const url = URL.createObjectURL(new Blob(["\uFEFF" + rows.map(row => row.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a"); link.href = url; link.download = `AdepaPay-store-report-${isoDate(new Date())}.csv`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const cards = (items: typeof metrics) => <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{items.map(([key,label,currency]) => <div key={key} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{currency ? formatMoney(data!.summary[key]) : data!.summary[key]}</p></div>)}</div>
  return <div className="space-y-6"><div className="flex flex-wrap justify-between gap-4"><div><h2 className="text-2xl font-bold">Store reports</h2><p className="mt-1 text-sm text-slate-500">Customers, field agents, products, applications and recorded payments.</p></div><div className="flex gap-2"><button className={button} disabled={loading} onClick={() => setReload(value => value + 1)}>Refresh</button><button className={`${button} !bg-blue-600 text-white`} disabled={loading || !data || !!error} onClick={exportReport}>Export CSV</button></div></div>
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">{[7,30,90].map(days => <button key={days} className={button} onClick={() => { setSince(startDate(days)); setUntil(isoDate(new Date())) }}>Last {days} days</button>)}<button className={button} onClick={() => { setSince(""); setUntil("") }}>All time</button><label className="text-sm">From<input type="date" className="ml-2 rounded-lg border border-slate-200 p-2" value={since} onChange={event => setSince(event.target.value)} /></label><label className="text-sm">To<input type="date" className="ml-2 rounded-lg border border-slate-200 p-2" value={until} onChange={event => setUntil(event.target.value)} /></label></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}{loading ? <p role="status">Loading store reports...</p> : !error && data && <><div><h3 className="mb-3 font-bold">Current store totals</h3><p className="mb-4 text-sm text-slate-500">Customers are unique people who have applied to your store. These totals reflect current records across all dates.</p>{cards(metrics)}</div><div><h3 className="mb-3 font-bold">Selected period</h3><p className="mb-4 text-sm text-slate-500">Applications are grouped by submission date and payments by receipt date. Amounts are in GHS.</p>{cards(periodMetrics)}</div><div className="grid gap-5 lg:grid-cols-2"><Table title="Application statuses in period" headings={["Status","Count"]} rows={data.applicationStatuses.map(row => [row.label,row.count])} /><Table title="Application types in period" headings={["Type","Count"]} rows={data.applicationTypes.map(row => [applicationKinds[row.label as keyof typeof applicationKinds] || row.label,row.count])} /><Table title="Current product statuses" headings={["Status","Count"]} rows={data.productStatuses.map(row => [row.label,row.count])} /><Table title="Payments by method in period" headings={["Method","Received"]} rows={data.paymentMethods.map(row => [row.label,formatMoney(row.amount)])} /></div><Table title="Payments received by day" headings={["Date","Received"]} rows={data.paymentsByDay.map(row => [row.date,formatMoney(row.amount)])} /><Table title="All store customers" headings={["Customer","Applications","Active plans","Payments recorded","Outstanding"]} rows={data.customers.map(row => [row.name,row.applications,row.activePlans,formatMoney(row.paid),formatMoney(row.outstanding)])} /><Table title="Field agents" headings={["Agent","Status","Region","Area"]} rows={data.agents.map(row => [row.name,row.status,row.region,row.area])} /><p className="text-xs text-slate-500">Updated {new Date(data.generatedAt).toLocaleString()}</p></>}
  </div>
}
