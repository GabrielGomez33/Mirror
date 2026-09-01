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

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: conversionTracking ${pass} passed, ${fail} failed`);
if (fail) throw new Error(`${fail} assertions failed`);
