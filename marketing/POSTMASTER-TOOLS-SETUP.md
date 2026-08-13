# Google Postmaster Tools — setup & what to watch

Postmaster Tools is Google's free dashboard showing how Gmail treats your mail:
spam rate, domain/IP reputation, authentication pass rates, and delivery errors.
Now that SPF/DKIM/DMARC pass and you're starting real sends, this is your
early-warning system. ~10 min to set up; data appears within ~48 hours.

Monitor **both** sending domains now that each sends real mail:
- `theundergroundrailroad.world` — app/transactional + the bulk campaign engine.
- `trymirror.world` — your 1:1 outreach mailbox (`gabrielgomez@trymirror.world`,
  Zoho Mail). Add this one too; see `ZOHO-MAIL-SETUP.md`.

Repeat the steps below once per domain (add each separately in Postmaster Tools).

---

## Step 1 — add the domain

1. Go to **postmaster.google.com** and sign in with your Google account.
2. Click the **+** (add domain) and enter: `theundergroundrailroad.world`
   (the bare domain — not a subdomain, not the app path).
3. Google shows a **TXT verification record**. Copy it.

## Step 2 — verify ownership in GoDaddy

Same place you added SPF/DKIM/DMARC:
1. GoDaddy → your domain → **DNS** → **Add New Record**.
2. **Type:** `TXT` · **Name:** `@` (or exactly what Google specifies) ·
   **Value:** the string Google gave you · **TTL:** default.
3. Save. Back in Postmaster Tools, click **Verify** (can take a few minutes; if
   it fails, wait for DNS propagation and retry).

> If you already have DMARC aggregate reports (`rua=`) pointing somewhere, this
> is complementary — Postmaster is Gmail-specific and more actionable.

## Step 3 — wait ~48h, then read these dashboards

Data only populates once you've sent a meaningful volume to Gmail, so it fills
in as your waitlist/launch sends go out. Then check weekly:

| Dashboard | What good looks like | Act if… |
|---|---|---|
| **Spam rate** | **< 0.10%** | It approaches **0.30%** → stop, review content/list; you're mailing people who don't want it. This is the single most important number. |
| **Domain reputation** | High / Medium | Drops to Low/Bad → pause sends, check for spam complaints, slow down. |
| **IP reputation** | High / Medium | Low → likely a shared-IP issue on the provider (Resend/SES) side. |
| **Authentication** | ~100% SPF, DKIM, DMARC pass | Any dips → a config regression; re-check DNS. |
| **Delivery errors** | ~0% | Spikes → bounces/blocks; read the error, reduce volume. |

---

## The rules that keep you green (from Gmail's guidelines)

- **Spam rate < 0.10%, never near 0.30%.** One bad blast can dent reputation for
  weeks. Only mail people who opted in — which is exactly why the waitlist
  (double opt-in) and registered users are your only audiences.
- **Warm up slowly.** Don't jump from 5 emails to 5,000. Ramp volume gradually;
  send at a steady cadence, not in bursts.
- **Engagement repairs reputation.** Opens and "not spam" clicks teach Gmail you
  are wanted. Your warm waitlist (people who asked) will do this for you — send
  to them first, before any colder segment.
- **Keep one-click unsubscribe working** (already in the campaign engine) and
  honor it instantly (the suppression list already does).

---

## Quick monthly ritual (5 min)

1. Open Postmaster Tools → glance at **spam rate** and **reputation**.
2. If spam rate crept up, look at what you last sent and to whom.
3. Cross-check the Admin campaign history: which sends had the best delivery.
4. Keep sending consistently to engaged people. Consistency + engagement is the
   whole game now that authentication is solved.
