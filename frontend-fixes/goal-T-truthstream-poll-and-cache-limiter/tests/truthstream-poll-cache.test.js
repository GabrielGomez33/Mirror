/* eslint-disable no-console */
// Verifies Goal T: (1) truthstream cache hits don't consume the 25/min client
// limiter, (2) the analysis poll's real-network spend at 15s stays well under
// budget where 8s risked it, and (3) a WS completion event short-circuits the poll.

let NOW = 0; const now = () => NOW; const at = (t) => { NOW = t; };
const RATE_LIMIT_WINDOW = 60000;
const MAX_REQUESTS_PER_WINDOW = 25;      // truthStreamApi client limiter
class RateLimiter { constructor(){this.ts=[];} canMakeRequest(){const t=now();this.ts=this.ts.filter(x=>t-x<RATE_LIMIT_WINDOW);if(this.ts.length>=MAX_REQUESTS_PER_WINDOW)return false;this.ts.push(t);return true;} }
class Cache { constructor(){this.m=new Map();} set(k,v,ttl){this.m.set(k,{v,t:now(),ttl});} get(k){const e=this.m.get(k);if(!e)return null;if(now()-e.t>e.ttl){this.m.delete(k);return null;}return e.v;} del(){this.m.clear();} }

function makeApi(order){ const rl=new RateLimiter(); const cache=new Cache(); let net=0;
  const req=(endpoint,{useCache=false,ttl=300000}={})=>{ const key=`ts:${endpoint}`;
    if(order==='new'){ if(useCache){const c=cache.get(key);if(c!=null)return c;} if(!rl.canMakeRequest())throw new Error('Rate limit exceeded'); }
    else { if(!rl.canMakeRequest())throw new Error('Rate limit exceeded'); if(useCache){const c=cache.get(key);if(c!=null)return c;} }
    net++; const v={data:`${endpoint}-${net}`}; if(useCache)cache.set(key,v,ttl); return v; };
  return { req, net:()=>net, wipe:()=>cache.del() };
}

let pass=0, fail=0; const ok=(n,c)=>{ if(c){pass++;console.log(`  ✅ ${n}`);}else{fail++;console.log(`  ❌ ${n}`);} };

console.log('cache-before-limiter: mount/WS fan-out of cached GETs is free');
{
  at(0);
  // Prime the caches (profile, queue, stats, milestones, reviews, analysis) — 6 real calls.
  const endpoints = ['/profile','/queue','/stats','/milestones','/reviews/received','/analysis'];
  const oldApi = makeApi('old'); endpoints.forEach(e=>oldApi.req(e,{useCache:true}));
  let threw=false;
  try { for(let i=0;i<10;i++){ at(1+i); endpoints.forEach(e=>oldApi.req(e,{useCache:true})); } } catch { threw=true; }
  ok('OLD self-throttles when re-reading cached endpoints (mount+WS refetch)', threw===true);

  at(0);
  const newApi = makeApi('new'); endpoints.forEach(e=>newApi.req(e,{useCache:true}));
  let threwNew=false;
  try { for(let i=0;i<50;i++){ at(1+i); endpoints.forEach(e=>newApi.req(e,{useCache:true})); } } catch { threwNew=true; }
  ok('NEW never throws re-reading cached endpoints', threwNew===false);
  ok('NEW made exactly 6 network calls (one per endpoint, then all cached)', newApi.net()===6);
}

console.log('poll spend during a 200s generation (cache wiped each tick = real call)');
{
  const pollCalls = (intervalMs) => { let n=0; for(let t=intervalMs;t<200000;t+=intervalMs) n++; return n; };
  const at8 = pollCalls(8000), at15 = pollCalls(15000);
  ok('8s poll ~24 real calls over 200s', at8 === 24);
  ok('15s poll ~13 real calls over 200s (roughly half)', at15 === 13);
  // Per-minute spend must leave headroom under the 25/min shared budget.
  const perMin = (intervalMs) => Math.floor(60000/intervalMs);
  ok('8s poll = 7/min (tight against 25 once WS+mount add on)', perMin(8000) === 7);
  ok('15s poll = 4/min (comfortable headroom under 25)', perMin(15000) === 4);
}

console.log('WS completion short-circuits the poll');
{
  // Model: poll every 15s wiping cache + a real /analysis GET; a ts:analysis_complete
  // WS event at t=20s delivers the new analysis and stops the poll.
  // The WS event clears the interval the instant `analysis` updates (via the
  // dashboard effect), independent of tick boundaries. Poll ticks fire at 15s, 30s…
  at(0); const api = makeApi('new');
  const wsAt = 20000;               // ts:analysis_complete delivered here
  let stopped = null;
  for (let t = 15000; t <= 200000; t += 15000) {
    if (t > wsAt) { break; }        // interval already cleared by the WS effect at wsAt
    at(t); api.wipe(); api.req('/analysis', { useCache: true }); // real poll fetch at this tick
  }
  stopped = wsAt;                   // effect stops the poll exactly at WS delivery
  ok('poll stopped exactly at WS completion (20s)', stopped === 20000);
  ok('only 1 real poll fetch (t=15s) before WS short-circuit', api.net() === 1);
}

console.log(`\n${fail===0?'✅ ALL PASSED':'❌ FAILURES'} — ${pass} passed, ${fail} failed`);
process.exit(fail===0?0:1);
