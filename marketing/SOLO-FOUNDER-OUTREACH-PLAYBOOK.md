# Mirror — Solo Founder Outreach Playbook

> Companion to `MIRROR-MARKETING-BRIEF.md`. This one is operational: what
> to spend, what to say, who to say it to, when to say it, and what parts
> of this Claude can actually run for you.
>
> Constraints assumed:
> - Solo operator (you).
> - $150 / month all-in marketing budget.
> - ElevenLabs Creative Suite already planned (voice + video).
> - Live product at `theundergroundrailroad.world/Mirror/`.
> - Goal: take it as far as possible solo, then outsource.

---

## 1. $150/month budget — where every dollar goes

Ranked by return-per-dollar for a solo operator selling a $9.99/mo B2C
product. Numbers are what they cost at the entry tier as of publish;
verify at signup.

| Line | Monthly | What it does |
|---|---|---|
| ElevenLabs Creator (voice + basic video) | ~$22 | Voiceovers for TikTok/Reels/YouTube Shorts. If you need higher usage go to Pro (~$99) but only if you're shipping 5+ videos/week. |
| Buffer / Publer free tier | $0 | Schedule 3 platforms, 10 posts each. Do NOT pay for a scheduler until organic is working. |
| Canva Pro | ~$15 | Templates, brand kit, batch resize, magic resize for cross-post. One reusable investment. |
| A domain for the marketing site (`getmirror.app` or similar) | ~$1–2 amortized | See §7. Point it at a one-page landing hosted free on GitHub Pages / Cloudflare Pages. |
| Notion free / Google Sheets | $0 | Your CRM until you have >200 leads. |
| Cold email tool — **Instantly.ai starter** or **Smartlead** | ~$37–50 | Actually deliverable cold email. Do NOT use Gmail-only for cold. Warmup + rotation matters. |
| Boosting winners on Reels/TikTok | ~$20–30 | Only boost a post *after* it has organic traction (>3% CTR, >2s avg watch time). Never pre-boost. |
| Small reserve for tools you'll discover | ~$10 | Screenshot tool, transcription, etc. |
| **Total** | **~$105–160** | |

If you pick ElevenLabs Pro instead of Creator, cut Instantly to the
free-plan warmup + do outreach manually the first 60 days.

**Rule:** No paid ads (Meta/TikTok Ads Manager) until you have a landing
page with a conversion event, a Meta pixel, and at least one organic
post pulling >5% CTR. Paid amplifies what's working; it doesn't
manufacture it.

---

## 2. What I (Claude) can automate for you, honestly

Set expectations first so you plan around real capability.

### I can (and should) do
- **Write batch content** — 30 TikTok scripts, 30 IG captions, 30
  LinkedIn posts, 30 tweets in one pass from one brief. Ship weekly.
- **Draft outreach at scale** — cold emails, DM openers, follow-ups,
  break-up emails, all personalized by segment.
- **Write phone scripts** — cold, warm, referral, discovery, close.
- **Build lightweight tools inside this repo** — a CSV → personalized-email
  generator, a lead-scoring script, a content calendar generator, a
  post-frequency tracker. All run locally on your machine.
- **Set up scheduled Claude "Routines"** that fire back into this
  session on a schedule — e.g., every Monday at 9am, "generate this
  week's content." Real, not aspirational. See §10.
- **Review analytics you paste in** — read a CSV export from
  TikTok/IG/Buffer/Instantly and tell you what to double down on.
- **Draft press pitches** — one per outlet, personalized to the beat.
- **Build a marketing site** — write the HTML/CSS/JS for a one-pager,
  push it to a `marketing-site` branch, and you deploy it via
  Cloudflare Pages or GitHub Pages.
- **Write GitHub Actions** for content-pipeline automation (e.g., a
  cron that opens a new content-brief issue every Monday).

### I cannot
- **Log into your social accounts and post for you.** No shared
  credentials, no browser session. You (or Buffer) hit publish.
- **Make phone calls.** Ever. You call. I write the script.
- **Run 24/7 in the background.** I only run when a session is active
  or when a Routine wakes one up.
- **DM real users on your behalf.** Same reason as posting.
- **Guarantee deliverability** for cold email — that's a function of
  domain warmup, list quality, and inbox provider, not me.
- **Manage paid ads campaigns** — no ads-manager access. I can draft
  the creative brief and target-audience spec; you set the campaign.

### The realistic division of labor
- **You:** camera, voice on calls (Eleven for VO where camera isn't
  needed), physical publishing, PayPal/analytics setup, relationship
  building, replies to comments/DMs, phone calls.
