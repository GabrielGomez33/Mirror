# mirror-server — Goal #1 audit ("Create Group" = Premium)

**Verdict: no required code change.** Group creation is already gated to the
Premium tier on the server, robustly, with a fail-open safety net for paying
users. The front-end lock/grey treatment added in this task is a UX layer on
top of an enforcement layer that already exists. Everything below is the proof,
the request flow, and an exhaustive edge-case matrix so we can be confident the
existing ecosystem is undisturbed.

Audited against a fresh clone of `mirror-server@master` on 2026-06-20.

---

## 1. Where enforcement already lives

mirror-server uses a **declarative, umbrella gate**: a single middleware checks
every authenticated request against a rules table, so no per-route edits are
needed.

**Wiring — `index.ts`**
```ts
// L196-206
const paywallConfig = loadPaywallConfig();
const subscriptionService = new SubscriptionService(paywallConfig, paypalProvider);
AuthMiddleware.setSubscriptionService(subscriptionService);
AuthMiddleware.setSubscriptionGateRules(
  AuthMiddleware.buildGateRulesFromConfig(paywallConfig.gates)
);

// L379 — the gate runs for every /mirror/api/groups/* request
APP.use('/mirror/api/groups', AuthMiddleware.subscriptionGate as express.RequestHandler, groupRoutes);
```

**The rule — `middleware/authMiddleware.ts` (`buildGateRulesFromConfig`, L168-173)**
```ts
// GROUPS — create is premium, join is usage-limited
{
  pattern: '/groups/create',
  methods: ['POST'],
  requiredTier: (gates['create_group'] as SubscriptionTier) || 'premium',
  featureName: 'create_group',
},
```

**The enforcement — `middleware/authMiddleware.ts` (`subscriptionGate`, L346-492)**
* Resolves the caller's *effective* tier from subscription status
  (`active` / `trialing` / `past_due` / `cancelled-within-period` keep tier).
* For `/groups/create` (a hard tier gate, no `usageLimitKey`) it runs the tier
  check at L475 and, when the user is below `premium`, returns **HTTP 403**:
  ```json
  {
    "error": "This feature requires premium",
    "code": "UPGRADE_REQUIRED",
    "feature": "create_group",
    "requiredTier": "premium",
    "currentTier": "free",
    "currentStatus": "free",
    "upgradeUrl": "/mirror/api/subscription/plans"
  }
  ```
* The handler `createGroupHandler` (`routes/groups.ts` L389; route registered
  L2486 `router.post('/create', verified, createGroupHandler)`) is therefore
  **never reached** by a non-premium user — the gate short-circuits first.

### Why this is robust (not config-dependent)
`requiredTier` is `gates['create_group'] || 'premium'`. Even if an operator's
live `.payenv` omits `create_group` from `PAYWALL_GATES`, the rule **defaults to
`premium`**. Creation cannot silently become free through a missing config key.

### Why it fails *open* for paying users (by design)
`subscriptionGate` wraps its body in try/catch and calls `next()` on any
internal error (L494-499), and also `next()`s if the subscription lookup throws
(L401-405). A Redis/DB blip can never wrongly *block* a legitimate user; the
worst case is a single creation slipping through on infrastructure failure,
which is the correct trade-off for a paywall.

---

## 2. End-to-end consistency (front ↔ back)

| Layer | Key used | File |
|------|----------|------|
| FE button gate | `create_group` | `client/src/pages/MirrorGroupsPage.tsx` |
| FE access check | `canAccess('create_group')` | `client/src/context/SubscriptionContext.tsx` L219 |
| FE 403 → modal | forwards `code`/`feature` | `client/src/services/groupsApi.ts` L255-256 |
| FE upgrade copy | `create_group` message | `client/src/components/paywall/UpgradeModal.tsx` L73 |
| BE gate rule | `featureName: 'create_group'` | `middleware/authMiddleware.ts` L168-173 |
| BE 403 payload | `feature: 'create_group'` | `middleware/authMiddleware.ts` L483-491 |

The `feature` string is identical on every hop, so the global paywall
interceptor opens the correct, contextual upgrade modal even if a request ever
reaches the server ungated (e.g. a scripted client, or the brief FE window
before subscription state resolves).

