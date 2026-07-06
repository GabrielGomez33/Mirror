# System-wide rate-limiter analysis

Branch: `claude/rate-limiter-analysis-m3o4rs`
Scope: `Mirror` (frontend) · `mirror-server` (backend) · `dina-server` (AI backend)
Symptom under investigation: "Rate limit exceeded" when creating/scrolling journal
entries, creating a mirror group, and generating personal-analysis and
TruthStream reports.

## TL;DR

There is no single rate limiter — there are **seven**, split across two layers,
and different user flows trip different ones. Two of them throw the *exact same*
`"Rate limit exceeded"` string from completely different places, which is why the
behavior looked random.

1. **Backend (`mirror-server`) shared limiter had two real bugs** — window held
   open ~2× too long, and one counter shared across all of a user's routes. These
   are the root cause behind the TruthStream and Personal-Analysis report 429s.
   **Fixed** in `mirror-server-patches/001-ratelimit-window-and-bucket/`.
2. **Frontend ships three per-service self-throttles** (journal 20/min, groups
   30/min, truthstream 25/min) that throw the user-facing "Rate limit exceeded"
   string **before any network call**, drained by request-amplification patterns.
   These are the root cause behind the journal and group 429s. **Not yet fixed —
   roadmap below.**

## The seven limiters

| # | Location | Kind | Limit | Verdict |
|---|----------|------|-------|---------|
| 1 | `mirror-server` `middleware/authMiddleware.ts:603` `AuthMiddleware.rateLimit` | in-memory, per-user (was) | per-route configs (5/hr … 60/min) | 🐞 **two bugs — FIXED (patch 001)** |
| 2 | `mirror-server` `routes/personalAnalysis.ts:65` `checkAnalysisRateLimit` | in-memory fixed window | 500 / 10 min | ✅ correct |
| 3 | `mirror-server` `routes/groups.ts:2459` `rateLimitedJoin` | in-memory sliding window | 10 joins / 60 s | ✅ correct |
| 4 | `mirror-server` `utils/journalSecurityHelpers.ts:250` `checkEntryRateLimit` | DB daily count | 20 entries / day | ✅ correct (business rule) |
| 5 | `Mirror` `services/journalApi.ts:64` client `RateLimiter` | in-memory, shared across all journal calls | 20 req / 60 s | ⚠️ amplified (roadmap J) |
| 6 | `Mirror` `services/groupsApi.ts:46` client `RateLimiter` | in-memory, shared across all group calls | 30 req / 60 s | ✅ **FIXED (Goal 3)** — cache-first + 30s poll |
| 7 | `Mirror` `services/truthStreamApi.ts:37` client `RateLimiter` | in-memory, shared across all truthstream calls | 25 req / 60 s | ⚠️ amplified (roadmap T) |
|   | `dina-server` `src/api/middleware/security.ts` + `config/database/db.ts:736` | per-identity/min | 15–20/min (100 trusted) | ✅ correct; aggregate-load risk (roadmap D) |
|   | `dina-server` `src/api/routes/index.ts:749` synthesis limiter | in-memory | 1 synthesis / 30 s / user+group | ✅ correct, routes through mirror module |

## Backend bugs (fixed in patch 001)

**Bug ① — 2× window.** Reset tested a fixed `resetTime = now + windowMs` against a
sliding `windowStart = now − windowMs`, so the counter only cleared at
`now > t₀ + 2·windowMs`. `retryAfter`/`X-RateLimit-Reset` pointed at the 1× mark,
so compliant clients retried early and re-triggered 429 → retry storm.

**Bug ② — shared per-user counter.** The store was keyed on `user_<id>` only, so
every rate-limited route for a user shared one bucket. A dashboard fanning out
several GETs tripped the lowest-limit route almost instantly (e.g. 25× `GET /profile`
at 60/min blocks `GET /analysis/history` at 20/min, untouched).

Fix: per-registration bucket namespace (`` `${bucketId}:${identifier}` ``) +
`now >= resetTime` reset + truthful `retryAfter`. Signature and response shape
unchanged. 19/19 edge-case tests pass. Details in the patch README.

**Confirmed NOT bugs:** limiters 2–4; `subscriptionGate` returns **403
`USAGE_LIMIT`/`UPGRADE_REQUIRED`** (not 429) and fails open; `verifyToken` does no
rate limiting. Note: a frontend that renders 403 usage-limits as a generic "limit
exceeded" toast could be conflating them with 429s — worth confirming per flow.

## Frontend self-throttles + amplifiers (roadmap)

All three client `RateLimiter`s throw the literal
`` `Rate limit exceeded. Please wait ${n} seconds.` `` **before** any fetch, so
much of what users see is the client throttling itself once amplifiers push it
past the (small, shared) budget.

### Roadmap J — Journal (`journalApi.ts` 20/min shared)
- Rapid date navigation (`JournalTab.tsx` `useEffect([selectedDate])`) fires an
  uncached GET per Prev/Next with **no AbortController / in-flight guard**.
- **Create → forced full refetch** = 2 requests per save; `createEntry` invalidates
  the date cache so the refetch always hits the network.
- `fetchWithRetry` fans each call up to 4× on 5xx/network errors, all against the
  same 20/min bucket.
