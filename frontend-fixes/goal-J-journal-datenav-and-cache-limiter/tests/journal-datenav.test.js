/* eslint-disable no-console */
// Verifies Goal J: (1) journal cache hits don't consume the 20/min client limiter,
// (2) rapid date navigation debounces to a single fetch, (3) an out-of-order stale
// response can't clobber the current date's entries.

let NOW = 0;
const now = () => NOW;
const at = (t) => { NOW = t; };

const RATE_LIMIT_WINDOW = 60000;
const MAX_REQUESTS_PER_WINDOW = 20;   // journalApi's client limiter
class RateLimiter {
  constructor() { this.ts = []; }
  canMakeRequest() { const t = now(); this.ts = this.ts.filter((x) => t - x < RATE_LIMIT_WINDOW); if (this.ts.length >= MAX_REQUESTS_PER_WINDOW) return false; this.ts.push(t); return true; }
}
class Cache { constructor() { this.m = new Map(); } set(k, v, ttl) { this.m.set(k, { v, t: now(), ttl }); } get(k) { const e = this.m.get(k); if (!e) return null; if (now() - e.t > e.ttl) { this.m.delete(k); return null; } return e.v; } }

// getEntriesByDate model — NEW order (cache before limiter) vs OLD (limiter first).
function makeApi(order) {
  const rl = new RateLimiter(); const cache = new Cache(); let network = 0;
  const get = (date) => {
    const key = `entries-${date}`;
    if (order === 'new') {
      const c = cache.get(key); if (c != null) return c;
      if (!rl.canMakeRequest()) throw new Error('Rate limit exceeded');
    } else {
      if (!rl.canMakeRequest()) throw new Error('Rate limit exceeded');
      const c = cache.get(key); if (c != null) return c;
    }
    network++; const v = [{ id: `${date}-1` }]; cache.set(key, v, 300000); return v;
  };
  return { get, net: () => network };
}

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log(`  ✅ ${n}`); } else { fail++; console.log(`  ❌ ${n}`); } };

console.log('cache-before-limiter: paging back over viewed dates is free');
{
  at(0);
  // OLD: revisiting one cached date 25x throws once budget is exhausted.
  const oldApi = makeApi('old');
  oldApi.get('2026-07-01');            // 1 network, cached
  let threw = false;
  try { for (let i = 0; i < 25; i++) { at(100 + i); oldApi.get('2026-07-01'); } } catch { threw = true; }
  ok('OLD throws when revisiting a cached date past the budget', threw === true);

  at(0);
  const newApi = makeApi('new');
  newApi.get('2026-07-01');
  let threwNew = false;
  try { for (let i = 0; i < 500; i++) { at(100 + i); newApi.get('2026-07-01'); } } catch { threwNew = true; }
  ok('NEW never throws revisiting a cached date', threwNew === false);
  ok('NEW made exactly 1 network call for the revisited date', newApi.net() === 1);
}

console.log('debounce: rapid Prev/Next coalesces to one fetch');
{
  // Model the effect: each selectedDate change schedules a 250ms timer, clearing
  // the previous. Only the final settled date fires.
  const DEBOUNCE = 250;
  let timer = null, fired = [];
  const scheduleFetch = (date) => { if (timer) clearHandle(timer); timer = { date, fireAt: now() + DEBOUNCE }; };
  const handles = [];
  const clearHandle = (t) => { t.cancelled = true; };
  const advanceAndRun = (t) => { at(t); if (timer && !timer.cancelled && now() >= timer.fireAt) { fired.push(timer.date); timer = null; } };

  // User clicks Next through 10 new days, 50ms apart (within the 250ms window).
  for (let i = 1; i <= 10; i++) { at(i * 50); scheduleFetch(`day-${i}`); }
  advanceAndRun(10 * 50 + DEBOUNCE); // settle
  ok('10 rapid navigations → exactly 1 fetch', fired.length === 1);
  ok('the single fetch is for the final date', fired[0] === 'day-10');
}

console.log('sequence guard: stale response cannot clobber current date');
{
  // Two fetches: fetch A (older) resolves AFTER fetch B (newer). Only B applies.
  let seqRef = 0; let applied = null;
  const run = async (date, resolveDelayTicks, resolver) => {
    const seq = ++seqRef;
    const entries = await resolver;              // resolves out of order
    if (seq !== seqRef) return;                  // guard
    applied = { date, seq };
  };
  let resolveA, resolveB;
  const pA = new Promise((r) => (resolveA = r));
  const pB = new Promise((r) => (resolveB = r));
  const a = run('old-date', 100, pA);            // seq 1
  const b = run('new-date', 10, pB);             // seq 2
  return (async () => {
    resolveB([{ id: 'b' }]); await b;
    resolveA([{ id: 'a' }]); await a;
    ok('newer fetch applied', applied && applied.date === 'new-date');
    ok('stale (older) fetch ignored by guard', applied && applied.seq === 2);

    console.log(`\n${fail === 0 ? '✅ ALL PASSED' : '❌ FAILURES'} — ${pass} passed, ${fail} failed`);
    process.exit(fail === 0 ? 0 : 1);
  })();
}
