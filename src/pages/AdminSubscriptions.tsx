import { useMemo, useState } from "react"
import { formatCurrency } from "../lib/localization"

type SubscriptionStatus = "Active" | "Expiring Soon" | "Expired" | "Past Due"
type PaymentStatus = "Paid" | "Pending" | "Failed"

type StoreSubscription = {
  id: string
  storeId: string
  store: string
  initials: string
  contact: string
  packageName: "Starter" | "Growth" | "Enterprise"
  billingCycle: "Monthly" | "Quarterly" | "Annual"
  amount: number
  status: SubscriptionStatus
  paymentStatus: PaymentStatus
  paymentMethod: string
  paymentReference: string
  subscribedAt: string
  lastPaymentAt: string
  expiresAt: string
  autoRenew: boolean
}

const SUBSCRIPTIONS: StoreSubscription[] = [
  { id: "SUB-2026-00941", storeId: "BPS-000184", store: "CYTECH Gadgets", initials: "CG", contact: "hello@cytechgadgets.com", packageName: "Enterprise", billingCycle: "Annual", amount: 7200, status: "Active", paymentStatus: "Paid", paymentMethod: "MTN Mobile Money", paymentReference: "MOMO-58204193", subscribedAt: "2026-01-15", lastPaymentAt: "2026-01-15", expiresAt: "2027-01-14", autoRenew: true },
  { id: "SUB-2026-00940", storeId: "BPS-000207", store: "Adepa Home", initials: "AH", contact: "billing@adepahome.com", packageName: "Growth", billingCycle: "Monthly", amount: 420, status: "Expiring Soon", paymentStatus: "Paid", paymentMethod: "Visa •••• 4082", paymentReference: "CARD-92018411", subscribedAt: "2026-02-04", lastPaymentAt: "2026-09-04", expiresAt: "2026-10-03", autoRenew: false },
  { id: "SUB-2026-00939", storeId: "BPS-000263", store: "PhoneHub Ghana", initials: "PG", contact: "accounts@phonehub.gh", packageName: "Growth", billingCycle: "Quarterly", amount: 1150, status: "Active", paymentStatus: "Paid", paymentMethod: "Bank transfer", paymentReference: "GCB-TRX-883104", subscribedAt: "2026-04-01", lastPaymentAt: "2026-07-01", expiresAt: "2026-09-30", autoRenew: true },
  { id: "SUB-2026-00938", storeId: "BPS-000318", store: "Kumasi Furniture Co.", initials: "KF", contact: "admin@kumasifurniture.com", packageName: "Starter", billingCycle: "Monthly", amount: 180, status: "Past Due", paymentStatus: "Failed", paymentMethod: "Telecel Cash", paymentReference: "TLC-FAILED-2918", subscribedAt: "2026-05-12", lastPaymentAt: "2026-08-12", expiresAt: "2026-09-11", autoRenew: true },
  { id: "SUB-2026-00937", storeId: "BPS-000329", store: "Glow Beauty Store", initials: "GB", contact: "hello@glowbeauty.gh", packageName: "Starter", billingCycle: "Annual", amount: 1800, status: "Active", paymentStatus: "Paid", paymentMethod: "AirtelTigo Money", paymentReference: "ATM-66301845", subscribedAt: "2026-03-20", lastPaymentAt: "2026-03-20", expiresAt: "2027-03-19", autoRenew: false },
  { id: "SUB-2026-00936", storeId: "BPS-000351", store: "AutoDrive Motors", initials: "AM", contact: "finance@autodrive.gh", packageName: "Enterprise", billingCycle: "Quarterly", amount: 1950, status: "Expiring Soon", paymentStatus: "Pending", paymentMethod: "Bank transfer", paymentReference: "PENDING-BT-2109", subscribedAt: "2026-03-30", lastPaymentAt: "2026-06-30", expiresAt: "2026-09-29", autoRenew: false },
  { id: "SUB-2026-00935", storeId: "BPS-000366", store: "Northern Appliances", initials: "NA", contact: "northern.appliances@email.com", packageName: "Growth", billingCycle: "Monthly", amount: 420, status: "Expired", paymentStatus: "Failed", paymentMethod: "MTN Mobile Money", paymentReference: "MOMO-FAILED-6012", subscribedAt: "2026-02-18", lastPaymentAt: "2026-08-18", expiresAt: "2026-09-17", autoRenew: false },
  { id: "SUB-2026-00934", storeId: "BPS-000401", store: "Campus Tech Point", initials: "CT", contact: "campustechpoint@gmail.com", packageName: "Starter", billingCycle: "Monthly", amount: 180, status: "Active", paymentStatus: "Paid", paymentMethod: "Visa •••• 7741", paymentReference: "CARD-33592018", subscribedAt: "2026-09-22", lastPaymentAt: "2026-09-22", expiresAt: "2026-10-21", autoRenew: true },
]

