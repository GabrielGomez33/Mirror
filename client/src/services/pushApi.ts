// ============================================================================
// PUSH NOTIFICATIONS API CLIENT (Phase 5)
// ============================================================================
// File: services/pushApi.ts
// Description: Browser-side calls to the Phase 4 mirror-server push routes.
//              Mirrors the server contract from server-changes/mirror-server/
//              routes/push.ts.
//
// Endpoints (server):
//   GET    /mirror/api/push/vapid-public-key   public
//   POST   /mirror/api/push/subscribe          bearer auth
//   DELETE /mirror/api/push/subscribe          bearer auth
//   GET    /mirror/api/push/devices            bearer auth
//
// What this module does NOT do:
//   - Ask for Notification permission (caller's job — must be in a user
//     gesture handler; we don't want to be tempted to call it eagerly).
//   - Manage UI state (caller's job; consumers use hooks/usePushSubscription).
//
// Why all errors are typed:
//   The settings UI needs to differentiate between "rate limited", "device
//   cap reached", "push not configured on server", and "real network
//   failure" to give actionable feedback to the user.
// ============================================================================

import { getToken } from '../utils/token';

const BASE = import.meta.env.VITE_API_URL
	? `${import.meta.env.VITE_API_URL}/mirror/api/push`
	: '/mirror/api/push';

// ============================================================================
// ERROR TYPES
// ============================================================================

export class PushApiError extends Error {
	readonly status: number;
	readonly code: string;
	constructor(status: number, code: string, message: string) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

export class PushNotConfiguredError extends PushApiError {
	constructor() {
		super(503, 'PUSH_DISABLED', 'Push notifications are not enabled on this server.');
	}
}

export class PushAuthRequiredError extends PushApiError {
	constructor() {
		super(401, 'AUTH_REQUIRED', 'You must be signed in to manage notifications.');
	}
}

export class PushDeviceLimitError extends PushApiError {
	readonly limit: number;
	constructor(limit: number) {
		super(409, 'DEVICE_LIMIT_REACHED', `Maximum of ${limit} devices reached.`);
		this.limit = limit;
	}
}

export class PushRateLimitError extends PushApiError {
	constructor() {
		super(429, 'RATE_LIMITED', 'Too many requests. Please wait a moment and try again.');
	}
}

// ============================================================================
// HELPER
// ============================================================================

interface PushRequestOptions {
	method?: 'GET' | 'POST' | 'DELETE';
	body?: unknown;
	auth?: boolean;
	signal?: AbortSignal;
}

async function pushRequest<T>(
	path: string,
	{ method = 'GET', body, auth = true, signal }: PushRequestOptions = {},
): Promise<T> {
	const headers: Record<string, string> = {
		Accept: 'application/json',
	};
	if (body !== undefined) headers['Content-Type'] = 'application/json';

	if (auth) {
		const token = getToken();
		if (!token) throw new PushAuthRequiredError();
		headers['Authorization'] = `Bearer ${token}`;
	}

	let response: Response;
	try {
		response = await fetch(`${BASE}${path}`, {
			method,
			headers,
			body: body !== undefined ? JSON.stringify(body) : undefined,
			credentials: 'include',
			signal,
		});
	} catch (err) {
		// Network error / abort. Bubble up — caller distinguishes from typed
		// PushApiError.
		throw err;
	}

	let data: unknown;
	try {
		data = await response.json();
	} catch {
		data = null;
	}

	if (response.ok) {
		return data as T;
	}

	const code =
		(data && typeof data === 'object' && 'code' in data && typeof (data as { code: unknown }).code === 'string'
			? (data as { code: string }).code
			: undefined) || 'UNKNOWN';
	const message =
		(data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string'
			? (data as { error: string }).error
			: undefined) || `Request failed (HTTP ${response.status})`;

	switch (response.status) {
		case 401:
			throw new PushAuthRequiredError();
		case 429:
			throw new PushRateLimitError();
		case 503:
			throw new PushNotConfiguredError();
		case 409: {
			const limit =
				data && typeof data === 'object' && 'limit' in data && typeof (data as { limit: unknown }).limit === 'number'
					? (data as { limit: number }).limit
					: 10;
			throw new PushDeviceLimitError(limit);
		}
		default:
			throw new PushApiError(response.status, code, message);
	}
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Fetches the server's VAPID public key. Required before calling
 * pushManager.subscribe(applicationServerKey: ...).
 *
 * Cached server-side (Cache-Control: max-age=3600) so HTTP caching
 * naturally keeps this snappy across reloads.
 */
export async function getVapidPublicKey(signal?: AbortSignal): Promise<string> {
	const result = await pushRequest<{ publicKey: string }>('/vapid-public-key', {
		auth: false,
		signal,
	});
	if (!result?.publicKey || typeof result.publicKey !== 'string') {
		throw new PushApiError(500, 'INVALID_VAPID', 'Server returned no VAPID public key.');
	}
	return result.publicKey;
}

/**
 * Persists a PushSubscription on the server. Idempotent — re-subscribing
 * the same device updates the row in place.
 */
export async function subscribePush(
	subscription: PushSubscription,
	signal?: AbortSignal,
): Promise<{ activeDevices: number }> {
	// PushSubscription.toJSON() returns the {endpoint, keys: {p256dh, auth}}
	// shape the server expects. expirationTime is intentionally dropped —
	// our server doesn't use it.
	const json = subscription.toJSON();
	if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
		throw new PushApiError(400, 'INVALID_SUBSCRIPTION', 'Browser produced an incomplete push subscription.');
	}
	return pushRequest<{ ok: boolean; activeDevices: number }>('/subscribe', {
		method: 'POST',
		body: {
			endpoint: json.endpoint,
			keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
		},
		signal,
	});
}

/**
 * Removes a single subscription. Caller should also call
 * subscription.unsubscribe() locally to clear the browser-side state.
 */
export async function unsubscribePush(
	endpoint: string,
	signal?: AbortSignal,
): Promise<void> {
	await pushRequest<{ ok: boolean }>('/subscribe', {
		method: 'DELETE',
		body: { endpoint },
		signal,
	});
}

/**
 * Returns the count of active push subscriptions for the current user.
 * Useful for "Notifications enabled on N devices" UI.
 */
export async function getActiveDeviceCount(signal?: AbortSignal): Promise<number> {
	const result = await pushRequest<{ activeDevices: number }>('/devices', { signal });
	return typeof result?.activeDevices === 'number' ? result.activeDevices : 0;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert a base64url string (VAPID public key format) to the Uint8Array
 * pushManager.subscribe() expects as applicationServerKey.
 */
export function urlBase64ToUint8Array(base64url: string): Uint8Array {
	// Pad to a multiple of 4
	const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
	const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
	const raw = atob(base64);
	const out = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
	return out;
}
