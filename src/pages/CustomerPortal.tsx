import PortalSearch from "../components/PortalSearch";
import StoreAgentAccounts from "./StoreAgentAccounts";
import { parsePortalRoute, portalHref, portalPages, type PortalRoute, type Portal } from "../lib/portalNavigation";
import AdminHome from "./AdminHome";
import AdminSearch from "../components/AdminSearch";
import AdminConnectionStatus from "../components/AdminConnectionStatus";
import { parseAdminRoute, adminHref, isAdminPage, type AdminRoute } from "../lib/adminNavigation";
import AdminOperations, { type AdminOperation } from "./AdminOperations";
import AdminPlatform, { type AdminPlatformPage } from "./AdminPlatform";
import SupportInbox from "./SupportInbox";
import AdminTraffic from './AdminTraffic';
import StoreNotifications from './StoreNotifications';
import StoreReports from './StoreReports';
import ApplicationWorkspace from './ApplicationWorkspace';
import CustomerAccount from './CustomerAccount';
import Marketplace from './Marketplace';
import StoreFieldAgentsPage from './StoreAgents';
import StoreCataloguePage from './StoreCatalogue';
import ConnectedStoreProducts from './StoreProducts';
import ConnectedStoreRules from './StoreRules';
import ConnectedStoreTeam from './StoreTeam';
import ConnectedStoreSettings from './StoreSettings';
import AdminStoresPage from './AdminStores';
import ConnectedStoreProfile from './StoreProfile';
import { useEffect, useState, type ReactNode } from "react";
import StorePromotionsPage from "./StorePromotions";
import AdminSubscriptionsPage from "./AdminSubscriptions";
import StoreBilling from "./StoreBilling";
import StoreOnboardingApprovalsPage from "./StoreOnboardingApprovals";


type DashboardState = "normal" | "loading" | "empty" | "error" | "restricted"
type NavId = "traffic" | "dashboard" | "store-approvals" | "stores" | "subscriptions" | "customers" | "products" | "promotions" | "categories" | "transactions" | "reports" | "notifications" | "settings" | "audit-logs" | "support" | "layaway-plans" | "my-payment-plans" | "collection-agents" | "agent-settlements" | "my-applications" | "hire-purchase-application" | "my-purchases" | "payment-history" | "receipts" | "profile" | "store-profile" | "store-settings" | "team-access" | "shop-rules" | "applications" | "active-purchases" | "payments" | "my-swaps" | "swap-application" | "swap-management" | "swap-settings" | "trade-in-inventory" | "swap-overview" | "logout"

type NavItem = {
  id: NavId
  label: string
  short: string
  icon: ReactNode
  count?: number
  countLabel?: string
}

type ApprovalTab = "all" | "new" | "under-review" | "documents" | "approved" | "rejected" | "suspended" | "expired"
type StoreTab = "all" | "active" | "pending" | "suspended" | "restricted" | "inactive" | "closed"
type CustomerTab = "all" | "active" | "verified" | "pending" | "overdue" | "restricted" | "suspended" | "closed"
type TransactionTab = "all" | "customer-payments" | "store-settlements" | "pending" | "failed" | "refunded" | "reversed" | "offline" | "flagged"

const ADMIN_NAV_ITEMS: NavItem[] = [
  { id: "traffic", label: "Website Traffic", short: "Traffic", icon: <IconChart /> },
  { id: "dashboard", label: "Dashboard", short: "Home", icon: <IconGrid /> },
  {
    id: "store-approvals",
    label: "Store Approvals",
    short: "Approvals",
    icon: <IconCheckCircle />,
  },
  { id: "stores", label: "Stores", short: "Stores", icon: <IconStore /> },
  {
    id: "subscriptions",
    label: "Store Subscriptions",
    short: "Plans",
    icon: <IconWallet />,
  },
  {
    id: "customers",
    label: "Customers",
    short: "Customers",
    icon: <IconUsers />,
  },
  { id: "products", label: "Products", short: "Products", icon: <IconBox /> },
  {
    id: "categories",
    label: "Categories",
    short: "Categories",
    icon: <IconLayers />,
  },
  {
    id: "applications",
    label: "Store Applications",
    short: "Applications",
    icon: <IconFile />,
  },
  {
    id: "swap-overview",
    label: "Swap Overview",
    short: "Swaps",
    icon: <IconArchive />,
  },
  {
    id: "active-purchases",
    label: "Active Purchases",
    short: "Purchases",
    icon: <IconBag />,
  },
  {
    id: "layaway-plans",
    label: "Layaway Plans",
    short: "Layaway",
    icon: <IconArchive />,
  },
  {
    id: "collection-agents",
    label: "Collection Agents",
    short: "Agents",
    icon: <IconUsers />,
  },
  {
    id: "agent-settlements",
    label: "Agent Settlements",
    short: "Settlements",
    icon: <IconWallet />,
  },
  {
    id: "transactions",
    label: "Transactions",
    short: "Payments",
    icon: <IconWallet />,
  },
  { id: "reports", label: "Reports", short: "Reports", icon: <IconChart /> },
  {
    id: "notifications",
    label: "Notifications",
    short: "Alerts",
    icon: <IconBell />,
  },
  { id: "settings", label: "Settings", short: "Settings", icon: <IconCog /> },
  { id: "audit-logs", label: "Audit Logs", short: "Audit", icon: <IconFile /> },
  {
    id: "support",
    label: "Help and Support",
    short: "More",
    icon: <IconHelp />,
  },
  { id: "logout", label: "Logout", short: "Logout", icon: <IconLogout /> },
]

