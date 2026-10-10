export type Portal = "customer" | "store"
export type PortalRoute = { page: string; record: string; query: string }
export const portalPages: Record<Portal, readonly string[]> = {
  customer: ["dashboard", "stores", "products", "my-applications", "my-swaps", "swap-application", "hire-purchase-application", "layaway-plans", "my-purchases", "my-payment-plans", "payment-history", "receipts", "notifications", "profile", "settings", "support"],
  store: ["dashboard", "subscriptions", "store-profile", "store-settings", "team-access", "shop-rules", "products", "promotions", "categories", "customers", "applications", "swap-management", "trade-in-inventory", "active-purchases", "layaway-plans", "collection-agents", "agent-settlements", "payments", "reports", "notifications", "support"],
}
export function portalHref(portal: Portal, page: string, record = "", query = "") {
  const params = new URLSearchParams()
  if (record) params.set("record", record)
  if (query) params.set("q", query)
  return `#${portal}/${portalPages[portal].includes(page) ? page : "dashboard"}${params.size ? `?${params}` : ""}`
}
export function parsePortalRoute(hash: string, portal: Portal, allowed: readonly string[] = portalPages[portal]): PortalRoute {
  const match = new RegExp(`^#${portal}/([^?]+)(?:\\?(.*))?$`).exec(hash)
  const page = match?.[1] === "swap-settings" && portal === "store" ? "products" : match?.[1]
  if (!page || !portalPages[portal].includes(page) || !allowed.includes(page)) return { page: allowed.find(page => portalPages[portal].includes(page)) || "dashboard", record: "", query: "" }
  const params = new URLSearchParams(match?.[2] || "")
  return { page, record: (params.get("record") || "").slice(0, 200), query: (params.get("q") || "").slice(0, 200) }
}
