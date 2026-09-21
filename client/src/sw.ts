// ============================================================================
// SERVICE WORKER (Phase 5)
// ============================================================================
// File: src/sw.ts (compiled to dist/sw.js by vite-plugin-pwa injectManifest)
//
// Responsibilities:
//   1. Workbox precache + runtime caching (parity with generateSW Phase 1-3
//      behavior, just authored explicitly).
//   2. push event — receive a push payload, surface as a system notification,
//      update the app badge.
//   3. notificationclick event — focus an existing tab, or open a new one
//      deep-linked to the payload's url.
//   4. message channel — apply skipWaiting on user-triggered Reload only.
//
// IMPORTANT
//   - This file is compiled with the SW global scope, NOT the Window scope.
//     `self` is a ServiceWorkerGlobalScope here. Do not import client code
//     that touches DOM, localStorage, or Window APIs.
//   - The plugin replaces `self.__WB_MANIFEST` with the precache list at
//     build time. Keep the literal `self.__WB_MANIFEST` reference exactly.
// ============================================================================

/// <reference lib="webworker" />

import { registerRoute, setCatchHandler, NavigationRoute } from 'workbox-routing';
import {
	CacheFirst,
	NetworkFirst,
	StaleWhileRevalidate,
} from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { clientsClaim } from 'workbox-core';

// __WB_MANIFEST is injected by vite-plugin-pwa at build time. Its type used to
// come from the workbox-precaching import; now that we precache manually, declare
// it here so `self.__WB_MANIFEST` stays typed.
type PrecacheEntry = string | { url: string; revision?: string | null };
declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: PrecacheEntry[] };

// ============================================================================
// DEV vs PROD
// ============================================================================
// In `npm run dev`, vite-plugin-pwa serves this worker at /Mirror/dev-sw.js
// (devOptions.enabled) and Vite serves the HTML + ES modules with content-
// hashed, frequently-changing URLs (e.g. ?v=abc123 on every dep re-optimize).
//
// The app-shell model (precache index.html + serve it for every navigation)
// is correct in PRODUCTION (assets are static and content-hashed at build) but
// BREAKS in dev: the cached index.html snapshot references module URLs that go
// stale within seconds, so Vite's client detects the mismatch and forces a
// full-page reload — the "blank flash + reload on first visit" loop, which also
// wipes any in-flight UI (e.g. the registration error banner) before it paints.
//
// So precache + navigation-fallback are PRODUCTION-ONLY. The worker still runs
// in dev (push, notification clicks, runtime API caching) — only the app-shell
// serving, which is meaningless against Vite's dev server, is skipped.
const IS_DEV_SW =
	self.location.search.includes('dev-sw') ||
	self.location.hostname === 'localhost' ||
	self.location.hostname === '127.0.0.1';

// ============================================================================
// LIFECYCLE
// ============================================================================
//
// clientsClaim: take control of any uncontrolled clients on activation. This
// makes a brand-new install start intercepting fetches immediately on the
// page that just registered the SW, instead of waiting for the next nav.
clientsClaim();

// ----------------------------------------------------------------------------
// SELF-UPDATING + SELF-HEALING (hardening)
// ----------------------------------------------------------------------------
// Previously the SW waited (registerType 'prompt') until the user clicked
// "Reload". Combined with the app-shell being served from cache, a new deploy
// could leave a browser serving a STALE index.html that points at a hashed
// bundle the deploy already deleted -> 404 -> white screen, with no way to
// recover except manually clearing site data. And if the cache had filled the
// origin quota, the new SW couldn't even install to offer the prompt.
//
// The fix has three parts: (1) skipWaiting so a new SW takes over immediately
// instead of queuing behind the broken one; (2) reclaimQuota() frees the big
// runtime caches when storage is pressured, so a full quota can never deadlock
// an update (cache deletes succeed even when writes fail); (3) the navigation
// route below is NetworkFirst, so an online client always gets a FRESH shell
// referencing the current bundle. Together these let a stuck browser self-heal
// on its next reload/visit. We still never force a surprise reload — pwa.ts
// only reloads on a user-approved update — so an in-session page is undisturbed.
self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		self.skipWaiting();
	}
});

