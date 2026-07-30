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

// O registro do service worker vive em <NewVersionPrompt />, que também detecta
// e aplica atualizações. Registrar aqui de novo duplicaria os listeners.
