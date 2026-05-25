/**
 * Consent API client.
 *
 * Records and reads a user's acceptance of the Terms & Conditions. Mirrors
 * the auth pattern used across the service layer: same-origin `/mirror/api`
 * base, bearer token from utils/token, credentials included.
 *
 * DESIGN NOTE — fail open. Every function degrades gracefully when the
 * backend endpoints are not yet deployed (404) or transiently unavailable
 * (5xx / network). This is deliberate: the client is safe to ship before
 * the mirror-server consent endpoints go live. The legally-binding consent
 * is the registration checkbox the user actually ticked; the recorded row
 * is the audit trail, and the ConsentGate re-prompts if the row is missing
 * once the backend is live.
 */

import { getToken } from '../utils/token';
import { TERMS_VERSION } from '../config/legal';

const API_BASE = '/mirror/api';

export interface ConsentStatus {
  termsVersion: string | null;
  acceptedAt: string | null;
  /** True when the endpoint could not be reached; callers MUST fail open. */
  unavailable: boolean;
}

/**
 * Record acceptance of a legal document for the current user.
 * Returns true on a confirmed 2xx, false otherwise. Never throws.
 */
export async function acceptTerms(
  version: string = TERMS_VERSION,
  document: 'terms' | 'privacy' = 'terms'
): Promise<boolean> {
  const token = getToken();
  if (!token) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/accept-terms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
      body: JSON.stringify({ document, version }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Read the current user's latest accepted terms version. On any failure
 * (no token, 404 not-deployed, 5xx, network) returns `unavailable: true`
 * so the caller can fail open and NOT block the user.
 */
export async function getConsentStatus(): Promise<ConsentStatus> {
  const token = getToken();
  if (!token) {
    return { termsVersion: null, acceptedAt: null, unavailable: true };
  }
  try {
    const res = await fetch(`${API_BASE}/auth/consent-status`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      credentials: 'include',
    });
    if (!res.ok) {
      return { termsVersion: null, acceptedAt: null, unavailable: true };
    }
    const json = await res.json().catch(() => null);
    const terms = json?.terms ?? null;
    return {
      termsVersion: terms?.version ?? null,
      acceptedAt: terms?.acceptedAt ?? null,
      unavailable: false,
    };
  } catch {
    return { termsVersion: null, acceptedAt: null, unavailable: true };
  }
}