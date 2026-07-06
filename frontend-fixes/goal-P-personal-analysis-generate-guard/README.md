# Goal P — Personal-Analysis "Generate" double-submit guard

**Repo:** Mirror (frontend) — changes applied directly under `client/`.
**Files changed:**
- `client/src/components/home/MyMirrorPanel.tsx`
- `client/src/services/mirrorDashboard.ts`

## Why

`POST /mirror/api/personal-analysis/generate` is limited to **5 per hour**
(`mirror-server routes/personalAnalysis.ts:304`). The UI let a user exceed it
trivially:

- `handleRequestAnalysis` set `isPolling` **after** the awaited POST resolved, so
  during the in-flight request `isPolling` was still `false`.
- The primary **"Generate Report"** button had **no `disabled` attribute** — only
  a cosmetic `opacity` — and no synchronous guard.
- The **"Regenerate"** button used `disabled={isPolling}`, which was also `false`
  during that same in-flight window.

So a few impatient clicks fired several `POST /generate` calls back-to-back and
burned the 5/hour budget, producing a genuine backend 429.

## The fix

1. **Synchronous in-flight ref guard.** `handleRequestAnalysis` now sets
   `requestInFlightRef.current = true` **before any `await`** and returns early if
   a request is already in flight or polling is active. A ref (not state) is used
   because it updates synchronously — it blocks a burst of clicks fired in the same
   tick, before React re-renders.
2. **Real `disabled` state.** A new `isRequesting` state drives
   `disabled={isRequesting || isPolling}` on **both** buttons, with matching
   `opacity`/`cursor` and an in-flight label (`Generating…` / `Regenerating…`).
3. **Accurate rate-limit UX.** `mirrorDashboard.makeRequest` now preserves the
   HTTP `status`, `code`, and `retryAfter` on the thrown error (message unchanged
   for backward compatibility). On a 429 the panel shows
   *"You've reached the report-generation limit. Please try again in N minutes."*
   instead of a silent `console.error`.

## Edge cases covered by the test

`tests/generate-guard.test.js` models the guard faithfully and asserts:
- 10 rapid clicks in one tick → **exactly 1** POST.
- No POST fires while polling is active.
- After a **failed** request (e.g. a real 429), polling does not start and a retry
  is allowed once the prior attempt settles (the guard doesn't wedge shut).
- `retryAfter` → message formatting: 120 s → "2 minutes", 60 s → "1 minute"
  (singular), 0 s → generic "later" message.

Result: **9/9 passing** (see `tests/RESULTS.txt`). Both edited files also pass an
isolated TypeScript transpile check (no syntax/JSX/type-emit errors); a full
`tsc`/`vite build` was not run here because the frontend dependency tree
(three.js, tensorflow, face-api) is not installed in this environment.

## No-disruption notes

- The `/latest` polling loop (8 s interval, 200 s cap, cleared on unmount/success)
  was already bounded and correct — left unchanged.
- `handleRequestAnalysis`'s regenerate path (`analysisIdBeforeRegen`,
  `isRegenerating`) is untouched; the guard only tightens `disabled` from
  `isPolling` to `isRequesting || isPolling`, which is strictly safer.
- No API contract, endpoint, or response shape changed.
