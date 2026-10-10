import FeaturedListings from './pages/FeaturedListings'
import PublicInformation from './pages/PublicInformation'
import { authRequest, AuthError, type AuthUser } from './lib/auth'
import { useState, useEffect, useCallback } from "react"
import BrowseStores from "./pages/BrowseStores"
import StoreDetails from "./pages/StoreDetails"
import BrowseProducts from "./pages/BrowseProducts"
import Register from "./pages/Register"
import Login from "./pages/Login"
import CustomerPortal from "./pages/CustomerPortal"
import StoreBilling from "./pages/StoreBilling"
import StoreRegistration from "./pages/StoreRegistration"
import PublicNavbar from "./components/PublicNavbar"
import Services from "./pages/ServicesRedesign"
import FieldAgentPortal from "./pages/AgentAccount"

// ─── Types ────────────────────────────────────────────────────────────────────
const FAQS = [
  {q:"How does hire purchase work?",a:"Choose an eligible product, review its terms and apply. The store reviews your request. After approval and the required deposit is confirmed, the store can arrange handover while the remaining payments follow the agreed plan."},
  {q:"How is layaway different?",a:"Layaway requires full payment before product handover. Deposits, durations and available payment frequencies are set for each product."},
  {q:"How much deposit is required?",a:"Check the product application form. It displays the current minimum deposit and terms; there is no single deposit that applies to every listing."},
  {q:"Can I complete payment early?",a:"Contact the store and check your accepted agreement. Do not assume early settlement changes the price or waives fees."},
  {q:"How long does approval take?",a:"The receiving store reviews your application. Check My Applications for decisions and activity. Approval times vary; automatic SMS or email updates are not currently provided."},
  {q:"How are featured ratings calculated?",a:"Customers can rate their store and product after a completed purchase. Featured listings rank by average rating and then number of ratings. Unrated listings display Not rated yet."},
]

function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal")
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            ;(e.target as HTMLElement).classList.add("visible")
          }
        })
      },
      { threshold: 0.12 },
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  })
}

