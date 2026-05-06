# server-changes

This folder is **not** part of the client build. It contains files that need
to land in companion backend repos (currently only `mirror-server`) to
complete a feature being shipped from this branch.

The layout under each subfolder mirrors the target repo's tree, so applying
the changes is a copy of equivalent paths — no rewriting.

## Why it lives here

The Mirror PWA's Phase 4 (Web Push) requires backend support: a
`push_subscriptions` table, the HTTP routes for opt-in / opt-out, and a
service module that fans out notifications. Rather than open a parallel PR
in `mirror-server` and risk the two halves drifting, we draft the server
changes here on the same branch as the client work and apply them
manually after review.

After Phase 4 ships and stabilizes, this folder can be deleted.

## Current contents (Phase 4)

```
server-changes/
└── mirror-server/
    ├── migrations/
    │   └── 009_push_subscriptions.sql              (Phase 4)
    ├── services/
    │   ├── pushService.ts                          (Phase 4; PushPayload extended in 6a)
    │   └── pushNotificationDispatcher.ts           (Phase 6a — new)
    ├── routes/
    │   └── push.ts                                 (Phase 4)
    └── systems/
        └── mirrorGroupNotifications.ts             (Phase 6a — full file with hook applied)
```

All files are full, ready-to-copy versions of their target paths in the
`mirror-server` repo. No patches, no instructional snippets — just `cp`.

## Phase 6a — auto-push on every notification event

Hooks Web Push delivery into mirror-server's central notification system.
Every event whose template has `'push'` in its `channels` array now
dispatches to subscribed devices automatically; templates without
`'push'` (e.g. `member_left`, `chat_typing`) stay WebSocket-only.

**Files in this phase:**

| Target path in mirror-server | Action | Notes |
|---|---|---|
| `services/pushService.ts` | Replace | PushPayload interface gained: `badge`, `unreadCount`, `requireInteraction`, `silent`, `renotify` (all optional, all already supported by the SW). Rest of the file unchanged from Phase 4. |
| `services/pushNotificationDispatcher.ts` | New file | Bridges `sendNotification()` → `pushService.send()`. Builds the push payload, sanitizes & prefixes the URL with `/Mirror/`, derives a tag for OS-level dedup, swallows all errors. |
| `systems/mirrorGroupNotifications.ts` | Replace | Two changes from upstream: (1) adds the dispatcher import, (2) `sendNotification()` calls `void dispatchPushFromNotification(notification, template)` after both the immediate-WebSocket and the queue paths. Templates and all other methods are untouched. |

**Behavior under failure:**

| Scenario | Outcome |
|---|---|
| Dispatcher throws | Caught inside dispatcher; logged via `Logger`; WebSocket / queue path completely unaffected. |
| User has no active push subscriptions | `pushService.send()` returns `{sent:0, expired:0, skipped:0}`; dispatcher logs nothing. |
| User has 3 devices, 1 dead | `pushService.send()` returns `{sent:2, expired:1, ...}`; dead device soft-deleted server-side via 410 handling. |
| VAPID env vars missing | `pushService.send()` returns zeros silently (Phase 4 behavior); dispatcher no-ops. |
| `actionUrl` malformed/off-origin | Dispatcher passes `undefined` to the SW; SW falls back to `/Mirror/` per its existing security boundary. |
| Multiple chat messages in same group within seconds | Same `tag` (e.g. `chat_message:<groupId>`); OS collapses on the device. |

**What's covered automatically** (templates with `'push'` in `channels`):

`group_invite`, `member_joined`, `peer_review_received`, `video_call_started`,
`admin_promoted`, `drawing_session_started`, `vote_proposed`, `vote_completed`,
`conversation_summary`, `chat_message`, `chat_mention`, `analysis_completed`,
`ts_review_received`, `ts_review_classified`, `ts_analysis_complete`,
`ts_dialogue_message`, `ts_queue_assigned`, `ts_milestone_earned`.

**What stays WebSocket-only** (correctly): `member_left`, `compatibility_updated`,
`admin_demoted`, `conversation_insight`, `chat_message_edited` /
`chat_message_deleted` / `chat_typing` / `chat_presence` /
`chat_reactions_updated` / `chat_message_read`, `dina_processing_started`.

**Apply order:**

```bash
cd mirror-server

cp <Mirror-repo>/server-changes/mirror-server/services/pushService.ts                    services/
cp <Mirror-repo>/server-changes/mirror-server/services/pushNotificationDispatcher.ts     services/
cp <Mirror-repo>/server-changes/mirror-server/systems/mirrorGroupNotifications.ts        systems/

npm run rebuild           # tsc must pass — verifies the import resolves
sudo pm2 reload mirror-server

# Verify: trigger an event the user is subscribed to (e.g. send yourself
# a TruthStream review) and watch logs:
pm2 logs mirror-server | grep PushDispatcher
# Expect: "Push dispatched { userId: ..., type: ..., sent: 1, ... }"
```