**Dina is intentionally absent from this flow.** Group creation persists in
mirror-server's own DB; Dina (`src/modules/mirror`) is only consulted over the
WebSocket bridge (`services/DinaWebSocketClient.ts`) for AI enrichment/insights.
Entitlement = mirror-server's job. Separation of concerns is preserved.

---

## 3. Edge-case / regression matrix

Behaviour of `POST /mirror/api/groups/create` per caller state. "Pass" = reaches
`createGroupHandler`; "Block" = 403 `UPGRADE_REQUIRED`.

| # | Caller state | Effective tier | Result | Notes |
|---|--------------|----------------|--------|-------|
| 1 | `free` / `free` | free | **Block 403** | FE shows lock; tap → upgrade modal |
| 2 | `trialing` premium | premium | Pass | Trial users can create |
| 3 | `active` premium | premium | Pass | Normal paying user |
| 4 | `past_due` (grace) | premium | Pass | Grace period keeps access (L66-67) |
| 5 | `cancelled`, period not ended | premium | Pass | `accessUntil` in future (L69-74) |
| 6 | `cancelled`, period ended | free | **Block 403** | Downgraded |
| 7 | `expired` | free | **Block 403** | |
| 8 | `enterprise` | enterprise | Pass | Tier order: enterprise ≥ premium |
| 9 | Unauthenticated | — | 401 | `verified` / token check rejects first |
| 10 | Premium, Redis/DB error mid-check | — | Pass (fail-open) | Never block a payer (L401-405, L494-499) |
| 11 | `.payenv` missing `create_group` gate key | premium default | **Block 403** for free | Hard-coded `|| 'premium'` default |
| 12 | Front-end bypassed (curl as free user) | free | **Block 403** | Server is the source of truth |

### Manual verification (smoke test)
```bash
# As a FREE user (expect HTTP 403, code UPGRADE_REQUIRED, feature create_group):
curl -i -X POST https://<host>/mirror/api/groups/create \
  -H "Authorization: Bearer <FREE_USER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Edge case test","type":"family","privacy":"private","maxMembers":5}'

# As a PREMIUM/TRIAL user (expect 200/201 and a created group):
curl -i -X POST https://<host>/mirror/api/groups/create \
  -H "Authorization: Bearer <PREMIUM_USER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Premium ok","type":"family","privacy":"private","maxMembers":5}'
```
No new analytics needed: blocks are already logged via
`AuthMiddleware.logGateBlock(userId, 'create_group', 'tier_required')` →
`activity_logs` (action `upgrade_prompt_shown`), which feeds conversion metrics.

---

## 4. Optional, non-breaking hardening (NOT required)

There is a cosmetic naming inconsistency in the **example** config: the Premium
tier's `features` array lists `create_groups` (plural) while the gate key and
the entire front end use `create_group` (singular).

* **Current impact: none.** The gate decides by *tier*, and the FE `canAccess`
  falls back to a tier check, so Premium users are correctly allowed today.
* **Latent risk:** if anyone later switches `canAccess`/the gate to be
  *feature-list*-driven instead of *tier*-driven, the plural entry would no
  longer match `create_group` and Premium users could lose create access.

Aligning the token removes that future foot-gun. A complete corrected example
file is provided at:

```
optional-hardening/paywall/.payenv.example
```

**To apply (only if you want it):** change the single token `create_groups` →
`create_group` inside `PAYWALL_TIERS`'s premium `features` array in your **live**
`.payenv` on the host. ⚠️ Do **not** copy the example file over your live
`.payenv` — the example contains placeholder PayPal credentials. The provided
file is the *template* (`.payenv.example`) only. This change is safe to skip.

---

# mirror-server — Goal #2 ("live username availability")

**Required: two complete files.** Adds a public, rate-limited endpoint that
powers the registration form's real-time "username available / taken" indicator.

Authored + typechecked against a fresh clone of `mirror-server@master`
(`tsc --noEmit` → 0 errors in both files) on 2026-06-20.

## 1. Files to deploy