// vite-plugin-pwa injects the precache list at `self.__WB_MANIFEST` — it MUST
// appear literally exactly once or the plugin can't find its injection point.
// We deliberately DO NOT use workbox `precacheAndRoute`: its install step is
// FATAL if a cache write fails (full or corrupt CacheStorage), which is exactly
// the deadlock that left browsers permanently stuck — the new SW couldn't
// install, so the old broken one kept control. Instead we precache best-effort
// (below) so install can NEVER fail, and serve everything network-first with a
// raw fetch that doesn't depend on CacheStorage at all.
const precacheManifest = self.__WB_MANIFEST;
const PRECACHE_URLS: string[] = precacheManifest
	.map((e) => (typeof e === 'string' ? e : e && typeof e === 'object' ? (e as { url?: string }).url : undefined))
	.filter((u): u is string => typeof u === 'string');

const SHELL_CACHE = 'mirror-shell';
const SHELL_URL = '/Mirror/index.html';

// Cleanup + quota reclaim. Best-effort throughout: a corrupt/full CacheStorage
// may throw on open/delete, and we must never let that reject the lifecycle.
//   * Always delete stale workbox precache caches left by older SW versions
//     (we no longer use them) to free space.
//   * Under quota pressure, drop the large runtime caches (216 MB face-api
//     models dominate). Cache deletes succeed even at 100% quota, which is what
//     frees a wedged browser.
async function cleanupCaches(): Promise<void> {
	try {
		const names = await caches.keys();
		for (const name of names) {
			if (name.startsWith('workbox-precache')) {
				try { await caches.delete(name); } catch { /* ignore */ }
			}
		}
	} catch { /* CacheStorage unavailable — nothing to clean */ }
	try {
		const est = await self.navigator?.storage?.estimate?.();
		const usage = est?.usage ?? 0;
		const quota = est?.quota ?? 0;
		if (quota > 0 && usage / quota > 0.8) {
			for (const name of ['mirror-faceapi-models', 'mirror-iq-images']) {
				try { await caches.delete(name); } catch { /* ignore */ }
			}
		}
	} catch { /* best-effort */ }
}

// Best-effort precache of the shell + small static assets. Wrapped so a failed
// write (full/corrupt storage) can NEVER fail install. Large images that would
// blow the quota are simply skipped; the app still works (served from network).
async function precacheBestEffort(): Promise<void> {
	if (IS_DEV_SW) return;
	try {
		const cache = await caches.open(SHELL_CACHE);
		await Promise.all(
			PRECACHE_URLS.map(async (url) => {
				try { await cache.add(new Request(url, { cache: 'reload' })); } catch { /* skip this one */ }
			}),
		);
	} catch { /* CacheStorage unusable — runtime network fetch covers us */ }
}

self.addEventListener('install', (event) => {
	// Take over immediately (no waiting behind a broken SW). Free space, then
	// best-effort precache. NONE of these can fail install.
	event.waitUntil((async () => {
		await cleanupCaches();
		await precacheBestEffort();
		await self.skipWaiting();
	})());
});

self.addEventListener('activate', (event) => {
	// On activation of a NEW deploy, drop the hashed-asset cache: those bundles
	// belong to the previous build and are dead weight (the current build's
	// assets re-cache on next load via the network-fallback handler). This bounds
	// the asset cache to one build and keeps storage from creeping up over
	// deploys — the growth that led to the quota exhaustion in the first place.
	event.waitUntil((async () => {
		await cleanupCaches();
		try { await caches.delete('mirror-assets'); } catch { /* best-effort */ }
	})());
});

