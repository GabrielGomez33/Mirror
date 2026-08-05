# Mirror — Marketing & Outreach Brief

> Source-of-truth document for the B2C marketing team. All claims below are
> derived from the live codebases at:
> - Client (PWA): `github.com/GabrielGomez33/Mirror`
> - Backend API: `github.com/GabrielGomez33/mirror-server`
> - AI coordinator: `github.com/GabrielGomez33/dina-server`
>
> Live deployment: `https://www.theundergroundrailroad.world/Mirror/`

---

## 1. Product, In One Paragraph

Mirror is a **personal intelligence platform** that helps a person see
themselves from the inside, from the outside, and through the eyes of a
trusted circle. A new user completes a multi-modal intake — personality
science, cognitive assessment, on-device facial & vocal capture, astrology
& numerology, and emotional reflection — and Mirror synthesizes the result
into a living dashboard ("MyMirror") powered by an AI called **Dina**.
From there, the user can journal privately ("MyJournal"), request
anonymous peer feedback that quantifies the gap between how they see
themselves and how others see them ("TruthStream"), and form small
collective groups with shared profiles, group chat, voting, and Dina
coaching ("MirrorGroups"). It runs as an installable PWA on phone,
tablet, and desktop, works offline, and processes facial analysis
entirely on-device.

**Tagline (from the product itself):** *"See yourself in the world, and
the world in you."*

**One-line description (from the product itself):** *"A personal
intelligence platform for self-reflection, peer review, and collective
insight."*

---

## 2. The Three Repositories — What Each Does

| Repo | Role | Tech |
|---|---|---|
| **Mirror** (client) | The PWA users interact with. React 19 + TypeScript + Vite. On-device ML via face-api + TensorFlow.js. 3D scenes via Three.js / R3F. Workbox service worker for offline & push. PayPal SDK for checkout. | React 19, TS, Vite 6, Tailwind 4, Three.js, Framer Motion, Zustand, react-router 7, vite-plugin-pwa |
| **mirror-server** | The application backend. Handles auth, accounts, subscriptions, journals, groups, voting, TruthStream queueing & analysis, push notifications, the paywall, and persists everything. Real-time via WebSockets. | Node.js + TypeScript (99%+), PM2 process management, WebSocket server, migrations, paywall module, integrations, workers |
| **dina-server** | The AI coordination layer ("Distributed Intelligence Neural Architect"). Routes user input to specialized AI sub-modules. The `MirrorModule` is the first sub-module and provides multi-sensory human analysis. This is what powers @Dina, the personal analysis reports, group insights, and Truth Mirror reports. | Node.js + TypeScript, PM2, modular agent architecture |

The three-tier separation matters for marketing because it lets us say,
truthfully: *"Mirror is not a wrapper on someone else's chatbot. We built
our own AI orchestration layer."*

---

## 3. Feature Inventory (For Press, App Store Copy, Sales Sheets)

### 3.1 Intake — the 7-step "cosmic profile"

A guided onboarding that captures a complete profile in one sitting.

- **Welcome** — sets the tone.
- **Personality** — Big Five (Openness, Conscientiousness, Extraversion,
  Agreeableness, Neuroticism, each 0–100%) plus MBTI type. Backed by a
  scientific question bank and an MBTI bank.
- **IQ / Cognitive** — 15-question battery covering numerical, spatial,
  logical, and verbal reasoning. Outputs raw score, estimated IQ,
  percentile, and cognitive strengths.
- **Visual** — live, on-device face capture using face-api and
  TensorFlow.js. Real-time emotion detection across joyful, excited,
  calm, grateful, content, anxious, sad, frustrated, angry, overwhelmed.
  No image ever leaves the device for inference.
- **Vocal** — up to 30 seconds of voice recording with cross-browser
  codec negotiation (handles iOS Safari, Android Chrome/Firefox, desktop).
