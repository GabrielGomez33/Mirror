# Goal T — TruthStream: free cached reads + halve the analysis-poll spend

**Repo:** Mirror (frontend) — changes applied directly under `client/`.
**Files changed:**
- `client/src/services/truthStreamApi.ts`
- `client/src/components/truthstream/AnalysisDashboard.tsx`

## Why

Generating a TruthStream report threw the client-side **"Rate limit exceeded"**
(the `truthStreamApi.ts` limiter — 25 requests / 60 s, shared across every
truthstream endpoint), not a server 429. During generation three things shared and
drained that one budget:

1. **`makeRequest` checked the limiter before the cache**, so mount-time fan-out
   (`profile` + `queue` + `stats` + `milestones` + reviews) and WebSocket-driven
   refetches consumed budget even when served from cache.
2. **The completion poll ran every 8 s for up to 200 s and wiped the analysis cache
   each tick** (`clearTruthStreamCache('analysis')` → real network GET) = ~7
   real calls/min, tight against the 25/min budget once the fan-out is added.

## The fix

**Cache before budget (`truthStreamApi.ts`).** The GET cache lookup now runs before
`rateLimiter.canMakeRequest()`. Cached reads are free; only genuine network requests
count against the 25/min limiter. This directly relieves the mount burst and the
WS-driven refetch fan-out.

**Poll is a fallback, not the primary path (`AnalysisDashboard.tsx`).** Completion
normally arrives via the existing `ts:analysis_complete` WebSocket event
(TruthStreamContext → `loadAnalysis`), and the dashboard effect stops the poll the
instant the new analysis lands. The poll interval went **8 s → 15 s**, roughly
halving its real-network spend (~7/min → ~4/min) while keeping WS-based completion
near-instant. The 200 s cap and cache-wipe-per-tick (needed for the fallback to
detect completion) are unchanged.

## Edge cases covered by the test

`tests/truthstream-poll-cache.test.js` (fake clock, faithful 25/min RateLimiter +
cache):
- **Cache-before-limiter** — OLD self-throttles when the mount/WS set re-reads
  cached endpoints; NEW never does and makes exactly **6** network calls (one per
  endpoint, then all cached).
- **Poll spend** — 8 s ≈ 24 real calls / 7 per min vs 15 s ≈ 13 real calls / 4 per
  min over a 200 s generation (comfortable headroom under 25/min).
- **WS short-circuit** — a `ts:analysis_complete` event at 20 s stops the poll
  immediately; only **1** real poll fetch (at 15 s) happens before it.

Result: **9/9 passing** (see `tests/RESULTS.txt`). Both edited files pass an
isolated TypeScript transpile check.

## No-disruption notes

- No API contract, endpoint, cache TTL, or the 25/min limit changed — only the
  cache/limiter order and the poll cadence.
- Completion detection is unchanged in the fast path (WS); only the fallback poll is
  slower, and it already had a 200 s cap and unmount cleanup.
- **Deferred (documented, now cheaper):** coalescing the several mount-time loads in
  `refreshAll` and the per-component list fetches — with cache hits now free they no
  longer drain the budget, so this is optional polish.