## How to apply to mirror-server

### 1. Add the dependency

```bash
cd mirror-server
npm install web-push
npm install --save-dev @types/web-push
```

### 2. Generate VAPID keys (one time, ever)

```bash
npx web-push generate-vapid-keys --json
```

Output looks like:

```json
{ "publicKey": "BEl62iUYgUivxIkv69yViEuiBIa-...", "privateKey": "Yq..." }
```

### 3. Add env vars to `mirror-server/.env`

```
# REQUIRED
VAPID_PUBLIC_KEY=<the publicKey from the output>
VAPID_PRIVATE_KEY=<the privateKey from the output>
VAPID_SUBJECT=mailto:you@example.com

# OPTIONAL — sane defaults are used if unset
MAX_PUSH_SUBSCRIPTIONS_PER_USER=10
MAX_PUSH_PAYLOAD_BYTES=3000
```

| Var | Notes |
|---|---|
| `VAPID_PUBLIC_KEY` | base64url, ~88 chars. Safe to expose to clients. |
| `VAPID_PRIVATE_KEY` | base64url, ~43 chars. **Secret.** Never commit, never log. |
| `VAPID_SUBJECT` | `mailto:` (or `https://`) URL the push service can reach you at if they need to flag abuse. Required by VAPID spec. |
| `MAX_PUSH_SUBSCRIPTIONS_PER_USER` | Hard cap on active subscriptions per user. Beyond this, `/subscribe` returns `409 DEVICE_LIMIT_REACHED`. |
| `MAX_PUSH_PAYLOAD_BYTES` | Defensive cap on the JSON payload before encryption. Web Push services reject anything above ~4096 B encrypted; raw + crypto overhead must stay below that. |

VAPID keys are stable for the life of the deployment. Rotating them
invalidates every existing subscription, forcing all users to re-opt-in,
so don't rotate casually.

### 4. Run the migration

```bash
mysql -u $DB_USER -p $DB_NAME < migrations/009_push_subscriptions.sql
```

### 5. Copy the new files

```bash
cp services/pushService.ts <mirror-server>/services/pushService.ts
cp routes/push.ts          <mirror-server>/routes/push.ts
```

### 6. Wire the route into `index.ts`

Add the import alongside the other route imports:

```ts
import pushRoutes from './routes/push';
```

Mount alongside the other `/mirror/api/*` routes (no `subscriptionGate` —
push opt-in must work on the free tier, and `/vapid-public-key` must be
reachable while logged out):

```ts
APP.use('/mirror/api/push', pushRoutes);
console.log('[ROUTES] Push routes mounted at /mirror/api/push');
```

### 7. Restart and verify

```bash
npm run rebuild && sudo pm2 reload ecosystem.config.js
```

```bash
# Public key endpoint should return 200.
curl -s https://www.theundergroundrailroad.world/mirror/api/push/vapid-public-key | jq .

# Subscribe should return 401 without a token.
curl -s -o /dev/null -w '%{http_code}\n' \
  -X POST https://www.theundergroundrailroad.world/mirror/api/push/subscribe \
  -H 'Content-Type: application/json' -d '{}'
# expected: 401
```

## API contract

| Method | Path | Auth | Description | Possible status |
|---|---|---|---|---|
| GET | `/mirror/api/push/vapid-public-key` | none | Returns `{ publicKey }` for `PushManager.subscribe`. | 200, 503 (push not configured) |
| POST | `/mirror/api/push/subscribe` | bearer | Persists a `PushSubscription`. Idempotent — re-subscribing same device updates in place. Returns `{ ok, activeDevices }`. | 201, 400 (`INVALID_SUBSCRIPTION`), 401, 409 (`DEVICE_LIMIT_REACHED`), 429 (`RATE_LIMITED`) |
| DELETE | `/mirror/api/push/subscribe` | bearer | Removes a subscription by endpoint. | 200, 400, 401, 429 |
| GET | `/mirror/api/push/devices` | bearer | Returns `{ activeDevices }`. For settings UI. | 200, 401, 429 |

## SECURITY NOTES

What this implementation defends against, and what it doesn't.

### Defended

