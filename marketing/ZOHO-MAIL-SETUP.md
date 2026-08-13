# Zoho Mail — setup, verify & first sends

Your outreach mailbox: **`gabrielgomez@trymirror.world`** (Zoho Mail).

Zoho auto-configured the DNS records in GoDaddy for you, so the heavy lifting is
done. This doc is the short checklist to (1) confirm the records are live and
correct, (2) prove your mail authenticates, (3) set your signature, and
(4) warm up the domain so you land in the inbox, not spam.

> **What this mailbox is for:** personal, **1:1** outreach — you typing in Zoho's
> webmail or phone app, one prospect at a time, expecting a reply. It is **not**
> the bulk campaign engine (that stays on `theundergroundrailroad.world` for
> opted-in users/waitlist only). Keeping the two domains separate protects both
> reputations.

---

## Step 1 — Confirm the mailbox is active

1. Sign in at **mail.zoho.com** with `gabrielgomez@trymirror.world`.
2. In the Zoho **Admin Console** (admin.zoho.com) → **Domains** → `trymirror.world`,
   confirm the domain shows **Verified** and the mailbox is **Active**.
3. Send yourself a test from the webmail to a personal Gmail — confirm it arrives.

---

## Step 2 — Verify the auto-added DNS is live & correct

Zoho added these in GoDaddy automatically. Confirm they're present and propagated
(Admin Console usually shows a green check next to each; you can double-check
externally at **mxtoolbox.com** or with `dig`). Expected shape:

| Record | Expected value |
|---|---|
| **MX** | `mx.zoho.com` (pri 10), `mx2.zoho.com` (20), `mx3.zoho.com` (50) |
| **SPF** (TXT `@`) | `v=spf1 include:zoho.com ~all` *(some regions: `include:zohomail.com`)* |
| **DKIM** (TXT, Zoho's selector) | Shows **DKIM active / verified** in Admin Console → Email Config → DKIM |
| **DMARC** (TXT `_dmarc`) | `v=DMARC1; p=none; rua=mailto:gabrielgomez@trymirror.world` |

Quick external checks:
```
dig +short MX trymirror.world
dig +short TXT trymirror.world           # look for the v=spf1 line
dig +short TXT _dmarc.trymirror.world    # look for the v=DMARC1 line
```
If DKIM shows inactive in the console, click **Enable/Verify** there — it just
means the record hasn't propagated yet; wait and retry.

> These are new **mail** records (MX/TXT). They do **not** touch the A/CNAME
> records serving your landing page, so the site is unaffected.

---

## Step 3 — Prove your mail authenticates (do this before real outreach)

1. Go to **mail-tester.com**, copy the address it gives you.
2. From Zoho webmail, send a normal-looking email to that address (subject +
   a few sentences, like a real outreach note).
3. Check the score — aim for **9–10/10**. It confirms **SPF, DKIM, and DMARC all
   pass** and flags anything off.

Alternative: send to a Gmail account → open it → **⋮ → Show original** → confirm
`SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`.

Don't start real outreach until this passes.

---

## Step 4 — Set your signature in Zoho

Zoho webmail → **Settings (gear) → Mail → Signatures → New**. Paste:

```
Gabriel Gomez
Founder, Mirror
trymirror.world

Mirror is a personal-intelligence app — a private mirror for how you think.
```

Set it to auto-append on new mail and replies. Keep it plain text-ish (no heavy
images/logos — image-only signatures hurt deliverability on cold sends).

---

## Step 5 — Warm up the domain (this is the part people skip and regret)

`trymirror.world` has **never sent email before**, so it has zero sending
reputation. If you blast 40 emails on day one, mailbox providers read it as spam.
Ramp up over the first few weeks, sending **real, personalized 1:1 notes** that
earn replies (replies are the strongest trust signal there is):

| Week | Emails/day | Send to |
|---|---|---|
| 1 | **5–10** | Your warmest, most likely-to-reply contacts first |
| 2 | 15–20 | Continue warm segments |
| 3 | 25–30 | Broader list |
| 4 | up to ~40 | Full daily cadence from the planner |

Rules while warming:
- **Personalize every one** — name something specific about them (see the
  outreach playbook). Identical mail-merge text is what gets flagged.
- **Send in a steady trickle**, not one big burst at 9am.
- **Reply to replies fast.** Engagement (opens, replies, "not spam") repairs and
  builds reputation.

---

## Step 6 — Stay compliant (keeps you legal *and* out of spam)

Every outreach email should:
- **Come from your real identity** — it already does (real name, real address).
- **Have a truthful subject** — no bait-and-switch.
- **Include a physical mailing address** in the footer (CAN-SPAM requires it —
  a business address or registered-agent address is fine).
- **Offer an easy opt-out** — one line at the bottom, e.g.
  *"Reply 'no thanks' and I won't write again."* Honor it immediately.
- **Target US business contacts.** Keep cold outreach to the US — Canada (CASL)
  and the EU/UK (GDPR) require prior consent.

This is general guidance, not legal advice — but following it keeps you well
inside CAN-SPAM for US B2B outreach.

---

## Step 7 — Monitor deliverability

Now that `trymirror.world` **sends** mail, add it to **Google Postmaster Tools**
too (same steps as in `POSTMASTER-TOOLS-SETUP.md`, just for this domain) so you
get an early warning if spam rate or reputation slips. Watch the same numbers:
spam rate **< 0.10%**, reputation High/Medium, auth ~100% pass.

---

## Daily workflow (once warmed up)

1. Open Zoho webmail (or the Zoho Mail app on your phone).
2. Work the day's list from `MONTH-1-OUTREACH-PLANNER.md` — one personalized
   email at a time.
3. Log sends/replies in `partner-outreach-tracker.csv`.
4. Anyone who says no → stop, and don't write them again.

That's it. A real inbox, sending like a human, warmed up and authenticated —
which is exactly how you land in the inbox and stay legal.
