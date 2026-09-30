import { useMemo, useState, type FormEvent } from "react"
import {
  isCampaignActive,
  loadPromotionSettings,
  savePromotionSettings,
  type StorePromoCode,
  type StorePromotion,
  type StorePromotionSettings,
} from "../lib/promotions"

const PRODUCTS = [
  { id: 1, name: "iPhone 15 Pro Max 256GB", category: "Phones" },
  { id: 2, name: 'MacBook Pro 14" M3 Pro', category: "Laptops" },
  { id: 3, name: "Samsung Galaxy S25 Ultra", category: "Phones" },
  { id: 4, name: 'Samsung 65" Neo QLED 4K', category: "Electronics" },
  { id: 5, name: "Dell XPS 15 Intel i9", category: "Laptops" },
  { id: 6, name: "Sony WH-1000XM5 Headphones", category: "Accessories" },
  { id: 7, name: 'iPad Pro 12.9" M2 512GB', category: "Tablets" },
  { id: 8, name: "Dyson V15 Detect Vacuum", category: "Smart Home" },
  { id: 9, name: "Apple Watch Series 9 GPS", category: "Accessories" },
]
const CATEGORIES = [...new Set(PRODUCTS.map((product) => product.category))]
const inputClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange} className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-blue-600" : "bg-slate-300"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? "left-6" : "left-1"}`} /></button>
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-bold text-slate-600">{children}</span>
}

