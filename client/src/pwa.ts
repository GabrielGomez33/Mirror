// client/src/pwa.ts
//
// Service worker registration. Imported once from main.tsx.
//
// We register the SW directly via `navigator.serviceWorker.register` instead
// of using `virtual:pwa-register`. The virtual module wraps registration in
// workbox-window, which races vite-plugin-pwa's dev HMR listener and produces
// `AbortError: Operation has been aborted`.
//
// In prod, vite-plugin-pwa generates `/Mirror/sw.js` with workbox precaching.
// In dev, with `devOptions.enabled: true`, the plugin serves the SW at
// `/Mirror/dev-sw.js?dev-sw`.
//
// URLs are hardcoded because vite.config.ts uses `base: '/Mirror'` (no
// trailing slash), which makes `import.meta.env.BASE_URL` resolve to
// '/Mirror' — concatenating that with 'sw.js' yields '/Mirrorsw.js' (404).
//
// Microsoft Edge note: in default "Balanced" tracking prevention, Edge
// silently blocks SW registration on localhost with `AbortError: Operation
// has been aborted`. Test in Chrome or add localhost to Edge's tracking
// prevention exceptions (edge://settings/privacy) for local development.

const SW_URL = import.meta.env.DEV
	? '/Mirror/dev-sw.js?dev-sw'
	: '/Mirror/sw.js';

const SW_SCOPE = '/Mirror/';

export function initPWA(): void {
	if (!('serviceWorker' in navigator)) return;

	const register = async () => {
		try {
			const registration = await navigator.serviceWorker.register(SW_URL, {
				scope: SW_SCOPE,
				type: 'classic',
			});
			console.log('[PWA] service worker registered:', registration.scope);
		} catch (error) {
			console.error('[PWA] service worker registration failed:', error);
		}
	};

	if (document.readyState === 'complete') {
		register();
	} else {
		window.addEventListener('load', register, { once: true });
	}
}