const CUSTOMER_NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", short: "Home", icon: <IconGrid /> },
  {
    id: "stores",
    label: "Browse Stores",
    short: "Stores",
    icon: <IconStore />,
  },
  {
    id: "products",
    label: "Browse Products",
    short: "Products",
    icon: <IconBox />,
  },
  {
    id: "my-applications",
    label: "My Applications",
    short: "Applications",
    icon: <IconFile />,
  },
  {
    id: "my-swaps",
    label: "My Swaps",
    short: "Swaps",
    icon: <IconArchive />,
  },
  {
    id: "hire-purchase-application",
    label: "Hire Purchase Application",
    short: "Apply",
    icon: <IconCheckCircle />,
  },
  {
    id: "layaway-plans",
    label: "Layaway",
    short: "Layaway",
    icon: <IconArchive />,
  },
  {
    id: "my-purchases",
    label: "My Purchases",
    short: "Purchases",
    icon: <IconBag />,
  },
  {
    id: "my-payment-plans",
    label: "My Payment Plans",
    short: "Plans",
    icon: <IconWallet />,
  },
  {
    id: "payment-history",
    label: "Payment History",
    short: "Payments",
    icon: <IconWallet />,
  },
  { id: "receipts", label: "Receipts", short: "Receipts", icon: <IconFile /> },
  {
    id: "notifications",
    label: "Notifications",
    short: "Alerts",
    icon: <IconBell />,
  },
  { id: "profile", label: "Profile", short: "Profile", icon: <IconUsers /> },
  { id: "settings", label: "Settings", short: "Settings", icon: <IconCog /> },
  { id: "support", label: "Help & Support", short: "Support", icon: <IconHelp /> },
  { id: "logout", label: "Logout", short: "Logout", icon: <IconLogout /> },
]

const STORE_MANAGER_NAV_ITEMS: NavItem[] = [
  { id: "subscriptions", label: "Subscription", short: "Billing", icon: <IconFile /> },
  { id: "dashboard", label: "Dashboard", short: "Home", icon: <IconGrid /> },
  {
    id: "store-profile",
    label: "Store Profile",
    short: "Profile",
    icon: <IconStore />,
  },
  {
    id: "store-settings",
    label: "Store Settings",
    short: "Settings",
    icon: <IconCog />,
  },
  {
    id: "team-access",
    label: "Roles & Users",
    short: "Team",
    icon: <IconLock />,
  },
  {
    id: "shop-rules",
    label: "Shop Rules & Terms",
    short: "Rules",
    icon: <IconFile />,
  },
  { id: "products", label: "Products", short: "Products", icon: <IconBox /> },
  {
    id: "promotions",
    label: "Promotions & Codes",
    short: "Promos",
    icon: <IconChart />,
  },
  {
    id: "categories",
    label: "Categories",
    short: "Categories",
    icon: <IconLayers />,
  },
  {
    id: "customers",
    label: "Customers",
    short: "Customers",
    icon: <IconUsers />,
  },
  {
    id: "applications",
    label: "Customer Applications",
    short: "Applications",
    icon: <IconFile />,
  },
  {
    id: "swap-management",
    label: "Swap Management",
    short: "Swaps",
    icon: <IconArchive />,
  },
  {
    id: "trade-in-inventory",
    label: "Trade-in Inventory",
    short: "Inventory",
    icon: <IconBox />,
  },
  {
    id: "active-purchases",
    label: "Active Purchases",
    short: "Purchases",
    icon: <IconBag />,
  },
  {
    id: "layaway-plans",
    label: "Layaway Plans",
    short: "Layaway",
    icon: <IconArchive />,
  },
  {
    id: "collection-agents",
    label: "Field Agents",
    short: "Agents",
    icon: <IconUsers />,
  },
  {
    id: "agent-settlements",
    label: "Agent Accounts",
    short: "Settlements",
    icon: <IconWallet />,
  },
  {
    id: "payments",
    label: "Payments",
    short: "Payments",
    icon: <IconWallet />,
  },
  { id: "reports", label: "Reports", short: "Reports", icon: <IconChart /> },
  {
    id: "notifications",
    label: "Notifications",
    short: "Alerts",
    icon: <IconBell />,
  },
  {
    id: "support",
    label: "Help and Support",
    short: "More",
    icon: <IconHelp />,
  },
  { id: "logout", label: "Logout", short: "Logout", icon: <IconLogout /> },
]

