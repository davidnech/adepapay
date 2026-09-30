import { useState, useEffect, useRef, useCallback } from "react"

// ─── Types ────────────────────────────────────────────────────────────────────
import { formatCurrency, GHANA_REGION_CAPITALS } from "../lib/localization"
import PublicNavbar from "../components/PublicNavbar"

interface Store {
  id: number
  name: string
  category: string
  location: string
  rating: number
  reviews: number
  products: number
  sold: number
  responseTime: string
  approvalTime: string
  yearsOnPlatform: number
  startingMonthly: number
  description: string
  verified: boolean
  featured: boolean
  badges: string[]
  image: string
  logo: string
}

type SortKey = "popular" | "rated" | "newest" | "alpha" | "products"
type PageView = "grid" | "empty" | "error" | "loading"

// ─── Data ─────────────────────────────────────────────────────────────────────
const ALL_STORES: Store[] = [
  {
    id: 1,
    name: "TechWorld Electronics",
    category: "Electronics",
    location: "Osu, Accra",
    rating: 4.9,
    reviews: 1284,
    products: 248,
    sold: 4320,
    responseTime: "< 1 hour",
    approvalTime: "2 min",
    yearsOnPlatform: 3,
    startingMonthly: 12000,
    description:
      "Premium electronics retailer stocking the latest smartphones, TVs, laptops and accessories from global brands.",
    verified: true,
    featured: true,
    badges: ["Verified", "Top Rated", "Featured"],
    image:
      "https://images.unsplash.com/photo-1491933382434-500287f9b54b?w=700&h=280&fit=crop&auto=format",
    logo: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=80&h=80&fit=crop&auto=format",
  },
  {
    id: 2,
    name: "HomeStyle Furniture",
    category: "Furniture",
    location: "Adum, Kumasi",
    rating: 4.7,
    reviews: 892,
    products: 182,
    sold: 2100,
    responseTime: "< 2 hours",
    approvalTime: "5 min",
    yearsOnPlatform: 2,
    startingMonthly: 18000,
    description:
      "Curated modern furniture and home decor for every budget. From minimalist to opulent — we have your style.",
    verified: true,
    featured: true,
    badges: ["Verified", "Top Rated"],
    image:
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=700&h=280&fit=crop&auto=format",
    logo: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=80&h=80&fit=crop&auto=format",
  },
  {
    id: 3,
    name: "AutoDrive Motors",
    category: "Motorbikes",
    location: "Community 1, Tema",
    rating: 4.8,
    reviews: 543,
    products: 94,
    sold: 876,
    responseTime: "< 3 hours",
    approvalTime: "10 min",
    yearsOnPlatform: 4,
    startingMonthly: 45000,
    description:
      "Authorised dealer for Yamaha, Honda, TVS and Bajaj motorcycles with comprehensive after-sales service.",
    verified: true,
    featured: false,
    badges: ["Verified", "Fast Approval"],
    image:
      "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=700&h=280&fit=crop&auto=format",
    logo: "https://images.unsplash.com/photo-1607853202273-797f1c22a38e?w=80&h=80&fit=crop&auto=format",
  },
  {
    id: 4,
    name: "FashionHub Boutique",
    category: "Fashion",
    location: "East Legon, Accra",
    rating: 4.6,
    reviews: 2108,
    products: 310,
    sold: 8900,
    responseTime: "< 1 hour",
    approvalTime: "3 min",
    yearsOnPlatform: 2,
    startingMonthly: 8500,
    description:
      "Luxury and contemporary fashion for men and women. New arrivals weekly. Free styling consultations.",
    verified: true,
    featured: true,
    badges: ["Verified", "Trending", "Featured"],
    image:
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=700&h=280&fit=crop&auto=format",
    logo: "https://images.unsplash.com/photo-1600180758890-6b94519a8ba6?w=80&h=80&fit=crop&auto=format",
  },
  {
    id: 5,
    name: "SmartHome Appliances",
    category: "Home Appliances",
    location: "Takoradi, Western Region",
    rating: 4.9,
    reviews: 672,
    products: 156,
    sold: 3200,
    responseTime: "< 30 min",
    approvalTime: "2 min",
    yearsOnPlatform: 1,
    startingMonthly: 15000,
    description:
      "Smart kitchen and home appliances. We carry LG, Samsung, Hisense, Midea and more with full warranty.",
    verified: true,
    featured: false,
    badges: ["Verified", "Fast Approval", "New Store"],
    image:
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=700&h=280&fit=crop&auto=format",
    logo: "https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=80&h=80&fit=crop&auto=format",
  },
  {
    id: 6,
    name: "PhoneZone Ghana",
    category: "Phones",
    location: "Circle, Accra",
    rating: 4.5,
    reviews: 3421,
    products: 420,
    sold: 12000,
    responseTime: "< 1 hour",
    approvalTime: "4 min",
    yearsOnPlatform: 5,
    startingMonthly: 9000,
    description:
      "One of Ghana's largest phone retailers. Genuine iPhones, Samsungs, Tecno, Infinix and every accessory imaginable.",
    verified: true,
    featured: false,
    badges: ["Verified", "Top Rated", "Trending"],
    image:
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=700&h=280&fit=crop&auto=format",
    logo: "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=80&h=80&fit=crop&auto=format",
  },
  {
    id: 7,
    name: "LaptopCity Pro",
    category: "Laptops",
    location: "KNUST Junction, Kumasi",
    rating: 4.7,
    reviews: 987,
    products: 134,
    sold: 2400,
    responseTime: "< 2 hours",
    approvalTime: "5 min",
    yearsOnPlatform: 3,
    startingMonthly: 22000,
    description:
      "Specialists in business and gaming laptops. Apple, Dell, HP, Lenovo and Asus — all with certified warranties.",
    verified: true,
    featured: false,
    badges: ["Verified", "Fast Approval"],
    image:
      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=700&h=280&fit=crop&auto=format",
    logo: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=80&h=80&fit=crop&auto=format",
  },
  {
    id: 8,
    name: "GlowUp Beauty Store",
    category: "Beauty",
    location: "Airport Residential, Accra",
    rating: 4.4,
    reviews: 1560,
    products: 285,
    sold: 6700,
    responseTime: "< 1 hour",
    approvalTime: "3 min",
    yearsOnPlatform: 2,
    startingMonthly: 5000,
    description:
      "Premium skincare, cosmetics and haircare products. 100% authentic brands from international suppliers.",
    verified: true,
    featured: false,
    badges: ["Verified", "Trending"],
    image:
      "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=700&h=280&fit=crop&auto=format",
    logo: "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=80&h=80&fit=crop&auto=format",
  },
  {
    id: 9,
    name: "MegaMart Superstore",
    category: "Supermarket",
    location: "Tamale Central",
    rating: 4.3,
    reviews: 441,
    products: 890,
    sold: 15000,
    responseTime: "< 4 hours",
    approvalTime: "8 min",
    yearsOnPlatform: 1,
    startingMonthly: 6000,
    description:
      "Your one-stop supermarket for groceries, household goods, baby products and bulk orders. Same-day delivery.",
    verified: true,
    featured: false,
    badges: ["Verified", "New Store"],
    image:
      "https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=700&h=280&fit=crop&auto=format",
    logo: "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=80&h=80&fit=crop&auto=format",
  },
]

