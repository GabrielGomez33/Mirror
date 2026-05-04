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
			// Phase 2: precache + runtime caching strategies. Phase 5 will
			// switch to injectManifest mode for custom push handlers.
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

			// Service worker filename and scope. Apache serves /Mirror/ as the
			// app root; the SW must live there to control /Mirror/* requests.
			filename: 'sw.js',
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
				globPatterns: ['**/*.{js,css,html,svg,ico,webmanifest}'],
				// Heavy media handled by runtimeCaching below, not precache.
				globIgnores: ['**/models/**', '**/images/iq/**'],
				// Default Workbox precache limit is 2 MiB. Mirror's main bundle
				// is ~3 MiB minified (Three.js + face-api + framer-motion eagerly
				// imported). Bumped to 6 MiB so the shell precaches in one shot.
				// Follow-up: code-split routes and lazy-load Three.js scenes so
				// the main bundle drops back under 1 MiB.
				maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
				// SPA navigation fallback: any route under /Mirror/* that isn't
				// a real file falls back to the cached index.html shell.
				navigateFallback: '/Mirror/index.html',
				navigateFallbackDenylist: [
					// Never serve cached HTML for API or WS upgrade requests.
					/^\/mirror\/api\//,
					/^\/mirror\/groups\/chat/,
				],
				cleanupOutdatedCaches: true,
				runtimeCaching: [
					// face-api ML models (216 MB total, served from /Mirror/models/faceapi/).
					// Files have no extension (e.g. tiny_face_detector_model-shard1)
					// so we match by URL path rather than extension. Each shard
					// is content-stable per name, safe for CacheFirst.
					{
						urlPattern: ({ url }) =>
							url.pathname.startsWith('/Mirror/models/faceapi/'),
						handler: 'CacheFirst',
						options: {
							cacheName: 'mirror-faceapi-models',
							expiration: {
								maxEntries: 30,
								maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
								purgeOnQuotaError: true,
							},
							cacheableResponse: { statuses: [0, 200] },
						},
					},
					// IQ test reference images (SVGs, ~56 KB total).
					{
						urlPattern: ({ url }) =>
							url.pathname.startsWith('/Mirror/images/iq/'),
						handler: 'CacheFirst',
						options: {
							cacheName: 'mirror-iq-images',
							expiration: {
								maxEntries: 50,
								maxAgeSeconds: 60 * 60 * 24 * 30,
							},
							cacheableResponse: { statuses: [0, 200] },
						},
					},
					// Google Fonts CSS — small but updates occasionally.
					{
						urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
						handler: 'StaleWhileRevalidate',
						options: {
							cacheName: 'google-fonts-css',
							expiration: {
								maxEntries: 10,
								maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
							},
							cacheableResponse: { statuses: [0, 200] },
						},
					},
					// Google Fonts files — versioned URLs, immutable.
					{
						urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
						handler: 'CacheFirst',
						options: {
							cacheName: 'google-fonts-files',
							expiration: {
								maxEntries: 30,
								maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
							},
							cacheableResponse: { statuses: [0, 200] },
						},
					},
					// Mirror API GETs — network-first with a 3s timeout, cached
					// fallback for offline reads. Matches both same-origin
					// (/mirror/api/*) and cross-origin (when VITE_API_URL is set).
					// `method: 'GET'` ensures POST/PUT/DELETE bypass the SW
					// entirely — writes always go straight to the network.
					{
						urlPattern: ({ url, request }) =>
							request.method === 'GET' &&
							url.pathname.startsWith('/mirror/api/'),
						method: 'GET',
						handler: 'NetworkFirst',
						options: {
							cacheName: 'mirror-api',
							networkTimeoutSeconds: 3,
							expiration: {
								maxEntries: 100,
								maxAgeSeconds: 60 * 60 * 24, // 1 day
							},
							cacheableResponse: { statuses: [0, 200] },
						},
					},
				],
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