| File in this folder | Destination in mirror-server | Action |
|---------------------|------------------------------|--------|
| `controllers/availabilityController.ts` | `controllers/availabilityController.ts` | **NEW** |
| `routes/auth.ts` | `routes/auth.ts` | **REPLACE** (adds one import, one rate-limiter const, one route — all other routes preserved verbatim) |

No other files change. No DB migration. No dina-server change.

## 2. What it adds

`POST /mirror/api/auth/check-username` — public (registration is pre-auth),
IP-rate-limited **30/min** via the existing `AuthMiddleware.rateLimit`.

Request body (or query): `{ "username": "<candidate>" }`
Responses (always JSON, `Cache-Control: no-store`):

| Status | Body | Meaning |
|--------|------|---------|
| 200 | `{ "available": true }` | free |
| 200 | `{ "available": false, "reason": "taken" }` | already registered (case-insensitive) |
| 200 | `{ "available": false, "reason": "reserved" }` | reserved handle (admin, support, dina, …) |
| 200 | `{ "available": false, "reason": "invalid" }` | fails format rules |
| 400 | `{ "available": false, "reason": "invalid" }` | empty/missing |
| 429 | (limiter) | too many requests from this IP |
| 503 | `{ "available": null }` | internal error — could not verify |

Uniqueness uses `SELECT id FROM users WHERE LOWER(username) = ? LIMIT 1` — the
**same case-insensitive rule as `createUserInDB()`**, so the live answer matches
what registration will actually enforce. No drift.

## 3. Security / design rationale

* **No email enumeration oracle.** Only *usernames* are checked. Usernames are
  already public in Mirror (search, group rosters, @mentions), so their
  availability leaks nothing. Email existence deliberately stays a submit-time
  reveal (Goal: "keep inline reveal + harden").
* **Rate limited** to protect the DB from as-you-type / scripted volume. The
  client also debounces (450ms) and aborts superseded requests.
* **Fail-safe.** On any internal error the endpoint returns `503 available:null`
  and the client shows a neutral state — it never reports a name as free that it
  couldn't verify. The authoritative gate remains the `USERNAME_TAKEN` error
  from `createUserInDB()` at submit time (defense in depth).
* **Parameterized query** (no SQL injection surface); input length-capped and
  format-validated before the DB is touched.
* **`trust proxy`** must be configured (already required for `/register`,
  `/login`) so the limiter keys on the real client IP, not 127.0.0.1.

## 4. Edge-case / test matrix

`POST /mirror/api/auth/check-username`:

| # | Input | Expected |
|---|-------|----------|
| 1 | free name e.g. `"brandnew_handle"` | 200 `{available:true}` |
| 2 | existing name (any case, e.g. `"Gabriel"` vs stored `"gabriel"`) | 200 `{available:false, reason:"taken"}` |
| 3 | `"admin"` / `"dina"` / `"support"` | 200 `{available:false, reason:"reserved"}` |
| 4 | `"ab"` (too short) / `"bad name"` (space) / 21+ chars | 200 `{available:false, reason:"invalid"}` |
| 5 | `""` or missing body | 400 `{available:false, reason:"invalid"}` |
| 6 | 31 requests in a minute from one IP | 429 on the 31st |
| 7 | DB unavailable | 503 `{available:null}` |
| 8 | leading/trailing spaces `" gabriel "` | trimmed → treated as `"gabriel"` |

### Smoke tests
```bash
# free
curl -sS -X POST https://<host>/mirror/api/auth/check-username \
  -H 'Content-Type: application/json' -d '{"username":"totally_unique_42"}'
# taken (use a known existing username)
curl -sS -X POST https://<host>/mirror/api/auth/check-username \
  -H 'Content-Type: application/json' -d '{"username":"<existing>"}'
# reserved
curl -sS -X POST https://<host>/mirror/api/auth/check-username \
  -H 'Content-Type: application/json' -d '{"username":"admin"}'
```

## 5. Rollback

Delete `controllers/availabilityController.ts` and restore the previous
`routes/auth.ts`. The front end degrades gracefully — with the endpoint gone,
every check resolves to "unknown" (no indicator) and registration still works
via the unchanged submit-time uniqueness check. Zero downstream impact.
