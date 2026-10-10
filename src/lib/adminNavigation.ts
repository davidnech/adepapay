export const adminPages = ["traffic", "dashboard", "store-approvals", "stores", "subscriptions", "customers", "products", "categories", "applications", "swap-overview", "active-purchases", "layaway-plans", "collection-agents", "agent-settlements", "transactions", "reports", "notifications", "settings", "audit-logs", "support"] as const
export type AdminPage = typeof adminPages[number]
export type AdminRoute = { page: AdminPage; record: string; query: string }
export const isAdminPage = (value: string): value is AdminPage => (adminPages as readonly string[]).includes(value)
export function parseAdminRoute(hash: string): AdminRoute {
  const store = /^#admin-store\/([0-9a-f-]{36})$/i.exec(hash)
  if (store) return { page: "stores", record: store[1], query: "" }
  if (hash === "#admin-stores") return { page: "stores", record: "", query: "" }
  const match = /^#admin\/([^?]+)(?:\?(.*))?$/.exec(hash)
  if (!match || !isAdminPage(match[1])) return { page: "dashboard", record: "", query: "" }
  const params = new URLSearchParams(match[2] || "")
  return { page: match[1], record: (params.get("record") || "").slice(0, 200), query: (params.get("q") || "").slice(0, 200) }
}
export function adminHref(page: AdminPage, record = "", query = "") {
  if (page === "stores" && /^[0-9a-f-]{36}$/i.test(record)) return `#admin-store/${record}`
  const params = new URLSearchParams()
  if (record) params.set("record", record)
  if (query) params.set("q", query)
  return `#admin/${page}${params.size ? `?${params}` : ""}`
}
