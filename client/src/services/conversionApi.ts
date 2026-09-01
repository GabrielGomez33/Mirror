// services/conversionApi.ts
// ----------------------------------------------------------------------------
// Fail-safe, fire-and-forget client for anonymous conversion-funnel beacons.
// Mirrors consentApi's never-throw contract: instrumentation must NEVER block,
// break, or slow the UI, and must never surface an error to the user.
//
// Consent + privacy posture (enforced here):
//   * If the browser signals GPC or Do-Not-Track, OR the visitor has opted out
//     locally, tracking is DISABLED and nothing is ever sent.
//   * Events are anonymous: no auth header, credentials omitted (so no session
//     cookie is attached), no account id, no PII — only the allowlisted funnel
//     payload built by buildEventPayload.
//   * The session token is a random, ephemeral per-tab value in sessionStorage.
//     UTM attribution is captured ONCE at init from the landing URL.
//
// A module-level enabled flag lets non-React call sites (and the provider) share
// one source of truth without importing React.
// ----------------------------------------------------------------------------

import {
  parseUtmParams,
  newSessionToken,
  isSessionToken,
  isTrackingSuppressedByBrowser,
  buildEventPayload,
  type Utm,
  type FunnelStage,
} from './conversionFunnel';

const INGEST_URL = '/mirror/api/analytics/conversion';
const SESSION_KEY = 'mirror:analytics:session';
const OPTOUT_KEY = 'mirror:analytics:optout';

interface AnalyticsState {
  ready: boolean;
  enabled: boolean;
  sessionToken: string | null;
  utm: Utm;
}

const state: AnalyticsState = {
  ready: false,
  enabled: false,
  sessionToken: null,
  utm: { utmSource: null, utmMedium: null, utmCampaign: null },
};

// --- safe storage helpers (Safari private mode / disabled storage throw) ------
function safeGet(store: Storage | undefined, key: string): string | null {
  try { return store ? store.getItem(key) : null; } catch { return null; }
}
function safeSet(store: Storage | undefined, key: string, val: string): void {
  try { store?.setItem(key, val); } catch { /* noop */ }
}

function detectSurface(): 'web' | 'pwa' {
  try {
    if (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches) return 'pwa';
    // iOS Safari standalone flag
    if (typeof navigator !== 'undefined' && (navigator as unknown as { standalone?: boolean }).standalone) return 'pwa';
  } catch { /* noop */ }
  return 'web';
}

function hasLocalOptOut(): boolean {
  return safeGet(typeof localStorage !== 'undefined' ? localStorage : undefined, OPTOUT_KEY) === '1';
}

function ensureSessionToken(): string | null {
  if (!state.enabled) return null;
  const ss = typeof sessionStorage !== 'undefined' ? sessionStorage : undefined;
  const existing = safeGet(ss, SESSION_KEY);
  if (isSessionToken(existing)) return existing!.toLowerCase();
  const fresh = newSessionToken();
  safeSet(ss, SESSION_KEY, fresh);
  return fresh;
}

/**
 * Initialize analytics once at app start. Computes consent (GPC/DNT/opt-out),
 * captures UTM from the landing URL, and provisions the session token. Idempotent
 * within a page load unless `force` is set (used when the visitor toggles opt-out).
 */
export function initConversionAnalytics(opts?: { search?: string; force?: boolean }): void {
  if (state.ready && !opts?.force) return;
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const suppressed = isTrackingSuppressedByBrowser(nav as never) || hasLocalOptOut();
  state.enabled = !suppressed;
  const search = opts?.search ?? (typeof window !== 'undefined' ? window.location.search : '');
  state.utm = parseUtmParams(search);
  state.sessionToken = ensureSessionToken();
  state.ready = true;
}

/** Is analytics currently enabled (consent granted + not suppressed)? */
export function isAnalyticsEnabled(): boolean {
  if (!state.ready) initConversionAnalytics();
  return state.enabled;
}

/** Persist an explicit opt-out (or opt back in) and re-init. */
export function setAnalyticsOptOut(optOut: boolean): void {
  safeSet(typeof localStorage !== 'undefined' ? localStorage : undefined, OPTOUT_KEY, optOut ? '1' : '0');
  initConversionAnalytics({ force: true });
}

/**
 * Record one funnel stage. Fire-and-forget: never awaited in the UI path, never
 * throws, no-ops when disabled or for an unknown stage. Uses keepalive so an
 * event fired right before navigation still flushes.
 */
export function trackFunnelStage(stage: FunnelStage): void {
  try {
    if (!state.ready) initConversionAnalytics();
    if (!state.enabled) return;
    const payload = buildEventPayload(stage, {
      sessionToken: state.sessionToken,
      utm: state.utm,
      surface: detectSurface(),
    });
    if (!payload) return;
    // credentials:'omit' — anonymous; do not attach the auth/session cookie.
    void fetch(INGEST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'omit',
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* analytics must never break the UI */
  }
}

// Test-only hook: reset module state so unit tests start clean.
export function __resetConversionAnalyticsForTest(): void {
  state.ready = false;
  state.enabled = false;
  state.sessionToken = null;
  state.utm = { utmSource: null, utmMedium: null, utmCampaign: null };
}
