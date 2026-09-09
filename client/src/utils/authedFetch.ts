// utils/authedFetch.ts
// ----------------------------------------------------------------------------
// The ONE authed fetch every REST data service should use. It does two things
// the per-service `fetch()` calls were NOT doing, which is why a mid-session
// token expiry forced a full page reload:
//
//   1. Injects a FRESH Bearer from storage on EVERY attempt (getToken() is read
//      at call time), so the retry below automatically uses a just-refreshed
//      token.
//   2. Wraps the call in withAuthRetry: on a 401 it refreshes the access token
//      once (via authApi.refreshToken, which persists the new token where
//      getToken reads it) and retries exactly once. On refresh failure the
//      original 401 is surfaced so the caller's normal "please log in" path runs.
//
// Result: an expired access token self-heals in-flight — the dashboard, groups,
// journal, etc. transparently refresh and continue instead of failing until the
// user reloads. Returns the raw Response so each service keeps its own parsing.
//
// Do NOT use this for the auth PRIMITIVES themselves (login/register/refresh/
// verify in authApi) — refresh must not recurse through a refresh-retry, and
// login/register have no token yet. Those stay on plain fetch.
// ----------------------------------------------------------------------------

import { getToken } from './token';
import { withAuthRetry } from './authRetry';
import { refreshTokenApi } from '../services/authApi';

/** Merge the caller's init with a fresh Authorization header (when a token exists). */
export function withFreshBearer(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers as HeadersInit | undefined);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  // credentials:'include' as the default (matches the services' existing calls);
  // an explicit init.credentials still wins via the spread.
  return { credentials: 'include', ...init, headers };
}

/**
 * fetch() for authenticated REST calls: fresh Bearer + refresh-once-on-401-retry.
 * Drop-in replacement for `fetch(url, init)` in an authed service.
 */
export async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return withAuthRetry(() => fetch(url, withFreshBearer(init)), refreshTokenApi);
}
