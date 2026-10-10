import PublicNavbar from '../components/PublicNavbar'
import Marketplace from './Marketplace'

export default function BrowseProducts({ applyKind, onServices, initialProduct, onBack, onBrowseStores, onLogin, onRegister, onBecomePartner }: {
  onServices?:()=>void; applyKind?:"hire_purchase"|"layaway"|"swap"; initialProduct?: string; onBack: () => void; onBrowseStores: () => void; onLogin: () => void; onRegister: () => void; onBecomePartner: () => void
}) {
  return <div className="min-h-screen bg-slate-50"><PublicNavbar onServices={onServices} active="products" onHome={onBack} onBrowseStores={onBrowseStores} onBrowseProducts={() => window.scrollTo({ top: 0, behavior: 'smooth' })} onLogin={onLogin} onRegister={onRegister} onBecomePartner={onBecomePartner} /><main className="mx-auto max-w-7xl px-5 pb-12 pt-28"><Marketplace applyKind={applyKind} initialProduct={initialProduct} onLogin={onLogin} mode="products" /></main></div>
}
