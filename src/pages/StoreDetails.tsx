import { useState, useEffect, useRef } from 'react'
import PublicNavbar from '../components/PublicNavbar'
import { discountedPrice, getProductPromotion, isCampaignActive, loadPromotionSettings, PROMOTIONS_UPDATED_EVENT, redeemPromoCode, validatePromoCode, type StorePromotionSettings } from '../lib/promotions'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Product {
  id: number
  name: string
  brand: string
  category: string
  image: string
  price: number
  deposit: number
  monthly: number
  duration: number
  rating: number
  reviews: number
  inStock: boolean
  featured: boolean
}

interface Review {
  id: number
  name: string
  avatar: string
  product: string
  rating: number
  date: string
  text: string
  helpful: number
}

type ReviewSort = 'newest' | 'highest' | 'lowest'

// ─── Store Data ───────────────────────────────────────────────────────────────
const STORE = {
  id: 'cytech-gadgets',
  name: 'CYTECH Gadgets',
  tagline: 'Your Trusted Tech Destination in Lagos',
  category: 'Electronics & Gadgets',
  location: 'Computer Village, Ikeja, Lagos',
  address: '14B Obafemi Awolowo Way, Computer Village, Ikeja, Lagos',
  phone: '+234 801 234 5678',
  email: 'hello@cytechgadgets.ng',
  website: 'www.cytechgadgets.ng',
  manager: 'Chukwuemeka Obi',
  years: 4,
  rating: 4.9,
  reviews: 2841,
  followers: 12400,
  products: 348,
  sold: 8720,
  approvalTime: '2 min',
  responseTime: '< 30 min',
  completedHP: 4300,
  repeatCustomers: '68%',
  status: 'open' as 'open' | 'closed',
  verified: true,
  banner: 'https://images.unsplash.com/photo-1491933382434-500287f9b54b?w=1400&h=400&fit=crop&auto=format',
  logo: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=160&h=160&fit=crop&auto=format',
  hours: [
    { day: 'Mon – Fri', time: '8:00 AM – 7:00 PM' },
    { day: 'Saturday', time: '9:00 AM – 6:00 PM' },
    { day: 'Sunday', time: '11:00 AM – 4:00 PM' },
  ],
  description: `CYTECH Gadgets was founded in 2020 by Chukwuemeka Obi, a passionate technologist with a vision to democratise access to premium electronics across Nigeria. Starting from a single kiosk in Computer Village, Ikeja, the store has grown into one of Lagos' most trusted technology retailers with over 348 products and 8,700+ satisfied customers.\n\nOur mission is to make the latest technology accessible to every Nigerian through transparent pricing, verified products, and AdepaPay's flexible hire purchase plans. We believe no one should be left behind in the digital age because of financial constraints.\n\nOur vision is to become the number one technology marketplace in West Africa by 2027 — serving millions of customers with integrity, speed, and genuine after-sales support.`,
  social: { twitter: '@cytechng', instagram: '@cytechgadgets', facebook: 'CYTECH Gadgets Nigeria' },
  badges: ['Verified', 'Top Rated', 'Featured', 'Fast Approval'],
}