const CATEGORIES = [
  { name: "Electronics", emoji: "💻", count: 18 },
  { name: "Phones", emoji: "📱", count: 24 },
  { name: "Laptops", emoji: "🖥️", count: 12 },
  { name: "Furniture", emoji: "🛋️", count: 15 },
  { name: "Home Appliances", emoji: "🏠", count: 21 },
  { name: "Fashion", emoji: "👗", count: 30 },
  { name: "Beauty", emoji: "💄", count: 16 },
  { name: "Motorbikes", emoji: "🏍️", count: 9 },
  { name: "Supermarket", emoji: "🛒", count: 7 },
  { name: "Accessories", emoji: "💎", count: 11 },
]

const LOCATIONS = GHANA_REGION_CAPITALS

const BADGE_STYLES: Record<string, { bg: string text: string }> = {
  Verified: { bg: "#ECFDF3", text: "#027A48" },
  "Top Rated": { bg: "#EFF8FF", text: "#175CD3" },
  Featured: { bg: "#FFF8E6", text: "#92400E" },
  "Fast Approval": { bg: "#F0FDF4", text: "#166534" },
  "New Store": { bg: "#F5F3FF", text: "#5B21B6" },
  Trending: { bg: "#FFF1F3", text: "#C01048" },
}

function formatNaira(n: number) {
  return formatCurrency(n)
}

// ─── Shared sub-components ────────────────────────────────────────────────────
function StarRating({ rating, small }: { rating: number small?: boolean }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          key={s}
          className={small ? "w-3 h-3" : "w-4 h-4"}
          fill={s <= Math.round(rating) ? "#F79009" : "#E5E7EB"}
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

function Badge({ label }: { label: string }) {
  const style = BADGE_STYLES[label] ?? { bg: "#F3F4F6", text: "#374151" }
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: style.bg, color: style.text }}
    >
      {label === "Verified" && (
        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      )}
      {label}
    </span>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
      <div className="skeleton h-36 w-full" />
      <div className="p-4 space-y-3">
        <div className="skeleton h-4 rounded-lg w-3/4" />
        <div className="skeleton h-3 rounded-lg w-1/2" />
        <div className="skeleton h-3 rounded-lg w-full" />
        <div className="skeleton h-3 rounded-lg w-2/3" />
        <div className="flex gap-2 pt-2">
          <div className="skeleton h-8 rounded-xl flex-1" />
          <div className="skeleton h-8 rounded-xl flex-1" />
        </div>
      </div>
    </div>
  )
}

