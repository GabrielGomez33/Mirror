/* eslint-disable no-console */
// Edge-case verification for AuthMiddleware.rateLimit.
// Two faithful, pure transcriptions of the limiter logic (OLD = pre-fix,
// NEW = post-fix) run against a shared store and a controllable clock, so we
// can assert exact time-boundary and isolation behavior deterministically.

let NOW = 0;
const clock = () => NOW;
const at = (t) => { NOW = t; };

// ---- OLD implementation (buggy) -------------------------------------------
// Key = identifier only (no per-route bucket). Reset when resetTime < now-windowMs.
function makeOld(store, maxRequests, windowMs) {
  return (identifier) => {
    const now = clock();
    const windowStart = now - windowMs;
    let d = store.get(identifier);
    if (!d || d.resetTime < windowStart) {
      d = { count: 0, resetTime: now + windowMs };
      store.set(identifier, d);
    }
    if (d.count >= maxRequests) {
      return { ok: false, retryAfter: Math.ceil((d.resetTime - now) / 1000) };
    }
    d.count++;
    return { ok: true };
  };
}

// ---- NEW implementation (fixed) -------------------------------------------
// Per-registration bucket id + fixed-window reset (now >= resetTime) + truthful retryAfter.
let bucketSeq = 0;
function makeNew(store, maxRequests, windowMs) {
  const bucketId = `rl${++bucketSeq}`;
  return (identifier) => {
    const now = clock();
    const key = `${bucketId}:${identifier}`;
    let d = store.get(key);
    if (!d || now >= d.resetTime) {
      d = { count: 0, resetTime: now + windowMs };
      store.set(key, d);
    }
    if (d.count >= maxRequests) {
      return { ok: false, retryAfter: Math.max(1, Math.ceil((d.resetTime - now) / 1000)) };
    }
    d.count++;
    return { ok: true };
  };
}

// ---- tiny assert harness ---------------------------------------------------
let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log(`  ✅ ${name}`); } else { fail++; console.log(`  ❌ ${name}`); } }

// ===========================================================================
console.log('BUG ①  window duration');
{
  // OLD: 2 req/60s. Fill window, then check at exactly 60s and just after — still blocked (bug).
  const store = new Map();
  const old = makeOld(store, 2, 60000);
  at(0); old('user_1'); old('user_1');            // count = 2, window full
  at(30000); ok('OLD blocks mid-window (expected)', old('user_1').ok === false);
  at(60001); ok('OLD STILL blocked just after 1x window (demonstrates 2x bug)', old('user_1').ok === false);
  at(120001); ok('OLD only resets after ~2x window', old('user_1').ok === true);
}
{
  // NEW: resets exactly at windowMs.
  const store = new Map();
  const nw = makeNew(store, 2, 60000);
  at(0); nw('user_1'); nw('user_1');
  at(30000); ok('NEW blocks mid-window', nw('user_1').ok === false);
  at(59999); ok('NEW still blocked at 59.999s', nw('user_1').ok === false);
  at(60000); ok('NEW resets exactly at windowMs (60.000s)', nw('user_1').ok === true);
}

console.log('BUG ①  retryAfter accuracy');
{
  const store = new Map();
  const nw = makeNew(store, 1, 60000);
  at(0); nw('user_1');                             // window opens at 0, resetTime = 60000
  at(10000);
  const r = nw('user_1');
  ok('NEW retryAfter reflects true remaining wait (50s)', r.ok === false && r.retryAfter === 50);
  at(59500);
  ok('NEW retryAfter never rounds to 0 (>=1s)', nw('user_1').retryAfter >= 1);
}

console.log('BUG ②  per-route isolation (same user, two routes)');
{
  // Two independent registrations sharing one store, same user.
  const store = new Map();
  const routeA = makeNew(store, 30, 60000);   // e.g. GET /analysis  30/min
  const routeB = makeNew(store, 60, 60000);   // e.g. GET /profile   60/min
  at(0);
  for (let i = 0; i < 30; i++) routeA('user_1');   // exhaust route A
  ok('NEW route A blocks at its own limit', routeA('user_1').ok === false);
  ok('NEW route B unaffected by route A usage', routeB('user_1').ok === true);
}
{
  // Contrast: OLD shares one bucket across routes. A high-limit route (profile,
  // 60/min) drains the shared counter to 25, then a LOWER-limit route (history,
  // 20/min) — never called itself — is wrongly blocked because 25 >= 20.
  const store = new Map();
  const routeProfile = makeOld(store, 60, 60000);
  const routeHistory = makeOld(store, 20, 60000);
  at(0);
  for (let i = 0; i < 25; i++) routeProfile('user_1');
  ok('OLD low-limit route WRONGLY blocked by unrelated high-limit route (shared-bucket bug)', routeHistory('user_1').ok === false);
}
{
  // Same scenario under NEW: the two routes are independent buckets.
  const store = new Map();
  const routeProfile = makeNew(store, 60, 60000);
  const routeHistory = makeNew(store, 20, 60000);
  at(0);
  for (let i = 0; i < 25; i++) routeProfile('user_1');
  ok('NEW low-limit route unaffected by unrelated high-limit route', routeHistory('user_1').ok === true);
}

console.log('per-user isolation & boundary counts');
{
  const store = new Map();
  const route = makeNew(store, 5, 60000);
  at(0);
  let allowed = 0;
  for (let i = 0; i < 5; i++) if (route('user_1').ok) allowed++;
  ok('NEW allows exactly maxRequests', allowed === 5);
  ok('NEW blocks the (max+1)th', route('user_1').ok === false);
  ok('NEW different user is independent', route('user_2').ok === true);
  at(60000);
  ok('NEW same user allowed again after window', route('user_1').ok === true);
}

console.log('unauthenticated (IP-keyed) requests are namespaced');
{
  const store = new Map();
  const routeA = makeNew(store, 1, 60000);
  const routeB = makeNew(store, 1, 60000);
  at(0);
  ok('NEW IP-keyed route A first request ok', routeA('1.2.3.4').ok === true);
  ok('NEW IP-keyed route A second blocked', routeA('1.2.3.4').ok === false);
  ok('NEW same IP on route B still ok (namespaced)', routeB('1.2.3.4').ok === true);
}

console.log(`\n${fail === 0 ? '✅ ALL PASSED' : '❌ FAILURES'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
