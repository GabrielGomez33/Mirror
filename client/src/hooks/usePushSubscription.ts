// ============================================================================
// usePushSubscription (Phase 5)
// ============================================================================
// File: hooks/usePushSubscription.ts
// Description: State machine + actions for browser push opt-in. Handles the
//              full lifecycle: read current permission/subscription state,
//              enable (request permission → subscribe → POST), disable
//              (unsubscribe locally + DELETE on server), and react to
//              browser-issued subscription changes.
//
// Invariants:
//   - enable() MUST be called from a user gesture handler (button click).
//     Browsers reject Notification.requestPermission() outside of one.
//   - disable() is idempotent: works whether or not we have a current sub.
//   - Server is the source of truth for "is the user subscribed" only when
//     online. Locally we trust pushManager.getSubscription().
//   - All errors are typed enums so the UI can render specific messaging.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import {
	getActiveDeviceCount,
	getVapidPublicKey,
	subscribePush,
	unsubscribePush,
	urlBase64ToUint8Array,
	PushApiError,
	PushAuthRequiredError,
	PushDeviceLimitError,
	PushNotConfiguredError,
	PushRateLimitError,
} from '../services/pushApi';
import { PWA_PUSH_SUBSCRIPTION_CHANGED } from '../pwa';

// ============================================================================
// PUBLIC TYPES
// ============================================================================

export type PushPermission = NotificationPermission | 'unsupported';

export type PushErrorCode =
	| 'unsupported'
	| 'permission-denied'
	| 'permission-default'
	| 'auth-required'
	| 'server-not-configured'
	| 'rate-limited'
	| 'device-limit'
	| 'subscribe-failed'
	| 'unsubscribe-failed'
	| 'network'
	| 'unknown';

export interface PushError {
	code: PushErrorCode;
	message: string;
	limit?: number;
}

export interface UsePushSubscriptionResult {
	/** True if the browser exposes the push APIs at all. */
	supported: boolean;
	/** Current Notification.permission value, or 'unsupported'. */
	permission: PushPermission;
	/** Local PushSubscription object, or null. */
	subscription: PushSubscription | null;
	/** Number of devices the server thinks are subscribed (across all). */
	activeDevices: number | null;
	/** True while a network operation is in-flight. */
	busy: boolean;
	/** Last error from enable/disable (cleared on next attempt). */
	error: PushError | null;
	/** True after the initial state load completes — UI can hide a skeleton. */
	ready: boolean;
	/** Opt the current device in. MUST be called from a user gesture. */
	enable: () => Promise<boolean>;
	/** Opt the current device out. */
	disable: () => Promise<boolean>;
	/** Force a re-read of the device count from the server. */
	refreshDeviceCount: () => Promise<void>;
}

// ============================================================================
// HOOK
// ============================================================================

const PUSH_SUPPORTED =
	typeof window !== 'undefined' &&
	'serviceWorker' in navigator &&
	'PushManager' in window &&
	'Notification' in window;

