import { createRoot } from 'react-dom/client'
import {BrowserRouter} from 'react-router-dom'

import './index.css'
import './styles/glass.css';
import './styles/chat-glass.css';

import App from './App.tsx'
import { ThemeProvider, readStoredTheme } from './context/ThemeContext'
import { initPWA, unregisterServiceWorkersInDev } from './pwa'
import { installIOSResizeBridge } from './utils/iosResizeBridge'

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

// Service worker is PRODUCTION-ONLY. In dev a SW causes a blank-flash + full
// page reload on first load (clientsClaim) and fights HMR — so we never start
// it here and instead tear down any SW a previous build left in the browser.
if (import.meta.env.PROD) {
  initPWA()
} else {
  void unregisterServiceWorkersInDev()
}
installIOSResizeBridge()