# mirror-server patches

Server-side patches that pair with landing-page work in this repo. Each
patch is a `git format-patch` bundle you apply to your local mirror-server
clone with `git am`.

Why patches instead of a PR: this Claude session only has push access to
the Mirror repo, not to `mirror-server`. Applying the patch locally lets
you keep the commit history clean on your end (author, message, and diff
all preserved).

---

## 0001-marketing-waitlist.patch — public waitlist endpoint

Adds `POST /mirror/api/waitlist` for the landing-page email form.

### What's in it

- **`migrations/018_marketing_waitlist.sql`** — `marketing_waitlist` table:
  UNIQUE email, source tag, truncated IP, bounded UA, status ENUM,
  timestamps, JSON metadata. utf8mb4, idempotent (`IF NOT EXISTS`).
- **`controllers/waitlistController.ts`** — strict email validation +
  normalisation, per-IP sliding-window rate limit (20/hour default;
  override with `WAITLIST_RATE_LIMIT`), IP truncated to /24 (v4) / /48
  (v6), bounded string lengths, DB-level dedup via
  `INSERT ... ON DUPLICATE KEY UPDATE`. Returns identical response for
  new vs. duplicate to avoid membership leaks.
- **`routes/waitlist.ts`** — thin router, no auth/subscription gate.
- **`index.ts`** — one import + one mount, placed next to the existing
  `emailPublicRoutes` in the public-routes section.

### How to apply — on your laptop, in your mirror-server clone

```bash
cd /path/to/mirror-server
git fetch origin
git checkout -b marketing-waitlist origin/master

# Copy the patch from the Mirror repo (adjust the path if your clones
# live elsewhere).
cp /path/to/Mirror/mirror-server-patches/0001-marketing-waitlist.patch .

# Apply it — this preserves the author, message, and diff as a real commit.
git am 0001-marketing-waitlist.patch

# Verify it typechecks locally.
npm ci        # or npm install, first time only
npx tsc --noEmit

# Push and open a PR (or push straight to master if that's your flow).
git push -u origin marketing-waitlist

# Clean up
rm 0001-marketing-waitlist.patch
```

If `git am` reports conflicts (unlikely — the diff only touches new files
plus two small hunks in `index.ts` near `emailPublicRoutes`), resolve them
and continue with `git add . && git am --continue`.

### After the patch is on origin/master (or whichever branch prod tracks)

1. **Run the migration on the production DB.** From the server:

   ```bash
   mysql -u <user> -p <db_name> < migrations/018_marketing_waitlist.sql
   ```

   `IF NOT EXISTS` makes it safe to run twice.

2. **Deploy the code the same way you deploy the rest of mirror-server**
   (likely `git pull && npm run rebuild && sudo pm2 reload ecosystem.config.js`,
   per the `deploy` script in `package.json`).

3. **Confirm the route is live:**

   ```bash
   curl -X POST https://www.theundergroundrailroad.world/mirror/api/waitlist \
        -H "Content-Type: application/json" \
        -d '{"email":"test+1@example.com","source":"landing"}'
   ```

   Expect: `{"success":true}` on 200. Repeat with the same email — same
   response (dedup is silent by design).

4. **Test the landing form.** Reload
   `https://www.theundergroundrailroad.world/`, submit a real email, and
   watch the network tab for a 200. Verify the row in the DB:

   ```bash
   mysql -u <user> -p <db_name> -e \
     "SELECT id, email, source, created_at FROM marketing_waitlist ORDER BY id DESC LIMIT 5;"
   ```

### Rate-limit tuning

Default is 20 signups per hour per truncated-IP window. Change with an
env var (add to your `.env` and `pm2 reload`):

```bash
WAITLIST_RATE_LIMIT=50
```

### Operational note

The waitlist endpoint is intentionally not covered by the paywall middleware
(`AuthMiddleware.subscriptionGate`) — it must always be reachable, including
by users who aren't signed in. It sits in the same public block as
`/mirror/api/email` (unsubscribe) and `/mirror/api/auth`.
