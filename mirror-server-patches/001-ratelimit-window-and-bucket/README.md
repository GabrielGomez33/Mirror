# 001 — Rate limiter: correct fixed-window reset + per-route buckets

**Repo:** mirror-server
**File:** `middleware/authMiddleware.ts` (the shared `AuthMiddleware.rateLimit`)
**Type:** bug fix — internal logic only. No route, request, or response-shape
changes. Backward compatible.

## Why

`AuthMiddleware.rateLimit(maxRequests, windowMs)` backs every TruthStream and
Personal-Analysis route (see `routes/truthstream.ts`, `routes/personalAnalysis.ts`).
It had **two independent defects** that together produced spurious
`429 / code: RATE_LIMIT_EXCEEDED` responses — the errors users saw when
generating TruthStream and personal-analysis reports.

### Bug ① — the window was held open for ~2× its configured duration

The code set a *fixed* reset timestamp but tested it against a *sliding* window:

```ts
const windowStart = now - windowMs;                 // sliding
let limitData = rateLimitStore.get(identifier);
if (!limitData || limitData.resetTime < windowStart) {   // reset test
  limitData = { count: 0, resetTime: now + windowMs };    // fixed stamp
}
```

Substituting `resetTime = t₀ + windowMs` into `resetTime < now − windowMs`, the
counter only resets once `now > t₀ + 2·windowMs`. A `(60, 60000)` limit therefore
did not clear at 60 s — it cleared at ~120 s. Worse, `retryAfter` and
`X-RateLimit-Reset` were computed off the 1× mark (`t₀ + windowMs`), so a
well-behaved client was told "retry now" while the server kept returning 429 —
a self-inflicted **retry storm**.

### Bug ② — one shared counter per user across *all* routes

The store was keyed on the caller identity alone (`user_<id>`), with no
per-route namespace. Every rate-limited route for a given user therefore
incremented **one shared counter**. A screen that fans out several GETs on load
(e.g. `/analysis` + `/perception-gap` + `/trends` + `/reviews/received`) drove a
single counter, and the route with the lowest ceiling (20 or 30) 429'd almost
immediately — even though that route had barely been called. Concretely:
hammering `GET /profile` (60/min) to 25 requests instantly blocked
`GET /analysis/history` (20/min), which the user never touched.

## The fix

1. **Per-registration bucket id.** Each `rateLimit(...)` call captures a stable,
   unique `bucketId` (`rl1`, `rl2`, …) at module-load time. The store key becomes
   `` `${bucketId}:${identifier}` ``, so two routes never share a counter and each
   enforces its own `(maxRequests, windowMs)`.
2. **Correct fixed-window reset.** Reset when `now >= limitData.resetTime`
   (the window has actually elapsed), removing the sliding `windowStart` entirely.
3. **Truthful `retryAfter`.** Because an elapsed window is reset before the limit
   check, `resetTime` is always in the future at the point of a 429, so
   `retryAfter = max(1, ceil((resetTime − now) / 1000))` is always an honest,
   ≥ 1 s wait. A `Retry-After` header is now also emitted alongside the existing
   `X-RateLimit-*` headers.

### What deliberately did **not** change
- Method signature `rateLimit(maxRequests, windowMs)` — every existing route call
  site works unchanged.
- 429 body shape (`{ error, code: 'RATE_LIMIT_EXCEEDED', retryAfter }`).
- The `SecurityMonitor.logSecurityEvent('rate_limit_exceeded', …)` call (now also
  records which `bucket` tripped, for observability).
- The cleanup `setInterval` (`data.resetTime < now` → delete) — already correct
  and consistent with the new keys; expired buckets are purged normally.

## Edge cases covered by the tests

`tests/limiter-edgecases.test.js` transcribes both the OLD and NEW logic
faithfully and drives them with a deterministic fake clock. It asserts:

- **Window duration** — OLD stays blocked past 1× and only clears near 2×; NEW
  clears at exactly `windowMs` (checked at 59.999 s vs 60.000 s).
- **`retryAfter` accuracy** — reflects the true remaining wait (50 s at t=10 s of
  a 60 s window) and never rounds down to 0.
- **Per-route isolation** — exhausting one route does not affect another; the
  low-limit-route-poisoned-by-high-limit-route bug is reproduced on OLD and
  absent on NEW.
- **Per-user isolation & boundaries** — exactly `maxRequests` allowed, `(max+1)`th
  blocked, a different user unaffected, same user allowed again after the window.
- **Unauthenticated (IP-keyed) requests** — namespaced per route just like
  authenticated ones.

Result: **19/19 passing** (see `tests/RESULTS.txt`). The same suite shows the OLD
implementation failing the window-duration and shared-bucket assertions.

## No-disruption / scaling notes

- `mirror-server` currently runs as a **single PM2 fork** (no `instances` /
  `cluster` in `ecosystem.config.js`), so the in-memory `Map` remains
  authoritative — this fix does not change that assumption.
- **Latent (out of scope):** if the app is ever moved to PM2 cluster mode, each
  worker keeps its own `Map` and limits fragment. The existing comment at the top
  of the file already sketches the Redis migration (`INCR` + `EXPIRE`); the new
  key format `` `${bucketId}:${identifier}` `` maps cleanly onto a Redis key when
  that migration happens.

## How to apply

```bash
# from a clean mirror-server checkout
git apply /path/to/authMiddleware.ts.patch      # or: cp authMiddleware.ts middleware/
npm run build
```