const CATEGORIES_STORE = [
  { name: 'Phones', count: 98, image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=200&h=120&fit=crop&auto=format' },
  { name: 'Laptops', count: 54, image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=200&h=120&fit=crop&auto=format' },
  { name: 'Electronics', count: 87, image: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=200&h=120&fit=crop&auto=format' },
  { name: 'Accessories', count: 63, image: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=200&h=120&fit=crop&auto=format' },
  { name: 'Tablets', count: 29, image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=200&h=120&fit=crop&auto=format' },
  { name: 'Smart Home', count: 17, image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&h=120&fit=crop&auto=format' },
]

const PRODUCTS: Product[] = [
  { id: 1, name: 'iPhone 15 Pro Max 256GB', brand: 'Apple', category: 'Phones', image: 'https://images.unsplash.com/photo-1696446702183-afb69c5f24a4?w=400&h=320&fit=crop&auto=format', price: 760000, deposit: 152000, monthly: 50667, duration: 12, rating: 4.9, reviews: 412, inStock: true, featured: true },
  { id: 2, name: 'MacBook Pro 14" M3 Pro', brand: 'Apple', category: 'Laptops', image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=320&fit=crop&auto=format', price: 980000, deposit: 196000, monthly: 65333, duration: 12, rating: 4.8, reviews: 287, inStock: true, featured: true },
  { id: 3, name: 'Samsung Galaxy S25 Ultra', brand: 'Samsung', category: 'Phones', image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=320&fit=crop&auto=format', price: 580000, deposit: 116000, monthly: 38667, duration: 12, rating: 4.7, reviews: 318, inStock: true, featured: true },
  { id: 4, name: 'Samsung 65" Neo QLED 4K', brand: 'Samsung', category: 'Electronics', image: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=400&h=320&fit=crop&auto=format', price: 450000, deposit: 90000, monthly: 30000, duration: 12, rating: 4.6, reviews: 192, inStock: true, featured: false },
  { id: 5, name: 'Dell XPS 15 Intel i9', brand: 'Dell', category: 'Laptops', image: 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=400&h=320&fit=crop&auto=format', price: 720000, deposit: 144000, monthly: 48000, duration: 12, rating: 4.7, reviews: 143, inStock: false, featured: false },
  { id: 6, name: 'Sony WH-1000XM5 Headphones', brand: 'Sony', category: 'Accessories', image: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400&h=320&fit=crop&auto=format', price: 180000, deposit: 36000, monthly: 12000, duration: 12, rating: 4.9, reviews: 524, inStock: true, featured: false },
  { id: 7, name: 'iPad Pro 12.9" M2 512GB', brand: 'Apple', category: 'Tablets', image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400&h=320&fit=crop&auto=format', price: 640000, deposit: 128000, monthly: 42667, duration: 12, rating: 4.8, reviews: 209, inStock: true, featured: false },
  { id: 8, name: 'Dyson V15 Detect Vacuum', brand: 'Dyson', category: 'Smart Home', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=320&fit=crop&auto=format', price: 185000, deposit: 37000, monthly: 12333, duration: 12, rating: 4.5, reviews: 88, inStock: true, featured: false },
  { id: 9, name: 'Apple Watch Series 9 GPS', brand: 'Apple', category: 'Accessories', image: 'https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?w=400&h=320&fit=crop&auto=format', price: 280000, deposit: 56000, monthly: 18667, duration: 12, rating: 4.7, reviews: 341, inStock: true, featured: false },
]

const REVIEWS: Review[] = [
  { id: 1, name: 'Adaeze Okonkwo', avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=80&h=80&fit=crop&auto=format', product: 'iPhone 15 Pro Max', rating: 5, date: 'March 12, 2026', text: 'Absolutely outstanding service! The product arrived exactly as described, the hire purchase process was seamless, and the CYTECH team was incredibly helpful throughout. Got my iPhone in 24 hours after deposit — highly recommended!', helpful: 47 },
  { id: 2, name: 'Emeka Nwosu', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=80&h=80&fit=crop&auto=format', product: 'MacBook Pro M3', rating: 5, date: 'February 28, 2026', text: 'Best tech store experience I\'ve had in Lagos. The MacBook Pro was genuine, sealed, and came with full Apple warranty. The AdepaPay installment plan made it completely manageable on my salary. Will definitely buy again!', helpful: 33 },
  { id: 3, name: 'Funmilayo Adekunle', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&h=80&fit=crop&auto=format', product: 'Samsung Galaxy S25', rating: 4, date: 'January 15, 2026', text: 'Great store with genuine products. My S25 Ultra is everything I hoped for. Only reason I gave 4 stars is delivery took an extra day, but the customer support team kept me updated throughout. Overall very satisfied.', helpful: 21 },
]

const RECOMMENDED = [
  { id: 1, name: 'TechWorld Electronics', category: 'Electronics', rating: 4.9, location: 'Lagos Island', image: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=400&h=200&fit=crop&auto=format', logo: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=60&h=60&fit=crop&auto=format' },
  { id: 2, name: 'PhoneZone Nigeria', category: 'Phones', rating: 4.5, location: 'Computer Village', image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=200&fit=crop&auto=format', logo: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=60&h=60&fit=crop&auto=format' },
  { id: 3, name: 'LaptopCity Pro', category: 'Laptops', rating: 4.7, location: 'Ikeja, Lagos', image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=200&fit=crop&auto=format', logo: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=60&h=60&fit=crop&auto=format' },
  { id: 4, name: 'SmartHome Appliances', category: 'Home Appliances', rating: 4.9, location: 'Enugu', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=200&fit=crop&auto=format', logo: 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=60&h=60&fit=crop&auto=format' },
]

const FAQS_STORE = [
  { q: 'Does this store offer delivery?', a: 'Yes. CYTECH Gadgets offers same-day delivery within Lagos Island and Mainland for orders placed before 2PM. Delivery to other states takes 2–3 business days via Aramex or GIG Logistics at a flat rate of ₦3,500.' },
  { q: 'How long does hire purchase approval take?', a: 'Most applications are approved within 2 minutes of submission. In rare cases where additional verification is required, the process takes up to 24 hours. You\'ll receive an SMS and email notification as soon as a decision is made.' },
  { q: 'Can I return a product?', a: 'CYTECH accepts returns within 7 days of delivery for products in original condition. Items must be unused, sealed, and accompanied by the original receipt. Hire purchase agreements on returned items are cancelled within 3–5 business days.' },
  { q: 'Are products covered by warranty?', a: 'All products carry the manufacturer\'s official warranty — Apple products come with a 1-year Apple warranty, Samsung products with a 1-year Samsung warranty. CYTECH also offers an optional 2-year extended warranty for an additional fee.' },
  { q: 'How do installment payments work?', a: 'After paying your deposit (minimum 20%), you receive the product. Monthly installments are automatically debited from your registered bank account on the same date each month. You can also make payments manually via the AdepaPay app.' },
]

const POLICIES = [
  { icon: '↩️', title: 'Return Policy', desc: '7-day returns on all products in original condition. Full refund processed within 3–5 business days.' },
  { icon: '🚚', title: 'Delivery Policy', desc: 'Same-day Lagos delivery. Nationwide 2–3 days. Real-time tracking on all orders.' },
  { icon: '🛡️', title: 'Warranty', desc: 'Official manufacturer warranty on all products. Optional 2-year extended warranty available.' },
  { icon: '📋', title: 'Hire Purchase Terms', desc: 'Minimum 20% deposit. 3, 6, 9, or 12-month plans. No hidden fees. Early settlement allowed.' },
  { icon: '🔒', title: 'Privacy Policy', desc: 'Your data is protected under NDPR compliance. We never share personal data with third parties.' },
  { icon: '🎧', title: 'Customer Support', desc: '24/7 support via chat, WhatsApp and phone. Average response time under 30 minutes.' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) { return '₦' + n.toLocaleString('en-NG') }

function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal')
    const obs = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) (e.target as HTMLElement).classList.add('visible') }),
      { threshold: 0.1 }
    )
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  })
}

function useCounter(target: number, duration = 1600) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const started = useRef(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
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
    }, { threshold: 0.5 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [target, duration])
  return { count, ref }
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StarRating({ rating, small }: { rating: number; small?: boolean }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <svg key={s} className={small ? 'w-3 h-3' : 'w-4 h-4'} fill={s <= Math.round(rating) ? '#F79009' : '#E5E7EB'} viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      ))}
    </div>
  )
}

function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#ECFDF3', color: '#027A48' }}>
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
      </svg>
      Verified Store
    </span>
  )
}

function StatPill({ target, suffix, label, color }: { target: number; suffix: string; label: string; color: string }) {
  const { count, ref } = useCounter(target)
  return (
    <div ref={ref} className="card-lift bg-white rounded-2xl p-5 border border-gray-100 shadow-sm text-center flex flex-col items-center gap-1.5">
      <div className="text-2xl font-bold tracking-tight" style={{ color }}>{count.toLocaleString()}{suffix}</div>
      <div className="text-xs text-gray-500 font-medium">{label}</div>
    </div>
  )
}

function FAQItem({ q, a, open: initOpen }: { q: string; a: string; open?: boolean }) {
  const [open, setOpen] = useState(!!initOpen)
  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors">
        <span className="font-semibold text-sm text-gray-900 pr-4">{q}</span>
        <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-transform duration-300" style={{ background: '#EAF2FF', transform: open ? 'rotate(45deg)' : 'rotate(0)' }}>
          <svg className="w-3.5 h-3.5" style={{ color: '#0B5FFF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
        </span>
      </button>
      <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: open ? '200px' : '0', opacity: open ? 1 : 0 }}>
        <p className="px-6 pb-5 text-sm text-gray-500 leading-relaxed">{a}</p>
      </div>
    </div>
  )
}

// ─── Product Card (compact) ───────────────────────────────────────────────────
function PromoCodeBox({ product, salePrice, settings, onSettingsChange }: { product: Product; salePrice: number; settings: StorePromotionSettings; onSettingsChange: (settings: StorePromotionSettings) => void }) {
  const [code, setCode] = useState('')
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string; finalPrice?: number } | null>(null)
  const redeem = () => {
    const result = validatePromoCode(settings, code, salePrice, STORE.id)
    if (!result.valid) return setFeedback({ tone: 'error', message: result.message })
    const next = redeemPromoCode(settings, result.code.id)
    onSettingsChange(next)
    setFeedback({ tone: 'success', message: `${result.code.code} redeemed · ${result.code.discountPercent}% extra off`, finalPrice: salePrice - result.discountAmount })
  }
  return (
    <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/60 p-2.5">
      <div className="mb-1.5 flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wide text-blue-700">Have a promo code?</span>{feedback?.finalPrice && <span className="text-xs font-black text-emerald-700">Now {fmt(feedback.finalPrice)}</span>}</div>
      <div className="flex gap-1.5"><input value={code} disabled={feedback?.tone === 'success'} onChange={(event) => { setCode(event.target.value.toUpperCase()); setFeedback(null) }} onKeyDown={(event) => { if (event.key === 'Enter') redeem() }} placeholder="ENTER CODE" aria-label={`Promo code for ${product.name}`} className="min-w-0 flex-1 rounded-lg border border-blue-100 bg-white px-2.5 py-2 font-mono text-[11px] font-bold uppercase outline-none focus:border-blue-500 disabled:bg-emerald-50" /><button onClick={redeem} disabled={feedback?.tone === 'success'} className="rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-bold text-white disabled:bg-emerald-600">{feedback?.tone === 'success' ? 'Applied' : 'Redeem'}</button></div>
      {feedback && <div className={`mt-1.5 text-[10px] font-semibold ${feedback.tone === 'success' ? 'text-emerald-700' : 'text-red-600'}`}>{feedback.message}</div>}
    </div>
  )
}

function ProductCard({ product, promotionSettings, onPromotionSettingsChange }: { product: Product; promotionSettings: StorePromotionSettings; onPromotionSettingsChange: (settings: StorePromotionSettings) => void }) {
  const [wished, setWished] = useState(false)
  const promotion = getProductPromotion(promotionSettings, product)
  const salePrice = promotion ? discountedPrice(product.price, promotion.discountPercent) : product.price
  return (
    <div className="card-lift group bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm flex flex-col">
      <div className="relative h-44 bg-gray-50 overflow-hidden flex-shrink-0">
        <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
        {promotion && <div className="absolute left-3 top-3 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-black text-white shadow-lg">{promotion.discountPercent}% OFF</div>}
        <button onClick={() => setWished(!wished)} className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm hover:scale-110 transition-transform">
          <svg className={`w-3.5 h-3.5 ${wished ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} fill={wished ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
          </svg>
        </button>
        {!product.inStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-white text-gray-800 text-xs font-semibold px-3 py-1 rounded-full">Out of Stock</span>
          </div>
        )}
        <div className="absolute bottom-3 left-3">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-sm text-gray-700">{product.brand}</span>
        </div>
      </div>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full self-start" style={{ background: '#EAF2FF', color: '#0B5FFF' }}>{product.category}</span>
        <h3 className="font-semibold text-sm text-gray-900 leading-snug line-clamp-2">{product.name}</h3>
        <div className="flex items-center gap-1.5">
          <StarRating rating={product.rating} small />
          <span className="text-[11px] text-gray-500">({product.reviews})</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 p-2.5 rounded-xl bg-gray-50 text-center">
          <div>
            <div className="text-[9px] text-gray-400">Cash</div>
            <div className="text-[11px] font-bold text-gray-900">{fmt(salePrice)}</div>
            {promotion && <div className="text-[9px] text-gray-400 line-through">{fmt(product.price)}</div>}
          </div>
          <div>
            <div className="text-[9px] text-gray-400">Deposit</div>
            <div className="text-[11px] font-bold" style={{ color: '#0B5FFF' }}>{fmt(product.deposit)}</div>
          </div>
          <div>
            <div className="text-[9px] text-gray-400">Monthly</div>
            <div className="text-[11px] font-bold" style={{ color: '#12B76A' }}>{fmt(product.monthly)}</div>
          </div>
        </div>
        {promotion && <div className="rounded-xl bg-red-50 px-3 py-2"><div className="text-[11px] font-bold text-red-700">{promotion.name}</div><div className="mt-0.5 text-[10px] text-red-600">{promotion.description} · Ends {promotion.endsAt}</div></div>}
        {promotionSettings.publicPromotionsEnabled && promotionSettings.codes.some((item) => item.enabled) && <PromoCodeBox product={product} salePrice={salePrice} settings={promotionSettings} onSettingsChange={onPromotionSettingsChange} />}
      </div>
      <div className="px-4 pb-4 grid grid-cols-2 gap-2 flex-shrink-0">
        <button className="py-2 rounded-xl text-xs font-semibold border-2 transition-all hover:bg-blue-50" style={{ borderColor: '#0B5FFF', color: '#0B5FFF' }}>View Product</button>
        <button disabled={!product.inStock} className="py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:opacity-90" style={{ background: '#0B5FFF' }}>Apply Now</button>
      </div>
    </div>
  )
}

// ─── Featured Product Card (wider, for carousel) ──────────────────────────────
function FeaturedProductCard({ product, promotionSettings, onPromotionSettingsChange }: { product: Product; promotionSettings: StorePromotionSettings; onPromotionSettingsChange: (settings: StorePromotionSettings) => void }) {
  const [wished, setWished] = useState(false)
  const promotion = getProductPromotion(promotionSettings, product)
  const salePrice = promotion ? discountedPrice(product.price, promotion.discountPercent) : product.price
  return (
    <div className="card-lift group flex-shrink-0 w-72 bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm flex flex-col">
      <div className="relative h-52 bg-gray-50 overflow-hidden flex-shrink-0">
        <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
        {promotion && <div className="absolute bottom-3 left-3 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-black text-white shadow-lg">{promotion.discountPercent}% OFF</div>}
        <button onClick={() => setWished(!wished)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm hover:scale-110 transition-transform">
          <svg className={`w-4 h-4 ${wished ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} fill={wished ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
          </svg>
        </button>
        <div className="absolute top-3 left-3">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: 'linear-gradient(90deg,#D4A017,#F59E0B)' }}>✦ Featured</span>
        </div>
        {!product.inStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-white text-gray-800 text-xs font-semibold px-3 py-1 rounded-full">Out of Stock</span>
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col gap-2.5 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: '#EAF2FF', color: '#0B5FFF' }}>{product.category}</span>
          <span className="text-[10px] text-gray-400">{product.brand}</span>
        </div>
        <h3 className="font-bold text-sm text-gray-900 leading-snug">{product.name}</h3>
        <div className="flex items-center gap-1.5">
          <StarRating rating={product.rating} small />
          <span className="text-xs font-semibold text-gray-700">{product.rating}</span>
          <span className="text-[11px] text-gray-400">({product.reviews} reviews)</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 p-3 rounded-xl bg-gray-50 text-center">
          <div>
            <div className="text-[9px] text-gray-400 mb-0.5">Cash Price</div>
            <div className="text-xs font-bold text-gray-900">{fmt(salePrice)}</div>
            {promotion && <div className="text-[9px] text-gray-400 line-through">{fmt(product.price)}</div>}
          </div>
          <div>
            <div className="text-[9px] text-gray-400 mb-0.5">Deposit</div>
            <div className="text-xs font-bold" style={{ color: '#0B5FFF' }}>{fmt(product.deposit)}</div>
          </div>
          <div>
            <div className="text-[9px] text-gray-400 mb-0.5">Monthly</div>
            <div className="text-xs font-bold" style={{ color: '#12B76A' }}>{fmt(product.monthly)}</div>
          </div>
        </div>
        {promotion && <div className="rounded-xl bg-red-50 px-3 py-2 text-[10px] font-semibold text-red-700">{promotion.name} · ends {promotion.endsAt}</div>}
        {promotionSettings.publicPromotionsEnabled && promotionSettings.codes.some((item) => item.enabled) && <PromoCodeBox product={product} salePrice={salePrice} settings={promotionSettings} onSettingsChange={onPromotionSettingsChange} />}
        <div className="text-[11px] text-gray-400 text-center">{product.duration}-month plan · {product.inStock ? '✓ In Stock' : '✗ Out of Stock'}</div>
      </div>
      <div className="px-4 pb-4 grid grid-cols-2 gap-2 flex-shrink-0">
        <button className="py-2.5 rounded-xl text-xs font-semibold border-2 hover:bg-blue-50 transition-all" style={{ borderColor: '#0B5FFF', color: '#0B5FFF' }}>View Product</button>
        <button disabled={!product.inStock} className="py-2.5 rounded-xl text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-all" style={{ background: '#0B5FFF' }}>Apply Now</button>
      </div>
    </div>
  )
}

