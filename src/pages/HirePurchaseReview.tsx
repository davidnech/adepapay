import { useEffect, useMemo, useState } from "react"
import {
  HIRE_PURCHASE_EVENT,
  loadHirePurchaseApplications,
  updateHirePurchaseApplication,
  type HirePurchaseApplication,
} from "../lib/hirePurchaseApplications"

const money = (value: number) => new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(value)
const date = (value: string) => new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
const primary = "rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
const secondary = "rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
const input = "mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"

function useApplications() {
  const [applications, setApplications] = useState(loadHirePurchaseApplications)
  useEffect(() => {
    const refresh = () => setApplications(loadHirePurchaseApplications())
    window.addEventListener(HIRE_PURCHASE_EVENT, refresh)
    window.addEventListener("storage", refresh)
    return () => { window.removeEventListener(HIRE_PURCHASE_EVENT, refresh); window.removeEventListener("storage", refresh) }
  }, [])
  return applications
}

function tone(stage: string) {
  if (stage === "Approved" || stage === "Accepted") return "bg-emerald-50 text-emerald-700"
  if (stage.includes("Rejected")) return "bg-red-50 text-red-700"
  if (stage.includes("Documents")) return "bg-amber-50 text-amber-700"
  if (stage.includes("Admin")) return "bg-purple-50 text-purple-700"
  return "bg-blue-50 text-blue-700"
}

export default function HirePurchaseReviewPage({ role, storeId }: { role: "Admin" | "Store"; storeId?: string }) {
  const all = useApplications()
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState("All")
  const [selected, setSelected] = useState<HirePurchaseApplication | null>(null)
  const applications = useMemo(() => all.filter((application) => {
    if (role === "Store" && application.storeId !== storeId) return false
    if (role === "Admin" && application.adminDecision === "Not Submitted") return false
    const search = `${application.reference} ${application.customerName} ${application.product} ${application.storeName}`.toLowerCase()
    if (!search.includes(query.toLowerCase())) return false
    if (filter === "Pending") return role === "Admin" ? application.stage === "Admin Review" : application.stage === "Store Review"
    if (filter === "Documents") return application.stage.includes("Documents")
    if (filter === "Approved") return application.stage === "Approved"
    if (filter === "Rejected") return application.stage.includes("Rejected")
    return true
  }), [all, filter, query, role, storeId])
  const scoped = all.filter((application) => role === "Admin" ? application.adminDecision !== "Not Submitted" : application.storeId === storeId)
  const metrics = role === "Admin"
    ? [["Submitted by stores", scoped.length], ["Awaiting Admin review", scoped.filter((item) => item.stage === "Admin Review").length], ["Documents requested", scoped.filter((item) => item.stage === "Admin Documents Required").length], ["Approved", scoped.filter((item) => item.stage === "Approved").length]]
    : [["Customer applications", scoped.length], ["Awaiting Store review", scoped.filter((item) => item.stage === "Store Review").length], ["Sent to Admin", scoped.filter((item) => item.adminDecision !== "Not Submitted").length], ["Final approvals", scoped.filter((item) => item.stage === "Approved").length]]
  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-2xl font-bold">{role === "Admin" ? "Store-Submitted Applications" : "Hire Purchase Applications"}</h2><p className="mt-1 max-w-3xl text-sm text-slate-500">{role === "Admin" ? "Review applications forwarded by stores and approve, request supporting documents, or reject them before an agreement can be issued." : "Review customer applications, request missing documents, and forward eligible cases to AdepaPay Admin for final approval."}</p></div><button className={secondary}>Export applications</button></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="text-sm text-slate-500">{label}</div><div className="mt-2 text-2xl font-black">{value}</div></div>)}</div>
    <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-col gap-3 lg:flex-row"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reference, customer, store, or product" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500" /><div className="flex gap-2 overflow-x-auto">{["All", "Pending", "Documents", "Approved", "Rejected"].map((item) => <button key={item} onClick={() => setFilter(item)} className={`whitespace-nowrap rounded-xl px-4 py-3 text-xs font-bold ${filter === item ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-600"}`}>{item}</button>)}</div></div></div>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[1120px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Application", "Customer", "Product", ...(role === "Admin" ? ["Store"] : []), "Amount", "Risk", "Store decision", "Admin decision", "Status", "Actions"].map((label) => <th key={label} className="px-5 py-4">{label}</th>)}</tr></thead><tbody>{applications.map((application) => <tr key={application.reference} className="border-t border-slate-100"><td className="px-5 py-4"><div className="font-bold">{application.reference}</div><div className="text-xs text-slate-400">{date(application.submittedAt)}</div></td><td className="px-5 py-4"><div className="font-bold">{application.customerName}</div><div className="text-xs text-slate-400">{application.customerId}</div></td><td className="px-5 py-4">{application.product}</td>{role === "Admin" && <td className="px-5 py-4 font-semibold">{application.storeName}</td>}<td className="px-5 py-4 font-bold">{money(application.amount)}</td><td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${application.riskLevel === "Low" ? "bg-emerald-50 text-emerald-700" : application.riskLevel === "High" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{application.riskScore}/100 · {application.riskLevel}</span></td><td className="px-5 py-4">{application.storeDecision}</td><td className="px-5 py-4">{application.adminDecision}</td><td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${tone(application.stage)}`}>{application.stage}</span></td><td className="px-5 py-4"><button onClick={() => setSelected(application)} className="font-bold text-blue-600">Review application</button></td></tr>)}</tbody></table>{!applications.length && <div className="p-12 text-center text-sm text-slate-500">No applications match this view.</div>}</div></div>
    {selected && <ApplicationReviewModal key={`${selected.reference}-${selected.stage}`} application={all.find((item) => item.reference === selected.reference) ?? selected} role={role} onClose={() => setSelected(null)} />}
  </div>
}

