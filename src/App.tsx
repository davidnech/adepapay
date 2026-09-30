import { useState, useEffect, useRef, useCallback } from "react"
import BrowseStores from "./pages/BrowseStores"
import StoreDetails from "./pages/StoreDetails"
import BrowseProducts from "./pages/BrowseProducts"
import Register from "./pages/Register"
import Login from "./pages/Login"
import OTPVerification from "./pages/OTPVerification"
import ForgotPassword from "./pages/ForgotPassword"
import CustomerPortal from "./pages/CustomerPortal"
import StoreRegistration from "./pages/StoreRegistration"
import { formatCurrency } from "./lib/localization"
import PublicNavbar from "./components/PublicNavbar"
import Services from "./pages/ServicesRedesign"
import FieldAgentPortal from "./pages/FieldAgentPortal"

// ─── Types ────────────────────────────────────────────────────────────────────
interface Store {
  id: number
  name: string
  category: string
  location: string
  rating: number
  products: number
  image: string
  logo: string
  verified: boolean
}

interface Product {
  id: number
  name: string
  store: string
  image: string
  price: number
  deposit: number
  monthly: number
  duration: number
  inStock: boolean
  verified: boolean
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const STORES: Store[] = [
  {
    id: 1,
    name: "TechWorld Electronics",
    category: "Electronics",
    location: "Accra, Ghana",
    rating: 4.9,
    products: 248,
    image:
      "https://images.unsplash.com/photo-1491933382434-500287f9b54b?w=600&h=240&fit=crop&auto=format",
    logo: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=80&h=80&fit=crop&auto=format",
    verified: true,
  },
  {
    id: 2,
    name: "HomeStyle Furniture",
    category: "Furniture & Decor",
    location: "Kumasi, Ghana",
    rating: 4.7,
    products: 182,
    image:
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&h=240&fit=crop&auto=format",
    logo: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=80&h=80&fit=crop&auto=format",
    verified: true,
  },
  {
    id: 3,
    name: "AutoDrive Motors",
    category: "Automobiles",
    location: "Tema, Greater Accra",
    rating: 4.8,
    products: 94,
    image:
      "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=600&h=240&fit=crop&auto=format",
    logo: "https://images.unsplash.com/photo-1607853202273-797f1c22a38e?w=80&h=80&fit=crop&auto=format",
    verified: true,
  },
  {
    id: 4,
    name: "FashionHub Boutique",
    category: "Fashion & Apparel",
    location: "East Legon, Accra",
    rating: 4.6,
    products: 310,
    image:
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&h=240&fit=crop&auto=format",
    logo: "https://images.unsplash.com/photo-1600180758890-6b94519a8ba6?w=80&h=80&fit=crop&auto=format",
    verified: true,
  },
  {
    id: 5,
    name: "SmartHome Appliances",
    category: "Home Appliances",
    location: "Takoradi, Ghana",
    rating: 4.9,
    products: 156,
    image:
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=240&fit=crop&auto=format",
    logo: "https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=80&h=80&fit=crop&auto=format",
    verified: true,
  },
  {
    id: 6,
    name: "HealthPlus Pharmacy",
    category: "Health & Wellness",
    location: "Tamale, Ghana",
    rating: 4.5,
    products: 89,
    image:
      "https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=600&h=240&fit=crop&auto=format",
    logo: "https://images.unsplash.com/photo-1585435557343-3b348031a0d3?w=80&h=80&fit=crop&auto=format",
    verified: true,
  },
]

const PRODUCTS: Product[] = [
  {
    id: 1,
    name: 'Samsung 65" QLED 4K Smart TV',
    store: "TechWorld Electronics",
    image:
      "https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=400&h=300&fit=crop&auto=format",
    price: 450000,
    deposit: 90000,
    monthly: 30000,
    duration: 12,
    inStock: true,
    verified: true,
  },
  {
    id: 2,
    name: 'MacBook Pro 14" M3 Chip',
    store: "TechWorld Electronics",
    image:
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=300&fit=crop&auto=format",
    price: 980000,
    deposit: 196000,
    monthly: 65400,
    duration: 12,
    inStock: true,
    verified: true,
  },
  {
    id: 3,
    name: "Premium Sectional Sofa",
    store: "HomeStyle Furniture",
    image:
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=300&fit=crop&auto=format",
    price: 320000,
    deposit: 64000,
    monthly: 21340,
    duration: 12,
    inStock: true,
    verified: true,
  },
  {
    id: 4,
    name: "LG Side-by-Side Refrigerator",
    store: "SmartHome Appliances",
    image:
      "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=400&h=300&fit=crop&auto=format",
    price: 280000,
    deposit: 56000,
    monthly: 18670,
    duration: 12,
    inStock: false,
    verified: true,
  },
  {
    id: 5,
    name: "iPhone 15 Pro Max 256GB",
    store: "TechWorld Electronics",
    image:
      "https://images.unsplash.com/photo-1696446702183-afb69c5f24a4?w=400&h=300&fit=crop&auto=format",
    price: 760000,
    deposit: 152000,
    monthly: 50670,
    duration: 12,
    inStock: true,
    verified: true,
  },
  {
    id: 6,
    name: "Dyson V15 Detect Vacuum",
    store: "SmartHome Appliances",
    image:
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop&auto=format",
    price: 185000,
    deposit: 37000,
    monthly: 12340,
    duration: 12,
    inStock: true,
    verified: true,
  },
]

const TESTIMONIALS = [
  {
    id: 1,
    name: "Ama Boateng",
    product: 'Samsung 65" QLED TV',
    store: "TechWorld Electronics",
    review:
      "AdepaPay made it so easy to get the TV I always wanted. The approval was instant, and I was watching on my new screen the very next day. The installment plan fits perfectly into my budget!",
    avatar:
      "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=80&h=80&fit=crop&auto=format",
    rating: 5,
  },
  {
    id: 2,
    name: "Kwame Mensah",
    product: 'MacBook Pro 14"',
    store: "TechWorld Electronics",
    review:
      "As a freelance designer, the MacBook Pro was a game-changer for my career. With AdepaPay, I got it immediately and the monthly payments are very manageable. Highly recommend to every professional!",
    avatar:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=80&h=80&fit=crop&auto=format",
    rating: 5,
  },
  {
    id: 3,
    name: "Funmilayo Adekunle",
    product: "Premium Sectional Sofa",
    store: "HomeStyle Furniture",
    review:
      "I furnished my entire living room through AdepaPay. The stores are all verified and trustworthy, and the process was completely transparent — no hidden charges. This platform is genuinely life-changing!",
    avatar:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&h=80&fit=crop&auto=format",
    rating: 5,
  },
]

const FAQS = [
  {
    q: "How does Hire Purchase work?",
    a: "Hire Purchase allows you to take possession of a product immediately after paying an initial deposit. You then pay the remaining balance in fixed monthly installments over an agreed period, at the end of which you become the full legal owner of the product.",
  },
  {
    q: "Who can apply for Hire Purchase?",
    a: "Any Ghanaian resident aged 18 and above with a valid Ghana Card, proof of income, and a bank or mobile money account can apply. Both salaried employees and self-employed individuals are eligible to apply through AdepaPay.",
  },
  {
    q: "How much deposit is required?",
    a: "The minimum deposit is typically 20% of the product price, though this may vary by store and product category. Some stores offer special promotions with lower deposit requirements for selected products.",
  },
  {
    q: "Can I complete payment early?",
    a: "Yes! You can make early payments or settle your hire purchase balance at any time without penalty. Early settlement can save you on interest charges and transfer full ownership to you sooner.",
  },
  {
    q: "How long does approval take?",
    a: "Most applications receive a decision within minutes. In some cases, additional verification may take up to 24 hours. You will be notified via SMS and email as soon as your application is processed.",
  },
  {
    q: "Are all stores on AdepaPay verified?",
    a: "Absolutely. Every store on AdepaPay undergoes a rigorous verification process that includes business registration checks, physical address verification, and product quality audits before they are listed on our marketplace.",
  },
]

const PARTNERS = [
  "Samsung",
  "LG Electronics",
  "Apple",
  "HP",
  "Lenovo",
  "Sony",
  "Dell",
  "Panasonic",
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatNaira(n: number) {
  return formatCurrency(n)
}

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

function useCounter(target: number, duration = 1800) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          const start = performance.now()
          const step = (now: number) => {
            const p = Math.min((now - start) / duration, 1)
            const eased = 1 - Math.pow(1 - p, 3)
            setCount(Math.round(eased * target))
            if (p < 1) requestAnimationFrame(step)
          }
          requestAnimationFrame(step)
        }
      },
      { threshold: 0.5 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [target, duration])

  return { count, ref }
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          key={s}
          className={`w-4 h-4 ${
            s <= rating ? "text-amber-400" : "text-gray-200"
          }`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
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

function StatCard({
  icon,
  suffix,
  target,
  label,
}: {
  icon: React.ReactNode
  suffix: string
  target: number
  label: string
}) {
  const { count, ref } = useCounter(target)
  return (
    <div
      ref={ref}
      className="card-lift bg-white rounded-2xl p-6 text-center shadow-sm border border-gray-100 flex flex-col items-center gap-3"
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{ background: "#EAF2FF" }}
      >
        {icon}
      </div>
      <div
        className="text-4xl font-bold tracking-tight"
        style={{ color: "#0B5FFF" }}
      >
        {count.toLocaleString()}
        {suffix}
      </div>
      <div className="text-sm font-medium text-gray-500">{label}</div>
    </div>
  )
}