- **Me:** batch writing, script drafting, CRM template, content
  calendar, weekly analysis, marketing site copy, cold-email
  sequences, scheduled prompts to keep you on cadence.

---

## 3. The ICP list — who to actually call and DM

Focus on the two audiences with the **shortest path to first paying
users**: therapists/coaches (they refer 5–50 clients each) and
astrology/self-development creators (they reach thousands per post).
Everything else is a slower loop.

### Tier A — call these (highest LTV, warm intent)

1. **Licensed therapists (LMFTs, LCSWs, PsyDs) in private practice.**
   Solo or 2–3 person practices. They Google their own name, they
   pick up the phone. Positioning: *"complementary between-session
   tool for your clients."*
2. **Executive & life coaches** — ICF-credentialed or with a real
   website. Positioning: *"a client-facing personality + reflection
   system so you don't have to build one."*
3. **Retreat organizers** — silent retreats, women's/men's circles,
   couples' retreats. Positioning: *"pre-retreat intake + post-retreat
   integration tool."*
4. **Small yoga / meditation studios** with a coaching arm.
   Positioning: *"a member benefit that makes your community stickier."*
5. **Small university counseling / wellness centers** (community
   colleges especially, faster procurement). Positioning: *"student
   self-reflection with no PHI liability — data lives on the phone."*
6. **HR at 20–200-person companies** doing wellness stipends.
   Positioning: *"a $10 monthly wellness benefit employees actually
   use."*
7. **Small-group leaders** — Bible studies, AA sponsors, book clubs,
   masterminds. Positioning: *"shared profiles + group voting + group
   AI."*
8. **Podcast hosts** in self-development, relationships, astrology,
   psychology. Positioning: *"guest founder story + free codes for
   your listeners."*

### Tier B — DM these, don't call (creator economy)

9. Astrology creators on TikTok/IG (50k–500k followers, mid-tier is
   the sweet spot).
10. MBTI / personality-typology creators.
11. Couples' therapy / relationship creators.
12. "Anti-hustle" / slow-living creators (aesthetic match with sakura
    brand).
13. Journal + reflection creators.
14. African diaspora spiritual & wellness creators (the Orisha
    integration is a rare, defensible hook).

### Tier C — email these (long tail)

15. Newsletter operators (Substack self-development, applied
    psychology, astrology).
16. Small podcast networks.
17. College clubs (Greek life, wellness clubs, philosophy societies).
18. Independent bookstores that do book clubs.

---

## 4. Phone scripts — read these out loud

Copy-paste. Do not improve them until you've run each 25 times.
The goal of every first call is one of: (a) email to send a demo,
(b) a 15-minute follow-up, (c) a "no." Fast nos are wins.

### 4.1 Cold call — Therapist / Coach

> Hi, is this [name]? — Hey [name], my name is Gabriel, I'm the
> founder of Mirror. It's a personal intelligence app my clients —
> sorry, my *users* — use between sessions with people like you.
>
> I'm calling therapists in [city] this week for feedback, not to
> sell you anything. Do you have 90 seconds?
>
> *[wait for yes]*
>
> Mirror is a phone app your clients can use to journal daily with
> real emotion tracking, take a full personality and reflection
> intake, and get anonymous feedback from other users about how
> they come across. The angle is: it gives your clients structure
> between the times they see you, and it gives you a shared
> reference point when they come in.
>
> Two questions. One — does that sound like something you'd want to
> look at? And two — if I gave you a lifetime free Premium account
> to evaluate, what's the best email to send that to?
>
> *[capture email, confirm spelling, tell them you'll follow up
> next week to hear what they thought.]*

Time on call: 60–90 seconds. Success = email captured.

### 4.2 Cold call — Retreat organizer

> Hi, is this [name]? Hi [name], I'm Gabriel, founder of Mirror.
> I saw you run [retreat name] — the one in [month/place]. Quick
> question, not a sales call: do your attendees currently do any
> intake or integration between the time they book and the time
> they show up?
>
> *[listen]*
>
> Reason I ask — I built a personal reflection app that a few
> retreat leaders have started using as a pre-retreat prep and
> post-retreat integration tool. It captures a personality and
> emotional baseline before, and gives them a way to journal and
> get grounded after. I'd love to send you a free founder's account
> so you can look at it. Would that be useful?

Time on call: 90–120 seconds.

### 4.3 Cold call — HR / people ops, small company