// ─── Review Card ──────────────────────────────────────────────────────────────
function ReviewCard({ review }: { review: Review }) {
  const [helpCount, setHelpCount] = useState(review.helpful)
  const [helped, setHelped] = useState(false)
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src={review.avatar} alt={review.name} className="w-11 h-11 rounded-full object-cover border-2 border-blue-50 flex-shrink-0"/>
          <div>
            <div className="font-semibold text-sm text-gray-900">{review.name}</div>
            <div className="text-[11px] text-gray-400">{review.product} · {review.date}</div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: '#ECFDF3', color: '#027A48' }}>
          ✓ Verified
        </span>
      </div>
      <StarRating rating={review.rating} small />
      <p className="text-sm text-gray-600 leading-relaxed">{review.text}</p>
      <div className="flex items-center gap-2 pt-1 border-t border-gray-50">
        <span className="text-[11px] text-gray-400">Helpful?</span>
        <button
          onClick={() => { if (!helped) { setHelpCount(h => h + 1); setHelped(true) } }}
          className="flex items-center gap-1 text-[11px] font-semibold transition-colors"
          style={{ color: helped ? '#0B5FFF' : '#6B7280' }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/>
          </svg>
          Yes ({helpCount})
        </button>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ h, rounded = 'rounded-xl' }: { h: string; rounded?: string }) {
  return <div className={`skeleton ${h} ${rounded} w-full`} />
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StoreDetails({ onBack, onBrowseStores, onBrowseProducts, onLogin, onRegister, onBecomePartner }: { onBack: () => void; onBrowseStores: () => void; onBrowseProducts: () => void; onLogin: () => void; onRegister: () => void; onBecomePartner: () => void }) {
  const [scrolled, setScrolled] = useState(false)
  const [followed, setFollowed] = useState(false)
  const [saved, setSaved] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [reviewSort, setReviewSort] = useState<ReviewSort>('newest')
  const [reviews, setReviews] = useState<Review[]>(REVIEWS)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [reviewProduct, setReviewProduct] = useState('MacBook Pro 14" M3 Pro')
  const [activeProductCat, setActiveProductCat] = useState<string | null>(null)
  const [showAllProducts, setShowAllProducts] = useState(false)
  const [pageView, setPageView] = useState<'page' | 'loading'>('page')
  const [promotionSettings, setPromotionSettings] = useState<StorePromotionSettings>(() => loadPromotionSettings(STORE.id))
  const featuredRef = useRef<HTMLDivElement>(null)
  const bannerRef = useRef<HTMLDivElement>(null)

  useScrollReveal()

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20)
      // Parallax on banner
      if (bannerRef.current) {
        bannerRef.current.style.transform = `translateY(${window.scrollY * 0.3}px)`
      }
    }
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const refreshPromotions = (event: Event) => {
      const changedStoreId = (event as CustomEvent<{ storeId?: string }>).detail?.storeId
      if (changedStoreId && changedStoreId !== STORE.id) return
      setPromotionSettings(loadPromotionSettings(STORE.id))
    }
    window.addEventListener(PROMOTIONS_UPDATED_EVENT, refreshPromotions)
    window.addEventListener('storage', refreshPromotions)
    return () => {
      window.removeEventListener(PROMOTIONS_UPDATED_EVENT, refreshPromotions)
      window.removeEventListener('storage', refreshPromotions)
    }
  }, [])

  const scrollCarousel = (dir: 'left' | 'right') => {
    featuredRef.current?.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' })
  }

  const sortedReviews = [...reviews].sort((a, b) => {
    if (reviewSort === 'highest') return b.rating - a.rating
    if (reviewSort === 'lowest') return a.rating - b.rating
    return 0
  })

  const filteredProducts = PRODUCTS.filter(p => !activeProductCat || p.category === activeProductCat)
  const displayedProducts = showAllProducts ? filteredProducts : filteredProducts.slice(0, 6)
  const livePromotions = promotionSettings.publicPromotionsEnabled ? promotionSettings.campaigns.filter((campaign) => isCampaignActive(campaign)) : []

  const NAV_LINKS = ['Home', 'Browse Stores', 'Products', 'How It Works', 'About', 'Contact']

  // Loading state
  if (pageView === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 pt-16">
        <div className="skeleton h-64 w-full rounded-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 space-y-3 border border-gray-100">
                <Skeleton h="h-40" rounded="rounded-xl" />
                <Skeleton h="h-4" />
                <Skeleton h="h-3" />
                <Skeleton h="h-16" />
              </div>
            ))}
          </div>
        </div>
        <button onClick={() => setPageView('page')} className="fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white shadow-xl" style={{ background: '#0B5FFF' }}>
          View Loaded Page
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      <PublicNavbar active="stores" onHome={onBack} onBrowseStores={onBrowseStores} onBrowseProducts={onBrowseProducts} onLogin={onLogin} onRegister={onRegister} onBecomePartner={onBecomePartner} />

      {/* ── NAV ──────────────────────────────────────────────────────────── */}

      <main>

        {/* ── BREADCRUMB ───────────────────────────────────────────────────── */}
        <div className="pt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-2 text-xs text-gray-400">
            <button onClick={onBack} className="hover:text-blue-600 transition-colors">Home</button>
            <span>›</span>
            <button onClick={onBrowseStores} className="hover:text-blue-600 transition-colors">Browse Stores</button>
            <span>›</span>
            <span className="text-gray-700 font-medium">{STORE.name}</span>
          </div>
        </div>

        {/* ── HERO BANNER ──────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-gray-900" style={{ height: '340px' }}>
          <div ref={bannerRef} className="absolute inset-0 scale-110">
            <img src={STORE.banner} alt={STORE.name} className="w-full h-full object-cover opacity-80"/>
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"/>
          <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent"/>

          {/* Demo toggle */}
          <div className="absolute top-4 right-4 flex gap-2 z-10">
            {(['page', 'loading'] as const).map(v => (
              <button key={v} onClick={() => setPageView(v)} className="px-2.5 py-1 rounded-lg text-[10px] font-semibold capitalize transition-all" style={{ background: pageView === v ? '#fff' : 'rgba(255,255,255,0.2)', color: pageView === v ? '#0B5FFF' : '#fff' }}>{v}</button>
            ))}
          </div>

          <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 lg:px-8 pb-6">
            <div className="max-w-7xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="flex items-end gap-4">
                  {/* Logo */}
                  <div className="w-20 h-20 rounded-2xl border-4 border-white shadow-xl overflow-hidden flex-shrink-0 bg-white">
                    <img src={STORE.logo} alt="" className="w-full h-full object-cover"/>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <VerifiedBadge />
                      <span className="text-xs font-semibold text-green-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"/>
                        Open Now
                      </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">{STORE.name}</h1>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-300">
                      <span>{STORE.category}</span>
                      <span className="opacity-50">·</span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                        {STORE.location}
                      </span>
                      <span className="opacity-50">·</span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 fill-amber-400" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                        {STORE.rating} ({STORE.reviews.toLocaleString()} reviews)
                      </span>
                      <span className="opacity-50">·</span>
                      <span>{STORE.followers.toLocaleString()} followers</span>
                      <span className="opacity-50">·</span>
                      <span>{STORE.years} years on AdepaPay</span>
                    </div>
                  </div>
                </div>
                {/* Action buttons */}
                <div className="flex flex-wrap gap-2">
                  <button onClick={onBrowseProducts} className="px-4 py-2 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-all" style={{ background: '#0B5FFF' }}>Browse Products</button>
                  <button className="px-4 py-2 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-all" style={{ background: '#12B76A' }}>Apply for Hire Purchase</button>
                  <button onClick={() => setFollowed(!followed)} className="px-4 py-2 rounded-xl text-xs font-semibold border border-white/40 transition-all hover:bg-white/10" style={{ color: followed ? '#93C5FD' : '#fff' }}>
                    {followed ? '✓ Following' : '+ Follow'}
                  </button>
                  <button onClick={() => setSaved(!saved)} className="w-8 h-8 rounded-xl flex items-center justify-center border border-white/40 hover:bg-white/10 transition-all">
                    <svg className={`w-4 h-4 ${saved ? 'fill-blue-300 text-blue-300' : 'text-white'}`} fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
                    </svg>
                  </button>
                  <button className="w-8 h-8 rounded-xl flex items-center justify-center border border-white/40 hover:bg-white/10 transition-all">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── STORE INFO + STATS ────────────────────────────────────────────── */}
        {livePromotions.length > 0 && (
          <section className="border-b border-red-100 bg-gradient-to-r from-red-600 via-rose-600 to-orange-500 px-4 py-3 text-white">
            <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3"><span className="rounded-full bg-white px-3 py-1 text-xs font-black text-red-600">LIVE OFFER</span><div><span className="text-sm font-bold">{livePromotions[0].name}: {livePromotions[0].discountPercent}% off</span><span className="ml-2 text-xs text-red-100">{livePromotions[0].description}</span></div></div>
              <a href="#store-products" className="text-xs font-bold underline underline-offset-4">Shop promotion →</a>
            </div>
          </section>
        )}

        <section className="py-10 px-4 sm:px-6 lg:px-8" style={{ background: '#F8FAFC' }}>
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-3 gap-5">

              {/* Info card */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 reveal">
                <h2 className="font-bold text-base text-gray-900 mb-4">Store Information</h2>
                <div className="space-y-3">
                  {[
                    { icon: '🏢', label: 'Business Name', value: STORE.name },
                    { icon: '📦', label: 'Category', value: STORE.category },
                    { icon: '📞', label: 'Phone', value: STORE.phone },
                    { icon: '✉️', label: 'Email', value: STORE.email },
                    { icon: '📍', label: 'Address', value: STORE.address },
                    { icon: '🌐', label: 'Website', value: STORE.website },
                    { icon: '👤', label: 'Manager', value: STORE.manager },
                  ].map(item => (
                    <div key={item.label} className="flex gap-3 text-sm">
                      <span className="text-base flex-shrink-0 w-5">{item.icon}</span>
                      <div>
                        <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{item.label}</div>
                        <div className="text-gray-700 font-medium text-xs mt-0.5">{item.value}</div>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-3 text-sm pt-2 border-t border-gray-50">
                    <span className="text-base flex-shrink-0 w-5">🕐</span>
                    <div>
                      <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1">Operating Hours</div>
                      {STORE.hours.map(h => (
                        <div key={h.day} className="flex justify-between gap-6 text-xs text-gray-700">
                          <span>{h.day}</span><span className="font-medium">{h.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-gray-50">
                    {[STORE.social.twitter, STORE.social.instagram, STORE.social.facebook].map((s, i) => (
                      <a key={i} href="#" className="text-[10px] px-2 py-1 rounded-lg font-medium hover:bg-blue-50 transition-colors" style={{ background: '#F3F4F6', color: '#0B5FFF' }}>{s}</a>
                    ))}
                  </div>
                </div>
              </div>

              {/* Stats grid */}
              <div className="lg:col-span-2 reveal" style={{ transitionDelay: '0.1s' }}>
                <h2 className="font-bold text-base text-gray-900 mb-4">Store Performance</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                  <StatPill target={STORE.products} suffix="+" label="Products" color="#0B5FFF"/>
                  <StatPill target={STORE.sold} suffix="+" label="Products Sold" color="#12B76A"/>
                  <StatPill target={STORE.reviews} suffix="" label="Reviews" color="#D4A017"/>
                  <StatPill target={STORE.completedHP} suffix="+" label="Hire Purchases" color="#7C3AED"/>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Average Rating', value: `${STORE.rating} / 5.0`, color: '#F79009' },
                    { label: 'Avg Approval Time', value: STORE.approvalTime, color: '#12B76A' },
                    { label: 'Response Time', value: STORE.responseTime, color: '#0B5FFF' },
                    { label: 'Repeat Customers', value: STORE.repeatCustomers, color: '#7C3AED' },
                    { label: 'Years on Platform', value: `${STORE.years} Years`, color: '#D4A017' },
                    { label: 'Store Status', value: '● Open Now', color: '#12B76A' },
                  ].map(s => (
                    <div key={s.label} className="card-lift bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                      <div className="text-sm font-bold" style={{ color: s.color }}>{s.value}</div>
                      <div className="text-[10px] text-gray-400 font-medium mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── ABOUT THE STORE ───────────────────────────────────────────────── */}
        <section className="py-14 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-10 items-start reveal">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#0B5FFF' }}>Our Story</p>
                <h2 className="text-2xl sm:text-3xl font-bold mb-5" style={{ color: '#101828' }}>About {STORE.name}</h2>
                <div className="space-y-4">
                  {STORE.description.split('\n\n').map((para, i) => (
                    <p key={i} className="text-sm text-gray-600 leading-relaxed">{para}</p>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-3 mt-6">
                  {[
                    { label: 'Mission', text: 'Make tech accessible to all Nigerians through transparent hire purchase.' },
                    { label: 'Vision', text: 'West Africa\'s #1 technology marketplace by 2027.' },
                    { label: 'Values', text: 'Integrity, speed, and genuine after-sales care on every transaction.' },
                  ].map(v => (
                    <div key={v.label} className="p-3 rounded-xl border border-gray-100 bg-gray-50">
                      <div className="text-xs font-bold mb-1" style={{ color: '#0B5FFF' }}>{v.label}</div>
                      <p className="text-[11px] text-gray-500 leading-relaxed">{v.text}</p>
                    </div>
                  ))}
                </div>
              </div>
              {/* Why choose */}
              <div className="reveal" style={{ transitionDelay: '0.1s' }}>
                <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#0B5FFF' }}>Why Customers Love Us</p>
                <h3 className="text-xl font-bold mb-4" style={{ color: '#101828' }}>What Sets CYTECH Apart</h3>
                <div className="space-y-3">
                  {[
                    { icon: '✅', title: 'Every product is 100% genuine', desc: 'All products are purchased directly from authorised distributors and come with full manufacturer warranty.' },
                    { icon: '⚡', title: '2-minute hire purchase approval', desc: 'Our smart system approves most applications instantly. You get your product the same day as approval.' },
                    { icon: '🎧', title: 'After-sales support you can count on', desc: 'Our support team is available 7 days a week via phone, WhatsApp, and walk-in at our Ikeja showroom.' },
                    { icon: '🔄', title: 'Hassle-free 7-day returns', desc: 'Not satisfied? Return any product within 7 days of delivery for a full refund — no questions asked.' },
                  ].map(item => (
                    <div key={item.title} className="flex gap-3 p-3.5 rounded-xl hover:bg-blue-50 transition-colors cursor-default group">
                      <span className="text-xl flex-shrink-0">{item.icon}</span>
                      <div>
                        <div className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">{item.title}</div>
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── STORE POLICIES ────────────────────────────────────────────────── */}
        <section className="py-14 px-4 sm:px-6 lg:px-8" style={{ background: '#F8FAFC' }}>
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-8 reveal">
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#0B5FFF' }}>Transparency</p>
              <h2 className="text-2xl font-bold" style={{ color: '#101828' }}>Store Policies</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {POLICIES.map((p, i) => (
                <div key={p.title} className="card-lift reveal bg-white rounded-2xl p-5 border border-gray-100 shadow-sm" style={{ transitionDelay: `${i * 0.06}s` }}>
                  <div className="text-3xl mb-3">{p.icon}</div>
                  <h3 className="font-bold text-sm text-gray-900 mb-1.5">{p.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed mb-3">{p.desc}</p>
                  <button className="text-xs font-semibold hover:underline" style={{ color: '#0B5FFF' }}>Learn more →</button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PRODUCT CATEGORIES ────────────────────────────────────────────── */}
        <section className="py-14 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between mb-6 reveal">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#0B5FFF' }}>Shop by Category</p>
                <h2 className="text-2xl font-bold" style={{ color: '#101828' }}>Product Categories</h2>
              </div>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
              <button
                onClick={() => setActiveProductCat(null)}
                className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all"
                style={{ background: !activeProductCat ? '#0B5FFF' : '#F3F4F6', color: !activeProductCat ? '#fff' : '#374151' }}
              >
                All ({PRODUCTS.length})
              </button>
              {CATEGORIES_STORE.map(cat => (
                <button
                  key={cat.name}
                  onClick={() => setActiveProductCat(activeProductCat === cat.name ? null : cat.name)}
                  className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all overflow-hidden relative group"
                  style={{ background: activeProductCat === cat.name ? '#0B5FFF' : '#fff', color: activeProductCat === cat.name ? '#fff' : '#374151', border: `1px solid ${activeProductCat === cat.name ? '#0B5FFF' : '#E5E7EB'}` }}
                >
                  {cat.name}
                  <span className="text-[11px] font-bold opacity-60">{cat.count}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURED PRODUCTS CAROUSEL ────────────────────────────────────── */}
        <section className="pb-10 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-5 reveal">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#0B5FFF' }}>Handpicked</p>
                <h2 className="text-2xl font-bold" style={{ color: '#101828' }}>Featured Products</h2>
              </div>
              <div className="flex gap-2">
                <button onClick={() => scrollCarousel('left')} className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline strokeLinecap="round" strokeLinejoin="round" points="15 18 9 12 15 6"/></svg>
                </button>
                <button onClick={() => scrollCarousel('right')} className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline strokeLinecap="round" strokeLinejoin="round" points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            </div>
            <div ref={featuredRef} className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
              {PRODUCTS.filter(p => p.featured).map(product => (
                <FeaturedProductCard key={product.id} product={product} promotionSettings={promotionSettings} onPromotionSettingsChange={setPromotionSettings} />
              ))}
            </div>
          </div>
        </section>

        {/* ── ALL PRODUCTS GRID ─────────────────────────────────────────────── */}
        <section id="store-products" className="scroll-mt-20 py-10 px-4 sm:px-6 lg:px-8" style={{ background: '#F8FAFC' }}>
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6 reveal">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#0B5FFF' }}>Full Catalogue</p>
                <h2 className="text-2xl font-bold" style={{ color: '#101828' }}>All Products</h2>
              </div>
              <span className="text-sm text-gray-400">{filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}</span>
            </div>

            {displayedProducts.length === 0 ? (
              <div className="flex flex-col items-center py-20 text-center">
                <div className="text-5xl mb-4">📭</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">No Products Available</h3>
                <p className="text-sm text-gray-500 mb-5">This store has not published any products in this category yet.</p>
                <button onClick={() => setActiveProductCat(null)} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#0B5FFF' }}>Browse Other Stores</button>
              </div>
            ) : (
              <>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {displayedProducts.map((product, i) => (
                    <div key={product.id} className="reveal" style={{ transitionDelay: `${i * 0.05}s` }}>
                      <ProductCard product={product} promotionSettings={promotionSettings} onPromotionSettingsChange={setPromotionSettings} />
                    </div>
                  ))}
                </div>
                {filteredProducts.length > 6 && (
                  <div className="text-center mt-8">
                    <button
                      onClick={() => setShowAllProducts(!showAllProducts)}
                      className="px-8 py-3 rounded-xl text-sm font-semibold border-2 hover:bg-blue-50 transition-all"
                      style={{ borderColor: '#0B5FFF', color: '#0B5FFF' }}
                    >
                      {showAllProducts ? 'Show Less' : `View All ${filteredProducts.length} Products`}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* ── CUSTOMER REVIEWS ──────────────────────────────────────────────── */}
        <section className="py-14 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 reveal">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#0B5FFF' }}>Social Proof</p>
                <h2 className="text-2xl font-bold" style={{ color: '#101828' }}>Customer Reviews</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2"><button onClick={()=>setReviewOpen(true)} className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700">Write a Review</button><div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                {(['newest', 'highest', 'lowest'] as ReviewSort[]).map(s => (
                  <button key={s} onClick={() => setReviewSort(s)} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize" style={{ background: reviewSort === s ? '#fff' : 'transparent', color: reviewSort === s ? '#0B5FFF' : '#6B7280', boxShadow: reviewSort === s ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>{s}</button>
                ))}
              </div></div>
            </div>

            {/* Rating summary */}
            <div className="bg-gray-50 rounded-2xl p-5 mb-6 flex flex-col sm:flex-row items-center gap-6 reveal">
              <div className="text-center flex-shrink-0">
                <div className="text-5xl font-bold" style={{ color: '#101828' }}>{STORE.rating}</div>
                <StarRating rating={STORE.rating} />
                <div className="text-xs text-gray-400 mt-1">{STORE.reviews.toLocaleString()} reviews</div>
              </div>
              <div className="flex-1 w-full space-y-2">
                {[5,4,3,2,1].map(star => {
                  const pct = star === 5 ? 72 : star === 4 ? 19 : star === 3 ? 6 : star === 2 ? 2 : 1
                  return (
                    <div key={star} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-2">{star}</span>
                      <svg className="w-3 h-3 fill-amber-400 flex-shrink-0" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: star >= 4 ? '#12B76A' : star === 3 ? '#F79009' : '#F04438' }}/>
                      </div>
                      <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedReviews.map((review, i) => (
                <div key={review.id} className="reveal" style={{ transitionDelay: `${i * 0.08}s` }}>
                  <ReviewCard review={review} />
                </div>
              ))}
            </div>
            {reviewOpen&&<div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"><button className="absolute inset-0" onClick={()=>setReviewOpen(false)} aria-label="Close review dialog"/><div className="relative w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h3 className="text-xl font-bold text-slate-950">Review {STORE.name}</h3><p className="mt-1 text-sm text-slate-500">Your review will be public and visible to other customers.</p></div><button onClick={()=>setReviewOpen(false)} className="text-2xl text-slate-400">×</button></div><div className="mt-6"><div className="text-xs font-bold text-slate-600">Your rating</div><div className="mt-2 flex gap-2">{[1,2,3,4,5].map(star=><button key={star} onClick={()=>setReviewRating(star)} className={`text-3xl ${star<=reviewRating?"text-amber-400":"text-slate-200"}`}>★</button>)}</div></div><label className="mt-5 block"><span className="text-xs font-bold text-slate-600">Product purchased</span><select value={reviewProduct} onChange={event=>setReviewProduct(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm">{PRODUCTS.slice(0,6).map(product=><option key={product.id}>{product.name}</option>)}</select></label><label className="mt-5 block"><span className="text-xs font-bold text-slate-600">Your feedback</span><textarea value={reviewText} onChange={event=>setReviewText(event.target.value)} rows={5} placeholder="Tell other customers about product quality, delivery, and service..." className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"/></label><label className="mt-4 flex items-start gap-3 rounded-xl bg-blue-50 p-4 text-xs leading-5 text-blue-800"><input type="checkbox" defaultChecked className="mt-1 accent-blue-600"/><span>I confirm this review reflects my genuine experience with this store.</span></label><div className="mt-6 flex justify-end gap-3"><button onClick={()=>setReviewOpen(false)} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold">Cancel</button><button disabled={reviewText.trim().length<10} onClick={()=>{setReviews(items=>[{id:Date.now(),name:'Emmanuel Agyeman',avatar:'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop',product:reviewProduct,rating:reviewRating,date:'Today',text:reviewText.trim(),helpful:0},...items]);setReviewText('');setReviewOpen(false)}} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-40">Publish Review</button></div></div></div>}
          </div>
        </section>

        {/* ── FAQ ───────────────────────────────────────────────────────────── */}
        <section className="py-14 px-4 sm:px-6 lg:px-8" style={{ background: '#F8FAFC' }}>
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8 reveal">
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#0B5FFF' }}>Questions?</p>
              <h2 className="text-2xl font-bold" style={{ color: '#101828' }}>Frequently Asked Questions</h2>
            </div>
            <div className="flex flex-col gap-3">
              {FAQS_STORE.map((faq, i) => (
                <div key={i} className="reveal" style={{ transitionDelay: `${i * 0.06}s` }}>
                  <FAQItem q={faq.q} a={faq.a} open={i === 0} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── RECOMMENDED STORES ────────────────────────────────────────────── */}
        <section className="py-14 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-8 reveal">
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#0B5FFF' }}>Discover More</p>
              <h2 className="text-2xl font-bold" style={{ color: '#101828' }}>Stores You Might Like</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {RECOMMENDED.map((store, i) => (
                <div key={store.id} className="card-lift reveal bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm" style={{ transitionDelay: `${i * 0.07}s` }}>
                  <div className="relative h-28 overflow-hidden bg-gray-100">
                    <img src={store.image} alt={store.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"/>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"/>
                    <img src={store.logo} alt="" className="absolute bottom-2 left-2 w-8 h-8 rounded-lg border-2 border-white object-cover shadow"/>
                  </div>
                  <div className="p-3">
                    <h3 className="font-semibold text-xs text-gray-900">{store.name}</h3>
                    <p className="text-[10px] text-gray-400 mb-1.5">{store.category} · {store.location}</p>
                    <div className="flex items-center gap-1 mb-3">
                      <svg className="w-3 h-3 fill-amber-400" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                      <span className="text-[11px] font-semibold text-gray-700">{store.rating}</span>
                    </div>
                    <button className="w-full py-1.5 rounded-lg text-[11px] font-semibold border-2 hover:bg-blue-50 transition-all" style={{ borderColor: '#0B5FFF', color: '#0B5FFF' }}>View Store</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────────────── */}
        <section className="py-16 px-4 sm:px-6 lg:px-8" style={{ background: 'linear-gradient(135deg, #0B5FFF 0%, #1E3A8A 100%)' }}>
          <div className="max-w-2xl mx-auto text-center reveal">
            <div className="text-4xl mb-4">🛒</div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Found what you're looking for?</h2>
            <p className="text-blue-200 text-sm mb-7 leading-relaxed">Browse products from this trusted store and start your hire purchase journey today. Instant approval, genuine products, flexible payments.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={onBrowseProducts} className="px-8 py-3 rounded-xl text-sm font-semibold text-blue-700 bg-white hover:bg-blue-50 transition-all">Browse Products</button>
              <button className="px-8 py-3 rounded-xl text-sm font-semibold text-white border-2 border-white/40 hover:border-white hover:bg-white/10 transition-all">Apply Now</button>
            </div>
          </div>
        </section>

        {/* ── FOOTER ───────────────────────────────────────────────────────── */}
        <footer className="py-12 px-4 sm:px-6 lg:px-8" style={{ background: '#101828' }}>
          <div className="max-w-7xl mx-auto">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#0B5FFF' }}>
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/></svg>
                  </div>
                  <img src="/images/adepa_pay_logo.png" alt="AdepaPay" className="h-10 w-auto object-contain" />
                </div>
                <p className="text-sm text-gray-400 leading-relaxed mb-4">Ghana's premier hire purchase marketplace.</p>
                <div className="flex gap-2">
                  <input type="email" placeholder="Your email" className="flex-1 px-3 py-2 rounded-xl text-xs bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"/>
                  <button className="px-3 py-2 rounded-xl text-xs font-semibold text-white" style={{ background: '#0B5FFF' }}>Go</button>
                </div>
              </div>
              {[
                { title: 'Company', links: ['About', 'Stores', 'Products', 'Careers'] },
                { title: 'Marketplace', links: ['Browse Stores', 'Browse Products', 'Hire Purchase', 'Categories'] },
                { title: 'Support', links: ['Help Center', 'Privacy', 'Terms', 'FAQs', 'Contact'] },
              ].map(col => (
                <div key={col.title}>
                  <h4 className="text-sm font-semibold text-white mb-3">{col.title}</h4>
                  <ul className="space-y-2">
                    {col.links.map(link => <li key={link}><a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">{link}</a></li>)}
                  </ul>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-gray-500">© 2026 AdepaPay Technologies Ltd. All rights reserved.</p>
              <div className="flex gap-2">
                {['F','I','L','X'].map(s => <a key={s} href="#" className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-800 text-gray-400 hover:bg-blue-600 hover:text-white transition-all text-xs font-bold">{s}</a>)}
              </div>
            </div>
          </div>
        </footer>

      </main>

      {/* ── MOBILE STICKY ACTIONS ─────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 md:hidden bg-white border-t border-gray-200 px-4 py-3 flex gap-2 shadow-2xl">
        <button onClick={onBrowseProducts} className="flex-1 py-3 rounded-xl text-xs font-semibold text-white" style={{ background: '#0B5FFF' }}>Browse Products</button>
        <button className="flex-1 py-3 rounded-xl text-xs font-semibold text-white" style={{ background: '#12B76A' }}>Apply for HP</button>
        <button onClick={() => setFollowed(!followed)} className="w-12 py-3 rounded-xl text-xs font-semibold border-2 transition-all" style={{ borderColor: '#0B5FFF', color: '#0B5FFF' }}>
          {followed ? '✓' : '+'}
        </button>
      </div>
    </div>
  )
}
