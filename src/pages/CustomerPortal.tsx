import { useEffect, useState, type ReactNode } from "react"
import {
  MySwapsPage,
  SwapAdminOverviewPage,
  SwapApplicationPage,
  SwapDemoProvider,
  SwapManagementPage,
  SwapSettingsPage,
  TradeInInventoryPage,
} from "./SwapPages"
import StorePromotionsPage from "./StorePromotions"
import AdminSubscriptionsPage from "./AdminSubscriptions"
import {
  StoreAgentSettlementsPage,
  StoreFieldAgentsPage,
} from "./StoreFieldAgents"
import {
  getCustomerRisk,
  type CustomerRiskAssessment,
} from "../lib/customerRisk"
import HirePurchaseReviewPage from "./HirePurchaseReview"
import { submitDemoHirePurchaseApplication } from "../lib/hirePurchaseApplications"
import StoreOnboardingApprovalsPage from "./StoreOnboardingApprovals"
import { GHANA_REGIONS, getGhanaRegionalCapital } from "../lib/localization"

const CUSTOMER_PHOTO_STORAGE_KEY = "adepapay.customer-profile-photo.v1"

type DashboardState = "normal" | "loading" | "empty" | "error" | "restricted"
type NavId = "dashboard" | "store-approvals" | "stores" | "subscriptions" | "customers" | "products" | "promotions" | "categories" | "transactions" | "reports" | "notifications" | "settings" | "audit-logs" | "support" | "layaway-plans" | "my-payment-plans" | "collection-agents" | "agent-settlements" | "my-applications" | "hire-purchase-application" | "my-purchases" | "payment-history" | "receipts" | "profile" | "store-profile" | "store-settings" | "team-access" | "shop-rules" | "applications" | "active-purchases" | "payments" | "my-swaps" | "swap-application" | "swap-management" | "swap-settings" | "trade-in-inventory" | "swap-overview" | "logout"

type Tone = "info" | "success" | "pending" | "danger" | "admin"

type NavItem = {
  id: NavId
  label: string
  short: string
  icon: ReactNode
}

type Metric = {
  title: string
  value: string
  detail: string
  trend: string
  tone: Tone
  icon: ReactNode
}

type ApprovalTab = "all" | "new" | "under-review" | "documents" | "approved" | "rejected" | "suspended" | "expired"
type StoreTab = "all" | "active" | "pending" | "suspended" | "restricted" | "inactive" | "closed"
type CustomerTab = "all" | "active" | "verified" | "pending" | "overdue" | "restricted" | "suspended" | "closed"
type TransactionTab = "all" | "customer-payments" | "store-settlements" | "pending" | "failed" | "refunded" | "reversed" | "offline" | "flagged"
type SettingsTab = "general" | "stores" | "customers" | "hire-purchase" | "products" | "payments" | "integrations" | "communication" | "notifications" | "roles" | "security" | "system" | "legal" | "danger"

type ApprovalRow = {
  reference: string
  store: string
  owner: string
  category: string
  region: string
  submitted: string
  progress: string
  risk: string
  status: string
  reviewer: string
  tone: Tone
}

type StoreRow = {
  id: string
  name: string
  owner: string
  category: string
  region: string
  products: string
  purchases: string
  value: string
  verification: string
  operational: string
  tone: Tone
}

type CustomerRow = {
  id: string
  name: string
  initials: string
  phone: string
  email: string
  verification: string
  applications: string
  purchases: string
  paid: string
  outstanding: string
  paymentStatus: string
  risk: string
  account: string
  region: string
  tone: Tone
}

type CustomerVerificationDecision = {
  status: "Approved" | "Further Documents Required"
  documents: string[]
  note: string
  decidedAt: string
}

type TransactionRow = {
  reference: string
  gatewayRef: string
  customer: string
  store: string
  purchase: string
  type: string
  method: string
  gross: string
  fee: string
  net: string
  dateTime: string
  paymentStatus: string
  settlementStatus: string
  risk: string
  tone: Tone
}

type ReportItem = {
  title: string
  description: string
}

const ADMIN_NAV_ITEMS: NavItem[] = [
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
  { id: "logout", label: "Logout", short: "Logout", icon: <IconLogout /> },
]

const STORE_MANAGER_NAV_ITEMS: NavItem[] = [
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

const ADMIN_BOTTOM_NAV: NavId[] = [
  "dashboard",
  "stores",
  "customers",
  "transactions",
  "support",
]
const CUSTOMER_BOTTOM_NAV: NavId[] = [
  "dashboard",
  "my-applications",
  "my-purchases",
  "payment-history",
  "profile",
]
const STORE_MANAGER_BOTTOM_NAV: NavId[] = [
  "dashboard",
  "products",
  "applications",
  "active-purchases",
  "support",
]

const METRICS: Metric[] = [
  {
    title: "Total Stores",
    value: "486",
    detail: "422 active, 18 suspended, 46 under review",
    trend: "+8.2% vs July 2026",
    tone: "info",
    icon: <IconStore />,
  },
  {
    title: "Pending Store Approvals",
    value: "34",
    detail: "11 high priority reviews pending today",
    trend: "+6 new since Monday",
    tone: "pending",
    icon: <IconCheckCircle />,
  },
  {
    title: "Total Customers",
    value: "12,842",
    detail: "1,148 new customers this quarter",
    trend: "+14.5% vs Q2 2026",
    tone: "success",
    icon: <IconUsers />,
  },
  {
    title: "Active Purchases",
    value: "3,286",
    detail: "GHS 8.4M live financed portfolio",
    trend: "+5.1% vs previous period",
    tone: "success",
    icon: <IconBag />,
  },
  {
    title: "Transactions This Month",
    value: "GHS 250,450.00",
    detail: "Across customer payments, fees, and settlements",
    trend: "+11.2% vs July 2026",
    tone: "admin",
    icon: <IconWallet />,
  },
  {
    title: "Total Platform Revenue",
    value: "GHS 38,920.00",
    detail: "Collected fees and service charges",
    trend: "+9.7% vs previous month",
    tone: "admin",
    icon: <IconChart />,
  },
  {
    title: "Outstanding Balance",
    value: "GHS 1,842,600.00",
    detail: "Across active customer repayment plans",
    trend: "-3.4% vs July 2026",
    tone: "pending",
    icon: <IconWarning />,
  },
  {
    title: "Overdue Purchases",
    value: "217",
    detail: "Concentrated in 19 high-risk stores",
    trend: "+2.1% vs previous week",
    tone: "danger",
    icon: <IconWarning />,
  },
]

const STORE_APPLICATIONS = [
  [
    "CYTECH Gadgets",
    "Emmanuel Agyeman",
    "Electronics",
    "August 2, 2026",
    "82%",
    "Low Risk",
    "Under Review",
  ],
  [
    "Adepa Home",
    "Mavis Serwaa",
    "Furniture",
    "August 1, 2026",
    "61%",
    "Requires Attention",
    "Verification Required",
  ],
  [
    "Prime Mobility",
    "Kojo Badu",
    "Automotive",
    "July 31, 2026",
    "93%",
    "Low Risk",
    "Approved",
  ],
  [
    "Nova Appliances",
    "Yaw Kwarteng",
    "Home Appliances",
    "July 30, 2026",
    "57%",
    "Medium Risk",
    "Pending Documents",
  ],
]

const TRANSACTIONS = [
  [
    "BPTX-241180",
    "Kwame Asante",
    "CYTECH Gadgets",
    "Installment Payment",
    "GHS 1,100.00",
    "MTN Mobile Money",
    "Aug 4, 2026 • 9:12 AM",
    "Successful",
  ],
  [
    "BPTX-241171",
    "Ama Serwaa Owusu",
    "Adepa Home",
    "Card Payment",
    "GHS 820.00",
    "Bank Card",
    "Aug 4, 2026 • 8:40 AM",
    "Pending",
  ],
  [
    "BPTX-241124",
    "Yaw Boateng",
    "Nova Appliances",
    "Installment Payment",
    "GHS 695.00",
    "Telecel Cash",
    "Aug 3, 2026 • 6:18 PM",
    "Failed",
  ],
  [
    "BPTX-241088",
    "Abena Tandoh",
    "CYTECH Gadgets",
    "Offline Transfer",
    "GHS 968.00",
    "Bank Transfer",
    "Aug 3, 2026 • 3:22 PM",
    "Successful",
  ],
]

const ALERTS = [
  [
    "High-value transaction completed",
    "GHS 18,000.00 MacBook Pro purchase completed at CYTECH Gadgets.",
    "pending",
  ],
  [
    "Failed settlement detected",
    "Friday settlement batch for 2 stores is delayed pending bank confirmation.",
    "danger",
  ],
  [
    "Suspicious customer activity",
    "Multiple failed payment attempts detected on one flagged customer account.",
    "danger",
  ],
  [
    "Store verification issue",
    "Adepa Home is missing a valid settlement document.",
    "pending",
  ],
  [
    "Payment gateway interruption",
    "Short MTN MoMo timeout spike recorded at 8:05 AM.",
    "admin",
  ],
  [
    "Overdue purchases increased",
    "Overdue accounts rose by 2.1% week over week.",
    "pending",
  ],
  [
    "Product policy violation",
    "One product listing was suspended for misleading pricing disclosure.",
    "danger",
  ],
] as const

const TOP_STORES = [
  ["CYTECH Gadgets", "GHS 412,880.00", "418", "1,182", "94%", "+12.1%"],
  ["Adepa Home", "GHS 287,300.00", "276", "842", "91%", "+8.4%"],
  ["Prime Mobility", "GHS 231,900.00", "141", "304", "88%", "+6.7%"],
  ["Nova Appliances", "GHS 188,450.00", "193", "521", "89%", "+5.2%"],
]

const CHECKLIST = [
  "Review 11 pending store approvals",
  "Investigate 2 failed settlement batches",
  "Approve quarterly scheduled reports",
  "Resolve 3 flagged product-policy violations",
]

const APPROVAL_SUMMARY: Metric[] = [
  {
    title: "Total Applications",
    value: "128",
    detail: "All partner-store onboarding submissions",
    trend: "+12 this week",
    tone: "info",
    icon: <IconStore />,
  },
  {
    title: "New Applications",
    value: "18",
    detail: "Submitted in the last 7 days",
    trend: "+4 since yesterday",
    tone: "pending",
    icon: <IconCheckCircle />,
  },
  {
    title: "Under Review",
    value: "27",
    detail: "Currently assigned to administrators",
    trend: "9 high priority",
    tone: "pending",
    icon: <IconFile />,
  },
  {
    title: "Additional Information Required",
    value: "14",
    detail: "Waiting for store response",
    trend: "+2 today",
    tone: "admin",
    icon: <IconWarning />,
  },
  {
    title: "Approved",
    value: "56",
    detail: "Verified and activated partner stores",
    trend: "+8 this month",
    tone: "success",
    icon: <IconCheckCircle />,
  },
  {
    title: "Rejected",
    value: "13",
    detail: "Failed compliance or document checks",
    trend: "1 escalated",
    tone: "danger",
    icon: <IconClose />,
  },
]

const APPROVAL_ROWS: ApprovalRow[] = [
  {
    reference: "BPSA-2026-00182",
    store: "CYTECH Gadgets",
    owner: "Emmanuel Agyeman",
    category: "Electronics",
    region: "Greater Accra",
    submitted: "August 2, 2026",
    progress: "82%",
    risk: "Low Risk",
    status: "Under Review",
    reviewer: "Adwoa Mensah",
    tone: "pending",
  },
  {
    reference: "BPSA-2026-00179",
    store: "Adepa Home",
    owner: "Mavis Serwaa",
    category: "Furniture",
    region: "Ashanti",
    submitted: "August 1, 2026",
    progress: "61%",
    risk: "Requires Attention",
    status: "Documents Required",
    reviewer: "Kwesi Annan",
    tone: "admin",
  },
  {
    reference: "BPSA-2026-00174",
    store: "Prime Mobility",
    owner: "Kojo Badu",
    category: "Automotive",
    region: "Greater Accra",
    submitted: "July 31, 2026",
    progress: "93%",
    risk: "Low Risk",
    status: "Approved",
    reviewer: "Emmanuel",
    tone: "success",
  },
  {
    reference: "BPSA-2026-00168",
    store: "Nova Appliances",
    owner: "Yaw Kwarteng",
    category: "Home Appliances",
    region: "Central",
    submitted: "July 30, 2026",
    progress: "57%",
    risk: "Medium Risk",
    status: "Under Review",
    reviewer: "Abena Asiedu",
    tone: "pending",
  },
  {
    reference: "BPSA-2026-00161",
    store: "Urban Style Hub",
    owner: "Naa Okailey",
    category: "Fashion",
    region: "Greater Accra",
    submitted: "July 28, 2026",
    progress: "46%",
    risk: "Missing Documents",
    status: "Rejected",
    reviewer: "Adwoa Mensah",
    tone: "danger",
  },
]

const STORE_SUMMARY: Metric[] = [
  {
    title: "Total Stores",
    value: "486",
    detail: "Registered on AdepaPay",
    trend: "+8.2% vs July 2026",
    tone: "info",
    icon: <IconStore />,
  },
  {
    title: "Active Stores",
    value: "422",
    detail: "Operational and transacting",
    trend: "+17 this month",
    tone: "success",
    icon: <IconCheckCircle />,
  },
  {
    title: "Pending Verification",
    value: "34",
    detail: "Still in onboarding review",
    trend: "11 due today",
    tone: "pending",
    icon: <IconFile />,
  },
  {
    title: "Suspended Stores",
    value: "18",
    detail: "Temporarily blocked from trading",
    trend: "+2 this week",
    tone: "danger",
    icon: <IconWarning />,
  },
  {
    title: "Restricted Stores",
    value: "9",
    detail: "Operating under conditions",
    trend: "3 policy issues",
    tone: "admin",
    icon: <IconLock />,
  },
  {
    title: "Stores Added This Month",
    value: "31",
    detail: "Approved during August 2026",
    trend: "+6.9% vs July",
    tone: "success",
    icon: <IconChart />,
  },
]

const STORE_ROWS: StoreRow[] = [
  {
    id: "BPS-000184",
    name: "CYTECH Gadgets",
    owner: "Emmanuel Agyeman",
    category: "Electronics",
    region: "Greater Accra",
    products: "248",
    purchases: "418",
    value: "GHS 412,880.00",
    verification: "Verified",
    operational: "Active",
    tone: "success",
  },
  {
    id: "BPS-000176",
    name: "Adepa Home",
    owner: "Mavis Serwaa",
    category: "Furniture",
    region: "Ashanti",
    products: "182",
    purchases: "276",
    value: "GHS 287,300.00",
    verification: "Pending Review",
    operational: "Restricted",
    tone: "admin",
  },
  {
    id: "BPS-000151",
    name: "Prime Mobility",
    owner: "Kojo Badu",
    category: "Automotive",
    region: "Greater Accra",
    products: "94",
    purchases: "141",
    value: "GHS 231,900.00",
    verification: "Verified",
    operational: "Active",
    tone: "success",
  },
  {
    id: "BPS-000143",
    name: "Nova Appliances",
    owner: "Yaw Kwarteng",
    category: "Home Appliances",
    region: "Central",
    products: "156",
    purchases: "193",
    value: "GHS 188,450.00",
    verification: "Verified",
    operational: "Suspended",
    tone: "danger",
  },
  {
    id: "BPS-000127",
    name: "Urban Style Hub",
    owner: "Naa Okailey",
    category: "Fashion",
    region: "Greater Accra",
    products: "116",
    purchases: "84",
    value: "GHS 98,120.00",
    verification: "Verified",
    operational: "Inactive",
    tone: "pending",
  },
]

const CUSTOMER_SUMMARY: Metric[] = [
  {
    title: "Total Customers",
    value: "12,842",
    detail: "All registered customer accounts",
    trend: "+14.5% vs Q2 2026",
    tone: "info",
    icon: <IconUsers />,
  },
  {
    title: "Verified Customers",
    value: "9,486",
    detail: "Passed ID and identity checks",
    trend: "+8.9% this quarter",
    tone: "success",
    icon: <IconCheckCircle />,
  },
  {
    title: "Verification Pending",
    value: "1,148",
    detail: "Waiting on identity or document review",
    trend: "126 need review today",
    tone: "pending",
    icon: <IconFile />,
  },
  {
    title: "Customers with Active Purchases",
    value: "3,286",
    detail: "Currently repaying financed products",
    trend: "+5.1% vs previous period",
    tone: "success",
    icon: <IconBag />,
  },
  {
    title: "Customers with Overdue Payments",
    value: "217",
    detail: "Missed one or more installments",
    trend: "+2.1% vs last week",
    tone: "danger",
    icon: <IconWarning />,
  },
  {
    title: "Restricted Accounts",
    value: "64",
    detail: "Under compliance or fraud controls",
    trend: "+5 this week",
    tone: "admin",
    icon: <IconLock />,
  },
  {
    title: "New Customers This Month",
    value: "486",
    detail: "Joined in August 2026",
    trend: "+6.7% vs July",
    tone: "info",
    icon: <IconChart />,
  },
]

const CUSTOMER_ROWS: CustomerRow[] = [
  {
    id: "BPC-001842",
    name: "Kwame Asante",
    initials: "KA",
    phone: "+233 24 601 1182",
    email: "kwame.asante@email.com",
    verification: "Verified",
    applications: "4",
    purchases: "2",
    paid: "GHS 6,450.00",
    outstanding: "GHS 1,820.00",
    paymentStatus: "Due Soon",
    risk: "Low Risk",
    account: "Active",
    region: "Greater Accra",
    tone: "success",
  },
  {
    id: "BPC-002117",
    name: "Ama Serwaa Owusu",
    initials: "AO",
    phone: "+233 20 918 4405",
    email: "ama.owusu@email.com",
    verification: "Verified",
    applications: "3",
    purchases: "1",
    paid: "GHS 3,200.00",
    outstanding: "GHS 4,960.00",
    paymentStatus: "Overdue",
    risk: "Medium Risk",
    account: "Overdue",
    region: "Ashanti",
    tone: "danger",
  },
  {
    id: "BPC-002344",
    name: "Kojo Mensah",
    initials: "KM",
    phone: "+233 55 440 9118",
    email: "kojo.mensah@email.com",
    verification: "Pending Review",
    applications: "1",
    purchases: "0",
    paid: "GHS 0.00",
    outstanding: "GHS 0.00",
    paymentStatus: "No Purchase",
    risk: "Review",
    account: "Verification Pending",
    region: "Eastern",
    tone: "pending",
  },
  {
    id: "BPC-002558",
    name: "Abena Tandoh",
    initials: "AT",
    phone: "+233 26 803 1007",
    email: "abena.tandoh@email.com",
    verification: "Verified",
    applications: "5",
    purchases: "3",
    paid: "GHS 12,980.00",
    outstanding: "GHS 650.00",
    paymentStatus: "Current",
    risk: "Low Risk",
    account: "Active",
    region: "Greater Accra",
    tone: "success",
  },
  {
    id: "BPC-002601",
    name: "Yaw Boateng",
    initials: "YB",
    phone: "+233 27 331 7004",
    email: "yaw.boateng@email.com",
    verification: "Verified",
    applications: "2",
    purchases: "1",
    paid: "GHS 1,540.00",
    outstanding: "GHS 2,100.00",
    paymentStatus: "Pending Verification",
    risk: "High Risk",
    account: "Restricted",
    region: "Central",
    tone: "admin",
  },
]

const TRANSACTION_SUMMARY: Metric[] = [
  {
    title: "Total Transaction Value",
    value: "GHS 2,845,920.00",
    detail: "Across payments, settlements, fees, refunds, and reversals",
    trend: "+10.6% vs July 2026",
    tone: "info",
    icon: <IconWallet />,
  },
  {
    title: "Successful Transactions",
    value: "18,420",
    detail: "Customer payments and approved settlements",
    trend: "+8.4% this month",
    tone: "success",
    icon: <IconCheckCircle />,
  },
  {
    title: "Pending Transactions",
    value: "126",
    detail: "Awaiting gateway or manual verification",
    trend: "21 need review today",
    tone: "pending",
    icon: <IconBell />,
  },
  {
    title: "Failed Transactions",
    value: "74",
    detail: "Retry or investigation required",
    trend: "-3.1% vs last week",
    tone: "danger",
    icon: <IconWarning />,
  },
  {
    title: "Refunded Amount",
    value: "GHS 48,620.00",
    detail: "Processed customer refunds and reversals",
    trend: "+4.8% vs July 2026",
    tone: "admin",
    icon: <IconArchive />,
  },
  {
    title: "Platform Fees Collected",
    value: "GHS 138,440.00",
    detail: "Net fees booked to AdepaPay",
    trend: "+9.7% vs previous month",
    tone: "admin",
    icon: <IconChart />,
  },
  {
    title: "Pending Store Settlements",
    value: "GHS 184,210.00",
    detail: "Due for Friday, August 7, 2026 batch",
    trend: "2 batches on hold",
    tone: "pending",
    icon: <IconStore />,
  },
  {
    title: "Suspicious Transactions",
    value: "19",
    detail: "Flagged for fraud or anomaly review",
    trend: "+3 since Monday, August 3, 2026",
    tone: "danger",
    icon: <IconLock />,
  },
]

const TRANSACTION_ROWS: TransactionRow[] = [
  {
    reference: "BPTX-241180",
    gatewayRef: "MOMO-GH-991182",
    customer: "Kwame Asante",
    store: "CYTECH Gadgets",
    purchase: "BPP-2026-00311",
    type: "Customer Installment",
    method: "MTN Mobile Money",
    gross: "GHS 1,100.00",
    fee: "GHS 16.00",
    net: "GHS 1,084.00",
    dateTime: "Tuesday, August 4, 2026 • 9:12 AM",
    paymentStatus: "Successful",
    settlementStatus: "Processing",
    risk: "Low Risk",
    tone: "success",
  },
  {
    reference: "BPTX-241171",
    gatewayRef: "CARD-GH-774201",
    customer: "Ama Serwaa Owusu",
    store: "Adepa Home",
    purchase: "BPP-2026-00192",
    type: "Deposit Payment",
    method: "Bank Card",
    gross: "GHS 820.00",
    fee: "GHS 14.50",
    net: "GHS 805.50",
    dateTime: "Tuesday, August 4, 2026 • 8:40 AM",
    paymentStatus: "Pending",
    settlementStatus: "Pending",
    risk: "Review",
    tone: "pending",
  },
  {
    reference: "BPTX-241124",
    gatewayRef: "TEL-GH-881012",
    customer: "Yaw Boateng",
    store: "Nova Appliances",
    purchase: "BPP-2026-00144",
    type: "Customer Installment",
    method: "Telecel Cash",
    gross: "GHS 695.00",
    fee: "GHS 10.00",
    net: "GHS 685.00",
    dateTime: "Monday, August 3, 2026 • 6:18 PM",
    paymentStatus: "Failed",
    settlementStatus: "Held",
    risk: "High Risk",
    tone: "danger",
  },
  {
    reference: "BPTX-241088",
    gatewayRef: "TRF-GH-550219",
    customer: "Abena Tandoh",
    store: "CYTECH Gadgets",
    purchase: "BPP-2026-00228",
    type: "Offline Payment",
    method: "Bank Transfer",
    gross: "GHS 968.00",
    fee: "GHS 0.00",
    net: "GHS 968.00",
    dateTime: "Monday, August 3, 2026 • 3:22 PM",
    paymentStatus: "Successful",
    settlementStatus: "Settled",
    risk: "Low Risk",
    tone: "success",
  },
  {
    reference: "BPTX-240990",
    gatewayRef: "SETTLE-GH-220118",
    customer: "AdepaPay Settlement Pool",
    store: "Prime Mobility",
    purchase: "Batch 08-01",
    type: "Store Settlement",
    method: "Bank Transfer",
    gross: "GHS 28,440.00",
    fee: "GHS 0.00",
    net: "GHS 28,440.00",
    dateTime: "Friday, August 1, 2026 • 4:10 PM",
    paymentStatus: "Successful",
    settlementStatus: "Settled",
    risk: "Low Risk",
    tone: "success",
  },
  {
    reference: "BPTX-240944",
    gatewayRef: "REV-GH-450012",
    customer: "Kojo Mensah",
    store: "Urban Style Hub",
    purchase: "BPP-2026-00088",
    type: "Refund",
    method: "Bank Card",
    gross: "GHS 1,150.00",
    fee: "GHS 0.00",
    net: "GHS 1,150.00",
    dateTime: "Thursday, July 30, 2026 • 11:44 AM",
    paymentStatus: "Refunded",
    settlementStatus: "Settled",
    risk: "Low Risk",
    tone: "admin",
  },
]

const REPORT_SUMMARY: Metric[] = [
  {
    title: "Total Registered Stores",
    value: "486",
    detail: "Platform-wide merchant base",
    trend: "+8.2% vs July 2026",
    tone: "info",
    icon: <IconStore />,
  },
  {
    title: "Active Stores",
    value: "422",
    detail: "Currently transacting stores",
    trend: "+17 this month",
    tone: "success",
    icon: <IconCheckCircle />,
  },
  {
    title: "Total Customers",
    value: "12,842",
    detail: "Registered customer accounts",
    trend: "+14.5% vs Q2 2026",
    tone: "info",
    icon: <IconUsers />,
  },
  {
    title: "Active Purchases",
    value: "3,286",
    detail: "Open repayment agreements",
    trend: "+5.1% vs previous period",
    tone: "success",
    icon: <IconBag />,
  },
  {
    title: "Total Transaction Value",
    value: "GHS 2,845,920.00",
    detail: "Gross movement across the platform",
    trend: "+10.6% vs July 2026",
    tone: "admin",
    icon: <IconWallet />,
  },
  {
    title: "Platform Revenue",
    value: "GHS 138,440.00",
    detail: "Service and transaction fees",
    trend: "+9.7% month over month",
    tone: "admin",
    icon: <IconChart />,
  },
  {
    title: "Outstanding Balance",
    value: "GHS 1,842,600.00",
    detail: "Outstanding financed balances",
    trend: "-3.4% vs July 2026",
    tone: "pending",
    icon: <IconWarning />,
  },
  {
    title: "Overdue Amount",
    value: "GHS 284,210.00",
    detail: "Late customer obligations",
    trend: "+2.1% vs last week",
    tone: "danger",
    icon: <IconWarning />,
  },
  {
    title: "Application Approval Rate",
    value: "47%",
    detail: "Submitted to approved conversion",
    trend: "+4.1% vs previous period",
    tone: "success",
    icon: <IconFile />,
  },
  {
    title: "Payment Success Rate",
    value: "93.4%",
    detail: "Across all payment channels",
    trend: "+1.3% vs previous period",
    tone: "success",
    icon: <IconCheckCircle />,
  },
]

const REPORT_LIBRARY: ReportItem[] = [
  {
    title: "Stores Report",
    description:
      "Store growth, distribution, operational status, and value metrics.",
  },
  {
    title: "Store Approval Report",
    description:
      "Onboarding pipeline, approval rates, and average review time.",
  },
  {
    title: "Customers Report",
    description:
      "Growth, verification, repayment health, and risk distribution.",
  },
  {
    title: "Products Report",
    description: "Approvals, suspensions, conversion, and category spread.",
  },
  {
    title: "Categories Report",
    description: "Category composition, performance, and stock trends.",
  },
  {
    title: "Applications Report",
    description:
      "Submitted, reviewed, approved, rejected, and cancelled applications.",
  },
  {
    title: "Purchases Report",
    description:
      "Active, completed, cancelled purchases and repayment behavior.",
  },
  {
    title: "Transactions Report",
    description: "Payments, refunds, reversals, settlements, and fees.",
  },
  {
    title: "Revenue Report",
    description:
      "Platform fees, store fees, recurring revenue, and comparisons.",
  },
  {
    title: "Settlement Report",
    description:
      "Gross payments, net settlements, pending batches, and differences.",
  },
  {
    title: "Outstanding Balance Report",
    description: "Open balances, overdue segments, and recovery exposure.",
  },
  {
    title: "Risk and Compliance Report",
    description: "Flags, suspicious activity, violations, and investigations.",
  },
  {
    title: "Audit Log Report",
    description: "Administrative activity and audit trail summaries.",
  },
]

const SETTINGS_SUMMARY: Metric[] = [
  {
    title: "Configuration Changes",
    value: "18",
    detail: "Updated in the last 30 days",
    trend: "4 pending confirmation",
    tone: "admin",
    icon: <IconCog />,
  },
  {
    title: "Gateway Health",
    value: "98.7%",
    detail: "Payment services operational",
    trend: "1 degraded provider",
    tone: "success",
    icon: <IconWallet />,
  },
  {
    title: "Security Policies",
    value: "12",
    detail: "Active password, session, and audit rules",
    trend: "2 require review",
    tone: "pending",
    icon: <IconLock />,
  },
  {
    title: "Backups",
    value: "Daily",
    detail: "Last successful backup Monday, August 3, 2026",
    trend: "Storage at 68%",
    tone: "info",
    icon: <IconArchive />,
  },
]

const SETTINGS_MENU: Array<{ id: SettingsTab label: string desc: string }> = [
  {
    id: "general",
    label: "General Platform Settings",
    desc: "Branding, contact, language, time, and maintenance mode",
  },
  {
    id: "stores",
    label: "Store Management Settings",
    desc: "Store onboarding, verification, suspension, and settlement rules",
  },
  {
    id: "customers",
    label: "Customer Settings",
    desc: "Registration, identity checks, limits, and data retention",
  },
  {
    id: "hire-purchase",
    label: "Hire-Purchase Settings",
    desc: "Deposits, durations, fees, and suspension rules",
  },
  {
    id: "products",
    label: "Product Settings",
    desc: "Approval rules, images, conditions, and review SLA",
  },
  {
    id: "payments",
    label: "Payment Settings",
    desc: "Providers, transaction limits, refunds, reversals, and settlements",
  },
  {
    id: "integrations",
    label: "Payment Gateway Integrations",
    desc: "Keys, webhooks, test mode, and gateway health",
  },
  {
    id: "communication",
    label: "Communication Settings",
    desc: "SMS, email, WhatsApp, templates, and sender settings",
  },
  {
    id: "notifications",
    label: "Notifications",
    desc: "Alert routing for critical platform events",
  },
  {
    id: "roles",
    label: "Roles and Permissions",
    desc: "Role definitions, permission matrix, and custom roles",
  },
  {
    id: "security",
    label: "Security Settings",
    desc: "Password policy, 2FA, sessions, IP rules, and encryption",
  },
  {
    id: "system",
    label: "System and Data",
    desc: "Backups, logs, storage, exports, and services",
  },
  {
    id: "legal",
    label: "Legal and Compliance",
    desc: "Policies, agreements, consent wording, and version history",
  },
  {
    id: "danger",
    label: "Dangerous Actions",
    desc: "Maintenance, registration pauses, resets, and platform lock actions",
  },
]

export default function CustomerPortal({
  role = "Admin",
  storeId = "cytech-gadgets",
  onLogout,
  onBrowseStores,
  onBrowseProducts,
}: {
  role?: "Customer" | "Store Manager" | "Admin"
  storeId?: string
  onLogout?: () => void
  onBrowseStores?: () => void
  onBrowseProducts?: () => void
}) {
  const [activeNav, setActiveNav] = useState<NavId>("dashboard")
  const [customerPhoto, setCustomerPhoto] = useState<string | null>(() => {
    try {
      return (
        localStorage.getItem(CUSTOMER_PHOTO_STORAGE_KEY) ||
        DEFAULT_CUSTOMER_PHOTO
      )
    } catch {
      return DEFAULT_CUSTOMER_PHOTO
    }
  })
  const updateCustomerPhoto = (photo: string | null) => {
    setCustomerPhoto(photo)
    if (photo) localStorage.setItem(CUSTOMER_PHOTO_STORAGE_KEY, photo)
    else localStorage.removeItem(CUSTOMER_PHOTO_STORAGE_KEY)
  }
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [state, setState] = useState<DashboardState>("normal")
  const [approvalTab, setApprovalTab] = useState<ApprovalTab>("all")
  const [storeTab, setStoreTab] = useState<StoreTab>("all")
  const [customerTab, setCustomerTab] = useState<CustomerTab>("all")
  const [transactionTab, setTransactionTab] = useState<TransactionTab>("all")
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general")

  const pageMeta: Record<NavId, { title: string crumb: string }> = {
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
    reports: { title: "Reports", crumb: "Admin Portal / Reports" },
    notifications: {
      title: "Notifications",
      crumb: "Admin Portal / Notifications",
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
  const currentMeta = pageMeta[activeNav]
  const portalNavItems =
    role === "Customer"
      ? CUSTOMER_NAV_ITEMS
      : role === "Store Manager"
        ? STORE_MANAGER_NAV_ITEMS
        : ADMIN_NAV_ITEMS

  useEffect(() => {
    document.title = `AdepaPay | ${currentMeta.title}`
  }, [currentMeta.title])

  return (
    <SwapDemoProvider>
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
                className="xl:hidden"
                onClick={() => setDrawerOpen(true)}
              >
                <IconMenu />
              </IconButton>

              {role === "Admin" && false ? (
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                    <span>{currentMeta.crumb}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-4">
                    <h1 className="truncate text-xl font-bold text-slate-900 sm:text-2xl">
                      {currentMeta.title}
                    </h1>
                    <div className="hidden flex-wrap items-center gap-2 lg:flex">
                      <StateButton
                        active={state === "normal"}
                        onClick={() => setState("normal")}
                      >
                        Normal
                      </StateButton>
                      <StateButton
                        active={state === "loading"}
                        onClick={() => setState("loading")}
                      >
                        Loading
                      </StateButton>
                      <StateButton
                        active={state === "empty"}
                        onClick={() => setState("empty")}
                      >
                        Empty
                      </StateButton>
                      <StateButton
                        active={state === "restricted"}
                        onClick={() => setState("restricted")}
                      >
                        Restricted
                      </StateButton>
                      <StateButton
                        active={state === "error"}
                        onClick={() => setState("error")}
                      >
                        Error
                      </StateButton>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1" />
              )}

              <div className="hidden min-w-[320px] items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 xl:flex">
                <IconSearch />
                <input
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  placeholder="Search stores, customers, transactions, logs..."
                />
              </div>

              <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 lg:flex">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {role === "Store Manager"
                  ? "Store operational"
                  : role === "Customer"
                    ? "Account verified"
                    : "Platform operational"}
              </div>

              <IconButton>
                <IconHelp />
              </IconButton>
              <div className="relative">
                <IconButton>
                  <IconBell />
                </IconButton>
                <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
                  12
                </span>
              </div>
              <button className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-blue-200 lg:flex">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-100 font-bold text-purple-700">
                  EM
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Emmanuel
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>
                      {role === "Store Manager"
                        ? "Store Manager"
                        : role === "Customer"
                          ? "Customer"
                          : "Platform Admin"}
                    </span>
                    <span className="rounded-full bg-purple-50 px-2 py-0.5 font-semibold text-purple-700">
                      {role === "Store Manager"
                        ? "CYTECH Gadgets"
                        : role === "Customer"
                          ? "Verified"
                          : "Super Admin"}
                    </span>
                  </div>
                </div>
                <IconChevron />
              </button>
            </div>
          </header>

          <main className="px-4 pb-8 pt-6 sm:px-6 lg:px-8">
            {state === "loading" && <LoadingGrid />}
            {state === "empty" && <EmptyState />}
            {state === "error" && <ErrorState />}
            {state === "restricted" && <RestrictedState />}
            {state === "normal" &&
              activeNav === "dashboard" &&
              (role === "Customer" ? (
                <CustomerDashboard onNavigate={setActiveNav} />
              ) : role === "Store Manager" ? (
                <StoreManagerDashboard onNavigate={setActiveNav} />
              ) : (
                <DashboardContent />
              ))}
            {state === "normal" &&
              role === "Admin" &&
              activeNav === "store-approvals" && (
                <StoreOnboardingApprovalsPage />
              )}
            {state === "normal" &&
              role === "Admin" &&
              activeNav === "stores" && (
                <StoresPage activeTab={storeTab} setActiveTab={setStoreTab} />
              )}
            {state === "normal" &&
              role === "Admin" &&
              activeNav === "subscriptions" && <AdminSubscriptionsPage />}
            {state === "normal" &&
              role === "Admin" &&
              activeNav === "customers" && (
                <CustomersPage
                  activeTab={customerTab}
                  setActiveTab={setCustomerTab}
                />
              )}
            {state === "normal" &&
              role === "Admin" &&
              activeNav === "transactions" && (
                <TransactionsPage
                  activeTab={transactionTab}
                  setActiveTab={setTransactionTab}
                />
              )}
            {state === "normal" &&
              role === "Admin" &&
              activeNav === "reports" && <ReportsPage />}
            {state === "normal" &&
              role === "Admin" &&
              activeNav === "settings" && (
                <SettingsPage
                  activeTab={settingsTab}
                  setActiveTab={setSettingsTab}
                />
              )}
            {state === "normal" &&
              role === "Admin" &&
              activeNav === "applications" && (
                <HirePurchaseReviewPage role="Admin" />
              )}
            {state === "normal" &&
              role === "Admin" &&
              activeNav === "swap-overview" && <SwapAdminOverviewPage />}
            {state === "normal" &&
              role === "Admin" &&
              activeNav === "layaway-plans" && <LayawayPlansPage />}
            {state === "normal" &&
              role === "Admin" &&
              activeNav === "collection-agents" && <CollectionAgentsPage />}
            {state === "normal" &&
              role === "Admin" &&
              activeNav === "agent-settlements" && <AgentSettlementsPage />}
            {state === "normal" &&
              role === "Customer" &&
              activeNav === "profile" && (
                <CustomerProfilePage
                  photo={customerPhoto}
                  onPhotoChange={updateCustomerPhoto}
                />
              )}
            {state === "normal" &&
              role === "Customer" &&
              activeNav === "stores" && (
                <CustomerBrowseStoresPage onNavigate={setActiveNav} />
              )}
            {state === "normal" &&
              role === "Customer" &&
              activeNav === "products" && (
                <CustomerBrowseProductsPage onNavigate={setActiveNav} />
              )}
            {state === "normal" &&
              role === "Customer" &&
              activeNav === "my-applications" && (
                <MyApplicationsPage
                  customerPhoto={customerPhoto}
                  onNavigate={setActiveNav}
                />
              )}
            {state === "normal" &&
              role === "Customer" &&
              activeNav === "my-swaps" && (
                <MySwapsPage
                  onNavigate={(page) => setActiveNav(page as NavId)}
                />
              )}
            {state === "normal" &&
              role === "Customer" &&
              activeNav === "swap-application" && (
                <SwapApplicationPage
                  onNavigate={(page) => setActiveNav(page as NavId)}
                />
              )}
            {state === "normal" &&
              role === "Customer" &&
              activeNav === "hire-purchase-application" && (
                <HirePurchaseApplicationPage />
              )}
            {state === "normal" &&
              role === "Customer" &&
              activeNav === "layaway-plans" && (
                <CustomerLayawayApplicationPage onNavigate={setActiveNav} />
              )}
            {state === "normal" &&
              role === "Customer" &&
              activeNav === "my-payment-plans" && (
                <CustomerLayawayPlansPage onNavigate={setActiveNav} />
              )}
            {state === "normal" &&
              role === "Customer" &&
              activeNav === "my-purchases" && <MyPurchasesPage />}
            {state === "normal" &&
              role === "Customer" &&
              activeNav === "payment-history" && <PaymentHistoryPage />}
            {state === "normal" &&
              role === "Customer" &&
              activeNav === "receipts" && <ReceiptsPage />}
            {state === "normal" &&
              activeNav === "notifications" &&
              role === "Customer" && <CustomerNotificationsPage />}
            {state === "normal" &&
              activeNav === "settings" &&
              role === "Customer" && <CustomerSettingsPage />}
            {state === "normal" &&
              role === "Store Manager" &&
              activeNav === "swap-management" && (
                <SwapManagementPage
                  onNavigate={(page) => setActiveNav(page as NavId)}
                />
              )}
            {state === "normal" &&
              role === "Store Manager" &&
              activeNav === "swap-settings" && <SwapSettingsPage />}
            {state === "normal" &&
              role === "Store Manager" &&
              activeNav === "trade-in-inventory" && <TradeInInventoryPage />}
            {state === "normal" &&
              role === "Store Manager" &&
              activeNav !== "dashboard" &&
              ![
                "swap-management",
                "swap-settings",
                "trade-in-inventory",
              ].includes(activeNav) && (
                <StoreManagerPage page={activeNav} storeId={storeId} />
              )}
            {state === "normal" &&
              role === "Admin" &&
              [
                "products",
                "categories",
                "active-purchases",
                "notifications",
                "audit-logs",
                "support",
              ].includes(activeNav) && <AdminModulePage page={activeNav} />}
          </main>
        </div>
      </div>
    </SwapDemoProvider>
  )
}

function ReportsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Reports and Analytics"
        description="Analyse AdepaPay platform performance and operational activities."
        actions={
          <>
            <Button variant="secondary">Date Range: Last 30 Days</Button>
            <Button variant="secondary">Export Report</Button>
            <Button variant="secondary">Schedule Report</Button>
            <Button>Compare Periods</Button>
          </>
        }
      />

      <Card className="p-3">
        <div className="flex gap-2 overflow-x-auto">
          {[
            "Today",
            "Yesterday",
            "Last 7 Days",
            "Last 30 Days",
            "This Month",
            "Previous Month",
            "This Quarter",
            "This Year",
            "Custom Date Range",
          ].map((chip, index) => (
            <button
              key={chip}
              className={`whitespace-nowrap rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                index === 3
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {chip}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {REPORT_SUMMARY.map((metric) => (
          <MetricCard key={metric.title} metric={metric} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartPanel
          title="Store Growth Report"
          description="Registrations, approvals, rejections, suspensions, active-store trend, and distribution by region."
          chips={["Monthly Trend", "By Region", "By Category"]}
          legend={[
            ["New store registrations", "bg-blue-600"],
            ["Approved stores", "bg-emerald-500"],
            ["Rejected stores", "bg-red-500"],
            ["Suspended stores", "bg-amber-500"],
            ["Active stores", "bg-purple-500"],
          ]}
          groups={[
            { label: "May", values: [22, 17, 3, 2, 344] },
            { label: "Jun", values: [25, 21, 2, 3, 386] },
            { label: "Jul", values: [31, 24, 4, 4, 422] },
            { label: "Aug", values: [9, 6, 1, 1, 427] },
          ]}
          footer="Store distribution highlight: Greater Accra leads with 38% of active stores, followed by Ashanti at 21%."
        />

        <ChartPanel
          title="Customer Analytics Report"
          description="New, verified, active-purchase, returning, overdue, and restricted customer trends."
          chips={["Growth Trend", "Regional Split", "Risk Split"]}
          legend={[
            ["New customers", "bg-blue-600"],
            ["Verified customers", "bg-emerald-500"],
            ["Active-purchase customers", "bg-purple-500"],
            ["Overdue customers", "bg-red-500"],
            ["Restricted accounts", "bg-amber-500"],
          ]}
          groups={[
            { label: "May", values: [366, 8240, 2810, 201, 51] },
            { label: "Jun", values: [392, 8614, 2984, 205, 56] },
            { label: "Jul", values: [455, 9122, 3171, 213, 61] },
            { label: "Aug", values: [486, 9486, 3286, 217, 64] },
          ]}
          footer="Regional distribution: Greater Accra 42%, Ashanti 24%, Eastern 14%, Central 11%, Other Regions 9%."
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartPanel
          title="Applications Report"
          description="Submitted, under review, approved, rejected, cancelled, average review time, and conversion."
          chips={["Volume", "Review Time", "Conversion"]}
          legend={[
            ["Submitted", "bg-blue-600"],
            ["Under review", "bg-amber-500"],
            ["Approved", "bg-emerald-500"],
            ["Rejected", "bg-red-500"],
            ["Cancelled", "bg-slate-500"],
          ]}
          groups={[
            { label: "Week 1", values: [24, 11, 9, 3, 1] },
            { label: "Week 2", values: [28, 12, 11, 3, 2] },
            { label: "Week 3", values: [31, 13, 12, 4, 2] },
            { label: "Week 4", values: [34, 15, 15, 4, 3] },
          ]}
          footer="Average review time is 2.8 days and approval conversion rate is 47% for the current reporting window."
        />

        <ChartPanel
          title="Products Report"
          description="Active, pending, suspended, most viewed, most applied-for, and highest-converting products."
          chips={["Category Split", "Store Split", "Performance"]}
          legend={[
            ["Active products", "bg-emerald-500"],
            ["Pending approval", "bg-amber-500"],
            ["Suspended products", "bg-red-500"],
            ["Most viewed", "bg-blue-600"],
            ["Highest converting", "bg-purple-500"],
          ]}
          groups={[
            { label: "Electronics", values: [812, 46, 12, 91, 52] },
            { label: "Furniture", values: [441, 18, 6, 56, 44] },
            { label: "Appliances", values: [367, 22, 9, 61, 39] },
            { label: "Fashion", values: [298, 14, 5, 38, 28] },
          ]}
          footer='Most viewed product remains Samsung 65" QLED TV, while MacBook Pro 14" M3 leads application conversion.'
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartPanel
          title="Purchases Report"
          description="Active, completed, cancelled purchases, value, repayment duration, and completion rate."
          chips={["By Store", "By Category", "Repayment Trend"]}
          legend={[
            ["Active purchases", "bg-blue-600"],
            ["Completed purchases", "bg-emerald-500"],
            ["Cancelled purchases", "bg-red-500"],
            ["Average repayment duration", "bg-purple-500"],
            ["Payment completion rate", "bg-amber-500"],
          ]}
          groups={[
            { label: "Q1", values: [2184, 540, 64, 8, 88] },
            { label: "Q2", values: [2740, 711, 71, 8, 90] },
            { label: "Q3", values: [3286, 904, 78, 8, 91] },
            { label: "Q4", values: [3364, 948, 81, 8, 92] },
          ]}
          footer="Average purchase value is GHS 6,058.82 and average repayment duration remains 8.4 months."
        />

        <ChartPanel
          title="Transactions Report"
          description="Gross value, success/failure, refunds, fees, settlements, and payment-method distribution."
          chips={["Volume Trend", "Method Split", "Settlement Split"]}
          legend={[
            ["Gross transaction value", "bg-blue-600"],
            ["Successful transactions", "bg-emerald-500"],
            ["Failed transactions", "bg-red-500"],
            ["Pending transactions", "bg-amber-500"],
            ["Processing fees", "bg-purple-500"],
          ]}
          groups={[
            { label: "May", values: [520, 448, 22, 11, 25] },
            { label: "Jun", values: [612, 521, 18, 13, 30] },
            { label: "Jul", values: [701, 609, 16, 12, 34] },
            { label: "Aug", values: [744, 632, 14, 11, 39] },
          ]}
          footer="Payment-method distribution remains led by Mobile Money at 58%, followed by cards at 24% and bank transfer at 18%."
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartPanel
          title="Revenue Report"
          description="Service fees, transaction fees, store fees, total revenue, recurring revenue, and comparisons."
          chips={["By Store", "By Type", "Period Comparison"]}
          legend={[
            ["Platform service fees", "bg-blue-600"],
            ["Transaction fees", "bg-emerald-500"],
            ["Store fees", "bg-purple-500"],
            ["Monthly recurring revenue", "bg-amber-500"],
          ]}
          groups={[
            { label: "May", values: [32, 41, 18, 22] },
            { label: "Jun", values: [34, 43, 19, 23] },
            { label: "Jul", values: [36, 46, 21, 24] },
            { label: "Aug", values: [38, 49, 22, 25] },
          ]}
          footer="Total revenue is GHS 138,440.00 with month-over-month growth of 9.7%."
        />

        <ChartPanel
          title="Risk and Compliance Report"
          description="Flags, suspicious transactions, overdue purchases, verification failures, and investigations."
          chips={["Risk Trend", "Open Cases", "Violations"]}
          legend={[
            ["Suspicious transactions", "bg-red-500"],
            ["Flagged customer accounts", "bg-amber-500"],
            ["Flagged stores", "bg-purple-500"],
            ["Verification failures", "bg-blue-600"],
            ["Open investigations", "bg-slate-500"],
          ]}
          groups={[
            { label: "Week 1", values: [14, 22, 6, 18, 7] },
            { label: "Week 2", values: [16, 25, 7, 16, 8] },
            { label: "Week 3", values: [18, 27, 8, 15, 8] },
            { label: "Week 4", values: [19, 29, 9, 14, 9] },
          ]}
          footer="Open compliance investigations: 9, including 3 policy-violating products and 2 held settlement batches."
        />
      </div>

      <Card className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-lg font-bold text-slate-900">
              Reports Library
            </div>
            <div className="mt-1 text-sm text-slate-500">
              Saved report filters, drill-down actions, and export-ready
              executive reporting.
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Saved filter: Executive Monthly Review • Compared against Previous
            Month
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {REPORT_LIBRARY.map((report) => (
            <div
              key={report.title}
              className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {report.title}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {report.description}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary">View Report</Button>
                  <Button variant="secondary">Download PDF</Button>
                  <Button variant="secondary">Download CSV</Button>
                  <Button variant="secondary">Download Excel</Button>
                  <Button variant="secondary">Print</Button>
                  <Button variant="secondary">Email Report</Button>
                  <Button>Schedule Recurring Report</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function SettingsPage({
  activeTab,
  setActiveTab,
}: {
  activeTab: SettingsTab
  setActiveTab: (tab: SettingsTab) => void
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[320px,minmax(0,1fr)]">
      <div className="space-y-4">
        <SectionHeader
          title="Platform Settings"
          description="Configure AdepaPay platform operations, security, payments, and integrations."
          actions={
            <>
              <Button variant="secondary">View Configuration History</Button>
              <Button>Save All Changes</Button>
            </>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
          {SETTINGS_SUMMARY.map((metric) => (
            <MetricCard key={metric.title} metric={metric} />
          ))}
        </div>

        <Card className="p-4">
          <div className="text-sm font-semibold text-slate-900">
            Settings Navigation
          </div>
          <div className="mt-1 text-sm text-slate-500">
            Responsive menu for platform configuration sections.
          </div>
          <div className="mt-4 space-y-2">
            {SETTINGS_MENU.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full rounded-2xl px-4 py-3 text-left transition ${
                  activeTab === item.id
                    ? "bg-blue-600 text-white"
                    : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <div className="text-sm font-semibold">{item.label}</div>
                <div
                  className={`mt-1 text-xs ${
                    activeTab === item.id ? "text-blue-100" : "text-slate-400"
                  }`}
                >
                  {item.desc}
                </div>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-lg font-bold text-slate-900">
                {SETTINGS_MENU.find((item) => item.id === activeTab)?.label}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {SETTINGS_MENU.find((item) => item.id === activeTab)?.desc}
              </div>
            </div>
            <div className="rounded-2xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-700">
              Last updated by Emmanuel on Tuesday, August 4, 2026 at 11:26 AM
            </div>
          </div>
        </Card>

        {activeTab === "general" && (
          <DrawerSection title="General Platform Settings">
            <GridInfo
              items={[
                ["Platform name", "AdepaPay"],
                ["Platform logo", "adepapay-logo.svg"],
                ["Favicon", "adepapay-favicon.ico"],
                ["Company email", "admin@adepapay.com"],
                ["Support email", "support@adepapay.com"],
                ["Support phone number", "+233 30 298 4401"],
                ["Business address", "Airport City, Accra, Ghana"],
                ["Default currency", "Ghana Cedi (GHS)"],
                ["Time zone", "Africa/Accra"],
                ["Default language", "English"],
                ["Date and time format", "DD MMM YYYY, 24-hour"],
                ["Maintenance mode toggle", "Disabled"],
              ]}
            />
          </DrawerSection>
        )}

        {activeTab === "stores" && (
          <DrawerSection title="Store Management Settings">
            <GridInfo
              items={[
                ["Enable new store registrations", "Enabled"],
                ["Automatic store acknowledgement", "Enabled"],
                ["Require administrator approval", "Required"],
                [
                  "Required store documents",
                  "Registration, tax, address, settlement",
                ],
                ["Store verification expiry period", "12 months"],
                ["Minimum store profile completion", "85%"],
                ["Allow stores to pause operations", "Enabled"],
                [
                  "Store suspension rules",
                  "Policy, fraud, settlement, compliance",
                ],
                ["Store commission rate", "6.5%"],
                ["Store settlement frequency", "Weekly"],
              ]}
            />
          </DrawerSection>
        )}

        {activeTab === "customers" && (
          <DrawerSection title="Customer Settings">
            <GridInfo
              items={[
                ["Enable customer registration", "Enabled"],
                ["Required customer verification", "Mandatory"],
                ["Required identity documents", "Ghana Card, selfie"],
                ["Minimum customer age", "18 years"],
                ["Ghana Card verification", "Enabled"],
                ["Phone verification", "Enabled"],
                ["Email verification", "Enabled"],
                ["Maximum active purchases", "4"],
                [
                  "Account restriction rules",
                  "Fraud, overdue, dispute, compliance",
                ],
                ["Customer data retention period", "7 years"],
              ]}
            />
          </DrawerSection>
        )}

        {activeTab === "hire-purchase" && (
          <DrawerSection title="Hire-Purchase Settings">
            <GridInfo
              items={[
                ["Minimum deposit percentage", "15%"],
                ["Maximum deposit percentage", "60%"],
                ["Available repayment durations", "3, 6, 9, 12 months"],
                ["Weekly repayment toggle", "Enabled"],
                ["Monthly repayment toggle", "Enabled"],
                ["Maximum financed amount", "GHS 50,000.00"],
                ["Minimum financed amount", "GHS 500.00"],
                ["Grace period", "3 days"],
                ["Late-payment fee", "GHS 25.00"],
                ["Maximum overdue days", "30 days"],
                [
                  "Automatic purchase suspension",
                  "Enabled after 30 overdue days",
                ],
                ["Application expiry period", "14 days"],
              ]}
            />
          </DrawerSection>
        )}

        {activeTab === "products" && (
          <DrawerSection title="Product Settings">
            <GridInfo
              items={[
                ["Require product approval", "Enabled"],
                ["Allowed product conditions", "New, Refurbished, Used"],
                ["Maximum product images", "8"],
                ["Maximum image file size", "5 MB"],
                [
                  "Restricted product categories",
                  "Weapons, gambling, adult, illegal imports",
                ],
                ["Prohibited product keywords", "Configured blacklist"],
                [
                  "Minimum product-information requirements",
                  "Description, pricing, specs, warranty",
                ],
                ["Product-review SLA", "24 hours"],
                ["Automatically hide out-of-stock products", "Enabled"],
              ]}
            />
          </DrawerSection>
        )}

        {activeTab === "payments" && (
          <DrawerSection title="Payment Settings">
            <GridInfo
              items={[
                [
                  "Supported Mobile Money providers",
                  "MTN, Telecel, AirtelTigo",
                ],
                ["MTN Mobile Money", "Enabled"],
                ["Telecel Cash", "Enabled"],
                ["AirtelTigo Money", "Enabled"],
                ["Card payment toggle", "Enabled"],
                ["Bank transfer toggle", "Enabled"],
                ["Offline payment toggle", "Enabled"],
                ["Payment-processing fee", "1.45%"],
                ["Minimum transaction amount", "GHS 5.00"],
                ["Maximum transaction amount", "GHS 100,000.00"],
                ["Refund rules", "Authorized admins only"],
                ["Reversal rules", "Gateway and finance review required"],
                ["Settlement schedule", "Every Friday"],
                ["Settlement hold period", "48 hours"],
              ]}
            />
          </DrawerSection>
        )}

        {activeTab === "integrations" && (
          <DrawerSection title="Payment Gateway Integrations">
            <GridInfo
              items={[
                ["Paystack configuration", "Configured"],
                ["Flutterwave configuration", "Configured"],
                ["Mobile Money API credentials", "Configured"],
                ["Webhook URLs", "3 registered endpoints"],
                ["Public key", "pk_live_********"],
                ["Masked secret key", "sk_live_********"],
                ["Test mode toggle", "Disabled"],
                ["Live mode toggle", "Enabled"],
                ["Verify Connection button", "Available"],
                ["Gateway health status", "Operational"],
                ["Transaction callback status", "Healthy"],
              ]}
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <Button variant="secondary">Verify Connection</Button>
              <Button variant="secondary">View Webhook Logs</Button>
            </div>
          </DrawerSection>
        )}

        {activeTab === "communication" && (
          <DrawerSection title="Communication Settings">
            <GridInfo
              items={[
                ["SMS provider", "Hubtel"],
                ["Email provider", "SendGrid"],
                ["WhatsApp provider", "Meta Business API"],
                ["Sender name", "AdepaPay Ghana"],
                ["SMS templates", "Configured"],
                ["Email templates", "Configured"],
                ["Application notification templates", "Configured"],
                ["Payment reminder templates", "Configured"],
                ["Overdue reminder templates", "Configured"],
                ["Store approval templates", "Configured"],
                ["Customer security alerts", "Enabled"],
                ["Test Message button", "Available"],
              ]}
            />
            <div className="mt-4">
              <Button variant="secondary">Test Message</Button>
            </div>
          </DrawerSection>
        )}

        {activeTab === "notifications" && (
          <DrawerSection title="Notifications">
            <GridInfo
              items={[
                ["New store-registration alerts", "Enabled"],
                ["High-value transaction alerts", "Enabled"],
                ["Failed payment alerts", "Enabled"],
                ["Suspicious activity alerts", "Enabled"],
                ["Overdue payment alerts", "Enabled"],
                ["Settlement failure alerts", "Enabled"],
                ["Product policy violation alerts", "Enabled"],
                ["System downtime alerts", "Enabled"],
                ["Email notifications", "Enabled"],
                ["SMS notifications", "Enabled"],
                ["Push notifications", "Enabled"],
              ]}
            />
          </DrawerSection>
        )}

        {activeTab === "roles" && (
          <DrawerSection title="Roles and Permissions">
            <GridInfo
              items={[
                ["Super Administrator", "Full access"],
                ["Compliance Officer", "Risk, flags, investigations"],
                ["Finance Administrator", "Transactions, settlements, refunds"],
                ["Store Administrator", "Store and product governance"],
                ["Customer Support", "Customer communication and reviews"],
                ["Report Viewer", "Read-only analytics access"],
                ["Custom role creation", "Enabled"],
                ["Permission matrix", "Configured"],
                ["View permission", "Available"],
                ["Create permission", "Available"],
                ["Edit permission", "Available"],
                ["Approve permission", "Available"],
                ["Delete permission", "Restricted"],
                ["Export permission", "Available"],
              ]}
            />
          </DrawerSection>
        )}

        {activeTab === "security" && (
          <DrawerSection title="Security Settings">
            <GridInfo
              items={[
                ["Password policy", "Strong"],
                ["Minimum password length", "12 characters"],
                ["Password expiry", "90 days"],
                [
                  "Two-factor authentication requirement",
                  "Mandatory for admins",
                ],
                ["Login-attempt limit", "5 attempts"],
                ["Account lockout duration", "30 minutes"],
                ["Session timeout", "20 minutes"],
                ["IP restriction", "Enabled for finance roles"],
                ["Device verification", "Enabled"],
                ["Login alerts", "Enabled"],
                ["Audit logging", "Enabled"],
                ["Encryption status", "AES-256 active"],
                ["API rate limiting", "Enabled"],
              ]}
            />
            <div className="mt-4 rounded-[24px] border border-purple-200 bg-purple-50 p-4 text-purple-700">
              Two-factor confirmation modal and administrator PIN confirmation
              are required for high-impact security changes.
            </div>
          </DrawerSection>
        )}

        {activeTab === "system" && (
          <DrawerSection title="System and Data">
            <GridInfo
              items={[
                ["Database backup schedule", "Daily at 2:00 AM"],
                ["Data-retention period", "7 years"],
                ["Export platform data", "Available"],
                ["Clear temporary files", "Available"],
                ["System cache", "Healthy"],
                ["API logs", "Available"],
                ["Webhook logs", "Available"],
                ["Error logs", "Available"],
                ["Background service status", "Operational"],
                ["Storage usage", "68% of allocated storage"],
                ["Backup Now button", "Available"],
                ["Restore Backup button", "Restricted"],
              ]}
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <Button variant="secondary">Backup Now</Button>
              <Button variant="secondary">Restore Backup</Button>
              <Button variant="secondary">Export Platform Data</Button>
            </div>
          </DrawerSection>
        )}

        {activeTab === "legal" && (
          <DrawerSection title="Legal and Compliance">
            <GridInfo
              items={[
                ["Terms and Conditions", "Version 4.2"],
                ["Privacy Policy", "Version 3.8"],
                ["Store Agreement", "Version 5.0"],
                ["Customer Hire-Purchase Agreement", "Version 4.4"],
                ["Refund Policy", "Version 2.9"],
                ["Data Protection Policy", "Version 3.1"],
                ["Consent wording", "Configured"],
                ["Document version history", "Available"],
                ["Publish Updated Policy button", "Available"],
                ["Require users to accept new terms", "Enabled"],
              ]}
            />
            <div className="mt-4">
              <Button>Publish Updated Policy</Button>
            </div>
          </DrawerSection>
        )}

        {activeTab === "danger" && (
          <DrawerSection title="Dangerous Actions">
            <div className="space-y-4">
              {[
                [
                  "Enable maintenance mode",
                  "Temporarily block public platform access while preserving admin access.",
                ],
                [
                  "Disable new registrations",
                  "Prevent new store and customer signups platform-wide.",
                ],
                [
                  "Pause all payments",
                  "Disable transaction acceptance across payment channels.",
                ],
                [
                  "Pause store settlements",
                  "Stop payout processing to partner stores.",
                ],
                [
                  "Lock administrator access",
                  "Restrict admin entry to emergency recovery accounts only.",
                ],
                [
                  "Reset platform configuration",
                  "Restore platform settings to a baseline state.",
                ],
                [
                  "Deactivate platform",
                  "Disable the full AdepaPay environment.",
                ],
                [
                  "Delete test data",
                  "Remove non-production seeded records from the environment.",
                ],
              ].map(([title, body]) => (
                <div
                  key={title}
                  className="rounded-[24px] border border-red-200 bg-red-50 p-4 text-red-700"
                >
                  <div className="text-sm font-bold">{title}</div>
                  <div className="mt-1 text-sm">{body}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-amber-700">
              Unsaved-changes warning, administrator PIN confirmation, and
              two-factor confirmation are required before any dangerous action
              is executed.
            </div>
          </DrawerSection>
        )}

        <Card className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-lg font-bold text-slate-900">
                Configuration History and Audit Trail
              </div>
              <div className="mt-1 text-sm text-slate-500">
                Recent platform-setting updates with administrator traceability.
              </div>
            </div>
            <Pill tone="admin">Audit Trail Enabled</Pill>
          </div>
          <div className="mt-5">
            <Timeline
              items={[
                {
                  title: "Payment-processing fee updated",
                  body: "Finance Administrator adjusted fee from 1.40% to 1.45%.",
                  date: "Tuesday, August 4, 2026 • 10:12 AM",
                },
                {
                  title: "Security session timeout updated",
                  body: "Session timeout reduced from 30 to 20 minutes.",
                  date: "Monday, August 3, 2026 • 4:45 PM",
                },
                {
                  title: "Store verification expiry changed",
                  body: "Verification expiry extended from 9 to 12 months.",
                  date: "Monday, August 3, 2026 • 11:10 AM",
                },
              ]}
            />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="secondary">View Configuration History</Button>
            <Button variant="secondary">Open Audit Trail</Button>
            <Button>Save Changes</Button>
          </div>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <div className="text-sm font-bold text-emerald-800">
            Success notifications and error alerts
          </div>
          <div className="mt-1 text-sm text-emerald-700">
            Platform settings changes show real-time validation, success
            confirmation, and error alerts before publishing to production.
          </div>
        </Card>
      </div>
    </div>
  )
}

function TransactionsPage({
  activeTab,
  setActiveTab,
}: {
  activeTab: TransactionTab
  setActiveTab: (tab: TransactionTab) => void
}) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [refundOpen, setRefundOpen] = useState(false)
  const tabs: Array<{ id: TransactionTab label: string }> = [
    { id: "all", label: "All Transactions" },
    { id: "customer-payments", label: "Customer Payments" },
    { id: "store-settlements", label: "Store Settlements" },
    { id: "pending", label: "Pending" },
    { id: "failed", label: "Failed" },
    { id: "refunded", label: "Refunded" },
    { id: "reversed", label: "Reversed" },
    { id: "offline", label: "Offline Payments" },
    { id: "flagged", label: "Flagged Transactions" },
  ]

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Transactions"
        description="Monitor payments, settlements, refunds, and platform transaction activities."
        actions={
          <>
            <Button variant="secondary">Export Transactions</Button>
            <Button>Reconcile Transactions</Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {TRANSACTION_SUMMARY.map((metric) => (
          <MetricCard key={metric.title} metric={metric} />
        ))}
      </div>

      <Card className="p-5">
        <div className="grid gap-4 xl:grid-cols-[1fr,0.95fr]">
          <div className="rounded-[24px] border border-red-200 bg-red-50 p-4 text-red-700">
            <div className="text-sm font-bold">
              High-value and suspicious activity alerts
            </div>
            <div className="mt-1 text-sm">
              3 high-value transactions above GHS 15,000.00 and 19 flagged
              transactions require administrator follow-up on Tuesday, August 4,
              2026.
            </div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">
              Reconciliation overview
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <InfoTile label="Gateway transaction count" value="18,716" />
              <InfoTile label="AdepaPay transaction count" value="18,702" />
              <InfoTile label="Matched transactions" value="18,664" />
              <InfoTile label="Unmatched transactions" value="38" />
              <InfoTile label="Settlement difference" value="GHS 1,842.50" />
              <InfoTile label="Reconcile action" value="Ready to run" />
            </div>
            <div className="mt-4">
              <Button>Reconcile Now</Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-3">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <div className="grid gap-3 lg:grid-cols-6">
          <FilterBox label="Transaction reference" value="BPTX-241180" />
          <FilterBox label="Gateway reference" value="MOMO-GH-991182" />
          <FilterBox label="Customer name" value="Kwame Asante" />
          <FilterBox label="Customer ID" value="BPC-001842" />
          <FilterBox label="Store name" value="CYTECH Gadgets" />
          <FilterBox label="Store ID" value="BPS-000184" />
          <FilterBox label="Purchase reference" value="BPP-2026-00311" />
          <FilterBox label="Transaction type" value="All types" />
          <FilterBox label="Payment method" value="All methods" />
          <FilterBox label="Payment status" value="All statuses" />
          <FilterBox label="Settlement status" value="All settlement states" />
          <FilterBox label="Date range" value="Jul 1, 2026 - Aug 4, 2026" />
          <FilterBox label="Amount range" value="GHS 0 - GHS 50,000" />
          <FilterBox label="Risk level" value="All risk levels" />
          <FilterBox label="Sort by" value="Risk" />
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary">Export Selected</Button>
          <Button variant="secondary">Verify Transaction</Button>
          <Button variant="secondary">Retry Verification</Button>
          <Button variant="secondary">Hold Settlement</Button>
          <Button variant="secondary">Release Settlement</Button>
          <Button variant="secondary">Flag Transaction</Button>
        </div>
      </Card>

      <div className="hidden xl:block">
        <TableCard
          title="Transactions Management Table"
          description="Monitor customer payments, settlements, refunds, reversals, fees, offline payments, and suspicious activity."
        >
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {[
                  "",
                  "Transaction reference",
                  "Customer",
                  "Store",
                  "Purchase reference",
                  "Transaction type",
                  "Payment method",
                  "Gross amount",
                  "Processing fee",
                  "Net amount",
                  "Date and time",
                  "Payment status",
                  "Settlement status",
                  "Risk indicator",
                  "Actions",
                ].map((head) => (
                  <th key={head} className="px-4 py-3 text-left font-semibold">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TRANSACTION_ROWS.map((row) => (
                <tr key={row.reference} className="border-t border-slate-200">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {row.reference}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.customer}</td>
                  <td className="px-4 py-3 text-slate-700">{row.store}</td>
                  <td className="px-4 py-3 text-slate-700">{row.purchase}</td>
                  <td className="px-4 py-3 text-slate-700">{row.type}</td>
                  <td className="px-4 py-3 text-slate-700">{row.method}</td>
                  <td className="px-4 py-3 text-slate-700">{row.gross}</td>
                  <td className="px-4 py-3 text-slate-700">{row.fee}</td>
                  <td className="px-4 py-3 text-slate-700">{row.net}</td>
                  <td className="px-4 py-3 text-slate-700">{row.dateTime}</td>
                  <td className="px-4 py-3">
                    <Pill
                      tone={
                        row.paymentStatus === "Successful"
                          ? "success"
                          : row.paymentStatus === "Pending"
                            ? "pending"
                            : row.paymentStatus === "Refunded"
                              ? "admin"
                              : "danger"
                      }
                    >
                      {row.paymentStatus}
                    </Pill>
                  </td>
                  <td className="px-4 py-3">
                    <Pill
                      tone={
                        row.settlementStatus === "Settled"
                          ? "success"
                          : row.settlementStatus === "Processing" ||
                              row.settlementStatus === "Pending"
                            ? "pending"
                            : row.settlementStatus === "Held"
                              ? "danger"
                              : "admin"
                      }
                    >
                      {row.settlementStatus}
                    </Pill>
                  </td>
                  <td className="px-4 py-3">
                    <Pill
                      tone={
                        row.risk === "Low Risk"
                          ? "success"
                          : row.risk === "High Risk"
                            ? "danger"
                            : "admin"
                      }
                    >
                      {row.risk}
                    </Pill>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-2">
                      <ActionLink onClick={() => setDrawerOpen(true)}>
                        View Transaction
                      </ActionLink>
                      <ActionLink>View Customer</ActionLink>
                      <ActionLink>View Store</ActionLink>
                      <ActionLink>View Purchase</ActionLink>
                      <ActionLink>Download Receipt</ActionLink>
                      <ActionLink>Verify Transaction</ActionLink>
                      <ActionLink>Retry Verification</ActionLink>
                      <ActionLink onClick={() => setRefundOpen(true)}>
                        Initiate Refund
                      </ActionLink>
                      <ActionLink>Hold Settlement</ActionLink>
                      <ActionLink>Release Settlement</ActionLink>
                      <ActionLink>Flag Transaction</ActionLink>
                      <ActionLink>Report Issue</ActionLink>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      </div>

      <div className="grid gap-4 xl:hidden">
        {TRANSACTION_ROWS.map((row) => (
          <Card key={row.reference} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-bold text-slate-900">
                  {row.reference}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {row.customer} • {row.store}
                </div>
              </div>
              <Pill tone={row.tone}>{row.paymentStatus}</Pill>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <InfoTile label="Type" value={row.type} />
              <InfoTile label="Method" value={row.method} />
              <InfoTile label="Gross amount" value={row.gross} />
              <InfoTile label="Risk" value={row.risk} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
                View Transaction
              </Button>
              <Button variant="secondary" onClick={() => setRefundOpen(true)}>
                Refund
              </Button>
              <Button variant="secondary">Flag</Button>
            </div>
          </Card>
        ))}
      </div>

      {drawerOpen && (
        <TransactionDetailsDrawer onClose={() => setDrawerOpen(false)} />
      )}
      {refundOpen && <RefundModal onClose={() => setRefundOpen(false)} />}
    </div>
  )
}

function DashboardContent() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Good morning, Emmanuel"
        description="Here is the latest overview of the AdepaPay platform."
        actions={
          <>
            <Button variant="secondary">Review Pending Stores</Button>
            <Button variant="secondary">View Transactions</Button>
            <Button>Generate Report</Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {METRICS.map((metric) => (
          <MetricCard key={metric.title} metric={metric} />
        ))}
      </div>

      <LayawayDashboardSection />

      <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
        <ChartPanel
          title="Platform Transactions Overview"
          description="Daily, weekly, monthly, and quarterly performance across transaction value, success, failure, pending volume, and platform fees."
          chips={["Daily", "Weekly", "Monthly", "Quarterly", "Custom Range"]}
          legend={[
            ["Total transaction value", "bg-blue-600"],
            ["Successful transactions", "bg-emerald-500"],
            ["Failed transactions", "bg-red-500"],
            ["Pending transactions", "bg-amber-500"],
            ["Platform fees collected", "bg-purple-500"],
          ]}
          groups={[
            { label: "Week 1", values: [88, 74, 8, 10, 26] },
            { label: "Week 2", values: [92, 79, 7, 11, 29] },
            { label: "Week 3", values: [96, 83, 6, 9, 31] },
            { label: "Week 4", values: [100, 86, 9, 12, 34] },
          ]}
          footer="Platform fees collected are up 9.7% compared with the previous 30-day period."
        />

        <ChartPanel
          title="Store Growth"
          description="New stores registered, approved, rejected, active, and suspended."
          chips={["Last 30 Days", "This Quarter", "This Year"]}
          legend={[
            ["New stores registered", "bg-blue-600"],
            ["Stores approved", "bg-emerald-500"],
            ["Stores rejected", "bg-red-500"],
            ["Active stores", "bg-purple-500"],
            ["Suspended stores", "bg-amber-500"],
          ]}
          groups={[
            { label: "Apr", values: [18, 14, 2, 302, 9] },
            { label: "May", values: [22, 17, 3, 344, 11] },
            { label: "Jun", values: [25, 21, 2, 386, 14] },
            { label: "Jul", values: [31, 24, 4, 422, 18] },
          ]}
          footer="Store approval rate is 77% for the current 30-day reporting period."
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr,0.9fr]">
        <TableCard
          title="Recent Store Applications"
          description="Latest store registrations awaiting platform review."
        >
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {[
                  "Store name",
                  "Store owner",
                  "Business category",
                  "Registration date",
                  "Verification progress",
                  "Risk indicator",
                  "Application status",
                  "Review",
                ].map((head) => (
                  <th key={head} className="px-4 py-3 text-left font-semibold">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STORE_APPLICATIONS.map((row) => (
                <tr key={row[0]} className="border-t border-slate-200">
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {row[0]}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row[1]}</td>
                  <td className="px-4 py-3 text-slate-700">{row[2]}</td>
                  <td className="px-4 py-3 text-slate-700">{row[3]}</td>
                  <td className="px-4 py-3 text-slate-700">{row[4]}</td>
                  <td className="px-4 py-3">
                    <Pill tone={row[5].includes("Low") ? "success" : "pending"}>
                      {row[5]}
                    </Pill>
                  </td>
                  <td className="px-4 py-3">
                    <Pill
                      tone={
                        row[6].includes("Approved")
                          ? "success"
                          : row[6].includes("Pending") ||
                              row[6].includes("Review")
                            ? "pending"
                            : "danger"
                      }
                    >
                      {row[6]}
                    </Pill>
                  </td>
                  <td className="px-4 py-3">
                    <ActionLink>Review</ActionLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>

        <Card className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-bold text-slate-900">
                Platform Service Status
              </div>
              <div className="mt-1 text-sm text-slate-500">
                Operational health across critical AdepaPay services.
              </div>
            </div>
            <Pill tone="admin">System Level</Pill>
          </div>
          <div className="mt-5 space-y-3">
            <ServiceRow
              label="Platform operational status"
              status="Operational"
              tone="success"
            />
            <ServiceRow
              label="Payment gateway status"
              status="Minor latency"
              tone="pending"
            />
            <ServiceRow
              label="SMS service status"
              status="Operational"
              tone="success"
            />
            <ServiceRow
              label="Email service status"
              status="Operational"
              tone="success"
            />
            <ServiceRow
              label="Identity verification service status"
              status="Operational"
              tone="success"
            />
            <ServiceRow
              label="Pending administrative tasks"
              status="17 open tasks"
              tone="admin"
            />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr,1fr]">
        <TableCard
          title="Recent Transactions"
          description="Latest platform-wide customer and settlement activity."
        >
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {[
                  "Transaction reference",
                  "Customer",
                  "Store",
                  "Type",
                  "Amount",
                  "Method",
                  "Date and time",
                  "Status",
                  "View",
                ].map((head) => (
                  <th key={head} className="px-4 py-3 text-left font-semibold">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TRANSACTIONS.map((row) => (
                <tr key={row[0]} className="border-t border-slate-200">
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {row[0]}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row[1]}</td>
                  <td className="px-4 py-3 text-slate-700">{row[2]}</td>
                  <td className="px-4 py-3 text-slate-700">{row[3]}</td>
                  <td className="px-4 py-3 text-slate-700">{row[4]}</td>
                  <td className="px-4 py-3 text-slate-700">{row[5]}</td>
                  <td className="px-4 py-3 text-slate-700">{row[6]}</td>
                  <td className="px-4 py-3">
                    <Pill
                      tone={
                        row[7] === "Successful"
                          ? "success"
                          : row[7] === "Pending"
                            ? "pending"
                            : "danger"
                      }
                    >
                      {row[7]}
                    </Pill>
                  </td>
                  <td className="px-4 py-3">
                    <ActionLink>View</ActionLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>

        <Card className="p-5">
          <div className="text-lg font-bold text-slate-900">
            Platform Alerts
          </div>
          <div className="mt-1 text-sm text-slate-500">
            Warnings, suspicious activity, settlement failures, and policy
            issues.
          </div>
          <div className="mt-5 space-y-3">
            {ALERTS.map(([title, body, tone]) => (
              <div
                key={title}
                className={`rounded-[24px] border p-4 ${alertClasses(tone)}`}
              >
                <div className="text-sm font-bold">{title}</div>
                <div className="mt-1 text-sm">{body}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <Card className="p-5">
          <div className="text-lg font-bold text-slate-900">Top Stores</div>
          <div className="mt-1 text-sm text-slate-500">
            Store sales, active purchases, customer counts, payment completion,
            and trend.
          </div>
          <div className="mt-5 space-y-3">
            {TOP_STORES.map((store, index) => (
              <div
                key={store[0]}
                className="flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 font-bold text-blue-700">
                    {index + 1}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {store[0]}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Sales {store[1]} • Active purchases {store[2]}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-slate-600 sm:text-right">
                  <span>Customers {store[3]}</span>
                  <span>Completion {store[4]}</span>
                  <span className="col-span-2 font-semibold text-emerald-600">
                    {store[5]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MiniMetric
              title="Customer growth analytics"
              value="+14.5%"
              detail="Compared with Q2 2026"
              tone="success"
            />
            <MiniMetric
              title="Application approval rate"
              value="47%"
              detail="Platform-wide approval conversion"
              tone="pending"
            />
            <MiniMetric
              title="Store approval rate"
              value="77%"
              detail="Current 30-day window"
              tone="success"
            />
            <MiniMetric
              title="Payment success rate"
              value="93.4%"
              detail="Across all active payment channels"
              tone="success"
            />
            <MiniMetric
              title="Outstanding balance trend"
              value="-3.4%"
              detail="Lower than July 2026"
              tone="info"
            />
            <MiniMetric
              title="Administrative tasks"
              value="17"
              detail="Open review and compliance actions"
              tone="admin"
            />
          </div>

          <Card className="p-5">
            <div className="text-lg font-bold text-slate-900">
              Administrative Task Checklist
            </div>
            <div className="mt-1 text-sm text-slate-500">
              Priority work items for Tuesday, August 4, 2026.
            </div>
            <div className="mt-5 space-y-3">
              {CHECKLIST.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 text-purple-700">
                    <IconCheckSmall />
                  </span>
                  <span className="text-sm font-medium text-slate-700">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-lg font-bold text-slate-900">
              Recent Audit Activities
            </div>
            <div className="mt-1 text-sm text-slate-500">
              Recent system and administrator activity across the platform.
            </div>
            <Timeline
              items={[
                {
                  title: "Store registration submitted",
                  body: "Adepa Home submitted updated settlement documents.",
                  date: "Today • 9:30 AM",
                },
                {
                  title: "Store approved",
                  body: "Prime Mobility moved from pending to approved.",
                  date: "Today • 8:42 AM",
                },
                {
                  title: "Product suspended",
                  body: "One product suspended for policy violation review.",
                  date: "Yesterday • 6:14 PM",
                },
                {
                  title: "Customer account flagged",
                  body: "Fraud rules triggered enhanced monitoring.",
                  date: "Yesterday • 4:08 PM",
                },
                {
                  title: "High-value transaction completed",
                  body: "GHS 18,000.00 purchase closed successfully.",
                  date: "Yesterday • 3:22 PM",
                },
                {
                  title: "Administrator setting updated",
                  body: "Gateway retry threshold updated by Emmanuel.",
                  date: "Yesterday • 11:05 AM",
                },
              ]}
            />
          </Card>
        </div>
      </div>
    </div>
  )
}

type LayawayPlan = {
  reference: string
  customer: string
  customerId: string
  store: string
  product: string
  sku: string
  price: number
  deposit: number
  paid: number
  frequency: "Daily" | "Weekly" | "Custom"
  nextPayment: string
  reservation: string
  status: string
  agent: string
  created: string
}

const LAYAWAY_PLANS: LayawayPlan[] = [
  {
    reference: "LAY-2026-004582",
    customer: "Ama Owusu",
    customerId: "BPC-002117",
    store: "CYTECH Gadgets",
    product: "Samsung Galaxy S25",
    sku: "CY-S25-256",
    price: 8400,
    deposit: 1680,
    paid: 3500,
    frequency: "Weekly",
    nextPayment: "Aug 28, 2026",
    reservation: "Reserved",
    status: "Partially Paid",
    agent: "Kofi Mensah",
    created: "Jul 02, 2026",
  },
  {
    reference: "LAY-2026-004511",
    customer: "Kwame Asante",
    customerId: "BPC-001842",
    store: "Adepa Home",
    product: "Hisense 55-inch TV",
    sku: "AH-TV-055",
    price: 6200,
    deposit: 1240,
    paid: 6200,
    frequency: "Daily",
    nextPayment: "Completed",
    reservation: "Reserved",
    status: "Fully Paid",
    agent: "Mavis Tetteh",
    created: "Jun 18, 2026",
  },
  {
    reference: "LAY-2026-004402",
    customer: "Yaw Boateng",
    customerId: "BPC-002601",
    store: "Nova Appliances",
    product: "LG Double Door Fridge",
    sku: "NA-LG-442",
    price: 5650,
    deposit: 1130,
    paid: 2260,
    frequency: "Custom",
    nextPayment: "Aug 24, 2026",
    reservation: "Reserved",
    status: "Overdue",
    agent: "Unassigned",
    created: "May 29, 2026",
  },
  {
    reference: "LAY-2026-004318",
    customer: "Abena Tandoh",
    customerId: "BPC-002487",
    store: "HomeStyle Furniture",
    product: "Premium Sofa Set",
    sku: "HS-SOF-114",
    price: 7200,
    deposit: 1440,
    paid: 1440,
    frequency: "Weekly",
    nextPayment: "Aug 30, 2026",
    reservation: "Pending",
    status: "Awaiting Deposit",
    agent: "Daniel Kumi",
    created: "Aug 21, 2026",
  },
]

const money = (value: number) =>
  `GHS ${value.toLocaleString("en-GH", { minimumFractionDigits: 2 })}`

function LayawayDashboardSection() {
  const metrics = [
    ["Active Layaway Plans", "386", "+24 this month"],
    ["Total Layaway Portfolio", "GHS 2.84M", "+8.4%"],
    ["Amount Collected", "GHS 1.72M", "60.6% of portfolio"],
    ["Outstanding Balance", "GHS 1.12M", "Across 386 plans"],
    ["Expected Today", "GHS 48,620", "714 installments"],
    ["Collected Today", "GHS 42,180", "86.8% collection rate"],
    ["Overdue Plans", "29", "GHS 72,450 overdue"],
    ["Awaiting Release", "18", "Fully paid"],
    ["Completed Plans", "642", "Platform lifetime"],
    ["Cancelled Plans", "31", "4.2% cancellation rate"],
    ["Active Agents", "48", "12 assigned stores"],
    ["Cash Awaiting Reconciliation", "GHS 18,740", "Requires review"],
  ]
  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold">Layaway Overview</h2>
          <p className="mt-1 text-sm text-slate-500">
            Reservations, collections, overdue exposure, releases, and agent
            cash.
          </p>
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {["Daily", "Weekly", "Monthly", "Quarterly", "Custom Range"].map(
            (period, index) => (
              <button
                key={period}
                className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold ${
                  index === 2
                    ? "bg-blue-600 text-white"
                    : "border border-slate-200 text-slate-600"
                }`}
              >
                {period}
              </button>
            ),
          )}
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {metrics.map(([label, value, detail]) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="text-xs font-semibold text-slate-500">{label}</div>
            <div className="mt-2 text-xl font-bold">{value}</div>
            <div className="mt-1 text-[11px] text-slate-400">{detail}</div>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {[
          ["Layaway collections", [42, 58, 51, 72, 66, 84, 78]],
          ["Expected vs actual", [62, 55, 78, 69, 88, 75, 91]],
          ["Agent performance", [48, 64, 57, 81, 73, 90, 85]],
        ].map(([title, values]) => (
          <div
            key={String(title)}
            className="rounded-2xl border border-slate-200 p-4"
          >
            <div className="text-sm font-bold">{String(title)}</div>
            <div className="mt-4 flex h-24 items-end gap-2">
              {(values as number[]).map((value, index) => (
                <div
                  key={index}
                  className="flex-1 rounded-t bg-blue-500"
                  style={{ height: `${value}%` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function LayawayPlansPage() {
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("All")
  const [frequency, setFrequency] = useState("All")
  const [selected, setSelected] = useState<LayawayPlan | null>(null)
  const filtered = LAYAWAY_PLANS.filter(
    (plan) =>
      (!query ||
        `${plan.reference} ${plan.customer} ${plan.store} ${plan.product}`
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (status === "All" || plan.status === status) &&
      (frequency === "All" || plan.frequency === frequency),
  )
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Layaway Plans"
        description="Monitor every platform Layaway plan, reserved product, payment schedule, and release state."
        actions={
          <>
            <Button variant="secondary">Export CSV</Button>
            <Button>Platform Layaway Rules</Button>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Active Plans", "386"],
          ["Outstanding", "GHS 1.12M"],
          ["Overdue", "29"],
          ["Awaiting Release", "18"],
        ].map(([label, value]) => (
          <Card key={label} className="p-5">
            <div className="text-sm text-slate-500">{label}</div>
            <div className="mt-2 text-2xl font-bold">{value}</div>
          </Card>
        ))}
      </div>
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reference, customer, store, or product"
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
          >
            <option>All</option>
            {[
              "Partially Paid",
              "Fully Paid",
              "Overdue",
              "Awaiting Deposit",
              "Active",
              "Suspended",
              "Completed",
              "Cancelled",
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
          >
            <option>All</option>
            <option>Daily</option>
            <option>Weekly</option>
            <option>Custom</option>
          </select>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {["All", "Fully Paid", "Overdue", "Awaiting Product Release"].map(
            (label) => (
              <button
                key={label}
                onClick={() =>
                  label === "All"
                    ? setStatus("All")
                    : label === "Awaiting Product Release"
                      ? setStatus("Fully Paid")
                      : setStatus(label)
                }
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-blue-50"
              >
                {label}
              </button>
            ),
          )}
        </div>
      </Card>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1500px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {[
                  "Reference",
                  "Customer",
                  "Store / Product",
                  "Price",
                  "Deposit",
                  "Paid",
                  "Outstanding",
                  "Frequency",
                  "Next Payment",
                  "Progress",
                  "Reservation",
                  "Status",
                  "Agent",
                  "Created",
                  "Action",
                ].map((head) => (
                  <th key={head} className="px-4 py-4">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((plan) => {
                const outstanding = Math.max(0, plan.price - plan.paid)
                const progress = Math.min(
                  100,
                  Math.round((plan.paid / plan.price) * 100),
                )
                return (
                  <tr
                    key={plan.reference}
                    className="border-t border-slate-100"
                  >
                    <td className="px-4 py-4 font-bold text-blue-700">
                      {plan.reference}
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-semibold">{plan.customer}</div>
                      <div className="text-xs text-slate-400">
                        {plan.customerId}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-semibold">{plan.store}</div>
                      <div className="text-xs text-slate-500">
                        {plan.product}
                      </div>
                    </td>
                    <td className="px-4 py-4">{money(plan.price)}</td>
                    <td className="px-4 py-4">{money(plan.deposit)}</td>
                    <td className="px-4 py-4 font-semibold text-emerald-700">
                      {money(plan.paid)}
                    </td>
                    <td className="px-4 py-4 font-semibold">
                      {money(outstanding)}
                    </td>
                    <td className="px-4 py-4">{plan.frequency}</td>
                    <td className="px-4 py-4">{plan.nextPayment}</td>
                    <td className="px-4 py-4">
                      <div className="w-24">
                        <div className="flex justify-between text-xs">
                          <span>{progress}%</span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-blue-600"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Pill
                        tone={
                          plan.reservation === "Reserved"
                            ? "success"
                            : "pending"
                        }
                      >
                        {plan.reservation}
                      </Pill>
                    </td>
                    <td className="px-4 py-4">
                      <Pill
                        tone={
                          plan.status === "Overdue"
                            ? "danger"
                            : plan.status === "Fully Paid"
                              ? "success"
                              : "pending"
                        }
                      >
                        {plan.status}
                      </Pill>
                    </td>
                    <td className="px-4 py-4">{plan.agent}</td>
                    <td className="px-4 py-4">{plan.created}</td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => setSelected(plan)}
                        className="font-bold text-blue-600"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-10 text-center text-sm text-slate-500">
            No Layaway plans match these filters.
          </div>
        )}
      </Card>
      {selected && (
        <LayawayDetailsModal
          plan={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

function LayawayDetailsModal({
  plan,
  onClose,
}: {
  plan: LayawayPlan
  onClose: () => void
}) {
  const [tab, setTab] = useState("Schedule")
  const [override, setOverride] = useState(false)
  const [reason, setReason] = useState("")
  const [notice, setNotice] = useState("")
  const outstanding = Math.max(0, plan.price - plan.paid),
    progress = Math.min(100, Math.round((plan.paid / plan.price) * 100)),
    canRelease = outstanding <= 0 && plan.status === "Fully Paid"
  /*
  const schedule=[["01","Jul 09, 2026","GHS 140.00","GHS 140.00","Jul 09, 2026","Paid","LTX-88401","MTN MoMo","Kofi Mensah"],["02","Jul 16, 2026","GHS 140.00","GHS 140.00","Jul 16, 2026","Paid","LTX-88532","Agent cash","Kofi Mensah"],["03","Aug 21, 2026","GHS 140.00","GHS 0.00","—","Overdue","—","—","Kofi Mensah"],["04","Aug 28, 2026","GHS 140.00","GHS 0.00","—","Upcoming","—","—","Kofi Mensah"]]
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm"><button className="absolute inset-0" onClick={onClose} aria-label="Close Layaway details"/><div className="relative max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-[28px] bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white p-6"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-2xl font-bold">{plan.reference}</h2><Pill tone={plan.status==="Overdue"?"danger":plan.status==="Fully Paid"?"success":"pending"}>{plan.status}</Pill></div><p className="mt-1 text-sm text-slate-500">{plan.customer} · {plan.product} · {plan.store}</p></div><button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200"><IconClose/></button></div><div className="p-6">{notice&&<div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{notice}</div>}<div className="grid gap-4 md:grid-cols-3"><Card className="p-5"><h3 className="font-bold">Customer Information</h3><div className="mt-4 space-y-2 text-sm text-slate-600"><p><b>{plan.customer}</b> · {plan.customerId}</p><p>+233 24 601 1182</p><p>ama.owusu@example.com</p><p>East Legon, Accra</p><Pill tone="success">Active account</Pill></div></Card><Card className="p-5"><h3 className="font-bold">Store Information</h3><div className="mt-4 space-y-2 text-sm text-slate-600"><p><b>{plan.store}</b> · STR-001842</p><p>Manager: Emmanuel Agyeman</p><p>+233 30 221 4405</p><p>support@cytechgadgets.com</p></div></Card><Card className="p-5"><h3 className="font-bold">Product Reservation</h3><div className="mt-4 space-y-2 text-sm text-slate-600"><p><b>{plan.product}</b></p><p>SKU: {plan.sku} · Qty: 1</p><p>Unit: INV-CY-00441</p><p>Serial: S25-GH-882104</p><Pill tone="success">{plan.reservation}</Pill></div></Card></div><Card className="mt-5 p-5"><div className="flex flex-col gap-5 lg:flex-row lg:items-end"><div className="flex-1"><div className="flex justify-between text-sm"><span className="font-bold">{money(plan.paid)} paid of {money(plan.price)}</span><span className="font-bold text-blue-700">{progress}% Complete</span></div><div className="mt-3 h-3 rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-emerald-500" style={{width:`${progress}%`}}/></div></div><div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{[["Deposit",money(plan.deposit)],["Outstanding",money(outstanding)],["Frequency",plan.frequency],["Next payment",plan.nextPayment],["Payments made","8"],["Missed","1"]].map(([label,value])=><div key={label}><div className="text-xs text-slate-400">{label}</div><div className="mt-1 text-sm font-bold">{value}</div></div>)}</div></div><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={()=>setNotice("Agent assignment updated and audit entry created.")}>Assign Agent</Button><Button variant="secondary" onClick={()=>setNotice("Plan suspended. An audit event has been queued for backend persistence.")}>Suspend</Button><Button onClick={()=>canRelease?setNotice("Product marked ready for collection. Store confirmation is still required."):setOverride(true)}>{canRelease?"Mark Ready for Collection":"Exceptional Release Override"}</Button></div></div>{!canRelease&&<div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">Release is locked because the authoritative outstanding balance is not zero or the plan is not Fully Paid. Only an audited administrator override may proceed.</div>}</Card><div className="mt-6 flex gap-2 overflow-x-auto">{["Schedule","Transactions","Reservation","Audit History"].map(item=><button key={item} onClick={()=>setTab(item)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold ${tab===item?"bg-blue-600 text-white":"border border-slate-200 text-slate-600"}`}>{item}</button>)}</div>{tab==="Schedule"&&<Card className="mt-4 overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["#","Due Date","Expected","Paid","Paid Date","Status","Reference","Method","Collector"].map(h=><th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody>{schedule.map(row=><tr key={row[0]} className="border-t border-slate-100">{row.map((cell,i)=><td key={i} className="px-4 py-3">{i===5?<Pill tone={cell==="Paid"?"success":cell==="Overdue"?"danger":"pending"}>{cell}</Pill>:cell}</td>)}</tr>)}</tbody></table></div></Card>}{tab==="Transactions"&&<Card className="mt-4 p-5"><h3 className="font-bold">Immutable transaction history</h3><p className="mt-1 text-sm text-slate-500">Historical entries cannot be edited or deleted. Corrections create linked reversal transactions.</p>{[["LTX-88532","agent_collection","GHS 140.00","Verified"],["LTX-88401","layaway_payment","GHS 140.00","Verified"],["LTX-88102","layaway_deposit",money(plan.deposit),"Verified"]].map(row=><div key={row[0]} className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 p-3 text-sm sm:grid-cols-4">{row.map(cell=><span key={cell}>{cell}</span>)}</div>)}<Button variant="secondary" onClick={()=>setNotice("A reversal request was created; the original transaction remains unchanged.")}>Create Reversal</Button></Card>}{tab==="Reservation"&&<Card className="mt-4 p-5"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[["Reservation status",plan.reservation],["Reservation date","Jul 02, 2026"],["Reserved quantity","1 unit"],["Release status",canRelease?"Eligible":"Locked"]].map(([l,v])=><InfoTile key={l} label={l} value={v}/>)}</div></Card>}{tab==="Audit History"&&<Card className="mt-4 p-5"><Timeline items={[{title:"Layaway application approved",body:"Store Manager · CYTECH Gadgets · Web",date:"Jul 02, 2026 · 10:42 AM"},{title:"Product inventory reserved",body:"INV-CY-00441 assigned to this plan",date:"Jul 02, 2026 · 10:45 AM"},{title:"Agent assigned",body:"Kofi Mensah assigned by Emmanuel (Admin)",date:"Jul 03, 2026 · 8:12 AM"}]}/></Card>}</div></div>{override&&<div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/50 p-4"><div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><h3 className="text-xl font-bold text-red-700">Exceptional release override</h3><p className="mt-2 text-sm text-slate-600">This bypasses the normal full-payment release lock. Your identity, reason, time, device, old value, and new value will be recorded.</p><textarea value={reason} onChange={e=>setReason(e.target.value)} rows={4} placeholder="Mandatory audit reason (minimum 15 characters)" className="mt-4 w-full rounded-2xl border border-slate-200 p-4 text-sm outline-none focus:border-red-500"/><div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={()=>setOverride(false)}>Cancel</Button><button disabled={reason.trim().length<15} onClick={()=>{setOverride(false);setNotice("Exceptional override recorded. Release requires backend authorization before store confirmation.")}} className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Record Override</button></div></div></div>}</div>
  */
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-3">
      <button className="absolute inset-0" onClick={onClose} />
      <div className="relative max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">{plan.reference}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {plan.customer} · {plan.product} · {plan.store}
            </p>
          </div>
          <button onClick={onClose} className="rounded-xl border p-3">
            <IconClose />
          </button>
        </div>
        {notice && (
          <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
            {notice}
          </div>
        )}
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            ["Customer", plan.customer, plan.customerId],
            ["Store", plan.store, "STR-001842"],
            ["Reserved Product", plan.product, plan.sku],
          ].map(([title, value, detail]) => (
            <Card key={title} className="p-5">
              <div className="text-xs font-bold uppercase text-slate-400">
                {title}
              </div>
              <div className="mt-3 font-bold">{value}</div>
              <div className="mt-1 text-sm text-slate-500">{detail}</div>
            </Card>
          ))}
        </div>
        <Card className="mt-5 p-5">
          <div className="flex justify-between text-sm">
            <b>
              {money(plan.paid)} paid of {money(plan.price)}
            </b>
            <b>{progress}% Complete</b>
          </div>
          <div className="mt-3 h-3 rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-600"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {[
              ["Deposit", money(plan.deposit)],
              ["Outstanding", money(outstanding)],
              ["Frequency", plan.frequency],
              ["Next payment", plan.nextPayment],
            ].map(([label, value]) => (
              <InfoTile key={label} label={label} value={value} />
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => setNotice("Agent assignment updated and audited.")}
            >
              Assign Agent
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                setNotice("Reversal request created; history preserved.")
              }
            >
              Create Reversal
            </Button>
            <Button
              onClick={() =>
                canRelease
                  ? setNotice(
                      "Ready for collection; store confirmation required.",
                    )
                  : setOverride(true)
              }
            >
              {canRelease
                ? "Mark Ready for Collection"
                : "Exceptional Release Override"}
            </Button>
          </div>
          {!canRelease && (
            <div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">
              Release locked until the backend-verified balance is zero and
              status is Fully Paid.
            </div>
          )}
        </Card>
        <div className="mt-5 flex gap-2">
          {["Schedule", "Transactions", "Reservation", "Audit History"].map(
            (item) => (
              <button
                key={item}
                onClick={() => setTab(item)}
                className={`rounded-xl px-3 py-2 text-xs font-bold ${
                  tab === item ? "bg-blue-600 text-white" : "border"
                }`}
              >
                {item}
              </button>
            ),
          )}
        </div>
        <Card className="mt-4 p-5">
          <h3 className="font-bold">{tab}</h3>
          <p className="mt-2 text-sm text-slate-500">
            {tab === "Schedule"
              ? "Payment schedule includes paid, due, overdue, rescheduled and upcoming installments."
              : tab === "Transactions"
                ? "Transaction history is immutable; corrections use linked reversals."
                : tab === "Reservation"
                  ? `Inventory unit INV-CY-00441 is ${plan.reservation.toLowerCase()}.`
                  : "Approval, reservation, assignment, payment and override events include actor, reason, time and device."}
          </p>
        </Card>
        {override && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 p-4">
            <div className="w-full max-w-lg rounded-3xl bg-white p-6">
              <h3 className="text-xl font-bold text-red-700">
                Exceptional release override
              </h3>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                placeholder="Mandatory audit reason (minimum 15 characters)"
                className="mt-4 w-full rounded-2xl border p-4"
              />
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setOverride(false)}>
                  Cancel
                </Button>
                <button
                  disabled={reason.trim().length < 15}
                  onClick={() => {
                    setOverride(false)
                    setNotice(
                      "Override recorded; backend authorization required.",
                    )
                  }}
                  className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
                >
                  Record Override
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CollectionAgentsPage() {
  const seed = [
    {
      id: "AGT-0018",
      name: "Kofi Mensah",
      phone: "+233 24 814 2201",
      email: "kofi@agents.adepapay.com",
      store: "CYTECH Gadgets",
      area: "Osu / East Legon",
      customers: 42,
      plans: 36,
      today: "GHS 2,840",
      month: "GHS 38,620",
      pending: "GHS 4,120",
      status: "Active",
    },
    {
      id: "AGT-0024",
      name: "Mavis Tetteh",
      phone: "+233 20 554 8810",
      email: "mavis@agents.adepapay.com",
      store: "Adepa Home",
      area: "Adabraka / Ridge",
      customers: 31,
      plans: 28,
      today: "GHS 1,960",
      month: "GHS 29,840",
      pending: "GHS 1,440",
      status: "Active",
    },
    {
      id: "AGT-0031",
      name: "Daniel Kumi",
      phone: "+233 55 212 3340",
      email: "daniel@agents.adepapay.com",
      store: "HomeStyle Furniture",
      area: "Kumasi Central",
      customers: 18,
      plans: 14,
      today: "GHS 0",
      month: "GHS 12,220",
      pending: "GHS 0",
      status: "Suspended",
    },
  ]
  const [agents, setAgents] = useState(seed)
  const [query, setQuery] = useState("")
  const [notice, setNotice] = useState("")
  const filtered = agents.filter((a) =>
    `${a.id} ${a.name} ${a.store} ${a.area}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  )
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Collection Agents"
        description="Monitor agent assignments, collections, cash exposure, status, and audit history."
        actions={<Button>Register Agent</Button>}
      />
      {notice && (
        <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
          {notice}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          [
            "Active Agents",
            String(agents.filter((a) => a.status === "Active").length),
          ],
          ["Collections Today", "GHS 4,800"],
          ["Cash Pending", "GHS 5,560"],
        ].map(([l, v]) => (
          <Card key={l} className="p-5">
            <div className="text-sm text-slate-500">{l}</div>
            <div className="mt-2 text-2xl font-bold">{v}</div>
          </Card>
        ))}
      </div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search agent, store, or area"
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
      />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1300px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {[
                  "Agent",
                  "Contact",
                  "Store",
                  "Area",
                  "Customers",
                  "Active Plans",
                  "Today",
                  "This Month",
                  "Cash Pending",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th key={h} className="px-4 py-4">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-t border-slate-100">
                  <td className="px-4 py-4">
                    <b>{a.name}</b>
                    <div className="text-xs text-slate-400">{a.id}</div>
                  </td>
                  <td className="px-4 py-4">
                    {a.phone}
                    <div className="text-xs text-slate-400">{a.email}</div>
                  </td>
                  <td className="px-4 py-4">{a.store}</td>
                  <td className="px-4 py-4">{a.area}</td>
                  <td className="px-4 py-4">{a.customers}</td>
                  <td className="px-4 py-4">{a.plans}</td>
                  <td className="px-4 py-4 font-semibold">{a.today}</td>
                  <td className="px-4 py-4">{a.month}</td>
                  <td className="px-4 py-4 font-semibold text-amber-700">
                    {a.pending}
                  </td>
                  <td className="px-4 py-4">
                    <Pill tone={a.status === "Active" ? "success" : "danger"}>
                      {a.status}
                    </Pill>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex gap-3">
                      <button
                        onClick={() =>
                          setNotice(
                            `Opened assignments and collection history for ${a.name}.`,
                          )
                        }
                        className="font-bold text-blue-600"
                      >
                        View
                      </button>
                      <button
                        onClick={() => {
                          setAgents((items) =>
                            items.map((item) =>
                              item.id === a.id
                                ? {
                                    ...item,
                                    status:
                                      item.status === "Active"
                                        ? "Suspended"
                                        : "Active",
                                  }
                                : item,
                            ),
                          )
                          setNotice(
                            `${a.name} ${
                              a.status === "Active"
                                ? "suspended"
                                : "reactivated"
                            }. Audit entry created.`,
                          )
                        }}
                        className={`font-bold ${
                          a.status === "Active"
                            ? "text-red-600"
                            : "text-emerald-600"
                        }`}
                      >
                        {a.status === "Active" ? "Suspend" : "Reactivate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function AgentSettlementsPage() {
  const seed = [
    {
      ref: "AST-2026-00842",
      agent: "Kofi Mensah",
      store: "CYTECH Gadgets",
      cash: 4120,
      electronic: 5860,
      submitted: 3000,
      pending: 1120,
      date: "Aug 26, 2026",
      confirmation: "Pending",
      status: "Submitted",
    },
    {
      ref: "AST-2026-00838",
      agent: "Mavis Tetteh",
      store: "Adepa Home",
      cash: 1440,
      electronic: 7420,
      submitted: 1440,
      pending: 0,
      date: "Aug 26, 2026",
      confirmation: "Confirmed",
      status: "Confirmed",
    },
    {
      ref: "AST-2026-00821",
      agent: "Daniel Kumi",
      store: "HomeStyle Furniture",
      cash: 2680,
      electronic: 3250,
      submitted: 1800,
      pending: 880,
      date: "Aug 24, 2026",
      confirmation: "Disputed",
      status: "Disputed",
    },
  ]
  const [rows, setRows] = useState(seed)
  const [filter, setFilter] = useState("All")
  const [notice, setNotice] = useState("")
  const filtered = rows.filter((r) => filter === "All" || r.status === filter)
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Agent Settlements"
        description="Reconcile agent cash and electronic Layaway collections without altering collection history."
        actions={<Button variant="secondary">Export Settlements</Button>}
      />
      {notice && (
        <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
          {notice}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Cash Collected", "GHS 8,240"],
          ["Electronic", "GHS 16,530"],
          ["Cash Pending", "GHS 2,000"],
          ["Disputed", "1"],
        ].map(([l, v]) => (
          <Card key={l} className="p-5">
            <div className="text-sm text-slate-500">{l}</div>
            <div className="mt-2 text-2xl font-bold">{v}</div>
          </Card>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {[
          "All",
          "Pending",
          "Submitted",
          "Confirmed",
          "Disputed",
          "Reconciled",
        ].map((value) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`rounded-xl px-4 py-2 text-sm font-bold ${
              filter === value
                ? "bg-blue-600 text-white"
                : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            {value}
          </button>
        ))}
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {[
                  "Reference",
                  "Agent",
                  "Store",
                  "Cash Collected",
                  "Electronic",
                  "Cash Submitted",
                  "Cash Pending",
                  "Date",
                  "Store Confirmation",
                  "Admin Status",
                  "Action",
                ].map((h) => (
                  <th key={h} className="px-4 py-4">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.ref} className="border-t border-slate-100">
                  <td className="px-4 py-4 font-bold text-blue-700">
                    {row.ref}
                  </td>
                  <td className="px-4 py-4 font-semibold">{row.agent}</td>
                  <td className="px-4 py-4">{row.store}</td>
                  <td className="px-4 py-4">{money(row.cash)}</td>
                  <td className="px-4 py-4">{money(row.electronic)}</td>
                  <td className="px-4 py-4 text-emerald-700">
                    {money(row.submitted)}
                  </td>
                  <td className="px-4 py-4 font-bold text-amber-700">
                    {money(row.pending)}
                  </td>
                  <td className="px-4 py-4">{row.date}</td>
                  <td className="px-4 py-4">{row.confirmation}</td>
                  <td className="px-4 py-4">
                    <Pill
                      tone={
                        row.status === "Reconciled" ||
                        row.status === "Confirmed"
                          ? "success"
                          : row.status === "Disputed"
                            ? "danger"
                            : "pending"
                      }
                    >
                      {row.status}
                    </Pill>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      disabled={row.pending > 0 || row.status === "Disputed"}
                      onClick={() => {
                        setRows((items) =>
                          items.map((item) =>
                            item.ref === row.ref
                              ? { ...item, status: "Reconciled" }
                              : item,
                          ),
                        )
                        setNotice(
                          `${row.ref} reconciled. Settlement confirmation was added to the audit log.`,
                        )
                      }}
                      className="font-bold text-blue-600 disabled:cursor-not-allowed disabled:text-slate-300"
                    >
                      Reconcile
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <b>Accounting control:</b> settlements with pending cash or an active
        dispute cannot be reconciled. Historical agent collections remain
        immutable; corrections require reversal entries.
      </div>
    </div>
  )
}

function StoreApprovalsPage({
  activeTab,
  setActiveTab,
}: {
  activeTab: ApprovalTab
  setActiveTab: (tab: ApprovalTab) => void
}) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const tabs: Array<{ id: ApprovalTab label: string }> = [
    { id: "all", label: "All" },
    { id: "new", label: "New" },
    { id: "under-review", label: "Under Review" },
    { id: "documents", label: "Documents Required" },
    { id: "approved", label: "Approved" },
    { id: "rejected", label: "Rejected" },
    { id: "suspended", label: "Suspended" },
    { id: "expired", label: "Expired" },
  ]

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Store Approvals"
        description="Review and verify new partner-store applications."
        actions={
          <>
            <Button variant="secondary">34 Pending Applications</Button>
            <Button>Export Applications</Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {APPROVAL_SUMMARY.map((metric) => (
          <MetricCard key={metric.title} metric={metric} />
        ))}
      </div>

      <Card className="p-3">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <div className="grid gap-3 lg:grid-cols-5">
          <FilterBox label="Search store name" value="CYTECH Gadgets" />
          <FilterBox label="Application reference" value="BPSA-2026-00182" />
          <FilterBox label="Store owner name" value="Emmanuel Agyeman" />
          <FilterBox label="Business category" value="Electronics" />
          <FilterBox label="Region" value="Greater Accra" />
          <FilterBox
            label="Submission date"
            value="Jul 1, 2026 - Aug 4, 2026"
          />
          <FilterBox
            label="Verification status"
            value="All verification states"
          />
          <FilterBox label="Risk level" value="All risk levels" />
          <FilterBox label="Assigned reviewer" value="All reviewers" />
          <FilterBox label="Sort by" value="Priority" />
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <Button variant="secondary">Clear Filters</Button>
        </div>
      </Card>

      <div className="hidden xl:block">
        <TableCard
          title="Store Approval Queue"
          description="Review, assign, request documents, approve, reject, and audit applications."
        >
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {[
                  "Application reference",
                  "Store logo",
                  "Store name",
                  "Store owner",
                  "Business category",
                  "Region",
                  "Submission date",
                  "Verification progress",
                  "Risk level",
                  "Status",
                  "Assigned reviewer",
                  "Actions",
                ].map((head) => (
                  <th key={head} className="px-4 py-3 text-left font-semibold">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {APPROVAL_ROWS.map((row) => (
                <tr key={row.reference} className="border-t border-slate-200">
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {row.reference}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 font-bold text-blue-700">
                      {row.store.slice(0, 2).toUpperCase()}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.store}</td>
                  <td className="px-4 py-3 text-slate-700">{row.owner}</td>
                  <td className="px-4 py-3 text-slate-700">{row.category}</td>
                  <td className="px-4 py-3 text-slate-700">{row.region}</td>
                  <td className="px-4 py-3 text-slate-700">{row.submitted}</td>
                  <td className="px-4 py-3 text-slate-700">{row.progress}</td>
                  <td className="px-4 py-3">
                    <Pill
                      tone={
                        row.risk.includes("Low")
                          ? "success"
                          : row.risk.includes("Missing")
                            ? "danger"
                            : "pending"
                      }
                    >
                      {row.risk}
                    </Pill>
                  </td>
                  <td className="px-4 py-3">
                    <Pill tone={row.tone}>{row.status}</Pill>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.reviewer}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-2">
                      <ActionLink>Review Application</ActionLink>
                      <ActionLink>Assign Reviewer</ActionLink>
                      <ActionLink>Request Documents</ActionLink>
                      <ActionLink>Approve Store</ActionLink>
                      <ActionLink>Reject Store</ActionLink>
                      <ActionLink>Add Internal Note</ActionLink>
                      <ActionLink onClick={() => setDrawerOpen(true)}>
                        View Audit History
                      </ActionLink>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      </div>

      <div className="grid gap-4 xl:hidden">
        {APPROVAL_ROWS.map((row) => (
          <Card key={row.reference} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-bold text-slate-900">
                  {row.store}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {row.reference} • {row.owner}
                </div>
              </div>
              <Pill tone={row.tone}>{row.status}</Pill>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <InfoTile label="Category" value={row.category} />
              <InfoTile label="Region" value={row.region} />
              <InfoTile label="Verification" value={row.progress} />
              <InfoTile label="Reviewer" value={row.reviewer} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary">Review</Button>
              <Button variant="secondary">Request Docs</Button>
              <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
                Audit History
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {drawerOpen && (
        <StoreApprovalDrawer onClose={() => setDrawerOpen(false)} />
      )}
    </div>
  )
}

function StoresPage({
  activeTab,
  setActiveTab,
}: {
  activeTab: StoreTab
  setActiveTab: (tab: StoreTab) => void
}) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const tabs: Array<{ id: StoreTab label: string }> = [
    { id: "all", label: "All" },
    { id: "active", label: "Active" },
    { id: "pending", label: "Pending Verification" },
    { id: "suspended", label: "Suspended" },
    { id: "restricted", label: "Restricted" },
    { id: "inactive", label: "Inactive" },
    { id: "closed", label: "Closed" },
  ]

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Stores"
        description="Manage all stores registered on the AdepaPay platform."
        actions={
          <>
            <Button variant="secondary">Add Store</Button>
            <Button>Export Stores</Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {STORE_SUMMARY.map((metric) => (
          <MetricCard key={metric.title} metric={metric} />
        ))}
      </div>

      <Card className="p-3">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <div className="grid gap-3 lg:grid-cols-5">
          <FilterBox label="Store name" value="CYTECH Gadgets" />
          <FilterBox label="Store ID" value="BPS-000184" />
          <FilterBox label="Store owner" value="Emmanuel Agyeman" />
          <FilterBox label="Business category" value="Electronics" />
          <FilterBox label="Region" value="Greater Accra" />
          <FilterBox label="Verification status" value="All states" />
          <FilterBox label="Operational status" value="All statuses" />
          <FilterBox
            label="Date registered"
            value="Jan 1, 2026 - Aug 4, 2026"
          />
          <FilterBox label="Transaction volume" value="Any volume" />
          <FilterBox label="Risk level" value="All risk levels" />
          <FilterBox label="Sort by" value="Highest sales" />
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <Button variant="secondary">Clear Filters</Button>
          <Button variant="secondary">Export Selected Stores</Button>
          <Button variant="secondary">Assign Administrator</Button>
          <Button variant="secondary">Send Notification</Button>
          <Button variant="secondary">Mark for Review</Button>
          <Button variant="secondary">Suspend Selected Stores</Button>
        </div>
      </Card>

      <Card className="p-5">
        <div className="grid gap-4 xl:grid-cols-[1fr,0.9fr]">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">
              Store performance ranking
            </div>
            <div className="mt-4 space-y-3">
              {STORE_ROWS.slice(0, 4).map((row, index) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between rounded-2xl bg-white px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-sm font-bold text-blue-700">
                      {index + 1}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {row.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {row.category} • {row.region}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-emerald-600">
                    {row.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-amber-700">
              <div className="text-sm font-bold">Verification warning</div>
              <div className="mt-1 text-sm">
                34 stores are still pending verification and 11 of them require
                admin action today.
              </div>
            </div>
            <div className="rounded-[24px] border border-red-200 bg-red-50 p-4 text-red-700">
              <div className="text-sm font-bold">
                Policy violation indicator
              </div>
              <div className="mt-1 text-sm">
                3 stores currently have unresolved product or pricing policy
                violations.
              </div>
            </div>
            <div className="rounded-[24px] border border-purple-200 bg-purple-50 p-4 text-purple-700">
              <div className="text-sm font-bold">Settlement issue alert</div>
              <div className="mt-1 text-sm">
                2 stores are temporarily held from settlement pending banking
                verification.
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="hidden xl:block">
        <TableCard
          title="Stores Management Table"
          description="Monitor verification, operations, value, products, customers, and administrator actions."
        >
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {[
                  "",
                  "Store logo",
                  "Store name",
                  "Store ID",
                  "Owner or manager",
                  "Category",
                  "Region",
                  "Products",
                  "Active purchases",
                  "Transaction value",
                  "Verification status",
                  "Operational status",
                  "Actions",
                ].map((head) => (
                  <th key={head} className="px-4 py-3 text-left font-semibold">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STORE_ROWS.map((row) => (
                <tr key={row.id} className="border-t border-slate-200">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 font-bold text-blue-700">
                      {row.name.slice(0, 2).toUpperCase()}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {row.name}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.id}</td>
                  <td className="px-4 py-3 text-slate-700">{row.owner}</td>
                  <td className="px-4 py-3 text-slate-700">{row.category}</td>
                  <td className="px-4 py-3 text-slate-700">{row.region}</td>
                  <td className="px-4 py-3 text-slate-700">{row.products}</td>
                  <td className="px-4 py-3 text-slate-700">{row.purchases}</td>
                  <td className="px-4 py-3 text-slate-700">{row.value}</td>
                  <td className="px-4 py-3">
                    <Pill
                      tone={
                        row.verification.includes("Pending")
                          ? "pending"
                          : "success"
                      }
                    >
                      {row.verification}
                    </Pill>
                  </td>
                  <td className="px-4 py-3">
                    <Pill tone={row.tone}>{row.operational}</Pill>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-2">
                      <ActionLink onClick={() => setDrawerOpen(true)}>
                        View Store
                      </ActionLink>
                      <ActionLink>Edit Store</ActionLink>
                      <ActionLink>View Products</ActionLink>
                      <ActionLink>View Customers</ActionLink>
                      <ActionLink>View Transactions</ActionLink>
                      <ActionLink>Review Documents</ActionLink>
                      <ActionLink>Suspend Store</ActionLink>
                      <ActionLink>Restrict Store</ActionLink>
                      <ActionLink>Reactivate Store</ActionLink>
                      <ActionLink>Close Store Account</ActionLink>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      </div>

      <div className="grid gap-4 xl:hidden">
        {STORE_ROWS.map((row) => (
          <Card key={row.id} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-bold text-slate-900">
                  {row.name}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {row.id} • {row.owner}
                </div>
              </div>
              <Pill tone={row.tone}>{row.operational}</Pill>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <InfoTile label="Category" value={row.category} />
              <InfoTile label="Region" value={row.region} />
              <InfoTile label="Products" value={row.products} />
              <InfoTile label="Value" value={row.value} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
                View Store
              </Button>
              <Button variant="secondary">View Transactions</Button>
              <Button variant="secondary">Suspend</Button>
            </div>
          </Card>
        ))}
      </div>

      {drawerOpen && (
        <StoreDetailsDrawer onClose={() => setDrawerOpen(false)} />
      )}
    </div>
  )
}

function CustomersPage({
  activeTab,
  setActiveTab,
}: {
  activeTab: CustomerTab
  setActiveTab: (tab: CustomerTab) => void
}) {
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(
    null,
  )
  const [customerAction, setCustomerAction] =
    useState<"approve" | "documents" | null>(null)
  const [verificationDecisions, setVerificationDecisions] =
    useState<Record<string, CustomerVerificationDecision>>(() => {
      try {
        return JSON.parse(
          localStorage.getItem("adepapay.customer-verification-decisions.v1") ||
            "{}",
        )
      } catch {
        return {}
      }
    })
  const [bannedCustomers, setBannedCustomers] = useState<string[]>([])
  const [banTarget, setBanTarget] =
    useState<typeof CUSTOMER_ROWS[number] | null>(null)
  const tabs: Array<{ id: CustomerTab label: string }> = [
    { id: "all", label: "All" },
    { id: "active", label: "Active" },
    { id: "verified", label: "Verified" },
    { id: "pending", label: "Verification Pending" },
    { id: "overdue", label: "Overdue" },
    { id: "restricted", label: "Restricted" },
    { id: "suspended", label: "Suspended" },
    { id: "closed", label: "Closed" },
  ]

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Customers"
        description="View and manage all AdepaPay customer accounts."
        actions={
          <>
            <Button variant="secondary">Export Customers</Button>
            <Button>Send Notification</Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {CUSTOMER_SUMMARY.map((metric) => (
          <MetricCard key={metric.title} metric={metric} />
        ))}
      </div>

      <Card className="p-3">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <div className="grid gap-3 lg:grid-cols-6">
          <FilterBox label="Customer name" value="Kwame Asante" />
          <FilterBox label="Customer ID" value="BPC-001842" />
          <FilterBox label="Phone number" value="+233 24 601 1182" />
          <FilterBox label="Email address" value="kwame.asante@email.com" />
          <FilterBox label="Ghana Card verification" value="All states" />
          <FilterBox label="Customer status" value="All statuses" />
          <FilterBox label="Region" value="All regions" />
          <FilterBox
            label="Registration date"
            value="Jan 1, 2026 - Aug 4, 2026"
          />
          <FilterBox
            label="Active purchase status"
            value="All purchase states"
          />
          <FilterBox label="Payment status" value="All payment states" />
          <FilterBox
            label="Outstanding balance range"
            value="GHS 0 - GHS 10,000"
          />
          <FilterBox label="Risk level" value="All risk levels" />
          <FilterBox label="Sort by" value="Highest balance" />
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary">Export Selected Customers</Button>
          <Button variant="secondary">Send Notification</Button>
          <Button variant="secondary">Mark for Review</Button>
          <Button variant="secondary">Restrict Selected Accounts</Button>
          <Button variant="secondary">Assign Compliance Reviewer</Button>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr,0.9fr]">
          <div className="rounded-[24px] border border-blue-200 bg-blue-50 p-4 text-blue-700">
            <div className="text-sm font-bold">Data privacy notice</div>
            <div className="mt-1 text-sm">
              Customer personal data is protected and should only be used for
              authorized platform administration and compliance workflows.
            </div>
          </div>
          <div className="rounded-[24px] border border-purple-200 bg-purple-50 p-4 text-purple-700">
            <div className="text-sm font-bold">Access-control warning</div>
            <div className="mt-1 text-sm">
              Sensitive identity data, fraud notes, and full documents may be
              limited based on your administrative role.
            </div>
          </div>
        </div>
      </Card>

      <div className="hidden xl:block">
        <TableCard
          title="Customers Management Table"
          description="Monitor verification, purchases, balances, payment health, and account controls."
        >
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {[
                  "",
                  "Customer",
                  "Customer ID",
                  "Phone number",
                  "Verification status",
                  "Applications",
                  "Active purchases",
                  "Total paid",
                  "Outstanding balance",
                  "Payment status",
                  "Risk level",
                  "Account status",
                  "Actions",
                ].map((head) => (
                  <th key={head} className="px-4 py-3 text-left font-semibold">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CUSTOMER_ROWS.map((row) => (
                <tr key={row.id} className="border-t border-slate-200">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 font-bold text-blue-700">
                        {row.initials}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">
                          {row.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {row.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.id}</td>
                  <td className="px-4 py-3 text-slate-700">{row.phone}</td>
                  <td className="px-4 py-3">
                    <Pill
                      tone={
                        verificationDecisions[row.id]?.status === "Approved" ||
                        row.verification.includes("Verified")
                          ? "success"
                          : "pending"
                      }
                    >
                      {verificationDecisions[row.id]?.status ??
                        row.verification}
                    </Pill>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {row.applications}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.purchases}</td>
                  <td className="px-4 py-3 text-slate-700">{row.paid}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {row.outstanding}
                  </td>
                  <td className="px-4 py-3">
                    <Pill
                      tone={
                        row.paymentStatus === "Current" ||
                        row.paymentStatus === "Due Soon"
                          ? "success"
                          : row.paymentStatus === "Overdue"
                            ? "danger"
                            : "pending"
                      }
                    >
                      {row.paymentStatus}
                    </Pill>
                  </td>
                  <td className="px-4 py-3">
                    <Pill
                      tone={
                        row.risk.includes("Low")
                          ? "success"
                          : row.risk.includes("High")
                            ? "danger"
                            : row.risk.includes("Medium")
                              ? "pending"
                              : "admin"
                      }
                    >
                      {row.risk}
                    </Pill>
                  </td>
                  <td className="px-4 py-3">
                    <Pill
                      tone={
                        bannedCustomers.includes(row.id) ? "danger" : row.tone
                      }
                    >
                      {bannedCustomers.includes(row.id)
                        ? "Banned"
                        : row.account}
                    </Pill>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-2">
                      <ActionLink
                        onClick={() => {
                          setCustomerAction(null)
                          setSelectedCustomer(row)
                        }}
                      >
                        View Customer
                      </ActionLink>
                      <button
                        onClick={() => {
                          setCustomerAction("approve")
                          setSelectedCustomer(row)
                        }}
                        className="text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                      >
                        Approve Customer
                      </button>
                      <button
                        onClick={() => {
                          setCustomerAction("documents")
                          setSelectedCustomer(row)
                        }}
                        className="text-sm font-semibold text-amber-600 hover:text-amber-700"
                      >
                        Request Further Documents
                      </button>
                      <ActionLink>View Applications</ActionLink>
                      <ActionLink>View Purchases</ActionLink>
                      <ActionLink>View Transactions</ActionLink>
                      <ActionLink>Review Documents</ActionLink>
                      <ActionLink>Contact Customer</ActionLink>
                      <ActionLink>Add Internal Note</ActionLink>
                      {bannedCustomers.includes(row.id) ? (
                        <button
                          onClick={() =>
                            setBannedCustomers((items) =>
                              items.filter((id) => id !== row.id),
                            )
                          }
                          className="text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                        >
                          Unban Customer
                        </button>
                      ) : (
                        <button
                          onClick={() => setBanTarget(row)}
                          className="text-sm font-semibold text-red-600 hover:text-red-700"
                        >
                          Ban Customer
                        </button>
                      )}
                      <ActionLink>Restrict Account</ActionLink>
                      <ActionLink>Suspend Account</ActionLink>
                      <ActionLink>Reactivate Account</ActionLink>
                      <ActionLink>Close Account</ActionLink>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      </div>

      <div className="grid gap-4 xl:hidden">
        {CUSTOMER_ROWS.map((row) => (
          <Card key={row.id} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 font-bold text-blue-700">
                  {row.initials}
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-900">
                    {row.name}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {row.id} • {row.phone}
                  </div>
                </div>
              </div>
              <Pill
                tone={bannedCustomers.includes(row.id) ? "danger" : row.tone}
              >
                {bannedCustomers.includes(row.id) ? "Banned" : row.account}
              </Pill>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <InfoTile
                label="Verification"
                value={
                  verificationDecisions[row.id]?.status ?? row.verification
                }
              />
              <InfoTile label="Active purchases" value={row.purchases} />
              <InfoTile label="Outstanding" value={row.outstanding} />
              <InfoTile label="Risk" value={row.risk} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setCustomerAction(null)
                  setSelectedCustomer(row)
                }}
              >
                View Customer
              </Button>
              <button
                onClick={() => {
                  setCustomerAction("approve")
                  setSelectedCustomer(row)
                }}
                className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white"
              >
                Approve
              </button>
              <button
                onClick={() => {
                  setCustomerAction("documents")
                  setSelectedCustomer(row)
                }}
                className="rounded-2xl border border-amber-200 px-5 py-3 text-sm font-semibold text-amber-700"
              >
                Request Documents
              </button>
              <Button variant="secondary">Contact</Button>
              <Button variant="secondary">Restrict</Button>
              {bannedCustomers.includes(row.id) ? (
                <button
                  onClick={() =>
                    setBannedCustomers((items) =>
                      items.filter((id) => id !== row.id),
                    )
                  }
                  className="rounded-2xl border border-emerald-200 px-5 py-3 text-sm font-semibold text-emerald-700"
                >
                  Unban
                </button>
              ) : (
                <button
                  onClick={() => setBanTarget(row)}
                  className="rounded-2xl border border-red-200 px-5 py-3 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  Ban
                </button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {selectedCustomer && (
        <CustomerDetailsDrawer
          customer={selectedCustomer}
          decision={verificationDecisions[selectedCustomer.id]}
          initialAction={customerAction}
          onDecision={(decision) => {
            const next = {
              ...verificationDecisions,
              [selectedCustomer.id]: decision,
            }
            setVerificationDecisions(next)
            localStorage.setItem(
              "adepapay.customer-verification-decisions.v1",
              JSON.stringify(next),
            )
          }}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
      {banTarget && (
        <BanCustomerModal
          customerName={banTarget.name}
          customerId={banTarget.id}
          scope="platform"
          onClose={() => setBanTarget(null)}
          onConfirm={() => {
            setBannedCustomers((items) => [...items, banTarget.id])
            setBanTarget(null)
          }}
        />
      )}
    </div>
  )
}

function StoreApprovalDrawer({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50">
      <button
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute right-0 top-0 h-full w-full max-w-3xl overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-2xl">
        <DrawerHeader
          title="Store Approval Review"
          subtitle="BPSA-2026-00182 • CYTECH Gadgets • Reviewer Emmanuel • August 4, 2026, 10:32 AM"
          onClose={onClose}
        />
        <div className="space-y-6">
          <DrawerSection title="Store Information">
            <GridInfo
              items={[
                ["Registered business name", "CYTECH Gadgets Limited"],
                ["Public store name", "CYTECH Gadgets"],
                [
                  "Store description",
                  "Consumer electronics and smart devices retailer.",
                ],
                ["Business type", "Limited Liability Company"],
                ["Business registration number", "CS284712024"],
                ["Tax identification number", "C0034182291"],
                ["Year established", "2021"],
              ]}
            />
          </DrawerSection>

          <DrawerSection title="Owner and Manager Details">
            <GridInfo
              items={[
                ["Full name", "Emmanuel Agyeman"],
                ["Masked Ghana Card number", "GHA-*****-1402"],
                ["Phone number", "+233 24 880 1931"],
                ["Email address", "emmanuel@cytechgadgets.com"],
                ["Role", "Founder and Manager"],
                ["Identity verification status", "Verified"],
              ]}
            />
          </DrawerSection>

          <DrawerSection title="Store Location">
            <GridInfo
              items={[
                ["Region", "Greater Accra"],
                ["City", "Accra"],
                ["Town", "Osu"],
                ["Street address", "Oxford Street, Ring Road"],
                ["GhanaPost GPS address", "GA-183-4408"],
                ["Map preview", "Map available for admin verification"],
              ]}
            />
          </DrawerSection>

          <DrawerSection title="Verification Documents">
            <DocumentList
              items={[
                ["Business registration certificate", "Verified"],
                ["Ghana Card", "Verified"],
                ["Tax certificate", "Verified"],
                ["Proof of business address", "Pending Review"],
                ["Bank settlement document", "Verified"],
              ]}
            />
          </DrawerSection>

          <DrawerSection title="Risk and Compliance">
            <GridInfo
              items={[
                ["Identity verification result", "Pass"],
                ["Business registration verification", "Pass"],
                ["Duplicate store check", "No duplicate found"],
                ["Fraud risk indicator", "Low Risk"],
                ["Restricted-business check", "Pass"],
                [
                  "Previous application history",
                  "No previous rejected applications",
                ],
                [
                  "Compliance notes",
                  "Settlement docs valid, address proof needs manual glance.",
                ],
              ]}
            />
          </DrawerSection>

          <DrawerSection title="Decision Options">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Button>Approve Store</Button>
              <Button variant="secondary">Approve with Conditions</Button>
              <Button variant="secondary">
                Request Additional Information
              </Button>
              <Button variant="secondary">Return for Correction</Button>
              <Button variant="secondary">Reject Application</Button>
              <Button variant="secondary">Escalate to Compliance Team</Button>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <TextPanel
                title="Internal notes"
                body="Store appears legitimate. Final address proof review required before unconditional approval."
              />
              <TextPanel
                title="Store-visible message"
                body="Please upload a clearer utility bill showing the same registered address."
              />
              <TextPanel
                title="Approval conditions"
                body="Store may go live after address proof is validated within 48 hours."
              />
              <TextPanel
                title="Required documents"
                body="Updated business address proof."
              />
              <TextPanel
                title="Rejection reason"
                body="Use only if document inconsistencies remain unresolved."
              />
              <InfoTile
                label="Decision confirmation checkbox"
                value="Confirmed"
              />
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button variant="secondary">Save Review Draft</Button>
              <Button>Submit Decision</Button>
            </div>
          </DrawerSection>

          <DrawerSection title="Audit History">
            <Timeline
              items={[
                {
                  title: "Application received",
                  body: "Store onboarding packet submitted.",
                  date: "August 2, 2026",
                },
                {
                  title: "Reviewer assigned",
                  body: "Assigned to Emmanuel for admin review.",
                  date: "August 3, 2026",
                },
                {
                  title: "Document check updated",
                  body: "Tax and settlement documents verified.",
                  date: "August 4, 2026",
                },
              ]}
            />
          </DrawerSection>
        </div>
      </div>
    </div>
  )
}

function StoreDetailsDrawer({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50">
      <button
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-2xl">
        <DrawerHeader
          title="Store Details"
          subtitle="CYTECH Gadgets • BPS-000184 • Verified • Active"
          onClose={onClose}
        />
        <div className="space-y-6">
          <div className="overflow-hidden rounded-[28px] border border-slate-200">
            <div className="h-36 bg-gradient-to-r from-blue-700 via-blue-600 to-purple-600" />
            <div className="p-5">
              <div className="-mt-16 flex h-20 w-20 items-center justify-center rounded-[24px] border-4 border-white bg-blue-100 text-2xl font-bold text-blue-700">
                CY
              </div>
              <div className="mt-4 text-xl font-bold text-slate-900">
                CYTECH Gadgets
              </div>
              <div className="mt-1 text-sm text-slate-500">
                Electronics • Greater Accra • Registered April 12, 2024
              </div>
            </div>
          </div>

          <GridInfo
            items={[
              ["Store ID", "BPS-000184"],
              ["Owner information", "Emmanuel Agyeman"],
              [
                "Contact details",
                "+233 24 880 1931 • emmanuel@cytechgadgets.com",
              ],
              ["Store location", "Osu, Accra • GA-183-4408"],
              ["Product count", "248"],
              ["Customer count", "1,182"],
              ["Active purchases", "418"],
              ["Total transaction value", "GHS 412,880.00"],
              ["Outstanding balance", "GHS 96,420.00"],
              ["Settlement status", "Settled"],
              ["Store risk indicator", "Low Risk"],
            ]}
          />

          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">
              Internal administrator notes
            </div>
            <div className="mt-2 text-sm text-slate-600">
              Strong payment completion rate and healthy onboarding history. No
              open compliance escalations.
            </div>
          </div>

          <DrawerSection title="Store Audit Trail">
            <Timeline
              items={[
                {
                  title: "Store approved",
                  body: "Onboarding approved by Platform Admin.",
                  date: "April 16, 2024",
                },
                {
                  title: "Verification renewed",
                  body: "Settlement document refreshed.",
                  date: "January 12, 2026",
                },
                {
                  title: "Transaction threshold updated",
                  body: "High-value monitoring threshold revised.",
                  date: "July 20, 2026",
                },
              ]}
            />
          </DrawerSection>
        </div>
      </div>
    </div>
  )
}

function CustomerDetailsDrawer({
  customer,
  decision,
  initialAction,
  onDecision,
  onClose,
}: {
  customer: CustomerRow
  decision?: CustomerVerificationDecision
  initialAction: "approve" | "documents" | null
  onDecision: (decision: CustomerVerificationDecision) => void
  onClose: () => void
}) {
  const risk = getCustomerRisk(customer.id)
  const [decisionMode, setDecisionMode] = useState<"approve" | "documents">(
    initialAction ?? "approve",
  )
  const [requestedDocuments, setRequestedDocuments] = useState(
    decision?.documents.join("\n") ?? "",
  )
  const [adminNote, setAdminNote] = useState(decision?.note ?? "")
  const [decisionError, setDecisionError] = useState("")
  const effectiveVerification = decision?.status ?? customer.verification
  const submitVerificationDecision = () => {
    const documents = requestedDocuments
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
    if (decisionMode === "documents" && !documents.length) {
      setDecisionError("List at least one document the customer must provide.")
      return
    }
    if (decisionMode === "documents" && !adminNote.trim()) {
      setDecisionError(
        "Add instructions explaining why the documents are required.",
      )
      return
    }
    onDecision({
      status:
        decisionMode === "approve" ? "Approved" : "Further Documents Required",
      documents: decisionMode === "approve" ? [] : documents,
      note:
        adminNote.trim() ||
        "Customer identity and submitted documents reviewed and approved.",
      decidedAt: new Date().toISOString(),
    })
    setDecisionError("")
  }
  return (
    <div className="fixed inset-0 z-50">
      <button
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute right-0 top-0 h-full w-full max-w-3xl overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-2xl">
        <DrawerHeader
          title="Customer Details"
          subtitle={`${customer.name} · ${customer.id} · ${effectiveVerification} · Risk assessed ${risk.assessedAt}`}
          onClose={onClose}
        />
        <div className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-blue-100 text-2xl font-bold text-blue-700">
                  {customer.initials}
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900">
                    {customer.name}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    AdepaPay code: {customer.id} | Ghana Card: verified and
                    protected
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {customer.id} · {customer.region}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Pill
                      tone={
                        effectiveVerification === "Approved" ||
                        effectiveVerification.includes("Verified")
                          ? "success"
                          : "pending"
                      }
                    >
                      {effectiveVerification}
                    </Pill>
                    <Pill tone={customer.tone}>{customer.account}</Pill>
                    <Pill
                      tone={
                        risk.level === "Low"
                          ? "success"
                          : risk.level === "High"
                            ? "danger"
                            : "pending"
                      }
                    >
                      {risk.level} Risk · {risk.score}/100
                    </Pill>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoTile label="Phone number" value={customer.phone} />
                <InfoTile label="Email address" value={customer.email} />
                <InfoTile label="Member since" value="March 18, 2026" />
                <InfoTile
                  label="Residential location"
                  value={customer.region}
                />
                <InfoTile label="GhanaPost GPS address" value="GA-492-1847" />
                <InfoTile
                  label="Nearest landmark"
                  value="East Legon Police Station"
                />
                <InfoTile label="Risk last assessed" value={risk.assessedAt} />
              </div>
            </div>
          </div>

          <DrawerSection title="Customer Summary">
            <GridInfo
              items={[
                ["Verification status", effectiveVerification],
                ["Total applications", customer.applications],
                ["Active purchases", customer.purchases],
                ["Total payments", customer.paid],
                ["Outstanding balance", customer.outstanding],
                ["Payment status", customer.paymentStatus],
                ["Risk score", `${risk.score} / 100 · ${risk.level}`],
                [
                  "Recent activity",
                  "Installment paid on Monday, August 3, 2026",
                ],
              ]}
            />
          </DrawerSection>

          <DrawerSection title="Customer Risk">
            <RiskScorePanel risk={risk} />
          </DrawerSection>

          <DrawerSection title="Customer Audit History">
            <Timeline
              items={[
                {
                  title: "Customer registered",
                  body: "Account created and email confirmed.",
                  date: "March 18, 2026",
                },
                {
                  title: "Identity verified",
                  body: "Ghana Card and selfie verification completed.",
                  date: "March 19, 2026",
                },
                {
                  title: "First purchase activated",
                  body: "Samsung QLED TV repayment started.",
                  date: "June 18, 2026",
                },
                {
                  title: "Latest installment received",
                  body: "Payment of GHS 820.83 received successfully.",
                  date: "Monday, August 3, 2026",
                },
              ]}
            />
          </DrawerSection>

          <DrawerSection title="Admin Verification Decision">
            {decision && (
              <div
                className={`mb-5 rounded-2xl border p-4 ${
                  decision.status === "Approved"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold">
                    Current decision: {decision.status}
                  </div>
                  <div className="text-xs">
                    {new Intl.DateTimeFormat("en-GH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(decision.decidedAt))}
                  </div>
                </div>
                <p className="mt-2 text-sm">{decision.note}</p>
                {!!decision.documents.length && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {decision.documents.map((document) => (
                      <span
                        key={document}
                        className="rounded-full bg-white px-3 py-1 text-xs font-bold"
                      >
                        {document}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => {
                  setDecisionMode("approve")
                  setDecisionError("")
                }}
                className={`rounded-2xl border p-4 text-left ${
                  decisionMode === "approve"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                    : "border-slate-200"
                }`}
              >
                <div className="font-bold">Approve Customer</div>
                <div className="mt-1 text-xs">
                  Confirm identity and activate the verified customer profile.
                </div>
              </button>
              <button
                onClick={() => {
                  setDecisionMode("documents")
                  setDecisionError("")
                }}
                className={`rounded-2xl border p-4 text-left ${
                  decisionMode === "documents"
                    ? "border-amber-500 bg-amber-50 text-amber-800"
                    : "border-slate-200"
                }`}
              >
                <div className="font-bold">Request Further Documents</div>
                <div className="mt-1 text-xs">
                  Keep verification pending and send document instructions.
                </div>
              </button>
            </div>
            {decisionMode === "documents" && (
              <label className="mt-5 block">
                <span className="text-xs font-bold text-slate-600">
                  Required documents *
                </span>
                <textarea
                  value={requestedDocuments}
                  onChange={(event) =>
                    setRequestedDocuments(event.target.value)
                  }
                  rows={3}
                  placeholder="Bank statement&#10;Proof of address&#10;Clearer Ghana Card image"
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                />
              </label>
            )}
            <label className="mt-5 block">
              <span className="text-xs font-bold text-slate-600">
                Admin note {decisionMode === "documents" ? "*" : "(optional)"}
              </span>
              <textarea
                value={adminNote}
                onChange={(event) => setAdminNote(event.target.value)}
                rows={3}
                placeholder={
                  decisionMode === "approve"
                    ? "Add an internal approval note"
                    : "Explain what is required and why"
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
              />
            </label>
            {decisionError && (
              <p className="mt-2 text-xs font-bold text-red-600">
                {decisionError}
              </p>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <button
                onClick={submitVerificationDecision}
                className={`rounded-2xl px-5 py-3 text-sm font-bold text-white ${
                  decisionMode === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {decisionMode === "approve"
                  ? "Approve Customer"
                  : "Send Document Request"}
              </button>
            </div>
          </DrawerSection>
        </div>
      </div>
    </div>
  )
}

function TransactionDetailsDrawer({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50">
      <button
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute right-0 top-0 h-full w-full max-w-3xl overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-2xl">
        <DrawerHeader
          title="Transaction Details"
          subtitle="BPTX-241180 • Gateway MOMO-GH-991182 • Reviewed Tuesday, August 4, 2026 at 11:08 AM"
          onClose={onClose}
        />
        <div className="space-y-6">
          <DrawerSection title="Transaction Summary">
            <GridInfo
              items={[
                ["Transaction reference", "BPTX-241180"],
                ["Gateway reference", "MOMO-GH-991182"],
                ["Customer details", "Kwame Asante • BPC-001842"],
                ["Store details", "CYTECH Gadgets • BPS-000184"],
                ["Purchase information", "BPP-2026-00311"],
                ["Gross amount", "GHS 1,100.00"],
                ["Processing fee", "GHS 16.00"],
                ["Net amount", "GHS 1,084.00"],
                ["Payment channel", "MTN Mobile Money"],
                ["Payer number", "+233 24 601 1182"],
                ["Date and time", "Tuesday, August 4, 2026 • 9:12 AM"],
                ["IP address", "154.160.18.102"],
                ["Device information", "iPhone 15 Pro • iOS Safari"],
              ]}
            />
          </DrawerSection>

          <DrawerSection title="Payment-Status Timeline">
            <Timeline
              items={[
                {
                  title: "Transaction created",
                  body: "Customer initiated installment payment.",
                  date: "Tuesday, August 4, 2026 • 9:10 AM",
                },
                {
                  title: "Authorization received",
                  body: "Mobile money authorization completed successfully.",
                  date: "Tuesday, August 4, 2026 • 9:11 AM",
                },
                {
                  title: "Payment successful",
                  body: "Gateway marked the transaction as successful.",
                  date: "Tuesday, August 4, 2026 • 9:12 AM",
                },
              ]}
            />
          </DrawerSection>

          <DrawerSection title="Settlement-Status Timeline">
            <Timeline
              items={[
                {
                  title: "Settlement queued",
                  body: "Included in next settlement batch.",
                  date: "Tuesday, August 4, 2026 • 9:14 AM",
                },
                {
                  title: "Settlement processing",
                  body: "Scheduled for Friday, August 7, 2026 payout.",
                  date: "Tuesday, August 4, 2026 • 10:00 AM",
                },
              ]}
            />
          </DrawerSection>

          <DrawerSection title="Risk Indicators">
            <GridInfo
              items={[
                ["Risk level", "Low Risk"],
                ["High-value flag", "No"],
                [
                  "Suspicious activity indicator",
                  "No suspicious pattern detected",
                ],
                ["Dispute status", "No dispute"],
                ["Settlement hold", "Not held"],
                [
                  "Administrator notes",
                  "Healthy payment pattern and normal device metadata.",
                ],
              ]}
            />
          </DrawerSection>
        </div>
      </div>
    </div>
  )
}

function RefundModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-2xl rounded-[32px] border border-slate-200 bg-white p-6 shadow-2xl">
        <DrawerHeader
          title="Initiate Refund"
          subtitle="Transaction BPTX-240944 • Thursday, July 30, 2026 • Authorized admin action required"
          onClose={onClose}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <InfoTile label="Refund amount" value="GHS 1,150.00" />
          <InfoTile label="Refund type" value="Full refund" />
          <TextPanel
            title="Refund reason"
            body="Customer purchase cancelled after policy-based fulfillment review."
          />
          <TextPanel
            title="Customer-visible message"
            body="Your refund has been initiated and should reflect in your payment channel shortly."
          />
          <TextPanel
            title="Internal note"
            body="Refund approved by admin after verifying store cancellation and settlement impact."
          />
          <InfoTile label="Authorization PIN" value="••••" />
          <InfoTile label="Confirmation checkbox" value="Confirmed" />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="secondary">Cancel</Button>
          <Button>Process Refund</Button>
        </div>
      </div>
    </div>
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
          <IconButton dark onClick={onClose}>
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
              title={collapsed ? item.label : undefined}
              className={`flex w-full items-center rounded-2xl py-3 text-left text-sm font-semibold transition ${
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
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SectionHeader({
  title,
  description,
  actions,
}: {
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  )
}

function MetricCard({ metric }: { metric: Metric }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-slate-500">
            {metric.title}
          </div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {metric.value}
          </div>
          <div className="mt-2 text-sm text-slate-500">{metric.detail}</div>
          <div className="mt-3 flex items-center gap-3 text-xs font-semibold">
            <span className={trendClass(metric.tone)}>{metric.trend}</span>
            <ActionLink>View Details</ActionLink>
          </div>
        </div>
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${toneClass(metric.tone)}`}
        >
          {metric.icon}
        </div>
      </div>
    </Card>
  )
}

function ChartPanel({
  title,
  description,
  chips,
  legend,
  groups,
  footer,
}: {
  title: string
  description: string
  chips: string[]
  legend: Array<[string, string]>
  groups: Array<{ label: string values: number[] }>
  footer: string
}) {
  const max = Math.max(...groups.flatMap((group) => group.values))
  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-lg font-bold text-slate-900">{title}</div>
          <div className="mt-1 text-sm text-slate-500">{description}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {chips.map((chip, index) => (
            <button
              key={chip}
              className={`rounded-2xl px-3 py-2 text-xs font-semibold ${
                index === 2 || (chips.length === 3 && index === 0)
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 text-slate-600"
              }`}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        {legend.map(([label, color]) => (
          <div
            key={label}
            className="flex items-center gap-2 text-xs font-semibold text-slate-500"
          >
            <span className={`h-3 w-3 rounded-full ${color}`} />
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {groups.map((group) => (
          <div
            key={group.label}
            className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
          >
            <div className="flex h-48 items-end gap-2">
              {group.values.map((value, index) => {
                const color = legend[index]?.[1] ?? "bg-slate-400"
                return (
                  <div
                    key={group.label + index}
                    className={`w-full rounded-t-xl ${color}`}
                    style={{ height: `${(value / max) * 100}%` }}
                    title={`${legend[index]?.[0]}: ${value}`}
                  />
                )
              })}
            </div>
            <div className="mt-3 text-center text-sm font-semibold text-slate-700">
              {group.label}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        {footer}
      </div>
    </Card>
  )
}

function TableCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="text-lg font-bold text-slate-900">{title}</div>
        <div className="mt-1 text-sm text-slate-500">{description}</div>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </Card>
  )
}

const ADMIN_MODULE_DATA: Partial<Record<NavId, {
  title: string
  description: string
  action: string
  metrics: string[][]
  columns: string[]
  rows: string[][]
}>> = {
  products: {
    title: "Products",
    description:
      "Review and manage products listed by AdepaPay partner stores.",
    action: "Export Products",
    metrics: [
      ["Total Products", "18,420"],
      ["Active Products", "16,882"],
      ["Pending Approval", "284"],
      ["Suspended", "46"],
    ],
    columns: [
      "Product",
      "SKU",
      "Store",
      "Category",
      "Cash Price",
      "Stock",
      "Status",
    ],
    rows: [
      [
        "MacBook Pro 14” M3",
        "CY-MBP-014",
        "CYTECH Gadgets",
        "Laptops",
        "GHS 18,500",
        "12",
        "Active",
      ],
      [
        "Samsung 65” QLED TV",
        "AH-SAM-065",
        "Adepa Home",
        "Electronics",
        "GHS 8,400",
        "8",
        "Pending Approval",
      ],
      [
        "LG Double Door Fridge",
        "NA-LGF-410",
        "Nova Appliances",
        "Appliances",
        "GHS 5,650",
        "0",
        "Out of Stock",
      ],
    ],
  },
  categories: {
    title: "Categories",
    description:
      "Manage global product categories available to all AdepaPay stores.",
    action: "Add Category",
    metrics: [
      ["Total Categories", "48"],
      ["Active Categories", "44"],
      ["Subcategories", "126"],
      ["Restricted", "3"],
    ],
    columns: [
      "Category",
      "Code",
      "Parent",
      "Products",
      "Stores",
      "Visibility",
      "Status",
    ],
    rows: [
      [
        "Smartphones",
        "CAT-MOB",
        "Electronics",
        "4,820",
        "184",
        "Public",
        "Active",
      ],
      ["Laptops", "CAT-LAP", "Electronics", "2,640", "126", "Public", "Active"],
      [
        "Home Appliances",
        "CAT-HAP",
        "Marketplace",
        "3,186",
        "98",
        "Public",
        "Active",
      ],
    ],
  },
  applications: {
    title: "Hire Purchase Applications",
    description:
      "Monitor and review customer applications across the platform.",
    action: "Export Applications",
    metrics: [
      ["Total Applications", "8,842"],
      ["Under Review", "386"],
      ["Approved", "6,420"],
      ["Rejected", "612"],
    ],
    columns: [
      "Reference",
      "Customer",
      "Store",
      "Product",
      "Amount",
      "Risk",
      "Status",
    ],
    rows: [
      [
        "BPA-2026-004582",
        "Ama Owusu",
        "CYTECH Gadgets",
        "MacBook Pro 14”",
        "GHS 12,800",
        "Low",
        "Under Review",
      ],
      [
        "BPA-2026-004511",
        "Kwame Asante",
        "Adepa Home",
        "Samsung QLED TV",
        "GHS 8,400",
        "Low",
        "Approved",
      ],
      [
        "BPA-2026-004402",
        "Yaw Boateng",
        "Nova Appliances",
        "LG Refrigerator",
        "GHS 5,650",
        "Review",
        "Documents Needed",
      ],
    ],
  },
  "active-purchases": {
    title: "Active Purchases",
    description:
      "Monitor active hire-purchase agreements and repayment health.",
    action: "Export Purchases",
    metrics: [
      ["Active Purchases", "3,286"],
      ["Total Value", "GHS 8.4M"],
      ["Outstanding", "GHS 1.84M"],
      ["Overdue", "217"],
    ],
    columns: [
      "Reference",
      "Customer",
      "Store",
      "Product",
      "Amount Paid",
      "Outstanding",
      "Status",
    ],
    rows: [
      [
        "BPP-2026-00311",
        "Kwame Asante",
        "CYTECH Gadgets",
        "MacBook Pro 14”",
        "GHS 8,400",
        "GHS 4,200",
        "On Track",
      ],
      [
        "BPP-2026-00228",
        "Abena Tandoh",
        "Adepa Home",
        "Samsung QLED TV",
        "GHS 6,650",
        "GHS 1,750",
        "Due Soon",
      ],
      [
        "BPP-2026-00144",
        "Yaw Boateng",
        "Nova Appliances",
        "LG Refrigerator",
        "GHS 2,100",
        "GHS 3,550",
        "Overdue",
      ],
    ],
  },
  notifications: {
    title: "Notifications",
    description: "Review platform, security, payment, and compliance alerts.",
    action: "Mark All as Read",
    metrics: [
      ["Unread Alerts", "12"],
      ["High Priority", "4"],
      ["System Alerts", "3"],
      ["Compliance", "5"],
    ],
    columns: [
      "Notification",
      "Category",
      "Related Account",
      "Date",
      "Priority",
      "Status",
    ],
    rows: [
      [
        "Suspicious transaction requires review",
        "Risk",
        "BPTX-241124",
        "Today 10:42 AM",
        "High",
        "Unread",
      ],
      [
        "Store verification documents updated",
        "Stores",
        "BPS-000176",
        "Today 9:18 AM",
        "Normal",
        "Unread",
      ],
      [
        "Payment gateway latency recovered",
        "System",
        "Paystack",
        "Yesterday",
        "Normal",
        "Read",
      ],
    ],
  },
  "audit-logs": {
    title: "Audit Logs",
    description: "Track administrator actions and critical platform changes.",
    action: "Export Audit Logs",
    metrics: [
      ["Events Today", "1,284"],
      ["Admin Actions", "146"],
      ["Security Events", "18"],
      ["Configuration Changes", "12"],
    ],
    columns: [
      "Event ID",
      "Administrator",
      "Action",
      "Module",
      "IP Address",
      "Date & Time",
      "Result",
    ],
    rows: [
      [
        "AUD-882104",
        "Emmanuel Mensah",
        "Approved store",
        "Store Approvals",
        "102.176.8.24",
        "Aug 4, 10:46 AM",
        "Successful",
      ],
      [
        "AUD-882088",
        "Mavis Owusu",
        "Updated payment rule",
        "Settings",
        "102.176.8.31",
        "Aug 4, 9:22 AM",
        "Successful",
      ],
      [
        "AUD-882041",
        "System",
        "Flagged transaction",
        "Risk Engine",
        "Internal",
        "Aug 4, 8:14 AM",
        "Review",
      ],
    ],
  },
  support: {
    title: "Help and Support",
    description:
      "Manage platform support requests and access administrator resources.",
    action: "Create Support Ticket",
    metrics: [
      ["Open Tickets", "34"],
      ["High Priority", "8"],
      ["Resolved Today", "46"],
      ["Average Response", "18 min"],
    ],
    columns: [
      "Ticket",
      "Requester",
      "Subject",
      "Category",
      "Created",
      "Priority",
      "Status",
    ],
    rows: [
      [
        "BPSUP-1842",
        "CYTECH Gadgets",
        "Settlement delayed",
        "Payments",
        "Today 10:20 AM",
        "High",
        "In Progress",
      ],
      [
        "BPSUP-1838",
        "Ama Owusu",
        "Verification support",
        "Customer",
        "Today 9:45 AM",
        "Normal",
        "Open",
      ],
      [
        "BPSUP-1824",
        "Adepa Home",
        "Product approval",
        "Products",
        "Yesterday",
        "Normal",
        "Resolved",
      ],
    ],
  },
}

function AdminModulePage({ page }: { page: NavId }) {
  const data = ADMIN_MODULE_DATA[page]
  if (!data) return null
  return (
    <div className="space-y-6">
      <SectionHeader
        title={data.title}
        description={data.description}
        actions={data.action ? <Button>{data.action}</Button> : undefined}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.metrics.map(([label, value]) => (
          <Card key={label} className="p-5">
            <div className="text-sm font-medium text-slate-500">{label}</div>
            <div className="mt-3 text-2xl font-bold">{value}</div>
            <button className="mt-3 text-xs font-bold text-blue-600">
              View details →
            </button>
          </Card>
        ))}
      </div>
      <CustomerPageToolbar placeholder={`Search ${data.title.toLowerCase()}`} />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {data.columns.map((c) => (
                  <th key={c} className="px-5 py-4">
                    {c}
                  </th>
                ))}
                <th className="px-5 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr
                  key={i}
                  className="border-t border-slate-100 hover:bg-slate-50"
                >
                  {row.map((cell, j) => (
                    <td key={j} className="px-5 py-4">
                      <span
                        className={
                          j === row.length - 1
                            ? "rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700"
                            : ""
                        }
                      >
                        {cell}
                      </span>
                    </td>
                  ))}
                  <td className="px-5 py-4">
                    <button className="font-bold text-blue-600">
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4 text-sm text-slate-500">
          <span>Showing 1–3 of many records</span>
          <div className="flex gap-2">
            <button className="rounded-lg border px-3 py-1.5">Previous</button>
            <button className="rounded-lg bg-blue-600 px-3 py-1.5 text-white">
              Next
            </button>
          </div>
        </div>
      </Card>
    </div>
  )
}

function StoreLayawayOverview({
  onNavigate,
}: {
  onNavigate: (id: NavId) => void
}) {
  const metrics = [
    ["Active Plans", "64"],
    ["Applications Pending", "9"],
    ["Expected Today", "GHS 4,850"],
    ["Collected Today", "GHS 3,950"],
    ["Outstanding Balance", "GHS 186,420"],
    ["Overdue Plans", "7"],
    ["Awaiting Collection", "5"],
    ["Products Reserved", "69"],
    ["Active Agents", "8"],
    ["Cash Pending", "GHS 6,240"],
  ]
  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold">Layaway Overview</h2>
          <p className="mt-1 text-sm text-slate-500">
            Expected GHS 4,850 · Collected GHS 3,950 · Remaining GHS 900 · 81.4%
            collection rate
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => onNavigate("applications")}
          >
            Review Layaway Applications
          </Button>
          <Button
            variant="secondary"
            onClick={() => onNavigate("collection-agents")}
          >
            Manage Agents
          </Button>
          <Button onClick={() => onNavigate("agent-settlements")}>
            Record Collection
          </Button>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="text-xs font-semibold text-slate-500">{label}</div>
            <div className="mt-2 text-lg font-bold">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-5">
        <div className="flex justify-between text-xs font-bold">
          <span>Today's collection progress</span>
          <span>81.4%</span>
        </div>
        <div className="mt-2 h-3 rounded-full bg-slate-100">
          <div className="h-full w-[81.4%] rounded-full bg-gradient-to-r from-blue-600 to-emerald-500" />
        </div>
      </div>
    </Card>
  )
}

function StoreManagerDashboard({
  onNavigate,
}: {
  onNavigate: (id: NavId) => void
}) {
  const metrics = [
    ["Total Products", "248", "232 active"],
    ["Products in Stock", "219", "88% inventory health"],
    ["Pending Applications", "18", "6 require attention"],
    ["Active Purchases", "84", "GHS 412,880 value"],
    ["Payments This Month", "GHS 48,650", "+12.4% this month"],
    ["Outstanding Balance", "GHS 76,420", "12 due this week"],
  ]
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Good morning, Emmanuel"
        description="Here is today’s overview of CYTECH Gadgets."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => onNavigate("applications")}
            >
              Review Applications
            </Button>
            <Button
              variant="secondary"
              onClick={() => onNavigate("layaway-plans")}
            >
              View Layaway Plans
            </Button>
            <Button onClick={() => onNavigate("products")}>Add Product</Button>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map(([a, b, c]) => (
          <Card key={a} className="p-5">
            <div className="text-sm font-medium text-slate-500">{a}</div>
            <div className="mt-3 text-2xl font-bold">{b}</div>
            <div className="mt-2 text-xs font-semibold text-emerald-600">
              {c}
            </div>
          </Card>
        ))}
      </div>
      <StoreLayawayOverview onNavigate={onNavigate} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-lg font-bold">Recent Applications</h3>
          {[
            ["Ama Owusu", "MacBook Pro 14”", "GHS 12,800", "Under Review"],
            ["Kwame Asante", "Samsung Galaxy S25", "GHS 9,450", "New"],
            ["Nana Mensah", "Dell XPS 13", "GHS 11,200", "Documents Needed"],
          ].map((r) => (
            <div
              key={r[0]}
              className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-4"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 font-bold text-blue-700">
                {r[0]
                  .split(" ")
                  .map((x) => x[0])
                  .join("")}
              </div>
              <div className="flex-1">
                <div className="font-semibold">{r[0]}</div>
                <div className="text-xs text-slate-500">
                  {r[1]} · {r[2]}
                </div>
              </div>
              <span className="text-xs font-bold text-amber-700">{r[3]}</span>
            </div>
          ))}
          <button
            onClick={() => onNavigate("applications")}
            className="mt-5 text-sm font-bold text-blue-600"
          >
            View all applications →
          </button>
        </Card>
        <Card className="p-5">
          <h3 className="text-lg font-bold">Low Stock Products</h3>
          {[
            ["MacBook Air M3", "SKU-MAC-034", "4 left"],
            ["AirPods Pro 2", "SKU-APP-088", "3 left"],
            ["Samsung Galaxy S25", "SKU-SAM-121", "5 left"],
          ].map((r) => (
            <div
              key={r[0]}
              className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4"
            >
              <div>
                <div className="font-semibold">{r[0]}</div>
                <div className="text-xs text-slate-500">{r[1]}</div>
              </div>
              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                {r[2]}
              </span>
            </div>
          ))}
        </Card>
      </div>
      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <h3 className="text-lg font-bold">Store status</h3>
            <p className="mt-1 text-sm text-slate-500">
              Verified · Operational · Settlements active
            </p>
          </div>
          <div className="w-full sm:w-64">
            <div className="flex justify-between text-xs font-bold">
              <span>Profile completion</span>
              <span>94%</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-100">
              <div className="h-full w-[94%] rounded-full bg-emerald-500" />
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={() => onNavigate("store-profile")}
          >
            Complete Profile
          </Button>
        </div>
      </Card>
    </div>
  )
}

const STORE_PAGE_DATA: Partial<Record<NavId, {
  title: string
  description: string
  action: string
  metrics: string[][]
  columns: string[]
  rows: string[][]
}>> = {
  products: {
    title: "Products",
    description: "Manage all products listed in your AdepaPay store.",
    action: "Add Product",
    metrics: [
      ["Total Products", "248"],
      ["Active", "232"],
      ["Low Stock", "12"],
      ["Out of Stock", "4"],
    ],
    columns: ["Product", "SKU", "Category", "Cash Price", "Stock", "Status"],
    rows: [
      [
        "MacBook Pro 14”",
        "CY-MBP-014",
        "Laptops",
        "GHS 18,500",
        "12",
        "Active",
      ],
      [
        "Samsung Galaxy S25",
        "CY-S25-256",
        "Smartphones",
        "GHS 9,450",
        "5",
        "Low Stock",
      ],
      [
        "AirPods Pro 2",
        "CY-APP-002",
        "Accessories",
        "GHS 2,850",
        "3",
        "Low Stock",
      ],
    ],
  },
  categories: {
    title: "Product Categories",
    description: "Organize your store products into clear categories.",
    action: "Add Category",
    metrics: [
      ["Total Categories", "12"],
      ["Active", "10"],
      ["With Products", "9"],
      ["Empty", "1"],
    ],
    columns: ["Category", "Parent", "Products", "Visibility", "Status"],
    rows: [
      ["Smartphones", "Electronics", "84", "Public", "Active"],
      ["Laptops", "Electronics", "46", "Public", "Active"],
      ["Accessories", "Electronics", "72", "Public", "Active"],
    ],
  },
  customers: {
    title: "Customers",
    description: "View customers connected to your store.",
    action: "Export Customers",
    metrics: [
      ["Total Customers", "1,182"],
      ["New This Month", "84"],
      ["Active Purchases", "326"],
      ["Overdue", "18"],
    ],
    columns: [
      "Customer",
      "Customer ID",
      "Phone",
      "Applications",
      "Outstanding",
      "Status",
    ],
    rows: [
      [
        "Ama Owusu",
        "BPC-002117",
        "+233 20 918 4405",
        "3",
        "GHS 4,960",
        "Active",
      ],
      [
        "Kwame Asante",
        "BPC-001842",
        "+233 24 601 1182",
        "4",
        "GHS 1,820",
        "Verified",
      ],
      [
        "Yaw Boateng",
        "BPC-002601",
        "+233 27 331 7004",
        "2",
        "GHS 2,100",
        "Overdue",
      ],
    ],
  },
  applications: {
    title: "Hire Purchase Applications",
    description:
      "Review and manage customer applications for your store products.",
    action: "Export Applications",
    metrics: [
      ["Total", "128"],
      ["New", "18"],
      ["Under Review", "34"],
      ["Approved", "62"],
    ],
    columns: ["Reference", "Customer", "Product", "Amount", "Risk", "Status"],
    rows: [
      [
        "BPA-2026-004582",
        "Ama Owusu",
        "MacBook Pro 14”",
        "GHS 12,800",
        "Low",
        "Under Review",
      ],
      [
        "BPA-2026-004511",
        "Kwame Asante",
        "Galaxy S25",
        "GHS 9,450",
        "Low",
        "New",
      ],
      [
        "BPA-2026-004402",
        "Yaw Boateng",
        "Dell XPS 13",
        "GHS 11,200",
        "Review",
        "Documents Needed",
      ],
    ],
  },
  "active-purchases": {
    title: "Active Purchases",
    description: "Track active agreements and customer repayment progress.",
    action: "Export Purchases",
    metrics: [
      ["Active Purchases", "84"],
      ["Purchase Value", "GHS 412,880"],
      ["Amount Received", "GHS 286,460"],
      ["Overdue", "7"],
    ],
    columns: [
      "Reference",
      "Customer",
      "Product",
      "Paid",
      "Outstanding",
      "Status",
    ],
    rows: [
      [
        "BPP-2026-00311",
        "Kwame Asante",
        "MacBook Pro 14”",
        "GHS 8,400",
        "GHS 4,200",
        "On Track",
      ],
      [
        "BPP-2026-00228",
        "Abena Tandoh",
        "Galaxy S25",
        "GHS 6,650",
        "GHS 2,800",
        "Due Soon",
      ],
      [
        "BPP-2026-00144",
        "Yaw Boateng",
        "Dell XPS 13",
        "GHS 3,500",
        "GHS 7,700",
        "Overdue",
      ],
    ],
  },
  payments: {
    title: "Payments",
    description: "Track customer payments, balances, and store settlements.",
    action: "",
    metrics: [
      ["Total Received", "GHS 286,460"],
      ["This Month", "GHS 48,650"],
      ["Pending", "GHS 8,420"],
      ["Next Settlement", "GHS 32,180"],
    ],
    columns: [
      "Transaction",
      "Customer",
      "Purchase",
      "Method",
      "Amount",
      "Status",
    ],
    rows: [
      [
        "BPTX-241180",
        "Kwame Asante",
        "BPP-2026-00311",
        "MTN MoMo",
        "GHS 1,100",
        "Successful",
      ],
      [
        "BPTX-241171",
        "Ama Owusu",
        "BPP-2026-00192",
        "Bank Card",
        "GHS 820",
        "Pending",
      ],
      [
        "BPTX-241124",
        "Yaw Boateng",
        "BPP-2026-00144",
        "Telecel Cash",
        "GHS 695",
        "Failed",
      ],
    ],
  },
  reports: {
    title: "Reports and Analytics",
    description:
      "Monitor store performance, applications, purchases, and payments.",
    action: "Export Report",
    metrics: [
      ["Product Views", "28,420"],
      ["Applications", "128"],
      ["Approval Rate", "72.4%"],
      ["Payments Received", "GHS 286,460"],
    ],
    columns: ["Report", "Period", "Last Generated", "Format", "Status"],
    rows: [
      [
        "Applications Report",
        "This Month",
        "Aug 4, 2026",
        "PDF / CSV",
        "Ready",
      ],
      [
        "Product Performance",
        "Last 30 Days",
        "Aug 3, 2026",
        "PDF / CSV",
        "Ready",
      ],
      [
        "Settlement Report",
        "This Quarter",
        "Aug 1, 2026",
        "PDF / CSV",
        "Ready",
      ],
    ],
  },
  notifications: {
    title: "Notifications",
    description: "Review store, application, payment, and inventory alerts.",
    action: "Mark All Read",
    metrics: [
      ["Unread", "12"],
      ["Applications", "5"],
      ["Payments", "4"],
      ["Inventory", "3"],
    ],
    columns: ["Notification", "Category", "Date", "Priority", "Status"],
    rows: [
      [
        "New application received",
        "Applications",
        "Today 10:24 AM",
        "Normal",
        "Unread",
      ],
      [
        "Payment of GHS 1,100 received",
        "Payments",
        "Today 9:12 AM",
        "Normal",
        "Unread",
      ],
      [
        "MacBook Air M3 stock is low",
        "Inventory",
        "Yesterday",
        "High",
        "Unread",
      ],
    ],
  },
  support: {
    title: "Help and Support",
    description: "Get help managing your store and customer transactions.",
    action: "New Support Request",
    metrics: [
      ["Open Tickets", "2"],
      ["Resolved", "18"],
      ["Response Time", "< 2 hours"],
      ["Help Articles", "48"],
    ],
    columns: ["Ticket", "Subject", "Created", "Priority", "Status"],
    rows: [
      [
        "BPSUP-0081",
        "Settlement verification",
        "Aug 3, 2026",
        "High",
        "In Progress",
      ],
      [
        "BPSUP-0074",
        "Product approval question",
        "Jul 28, 2026",
        "Normal",
        "Resolved",
      ],
    ],
  },
}

function BanCustomerModal({
  customerName,
  customerId,
  scope,
  onClose,
  onConfirm,
}: {
  customerName: string
  customerId: string
  scope: "platform" | "store"
  onClose: () => void
  onConfirm: (reason: string, duration: string) => void
}) {
  const [reason, setReason] = useState("")
  const [duration, setDuration] = useState("Until manually removed")
  const [error, setError] = useState("")
  const submit = () => {
    if (reason.trim().length < 10) {
      setError("Provide a clear reason of at least 10 characters")
      return
    }
    onConfirm(reason.trim(), duration)
  }
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <button
        className="absolute inset-0"
        onClick={onClose}
        aria-label="Close ban dialog"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ban-customer-title"
        className="relative w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl sm:p-7"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <IconWarning />
          </div>
          <div>
            <h3 id="ban-customer-title" className="text-xl font-bold">
              Ban {customerName}?
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              {scope === "platform"
                ? "This blocks the customer from signing in, applying, purchasing, or paying through AdepaPay."
                : "This blocks the customer from applying for or purchasing products from your store. Their AdepaPay account remains active elsewhere."}
            </p>
          </div>
        </div>
        <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-800">
          <div className="font-bold">
            {scope === "platform" ? "Platform-wide ban" : "Store-only ban"}
          </div>
          <div className="mt-1 text-xs">
            {customerName} · {customerId}
          </div>
        </div>
        <label className="mt-5 block">
          <span className="text-xs font-bold text-slate-600">
            Reason for ban *
          </span>
          <textarea
            value={reason}
            onChange={(event) => {
              setReason(event.target.value)
              setError("")
            }}
            rows={4}
            placeholder="Describe the policy, fraud, payment, or conduct reason..."
            className={`mt-2 w-full resize-none rounded-2xl border px-4 py-3 text-sm outline-none focus:border-red-400 ${
              error ? "border-red-400" : "border-slate-200"
            }`}
          />
          {error && (
            <span className="mt-1 block text-xs text-red-600">{error}</span>
          )}
        </label>
        <label className="mt-4 block">
          <span className="text-xs font-bold text-slate-600">Ban duration</span>
          <select
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
          >
            <option>7 days</option>
            <option>30 days</option>
            <option>90 days</option>
            <option>Until manually removed</option>
          </select>
        </label>
        <label className="mt-4 flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">
          <input
            type="checkbox"
            defaultChecked
            className="mt-1 accent-red-600"
          />
          <span>
            Notify the customer and record this action in the audit log.
          </span>
        </label>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <button
            onClick={submit}
            className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/20 hover:bg-red-700"
          >
            Confirm ban
          </button>
        </div>
      </div>
    </div>
  )
}

type CustomerMerchantReview = {
  id: string
  store: string
  manager: string
  rating: number
  note: string
  tags: string[]
  date: string
}

function StoreCustomersPage() {
  const customers = [
    {
      name: "Ama Owusu",
      id: "BPC-002117",
      phone: "+233 20 918 4405",
      applications: "3",
      outstanding: "GHS 4,960",
      status: "Active",
      risk: getCustomerRisk("BPC-002117"),
    },
    {
      name: "Kwame Asante",
      id: "BPC-001842",
      phone: "+233 24 601 1182",
      applications: "4",
      outstanding: "GHS 1,820",
      status: "Verified",
      risk: getCustomerRisk("BPC-001842"),
    },
    {
      name: "Yaw Boateng",
      id: "BPC-002601",
      phone: "+233 27 331 7004",
      applications: "2",
      outstanding: "GHS 2,100",
      status: "Overdue",
      risk: getCustomerRisk("BPC-002601"),
    },
  ]
  const [banned, setBanned] = useState<string[]>([])
  const [target, setTarget] = useState<typeof customers[number] | null>(null)
  const [reviewTarget, setReviewTarget] =
    useState<typeof customers[number] | null>(null)
  const [customerReviews, setCustomerReviews] =
    useState<Record<string, CustomerMerchantReview[]>>({})
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Store Customers"
        description="Manage customers connected to CYTECH Gadgets. Store bans do not affect their access to other AdepaPay stores."
        actions={<Button variant="secondary">Export Customers</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total Customers", "1,182"],
          ["New This Month", "84"],
          ["Active Purchases", "326"],
          ["Banned at Store", String(banned.length)],
        ].map(([label, value], index) => (
          <Card key={label} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-slate-500">{label}</div>
                <div
                  className={`mt-3 text-2xl font-bold ${
                    index === 3 && banned.length ? "text-red-600" : ""
                  }`}
                >
                  {value}
                </div>
              </div>
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                  index === 3
                    ? "bg-red-50 text-red-600"
                    : "bg-blue-50 text-blue-600"
                }`}
              >
                {index === 3 ? <IconLock /> : <IconUsers />}
              </span>
            </div>
          </Card>
        ))}
      </div>
      <CustomerPageToolbar placeholder="Search customer name, ID, or phone" />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {[
                  "Customer",
                  "Customer ID",
                  "Phone",
                  "Applications",
                  "Outstanding",
                  "Risk score",
                  "Status",
                  "Actions",
                ].map((label) => (
                  <th key={label} className="px-5 py-4">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => {
                const isBanned = banned.includes(customer.id)
                return (
                  <tr key={customer.id} className="border-t border-slate-100">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 font-bold text-blue-700">
                          {customer.name
                            .split(" ")
                            .map((part) => part[0])
                            .join("")}
                        </span>
                        <span className="font-bold">{customer.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">{customer.id}</td>
                    <td className="px-5 py-4">{customer.phone}</td>
                    <td className="px-5 py-4">{customer.applications}</td>
                    <td className="px-5 py-4 font-semibold">
                      {customer.outstanding}
                    </td>
                    <td className="px-5 py-4">
                      <Pill
                        tone={
                          customer.risk.level === "Low"
                            ? "success"
                            : customer.risk.level === "High"
                              ? "danger"
                              : "pending"
                        }
                      >
                        {customer.risk.score}/100 · {customer.risk.level}
                      </Pill>
                    </td>
                    <td className="px-5 py-4">
                      <Pill
                        tone={
                          isBanned
                            ? "danger"
                            : customer.status === "Overdue"
                              ? "pending"
                              : "success"
                        }
                      >
                        {isBanned ? "Banned from store" : customer.status}
                      </Pill>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setReviewTarget(customer)}
                          className="font-bold text-blue-600"
                        >
                          Profile & Reviews
                        </button>
                        {isBanned ? (
                          <button
                            onClick={() =>
                              setBanned((ids) =>
                                ids.filter((id) => id !== customer.id),
                              )
                            }
                            className="font-bold text-emerald-600"
                          >
                            Unban
                          </button>
                        ) : (
                          <button
                            onClick={() => setTarget(customer)}
                            className="font-bold text-red-600"
                          >
                            Ban from store
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {target && (
        <BanCustomerModal
          customerName={target.name}
          customerId={target.id}
          scope="store"
          onClose={() => setTarget(null)}
          onConfirm={() => {
            setBanned((ids) => [...ids, target.id])
            setTarget(null)
          }}
        />
      )}
      {reviewTarget && (
        <CustomerReputationModal
          customer={reviewTarget}
          reviews={customerReviews[reviewTarget.id] ?? []}
          onClose={() => setReviewTarget(null)}
          onAdd={(review) =>
            setCustomerReviews((current) => ({
              ...current,
              [reviewTarget.id]: [review, ...(current[reviewTarget.id] ?? [])],
            }))
          }
        />
      )}
    </div>
  )
}

function CustomerReputationModal({
  customer,
  reviews,
  onClose,
  onAdd,
}: {
  customer: {
    name: string
    id: string
    phone: string
    status: string
    risk: CustomerRiskAssessment
  }
  reviews: CustomerMerchantReview[]
  onClose: () => void
  onAdd: (review: CustomerMerchantReview) => void
}) {
  const baseReviews: CustomerMerchantReview[] = [
    {
      id: "base-1",
      store: "Adepa Home",
      manager: "Akosua Mensah",
      rating: 5,
      note: "Reliable customer. Payments were always made before the due date and communication was excellent.",
      tags: ["Pays on time", "Responsive", "Verified"],
      date: "June 18, 2026",
    },
    {
      id: "base-2",
      store: "Nova Appliances",
      manager: "Daniel Kumi",
      rating: 4,
      note: "Good purchase history and respectful communication. One payment required a reminder.",
      tags: ["Good communication", "Completed purchase"],
      date: "February 4, 2026",
    },
  ]
  const allReviews = [...reviews, ...baseReviews]
  const [rating, setRating] = useState(5)
  const [note, setNote] = useState("")
  const [tags, setTags] = useState<string[]>(["Pays on time"])
  const [writing, setWriting] = useState(false)
  const availableTags = [
    "Pays on time",
    "Responsive",
    "Verified",
    "Good communication",
    "Completed purchase",
    "Payment delays",
    "Needs follow-up",
  ]
  const submit = () => {
    if (note.trim().length < 10) return
    onAdd({
      id: String(Date.now()),
      store: "CYTECH Gadgets",
      manager: "Emmanuel Agyeman",
      rating,
      note: note.trim(),
      tags,
      date: "Today",
    })
    setNote("")
    setWriting(false)
  }
  const average = (
    allReviews.reduce((sum, review) => sum + review.rating, 0) /
    allReviews.length
  ).toFixed(1)
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <button className="absolute inset-0" onClick={onClose} />
      <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[30px] bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-lg font-bold text-blue-700">
              {customer.name
                .split(" ")
                .map((part) => part[0])
                .join("")}
            </span>
            <div>
              <h3 className="text-2xl font-bold">{customer.name}</h3>
              <p className="text-sm text-slate-500">
                {customer.id} · {customer.phone}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border"
          >
            <IconClose />
          </button>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InfoTile label="Merchant rating" value={`${average} / 5.0`} />
          <InfoTile label="Shop reviews" value={String(allReviews.length)} />
          <InfoTile label="Customer status" value={customer.status} />
          <InfoTile
            label="Hire-purchase risk"
            value={`${customer.risk.score} / 100 · ${customer.risk.level}`}
          />
        </div>
        <div className="mt-6">
          <RiskScorePanel risk={customer.risk} compact />
        </div>
        <div className="mt-6 flex items-center justify-between">
          <div>
            <h4 className="text-lg font-bold">Reviews from shops</h4>
            <p className="text-xs text-slate-500">
              Visible only to authorized merchants and AdepaPay administrators.
            </p>
          </div>
          <Button onClick={() => setWriting(!writing)}>
            {writing ? "Cancel" : "Review Customer"}
          </Button>
        </div>
        {writing && (
          <div className="mt-5 rounded-[24px] border border-blue-200 bg-blue-50/50 p-5">
            <div className="text-sm font-bold">Your rating</div>
            <div className="mt-2 flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className={`text-2xl ${
                    star <= rating ? "text-amber-400" : "text-slate-200"
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() =>
                    setTags((items) =>
                      items.includes(tag)
                        ? items.filter((item) => item !== tag)
                        : [...items, tag],
                    )
                  }
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                    tags.includes(tag)
                      ? "bg-blue-600 text-white"
                      : "border border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              placeholder="Describe payment reliability, communication, and conduct..."
              className="mt-4 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
            />
            <div className="mt-3 flex justify-end">
              <Button onClick={submit}>Publish Customer Review</Button>
            </div>
          </div>
        )}
        <div className="mt-5 space-y-3">
          {allReviews.map((review) => (
            <div
              key={review.id}
              className="rounded-[22px] border border-slate-200 p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold">{review.store}</div>
                  <div className="text-xs text-slate-500">
                    Reviewed by {review.manager} · {review.date}
                  </div>
                </div>
                <div className="text-sm text-amber-400">
                  {"★".repeat(review.rating)}
                  <span className="text-slate-200">
                    {"★".repeat(5 - review.rating)}
                  </span>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {review.note}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {review.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function RiskScorePanel({
  risk,
  compact = false,
}: {
  risk: CustomerRiskAssessment
  compact?: boolean
}) {
  const levelTone =
    risk.level === "Low"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : risk.level === "High"
        ? "border-red-200 bg-red-50 text-red-800"
        : risk.level === "Review"
          ? "border-purple-200 bg-purple-50 text-purple-800"
          : "border-amber-200 bg-amber-50 text-amber-800"
  const barTone =
    risk.level === "Low"
      ? "bg-emerald-500"
      : risk.level === "High"
        ? "bg-red-500"
        : risk.level === "Review"
          ? "bg-purple-500"
          : "bg-amber-500"
  return (
    <div className={`rounded-[24px] border p-5 ${levelTone}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.12em]">
            Hire-purchase risk assessment
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black">{risk.score}</span>
            <span className="text-sm font-bold">/ 100 · {risk.level} Risk</span>
          </div>
        </div>
        <div className="text-left text-xs sm:text-right">
          <div className="font-bold">{risk.modelVersion}</div>
          <div className="mt-1 opacity-75">Assessed {risk.assessedAt}</div>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/80">
        <div
          className={`h-full rounded-full ${barTone}`}
          style={{ width: `${risk.score}%` }}
        />
      </div>
      <p className="mt-4 text-sm leading-6">{risk.summary}</p>
      {!compact && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {risk.factors.map((factor) => (
            <div
              key={factor.label}
              className="rounded-2xl border border-white/80 bg-white/70 p-4 text-slate-700"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-500">
                  {factor.label}
                </span>
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                    factor.impact === "Positive"
                      ? "bg-emerald-100 text-emerald-700"
                      : factor.impact === "Adverse"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {factor.impact}
                </span>
              </div>
              <div className="mt-2 text-sm font-semibold">{factor.result}</div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 border-t border-current/10 pt-3 text-xs leading-5 opacity-80">
        Decision-support only. Staff must review verified documents and
        affordability evidence before approval; the score must not be the sole
        reason for a decision.
      </p>
    </div>
  )
}

type StoreProductItem = {
  id: string
  name: string
  sku: string
  category: string
  condition: "New" | "Used"
  price: string
  stock: string
  status: string
  images: string[]
  paymentOptions: { payNow: boolean hirePurchase: boolean layaway: boolean }
  swap?: {
    enabled: boolean
    categories: string
    minimumCondition: string
    validityDays: number
    instructions: string
  }
}

function StoreProductsPage() {
  const [products, setProducts] = useState<StoreProductItem[]>([
    {
      id: "1",
      name: "MacBook Pro 14-inch M3",
      sku: "CY-MBP-014",
      category: "Laptops",
      condition: "New",
      price: "GHS 18,500",
      stock: "12",
      status: "Active",
      paymentOptions: { payNow: true, hirePurchase: true, layaway: true },
      images: [
        "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=240&h=180&fit=crop&auto=format",
      ],
    },
    {
      id: "2",
      name: "Samsung Galaxy S25",
      sku: "CY-S25-256",
      category: "Smartphones",
      condition: "New",
      price: "GHS 9,450",
      stock: "5",
      status: "Low Stock",
      paymentOptions: { payNow: true, hirePurchase: false, layaway: true },
      swap: {
        enabled: true,
        categories: "Phones, Tablets, Laptops",
        minimumCondition: "Fair",
        validityDays: 7,
        instructions: "Physical inspection is required before a final offer.",
      },
      images: [
        "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=240&h=180&fit=crop&auto=format",
      ],
    },
    {
      id: "3",
      name: "AirPods Pro 2",
      sku: "CY-APP-002",
      category: "Accessories",
      condition: "Used",
      price: "GHS 2,850",
      stock: "3",
      status: "Low Stock",
      paymentOptions: { payNow: true, hirePurchase: true, layaway: false },
      images: [
        "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=240&h=180&fit=crop&auto=format",
      ],
    },
  ])
  const [adding, setAdding] = useState(false)
  const [saved, setSaved] = useState(false)
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Products"
        description="Manage your store catalogue, product images, pricing, and inventory."
        actions={<Button onClick={() => setAdding(true)}>+ Add Product</Button>}
      />
      {saved && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-700">
          Product added successfully.
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total Products", String(products.length)],
          [
            "Active",
            String(products.filter((p) => p.status === "Active").length),
          ],
          [
            "Low Stock",
            String(products.filter((p) => p.status === "Low Stock").length),
          ],
          [
            "Product Images",
            String(products.reduce((total, p) => total + p.images.length, 0)),
          ],
        ].map(([label, value], index) => (
          <Card key={label} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-slate-500">{label}</div>
                <div className="mt-3 text-2xl font-bold">{value}</div>
              </div>
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                  index === 3
                    ? "bg-violet-50 text-violet-600"
                    : "bg-blue-50 text-blue-600"
                }`}
              >
                {index === 3 ? <IconArchive /> : <IconBox />}
              </span>
            </div>
          </Card>
        ))}
      </div>
      <CustomerPageToolbar placeholder="Search product name, SKU, or category" />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {[
                  "Product",
                  "SKU",
                  "Category",
                  "Condition",
                  "Payment Options",
                  "Cash Price",
                  "Stock",
                  "Status",
                  "Actions",
                ].map((label) => (
                  <th key={label} className="px-5 py-4">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr
                  key={product.id}
                  className="border-t border-slate-100 hover:bg-slate-50/70"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-4">
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="h-16 w-20 rounded-2xl border border-slate-200 object-cover"
                      />
                      <div>
                        <div className="font-bold text-slate-900">
                          {product.name}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {product.images.length} image
                          {product.images.length !== 1 ? "s" : ""}
                        </div>
                        {product.swap?.enabled && (
                          <span className="mt-2 inline-block rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                            Swap Available
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-medium text-slate-600">
                    {product.sku}
                  </td>
                  <td className="px-5 py-4">{product.category}</td>
                  <td className="px-5 py-4">
                    <Pill
                      tone={product.condition === "New" ? "success" : "pending"}
                    >
                      {product.condition}
                    </Pill>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {product.paymentOptions.payNow && (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700">
                          Pay Now
                        </span>
                      )}
                      {product.paymentOptions.hirePurchase && (
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">
                          Hire Purchase
                        </span>
                      )}
                      {product.paymentOptions.layaway && (
                        <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">
                          Layaway
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 font-bold">{product.price}</td>
                  <td className="px-5 py-4">{product.stock}</td>
                  <td className="px-5 py-4">
                    <Pill
                      tone={product.status === "Active" ? "success" : "pending"}
                    >
                      {product.status}
                    </Pill>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-3">
                      <button className="font-bold text-blue-600">Edit</button>
                      <button className="font-bold text-slate-500">View</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {adding && (
        <AddProductModal
          onClose={() => setAdding(false)}
          onAdd={(product) => {
            setProducts((items) => [product, ...items])
            setAdding(false)
            setSaved(true)
            window.setTimeout(() => setSaved(false), 3000)
          }}
        />
      )}
    </div>
  )
}

function AddProductModal({
  onClose,
  onAdd,
}: {
  onClose: () => void
  onAdd: (product: StoreProductItem) => void
}) {
  const [form, setForm] = useState({
    name: "",
    sku: "",
    category: "",
    condition: "",
    price: "",
    stock: "",
  })
  const [images, setImages] = useState<string[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [paymentOptions, setPaymentOptions] = useState({
    payNow: true,
    hirePurchase: true,
    layaway: false,
  })
  const [swap, setSwap] = useState({
    enabled: false,
    categories: "Phones, Tablets, Laptops",
    minimumCondition: "Fair",
    validityDays: "7",
    instructions: "Physical inspection is required before a final offer.",
  })
  const [layaway, setLayaway] = useState({
    depositType: "Percentage",
    deposit: "20",
    duration: "12",
    minimumInstallment: "50",
    gracePeriod: "3",
    maxMissed: "3",
    agentCollection: true,
    reservationRules:
      "Reserve after verified deposit; hold until full payment.",
    cancellationPolicy:
      "Cancellation fee may apply before reserved stock is returned.",
    refundPolicy:
      "Refund verified payments less the approved cancellation fee.",
    frequencies: ["Weekly", "Monthly"],
  })
  const uploadImages = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(
      0,
      Math.max(0, 5 - images.length),
    )
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = () =>
        setImages((current) =>
          current.length < 5 ? [...current, String(reader.result)] : current,
        )
      reader.readAsDataURL(file)
    })
  }
  const submit = () => {
    const next: Record<string, string> = {}
    Object.entries(form).forEach(([key, value]) => {
      if (!value.trim()) next[key] = "Required"
    })
    if (!images.length) next.images = "Upload at least one product image"
    if (!Object.values(paymentOptions).some(Boolean))
      next.paymentOptions = "Select at least one payment option"
    if (
      paymentOptions.layaway &&
      layaway.depositType === "Percentage" &&
      Number(layaway.deposit) < 10
    )
      next.layawayDeposit = "Platform minimum deposit is 10%"
    if (
      paymentOptions.layaway &&
      layaway.depositType === "Percentage" &&
      Number(layaway.deposit) > 80
    )
      next.layawayDeposit = "Platform maximum deposit is 80%"
    if (
      paymentOptions.layaway &&
      (!layaway.duration || Number(layaway.duration) > 24)
    )
      next.layawayDuration = "Maximum platform duration is 24 months"
    if (paymentOptions.layaway && !layaway.frequencies.length)
      next.layawayFrequencies = "Select at least one frequency"
    setErrors(next)
    if (Object.keys(next).length) return
    onAdd({
      id: String(Date.now()),
      name: form.name,
      sku: form.sku.toUpperCase(),
      category: form.category,
      condition: form.condition as "New" | "Used",
      price: form.price.toUpperCase().startsWith("GHS")
        ? form.price
        : `GHS ${form.price}`,
      stock: form.stock,
      status: Number(form.stock) <= 5 ? "Low Stock" : "Active",
      images,
      paymentOptions,
      swap: swap.enabled
        ? {
            enabled: true,
            categories: swap.categories,
            minimumCondition: swap.minimumCondition,
            validityDays: Number(swap.validityDays) || 7,
            instructions: swap.instructions,
          }
        : undefined,
    })
  }
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <button
        className="absolute inset-0"
        onClick={onClose}
        aria-label="Close add product dialog"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[30px] bg-white p-6 shadow-2xl sm:p-8"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-2xl font-bold">Add a new product</h3>
            <p className="mt-1 text-sm text-slate-500">
              Create the listing and upload up to five clear product images.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500"
          >
            <IconClose />
          </button>
        </div>
        <div className="mt-7">
          <div className="text-sm font-bold">Product images *</div>
          <label
            className={`mt-3 flex cursor-pointer flex-col items-center justify-center rounded-[24px] border-2 border-dashed px-6 py-8 text-center transition hover:bg-blue-50 ${
              errors.images
                ? "border-red-300 bg-red-50"
                : "border-blue-200 bg-blue-50/50"
            }`}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
              <IconArchive />
            </span>
            <span className="mt-3 text-sm font-bold text-slate-800">
              Upload product images
            </span>
            <span className="mt-1 text-xs text-slate-500">
              PNG, JPG or WEBP · Up to 5 images
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="hidden"
              onChange={uploadImages}
            />
          </label>
          {errors.images && (
            <div className="mt-2 text-xs text-red-600">{errors.images}</div>
          )}
          {images.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
              {images.map((image, index) => (
                <div key={image} className="group relative">
                  <img
                    src={image}
                    alt={`Product preview ${index + 1}`}
                    className="aspect-square w-full rounded-2xl border border-slate-200 object-cover"
                  />
                  {index === 0 && (
                    <span className="absolute bottom-2 left-2 rounded-lg bg-slate-950/75 px-2 py-1 text-[9px] font-bold text-white">
                      Cover
                    </span>
                  )}
                  <button
                    onClick={() =>
                      setImages((items) => items.filter((_, i) => i !== index))
                    }
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white text-red-600 shadow"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {[
            ["name", "Product name", "Samsung Galaxy S25"],
            ["sku", "SKU", "CY-S25-256"],
            ["category", "Category", "Smartphones"],
            ["price", "Cash price (GHS)", "9450"],
            ["stock", "Stock quantity", "12"],
          ].map(([key, label, placeholder]) => (
            <label key={key} className={key === "name" ? "sm:col-span-2" : ""}>
              <span className="text-xs font-bold text-slate-600">
                {label} *
              </span>
              <input
                value={form[(key as keyof typeof form)]}
                onChange={(event) => {
                  setForm({ ...form, [key]: event.target.value })
                  setErrors({ ...errors, [key]: "" })
                }}
                placeholder={placeholder}
                type={key === "price" || key === "stock" ? "number" : "text"}
                className={`mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-500 ${
                  errors[key] ? "border-red-400" : "border-slate-200"
                }`}
              />
              {errors[key] && (
                <span className="mt-1 block text-xs text-red-600">
                  {errors[key]}
                </span>
              )}
            </label>
          ))}
          <label>
            <span className="text-xs font-bold text-slate-600">
              Item condition *
            </span>
            <select
              value={form.condition}
              onChange={(event) => {
                setForm({ ...form, condition: event.target.value })
                setErrors({ ...errors, condition: "" })
              }}
              className={`mt-2 w-full rounded-2xl border bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 ${
                errors.condition ? "border-red-400" : "border-slate-200"
              }`}
            >
              <option value="" disabled>
                Select condition
              </option>
              <option value="New">New</option>
              <option value="Used">Used</option>
            </select>
            {errors.condition && (
              <span className="mt-1 block text-xs text-red-600">
                {errors.condition}
              </span>
            )}
          </label>
        </div>
        <div className="mt-7 rounded-[24px] border border-emerald-200 bg-emerald-50/40 p-5">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <div>
              <h4 className="text-lg font-bold text-slate-900">
                Allow Swap for this product
              </h4>
              <p className="mt-1 text-xs text-slate-600">
                Final trade-in value is confirmed by the store after physical
                inspection.
              </p>
            </div>
            <input
              type="checkbox"
              checked={swap.enabled}
              onChange={(event) =>
                setSwap({ ...swap, enabled: event.target.checked })
              }
              className="h-5 w-5 accent-blue-600"
            />
          </label>
          {swap.enabled && (
            <div className="mt-5 grid gap-4 border-t border-emerald-200 pt-5 sm:grid-cols-2">
              <label>
                <span className="text-xs font-bold text-slate-600">
                  Accepted device categories
                </span>
                <input
                  value={swap.categories}
                  onChange={(event) =>
                    setSwap({ ...swap, categories: event.target.value })
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                />
              </label>
              <label>
                <span className="text-xs font-bold text-slate-600">
                  Minimum condition
                </span>
                <select
                  value={swap.minimumCondition}
                  onChange={(event) =>
                    setSwap({ ...swap, minimumCondition: event.target.value })
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                >
                  <option>Like New</option>
                  <option>Excellent</option>
                  <option>Good</option>
                  <option>Fair</option>
                </select>
              </label>
              <label>
                <span className="text-xs font-bold text-slate-600">
                  Offer validity (days)
                </span>
                <input
                  type="number"
                  min="1"
                  value={swap.validityDays}
                  onChange={(event) =>
                    setSwap({ ...swap, validityDays: event.target.value })
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                />
              </label>
              <label>
                <span className="text-xs font-bold text-slate-600">
                  Swap instructions
                </span>
                <input
                  value={swap.instructions}
                  onChange={(event) =>
                    setSwap({ ...swap, instructions: event.target.value })
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                />
              </label>
            </div>
          )}
        </div>
        <div className="mt-7 rounded-[24px] border border-slate-200 p-5">
          <h4 className="text-lg font-bold">Payment Options</h4>
          <p className="mt-1 text-xs text-slate-500">
            Choose how customers can purchase this product.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {[
              ["payNow", "Pay Now"],
              ["hirePurchase", "Hire Purchase"],
              ["layaway", "Layaway"],
            ].map(([key, label]) => (
              <label
                key={key}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold ${
                  paymentOptions[(key as keyof typeof paymentOptions)]
                    ? "border-blue-300 bg-blue-50 text-blue-800"
                    : "border-slate-200 text-slate-500"
                }`}
              >
                <input
                  type="checkbox"
                  checked={paymentOptions[(key as keyof typeof paymentOptions)]}
                  onChange={(e) => {
                    setPaymentOptions({
                      ...paymentOptions,
                      [key]: e.target.checked,
                    })
                    setErrors({ ...errors, paymentOptions: "" })
                  }}
                />
                {label}
              </label>
            ))}
          </div>
          {errors.paymentOptions && (
            <div className="mt-2 text-xs font-semibold text-red-600">
              {errors.paymentOptions}
            </div>
          )}
          {paymentOptions.layaway && (
            <div className="mt-5 border-t border-slate-200 pt-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label>
                  <span className="text-xs font-bold text-slate-600">
                    Minimum Deposit Type
                  </span>
                  <select
                    value={layaway.depositType}
                    onChange={(e) =>
                      setLayaway({ ...layaway, depositType: e.target.value })
                    }
                    className="mt-2 w-full rounded-2xl border bg-white px-4 py-3 text-sm"
                  >
                    <option>Percentage</option>
                    <option>Fixed amount</option>
                  </select>
                </label>
                <label>
                  <span className="text-xs font-bold text-slate-600">
                    Minimum Deposit *
                  </span>
                  <input
                    type="number"
                    value={layaway.deposit}
                    onChange={(e) => {
                      setLayaway({ ...layaway, deposit: e.target.value })
                      setErrors({ ...errors, layawayDeposit: "" })
                    }}
                    className={`mt-2 w-full rounded-2xl border px-4 py-3 text-sm ${
                      errors.layawayDeposit
                        ? "border-red-400"
                        : "border-slate-200"
                    }`}
                  />
                  {errors.layawayDeposit && (
                    <span className="text-xs text-red-600">
                      {errors.layawayDeposit}
                    </span>
                  )}
                </label>
                <label>
                  <span className="text-xs font-bold text-slate-600">
                    Maximum Plan Duration (months) *
                  </span>
                  <input
                    type="number"
                    value={layaway.duration}
                    onChange={(e) =>
                      setLayaway({ ...layaway, duration: e.target.value })
                    }
                    className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm"
                  />
                  {errors.layawayDuration && (
                    <span className="text-xs text-red-600">
                      {errors.layawayDuration}
                    </span>
                  )}
                </label>
                <label>
                  <span className="text-xs font-bold text-slate-600">
                    Minimum Installment (GHS)
                  </span>
                  <input
                    type="number"
                    value={layaway.minimumInstallment}
                    onChange={(e) =>
                      setLayaway({
                        ...layaway,
                        minimumInstallment: e.target.value,
                      })
                    }
                    className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm"
                  />
                </label>
                <label>
                  <span className="text-xs font-bold text-slate-600">
                    Grace Period (days)
                  </span>
                  <input
                    type="number"
                    value={layaway.gracePeriod}
                    onChange={(e) =>
                      setLayaway({ ...layaway, gracePeriod: e.target.value })
                    }
                    className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm"
                  />
                </label>
                <label>
                  <span className="text-xs font-bold text-slate-600">
                    Maximum Missed Payments
                  </span>
                  <input
                    type="number"
                    value={layaway.maxMissed}
                    onChange={(e) =>
                      setLayaway({ ...layaway, maxMissed: e.target.value })
                    }
                    className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm"
                  />
                </label>
              </div>
              <div className="mt-4">
                <div className="text-xs font-bold text-slate-600">
                  Allowed Payment Frequencies *
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["Daily", "Weekly", "Biweekly", "Monthly", "Custom"].map(
                    (value) => (
                      <button
                        type="button"
                        key={value}
                        onClick={() =>
                          setLayaway({
                            ...layaway,
                            frequencies: layaway.frequencies.includes(value)
                              ? layaway.frequencies.filter(
                                  (item) => item !== value,
                                )
                              : [...layaway.frequencies, value],
                          })
                        }
                        className={`rounded-full px-3 py-2 text-xs font-bold ${
                          layaway.frequencies.includes(value)
                            ? "bg-blue-600 text-white"
                            : "border border-slate-200 text-slate-600"
                        }`}
                      >
                        {value}
                      </button>
                    ),
                  )}
                </div>
                {errors.layawayFrequencies && (
                  <span className="text-xs text-red-600">
                    {errors.layawayFrequencies}
                  </span>
                )}
              </div>
              <label className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={layaway.agentCollection}
                  onChange={(e) =>
                    setLayaway({
                      ...layaway,
                      agentCollection: e.target.checked,
                    })
                  }
                />
                Agent Collection Available
              </label>
              <div className="mt-4 grid gap-4">
                {[
                  ["reservationRules", "Reservation Rules"],
                  ["cancellationPolicy", "Cancellation Policy"],
                  ["refundPolicy", "Refund Policy"],
                ].map(([key, label]) => (
                  <label key={key}>
                    <span className="text-xs font-bold text-slate-600">
                      {label}
                    </span>
                    <textarea
                      value={layaway[(key as keyof typeof layaway)] as string}
                      onChange={(e) =>
                        setLayaway({ ...layaway, [key]: e.target.value })
                      }
                      rows={2}
                      className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                    />
                  </label>
                ))}
              </div>
              <div className="mt-4 rounded-xl bg-blue-50 p-3 text-xs font-semibold text-blue-800">
                Validated against platform rules: deposit 10–80%, duration up to
                24 months, installment minimum GHS 20.
              </div>
            </div>
          )}
        </div>
        <div className="mt-8 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Add Product</Button>
        </div>
      </div>
    </div>
  )
}

type ShopUser = {
  id: string
  name: string
  email: string
  phone: string
  role: string
  permissions: string[]
  status: "Active" | "Invited" | "Disabled"
  lastActive: string
}
const SHOP_PERMISSION_PAGES = [
  "Dashboard",
  "Store Profile",
  "Products",
  "Categories",
  "Customers",
  "Applications",
  "Active Purchases",
  "Payments",
  "Reports",
  "Notifications",
  "Store Settings",
]

function StoreRolesUsersPage() {
  const [users, setUsers] = useState<ShopUser[]>([
    {
      id: "USR-001",
      name: "Emmanuel Agyeman",
      email: "emmanuel@cytechgadgets.com",
      phone: "+233 24 880 1931",
      role: "Store Owner",
      permissions: SHOP_PERMISSION_PAGES,
      status: "Active",
      lastActive: "Now",
    },
    {
      id: "USR-002",
      name: "Mavis Owusu",
      email: "mavis@cytechgadgets.com",
      phone: "+233 20 441 8210",
      role: "Sales Manager",
      permissions: [
        "Dashboard",
        "Products",
        "Customers",
        "Applications",
        "Active Purchases",
      ],
      status: "Active",
      lastActive: "18 minutes ago",
    },
    {
      id: "USR-003",
      name: "Daniel Mensah",
      email: "daniel@cytechgadgets.com",
      phone: "+233 55 731 9204",
      role: "Accounts Officer",
      permissions: ["Dashboard", "Active Purchases", "Payments", "Reports"],
      status: "Invited",
      lastActive: "Invitation pending",
    },
  ])
  const [editor, setEditor] = useState<ShopUser | "new" | null>(null)
  const [notice, setNotice] = useState("")
  const saveUser = (user: ShopUser) => {
    setUsers((items) =>
      items.some((item) => item.id === user.id)
        ? items.map((item) => (item.id === user.id ? user : item))
        : [...items, user],
    )
    setEditor(null)
    setNotice(
      editor === "new"
        ? "Invitation sent successfully."
        : "User permissions updated.",
    )
    window.setTimeout(() => setNotice(""), 3000)
  }
  const toggleStatus = (id: string) =>
    setUsers((items) =>
      items.map((user) =>
        user.id === id
          ? {
              ...user,
              status: user.status === "Disabled" ? "Active" : "Disabled",
            }
          : user,
      ),
    )
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Roles & Users"
        description="Invite store staff and control exactly which pages and information they can access."
        actions={<Button onClick={() => setEditor("new")}>+ Add User</Button>}
      />
      {notice && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-700">
          {notice}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Team Members", String(users.length), <IconUsers />],
          [
            "Active Users",
            String(users.filter((user) => user.status === "Active").length),
            <IconCheckCircle />,
          ],
          [
            "Pending Invites",
            String(users.filter((user) => user.status === "Invited").length),
            <IconFile />,
          ],
          [
            "Custom Roles",
            String(new Set(users.map((user) => user.role)).size),
            <IconLock />,
          ],
        ].map(([label, value, icon], index) => (
          <Card key={String(label)} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-slate-500">{label}</div>
                <div className="mt-3 text-2xl font-bold">{value}</div>
              </div>
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                  index === 3
                    ? "bg-violet-50 text-violet-700"
                    : "bg-blue-50 text-blue-700"
                }`}
              >
                {icon}
              </span>
            </div>
          </Card>
        ))}
      </div>
      <div className="rounded-[24px] border border-blue-100 bg-gradient-to-r from-blue-50 to-violet-50 p-5">
        <div className="flex gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-sm">
            <IconLock />
          </span>
          <div>
            <div className="font-bold text-slate-900">
              Principle of least access
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Give each staff member only the pages needed for their job. Store
              Owner access cannot be removed by another staff account.
            </p>
          </div>
        </div>
      </div>
      <CustomerPageToolbar placeholder="Search name, email, role, or status" />
      <div className="grid gap-4 xl:grid-cols-2">
        {users.map((user) => (
          <Card key={user.id} className="p-5">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-violet-100 font-bold text-blue-700">
                {user.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-950">{user.name}</h3>
                    <p className="truncate text-xs text-slate-500">
                      {user.email} · {user.phone}
                    </p>
                  </div>
                  <Pill
                    tone={
                      user.status === "Active"
                        ? "success"
                        : user.status === "Invited"
                          ? "pending"
                          : "danger"
                    }
                  >
                    {user.status}
                  </Pill>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">
                    {user.role}
                  </span>
                  <span className="text-xs text-slate-400">
                    {user.permissions.length} page permissions ·{" "}
                    {user.lastActive}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {user.permissions.slice(0, 5).map((permission) => (
                    <span
                      key={permission}
                      className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600"
                    >
                      {permission}
                    </span>
                  ))}
                  {user.permissions.length > 5 && (
                    <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                      +{user.permissions.length - 5} more
                    </span>
                  )}
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setEditor(user)}>
                    Edit Access
                  </Button>
                  {user.role !== "Store Owner" && (
                    <button
                      onClick={() => toggleStatus(user.id)}
                      className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
                        user.status === "Disabled"
                          ? "border-emerald-200 text-emerald-700"
                          : "border-amber-200 text-amber-700"
                      }`}
                    >
                      {user.status === "Disabled" ? "Enable" : "Disable"}
                    </button>
                  )}
                  {user.role !== "Store Owner" && (
                    <button
                      onClick={() =>
                        setUsers((items) =>
                          items.filter((item) => item.id !== user.id),
                        )
                      }
                      className="rounded-2xl px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {editor && (
        <ShopUserEditor
          user={editor === "new" ? null : editor}
          onClose={() => setEditor(null)}
          onSave={saveUser}
        />
      )}
    </div>
  )
}

function ShopUserEditor({
  user,
  onClose,
  onSave,
}: {
  user: ShopUser | null
  onClose: () => void
  onSave: (user: ShopUser) => void
}) {
  const [form, setForm] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    role: user?.role ?? "Sales Assistant",
  })
  const [permissions, setPermissions] = useState<string[]>(
    user?.permissions ?? ["Dashboard"],
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const togglePermission = (page: string) =>
    setPermissions((items) =>
      items.includes(page)
        ? items.filter((item) => item !== page)
        : [...items, page],
    )
  const applyPreset = (role: string) => {
    setForm({ ...form, role })
    const presets: Record<string, string[]> = {
      "Sales Assistant": ["Dashboard", "Products", "Customers", "Applications"],
      "Sales Manager": [
        "Dashboard",
        "Products",
        "Categories",
        "Customers",
        "Applications",
        "Active Purchases",
      ],
      "Accounts Officer": [
        "Dashboard",
        "Active Purchases",
        "Payments",
        "Reports",
      ],
      "Inventory Manager": [
        "Dashboard",
        "Products",
        "Categories",
        "Notifications",
      ],
      Custom: ["Dashboard"],
    }
    setPermissions(presets[role] ?? ["Dashboard"])
  }
  const submit = () => {
    const next: Record<string, string> = {}
    if (!form.name.trim()) next.name = "Required"
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Enter a valid email"
    if (!form.phone.trim()) next.phone = "Required"
    if (!permissions.length) next.permissions = "Select at least one page"
    setErrors(next)
    if (Object.keys(next).length) return
    onSave({
      id: user?.id ?? `USR-${Date.now()}`,
      name: form.name,
      email: form.email,
      phone: form.phone,
      role: form.role,
      permissions,
      status: user?.status ?? "Invited",
      lastActive: user?.lastActive ?? "Invitation pending",
    })
  }
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <button className="absolute inset-0" onClick={onClose} />
      <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[30px] bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-2xl font-bold">
              {user ? "Edit user access" : "Add store user"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {user
                ? "Update their role and page permissions."
                : "An invitation will be sent to the user’s email."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border"
          >
            <IconClose />
          </button>
        </div>
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {[
            ["name", "Full name", "text"],
            ["email", "Email address", "email"],
            ["phone", "Phone number", "tel"],
          ].map(([key, label, type]) => (
            <label key={key} className={key === "name" ? "sm:col-span-2" : ""}>
              <span className="text-xs font-bold text-slate-600">
                {label} *
              </span>
              <input
                value={form[(key as "name" | "email" | "phone")]}
                type={type}
                onChange={(event) =>
                  setForm({ ...form, [key]: event.target.value })
                }
                className={`mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-500 ${
                  errors[key] ? "border-red-400" : "border-slate-200"
                }`}
              />
              {errors[key] && (
                <span className="mt-1 block text-xs text-red-600">
                  {errors[key]}
                </span>
              )}
            </label>
          ))}
        </div>
        <label className="mt-5 block">
          <span className="text-xs font-bold text-slate-600">
            Role template
          </span>
          <select
            value={form.role}
            onChange={(event) => applyPreset(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
          >
            <option>Sales Assistant</option>
            <option>Sales Manager</option>
            <option>Accounts Officer</option>
            <option>Inventory Manager</option>
            <option>Custom</option>
          </select>
        </label>
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold">Page access</div>
              <div className="text-xs text-slate-500">
                Choose what this user can see and manage.
              </div>
            </div>
            <button
              onClick={() => setPermissions(SHOP_PERMISSION_PAGES)}
              className="text-xs font-bold text-blue-600"
            >
              Select all
            </button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {SHOP_PERMISSION_PAGES.map((page) => (
              <label
                key={page}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition ${
                  permissions.includes(page)
                    ? "border-blue-300 bg-blue-50"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={permissions.includes(page)}
                  onChange={() => togglePermission(page)}
                  className="h-4 w-4 accent-blue-600"
                />
                <span className="text-sm font-semibold">{page}</span>
              </label>
            ))}
          </div>
          {errors.permissions && (
            <div className="mt-2 text-xs text-red-600">
              {errors.permissions}
            </div>
          )}
        </div>
        <div className="mt-8 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>
            {user ? "Save Access" : "Send Invitation"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function ShopRulesTermsPage() {
  const [tab, setTab] = useState<"payment" | "shop" | "agreement">("payment")
  const [saved, setSaved] = useState(false)
  const [settings, setSettings] = useState({
    minimumDeposit: "20",
    minimumDuration: "3",
    maximumDuration: "12",
    gracePeriod: "3",
    lateFee: "2",
    returns: "7",
    warranty: "12",
    delivery: "2–5 business days",
    earlySettlement: true,
    autoDebit: true,
    allowReschedule: false,
    requireGuarantors: true,
  })
  const [clauses, setClauses] = useState([
    "The customer must pay the required deposit before the product is released.",
    "Monthly installments must be paid on or before the agreed due date.",
    "Ownership transfers only after the final installment and all charges are settled.",
    "Late or missed payments may result in account restrictions and recovery action.",
    "Products remain subject to the store return policy and manufacturer warranty.",
  ])
  const [newClause, setNewClause] = useState("")
  const save = () => {
    setSaved(true)
    window.setTimeout(() => setSaved(false), 3000)
  }
  const tabs = [
    { id: "payment", label: "Payment Terms", icon: <IconWallet /> },
    { id: "shop", label: "Shop Rules", icon: <IconStore /> },
    { id: "agreement", label: "Agreement Clauses", icon: <IconFile /> },
  ] as const
  const field = (
    key: keyof typeof settings,
    label: string,
    suffix?: string,
  ) => (
    <label>
      <span className="text-xs font-bold text-slate-600">{label}</span>
      <div className="relative mt-2">
        <input
          value={String(settings[key])}
          onChange={(event) =>
            setSettings({ ...settings, [key]: event.target.value })
          }
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
        />
        {suffix && (
          <span className="absolute right-4 top-3 text-sm text-slate-400">
            {suffix}
          </span>
        )}
      </div>
    </label>
  )
  const toggle = (
    key: "earlySettlement" | "autoDebit" | "allowReschedule" | "requireGuarantors",
    label: string,
    description: string,
  ) => (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4">
      <div>
        <div className="text-sm font-bold">{label}</div>
        <div className="mt-1 text-xs leading-5 text-slate-500">
          {description}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={settings[key]}
        onClick={() => setSettings({ ...settings, [key]: !settings[key] })}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          settings[key] ? "bg-blue-600" : "bg-slate-200"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
            settings[key] ? "left-6" : "left-1"
          }`}
        />
      </button>
    </div>
  )
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Shop Rules & Payment Terms"
        description="Define the commercial rules and agreement terms customers must review before purchasing from your shop."
        actions={
          <>
            <Button variant="secondary">Preview Customer Version</Button>
            <Button onClick={save}>Save & Publish</Button>
          </>
        }
      />
      {saved && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-700">
          Rules and payment terms published successfully. New agreements will
          use this version.
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Terms Version", "v2.4"],
          ["Last Published", "August 11, 2026"],
          ["Active Agreements", "84"],
        ].map(([label, value]) => (
          <Card key={label} className="p-5">
            <div className="text-sm text-slate-500">{label}</div>
            <div className="mt-3 text-xl font-bold">{value}</div>
          </Card>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto rounded-[22px] border border-slate-200 bg-white p-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`flex shrink-0 items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition ${
              tab === item.id
                ? "bg-slate-950 text-white shadow"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
      {tab === "payment" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_.85fr]">
          <Card className="p-5 sm:p-6">
            <h3 className="text-lg font-bold">Hire-purchase payment terms</h3>
            <p className="mt-1 text-sm text-slate-500">
              These values become the defaults when generating a customer
              agreement.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {field("minimumDeposit", "Minimum deposit", "%")}
              {field("minimumDuration", "Minimum duration", "months")}
              {field("maximumDuration", "Maximum duration", "months")}
              {field("gracePeriod", "Payment grace period", "days")}
              {field("lateFee", "Late payment charge", "%")}
              {field("delivery", "Delivery timeframe")}
            </div>
          </Card>
          <div className="space-y-4">
            {toggle(
              "earlySettlement",
              "Allow early settlement",
              "Customers can settle the remaining balance without a penalty.",
            )}
            {toggle(
              "autoDebit",
              "Enable automatic debit",
              "Customer may authorize scheduled payments from a saved method.",
            )}
            {toggle(
              "allowReschedule",
              "Allow payment rescheduling",
              "Staff may approve a revised due date after customer review.",
            )}
            {toggle(
              "requireGuarantors",
              "Require two guarantors",
              "Applications must include at least two verified guarantors.",
            )}
          </div>
        </div>
      )}
      {tab === "shop" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="p-5 sm:p-6">
            <h3 className="text-lg font-bold">Returns and warranty</h3>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {field("returns", "Return window", "days")}
              {field("warranty", "Standard warranty", "months")}
            </div>
            <label className="mt-5 block">
              <span className="text-xs font-bold text-slate-600">
                Return conditions
              </span>
              <textarea
                defaultValue="Products must be unused, in original packaging, and returned with the receipt. Faulty products are assessed before replacement or refund."
                rows={5}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none focus:border-blue-500"
              />
            </label>
          </Card>
          <Card className="p-5 sm:p-6">
            <h3 className="text-lg font-bold">
              Customer conduct and fulfillment
            </h3>
            <div className="mt-5 space-y-3">
              {[
                "Customer information must match verified Ghana Card records.",
                "Delivery requires customer or authorized representative identification.",
                "Customers must notify the store promptly about defects or delivery issues.",
                "Abusive, fraudulent, or threatening conduct may result in a store-level ban.",
              ].map((rule) => (
                <label
                  key={rule}
                  className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6"
                >
                  <input
                    type="checkbox"
                    defaultChecked
                    className="mt-1 accent-blue-600"
                  />
                  <span>{rule}</span>
                </label>
              ))}
            </div>
          </Card>
        </div>
      )}
      {tab === "agreement" && (
        <Card className="p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-bold">Customer agreement clauses</h3>
              <p className="mt-1 text-sm text-slate-500">
                Customers must explicitly accept these clauses and
                electronically sign the agreement.
              </p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              {clauses.length} active clauses
            </span>
          </div>
          <div className="mt-6 space-y-3">
            {clauses.map((clause, index) => (
              <div
                key={clause}
                className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-xs font-bold text-blue-700">
                  {index + 1}
                </span>
                <textarea
                  value={clause}
                  onChange={(event) =>
                    setClauses((items) =>
                      items.map((item, i) =>
                        i === index ? event.target.value : item,
                      ),
                    )
                  }
                  rows={2}
                  className="min-w-0 flex-1 resize-none border-0 bg-transparent text-sm leading-6 outline-none"
                />
                <button
                  onClick={() =>
                    setClauses((items) => items.filter((_, i) => i !== index))
                  }
                  className="text-sm font-bold text-red-500"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              value={newClause}
              onChange={(event) => setNewClause(event.target.value)}
              placeholder="Add a new agreement clause..."
              className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
            />
            <button
              disabled={!newClause.trim()}
              onClick={() => {
                setClauses((items) => [...items, newClause.trim()])
                setNewClause("")
              }}
              className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
            >
              Add Clause
            </button>
          </div>
        </Card>
      )}
    </div>
  )
}

function PurchaseAgreementViewer({
  agreement,
  customerMode,
  onClose,
  onAccept,
}: {
  agreement: PurchaseAgreement
  customerMode?: boolean
  onClose: () => void
  onAccept?: () => void
}) {
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [confirmedIdentity, setConfirmedIdentity] = useState(false)
  const [signature, setSignature] = useState("")
  const [customerPhotoFailed, setCustomerPhotoFailed] = useState(false)
  const canAccept =
    acceptedTerms && confirmedIdentity && signature.trim().length >= 3
  const clauses = [
    "The customer receives the product after the required deposit has cleared.",
    `The financed balance will be repaid in ${agreement.duration} installments of ${agreement.monthly}.`,
    "Payments must be made on or before each due date through an approved AdepaPay payment channel.",
    "Ownership transfers to the customer only after all required payments are completed.",
    "Late or missed payments may lead to reminders, account restrictions, recovery action, or other remedies stated in the agreement.",
    "The product warranty, returns, and after-sales support remain subject to the store and manufacturer policies.",
  ]
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
      <button className="absolute inset-0" onClick={onClose} />
      <div className="relative max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-[30px] bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-blue-600">
              AdepaPay Purchase Agreement
            </div>
            <h3 className="mt-1 text-xl font-bold">{agreement.reference}</h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border"
          >
            <IconClose />
          </button>
        </div>
        <div className="p-6 sm:p-8">
          <div className="rounded-[24px] bg-slate-950 p-6 text-white">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <div className="text-xs text-slate-400">Customer</div>
                <div className="mt-1 font-bold">{agreement.customer}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Store</div>
                <div className="mt-1 font-bold">{agreement.store}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Application</div>
                <div className="mt-1 font-bold">{agreement.application}</div>
              </div>
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Product", agreement.product],
              ["Cash price", agreement.cashPrice],
              ["Deposit", agreement.deposit],
              ["Amount financed", agreement.financed],
              ["Monthly installment", agreement.monthly],
              ["Duration", agreement.duration],
              ["Total payable", agreement.totalPayable],
              ["First payment", agreement.firstPayment],
            ].map(([label, value]) => (
              <InfoTile key={label} label={label} value={value} />
            ))}
          </div>
          <div className="mt-7">
            <h4 className="text-lg font-bold">Terms and conditions</h4>
            <div className="mt-4 space-y-3">
              {clauses.map((clause, index) => (
                <div
                  key={clause}
                  className="flex gap-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600"
                >
                  <span className="font-bold text-blue-600">{index + 1}.</span>
                  <span>{clause}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <InfoTile label="Issued by" value={agreement.issuer} />
            <InfoTile label="Issue date" value={agreement.issuedDate} />
          </div>
          {customerMode && agreement.status !== "Accepted" && (
            <div className="mt-7 rounded-[24px] border border-blue-200 bg-blue-50/50 p-5">
              <h4 className="font-bold">Electronic acceptance</h4>
              <p className="mt-1 text-sm text-slate-500">
                Confirm that you have reviewed and understood this agreement.
              </p>
              <label className="mt-4 flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(event) => setAcceptedTerms(event.target.checked)}
                  className="mt-1 accent-blue-600"
                />
                <span>
                  I have read and agree to all purchase, repayment, ownership,
                  and recovery terms above.
                </span>
              </label>
              <label className="mt-3 flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={confirmedIdentity}
                  onChange={(event) =>
                    setConfirmedIdentity(event.target.checked)
                  }
                  className="mt-1 accent-blue-600"
                />
                <span>
                  I confirm that I am Emmanuel Agyeman and authorize AdepaPay to
                  record this electronic acceptance.
                </span>
              </label>
              <label className="mt-5 block">
                <span className="text-xs font-bold text-slate-600">
                  Type your full name as signature *
                </span>
                <input
                  value={signature}
                  onChange={(event) => setSignature(event.target.value)}
                  placeholder="Emmanuel Agyeman"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
                />
              </label>
            </div>
          )}
          {agreement.status === "Accepted" && (
            <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-bold text-emerald-700">
              ✓ Electronically accepted by {agreement.customer}. Agreement
              locked and audit record created.
            </div>
          )}
          <div className="mt-7 flex flex-wrap justify-end gap-3">
            <Button variant="secondary">Download PDF</Button>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            {customerMode && agreement.status !== "Accepted" && (
              <button
                disabled={!canAccept}
                onClick={onAccept}
                className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Agree & Sign
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function AgreementManagementPage({ issuer }: { issuer: "Admin" | "Store" }) {
  const [agreement, setAgreement] = useState<PurchaseAgreement | null>(
    issuer === "Admin" ? DEMO_AGREEMENT : null,
  )
  const [generating, setGenerating] = useState(false)
  const [preview, setPreview] = useState(false)
  const [issued, setIssued] = useState(issuer === "Admin")
  const create = () => {
    setAgreement({
      ...DEMO_AGREEMENT,
      issuer:
        issuer === "Admin"
          ? "AdepaPay Administration"
          : "CYTECH Gadgets · Pending AdepaPay approval",
      status: "Draft",
    })
    setGenerating(false)
    setPreview(true)
  }
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Applications & Agreements"
        description={`${
          issuer === "Admin"
            ? "Generate, approve, and monitor"
            : "Prepare and issue"
        } purchase agreements for approved hire-purchase applications.`}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Approved Applications", "62"],
          ["Agreements Drafted", agreement ? "1" : "0"],
          ["Awaiting Customer", issued ? "1" : "0"],
          ["Accepted", "48"],
        ].map(([label, value], index) => (
          <Card key={label} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-slate-500">{label}</div>
                <div className="mt-3 text-2xl font-bold">{value}</div>
              </div>
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                  index === 2
                    ? "bg-amber-50 text-amber-600"
                    : "bg-blue-50 text-blue-600"
                }`}
              >
                <IconFile />
              </span>
            </div>
          </Card>
        ))}
      </div>
      <CustomerPageToolbar placeholder="Search application, customer, product, or agreement" />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {[
                  "Application",
                  "Customer",
                  "Product",
                  "Store",
                  "Amount",
                  "Approval",
                  "Agreement",
                  "Actions",
                ].map((label) => (
                  <th key={label} className="px-5 py-4">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-100">
                <td className="px-5 py-4 font-bold">BPA-2026-004582</td>
                <td className="px-5 py-4">Emmanuel Agyeman</td>
                <td className="px-5 py-4">Samsung 65-inch QLED TV</td>
                <td className="px-5 py-4">CYTECH Gadgets</td>
                <td className="px-5 py-4 font-bold">GHS 8,400.00</td>
                <td className="px-5 py-4">
                  <Pill tone="success">Approved</Pill>
                </td>
                <td className="px-5 py-4">
                  <Pill
                    tone={issued ? "pending" : agreement ? "info" : "admin"}
                  >
                    {issued
                      ? "Awaiting Customer"
                      : agreement
                        ? "Draft"
                        : "Not Generated"}
                  </Pill>
                </td>
                <td className="px-5 py-4">
                  <div className="flex gap-3">
                    {!agreement ? (
                      <button
                        onClick={() => setGenerating(true)}
                        className="font-bold text-blue-600"
                      >
                        Generate Agreement
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => setPreview(true)}
                          className="font-bold text-blue-600"
                        >
                          Preview
                        </button>
                        {!issued && (
                          <button
                            onClick={() => {
                              setAgreement({
                                ...agreement,
                                status: "Awaiting Customer",
                              })
                              setIssued(true)
                            }}
                            className="font-bold text-emerald-600"
                          >
                            Issue to Customer
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
      {generating && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4">
          <button
            className="absolute inset-0"
            onClick={() => setGenerating(false)}
          />
          <div className="relative w-full max-w-xl rounded-[28px] bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold">Generate Purchase Agreement</h3>
            <p className="mt-1 text-sm text-slate-500">
              Terms are prepared from the approved application and payment plan.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["Application", "BPA-2026-004582"],
                ["Customer", "Emmanuel Agyeman"],
                ["Deposit", "GHS 1,680.00"],
                ["Installment", "GHS 560.00 × 12"],
              ].map(([label, value]) => (
                <InfoTile key={label} label={label} value={value} />
              ))}
            </div>
            <label className="mt-5 block">
              <span className="text-xs font-bold text-slate-600">
                First payment date
              </span>
              <input
                type="date"
                defaultValue="2026-09-10"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              />
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setGenerating(false)}>
                Cancel
              </Button>
              <Button onClick={create}>Generate Draft</Button>
            </div>
          </div>
        </div>
      )}
      {preview && agreement && (
        <EnhancedPurchaseAgreementViewer
          agreement={agreement}
          onClose={() => setPreview(false)}
        />
      )}
    </div>
  )
}

function StoreManagerPage({ page, storeId }: { page: NavId storeId: string }) {
  if (page === "store-profile") return <StoreProfilePage />
  if (page === "store-settings") return <StoreSettingsPage />
  if (page === "products") return <StoreProductsPage />
  if (page === "promotions") return <StorePromotionsPage storeId={storeId} />
  if (page === "customers") return <StoreCustomersPage />
  if (page === "team-access") return <StoreRolesUsersPage />
  if (page === "shop-rules") return <ShopRulesTermsPage />
  if (page === "applications")
    return <HirePurchaseReviewPage role="Store" storeId={storeId} />
  if (page === "layaway-plans") return <LayawayPlansPage />
  if (page === "collection-agents")
    return <StoreFieldAgentsPage storeId={storeId} />
  if (page === "agent-settlements")
    return <StoreAgentSettlementsPage storeId={storeId} />
  const data = STORE_PAGE_DATA[page]
  if (!data) return null
  return (
    <div className="space-y-6">
      <SectionHeader
        title={data.title}
        description={data.description}
        actions={data.action ? <Button>{data.action}</Button> : undefined}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.metrics.map(([label, value]) => (
          <Card key={label} className="p-5">
            <div className="text-sm text-slate-500">{label}</div>
            <div className="mt-3 text-2xl font-bold">{value}</div>
            <div className="mt-2 text-xs font-semibold text-emerald-600">
              View details →
            </div>
          </Card>
        ))}
      </div>
      <CustomerPageToolbar placeholder={`Search ${data.title.toLowerCase()}`} />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {data.columns.map((c) => (
                  <th key={c} className="px-5 py-4">
                    {c}
                  </th>
                ))}
                <th className="px-5 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr key={i} className="border-t border-slate-100">
                  {row.map((cell, j) => (
                    <td key={j} className="px-5 py-4">
                      <span
                        className={
                          j === row.length - 1
                            ? "rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700"
                            : ""
                        }
                      >
                        {cell}
                      </span>
                    </td>
                  ))}
                  <td className="px-5 py-4 font-bold text-blue-600">
                    View Details
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function StoreProfilePage() {
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [profile, setProfile] = useState<Record<string, string>>({
    storeType: "Physical & online store",
    officeClassification: "Main head office",
    region: "Greater Accra",
    operatingLocation: "Oxford Street, Osu, Accra",
    nearestLandmark: "Opposite Oxford Street Mall",
  })
  const businessFields = [
    ["Registered business name", "CYTECH Digital Solutions Ltd"],
    ["Public store name", "CYTECH Gadgets"],
    ["Registration number", "CS-2021-88420"],
    ["Tax ID", "C0009841203"],
    ["Primary phone", "+233 24 555 0190"],
    ["Business email", "hello@cytechgadgets.com"],
    ["Store type", profile.storeType],
  ]
  const locationFields = [
    ["Office classification", profile.officeClassification],
    ["Region", profile.region],
    ["Exact operating location", profile.operatingLocation],
    ["Nearest landmark", profile.nearestLandmark],
    ["GhanaPost GPS", "GA-183-4402"],
    ["Manager", "Emmanuel Agyeman"],
    ["Opening hours", "8:30 AM – 6:00 PM"],
  ]
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Store Profile"
        description="Manage the information customers see about your store."
        actions={
          editing ? (
            <>
              <Button variant="secondary" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setEditing(false)
                  setSaved(true)
                }}
              >
                Save Changes
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary">Preview Store</Button>
              <Button onClick={() => setEditing(true)}>Edit Profile</Button>
            </>
          )
        }
      />
      {saved && (
        <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
          Store profile updated successfully.
        </div>
      )}
      <Card className="overflow-hidden">
        <div className="h-36 bg-gradient-to-r from-blue-950 to-blue-600" />
        <div className="p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl border-4 border-white bg-white text-2xl font-black text-blue-700 shadow">
              CG
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold">CYTECH Gadgets</h3>
              <p className="text-sm text-slate-500">
                Store ID BPS-000184 · Electronics · Member since 2022
              </p>
              <span className="mt-2 inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                Verified · Active
              </span>
            </div>
            <div className="sm:w-52">
              <div className="flex justify-between text-xs font-bold">
                <span>Profile completion</span>
                <span>94%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div className="h-full w-[94%] rounded-full bg-blue-600" />
              </div>
            </div>
          </div>
        </div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        {[
          { title: "Business & Contact Information", fields: businessFields },
          { title: "Location & Operating Information", fields: locationFields },
        ].map((section) => (
          <Card key={section.title} className="p-5">
            <h3 className="text-lg font-bold">{section.title}</h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {section.fields.map(([label, value]) => (
                <label
                  key={label}
                  className={
                    label === "Exact operating location" ||
                    label === "Nearest landmark"
                      ? "sm:col-span-2"
                      : ""
                  }
                >
                  <span className="text-xs font-semibold text-slate-500">
                    {label}
                  </span>
                  {editing ? (
                    label === "Store type" ? (
                      <select
                        value={profile.storeType}
                        onChange={(event) =>
                          setProfile({
                            ...profile,
                            storeType: event.target.value,
                          })
                        }
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                      >
                        <option>Physical store</option>
                        <option>Online store</option>
                        <option>Physical & online store</option>
                      </select>
                    ) : label === "Office classification" ? (
                      <select
                        value={profile.officeClassification}
                        onChange={(event) =>
                          setProfile({
                            ...profile,
                            officeClassification: event.target.value,
                          })
                        }
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                      >
                        <option>Main head office</option>
                        <option>Branch</option>
                      </select>
                    ) : label === "Region" ? (
                      <select
                        value={profile.region}
                        onChange={(event) =>
                          setProfile({
                            ...profile,
                            region: event.target.value,
                            operatingLocation: getGhanaRegionalCapital(
                              event.target.value,
                            ),
                          })
                        }
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                      >
                        {GHANA_REGIONS.map((region) => (
                          <option key={region}>{region}</option>
                        ))}
                      </select>
                    ) : label === "Exact operating location" ||
                      label === "Nearest landmark" ? (
                      <input
                        value={value}
                        onChange={(event) => {
                          if (label === "Exact operating location")
                            setProfile({
                              ...profile,
                              operatingLocation: event.target.value,
                            })
                          if (label === "Nearest landmark")
                            setProfile({
                              ...profile,
                              nearestLandmark: event.target.value,
                            })
                        }}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    ) : (
                      <input
                        defaultValue={value}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    )
                  ) : (
                    <div className="mt-1.5 rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-medium">
                      {value}
                    </div>
                  )}
                </label>
              ))}
            </div>
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <h3 className="text-lg font-bold">Verification Documents</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            "Business certificate",
            "Ghana Card",
            "Tax certificate",
            "Settlement account",
          ].map((x) => (
            <div key={x} className="rounded-2xl border border-slate-200 p-4">
              <div className="font-semibold">{x}</div>
              <div className="mt-2 text-xs font-bold text-emerald-700">
                ✓ Verified
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function StoreSettingsPage() {
  const tabs = [
    "General",
    "Operations",
    "Applications",
    "Inventory",
    "Payments",
    "Notifications",
    "Security",
    "Store Management",
  ]
  const [active, setActive] = useState("General")
  const [saved, setSaved] = useState(false)
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Store Settings"
        description="Manage store preferences, operations, payments, and security."
      />
      <div className="flex gap-2 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setActive(t)}
            className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold ${
              active === t
                ? "bg-blue-600 text-white"
                : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {saved && (
        <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
          {active} settings saved successfully.
        </div>
      )}
      <Card className="p-5 sm:p-6">
        <h3 className="text-xl font-bold">{active} Settings</h3>
        <p className="mt-1 text-sm text-slate-500">
          Configure your store’s {active.toLowerCase()} preferences.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            "Primary preference",
            "Default option",
            "Email notifications",
            "Automatic updates",
            "Require confirmation",
            "Operational alerts",
          ].map((label, i) => (
            <label
              key={label}
              className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4"
            >
              <div>
                <div className="font-semibold">{label}</div>
                <div className="text-xs text-slate-500">
                  Recommended for CYTECH Gadgets
                </div>
              </div>
              {i < 2 ? (
                <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  <option>Enabled</option>
                  <option>Disabled</option>
                </select>
              ) : (
                <input
                  type="checkbox"
                  defaultChecked={i !== 4}
                  className="h-5 w-5 accent-blue-600"
                />
              )}
            </label>
          ))}
        </div>
        <div className="mt-6">
          <Button onClick={() => setSaved(true)}>Save Changes</Button>
        </div>
      </Card>
    </div>
  )
}

function LegacyCustomerDashboard({
  onNavigate,
}: {
  onNavigate: (id: NavId) => void
}) {
  const summaries = [
    ["Active Applications", "2", "1 currently under review", "my-applications"],
    ["Active Purchases", "2", "7 of 12 installments paid", "my-purchases"],
    ["Next Payment", "GHS 350.00", "Due August 10, 2026", "payment-history"],
    [
      "Outstanding Balance",
      "GHS 2,450.00",
      "Across two purchases",
      "my-purchases",
    ],
  ] as const
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Good morning, Emmanuel"
        description="Here is an overview of your AdepaPay account."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => onNavigate("my-purchases")}
            >
              Browse Products
            </Button>
            <Button onClick={() => onNavigate("hire-purchase-application")}>
              New Application
            </Button>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaries.map(([title, value, detail, target]) => (
          <button
            key={title}
            onClick={() => onNavigate(target)}
            className="rounded-[24px] border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300"
          >
            <div className="text-sm font-medium text-slate-500">{title}</div>
            <div className="mt-3 text-2xl font-bold">{value}</div>
            <div className="mt-2 text-xs text-slate-500">{detail}</div>
          </button>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">Latest Application</h3>
              <p className="text-sm text-slate-500">
                BPA-2026-004582 · Samsung 65&quot; QLED TV
              </p>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
              Under Review
            </span>
          </div>
          <div className="mt-6 flex items-center justify-between gap-1">
            {["Submitted", "Verification", "Review", "Approved"].map(
              (step, i) => (
                <div key={step} className="flex-1 text-center">
                  <div
                    className={`mx-auto h-2 rounded-full ${
                      i < 3 ? "bg-blue-600" : "bg-slate-200"
                    }`}
                  />
                  <div className="mt-2 text-[10px] font-semibold text-slate-500">
                    {step}
                  </div>
                </div>
              ),
            )}
          </div>
          <button
            onClick={() => onNavigate("my-applications")}
            className="mt-5 text-sm font-bold text-blue-600"
          >
            View application →
          </button>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">Upcoming Payment</h3>
              <p className="text-sm text-slate-500">
                MacBook Pro 14&quot; · Due in 6 days
              </p>
            </div>
            <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
              Due Soon
            </span>
          </div>
          <div className="mt-5 text-3xl font-bold">GHS 350.00</div>
          <div className="mt-5 flex gap-3">
            <Button onClick={() => onNavigate("payment-history")}>
              Pay Now
            </Button>
            <Button
              variant="secondary"
              onClick={() => onNavigate("my-purchases")}
            >
              View Schedule
            </Button>
          </div>
        </Card>
      </div>
      <Card className="p-5">
        <h3 className="text-lg font-bold">Recent activity</h3>
        <div className="mt-4 divide-y divide-slate-100">
          {[
            [
              "Payment successful",
              "GHS 350.00 paid via MTN Mobile Money",
              "Today, 9:12 AM",
            ],
            [
              "Application moved to review",
              "BPA-2026-004582 is being assessed",
              "Yesterday",
            ],
            ["Receipt available", "Receipt BPR-008821 is ready", "August 1"],
          ].map(([a, b, c]) => (
            <div key={a} className="flex gap-4 py-4">
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-blue-600" />
              <div className="flex-1">
                <div className="font-semibold">{a}</div>
                <div className="text-sm text-slate-500">{b}</div>
              </div>
              <div className="text-xs text-slate-400">{c}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function CustomerBrowseStoresPage({
  onNavigate,
}: {
  onNavigate: (id: NavId) => void
}) {
  const stores = [
    {
      name: "TechWorld Electronics",
      category: "Electronics",
      location: "Osu, Accra",
      rating: "4.9",
      products: 248,
      image:
        "https://images.unsplash.com/photo-1491933382434-500287f9b54b?w=700&h=320&fit=crop",
      desc: "Premium phones, laptops, televisions and accessories.",
    },
    {
      name: "HomeStyle Furniture",
      category: "Furniture",
      location: "Adum, Kumasi",
      rating: "4.7",
      products: 182,
      image:
        "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=700&h=320&fit=crop",
      desc: "Modern furniture and home décor with flexible payment options.",
    },
    {
      name: "SmartHome Appliances",
      category: "Home Appliances",
      location: "Takoradi",
      rating: "4.9",
      products: 156,
      image:
        "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=700&h=320&fit=crop",
      desc: "Trusted kitchen and home appliances with full warranty.",
    },
    {
      name: "PhoneZone Ghana",
      category: "Phones",
      location: "Circle, Accra",
      rating: "4.5",
      products: 420,
      image:
        "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=700&h=320&fit=crop",
      desc: "Genuine smartphones and accessories from leading brands.",
    },
    {
      name: "LaptopCity Pro",
      category: "Laptops",
      location: "Kumasi",
      rating: "4.7",
      products: 134,
      image:
        "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=700&h=320&fit=crop",
      desc: "Business and gaming laptops with certified warranties.",
    },
    {
      name: "GlowUp Beauty Store",
      category: "Beauty",
      location: "Airport, Accra",
      rating: "4.4",
      products: 285,
      image:
        "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=700&h=320&fit=crop",
      desc: "Authentic skincare, cosmetics and personal care products.",
    },
  ]
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("All")
  const visible = stores.filter(
    (store) =>
      (category === "All" || store.category === category) &&
      `${store.name} ${store.location} ${store.category}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  )
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Browse Stores"
        description="Discover verified AdepaPay stores and explore their available products."
        actions={
          <Button onClick={() => onNavigate("products")}>
            Browse All Products
          </Button>
        }
      />
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_240px]">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search stores, categories, or locations"
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
          >
            <option>All</option>
            {[...new Set(stores.map((store) => store.category))].map(
              (value) => (
                <option key={value}>{value}</option>
              ),
            )}
          </select>
        </div>
      </Card>
      <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
        {visible.map((store) => (
          <Card key={store.name} className="group overflow-hidden">
            <div className="relative h-44 overflow-hidden">
              <img
                src={store.image}
                alt={store.name}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
              <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-bold text-blue-700 shadow">
                ✓ Verified Store
              </span>
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">{store.name}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {store.category} · {store.location}
                  </p>
                </div>
                <span className="rounded-xl bg-amber-50 px-2 py-1 text-sm font-bold text-amber-700">
                  ★ {store.rating}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {store.desc}
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="text-xs font-semibold text-slate-500">
                  {store.products} products
                </span>
                <button
                  onClick={() => onNavigate("products")}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white"
                >
                  View Products
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {visible.length === 0 && (
        <Card className="p-10 text-center text-sm text-slate-500">
          No stores match your search.
        </Card>
      )}
    </div>
  )
}

function CustomerBrowseProductsPage({
  onNavigate,
}: {
  onNavigate: (id: NavId) => void
}) {
  const products = [
    {
      name: "iPhone 15 Pro Max 256GB",
      brand: "Apple",
      store: "TechWorld Electronics",
      category: "Phones",
      price: 7600,
      deposit: 1520,
      monthly: 507,
      image:
        "https://images.unsplash.com/photo-1696446702183-afb69c5f24a4?w=500&h=400&fit=crop",
      condition: "New",
      applications: ["Pay Now", "Hire Purchase", "Layaway"],
    },
    {
      name: 'MacBook Pro 14" M3 Pro',
      brand: "Apple",
      store: "CYTECH Gadgets",
      category: "Laptops",
      price: 9800,
      deposit: 1960,
      monthly: 653,
      image:
        "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500&h=400&fit=crop",
      condition: "New",
      applications: ["Pay Now", "Hire Purchase"],
      swap: true,
    },
    {
      name: "Samsung Galaxy S25 Ultra",
      brand: "Samsung",
      store: "PhoneZone Ghana",
      category: "Phones",
      price: 5800,
      deposit: 1160,
      monthly: 387,
      image:
        "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500&h=400&fit=crop",
      condition: "New",
      applications: ["Pay Now", "Layaway"],
      swap: true,
    },
    {
      name: 'Samsung 65" Neo QLED 4K',
      brand: "Samsung",
      store: "TechWorld Electronics",
      category: "Electronics",
      price: 8400,
      deposit: 1400,
      monthly: 560,
      image:
        "https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=500&h=400&fit=crop",
      condition: "New",
      applications: ["Pay Now", "Hire Purchase", "Layaway"],
    },
    {
      name: "Premium Sectional Sofa Set",
      brand: "HomeStyle",
      store: "HomeStyle Furniture",
      category: "Furniture",
      price: 7200,
      deposit: 1440,
      monthly: 480,
      image:
        "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=500&h=400&fit=crop",
      condition: "New",
      applications: ["Pay Now", "Layaway"],
    },
    {
      name: "LG Double Door Refrigerator",
      brand: "LG",
      store: "SmartHome Appliances",
      category: "Home Appliances",
      price: 5650,
      deposit: 1130,
      monthly: 377,
      image:
        "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=500&h=400&fit=crop",
      condition: "New",
      applications: ["Pay Now", "Hire Purchase"],
    },
  ]
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("All"),
    [swapOnly, setSwapOnly] = useState(false)
  const visible = products.filter(
    (product) =>
      (category === "All" || product.category === category) &&
      (!swapOnly || product.swap) &&
      `${product.name} ${product.store} ${product.brand}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  )
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Browse Products"
        description="Explore products from verified stores with Pay Now, Hire Purchase, and Layaway options."
        actions={
          <Button variant="secondary" onClick={() => onNavigate("stores")}>
            Browse Stores
          </Button>
        }
      />
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_240px_auto]">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, brands, or stores"
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
          >
            <option>All</option>
            {[...new Set(products.map((product) => product.category))].map(
              (value) => (
                <option key={value}>{value}</option>
              ),
            )}
          </select>
          <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700">
            <input
              type="checkbox"
              checked={swapOnly}
              onChange={(event) => setSwapOnly(event.target.checked)}
            />
            Swap Available
          </label>
        </div>
      </Card>
      <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
        {visible.map((product) => (
          <Card key={product.name} className="group overflow-hidden">
            <div className="relative h-52 overflow-hidden bg-slate-50">
              <img
                src={product.image}
                alt={product.name}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
              <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-700 shadow">
                {product.condition}
              </span>
              {product.swap && (
                <span className="absolute right-3 top-3 rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white shadow">
                  Swap Available
                </span>
              )}
            </div>
            <div className="p-5">
              <div className="text-xs font-semibold text-slate-400">
                {product.brand} · ✓ Verified Store
              </div>
              <h3 className="mt-1 text-lg font-bold">{product.name}</h3>
              <p className="mt-1 text-xs text-slate-500">{product.store}</p>
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-center">
                <div>
                  <div className="text-[10px] text-slate-400">Price</div>
                  <div className="mt-1 text-xs font-bold">
                    {money(product.price)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Deposit</div>
                  <div className="mt-1 text-xs font-bold text-blue-700">
                    {money(product.deposit)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Monthly</div>
                  <div className="mt-1 text-xs font-bold text-emerald-700">
                    {money(product.monthly)}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {product.applications.map((option) => (
                  <span
                    key={option}
                    className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700"
                  >
                    {option}
                  </span>
                ))}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                {product.applications.includes("Hire Purchase") && (
                  <Button
                    variant="secondary"
                    onClick={() => onNavigate("hire-purchase-application")}
                  >
                    Hire Purchase
                  </Button>
                )}
                {product.applications.includes("Layaway") && (
                  <Button onClick={() => onNavigate("layaway-plans")}>
                    Choose Layaway
                  </Button>
                )}
                {product.swap && (
                  <Button
                    variant="secondary"
                    onClick={() => onNavigate("swap-application")}
                  >
                    Apply for Swap
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
      {visible.length === 0 && (
        <Card className="p-10 text-center text-sm text-slate-500">
          No products match your search.
        </Card>
      )}
    </div>
  )
}

function CustomerDashboard({
  onNavigate,
}: {
  onNavigate: (id: NavId) => void
}) {
  const quickActions = [
    {
      label: "New application",
      detail: "Apply in minutes",
      icon: <IconCheckCircle />,
      target: "hire-purchase-application" as NavId,
      tone: "bg-blue-600 text-white",
    },
    {
      label: "My purchases",
      detail: "Track your items",
      icon: <IconBag />,
      target: "my-purchases" as NavId,
      tone: "bg-white text-blue-700",
    },
    {
      label: "Make payment",
      detail: "Securely pay now",
      icon: <IconWallet />,
      target: "payment-history" as NavId,
      tone: "bg-white text-emerald-700",
    },
    {
      label: "Get support",
      detail: "We're here to help",
      icon: <IconHelp />,
      target: "settings" as NavId,
      tone: "bg-white text-violet-700",
    },
  ]
  const metrics = [
    {
      label: "Active purchases",
      value: "2",
      detail: "Both accounts current",
      icon: <IconBag />,
      tone: "bg-blue-50 text-blue-700",
      target: "my-purchases" as NavId,
    },
    {
      label: "Applications",
      value: "2",
      detail: "1 currently in review",
      icon: <IconFile />,
      tone: "bg-violet-50 text-violet-700",
      target: "my-applications" as NavId,
    },
    {
      label: "Paid this month",
      value: "GHS 805",
      detail: "2 successful payments",
      icon: <IconCheckCircle />,
      tone: "bg-emerald-50 text-emerald-700",
      target: "payment-history" as NavId,
    },
  ]
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#0b5fff] via-[#1746c7] to-[#172554] p-6 text-white shadow-xl shadow-blue-950/10 sm:p-8">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-cyan-300/20 blur-2xl" />
        <div className="absolute bottom-0 right-1/3 h-36 w-36 rounded-full bg-violet-400/20 blur-2xl" />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_360px] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              Account in good standing
            </div>
            <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
              Good morning, Emmanuel
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-blue-100 sm:text-base">
              You are making great progress. Your next installment is due in 6
              days.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => onNavigate("payment-history")}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-blue-700 shadow-lg"
              >
                Pay GHS 350.00
              </button>
              <button
                onClick={() => onNavigate("my-purchases")}
                className="rounded-2xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur hover:bg-white/15"
              >
                View payment plan
              </button>
            </div>
          </div>
          <div className="rounded-[26px] border border-white/15 bg-white/10 p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-blue-200">
                  Overall repayment
                </div>
                <div className="mt-2 text-3xl font-bold">68%</div>
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-[6px] border-white/25 border-t-white text-xs font-bold">
                7/12
              </div>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15">
              <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-cyan-300 to-white" />
            </div>
            <div className="mt-3 flex justify-between text-xs text-blue-100">
              <span>GHS 5,950 paid</span>
              <span>GHS 2,450 remaining</span>
            </div>
          </div>
        </div>
      </section>
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">Quick actions</h3>
            <p className="text-sm text-slate-500">
              Everything you need, one tap away.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => onNavigate(action.target)}
              className={`group flex items-center gap-4 rounded-[22px] border border-slate-200 p-4 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${action.tone}`}
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                  action.tone.includes("bg-white")
                    ? "bg-slate-50"
                    : "bg-white/15"
                }`}
              >
                {action.icon}
              </span>
              <span>
                <span className="block text-sm font-bold">{action.label}</span>
                <span
                  className={`mt-0.5 block text-xs ${
                    action.tone.includes("bg-white")
                      ? "text-slate-500"
                      : "text-blue-100"
                  }`}
                >
                  {action.detail}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">My Active Layaway</h3>
            <p className="mt-1 text-sm text-slate-500">
              Your product stays reserved at the store until it is fully paid.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => onNavigate("my-payment-plans")}
          >
            View all plans
          </Button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Active Layaway Plans", "2"],
            ["Amount Paid", "GHS 5,950"],
            ["Outstanding", "GHS 2,450"],
            ["Due Today", "GHS 80"],
            ["Ready for Collection", "1"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-semibold text-slate-500">
                {label}
              </div>
              <div className="mt-2 text-xl font-bold">{value}</div>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <div className="font-bold">Samsung 65-inch QLED TV</div>
              <div className="mt-1 text-xs text-slate-500">
                CYTECH Gadgets · LAY-2026-004582
              </div>
              <div className="mt-3 h-2 rounded-full bg-white">
                <div className="h-full w-[61.9%] rounded-full bg-blue-600" />
              </div>
              <div className="mt-2 flex justify-between text-xs font-semibold">
                <span>61.9% paid</span>
                <span>GHS 50 due today</span>
              </div>
            </div>
            <Button onClick={() => onNavigate("my-payment-plans")}>
              Pay Now
            </Button>
          </div>
        </div>
      </Card>
      <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {metrics.map((metric) => (
              <button
                key={metric.label}
                onClick={() => onNavigate(metric.target)}
                className="rounded-[24px] border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-blue-200 hover:shadow-md"
              >
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl ${metric.tone}`}
                >
                  {metric.icon}
                </span>
                <div className="mt-4 text-2xl font-bold text-slate-950">
                  {metric.value}
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-700">
                  {metric.label}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {metric.detail}
                </div>
              </button>
            ))}
          </div>
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div>
                <h3 className="text-lg font-bold">Latest application</h3>
                <p className="text-xs text-slate-500">
                  BPA-2026-004582 · Samsung 65&quot; QLED TV
                </p>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
                Under review
              </span>
            </div>
            <div className="p-5">
              <div className="flex gap-2">
                {["Submitted", "Identity check", "Review", "Approved"].map(
                  (label, i) => (
                    <div key={label} className="min-w-0 flex-1">
                      <div
                        className={`h-2 rounded-full ${
                          i < 3
                            ? "bg-gradient-to-r from-blue-600 to-cyan-400"
                            : "bg-slate-200"
                        }`}
                      />
                      <div className="mt-2 truncate text-[10px] font-semibold text-slate-500">
                        {label}
                      </div>
                    </div>
                  ),
                )}
              </div>
              <button
                onClick={() => onNavigate("my-applications")}
                className="mt-5 flex items-center gap-2 text-sm font-bold text-blue-600"
              >
                Track application <span>→</span>
              </button>
            </div>
          </Card>
        </div>
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-start justify-between">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                <IconWallet />
              </span>
              <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
                Due in 6 days
              </span>
            </div>
            <div className="mt-5 text-sm font-semibold text-slate-500">
              Upcoming installment
            </div>
            <div className="mt-1 text-3xl font-bold">GHS 350.00</div>
            <div className="mt-1 text-sm text-slate-500">
              MacBook Pro 14&quot; · August 10
            </div>
            <button
              onClick={() => onNavigate("payment-history")}
              className="mt-5 w-full rounded-2xl bg-slate-950 py-3 text-sm font-bold text-white hover:bg-blue-700"
            >
              Pay securely
            </button>
          </Card>
          <Card className="p-5">
            <h3 className="text-lg font-bold">Recent activity</h3>
            <div className="mt-3 space-y-1">
              {[
                ["Payment received", "GHS 350.00 · Today", "bg-emerald-500"],
                [
                  "Application updated",
                  "Moved to review · Yesterday",
                  "bg-blue-500",
                ],
                ["Receipt ready", "BPR-008821 · Aug 1", "bg-violet-500"],
              ].map(([title, detail, color]) => (
                <div
                  key={title}
                  className="flex items-center gap-3 rounded-2xl p-3 hover:bg-slate-50"
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
                  <div>
                    <div className="text-sm font-semibold">{title}</div>
                    <div className="text-xs text-slate-500">{detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function CustomerPageToolbar({ placeholder }: { placeholder: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-white p-4 sm:flex-row">
      <input
        className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
        placeholder={placeholder}
      />
      <select className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm">
        <option>All statuses</option>
        <option>Active</option>
        <option>Pending</option>
        <option>Completed</option>
      </select>
      <Button variant="secondary">Clear Filters</Button>
    </div>
  )
}

function LegacyMyApplicationsPage({
  onNavigate,
}: {
  onNavigate: (id: NavId) => void
}) {
  const rows = [
    [
      "BPA-2026-004582",
      "Samsung 65” QLED TV",
      "Adepa Home",
      "GHS 8,400.00",
      "Under Review",
    ],
    [
      "BPA-2026-003901",
      "MacBook Pro 14”",
      "CYTECH Gadgets",
      "GHS 12,800.00",
      "Approved",
    ],
    [
      "BPA-2026-002744",
      "LG Double Door Fridge",
      "Nova Appliances",
      "GHS 5,650.00",
      "Draft",
    ],
  ]
  return (
    <div className="space-y-6">
      <SectionHeader
        title="My Applications"
        description="View and manage all your hire-purchase applications."
        actions={
          <Button onClick={() => onNavigate("hire-purchase-application")}>
            New Application
          </Button>
        }
      />
      <CustomerPageToolbar placeholder="Search application reference or product" />
      <Card className="overflow-hidden">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {[
                  "Reference",
                  "Product",
                  "Store",
                  "Amount",
                  "Status",
                  "Action",
                ].map((h) => (
                  <th key={h} className="px-5 py-4">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row[0]} className="border-t border-slate-100">
                  {row.slice(0, 4).map((v) => (
                    <td key={v} className="px-5 py-4">
                      {v}
                    </td>
                  ))}
                  <td className="px-5 py-4">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                      {row[4]}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-bold text-blue-600">
                    View Details
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-3 p-4 md:hidden">
          {rows.map((row) => (
            <div
              key={row[0]}
              className="rounded-2xl border border-slate-200 p-4"
            >
              <div className="font-bold">{row[1]}</div>
              <div className="mt-1 text-xs text-slate-500">
                {row[0]} · {row[2]}
              </div>
              <div className="mt-4 flex justify-between">
                <span className="font-semibold">{row[3]}</span>
                <span className="text-xs font-bold text-blue-600">
                  {row[4]}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

type PurchaseAgreement = {
  reference: string
  application: string
  customer: string
  store: string
  product: string
  cashPrice: string
  deposit: string
  financed: string
  monthly: string
  duration: string
  totalPayable: string
  firstPayment: string
  issuer: string
  issuedDate: string
  status: "Draft" | "Awaiting Customer" | "Accepted"
}

const DEMO_AGREEMENT: PurchaseAgreement = {
  reference: "AGR-2026-004582",
  application: "BPA-2026-004582",
  customer: "Emmanuel Agyeman",
  store: "CYTECH Gadgets",
  product: "Samsung 65-inch QLED TV",
  cashPrice: "GHS 8,400.00",
  deposit: "GHS 1,680.00",
  financed: "GHS 6,720.00",
  monthly: "GHS 560.00",
  duration: "12 months",
  totalPayable: "GHS 8,400.00",
  firstPayment: "September 10, 2026",
  issuer: "CYTECH Gadgets · Approved by AdepaPay",
  issuedDate: "August 11, 2026",
  status: "Awaiting Customer",
}

function MyApplicationsPage({
  onNavigate,
  customerPhoto,
}: {
  onNavigate: (id: NavId) => void
  customerPhoto: string | null
}) {
  const [agreement, setAgreement] = useState<PurchaseAgreement>(DEMO_AGREEMENT)
  const [viewing, setViewing] = useState(false)
  const rows = [
    [
      "BPA-2026-004582",
      "Samsung 65-inch QLED TV",
      "CYTECH Gadgets",
      "GHS 8,400.00",
      "Approved",
    ],
    [
      "BPA-2026-003901",
      "MacBook Pro 14-inch",
      "CYTECH Gadgets",
      "GHS 12,800.00",
      "Approved",
    ],
    [
      "BPA-2026-002744",
      "LG Double Door Fridge",
      "Nova Appliances",
      "GHS 5,650.00",
      "Draft",
    ],
  ]
  return (
    <div className="space-y-6">
      <SectionHeader
        title="My Applications"
        description="Track applications and review purchase agreements issued by stores and AdepaPay."
        actions={
          <Button onClick={() => onNavigate("hire-purchase-application")}>
            New Application
          </Button>
        }
      />
      {agreement.status === "Awaiting Customer" && (
        <div className="rounded-[24px] border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-amber-600 shadow-sm">
              <IconFile />
            </span>
            <div className="flex-1">
              <div className="font-bold text-slate-950">
                Purchase agreement ready for your review
              </div>
              <div className="mt-1 text-sm text-slate-600">
                {agreement.reference} · {agreement.product} · Issued by{" "}
                {agreement.issuer}
              </div>
            </div>
            <button
              onClick={() => setViewing(true)}
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white"
            >
              Review & Agree
            </button>
          </div>
        </div>
      )}
      {agreement.status === "Accepted" && (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5 text-sm font-bold text-emerald-700">
          ✓ Purchase agreement {agreement.reference} accepted successfully. Your
          copy is available below.
        </div>
      )}
      <CustomerPageToolbar placeholder="Search application reference or product" />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {[
                  "Reference",
                  "Product",
                  "Store",
                  "Amount",
                  "Application",
                  "Agreement",
                  "Action",
                ].map((label) => (
                  <th key={label} className="px-5 py-4">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row[0]} className="border-t border-slate-100">
                  <td className="px-5 py-4 font-semibold">{row[0]}</td>
                  <td className="px-5 py-4">{row[1]}</td>
                  <td className="px-5 py-4">{row[2]}</td>
                  <td className="px-5 py-4 font-semibold">{row[3]}</td>
                  <td className="px-5 py-4">
                    <Pill tone={row[4] === "Approved" ? "success" : "pending"}>
                      {row[4]}
                    </Pill>
                  </td>
                  <td className="px-5 py-4">
                    {index === 0 ? (
                      <Pill
                        tone={
                          agreement.status === "Accepted"
                            ? "success"
                            : "pending"
                        }
                      >
                        {agreement.status}
                      </Pill>
                    ) : (
                      <span className="text-slate-400">Not issued</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {index === 0 ? (
                      <button
                        onClick={() => setViewing(true)}
                        className="font-bold text-blue-600"
                      >
                        {agreement.status === "Accepted"
                          ? "View Agreement"
                          : "Review & Agree"}
                      </button>
                    ) : (
                      <button className="font-bold text-blue-600">
                        View Details
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {viewing && (
        <EnhancedPurchaseAgreementViewer
          agreement={agreement}
          customerPhoto={customerPhoto}
          customerMode
          onClose={() => setViewing(false)}
          onAccept={() => {
            setAgreement({ ...agreement, status: "Accepted" })
            setViewing(false)
          }}
        />
      )}
    </div>
  )
}

function LegacyHirePurchaseApplicationPage() {
  const steps = [
    "Product",
    "Personal",
    "Income",
    "Delivery",
    "Documents",
    "Payment Plan",
    "Review",
  ]
  const [step, setStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  if (submitted)
    return (
      <Card className="mx-auto max-w-xl p-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-600">
          ✓
        </div>
        <h2 className="mt-5 text-2xl font-bold">Application submitted</h2>
        <p className="mt-2 text-sm text-slate-500">
          Reference BPA-2026-004913. We will notify you when verification
          begins.
        </p>
      </Card>
    )
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Apply for Hire Purchase"
        description="Complete the steps below to submit your application."
        actions={<Button variant="secondary">Save as Draft</Button>}
      />
      <div className="overflow-x-auto">
        <div className="flex min-w-[720px] gap-2">
          {steps.map((label, i) => (
            <button
              key={label}
              onClick={() => setStep(i)}
              className={`flex-1 rounded-xl px-2 py-3 text-xs font-bold ${
                i === step
                  ? "bg-blue-600 text-white"
                  : i < step
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-white text-slate-500"
              }`}
            >
              {i + 1}. {label}
            </button>
          ))}
        </div>
      </div>
      <Card className="p-6">
        <h3 className="text-xl font-bold">{steps[step]}</h3>
        <p className="mt-1 text-sm text-slate-500">
          Provide the requested information for this application step.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            ["Product / selection", "Samsung 65-inch QLED TV"],
            ["Store / provider", "Adepa Home"],
            ["Amount / details", "GHS 8,400.00"],
            ["Additional information", ""],
          ].map(([label, value]) => (
            <label key={label}>
              <span className="text-xs font-semibold text-slate-500">
                {label}
              </span>
              <input
                defaultValue={value}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                placeholder={`Enter ${label.toLowerCase()}`}
              />
            </label>
          ))}
        </div>
        <div className="mt-8 flex justify-between">
          <Button
            variant="secondary"
            onClick={() => setStep(Math.max(0, step - 1))}
          >
            Back
          </Button>
          <Button
            onClick={() =>
              step === steps.length - 1 ? setSubmitted(true) : setStep(step + 1)
            }
          >
            {step === steps.length - 1 ? "Submit Application" : "Continue"}
          </Button>
        </div>
      </Card>
    </div>
  )
}

type ApplicationGuarantor = {
  fullName: string
  relationship: string
  phone: string
  occupation: string
  address: string
  digitalAddress: string
  ghanaCard: string
  profilePhoto: string
  ghanaCardFront: string
  ghanaCardBack: string
}

type GuarantorUploadKey = "profilePhoto" | "ghanaCardFront" | "ghanaCardBack"

function HirePurchaseApplicationPage() {
  const makeGuarantor = (): ApplicationGuarantor => ({
    fullName: "",
    relationship: "",
    phone: "",
    occupation: "",
    address: "",
    digitalAddress: "",
    ghanaCard: "",
    profilePhoto: "",
    ghanaCardFront: "",
    ghanaCardBack: "",
  })
  const steps = [
    "Product",
    "Personal",
    "Income",
    "Delivery",
    "Identity",
    "Guarantors",
    "Payment Plan",
    "Review",
  ]
  const [step, setStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [paymentFrequency, setPaymentFrequency] =
    useState<"Daily" | "Weekly" | "Monthly">("Monthly")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [ghanaCard, setGhanaCard] = useState({
    number: "",
    front: "",
    back: "",
    consent: false,
  })
  const [guarantors, setGuarantors] = useState<ApplicationGuarantor[]>([
    makeGuarantor(),
    makeGuarantor(),
  ])
  const [guarantorConsent, setGuarantorConsent] = useState(false)
  const inputClass = (error?: string) =>
    `mt-1.5 w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-blue-500 ${
      error ? "border-red-400 bg-red-50/30" : "border-slate-200"
    }`
  const paymentPlans = [
    {
      frequency: "Daily" as const,
      amount: "GHS 18.41",
      installments: "365 daily payments",
    },
    {
      frequency: "Weekly" as const,
      amount: "GHS 129.23",
      installments: "52 weekly payments",
    },
    {
      frequency: "Monthly" as const,
      amount: "GHS 560.00",
      installments: "12 monthly payments",
    },
  ]
  const selectedPaymentPlan = paymentPlans.find(
    (plan) => plan.frequency === paymentFrequency,
  )!
  const updateGuarantor = (
    index: number,
    key: keyof ApplicationGuarantor,
    value: string,
  ) =>
    setGuarantors((items) =>
      items.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    )
  const uploadGuarantorImage = (
    index: number,
    key: GuarantorUploadKey,
    file?: File,
  ) => {
    if (!file) return
    const errorKey = `guarantor-${index}-${key}`
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrors((current) => ({
        ...current,
        [errorKey]: "Upload a JPG, PNG, or WEBP image",
      }))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors((current) => ({
        ...current,
        [errorKey]: "Image must be 5 MB or smaller",
      }))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      updateGuarantor(index, key, String(reader.result))
      setErrors((current) => ({ ...current, [errorKey]: "" }))
    }
    reader.readAsDataURL(file)
  }
  const validateStep = () => {
    const next: Record<string, string> = {}
    if (step === 4) {
      if (!/^GHA-\d{9}-\d$/i.test(ghanaCard.number.trim()))
        next.ghanaCard = "Use the format GHA-123456789-0"
      if (!ghanaCard.front)
        next.ghanaCardFront = "Upload the front of the Ghana Card"
      if (!ghanaCard.back)
        next.ghanaCardBack = "Upload the back of the Ghana Card"
      if (!ghanaCard.consent)
        next.ghanaCardConsent = "Consent is required for identity verification"
    }
    if (step === 5) {
      guarantors.forEach((guarantor, index) => {
        Object.entries(guarantor).forEach(([key, value]) => {
          if (!value.trim())
            next[`guarantor-${index}-${key}`] = "This field is required"
        })
        if (
          guarantor.phone &&
          !/^(\+233|0)\d{9}$/.test(guarantor.phone.replace(/\s/g, ""))
        )
          next[`guarantor-${index}-phone`] = "Enter a valid Ghana phone number"
        if (
          guarantor.ghanaCard &&
          !/^GHA-\d{9}-\d$/i.test(guarantor.ghanaCard.trim())
        )
          next[`guarantor-${index}-ghanaCard`] =
            "Use the format GHA-123456789-0"
        if (
          guarantor.digitalAddress &&
          !/^[A-Z]{2}-\d{3}-\d{4}$/i.test(guarantor.digitalAddress.trim())
        )
          next[`guarantor-${index}-digitalAddress`] =
            "Use the format GA-123-4567"
      })
      if (!guarantorConsent)
        next.guarantorConsent =
          "Confirm that every guarantor consented to identity verification"
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }
  const continueApplication = () => {
    if (!validateStep()) return
    if (step === steps.length - 1) {
      submitDemoHirePurchaseApplication()
      setSubmitted(true)
    } else setStep(step + 1)
  }
  if (submitted)
    return (
      <Card className="mx-auto max-w-xl p-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-600">
          ✓
        </div>
        <h2 className="mt-5 text-2xl font-bold">Application submitted</h2>
        <p className="mt-2 text-sm text-slate-500">
          Reference BPA-2026-004913. Your Ghana Card and each guarantor's
          identity documents will be securely verified during review. A new risk
          assessment will be added to your protected customer profile for
          authorized review.
        </p>
      </Card>
    )
  const standardFields = [
    ["Product / selection", "Samsung 65-inch QLED TV"],
    ["Store / provider", "CYTECH Gadgets"],
    ["Amount / details", "GHS 8,400.00"],
    ["Additional information", ""],
  ]
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Apply for Hire Purchase"
        description="Complete the steps below to submit your application."
        actions={<Button variant="secondary">Save as Draft</Button>}
      />
      <div className="overflow-x-auto">
        <div className="flex min-w-[860px] gap-2">
          {steps.map((label, i) => (
            <button
              key={label}
              onClick={() => {
                setErrors({})
                setStep(i)
              }}
              className={`flex-1 rounded-xl px-2 py-3 text-xs font-bold ${
                i === step
                  ? "bg-blue-600 text-white"
                  : i < step
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-white text-slate-500"
              }`}
            >
              {i + 1}. {label}
            </button>
          ))}
        </div>
      </div>
      <Card className="p-6">
        <h3 className="text-xl font-bold">{steps[step]}</h3>
        <p className="mt-1 text-sm text-slate-500">
          {step === 4
            ? "Provide your Ghana Card for secure identity verification."
            : step === 5
              ? "Add at least two guarantors who can confirm your application details."
              : "Provide the requested information for this application step."}
        </p>
        {step === 4 && (
          <div className="mt-6 space-y-5">
            <label className="block max-w-md">
              <span className="text-xs font-semibold text-slate-500">
                Ghana Card number *
              </span>
              <input
                value={ghanaCard.number}
                onChange={(e) =>
                  setGhanaCard({
                    ...ghanaCard,
                    number: e.target.value.toUpperCase(),
                  })
                }
                className={inputClass(errors.ghanaCard)}
                placeholder="GHA-123456789-0"
              />
              {errors.ghanaCard && (
                <span className="mt-1 block text-xs text-red-600">
                  {errors.ghanaCard}
                </span>
              )}
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              {(["front", "back"] as const).map((side) => {
                const errorKey =
                  side === "front" ? "ghanaCardFront" : "ghanaCardBack"
                return (
                  <label
                    key={side}
                    className={`cursor-pointer rounded-2xl border border-dashed p-5 text-center ${
                      errors[errorKey]
                        ? "border-red-400 bg-red-50"
                        : "border-slate-300 bg-slate-50"
                    }`}
                  >
                    <span className="block text-sm font-bold text-slate-700">
                      {side === "front" ? "Front" : "Back"} of Ghana Card *
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      PNG, JPG or PDF
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,application/pdf"
                      className="hidden"
                      onChange={(e) =>
                        setGhanaCard({
                          ...ghanaCard,
                          [side]: e.target.files?.[0]?.name ?? "",
                        })
                      }
                    />
                    <span className="mt-3 inline-block text-xs font-bold text-blue-600">
                      {ghanaCard[side] || "Choose file"}
                    </span>
                    {errors[errorKey] && (
                      <span className="mt-2 block text-xs text-red-600">
                        {errors[errorKey]}
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
            <label className="flex items-start gap-3 rounded-2xl bg-blue-50 p-4 text-sm text-blue-900">
              <input
                type="checkbox"
                checked={ghanaCard.consent}
                onChange={(e) =>
                  setGhanaCard({ ...ghanaCard, consent: e.target.checked })
                }
                className="mt-1"
              />
              <span>
                I consent to AdepaPay verifying my Ghana Card details. *
              </span>
            </label>
            {errors.ghanaCardConsent && (
              <span className="block text-xs text-red-600">
                {errors.ghanaCardConsent}
              </span>
            )}
          </div>
        )}
        {step === 5 && (
          <div className="mt-6 space-y-5">
            {guarantors.map((guarantor, index) => (
              <div
                key={index}
                className="rounded-2xl border border-slate-200 p-5"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold">Guarantor {index + 1}</h4>
                    <p className="text-xs text-slate-500">
                      All details are required.
                    </p>
                  </div>
                  {index > 1 && (
                    <button
                      onClick={() =>
                        setGuarantors((items) =>
                          items.filter((_, i) => i !== index),
                        )
                      }
                      className="text-xs font-bold text-red-600"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    ["fullName", "Full name"],
                    ["relationship", "Relationship to applicant"],
                    ["phone", "Phone number"],
                    ["occupation", "Occupation"],
                    ["ghanaCard", "Ghana Card number"],
                    ["address", "Residential address"],
                    ["digitalAddress", "GhanaPost GPS address"],
                  ].map(([key, label]) => (
                    <label
                      key={key}
                      className={
                        key === "address" || key === "digitalAddress"
                          ? "sm:col-span-2"
                          : ""
                      }
                    >
                      <span className="text-xs font-semibold text-slate-500">
                        {label} *
                      </span>
                      <input
                        value={guarantor[(key as keyof ApplicationGuarantor)]}
                        onChange={(e) =>
                          updateGuarantor(
                            index,
                            key as keyof ApplicationGuarantor,
                            key === "digitalAddress"
                              ? e.target.value.toUpperCase()
                              : e.target.value,
                          )
                        }
                        className={inputClass(
                          errors[`guarantor-${index}-${key}`],
                        )}
                        placeholder={
                          key === "ghanaCard"
                            ? "GHA-123456789-0"
                            : key === "digitalAddress"
                              ? "GA-123-4567"
                              : `Enter ${label.toLowerCase()}`
                        }
                      />
                      {errors[`guarantor-${index}-${key}`] && (
                        <span className="mt-1 block text-xs text-red-600">
                          {errors[`guarantor-${index}-${key}`]}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
                <div className="mt-6 border-t border-slate-100 pt-5">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h5 className="text-sm font-bold text-slate-900">
                        Identity verification images
                      </h5>
                      <p className="mt-1 text-xs text-slate-500">
                        Upload clear, original images. Screenshots and
                        photocopies are not accepted.
                      </p>
                    </div>
                    <span className="mt-2 self-start rounded-full bg-amber-50 px-3 py-1 text-[10px] font-bold text-amber-700 sm:mt-0">
                      3 uploads required
                    </span>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    {([
                      [
                        "profilePhoto",
                        "Profile photo",
                        "A clear, recent face photo",
                      ],
                      [
                        "ghanaCardFront",
                        "Ghana Card front",
                        "Front side, all edges visible",
                      ],
                      [
                        "ghanaCardBack",
                        "Ghana Card back",
                        "Back side, all edges visible",
                      ],
                    ] as const).map(([key, label, hint]) => {
                      const value = guarantor[key]
                      const errorKey = `guarantor-${index}-${key}`
                      return (
                        <div key={key}>
                          <label
                            className={`group relative flex min-h-44 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed p-3 text-center transition hover:border-blue-400 hover:bg-blue-50/50 ${
                              errors[errorKey]
                                ? "border-red-300 bg-red-50"
                                : value
                                  ? "border-emerald-300 bg-emerald-50/40"
                                  : "border-slate-200 bg-slate-50"
                            }`}
                          >
                            {value ? (
                              <>
                                <img
                                  src={value}
                                  alt={`${label} preview`}
                                  className={`h-28 w-full object-cover ${
                                    key === "profilePhoto"
                                      ? "mx-auto !w-28 rounded-full"
                                      : "rounded-xl"
                                  }`}
                                />
                                <span className="mt-2 text-xs font-bold text-emerald-700">
                                  ✓ Uploaded · Click to replace
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
                                  <IconArchive />
                                </span>
                                <span className="mt-2 text-xs font-bold text-slate-800">
                                  {label} *
                                </span>
                                <span className="mt-1 text-[10px] leading-4 text-slate-500">
                                  {hint}
                                </span>
                              </>
                            )}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              capture={
                                key === "profilePhoto" ? "user" : "environment"
                              }
                              className="hidden"
                              onChange={(event) =>
                                uploadGuarantorImage(
                                  index,
                                  key,
                                  event.target.files?.[0],
                                )
                              }
                            />
                          </label>
                          {value && (
                            <button
                              type="button"
                              onClick={() => updateGuarantor(index, key, "")}
                              className="mt-2 w-full text-center text-[11px] font-bold text-red-600"
                            >
                              Remove image
                            </button>
                          )}
                          {errors[errorKey] && (
                            <span className="mt-2 block text-xs text-red-600">
                              {errors[errorKey]}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-[11px] leading-5 text-slate-500">
                    Accepted: JPG, PNG, or WEBP · Maximum 5 MB each · Ensure the
                    Ghana Card details are readable and not covered by glare.
                  </div>
                </div>
              </div>
            ))}
            <div>
              <label
                className={`flex items-start gap-3 rounded-2xl border p-4 text-sm leading-6 ${
                  errors.guarantorConsent
                    ? "border-red-300 bg-red-50"
                    : "border-blue-100 bg-blue-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={guarantorConsent}
                  onChange={(event) => {
                    setGuarantorConsent(event.target.checked)
                    setErrors((current) => ({
                      ...current,
                      guarantorConsent: "",
                    }))
                  }}
                  className="mt-1 accent-blue-600"
                />
                <span className="text-blue-950">
                  I confirm that each guarantor has consented to sharing their
                  profile photo and Ghana Card images with AdepaPay for identity
                  verification and application assessment. *
                </span>
              </label>
              {errors.guarantorConsent && (
                <span className="mt-2 block text-xs text-red-600">
                  {errors.guarantorConsent}
                </span>
              )}
            </div>
            <button
              onClick={() =>
                setGuarantors((items) => [...items, makeGuarantor()])
              }
              className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700"
            >
              + Add another guarantor
            </button>
          </div>
        )}
        {step === 6 && (
          <div className="mt-6">
            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
              <div className="text-sm font-bold text-slate-900">
                Choose your payment schedule
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Select how often you would like to pay the financed balance of
                GHS 6,720.00.
              </p>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {paymentPlans.map((plan) => {
                const selected = paymentFrequency === plan.frequency
                return (
                  <button
                    key={plan.frequency}
                    type="button"
                    onClick={() => setPaymentFrequency(plan.frequency)}
                    className={`rounded-2xl border-2 p-5 text-left transition ${
                      selected
                        ? "border-blue-600 bg-blue-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-blue-300"
                    }`}
                    aria-pressed={selected}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-slate-900">
                        {plan.frequency}
                      </span>
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                          selected ? "border-blue-600" : "border-slate-300"
                        }`}
                      >
                        {selected && (
                          <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                        )}
                      </span>
                    </div>
                    <div className="mt-4 text-xl font-bold text-blue-700">
                      {plan.amount}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {plan.installments}
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="mt-5 rounded-2xl bg-slate-950 p-5 text-white">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Selected payment schedule
              </div>
              <div className="mt-2 text-lg font-bold">
                {selectedPaymentPlan.frequency} · {selectedPaymentPlan.amount}
              </div>
              <div className="mt-1 text-xs text-slate-300">
                {selectedPaymentPlan.installments} after the GHS 1,680.00
                deposit
              </div>
            </div>
          </div>
        )}
        {step === 7 && (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-5">
              <h4 className="font-bold">Identity</h4>
              <p className="mt-3 text-sm text-slate-600">
                Ghana Card:{" "}
                <span className="font-semibold text-slate-900">
                  {ghanaCard.number || "Not provided"}
                </span>
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Documents:{" "}
                <span className="font-semibold text-slate-900">
                  {ghanaCard.front && ghanaCard.back
                    ? "Front and back added"
                    : "Incomplete"}
                </span>
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-5">
              <h4 className="font-bold">Guarantors ({guarantors.length})</h4>
              {guarantors.map((g, i) => (
                <div
                  key={i}
                  className="mt-3 border-t border-slate-200 pt-3 text-sm"
                >
                  <div className="font-semibold">
                    {g.fullName || `Guarantor ${i + 1}`}
                  </div>
                  <div className="text-slate-500">
                    {g.relationship || "Relationship not provided"} ·{" "}
                    {g.phone || "No phone"}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    GhanaPost GPS: {g.digitalAddress || "Not provided"}
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl bg-slate-50 p-5 lg:col-span-2">
              <h4 className="font-bold">Payment plan</h4>
              <p className="mt-3 text-sm text-slate-600">
                <span className="font-semibold text-slate-900">
                  {selectedPaymentPlan.frequency} · {selectedPaymentPlan.amount}
                </span>{" "}
                · {selectedPaymentPlan.installments}
              </p>
            </div>
          </div>
        )}
        {step !== 4 && step !== 5 && step !== 6 && step !== 7 && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {standardFields.map(([label, value]) => (
              <label key={label}>
                <span className="text-xs font-semibold text-slate-500">
                  {label}
                </span>
                <input
                  defaultValue={value}
                  className={inputClass()}
                  placeholder={`Enter ${label.toLowerCase()}`}
                />
              </label>
            ))}
          </div>
        )}
        <div className="mt-8 flex justify-between">
          <Button
            variant="secondary"
            onClick={() => {
              setErrors({})
              setStep(Math.max(0, step - 1))
            }}
          >
            Back
          </Button>
          <Button onClick={continueApplication}>
            {step === steps.length - 1 ? "Submit Application" : "Continue"}
          </Button>
        </div>
      </Card>
    </div>
  )
}

function CustomerLayawayApplicationPage({
  onNavigate,
}: {
  onNavigate: (id: NavId) => void
}) {
  const price = 8400,
    minDeposit = 1400
  const [step, setStep] = useState(0),
    [deposit, setDeposit] = useState(1400),
    [frequency, setFrequency] = useState("Daily"),
    [duration, setDuration] = useState(140),
    [collection, setCollection] = useState("Self Payment"),
    [submitted, setSubmitted] = useState(false)
  const [details, setDetails] = useState({
    name: "Emmanuel Agyeman",
    phone: "+233 24 880 1931",
    email: "emmanuel@example.com",
    address: "East Legon, Accra",
    location: "CYTECH Gadgets, Osu",
  })
  const [terms, setTerms] = useState({
    layaway: false,
    store: false,
    holding: false,
  })
  const balance = Math.max(0, price - deposit),
    installment = Math.ceil(balance / duration),
    completion = new Date(2026, 7, 27 + duration).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  if (submitted)
    return (
      <Card className="mx-auto max-w-xl p-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-600">
          ✓
        </div>
        <h2 className="mt-5 text-2xl font-bold">
          Layaway application submitted
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Reference LYA-2026-004913. CYTECH Gadgets will review your plan
          request.
        </p>
        <div className="mt-6">
          <Button onClick={() => onNavigate("my-applications")}>
            View My Applications
          </Button>
        </div>
      </Card>
    )
  const steps = ["Product & Plan", "Your Details", "Review"]
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Layaway / Pay Small Small"
        description="Reserve a product and pay gradually. The store keeps it until your balance is fully paid."
        actions={
          <Button
            variant="secondary"
            onClick={() => onNavigate("my-payment-plans")}
          >
            My Layaway Plans
          </Button>
        }
      />
      <div className="flex gap-2">
        {steps.map((label, index) => (
          <div
            key={label}
            className={`flex-1 rounded-xl px-3 py-3 text-center text-xs font-bold ${
              index === step
                ? "bg-blue-600 text-white"
                : index < step
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-white text-slate-400"
            }`}
          >
            {index + 1}. {label}
          </div>
        ))}
      </div>
      <Card className="p-6">
        {step === 0 && (
          <div>
            <h3 className="text-xl font-bold">
              Product and Plan Configuration
            </h3>
            <div className="mt-5 flex flex-col gap-5 rounded-2xl bg-slate-50 p-5 sm:flex-row">
              <img
                src="https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=280&h=200&fit=crop"
                className="h-36 w-full rounded-2xl object-cover sm:w-48"
              />
              <div>
                <Pill tone="success">Available · Layaway eligible</Pill>
                <h4 className="mt-3 text-lg font-bold">
                  Samsung 65-inch QLED TV
                </h4>
                <p className="text-sm text-slate-500">CYTECH Gadgets</p>
                <p className="mt-3 text-2xl font-bold">GHS 8,400.00</p>
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <label>
                <span className="text-xs font-bold text-slate-600">
                  Selected Deposit (minimum GHS 1,400)
                </span>
                <input
                  type="number"
                  min={minDeposit}
                  max={price}
                  value={deposit}
                  onChange={(e) =>
                    setDeposit(
                      Math.min(
                        price,
                        Math.max(minDeposit, Number(e.target.value)),
                      ),
                    )
                  }
                  className="mt-2 w-full rounded-2xl border px-4 py-3"
                />
              </label>
              <label>
                <span className="text-xs font-bold text-slate-600">
                  Payment Frequency
                </span>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="mt-2 w-full rounded-2xl border bg-white px-4 py-3"
                >
                  <option>Daily</option>
                  <option>Weekly</option>
                  <option>Biweekly</option>
                  <option>Monthly</option>
                </select>
              </label>
              <label>
                <span className="text-xs font-bold text-slate-600">
                  Duration
                </span>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="mt-2 w-full rounded-2xl border bg-white px-4 py-3"
                >
                  <option value={140}>140 days</option>
                  <option value={180}>180 days</option>
                  <option value={240}>240 days</option>
                </select>
              </label>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Product Price", "GHS 8,400.00"],
                ["Selected Deposit", money(deposit)],
                ["Remaining Balance", money(balance)],
                [
                  "Installment",
                  `${money(installment)} ${frequency.toLowerCase()}`,
                ],
                ["Number of Installments", String(duration)],
                ["Start Date", "27 August 2026"],
                ["Estimated Completion", completion],
                ["Minimum Deposit", money(minDeposit)],
              ].map(([label, value]) => (
                <InfoTile key={label} label={label} value={value} />
              ))}
            </div>
            <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-900">
              The store will reserve your product while you make payments. You
              can collect or receive the product only after your Layaway balance
              has been fully paid.
            </div>
          </div>
        )}
        {step === 1 && (
          <div>
            <h3 className="text-xl font-bold">
              Customer and Collection Details
            </h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {Object.entries(details).map(([key, value]) => (
                <label
                  key={key}
                  className={
                    key === "address" || key === "location"
                      ? "sm:col-span-2"
                      : ""
                  }
                >
                  <span className="text-xs font-bold capitalize text-slate-600">
                    {key === "location"
                      ? "Collection / delivery location"
                      : key}
                  </span>
                  <input
                    value={value}
                    onChange={(e) =>
                      setDetails({ ...details, [key]: e.target.value })
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                  />
                </label>
              ))}
            </div>
            <h4 className="mt-6 font-bold">Collection Method</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {[
                ["Self Payment", "You make each payment through AdepaPay."],
                [
                  "Collection Agent",
                  "An authorized collection agent may collect your scheduled payments.",
                ],
              ].map(([label, desc]) => (
                <button
                  key={label}
                  onClick={() => setCollection(label)}
                  className={`rounded-2xl border-2 p-4 text-left ${
                    collection === label
                      ? "border-blue-600 bg-blue-50"
                      : "border-slate-200"
                  }`}
                >
                  <div className="font-bold">{label}</div>
                  <div className="mt-1 text-xs text-slate-500">{desc}</div>
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">
              Never give an agent your AdepaPay password or login OTP.
            </div>
          </div>
        )}
        {step === 2 && (
          <div>
            <h3 className="text-xl font-bold">Review Application</h3>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["Product", "Samsung 65-inch QLED TV"],
                ["Store", "CYTECH Gadgets"],
                ["Price", money(price)],
                ["Deposit", money(deposit)],
                ["Balance after deposit", money(balance)],
                ["Installment", money(installment)],
                ["Frequency", frequency],
                ["Installments", String(duration)],
                ["Completion", completion],
                ["Collection Method", collection],
                ["Cancellation Policy", "5% cancellation fee may apply"],
                ["Refund Policy", "Verified payments less approved fee"],
              ].map(([label, value]) => (
                <InfoTile key={label} label={label} value={value} />
              ))}
            </div>
            <div className="mt-5 space-y-3">
              {[
                ["layaway", "I accept the AdepaPay Layaway terms."],
                [
                  "store",
                  "I accept the store cancellation, refund, and reservation terms.",
                ],
                [
                  "holding",
                  "I confirm the product remains with the store until fully paid.",
                ],
              ].map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-start gap-3 rounded-2xl border p-4 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={terms[(key as keyof typeof terms)]}
                    onChange={(e) =>
                      setTerms({ ...terms, [key]: e.target.checked })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="mt-8 flex justify-between">
          <Button
            variant="secondary"
            onClick={() => setStep(Math.max(0, step - 1))}
          >
            Back
          </Button>
          <Button
            onClick={() =>
              step === 2
                ? Object.values(terms).every(Boolean) && setSubmitted(true)
                : setStep(step + 1)
            }
          >
            {step === 2 ? "Submit Application" : "Continue"}
          </Button>
        </div>
      </Card>
    </div>
  )
}

function CustomerLayawayPlansPage({
  onNavigate,
}: {
  onNavigate: (id: NavId) => void
}) {
  const plans = [
    {
      reference: "LAY-2026-004582",
      product: "Samsung 65-inch QLED TV",
      store: "CYTECH Gadgets",
      price: 8400,
      paid: 5200,
      installment: 50,
      frequency: "Daily",
      next: "GHS 50 · Due today",
      status: "Active",
      reservation: "Reserved",
      progress: 61.9,
    },
    {
      reference: "LAY-2026-003841",
      product: "iPhone 15 Pro Max",
      store: "PhoneZone Ghana",
      price: 7600,
      paid: 7600,
      installment: 100,
      frequency: "Weekly",
      next: "Fully paid",
      status: "Fully Paid",
      reservation: "Fully Paid - Awaiting Collection",
      progress: 100,
    },
  ]
  const [selected, setSelected] = useState<typeof plans[number] | null>(null),
    [paying, setPaying] = useState<typeof plans[number] | null>(null),
    [filter, setFilter] = useState("All")
  const visible = plans.filter((p) => filter === "All" || p.status === filter)
  return (
    <div className="space-y-6">
      <SectionHeader
        title="My Payment Plans"
        description="Your Layaway plans stay separate from Hire Purchase and completed purchases."
        actions={
          <Button onClick={() => onNavigate("layaway-plans")}>
            Start New Layaway
          </Button>
        }
      />
      <div className="flex gap-2 overflow-x-auto">
        {["All", "Active", "Fully Paid", "Completed", "Cancelled"].map(
          (value) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`rounded-xl px-4 py-2 text-sm font-bold ${
                filter === value
                  ? "bg-blue-600 text-white"
                  : "border bg-white text-slate-600"
              }`}
            >
              {value}
            </button>
          ),
        )}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        {visible.map((plan) => (
          <Card key={plan.reference} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold">{plan.product}</h3>
                <p className="text-sm text-slate-500">
                  {plan.store} · {plan.reference}
                </p>
              </div>
              <Pill tone={plan.status === "Fully Paid" ? "success" : "info"}>
                {plan.status}
              </Pill>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <InfoTile label="Product Price" value={money(plan.price)} />
              <InfoTile label="Amount Paid" value={money(plan.paid)} />
              <InfoTile
                label="Outstanding"
                value={money(plan.price - plan.paid)}
              />
              <InfoTile label="Next Payment" value={plan.next} />
            </div>
            <div className="mt-5 flex justify-between text-xs font-bold">
              <span>{plan.progress}% Paid</span>
              <span>
                {plan.frequency} · {money(plan.installment)}
              </span>
            </div>
            <div className="mt-2 h-3 rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-600"
                style={{ width: `${plan.progress}%` }}
              />
            </div>
            <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
              Product {plan.reservation} ✓
              <div className="mt-1 font-normal">
                This product remains with the store until payment is complete.
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              {plan.status === "Active" ? (
                <Button onClick={() => setPaying(plan)}>Pay Now</Button>
              ) : (
                <Button onClick={() => setSelected(plan)}>
                  View Collection Details
                </Button>
              )}
              <Button variant="secondary" onClick={() => setSelected(plan)}>
                View Plan
              </Button>
            </div>
          </Card>
        ))}
      </div>
      {selected && (
        <CustomerLayawayDetails
          plan={selected}
          onClose={() => setSelected(null)}
          onPay={() => {
            setSelected(null)
            setPaying(selected)
          }}
        />
      )}
      {paying && (
        <LayawayPaymentModal plan={paying} onClose={() => setPaying(null)} />
      )}
    </div>
  )
}

function CustomerLayawayDetails({
  plan,
  onClose,
  onPay,
}: {
  plan: {
    reference: string
    product: string
    store: string
    price: number
    paid: number
    installment: number
    frequency: string
    next: string
    status: string
    reservation: string
    progress: number
  }
  onClose: () => void
  onPay: () => void
}) {
  const [scheduleFilter, setScheduleFilter] = useState("All"),
    [reschedule, setReschedule] = useState(false),
    [cancel, setCancel] = useState(false)
  const schedule = [
    ["01", "Aug 20", "GHS 50", "GHS 50", "Paid"],
    ["02", "Aug 21", "GHS 50", "GHS 50", "Paid"],
    ["03", "Aug 26", "GHS 50", "GHS 0", "Due Today"],
    ["04", "Aug 27", "GHS 50", "GHS 0", "Upcoming"],
    ["05", "Aug 28", "GHS 50", "GHS 0", "Upcoming"],
  ].filter((row) => scheduleFilter === "All" || row[4] === scheduleFilter)
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4">
      <button className="absolute inset-0" onClick={onClose} />
      <div className="relative max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-[30px] bg-white p-6 shadow-2xl">
        <div className="flex justify-between">
          <div>
            <h2 className="text-2xl font-bold">{plan.product}</h2>
            <p className="text-sm text-slate-500">
              {plan.store} · {plan.reference}
            </p>
          </div>
          <button onClick={onClose} className="rounded-xl border p-3">
            <IconClose />
          </button>
        </div>
        {plan.status === "Fully Paid" && (
          <div className="mt-5 rounded-2xl bg-emerald-50 p-5">
            <h3 className="text-xl font-bold text-emerald-800">
              Congratulations! Your Layaway plan is fully paid.
            </h3>
            <p className="mt-1 text-sm text-emerald-700">
              Your {plan.product} is ready for collection from {plan.store}. The
              plan becomes Completed only after the store releases it.
            </p>
          </div>
        )}
        <Card className="mt-5 p-5">
          <div className="flex justify-between">
            <b>
              {money(plan.paid)} / {money(plan.price)}
            </b>
            <b>{plan.progress}% Paid</b>
          </div>
          <div className="mt-3 h-4 rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-600"
              style={{ width: `${plan.progress}%` }}
            />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              ["Outstanding", money(plan.price - plan.paid)],
              ["Deposit", "GHS 1,400.00"],
              ["Installment", money(plan.installment)],
              ["Frequency", plan.frequency],
              ["Next Payment", plan.next],
              ["Start Date", "Aug 20, 2026"],
              ["Completion", "Jan 13, 2027"],
              ["Payments Made", "104"],
              ["Remaining", "64"],
              ["Reservation", plan.reservation],
            ].map(([l, v]) => (
              <InfoTile key={l} label={l} value={v} />
            ))}
          </div>
        </Card>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Card className="p-5">
            <h3 className="font-bold">Product Reserved ✓</h3>
            <p className="mt-2 text-sm text-slate-500">
              This product has been reserved for your Layaway plan and will
              remain with the store until you complete payment.
            </p>
          </Card>
          <Card className="p-5">
            <h3 className="font-bold">Your Collection Agent</h3>
            <p className="mt-2 text-sm font-semibold">
              Kwame Mensah · AGT-0018
            </p>
            <p className="text-sm text-slate-500">
              +233 24 814 2201 · {plan.store}
            </p>
            <button className="mt-3 text-sm font-bold text-blue-600">
              Contact Agent
            </button>
          </Card>
        </div>
        <div className="mt-6 flex gap-2">
          {["All", "Paid", "Upcoming", "Missed"].map((v) => (
            <button
              key={v}
              onClick={() => setScheduleFilter(v)}
              className={`rounded-xl px-3 py-2 text-xs font-bold ${
                scheduleFilter === v ? "bg-blue-600 text-white" : "border"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <Card className="mt-3 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["Payment #", "Due Date", "Amount", "Paid", "Status"].map(
                    (h) => (
                      <th key={h} className="px-4 py-3">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {schedule.map((row) => (
                  <tr key={row[0]} className="border-t">
                    {row.map((cell, i) => (
                      <td key={i} className="px-4 py-3">
                        {i === 4 ? (
                          <Pill
                            tone={
                              cell === "Paid"
                                ? "success"
                                : cell === "Due Today"
                                  ? "pending"
                                  : "info"
                            }
                          >
                            {cell}
                          </Pill>
                        ) : (
                          cell
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="mt-5 flex flex-wrap gap-3">
          {plan.status === "Active" && <Button onClick={onPay}>Pay Now</Button>}
          <Button variant="secondary" onClick={() => setReschedule(true)}>
            Request Payment Reschedule
          </Button>
          <Button variant="secondary" onClick={() => setCancel(true)}>
            Request Cancellation
          </Button>
        </div>
        {(reschedule || cancel) && (
          <div className="mt-4 rounded-2xl border p-5">
            <h3 className="font-bold">
              {reschedule
                ? "Request Payment Reschedule"
                : "Request Cancellation"}
            </h3>
            <textarea
              rows={3}
              placeholder="Tell the store why you are making this request"
              className="mt-3 w-full rounded-2xl border p-3 text-sm"
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setReschedule(false)
                  setCancel(false)
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setReschedule(false)
                  setCancel(false)
                }}
              >
                Submit Request
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function LayawayPaymentModal({
  plan,
  onClose,
}: {
  plan: {
    reference: string
    product: string
    price: number
    paid: number
    installment: number
  }
  onClose: () => void
}) {
  const balance = plan.price - plan.paid,
    [amount, setAmount] = useState(plan.installment),
    [confirmed, setConfirmed] = useState(false)
  const covered = Math.max(1, Math.floor(amount / plan.installment)),
    newBalance = Math.max(0, balance - amount)
  if (confirmed)
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4">
        <Card className="relative max-w-md p-8 text-center">
          <div className="text-4xl text-emerald-600">✓</div>
          <h3 className="mt-4 text-xl font-bold">
            Payment submitted for verification
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            The balance will update after payment confirmation. Receipt
            RCP-LAY-260826-00482 will then be available.
          </p>
          <div className="mt-5">
            <Button onClick={onClose}>Done</Button>
          </div>
        </Card>
      </div>
    )
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4">
      <button className="absolute inset-0" onClick={onClose} />
      <Card className="relative w-full max-w-lg p-6">
        <div className="flex justify-between">
          <div>
            <h3 className="text-xl font-bold">Pay Layaway</h3>
            <p className="text-sm text-slate-500">
              {plan.reference} · {plan.product}
            </p>
          </div>
          <button onClick={onClose}>
            <IconClose />
          </button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <InfoTile label="Amount Due Today" value={money(plan.installment)} />
          <InfoTile label="Outstanding Balance" value={money(balance)} />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          {[
            plan.installment,
            plan.installment * 2,
            plan.installment * 5,
            balance,
          ].map((value) => (
            <button
              key={value}
              onClick={() => setAmount(value)}
              className={`rounded-xl border px-3 py-3 text-sm font-bold ${
                amount === value
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-slate-200"
              }`}
            >
              {value === balance ? "Pay Full Balance" : `Pay ${money(value)}`}
            </button>
          ))}
        </div>
        <label className="mt-4 block">
          <span className="text-xs font-bold">Custom Amount</span>
          <input
            type="number"
            min={1}
            max={balance}
            value={amount}
            onChange={(e) =>
              setAmount(Math.min(balance, Math.max(1, Number(e.target.value))))
            }
            className="mt-2 w-full rounded-2xl border px-4 py-3"
          />
        </label>
        <div className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
          This payment covers approximately{" "}
          <b>
            {covered} installment{covered !== 1 ? "s" : ""}
          </b>
          . Preview balance: <b>{money(newBalance)}</b>.
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Payment values and allocation will be verified before the plan balance
          is updated.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => setConfirmed(true)}>
            Continue to Payment
          </Button>
        </div>
      </Card>
    </div>
  )
}

function MyPurchasesPage() {
  const purchases = [
    ["MacBook Pro 14” M3", "CYTECH Gadgets", "GHS 4,200.00", "GHS 350.00", 68],
    ["Samsung 65” QLED TV", "Adepa Home", "GHS 1,820.00", "GHS 455.00", 78],
  ]
  return (
    <div className="space-y-6">
      <SectionHeader
        title="My Purchases"
        description="Manage your active and completed hire-purchase agreements."
        actions={<Button>Browse Products</Button>}
      />
      <CustomerPageToolbar placeholder="Search product or purchase reference" />
      <div className="grid gap-5 lg:grid-cols-2">
        {purchases.map(([name, store, balance, next, progress]) => (
          <Card key={String(name)} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold">{name}</h3>
                <p className="text-sm text-slate-500">{store} · Active</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                Current
              </span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <InfoTile label="Outstanding" value={String(balance)} />
              <InfoTile label="Next payment" value={String(next)} />
            </div>
            <div className="mt-5 flex justify-between text-xs font-semibold">
              <span>Payment progress</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-600"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-5 flex gap-3">
              <Button>Pay Now</Button>
              <Button variant="secondary">View Purchase</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function PaymentHistoryPage() {
  const rows = [
    [
      "BPTX-241180",
      "MacBook Pro 14”",
      "MTN Mobile Money",
      "GHS 350.00",
      "Successful",
      "Aug 4, 2026",
    ],
    [
      "BPTX-240944",
      "Samsung QLED TV",
      "Bank Card",
      "GHS 455.00",
      "Successful",
      "Jul 28, 2026",
    ],
    [
      "BPTX-240812",
      "MacBook Pro 14”",
      "Telecel Cash",
      "GHS 350.00",
      "Failed",
      "Jul 10, 2026",
    ],
  ]
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Payment History"
        description="View and track all payments made through AdepaPay."
        actions={
          <>
            <Button variant="secondary">Export History</Button>
            <Button>Make Payment</Button>
          </>
        }
      />
      <CustomerPageToolbar placeholder="Search transaction or purchase reference" />
      <Card className="p-4 sm:p-5">
        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row[0]}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center"
            >
              <div className="flex-1">
                <div className="font-bold">{row[1]}</div>
                <div className="text-xs text-slate-500">
                  {row[0]} · {row[2]} · {row[5]}
                </div>
              </div>
              <div className="font-bold">{row[3]}</div>
              <span
                className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${
                  row[4] === "Successful"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {row[4]}
              </span>
              <button className="text-sm font-bold text-blue-600">View</button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function ReceiptsPage() {
  const receipts = [
    ["BPR-008821", "MacBook Pro installment", "GHS 350.00", "Aug 4, 2026"],
    ["BPR-008650", "Samsung QLED TV installment", "GHS 455.00", "Jul 28, 2026"],
    ["BPR-008204", "MacBook Pro installment", "GHS 350.00", "Jul 4, 2026"],
  ]
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Receipts"
        description="View and download receipts for all successful payments."
        actions={<Button>Download All</Button>}
      />
      <CustomerPageToolbar placeholder="Search receipt or transaction number" />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {receipts.map((row) => (
          <Card key={row[0]} className="p-5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-blue-600">
                ADEPA PAY RECEIPT
              </div>
              <span className="text-xs font-bold text-emerald-700">
                Successful
              </span>
            </div>
            <h3 className="mt-5 font-bold">{row[1]}</h3>
            <div className="mt-1 text-xs text-slate-500">
              {row[0]} · {row[3]}
            </div>
            <div className="my-5 text-2xl font-bold">{row[2]}</div>
            <div className="flex gap-2">
              <Button>View Receipt</Button>
              <Button variant="secondary">Download</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function CustomerNotificationsPage() {
  const [unread, setUnread] = useState(4)
  const notices = [
    [
      "Application approved",
      "Your MacBook Pro application has been approved.",
      "Applications",
      "Today, 10:24 AM",
    ],
    [
      "Installment due soon",
      "Your GHS 350.00 installment is due in three days.",
      "Payments",
      "Today, 8:10 AM",
    ],
    [
      "Payment successful",
      "Your payment of GHS 455.00 was successful.",
      "Payments",
      "Yesterday",
    ],
    [
      "New receipt available",
      "Receipt BPR-008821 is ready to download.",
      "Receipts",
      "August 1",
    ],
  ]
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Notifications"
        description={`${unread} unread notifications`}
        actions={<Button onClick={() => setUnread(0)}>Mark All as Read</Button>}
      />
      <div className="flex gap-2 overflow-x-auto">
        {["All", "Applications", "Payments", "Purchases", "Security"].map(
          (tab, i) => (
            <button
              key={tab}
              className={`rounded-xl px-4 py-2 text-sm font-bold ${
                i === 0
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 bg-white text-slate-600"
              }`}
            >
              {tab}
            </button>
          ),
        )}
      </div>
      <Card className="divide-y divide-slate-100 overflow-hidden">
        {notices.map((notice, i) => (
          <div key={notice[0]} className="flex gap-4 p-5 hover:bg-slate-50">
            <span
              className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${
                i < unread ? "bg-blue-600" : "bg-slate-200"
              }`}
            />
            <div className="flex-1">
              <div className="flex flex-wrap justify-between gap-2">
                <h3 className="font-bold">{notice[0]}</h3>
                <span className="text-xs text-slate-400">{notice[3]}</span>
              </div>
              <p className="mt-1 text-sm text-slate-500">{notice[1]}</p>
              <button className="mt-3 text-xs font-bold text-blue-600">
                View {notice[2]}
              </button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  )
}

function CustomerSettingsPage() {
  const [saved, setSaved] = useState(false)
  const [preferences, setPreferences] = useState({
    paymentReminders: true,
    applicationUpdates: true,
    promotions: false,
    emailReceipts: true,
    biometricLogin: false,
    profileVisibility: false,
  })
  const toggle = (key: keyof typeof preferences) =>
    setPreferences((current) => ({ ...current, [key]: !current[key] }))
  const save = () => {
    setSaved(true)
    window.setTimeout(() => setSaved(false), 3000)
  }
  const groups = [
    {
      title: "Notifications",
      description: "Choose the updates you want to receive.",
      items: [
        [
          "paymentReminders",
          "Payment reminders",
          "Receive alerts before an installment is due",
        ],
        [
          "applicationUpdates",
          "Application updates",
          "Approval, verification, and document status alerts",
        ],
        [
          "promotions",
          "Offers and promotions",
          "Product offers from verified AdepaPay stores",
        ],
      ],
    },
    {
      title: "Receipts and communication",
      description: "Control how important account records reach you.",
      items: [
        [
          "emailReceipts",
          "Email receipts",
          "Send a receipt to your email after every payment",
        ],
      ],
    },
    {
      title: "Privacy and access",
      description: "Manage account access and data visibility.",
      items: [
        [
          "biometricLogin",
          "Biometric login",
          "Use fingerprint or face recognition on supported devices",
        ],
        [
          "profileVisibility",
          "Share profile with stores",
          "Allow approved stores to view your verified customer profile",
        ],
      ],
    },
  ] as const
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Settings"
        description="Manage your account security, notifications, and privacy preferences."
        actions={<Button onClick={save}>Save Changes</Button>}
      />
      {saved && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
          Your settings have been saved successfully.
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {groups.map((group) => (
            <Card key={group.title} className="p-5 sm:p-6">
              <h3 className="text-lg font-bold">{group.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{group.description}</p>
              <div className="mt-5 divide-y divide-slate-100">
                {group.items.map(([key, label, description]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-5 py-4 first:pt-0 last:pb-0"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {label}
                      </div>
                      <div className="mt-1 text-xs leading-5 text-slate-500">
                        {description}
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={preferences[key]}
                      onClick={() => toggle(key)}
                      className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                        preferences[key] ? "bg-blue-600" : "bg-slate-200"
                      }`}
                    >
                      <span
                        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
                          preferences[key] ? "left-6" : "left-1"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <h3 className="text-lg font-bold">Account security</h3>
            <div className="mt-5 space-y-3">
              <button className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold hover:border-blue-200 hover:bg-blue-50">
                Change password
              </button>
              <button className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold hover:border-blue-200 hover:bg-blue-50">
                Manage two-factor authentication
              </button>
              <button className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold hover:border-blue-200 hover:bg-blue-50">
                View active sessions
              </button>
            </div>
          </Card>
          <Card className="p-5 sm:p-6">
            <h3 className="text-lg font-bold">Payment preferences</h3>
            <p className="mt-1 text-sm text-slate-500">
              Default payment method
            </p>
            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <div className="text-sm font-bold text-blue-900">
                MTN Mobile Money
              </div>
              <div className="mt-1 text-xs text-blue-700">+233 24 ••• •182</div>
            </div>
            <button className="mt-4 text-sm font-bold text-blue-600">
              Manage payment methods →
            </button>
          </Card>
          <Card className="border-red-100 p-5 sm:p-6">
            <h3 className="text-lg font-bold text-red-700">Close account</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Request account closure after all active purchases and balances
              are settled.
            </p>
            <button className="mt-4 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50">
              Request account closure
            </button>
          </Card>
        </div>
      </div>
    </div>
  )
}

type ProfileField = { label: string key: string restricted?: boolean }

const PROFILE_SECTIONS: Array<{ title: string fields: ProfileField[] }> = [
  {
    title: "Personal Information",
    fields: [
      { label: "First name", key: "firstName" },
      { label: "Middle name", key: "middleName" },
      { label: "Last name", key: "lastName" },
      { label: "Date of birth", key: "dob", restricted: true },
      { label: "Gender", key: "gender" },
      { label: "Nationality", key: "nationality" },
      { label: "Ghana Card number", key: "ghanaCard", restricted: true },
    ],
  },
  {
    title: "Contact Information",
    fields: [
      { label: "Phone number", key: "phone" },
      { label: "Alternative phone", key: "altPhone" },
      { label: "Email address", key: "email" },
    ],
  },
  {
    title: "Residential Address",
    fields: [
      { label: "Region", key: "region" },
      { label: "City", key: "city" },
      { label: "Town", key: "town" },
      { label: "Street", key: "street" },
      { label: "GhanaPost GPS address", key: "gps" },
      { label: "Nearest landmark", key: "nearestLandmark" },
    ],
  },
  {
    title: "Employment Information",
    fields: [
      { label: "Employment status", key: "employment" },
      { label: "Employer or business", key: "employer" },
      { label: "Occupation", key: "occupation" },
      { label: "Monthly income", key: "income" },
      { label: "Work address", key: "workAddress" },
      { label: "Employer GhanaPost GPS address", key: "employerGps" },
      { label: "Employer contact number", key: "employerPhone" },
      { label: "Employer email address", key: "employerEmail" },
    ],
  },
  {
    title: "Emergency Contact",
    fields: [
      { label: "Name", key: "emergencyName" },
      { label: "Relationship", key: "relationship" },
      { label: "Phone number", key: "emergencyPhone" },
    ],
  },
]

const DEFAULT_CUSTOMER_PHOTO =
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160&h=160&fit=crop&auto=format"

const INITIAL_PROFILE: Record<string, string> = {
  firstName: "Emmanuel",
  middleName: "Kwame",
  lastName: "Agyeman",
  dob: "12 June 1992",
  gender: "Male",
  nationality: "Ghanaian",
  ghanaCard: "GHA-123456789-0",
  phone: "+233 24 555 0182",
  altPhone: "+233 20 404 7712",
  email: "emmanuel.customer@adepapay.com",
  region: "Greater Accra",
  city: "Accra",
  town: "East Legon",
  street: "Lagos Avenue",
  gps: "GA-492-1847",
  nearestLandmark: "East Legon Police Station",
  employment: "Employed",
  employer: "Agyeman Digital Services",
  occupation: "Product Designer",
  income: "GHS 8,500.00",
  workAddress: "Airport City, Accra",
  employerGps: "GA-183-8164",
  employerPhone: "+233 30 255 4412",
  employerEmail: "hr@agyemandigital.com",
  emergencyName: "Akosua Agyeman",
  relationship: "Sister",
  emergencyPhone: "+233 55 229 1830",
}

function CustomerProfilePage({
  photo,
  onPhotoChange,
}: {
  photo: string | null
  onPhotoChange: (photo: string | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [profile, setProfile] = useState(INITIAL_PROFILE)
  const [draft, setDraft] = useState(INITIAL_PROFILE)
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const beginEdit = () => {
    setDraft(profile)
    setErrors({})
    setSaved(false)
    setEditing(true)
  }
  const cancelEdit = () => {
    setDraft(profile)
    setErrors({})
    setEditing(false)
  }
  const saveProfile = () => {
    const required = [
      "firstName",
      "lastName",
      "phone",
      "email",
      "region",
      "city",
      "gps",
      "nearestLandmark",
    ]
    const nextErrors = Object.fromEntries(
      required
        .filter((key) => !draft[key]?.trim())
        .map((key) => [key, "This field is required"]),
    )
    if (!/^\S+@\S+\.\S+$/.test(draft.email))
      nextErrors.email = "Enter a valid email address"
    if (draft.gps && !/^[A-Z]{2}-\d{3}-\d{4}$/i.test(draft.gps.trim()))
      nextErrors.gps = "Use the format GA-123-4567"
    if (
      draft.employerGps &&
      !/^[A-Z]{2}-\d{3}-\d{4}$/i.test(draft.employerGps.trim())
    )
      nextErrors.employerGps = "Use the format GA-123-4567"
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setProfile(draft)
    setEditing(false)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 3500)
  }
  const uploadPhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => onPhotoChange(String(reader.result))
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="My Profile"
        description="Manage your personal and verification information."
        actions={
          editing ? (
            <>
              <Button variant="secondary" onClick={cancelEdit}>
                Cancel
              </Button>
              <Button onClick={saveProfile}>Save Changes</Button>
            </>
          ) : (
            <Button onClick={beginEdit}>Edit Profile</Button>
          )
        }
      />
      {saved && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
          Your profile was updated successfully.
        </div>
      )}

      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-3xl bg-blue-100">
            {photo ? (
              <img
                src={photo}
                alt="Emmanuel Agyeman"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-blue-700">
                EA
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-2xl font-bold">Emmanuel Agyeman</h3>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                Active · Verified
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Customer ID BPC-001842 · Member since March 18, 2026
            </p>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
              <span>{profile.phone}</span>
              <span>{profile.email}</span>
            </div>
          </div>
          <div className="w-full md:w-56">
            <div className="flex justify-between text-sm font-semibold">
              <span>Profile completion</span>
              <span className="text-blue-600">92%</span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-[92%] rounded-full bg-blue-600" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <label className="cursor-pointer rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                Upload image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={uploadPhoto}
                />
              </label>
              {photo && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="rounded-xl px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-bold">Identity Verification</h3>
            <p className="mt-1 text-sm text-slate-500">
              Your identity documents are protected and reviewed securely.
            </p>
          </div>
          <Button variant="secondary">Update Document</Button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {["Ghana Card", "Passport photograph", "Proof of address"].map(
            (document) => (
              <div
                key={document}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="font-semibold">{document}</div>
                <div className="mt-2 text-xs font-bold text-emerald-700">
                  ✓ Verified
                </div>
              </div>
            ),
          )}
        </div>
        <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
          Date of birth and Ghana Card number are restricted after verification.
          Contact support to request a correction.
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        {PROFILE_SECTIONS.map((section) => (
          <Card key={section.title} className="p-5 sm:p-6">
            <h3 className="text-lg font-bold">{section.title}</h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {section.fields.map((field) => (
                <label
                  key={field.key}
                  className={
                    field.key === "workAddress" ||
                    field.key === "employerGps" ||
                    field.key === "street"
                      ? "sm:col-span-2"
                      : ""
                  }
                >
                  <span className="text-xs font-semibold text-slate-500">
                    {field.label}
                  </span>
                  {editing && !field.restricted ? (
                    field.key === "region" ? (
                      <select
                        value={draft.region}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            region: event.target.value,
                            city: getGhanaRegionalCapital(event.target.value),
                          })
                        }
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                      >
                        {GHANA_REGIONS.map((region) => (
                          <option key={region}>{region}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={draft[field.key] ?? ""}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            [field.key]:
                              field.key === "employerGps" || field.key === "gps"
                                ? event.target.value.toUpperCase()
                                : event.target.value,
                          })
                        }
                        placeholder={
                          field.key === "employerGps" || field.key === "gps"
                            ? "GA-123-4567"
                            : undefined
                        }
                        className={`mt-1.5 w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 ${
                          errors[field.key]
                            ? "border-red-400"
                            : "border-slate-200"
                        }`}
                      />
                    )
                  ) : (
                    <div className="mt-1.5 min-h-10 rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800">
                      {profile[field.key] || "Not provided"}
                      {field.restricted && editing ? "  🔒" : ""}
                    </div>
                  )}
                  {errors[field.key] && (
                    <span className="mt-1 block text-xs text-red-600">
                      {errors[field.key]}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold">Delete profile image?</h3>
            <p className="mt-2 text-sm text-slate-500">
              Your initials will be shown until you upload a new photograph.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
              <button
                onClick={() => {
                  onPhotoChange(null)
                  setConfirmDelete(false)
                }}
                className="rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white"
              >
                Delete image
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <Card className="p-10 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-purple-50 text-purple-600">
        <IconLock />
      </div>
      <h3 className="mt-4 text-xl font-bold text-slate-900">
        {title} is not in this preview yet
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        This admin portal preview currently focuses on Dashboard, Store
        Approvals, and Stores Management.
      </p>
    </Card>
  )
}

function FilterBox({ label, value }: { label: string value: string }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-slate-700">{value}</div>
    </div>
  )
}

function InfoTile({ label, value }: { label: string value: string }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-slate-800">{value}</div>
    </div>
  )
}

function DrawerHeader({
  title,
  subtitle,
  onClose,
}: {
  title: string
  subtitle: string
  onClose: () => void
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <div className="text-xl font-bold text-slate-900">{title}</div>
        <div className="mt-1 text-sm text-slate-500">{subtitle}</div>
      </div>
      <IconButton onClick={onClose}>
        <IconClose />
      </IconButton>
    </div>
  )
}

function DrawerSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-lg font-bold text-slate-900">{title}</div>
      <div className="mt-4">{children}</div>
    </div>
  )
}

function GridInfo({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map(([label, value]) => (
        <InfoTile key={label} label={label} value={value} />
      ))}
    </div>
  )
}

function DocumentList({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="space-y-3">
      {items.map(([name, status]) => (
        <div
          key={name}
          className="flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <div className="text-sm font-semibold text-slate-900">{name}</div>
            <div className="mt-1 text-sm text-slate-500">
              Document verification status
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Pill
              tone={
                status === "Verified"
                  ? "success"
                  : status === "Pending Review"
                    ? "pending"
                    : "danger"
              }
            >
              {status}
            </Pill>
            <Button variant="secondary">Preview</Button>
            <Button variant="secondary">Download</Button>
          </div>
        </div>
      ))}
    </div>
  )
}

function TextPanel({ title, body }: { title: string body: string }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </div>
      <div className="mt-2 text-sm leading-6 text-slate-700">{body}</div>
    </div>
  )
}

function MiniMetric({
  title,
  value,
  detail,
  tone,
}: {
  title: string
  value: string
  detail: string
  tone: Tone
}) {
  return (
    <Card className="p-4">
      <div
        className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClass(tone)}`}
      >
        {title}
      </div>
      <div className="mt-3 text-2xl font-bold text-slate-900">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{detail}</div>
    </Card>
  )
}

function ServiceRow({
  label,
  status,
  tone,
}: {
  label: string
  status: string
  tone: Tone
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="text-sm font-medium text-slate-700">{label}</div>
      <Pill tone={tone}>{status}</Pill>
    </div>
  )
}

function Timeline({
  items,
}: {
  items: Array<{ title: string body: string date: string }>
}) {
  return (
    <div className="space-y-5">
      {items.map((item) => (
        <div key={item.title + item.date} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="h-3 w-3 rounded-full bg-purple-500" />
            <div className="mt-2 min-h-10 w-px flex-1 bg-slate-200" />
          </div>
          <div className="pb-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {item.date}
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {item.title}
            </div>
            <div className="mt-1 text-sm text-slate-500">{item.body}</div>
          </div>
        </div>
      ))}
    </div>
  )
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

function StateButton({
  active,
  onClick,
  children,
}: {
  active?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl px-3 py-2 text-xs font-semibold transition ${
        active
          ? "bg-blue-600 text-white"
          : "border border-slate-200 text-slate-600 hover:bg-slate-50"
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
}: {
  children: ReactNode
  onClick?: () => void
  className?: string
  dark?: boolean
}) {
  return (
    <button
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

function Pill({ tone, children }: { tone: Tone children: ReactNode }) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${toneClass(tone)}`}
    >
      {children}
    </span>
  )
}

function ActionLink({
  children,
  onClick,
}: {
  children: ReactNode
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
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

function toneClass(tone: Tone) {
  if (tone === "success")
    return "border-emerald-100 bg-emerald-50 text-emerald-700"
  if (tone === "pending") return "border-amber-100 bg-amber-50 text-amber-700"
  if (tone === "danger") return "border-red-100 bg-red-50 text-red-700"
  if (tone === "admin") return "border-purple-100 bg-purple-50 text-purple-700"
  return "border-blue-100 bg-blue-50 text-blue-700"
}

function trendClass(tone: Tone) {
  if (tone === "danger") return "text-red-600"
  if (tone === "pending") return "text-amber-600"
  if (tone === "admin") return "text-purple-600"
  if (tone === "success") return "text-emerald-600"
  return "text-blue-600"
}

function alertClasses(tone: string) {
  if (tone === "danger") return "border-red-200 bg-red-50 text-red-700"
  if (tone === "pending") return "border-amber-200 bg-amber-50 text-amber-700"
  if (tone === "admin") return "border-purple-200 bg-purple-50 text-purple-700"
  return "border-blue-200 bg-blue-50 text-blue-700"
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

function IconBridge() {
  return (
    <Svg className="h-6 w-6 text-white">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 9 12 4l8 5M5 10v6m4-4v4m6-4v4m4-6v6M3 20h18"
      />
    </Svg>
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
function IconSearch() {
  return (
    <Svg>
      <circle cx="11" cy="11" r="6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m20 20-4.2-4.2" />
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
function IconCheckSmall() {
  return (
    <Svg className="h-3.5 w-3.5">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m5 9 2.5 2.5L13 6"
      />
    </Svg>
  )
}

const AGREEMENT_DETAILS = {
  "AGR-2026-004582": {
    store: {
      name: "CYTECH Gadgets",
      logo: "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=120&h=120&fit=crop&auto=format",
      address: "Oxford Street, Osu, Accra, Ghana",
      phone: "+233 24 555 0190",
      email: "hello@cytechgadgets.com",
    },
    customer: {
      fullName: "Emmanuel Agyeman",
      photo: DEFAULT_CUSTOMER_PHOTO,
      phone: "+233 24 555 0182",
      email: "emmanuel.customer@adepapay.com",
      ghanaCard: "GHA-123456789-0",
      address: "House 14, North Legon, Accra",
      digitalAddress: "GA-412-7785",
      nearestLandmark: "North Legon Police Station",
    },
    employment: {
      status: "Employed",
      employer: "Agyeman Digital Services",
      occupation: "Product Designer",
      income: "GHS 8,500.00",
      workAddress: "Airport City, Accra",
      employerGps: "GA-183-8164",
      employerPhone: "+233 30 255 4412",
      employerEmail: "hr@agyemandigital.com",
    },
    guarantors: [
      {
        fullName: "Mavis Boateng",
        relationship: "Sister",
        phone: "+233 20 441 8210",
        occupation: "Teacher",
        address: "Kokomlemle, Accra",
        digitalAddress: "GA-183-8164",
        ghanaCard: "GHA-987654321-1",
      },
      {
        fullName: "Daniel Mensah",
        relationship: "Supervisor",
        phone: "+233 55 731 9204",
        occupation: "Finance Manager",
        address: "Adenta Housing Down, Accra",
        digitalAddress: "GA-092-4701",
        ghanaCard: "GHA-456789123-4",
      },
    ],
  },
} satisfies Record<string, {
  store: {
    name: string
    logo: string
    address: string
    phone: string
    email: string
  }
  customer: {
    fullName: string
    photo: string
    phone: string
    email: string
    ghanaCard: string
    address: string
    digitalAddress: string
    nearestLandmark: string
  }
  employment: {
    status: string
    employer: string
    occupation: string
    income: string
    workAddress: string
    employerGps: string
    employerPhone: string
    employerEmail: string
  }
  guarantors: Array<{
    fullName: string
    relationship: string
    phone: string
    occupation: string
    address: string
    digitalAddress: string
    ghanaCard: string
  }>
}>

function EnhancedPurchaseAgreementViewer({
  agreement,
  customerMode,
  customerPhoto,
  onClose,
  onAccept,
}: {
  agreement: PurchaseAgreement
  customerMode?: boolean
  customerPhoto?: string | null
  onClose: () => void
  onAccept?: () => void
}) {
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [confirmedIdentity, setConfirmedIdentity] = useState(false)
  const [signature, setSignature] = useState("")
  const canAccept =
    acceptedTerms && confirmedIdentity && signature.trim().length >= 3
  const details = AGREEMENT_DETAILS[agreement.reference] ?? {
    store: {
      name: agreement.store,
      logo: "/images/adepa_pay_logo.png",
      address: "Address not provided",
      phone: "Phone not provided",
      email: "Email not provided",
    },
    customer: {
      fullName: agreement.customer,
      photo: DEFAULT_CUSTOMER_PHOTO,
      phone: "Phone not provided",
      email: "Email not provided",
      ghanaCard: "Not provided",
      address: "Address not provided",
      digitalAddress: "Not provided",
      nearestLandmark: "Not provided",
    },
    employment: {
      status: "Not provided",
      employer: "Not provided",
      occupation: "Not provided",
      income: "Not provided",
      workAddress: "Not provided",
      employerGps: "Not provided",
      employerPhone: "Not provided",
      employerEmail: "Not provided",
    },
    guarantors: [],
  }
  let savedCustomerPhoto = ""
  try {
    savedCustomerPhoto = localStorage.getItem(CUSTOMER_PHOTO_STORAGE_KEY) || ""
  } catch {
    savedCustomerPhoto = ""
  }
  const displayedCustomerPhoto =
    customerPhoto || savedCustomerPhoto || details.customer.photo
  const customerInitials = details.customer.fullName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
  const clauses = [
    "The customer receives the product after the required deposit has cleared.",
    `The financed balance will be repaid in ${agreement.duration} installments of ${agreement.monthly}.`,
    "Payments must be made on or before each due date through an approved AdepaPay payment channel.",
    "Ownership transfers to the customer only after all required payments are completed.",
    "Late or missed payments may lead to reminders, account restrictions, recovery action, or other remedies stated in the agreement.",
    "The product warranty, returns, and after-sales support remain subject to the store and manufacturer policies.",
  ]

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
      <button className="absolute inset-0" onClick={onClose} />
      <div className="relative max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-[30px] bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-blue-600">
              AdepaPay Purchase Agreement
            </div>
            <h3 className="mt-1 text-xl font-bold">{agreement.reference}</h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border"
          >
            <IconClose />
          </button>
        </div>
        <div className="p-6 sm:p-8">
          <div className="rounded-[24px] bg-slate-950 p-6 text-white">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="grid flex-1 gap-4 sm:grid-cols-3">
                <div className="flex items-center gap-3">
                  {customerPhotoFailed ? (
                    <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/20 bg-blue-600 text-sm font-black text-white">
                      {customerInitials}
                    </span>
                  ) : (
                    <img
                      src={displayedCustomerPhoto}
                      alt={`${details.customer.fullName} profile`}
                      onError={() => setCustomerPhotoFailed(true)}
                      className="h-12 w-12 rounded-full border-2 border-white/20 object-cover"
                    />
                  )}
                  <div>
                    <div className="text-xs text-slate-400">Customer</div>
                    <div className="mt-1 font-bold">{agreement.customer}</div>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Store</div>
                  <div className="mt-1 font-bold">{agreement.store}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Application</div>
                  <div className="mt-1 font-bold">{agreement.application}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <img
                  src={details.store.logo}
                  alt={`${details.store.name} logo`}
                  className="h-14 w-14 rounded-2xl border border-white/10 bg-white object-cover p-1"
                />
                <div>
                  <div className="text-sm font-bold">{details.store.name}</div>
                  <div className="text-xs text-slate-300">
                    {details.store.phone}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Product", agreement.product],
              ["Cash price", agreement.cashPrice],
              ["Deposit", agreement.deposit],
              ["Amount financed", agreement.financed],
              ["Monthly installment", agreement.monthly],
              ["Duration", agreement.duration],
              ["Total payable", agreement.totalPayable],
              ["First payment", agreement.firstPayment],
            ].map(([label, value]) => (
              <InfoTile key={label} label={label} value={value} />
            ))}
          </div>
          <div className="mt-7 grid gap-4 lg:grid-cols-2">
            <Card className="order-1 border border-slate-200 p-5 shadow-none">
              <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
                {customerPhotoFailed ? (
                  <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-xl font-black text-blue-700">
                    {customerInitials}
                  </span>
                ) : (
                  <img
                    src={displayedCustomerPhoto}
                    alt={`${details.customer.fullName} profile`}
                    onError={() => setCustomerPhotoFailed(true)}
                    className="h-20 w-20 shrink-0 rounded-2xl border border-slate-200 object-cover"
                  />
                )}
                <div>
                  <h4 className="text-lg font-bold text-slate-950">
                    Customer details
                  </h4>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    {details.customer.fullName}
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">
                    Profile photograph attached
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  ["Full name", details.customer.fullName],
                  ["Phone number", details.customer.phone],
                  ["Email address", details.customer.email],
                  ["Ghana Card number", details.customer.ghanaCard],
                  ["Residential address", details.customer.address],
                  ["GhanaPost GPS address", details.customer.digitalAddress],
                  ["Nearest landmark", details.customer.nearestLandmark],
                ].map(([label, value]) => (
                  <InfoTile key={label} label={label} value={value} />
                ))}
              </div>
            </Card>
            <Card className="order-2 border border-slate-200 p-5 shadow-none">
              <h4 className="text-lg font-bold text-slate-950">
                Store details
              </h4>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  ["Store name", details.store.name],
                  ["Phone number", details.store.phone],
                  ["Email address", details.store.email],
                  ["Business address", details.store.address],
                ].map(([label, value]) => (
                  <InfoTile key={label} label={label} value={value} />
                ))}
              </div>
            </Card>
          </div>
          <Card className="mt-7 border border-slate-200 p-5 shadow-none">
            <h4 className="text-lg font-bold text-slate-950">
              Employment information
            </h4>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Employment status", details.employment.status],
                ["Employer or business", details.employment.employer],
                ["Occupation", details.employment.occupation],
                ["Monthly income", details.employment.income],
                ["Work address", details.employment.workAddress],
                [
                  "Employer GhanaPost GPS address",
                  details.employment.employerGps,
                ],
                ["Employer phone number", details.employment.employerPhone],
                ["Employer email address", details.employment.employerEmail],
              ].map(([label, value]) => (
                <InfoTile key={label} label={label} value={value} />
              ))}
            </div>
          </Card>
          <div className="mt-7">
            <h4 className="text-lg font-bold">Guarantor details</h4>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {details.guarantors.map((guarantor, index) => (
                <Card
                  key={`${guarantor.fullName}-${index}`}
                  className="border border-slate-200 p-5 shadow-none"
                >
                  <div className="flex items-center justify-between">
                    <h5 className="font-bold text-slate-950">
                      Guarantor {index + 1}
                    </h5>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700">
                      {guarantor.relationship}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Full name", guarantor.fullName],
                      ["Phone number", guarantor.phone],
                      ["Occupation", guarantor.occupation],
                      ["Ghana Card", guarantor.ghanaCard],
                      ["Residential address", guarantor.address],
                      ["GhanaPost GPS address", guarantor.digitalAddress],
                    ].map(([label, value]) => (
                      <InfoTile key={label} label={label} value={value} />
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </div>
          <div className="mt-7">
            <h4 className="text-lg font-bold">Terms and conditions</h4>
            <div className="mt-4 space-y-3">
              {clauses.map((clause, index) => (
                <div
                  key={clause}
                  className="flex gap-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600"
                >
                  <span className="font-bold text-blue-600">{index + 1}.</span>
                  <span>{clause}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <InfoTile label="Issued by" value={agreement.issuer} />
            <InfoTile label="Issue date" value={agreement.issuedDate} />
          </div>
          {customerMode && agreement.status !== "Accepted" && (
            <div className="mt-7 rounded-[24px] border border-blue-200 bg-blue-50/50 p-5">
              <h4 className="font-bold">Electronic acceptance</h4>
              <p className="mt-1 text-sm text-slate-500">
                Confirm that you have reviewed and understood this agreement.
              </p>
              <label className="mt-4 flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(event) => setAcceptedTerms(event.target.checked)}
                  className="mt-1 accent-blue-600"
                />
                <span>
                  I have read and agree to all purchase, repayment, ownership,
                  and recovery terms above.
                </span>
              </label>
              <label className="mt-3 flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={confirmedIdentity}
                  onChange={(event) =>
                    setConfirmedIdentity(event.target.checked)
                  }
                  className="mt-1 accent-blue-600"
                />
                <span>
                  I confirm that I am {details.customer.fullName} and authorize
                  AdepaPay to record this electronic acceptance.
                </span>
              </label>
              <label className="mt-5 block">
                <span className="text-xs font-bold text-slate-600">
                  Type your full name as signature *
                </span>
                <input
                  value={signature}
                  onChange={(event) => setSignature(event.target.value)}
                  placeholder={details.customer.fullName}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
                />
              </label>
            </div>
          )}
          {agreement.status === "Accepted" && (
            <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-bold text-emerald-700">
              ✓ Electronically accepted by {agreement.customer}. Agreement
              locked and audit record created.
            </div>
          )}
          <div className="mt-7 flex flex-wrap justify-end gap-3">
            <Button variant="secondary">Download PDF</Button>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            {customerMode && agreement.status !== "Accepted" && (
              <button
                disabled={!canAccept}
                onClick={onAccept}
                className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Agree & Sign
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
