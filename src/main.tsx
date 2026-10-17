import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import PublicDocument from './components/PublicDocument'
import SiteExperience from './components/SiteExperience'
import './index.css'

const root = document.getElementById('root')!
const publicDocument = root.querySelector('[data-public-content]')
if (publicDocument) {
  ReactDOM.hydrateRoot(root, <PublicDocument html={publicDocument.innerHTML} />)
  const experience = document.createElement('div')
  document.body.appendChild(experience)
  ReactDOM.createRoot(experience).render(<SiteExperience />)
} else {
  const App = lazy(() => import('./App'))
  const LegalDocument = lazy(() => import('./pages/LegalDocument'))
  const AboutAdepaPay = lazy(() => import('./pages/AboutAdepaPay'))
  const policy=window.location.pathname.replace(/\/$/,'')
  ReactDOM.createRoot(root).render(<React.StrictMode><SiteExperience /><Suspense fallback={<p role="status" className="p-8">Loading AdepaPay…</p>}>{policy==='/about'?<AboutAdepaPay/>:policy==='/privacy'||policy==='/terms'?<LegalDocument slug={policy==='/privacy'?'privacy':'terms'}/>:<App />}</Suspense></React.StrictMode>)
}
