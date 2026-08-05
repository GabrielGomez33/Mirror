# trymirror.world — front-door domain setup

Point a clean marketing domain (`trymirror.world`) at the existing landing page,
**without moving the app**. The app stays at
`https://www.theundergroundrailroad.world/Mirror/`; email stays on
`theundergroundrailroad.world` (protects the warmed reputation). This new domain
just serves the landing and proxies the waitlist API so the signup form works.

Server IP: **24.39.41.126** · Landing dir (already exists): **/var/www/marketing/mirror**

> The landing was made domain-portable in this same change: all app/icon links
> are now absolute to the app domain, so they work identically on either host.
> The waitlist form still POSTs to a relative `/mirror/api/waitlist`, which the
> vhost below proxies to mirror-server — so nothing about the working flow
> changes.

---

## Step 1 — DNS at GoDaddy

Add two records (Name = host only; GoDaddy appends the domain):

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@`   | `24.39.41.126` | default |
| A | `www` | `24.39.41.126` | default |

Wait for propagation (usually minutes). Verify from anywhere:
```bash
dig +short trymirror.world      # should print 24.39.41.126
dig +short www.trymirror.world  # should print 24.39.41.126
```

## Step 2 — temporary HTTP vhost (so Let's Encrypt can validate)

On the server, create `/etc/apache2/sites-available/trymirror.world.conf`:
```apache
<VirtualHost *:80>
    ServerName trymirror.world
    ServerAlias www.trymirror.world
    DocumentRoot /var/www/marketing/mirror
    <Directory "/var/www/marketing/mirror">
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        DirectoryIndex index.html
    </Directory>
    ErrorLog  ${APACHE_LOG_DIR}/trymirror_error.log
    CustomLog ${APACHE_LOG_DIR}/trymirror_access.log combined
</VirtualHost>
```
Enable it:
```bash
sudo a2ensite trymirror.world
sudo apache2ctl configtest && sudo systemctl reload apache2
```

## Step 3 — issue the SSL certificate

```bash
sudo certbot --apache -d trymirror.world -d www.trymirror.world
```
Certbot issues the cert and generates an SSL vhost
(`/etc/apache2/sites-available/trymirror.world-le-ssl.conf`) with an automatic
HTTP→HTTPS redirect.

> If the challenge fails because of the existing `.well-known` symlink, use the
> webroot method instead:
> `sudo certbot certonly --webroot -w /var/www/marketing/mirror -d trymirror.world -d www.trymirror.world`
> then add the SSL vhost from Step 4 manually.

## Step 4 — add the waitlist API proxy to the SSL vhost

Edit the SSL vhost certbot created
(`sudo nano /etc/apache2/sites-available/trymirror.world-le-ssl.conf`) and add
this block **inside** the `<VirtualHost *:443>` … `</VirtualHost>` (it makes the
landing's waitlist form work same-origin on the new domain):

```apache
    # Proxy ONLY the Mirror API so the landing's waitlist form posts work.
    # The app itself is NOT served here — its links point to the app domain.
    SSLProxyEngine On
    SSLProxyVerify off
    SSLProxyCheckPeerCN off
    SSLProxyCheckPeerName off
    ProxyPass        /mirror/api https://127.0.0.1:8444/mirror/api
    ProxyPassReverse /mirror/api https://127.0.0.1:8444/mirror/api
```

Then:
```bash
sudo apache2ctl configtest && sudo systemctl reload apache2
```

## Step 5 — deploy the domain-portable landing

The landing edits (absolute app links) ship with the normal landing deploy:
either merge to master (the CI copies `landing/index.html` to
`/var/www/marketing/mirror/`), or scp it manually as before. Same file serves
both domains.

## Step 6 — verify

```bash
curl -sk -o /dev/null -w '%{http_code}\n' https://trymirror.world/            # 200 (landing)
curl -sk -o /dev/null -w '%{http_code}\n' https://www.trymirror.world/        # 200
```
Then in a browser:
- `https://trymirror.world/` → the Mirror landing, padlock valid.
- Submit a test email → the waitlist form succeeds (proxied to mirror-server).
- Click any "Enter Mirror" / app button → lands on
  `https://www.theundergroundrailroad.world/Mirror/` (the app, unchanged).

## Optional — belt-and-suspenders CORS

Not required (the waitlist is proxied same-origin), but if you ever have the
landing call the API cross-origin, mirror-server now supports adding origins via
env (no code change). In mirror-server `.env`:
```
EXTRA_ALLOWED_ORIGINS=https://trymirror.world,https://www.trymirror.world
```
then restart mirror-server.

---

## What did NOT change (by design)
- The app: still at `theundergroundrailroad.world/Mirror/`, untouched, no rebuild.
- Email sending + auth (SPF/DKIM/DMARC): still on `theundergroundrailroad.world`.
- The existing site, DINA, CamBridge, admin, portfolio: all unaffected — this is
  a brand-new, isolated vhost.
