import { useEffect, useState } from "react"
import { categoryChoices } from "../lib/productCategories"
type Category = { name: string; status: string }
export default function ProductCategoryPicker({ value, onChange, readOnly = false, onBusyChange }: { value: string; onChange: (value: string) => void; readOnly?: boolean; onBusyChange: (busy: boolean) => void }) {
  const [categories, setCategories] = useState<Category[]>([]), [adding, setAdding] = useState(false), [name, setName] = useState(""), [saving, setSaving] = useState(false), [error, setError] = useState(""), [reload, setReload] = useState(0), [loading, setLoading] = useState(true)
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("")
    fetch("/api/auth/store/category-options", { credentials: "same-origin", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) }).then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error || "Unable to load store categories."); return result }).then(result => { if (!controller.signal.aborted) setCategories(result.categories) }).catch(error => { if (!controller.signal.aborted) setError(error.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [reload])
  const add = async () => {
    if (saving || readOnly) return
    const trimmed = name.trim()
    if (!trimmed || trimmed.length > 100) { setError("Enter a category name of 1–100 characters."); return }
    const existing = categories.find(row => row.name.trim().toLowerCase() === trimmed.toLowerCase())
    if (existing) {
      if (existing.status !== "Active") { setError("This category is archived. Reactivate it from Categories before using it."); return }
      onChange(existing.name); setAdding(false); setName(""); setError(""); return
    }
    setSaving(true); onBusyChange(true); setError("")
    try {
      const response = await fetch("/api/auth/store/category-options", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: trimmed, description: "", status: "Active" }), signal: AbortSignal.timeout(20000) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to save category.")
      setCategories(current => [...current, result.item]); onChange(result.item.name); setAdding(false); setName("")
      window.dispatchEvent(new Event("store-categories-changed"))
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to save category.") }
    finally { setSaving(false); onBusyChange(false) }
  }
  return <div className="space-y-2"><label className="block text-sm font-semibold" htmlFor="product-category">Category<select id="product-category" required value={value} onChange={event => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"><option value="">Select a category</option>{categoryChoices(categories, value).map(([group, names]) => <optgroup key={group} label={group}>{names.map(name => <option key={name} value={name}>{name}</option>)}</optgroup>)}</select></label>{!readOnly && <button type="button" className="text-sm font-semibold text-blue-700" disabled={loading || saving} onClick={() => { setAdding(true); setError("") }}>+ Add new category</button>}{adding && !readOnly && <div className="space-y-2 rounded-xl border border-blue-200 bg-blue-50 p-3"><label htmlFor="new-product-category" className="block text-sm font-semibold">New category name</label><input id="new-product-category" autoFocus maxLength={100} value={name} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void add() } }} className="w-full rounded-lg border border-slate-200 bg-white p-2 text-sm" /><div className="flex gap-2"><button type="button" className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => void add()} disabled={saving}>{saving ? "Saving..." : "Save category"}</button><button type="button" className="rounded-lg border bg-white px-3 py-2 text-sm" disabled={saving} onClick={() => { setAdding(false); setName(""); setError("") }}>Cancel</button></div></div>}{error && <div role="alert" className="text-sm text-red-700">{error}<button type="button" className="ml-2 underline" disabled={saving || loading} onClick={() => setReload(count => count + 1)}>Reload categories</button></div>}</div>
}