- **Auth bypass**: All write endpoints go through `AuthMiddleware.verifyToken`. `/vapid-public-key` is intentionally public (the value is non-secret).
- **CSRF**: API auth is Bearer-token only (no ambient cookies), so cross-origin form submissions can't act as the user.
- **Subscription stuffing**: `MAX_PUSH_SUBSCRIPTIONS_PER_USER` (default 10) blocks runaway insertion. Re-subscribing the same device doesn't count against the cap.
- **Rate floods**: Per-user sliding-window limiter on `/subscribe` (10/min), `/subscribe DELETE` (10/min), and `/devices` (30/min), matching `truthstreamController` patterns. Returns 429 + `RATE_LIMITED`.
- **Body bloat**: Push router accepts max 4 KB JSON (vs the 100 KB global limit). Field-level lengths bounded: endpoint ≤ 2048 chars, p256dh/auth ≤ 255 chars.
- **Endpoint forgery**: Endpoints must start with `https://`. SHA-256 hash used for the unique index lookup so no row identifies on user-controlled data.
- **Payload bombs to push services**: `pushService.send` rejects payloads > `MAX_PUSH_PAYLOAD_BYTES` (default 3 KB) before calling web-push, protecting our reputation with FCM/APNs/Mozilla.
- **Push service rate limits**: 429s with `Retry-After` populate the row's `retry_after` column; subsequent fan-outs skip that subscription until the timestamp passes. Cap of 7 days on `Retry-After` to bound damage from misbehaving services.
- **Stale subscriptions**: 404/410 from a push service triggers soft-delete via `expired_at`; nightly `pushService.pruneExpired()` hard-deletes rows older than 30 days. Skipped subscriptions are reported in `send()`'s return value so callers can monitor.
- **DB integrity**: FK `ON DELETE CASCADE` so user deletion removes all their subscriptions atomically.
- **Memory leaks**: Rate-limit map cleanup interval runs every 5 minutes and is `.unref()`ed so it doesn't block process exit.
- **Logging discipline**: Endpoint URLs and key material are never logged. Only userId, subscriptionId, statusCode, and last_error are emitted.

### Not yet defended (accepted risk or out of scope)

- **Distributed rate limiting**: The limiter is in-memory per-process. Mirror runs under PM2; if multiple workers serve push routes, each enforces its own counter. The effective ceiling is `workers × max`. Acceptable for now since (a) push routes are low-volume and (b) the device cap puts an absolute upper bound on damage. If push traffic grows, move to Redis (`ioredis` is already a project dep).
- **IP-based abuse correlation**: We capture `created_ip` on subscribe but don't use it for blocking. Future: rate-limit on IP for unauthenticated bursts on `/vapid-public-key`.
- **Notification preferences enforcement**: The current contract is "subscribed = will be notified for everything." Phase 6 adds per-event-type preferences (mute groups, mute reviews, etc.); until then, callers of `pushService.send()` must respect existing in-app mute settings before calling.
- **Encryption at rest of `auth_secret` / `p256dh`**: These are public-key-equivalent material — they only let *our* server encrypt for *that device*. Compromise of the DB doesn't let an attacker push to users without also stealing `VAPID_PRIVATE_KEY`. We do not encrypt them at rest. If your threat model includes a passive DB read (e.g. backup leak), apply column-level encryption similar to whatever `mirror_group_messages` uses.
- **Replay protection of the subscribe payload**: Bearer token auth + idempotent upsert means a replayed request just refreshes the same row. Not exploitable.
- **Tests**: No automated tests included, matching the rest of the project. Recommend adding before Phase 6 wires push to live event triggers.

## What's NOT in this drop yet

- **Phase 5 (frontend):** the client wiring (permission prompt, subscribe flow, custom SW push/notificationclick handlers) lands directly in `client/` on this branch — not in this folder.
- **Phase 6 (event hooks):** `pushService.send()` calls from existing notification triggers (TruthStream review received, dialogue reply, group activity, etc.) will be added as a follow-up patch under `server-changes/mirror-server/` once Phase 5 is verified end-to-end.
- **dina-server:** No changes required for Phase 4. If Phase 6 needs to push from DINA-originated events (e.g. analysis complete), a `server-changes/dina-server/` folder will appear at that point.

## Reviewer checklist

- [ ] `web-push` and `@types/web-push` added to `mirror-server/package.json`
- [ ] VAPID env vars set in `.env` (and not committed)
- [ ] Migration `009_push_subscriptions.sql` applied
- [ ] `pushService.ts` and `push.ts` copied to matching paths
- [ ] Route mounted in `index.ts` at `/mirror/api/push`
- [ ] Server restarted (`pm2 reload`)
- [ ] `curl /vapid-public-key` returns 200 with `publicKey`
- [ ] Authenticated `POST /subscribe` with valid payload returns 201
- [ ] Authenticated `POST /subscribe` with garbage returns 400 `INVALID_SUBSCRIPTION`
- [ ] 11th distinct subscribe for one user returns 409 `DEVICE_LIMIT_REACHED`
- [ ] 11th rapid `/subscribe` returns 429 `RATE_LIMITED`
- [ ] `DELETE /subscribe` removes the row
- [ ] No `auth_secret` / `p256dh` / `endpoint` values appear in any log line