export function usePushSubscription(): UsePushSubscriptionResult {
	const [permission, setPermission] = useState<PushPermission>(
		PUSH_SUPPORTED ? Notification.permission : 'unsupported',
	);
	const [subscription, setSubscription] = useState<PushSubscription | null>(null);
	const [activeDevices, setActiveDevices] = useState<number | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<PushError | null>(null);
	const [ready, setReady] = useState(false);

	// Abort signals so unmounted components don't try to setState.
	const abortRef = useRef<AbortController | null>(null);
	useEffect(() => {
		return () => {
			abortRef.current?.abort();
		};
	}, []);

	// Initial state load: read current permission + existing PushSubscription.
	useEffect(() => {
		if (!PUSH_SUPPORTED) {
			setReady(true);
			return;
		}
		let cancelled = false;
		(async () => {
			try {
				const reg = await navigator.serviceWorker.ready;
				const existing = await reg.pushManager.getSubscription();
				if (cancelled) return;
				setSubscription(existing);
				setPermission(Notification.permission);
				if (existing) {
					try {
						const count = await getActiveDeviceCount();
						if (!cancelled) setActiveDevices(count);
					} catch {
						// Non-fatal — device count is informational.
					}
				}
			} catch {
				// Non-fatal: SW not ready yet, or PushManager not available.
			} finally {
				if (!cancelled) setReady(true);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	// React to browser-issued subscription changes (token rotation, etc.).
	// The SW posts PUSH_SUBSCRIPTION_CHANGED via pwa.ts; we re-subscribe
	// transparently if the user had been opted in.
	useEffect(() => {
		if (!PUSH_SUPPORTED) return;
		const onChanged = () => {
			void resubscribeAfterRotation();
		};
		window.addEventListener(PWA_PUSH_SUBSCRIPTION_CHANGED, onChanged);
		return () => window.removeEventListener(PWA_PUSH_SUBSCRIPTION_CHANGED, onChanged);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const resubscribeAfterRotation = useCallback(async () => {
		try {
			const reg = await navigator.serviceWorker.ready;
			// The browser may have already created a new subscription, or we
			// may need to re-subscribe from scratch. Try existing first.
			let sub = await reg.pushManager.getSubscription();
			if (!sub && Notification.permission === 'granted') {
				const vapid = await getVapidPublicKey();
				sub = await reg.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: urlBase64ToUint8Array(vapid),
				});
			}
			if (sub) {
				await subscribePush(sub);
				setSubscription(sub);
				try {
					setActiveDevices(await getActiveDeviceCount());
				} catch {
					// ignore
				}
			}
		} catch {
			// Silent — user can re-enable from settings if needed.
		}
	}, []);

	const refreshDeviceCount = useCallback(async () => {
		if (!PUSH_SUPPORTED) return;
		try {
			const count = await getActiveDeviceCount();
			setActiveDevices(count);
		} catch {
			// non-fatal
		}
	}, []);

	const enable = useCallback(async (): Promise<boolean> => {
		setError(null);

		if (!PUSH_SUPPORTED) {
			setError({
				code: 'unsupported',
				message: 'This browser does not support push notifications.',
			});
			return false;
		}

		// Ask permission. Must be in a user gesture handler — the caller's
		// onClick — but if it's not, the browser quietly returns 'denied'
		// or 'default' without prompting. Either way we surface the right
		// error.
		setBusy(true);
		try {
			const result = await Notification.requestPermission();
			setPermission(result);

			if (result === 'denied') {
				setError({
					code: 'permission-denied',
					message:
						'Notifications are blocked. Enable them in your browser settings to receive Mirror updates.',
				});
				return false;
			}
			if (result !== 'granted') {
				setError({
					code: 'permission-default',
					message: 'Notification permission was not granted.',
				});
				return false;
			}

			const reg = await navigator.serviceWorker.ready;

			// Use the existing PushSubscription if present (idempotent
			// re-enable). Otherwise create a new one.
			let sub = await reg.pushManager.getSubscription();
			if (!sub) {
				const vapid = await getVapidPublicKey();
				sub = await reg.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: urlBase64ToUint8Array(vapid),
				});
			}
			setSubscription(sub);

			const { activeDevices: count } = await subscribePush(sub);
			setActiveDevices(count);
			return true;
		} catch (err) {
			const mapped = mapError(err, 'enable');
			setError(mapped);
			return false;
		} finally {
			setBusy(false);
		}
	}, []);

	const disable = useCallback(async (): Promise<boolean> => {
		setError(null);

		if (!PUSH_SUPPORTED) return true;

		setBusy(true);
		try {
			const reg = await navigator.serviceWorker.ready;
			const existing = await reg.pushManager.getSubscription();

			// Tell the server first so we don't fan out to a dead endpoint.
			// If server-side fails, still try to unsubscribe locally — better
			// to be locally clean than to leave the user with a half-state.
			let serverOk = true;
			if (existing) {
				try {
					await unsubscribePush(existing.endpoint);
				} catch (err) {
					serverOk = false;
					// Don't surface as an error if the server didn't know
					// about this endpoint — DELETE is idempotent server-side
					// (it just returns ok:true even for non-existent rows).
					// Network/auth errors do surface.
					if (err instanceof PushAuthRequiredError) {
						setError(mapError(err, 'disable'));
					}
				}
			}

			if (existing) {
				try {
					await existing.unsubscribe();
				} catch {
					// Some browsers throw on already-unsubscribed; non-fatal.
				}
			}
			setSubscription(null);

			try {
				const count = await getActiveDeviceCount();
				setActiveDevices(count);
			} catch {
				setActiveDevices(null);
			}

			return serverOk;
		} catch (err) {
			setError(mapError(err, 'disable'));
			return false;
		} finally {
			setBusy(false);
		}
	}, []);

	return {
		supported: PUSH_SUPPORTED,
		permission,
		subscription,
		activeDevices,
		busy,
		error,
		ready,
		enable,
		disable,
		refreshDeviceCount,
	};
}

// ============================================================================
// ERROR MAPPING
// ============================================================================

function mapError(err: unknown, op: 'enable' | 'disable'): PushError {
	if (err instanceof PushAuthRequiredError) {
		return {
			code: 'auth-required',
			message: 'Please sign in to manage notifications.',
		};
	}
	if (err instanceof PushNotConfiguredError) {
		return {
			code: 'server-not-configured',
			message: 'Push notifications are not yet enabled on this server. Try again later.',
		};
	}
	if (err instanceof PushRateLimitError) {
		return {
			code: 'rate-limited',
			message: 'Too many requests. Please wait a moment and try again.',
		};
	}
	if (err instanceof PushDeviceLimitError) {
		return {
			code: 'device-limit',
			message: `You've reached the maximum of ${err.limit} devices. Disable notifications on another device first.`,
			limit: err.limit,
		};
	}
	if (err instanceof PushApiError) {
		return {
			code: op === 'enable' ? 'subscribe-failed' : 'unsubscribe-failed',
			message: err.message,
		};
	}
	if (err instanceof TypeError && /failed to fetch|network/i.test(err.message)) {
		return {
			code: 'network',
			message: 'Could not reach the server. Check your connection and try again.',
		};
	}
	if (err instanceof DOMException && err.name === 'NotAllowedError') {
		return {
			code: 'permission-denied',
			message: 'Notifications are blocked. Enable them in your browser settings.',
		};
	}
	return {
		code: 'unknown',
		message: err instanceof Error ? err.message : 'Something went wrong. Please try again.',
	};
}
