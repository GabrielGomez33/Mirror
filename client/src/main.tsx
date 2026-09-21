import { createRoot } from 'react-dom/client'
import {BrowserRouter} from 'react-router-dom'

import './index.css'
import './styles/glass.css';
import './styles/chat-glass.css';

import App from './App.tsx'
import { ThemeProvider, readStoredTheme } from './context/ThemeContext'
import { initPWA } from './pwa'
import { installIOSResizeBridge } from './utils/iosResizeBridge'
import { initConversionAnalytics } from './services/conversionApi'

// Initialize anonymous conversion analytics as early as possible so UTM
// attribution is captured from the LANDING url before any client-side
// navigation. No-ops entirely if GPC/DNT/opt-out is set. Fail-safe: never throws.
initConversionAnalytics()

// Stale-shell recovery: after a deploy, a lazy-loaded chunk's hashed filename
// may no longer exist on the server (404). Vite raises `vite:preloadError`.
// Reload ONCE to pull the fresh shell + current chunks (the service worker now
// serves index.html NetworkFirst, so the reload gets the current bundle). The
// sessionStorage guard makes this idempotent so it can never loop.
window.addEventListener('vite:preloadError', ((e: Event) => {
	e.preventDefault()
	try {
		if (sessionStorage.getItem('mirror:chunkReloaded') === '1') return
		sessionStorage.setItem('mirror:chunkReloaded', '1')
	} catch { /* storage unavailable — still attempt the reload below */ }
	window.location.reload()
}) as EventListener)

// Apply the persisted colorway before first paint to avoid a flash of the
// default (sakura) theme for users who chose cosmic. ThemeProvider keeps it
// in sync from here on.
document.documentElement.setAttribute('data-theme', readStoredTheme())

createRoot(document.getElementById('root')!).render(
     <ThemeProvider>
         <BrowserRouter basename="/Mirror">
             <App />
         </BrowserRouter>
     </ThemeProvider>,
)

initPWA()
installIOSResizeBridge()