- Reconnect (`online` event) refetches; effect re-subscribes per date.
- Search refetches 100 uncached entries per settled keystroke burst.
- **Fix direction:** add an AbortController + in-flight guard to
  `fetchEntriesForDate`; update local state from `createEntry`'s returned entry
  instead of refetching; reconsider the 20/min shared cap (it is stricter than any
  backend journal limit — journal reads are unlimited server-side).

### Roadmap G — Groups (`groupsApi.ts` 30/min shared) ✅ DONE (Goal 3)
- **3-second `getMyGroups` poll** burned ~20 of 30 slots/min for the entire time
  the page was open.
- The client limiter was checked **before** the cache lookup, so **cache hits
  consumed budget** — the poll drained the bucket even though almost every tick was
  served from cache.
- **Fixed:** cache lookup now runs **before** the limiter (cache hits are free);
  poll lengthened 3 s → 30 s and paused while the tab is hidden. Real network calls
  drop to ≤ 1/min. See `frontend-fixes/goal-G-groups-poll-and-cache-limiter/`
  (7/7 tests pass).
- **Deferred (now cheap, documented):** duplicate mount fetch, double-registered WS
  handlers (`member:joined`/`member_joined`), focus-refetch of uncached invitations.

### Roadmap T — TruthStream (`truthStreamApi.ts` 25/min shared)
- Generate → **poll `GET /analysis` every 8 s for up to 200 s**, and each tick
  `clearTruthStreamCache('analysis')` **defeats its own 2-min cache**
  (`AnalysisDashboard.tsx`).
- WebSocket events (`ts:review_classified`, `ts:dialogue_message`,
  `ts:analysis_complete`) each trigger list/analysis refetches that overlap the
  poll and share the 25/min bucket.
- Mount fires 4+ parallel loads (`refreshAll`) + per-component list fetches.
- **Fix direction:** stop wiping the cache each poll tick; drive completion from
  the existing `ts:analysis_complete` WS event instead of polling (or back off the
  poll); coalesce mount fetches.

### Roadmap P — Personal-analysis Generate button ✅ DONE (Goal 2)
- `handleRequestAnalysis` set `isPolling` **after** the awaited POST and the
  primary "Generate Report" button had **no `disabled` guard**
  (`MyMirrorPanel.tsx:1152`), so impatient clicks fired multiple `POST /generate`
  against the unforgiving **5/hour** backend limit.
- The `/latest` poll itself is bounded and safe (8 s, 200 s cap, cleared on
  unmount/success).
- **Fixed:** synchronous in-flight ref guard at the top of `handleRequestAnalysis`
  + `isRequesting` state driving `disabled` on both buttons + accurate 429 retry
  message (via `mirrorDashboard.makeRequest` now preserving status/code/retryAfter).
  See `frontend-fixes/goal-P-personal-analysis-generate-guard/` (9/9 tests pass).

### Roadmap D — dina-server aggregate load (architecture)
- A single report = **one** dina LLM call, so dina's own 15–20/min per-identity
  limiter is not tripped per report.
- Exposure: all mirror-server → dina calls present **one shared service identity**,
  so concurrent classify/generate jobs share one dina bucket; under load this
  surfaces as report **failures** (retryable, feeds the worker circuit breaker),
  not the client 429. Consider a higher trust level or per-user service tokens if
  aggregate throughput grows.

## Architecture / separation-of-concerns audit

Compliant (routed through dina's `src/modules/mirror` entry point):
- TruthStream classify/generate — `workers/TruthStreamQueueProcessor.ts` →
  `/mirror/truthstream/*` → `MirrorModule`.
- Personal-analysis — `workers/PersonalAnalysisQueueProcessor.ts` →
  `/mirror/personal-analysis/generate` → `MirrorModule.handlePersonalAnalysis`.
- Group synthesis — `DINALLMConnector.synthesizeViaMirrorModule` →
  `/mirror/synthesize-insights` → `MirrorModule.synthesizeInsights`.

Violation (bypasses the mirror module — **out of scope for the four report flows**,
noted for a later goal):
- `workers/DinaChatQueueProcessor.ts` calls `/api/v1/models/mistral:7b/chat`
  directly (`module: 'llm'`), and the `utils/dinaMessageUtils.ts` `LLM_CHAT`
  helper builds those direct URLs. This is the @Dina non-streaming chat path;
  streaming already uses `/api/mirror/chat/stream`. Bringing non-streaming chat
  through the mirror module would restore the single entry point.
- Suspected stale path: `routes/dashboard.ts:440` fetches
  `${DINA_SERVER_URL}/api/mirror/insights…` (missing the `/v1` segment dina mounts
  under) — verify it isn't 404-ing.

## Status & next step

- ✅ **Goal 1 (backend limiter) implemented and tested** — patch 001. This is the
  highest-leverage fix and directly relieves the report-generation 429s.
- ✅ **Goal 2 (Roadmap P — personal-analysis Generate guard) implemented and
  tested** — `client/` edits + `frontend-fixes/goal-P-.../`.
- ✅ **Goal 3 (Roadmap G — groups poll + cache/limiter order) implemented and
  tested** — `client/` edits + `frontend-fixes/goal-G-.../`.
- ⏭️ Remaining goals, one at a time, each hardened + verified before the next:
  **J** (journal: abort + in-flight guard, drop create→refetch), **T** (truthstream:
  stop cache-wipe poll, WS-driven completion). Each lands as a frontend edit under
  `client/` (and any backend/dina change under the sibling `*-patches/` folders).
