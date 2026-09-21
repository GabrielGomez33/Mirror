// Standalone runtime proof for client conversion instrumentation.
// Run:  tsx scripts/conversionTracking.test.ts   (exit 0 = pass, throws on fail)
//
// Proves the client-side PII firewall (buildEventPayload emits only allowlisted
// fields), UTM minimization, and the consent gate (GPC / DNT / opt-out suppress
// all collection). The emitter is exercised against stubbed globals to prove it
// stays silent when disabled and fires an anonymous, cookie-less POST when not.

// --- stub browser globals BEFORE importing the emitter ----------------------
class MemStore {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key() { return null; }
  get length() { return this.m.size; }
}
(globalThis as any).sessionStorage = new MemStore();
(globalThis as any).localStorage = new MemStore();
// `navigator` is a getter-only global in modern Node — install it (and later
// swap it) via defineProperty rather than plain assignment.
function setNavigator(nav: any) {
  Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true, writable: true });
}
setNavigator({ doNotTrack: null });

const fetchCalls: Array<{ url: string; init: any }> = [];
(globalThis as any).fetch = (url: string, init: any) => {
  fetchCalls.push({ url, init });
  return Promise.resolve({ ok: true, status: 204 });
};

import {
  isFunnelStage,
  parseUtmParams,
  newSessionToken,
  isSessionToken,
  isTrackingSuppressedByBrowser,
  buildEventPayload,
  hasUtmSignal,
  mergeFirstTouchUtm,
  coerceStoredUtm,
  readIncomingSessionToken,
} from '../src/services/conversionFunnel';
import {
  initConversionAnalytics,
  isAnalyticsEnabled,
  setAnalyticsOptOut,
  trackFunnelStage,
  __resetConversionAnalyticsForTest,
} from '../src/services/conversionApi';

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + m); } };

// --- vocabulary --------------------------------------------------------------
ok(isFunnelStage('entry_first_value'), 'known stage recognized');
ok(!isFunnelStage('nope'), 'unknown stage rejected');

// --- UTM minimization --------------------------------------------------------
{
  const u = parseUtmParams('?utm_source=instagram&utm_medium=paid&utm_campaign=launch&gclid=abc&email=x@y.com');
  ok(u.utmSource === 'instagram' && u.utmMedium === 'paid' && u.utmCampaign === 'launch', 'captures the three utm keys');
  ok(Object.keys(u).length === 3, 'ignores gclid/email and every non-utm param (minimization)');
}
{
  const u = parseUtmParams('?utm_source=' + encodeURIComponent('ig<script>') + '&utm_campaign=' + 'x'.repeat(400));
  ok(u.utmSource === 'igscript', 'utm sanitized (angle brackets stripped)');
  ok((u.utmCampaign as string).length === 96, 'utm campaign capped at 96');
}

// --- session token -----------------------------------------------------------
ok(isSessionToken(newSessionToken()), 'generated session token is a valid UUID');
ok(!isSessionToken('not-a-uuid'), 'bad token rejected');

// --- browser suppression signals --------------------------------------------
ok(isTrackingSuppressedByBrowser({ globalPrivacyControl: true }), 'GPC suppresses');
ok(isTrackingSuppressedByBrowser({ doNotTrack: '1' }), 'DNT=1 suppresses');
ok(!isTrackingSuppressedByBrowser({ doNotTrack: null }), 'no signal -> not suppressed');
ok(!isTrackingSuppressedByBrowser(undefined), 'missing navigator -> not suppressed');

// --- buildEventPayload: allowlist-only + adversarial PII --------------------
{
  const p = buildEventPayload('signup_completed', {
    sessionToken: '11111111-2222-4333-8444-555566667777',
    utm: { utmSource: 'instagram', utmMedium: null, utmCampaign: null },
    surface: 'web',
    // hostile extras (cast to bypass types — simulates a careless caller):
    ...( { email: 'v@x.com', userId: 7, ip: '203.0.113.1' } as any ),
  } as any);
  ok(!!p, 'valid stage builds a payload');
  ok(Object.keys(p!).sort().join(',') === 'sessionToken,stage,surface,utmCampaign,utmMedium,utmSource', 'payload has exactly the six allowlisted keys');
  ok(!JSON.stringify(p).includes('v@x.com') && !JSON.stringify(p).includes('203.0.113.1'), 'no smuggled PII in payload');
  ok(buildEventPayload('bogus', {}) === null, 'unknown stage -> null payload');
  ok(buildEventPayload('landing_view', { surface: 'hologram' as any }).surface === null, 'bad surface -> null');
}