// ============================================================================
// SPA NAVIGATION — NetworkFirst app shell
// ============================================================================
// Every navigation under /Mirror/* is served the app shell (index.html). We use
// NetworkFirst against index.html specifically (not the requested path, so deep
// links work regardless of server-side SPA fallback):
//   * ONLINE  -> fetch the CURRENT index.html, which references the CURRENT
//     hashed bundle. This is what eliminates the stale-shell -> deleted-bundle
//     -> 404 white screen after a deploy, and lets a previously-stuck browser
//     self-heal on its next reload.
//   * OFFLINE / slow -> after a 3s timeout, serve the last good shell from the
//     'mirror-shell' cache; if that's empty, setCatchHandler falls back to the
//     precached index.html.
//
// Deny-list: never serve HTML for API or WebSocket upgrade paths.
// PRODUCTION-ONLY: in dev, navigations must fall through to Vite for fresh HTML
// + correctly-versioned module URLs (see IS_DEV_SW note).
// Custom handler (NOT a workbox strategy) so a corrupt/unavailable CacheStorage
// can NEVER block serving the shell: we fetch index.html from the network with a
// raw fetch first, and only TOUCH the cache best-effort (read fallback, write
// update) inside try/catch. This is what makes a normal reload recover a wedged
// browser — no hard-reload needed — because the app never depends on the cache
// being healthy to load.
async function fetchFreshShell(): Promise<Response> {
	// 1. Network first — a plain fetch, unaffected by a broken CacheStorage.
	try {
		const net = await fetch(SHELL_URL, { cache: 'no-store' });
		if (net && net.ok) {
			// Best-effort: refresh the offline copy. Swallow any cache error.
			try {
				const cache = await caches.open(SHELL_CACHE);
				await cache.put(SHELL_URL, net.clone());
			} catch { /* cache unusable — serving from network is enough */ }
			return net;
		}
	} catch { /* offline or fetch failed — fall through to cache */ }

	// 2. Fallback: last good cached shell (best-effort; may throw if corrupt).
	try {
		const cache = await caches.open(SHELL_CACHE);
		const hit = await cache.match(SHELL_URL);
		if (hit) return hit;
	} catch { /* cache unavailable */ }

	// 3. Last resort: a plain fetch with no options (also serves offline error).
	return fetch(SHELL_URL);
}

