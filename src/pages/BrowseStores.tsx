import PublicNavbar from '../components/PublicNavbar'
import Marketplace from './Marketplace'

export default function BrowseStores({ onServices, onBack, onStoreDetails, onBrowseProducts, onLogin, onRegister, onBecomePartner }: {
  onServices?:()=>void; onBack: () => void; onStoreDetails?: (id: string) => void; onBrowseProducts: () => void; onLogin: () => void; onRegister: () => void; onBecomePartner: () => void
}) {
  return <div className="min-h-screen bg-slate-50"><PublicNavbar onServices={onServices} active="stores" onHome={onBack} onBrowseStores={() => window.scrollTo({ top: 0, behavior: 'smooth' })} onBrowseProducts={onBrowseProducts} onLogin={onLogin} onRegister={onRegister} onBecomePartner={onBecomePartner} /><main className="mx-auto max-w-7xl px-5 pb-12 pt-28"><Marketplace onLogin={onLogin} mode="stores" onStoreDetails={onStoreDetails} /></main></div>
}
