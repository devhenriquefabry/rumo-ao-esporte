import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

if (
  localStorage.getItem('rae_admin_keep_signed_in') === 'false'
  && sessionStorage.getItem('rae_admin_session_active') !== 'true'
) {
  localStorage.removeItem('rae_admin_auth')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('[PWA] Não foi possível registrar o aplicativo.', error)
    })
  })
}