- **Emotional Depth** — guided reflection on emotional patterns.
- **Perception Check** — how the user *thinks* others see them
  (this becomes the anchor for TruthStream's "perception gap").
- **AstroLogical** — birth date, birth time, and birth location
  (geocoded). Computes Western astrology (sun/moon/rising, all 12
  houses, 8 planets, chart ruler), Chinese zodiac, African astrology
  (Orisha guardian, elemental force, sacred animal, spiritual gifts),
  and Numerology (life path, destiny, soul urge, personality, birthday).
- **Life Snapshot** — current life phase and context.
- **Final Notes** — free-form anything-else.
- **Results** — the synthesized first read of who you are.

### 3.2 MyMirror — the personal dashboard

The home base after intake. Currently surfaces:

- **Mirror Scores** (all 0–100): Self-Awareness Index, Growth Momentum,
  Reflection Depth, Authenticity, and an overall composite.
- **Personal Analysis Dashboard** — Dina-generated synthesis crossing
  personality × astrology × cognitive × emotional × voice into a
  human-readable narrative. Trends move up / down / stable over time.
- **Live Insights** — actionable cards (e.g., personality + astrology
  combinations that suggest a specific career or relational stance).
- **Snapshot** — current life phase, dominant traits, cognitive
  strengths, emotional profile, astrological highlights.
- **Data Export** — full personal-intelligence export for users who
  want to own their data.

Background is a 3D zen scene (Three.js). UI is glassmorphic,
sakura/rose palette, calm by design.

### 3.3 TruthStream — anonymous peer review (the differentiator)

The feature that nothing else in the personal-development category does
the way Mirror does.

- User opts into TruthStream and configures what slice of their profile
  is shared anonymously (personality, astrology, IQ — granular).
- The user *gives* reviews: rates anonymous peers on five dimensions,
  writes feedback (constructive / affirming / raw), answers custom
  questions. Profiles in the queue expire after 72 hours.
- The user *receives* reviews from 5–10 anonymous reviewers.
- The **Truth Mirror Analysis Dashboard** computes:
  - **Perception Gap Score** — quantified distance between
    self-perception and peer perception.
  - **Quality Metrics** — how coherent / thoughtful reviewers were.
  - **Review Classification** — feedback tone breakdown
    (constructive, affirming, raw truth, hostile).
- Milestone / badge system — 15+ unlockable achievements.

This is the **flagship Premium feature** and the single strongest
marketing claim: *"How accurately do you see yourself? Mirror will
tell you."*

### 3.4 MirrorGroups — collective intelligence

Small private spaces for families, couples, friend groups, teams,
therapy/support groups, anonymous circles, professional cohorts.

- Privacy levels: public, private (invite-only), secret (unlisted).
- **Group Chat** — real-time WebSocket with offline-resilient polling
  fallback, optimistic UI, message cache.
- **@Dina mention** — drop "@Dina" in the chat and the AI joins the
  conversation with group-aware coaching (it reads the shared profiles
  of consenting members).
- **Data Sharing Panel** — per-member, per-data-type opt-in. You choose
  exactly what your group sees.
- **Voting System** — yes/no, multiple choice, or ranked votes with
  expiry timers. Built for shared decisions (move, therapy, hire, etc.).
- **Members & Roles** — owner, admin, member; request-to-join workflow
  for private groups.
- **Directory** — searchable public group catalog.

### 3.5 MyJournal — daily reflection

Structured journaling that lowers the activation energy.

- Date, time of day, mood (1–10 with emoji), energy (1–10), primary
  emotion (10 options), emotion intensity (1–10), free-form text,
  "grateful for" prompt, tags.
- **Auto-save** with 3-second debounce, draft recovery (24h TTL).
- **Search** across all entries.
- **Emotion heatmap** — color-coded historical view.
- **Fully offline-capable** — IndexedDB + localStorage. The app works
  on a plane.

### 3.6 Dina — the AI assistant

Dina is the company's own AI agent (not a third-party chatbot wrapper).
Available:

- **In MyMirror** — generates personal analysis reports.
- **In MirrorGroups** — joins on @mention with group-context awareness.
- **Streaming responses** — partial output as it generates.
- **Queue-based** — handles long LLM latencies gracefully.
- **Context-injected** — reads personal intelligence and (in groups)
  shared member profiles, then writes evidence-based advice that cites
  actual user data.

### 3.7 Notifications & PWA

- **Web Push** (VAPID) for group chat, @mentions, new reviews, vote
  events, fresh insights.
- **Per-feature notification preferences**, **quiet hours**, **digest
  mode**, **DND override**.
- **Up to 10 devices per user.**
- **Installable** on iOS, Android, desktop. Apple splash screens are
  pre-generated for the major iPhone/iPad viewports. Launches in
  standalone mode, draws under the notch.
- **Offline-first**: precache + IndexedDB + draft recovery.
- **Service worker** handles push, deep-links, background sync.

### 3.8 Accounts & security

- Email + password registration with email verification flow.
- Access + refresh token rotation; auto-refresh on 401.
- Optional device fingerprinting for suspicious-login detection.
- Route-level permission matrix (PUBLIC / BASIC / VERIFIED /
  TIER2_ACCESS / TIER3_ACCESS / ADMIN; PUBLIC / AUTHENTICATED /
  VERIFIED / INTAKE_REQUIRED / PREMIUM / ADMIN).

---

## 4. Subscription, Pricing, and Gating

### Tiers (literal, from the codebase)

`tier: 'free' | 'premium' | 'enterprise'`
`status: 'free' | 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired'`

### What's free

- Full Intake (no charge to find out who you are).
- MyJournal — *with a monthly entry limit*.
- MyMirror dashboard view.
- Join MirrorGroups — *with a monthly group-join limit*.
- @Dina queries — *with a daily limit*.
- Personal Analysis — *with a weekly limit*.

### What Premium unlocks (verbatim from the UpgradeModal)

- Unlimited journal entries
- AI-powered journal analysis
- Personal Mirror Report
- Create unlimited MirrorGroups
- Group AI insights & compatibility
- **Receive TruthStream reviews**
- **Truth Mirror Report**
- Unlimited @Dina AI queries
- Data export

### Price

- **$9.99 / month** for Premium.
- **7-day free trial** included on signup.
- Grace period preserved through end of billing cycle on cancellation.
- Payment processor: **PayPal** (subscription flow, vault + intent=subscription).
- Enterprise tier exists in the schema but is not surfaced in the UI;
  reserve for outbound sales / B2B partnerships.

### Headline gating messages already written into the product

These are the in-app paywall copy lines marketing should mirror in ads:

- *"TruthStream — anonymous peer reviews and deep self-insight — is a Premium feature."*
- *"Truth Mirror reports reveal how others perceive you. Upgrade to access TruthStream."*
- *"Group AI insights are a Premium feature. Upgrade to unlock compatibility analysis."*
- *"Creating MirrorGroups is a Premium feature. Upgrade to build your own groups."*
- *"Data export is a Premium feature. Upgrade to download your complete Mirror report."*

---

## 5. Target Audiences

These are the segments the product is **already shaped for** based on
features that exist today.

### Primary (highest fit)

1. **Self-development seekers, 22–40, mostly female-leaning.**
   The astrology + Big Five + journaling stack is a near-exact match
   for the audience already buying The Pattern, Co–Star, Sanvello,
   Calm, Insight Timer, Notion-for-self-tracking. They will instantly
   understand "see yourself through anonymous peer eyes."

2. **Therapy-adjacent users between therapists.**
   People who have done therapy and want structured between-session
   reflection. The journal + emotion taxonomy + Mirror Scores read as a
   self-administered companion. (Not a medical claim.)

3. **Couples and small friend circles.**
   MirrorGroups for two ("partners" group type) + shared personality
   profiles + voting + Dina coaching = a real product nobody else
   ships.

4. **High-functioning curious professionals.**
   The Big Five + MBTI + IQ + perception-gap data is catnip for
   founders, PMs, designers, coaches, and consultants who already pay
   for 360 reviews at work. TruthStream is the consumer 360.

### Secondary

5. **Astrology-first audiences** (TikTok / Instagram astrology
   communities). Mirror is one of the few products to take Western,
   Chinese, *and* African astrology + Numerology seriously and integrate
   them with psychology.

6. **Spiritual-but-evidence-based audiences.** The science +
   spirituality fusion is the wedge — no one is forced to choose.

7. **Group / cohort facilitators** (small group leaders, men's & women's
   circles, recovery groups, mastermind hosts). MirrorGroups + voting +
   group AI is the SaaS they've been duct-taping in Slack + Notion +
   Typeform.

### Tertiary / future

8. **Enterprise & teams** (Enterprise tier already wired in schema).
   Team-of-8 group plan with anonymized perception gap = an internal
   360 review product that doesn't require HR.

9. **Therapist & coach side** — partner channel, not a direct buyer.
   They become referrers if we give them a clinician-friendly export.

---

## 6. Positioning

### What Mirror is

A **personal intelligence platform** combining science, spirituality,
and peer truth into one quantified, beautiful, private system.

### What Mirror is not

- Not a horoscope app (astrology is one of many lenses, not the product).
- Not a journaling app (journal is one of five surfaces).
- Not a chatbot (Dina is grounded in the user's own data).
- Not a dating app (anonymous peer review is structural, not romantic).
- Not therapy (no clinical claims; complementary to therapy).
- Not a productivity tool (the product is about *being*, not doing).

### Three positioning statements to test in market

1. **"How accurately do you see yourself? Mirror will tell you — with
   anonymous peer reviews, AI synthesis, and a perception gap score."**
   *Lead: TruthStream. Best for performance / paid social.*

2. **"Personality science meets astrology meets your inner circle.
   Mirror is the operating system for self-knowledge."**
   *Lead: holism. Best for organic content / influencer / PR.*

3. **"See yourself in the world, and the world in you."**
   *Lead: aesthetic / brand. Best for OOH, hero video, brand campaigns.
   This is the line already in the app — protect it.*

### Three pillars to use across all creative

- **See yourself** — personality, IQ, emotional, vocal, visual,
  cosmic profile (Intake → MyMirror).
- **Be seen** — anonymous peer reviews, perception gap, Truth Mirror
  (TruthStream).
- **See together** — group chat, shared profiles, group AI, voting
  (MirrorGroups).

---

## 7. Competitive Landscape

Mirror does not compete head-to-head with any single product. It
overlaps with four categories:

| Category | Example competitors | Where Mirror wins |
|---|---|---|
| Personality / typology | 16personalities, Truity, Crystal | Mirror is *continuous*, not a one-off quiz. Personality is one of many layers. |
| Astrology | Co–Star, The Pattern, Sanctuary, Nebula | Mirror integrates astrology with psychometrics, IQ, voice, face — astrology people don't have to leave to get the rest. |
| Journaling / mental wellness | Reflectly, Stoic, Daylio, Finch, How We Feel | Mirror's journal is decent; the wedge is what comes *with* it — peer review, group AI, perception gap. |
| AI life coaches | Replika, Pi, Rosebud, Reflectly+AI | Dina is grounded in real measured data about the user (Big Five scores, astrology placements, IQ percentile), not vibes. |
| 360 review / peer feedback | Officevibe, Lattice (B2B), Spill | TruthStream is the only *consumer* 360. Anonymous, gamified, free to give reviews. |

**The defensible position:** *Mirror is the only product that combines
all five layers — psychology, cognition, emotion, cosmology, and peer
truth — into a single intelligence layer with its own AI.*

---

## 8. Differentiators Worth Loud Repetition

1. **Anonymous peer review with a quantified perception-gap score** —
   nothing in the consumer space ships this.
2. **On-device facial emotion analysis** — no image leaves the device.
   This is a real, factual privacy claim and a story journalists will
   pick up.
3. **Five layers, one product** — psychology + cognition + emotion +
   astrology/numerology + peer truth.
4. **Mirror's own AI orchestration (Dina)** — not a wrapper on ChatGPT.
5. **Groups are first-class** — voting, shared profiles, group AI,
   not bolted on.
6. **Installable PWA, offline-first** — works on a plane, no app store
   required, smaller download than native.
7. **Visual identity** — sakura/zen aesthetic, 3D scenes, glassmorphism.
   Looks nothing like the rest of the category. Highly screenshottable.
8. **Granular data sharing controls** — every peer review, every group
   member sees exactly what the user permits. The privacy story is real.

---

## 9. Message Framework (Copy Library)

### Master tagline (already in product)
*See yourself in the world, and the world in you.*

### Subhead options
- Personal intelligence for reflection, peer review, and collective insight.
- The mirror that reflects back what only your circle can see.
- Self-knowledge, quantified. Privately.

### Headlines for ads / posts (ready to ship)

- *"What if you could measure how accurately you see yourself?"*
- *"Your Big Five. Your chart. Your circle. One Mirror."*
- *"Anonymous peer reviews. AI synthesis. A perception gap score."*
- *"Therapy gives you tools. Mirror gives you a map."*
- *"You've taken the personality test. Now find out what other people see."*
- *"Five reviewers. One you. Zero names."*
- *"The 360 review you'd actually want."*
- *"Personality + astrology + the truth from people who know you."*
- *"For couples who think they know each other."*
- *"Run your team like a Mirror group: shared profiles, group AI, anonymous feedback."*

### Calls to action (already in product)

- *Begin Your Reflection.*
- *Start Session.*
- *LOOK into The Mirror.*
- *ENTER The Mirror.*

### Proof points (factual; usable in copy)

- 5 onboarding modalities (personality, cognitive, visual, vocal, astro).
- 10-emotion taxonomy, real-time on-device classification.
- 12 astrological houses + 8 planetary placements + 3 astrological
  systems (Western, Chinese, African) + Numerology.
- 5-dimension peer review, 5–10 reviewers per cycle.
- 4 Mirror Scores (Self-Awareness Index, Growth Momentum, Reflection
  Depth, Authenticity) plus a composite.
- 8 group types, 3 privacy levels.
- Up to 10 push-notification devices per user.
- 7-day free trial.
- $9.99 / month.
- Works offline. Installable. iOS, Android, desktop.

---

## 10. Brand Voice & Visual Identity

### Voice

- **Calm, considered, never urgent.** Mirror is the opposite of doomscroll.
- **Direct, but tender.** "Raw truth" is in the product, not the copy.
- **Evidence-friendly, not lab-coated.** Cite the Big Five and the
  natal chart in the same sentence without flinching.
- **First-person plural.** "We built Mirror because…" The team posture
  is *fellow seekers*, not vendors.

### Visual

- **Palette:** sakura pink, rose, soft orange, dark burgundy text,
  warm white. (`#fff0f5` theme color is set in the manifest.)
- **Texture:** glassmorphism — frosted panels, soft shadows, generous
  whitespace.
- **Imagery:** zen gardens, sakura forests, bridges, ponds, orbs.
  Built-in 3D scenes provide ready-made screenshot backgrounds.
- **Typography:** light, generous line height, system stack.
- **Motion:** Framer Motion. Slow, drifting, breath-paced — never
  punchy or productized.
- **Symbol:** the sakura mirror logo (`mirror-sakura.svg`).

### Don'ts

- No hustle / "10x yourself" / productivity language.
- No medical or clinical claims.
- No fear-based copy ("you're broken, we fix you"). The opposite —
  Mirror reveals.
- No dark-mode / cyber aesthetic. Mirror is light, soft, alive.

---

## 11. Channel Strategy — What to Prioritize and Why

Ranked by expected ROI given current product surface area:

1. **TikTok + Instagram Reels** — astrology + personality content
   already wins here, and the perception-gap score is a single-frame
   hook. Creator partnerships > paid alone.
2. **Influencer partnerships** — mid-tier (50k–500k) in astrology,
   self-development, couples, and therapy-adjacent niches. Give them
   the TruthStream experience first, then a custom referral code.
3. **PR / press** — the privacy angle (on-device ML, anonymous peer
   review) is a story for *Wired, The Verge, Fast Company, NYT
   Styles, The Cut*. The integration of African astrology is a
   distinct cultural story.
4. **Reddit** — r/MBTI, r/Enneagram, r/astrology, r/decidingtobebetter,
   r/getdisciplined, r/socialskills, r/therapy. Long-form,
   community-first.
5. **Substack / podcast** — sponsor pods in self-development,
   couples, and applied-psychology categories. Audience matches.
6. **App store SEO** — even though Mirror is a PWA, listing on the
   PWA app discovery sites and on Apple's "add to home screen"
   moments is worth the effort.
7. **Paid search** — only on bottom-of-funnel queries
   ("how do others see me," "personality test with peer review,"
   "anonymous feedback friends"). Don't try to outbid Headspace.
8. **Partnerships** — therapists, executive coaches, small-group
   leaders, retreat organizers. Give them a co-branded export.

---

## 12. Funnel & Conversion Levers (What the Code Already Supports)

- **Free Intake = irresistible top of funnel.** The intake itself
  produces a real, shareable result. Make the result genuinely
  shareable on Instagram / iMessage. (No share kit appears in the
  code yet — see "What we don't have but should" below.)
- **7-day free trial** baked in at checkout.
- **Free-tier monthly limits** on journal entries, group joins, Dina
  queries, and personal analyses naturally pace users toward upgrade.
- **TruthStream is the conversion event.** Users can *give* reviews
  for free (data flywheel) but must be Premium to *receive* their
  Truth Mirror report. This is the single best paywall in the product
  — lead campaigns toward it.
- **Push notifications** re-engage users on chat, new reviews, vote
  events. Quiet hours and digest mode prevent burnout.
- **Group invites are inherently viral** — every invite is a new
  signup. Build refer-a-friend on top of this.

---

## 13. Story Hooks for Earned Media

- *"The startup that built its own AI just to grade how well you know
  yourself."*
- *"This app uses your phone's camera to read your emotions — and the
  image never leaves your phone."*
- *"Anonymous peer review goes consumer."*
- *"Western astrology, Chinese zodiac, and West African Orisha
  traditions, in one product."*
- *"A 360 review for your relationship."*
- *"The PWA that's quietly outclassing native self-development apps."*

---

## 14. Risks, Sensitivities, and How to Communicate

| Risk | Mitigation in copy |
|---|---|
| Astrology-skeptical press | Lead with psychology + peer review; treat astrology as *one lens* of many. |
| Privacy concerns around face & voice | Emphasize on-device processing for face; voice is opt-in, ~30 sec, used for analysis only. Cite specific tech (face-api + TF.js, no cloud vision). |
| Mental-health-adjacency | Never claim medical/therapeutic benefit. Use "complementary to" not "replaces." |
| IQ score sensitivity | Frame as "cognitive snapshot," not a label. Mention "Excellent / Good / Fair / Poor" quality bands honestly. |
| Anonymous-feedback misuse | Mirror has tone classification (constructive / affirming / raw / hostile). Reference moderation; never minimize. |
| African astrology authenticity | Don't oversell; be honest about scope. This will be reviewed by cultural press — make sure spokespeople are briefed. |

---

## 15. What Doesn't Yet Exist in the Product (Marketing Should Know)

Honest gaps the team should be aware of so we don't promise them:

- No native social-share kit for intake results yet. Worth adding for
  organic growth.
- No referral / refer-a-friend program wired into the code.
- No Android Play Store / iOS App Store native presence — PWA only.
  This is a *feature* (faster, smaller, no review process) but some
  users still expect a store listing.
- No public web "marketing site" surfaced in the repo (the landing
  pages live inside the app). A standalone marketing site at
  `getmirror.app` or similar is the natural next investment.
- Enterprise tier exists in the schema but has no checkout flow yet —
  outbound only.
- No public testimonials wall in the product yet.
- No partner/coach dashboard.

---

## 16. Data Marketing Can Pull From Day One

The backend already tracks:

- Tier, subscription status, trial days remaining, grace days, period
  end, cancellation timestamp.
- Per-feature usage with limits and reset times (great for cohort
  analysis: who hits the journal cap, who hits the Dina cap, who
  upgrades after which gate).
- Intake completion vs. drop-off per step (great for funnel viz).
- Group creation, joins, messages sent, votes cast, @Dina mentions.
- TruthStream queue throughput, reviews given, reviews received,
  perception gap distribution.
- Device count per user, push subscription state, notification
  preferences (channel mix indicator).

The marketing team should request a read-only analytics surface
(or a weekly export) covering: signups, intake completion, trial
starts, paid conversions, conversion-by-gate, D1/D7/D30 retention,
group invite-conversion rate, TruthStream cycle completion rate.

---

## 17. 90-Day Recommended Outreach Plan (Skeleton)

| Phase | Weeks | Focus |
|---|---|---|
| **Foundation** | 1–2 | Lock brand voice + visual guide. Stand up marketing site. Set up analytics. Brief spokespeople (founder + 1). |
| **Soft launch** | 3–6 | Influencer seeding (10 mid-tier creators across astrology, MBTI, couples, therapy-adjacent). Reddit AMAs. Long-form Substack guest posts. |
| **Press push** | 5–8 | Pitch privacy + on-device-ML story to Wired, Fast Company, The Verge. Pitch culture / African astrology story to Cut, Refinery29. Pitch "consumer 360" story to HBR / Fast Co. |
| **Paid scale** | 7–12 | Open TikTok + IG Reels paid. Start retargeting on intake-completers who didn't trial. Test the three positioning statements head-to-head. |
| **Loop** | 10–12 | Build referral. Ship social-share kit for intake results. Re-engage churned trials with new TruthStream report drops. |

---

## 18. Quick-Reference Sheet (For Briefs and Sales Decks)

- **Product:** Mirror — personal intelligence platform.
- **Pitch:** See yourself in the world, and the world in you.
- **What it does:** Multi-modal personal intake + AI synthesis +
  anonymous peer review + small-group collective intelligence.
- **Tagline already in product:** *See yourself in the world, and the
  world in you.*
- **Flagship feature:** TruthStream (anonymous peer review +
  perception-gap score + Truth Mirror Report).
- **AI:** Dina, our own AI coordination layer.
- **Platform:** Installable PWA. iOS, Android, desktop.
- **Pricing:** Free with limits; Premium $9.99/mo with 7-day trial;
  Enterprise on request.
- **Live URL:** https://www.theundergroundrailroad.world/Mirror/
- **Privacy headline:** On-device facial analysis. Granular data
  sharing. Anonymous peer review.
- **Visual cues:** Sakura, zen garden, glassmorphism, soft motion.
- **Voice cues:** Calm, considered, evidence-friendly, tender, never
  urgent.

---

*Prepared from a full source-code audit of the Mirror client,
mirror-server, and dina-server repositories. Every feature, tier,
price, and metric in this document is verifiable in the codebase as of
the date of this brief.*
