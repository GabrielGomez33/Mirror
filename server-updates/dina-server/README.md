# dina-server — Goal #1 audit ("Create Group" = Premium)

**Verdict: no change required, and none appropriate.**

Audited against a fresh clone of `dina-server@master` on 2026-06-20.

## Why Dina is not involved

Goal #1 is an **entitlement** decision ("may this user create a group?").
Entitlement/billing state is owned exclusively by **mirror-server's `paywall/`
module**. Per our architecture ground rule, mirror-server ⇄ dina-server traffic
flows through the dina mirror module at `src/modules/mirror`, and that module's
job is analysis / validation / enrichment — **not** subscription tier checks.

Putting a paywall check inside `src/modules/mirror` would:

* duplicate authority over subscription state (two sources of truth), and
* couple Dina to mirror-server's billing model,

both of which violate separation of concerns. So the correct action here is to
make **no** change to dina-server.

## What was checked

* `src/modules/mirror/groupManager.ts` and `src/modules/mirror/groupRoutes.ts`
  — these expose group **validation/enrichment** (`POST /mirror/groups/validate`
  and related context helpers). They contain no tier/subscription logic and
  should not. They are reached only after mirror-server has already authorized
  the request, so no premium user is ever blocked here and no free user reaches
  a *creation* path through Dina.
* The group **creation** write path lives entirely in mirror-server
  (`routes/groups.ts` → its own DB), which is where the Premium gate already
  sits (see `../mirror-server/README.md`).

## Net effect

The dina mirror module remains the sole, unchanged entry point into Dina. Goal
#1 is satisfied with a front-end UX layer plus mirror-server's pre-existing
server-side gate — Dina is untouched.
