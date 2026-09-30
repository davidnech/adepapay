import { useState, useEffect, useRef } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────
import { formatCurrency } from '../lib/localization'
import PublicNavbar from '../components/PublicNavbar'

type SortKey = 'popular' | 'newest' | 'price-asc' | 'price-desc' | 'monthly-asc' | 'rated' | 'best-selling'
type ViewMode = 'grid' | 'loading' | 'empty' | 'error'

interface Product {
  id: number
  name: string
  brand: string
  store: string
  storeVerified: boolean
  category: string
  image: string
  price: number
  deposit: number
  monthly: number
  duration: number
  rating: number
  reviews: number
  inStock: boolean
  condition: 'New' | 'Refurbished'
  badges: string[]
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const PRODUCTS: Product[] = [
  { id: 1,  name: 'iPhone 15 Pro Max 256GB', brand: 'Apple', store: 'TechWorld Electronics', storeVerified: true, category: 'Phones', image: 'https://images.unsplash.com/photo-1696446702183-afb69c5f24a4?w=400&h=340&fit=crop&auto=format', price: 760000, deposit: 152000, monthly: 50667, duration: 12, rating: 4.9, reviews: 412, inStock: true,  condition: 'New', badges: ['Best Seller', 'Verified Store'] },
  { id: 2,  name: 'MacBook Pro 14" M3 Pro', brand: 'Apple', store: 'CYTECH Gadgets', storeVerified: true, category: 'Laptops', image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=340&fit=crop&auto=format', price: 980000, deposit: 196000, monthly: 65333, duration: 12, rating: 4.8, reviews: 287, inStock: true,  condition: 'New', badges: ['AdepaPay Choice', 'Verified Store'] },
  { id: 3,  name: 'Samsung Galaxy S25 Ultra', brand: 'Samsung', store: 'PhoneZone Ghana', storeVerified: true, category: 'Phones', image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=340&fit=crop&auto=format', price: 580000, deposit: 116000, monthly: 38667, duration: 12, rating: 4.7, reviews: 318, inStock: true,  condition: 'New', badges: ['New Arrival', 'Trending'] },
  { id: 4,  name: 'Samsung 65" Neo QLED 4K', brand: 'Samsung', store: 'TechWorld Electronics', storeVerified: true, category: 'Electronics', image: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=400&h=340&fit=crop&auto=format', price: 450000, deposit: 90000, monthly: 30000, duration: 12, rating: 4.6, reviews: 192, inStock: true,  condition: 'New', badges: ['Trending'] },
  { id: 5,  name: 'Dell XPS 15 Intel i9', brand: 'Dell', store: 'LaptopCity Pro', storeVerified: true, category: 'Laptops', image: 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=400&h=340&fit=crop&auto=format', price: 720000, deposit: 144000, monthly: 48000, duration: 12, rating: 4.7, reviews: 143, inStock: false, condition: 'New', badges: ['Fast Approval'] },
  { id: 6,  name: 'Sony WH-1000XM5 Headphones', brand: 'Sony', store: 'TechWorld Electronics', storeVerified: true, category: 'Accessories', image: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400&h=340&fit=crop&auto=format', price: 180000, deposit: 36000, monthly: 12000, duration: 12, rating: 4.9, reviews: 524, inStock: true,  condition: 'New', badges: ['Best Seller'] },
  { id: 7,  name: 'iPad Pro 12.9" M2 512GB', brand: 'Apple', store: 'CYTECH Gadgets', storeVerified: true, category: 'Electronics', image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400&h=340&fit=crop&auto=format', price: 640000, deposit: 128000, monthly: 42667, duration: 12, rating: 4.8, reviews: 209, inStock: true,  condition: 'New', badges: ['AdepaPay Choice'] },
  { id: 8,  name: 'Premium Sectional Sofa Set', brand: 'HomeStyle', store: 'HomeStyle Furniture', storeVerified: true, category: 'Furniture', image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=340&fit=crop&auto=format', price: 320000, deposit: 64000, monthly: 21333, duration: 12, rating: 4.6, reviews: 88, inStock: true,  condition: 'New', badges: ['Trending'] },
  { id: 9,  name: 'LG Side-by-Side Refrigerator', brand: 'LG', store: 'SmartHome Appliances', storeVerified: true, category: 'Home Appliances', image: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=400&h=340&fit=crop&auto=format', price: 280000, deposit: 56000, monthly: 18667, duration: 12, rating: 4.5, reviews: 117, inStock: false, condition: 'New', badges: ['Fast Approval'] },
  { id: 10, name: 'Apple Watch Series 9 GPS', brand: 'Apple', store: 'CYTECH Gadgets', storeVerified: true, category: 'Accessories', image: 'https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?w=400&h=340&fit=crop&auto=format', price: 280000, deposit: 56000, monthly: 18667, duration: 12, rating: 4.7, reviews: 341, inStock: true,  condition: 'New', badges: ['New Arrival'] },
  { id: 11, name: 'Hisense 43" 4K Smart TV', brand: 'Hisense', store: 'TechWorld Electronics', storeVerified: true, category: 'Electronics', image: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=400&h=340&fit=crop&q=80&auto=format', price: 180000, deposit: 36000, monthly: 12000, duration: 12, rating: 4.4, reviews: 203, inStock: true,  condition: 'New', badges: ['Limited Stock'] },
  { id: 12, name: 'Dyson V15 Detect Vacuum', brand: 'Dyson', store: 'SmartHome Appliances', storeVerified: true, category: 'Home Appliances', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=340&fit=crop&auto=format', price: 185000, deposit: 37000, monthly: 12333, duration: 12, rating: 4.5, reviews: 88, inStock: true,  condition: 'New', badges: ['Best Seller'] },
  { id: 13, name: 'Yamaha FZ-S V3 Motorbike', brand: 'Yamaha', store: 'AutoDrive Motors', storeVerified: true, category: 'Motorbikes', image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=400&h=340&fit=crop&auto=format', price: 650000, deposit: 130000, monthly: 43333, duration: 12, rating: 4.8, reviews: 64, inStock: true,  condition: 'New', badges: ['New Arrival', 'Fast Approval'] },
  { id: 14, name: 'HP Pavilion Gaming Laptop', brand: 'HP', store: 'LaptopCity Pro', storeVerified: true, category: 'Laptops', image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=340&fit=crop&auto=format', price: 420000, deposit: 84000, monthly: 28000, duration: 12, rating: 4.5, reviews: 156, inStock: true,  condition: 'New', badges: ['Trending', 'Fast Approval'] },
  { id: 15, name: 'Tecno Camon 30 Pro 5G', brand: 'Tecno', store: 'PhoneZone Ghana', storeVerified: true, category: 'Phones', image: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400&h=340&fit=crop&auto=format', price: 120000, deposit: 24000, monthly: 8000, duration: 12, rating: 4.3, reviews: 289, inStock: true,  condition: 'New', badges: ['Best Seller'] },
  { id: 16, name: 'Lenovo ThinkPad X1 Carbon', brand: 'Lenovo', store: 'LaptopCity Pro', storeVerified: true, category: 'Laptops', image: 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=400&h=340&fit=crop&q=70&auto=format', price: 860000, deposit: 172000, monthly: 57333, duration: 12, rating: 4.8, reviews: 98, inStock: true,  condition: 'Refurbished', badges: ['AdepaPay Choice'] },
  { id: 17, name: 'GlowUp Skincare Bundle', brand: 'GlowUp', store: 'GlowUp Beauty Store', storeVerified: true, category: 'Beauty', image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400&h=340&fit=crop&auto=format', price: 85000, deposit: 17000, monthly: 5667, duration: 12, rating: 4.6, reviews: 412, inStock: true,  condition: 'New', badges: ['Best Seller', 'Trending'] },
  { id: 18, name: 'Nike Air Max 2026 Sneakers', brand: 'Nike', store: 'FashionHub Boutique', storeVerified: true, category: 'Fashion', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=340&fit=crop&auto=format', price: 95000, deposit: 19000, monthly: 6333, duration: 12, rating: 4.4, reviews: 178, inStock: true,  condition: 'New', badges: ['New Arrival'] },
]

const CATEGORIES = [
  { name: 'Phones',         emoji: '📱', count: 98,  image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=160&h=100&fit=crop&auto=format' },
  { name: 'Laptops',        emoji: '💻', count: 54,  image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=160&h=100&fit=crop&auto=format' },
  { name: 'Electronics',    emoji: '📺', count: 87,  image: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=160&h=100&fit=crop&auto=format' },
  { name: 'Furniture',      emoji: '🛋️', count: 45,  image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=160&h=100&fit=crop&auto=format' },
  { name: 'Home Appliances',emoji: '🏠', count: 63,  image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=160&h=100&fit=crop&auto=format' },
  { name: 'Fashion',        emoji: '👗', count: 120, image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=160&h=100&fit=crop&auto=format' },
  { name: 'Beauty',         emoji: '💄', count: 76,  image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=160&h=100&fit=crop&auto=format' },
  { name: 'Accessories',    emoji: '⌚', count: 58,  image: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=160&h=100&fit=crop&auto=format' },
  { name: 'Motorbikes',     emoji: '🏍️', count: 22,  image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=160&h=100&fit=crop&auto=format' },
]

const BRANDS = ['Apple', 'Samsung', 'Dell', 'HP', 'Sony', 'LG', 'Hisense', 'Tecno', 'Infinix', 'Lenovo', 'Dyson', 'Nike']
const STORES  = ['TechWorld Electronics', 'CYTECH Gadgets', 'PhoneZone Ghana', 'LaptopCity Pro', 'HomeStyle Furniture', 'SmartHome Appliances', 'AutoDrive Motors', 'FashionHub Boutique', 'GlowUp Beauty Store']

const BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  'New Arrival':      { bg: '#EFF8FF', text: '#175CD3' },
  'Best Seller':      { bg: '#FFF8E6', text: '#92400E' },
  'Trending':         { bg: '#FFF1F3', text: '#C01048' },
  'Limited Stock':    { bg: '#FEF3C7', text: '#92400E' },
  'AdepaPay Choice': { bg: '#EAF2FF', text: '#0B5FFF' },
  'Fast Approval':    { bg: '#ECFDF3', text: '#027A48' },
  'Verified Store':   { bg: '#ECFDF3', text: '#027A48' },
  'Discount':         { bg: '#FFF1F3', text: '#C01048' },
}

const RECENTLY_VIEWED = PRODUCTS.slice(0, 5)

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => formatCurrency(n)

function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal')
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) (e.target as HTMLElement).classList.add('visible') }),
      { threshold: 0.08 }
    )
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  })
}

// ─── Shared UI ────────────────────────────────────────────────────────────────
function Stars({ rating, sm }: { rating: number; sm?: boolean }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <svg key={s} className={sm ? 'w-3 h-3' : 'w-3.5 h-3.5'} fill={s <= Math.round(rating) ? '#F79009' : '#E5E7EB'} viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      ))}
    </div>
  )
}

function ProductBadge({ label }: { label: string }) {
  const s = BADGE_COLORS[label] ?? { bg: '#F3F4F6', text: '#374151' }
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: s.bg, color: s.text }}>
      {label}
    </span>
  )
}

function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold" style={{ color: '#027A48' }}>
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
      </svg>
      Verified
    </span>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
      <div className="skeleton h-48 w-full" />
      <div className="p-4 space-y-2.5">
        <div className="skeleton h-3 rounded w-1/3" />
        <div className="skeleton h-4 rounded w-3/4" />
        <div className="skeleton h-3 rounded w-1/2" />
        <div className="skeleton h-16 rounded-xl" />
        <div className="flex gap-2 pt-1">
          <div className="skeleton h-8 rounded-xl flex-1" />
          <div className="skeleton h-8 rounded-xl flex-1" />
        </div>
      </div>
    </div>
  )
}

// ─── Pagination ───────────────────────────────────────────────────────────────
function Pagination({ current, total, onChange }: { current: number; total: number; onChange: (p: number) => void }) {
  const pages = Array.from({ length: total }, (_, i) => i + 1)
  const visible = pages.filter(p => p === 1 || p === total || Math.abs(p - current) <= 1)
  return (
    <div className="flex items-center justify-center gap-1.5 mt-10">
      <button onClick={() => onChange(current - 1)} disabled={current === 1}
        className="px-3 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition-colors disabled:cursor-not-allowed">
        ← Previous
      </button>
      {visible.map((p, i) => {
        const prev = visible[i - 1]
        return (
          <div key={p} className="contents">
            {prev && p - prev > 1 && <span className="px-2 text-gray-400">…</span>}
            <button onClick={() => onChange(p)} className="w-9 h-9 rounded-xl text-sm font-semibold transition-all"
              style={{ background: p === current ? '#0B5FFF' : 'transparent', color: p === current ? '#fff' : '#374151', border: p === current ? 'none' : '1px solid #E5E7EB' }}>
              {p}
            </button>
          </div>
        )
      })}
      <button onClick={() => onChange(current + 1)} disabled={current === total}
        className="px-3 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition-colors disabled:cursor-not-allowed">
        Next →
      </button>
    </div>
  )
}

// ─── Product Card (grid) ──────────────────────────────────────────────────────
function ProductCard({ product, onCompare, isCompared }: { product: Product; onCompare: (id: number) => void; isCompared: boolean }) {
  const [wished, setWished] = useState(false)
  return (
    <div className="card-lift group bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm flex flex-col relative">
      {/* Image */}
      <div className="relative h-48 bg-gray-50 overflow-hidden flex-shrink-0">
        <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
        {!product.inStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-white text-gray-800 text-xs font-semibold px-3 py-1 rounded-full">Out of Stock</span>
          </div>
        )}
        {product.condition === 'Refurbished' && (
          <div className="absolute top-2 left-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Refurbished</span>
          </div>
        )}
        {/* Action icons */}
        <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button onClick={() => setWished(!wished)} className="w-7 h-7 rounded-full bg-white shadow-md flex items-center justify-center hover:scale-110 transition-transform">
            <svg className={`w-3.5 h-3.5 transition-colors ${wished ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} fill={wished ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
            </svg>
          </button>
          <button onClick={() => onCompare(product.id)} className="w-7 h-7 rounded-full bg-white shadow-md flex items-center justify-center hover:scale-110 transition-transform" title="Compare">
            <svg className={`w-3.5 h-3.5 ${isCompared ? 'text-blue-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          </button>
          <button className="w-7 h-7 rounded-full bg-white shadow-md flex items-center justify-center hover:scale-110 transition-transform" title="Share">
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/>
            </svg>
          </button>
        </div>
        {/* Heart always visible on mobile */}
        <button onClick={() => setWished(!wished)} className="sm:hidden absolute top-2 right-2 w-7 h-7 rounded-full bg-white shadow-md flex items-center justify-center">
          <svg className={`w-3.5 h-3.5 ${wished ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} fill={wished ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        {/* Badges */}
        <div className="flex flex-wrap gap-1">
          {product.badges.slice(0, 2).map(b => <ProductBadge key={b} label={b}/>)}
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-semibold text-gray-400">{product.brand}</span>
            <span className="text-gray-200">·</span>
            {product.storeVerified && <VerifiedBadge/>}
          </div>
          <h3 className="font-semibold text-sm text-gray-900 leading-snug line-clamp-2">{product.name}</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">{product.store}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Stars rating={product.rating} sm/>
          <span className="text-[11px] font-semibold text-gray-700">{product.rating}</span>
          <span className="text-[11px] text-gray-400">({product.reviews})</span>
        </div>
        {/* Pricing grid */}
        <div className="grid grid-cols-3 gap-1.5 p-2.5 rounded-xl bg-gray-50">
          <div className="text-center">
            <div className="text-[9px] text-gray-400 mb-0.5">Cash Price</div>
            <div className="text-[11px] font-bold text-gray-900">{fmt(product.price)}</div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-gray-400 mb-0.5">Deposit</div>
            <div className="text-[11px] font-bold" style={{ color: '#0B5FFF' }}>{fmt(product.deposit)}</div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-gray-400 mb-0.5">Monthly</div>
            <div className="text-[11px] font-bold" style={{ color: '#12B76A' }}>{fmt(product.monthly)}</div>
          </div>
        </div>
        <div className="text-[10px] text-gray-400 text-center">{product.duration}-month plan</div>
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 grid grid-cols-2 gap-2 flex-shrink-0">
        <button className="py-2 rounded-xl text-xs font-semibold border-2 transition-all hover:bg-blue-50" style={{ borderColor: '#0B5FFF', color: '#0B5FFF' }}>
          View Details
        </button>
        <button disabled={!product.inStock} className="py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:opacity-90" style={{ background: '#0B5FFF' }}>
          Apply Now
        </button>
      </div>
    </div>
  )
}

// ─── Featured Product Card (carousel) ────────────────────────────────────────
function FeaturedProductCard({ product }: { product: Product }) {
  const [wished, setWished] = useState(false)
  return (
    <div className="card-lift group flex-shrink-0 w-72 bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm flex flex-col">
      <div className="relative h-52 bg-gray-50 overflow-hidden flex-shrink-0">
        <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
        <div className="absolute top-2.5 left-2.5">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: 'linear-gradient(90deg,#D4A017,#F59E0B)' }}>✦ Featured</span>
        </div>
        {!product.inStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-white text-gray-800 text-xs font-semibold px-3 py-1 rounded-full">Out of Stock</span>
          </div>
        )}
        <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5">
          <button onClick={() => setWished(!wished)} className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm hover:scale-110 transition-transform">
            <svg className={`w-4 h-4 ${wished ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} fill={wished ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
            </svg>
          </button>
        </div>
      </div>
      <div className="p-4 flex flex-col gap-2.5 flex-1">
        <div className="flex flex-wrap gap-1">
          {product.badges.slice(0,2).map(b => <ProductBadge key={b} label={b}/>)}
        </div>
        <div>
          <div className="text-[10px] font-semibold text-gray-400 mb-0.5">{product.brand} · {product.store}</div>
          <h3 className="font-bold text-sm text-gray-900 leading-snug">{product.name}</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <Stars rating={product.rating} sm/>
          <span className="text-xs font-semibold text-gray-700">{product.rating}</span>
          <span className="text-[11px] text-gray-400">({product.reviews})</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 p-3 rounded-xl bg-gray-50 text-center">
          <div><div className="text-[9px] text-gray-400">Cash</div><div className="text-xs font-bold text-gray-900">{fmt(product.price)}</div></div>
          <div><div className="text-[9px] text-gray-400">Deposit</div><div className="text-xs font-bold" style={{ color: '#0B5FFF' }}>{fmt(product.deposit)}</div></div>
          <div><div className="text-[9px] text-gray-400">Monthly</div><div className="text-xs font-bold" style={{ color: '#12B76A' }}>{fmt(product.monthly)}</div></div>
        </div>
        <div className="text-[11px] text-center text-gray-400">{product.duration}-month · {product.inStock ? '✓ In Stock' : '✗ Out of Stock'}</div>
      </div>
      <div className="px-4 pb-4 grid grid-cols-2 gap-2 flex-shrink-0">
        <button className="py-2.5 rounded-xl text-xs font-semibold border-2 hover:bg-blue-50 transition-all" style={{ borderColor: '#0B5FFF', color: '#0B5FFF' }}>View Details</button>
        <button disabled={!product.inStock} className="py-2.5 rounded-xl text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-all" style={{ background: '#0B5FFF' }}>Apply Now</button>
      </div>
    </div>
  )
}

// ─── Filter Sidebar ───────────────────────────────────────────────────────────
interface Filters {
  categories: string[]
  brands: string[]
  store: string
  location: string
  priceMin: string
  priceMax: string
  depositMax: string
  monthlyMax: string
  durations: number[]
  availability: string
  condition: string
  minRating: number
  verifiedOnly: boolean
  sortBy: SortKey
}

const defaultFilters = (): Filters => ({
  categories: [], brands: [], store: '', location: '',
  priceMin: '', priceMax: '', depositMax: '', monthlyMax: '',
  durations: [], availability: '', condition: '', minRating: 0,
  verifiedOnly: false, sortBy: 'popular',
})

function FilterPanel({ f, setF, onClear, onApply, mobile, onClose }:
  { f: Filters; setF: (v: Filters) => void; onClear: () => void; onApply: () => void; mobile?: boolean; onClose?: () => void }) {

  const toggle = <T,>(arr: T[], val: T) => arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">{title}</h3>
      {children}
    </div>
  )

  const body = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-5 flex-shrink-0">
        <h2 className="font-bold text-base text-gray-900">Filters</h2>
        {mobile && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round"/><line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round"/></svg>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-5 pr-0.5">

        {/* Sort By */}
        <Section title="Sort By">
          <div className="space-y-0.5">
            {([
              ['popular','Most Popular'],['newest','Newest'],['price-asc','Lowest Price'],
              ['price-desc','Highest Price'],['monthly-asc','Lowest Monthly'],['rated','Highest Rated'],['best-selling','Best Selling'],
            ] as [SortKey,string][]).map(([k, label]) => (
              <button key={k} onClick={() => setF({ ...f, sortBy: k })}
                className="w-full text-left px-3 py-1.5 rounded-xl text-sm transition-all flex items-center gap-2"
                style={{ background: f.sortBy===k ? '#EAF2FF' : 'transparent', color: f.sortBy===k ? '#0B5FFF' : '#374151', fontWeight: f.sortBy===k ? '600' : '400' }}>
                {f.sortBy===k && <div className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0"/>}{label}
              </button>
            ))}
          </div>
        </Section>

        {/* Category */}
        <Section title="Category">
          <div className="space-y-0.5">
            {CATEGORIES.map(c => (
              <label key={c.name} className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                <input type="checkbox" checked={f.categories.includes(c.name)} onChange={() => setF({ ...f, categories: toggle(f.categories, c.name) })} className="accent-blue-600 w-3.5 h-3.5 rounded"/>
                <span className="text-sm text-gray-700 flex-1">{c.emoji} {c.name}</span>
                <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{c.count}</span>
              </label>
            ))}
          </div>
        </Section>

        {/* Brands */}
        <Section title="Brand">
          <div className="flex flex-wrap gap-1.5">
            {BRANDS.map(b => (
              <button key={b} onClick={() => setF({ ...f, brands: toggle(f.brands, b) })}
                className="px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
                style={{ background: f.brands.includes(b) ? '#0B5FFF' : '#F9FAFB', color: f.brands.includes(b) ? '#fff' : '#374151', borderColor: f.brands.includes(b) ? '#0B5FFF' : '#E5E7EB' }}>
                {b}
              </button>
            ))}
          </div>
        </Section>

        {/* Store */}
        <Section title="Store">
          <select value={f.store} onChange={e => setF({ ...f, store: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-400 bg-white transition-colors">
            <option value="">All Stores</option>
            {STORES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Section>

        {/* Price Range */}
        <Section title="Price Range">
          <div className="grid grid-cols-2 gap-2">
            <input type="number" placeholder="Min GHS" value={f.priceMin} onChange={e => setF({ ...f, priceMin: e.target.value })}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 w-full transition-colors"/>
            <input type="number" placeholder="Max GHS" value={f.priceMax} onChange={e => setF({ ...f, priceMax: e.target.value })}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 w-full transition-colors"/>
          </div>
        </Section>

        {/* Monthly installment max */}
        <Section title="Max Monthly Payment">
          <input type="number" placeholder="e.g. 30000" value={f.monthlyMax} onChange={e => setF({ ...f, monthlyMax: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 transition-colors"/>
        </Section>

        {/* Duration */}
        <Section title="Installment Duration">
          <div className="flex flex-wrap gap-1.5">
            {[3,6,12,18,24].map(d => (
              <button key={d} onClick={() => setF({ ...f, durations: toggle(f.durations, d) })}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
                style={{ background: f.durations.includes(d) ? '#0B5FFF' : '#F9FAFB', color: f.durations.includes(d) ? '#fff' : '#374151', borderColor: f.durations.includes(d) ? '#0B5FFF' : '#E5E7EB' }}>
                {d}mo
              </button>
            ))}
          </div>
        </Section>

        {/* Availability */}
        <Section title="Availability">
          {['In Stock','Out of Stock','Coming Soon'].map(a => (
            <label key={a} className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
              <input type="radio" name="avail" checked={f.availability===a} onChange={() => setF({ ...f, availability: f.availability===a ? '' : a })} className="accent-blue-600 w-3.5 h-3.5"/>
              <span className="text-sm text-gray-700">{a}</span>
            </label>
          ))}
        </Section>

        {/* Condition */}
        <Section title="Condition">
          {['New','Refurbished'].map(c => (
            <label key={c} className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
              <input type="radio" name="cond" checked={f.condition===c} onChange={() => setF({ ...f, condition: f.condition===c ? '' : c })} className="accent-blue-600 w-3.5 h-3.5"/>
              <span className="text-sm text-gray-700">{c}</span>
            </label>
          ))}
        </Section>

        {/* Rating */}
        <Section title="Minimum Rating">
          {[5,4,3].map(r => (
            <button key={r} onClick={() => setF({ ...f, minRating: f.minRating===r ? 0 : r })}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all"
              style={{ background: f.minRating===r ? '#EAF2FF' : 'transparent' }}>
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(s => <svg key={s} className="w-3.5 h-3.5" fill={s<=r ? '#F79009' : '#E5E7EB'} viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>)}
              </div>
              <span className="text-xs text-gray-500">& above</span>
            </button>
          ))}
        </Section>

        {/* Verified toggle */}
        <Section title="Store Quality">
          <label className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
            <span className="text-sm text-gray-700">Verified Stores Only</span>
            <button onClick={() => setF({ ...f, verifiedOnly: !f.verifiedOnly })}
              className="relative w-9 h-5 rounded-full transition-all flex-shrink-0"
              style={{ background: f.verifiedOnly ? '#0B5FFF' : '#D1D5DB' }}>
              <div className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200" style={{ left: f.verifiedOnly ? 'calc(100% - 18px)' : '2px' }}/>
            </button>
          </label>
        </Section>
      </div>

      <div className="flex gap-2 pt-4 border-t border-gray-100 mt-4 flex-shrink-0">
        <button onClick={onClear} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">Clear All</button>
        <button onClick={onApply} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all" style={{ background: '#0B5FFF' }}>Apply</button>
      </div>
    </div>
  )

  if (mobile) return <div className="h-full bg-white p-5 overflow-y-auto">{body}</div>
  return (
    <div className="w-60 flex-shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sticky top-20 max-h-[calc(100vh-96px)] overflow-hidden flex flex-col">
      {body}
    </div>
  )
}

// ─── Compare bar ──────────────────────────────────────────────────────────────
function CompareBar({ ids, products, onRemove, onClear }: { ids: number[]; products: Product[]; onRemove: (id: number) => void; onClear: () => void }) {
  if (ids.length === 0) return null
  const selected = products.filter(p => ids.includes(p.id))
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-2xl px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <span className="text-xs font-semibold text-gray-600 flex-shrink-0">Compare ({ids.length}/3):</span>
        <div className="flex gap-2 flex-1 overflow-x-auto">
          {selected.map(p => (
            <div key={p.id} className="flex-shrink-0 flex items-center gap-1.5 px-2 py-1 bg-blue-50 rounded-xl">
              <img src={p.image} alt="" className="w-7 h-7 rounded-lg object-cover"/>
              <span className="text-xs font-medium text-gray-800 max-w-[100px] truncate">{p.name}</span>
              <button onClick={() => onRemove(p.id)} className="text-gray-400 hover:text-red-500 transition-colors ml-0.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round"/><line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round"/></svg>
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={onClear} className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">Clear</button>
          <button className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-all" style={{ background: '#0B5FFF' }}>Compare Now</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BrowseProducts({ onBack, onBrowseStores, onLogin, onRegister, onBecomePartner }: { onBack: () => void; onBrowseStores: () => void; onLogin: () => void; onRegister: () => void; onBecomePartner: () => void }) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(defaultFilters())
  const [appliedFilters, setAppliedFilters] = useState<Filters>(defaultFilters())
  const [currentPage, setCurrentPage] = useState(1)
  const [compareIds, setCompareIds] = useState<number[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [serviceFilter, setServiceFilter] = useState(() => sessionStorage.getItem('adepapay-product-service') || '')
  const featuredRef = useRef<HTMLDivElement>(null)
  const PER_PAGE = 8

  useScrollReveal()

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const applyFilters = () => { setAppliedFilters(filters); setCurrentPage(1); setMobileFilterOpen(false) }
  const clearFilters = () => { setFilters(defaultFilters()); setAppliedFilters(defaultFilters()); setSearch(''); setActiveCat(null); setServiceFilter(''); sessionStorage.removeItem('adepapay-product-service'); setCurrentPage(1) }

  const filtered = PRODUCTS.filter(p => {
    const q = search.toLowerCase()
    if (q && !p.name.toLowerCase().includes(q) && !p.brand.toLowerCase().includes(q) && !p.store.toLowerCase().includes(q)) return false
    if (activeCat && p.category !== activeCat) return false
    if (appliedFilters.categories.length && !appliedFilters.categories.includes(p.category)) return false
    if (appliedFilters.brands.length && !appliedFilters.brands.includes(p.brand)) return false
    if (appliedFilters.store && p.store !== appliedFilters.store) return false
    if (appliedFilters.priceMin && p.price < +appliedFilters.priceMin) return false
    if (appliedFilters.priceMax && p.price > +appliedFilters.priceMax) return false
    if (appliedFilters.monthlyMax && p.monthly > +appliedFilters.monthlyMax) return false
    if (appliedFilters.durations.length && !appliedFilters.durations.includes(p.duration)) return false
    if (appliedFilters.availability === 'In Stock' && !p.inStock) return false
    if (appliedFilters.availability === 'Out of Stock' && p.inStock) return false
    if (appliedFilters.condition && p.condition !== appliedFilters.condition) return false
    if (appliedFilters.minRating && p.rating < appliedFilters.minRating) return false
    if (appliedFilters.verifiedOnly && !p.storeVerified) return false
    if (serviceFilter === 'swap' && ![1, 2, 3].includes(p.id)) return false
    if (serviceFilter === 'layaway' && ![1, 3, 4, 7, 8, 9].includes(p.id)) return false
    return true
  }).sort((a, b) => {
    if (appliedFilters.sortBy === 'price-asc')    return a.price - b.price
    if (appliedFilters.sortBy === 'price-desc')   return b.price - a.price
    if (appliedFilters.sortBy === 'monthly-asc')  return a.monthly - b.monthly
    if (appliedFilters.sortBy === 'rated')        return b.rating - a.rating
    if (appliedFilters.sortBy === 'best-selling') return b.reviews - a.reviews
    return b.reviews - a.reviews
  })

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const paged = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE)

  const toggleCompare = (id: number) => {
    setCompareIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 3 ? [...prev, id] : prev)
  }

  const activeFilterCount =
    appliedFilters.categories.length + appliedFilters.brands.length +
    (appliedFilters.store ? 1 : 0) + (appliedFilters.priceMin || appliedFilters.priceMax ? 1 : 0) +
    (appliedFilters.monthlyMax ? 1 : 0) + appliedFilters.durations.length +
    (appliedFilters.availability ? 1 : 0) + (appliedFilters.condition ? 1 : 0) +
    (appliedFilters.minRating ? 1 : 0) + (appliedFilters.verifiedOnly ? 1 : 0)

  const scrollCarousel = (dir: 'left' | 'right') => {
    featuredRef.current?.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' })
  }

  const NAV_LINKS = ['Home', 'Browse Stores', 'Browse Products', 'How It Works', 'About', 'Contact']

  return (
    <div className="min-h-screen bg-white font-sans">
      <PublicNavbar active="products" onHome={onBack} onBrowseStores={onBrowseStores} onBrowseProducts={() => window.scrollTo({ top: 0, behavior: 'smooth' })} onLogin={onLogin} onRegister={onRegister} onBecomePartner={onBecomePartner} />

      {/* ── NAV ──────────────────────────────────────────────────────────── */}

      {/* ── PAGE HEADER ──────────────────────────────────────────────────── */}
      <section className="pt-28 pb-14 px-4 sm:px-6 lg:px-8 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0B5FFF 0%, #1a4fd8 50%, #101828 100%)' }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at center, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '28px 28px' }}/>
        <div className="absolute top-6 right-24 w-72 h-72 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)' }}/>
        <div className="absolute bottom-0 left-10 w-48 h-48 rounded-full opacity-8" style={{ background: 'radial-gradient(circle, #D4A017 0%, transparent 70%)' }}/>
        <div className="max-w-3xl mx-auto text-center relative z-10">
          {/* Breadcrumb */}
          <div className="flex items-center justify-center gap-2 text-xs text-blue-200 mb-5">
            <button onClick={onBack} className="hover:text-white transition-colors">Home</button>
            <span>›</span>
            <span className="text-white font-medium">Browse Products</span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4 bg-white/20 text-white backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
            {PRODUCTS.length}+ Products Available
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3 tracking-tight leading-tight">Browse Products</h1>
          <p className="text-blue-200 text-base mb-8 max-w-xl mx-auto leading-relaxed">
            Discover thousands of products from trusted stores and pay in convenient flexible installments.
          </p>
          {/* Search */}
          <div className="bg-white rounded-2xl shadow-xl p-2 flex gap-2 max-w-2xl mx-auto">
            <div className="flex-1 flex items-center gap-3 px-3">
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/></svg>
              <input type="text" value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
                placeholder="Search products, brands or stores..."
                className="flex-1 text-sm text-gray-700 placeholder-gray-400 focus:outline-none"/>
              {search && <button onClick={() => setSearch('')} className="text-gray-300 hover:text-gray-500 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round"/><line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round"/></svg>
              </button>}
            </div>
            <button className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white flex-shrink-0 hover:opacity-90 transition-all" style={{ background: '#0B5FFF' }}>Search</button>
          </div>
        </div>
      </section>

      {/* ── CATEGORY STRIP (sticky) ───────────────────────────────────────── */}
      <section className="py-5 px-4 sm:px-6 lg:px-8 border-b border-gray-100 bg-white sticky top-16 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            <button onClick={() => { setActiveCat(null); setCurrentPage(1) }}
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all"
              style={{ background: !activeCat ? '#0B5FFF' : '#F3F4F6', color: !activeCat ? '#fff' : '#374151' }}>
              🛍️ All <span className="text-[11px] opacity-70">{PRODUCTS.length}</span>
            </button>
            {CATEGORIES.map(cat => (
              <button key={cat.name} onClick={() => { setActiveCat(activeCat === cat.name ? null : cat.name); setCurrentPage(1) }}
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all"
                style={{ background: activeCat === cat.name ? '#0B5FFF' : '#fff', color: activeCat === cat.name ? '#fff' : '#374151', borderColor: activeCat === cat.name ? '#0B5FFF' : '#E5E7EB' }}>
                {cat.emoji} {cat.name} <span className="text-[11px] opacity-70">{cat.count}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* ── FEATURED CAROUSEL ────────────────────────────────────────────── */}
        <section className="mb-12 reveal">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#0B5FFF' }}>Hand-picked</p>
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
            {PRODUCTS.filter(p => p.badges.includes('AdepaPay Choice') || p.badges.includes('Best Seller')).map(p => (
              <FeaturedProductCard key={p.id} product={p}/>
            ))}
          </div>
        </section>

        {/* ── FILTERS + GRID ────────────────────────────────────────────────── */}
        <div className="flex gap-6 items-start">

          {/* Desktop sidebar */}
          <div className="hidden lg:block">
            <FilterPanel f={filters} setF={setFilters} onClear={clearFilters} onApply={applyFilters}/>
          </div>

          <div className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-500">
                  <span className="font-semibold text-gray-900">{filtered.length}</span> product{filtered.length !== 1 ? 's' : ''}
                  {search && <span className="text-gray-400"> for "{search}"</span>}
                </span>
                {serviceFilter && (
                  <button onClick={() => clearFilters()} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                    {serviceFilter === 'swap' ? 'Swap Available' : serviceFilter === 'layaway' ? 'Layaway' : 'Hire Purchase'} x
                  </button>
                )}
                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} className="text-xs font-semibold hover:underline" style={{ color: '#0B5FFF' }}>
                    Clear {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* State demo toggles */}
                <div className="hidden sm:flex gap-1 p-1 bg-gray-100 rounded-xl">
                  {(['grid','loading','empty','error'] as ViewMode[]).map(v => (
                    <button key={v} onClick={() => setViewMode(v)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all capitalize"
                      style={{ background: viewMode===v ? '#fff' : 'transparent', color: viewMode===v ? '#0B5FFF' : '#6B7280', boxShadow: viewMode===v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                      {v}
                    </button>
                  ))}
                </div>
                {/* Mobile filter btn */}
                <button onClick={() => setMobileFilterOpen(true)}
                  className="lg:hidden flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><line x1="4" y1="6" x2="20" y2="6" strokeLinecap="round"/><line x1="8" y1="12" x2="16" y2="12" strokeLinecap="round"/><line x1="11" y1="18" x2="13" y2="18" strokeLinecap="round"/></svg>
                  Filters{activeFilterCount > 0 && <span className="w-4 h-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style={{ background: '#0B5FFF' }}>{activeFilterCount}</span>}
                </button>
              </div>
            </div>

            {/* View states */}
            {viewMode === 'loading' && (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i}/>)}
              </div>
            )}

            {viewMode === 'empty' && (
              <div className="flex flex-col items-center py-24 text-center">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Products Found</h3>
                <p className="text-gray-500 text-sm max-w-xs mb-6">Try adjusting your filters or search keywords to find what you're looking for.</p>
                <button onClick={() => { clearFilters(); setViewMode('grid') }} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#0B5FFF' }}>Reset Filters</button>
              </div>
            )}

            {viewMode === 'error' && (
              <div className="flex flex-col items-center py-24 text-center">
                <div className="text-6xl mb-4">⚠️</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Unable to Load Products</h3>
                <p className="text-gray-500 text-sm max-w-xs mb-6">Please check your connection or try again later.</p>
                <button onClick={() => setViewMode('grid')} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#0B5FFF' }}>Try Again</button>
              </div>
            )}

            {viewMode === 'grid' && (
              <>
                {paged.length === 0 ? (
                  <div className="flex flex-col items-center py-24 text-center">
                    <div className="text-6xl mb-4">🔍</div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">No Products Found</h3>
                    <p className="text-gray-500 text-sm max-w-xs mb-6">Try adjusting your filters or search keywords.</p>
                    <button onClick={clearFilters} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#0B5FFF' }}>Reset Filters</button>
                  </div>
                ) : (
                  <>
                    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {paged.map((product, i) => (
                        <div key={product.id} className="reveal" style={{ transitionDelay: `${i * 0.04}s` }}>
                          <ProductCard product={product} onCompare={toggleCompare} isCompared={compareIds.includes(product.id)}/>
                        </div>
                      ))}
                    </div>
                    {totalPages > 1 && (
                      <Pagination current={currentPage} total={totalPages} onChange={p => { setCurrentPage(p); window.scrollTo({ top: 280, behavior: 'smooth' }) }}/>
                    )}
                    <p className="text-center text-xs text-gray-400 mt-3">
                      Showing {Math.min((currentPage-1)*PER_PAGE+1, filtered.length)}–{Math.min(currentPage*PER_PAGE, filtered.length)} of {filtered.length} products
                    </p>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── RECENTLY VIEWED ──────────────────────────────────────────────── */}
        <section className="mt-16 reveal">
          <h2 className="text-xl font-bold mb-5" style={{ color: '#101828' }}>Recently Viewed</h2>
          <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            {RECENTLY_VIEWED.map(p => (
              <div key={p.id} className="card-lift flex-shrink-0 w-44 bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                <div className="h-28 overflow-hidden bg-gray-50">
                  <img src={p.image} alt={p.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"/>
                </div>
                <div className="p-3">
                  <h4 className="text-xs font-semibold text-gray-900 line-clamp-2 leading-snug mb-1">{p.name}</h4>
                  <p className="text-[10px] text-gray-400 mb-0.5">{p.store}</p>
                  <p className="text-[11px] font-bold mb-2" style={{ color: '#12B76A' }}>{fmt(p.monthly)}/mo</p>
                  <button className="w-full py-1.5 rounded-xl text-[11px] font-semibold border-2 transition-all hover:bg-blue-50" style={{ borderColor: '#0B5FFF', color: '#0B5FFF' }}>View Again</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── POPULAR BRANDS ────────────────────────────────────────────────── */}
        <section className="mt-14 reveal">
          <h2 className="text-xl font-bold mb-6" style={{ color: '#101828' }}>Popular Brands</h2>
          <div className="flex flex-wrap gap-3">
            {BRANDS.map(brand => (
              <button key={brand} onClick={() => { setFilters(f => ({ ...f, brands: f.brands.includes(brand) ? f.brands.filter(b => b !== brand) : [...f.brands, brand] })) }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl border-2 text-sm font-semibold transition-all hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600"
                style={{ borderColor: filters.brands.includes(brand) ? '#0B5FFF' : '#E5E7EB', color: filters.brands.includes(brand) ? '#0B5FFF' : '#374151', background: filters.brands.includes(brand) ? '#EAF2FF' : '#fff' }}>
                {brand}
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 mt-8" style={{ background: 'linear-gradient(135deg, #0B5FFF 0%, #1E3A8A 100%)' }}>
        <div className="max-w-2xl mx-auto text-center reveal">
          <div className="text-5xl mb-4">✨</div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 leading-tight">Found Something You Like?</h2>
          <p className="text-blue-200 text-sm mb-7 max-w-lg mx-auto leading-relaxed">
            View product details, compare installment plans, and apply through AdepaPay in just a few steps. No paperwork, instant approval.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button className="px-8 py-3 rounded-xl text-sm font-semibold text-blue-700 bg-white hover:bg-blue-50 transition-all">View Product</button>
            <button onClick={onBrowseStores} className="px-8 py-3 rounded-xl text-sm font-semibold text-white border-2 border-white/40 hover:border-white hover:bg-white/10 transition-all">Browse Stores</button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
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
              { title: 'Company',     links: ['About', 'Browse Stores', 'Browse Products', 'How It Works'] },
              { title: 'Support',     links: ['Help Center', 'Privacy Policy', 'Terms & Conditions', 'FAQs'] },
              { title: 'Connect',     links: ['Twitter / X', 'Instagram', 'LinkedIn', 'Facebook'] },
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

      {/* ── MOBILE FILTER DRAWER ─────────────────────────────────────────────── */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileFilterOpen(false)}/>
          <div className="absolute right-0 top-0 bottom-0 w-80 max-w-full bg-white shadow-xl z-10 overflow-hidden">
            <FilterPanel f={filters} setF={setFilters} onClear={clearFilters} onApply={applyFilters} mobile onClose={() => setMobileFilterOpen(false)}/>
          </div>
        </div>
      )}

      {/* ── COMPARE BAR ──────────────────────────────────────────────────────── */}
      <CompareBar ids={compareIds} products={PRODUCTS} onRemove={id => setCompareIds(prev => prev.filter(x => x !== id))} onClear={() => setCompareIds([])}/>
    </div>
  )
}
