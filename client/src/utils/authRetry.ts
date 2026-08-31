// ============================================================================
// authRetry — refresh-on-401-and-retry orchestration (pure, side-effect-free).
// ============================================================================
// Access tokens are deliberately short-lived (15 min). A user who lingers on a
// long form — most acutely the conversion-critical Entry intake — can outlive
// their access token and, on submit, get a 401 "Invalid token" that throws away
// everything they just entered. That is exactly the kind of edge case that
// silently kills signups.
//
// This module owns ONE decision and nothing else: "given an attempt that came
// back 401, refresh the credential once and retry exactly once; on any refresh
// failure, keep the original 401 so the caller can surface a clean re-login."
// The actual fetch and the actual token refresh are injected, so this logic is
// unit-testable without a network or a DOM. Callers (entryApi, and any other
// authorized client) pass their own `attempt` and `refresh`.
// ============================================================================

/** Minimal shape every attempt result must expose so we can see the status. */
export interface HasStatus {
  status: number;
}

/**
 * Run `attempt`. If it returns HTTP 401, run `refresh` once and re-run `attempt`
 * one more time. Never retries more than once (no infinite loop), never retries
 * a non-401, and if `refresh` throws (no/expired refresh token) returns the
 * ORIGINAL 401 untouched so the caller's normal error path runs.
 *
 * `refresh` is expected to persist the new credential where `attempt` reads it
 * (e.g. authApi.refreshToken() writes the fresh access token to storage), so the
 * retried `attempt` picks it up. This function does not touch tokens itself.
 */
export async function withAuthRetry<T extends HasStatus>(
  attempt: () => Promise<T>,
  refresh: () => Promise<unknown>,
): Promise<T> {
  const first = await attempt();
  if (first.status !== 401) return first;

  try {
    await refresh();
  } catch {
    // Refresh unavailable/failed — the session is genuinely gone. Surface the
    // original 401 rather than a refresh error, so the UI shows "please log in".
    return first;
  }

  // Exactly one retry with the freshly-refreshed credential. Whatever this
  // returns (200, or another 401 if the refresh didn't actually help) is final.
  return attempt();
}
