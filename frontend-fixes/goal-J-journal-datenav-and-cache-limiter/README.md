# Goal J — Journal: free cached reads + coalesce rapid date navigation

**Repo:** Mirror (frontend) — changes applied directly under `client/`.
**Files changed:**
- `client/src/services/journalApi.ts`
- `client/src/components/journal/JournalTab.tsx`

## Why

Creating and "scrolling through" journal entries threw the client-side
**"Rate limit exceeded. Please wait N seconds."** — the `journalApi.ts` limiter
(20 requests / 60 s, shared across all journal calls), not a server 429 (journal
*reads* are unlimited server-side). "Scrolling" here is day-by-day navigation
(Prev/Next), and two things drained the budget:

1. **`getEntriesByDate` checked the limiter before the cache.** Re-viewing a date
   (paging back and forth) still consumed a slot even though the entries were
   served from the 5-minute cache.
2. **Every date change fired an immediate uncached fetch** with no coalescing, so
   clicking Prev/Next through ~20 days in a minute exhausted the 20/min budget. The
   subsequent "429 when creating an entry" was the post-create refetch throwing
   once the budget was already drained.

## The fix

**Cache before budget (`journalApi.ts`).** `getEntriesByDate` now performs the GET
cache lookup *before* `rateLimiter.canMakeRequest()`. Cached dates (revisits) are
free; only genuine network requests count against the 20/min limiter.

**Debounced, guarded date navigation (`JournalTab.tsx`).**
- The `selectedDate` effect now debounces the fetch by 250 ms, so rapid Prev/Next
  navigation coalesces into a single fetch for the date the user settles on instead
  of one request per intermediate day.
- A monotonic `fetchSeqRef` guard ensures an out-of-order (slower, older) response
  can never overwrite the entries for the date currently being viewed.

Together: paging back over viewed days costs nothing (cache), and paging forward
through new days costs one request per settle instead of one per day.

## Edge cases covered by the test

`tests/journal-datenav.test.js` (fake clock, faithful RateLimiter + cache):
- **Cache-before-limiter** — OLD throws when revisiting a cached date past the
  budget; NEW never throws and makes exactly **1** network call for the revisited
  date.
- **Debounce** — 10 rapid navigations → exactly **1** fetch, for the final date.
- **Sequence guard** — when an older fetch resolves after a newer one, only the
  newer result is applied; the stale one is ignored.

Result: **7/7 passing** (see `tests/RESULTS.txt`). Both edited files pass an
isolated TypeScript transpile check.

## No-disruption notes

- No API contract, endpoint, cache TTL, or the 20/min limit changed — only the
  cache/limiter *order* and the date-fetch cadence.
- `fetchWithRetry`'s retries happen inside a single limiter check, so they never
  consumed extra client-limiter slots (the earlier analysis was conservative here);
  retry behavior is left unchanged.
- **Deferred (documented, now cheaper):** replacing the post-create full refetch
  with a local-state append from `createEntry`'s returned entry (saves 1 request
  per save; left out here to avoid any entry-shape rendering risk), and making the
  online/offline effect not re-subscribe per date. Both are optional follow-ups.
