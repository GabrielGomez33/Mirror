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
			// Phase 1: simple precaching only. Phase 2 adds runtime caching
			// strategies; Phase 5 switches to injectManifest mode for custom
			// push handlers.
			registerType: 'autoUpdate',

			// We register the SW manually from main.tsx so we control timing
			// and can add an update-available toast in Phase 3.
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

			// Workbox precache configuration. Phase 1 keeps this minimal:
			// precache the JS/CSS/HTML build output, leave large media (face-api
			// models, IQ images, fonts) for Phase 2's runtime caching.
			workbox: {
				globPatterns: ['**/*.{js,css,html,svg,ico,webmanifest}'],
				// Don't precache the heavy ML models or IQ image bank — too big
				// for one-shot install. Runtime caching in Phase 2.
				globIgnores: ['**/models/**', '**/images/iq/**'],
				// Default Workbox precache limit is 2 MiB. Mirror's main bundle
				// is ~3 MiB minified (Three.js + face-api + framer-motion eagerly
				// imported). Bumped to 6 MiB so the shell precaches in one shot.
				// Follow-up: code-split routes and lazy-load Three.js scenes so
				// the main bundle drops back under 1 MiB. See PHASE-1 notes.
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
})