// --- emitter: suppressed by GPC ---------------------------------------------
{
  fetchCalls.length = 0;
  setNavigator({ globalPrivacyControl: true });
  __resetConversionAnalyticsForTest();
  initConversionAnalytics({ search: '?utm_source=instagram', force: true });
  ok(!isAnalyticsEnabled(), 'GPC -> analytics disabled');
  trackFunnelStage('signup_completed');
  ok(fetchCalls.length === 0, 'disabled -> no beacon sent');
}

// --- emitter: enabled fires an anonymous, cookie-less POST ------------------
{
  fetchCalls.length = 0;
  setNavigator({ doNotTrack: null });
  (globalThis as any).localStorage.clear();
  __resetConversionAnalyticsForTest();
  initConversionAnalytics({ search: '?utm_source=instagram&utm_medium=paid', force: true });
  ok(isAnalyticsEnabled(), 'no signal -> analytics enabled');
  trackFunnelStage('signup_completed');
  ok(fetchCalls.length === 1, 'enabled -> exactly one beacon');
  const call = fetchCalls[0];
  ok(call.url === '/mirror/api/analytics/conversion', 'beacon hits same-origin ingest');
  ok(call.init.method === 'POST' && call.init.keepalive === true, 'POST + keepalive');
  ok(call.init.credentials === 'omit', 'credentials omitted (no cookie attached)');
  const body = JSON.parse(call.init.body);
  ok(body.stage === 'signup_completed' && body.utmSource === 'instagram' && body.utmMedium === 'paid', 'body carries stage + captured utm');
  ok(isSessionToken(body.sessionToken), 'body carries a valid session token');
  ok(!('userId' in body) && !('email' in body), 'body carries no identity fields');
}

// --- emitter: explicit opt-out suppresses -----------------------------------
{
  fetchCalls.length = 0;
  setAnalyticsOptOut(true);
  ok(!isAnalyticsEnabled(), 'opt-out -> disabled');
  trackFunnelStage('landing_view');
  ok(fetchCalls.length === 0, 'opt-out -> no beacon');
  setAnalyticsOptOut(false);
  ok(isAnalyticsEnabled(), 'opt back in -> enabled');
}

// --- FIRST-TOUCH UTM: pure helpers ------------------------------------------
{
  ok(hasUtmSignal({ utmSource: 'instagram', utmMedium: null, utmCampaign: null }), 'hasUtmSignal true when any field set');
  ok(!hasUtmSignal({ utmSource: null, utmMedium: null, utmCampaign: null }), 'hasUtmSignal false when empty');
  ok(!hasUtmSignal(null), 'hasUtmSignal false for null');
  const url = { utmSource: 'fromurl', utmMedium: null, utmCampaign: null };
  const stored = { utmSource: 'instagram', utmMedium: 'paid', utmCampaign: 'launch' };
  ok(mergeFirstTouchUtm(url, stored).utmSource === 'instagram', 'first-touch: stored source wins over a later URL');
  ok(mergeFirstTouchUtm(url, null).utmSource === 'fromurl', 'first-touch: URL used when nothing stored');
  ok(mergeFirstTouchUtm(url, { utmSource: null, utmMedium: null, utmCampaign: null }).utmSource === 'fromurl', 'first-touch: empty stored ignored');
  const c = coerceStoredUtm({ utmSource: 'ig<script>', utmMedium: 123, utmCampaign: 'launch' });
  ok(c.utmSource === 'igscript' && c.utmMedium === null && c.utmCampaign === 'launch', 'coerceStoredUtm sanitizes + drops non-strings');
}

