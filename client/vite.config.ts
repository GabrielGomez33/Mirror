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
			registerType: 'autoUpdate',
			injectRegister: false,
			filename: 'sw.js',
			scope: '/Mirror/',
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
			workbox: {
				globPatterns: ['**/*.{js,css,html,svg,ico,webmanifest}'],
				globIgnores: ['**/models/**', '**/images/iq/**'],
				maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
				navigateFallback: '/Mirror/index.html',
				navigateFallbackDenylist: [
					/^\/mirror\/api\//,
					/^\/mirror\/groups\/chat/,
				],
				cleanupOutdatedCaches: true,
			},
			devOptions: {
				enabled: true,
				type: 'module',
				navigateFallback: '/Mirror/index.html'
			},
		}),
	],
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