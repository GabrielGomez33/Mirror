# Goal G — Groups: stop the client limiter from throttling on cache hits + tame the poll

**Repo:** Mirror (frontend) — changes applied directly under `client/`.
**Files changed:**
- `client/src/services/groupsApi.ts`
- `client/src/pages/MirrorGroupsPage.tsx`

## Why

Creating a mirror group (and general group activity) threw the user-facing
**"Rate limit exceeded. Please wait N seconds."** — which is the *client-side*
limiter in `groupsApi.ts` (30 requests / 60 s, shared across every group
endpoint), not a server 429. Two things drove it over the limit:

1. **The limiter counted cache hits.** `makeRequest` called
   `rateLimiter.canMakeRequest()` (which records a timestamp) **before** the cache
   lookup, so even reads served entirely from cache consumed budget.
2. **A 3-second background poll.** `MirrorGroupsPage` polled `getMyGroups()` every
   3 s (~20 calls/min). Because of #1, that poll burned ~20 of the 30 slots/min
   even though `getMyGroups` is cache-backed (60 s TTL) and almost every tick was a
   cache hit. Any create/join/refetch on top then tipped it over 30/min.

## The fix

**A2 — cache before budget (`groupsApi.ts`).** The GET cache lookup now runs
*before* `rateLimiter.canMakeRequest()`. A cached read returns immediately and
never touches the limiter; only genuine network requests consume budget. The
30/min ceiling still applies to real traffic.

**A1 — saner poll (`MirrorGroupsPage.tsx`).** The interval went from **3 s → 30 s**
and now **pauses while the tab is hidden** (`document.visibilityState`). Combined
with the 60 s cache and the existing immediate refetches after create/join/leave
and on WebSocket member events, the list stays fresh while real network calls drop
to ≤ 1/min.

## Edge cases covered by the test

`tests/groups-cache-limiter.test.js` transcribes the real `RateLimiter` +
`SimpleCache` and drives them with a fake clock:
- **OLD order** self-throttles: cache-served polls throw "Rate limit exceeded".
- **NEW order**: 200 cache-served reads never throw; exactly **1** network call
  inside the 60 s cache window.
- The limiter **still** enforces 30/min on genuine (uncached) network bursts
  (blocks the 31st).
- Poll-rate math: 3 s → 20 ticks/min vs 30 s → 2 ticks/min, and a simulated minute
  of the 30 s poll against the 60 s cache makes **exactly 1** real network call.

Result: **7/7 passing** (see `tests/RESULTS.txt`). Both edited files pass an
isolated TypeScript transpile check.

## No-disruption notes

- No API contract or endpoint changed; the 30/min limiter and all caching TTLs are
  unchanged — only the *order* of the cache/limiter checks and the poll cadence.
- Freshness is preserved: create/join/leave still invalidate the cache and refetch
  immediately; WebSocket member events still refetch; the 30 s poll is only a
  backstop for out-of-band changes.
- **Deferred (documented, not required for the 429 fix):** duplicate mount fetch
  (GroupContext + page), double-registered WS handlers (`member:joined` /
  `member_joined`), and focus-refetch of uncached invitations
  (`NotificationContext`). With cache hits now free (A2) these are cheap; they can
  be deduped in a later pass if desired.