// --- FIRST-TOUCH UTM: survives a param-less reload/navigation ----------------
// The exact bug this fixes: land on ?utm_source=instagram, then a later page
// (no UTM in its URL) must still attribute its events to instagram, not (direct).
{
  fetchCalls.length = 0;
  setNavigator({ doNotTrack: null });
  (globalThis as any).localStorage.clear();
  (globalThis as any).sessionStorage.clear();
  __resetConversionAnalyticsForTest();
  initConversionAnalytics({ search: '?utm_source=instagram&utm_campaign=launch', force: true }); // landing (tagged)
  __resetConversionAnalyticsForTest();                    // simulate a full reload
  initConversionAnalytics({ search: '', force: true });   // later page: NO utm in the URL
  trackFunnelStage('signup_completed');
  ok(fetchCalls.length === 1, 'first-touch: beacon fires on the later, param-less page');
  const b = JSON.parse(fetchCalls[0].init.body);
  ok(b.utmSource === 'instagram' && b.utmCampaign === 'launch', 'first-touch: later stage still attributed to the landing source (not (direct))');
  ok(isSessionToken(b.sessionToken), 'first-touch: session token stays stable across the reload');
}

// --- CROSS-DOMAIN SESSION STITCH: pure helper -------------------------------
{
  const tok = '11111111-2222-4333-8444-555555555555';
  ok(readIncomingSessionToken('?sid=' + tok) === tok, 'readIncomingSessionToken accepts a valid uuid sid');
  ok(readIncomingSessionToken('?sid=' + tok.toUpperCase()) === tok, 'readIncomingSessionToken lowercases the sid');
  ok(readIncomingSessionToken('?utm_source=ig') === null, 'no sid -> null');
  ok(readIncomingSessionToken('?sid=not-a-uuid') === null, 'malformed sid rejected');
  ok(readIncomingSessionToken('') === null, 'empty search -> null');
}

// --- CROSS-DOMAIN SESSION STITCH: app adopts the landing's session ----------
// The landing (trymirror.world) mints the token, fires landing_view with it,
// and forwards ?sid= to the app (theundergroundrailroad.world). The app must
// adopt it so both events correlate as ONE session across the domain hop.
{
  fetchCalls.length = 0;
  setNavigator({ doNotTrack: null });
  (globalThis as any).localStorage.clear();
  (globalThis as any).sessionStorage.clear();
  __resetConversionAnalyticsForTest();
  const landingSid = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  initConversionAnalytics({ search: `?utm_source=ig&utm_medium=social&sid=${landingSid}`, force: true });
  trackFunnelStage('signup_view');
  ok(fetchCalls.length === 1, 'stitch: beacon fires after adopting the landing sid');
  const b = JSON.parse(fetchCalls[0].init.body);
  ok(b.sessionToken === landingSid, 'stitch: in-app event uses the landing session token (one session across domains)');
  ok(b.utmSource === 'ig' && b.utmMedium === 'social', 'stitch: forwarded UTM is attributed too');
}

// --- STITCH is first-touch: a stale sid never hijacks a running session -----
{
  fetchCalls.length = 0;
  setNavigator({ doNotTrack: null });
  (globalThis as any).localStorage.clear();
  (globalThis as any).sessionStorage.clear();
  __resetConversionAnalyticsForTest();
  initConversionAnalytics({ search: '', force: true });      // app mints its own session first
  trackFunnelStage('signup_view');
  const own = JSON.parse(fetchCalls[0].init.body).sessionToken;
  __resetConversionAnalyticsForTest();                        // later navigation, same tab
  initConversionAnalytics({ search: '?sid=99999999-8888-4777-8666-555555555555', force: true });
  trackFunnelStage('entry_started');
  const after = JSON.parse(fetchCalls[1].init.body).sessionToken;
  ok(after === own, 'stitch: an incoming sid does NOT overwrite an already-established session');
}

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: conversionTracking ${pass} passed, ${fail} failed`);
if (fail) throw new Error(`${fail} assertions failed`);