export default function StorePromotionsPage({ storeId = "cytech-gadgets" }: { storeId?: string }) {
  const [settings, setSettings] = useState<StorePromotionSettings>(() => loadPromotionSettings(storeId))
  const [tab, setTab] = useState<"campaigns" | "codes">("campaigns")
  const [campaignModal, setCampaignModal] = useState(false)
  const [codeModal, setCodeModal] = useState(false)
  const [notice, setNotice] = useState("")

  const persist = (next: StorePromotionSettings, message?: string) => {
    setSettings(next)
    savePromotionSettings(next)
    if (message) {
      setNotice(message)
      window.setTimeout(() => setNotice(""), 3000)
    }
  }
  const activeCampaigns = settings.campaigns.filter((campaign) => isCampaignActive(campaign)).length
  const activeCodes = settings.codes.filter((code) => code.enabled && code.usedCount < code.usageLimit && new Date(`${code.expiresAt}T23:59:59`) >= new Date()).length
  const totalRedemptions = settings.codes.reduce((sum, code) => sum + code.usedCount, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><h2 className="text-2xl font-bold text-slate-950">Promotions & Promo Codes</h2><p className="mt-1 text-sm text-slate-500">Launch discounts, control where they appear, and create codes customers can redeem.</p></div>
        <div className="flex gap-2"><button onClick={() => setCodeModal(true)} className="rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-700">Generate code</button><button onClick={() => setCampaignModal(true)} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20">+ New promotion</button></div>
      </div>

      {notice && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-700">{notice}</div>}

      <div className="rounded-[24px] bg-gradient-to-r from-blue-950 via-blue-800 to-blue-600 p-5 text-white shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${settings.publicPromotionsEnabled ? "bg-emerald-400" : "bg-slate-400"}`} /><h3 className="font-bold">Public promotions</h3></div><p className="mt-1 text-sm text-blue-100">Show active discounts and promo-code redemption on your public store products.</p></div><div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3"><span className="text-sm font-semibold">{settings.publicPromotionsEnabled ? "Visible to customers" : "Hidden from customers"}</span><Toggle label="Toggle public promotions" checked={settings.publicPromotionsEnabled} onChange={() => persist({ ...settings, publicPromotionsEnabled: !settings.publicPromotionsEnabled }, settings.publicPromotionsEnabled ? "Promotions hidden from the public store." : "Promotions are now live on the public store.")} /></div></div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[["Active promotions", activeCampaigns, "Live product discounts"], ["Active promo codes", activeCodes, "Ready to redeem"], ["Code redemptions", totalRedemptions, "Across all codes"]].map(([label, value, detail]) => <div key={label} className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm font-semibold text-slate-500">{label}</div><div className="mt-2 text-3xl font-black text-slate-950">{value}</div><div className="mt-1 text-xs text-slate-400">{detail}</div></div>)}
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <div className="flex gap-1 border-b border-slate-100 p-2">{(["campaigns", "codes"] as const).map((item) => <button key={item} onClick={() => setTab(item)} className={`rounded-xl px-4 py-2.5 text-sm font-bold capitalize ${tab === item ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50"}`}>{item === "campaigns" ? "Product promotions" : "Promo codes"}</button>)}</div>
        {tab === "campaigns" ? (
          <div className="divide-y divide-slate-100">
            {settings.campaigns.length === 0 ? <EmptyState title="No promotions yet" action="Create your first promotion" onClick={() => setCampaignModal(true)} /> : settings.campaigns.map((campaign) => {
              const active = isCampaignActive(campaign)
              return <div key={campaign.id} className="p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-start gap-4"><div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-black ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{campaign.discountPercent}%</div><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-950">{campaign.name}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${active ? "bg-emerald-50 text-emerald-700" : campaign.enabled ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{active ? "LIVE" : campaign.enabled ? "SCHEDULED / ENDED" : "PAUSED"}</span></div><p className="mt-1 text-sm text-slate-500">{campaign.description}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400"><span>{campaign.scope}{campaign.scope === "Category" && `: ${campaign.categories.join(", ")}`}</span><span>{campaign.startsAt} → {campaign.endsAt}</span></div></div></div><div className="flex items-center gap-3 self-end lg:self-auto"><Toggle label={`Toggle ${campaign.name}`} checked={campaign.enabled} onChange={() => persist({ ...settings, campaigns: settings.campaigns.map((item) => item.id === campaign.id ? { ...item, enabled: !item.enabled } : item) }, `${campaign.name} ${campaign.enabled ? "paused" : "enabled"}.`)} /><button onClick={() => persist({ ...settings, campaigns: settings.campaigns.filter((item) => item.id !== campaign.id) }, "Promotion deleted.")} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-red-600">Delete</button></div></div></div>
            })}
          </div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Code", "Offer", "Minimum spend", "Usage", "Expires", "Status", "Actions"].map((label) => <th key={label} className="px-5 py-4">{label}</th>)}</tr></thead><tbody>{settings.codes.map((code) => <tr key={code.id} className="border-t border-slate-100"><td className="px-5 py-4"><button onClick={() => navigator.clipboard?.writeText(code.code)} title="Copy promo code" className="rounded-lg border border-dashed border-blue-300 bg-blue-50 px-3 py-2 font-mono font-black tracking-wider text-blue-700">{code.code}</button><div className="mt-1 text-[10px] text-slate-400">Click to copy</div></td><td className="px-5 py-4"><div className="font-bold">{code.discountPercent}% off</div><div className="text-xs text-slate-500">{code.description}</div></td><td className="px-5 py-4">{code.minimumSpend.toLocaleString()}</td><td className="px-5 py-4"><div className="font-semibold">{code.usedCount} / {code.usageLimit}</div><div className="mt-1 h-1.5 w-24 rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, code.usedCount / code.usageLimit * 100)}%` }} /></div></td><td className="px-5 py-4">{code.expiresAt}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${code.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{code.enabled ? "Active" : "Paused"}</span></td><td className="px-5 py-4"><div className="flex items-center gap-3"><Toggle label={`Toggle ${code.code}`} checked={code.enabled} onChange={() => persist({ ...settings, codes: settings.codes.map((item) => item.id === code.id ? { ...item, enabled: !item.enabled } : item) })} /><button onClick={() => persist({ ...settings, codes: settings.codes.filter((item) => item.id !== code.id) }, "Promo code deleted.")} className="text-xs font-bold text-red-600">Delete</button></div></td></tr>)}</tbody></table>{settings.codes.length === 0 && <EmptyState title="No promo codes yet" action="Generate a promo code" onClick={() => setCodeModal(true)} />}</div>
        )}
      </div>
      {campaignModal && <CampaignModal storeId={settings.storeId} onClose={() => setCampaignModal(false)} onSave={(campaign) => { persist({ ...settings, campaigns: [campaign, ...settings.campaigns] }, "Promotion created and published."); setCampaignModal(false) }} />}
      {codeModal && <CodeModal storeId={settings.storeId} onClose={() => setCodeModal(false)} onSave={(code) => { persist({ ...settings, codes: [code, ...settings.codes] }, `Promo code ${code.code} created.`); setCodeModal(false) }} existingCodes={settings.codes.map((code) => code.code)} />}
    </div>
  )
}

function EmptyState({ title, action, onClick }: { title: string; action: string; onClick: () => void }) {
  return <div className="p-12 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl">%</div><h3 className="mt-3 font-bold">{title}</h3><button onClick={onClick} className="mt-3 text-sm font-bold text-blue-600">{action} →</button></div>
}

function CampaignModal({ storeId, onClose, onSave }: { storeId: string; onClose: () => void; onSave: (campaign: StorePromotion) => void }) {
  const [form, setForm] = useState({ name: "", description: "", discountPercent: "", scope: "All products" as StorePromotion["scope"], startsAt: new Date().toISOString().slice(0, 10), endsAt: "2026-12-31" })
  const [categories, setCategories] = useState<string[]>([])
  const [productIds, setProductIds] = useState<number[]>([])
  const [error, setError] = useState("")
  const previewCount = useMemo(() => form.scope === "All products" ? PRODUCTS.length : form.scope === "Category" ? PRODUCTS.filter((product) => categories.includes(product.category)).length : productIds.length, [form.scope, categories, productIds])
  const submit = (event: FormEvent) => { event.preventDefault(); const discount = Number(form.discountPercent); if (!form.name.trim() || discount < 1 || discount > 90 || !form.startsAt || !form.endsAt) return setError("Complete all required fields. Discount must be between 1% and 90%."); if (form.endsAt < form.startsAt) return setError("End date must be after the start date."); if (form.scope === "Category" && !categories.length) return setError("Select at least one category."); if (form.scope === "Selected products" && !productIds.length) return setError("Select at least one product."); onSave({ id: `campaign-${Date.now()}`, storeId, name: form.name.trim(), description: form.description.trim() || `${discount}% off for a limited time.`, discountPercent: discount, scope: form.scope, categories, productIds, startsAt: form.startsAt, endsAt: form.endsAt, enabled: true }) }
  return <Modal title="Create product promotion" description="Discount eligible products automatically on your public store." onClose={onClose}><form onSubmit={submit} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2"><FieldLabel>Promotion name *</FieldLabel><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Weekend Tech Sale" className={inputClass} /></label><label className="sm:col-span-2"><FieldLabel>Customer-facing message</FieldLabel><input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Short message shown on public products" className={inputClass} /></label><label><FieldLabel>Percentage discount *</FieldLabel><div className="relative"><input type="number" min="1" max="90" value={form.discountPercent} onChange={(event) => setForm({ ...form, discountPercent: event.target.value })} className={inputClass} /><span className="absolute right-4 top-5 text-sm font-bold text-slate-400">%</span></div></label><label><FieldLabel>Applies to *</FieldLabel><select value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value as StorePromotion["scope"] })} className={inputClass}><option>All products</option><option>Category</option><option>Selected products</option></select></label><label><FieldLabel>Starts *</FieldLabel><input type="date" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} className={inputClass} /></label><label><FieldLabel>Ends *</FieldLabel><input type="date" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} className={inputClass} /></label></div>{form.scope === "Category" && <ChoiceGrid items={CATEGORIES.map((category) => ({ id: category, label: category }))} selected={categories} onToggle={(id) => setCategories((items) => items.includes(id as string) ? items.filter((item) => item !== id) : [...items, id as string])} />}{form.scope === "Selected products" && <ChoiceGrid items={PRODUCTS.map((product) => ({ id: product.id, label: product.name }))} selected={productIds} onToggle={(id) => setProductIds((items) => items.includes(id as number) ? items.filter((item) => item !== id) : [...items, id as number])} />}<div className="rounded-2xl bg-blue-50 p-4 text-sm text-blue-800"><b>{previewCount} product{previewCount === 1 ? "" : "s"}</b> will display this offer when it is active.</div>{error && <div className="text-sm font-semibold text-red-600">{error}</div>}<ModalActions onClose={onClose} submit="Publish promotion" /></form></Modal>
}

function CodeModal({ storeId, onClose, onSave, existingCodes }: { storeId: string; onClose: () => void; onSave: (code: StorePromoCode) => void; existingCodes: string[] }) {
  const makeCode = () => `CYTECH${Math.random().toString(36).slice(2, 7).toUpperCase()}`
  const [form, setForm] = useState({ code: makeCode(), description: "Customer discount", discountPercent: "10", minimumSpend: "0", usageLimit: "100", expiresAt: "2026-12-31" })
  const [error, setError] = useState("")
  const submit = (event: FormEvent) => { event.preventDefault(); const normalized = form.code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, ""); const discount = Number(form.discountPercent); if (normalized.length < 4 || existingCodes.includes(normalized)) return setError("Use a unique code with at least 4 characters."); if (discount < 1 || discount > 90 || Number(form.usageLimit) < 1 || !form.expiresAt) return setError("Enter a discount from 1–90%, an expiry date, and a valid usage limit."); onSave({ id: `code-${Date.now()}`, storeId, code: normalized, description: form.description.trim() || "Customer discount", discountPercent: discount, minimumSpend: Math.max(0, Number(form.minimumSpend)), usageLimit: Number(form.usageLimit), usedCount: 0, expiresAt: form.expiresAt, enabled: true }) }
  return <Modal title="Generate promo code" description="Create a unique code customers can redeem on your products." onClose={onClose}><form onSubmit={submit} className="space-y-5"><label><FieldLabel>Promo code *</FieldLabel><div className="flex gap-2"><input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} className={`${inputClass} font-mono font-black uppercase tracking-wider`} /><button type="button" onClick={() => setForm({ ...form, code: makeCode() })} className="mt-1.5 rounded-xl border border-slate-200 px-4 text-xs font-bold text-blue-600">Regenerate</button></div></label><label><FieldLabel>Internal description</FieldLabel><input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={inputClass} /></label><div className="grid gap-4 sm:grid-cols-2"><label><FieldLabel>Discount percentage *</FieldLabel><input type="number" min="1" max="90" value={form.discountPercent} onChange={(event) => setForm({ ...form, discountPercent: event.target.value })} className={inputClass} /></label><label><FieldLabel>Minimum spend</FieldLabel><input type="number" min="0" value={form.minimumSpend} onChange={(event) => setForm({ ...form, minimumSpend: event.target.value })} className={inputClass} /></label><label><FieldLabel>Usage limit *</FieldLabel><input type="number" min="1" value={form.usageLimit} onChange={(event) => setForm({ ...form, usageLimit: event.target.value })} className={inputClass} /></label><label><FieldLabel>Expiry date *</FieldLabel><input type="date" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} className={inputClass} /></label></div>{error && <div className="text-sm font-semibold text-red-600">{error}</div>}<ModalActions onClose={onClose} submit="Create promo code" /></form></Modal>
}

function ChoiceGrid({ items, selected, onToggle }: { items: { id: string | number; label: string }[]; selected: (string | number)[]; onToggle: (id: string | number) => void }) {
  return <div><FieldLabel>Select eligibility *</FieldLabel><div className="mt-2 grid max-h-44 gap-2 overflow-y-auto rounded-2xl border border-slate-200 p-3 sm:grid-cols-2">{items.map((item) => <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded-xl p-2 text-sm hover:bg-slate-50"><input type="checkbox" checked={selected.includes(item.id)} onChange={() => onToggle(item.id)} className="accent-blue-600" />{item.label}</label>)}</div></div>
}

function Modal({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"><button className="absolute inset-0" onClick={onClose} aria-label="Close dialog" /><div role="dialog" aria-modal="true" className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl sm:p-8"><div className="mb-6 flex items-start justify-between"><div><h3 className="text-xl font-bold text-slate-950">{title}</h3><p className="mt-1 text-sm text-slate-500">{description}</p></div><button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-xl text-slate-500">×</button></div>{children}</div></div>
}

function ModalActions({ onClose, submit }: { onClose: () => void; submit: string }) {
  return <div className="flex justify-end gap-3 border-t border-slate-100 pt-5"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button type="submit" className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white">{submit}</button></div>
}
