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

			// injectManifest controls PRECACHE scope only — the Workbox
			// strategies (NetworkFirst for API, CacheFirst for models, etc.)
			// live in src/sw.ts now.
			//
			// PRECACHE STRATEGY (Phase 5 update):
			// We deliberately exclude assets/*.{js,css} from precache. Vite
			// emits content-hashed filenames for those (index-XXXX.js), so
			// they're immutable per build — the perfect fit for runtime
			// CacheFirst, registered in sw.ts. Benefits:
			//   - Precache stays tiny (HTML + manifest + icons, well under 1 MiB)
			//   - No file-size-limit gymnastics
			//   - First visit downloads bundles → SW caches → repeat visits
			//     and offline mode serve them from cache
			//   - New deploy = new content-hash filename = fresh fetch +
			//     cache; ExpirationPlugin retires stale hashes
			//
			// What stays precached: navigation shell + app icons. These are
			// what the user needs INSTANTLY on first launch, even if the
			// runtime cache is cold. Heavy bundles can wait the ~1s it
			// takes to fetch them on first visit.
			injectManifest: {
				globPatterns: [
					'index.html',
					'manifest.webmanifest',
					'favicon*.{ico,svg,png}',
					'pwa-*.png',
					'apple-touch-icon.png',
					'mirror-logo-sakura.png',
					'vite.svg',
				],
				globIgnores: ['**/models/**', '**/images/iq/**', '**/assets/**'],
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