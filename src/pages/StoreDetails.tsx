import PublicNavbar from '../components/PublicNavbar'
import Marketplace from './Marketplace'

export default function StoreDetails({ onServices, storeId, onBack, onBrowseStores, onBrowseProducts, onLogin, onRegister, onBecomePartner }: {
  onServices?:()=>void; storeId: string; onBack: () => void; onBrowseStores: () => void; onBrowseProducts: () => void; onLogin: () => void; onRegister: () => void; onBecomePartner: () => void
}) {
  return <div className="min-h-screen bg-slate-50"><PublicNavbar onServices={onServices} active="stores" onHome={onBack} onBrowseStores={onBrowseStores} onBrowseProducts={onBrowseProducts} onLogin={onLogin} onRegister={onRegister} onBecomePartner={onBecomePartner} /><main className="mx-auto max-w-7xl px-5 pb-12 pt-28"><Marketplace onLogin={onLogin} mode="stores" initialStore={storeId} /></main></div>
}