const tone = {
  Active: "bg-emerald-50 text-emerald-700",
  "Expiring Soon": "bg-amber-50 text-amber-700",
  Expired: "bg-slate-100 text-slate-600",
  "Past Due": "bg-red-50 text-red-700",
  Paid: "bg-emerald-50 text-emerald-700",
  Pending: "bg-amber-50 text-amber-700",
  Failed: "bg-red-50 text-red-700",
} satisfies Record<SubscriptionStatus | PaymentStatus, string>

const shortDate = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString("en-GH", { day: "2-digit", month: "short", year: "numeric" })
const monthlyValue = (subscription: StoreSubscription) => subscription.billingCycle === "Annual" ? subscription.amount / 12 : subscription.billingCycle === "Quarterly" ? subscription.amount / 3 : subscription.amount

export default function AdminSubscriptionsPage() {
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("All")
  const [packageFilter, setPackageFilter] = useState("All")
  const [paymentMethod, setPaymentMethod] = useState("All")
  const [selected, setSelected] = useState<StoreSubscription | null>(null)
  const filtered = useMemo(() => SUBSCRIPTIONS.filter((subscription) => {
    const search = `${subscription.store} ${subscription.storeId} ${subscription.id} ${subscription.paymentReference}`.toLowerCase()
    return (!query || search.includes(query.toLowerCase())) && (status === "All" || subscription.status === status) && (packageFilter === "All" || subscription.packageName === packageFilter) && (paymentMethod === "All" || subscription.paymentMethod.includes(paymentMethod))
  }), [query, status, packageFilter, paymentMethod])
  const active = SUBSCRIPTIONS.filter((item) => item.status === "Active" || item.status === "Expiring Soon")
  const monthlyRevenue = active.reduce((total, item) => total + monthlyValue(item), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><h2 className="text-2xl font-bold text-slate-950">Store Subscriptions</h2><p className="mt-1 text-sm text-slate-500">Monitor store packages, billing, payment methods, renewals, and expiration dates.</p></div>
        <div className="flex gap-2"><button className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">Export CSV</button><button className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white">Manage Packages</button></div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Total subscriptions", String(SUBSCRIPTIONS.length), "All store packages", "bg-blue-500"],
          ["Active", String(active.length), "Including expiring soon", "bg-emerald-500"],
          ["Monthly recurring revenue", formatCurrency(monthlyRevenue), "Normalized billing value", "bg-violet-500"],
          ["Expiring soon", String(SUBSCRIPTIONS.filter((item) => item.status === "Expiring Soon").length), "Requires renewal follow-up", "bg-amber-500"],
          ["Payment issues", String(SUBSCRIPTIONS.filter((item) => item.paymentStatus === "Failed").length), "Failed or past due", "bg-red-500"],
        ].map(([label, value, detail, dotClass]) => <div key={label} className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-500">{label}</span><span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} /></div><div className="mt-3 text-2xl font-black text-slate-950">{value}</div><div className="mt-1 text-xs text-slate-400">{detail}</div></div>)}
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-100 p-4 lg:grid-cols-[1fr_180px_160px_200px]">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search store, subscription or payment reference" className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500" />
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option>All</option><option>Active</option><option>Expiring Soon</option><option>Past Due</option><option>Expired</option></select>
          <select value={packageFilter} onChange={(event) => setPackageFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option>All</option><option>Starter</option><option>Growth</option><option>Enterprise</option></select>
          <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option>All</option><option>Mobile Money</option><option>Visa</option><option>Bank transfer</option><option>Telecel Cash</option><option>AirtelTigo Money</option></select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Store", "Package", "Payment", "Mode of payment", "Subscription date", "Expiration date", "Status", "Action"].map((label) => <th key={label} className="px-5 py-4">{label}</th>)}</tr></thead>
            <tbody>{filtered.map((subscription) => <tr key={subscription.id} className="border-t border-slate-100 hover:bg-slate-50/70"><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 font-black text-blue-700">{subscription.initials}</div><div><div className="font-bold text-slate-950">{subscription.store}</div><div className="text-xs text-slate-400">{subscription.storeId} · {subscription.id}</div></div></div></td><td className="px-5 py-4"><div className="font-bold">{subscription.packageName}</div><div className="text-xs text-slate-500">{subscription.billingCycle}</div></td><td className="px-5 py-4"><div className="font-bold">{formatCurrency(subscription.amount)}</div><span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${tone[subscription.paymentStatus]}`}>{subscription.paymentStatus}</span></td><td className="px-5 py-4"><div className="font-semibold">{subscription.paymentMethod}</div><div className="text-xs text-slate-400">{subscription.paymentReference}</div></td><td className="px-5 py-4">{shortDate(subscription.subscribedAt)}</td><td className="px-5 py-4"><div className={subscription.status === "Expiring Soon" || subscription.status === "Past Due" ? "font-bold text-amber-700" : ""}>{shortDate(subscription.expiresAt)}</div><div className="text-xs text-slate-400">Auto-renew {subscription.autoRenew ? "on" : "off"}</div></td><td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${tone[subscription.status]}`}>{subscription.status}</span></td><td className="px-5 py-4"><button onClick={() => setSelected(subscription)} className="font-bold text-blue-600">View details</button></td></tr>)}</tbody>
          </table>
          {filtered.length === 0 && <div className="p-12 text-center text-sm text-slate-500">No subscriptions match the selected filters.</div>}
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-xs text-slate-500"><span>Showing {filtered.length} of {SUBSCRIPTIONS.length} subscriptions</span><span>Last updated: just now</span></div>
      </div>
      {selected && <SubscriptionDetails subscription={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function SubscriptionDetails({ subscription, onClose }: { subscription: StoreSubscription; onClose: () => void }) {
  const payments = [
    { date: subscription.lastPaymentAt, amount: subscription.amount, status: subscription.paymentStatus, reference: subscription.paymentReference },
    { date: subscription.subscribedAt, amount: subscription.amount, status: "Paid" as PaymentStatus, reference: `INITIAL-${subscription.id.slice(-5)}` },
  ]
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"><button className="absolute inset-0" onClick={onClose} aria-label="Close subscription details" /><div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 font-black text-blue-700">{subscription.initials}</div><div><h3 className="text-xl font-bold">{subscription.store}</h3><p className="text-xs text-slate-500">{subscription.storeId} · {subscription.contact}</p></div></div><button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-xl text-slate-500">×</button></div><div className="mt-6 rounded-[22px] bg-slate-950 p-5 text-white"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-xs font-bold uppercase tracking-wide text-slate-400">Current package</div><div className="mt-1 text-2xl font-black">{subscription.packageName}</div></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${tone[subscription.status]}`}>{subscription.status}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><div><div className="text-xs text-slate-400">Billing</div><div className="mt-1 font-bold">{subscription.billingCycle}</div></div><div><div className="text-xs text-slate-400">Amount</div><div className="mt-1 font-bold">{formatCurrency(subscription.amount)}</div></div><div><div className="text-xs text-slate-400">Auto-renewal</div><div className="mt-1 font-bold">{subscription.autoRenew ? "Enabled" : "Disabled"}</div></div></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Subscribed", shortDate(subscription.subscribedAt)], ["Last payment", shortDate(subscription.lastPaymentAt)], ["Expires", shortDate(subscription.expiresAt)], ["Payment method", subscription.paymentMethod]].map(([label, value]) => <div key={label} className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-semibold text-slate-400">{label}</div><div className="mt-2 text-sm font-bold">{value}</div></div>)}</div><div className="mt-7"><h4 className="font-bold">Payment history</h4><div className="mt-3 overflow-hidden rounded-2xl border border-slate-200"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.reference} className="border-t border-slate-100"><td className="px-4 py-3">{shortDate(payment.date)}</td><td className="px-4 py-3 font-mono text-xs">{payment.reference}</td><td className="px-4 py-3 font-bold">{formatCurrency(payment.amount)}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${tone[payment.status]}`}>{payment.status}</span></td></tr>)}</tbody></table></div></div><div className="mt-6 flex flex-wrap justify-end gap-3"><button className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">Send renewal reminder</button><button className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white">View store account</button></div></div></div>
}
