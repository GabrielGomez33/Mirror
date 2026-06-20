// src/services/usernameAvailability.ts
//
// Real-time username availability check for the registration form.
//
// Resolves the API base the same proven way AuthContext.register() does:
// VITE_API_URL when set (cross-origin dev), else an empty string → a relative
// /mirror/api URL for same-origin production. (We deliberately do NOT reuse
// authApi's baseUrl, which is `${VITE_API_URL}/...` and becomes the literal
// "undefined/..." when the env var is unset.)
//
// This function NEVER throws and NEVER blocks the user: any ambiguous outcome
// (network error, 429 rate limit, 5xx, abort) resolves to 'unknown', and the
// authoritative check remains the submit-time USERNAME_TAKEN gate on the server.

const API_BASE = `${(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')}/mirror/api/auth`;

export type UsernameCheckStatus =
  | 'available'
  | 'taken'
  | 'reserved'
  | 'invalid'
  | 'unknown';

interface CheckResponse {
  available: boolean | null;
  reason?: 'taken' | 'reserved' | 'invalid';
}

/**
 * Check whether a username is free. POST (not GET) so the PWA service worker's
 * NetworkFirst cache for GET /mirror/api/* can never serve a stale answer.
 *
 * @param username  the candidate (already format-trimmed by the caller)
 * @param signal    optional AbortSignal so callers can cancel stale in-flight checks
 */
export async function checkUsernameAvailability(
  username: string,
  signal?: AbortSignal,
): Promise<UsernameCheckStatus> {
  try {
    const response = await fetch(`${API_BASE}/check-username`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
      credentials: 'include',
      signal,
    });

    // Rate limited — back off silently, stay neutral.
    if (response.status === 429) return 'unknown';

    const data = (await response.json().catch(() => ({}))) as CheckResponse;

    if (response.ok) {
      if (data.available === true) return 'available';
      if (data.reason === 'reserved') return 'reserved';
      if (data.reason === 'invalid') return 'invalid';
      if (data.available === false) return 'taken';
      return 'unknown';
    }

    // 400 carries reason:'invalid'; everything else (incl. 503 available:null,
    // or a 404 when the endpoint isn't deployed yet) is neutral.
    if (data.reason === 'invalid') return 'invalid';
    return 'unknown';
  } catch {
    // AbortError (superseded check) or a network failure — neutral. The
    // submit-time server check is the backstop.
    return 'unknown';
  }
}