function ApplicationReviewModal({ application, role, onClose }: { application: HirePurchaseApplication; role: "Admin" | "Store"; onClose: () => void }) {
  const [note, setNote] = useState("")
  const [documents, setDocuments] = useState("")
  const [error, setError] = useState("")
  const requested = documents.split(/[,\n]/).map((item) => item.trim()).filter(Boolean)
  const act = (kind: "forward" | "request" | "reject" | "approve" | "resubmit" | "generate" | "issue") => {
    if (["request", "reject"].includes(kind) && !note.trim()) { setError("Add a reason or instruction before continuing."); return }
    if (kind === "request" && !requested.length) { setError("List at least one required document."); return }
    const now = new Date().toISOString()
    updateHirePurchaseApplication(application.reference, (current) => {
      const actor = role
      if (kind === "forward") return { ...current, stage: "Admin Review", storeDecision: "Forwarded", adminDecision: "Pending", history: [...current.history, { at: now, actor: "Store", action: "Forwarded to Admin", note: note.trim() || "Store checks completed and application submitted for final approval." }] }
      if (kind === "request") return role === "Admin"
        ? { ...current, stage: "Admin Documents Required", adminDecision: "Documents Required", requestedDocuments: requested, documents: [...current.documents, ...requested.map((name) => ({ name, status: "Requested" as const }))], history: [...current.history, { at: now, actor: "Admin", action: "Further documents requested", note: note.trim() }] }
        : { ...current, stage: "Store Documents Required", storeDecision: "Documents Required", requestedDocuments: requested, documents: [...current.documents, ...requested.map((name) => ({ name, status: "Requested" as const }))], history: [...current.history, { at: now, actor: "Store", action: "Further documents requested", note: note.trim() }] }
      if (kind === "reject") return role === "Admin"
        ? { ...current, stage: "Rejected by Admin", adminDecision: "Rejected", agreementStatus: "Not Available", history: [...current.history, { at: now, actor: "Admin", action: "Application rejected", note: note.trim() }] }
        : { ...current, stage: "Rejected by Store", storeDecision: "Rejected", agreementStatus: "Not Available", history: [...current.history, { at: now, actor: "Store", action: "Application rejected", note: note.trim() }] }
      if (kind === "approve") return { ...current, stage: "Approved", adminDecision: "Approved", agreementStatus: "Ready to Generate", requestedDocuments: [], history: [...current.history, { at: now, actor: "Admin", action: "Application approved", note: note.trim() || "Final platform checks completed." }] }
      if (kind === "resubmit") return { ...current, stage: current.adminDecision === "Documents Required" ? "Admin Review" : "Store Review", adminDecision: current.adminDecision === "Documents Required" ? "Pending" : current.adminDecision, storeDecision: current.adminDecision === "Documents Required" ? "Forwarded" : "Pending", requestedDocuments: [], documents: current.documents.map((item) => item.status === "Requested" ? { ...item, status: "Pending" as const } : item), history: [...current.history, { at: now, actor: "Store", action: "Requested documents supplied", note: note.trim() || "Documents received and application resubmitted for review." }] }
      if (kind === "generate") return { ...current, agreementStatus: "Draft", history: [...current.history, { at: now, actor, action: "Agreement draft generated", note: "Draft created from the approved application and payment plan." }] }
      return { ...current, agreementStatus: "Awaiting Customer", history: [...current.history, { at: now, actor, action: "Agreement issued", note: "Agreement sent to customer for electronic acceptance." }] }
    })
    onClose()
  }
  const canStoreReview = role === "Store" && application.stage === "Store Review"
  const canAdminReview = role === "Admin" && ["Admin Review", "Admin Documents Required"].includes(application.stage)
  const canResubmit = role === "Store" && ["Store Documents Required", "Admin Documents Required"].includes(application.stage)
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"><button className="absolute inset-0" onClick={onClose} aria-label="Close application review" /><div className="relative max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-bold">{application.reference}</h3><span className={`rounded-full px-3 py-1 text-xs font-bold ${tone(application.stage)}`}>{application.stage}</span></div><p className="mt-1 text-sm text-slate-500">{application.customerName} · {application.storeName} · submitted {date(application.submittedAt)}</p></div><button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-xl">×</button></div>
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[["Product", application.product], ["Purchase amount", money(application.amount)], ["Required deposit", money(application.deposit)], ["Payment plan", `${money(application.installment)} × ${application.tenureMonths} months`]].map(([label, value]) => <div key={label} className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-bold text-slate-400">{label}</div><div className="mt-2 text-sm font-bold">{value}</div></div>)}</div>
    <div className="mt-6 grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><div className={`rounded-2xl border p-5 ${application.riskLevel === "Low" ? "border-emerald-200 bg-emerald-50" : application.riskLevel === "High" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}><div className="text-xs font-bold uppercase tracking-wide">Customer risk score</div><div className="mt-2 text-3xl font-black">{application.riskScore}<span className="text-sm"> / 100 · {application.riskLevel}</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-white"><div className={`h-full ${application.riskLevel === "Low" ? "bg-emerald-500" : application.riskLevel === "High" ? "bg-red-500" : "bg-amber-500"}`} style={{ width: `${application.riskScore}%` }} /></div><p className="mt-4 text-xs leading-5">Decision-support only. Review affordability and verified evidence before deciding.</p></div><div className="rounded-2xl border border-slate-200 p-5"><h4 className="font-bold">Application checks</h4><div className="mt-4 grid gap-3 sm:grid-cols-2">{[["Customer", `${application.customerName} · ${application.customerId}`], ["Phone", application.phone], ["Store review", application.storeDecision], ["Admin review", application.adminDecision], ["Agreement", application.agreementStatus], ["Affordability", "Income and installment ratio available"]].map(([label, value]) => <div key={label}><div className="text-xs text-slate-400">{label}</div><div className="mt-1 text-sm font-bold">{value}</div></div>)}</div></div></div>
    <div className="mt-6 grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 p-5"><h4 className="font-bold">Supporting documents</h4><div className="mt-3 space-y-2">{application.documents.map((document, index) => <div key={`${document.name}-${index}`} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm"><span>{document.name}</span><span className={`text-xs font-bold ${document.status === "Verified" ? "text-emerald-600" : document.status === "Requested" ? "text-red-600" : "text-amber-600"}`}>{document.status}</span></div>)}</div></div><div className="rounded-2xl border border-slate-200 p-5"><h4 className="font-bold">Decision history</h4><div className="mt-3 space-y-3">{[...application.history].reverse().map((item, index) => <div key={`${item.at}-${index}`} className="border-l-2 border-blue-200 pl-3"><div className="text-sm font-bold">{item.action}</div><div className="text-xs text-slate-400">{item.actor} · {date(item.at)}</div><p className="mt-1 text-xs leading-5 text-slate-600">{item.note}</p></div>)}</div></div></div>
    {(canStoreReview || canAdminReview || canResubmit) && <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50/40 p-5"><h4 className="font-bold">{canResubmit ? "Supply requested documents" : `${role} decision`}</h4>{!canResubmit && <label className="mt-4 block"><span className="text-xs font-bold">Documents to request</span><textarea value={documents} onChange={(event) => setDocuments(event.target.value)} rows={2} placeholder="Enter document names, separated by commas or new lines" className={input} /></label>}<label className="mt-4 block"><span className="text-xs font-bold">Decision note {canResubmit ? "(optional)" : ""}</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Add review notes, reasons, or instructions" className={input} /></label>{error && <p className="mt-2 text-xs font-bold text-red-600">{error}</p>}<div className="mt-5 flex flex-wrap justify-end gap-3">{canResubmit ? <button onClick={() => act("resubmit")} className={primary}>{application.stage === "Admin Documents Required" ? "Resubmit to Admin" : "Mark received & continue review"}</button> : <><button onClick={() => act("reject")} className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white">Reject</button><button onClick={() => act("request")} className={secondary}>Request further documents</button>{role === "Store" ? <button onClick={() => act("forward")} className={primary}>Approve & submit to Admin</button> : <button onClick={() => act("approve")} className={primary}>Approve application</button>}</>}</div></div>}
    {application.stage === "Approved" && <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div><div className="font-bold text-emerald-800">Final Admin approval complete</div><div className="mt-1 text-xs text-emerald-700">Agreement status: {application.agreementStatus}</div></div>{application.agreementStatus === "Ready to Generate" ? <button onClick={() => act("generate")} className={primary}>Generate agreement</button> : application.agreementStatus === "Draft" ? <button onClick={() => act("issue")} className={primary}>Issue to customer</button> : null}</div>}
  </div></div>
}