// ─── Full Store Card ──────────────────────────────────────────────────────────
function StoreCard({ store, onView }: { store: Store onView?: () => void }) {
  const [saved, setSaved] = useState(false)
  return (
    <div className="card-lift group bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm flex flex-col">
      {/* Banner */}
      <div className="relative h-36 bg-blue-50 overflow-hidden flex-shrink-0">
        <img
          src={store.image}
          alt={store.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        {/* Logo */}
        <div className="absolute bottom-3 left-3">
          <img
            src={store.logo}
            alt=""
            className="w-10 h-10 rounded-xl border-2 border-white object-cover shadow-md"
          />
        </div>
        {/* Top right actions */}
        <div className="absolute top-3 right-3 flex gap-1.5">
          <button
            onClick={() => setSaved(!saved)}
            className="w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm transition-transform hover:scale-110"
          >
            <svg
              className={`w-3.5 h-3.5 transition-colors ${
                saved ? "fill-blue-600 text-blue-600" : "text-gray-500"
              }`}
              fill={saved ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
          </button>
          <button className="w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm hover:scale-110 transition-transform">
            <svg
              className="w-3.5 h-3.5 text-gray-500"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"
              />
            </svg>
          </button>
        </div>
        {/* Featured label */}
        {store.featured && (
          <div
            className="absolute top-3 left-3 text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: "#D4A017", color: "#fff" }}
          >
            ✦ Featured
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col gap-2.5 flex-1">
        {/* Badges */}
        <div className="flex flex-wrap gap-1">
          {store.badges.map((b) => (
            <Badge key={b} label={b} />
          ))}
        </div>

        <div>
          <h3 className="font-bold text-sm text-gray-900 leading-tight">
            {store.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className="text-xs font-medium px-1.5 py-0.5 rounded-full"
              style={{ background: "#EAF2FF", color: "#0B5FFF" }}
            >
              {store.category}
            </span>
            <span className="text-xs text-gray-400 flex items-center gap-0.5">
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              {store.location}
            </span>
          </div>
        </div>

        <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2">
          {store.description}
        </p>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-1.5">
          {[
            {
              label: "Rating",
              value: `${store.rating} (${store.reviews.toLocaleString()})`,
            },
            { label: "Products", value: store.products.toString() },
            { label: "Response", value: store.responseTime },
            { label: "Approval", value: store.approvalTime },
          ].map((s) => (
            <div key={s.label} className="bg-gray-50 rounded-lg px-2 py-1.5">
              <div className="text-[9px] text-gray-400 font-medium">
                {s.label}
              </div>
              <div className="text-[11px] font-semibold text-gray-800 truncate">
                {s.value}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-[11px] pt-0.5">
          <span className="text-gray-400">
            {store.yearsOnPlatform}yr{store.yearsOnPlatform > 1 ? "s" : ""} on
            AdepaPay
          </span>
          <span className="font-semibold" style={{ color: "#12B76A" }}>
            From {formatNaira(store.startingMonthly)}/mo
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 grid grid-cols-2 gap-2 flex-shrink-0">
        <button
          onClick={onView}
          className="py-2 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90"
          style={{ background: "#0B5FFF" }}
        >
          View Store
        </button>
        <button
          className="py-2 rounded-xl text-xs font-semibold border-2 transition-all hover:bg-blue-50"
          style={{ borderColor: "#0B5FFF", color: "#0B5FFF" }}
        >
          Browse Products
        </button>
      </div>
    </div>
  )
}

// ─── Featured Store Card (wider) ─────────────────────────────────────────────
function FeaturedStoreCard({
  store,
  onView,
}: {
  store: Store
  onView?: () => void
}) {
  const [saved, setSaved] = useState(false)
  return (
    <div className="card-lift flex-shrink-0 w-80 bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm flex flex-col">
      <div className="relative h-44 bg-blue-50 overflow-hidden flex-shrink-0">
        <img
          src={store.image}
          alt={store.name}
          className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute bottom-3 left-3">
          <img
            src={store.logo}
            alt=""
            className="w-12 h-12 rounded-xl border-2 border-white object-cover shadow"
          />
        </div>
        <div className="absolute top-3 right-3 flex gap-1.5">
          <button
            onClick={() => setSaved(!saved)}
            className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm hover:scale-110 transition-transform"
          >
            <svg
              className={`w-4 h-4 ${
                saved ? "fill-blue-600 text-blue-600" : "text-gray-500"
              }`}
              fill={saved ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
          </button>
        </div>
        <div className="absolute top-3 left-3">
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
            style={{ background: "linear-gradient(90deg, #D4A017, #F59E0B)" }}
          >
            ✦ Featured Store
          </span>
        </div>
      </div>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex flex-wrap gap-1">
          {store.badges.slice(0, 3).map((b) => (
            <Badge key={b} label={b} />
          ))}
        </div>
        <h3 className="font-bold text-sm text-gray-900">{store.name}</h3>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span
            className="px-1.5 py-0.5 rounded-full font-medium"
            style={{ background: "#EAF2FF", color: "#0B5FFF" }}
          >
            {store.category}
          </span>
          <span>{store.location}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <StarRating rating={store.rating} small />
          <span className="text-xs font-semibold text-gray-700">
            {store.rating}
          </span>
          <span className="text-xs text-gray-400">
            ({store.reviews.toLocaleString()} reviews)
          </span>
        </div>
        <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2">
          {store.description}
        </p>
        <div className="flex justify-between text-xs pt-1">
          <span className="text-gray-400">
            {store.products} products · {store.sold.toLocaleString()} sold
          </span>
          <span className="font-semibold" style={{ color: "#12B76A" }}>
            From {formatNaira(store.startingMonthly)}/mo
          </span>
        </div>
      </div>
      <div className="px-4 pb-4 grid grid-cols-2 gap-2">
        <button
          onClick={onView}
          className="py-2 rounded-xl text-xs font-semibold text-white"
          style={{ background: "#0B5FFF" }}
        >
          View Store
        </button>
        <button
          className="py-2 rounded-xl text-xs font-semibold border-2"
          style={{ borderColor: "#0B5FFF", color: "#0B5FFF" }}
        >
          Browse Products
        </button>
      </div>
    </div>
  )
}

// ─── Filter Sidebar ───────────────────────────────────────────────────────────
function FilterSidebar({
  selectedCats,
  setSelectedCats,
  selectedLocation,
  setSelectedLocation,
  verifiedOnly,
  setVerifiedOnly,
  minRating,
  setMinRating,
  openNow,
  setOpenNow,
  sortBy,
  setSortBy,
  onClear,
  onApply,
  mobile,
  onClose,
}: {
  selectedCats: string[]
  setSelectedCats: (v: string[]) => void
  selectedLocation: string
  setSelectedLocation: (v: string) => void
  verifiedOnly: boolean
  setVerifiedOnly: (v: boolean) => void
  minRating: number
  setMinRating: (v: number) => void
  openNow: boolean
  setOpenNow: (v: boolean) => void
  sortBy: SortKey
  setSortBy: (v: SortKey) => void
  onClear: () => void
  onApply: () => void
  mobile?: boolean
  onClose?: () => void
}) {
  const toggleCat = (cat: string) => {
    setSelectedCats(
      selectedCats.includes(cat)
        ? selectedCats.filter((c) => c !== cat)
        : [...selectedCats, cat],
    )
  }

  const content = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-5 flex-shrink-0">
        <h2 className="font-bold text-base text-gray-900">Filters</h2>
        {mobile && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
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
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-5 pr-1">
        {/* Sort By */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
            Sort By
          </h3>
          <div className="space-y-1">
            {([
              ["popular", "Most Popular"],
              ["rated", "Highest Rated"],
              ["newest", "Newest"],
              ["alpha", "Alphabetical"],
              ["products", "Most Products"],
            ] as [SortKey, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all text-left"
                style={{
                  background: sortBy === key ? "#EAF2FF" : "transparent",
                  color: sortBy === key ? "#0B5FFF" : "#374151",
                  fontWeight: sortBy === key ? "600" : "400",
                }}
              >
                {sortBy === key && (
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0" />
                )}
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Category */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
            Category
          </h3>
          <div className="space-y-1">
            {CATEGORIES.map((cat) => (
              <label
                key={cat.name}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedCats.includes(cat.name)}
                  onChange={() => toggleCat(cat.name)}
                  className="w-3.5 h-3.5 rounded accent-blue-600"
                />
                <span className="text-sm text-gray-700 flex-1">
                  {cat.emoji} {cat.name}
                </span>
                <span className="text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                  {cat.count}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Location */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
            Location
          </h3>
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-400 transition-colors bg-white"
          >
            <option value="">All Locations</option>
            {LOCATIONS.map(({ region, capital }) => (
              <option key={region} value={capital}>
                {region}: {capital}
              </option>
            ))}
          </select>
        </div>

        {/* Ratings */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
            Minimum Rating
          </h3>
          <div className="space-y-1">
            {[5, 4, 3].map((r) => (
              <button
                key={r}
                onClick={() => setMinRating(r === minRating ? 0 : r)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-all"
                style={{
                  background: minRating === r ? "#EAF2FF" : "transparent",
                }}
              >
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <svg
                      key={s}
                      className="w-3.5 h-3.5"
                      fill={s <= r ? "#F79009" : "#E5E7EB"}
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="text-xs text-gray-500">& above</span>
              </button>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
            Options
          </h3>
          <div className="space-y-2">
            {[
              {
                label: "Verified Stores Only",
                value: verifiedOnly,
                set: setVerifiedOnly,
              },
              { label: "Open Now", value: openNow, set: setOpenNow },
            ].map(({ label, value, set }) => (
              <label
                key={label}
                className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <span className="text-sm text-gray-700">{label}</span>
                <button
                  onClick={() => set(!value)}
                  className="relative w-9 h-5 rounded-full transition-all flex-shrink-0"
                  style={{ background: value ? "#0B5FFF" : "#D1D5DB" }}
                >
                  <div
                    className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200"
                    style={{ left: value ? "calc(100% - 18px)" : "2px" }}
                  />
                </button>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t border-gray-100 mt-4 flex-shrink-0">
        <button
          onClick={onClear}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Clear All
        </button>
        <button
          onClick={onApply}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ background: "#0B5FFF" }}
        >
          Apply Filters
        </button>
      </div>
    </div>
  )

  if (mobile) {
    return <div className="h-full bg-white p-5 overflow-y-auto">{content}</div>
  }

  return (
    <div className="w-64 flex-shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sticky top-20 max-h-[calc(100vh-96px)] overflow-hidden flex flex-col">
      {content}
    </div>
  )
}

// ─── Empty / Error States ─────────────────────────────────────────────────────
function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-6xl mb-4">🔍</div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">No Stores Found</h3>
      <p className="text-gray-500 text-sm max-w-xs mb-6">
        We couldn't find any stores matching your search. Try adjusting your
        filters or search term.
      </p>
      <button
        onClick={onReset}
        className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
        style={{ background: "#0B5FFF" }}
      >
        Reset Filters
      </button>
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-6xl mb-4">⚠️</div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">
        Unable to Load Stores
      </h3>
      <p className="text-gray-500 text-sm max-w-xs mb-6">
        Please check your internet connection or try again later. We're working
        to fix this quickly.
      </p>
      <button
        onClick={onRetry}
        className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
        style={{ background: "#0B5FFF" }}
      >
        Try Again
      </button>
    </div>
  )
}

// ─── Pagination ───────────────────────────────────────────────────────────────
function Pagination({
  current,
  total,
  onChange,
}: {
  current: number
  total: number
  onChange: (p: number) => void
}) {
  const pages = Array.from({ length: total }, (_, i) => i + 1)
  const visible = pages.filter(
    (p) => p === 1 || p === total || Math.abs(p - current) <= 1,
  )

  return (
    <div className="flex items-center justify-center gap-1.5 mt-10">
      <button
        onClick={() => onChange(current - 1)}
        disabled={current === 1}
        className="px-3 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition-colors disabled:cursor-not-allowed"
      >
        ← Previous
      </button>
      {visible.map((p, i) => {
        const prev = visible[i - 1]
        return (
          <div key={p} className="contents">
            {prev && p - prev > 1 && (
              <span className="px-2 text-gray-400">…</span>
            )}
            <button
              onClick={() => onChange(p)}
              className="w-9 h-9 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: p === current ? "#0B5FFF" : "transparent",
                color: p === current ? "#fff" : "#374151",
                border: p === current ? "none" : "1px solid #E5E7EB",
              }}
            >
              {p}
            </button>
          </div>
        )
      })}
      <button
        onClick={() => onChange(current + 1)}
        disabled={current === total}
        className="px-3 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition-colors disabled:cursor-not-allowed"
      >
        Next →
      </button>
    </div>
  )
}

// ─── BrowseStores Page ────────────────────────────────────────────────────────
export default function BrowseStores({
  onBack,
  onStoreDetails,
  onBrowseProducts,
  onLogin,
  onRegister,
  onBecomePartner,
}: {
  onBack: () => void
  onStoreDetails?: () => void
  onBrowseProducts: () => void
  onLogin: () => void
  onRegister: () => void
  onBecomePartner: () => void
}) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedCats, setSelectedCats] = useState<string[]>([])
  const [selectedLocation, setSelectedLocation] = useState("")
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [minRating, setMinRating] = useState(0)
  const [openNow, setOpenNow] = useState(false)
  const [sortBy, setSortBy] = useState<SortKey>("popular")
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [view, setView] = useState<PageView>("grid")
  const carouselRef = useRef<HTMLDivElement>(null)

  const STORES_PER_PAGE = 6

  // Scroll handler
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Scroll reveal
  useEffect(() => {
    const els = document.querySelectorAll(".reveal")
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting)
            (e.target as HTMLElement).classList.add("visible")
        })
      },
      { threshold: 0.12 },
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  })

  // Filtering
  const filteredStores = ALL_STORES.filter((s) => {
    if (
      search &&
      !s.name.toLowerCase().includes(search.toLowerCase()) &&
      !s.category.toLowerCase().includes(search.toLowerCase()) &&
      !s.location.toLowerCase().includes(search.toLowerCase())
    )
      return false
    if (selectedCats.length && !selectedCats.includes(s.category)) return false
    if (activeCat && s.category !== activeCat) return false
    if (selectedLocation && !s.location.includes(selectedLocation)) return false
    if (verifiedOnly && !s.verified) return false
    if (minRating && s.rating < minRating) return false
    return true
  }).sort((a, b) => {
    if (sortBy === "rated") return b.rating - a.rating
    if (sortBy === "alpha") return a.name.localeCompare(b.name)
    if (sortBy === "products") return b.products - a.products
    return b.reviews - a.reviews
  })

  const totalPages = Math.ceil(filteredStores.length / STORES_PER_PAGE)
  const pagedStores = filteredStores.slice(
    (currentPage - 1) * STORES_PER_PAGE,
    currentPage * STORES_PER_PAGE,
  )
  const featuredStores = ALL_STORES.filter((s) => s.featured)

  const clearFilters = useCallback(() => {
    setSearch("")
    setSelectedCats([])
    setSelectedLocation("")
    setVerifiedOnly(false)
    setMinRating(0)
    setOpenNow(false)
    setSortBy("popular")
    setActiveCat(null)
    setCurrentPage(1)
  }, [])

  const activeFilterCount =
    selectedCats.length +
    (selectedLocation ? 1 : 0) +
    (verifiedOnly ? 1 : 0) +
    (minRating ? 1 : 0) +
    (openNow ? 1 : 0)

  const scroll = (dir: "left" | "right") => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({
        left: dir === "left" ? -340 : 340,
        behavior: "smooth",
      })
    }
  }

  const NAV_LINKS = [
    "Home",
    "Browse Stores",
    "Products",
    "How It Works",
    "About",
    "Contact",
  ]

  return (
    <div className="min-h-screen bg-white font-sans">
      <PublicNavbar
        active="stores"
        onHome={onBack}
        onBrowseStores={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        onBrowseProducts={onBrowseProducts}
        onLogin={onLogin}
        onRegister={onRegister}
        onBecomePartner={onBecomePartner}
      />

      {/* ── NAV ──────────────────────────────────────────────────────────── */}

      {/* ── PAGE HEADER ──────────────────────────────────────────────────── */}
      <section
        className="pt-28 pb-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, #0B5FFF 0%, #1E3A8A 60%, #101828 100%)",
        }}
      >
        {/* Abstract grid decoration */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at center, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div
          className="absolute top-10 right-20 w-64 h-64 rounded-full opacity-10"
          style={{
            background: "radial-gradient(circle, #fff 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-0 left-10 w-40 h-40 rounded-full opacity-8"
          style={{
            background: "radial-gradient(circle, #D4A017 0%, transparent 70%)",
          }}
        />

        <div className="max-w-3xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-5 bg-white/20 text-white backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            120+ Verified Stores Online
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 tracking-tight leading-tight">
            Browse Verified Stores
          </h1>
          <p className="text-lg text-blue-200 mb-8 max-w-xl mx-auto leading-relaxed">
            Find trusted stores across different categories and shop confidently
            with flexible installment payment options.
          </p>

          {/* Search */}
          <div className="bg-white rounded-2xl shadow-xl p-2 flex gap-2 max-w-2xl mx-auto">
            <div className="flex-1 flex items-center gap-3 px-3">
              <svg
                className="w-5 h-5 text-gray-400 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <circle cx="11" cy="11" r="8" />
                <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setCurrentPage(1)
                }}
                placeholder="Search stores by name, category or location..."
                className="flex-1 text-sm text-gray-700 placeholder-gray-400 focus:outline-none"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="text-gray-300 hover:text-gray-500 transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" />
                    <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
            <button
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white flex-shrink-0 hover:opacity-90 transition-all"
              style={{ background: "#0B5FFF" }}
            >
              Search
            </button>
          </div>
        </div>
      </section>

      {/* ── CATEGORY PILLS ───────────────────────────────────────────────── */}
      <section className="py-8 px-4 sm:px-6 lg:px-8 border-b border-gray-100 bg-white sticky top-16 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto">
          <div
            className="flex gap-2 overflow-x-auto pb-1"
            style={{ scrollbarWidth: "none" }}
          >
            <button
              onClick={() => {
                setActiveCat(null)
                setCurrentPage(1)
              }}
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all"
              style={{
                background: !activeCat ? "#0B5FFF" : "#F3F4F6",
                color: !activeCat ? "#fff" : "#374151",
              }}
            >
              All Stores
              <span className="text-[11px] font-bold opacity-70">
                {ALL_STORES.length}
              </span>
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.name}
                onClick={() => {
                  setActiveCat(activeCat === cat.name ? null : cat.name)
                  setCurrentPage(1)
                }}
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all"
                style={{
                  background: activeCat === cat.name ? "#0B5FFF" : "#F3F4F6",
                  color: activeCat === cat.name ? "#fff" : "#374151",
                }}
              >
                {cat.emoji} {cat.name}
                <span className="text-[11px] font-bold opacity-70">
                  {cat.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* ── FEATURED STORES CAROUSEL ──────────────────────────────────── */}
        <section className="mb-12 reveal">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-widest mb-1"
                style={{ color: "#0B5FFF" }}
              >
                Hand-picked
              </p>
              <h2 className="text-2xl font-bold" style={{ color: "#101828" }}>
                Featured Stores
              </h2>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => scroll("left")}
                className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <polyline
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points="15 18 9 12 15 6"
                  />
                </svg>
              </button>
              <button
                onClick={() => scroll("right")}
                className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <polyline
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points="9 18 15 12 9 6"
                  />
                </svg>
              </button>
            </div>
          </div>
          <div
            ref={carouselRef}
            className="flex gap-4 overflow-x-auto pb-2"
            style={{ scrollbarWidth: "none" }}
          >
            {featuredStores.map((store) => (
              <FeaturedStoreCard
                key={store.id}
                store={store}
                onView={onStoreDetails}
              />
            ))}
          </div>
        </section>

        {/* ── FILTERS + GRID ────────────────────────────────────────────── */}
        <div className="flex gap-6 items-start">
          {/* Desktop Sidebar */}
          <div className="hidden lg:block">
            <FilterSidebar
              selectedCats={selectedCats}
              setSelectedCats={setSelectedCats}
              selectedLocation={selectedLocation}
              setSelectedLocation={setSelectedLocation}
              verifiedOnly={verifiedOnly}
              setVerifiedOnly={setVerifiedOnly}
              minRating={minRating}
              setMinRating={setMinRating}
              openNow={openNow}
              setOpenNow={setOpenNow}
              sortBy={sortBy}
              setSortBy={setSortBy}
              onClear={clearFilters}
              onApply={() => {}}
            />
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <span className="text-sm text-gray-500">
                  Showing{" "}
                  <span className="font-semibold text-gray-900">
                    {filteredStores.length}
                  </span>{" "}
                  store{filteredStores.length !== 1 ? "s" : ""}
                  {search && (
                    <span className="text-gray-400"> for "{search}"</span>
                  )}
                </span>
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="ml-3 text-xs font-semibold hover:underline"
                    style={{ color: "#0B5FFF" }}
                  >
                    Clear {activeFilterCount} filter
                    {activeFilterCount > 1 ? "s" : ""}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* State toggle for demo */}
                <div className="hidden sm:flex gap-1 p-1 bg-gray-100 rounded-xl">
                  {(["grid", "loading", "empty", "error"] as PageView[]).map(
                    (v) => (
                      <button
                        key={v}
                        onClick={() => setView(v)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all capitalize"
                        style={{
                          background: view === v ? "#fff" : "transparent",
                          color: view === v ? "#0B5FFF" : "#6B7280",
                          boxShadow:
                            view === v ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                        }}
                      >
                        {v}
                      </button>
                    ),
                  )}
                </div>
                {/* Mobile filter button */}
                <button
                  onClick={() => setMobileFilterOpen(true)}
                  className="lg:hidden flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <line x1="4" y1="6" x2="20" y2="6" strokeLinecap="round" />
                    <line
                      x1="8"
                      y1="12"
                      x2="16"
                      y2="12"
                      strokeLinecap="round"
                    />
                    <line
                      x1="11"
                      y1="18"
                      x2="13"
                      y2="18"
                      strokeLinecap="round"
                    />
                  </svg>
                  Filters
                  {activeFilterCount > 0 && (
                    <span
                      className="w-4 h-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                      style={{ background: "#0B5FFF" }}
                    >
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* States */}
            {view === "loading" && (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            )}

            {view === "empty" && (
              <EmptyState
                onReset={() => {
                  clearFilters()
                  setView("grid")
                }}
              />
            )}
            {view === "error" && <ErrorState onRetry={() => setView("grid")} />}

            {view === "grid" && (
              <>
                {pagedStores.length === 0 ? (
                  <EmptyState onReset={clearFilters} />
                ) : (
                  <>
                    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {pagedStores.map((store, i) => (
                        <div
                          key={store.id}
                          className="reveal"
                          style={{ transitionDelay: `${i * 0.06}s` }}
                        >
                          <StoreCard store={store} onView={onStoreDetails} />
                        </div>
                      ))}
                    </div>
                    {totalPages > 1 && (
                      <Pagination
                        current={currentPage}
                        total={totalPages}
                        onChange={(p) => {
                          setCurrentPage(p)
                          window.scrollTo({ top: 320, behavior: "smooth" })
                        }}
                      />
                    )}
                    <p className="text-center text-xs text-gray-400 mt-4">
                      Showing{" "}
                      {Math.min(
                        (currentPage - 1) * STORES_PER_PAGE + 1,
                        filteredStores.length,
                      )}
                      –
                      {Math.min(
                        currentPage * STORES_PER_PAGE,
                        filteredStores.length,
                      )}{" "}
                      of {filteredStores.length} stores
                    </p>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── STORE PARTNER CTA ─────────────────────────────────────────── */}
        <section className="mt-16 reveal">
          <div
            className="rounded-3xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #F8FAFC 0%, #EAF2FF 100%)",
              border: "1px solid #e2eeff",
            }}
          >
            <div className="grid lg:grid-cols-2 gap-10 p-10 lg:p-14 items-center">
              {/* Mini dashboard */}
              <div className="order-2 lg:order-1">
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden max-w-sm mx-auto">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-400" />
                      <div className="w-3 h-3 rounded-full bg-yellow-400" />
                      <div className="w-3 h-3 rounded-full bg-green-400" />
                    </div>
                    <div className="bg-gray-100 rounded px-3 py-1 text-xs text-gray-400 font-mono flex-1 mx-2">
                      merchant.adepapay.ng
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {[
                        { l: "Revenue", v: "GHS 4.2M", c: "#12B76A" },
                        { l: "Orders", v: "312", c: "#0B5FFF" },
                        { l: "Rating", v: "4.9?", c: "#F79009" },
                      ].map((s) => (
                        <div
                          key={s.l}
                          className="bg-gray-50 rounded-xl p-2.5 text-center"
                        >
                          <div
                            className="text-sm font-bold"
                            style={{ color: s.c }}
                          >
                            {s.v}
                          </div>
                          <div className="text-[10px] text-gray-400">{s.l}</div>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2.5">
                      {[
                        {
                          img: "https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=40&h=40&fit=crop&auto=format",
                          name: 'Samsung 65" QLED TV',
                          amt: "GHS 90,000.00",
                          status: "approved",
                        },
                        {
                          img: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=40&h=40&fit=crop&auto=format",
                          name: "MacBook Pro M3",
                          amt: "GHS 196,000.00",
                          status: "approved",
                        },
                        {
                          img: "https://images.unsplash.com/photo-1696446702183-afb69c5f24a4?w=40&h=40&fit=crop&auto=format",
                          name: "iPhone 15 Pro Max",
                          amt: "GHS 152,000.00",
                          status: "pending",
                        },
                      ].map((o) => (
                        <div
                          key={o.name}
                          className="flex items-center gap-2.5 text-xs"
                        >
                          <img
                            src={o.img}
                            alt=""
                            className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-800 truncate">
                              {o.name}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="font-bold text-gray-900">
                              {o.amt}
                            </div>
                            <div
                              className={`text-[9px] font-semibold ${
                                o.status === "approved"
                                  ? "text-emerald-600"
                                  : "text-amber-600"
                              }`}
                            >
                              {o.status === "approved"
                                ? "✓ Approved"
                                : "⋯ Pending"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <div
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4"
                  style={{ background: "#EAF2FF", color: "#0B5FFF" }}
                >
                  🏪 For Merchants
                </div>
                <h2
                  className="text-3xl font-bold mb-3 leading-tight"
                  style={{ color: "#101828" }}
                >
                  Own a Business?
                  <br />
                  <span className="gradient-text">Sell More with AdepaPay</span>
                </h2>
                <p className="text-gray-500 text-sm leading-relaxed mb-5">
                  Create your online store, reach thousands of customers, and
                  offer flexible hire purchase plans. We handle the financing —
                  you focus on selling.
                </p>
                <ul className="space-y-2 mb-6">
                  {[
                    "Reach 15,000+ active buyers",
                    "Get paid upfront on every order",
                    "Real-time analytics dashboard",
                    "Free store setup in minutes",
                  ].map((b) => (
                    <li
                      key={b}
                      className="flex items-center gap-2 text-sm text-gray-700"
                    >
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: "#12B76A" }}
                      >
                        <svg
                          className="w-2.5 h-2.5 text-white"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={3}
                          viewBox="0 0 24 24"
                        >
                          <polyline
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points="20 6 9 17 4 12"
                          />
                        </svg>
                      </div>
                      {b}
                    </li>
                  ))}
                </ul>
                <div className="flex gap-3 flex-wrap">
                  <button
                    onClick={onBecomePartner}
                    className="px-6 py-3 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all"
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
        </section>
      </main>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer
        className="py-12 px-4 sm:px-6 lg:px-8 mt-10"
        style={{ background: "#101828" }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            <div className="lg:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: "#0B5FFF" }}
                >
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
                    />
                  </svg>
                </div>
                <img
                  src="/images/adepa_pay_logo.png"
                  alt="AdepaPay"
                  className="h-10 w-auto object-contain"
                />
              </div>
              <p className="text-sm text-gray-400 leading-relaxed mb-4 max-w-xs">
                Ghana's premier hire purchase marketplace. Buy today, pay smart.
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Your email"
                  className="flex-1 px-3 py-2 rounded-xl text-xs bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <button
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-white"
                  style={{ background: "#0B5FFF" }}
                >
                  Go
                </button>
              </div>
            </div>
            {[
              {
                title: "Company",
                links: ["About", "How It Works", "Careers", "Blog"],
              },
              {
                title: "Marketplace",
                links: [
                  "Browse Stores",
                  "Browse Products",
                  "Categories",
                  "Hire Purchase",
                ],
              },
              {
                title: "Support",
                links: [
                  "Help Center",
                  "Privacy Policy",
                  "Terms",
                  "FAQs",
                  "Contact",
                ],
              },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="text-sm font-semibold text-white mb-3">
                  {col.title}
                </h4>
                <ul className="space-y-2">
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
          <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-500">
              © 2026 AdepaPay Technologies Ltd. All rights reserved.
            </p>
            <div className="flex gap-2">
              {["Facebook", "Instagram", "LinkedIn", "X"].map((s) => (
                <a
                  key={s}
                  href="#"
                  className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-800 text-gray-400 hover:bg-blue-600 hover:text-white transition-all text-xs font-bold"
                >
                  {s.charAt(0)}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* ── MOBILE FILTER DRAWER ─────────────────────────────────────────── */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileFilterOpen(false)}
          />
          <div className="absolute right-0 top-0 bottom-0 w-80 max-w-full bg-white shadow-xl z-10 overflow-hidden">
            <FilterSidebar
              selectedCats={selectedCats}
              setSelectedCats={setSelectedCats}
              selectedLocation={selectedLocation}
              setSelectedLocation={setSelectedLocation}
              verifiedOnly={verifiedOnly}
              setVerifiedOnly={setVerifiedOnly}
              minRating={minRating}
              setMinRating={setMinRating}
              openNow={openNow}
              setOpenNow={setOpenNow}
              sortBy={sortBy}
              setSortBy={setSortBy}
              onClear={clearFilters}
              onApply={() => setMobileFilterOpen(false)}
              mobile
              onClose={() => setMobileFilterOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