> Hi, is this [name]? Hey [name], I'm Gabriel, founder of a small
> wellness product called Mirror. I'm calling because we're pricing
> a team plan and I only need to talk to 8 people. Is that you?
>
> *[if not, ask who and get referred out]*
>
> Very quick — Mirror is $10 per employee per month. What people
> get is a personal reflection dashboard, private journaling, and
> the option to form small anonymous feedback groups inside the
> company. It's not a mental health tool, it's a self-awareness
> one, so there's no PHI liability for you.
>
> I'll send you a one-pager if it's interesting. Best email?

### 4.4 Podcast pitch — voicemail-safe

> Hi [name], this is Gabriel — I'm the founder of Mirror, the app
> that gives you a perception-gap score based on anonymous peer
> reviews of your personality. I've been a listener of [show
> name] since [episode] and I think your audience would like the
> story of why we built our own AI to do this. I'll follow up by
> email, but if you want to skip the queue, my number is [your callback number].
> Thanks for the show.

### 4.5 The "warm intro" call — after email reply

> Hey [name], thanks for getting back to me. You mentioned you
> looked at the intake — what did you think?
>
> *[shut up. let them talk. take notes.]*
>
> Great, that's really useful. Two things I want to leave you
> with. One, if this fits your practice, I'll set you up with a
> referral link so you can pass Premium codes to five clients to
> start. Two, is there anyone else in your network — another
> therapist, a coach, a group leader — who'd want to hear about
> this? A one-sentence intro from you is worth 50 of my cold calls.

### 4.6 The break-up call (or email) — after 3 tries no reply

> Hey [name] — closing the loop on this, I don't want to be a pest.
> If it's not a fit right now, totally fair, and I'd love to know
> what would have made it a fit. Two lines back is enough. Either
> way, I'll leave you alone after this. Thanks for the time.

Break-up messages have the highest reply rate of any cold sequence.
Send them.

---

## 5. Attention-grabbing hooks — for every platform

These are the *first sentence* of a video, DM, or email. Steal any of
them. Rotate through them to see which converts.

### For therapists / coaches
- "You already know your clients better than anyone. Mirror gives
  them a way to know themselves."
- "What if your clients showed up already halfway through the
  session?"
- "Between-session homework, without the awkward homework."
- "A quantified perception-gap score. Ready-made for the third
  session."

### For creators (DM openers)
- "Your last [post about X] is exactly what our app is trying to
  do. Wondering if I can send you a founder account."
- "You're one of maybe five people online explaining African
  astrology at this level. We built something you should look at."
- "Not a bot. Founder of a small app, sakura-aesthetic, no ads.
  30-second demo?"

### For B2C consumers (video / post hooks)
- "You've taken the personality test. Now find out what other
  people actually see."
- "Five strangers are about to tell you the truth."
- "This app measures how accurately you see yourself."
- "Your natal chart and your Big Five, in the same sentence."
- "Anonymous peer review, for you as a person."
- "I let five strangers rate my personality. Here's the perception
  gap."
- "My therapist recommended this. My ex agreed with the reviews."
- "The app is 3MB. It reads your emotions. The camera data never
  leaves your phone."

### For press
- "The startup that built its own AI just to grade how well you
  know yourself."
- "Anonymous peer review goes consumer."
- "This app runs face-emotion detection entirely on-device — no
  image ever leaves the phone."

### For podcasts / long-form
- "We built the first consumer 360 review."
- "Western psychology, Chinese astrology, and West African Orisha
  tradition, in one product. Here's why."
- "I'm the founder of Mirror. I'm going to tell you the number
  I'm most afraid of — my perception gap score."

---

## 6. The daily plan (Monday–Friday, ~3.5 hours/day)

Written to be sustainable, not heroic. If you can only do 2 of the 4
blocks in a day, always do Block 2 (outreach) and Block 4 (replies).

### Block 1 — Content creation (60 min, 9–10 AM)
- Ship 1 short-form video (TikTok/Reels/Shorts, one shoot → three
  crops).
- Ship 1 platform-native post (LinkedIn or Twitter).
- Queue tomorrow's post in Buffer.
- ElevenLabs VO for any B-roll videos.

Weekly cadence: 5 videos, 5 LinkedIn posts, 5 tweets/threads.
Batch on Sunday if you can — see §8.

### Block 2 — Outreach (60 min, 10–11 AM)
Choose ONE of these each day so you don't context-switch:
- **Mon:** 5 therapist calls + 10 therapist DMs.
- **Tue:** 5 coach calls + 10 creator DMs.
- **Wed:** 10 cold emails (Instantly) + 5 podcast pitches.
- **Thu:** 5 retreat calls + 10 group-facilitator DMs.
- **Fri:** Follow-ups only. Everyone who didn't reply Mon–Thu.

Weekly total: ~50 outbound touches. Realistic reply rate 5–10%.
So 3–5 conversations booked per week.

