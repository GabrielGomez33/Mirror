// client/src/pwa.ts
//
// Service worker registration + update lifecycle. Imported once from main.tsx.
//
// REGISTRATION (Phase 1):
// We call navigator.serviceWorker.register directly rather than going through
// virtual:pwa-register / workbox-window. The wrapper races vite-plugin-pwa's
// dev HMR listener and produces 'AbortError: Operation has been aborted'.
//
// SW URL — DEV vs PROD:
// In prod, vite-plugin-pwa generates `/Mirror/sw.js` with workbox precaching.
// In dev, with `devOptions.enabled: true`, the plugin serves the SW at
// `/Mirror/dev-sw.js?dev-sw`. SW_URL below picks the right one based on
// import.meta.env.DEV.
//
// WHY THE URLs ARE HARDCODED (don't "fix" this):
// vite.config.ts uses `base: '/Mirror'` (no trailing slash), which makes
// `import.meta.env.BASE_URL` resolve to '/Mirror' — concatenating that with
// 'sw.js' yields '/Mirrorsw.js' (a 404 that the SPA fallback serves as HTML,
// which the browser then aborts as an invalid SW). Hardcoding sidesteps
// this base-URL gotcha. If you ever change `base` to '/Mirror/' (trailing
// slash), you can switch back to template literals — but verify the URLs.
//
// UPDATE FLOW (Phase 2):
// vite.config.ts uses registerType: 'prompt' — when a new SW is found, it
// installs in the background and waits. We:
//   1. Listen for the registration's `updatefound` event
//   2. When the new worker reaches `installed` AND there's already a
//      controller (i.e. it's an update, not a first install), dispatch
//      a `pwa:update-available` CustomEvent with `detail.registration`
//   3. UpdateBanner listens for that event and shows a "Reload" prompt
//   4. On click, banner posts {type: 'SKIP_WAITING'} to the waiting SW
//   5. SW activates; `controllerchange` fires; we reload the page once
//
// MICROSOFT EDGE NOTE:
// In default "Balanced" tracking prevention, Edge silently blocks SW
// registration on localhost — and sometimes on first-party HTTPS too —
// with `AbortError: Operation has been aborted`. We accept this as a
// soft-fail: Edge users with strict tracking settings won't get PWA
// features, but the regular site continues to work. For local dev, test
// in Chrome or add localhost to Edge's tracking prevention exceptions
// (edge://settings/privacy).

const SW_URL = import.meta.env.DEV
	? '/Mirror/dev-sw.js?dev-sw'
	: '/Mirror/sw.js';

const SW_SCOPE = '/Mirror/';

// Custom event the UpdateBanner listens for.
export const PWA_UPDATE_EVENT = 'pwa:update-available';

// Custom event dispatched when the SW notifies us that the browser
// invalidated the push subscription (pushsubscriptionchange in the SW).
// The notifications/push UI listens for this and triggers a re-subscribe
// against the new endpoint. Without this, users would silently stop
// receiving pushes when the browser rotates the token.
export const PWA_PUSH_SUBSCRIPTION_CHANGED = 'pwa:push-subscription-changed';

export interface PWAUpdateDetail {
	registration: ServiceWorkerRegistration;
}

declare global {
	interface WindowEventMap {
		[PWA_UPDATE_EVENT]: CustomEvent<PWAUpdateDetail>;
		[PWA_PUSH_SUBSCRIPTION_CHANGED]: CustomEvent<void>;
	}
}

// Persistent storage hint — asks the OS not to evict our cache under
// storage pressure. Once a PWA is installed, browsers grant this
// automatically; for casual visitors it's denied. Either outcome is fine
// — denial just means we keep the default "best effort" tier.
async function requestPersistentStorage(): Promise<void> {
	if (!navigator.storage?.persist) return;
	try {
		const already = await navigator.storage.persisted?.();
		if (already) return;
		const granted = await navigator.storage.persist();
		if (granted) {
			console.log('[PWA] storage marked persistent — cache safe from auto-eviction');
		}
	} catch {
		// Non-fatal — best-effort caching still works without persist().
	}
}

// One-shot reload guard. `controllerchange` can fire more than once
// (e.g. multiple tabs all triggering skipWaiting); we only reload once.
let reloadingForUpdate = false;

function watchForWaiting(registration: ServiceWorkerRegistration): void {
	const announceIfWaiting = (sw: ServiceWorker | null) => {
		if (!sw) return;
		// Only announce as an "update" if there's already an active controller.
		// On first install there's no previous SW, so the new one isn't an update.
		if (!navigator.serviceWorker.controller) return;
		if (sw.state === 'installed') {
			window.dispatchEvent(
				new CustomEvent<PWAUpdateDetail>(PWA_UPDATE_EVENT, {
					detail: { registration },
				}),
			);
		}
	};

	// Case 1: there's already a waiting worker at registration time.
	if (registration.waiting) announceIfWaiting(registration.waiting);

	// Case 2: a new worker is found while the page is open. Watch its lifecycle.
	registration.addEventListener('updatefound', () => {
		const installing = registration.installing;
		if (!installing) return;
		installing.addEventListener('statechange', () => {
			announceIfWaiting(installing);
		});
	});
}

export function initPWA(): void {
	if (!('serviceWorker' in navigator)) return;

	// When the active SW changes (i.e. the waiting SW activated after we
	// posted SKIP_WAITING), reload once so the page picks up the new shell.
	navigator.serviceWorker.addEventListener('controllerchange', () => {
		if (reloadingForUpdate) return;
		reloadingForUpdate = true;
		window.location.reload();
	});

	// SW → page channel. The custom service worker posts these messages when
	// the browser invalidates the push subscription (pushsubscriptionchange).
	// Re-dispatched as a window CustomEvent so React components can react via
	// useEffect listeners.
	navigator.serviceWorker.addEventListener('message', (event) => {
		if (!event.data || typeof event.data !== 'object') return;
		if (event.data.type === 'PUSH_SUBSCRIPTION_CHANGED') {
			window.dispatchEvent(new CustomEvent(PWA_PUSH_SUBSCRIPTION_CHANGED));
		}
	});

	const register = async () => {
		try {
			// injectManifest mode + Vite serves the dev SW as an ES module,
			// so we register with type: 'module' in dev. In prod the SW is
			// bundled and served as classic — both work because the build
			// uses different entry points.
			const registration = await navigator.serviceWorker.register(SW_URL, {
				scope: SW_SCOPE,
				type: import.meta.env.DEV ? 'module' : 'classic',
			});
			console.log('[PWA] service worker registered:', registration.scope);
			watchForWaiting(registration);
			// Persistent storage is best requested AFTER registration so the
			// browser can correlate the request with an installable PWA.
			void requestPersistentStorage();
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

// Called by UpdateBanner when the user clicks "Reload to update".
// Tells the waiting SW to skipWaiting; the controllerchange handler above
// reloads the page automatically once the new SW takes control.
export function applyPWAUpdate(registration: ServiceWorkerRegistration): void {
	const waiting = registration.waiting;
	if (!waiting) {
		// Edge case: no waiting worker (e.g. user clicked stale banner). Just reload.
		window.location.reload();
		return;
	}
	waiting.postMessage({ type: 'SKIP_WAITING' });
}