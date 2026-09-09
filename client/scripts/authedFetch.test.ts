// Proof for authedFetch's contribution to refresh-on-401 (utils/authedFetch).
//
// withAuthRetry (the refresh-once-retry-once decision) is proven in
// authRetry.test.ts. The NEW guarantee authedFetch adds is that every attempt
// reads a FRESH Bearer from storage — so the retry after a refresh sends the
// NEW token, not the stale one. Without that, refresh-then-retry would resend
// the dead token and 401 again. This pins both halves composed together.
//
// Run: tsx scripts/authedFetch.test.ts

// --- Minimal in-memory Web Storage polyfill (Node has none) ------------------
class MemStorage {
  private m: Record<string, string> = {};
  getItem(k: string) { return k in this.m ? this.m[k] : null; }
  setItem(k: string, v: string) { this.m[k] = String(v); }
  removeItem(k: string) { delete this.m[k]; }
  clear() { this.m = {}; }
}
(globalThis as any).localStorage = new MemStorage();
(globalThis as any).sessionStorage = new MemStorage();

const { withFreshBearer } = await import('../src/utils/authedFetch');
const { withAuthRetry } = await import('../src/utils/authRetry');
const { setToken, setRememberMe } = await import('../src/utils/token');

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + m); } };
const authOf = (init: RequestInit) => new Headers(init.headers as HeadersInit).get('Authorization');

setRememberMe(true); // tokens in localStorage

// --- Fresh Bearer is read per call ------------------------------------------
setToken('OLD');
ok(authOf(withFreshBearer()) === 'Bearer OLD', 'injects the current token');
setToken('NEW');
ok(authOf(withFreshBearer()) === 'Bearer NEW', 'a later call reflects the NEW token (per-call freshness)');

// --- No token -> no Authorization header ------------------------------------
(globalThis as any).localStorage.clear();
ok(authOf(withFreshBearer()) === null, 'no token -> no Authorization header');

// --- Caller headers + credentials preserved ---------------------------------
setToken('T');
const merged = withFreshBearer({ headers: { 'Content-Type': 'application/json' } });
ok(new Headers(merged.headers as HeadersInit).get('Content-Type') === 'application/json', 'preserves caller headers');
ok(merged.credentials === 'include', 'defaults credentials to include');
ok(withFreshBearer({ credentials: 'omit' }).credentials === 'omit', 'explicit credentials wins over the default');

// --- END-TO-END: a 401 attempt reading the token; refresh swaps the token;
//     the retry (reading getToken again via withFreshBearer) sends the NEW one. -
setToken('STALE');
let refreshed = 0;
const attempt = async () => {
  const auth = authOf(withFreshBearer());
  return { status: auth === 'Bearer FRESH' ? 200 : 401 };
};
const refresh = async () => { refreshed++; setToken('FRESH'); };
const res = await withAuthRetry(attempt, refresh);
ok(res.status === 200, 'expired token 401 -> refresh -> retry sends the refreshed Bearer -> 200');
ok(refreshed === 1, 'refresh happened exactly once');

if (fail) { console.error(`\nauthedFetch: ${pass} passed, ${fail} FAILED`); process.exit(1); }
console.log(`authedFetch: ${pass} passed — authed calls send a fresh Bearer and self-heal a 401 without reload`);
