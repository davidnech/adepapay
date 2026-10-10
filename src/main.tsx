import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import SiteExperience from './components/SiteExperience'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SiteExperience />
    <App />
  </React.StrictMode>,
)