### Block 3 — Discovery calls & demos (60 min, 2–3 PM)
- 3–4 x 15-minute Zoom/phone demos.
- 15-minute buffer between calls.
- Record if the person consents — you'll use the good clips as
  testimonials.
- Immediately after each call: log in Notion, send the follow-up
  within 20 minutes.

### Block 4 — Community engagement (30 min, 6–6:30 PM)
- Reply to every DM and comment on your posts.
- Leave 10 substantive comments on other creators' posts in your
  niche (astrology, MBTI, relationships, therapy-adjacent).
- Answer one Reddit thread (r/therapy, r/MBTI, r/astrology,
  r/decidingtobebetter, r/socialskills).
- Update the CRM.

### Saturday (2 hours)
- Batch record 5 videos for next week.
- Write 5 LinkedIn posts.
- Reset outreach lists.

### Sunday (1 hour, optional)
- Read one competitor's app end-to-end. Steal one idea. Ship the
  observation as a Monday post.

---

## 7. The one-page marketing site (do this in week 1)

Right now you have a live app but no marketing page separate from the
app. Every ad, every DM, every press pitch needs a shareable URL that
loads in <1 second and describes the product in 8 seconds. Options:

- **Cheapest:** GitHub Pages on a subdomain. Free.
- **Best:** Cloudflare Pages. Free. Custom domain. Analytics included.

**Content the page must have** (in this order):

1. Hero: the tagline `See yourself in the world, and the world in
   you.` + the tagline `Personal intelligence for reflection, peer
   review, and collective insight.` + a "Try Mirror Free" button
   → `theundergroundrailroad.world/Mirror/`.
2. Three-panel: See yourself / Be seen / See together.
3. Screenshots — MyMirror, TruthStream analysis, a group chat.
4. Privacy line — "Face detection runs entirely on your device.
   Peer reviews are anonymous. You control what you share."
5. Pricing — Free with limits / Premium $9.99 with 7-day trial.
6. Founder note (1 paragraph, human voice).
7. FAQ (5 questions).
8. Contact — your email.

I can write the HTML/CSS for this. Ask me.

---

## 8. Content pipeline — how to keep the tank full

Solo operators lose the marketing game because the content well runs
dry, not because the ideas were bad.

### The 1 → 3 → 9 rule
- **1** long-form piece per week (a 5-minute video, a 1000-word
  essay, or a podcast interview).
- Cut it into **3** medium pieces (LinkedIn post, Twitter thread,
  Substack).
- Slice into **9** shorts (TikTok/Reels/Shorts + IG carousels).

One shoot per week = ~15 pieces of content on the calendar.

### The evergreen buckets — rotate every week
1. **The perception-gap show-and-tell.** You take a review cycle
   yourself, share the score, react.
2. **A single personality × astrology combo.** e.g., "INTJ Scorpio
   moon, what to do about it."
3. **A group story.** (Get consent.) How a real couple/team used
   MirrorGroups.
4. **A privacy / on-device-ML explainer.** Short. Nerdy is fine.
5. **The founder story.** Why you built it. Repeat every 4–6 weeks
   with new angles.

### The prompt I want you to send me every Monday morning
Say to me:
> "Weekly content batch. This week's theme: [X]. Give me 5 TikTok
> scripts (each 45 sec), 5 LinkedIn posts (200 words), 5 tweets,
> and 3 IG carousel outlines. Voice: calm, direct, no hustle."

I'll ship the batch in one turn. You record and publish.

---

## 9. CRM & pipeline — free Notion / Sheets, 5 columns only

Do not overengineer this. Five columns:

| Name | Segment | Last touch | Next action | Status |
|---|---|---|---|---|

Statuses: `new / contacted / replied / demo booked / active user / paying / dead`.

That's it. Every Friday, sort by `Next action` and reset for next week.

When you cross ~200 leads, ask me to migrate you to Airtable and I'll
build the schema.

---

## 10. Scheduled Claude Routines — real automation you can turn on

Claude can schedule work that fires back into this conversation. Real
uses for you:

- **Monday 9:00 AM** — "It's Monday. Ask me for this week's theme,
  then generate the weekly content batch (5 TikToks, 5 LinkedIns,
  5 tweets, 3 carousels)."
- **Thursday 5:00 PM** — "It's Thursday. Draft the Friday
  follow-up sequence for everyone I've contacted this week. Ask
  me for the list first."
- **Sunday 6:00 PM** — "It's Sunday. Generate 10 hook
  variations for next week's videos based on the top-performing
  posts. Ask me for what performed."
- **1st of the month** — "First of the month. Ask for last
  month's numbers (signups, trials, paying, top posts) and write
  a monthly retrospective + recommendations."

