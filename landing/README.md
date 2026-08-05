# Mirror Landing — deploy notes

Single-file static site at `landing/index.html`.

- **Palette / voice** match the app (sakura pink, dark burgundy, glass panels).
- **Everything inlined** — no build step, no dependencies, no JS bundler.
- **Small** — ships in one HTTP request, ~30 KB uncompressed.
- **Icons** are pulled from the existing app path `/Mirror/favicon.svg`, so no
  new asset uploads are needed at deploy time.

---

## Server-side layout (already prepared)

You created `/var/www/marketing/mirror/`. Deploy the landing there.

```
/var/www/
├── tugrr-storage1/          ← current DocumentRoot (bare domain)
├── mirror-client/dist/      ← the PWA, served at /Mirror
├── dina-client/dist/        ← DINA SPA, served at /dina
└── marketing/
    └── mirror/              ← NEW — put landing/index.html here
```

## Deploy — one command from your laptop

From the repo root:

```bash
scp landing/index.html \
    administrator@tugrr-portal:/var/www/marketing/mirror/index.html
```

That's the whole deploy. No build step, no restart.

---

## Apache change — point the domain root at the Mirror landing

Decision: `theundergroundrailroad.world/` will serve the Mirror landing.
The old files under `/var/www/tugrr-storage1/` stay on disk and remain
reachable via an explicit `/storage` alias — nothing gets deleted.

### The patch (edit `/etc/apache2/sites-available/theundergroundrailroad.world.conf`)

**1.** Change the `DocumentRoot` line at the top of the `<VirtualHost *:443>`
block:

```apache
# BEFORE
DocumentRoot /var/www/tugrr-storage1

# AFTER
DocumentRoot /var/www/marketing/mirror
```

**2.** Add a `<Directory>` block for the new root, and keep the old files
reachable at `/storage`. Put both blocks in the `# STATIC FILES` section,
ideally right above the existing `Alias "/admin" ...` block:

```apache
# Marketing landing (bare domain root)
<Directory "/var/www/marketing/mirror">
    Options -Indexes +FollowSymLinks
    AllowOverride All
    Require all granted
    DirectoryIndex index.html
</Directory>

# Preserve access to the old root contents at /storage
Alias "/storage" "/var/www/tugrr-storage1"
<Directory "/var/www/tugrr-storage1">
    Options -Indexes +FollowSymLinks
    AllowOverride All
    Require all granted
</Directory>
```

That's it. Every existing `Alias` (`/Mirror`, `/dina`, `/cambridge`,
`/GabrielGomez`, `/admin`) is a more specific path than `/`, so they all
keep working untouched. Every existing `ProxyPass` (`/mirror`, `/dina/api`,
`/admin/api`, `/GabrielGomez/api`, `/cambridge/api`) is also more specific,
so the API surface is untouched.

### Sanity check + reload

```bash
sudo apache2ctl configtest         # expect: Syntax OK
sudo systemctl reload apache2      # zero-downtime reload
```

Then visit `https://theundergroundrailroad.world/` — you should see the
Mirror landing. Visit `https://theundergroundrailroad.world/Mirror/` — the
PWA still loads. Visit `https://theundergroundrailroad.world/storage/` — the
old files still reachable.

### If anything at the old root was referenced by an absolute path

Common gotchas: `/robots.txt`, `/sitemap.xml`, `/favicon.ico`,
`/.well-known/*` (Let's Encrypt uses this). Check with:

```bash
ls /var/www/tugrr-storage1/ | head
ls -la /var/www/tugrr-storage1/.well-known 2>/dev/null
```

If any of those exist and matter, symlink them into the new root:

```bash
sudo ln -s /var/www/tugrr-storage1/.well-known /var/www/marketing/mirror/.well-known
sudo ln -s /var/www/tugrr-storage1/robots.txt   /var/www/marketing/mirror/robots.txt 2>/dev/null || true
```

(The `.well-known` symlink in particular is important — Let's Encrypt
renewal writes to it.)

---

## After you edit the vhost

```bash
sudo apache2ctl configtest
sudo systemctl reload apache2
```

Then visit whichever URL matches the option you picked. Hit refresh with
DevTools open to confirm no 404s in the network tab.

---

## The waitlist form

The landing has an email form that POSTs to `/mirror/api/waitlist`. That
endpoint **does not exist yet** on `mirror-server`. Two ways to handle it:

1. **Ship the landing now.** The form is written to fail gracefully — it
   shows "You're on the list" on a 404 so users don't see an error while we
   wire the backend. Emails aren't captured until we add the endpoint. Fine
   for week 1; unacceptable for week 2.
2. **Wire the endpoint first.** Small addition to `mirror-server`:
   - New migration `018_marketing_waitlist.sql` with a `waitlist(email,
     source, created_at, ip, ua)` table.
   - New `routes/marketing.ts` with `POST /waitlist` (rate-limited,
     email-validated, dedup on email).
   - Mount under `/mirror/api/waitlist` in `index.ts`.
   - CORS already allows the domain — no change needed there.

Say the word and I'll open a PR on `mirror-server` for #2. It's ~80 lines.

---

## Later — bake into CI

Once the vhost is settled, extend `.github/workflows/ci-cd.yml` with a
`landing-deploy` job that only fires when `landing/**` changes:

```yaml
landing-deploy:
  needs: quality
  if: contains(github.event.head_commit.modified, 'landing/')
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Deploy landing
      run: |
        echo "${{ secrets.SERVER_SSH_KEY }}" > ~/.ssh/deploy_key
        chmod 600 ~/.ssh/deploy_key
        scp -i ~/.ssh/deploy_key -o StrictHostKeyChecking=no \
          landing/index.html \
          administrator@tugrr-portal:/var/www/marketing/mirror/index.html
```

Don't add this until you've deployed by hand at least once and confirmed the
URL you want.

---

## Editing copy

The whole page is one HTML file with inlined CSS. To change hero copy,
pricing, FAQ, or the founder note, just edit `landing/index.html` in the
appropriate section — every block is labeled with a semantic tag or a
comment.

To add a screenshot section later, drop images into `landing/img/` and add
`<img src="img/mymirror.png" ...>` — nothing else needed. The Apache alias
serves the whole directory.