function VerifiedBadge({ small }: { small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 font-semibold rounded-full ${
        small ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1"
      }`}
    >
      <svg
        className={small ? "w-2.5 h-2.5" : "w-3 h-3"}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
      Verified
    </span>
  )
}

function FAQItem({ q, a, idx }: { q: string; a: string; idx: number }) {
  const [open, setOpen] = useState(idx === 0)
  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="font-semibold text-gray-900 text-sm pr-4">{q}</span>
        <span
          className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-transform"
          style={{
            background: "#EAF2FF",
            transform: open ? "rotate(45deg)" : "rotate(0deg)",
          }}
        >
          <svg
            className="w-3.5 h-3.5"
            style={{ color: "#0B5FFF" }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </span>
      </button>
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: open ? "240px" : "0px", opacity: open ? 1 : 0 }}
      >
        <p className="px-6 pb-5 text-sm text-gray-500 leading-relaxed">{a}</p>
      </div>
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const Icon = {
  Store: () => (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="#0B5FFF"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"
      />
      <polyline
        strokeLinecap="round"
        strokeLinejoin="round"
        points="9 22 9 12 15 12 15 22"
      />
    </svg>
  ),
  Package: () => (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="#0B5FFF"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"
      />
    </svg>
  ),
  Users: () => (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="#0B5FFF"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"
      />
      <circle
        cx="9"
        cy="7"
        r="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
      />
    </svg>
  ),
  CreditCard: () => (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="#0B5FFF"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <rect
        x="1"
        y="4"
        width="22"
        height="16"
        rx="2"
        ry="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="1"
        y1="10"
        x2="23"
        y2="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Clipboard: () => (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5h6m-7-2h8a2 2 0 012 2v16H6V5a2 2 0 012-2zm1 7h6m-6 4h6m-6 4h4"
      />
    </svg>
  ),
  Lock: () => (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 018 0v3" />
    </svg>
  ),
  Bolt: () => (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"
      />
    </svg>
  ),
  Calendar: () => (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  ),
  Shield: () => (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
      />
    </svg>
  ),
  Search: () => (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <circle cx="11" cy="11" r="8" strokeLinecap="round" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-4.35-4.35"
      />
    </svg>
  ),
  Menu: () => (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round" />
      <line x1="3" y1="6" x2="21" y2="6" strokeLinecap="round" />
      <line x1="3" y1="18" x2="21" y2="18" strokeLinecap="round" />
    </svg>
  ),
  X: () => (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" />
      <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" />
    </svg>
  ),
  ArrowUp: () => (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <polyline
        strokeLinecap="round"
        strokeLinejoin="round"
        points="18 15 12 9 6 15"
      />
    </svg>
  ),
  Chat: () => (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  ),
  Check: () => (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      viewBox="0 0 24 24"
    >
      <polyline
        strokeLinecap="round"
        strokeLinejoin="round"
        points="20 6 9 17 4 12"
      />
    </svg>
  ),
  ArrowRight: () => (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
      <polyline
        strokeLinecap="round"
        strokeLinejoin="round"
        points="12 5 19 12 12 19"
      />
    </svg>
  ),
}

// ─── Hero Illustration ────────────────────────────────────────────────────────
function HeroIllustration() {
  return (
    <img
      src="/images/index_phone_frame.png"
      alt="AdepaPay app displayed on a phone"
      className="mx-auto h-auto w-full max-w-[560px] object-contain"
    />
  )

  /* Legacy illustration retained below temporarily for reference. */
  return (
    <div className="relative w-full h-full min-h-[480px] flex items-center justify-center select-none">
      {/* Background blob */}
      <div className="absolute inset-0 overflow-hidden rounded-3xl">
        <div
          className="absolute -top-16 -right-16 w-80 h-80 rounded-full opacity-10"
          style={{
            background: "radial-gradient(circle, #0B5FFF 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute -bottom-8 -left-8 w-60 h-60 rounded-full opacity-8"
          style={{
            background: "radial-gradient(circle, #D4A017 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Main phone mockup */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="relative">
          {/* Phone */}
          <div
            className="w-[220px] rounded-[32px] shadow-2xl overflow-hidden border-[6px] border-white"
            style={{ background: "#101828" }}
          >
            {/* Phone top bar */}
            <div
              className="h-7 flex items-center justify-center"
              style={{ background: "#101828" }}
            >
              <div className="w-20 h-4 rounded-full bg-black" />
            </div>
            {/* Phone screen */}
            <div className="bg-white p-3 min-h-[320px]">
              {/* App header */}
              <div className="flex items-center justify-between mb-3">
                <span
                  className="text-xs font-bold"
                  style={{ color: "#0B5FFF" }}
                >
                  AdepaPay
                </span>
                <div className="w-6 h-6 rounded-full overflow-hidden bg-blue-100">
                  <img
                    src="https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=24&h=24&fit=crop&auto=format"
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              {/* Balance card */}
              <div
                className="rounded-xl p-3 mb-3 text-white text-xs"
                style={{
                  background:
                    "linear-gradient(135deg, #0B5FFF 0%, #1E3A8A 100%)",
                }}
              >
                <div className="opacity-70 mb-1">Hire Purchase Balance</div>
                <div className="text-lg font-bold">GHS 450,000.00</div>
                <div className="flex justify-between mt-2 opacity-80">
                  <span>Next: GHS 30,000.00</span>
                  <span>Apr 15</span>
                </div>
              </div>
              {/* Product row */}
              <div className="flex gap-2 mb-3">
                {[
                  {
                    img: "https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=60&h=60&fit=crop&auto=format",
                    name: "Samsung TV",
                  },
                  {
                    img: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=60&h=60&fit=crop&auto=format",
                    name: "MacBook",
                  },
                ].map((p) => (
                  <div
                    key={p.name}
                    className="flex-1 rounded-xl overflow-hidden bg-gray-50"
                  >
                    <img
                      src={p.img}
                      alt={p.name}
                      className="w-full h-14 object-cover"
                    />
                    <div className="p-1.5 text-[9px] font-medium text-gray-700 truncate">
                      {p.name}
                    </div>
                  </div>
                ))}
              </div>
              {/* Pay now button */}
              <button
                className="w-full py-2 rounded-xl text-xs font-semibold text-white"
                style={{ background: "#0B5FFF" }}
              >
                Make Payment
              </button>
            </div>
            {/* Phone bottom bar */}
            <div
              className="h-6 flex items-center justify-center"
              style={{ background: "#101828" }}
            >
              <div className="w-24 h-1 rounded-full bg-white/30" />
            </div>
          </div>

          {/* Floating cards */}
          <div
            className="absolute -left-24 top-8 w-[140px] bg-white rounded-xl shadow-xl border border-gray-100 p-3 animate-bounce"
            style={{ animationDuration: "3s" }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "#EAF2FF" }}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="#0B5FFF"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <div className="text-[10px] font-bold text-gray-900">
                  Approved!
                </div>
                <div className="text-[9px] text-gray-500">
                  iPhone 15 Pro Max
                </div>
              </div>
            </div>
          </div>

          <div
            className="absolute -right-20 bottom-16 w-[130px] bg-white rounded-xl shadow-xl border border-gray-100 p-3"
            style={{ animation: "bounce 4s infinite", animationDelay: "1s" }}
          >
            <div className="text-[10px] font-bold text-gray-900 mb-1">
              Payment Made
            </div>
            <div className="text-[11px] font-bold" style={{ color: "#12B76A" }}>
              GHS 30,000.00
            </div>
            <div className="text-[9px] text-gray-400 mt-0.5">
              Monthly installment
            </div>
          </div>

          <div className="absolute -left-16 bottom-4 w-[120px] bg-white rounded-xl shadow-xl border border-gray-100 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-5 h-5 rounded-full overflow-hidden bg-gray-100">
                <img
                  src="https://images.unsplash.com/photo-1566753323558-f4e0952af115?w=20&h=20&fit=crop&auto=format"
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-[9px] font-semibold text-gray-700">
                Store Partner
              </div>
            </div>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <div
                  key={s}
                  className="w-2 h-2 rounded-sm"
                  style={{ background: "#F79009" }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Merchant Dashboard Illustration ─────────────────────────────────────────
function MerchantIllustration() {
  return (
    <div className="relative w-full max-w-md mx-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        {/* Dashboard header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 mx-3">
            <div className="bg-gray-100 rounded px-3 py-1 text-xs text-gray-400 font-mono">
              merchant.adepapay.ng
            </div>
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-bold text-gray-900">
                Merchant Dashboard
              </div>
              <div className="text-xs text-gray-400">TechWorld Electronics</div>
            </div>
            <VerifiedBadge small />
          </div>
          {/* Mini stats */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: "Revenue", value: "GHS 2.4M", up: true },
              { label: "Orders", value: "186", up: true },
              { label: "Pending", value: "12", up: false },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-gray-50 rounded-xl p-2.5 text-center"
              >
                <div className="text-sm font-bold text-gray-900">{s.value}</div>
                <div className="text-[10px] text-gray-400">{s.label}</div>
                <div
                  className={`text-[9px] font-semibold mt-0.5 ${
                    s.up ? "text-emerald-600" : "text-amber-600"
                  }`}
                >
                  {s.up ? "↑ 12%" : "Pending review"}
                </div>
              </div>
            ))}
          </div>
          {/* Recent orders */}
          <div className="space-y-2">
            {[
              {
                name: "Ama B.",
                product: "Samsung TV",
                amount: "GHS 90,000.00",
                status: "approved",
              },
              {
                name: "Kwame M.",
                product: "MacBook Pro",
                amount: "GHS 196,000.00",
                status: "pending",
              },
              {
                name: "Akosua O.",
                product: "iPhone 15",
                amount: "GHS 152,000.00",
                status: "approved",
              },
            ].map((o) => (
              <div key={o.name} className="flex items-center gap-2 text-xs">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700 flex-shrink-0">
                  {o.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800 truncate">
                    {o.name}
                  </div>
                  <div className="text-[10px] text-gray-400 truncate">
                    {o.product}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">{o.amount}</div>
                  <div
                    className={`text-[9px] font-semibold ${
                      o.status === "approved"
                        ? "text-emerald-600"
                        : "text-amber-600"
                    }`}
                  >
                    {o.status === "approved" ? "✓ Approved" : "Pending"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────
export default function App() {
  type UserRole = "Customer" | "Store Manager" | "Field Agent" | "Admin"
  type Page = "home" | "services" | "browse-stores" | "store-details" | "browse-products" | "register" | "store-registration" | "login" | "portal" | "info"
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [selectedProductId,setSelectedProductId]=useState('')
  const [productKind,setProductKind]=useState<'hire_purchase'|'layaway'|'swap'|undefined>()
  const [infoTopic,setInfoTopic]=useState('About AdepaPay')
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [page, setPage] = useState<Page>(() =>
    window.location.pathname === "/services" ? "services" : "home",
  )

  useEffect(() => {
    let active = true
    authRequest('session').then(result => {
      if (active && result.user) {
        setAuthUser(result.user)
        setRole(result.user.role)
        setPage('portal')
      }
    }).catch(() => {}).finally(() => { if (active) setAuthLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!role) return
    let active = true
    const checkSession = () => {
      authRequest('session').then(result => {
        if (active && result.user) { setAuthUser(result.user); setRole(result.user.role) }
      }).catch(error => {
        if (active && error instanceof AuthError && error.status === 401) {
          setAuthUser(null)
          setRole(null)
          setPage('login')
        }
      })
    }
    const interval = window.setInterval(checkSession, 60000)
    window.addEventListener('focus', checkSession)
    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener('focus', checkSession)
    }
  }, [role])

  const browseProducts=()=>{setSelectedProductId('');setProductKind(undefined);setPage("browse-products")}

  const handleLogin = (user: AuthUser) => {
    setAuthUser(user)
    setRole(user.role)
    setPage('portal')
  }

  const handleLogout = async () => {
    try {
      await authRequest('logout', {})
      for (const key of ['adepapay-role', 'adepapay-store-id', 'adepapay-agent-id']) sessionStorage.removeItem(key)
      setAuthUser(null)
      setRole(null)
      setAuthError('')
      setPage('login')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to sign out. Please try again.')
    }
  }

  useEffect(() => {
    const pageTitles = {
      info: infoTopic,
      home: "Home",
      services: "Our Services",
      "browse-stores": "Browse Stores",
      "store-details": "Store Details",
      "browse-products": "Browse Products",
      register: "Register",
      "store-registration": "Become a Partner",
      login: "Login",
      portal: role ? `${role} Dashboard` : "Dashboard",
    } as const

    document.title = `AdepaPay | ${pageTitles[page]}`
  }, [page, role, infoTopic])

  useEffect(() => {
    if(authLoading)return
    document.documentElement.dataset.sitePage=page
    window.dispatchEvent(new CustomEvent("site-navigation",{detail:{page,id:crypto.randomUUID()}}))
  },[page,authLoading,selectedStoreId,selectedProductId,infoTopic])

  if (authLoading) return <div role="status" className="min-h-screen grid place-items-center text-slate-600">Loading your account...</div>
  if (authError) return <div role="alert" className="min-h-screen flex flex-col items-center justify-center gap-4"><p>{authError}</p><button onClick={handleLogout}>Retry sign out</button><button onClick={() => setAuthError('')}>Back to dashboard</button></div>

  if (page === "portal" && role && authUser?.store_application) {
    return <div className="min-h-screen grid place-items-center bg-slate-50 p-6"><main className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"><p className="text-sm font-bold text-amber-700">{authUser.store_application.status}</p><h1 className="mt-3 text-2xl font-bold text-slate-900">{authUser.store_application.storeName}</h1><p className="mt-3 text-slate-600">{authUser.store_application.status === "Rejected" ? "Your store application was rejected." : "Your store application has been received. Store management access will be available after approval."}{authUser.store_application.reason && <span className="mt-2 block">{authUser.store_application.reason}</span>}</p><p className="mt-5 break-all text-sm text-slate-500">Reference: {authUser.store_application.reference}</p><p className="mt-2 text-sm text-slate-500">{authUser.email}</p><button onClick={handleLogout} className="mt-6 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white">Sign out</button></main></div>
  }

  if (page === "portal" && role === "Store Manager" && (!authUser?.subscription?.active || new URLSearchParams(window.location.search).get('billing') === 'return')) {
    return <StoreBilling onLogout={handleLogout} onContinue={() => window.location.assign('/')} />
  }
  if (page === "portal" && role) {
    if (role === "Field Agent")
      return (
        <FieldAgentPortal
          onLogout={handleLogout}
        />
      )
    return (
      <CustomerPortal
        staff={authUser?.staff === true}
        permissions={authUser?.permissions}
        displayName={authUser?.name}
        roleTitle={authUser?.roleTitle}
        storeName={authUser?.store?.name}
        role={role}
        storeId={authUser?.store?.id || authUser?.id || ""}
        onLogout={handleLogout}
        onBrowseStores={() => setPage("browse-stores")}
        onBrowseProducts={browseProducts}
      />
    )
  }
  if (page === "info") return <PublicInformation topic={infoTopic} onHome={() => setPage("home")} onStores={() => setPage("browse-stores")} onProducts={browseProducts} onRegister={() => setPage("register")} />
  if (page === "services") {
    return (
      <Services
        onHome={() => setPage("home")}
        onBrowseStores={() => setPage("browse-stores")}
        onBrowseProducts={(service) => {
          setSelectedProductId('')
          setProductKind(service === "hire-purchase" ? "hire_purchase" : service)
          setPage("browse-products")
        }}
        onLogin={() => setPage("login")}
        onRegister={() => setPage("register")}
        onBecomePartner={() => setPage("store-registration")}
      />
    )
  }

  if (page === "browse-stores") {
    return (
      <BrowseStores
        onServices={() => setPage("services")}
        onBack={() => setPage(role ? "portal" : "home")}
        onStoreDetails={(id) => { setSelectedStoreId(id); setPage("store-details") }}
        onBrowseProducts={browseProducts}
        onLogin={() => setPage("login")}
        onRegister={() => setPage("register")}
        onBecomePartner={() => setPage("store-registration")}
      />
    )
  }
  if (page === "store-details") {
    return (
      <StoreDetails
        onServices={() => setPage("services")}
        storeId={selectedStoreId}
        onBack={() => setPage(role ? "portal" : "home")}
        onBrowseStores={() => setPage("browse-stores")}
        onBrowseProducts={browseProducts}
        onLogin={() => setPage("login")}
        onRegister={() => setPage("register")}
        onBecomePartner={() => setPage("store-registration")}
      />
    )
  }
  if (page === "browse-products") {
    return (
      <BrowseProducts
        onServices={() => setPage("services")}
        initialProduct={selectedProductId}
        applyKind={productKind}
        onBack={() => setPage(role ? "portal" : "home")}
        onBrowseStores={() => setPage("browse-stores")}
        onLogin={() => setPage("login")}
        onRegister={() => setPage("register")}
        onBecomePartner={() => setPage("store-registration")}
      />
    )
  }
  if (page === "login") {
    return (
      <Login
        onBack={() => setPage("home")}
        onBrowseStores={() => setPage("browse-stores")}
        onBrowseProducts={browseProducts}
        onRegister={() => setPage("register")}
        onLogin={handleLogin}
      />
    )
  }
  if (page === "register") {
    return (
      <Register
        onRegisterStore={() => setPage("store-registration")}
        onLogin={() => setPage("login")}
        onBack={() => setPage("home")}
        onBrowseStores={() => setPage("browse-stores")}
        onBrowseProducts={browseProducts}
      />
    )
  }
  if (page === "store-registration") {
    return (
      <StoreRegistration
        onCustomerRegister={() => setPage("register")}
        onBack={() => setPage("home")}
        onLogin={() => setPage("login")}
      />
    )
  }
  return <Landing onNavigate={(page)=>{setProductKind(undefined);setSelectedProductId('');setPage(page)}} onStore={(id)=>{setSelectedStoreId(id);setPage("store-details")}} onProduct={(id)=>{setProductKind(undefined);setSelectedProductId(id);setPage("browse-products")}} onInfo={(topic)=>{setInfoTopic(topic);setPage("info")}} />
}

function Landing({
  onStore,onProduct,onInfo,
  onNavigate,
}: {
  onStore:(id:string)=>void;onProduct:(id:string)=>void;onInfo:(topic:string)=>void;
  onNavigate: (
    p: "services" | "browse-stores" | "browse-products" | "register" | "store-registration" | "login",
  ) => void
}) {
  const [showBackTop, setShowBackTop] = useState(false)

  useScrollReveal()

  useEffect(() => {
    const onScroll = () => {
      setShowBackTop(window.scrollY > 400)
    }
    window.addEventListener("scroll", onScroll)

    return () => {
      window.removeEventListener("scroll", onScroll)

    }
  }, [])

  const scrollTop = useCallback(
    () => window.scrollTo({ top: 0, behavior: "smooth" }),
    [],
  )

  return (
    <div className="min-h-screen bg-white font-sans">
      <PublicNavbar
        active="home"
        onHome={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        onBrowseStores={() => onNavigate("browse-stores")}
        onBrowseProducts={() => onNavigate("browse-products")}
        onServices={() => onNavigate("services")}
        onLogin={() => onNavigate("login")}
        onRegister={() => onNavigate("register")}
        onBecomePartner={() => onNavigate("store-registration")}
      />

      {/* ── NAVIGATION ────────────────────────────────────────────────────── */}

      <main>
        {/* ── HERO ──────────────────────────────────────────────────────────── */}
        <section className="hero-pro relative overflow-hidden pt-28 pb-20 px-4 sm:px-6 lg:px-8">
          <div className="hero-mesh absolute inset-0" aria-hidden="true" />
          <div className="hero-glow hero-glow-left" aria-hidden="true" />
          <div className="hero-glow hero-glow-right" aria-hidden="true" />
          <div className="hero-ring hero-ring-one" aria-hidden="true" />
          <div className="hero-ring hero-ring-two" aria-hidden="true" />
          <div className="relative z-10 max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div>
                <div
                  className="hero-enter inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6"
                  style={{
                    background: "#EAF2FF",
                    color: "#0B5FFF",
                    animationDelay: "80ms",
                  }}
                >
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  FLEXIBLE WAYS TO SHOP WITH ADEPAPAY
                </div>
                <h1
                  className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight mb-5"
                  style={{ color: "#101828" }}
                >
                  <span
                    className="hero-line"
                    style={{ animationDelay: "170ms" }}
                  >
                    Buy in Installments.
                  </span>
                  <span
                    className="hero-line gradient-text hero-gradient"
                    style={{ animationDelay: "270ms" }}
                  >
                    Pay Ahead.
                  </span>
                  <span
                    className="hero-line"
                    style={{ animationDelay: "370ms" }}
                  >
                    Trade Up.
                  </span>
                </h1>
                <p
                  className="hero-enter text-lg text-gray-500 leading-relaxed mb-8 max-w-lg"
                  style={{ animationDelay: "470ms" }}
                >
                  Explore stores and products on AdepaPay. Choose Hire Purchase,
                  Layaway, or Device Swap where available, with terms set out
                  before you proceed.
                </p>
                <div
                  className="hero-enter flex flex-col sm:flex-row gap-3 mb-8"
                  style={{ animationDelay: "570ms" }}
                >
                  <button
                    onClick={() => onNavigate("browse-products")}
                    className="btn-ripple px-6 py-3.5 rounded-xl font-semibold text-white text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all"
                    style={{ background: "#0B5FFF" }}
                  >
                    Browse Products
                    <Icon.ArrowRight />
                  </button>
                  <button
                    onClick={() => onNavigate("services")}
                    className="px-6 py-3.5 rounded-xl font-semibold text-sm border-2 hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                    style={{ borderColor: "#0B5FFF", color: "#0B5FFF" }}
                  >
                    Explore Our Services
                  </button>
                </div>
                <div className="flex flex-wrap gap-4">
                  {[
                    "Approved Stores",
                    "Recorded Payments",
                    "Flexible Installments",
                    "Store Review",
                  ].map((badge, index) => (
                    <div
                      key={badge}
                      className="hero-enter flex items-center gap-1.5 text-sm font-medium"
                      style={{
                        color: "#344054",
                        animationDelay: `${680 + index * 70}ms`,
                      }}
                    >
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: "#12B76A" }}
                      >
                        <Icon.Check />
                      </div>
                      {badge}
                    </div>
                  ))}
                </div>
              </div>
              <div className="hero-visual" style={{ animationDelay: "300ms" }}>
                <HeroIllustration /><p className="mt-3 text-center text-xs text-slate-500">Illustrative plan preview. Actual products and terms appear below.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── FEATURED STORES ───────────────────────────────────────────────── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10 reveal">
              <div>
                <p
                  className="text-sm font-semibold uppercase tracking-widest mb-2"
                  style={{ color: "#0B5FFF" }}
                >
                  Marketplace
                </p>
                <h2
                  className="text-3xl sm:text-4xl font-bold"
                  style={{ color: "#101828" }}
                >
                  Featured Stores
                </h2>
              </div>
              <button
                onClick={() => onNavigate("browse-stores")}
                className="text-sm font-semibold flex items-center gap-1.5 hover:underline"
                style={{ color: "#0B5FFF" }}
              >
                View All Stores <Icon.ArrowRight />
              </button>
            </div>
            <FeaturedListings type="stores" onSelect={onStore} />
            <div className="text-center mt-10 reveal">
              <button
                onClick={() => onNavigate("browse-stores")}
                className="btn-ripple px-8 py-3 rounded-xl text-sm font-semibold border-2 hover:bg-blue-50 transition-all"
                style={{ borderColor: "#0B5FFF", color: "#0B5FFF" }}
              >
                View All Stores
              </button>
            </div>
          </div>
        </section>

        {/* ── FEATURED PRODUCTS ─────────────────────────────────────────────── */}
        <section
          className="py-20 px-4 sm:px-6 lg:px-8"
          style={{ background: "#F8FAFC" }}
        >
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10 reveal">
              <div>
                <p
                  className="text-sm font-semibold uppercase tracking-widest mb-2"
                  style={{ color: "#0B5FFF" }}
                >
                  Shop Now
                </p>
                <h2
                  className="text-3xl sm:text-4xl font-bold"
                  style={{ color: "#101828" }}
                >
                  Featured Products
                </h2>
              </div>
              <button
                onClick={() => onNavigate("browse-products")}
                className="text-sm font-semibold flex items-center gap-1.5 hover:underline"
                style={{ color: "#0B5FFF" }}
              >
                Browse All Products <Icon.ArrowRight />
              </button>
            </div>
            <FeaturedListings type="products" onSelect={onProduct} />
          </div>
        </section>

        {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-14 reveal">
              <p
                className="text-sm font-semibold uppercase tracking-widest mb-2"
                style={{ color: "#0B5FFF" }}
              >
                Simple Process
              </p>
              <h2
                className="text-3xl sm:text-4xl font-bold mb-3"
                style={{ color: "#101828" }}
              >
                How AdepaPay Works
              </h2>
              <p className="text-gray-500 max-w-md mx-auto">
                From browsing to ownership in just four simple steps.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
              {/* Connector line desktop */}
              <div
                className="hidden lg:block absolute top-10 left-[12.5%] right-[12.5%] h-px"
                style={{
                  background:
                    "linear-gradient(90deg, #0B5FFF 0%, #EAF2FF 100%)",
                }}
              />

              {[
                {
                  step: "01",
                  icon: <Icon.Store />,
                  title: "Browse Stores",
                  desc: "Explore approved stores across Ghana and compare their published products and terms.",
                },
                {
                  step: "02",
                  icon: <Icon.Package />,
                  title: "Choose Product",
                  desc: "Find the perfect product with detailed pricing, deposit, and monthly installment information upfront.",
                },
                {
                  step: "03",
                  icon: <Icon.Clipboard />,
                  title: "Apply for Hire Purchase",
                  desc: "Complete the required details and documents. Your selected store reviews the application.",
                },
                {
                  step: "04",
                  icon: <Icon.CreditCard />,
                  title: "Pay Monthly Until Ownership",
                  desc: "Arrange handover with the store after approval and the required payment. Follow your agreed schedule.",
                },
              ].map((s, i) => (
                <div
                  key={s.step}
                  className="reveal relative flex flex-col items-center text-center"
                  style={{ transitionDelay: `${i * 0.1}s` }}
                >
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center text-blue-600 mb-4 relative z-10 shadow-md"
                    style={{
                      background: "#ffffff",
                      border: "2px solid #EAF2FF",
                      boxShadow: "0 8px 24px rgba(11,95,255,0.12)",
                    }}
                  >
                    {s.icon}
                  </div>
                  <div
                    className="text-xs font-bold tracking-widest mb-2"
                    style={{ color: "#0B5FFF" }}
                  >
                    STEP {s.step}
                  </div>
                  <h3
                    className="text-base font-bold mb-2"
                    style={{ color: "#101828" }}
                  >
                    {s.title}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── WHY ADEPAPAY ─────────────────────────────────────────────────── */}
        <section
          className="py-20 px-4 sm:px-6 lg:px-8"
          style={{ background: "#F8FAFC" }}
        >
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12 reveal">
              <p
                className="text-sm font-semibold uppercase tracking-widest mb-2"
                style={{ color: "#0B5FFF" }}
              >
                Our Edge
              </p>
              <h2
                className="text-3xl sm:text-4xl font-bold mb-3"
                style={{ color: "#101828" }}
              >
                Why Choose AdepaPay?
              </h2>
              <p className="text-gray-500 max-w-md mx-auto">
                We built every feature to make hire purchase simpler, safer, and
                smarter.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  icon: <Icon.Shield />,
                  title: "Approved Stores",
                  desc: "Public listings belong to stores approved to participate in the marketplace.",
                },
                {
                  icon: <Icon.Lock />,
                  title: "Payment Records",
                  desc: "View payments recorded by your store and download the associated receipts.",
                },
                {
                  icon: <Icon.CreditCard />,
                  title: "Affordable Installments",
                  desc: "Plans designed to fit your income with no surprise charges.",
                },
                {
                  icon: <Icon.Bolt />,
                  title: "Store Review",
                  desc: "Track the store decision and application activity from your account.",
                },
                {
                  icon: <Icon.Users />,
                  title: "Trusted Platform",
                  desc: "Ratings come from customers with completed purchases.",
                },
                {
                  icon: <Icon.Chat />,
                  title: "Customer Support",
                  desc: "Ask the AI assistant about platform features and contact your store for order support.",
                },
                {
                  icon: <Icon.Calendar />,
                  title: "Flexible Plans",
                  desc: "Review the durations and payment frequencies offered for your selected product.",
                },
                {
                  icon: <Icon.Package />,
                  title: "Wide Selection",
                  desc: "Explore the live catalogue and filter by the categories available from participating stores.",
                },
              ].map((f, i) => (
                <div
                  key={f.title}
                  className="card-lift reveal bg-white rounded-2xl p-5 border border-gray-100 shadow-sm"
                  style={{ transitionDelay: `${i * 0.06}s` }}
                >
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    {f.icon}
                  </div>
                  <h3
                    className="font-semibold text-sm mb-1.5"
                    style={{ color: "#101828" }}
                  >
                    {f.title}
                  </h3>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ───────────────────────────────────────────────────────────── */}
        <section
          className="py-20 px-4 sm:px-6 lg:px-8"
          style={{ background: "#F8FAFC" }}
        >
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12 reveal">
              <p
                className="text-sm font-semibold uppercase tracking-widest mb-2"
                style={{ color: "#0B5FFF" }}
              >
                Got Questions?
              </p>
              <h2
                className="text-3xl sm:text-4xl font-bold mb-3"
                style={{ color: "#101828" }}
              >
                Frequently Asked Questions
              </h2>
              <p className="text-gray-500 max-w-md mx-auto">
                Everything you need to know about hire purchase on AdepaPay.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {FAQS.map((faq, i) => (
                <div
                  key={i}
                  className="reveal"
                  style={{ transitionDelay: `${i * 0.06}s` }}
                >
                  <FAQItem q={faq.q} a={faq.a} idx={i} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── STORE PARTNER CTA ─────────────────────────────────────────────── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div
              className="rounded-3xl overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #F8FAFC 0%, #EAF2FF 100%)",
                border: "1px solid #e2eeff",
              }}
            >
              <div className="grid lg:grid-cols-2 gap-10 p-10 lg:p-16 items-center">
                <div className="reveal order-2 lg:order-1">
                  <MerchantIllustration /><p className="mt-3 text-center text-xs text-slate-500">Illustrative workspace preview; figures shown are examples.</p>
                </div>
                <div
                  className="reveal order-1 lg:order-2"
                  style={{ transitionDelay: "0.1s" }}
                >
                  <div
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-5"
                    style={{ background: "#EAF2FF", color: "#0B5FFF" }}
                  >
                    <Icon.Store />
                    For Merchants
                  </div>
                  <h2
                    className="text-3xl sm:text-4xl font-bold mb-4 leading-tight"
                    style={{ color: "#101828" }}
                  >
                    Grow Your Business
                    <br />
                    with AdepaPay
                  </h2>
                  <p className="text-gray-500 text-base leading-relaxed mb-6">
                    Publish products, review applications and manage agreed payment plans in your store workspace.
                  </p>
                  <ul className="space-y-3 mb-8">
                    {[
                      "Review applications and record received payments",
                      "Reach customers browsing the marketplace",
                      "Store dashboards with application and payment records",
                      "Review customer details and supporting documents",
                    ].map((b) => (
                      <li
                        key={b}
                        className="flex items-start gap-2.5 text-sm text-gray-700"
                      >
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: "#12B76A" }}
                        >
                          <Icon.Check />
                        </div>
                        {b}
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-3 flex-wrap">
                    <button
                      onClick={() => onNavigate("store-registration")}
                      className="btn-ripple px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                      style={{ background: "#0B5FFF" }}
                    >
                      Register Your Store
                    </button>
                    <button
                      onClick={() => onInfo("About")}
                      className="px-6 py-3 rounded-xl text-sm font-semibold border-2 hover:bg-blue-50 transition-all"
                      style={{ borderColor: "#0B5FFF", color: "#0B5FFF" }}
                    >
                      Learn More
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ─────────────────────────────────────────────────────── */}
        <section
          className="py-20 px-4 sm:px-6 lg:px-8"
          style={{
            background: "linear-gradient(135deg, #0B5FFF 0%, #1E40AF 100%)",
          }}
        >
          <div className="max-w-3xl mx-auto text-center reveal">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 text-white">
              <Icon.Package />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight">
              Ready to Own Your
              <br />
              Next Product?
            </h2>
            <p className="text-blue-200 text-base mb-8 max-w-lg mx-auto leading-relaxed">
              Browse available products and review the payment options offered by each store before applying.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button onClick={() => onNavigate("browse-products")} className="btn-ripple px-8 py-3.5 rounded-xl font-semibold text-sm text-blue-700 bg-white hover:bg-blue-50 transition-all">
                Browse Products
              </button>
              <button onClick={() => onNavigate("register")} className="btn-ripple px-8 py-3.5 rounded-xl font-semibold text-sm text-white border-2 border-white/40 hover:border-white hover:bg-white/10 transition-all">
                Create Free Account
              </button>
            </div>
          </div>
        </section>

        {/* ── FOOTER ────────────────────────────────────────────────────────── */}
        <footer
          className="py-16 px-4 sm:px-6 lg:px-8"
          style={{ background: "#101828" }}
        >
          <div className="max-w-7xl mx-auto">
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
              {/* Brand */}
              <div className="lg:col-span-2">
                <div className="flex items-center gap-3 mb-4">
                  <img
                    src="/images/adepa_pay_logo.png"
                    alt="AdepaPay"
                    className="h-33 w-auto object-contain"
                  />
                </div>
                <p className="text-sm text-gray-400 leading-relaxed mb-5 max-w-xs">
                  Ghana's premier hire purchase marketplace. Buy today, pay
                  smart, own tomorrow.
                </p>
                <button className="rounded-xl border border-slate-500 px-4 py-2 text-sm text-white" onClick={()=>window.dispatchEvent(new Event("cookie-settings"))}>Cookie preferences</button>

              </div>
              {/* Links */}
              {[
                {
                  title: "Company",
                  links: ["About", "Help Center", "Become a Partner"],
                },
                {
                  title: "Products",
                  links: [
                    "Browse Stores",
                    "Categories",
                    "Hire Purchase",
                    "New Arrivals",
                  ],
                },
                {
                  title: "Support",
                  links: [
                    "Help Center",
                    "Privacy Policy",
                    "Terms of Service",
                    "FAQs",
                    "Contact Us",
                  ],
                },
              ].map((col) => (
                <div key={col.title}>
                  <h4 className="text-sm font-semibold text-white mb-4">
                    {col.title}
                  </h4>
                  <ul className="space-y-2.5">
                    {col.links.map((link) => (
                      <li key={link}>
                        <a
                          href="#"
                          onClick={(event)=>{event.preventDefault(); if(link==="Browse Stores")onNavigate("browse-stores");else if(["Browse Products","Products","Categories","Hire Purchase","New Arrivals"].includes(link))onNavigate("browse-products");else if(link==="Become a Partner")onNavigate("store-registration");else onInfo(link)}}
                          className="text-sm text-gray-400 hover:text-white transition-colors"
                        >
                          {link}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-gray-500">
                © 2026 AdepaPay Technologies Ltd. All rights reserved.
              </p>

            </div>
          </div>
        </footer>
      </main>

      {/* ── FLOATING COMPONENTS ──────────────────────────────────────────────── */}

      {/* Back to Top */}
      <button
        onClick={scrollTop}
        className="fixed left-6 bottom-16 z-40 w-10 h-10 rounded-full shadow-lg flex items-center justify-center text-white transition-all duration-300 hover:scale-110"
        style={{
          background: "#101828",
          opacity: showBackTop ? 1 : 0,
          pointerEvents: showBackTop ? "auto" : "none",
        }}
      >
        <Icon.ArrowUp />
      </button>

    </div>
  )
}