Say the word and I'll set these up. They're not magic — they're
persistent scheduled prompts — but they solve the *"I forgot to
do the batch this week"* problem, which is what kills solo
marketing.

---

## 11. Week 1 sprint — what to do in the next 7 days

Copy this to a note. Check off as you go.

**Day 1 (Mon)**
- Register `getmirror.app` or a similar clean domain.
- Ask me to write the one-pager. Deploy it to Cloudflare Pages.
- Create Buffer / Publer account (free plan).
- Create Notion CRM with the 5 columns above.

**Day 2 (Tue)**
- Set up ElevenLabs.
- Batch-record 5 videos (30–60 sec each) using scripts I give you.
- Set up an Instantly.ai account and warm your sending domain.
- Build first 50-lead therapist list (Psychology Today directory,
  filter by city + private practice).

**Day 3 (Wed)**
- First 5 therapist calls (script §4.1).
- 10 DMs to astrology creators (script §4 open lines).
- Ship 1st TikTok + 1st LinkedIn post.

**Day 4 (Thu)**
- 5 more therapist calls.
- Send 20-lead cold email batch from Instantly.
- Ship 2nd TikTok + 2nd LinkedIn post.

**Day 5 (Fri)**
- Follow-up day.
- Any demos booked → hold them.
- Ship 3rd TikTok.
- Write the week's retrospective in Notion: what got replies, what
  died, what to try next week.

**Weekend**
- Batch-record next week's 5 videos.
- Ask me for the next content batch.
- Sleep.

---

## 12. Metrics that actually matter (only track these)

Ignore vanity metrics for the first 90 days. Track these six weekly:

1. **Outreach touches sent** (target: 50/week).
2. **Replies received** (target: 5–8/week = 10–15% rate).
3. **Demos / discovery calls held** (target: 3–5/week).
4. **New signups on the app** (target: 20/week by week 6).
5. **Free-trial starts** (target: 5/week by week 8).
6. **Paying users at end of the month** (target: 5 by end of
   month 1, 20 by end of month 2, 50 by end of month 3).

If you hit those, you're at $500 MRR by month 3 on a $150 budget.
That's the frame for the "when do I outsource" question.

---

## 13. When to outsource, and what to hand off first

Outsource in this order — do not front-load it.

- **At $500 MRR:** hire a part-time video editor on Upwork ($200–400/mo)
  to cut your batch shoots into 15 pieces of content instead of you
  doing it. Buys back 6 hours/week.
- **At $1,500 MRR:** hire a lead-list VA ($200–300/mo) to build the
  therapist / coach lists you're currently building by hand.
- **At $3,000 MRR:** hire a part-time SDR ($800–1,200/mo) to run cold
  email and book your calendar. You stay on the calls.
- **At $5,000 MRR:** first ad spend at scale. Hire a paid-media
  freelancer at ~10% of ad spend.
- **At $10,000 MRR:** first full-time hire. Growth generalist.

Everything before $500 MRR is you. Sorry.

---

## 14. What to ask me for, when

Ready-made prompts to paste at me. Copy them.

- **Weekly content batch:** *"Weekly content batch for [theme].
  5 TikToks, 5 LinkedIns, 5 tweets, 3 IG carousels. Voice: calm,
  direct, no hustle."*
- **Segmented cold email sequence:** *"5-touch cold email sequence
  for [therapists / retreat leaders / coaches / HR at 50-person
  cos]. Personalize by [first name / city / niche]."*
- **Discovery call agenda:** *"15-minute discovery call agenda for
  a [therapist]. Include the two questions I need to answer to
  qualify them."*
- **Objection handlers:** *"5 objection handlers for '[the exact
  thing they said]'."*
- **Press pitch:** *"Press pitch to [outlet] for the [privacy
  angle / African astrology angle / consumer-360 angle] story.
  Under 200 words."*
- **Analytics review:** paste a CSV. *"What are the three things
  I should change next week?"*
- **Marketing-site copy update:** *"Rewrite the hero section given
  this feedback: [X]."*

If a prompt gets used more than 3 times, ask me to turn it into a
Routine.

---

## 15. The honest bottom line

You have a real product. The unfair advantages are: on-device face
ML, anonymous peer review with a quantified score, your own AI
orchestration layer, and a visual identity nothing in the category
matches. Those get you press and creator interest for free.

The thing that will kill this is not the budget. It's the daily
consistency. The plan above is designed so that the *worst* week you
have — the one where you only do outreach and replies — still moves
the needle.

Do §11 this week. Come back Friday. We'll adjust from there.