function StoreCard({ store }: { store: Store }) {
  return (
    <div className="card-lift bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col">
      <div className="relative h-36 bg-blue-50 overflow-hidden">
        <img
          src={store.image}
          alt={store.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        <div className="absolute bottom-3 left-3">
          <img
            src={store.logo}
            alt=""
            className="w-10 h-10 rounded-xl border-2 border-white object-cover shadow"
          />
        </div>
        {store.verified && (
          <div className="absolute top-3 right-3">
            <VerifiedBadge small />
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <h3 className="font-semibold text-gray-900 text-sm leading-tight">
          {store.name}
        </h3>
        <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full self-start">
          {store.category}
        </span>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          {store.location}
        </div>
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-50">
          <div className="flex items-center gap-1.5">
            <StarRating rating={Math.round(store.rating)} />
            <span className="text-xs font-semibold text-gray-700">
              {store.rating}
            </span>
          </div>
          <span className="text-xs text-gray-500">
            {store.products} products
          </span>
        </div>
      </div>
      <div className="px-4 pb-4">
        <button
          className="btn-ripple w-full py-2 rounded-xl text-sm font-semibold border-2 transition-all hover:bg-blue-600 hover:text-white hover:border-blue-600"
          style={{ borderColor: "#0B5FFF", color: "#0B5FFF" }}
        >
          View Store
        </button>
      </div>
    </div>
  )
}

function ProductCard({ product }: { product: Product }) {
  const [fav, setFav] = useState(false)
  return (
    <div className="card-lift bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col group">
      <div className="relative h-44 bg-gray-50 overflow-hidden">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <button
          onClick={() => setFav(!fav)}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm transition-transform hover:scale-110"
        >
          <svg
            className={`w-4 h-4 transition-colors ${
              fav ? "text-red-500 fill-red-500" : "text-gray-400"
            }`}
            fill={fav ? "currentColor" : "none"}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        </button>
        {!product.inStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-white text-gray-800 text-xs font-semibold px-3 py-1 rounded-full">
              Out of Stock
            </span>
          </div>
        )}
        {product.verified && (
          <div className="absolute bottom-3 left-3">
            <VerifiedBadge small />
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">
          {product.name}
        </h3>
        <p className="text-xs text-gray-500">{product.store}</p>
        <div className="grid grid-cols-2 gap-2 mt-1 p-3 rounded-xl bg-gray-50 text-xs">
          <div>
            <div className="text-gray-400 mb-0.5">Cash Price</div>
            <div className="font-bold text-gray-900">
              {formatCurrency(product.price)}
            </div>
          </div>
          <div>
            <div className="text-gray-400 mb-0.5">Deposit</div>
            <div className="font-bold text-blue-600">
              {formatCurrency(product.deposit)}
            </div>
          </div>
          <div>
            <div className="text-gray-400 mb-0.5">Monthly</div>
            <div className="font-bold text-emerald-600">
              {formatCurrency(product.monthly)}
            </div>
          </div>
          <div>
            <div className="text-gray-400 mb-0.5">Duration</div>
            <div className="font-bold text-gray-900">
              {product.duration} months
            </div>
          </div>
        </div>
      </div>
      <div className="px-4 pb-4 grid grid-cols-2 gap-2">
        <button
          className="py-2 rounded-xl text-xs font-semibold border-2 transition-all hover:bg-gray-50"
          style={{ borderColor: "#0B5FFF", color: "#0B5FFF" }}
        >
          View Details
        </button>
        <button
          disabled={!product.inStock}
          className="btn-ripple py-2 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: product.inStock ? "#0B5FFF" : "#9CA3AF" }}
        >
          Apply Now
        </button>
      </div>
    </div>
  )
}

function FAQItem({ q, a, idx }: { q: string a: string idx: number }) {
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
function Toast({ visible, onClose }: { visible: boolean onClose: () => void }) {
  useEffect(() => {
    if (visible) {
      const t = setTimeout(onClose, 4000)
      return () => clearTimeout(t)
    }
  }, [visible, onClose])

  if (!visible) return null
  return (
    <div className="toast-enter fixed bottom-24 right-6 z-50 bg-white border border-gray-100 shadow-xl rounded-xl p-4 flex items-start gap-3 max-w-xs">
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
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-gray-900">
          New Products Available!
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          Samsung Galaxy S25 is now listed on AdepaPay
        </p>
      </div>
      <button
        onClick={onClose}
        className="text-gray-300 hover:text-gray-500 transition-colors"
      >
        <Icon.X />
      </button>
    </div>
  )
}

// ─── Cookie Banner ────────────────────────────────────────────────────────────
function CookieBanner({ onAccept }: { onAccept: () => void }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 p-4">
      <div className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-2xl shadow-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <Icon.Shield />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">We use cookies</p>
          <p className="text-xs text-gray-500 mt-0.5">
            We use cookies to improve your experience on AdepaPay. By
            continuing, you agree to our privacy policy.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={onAccept}
            className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Decline
          </button>
          <button
            onClick={onAccept}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white transition-colors"
            style={{ background: "#0B5FFF" }}
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  type UserRole = "Customer" | "Store Manager" | "Field Agent" | "Admin"
  type Page = "home" | "services" | "browse-stores" | "store-details" | "browse-products" | "register" | "store-registration" | "login" | "otp" | "forgot-password" | "portal"
  const [role, setRole] = useState<UserRole | null>(
    () => sessionStorage.getItem("adepapay-role") as UserRole | null,
  )
  const [page, setPage] = useState<Page>(() =>
    window.location.pathname === "/services"
      ? "services"
      : sessionStorage.getItem("adepapay-role")
        ? "portal"
        : "home",
  )

  const handleLogin = (nextRole: UserRole) => {
    sessionStorage.setItem("adepapay-role", nextRole)
    if (nextRole === "Store Manager" && !sessionStorage.getItem("adepapay-store-id"))
      sessionStorage.setItem("adepapay-store-id", "cytech-gadgets")
    setRole(nextRole)
    setPage("portal")
  }

  const handleLogout = () => {
    sessionStorage.removeItem("adepapay-role")
    sessionStorage.removeItem("adepapay-store-id")
    sessionStorage.removeItem("adepapay-agent-id")
    setRole(null)
    setPage("login")
  }

  useEffect(() => {
    const pageTitles = {
      home: "Home",
      services: "Our Services",
      "browse-stores": "Browse Stores",
      "store-details": "Store Details",
      "browse-products": "Browse Products",
      register: "Register",
      "store-registration": "Become a Partner",
      login: "Login",
      otp: "OTP Verification",
      "forgot-password": "Forgot Password",
      portal: role ? `${role} Dashboard` : "Dashboard",
    } as const

    document.title = `AdepaPay | ${pageTitles[page]}`
  }, [page, role])

  if (page === "portal" && role) {
    if (role === "Field Agent")
      return (
        <FieldAgentPortal
          agentId={sessionStorage.getItem("adepapay-agent-id") || "AGT-0018"}
          onLogout={handleLogout}
        />
      )
    return (
      <CustomerPortal
        role={role}
        storeId={sessionStorage.getItem("adepapay-store-id") || "cytech-gadgets"}
        onLogout={handleLogout}
        onBrowseStores={() => setPage("browse-stores")}
        onBrowseProducts={() => setPage("browse-products")}
      />
    )
  }
  if (page === "services") {
    return (
      <Services
        onHome={() => setPage("home")}
        onBrowseStores={() => setPage("browse-stores")}
        onBrowseProducts={(service) => {
          if (service) sessionStorage.setItem("adepapay-product-service", service)
          else sessionStorage.removeItem("adepapay-product-service")
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
        onBack={() => setPage(role ? "portal" : "home")}
        onStoreDetails={() => setPage("store-details")}
        onBrowseProducts={() => setPage("browse-products")}
        onLogin={() => setPage("login")}
        onRegister={() => setPage("register")}
        onBecomePartner={() => setPage("store-registration")}
      />
    )
  }
  if (page === "store-details") {
    return (
      <StoreDetails
        onBack={() => setPage(role ? "portal" : "home")}
        onBrowseStores={() => setPage("browse-stores")}
        onBrowseProducts={() => setPage("browse-products")}
        onLogin={() => setPage("login")}
        onRegister={() => setPage("register")}
        onBecomePartner={() => setPage("store-registration")}
      />
    )
  }
  if (page === "browse-products") {
    return (
      <BrowseProducts
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
        onBrowseProducts={() => setPage("browse-products")}
        onRegister={() => setPage("register")}
        onLogin={handleLogin}
      />
    )
  }
  if (page === "otp") {
    return (
      <OTPVerification
        onBack={() => setPage("login")}
        onSuccess={() => setPage("home")}
      />
    )
  }
  if (page === "forgot-password") {
    return (
      <ForgotPassword
        onBack={() => setPage("login")}
        onLogin={() => setPage("login")}
      />
    )
  }
  if (page === "register") {
    return (
      <Register
        onBack={() => setPage("home")}
        onBrowseStores={() => setPage("browse-stores")}
        onBrowseProducts={() => setPage("browse-products")}
      />
    )
  }
  if (page === "store-registration") {
    return (
      <StoreRegistration
        onBack={() => setPage("home")}
        onLogin={() => setPage("login")}
      />
    )
  }
  return <Landing onNavigate={setPage} />
}

function Landing({
  onNavigate,
}: {
  onNavigate: (
    p: "services" | "browse-stores" | "browse-products" | "register" | "store-registration" | "login",
  ) => void
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [showBackTop, setShowBackTop] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [cookieAccepted, setCookieAccepted] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  useScrollReveal()

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20)
      setShowBackTop(window.scrollY > 400)
    }
    window.addEventListener("scroll", onScroll)
    const t = setTimeout(() => setShowToast(true), 3000)
    return () => {
      window.removeEventListener("scroll", onScroll)
      clearTimeout(t)
    }
  }, [])

  const scrollTop = useCallback(
    () => window.scrollTo({ top: 0, behavior: "smooth" }),
    [],
  )

  const NAV_LINKS = [
    "Home",
    "Browse Stores",
    "Products",
    "How It Works",
    "About Us",
    "Contact",
  ]

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
                    "Verified Stores",
                    "Secure Payments",
                    "Flexible Installments",
                    "Fast Approval",
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
                <HeroIllustration />
              </div>
            </div>
          </div>
        </section>

        {/* ── TRUSTED PARTNERS ──────────────────────────────────────────────── */}
        <section className="py-14 px-4 sm:px-6 lg:px-8 border-y border-gray-100">
          <div className="max-w-7xl mx-auto">
            <p className="text-center text-sm font-semibold tracking-widest uppercase text-gray-400 mb-8">
              Trusted by Leading Stores
            </p>
            <div className="flex flex-wrap justify-center items-center gap-8 lg:gap-12">
              {PARTNERS.map((p) => (
                <div
                  key={p}
                  className="text-lg font-bold tracking-tight transition-all duration-300 cursor-pointer"
                  style={{ color: "#C5CBD3", filter: "grayscale(1)" }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLElement).style.color = "#0B5FFF"
                    ;(e.currentTarget as HTMLElement).style.filter =
                      "grayscale(0)"
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLElement).style.color = "#C5CBD3"
                    ;(e.currentTarget as HTMLElement).style.filter =
                      "grayscale(1)"
                  }}
                >
                  {p}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── STATISTICS ────────────────────────────────────────────────────── */}
        <section
          className="py-20 px-4 sm:px-6 lg:px-8"
          style={{ background: "#F8FAFC" }}
        >
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12 reveal">
              <h2
                className="text-3xl sm:text-4xl font-bold mb-3"
                style={{ color: "#101828" }}
              >
                Platform at a Glance
              </h2>
              <p className="text-gray-500 max-w-lg mx-auto">
                Thousands of Ghanaians trust AdepaPay to buy smarter and live
                better.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="reveal" style={{ transitionDelay: "0s" }}>
                <StatCard
                  icon={<Icon.Store />}
                  target={120}
                  suffix="+"
                  label="Verified Stores"
                />
              </div>
              <div className="reveal" style={{ transitionDelay: "0.1s" }}>
                <StatCard
                  icon={<Icon.Package />}
                  target={5000}
                  suffix="+"
                  label="Products Available"
                />
              </div>
              <div className="reveal" style={{ transitionDelay: "0.2s" }}>
                <StatCard
                  icon={<Icon.Users />}
                  target={15000}
                  suffix="+"
                  label="Happy Customers"
                />
              </div>
              <div className="reveal" style={{ transitionDelay: "0.3s" }}>
                <StatCard
                  icon={<Icon.CreditCard />}
                  target={50}
                  suffix="M+"
                  label="Hire Purchases Processed"
                />
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
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {STORES.map((store, i) => (
                <div
                  key={store.id}
                  className="reveal"
                  style={{ transitionDelay: `${i * 0.07}s` }}
                >
                  <StoreCard store={store} />
                </div>
              ))}
            </div>
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
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {PRODUCTS.map((product, i) => (
                <div
                  key={product.id}
                  className="reveal"
                  style={{ transitionDelay: `${i * 0.07}s` }}
                >
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
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
                  desc: "Explore our marketplace of 120+ verified stores across Ghana. Filter by category, location, and rating.",
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
                  desc: "Complete a quick application in minutes. Our smart system reviews and approves most requests instantly.",
                },
                {
                  step: "04",
                  icon: <Icon.CreditCard />,
                  title: "Pay Monthly Until Ownership",
                  desc: "Receive your product after deposit payment. Pay monthly until it is fully yours — no hidden fees.",
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
                  title: "Verified Stores",
                  desc: "Every merchant undergoes rigorous verification before listing on our platform.",
                },
                {
                  icon: <Icon.Lock />,
                  title: "Secure Transactions",
                  desc: "Bank-level encryption and fraud protection on every payment.",
                },
                {
                  icon: <Icon.CreditCard />,
                  title: "Affordable Installments",
                  desc: "Plans designed to fit your income with no surprise charges.",
                },
                {
                  icon: <Icon.Bolt />,
                  title: "Fast Approval",
                  desc: "Most applications get an instant decision in under 3 minutes.",
                },
                {
                  icon: <Icon.Users />,
                  title: "Trusted Platform",
                  desc: "Over 15,000 happy customers and counting with a 4.8/5 satisfaction score.",
                },
                {
                  icon: <Icon.Chat />,
                  title: "Customer Support",
                  desc: "24/7 support via chat, phone, and email — always a human, never a bot.",
                },
                {
                  icon: <Icon.Calendar />,
                  title: "Flexible Plans",
                  desc: "Choose 3, 6, 9, or 12-month payment durations to suit your budget.",
                },
                {
                  icon: <Icon.Package />,
                  title: "Wide Selection",
                  desc: "Electronics, furniture, vehicles, fashion — over 5,000 products across all categories.",
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

        {/* ── TESTIMONIALS ──────────────────────────────────────────────────── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12 reveal">
              <p
                className="text-sm font-semibold uppercase tracking-widest mb-2"
                style={{ color: "#0B5FFF" }}
              >
                Social Proof
              </p>
              <h2
                className="text-3xl sm:text-4xl font-bold mb-3"
                style={{ color: "#101828" }}
              >
                What Customers Say
              </h2>
              <p className="text-gray-500 max-w-md mx-auto">
                Real reviews from real Ghanaians who own their products through
                AdepaPay.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {TESTIMONIALS.map((t, i) => (
                <div
                  key={t.id}
                  className="card-lift reveal bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col"
                  style={{ transitionDelay: `${i * 0.1}s` }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <img
                      src={t.avatar}
                      alt={t.name}
                      className="w-12 h-12 rounded-full object-cover border-2 border-blue-100"
                    />
                    <div>
                      <p
                        className="font-semibold text-sm"
                        style={{ color: "#101828" }}
                      >
                        {t.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {t.product} · {t.store}
                      </p>
                    </div>
                  </div>
                  <StarRating rating={t.rating} />
                  <p className="text-sm text-gray-600 leading-relaxed mt-3 flex-1">
                    "{t.review}"
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
                  <MerchantIllustration />
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
                    Join hundreds of verified merchants and sell more through
                    flexible hire purchase. AdepaPay handles the financing — you
                    just ship the products.
                  </p>
                  <ul className="space-y-3 mb-8">
                    {[
                      "Get paid upfront — AdepaPay handles installments",
                      "Reach 15,000+ active customers",
                      "Real-time dashboard with full analytics",
                      "Zero risk: we verify customer creditworthiness",
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
              Join over 15,000 Ghanaians who already own their dream products
              through AdepaPay. Start with zero paperwork in under 5 minutes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="btn-ripple px-8 py-3.5 rounded-xl font-semibold text-sm text-blue-700 bg-white hover:bg-blue-50 transition-all">
                Browse Products
              </button>
              <button className="btn-ripple px-8 py-3.5 rounded-xl font-semibold text-sm text-white border-2 border-white/40 hover:border-white hover:bg-white/10 transition-all">
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
                {/* Newsletter */}
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="Enter your email"
                    className="flex-1 px-3 py-2.5 rounded-xl text-sm bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <button
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                    style={{ background: "#0B5FFF" }}
                  >
                    Subscribe
                  </button>
                </div>
              </div>
              {/* Links */}
              {[
                {
                  title: "Company",
                  links: ["About", "Careers", "Blog", "Press"],
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
              <div className="flex items-center gap-3">
                {/* Social icons */}
                {[
                  {
                    label: "Facebook",
                    path: "M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z",
                  },
                  {
                    label: "LinkedIn",
                    path: "M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z M4 6a2 2 0 100-4 2 2 0 000 4z",
                  },
                ].map((s) => (
                  <a
                    key={s.label}
                    href="#"
                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-800 text-gray-400 hover:bg-blue-600 hover:text-white transition-all"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d={s.path} />
                    </svg>
                  </a>
                ))}
                {/* Instagram */}
                <a
                  href="#"
                  className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-800 text-gray-400 hover:bg-blue-600 hover:text-white transition-all"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <rect
                      x="2"
                      y="2"
                      width="20"
                      height="20"
                      rx="5"
                      ry="5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"
                    />
                    <line
                      x1="17.5"
                      y1="6.5"
                      x2="17.51"
                      y2="6.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </a>
                {/* X */}
                <a
                  href="#"
                  className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-800 text-gray-400 hover:bg-blue-600 hover:text-white transition-all"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </footer>
      </main>

      {/* ── FLOATING COMPONENTS ──────────────────────────────────────────────── */}

      {/* Live Chat */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
        {chatOpen && (
          <div className="w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden mb-2">
            <div
              className="flex items-center gap-3 px-4 py-3 text-white"
              style={{ background: "#0B5FFF" }}
            >
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Icon.Chat />
              </div>
              <div>
                <p className="text-sm font-semibold">AdepaPay Support</p>
                <p className="text-xs opacity-80">
                  ● Online · Typically replies instantly
                </p>
              </div>
              <button
                className="ml-auto text-white/70 hover:text-white"
                onClick={() => setChatOpen(false)}
              >
                <Icon.X />
              </button>
            </div>
            <div className="p-4">
              <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600 mb-3">
                Hi there! Welcome to AdepaPay. How can we help you today?
              </div>
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 transition-colors"
                placeholder="Type your message..."
              />
            </div>
          </div>
        )}
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className="btn-ripple w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-white transition-all hover:scale-105"
          style={{ background: "#0B5FFF" }}
        >
          {chatOpen ? <Icon.X /> : <Icon.Chat />}
        </button>
      </div>

      {/* Back to Top */}
      <button
        onClick={scrollTop}
        className="fixed left-6 bottom-6 z-40 w-10 h-10 rounded-full shadow-lg flex items-center justify-center text-white transition-all duration-300 hover:scale-110"
        style={{
          background: "#101828",
          opacity: showBackTop ? 1 : 0,
          pointerEvents: showBackTop ? "auto" : "none",
        }}
      >
        <Icon.ArrowUp />
      </button>

      {/* Toast */}
      <Toast visible={showToast} onClose={() => setShowToast(false)} />

      {/* Cookie Banner */}
      {!cookieAccepted && (
        <CookieBanner onAccept={() => setCookieAccepted(true)} />
      )}
    </div>
  )
}
