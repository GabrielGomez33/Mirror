// services/conversionFunnel.ts
// ----------------------------------------------------------------------------
// PURE, dependency-free logic for client-side conversion-funnel instrumentation.
// No network, no React — unit-tested in isolation (scripts/conversionTracking.test.ts).
//
// This is the client half of the anonymous funnel. It mirrors the server's
// closed stage vocabulary EXACTLY (mirror-server utils/conversionFunnel), and it
// is the client-side PII firewall: buildEventPayload emits ONLY allowlisted,
// sanitized fields, so nothing identifying (email, userId, birth data) can be
// put on the wire even by a careless caller.
//
// Privacy: events are anonymous + aggregate. The session token is a random,
// ephemeral per-tab value (sessionStorage) used only to correlate stages within
// one session; it is not a cookie and is never tied to an account.
// ----------------------------------------------------------------------------

// MUST match mirror-server FUNNEL_STAGES exactly (order + spelling).
export const FUNNEL_STAGES = [
  'landing_view',
  'signup_view',
  'signup_completed',
  'entry_started',
  'entry_first_value',
  'dashboard_view',
  'mymirror_view',
  'core_started',
  'core_completed',
  'premium_view',
  'premium_activated',
] as const;

export type FunnelStage = (typeof FUNNEL_STAGES)[number];

const STAGE_SET: ReadonlySet<string> = new Set(FUNNEL_STAGES);
export function isFunnelStage(x: unknown): x is FunnelStage {
  return typeof x === 'string' && STAGE_SET.has(x);
}

// Campaign attribution — the ONLY UTM keys we capture. Everything else in the
// query string is ignored (data minimization).
export interface Utm {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
}

const MAX_UTM = 96;
function cleanUtm(value: string | null | undefined, max: number): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim().slice(0, Math.min(max, MAX_UTM));
  if (!s) return null;
  const cleaned = s.replace(/[^a-zA-Z0-9_.\- ]/g, '');
  return cleaned.length ? cleaned : null;
}

/** Parse ONLY utm_source/medium/campaign from a query string; sanitized + bounded. */
export function parseUtmParams(search: string): Utm {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search || '');
  } catch {
    return { utmSource: null, utmMedium: null, utmCampaign: null };
  }
  return {
    utmSource: cleanUtm(params.get('utm_source'), 64),
    utmMedium: cleanUtm(params.get('utm_medium'), 64),
    utmCampaign: cleanUtm(params.get('utm_campaign'), 96),
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isSessionToken(x: unknown): x is string {
  return typeof x === 'string' && UUID_RE.test(x);
}

/** Generate a random session token (UUID v4). Falls back if crypto is absent. */
export function newSessionToken(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch { /* fall through */ }
  // RFC4122-ish fallback (non-crypto) — only used where crypto.randomUUID is missing.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * True when the browser signals a privacy preference we must honor:
 * Global Privacy Control (CCPA opt-out signal) or Do-Not-Track. When either is
 * set, no analytics are collected.
 */
export function isTrackingSuppressedByBrowser(nav: {
  globalPrivacyControl?: unknown;
  doNotTrack?: unknown;
} | undefined | null): boolean {
  if (!nav) return false;
  if (nav.globalPrivacyControl === true || nav.globalPrivacyControl === '1') return true;
  const dnt = nav.doNotTrack;
  if (dnt === '1' || dnt === 'yes' || dnt === 1) return true;
  return false;
}

// The exact wire shape — ONLY these fields ever leave the browser.
export interface ConversionEventPayload {
  stage: FunnelStage;
  sessionToken: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  surface: string | null;
}

/**
 * Build the wire payload for one stage. Returns null for an unknown stage.
 * CRITICAL: constructs a fresh object with only the allowlisted fields — a
 * caller cannot leak PII through an extra property because none is copied.
 */
export function buildEventPayload(
  stage: string,
  ctx: { sessionToken?: string | null; utm?: Utm | null; surface?: string | null },
): ConversionEventPayload | null {
  if (!isFunnelStage(stage)) return null;
  const utm = ctx.utm ?? null;
  const surface = ctx.surface === 'web' || ctx.surface === 'pwa' ? ctx.surface : null;
  return {
    stage,
    sessionToken: isSessionToken(ctx.sessionToken) ? (ctx.sessionToken as string).toLowerCase() : null,
    utmSource: utm?.utmSource ?? null,
    utmMedium: utm?.utmMedium ?? null,
    utmCampaign: utm?.utmCampaign ?? null,
    surface,
  };
}
