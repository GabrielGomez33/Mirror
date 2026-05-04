# server-changes

This folder is **not** part of the client build. It contains files that need
to land in companion backend repos (currently only `mirror-server`) to
complete a feature being shipped from this branch.

The layout under each subfolder mirrors the target repo's tree, so applying
the changes is a copy of equivalent paths — no rewriting.

## Why it lives here

The Mirror PWA's Phase 4 (Web Push) requires backend support: a
`push_subscriptions` table, three new HTTP routes, and a service module
that fans out notifications. Rather than open a parallel PR in
`mirror-server` and risk the two halves drifting, we draft the server
changes here on the same branch as the client work and apply them
manually after review.

After Phase 4 ships and stabilizes, this folder can be deleted.

## Current contents (Phase 4)

```
server-changes/
└── mirror-server/
    ├── migrations/
    │   └── 009_push_subscriptions.sql
    ├── services/
    │   └── pushService.ts
    └── routes/
        └── push.ts
```

## How to apply to mirror-server

1. **Add the dependency**

   ```bash
   cd mirror-server
   npm install web-push
   npm install --save-dev @types/web-push
   ```

2. **Generate VAPID keys (one time, ever)**

   ```bash
   npx web-push generate-vapid-keys --json
   ```

   Output looks like:

   ```json
   { "publicKey": "BEl62iUYgUivxIkv69yViEuiBIa-...", "privateKey": "Yq..." }
   ```

   Add these to `mirror-server/.env`:

   ```
   VAPID_PUBLIC_KEY=BEl62iUYgUivxIkv69yViEuiBIa-...
   VAPID_PRIVATE_KEY=Yq...
   VAPID_SUBJECT=mailto:you@example.com
   ```

   - `VAPID_PUBLIC_KEY` — base64url, ~88 chars. Safe to expose to clients.
   - `VAPID_PRIVATE_KEY` — base64url, ~43 chars. **Secret.** Never commit.
   - `VAPID_SUBJECT` — `mailto:` (or `https://`) URL the push service can
     reach you at if they need to flag abuse. Required by VAPID spec.

   These are stable for the life of the deployment. Rotating them
   invalidates every existing subscription, forcing all users to re-opt-in,
   so don't rotate casually.

3. **Run the migration**

   ```bash
   mysql -u $DB_USER -p $DB_NAME < migrations/009_push_subscriptions.sql
   ```

4. **Copy the new files**

   ```bash
   cp services/pushService.ts <mirror-server>/services/pushService.ts
   cp routes/push.ts          <mirror-server>/routes/push.ts
   ```

5. **Wire the route into `index.ts`**

   Add the import near the other route imports:

   ```ts
   import pushRoutes from './routes/push';
   ```

   Mount it alongside the other `/mirror/api/*` routes (no
   `subscriptionGate` — push opt-in should work on the free tier):

   ```ts
   APP.use('/mirror/api/push', pushRoutes);
   console.log('[ROUTES] Push routes mounted at /mirror/api/push');
   ```

6. **Restart the server**

   ```bash
   npm run rebuild && sudo pm2 reload ecosystem.config.js
   ```

7. **Verify**

   ```bash
   # Public key endpoint should return 200 with the publicKey field.
   curl https://www.theundergroundrailroad.world/mirror/api/push/vapid-public-key

   # Subscribe should return 401 without a token.
   curl -X POST https://www.theundergroundrailroad.world/mirror/api/push/subscribe \
        -H 'Content-Type: application/json' -d '{}'
   ```

## What's NOT in here yet

- **Phase 5 (frontend):** the client wiring (permission prompt, subscribe
  flow, custom SW push/notificationclick handlers) lands directly in
  `client/` on this branch — not in this folder.
- **Phase 6 (event hooks):** `pushService.send()` calls from existing
  notification triggers (TruthStream review received, dialogue reply,
  group activity, etc.) will be added as a follow-up patch under
  `server-changes/mirror-server/` once Phase 5 is verified end-to-end.
- **dina-server:** No changes required for Phase 4. If Phase 6 needs to
  push from DINA-originated events (e.g. analysis complete), a
  `server-changes/dina-server/` folder will appear at that point.

## Notes for the reviewer

- `pushService.send()` is fire-and-forget at the API layer — failures are
  logged, not thrown. Push delivery is best-effort; the in-app
  notification system remains the source of truth.
- The 410 Gone cleanup is automatic: any subscription a push service says
  is dead is soft-deleted on the next send attempt. A periodic
  `pushService.pruneExpired()` call (e.g. nightly cron) hard-deletes rows
  expired more than 30 days.
- `endpoint_hash` (SHA-256) exists because MySQL can't put a UNIQUE index
  on a TEXT column directly — and push endpoints can exceed 500 chars.
