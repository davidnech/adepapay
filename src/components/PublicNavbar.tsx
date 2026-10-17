import { useEffect, useState } from "react"

export type PublicPage = "home" | "stores" | "products" | "services" | "about"

type PublicNavbarProps = {
  active?: PublicPage
  onHome: () => void
  onBrowseStores: () => void
  onBrowseProducts: () => void
  onServices?: () => void
  onLogin: () => void
  onRegister: () => void
  onBecomePartner: () => void
}

export default function PublicNavbar({ active, onHome, onBrowseStores, onBrowseProducts, onServices = onHome, onLogin, onRegister, onBecomePartner }: PublicNavbarProps) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 16)
    handleScroll()
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])
  const navigate = (action: () => void) => { setOpen(false); action() }
  const links = [
    { label: "Home", id: "home" as const, action: onHome },
    { label: "Browse Stores", id: "stores" as const, action: onBrowseStores },
    { label: "Products", id: "products" as const, action: onBrowseProducts },
    { label: "Our Services", id: "services" as const, action: onServices },
  ]
  return <header className={`fixed inset-x-0 top-0 z-50 border-b transition-all ${scrolled ? "border-slate-200 bg-white/95 shadow-sm backdrop-blur-xl" : "border-slate-100 bg-white/90 backdrop-blur-xl"}`}>
    <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-5 px-4 sm:px-6 lg:px-8">
      <button type="button" onClick={() => navigate(onHome)} className="flex shrink-0 items-center gap-2" aria-label="AdepaPay home">
        <img src="/images/favicon/favicon.svg" alt="" className="h-9 w-9 object-contain" />
        <span className="text-lg font-bold tracking-tight text-blue-900">Adepa<span className="text-blue-600">Pay</span></span>
      </button>
      <nav className="hidden items-center gap-1 xl:flex" aria-label="Main navigation">
        <a href="/about" aria-current={active==='about'?'page':undefined} className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${active==='about'?'bg-blue-50 text-blue-700':'text-slate-600 hover:bg-slate-50 hover:text-blue-700'}`}>About</a>
        {links.map(link => <button type="button" key={link.id} onClick={() => navigate(link.action)} className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${active === link.id ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-blue-700"}`}>{link.label}</button>)}
      </nav>
      <div className="hidden items-center gap-2 md:flex">
        <button type="button" onClick={() => navigate(onLogin)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">Login</button>
        <button type="button" onClick={() => navigate(onRegister)} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">Create Account</button>
        <button type="button" onClick={() => navigate(onBecomePartner)} className="rounded-xl border border-blue-600 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50">Become a Partner</button>
      </div>
      <button type="button" onClick={() => setOpen(!open)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-700 xl:hidden" aria-label="Toggle navigation" aria-expanded={open}>
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d={open ? "M6 6l12 12M18 6 6 18" : "M4 7h16M4 12h16M4 17h16"}/></svg>
      </button>
    </div>
    {open && <div className="border-t border-slate-100 bg-white px-4 py-4 shadow-lg xl:hidden"><div className="mx-auto flex max-w-7xl flex-col gap-1">{links.map(link => <button type="button" key={link.id} onClick={() => navigate(link.action)} className={`rounded-xl px-4 py-3 text-left text-sm font-semibold ${active === link.id ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"}`}>{link.label}</button>)}<a href="/about" aria-current={active==='about'?'page':undefined} className="rounded-xl px-4 py-3 text-sm font-semibold text-blue-700">About AdepaPay</a><div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => navigate(onLogin)} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold">Login</button><button type="button" onClick={() => navigate(onRegister)} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white">Create Account</button><button type="button" onClick={() => navigate(onBecomePartner)} className="col-span-2 rounded-xl border border-blue-600 px-4 py-3 text-sm font-semibold text-blue-700">Become a Partner</button></div></div></div>}
  </header>
}