if (!IS_DEV_SW) {
	registerRoute(
		new NavigationRoute(() => fetchFreshShell(), {
			denylist: [/^\/mirror\/api\//, /^\/mirror\/groups\/chat/],
		}),
	);
}

// ============================================================================
// RUNTIME CACHING
// ============================================================================
// JS/CSS chunks under /Mirror/assets/* — vite emits content-hashed
// filenames (index-XXXX.js), so each file is immutable per build.
// CacheFirst is the right strategy: hit on every repeat visit / offline
// load, only refetched when a new deploy emits a new hash. The
// ExpirationPlugin auto-evicts old hashes as new ones arrive.
//
// This is what allows us to keep the giant main bundle OUT of precache
// (where Workbox's size-limit machinery would complain) without
// losing offline support: first visit downloads + caches the bundle,
// subsequent visits serve from cache, offline launches do the same.
// Hashed JS/CSS chunks are immutable per build, so cache-first is ideal for
// repeat/offline loads. But a corrupt/unavailable CacheStorage must NEVER stop a
// script from loading (that is a white screen even with a fresh shell), so this
// is a hand-rolled cache-first with a guaranteed network fallback — every cache
// op is best-effort and, if it throws, we serve straight from the network.
registerRoute(
	({ url, request }) =>
		url.pathname.startsWith('/Mirror/assets/') &&
		(request.destination === 'script' || request.destination === 'style'),
	async ({ request }) => {
		try {
			const cache = await caches.open('mirror-assets');
			const hit = await cache.match(request);
			if (hit) return hit;
			const net = await fetch(request);
			if (net && (net.status === 200 || net.status === 0)) {
				try { await cache.put(request, net.clone()); } catch { /* quota/corrupt — skip caching */ }
			}
			return net;
		} catch {
			// CacheStorage unusable — serve straight from the network so the app
			// still boots. This is the corruption-proof path.
			return fetch(request);
		}
	},
);

// face-api ML models (216 MB total, served from /Mirror/models/faceapi/).
// Files have no extension (e.g. tiny_face_detector_model-shard1) so we
// match by URL path. Each shard is content-stable per name → CacheFirst.
registerRoute(
	({ url }) => url.pathname.startsWith('/Mirror/models/faceapi/'),
	new CacheFirst({
		cacheName: 'mirror-faceapi-models',
		plugins: [
			new CacheableResponsePlugin({ statuses: [0, 200] }),
			new ExpirationPlugin({
				maxEntries: 30,
				maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
				purgeOnQuotaError: true,
			}),
		],
	}),
);

// IQ test reference images (SVGs).
registerRoute(
	({ url }) => url.pathname.startsWith('/Mirror/images/iq/'),
	new CacheFirst({
		cacheName: 'mirror-iq-images',
		plugins: [
			new CacheableResponsePlugin({ statuses: [0, 200] }),
			new ExpirationPlugin({
				maxEntries: 50,
				maxAgeSeconds: 60 * 60 * 24 * 30,
				purgeOnQuotaError: true,
			}),
		],
	}),
);

// Google Fonts CSS.
registerRoute(
	({ url }) => url.origin === 'https://fonts.googleapis.com',
	new StaleWhileRevalidate({
		cacheName: 'google-fonts-css',
		plugins: [
			new CacheableResponsePlugin({ statuses: [0, 200] }),
			new ExpirationPlugin({
				maxEntries: 10,
				maxAgeSeconds: 60 * 60 * 24 * 7,
			}),
		],
	}),
);

// Google Fonts files.
registerRoute(
	({ url }) => url.origin === 'https://fonts.gstatic.com',
	new CacheFirst({
		cacheName: 'google-fonts-files',
		plugins: [
			new CacheableResponsePlugin({ statuses: [0, 200] }),
			new ExpirationPlugin({
				maxEntries: 30,
				maxAgeSeconds: 60 * 60 * 24 * 365,
			}),
		],
	}),
);

// Mirror API GETs — NetworkFirst with 3s timeout. POST/PUT/DELETE bypass
// the SW because the matcher only returns true for GET.
registerRoute(
	({ url, request }) =>
		request.method === 'GET' && url.pathname.startsWith('/mirror/api/'),
	new NetworkFirst({
		cacheName: 'mirror-api',
		networkTimeoutSeconds: 3,
		plugins: [
			new CacheableResponsePlugin({ statuses: [0, 200] }),
			new ExpirationPlugin({
				maxEntries: 100,
				maxAgeSeconds: 60 * 60 * 24,
				purgeOnQuotaError: true,
			}),
		],
	}),
	'GET',
);

// ============================================================================
// CATCH-ALL FALLBACK
// ============================================================================
// If all of the above strategies fail (e.g. truly offline + nothing in
// cache for an asset Workbox wasn't told about), this returns a cached
// shell for navigations and a generic Response otherwise.
setCatchHandler(async ({ request }) => {
	// Offline document fallback is production-only — in dev there's no precache
	// and we must let navigation failures surface to Vite rather than mask them
	// with a blank cached shell (see IS_DEV_SW note). Best-effort: a corrupt
	// CacheStorage must not throw here either.
	if (!IS_DEV_SW && request.destination === 'document') {
		try {
			const cache = await caches.open(SHELL_CACHE);
			const fallback = await cache.match(SHELL_URL);
			if (fallback) return fallback;
		} catch { /* cache unavailable — fall through */ }
	}
	return Response.error();
});

// ============================================================================
// PUSH PAYLOAD SHAPE
// ============================================================================
// Mirrors the server's PushPayload (services/pushService.ts). Kept tiny —
// push services cap encrypted payloads at ~4096 B; we cap raw at 3000 B.
//
// Optional `unreadCount` lets the SW set the OS-level app icon badge (iOS
// 16.4+, Chrome, Edge, Opera). Falls back silently on unsupported platforms.
interface PushPayload {
	title: string;
	body: string;
	url?: string;
	tag?: string;
	icon?: string;
	badge?: string;
	data?: Record<string, unknown>;
	unreadCount?: number;
	requireInteraction?: boolean;
	silent?: boolean;
	renotify?: boolean;
}

const DEFAULT_ICON = '/Mirror/pwa-192x192.png';
const DEFAULT_BADGE = '/Mirror/pwa-192x192.png'; // Should be a small monochrome PNG; reusing main icon for now.
const DEFAULT_TITLE = 'Mirror';
const DEFAULT_BODY = 'You have a new notification.';

function safeParsePayload(event: PushEvent): PushPayload {
	if (!event.data) {
		return { title: DEFAULT_TITLE, body: DEFAULT_BODY };
	}
	try {
		const parsed = event.data.json() as Partial<PushPayload>;
		return {
			title: typeof parsed.title === 'string' && parsed.title ? parsed.title : DEFAULT_TITLE,
			body: typeof parsed.body === 'string' && parsed.body ? parsed.body : DEFAULT_BODY,
			url: typeof parsed.url === 'string' ? parsed.url : undefined,
			tag: typeof parsed.tag === 'string' ? parsed.tag : undefined,
			icon: typeof parsed.icon === 'string' ? parsed.icon : undefined,
			badge: typeof parsed.badge === 'string' ? parsed.badge : undefined,
			data: parsed.data && typeof parsed.data === 'object' ? parsed.data : undefined,
			unreadCount:
				typeof parsed.unreadCount === 'number' && parsed.unreadCount >= 0
					? parsed.unreadCount
					: undefined,
			requireInteraction: !!parsed.requireInteraction,
			silent: !!parsed.silent,
			renotify: !!parsed.renotify,
		};
	} catch {
		// Last-ditch: try .text() so we still surface SOMETHING to the user
		// rather than failing silently if the payload isn't valid JSON.
		try {
			const text = event.data.text();
			return { title: DEFAULT_TITLE, body: text.slice(0, 200) || DEFAULT_BODY };
		} catch {
			return { title: DEFAULT_TITLE, body: DEFAULT_BODY };
		}
	}
}

// ============================================================================
// APP BADGE
// ============================================================================
// navigator.setAppBadge / clearAppBadge land on the SW's WorkerNavigator.
// Wrapped in try/catch because the call can throw on some browsers when the
// PWA isn't installed or the count is invalid.
async function updateBadge(count: number | undefined): Promise<void> {
	const nav = self.navigator as Navigator & {
		setAppBadge?: (count: number) => Promise<void>;
		clearAppBadge?: () => Promise<void>;
	};
	if (!nav.setAppBadge) return;
	try {
		if (typeof count === 'number' && count > 0) {
			await nav.setAppBadge(count);
		} else if (count === 0 && nav.clearAppBadge) {
			await nav.clearAppBadge();
		}
	} catch {
		// Badging is polish, never block notification display.
	}
}

// ============================================================================
// PUSH EVENT
// ============================================================================
//
// Phase 6a.5: skip the OS notification when a Mirror window is visible+focused.
// The server already tries to skip push for active users (visibility-tracked
// over WS), but races still happen — the user backgrounds, server fires push
// based on stale visibility, push arrives ~50ms later. The SW catches that
// last-ms case here.
//
// Web Push spec requires `userVisibleOnly: true` subscriptions to result in
// a user-visible notification — most browsers warn but don't revoke if you
// don't show one, but Safari/iOS is stricter. So when we suppress: post the
// payload to the visible client (so the app can render an in-app toast if
// it wants) AND show a `silent: true` notification briefly, then close it.
// This satisfies the spec without buzzing the user mid-use.

async function handlePushEvent(event: PushEvent): Promise<void> {
	const payload = safeParsePayload(event);

	// `renotify` is valid per spec but missing from TS's NotificationOptions
	// type (lib.dom.d.ts hasn't caught up). Cast through unknown to set it.
	const notificationOptions = {
		body: payload.body,
		icon: payload.icon || DEFAULT_ICON,
		badge: payload.badge || DEFAULT_BADGE,
		tag: payload.tag,
		data: {
			url: payload.url,
			...(payload.data || {}),
		},
		requireInteraction: payload.requireInteraction,
		silent: payload.silent,
		renotify: payload.renotify,
	} as unknown as NotificationOptions;

	const visibleClient = await findVisibleClient();
	if (visibleClient) {
		// User is actively in the app — forward to the client for in-app
		// rendering, suppress the OS notification.
		try {
			visibleClient.postMessage({ type: 'PUSH_RECEIVED_WHILE_ACTIVE', payload });
		} catch {
			// non-fatal
		}

		// Spec compliance: still show *something* (silent + auto-close)
		// so userVisibleOnly contract is satisfied. iOS Safari is the
		// strictest enforcer; this dance keeps the subscription healthy.
		const silentOptions = {
			...notificationOptions,
			silent: true,
			requireInteraction: false,
			tag: payload.tag,
		} as unknown as NotificationOptions;

		await self.registration.showNotification(payload.title, silentOptions);
		// Close after a tick. Wrapping the timeout in a Promise so the
		// outer event.waitUntil keeps the SW alive long enough to close.
		// Otherwise on slower devices the SW could be killed mid-tick,
		// leaving the silent notification on screen forever.
		await new Promise<void>((resolve) => {
			setTimeout(async () => {
				try {
					const notifs = await self.registration.getNotifications({ tag: payload.tag });
					notifs.forEach((n) => n.close());
				} catch {
					/* non-fatal */
				}
				resolve();
			}, 100);
		});
		// Update badge regardless — unread count should reflect reality.
		await updateBadge(payload.unreadCount);
		return;
	}

	// No visible client — show the regular OS notification.
	await Promise.all([
		self.registration.showNotification(payload.title, notificationOptions),
		updateBadge(payload.unreadCount),
	]);
}

async function findVisibleClient(): Promise<WindowClient | null> {
	try {
		const all = await self.clients.matchAll({
			type: 'window',
			includeUncontrolled: true,
		});
		for (const c of all) {
			if (c.visibilityState === 'visible' && c.focused) {
				return c as WindowClient;
			}
		}
	} catch {
		// matchAll is broadly supported, but if it ever throws we just
		// fall through and show the notification — better to over-deliver.
	}
	return null;
}

self.addEventListener('push', (event) => {
	// waitUntil keeps the SW alive for the whole show/skip flow.
	event.waitUntil(handlePushEvent(event));
});

// ============================================================================
// NOTIFICATION CLICK
// ============================================================================
// Click handler: focus an existing Mirror tab if one is open, navigating it
// to the deep-link URL if needed. Otherwise open a new window. Falls back
// to the app root if no URL was provided.
self.addEventListener('notificationclick', (event) => {
	event.notification.close();

	const data = (event.notification.data || {}) as { url?: string };
	const targetUrl = sanitizeTargetUrl(data.url);

	event.waitUntil(focusOrOpen(targetUrl));
});

/**
 * Only allow same-origin URLs to be navigated to. Defends against a
 * malicious or buggy server sending an off-origin URL in a payload.
 */
function sanitizeTargetUrl(rawUrl: string | undefined): string {
	const fallback = '/Mirror/';
	if (!rawUrl || typeof rawUrl !== 'string') return fallback;

	try {
		const u = new URL(rawUrl, self.location.origin);
		if (u.origin !== self.location.origin) return fallback;
		// Confine deep-links to /Mirror/* so a payload can't point at e.g.
		// /admin or another app on the same origin.
		if (!u.pathname.startsWith('/Mirror/')) return fallback;
		return u.pathname + u.search + u.hash;
	} catch {
		return fallback;
	}
}

async function focusOrOpen(targetUrl: string): Promise<void> {
	const allClients = await self.clients.matchAll({
		type: 'window',
		includeUncontrolled: true,
	});

	// Prefer an existing client. If one is already on the target URL,
	// just focus it. Otherwise focus the first Mirror client and navigate it.
	const targetAbsolute = new URL(targetUrl, self.location.origin).href;

	for (const client of allClients) {
		if (client.url === targetAbsolute) {
			await client.focus();
			return;
		}
	}

	for (const client of allClients) {
		if (
			client.url.startsWith(self.location.origin + '/Mirror/') &&
			'navigate' in client
		) {
			try {
				await (client as WindowClient).navigate(targetUrl);
				await client.focus();
				return;
			} catch {
				// Some browsers reject navigate() across SW versions; fall
				// through to opening a new window.
			}
		}
	}

	// No existing tab → open one.
	if (self.clients.openWindow) {
		await self.clients.openWindow(targetUrl);
	}
}

// ============================================================================
// PUSH SUBSCRIPTION CHANGE
// ============================================================================
// Fires when the browser invalidates and re-issues a push subscription
// (rare — usually after a token rotation, profile change, or extended
// inactivity). The new subscription must be POSTed to the server; the
// old one is gone. Without handling this, users would silently stop
// receiving pushes.
//
// The SW can't reach our auth token directly — instead we ping any open
// client to take care of re-subscribing. If no client is open, the next
// time the user opens the app, the in-app subscribe flow will detect the
// missing record on the server and re-subscribe.
// TypeScript's ServiceWorkerGlobalScopeEventMap doesn't include
// 'pushsubscriptionchange' (lib.webworker.d.ts gap), so the handler arg
// gets typed as Event without waitUntil. Cast to ExtendableEvent — the
// runtime type is PushSubscriptionChangeEvent which IS extendable.
self.addEventListener('pushsubscriptionchange', ((event: ExtendableEvent) => {
	event.waitUntil(notifyClientsOfSubscriptionChange());
}) as EventListener);

async function notifyClientsOfSubscriptionChange(): Promise<void> {
	const allClients = await self.clients.matchAll({
		type: 'window',
		includeUncontrolled: true,
	});
	for (const client of allClients) {
		client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED' });
	}
}