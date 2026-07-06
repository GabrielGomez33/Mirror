/* eslint-disable no-console */
// Verifies Goal G: (A2) cache hits must not consume the client rate-limit budget,
// and (A1) the poll-rate reduction. Faithful transcription of groupsApi's
// RateLimiter + SimpleCache driven by a fake clock.

let NOW = 0;
const now = () => NOW;
const at = (t) => { NOW = t; };

const RATE_LIMIT_WINDOW = 60000;
const MAX_REQUESTS_PER_WINDOW = 30;

class RateLimiter {
  constructor() { this.timestamps = []; }
  canMakeRequest() {
    const t = now();
    this.timestamps = this.timestamps.filter((x) => t - x < RATE_LIMIT_WINDOW);
    if (this.timestamps.length >= MAX_REQUESTS_PER_WINDOW) return false;
    this.timestamps.push(t);
    return true;
  }
}
class SimpleCache {
  constructor() { this.m = new Map(); }
  set(k, v, ttl) { this.m.set(k, { v, t: now(), ttl }); }
  get(k) { const e = this.m.get(k); if (!e) return null; if (now() - e.t > e.ttl) { this.m.delete(k); return null; } return e.v; }
}

// makeRequest models: OLD = limiter before cache; NEW = cache before limiter.
function makeClient(order) {
  const rl = new RateLimiter();
  const cache = new SimpleCache();
  let network = 0;
  const req = (endpoint, { useCache = false, ttl = 60000 } = {}) => {
    const key = `groups:${endpoint}`;
    const cacheFirst = () => { if (useCache) { const c = cache.get(key); if (c != null) return { hit: true, v: c }; } return null; };
    const limiter = () => { if (!rl.canMakeRequest()) throw new Error('Rate limit exceeded'); };
    if (order === 'new') {
      const c = cacheFirst(); if (c) return c.v;
      limiter();
    } else {
      limiter();
      const c = cacheFirst(); if (c) return c.v;
    }
    network++;
    const v = { data: `resp-${endpoint}-${network}` };
    if (useCache) cache.set(key, v, ttl);
    return v;
  };
  return { req, getNetwork: () => network };
}

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log(`  ✅ ${n}`); } else { fail++; console.log(`  ❌ ${n}`); } };

console.log('OLD order: cache hits wrongly consume budget → poll self-throttles');
{
  at(0);
  const { req } = makeClient('old');
  req('/list', { useCache: true, ttl: 60000 });   // 1 real request, cached for 60s
  let threw = null;
  try {
    // 3s poll for the rest of the minute: 19 more ticks, all within cache TTL.
    for (let i = 1; i <= 40; i++) { at(i * 1500); req('/list', { useCache: true, ttl: 60000 }); }
  } catch (e) { threw = e.message; }
  ok('OLD throws "Rate limit exceeded" on cache-served polls', threw === 'Rate limit exceeded');
}

console.log('NEW order: cache hits are free → poll never self-throttles');
{
  at(0);
  const { req, getNetwork } = makeClient('new');
  req('/list', { useCache: true, ttl: 60000 });
  let threw = null;
  try {
    for (let i = 1; i <= 200; i++) { at(1 + i * 100); req('/list', { useCache: true, ttl: 60000 }); }
  } catch (e) { threw = e.message; }
  ok('NEW never throws on cache-served reads', threw === null);
  ok('NEW made exactly 1 network call within the 60s cache window', getNetwork() === 1);
}

console.log('NEW: real (uncached) network calls are still limited to 30/min');
{
  at(0);
  const { req } = makeClient('new');
  let threw = null, made = 0;
  try { for (let i = 0; i < 40; i++) { at(i * 100); req(`/uncached-${i}`, { useCache: false }); made++; } }
  catch { threw = true; }
  ok('NEW still enforces the limit on genuine network bursts', threw === true && made === 30);
}

console.log('A1 poll-rate math (30s + visibility gate vs 3s)');
{
  const perMin = (intervalMs) => Math.floor(60000 / intervalMs);
  ok('3s poll = 20 ticks/min', perMin(3000) === 20);
  ok('30s poll = 2 ticks/min', perMin(30000) === 2);
  // Simulate a full minute of the 30s poll against a 60s cache and count real
  // network calls (the honest measure, not a formula).
  at(0);
  const { req, getNetwork } = makeClient('new');
  for (let t = 0; t <= 60000; t += 30000) { at(t); req('/list', { useCache: true, ttl: 60000 }); }
  ok('30s poll → exactly 1 real network in the first 60s under 60s cache', getNetwork() === 1);
}

console.log(`\n${fail === 0 ? '✅ ALL PASSED' : '❌ FAILURES'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
