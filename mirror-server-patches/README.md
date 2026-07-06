# mirror-server patches

This folder holds changes destined for the **mirror-server** repository
(`GabrielGomez33/mirror-server`). They live here — at the root of the Mirror
frontend branch `claude/rate-limiter-analysis-m3o4rs` — instead of being pushed
directly to mirror-server, so every change can be reviewed in one place before
being applied to the backend. Each numbered subfolder is a self-contained,
independently-applyable change with its own README, a unified diff, a full
corrected copy of each touched file, and tests.

> Separation of concerns: nothing here alters how mirror-server talks to
> dina-server. Any dina-server-bound change lives in the sibling
> `dina-server-patches/` folder and must route through dina's mirror module
> (`src/modules/mirror`).

## Index

| # | Change | Files touched | Risk | Status |
|---|--------|---------------|------|--------|
| 001 | Rate limiter: correct fixed-window reset + per-route buckets | `middleware/authMiddleware.ts` | Low (internal-only; API/response shape unchanged) | ✅ implemented & tested |

## Applying a patch

From the root of a clean `mirror-server` checkout:

```bash
# Option A — apply the unified diff
git apply /path/to/001-ratelimit-window-and-bucket/authMiddleware.ts.patch

# Option B — drop in the full corrected file
cp /path/to/001-ratelimit-window-and-bucket/authMiddleware.ts middleware/authMiddleware.ts

# then rebuild as usual
npm run build
```

## Running a patch's tests

The tests are plain Node (no dependencies, no DB, no network):

```bash
node 001-ratelimit-window-and-bucket/tests/limiter-edgecases.test.js
```
