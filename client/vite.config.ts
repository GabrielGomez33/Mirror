import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import svgr from 'vite-plugin-svgr';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
	base: '/Mirror',
	plugins: [
		react(),
		svgr(),
		VitePWA({
			// Phase 5: switched to injectManifest so we can ship custom push +
			// notificationclick handlers in src/sw.ts. Workbox precaching and
			// runtime caching now live inside that SW file, configured via
			// imports — same strategies, just authored by us instead of
			// generated. The injectManifest option below only controls which
			// build-output files become the precache manifest.
			//
			// 'prompt' instead of 'autoUpdate': the new SW installs in the
			// background and waits. pwa.ts detects the waiting SW and
			// dispatches a `pwa:update-available` event; UpdateBanner shows
			// the reload prompt. This avoids surprise reloads mid-action
			// (e.g. while the user is recording a journal entry).
			registerType: 'prompt',

			// We register the SW manually from main.tsx so we control timing
			// and can surface the update event to UpdateBanner.
			injectRegister: false,

			// injectManifest mode: we author the SW; the plugin only injects
			// the precache manifest (self.__WB_MANIFEST) into our source.
			strategies: 'injectManifest',
			srcDir: 'src',
			filename: 'sw.ts',
			scope: '/Mirror/',

			// PWA manifest — what the OS/browser uses to install the app.
			manifest: {
				id: '/Mirror/',
				name: 'Mirror',
				short_name: 'Mirror',
				description:
					'Mirror — a personal intelligence platform for self-reflection, peer review, and collective insight.',
				start_url: '/Mirror/',
				scope: '/Mirror/',
				display: 'standalone',
				orientation: 'portrait',
				theme_color: '#0d0c1f',
				background_color: '#0d0c1f',
				lang: 'en',
				categories: ['lifestyle', 'productivity', 'social'],
				icons: [
					{
						src: '/Mirror/pwa-192x192.png',
						sizes: '192x192',
						type: 'image/png',
						purpose: 'any',
					},
					{
						src: '/Mirror/pwa-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'any',
					},
					{
						src: '/Mirror/pwa-maskable-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable',
					},
				],
			},

			// Workbox precache + runtime caching configuration.
			//
			// PRECACHE: JS/CSS/HTML/icons — small, immutable per build hash,
			// installed in one shot so the app shell loads offline.
			//
			// RUNTIME: heavy assets (face-api models 216 MB, fonts) and the IQ
			// image bank — fetched lazily, cached on first use, served from
			// cache forever after. This avoids a 200+ MB precache install.
			//
			// API GET requests use NetworkFirst with a short timeout: when
			// online users get fresh data, when offline they get the last
			// successful response. Writes (POST/PUT/DELETE) are never cached
			// — the runtimeCaching `method` filter only matches GET, so the
			// SW lets mutations pass through to the network unchanged.
			workbox: {
				globPatterns: ['**/*.{js,css,html,svg,ico,png,webmanifest}'],
				// Heavy media handled by runtimeCaching below, not precache.
				globIgnores: ['**/models/**', '**/images/iq/**'],
				// Take control of any uncontrolled clients as soon as the SW
				// activates. On a brand-new install this means the page that
				// just registered the SW starts routing fetches through it
				// immediately — no need to navigate or reload first to begin
				// populating the API cache. Also recovers gracefully after a
				// Shift+Reload (which loads the page uncontrolled): the SW
				// re-claims within ms and subsequent fetches are intercepted.
				//
				// Doesn't conflict with registerType: 'prompt': skipWaiting is
				// still false, so on UPDATES the new SW still waits for the
				// user's Reload click before activating. clientsClaim only
				// fires on activation, which on updates is user-triggered.
				clientsClaim: true,
				// Default Workbox precache limit is 2 MiB. Mirror's main bundle
				// is ~3 MiB minified (Three.js + face-api + framer-motion eagerly
				// imported). Bumped to 6 MiB so the shell precaches in one shot.
				// Follow-up: code-split routes and lazy-load Three.js scenes so
				// the main bundle drops back under 1 MiB.
				maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
			},

			// Run the SW + inject the manifest link during `npm run dev` so
			// you can verify the PWA in DevTools without a full prod build.
			// If HMR ever gets weird (stale chunks etc.), open DevTools →
			// Application → Service Workers → Unregister, then hard reload.
			devOptions: {
				enabled: true,
				type: 'module',
				navigateFallback: '/Mirror/index.html',
			},
		}),

	],
	// Dev-only proxy: lets `npm run dev` hit the real backend at
	// theundergroundrailroad.world without CORS / cookie hassles. Production
	// is same-origin (Apache serves both /Mirror/* and /mirror/api/* off the
	// same host), so no proxy is needed there — the build ignores this block.
	server: {
		proxy: {
			'/mirror/api': {
				target: 'https://www.theundergroundrailroad.world',
				changeOrigin: true,
				secure: true,
			},
			'/ws': {
				target: 'wss://www.theundergroundrailroad.world',
				changeOrigin: true,
				ws: true,
				secure: true,
			},
			'/mirror/groups/ws': {
				target: 'wss://www.theundergroundrailroad.world',
				changeOrigin: true,
				ws: true,
				secure: true,
			},
			'/mirror/groups/chat': {
				target: 'wss://www.theundergroundrailroad.world',
				changeOrigin: true,
				ws: true,
				secure: true,
			},
		},
	},
})