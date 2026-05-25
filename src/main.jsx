import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { AuthProvider } from './contexts/AuthContext.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// ─── Analytics bootstrap (env-driven; silent no-op when unset) ─────────
// We load these here in JS instead of inline <script> in index.html
// because Vite's `%VITE_X%` HTML substitution is unreliable on some
// hosts (Vercel sometimes ships the literal placeholder). `import.meta.env`
// is the canonical Vite path and ALWAYS substitutes at build time.
;(function bootstrapClarity() {
  const id = import.meta.env.VITE_CLARITY_PROJECT_ID
  if (!id || typeof id !== 'string') return
  // Standard Clarity tag — same body the dashboard hands out.
  ;(function(c, l, a, r, i, t, y) {
    c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments) }
    t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i
    y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y)
  })(window, document, 'clarity', 'script', id)
})()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
)
