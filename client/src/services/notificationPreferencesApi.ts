// ============================================================================
// NOTIFICATION PREFERENCES API CLIENT (Phase 6b)
// ============================================================================
// File: services/notificationPreferencesApi.ts
// Description: Browser-side calls to the Phase 6b mirror-server routes.
//
// Endpoints (server):
//   GET    /mirror/api/user/notification-preferences   bearer auth
//   PUT    /mirror/api/user/notification-preferences   bearer auth
//
// What this module does NOT do:
//   - Persist anything locally (the server is the source of truth).
//   - Subscribe / unsubscribe push (see services/pushApi.ts for that).
//
// Errors mirror pushApi.ts's typed-error pattern so the settings UI can
// distinguish auth failure from rate limit from real network breakage.
// ============================================================================

import { getToken } from '../utils/token';

const BASE = import.meta.env.VITE_API_URL
	? `${import.meta.env.VITE_API_URL}/mirror/api/user/notification-preferences`
	: '/mirror/api/user/notification-preferences';

// ============================================================================
// SHAPES (mirror the server contract)
// ============================================================================

export interface NotificationCategory {
	key: string;
	label: string;
	description: string;
	/** True if this category's mute can be scoped to an individual group. */
	perGroupAllowed: boolean;
}

export interface MutedEntry {
	category: string;
	/** 'global' or a group_id string. */
	scope: string;
}

export interface PreferencesResponse {
	categories: NotificationCategory[];
	muted: MutedEntry[];
}

export interface MutationEntry {
	category: string;
	scope: string;
	muted: boolean;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class NotificationPrefsError extends Error {
	readonly status: number;
	readonly code: string;
	constructor(status: number, code: string, message: string) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

export class NotificationPrefsAuthError extends NotificationPrefsError {
	constructor() {
		super(401, 'AUTH_REQUIRED', 'You must be signed in to manage notification preferences.');
	}
}

export class NotificationPrefsRateLimitError extends NotificationPrefsError {
	constructor() {
		super(429, 'RATE_LIMITED', 'Too many requests. Please wait a moment and try again.');
	}
}

// ============================================================================
// HELPER
// ============================================================================

interface RequestOptions {
	method?: 'GET' | 'PUT';
	body?: unknown;
	signal?: AbortSignal;
}

async function request<T>(
	path: string,
	{ method = 'GET', body, signal }: RequestOptions = {},
): Promise<T> {
	const token = getToken();
	if (!token) throw new NotificationPrefsAuthError();

	const headers: Record<string, string> = {
		Accept: 'application/json',
		Authorization: `Bearer ${token}`,
	};
	if (body !== undefined) headers['Content-Type'] = 'application/json';

	const response = await fetch(`${BASE}${path}`, {
		method,
		headers,
		body: body !== undefined ? JSON.stringify(body) : undefined,
		credentials: 'include',
		signal,
	});

	let data: unknown;
	try {
		data = await response.json();
	} catch {
		data = null;
	}

	if (response.ok) return data as T;

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
			throw new NotificationPrefsAuthError();
		case 429:
			throw new NotificationPrefsRateLimitError();
		default:
			throw new NotificationPrefsError(response.status, code, message);
	}
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Fetch the per-event-type mute catalog + the user's current mutes.
 * The catalog is server-defined so adding a new category doesn't
 * require a client rebuild — the UI renders whatever the server sends.
 */
export async function getNotificationPreferences(
	signal?: AbortSignal,
): Promise<PreferencesResponse> {
	const result = await request<PreferencesResponse>('', { signal });

	// Defensive shape checks. The server is trusted but the response may
	// be intercepted by a misconfigured proxy / CDN that mangles JSON.
	if (!result || !Array.isArray(result.categories) || !Array.isArray(result.muted)) {
		throw new NotificationPrefsError(500, 'INVALID_RESPONSE', 'Server returned malformed preferences.');
	}
	return result;
}

/**
 * Batch update: apply a list of {category, scope, muted} changes
 * atomically. Server validates every entry before touching the DB; if
 * any is invalid the whole call is rejected (no partial writes).
 *
 * Returns the post-update mute list so the caller can reconcile its
 * local state without an extra round-trip.
 */
export async function updateNotificationPreferences(
	entries: MutationEntry[],
	signal?: AbortSignal,
): Promise<MutedEntry[]> {
	if (!Array.isArray(entries)) {
		throw new NotificationPrefsError(400, 'INVALID_ARGUMENT', 'entries must be an array');
	}
	const result = await request<{ muted: MutedEntry[] }>('', {
		method: 'PUT',
		body: { entries },
		signal,
	});
	if (!result || !Array.isArray(result.muted)) {
		throw new NotificationPrefsError(500, 'INVALID_RESPONSE', 'Server returned malformed update response.');
	}
	return result.muted;
}