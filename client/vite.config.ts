import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import svgr from 'vite-plugin-svgr';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const CONFIG_DIR = dirname(fileURLToPath(import.meta.url));

// =============================================================================
// APP VERSION RESOLUTION (Option A — build-time injection)
// =============================================================================
// Resolution priority:
//   1. VITE_APP_VERSION env var (CI sets this from the workflow-computed tag)
//   2. `git describe --tags --always --dirty` (works in any local clone with
//      tags fetched — gives a useful identifier for local dev / debug builds)
//   3. 'dev' fallback so the UI never renders an empty string
//
// Surfaced to the client as import.meta.env.VITE_APP_VERSION via Vite's
// `define`. Using `define` (rather than relying solely on the env-var pickup)
// guarantees the value is hard-baked at build time even if the env var is
// stripped from the runtime environment.
// =============================================================================
function resolveAppVersion(): string {
	const fromEnv = process.env.VITE_APP_VERSION;
	if (fromEnv && fromEnv.trim().length > 0) return fromEnv.trim();

	try {
		const fromGit = execSync('git describe --tags --always --dirty', {
			stdio: ['ignore', 'pipe', 'ignore'],
			cwd: CONFIG_DIR,
		})
			.toString()
			.trim();
		if (fromGit) return fromGit;
	} catch {
		// No git, no tags, or shallow clone — fall through to the default.
	}

	return 'dev';
}

const APP_VERSION = resolveAppVersion();

export default defineConfig({
	base: '/Mirror',
	define: {
		'import.meta.env.VITE_APP_VERSION': JSON.stringify(APP_VERSION),
	},
	plugins: [
		react(),
		svgr(),
		VitePWA({
			registerType: 'prompt',
			injectRegister: false,
			strategies: 'injectManifest',
			srcDir: 'src',
			filename: 'sw.ts',
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
				// Phase 7: ordered fallback. Chrome/Edge honor display_override
				// before display; iOS Safari ignores it and uses `display`.
				// We list 'standalone' first (existing behavior) then
				// 'minimal-ui' as a graceful fallback.
				display_override: ['standalone', 'minimal-ui'],
				orientation: 'portrait',
				theme_color: '#0d0c1f',
				background_color: '#0d0c1f',
				lang: 'en',
				dir: 'ltr',
				// Defensive: tells the OS we're NOT a thin wrapper around a
				// native app, so the install prompt isn't redirected to a
				// store listing.
				prefer_related_applications: false,
				categories: ['lifestyle', 'productivity', 'social'],
				icons: [
					{ src: '/Mirror/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
					{ src: '/Mirror/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
					{ src: '/Mirror/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
				],
				// Phase 7: long-press home-screen shortcuts. Android Chrome
				// and a subset of desktop installs expose these as a quick
				// menu on the installed app icon. iOS ignores them today.
				// Keep to 4 high-signal destinations to avoid clutter.
				shortcuts: [
					{
						name: 'My Journal',
						short_name: 'Journal',
						description: 'Write a new journal entry.',
						url: '/Mirror/journal',
						icons: [{ src: '/Mirror/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
					},
					{
						name: 'My Mirror',
						short_name: 'Mirror',
						description: 'Open your personal Truth Mirror Report.',
						url: '/Mirror/mymirror',
						icons: [{ src: '/Mirror/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
					},
					{
						name: 'MirrorGroups',
						short_name: 'Groups',
						description: 'Jump to your groups.',
						url: '/Mirror/groups',
						icons: [{ src: '/Mirror/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
					},
					{
						name: 'TruthStream',
						short_name: 'TruthStream',
						description: 'Review your TruthStream.',
						url: '/Mirror/truthstream',
						icons: [{ src: '/Mirror/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
					},
				],
				// Phase 7: screenshots make Chrome show the rich install
				// dialog (with carousel) instead of the mini info bar.
				// We re-use the brand logo as a single hero shot until
				// true product screenshots land. `form_factor` is required
				// for each surface to gate on this.
				screenshots: [
					{
						src: '/Mirror/mirror-logo-sakura.png',
						sizes: '1024x1536',
						type: 'image/png',
						form_factor: 'narrow',
						label: 'Mirror — personal intelligence',
					},
					{
						src: '/Mirror/mirror-logo-sakura.png',
						sizes: '1024x1536',
						type: 'image/png',
						form_factor: 'wide',
						label: 'Mirror — personal intelligence',
					},
				],
			},

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

			devOptions: {
				// Keep the service worker OFF in `npm run dev`. In dev a SW adds
				// zero value and actively breaks the workflow: it calls
				// clientsClaim() and intercepts navigations, which produces a
				// blank-flash + full reload on first load and fights Vite HMR.
				// The SW is still generated for production builds (injectManifest
				// runs on `vite build` regardless of this flag).
				enabled: false,
				type: 'module',
				navigateFallback: '/Mirror/index.html',
			},
		}),
	],
	server: {
		proxy: {
			'/mirror/api':         { target: 'https://www.theundergroundrailroad.world', changeOrigin: true, secure: true },
			'/ws':                 { target: 'wss://www.theundergroundrailroad.world', changeOrigin: true, ws: true, secure: true },
			'/mirror/groups/ws':   { target: 'wss://www.theundergroundrailroad.world', changeOrigin: true, ws: true, secure: true },
			'/mirror/groups/chat': { target: 'wss://www.theundergroundrailroad.world', changeOrigin: true, ws: true, secure: true },
		},
	},
})