export default function CustomerPortal({
  role = "Admin",
  staff = false, permissions = [], displayName, roleTitle, storeName,
  storeId = "",
  onLogout,
  onBrowseStores,
  onBrowseProducts,
}: {
  role?: "Customer" | "Store Manager" | "Admin"
  staff?: boolean
  permissions?: string[]
  displayName?: string
  roleTitle?: string
  storeName?: string
  storeId?: string
  onLogout?: () => void
  onBrowseStores?: () => void
  onBrowseProducts?: () => void
}) {
  const portal: Portal = role === "Store Manager" ? "store" : "customer"
  const [portalRoute, setPortalRoute] = useState<PortalRoute>(() => parsePortalRoute(window.location.hash, portal, staff ? permissions : portalPages[portal]))
  const [activeNav, setActiveNavState] = useState<NavId>(() => role === "Admin" ? parseAdminRoute(window.location.hash).page : parsePortalRoute(window.location.hash, portal, staff ? permissions : portalPages[portal]).page as NavId)
  const [adminRoute, setAdminRoute] = useState<AdminRoute>(() => parseAdminRoute(window.location.hash))
  const setActiveNav = (id: NavId) => {
    if (role === "Admin" && isAdminPage(id)) {
      window.location.hash = adminHref(id)
      setAdminRoute({ page: id, record: "", query: "" })
    }
    if (role !== "Admin" && portalPages[portal].includes(id)) { window.location.hash = portalHref(portal, id); setPortalRoute({ page: id, record: "", query: "" }) }
    setActiveNavState(id)
  }
  const navigatePortal = (page: string, record = "") => { if (portalPages[portal].includes(page) && (!staff || permissions.includes(page))) window.location.hash = portalHref(portal, page, record) }
  const portalProps = { initialRecord: portalRoute.record, initialQuery: portalRoute.query, onRecordChange: (record: string) => { window.location.hash = portalHref(portal, activeNav, record, portalRoute.query) } }
  useEffect(() => {
    if (role === "Admin") return
    const sync = () => { const route = parsePortalRoute(window.location.hash, portal, staff ? permissions : portalPages[portal]); setPortalRoute(route); setActiveNavState(route.page as NavId); setDrawerOpen(false) }
    window.addEventListener("hashchange", sync); sync()
    return () => window.removeEventListener("hashchange", sync)
  }, [role, portal, staff, permissions.join(",")])
  useEffect(() => {
    if (role !== "Admin") return
    const sync = () => { const route = parseAdminRoute(window.location.hash); setAdminRoute(route); setActiveNavState(route.page); setDrawerOpen(false) }
    window.addEventListener("hashchange", sync)
    sync()
    return () => window.removeEventListener("hashchange", sync)
  }, [role])
  const [pendingStoreCount, setPendingStoreCount] = useState<number | undefined>()
  const [storeUnreadCount, setStoreUnreadCount] = useState<number | undefined>()
  const [customerUnreadCount, setCustomerUnreadCount] = useState<number | undefined>()
  useEffect(() => {
    if (role !== "Customer") return
    const controller = new AbortController(); let loading = false
    const refresh = async () => {
      if (loading || document.hidden) return
      loading = true
      try { const response = await fetch("/api/auth/customer/notifications", { credentials: "same-origin", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]) }); if (!response.ok) throw new Error(); const result = await response.json(); if (!controller.signal.aborted) setCustomerUnreadCount(Number.isInteger(result.unread) ? result.unread : undefined) } catch { if (!controller.signal.aborted) setCustomerUnreadCount(undefined) } finally { loading = false }
    }
    void refresh(); const timer = window.setInterval(refresh, 60000); window.addEventListener("focus", refresh); window.addEventListener("customer-notifications-changed", refresh); window.addEventListener("applications-changed", refresh)
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("customer-notifications-changed", refresh); window.removeEventListener("applications-changed", refresh) }
  }, [role])
  const [adminUnreadCount, setAdminUnreadCount] = useState<number | undefined>()
  useEffect(() => {
    if (role !== "Admin") return
    const controller = new AbortController()
    let loading = false
    const refresh = async () => {
      if (loading || document.hidden) return
      loading = true
      try {
        const response = await fetch("/api/auth/admin/notifications", { credentials: "same-origin", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(45000)]) })
        if (!response.ok) throw new Error("Unable to load admin alerts")
        const result = await response.json()
        if (!controller.signal.aborted) setAdminUnreadCount(Number.isInteger(result.unread) ? result.unread : undefined)
      } catch { if (!controller.signal.aborted) setAdminUnreadCount(undefined) }
      finally { loading = false }
    }
    void refresh()
    const timer = window.setInterval(refresh, 60000)
    window.addEventListener("focus", refresh)
    window.addEventListener("admin-notifications-changed", refresh)
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("admin-notifications-changed", refresh) }
  }, [role])
  const canReadStoreNotifications = role === "Store Manager" && (!staff || permissions.includes("notifications"))
  useEffect(() => {
    if (!canReadStoreNotifications) { setStoreUnreadCount(undefined); return }
    const controller = new AbortController()
    let loading = false
    const refresh = async () => {
      if (loading || document.hidden) return
      loading = true
      try {
        const response = await fetch("/api/auth/store/notifications", { credentials: "same-origin", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) })
        if (!response.ok) throw new Error("Unable to load notifications")
        const result = await response.json()
        if (!controller.signal.aborted) setStoreUnreadCount(Number.isInteger(result.unread) ? result.unread : undefined)
      } catch { if (!controller.signal.aborted) setStoreUnreadCount(undefined) }
      finally { loading = false }
    }
    void refresh()
    const timer = window.setInterval(refresh, 60000)
    window.addEventListener("focus", refresh)
    window.addEventListener("store-notifications-changed", refresh)
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("store-notifications-changed", refresh) }
  }, [canReadStoreNotifications])
  const [approvalCountRevision, setApprovalCountRevision] = useState(0)
  useEffect(() => {
    if (role !== "Admin") return
    const controller = new AbortController()
    let loading = false
    const refreshCount = async () => {
      if (loading || document.visibilityState === "hidden") return
      loading = true
      try {
        const response = await fetch("/api/auth/admin/store-directory", {
          credentials: "same-origin",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
        })
        if (!response.ok) throw new Error("Unable to load pending stores")
        const result = await response.json()
        const count = result.summary?.pending
        if (!controller.signal.aborted) {
          setPendingStoreCount(Number.isInteger(count) && count >= 0 ? count : undefined)
        }
      } catch {
        if (!controller.signal.aborted) setPendingStoreCount(undefined)
      } finally {
        loading = false
      }
    }
    void refreshCount()
    const interval = window.setInterval(refreshCount, 60000)
    window.addEventListener("focus", refreshCount)
    document.addEventListener("visibilitychange", refreshCount)
    return () => {
      controller.abort()
      window.clearInterval(interval)
      window.removeEventListener("focus", refreshCount)
      document.removeEventListener("visibilitychange", refreshCount)
    }
  }, [role, approvalCountRevision])

  const [showHelp, setShowHelp] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [state, setState] = useState<DashboardState>("normal")
  const [approvalTab, setApprovalTab] = useState<ApprovalTab>("all")
  const [storeTab, setStoreTab] = useState<StoreTab>("all")
  const [customerTab, setCustomerTab] = useState<CustomerTab>("all")
  const [transactionTab, setTransactionTab] = useState<TransactionTab>("all")

  const pageMeta: Record<NavId, { title: string; crumb: string }> = {
    traffic: { title: "Website Traffic", crumb: "Admin / Website Traffic" },
    dashboard: {
      title: `${role} Dashboard`,
      crumb: `${role} Portal / Dashboard`,
    },
    "store-approvals": {
      title: "Store Approvals",
      crumb: "Admin Portal / Store Approvals",
    },
    stores: { title: "Stores", crumb: "Admin Portal / Stores" },
    subscriptions: {
      title: "Store Subscriptions",
      crumb: "Admin Portal / Store Subscriptions",
    },
    customers: { title: "Customers", crumb: "Admin Portal / Customers" },
    products: { title: "Products", crumb: "Admin Portal / Products" },
    promotions: {
      title: "Promotions & Promo Codes",
      crumb: "Store Manager Portal / Promotions & Promo Codes",
    },
    categories: { title: "Categories", crumb: "Admin Portal / Categories" },
    transactions: {
      title: "Transactions",
      crumb: "Admin Portal / Transactions",
    },
    reports: { title: "Reports", crumb: `${role} Portal / Reports` },
    notifications: {
      title: "Notifications",
      crumb: `${role} Portal / Notifications`,
    },
    settings: { title: "Settings", crumb: "Admin Portal / Settings" },
    "audit-logs": { title: "Audit Logs", crumb: "Admin Portal / Audit Logs" },
    support: {
      title: "Help and Support",
      crumb: "Admin Portal / Help and Support",
    },
    "my-applications": {
      title: "My Applications",
      crumb: "Customer Portal / My Applications",
    },
    "my-swaps": { title: "My Swaps", crumb: "Customer Portal / My Swaps" },
    "swap-application": {
      title: "Apply for Swap",
      crumb: "Customer Portal / Apply for Swap",
    },
    "hire-purchase-application": {
      title: "Hire Purchase Application",
      crumb: "Customer Portal / Hire Purchase Application",
    },
    "my-purchases": {
      title: "My Purchases",
      crumb: "Customer Portal / My Purchases",
    },
    "my-payment-plans": {
      title: "My Payment Plans",
      crumb: "Customer Portal / My Payment Plans",
    },
    "payment-history": {
      title: "Payment History",
      crumb: "Customer Portal / Payment History",
    },
    receipts: { title: "Receipts", crumb: "Customer Portal / Receipts" },
    profile: { title: "My Profile", crumb: "Customer Portal / Profile" },
    "store-profile": {
      title: "Store Profile",
      crumb: "Store Manager Portal / Store Profile",
    },
    "store-settings": {
      title: "Store Settings",
      crumb: "Store Manager Portal / Store Settings",
    },
    "team-access": {
      title: "Roles & Users",
      crumb: "Store Manager Portal / Roles & Users",
    },
    "shop-rules": {
      title: "Shop Rules & Payment Terms",
      crumb: "Store Manager Portal / Shop Rules & Payment Terms",
    },
    applications: {
      title:
        role === "Admin"
          ? "Store-Submitted Applications"
          : "Customer Applications",
      crumb: `${
        role === "Admin" ? "Admin" : "Store Manager"
      } Portal / Applications`,
    },
    "active-purchases": {
      title: "Active Purchases",
      crumb: `${
        role === "Admin" ? "Admin" : "Store Manager"
      } Portal / Active Purchases`,
    },
    "layaway-plans": {
      title: "Layaway Plans",
      crumb: "Admin Portal / Layaway Plans",
    },
    "collection-agents": {
      title: role === "Store Manager" ? "Field Agents" : "Collection Agents",
      crumb: `${role} Portal / Field Agents`,
    },
    "agent-settlements": {
      title: role === "Store Manager" ? "Agent Accounts" : "Agent Settlements",
      crumb: `${role} Portal / Agent Accounts & Settlements`,
    },
    payments: { title: "Payments", crumb: "Store Manager Portal / Payments" },
    "swap-management": {
      title: "Swap Management",
      crumb: "Store Manager Portal / Swap Management",
    },
    "swap-settings": {
      title: "Swap Settings",
      crumb: "Store Manager Portal / Swap Settings",
    },
    "trade-in-inventory": {
      title: "Trade-in Inventory",
      crumb: "Store Manager Portal / Trade-in Inventory",
    },
    "swap-overview": {
      title: "Swap Overview",
      crumb: "Admin Portal / Swap Overview",
    },
    logout: { title: "Logout", crumb: "Admin Portal / Logout" },
  }
  const pageAllowed = !staff || permissions.includes(activeNav)
  useEffect(() => {
    if (staff && !permissions.includes(activeNav) && permissions.length) setActiveNav(permissions[0] as NavId)
  }, [staff, permissions, activeNav])
  const currentMeta = pageMeta[activeNav]
  const portalNavItems =
    role === "Customer"
      ? CUSTOMER_NAV_ITEMS.map(item => item.id === "notifications" ? { ...item, count: customerUnreadCount, countLabel: "unread" } : item)
      : role === "Store Manager"
        ? STORE_MANAGER_NAV_ITEMS.filter(item => !staff || item.id === "logout" || permissions.includes(item.id)).map(item => item.id === "notifications" ? { ...item, count: storeUnreadCount, countLabel: "unread" } : item)
        : ADMIN_NAV_ITEMS.map(item => item.id === "store-approvals" ? { ...item, count: pendingStoreCount } : item.id === "notifications" ? { ...item, count: adminUnreadCount, countLabel: "unread" } : item)

  useEffect(() => {
    document.title = `AdepaPay | ${currentMeta.title}`
  }, [currentMeta.title])

  return (
    <>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <div
          className={`relative hidden transition-[width] duration-300 xl:fixed xl:inset-y-0 xl:flex xl:flex-col xl:border-r xl:border-slate-200 xl:text-white ${
            role === "Customer"
              ? "xl:bg-gradient-to-b xl:from-[#102a63] xl:via-[#0b2250] xl:to-[#06152f]"
              : "xl:bg-[#071a34]"
          } ${sidebarCollapsed ? "xl:w-24" : "xl:w-76"}`}
        >
          <Sidebar
            navItems={portalNavItems}
            activeNav={activeNav}
            role={role}
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((value) => !value)}
            onSelect={(id) =>
              id === "logout" ? onLogout?.() : setActiveNav(id)
            }
          />
        </div>

        {drawerOpen && (
          <div className="fixed inset-0 z-50 xl:hidden">
            <button
              aria-label="Close navigation overlay"
              className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
              onClick={() => setDrawerOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full w-[84%] max-w-xs bg-[#071a34] text-white shadow-2xl">
              <Sidebar
                navItems={portalNavItems}
                activeNav={activeNav}
                role={role}
                onSelect={(id) => {
                  if (id === "logout") onLogout?.()
                  else setActiveNav(id)
                  setDrawerOpen(false)
                }}
                mobile
                onClose={() => setDrawerOpen(false)}
              />
            </div>
          </div>
        )}

        <div
          className={`transition-[padding] duration-300 ${
            sidebarCollapsed ? "xl:pl-24" : "xl:pl-76"
          }`}
        >
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
              <IconButton
                label="Open navigation"
                className="xl:hidden"
                onClick={() => setDrawerOpen(true)}
              >
                <IconMenu />
              </IconButton>

              {role === "Admin" ? <><div className="hidden min-w-0 md:block"><p className="truncate text-xs text-slate-400">{currentMeta.crumb}</p><h1 className="mt-1 truncate text-lg font-bold">{currentMeta.title}</h1></div><AdminSearch /><AdminConnectionStatus /></> : <><PortalSearch portal={portal} /><div className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 lg:block">Signed in</div></>}

              <IconButton label="Help and support" onClick={() => { if (!staff || permissions.includes("support")) setActiveNav("support"); else setShowHelp(value => !value) }}>
                <IconHelp />
              </IconButton>
              {(!staff || permissions.includes("notifications")) && <div className="relative">
                <IconButton label="Notifications" onClick={() => { if (!staff || permissions.includes("notifications")) setActiveNav("notifications") }}>
                  <IconBell />
                </IconButton>
                {canReadStoreNotifications && storeUnreadCount !== undefined && storeUnreadCount > 0 && <span aria-label={`${storeUnreadCount} unread notifications`} className="pointer-events-none absolute -right-1 -top-1 min-w-5 rounded-full bg-red-500 px-1.5 text-center text-xs font-bold text-white">{storeUnreadCount}</span>}
                {role === "Customer" && customerUnreadCount !== undefined && customerUnreadCount > 0 && <span aria-label={`${customerUnreadCount} unread notifications`} className="pointer-events-none absolute -right-1 -top-1 min-w-5 rounded-full bg-red-500 px-1.5 text-center text-xs font-bold text-white">{customerUnreadCount}</span>}
                {role === "Admin" && adminUnreadCount !== undefined && adminUnreadCount > 0 && <span aria-label={`${adminUnreadCount} unread notifications`} className="pointer-events-none absolute -right-1 -top-1 min-w-5 rounded-full bg-red-500 px-1.5 text-center text-xs font-bold text-white">{adminUnreadCount}</span>}

              </div>}
              {(!staff || permissions.includes("store-profile")) && <button onClick={() => { if (role === "Customer") setActiveNav("profile"); else if (role === "Store Manager" && (!staff || permissions.includes("store-profile"))) setActiveNav("store-profile"); else if (role === "Admin") setActiveNav("settings") }} className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-blue-200 lg:flex">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-100 font-bold text-purple-700">
                  {(displayName || "Account").split(" ").map(part => part[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {displayName || "Account"}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>
                      {role === "Store Manager"
                        ? (roleTitle || "Store Manager")
                        : role === "Customer"
                          ? "Customer"
                          : "Platform Admin"}
                    </span>
                    <span className="rounded-full bg-purple-50 px-2 py-0.5 font-semibold text-purple-700">
                      {role === "Store Manager"
                        ? (storeName || "Your store")
                        : role === "Customer"
                          ? "Customer account"
                          : "Super Admin"}
                    </span>
                  </div>
                </div>
                <IconChevron />
              </button>}
            </div>
          </header>

          <main className="px-4 pb-8 pt-6 sm:px-6 lg:px-8">
            {showHelp && <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-5"><h2 className="font-bold">Applications and payments</h2><p className="mt-2 text-sm">Choose a product from Browse Products, open its details and select an available application type. Track decisions under My Applications or My Swaps. The store reviews requests and confirms payments received. For questions about an order, use the store contact details under Browse Stores.</p><button className="mt-3 rounded-xl border border-slate-200 px-4 py-2 text-sm" onClick={() => setShowHelp(false)}>Close help</button></div>}
            {pageAllowed ? <>
            {role === "Admin" && activeNav === "traffic" && <AdminTraffic />}
            {state === "loading" && <LoadingGrid />}
            {state === "empty" && <EmptyState />}
            {state === "error" && <ErrorState />}
            {state === "restricted" && <RestrictedState />}
            {state === "normal" &&
              activeNav === "dashboard" &&
              (role === "Customer" ? (
                <ApplicationWorkspace {...portalProps} view="dashboard" onBrowse={() => setActiveNav("products")} />
              ) : role === "Store Manager" ? (
                <ApplicationWorkspace {...portalProps} view="dashboard" storeView="dashboard" />
              ) : (
                <AdminHome />
              ))}
            {state === "normal" &&
              role === "Admin" &&
              activeNav === "store-approvals" && (
                <StoreOnboardingApprovalsPage initialRecord={adminRoute.record} onRecordChange={record => { window.location.hash = adminHref("store-approvals", record) }} onApplicationsChange={() => setApprovalCountRevision(value => value + 1)} />
              )}
            {state === "normal" &&
              role === "Admin" &&
              activeNav === "stores" && (
                <AdminStoresPage onApprovals={() => setActiveNav("store-approvals")} />
              )}
            {state === "normal" &&
              role === "Admin" &&
              activeNav === "subscriptions" && <AdminSubscriptionsPage initialPlan={adminRoute.record} onRecordChange={record => { window.location.hash = adminHref("subscriptions", record) }} />}
            {role === "Store Manager" && !staff && activeNav === "subscriptions" && <StoreBilling embedded onContinue={() => setActiveNav("dashboard")} />}


            {state === "normal" && role === "Admin" && ["customers", "products", "categories", "applications", "swap-overview", "active-purchases", "layaway-plans", "collection-agents", "agent-settlements", "transactions", "audit-logs"].includes(activeNav) && <AdminOperations key={activeNav} page={activeNav as AdminOperation} initialRecord={adminRoute.record} initialQuery={adminRoute.query} onRecordChange={record => { if (isAdminPage(activeNav)) window.location.hash = adminHref(activeNav, record) }} />}
            {state === "normal" && role === "Admin" && ["settings", "support", "notifications", "reports"].includes(activeNav) && <AdminPlatform key={activeNav} page={activeNav as AdminPlatformPage} initialRecord={adminRoute.record} onRecordChange={record => { if (isAdminPage(activeNav)) window.location.hash = adminHref(activeNav, record) }} onNavigate={(target, record) => { if (isAdminPage(target)) window.location.hash = adminHref(target, record || "") }} />}
            {state === "normal" && role !== "Admin" && activeNav === "support" && <SupportInbox initialRecord={portalRoute.record} onRecordChange={portalProps.onRecordChange} />}





            {state === "normal" &&
              role === "Customer" &&
              activeNav === "profile" && (
                <CustomerAccount />
              )}
            {state === "normal" &&
              role === "Customer" &&
              activeNav === "stores" && (
                <Marketplace key="customer-stores" mode="stores" onStoreDetails={id => navigatePortal("stores", id)} initialStore={portalRoute.record} initialQuery={portalRoute.query} />
              )}
            {state === "normal" &&
              role === "Customer" &&
              activeNav === "products" && (
                <Marketplace key="customer-products" mode="products" onRecordChange={portalProps.onRecordChange} initialProduct={portalRoute.record} initialQuery={portalRoute.query} />
              )}
            {state === "normal" &&
              role === "Customer" &&
              activeNav === "my-applications" && (
                <ApplicationWorkspace {...portalProps} onBrowse={() => setActiveNav("products")} />
              )}
            {state === "normal" &&
              role === "Customer" &&
              activeNav === "my-swaps" && (
                <ApplicationWorkspace {...portalProps} view="swap" onBrowse={() => setActiveNav("swap-application")} />
              )}
            {state === "normal" &&
              role === "Customer" &&
              activeNav === "swap-application" && (
                <Marketplace onRecordChange={portalProps.onRecordChange} initialProduct={portalRoute.record} initialQuery={portalRoute.query} mode="products" applyKind="swap" />
              )}
            {state === "normal" &&
              role === "Customer" &&
              activeNav === "hire-purchase-application" && (
                <Marketplace onRecordChange={portalProps.onRecordChange} initialProduct={portalRoute.record} initialQuery={portalRoute.query} mode="products" applyKind="hire_purchase" />
              )}
            {state === "normal" &&
              role === "Customer" &&
              activeNav === "layaway-plans" && (
                <Marketplace onRecordChange={portalProps.onRecordChange} initialProduct={portalRoute.record} initialQuery={portalRoute.query} mode="products" applyKind="layaway" />
              )}
            {state === "normal" &&
              role === "Customer" &&
              activeNav === "my-payment-plans" && (
                <ApplicationWorkspace {...portalProps} view="plans" />
              )}
            {state === "normal" &&
              role === "Customer" &&
              activeNav === "my-purchases" && <ApplicationWorkspace {...portalProps} view="purchases" />}
            {state === "normal" &&
              role === "Customer" &&
              activeNav === "payment-history" && <ApplicationWorkspace {...portalProps} view="payments" />}
            {state === "normal" &&
              role === "Customer" &&
              activeNav === "receipts" && <ApplicationWorkspace {...portalProps} view="receipts" />}
            {state === "normal" &&
              activeNav === "notifications" &&
              role === "Customer" && <StoreNotifications customer initialQuery={portalRoute.query} onNavigate={navigatePortal} />}
            {state === "normal" &&
              activeNav === "settings" &&
              role === "Customer" && <CustomerAccount settings />}
            {state === "normal" &&
              role === "Store Manager" &&
              activeNav === "swap-management" && (
                <ApplicationWorkspace {...portalProps} view="swap" storeView="swap" />
              )}
            {state === "normal" &&
              role === "Store Manager" &&
              activeNav === "swap-settings" && <ConnectedStoreProducts {...portalProps} />}
            {state === "normal" &&
              role === "Store Manager" &&
              activeNav === "trade-in-inventory" && <StoreCataloguePage trade {...portalProps} />}
            {state === "normal" &&
              role === "Store Manager" &&
              activeNav !== "dashboard" &&
              ![
                "support",
                "subscriptions",
                "swap-management",
                "swap-settings",
                "trade-in-inventory",
              ].includes(activeNav) && (
                <StoreManagerPage route={portalRoute} onNavigate={navigatePortal} onRecordChange={portalProps.onRecordChange} page={activeNav} storeId={storeId} onProfile={() => setActiveNav("store-profile")} onLogout={() => onLogout?.()} />
              )}
            </> : <div role="alert" className="rounded-2xl border border-slate-200 bg-white p-8"><h2 className="text-xl font-bold">No access to this page</h2><p className="mt-2 text-slate-500">Choose an assigned page from the sidebar or contact your store owner for access.</p></div>}
          </main>
        </div>
      </div>
    </>
  )
}

function Sidebar({
  activeNav,
  onSelect,
  role,
  navItems,
  mobile,
  onClose,
  collapsed,
  onToggle,
}: {
  activeNav: NavId
  onSelect: (id: NavId) => void
  role: "Customer" | "Store Manager" | "Admin"
  navItems: NavItem[]
  mobile?: boolean
  onClose?: () => void
  collapsed?: boolean
  onToggle?: () => void
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="relative flex min-h-24 items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
        <div
          className={`flex items-center ${
            collapsed ? "w-full justify-center" : "gap-3"
          }`}
        >
          <div className="flex w-full items-center justify-center">
            <img
              src="/images/adepa_pay_logo.png"
              alt="AdepaPay"
              className={`${
                collapsed ? "h-[67px] max-w-[67px]" : "h-[115px] max-w-[264px]"
              } w-auto object-contain`}
            />
          </div>
        </div>
        {mobile && (
          <IconButton dark label="Close navigation" onClick={onClose}>
            <IconClose />
          </IconButton>
        )}
        {!mobile && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="absolute bottom-3 right-3 z-20 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <svg
              className={`h-4 w-4 transition-transform ${
                collapsed ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m15 18-6-6 6-6"
              />
            </svg>
          </button>
        )}
      </div>

      <div
        className={`space-y-1 overflow-y-auto py-5 ${
          collapsed ? "px-3" : "px-4"
        }`}
      >
        {navItems.map((item) => {
          const active = activeNav === item.id
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              aria-current={active ? "page" : undefined}
              title={collapsed ? `${item.label}${item.count ? ` (${item.count} ${item.countLabel || "pending"})` : ""}` : undefined}
              aria-label={item.count ? `${item.label}, ${item.count} ${item.countLabel || "pending"}` : item.label}
              className={`relative flex w-full items-center rounded-2xl py-3 text-left text-sm font-semibold transition ${
                collapsed ? "justify-center px-3" : "gap-3 px-4"
              } ${
                item.id === "logout"
                  ? "text-red-300 hover:bg-red-500/15 hover:text-red-200"
                  : active
                    ? role === "Customer"
                      ? "bg-gradient-to-r from-cyan-400 to-blue-500 text-white shadow-lg shadow-blue-950/30"
                      : "bg-blue-600 text-white shadow-lg shadow-blue-950/30"
                    : role === "Customer"
                      ? "text-blue-100 hover:bg-white/10 hover:text-white"
                      : "text-slate-200 hover:bg-white/8"
              }`}
            >
              <span
                className={
                  item.id === "logout"
                    ? "text-red-300"
                    : active
                      ? "text-white"
                      : "text-slate-300"
                }
              >
                {item.icon}
              </span>
              {!collapsed && <span>{item.label}</span>}
              {item.count !== undefined && item.count > 0 && (
                <span className={`flex min-w-6 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white ${collapsed ? "absolute -right-1 -top-1 h-5" : "ml-auto h-6"}`}>
                  {item.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StoreManagerPage({ page, storeId, onProfile, onLogout, route, onNavigate, onRecordChange }: { page: NavId; storeId: string; onProfile: () => void; onLogout: () => void; route: PortalRoute; onNavigate: (page: string, record?: string) => void; onRecordChange: (record: string) => void }) {
  const portalProps = { initialRecord: route.record, initialQuery: route.query, onRecordChange }
  if (page === "store-profile") return <ConnectedStoreProfile />
  if (page === "store-settings") return <ConnectedStoreSettings onProfile={onProfile} onLogout={onLogout} />
  if (page === "products") return <ConnectedStoreProducts {...portalProps} />
  if (page === "categories") return <StoreCataloguePage {...portalProps} />
  if (page === "promotions") return <StorePromotionsPage {...portalProps} storeId={storeId} />
  if (page === "customers") return <ApplicationWorkspace {...portalProps} view="customers" storeView="customers" />
  if (page === "team-access") return <ConnectedStoreTeam {...portalProps} />
  if (page === "shop-rules") return <ConnectedStoreRules />
  if (page === "applications")
    return <ApplicationWorkspace {...portalProps} storeView="applications" />
  if (page === "layaway-plans") return <ApplicationWorkspace {...portalProps} view="layaway" storeView="layaway" />
  if (page === "active-purchases") return <ApplicationWorkspace {...portalProps} view="purchases" storeView="purchases" />
  if (page === "payments") return <ApplicationWorkspace {...portalProps} view="payments" storeView="payments" />
  if (page === "notifications") return <StoreNotifications initialQuery={route.query} onNavigate={onNavigate} />
  if (page === "reports") return <StoreReports />
  if (page === "collection-agents")
    return <StoreFieldAgentsPage {...portalProps} storeId={storeId} />
  if (page === "agent-settlements")
    return <StoreAgentAccounts {...portalProps} />
  return <p className="rounded-xl border p-4 text-slate-500">Choose a page from the store sidebar.</p>
}

function Card({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={`rounded-[28px] border border-slate-200 bg-white shadow-sm ${className ?? ""}`}
    >
      {children}
    </div>
  )
}

function Button({
  children,
  variant = "primary",
  onClick,
}: {
  children: ReactNode
  variant?: "primary" | "secondary"
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
        variant === "primary"
          ? "bg-blue-600 text-white hover:bg-blue-700"
          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  )
}

function IconButton({
  children,
  onClick,
  className,
  dark,
  label,
}: {
  children: ReactNode
  onClick?: () => void
  className?: string
  dark?: boolean
  label?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition ${
        dark
          ? "border-white/10 text-slate-300 hover:bg-white/10"
          : "border-slate-200 text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
      } ${className ?? ""}`}
    >
      {children}
    </button>
  )
}

function LoadingGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <Card key={index} className="p-5">
          <div className="space-y-4">
            <Skeleton height="h-4" width="w-1/3" />
            <Skeleton height="h-8" width="w-1/2" />
            <Skeleton height="h-4" width="w-2/3" />
            <Skeleton height="h-28" />
          </div>
        </Card>
      ))}
    </div>
  )
}

function Skeleton({
  height,
  width = "w-full",
}: {
  height: string
  width?: string
}) {
  return (
    <div
      className={`animate-pulse rounded-2xl bg-slate-200 ${height} ${width}`}
    />
  )
}

function EmptyState() {
  return (
    <Card className="p-10 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-blue-600">
        <IconChart />
      </div>
      <h3 className="mt-4 text-xl font-bold text-slate-900">
        No dashboard data for this period
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        Try a wider date range or confirm platform services are publishing fresh
        analytics events.
      </p>
      <div className="mt-6">
        <Button>Reset Filters</Button>
      </div>
    </Card>
  )
}

function ErrorState() {
  return (
    <Card className="p-10 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-red-50 text-red-600">
        <IconWarning />
      </div>
      <h3 className="mt-4 text-xl font-bold text-slate-900">
        Platform dashboard unavailable
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        A reporting service or analytics dependency failed to respond. Retry
        after checking service status.
      </p>
      <div className="mt-6">
        <Button>Retry</Button>
      </div>
    </Card>
  )
}

function RestrictedState() {
  return (
    <Card className="p-10 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-purple-50 text-purple-600">
        <IconLock />
      </div>
      <h3 className="mt-4 text-xl font-bold text-slate-900">
        Restricted permission state
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        Your current administrator role can view summary platform health, but
        detailed transaction and audit metrics require expanded reporting
        permissions.
      </p>
      <div className="mt-6">
        <Button variant="secondary">Request Access</Button>
      </div>
    </Card>
  )
}

function Svg({
  children,
  className = "h-5 w-5",
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
    >
      {children}
    </svg>
  )
}
function IconGrid() {
  return (
    <Svg>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 4h7v7H4zM13 4h7v5h-7zM13 11h7v9h-7zM4 13h7v7H4z"
      />
    </Svg>
  )
}
function IconStore() {
  return (
    <Svg>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 8h16l-1 3a3 3 0 0 1-3 2H8a3 3 0 0 1-3-2L4 8Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 13v6h14v-6M9 19v-4h6v4"
      />
    </Svg>
  )
}
function IconUsers() {
  return (
    <Svg>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 19a4 4 0 0 0-8 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a3 3 0 0 0-6 0M18 9a3 3 0 1 0 0-6M5 19a3 3 0 0 0-6 0M6 9A3 3 0 1 0 6 3"
      />
    </Svg>
  )
}
function IconBox() {
  return (
    <Svg>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m12 3 8 4.5-8 4.5-8-4.5L12 3Zm8 4.5V16.5L12 21l-8-4.5V7.5M12 12v9"
      />
    </Svg>
  )
}
function IconLayers() {
  return (
    <Svg>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m12 4 8 4-8 4-8-4 8-4Zm8 8-8 4-8-4m16 4-8 4-8-4"
      />
    </Svg>
  )
}
function IconWallet() {
  return (
    <Svg>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 9h16" />
      <circle cx="16" cy="14" r="1.25" fill="currentColor" stroke="none" />
    </Svg>
  )
}
function IconChart() {
  return (
    <Svg>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 19V9M12 19V5M19 19v-7M3 19h18"
      />
    </Svg>
  )
}
function IconBell() {
  return (
    <Svg>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 17H5l1.2-1.2A2 2 0 0 0 7 14.4V11a5 5 0 1 1 10 0v3.4a2 2 0 0 0 .8 1.6L19 17h-4"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10 20a2 2 0 0 0 4 0"
      />
    </Svg>
  )
}
function IconCog() {
  return (
    <Svg>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m10.3 3.9.5-1.4h2.4l.5 1.4a1.5 1.5 0 0 0 1.6 1l1.5-.2 1.2 2-1 1.1a1.5 1.5 0 0 0 0 1.9l1 1.1-1.2 2-1.5-.2a1.5 1.5 0 0 0-1.6 1l-.5 1.4h-2.4l-.5-1.4a1.5 1.5 0 0 0-1.6-1l-1.5.2-1.2-2 1-1.1a1.5 1.5 0 0 0 0-1.9l-1-1.1 1.2-2 1.5.2a1.5 1.5 0 0 0 1.6-1Z"
      />
      <circle cx="12" cy="12" r="2.75" />
    </Svg>
  )
}
function IconFile() {
  return (
    <Svg>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 3h6l4 4v14H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5" />
    </Svg>
  )
}
function IconHelp() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-.8.7-1.7 1.2-1.7 2.7"
      />
      <circle cx="12" cy="16.7" r=".9" fill="currentColor" stroke="none" />
    </Svg>
  )
}
function IconLogout() {
  return (
    <Svg>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10 17H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m13 8 5 4-5 4M18 12H9"
      />
    </Svg>
  )
}
function IconMenu() {
  return (
    <Svg>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 7h16M4 12h16M4 17h16"
      />
    </Svg>
  )
}
function IconChevron() {
  return (
    <Svg className="h-4 w-4 text-slate-400">
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </Svg>
  )
}
function IconCheckCircle() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m8.5 12 2.3 2.3 4.7-4.8"
      />
    </Svg>
  )
}
function IconWarning() {
  return (
    <Svg>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v4M12 17h.01M10.3 3.9 2.7 17A2 2 0 0 0 4.4 20h15.2a2 2 0 0 0 1.7-3l-7.6-13.1a2 2 0 0 0-3.4 0Z"
      />
    </Svg>
  )
}
function IconBag() {
  return (
    <Svg>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 8h12l-1 11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 8V6a3 3 0 1 1 6 0v2"
      />
    </Svg>
  )
}
function IconArchive() {
  return (
    <Svg>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 7h16v4H4zM6 11v8h12v-8M10 14h4"
      />
    </Svg>
  )
}
function IconLock() {
  return (
    <Svg>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 11V8a4 4 0 1 1 8 0v3"
      />
    </Svg>
  )
}
function IconClose() {
  return (
    <Svg>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m6 6 12 12M18 6 6 18"
      />
    </Svg>
  )
}
