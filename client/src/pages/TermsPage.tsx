import React, { useEffect, useState } from 'react';
// Terminal theme — shared with /dev and /map.
import '../styles/dev-terminal.css';

import LegalSection from '../components/legal/LegalSection';
import DevCallout from '../components/dev/DevCallout';
import DevFieldList from '../components/dev/DevField';
import { TERMS_VERSION, TERMS_EFFECTIVE_DATE } from '../config/legal';

/**
 * /termsandconditions — Mirror Terms & Conditions.
 *
 * PUBLIC route (anonymous access). The registration checkbox links here,
 * so it must be readable before sign-up. Styled to match the terminal
 * aesthetic of /dev and /map.
 *
 * IMPORTANT: This document is a strong, product-specific starting point —
 * NOT a substitute for review by a licensed attorney. It is written for
 * an individual operator (no LLC yet) under New York governing law, with
 * binding arbitration, and is designed so that forming an LLC later is a
 * one-line operator swap plus a version bump. See the callouts within.
 */

const VERSION = TERMS_VERSION;
const EFFECTIVE_DATE = TERMS_EFFECTIVE_DATE;
const OPERATOR = 'Gabriel Gomez';
const CONTACT_EMAIL = 'gabrielelythgomez@gmail.com';
const SERVICE_DOMAIN = 'theundergroundrailroad.world';

interface IndexEntry {
  id: string;
  n: number;
  title: string;
}

const SECTION_INDEX: IndexEntry[] = [
  { id: 'acceptance', n: 1, title: 'Acceptance & eligibility' },
  { id: 'operator', n: 2, title: 'Who you are contracting with' },
  { id: 'what-mirror-is', n: 3, title: 'What Mirror is — and is not' },
  { id: 'data-we-collect', n: 4, title: 'The data we collect' },
  { id: 'how-we-use', n: 5, title: 'How we use your data' },
  { id: 'biometric', n: 6, title: 'Biometric data (face & voice)' },
  { id: 'ai', n: 7, title: 'AI processing & Dina' },
  { id: 'groups', n: 8, title: 'MirrorGroups & encryption' },
  { id: 'truthstream', n: 9, title: 'TruthStream & peer reviews' },
  { id: 'acceptable-use', n: 10, title: 'Acceptable use' },
  { id: 'billing', n: 11, title: 'Subscriptions, billing & refunds' },
  { id: 'privacy-rights', n: 12, title: 'Your privacy rights' },
  { id: 'retention', n: 13, title: 'Data retention & deletion' },
  { id: 'termination', n: 14, title: 'Account termination' },
  { id: 'ip', n: 15, title: 'Intellectual property' },
  { id: 'disclaimers', n: 16, title: 'Disclaimers' },
  { id: 'liability', n: 17, title: 'Limitation of liability' },
  { id: 'indemnification', n: 18, title: 'Indemnification' },
  { id: 'arbitration', n: 19, title: 'Disputes & binding arbitration' },
  { id: 'changes', n: 20, title: 'Changes to these terms' },
  { id: 'misc', n: 21, title: 'Miscellaneous' },
  { id: 'contact', n: 22, title: 'Contact' },
];

const TermsPage: React.FC = () => {
  const [scrollPct, setScrollPct] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const el = document.getElementById(id);
      if (el) {
        window.requestAnimationFrame(() =>
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        );
      }
    }
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const top = window.scrollY || doc.scrollTop;
      const max = doc.scrollHeight - doc.clientHeight || 1;
      setScrollPct(Math.round((top / max) * 100));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="dev-terminal min-h-screen">
      {/* ─── Sticky header ──────────────────────────────────────────── */}
      <header
        role="banner"
        className="sticky top-0 z-20"
        style={{
          background: 'var(--dt-bg-elevated)',
          borderBottom: '1px solid var(--dt-border)',
        }}
      >
        <div className="mx-auto flex max-w-[1100px] items-center gap-3 px-3 py-2 sm:px-5">
          <a
            href="/"
            className="flex shrink-0 items-baseline gap-1.5 text-[13px] sm:text-sm"
            aria-label="Mirror — home"
            style={{ borderBottom: 'none' }}
          >
            <span style={{ color: 'var(--dt-magenta)' }}>mirror</span>
            <span style={{ color: 'var(--dt-fg-dim)' }}>@</span>
            <span style={{ color: 'var(--dt-cyan)' }}>legal</span>
            <span style={{ color: 'var(--dt-fg-dim)' }}>:</span>
            <span style={{ color: 'var(--dt-amber)' }}>~/terms</span>
            <span style={{ color: 'var(--dt-green)' }}>$</span>
          </a>
          <div
            className="ml-auto flex items-center gap-2 text-[11px]"
            style={{ color: 'var(--dt-fg-muted)' }}
          >
            <span
              style={{
                border: '1px solid var(--dt-border-hi)',
                padding: '0.15rem 0.5rem',
                borderRadius: '3px',
              }}
            >
              {VERSION}
            </span>
            <span className="hidden sm:inline">effective {EFFECTIVE_DATE}</span>
          </div>
        </div>
      </header>

      <main
        role="main"
        aria-label="Terms and conditions"
        className="mx-auto max-w-[1100px] px-3 py-6 sm:px-5"
      >
        {/* Hero. */}
        <header className="mb-8">
          <pre
            aria-hidden="true"
            className="mb-4 overflow-x-auto text-[10px] leading-tight sm:text-xs"
            style={{ color: 'var(--dt-magenta)' }}
          >{`
 _____                            ___    ____               _ _ _   _
|_   _|__ _ __ _ __ ___  ___     ( _ )  / ___|___  _ __   __| (_) |_(_) ___  _ __  ___
  | |/ _ \\ '__| '_ \` _ \\/ __|    / _ \\/\\ |   / _ \\| '_ \\ / _\` | | __| |/ _ \\| '_ \\/ __|
  | |  __/ |  | | | | | \\__ \\   | (_>  < |__| (_) | | | | (_| | | |_| | (_) | | | \\__ \\
  |_|\\___|_|  |_| |_| |_|___/    \\___/\\/\\____\\___/|_| |_|\\__,_|_|\\__|_|\\___/|_| |_|___/`}</pre>
          <div
            className="text-[11px] uppercase tracking-widest"
            style={{ color: 'var(--dt-fg-dim)' }}
          >
            $ cat <span style={{ color: 'var(--dt-amber)' }}>terms-and-conditions.md</span>
          </div>
          <h1
            className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl"
            style={{ color: 'var(--dt-fg-strong)' }}
          >
            Terms &amp; Conditions
            <span className="dt-cursor" aria-hidden="true" />
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: 'var(--dt-fg-muted)' }}>
            These terms govern your use of Mirror, including MyMirror,
            MirrorGroups, and TruthStream, operated at{' '}
            <code>{SERVICE_DOMAIN}</code>. Please read them. The plain-English
            summary below is a courtesy, not a replacement for the full text.
          </p>
        </header>

        {/* Attorney-review disclaimer — visible, honest. */}
        <DevCallout kind="warning" title="Draft pending legal review">
          This document is a product-specific starting point generated for
          the operator. It has <strong>not yet been reviewed by a licensed
          attorney</strong>. Before relying on it in production with live
          payments and personal data, have it reviewed — particularly the
          biometric-consent, arbitration, and auto-renewal sections, which
          carry the highest exposure.
        </DevCallout>

        {/* Plain-English summary. */}
        <section
          aria-label="Plain-English summary"
          className="my-6"
          style={{
            background: 'var(--dt-bg-elevated)',
            border: '1px solid var(--dt-border)',
            borderRadius: '4px',
          }}
        >
          <div
            className="px-4 py-2 text-[11px] uppercase tracking-widest"
            style={{
              color: 'var(--dt-fg-muted)',
              background: 'var(--dt-bg-soft)',
              borderBottom: '1px solid var(--dt-border)',
            }}
          >
            <span style={{ color: 'var(--dt-green)' }}>$</span> head -8 summary.txt — the short version
          </div>
          <ul className="dt-bullets space-y-2 px-5 py-4 text-sm">
            <li>You must be <strong>at least 16</strong> to use Mirror.</li>
            <li>
              Mirror gives you <strong>informational self-reflection</strong> —
              it is <strong>not medical, psychological, hiring, lending, or
              legal advice</strong>, and must never be used to make those
              kinds of decisions about anyone.
            </li>
            <li>
              We collect sensitive data (face &amp; voice features, personality,
              cognitive, astrological, journals, group chat). We{' '}
              <strong>never sell it</strong>. Group chat is encrypted such
              that we cannot read it.
            </li>
            <li>
              TruthStream reviews are <strong>anonymous to the person reviewed</strong>;
              we will not reveal a reviewer's identity except under valid
              legal process.
            </li>
            <li>
              You can <strong>export or delete</strong> your data at any time.
              Deletion completes within 30 days.
            </li>
            <li>
              Paid plans <strong>auto-renew</strong>; you can cancel online
              anytime. After a trial converts to paid,{' '}
              <strong>charges are non-refundable</strong>.
            </li>
            <li>
              Disputes are resolved by <strong>binding arbitration</strong>{' '}
              (you may opt out within 30 days of accepting).
            </li>
            <li>We give 30 days' notice before material changes to these terms.</li>
          </ul>
        </section>

        {/* Jump index. */}
        <nav
          aria-label="Section index"
          className="my-6"
          style={{
            background: 'var(--dt-bg-elevated)',
            border: '1px solid var(--dt-border)',
            borderRadius: '4px',
          }}
        >
          <div
            className="px-4 py-2 text-[11px] uppercase tracking-widest"
            style={{
              color: 'var(--dt-fg-muted)',
              background: 'var(--dt-bg-soft)',
              borderBottom: '1px solid var(--dt-border)',
            }}
          >
            <span style={{ color: 'var(--dt-green)' }}>$</span> ls sections/
          </div>
          <ol className="grid grid-cols-1 gap-x-6 gap-y-1 px-4 py-3 sm:grid-cols-2">
            {SECTION_INDEX.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="flex items-baseline gap-2 py-0.5 text-sm"
                  style={{ color: 'var(--dt-fg)' }}
                >
                  <span style={{ color: 'var(--dt-fg-dim)' }}>
                    {String(s.n).padStart(2, '0')}
                  </span>
                  <span className="truncate">{s.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* ───────────────── SECTIONS ───────────────── */}

        <LegalSection id="acceptance" n={1} title="Acceptance & eligibility">
          <p>
            These Terms &amp; Conditions ("Terms") form a binding agreement
            between you and the operator (see §2) governing your access to and
            use of Mirror and all of its features (the "Service"). By creating
            an account, checking the acceptance box at registration, or
            otherwise using the Service, you agree to these Terms and to our
            Privacy practices described herein.
          </p>
          <p>
            <strong>You must be at least 16 years old.</strong> If you are
            under 16, you may not use the Service. If you are between 16 and
            the age of majority in your jurisdiction, you represent that your
            parent or legal guardian has reviewed and agreed to these Terms.
            The Service is not directed to children under 16, and we do not
            knowingly collect their data; if we learn we have, we will delete
            it.
          </p>
          <p>
            If you do not agree to these Terms, do not use the Service. Your
            continued use after an updated version takes effect (see §20)
            constitutes acceptance of the update.
          </p>
        </LegalSection>

        <LegalSection id="operator" n={2} title="Who you are contracting with">
          <p>
            The Service is operated by <strong>{OPERATOR}</strong>, an
            individual ("we," "us," "our," the "Operator"), reachable at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. References
            to the Operator include any successor entity (for example, a
            limited-liability company later formed to operate the Service), to
            which these Terms and your account may be assigned under §21.
          </p>
          <DevCallout kind="info" title="Operator note">
            Mirror currently operates under an individual's name. If and when
            it is reorganized under a registered entity, the Operator
            identity above will be updated and the version incremented; your
            agreement carries over by assignment.
          </DevCallout>
        </LegalSection>

        <LegalSection id="what-mirror-is" n={3} title="What Mirror is — and is not">
          <p>
            Mirror is a personal-reflection platform. It captures a
            multi-modal profile and produces insights, peer feedback, and
            narrative reports intended to support self-knowledge and
            conversation. Everything Mirror produces is{' '}
            <strong>informational and experimental</strong>.
          </p>
          <DevCallout kind="danger" title="Mirror is NOT any of the following">
            <ul className="dt-bullets space-y-1">
              <li>Not medical, psychiatric, or mental-health advice, care, or diagnosis.</li>
              <li>Not a substitute for a licensed professional of any kind.</li>
              <li>Not a validated psychometric or clinical instrument. IQ-style scores are relative, internal estimates — not clinical IQ.</li>
              <li>Not a tool for making employment, hiring, firing, promotion, or recruiting decisions.</li>
              <li>Not a tool for credit, lending, insurance, or financial-eligibility decisions.</li>
              <li>Not a tool for housing, tenancy, immigration, education-admission, or child-custody decisions.</li>
              <li>Not a means of surveilling, profiling, or evaluating any person without their knowledge and consent.</li>
            </ul>
          </DevCallout>
          <p>
            You agree not to use Mirror, or anything it generates, for any of
            the prohibited purposes above. Using Mirror output to make
            decisions about other people may violate laws including the U.S.
            Fair Credit Reporting Act, Equal Employment Opportunity laws, the
            Fair Housing Act, and analogous state and international statutes —
            and is a material breach of these Terms.
          </p>
        </LegalSection>

        <LegalSection id="data-we-collect" n={4} title="The data we collect">
          <p>You provide most of this data directly through the intake flow and ongoing use:</p>
          <DevFieldList
            rows={[
              { name: 'Account', type: 'identifiers', description: 'Email, username, hashed password, session and device metadata (IP, user agent, device fingerprint).' },
              { name: 'Facial features', type: 'biometric — see §6', description: 'Facial landmarks, an expression/emotion vector, and a numeric face descriptor computed in your browser. We do not, by default, store the raw photograph.' },
              { name: 'Vocal features', type: 'biometric — see §6', description: 'A short voice recording and acoustic metadata (duration, format, device).' },
              { name: 'Cognitive', type: 'assessment', description: 'Responses to timed reasoning items and a relative percentile estimate. Not a clinical score.' },
              { name: 'Personality', type: 'assessment', description: 'Big-5 (OCEAN) responses and an inferred type. Self-report; not diagnostic.' },
              { name: 'Astrological', type: 'self-provided', description: 'Birth date and optional birth time/place, used for chart computation performed on your device.' },
              { name: 'Journals', type: 'free text', description: 'Private entries you write. Among the most sensitive data on the platform.' },
              { name: 'Group content', type: 'encrypted', description: 'MirrorGroups chat and shared data, encrypted at rest (see §8).' },
              { name: 'Peer reviews', type: 'free text + structured', description: 'Reviews you write about others and reviews others write about you (see §9).' },
              { name: 'Usage & billing', type: 'operational', description: 'Feature usage counters, subscription status, and payment-processor event records (we do not store full card numbers — see §11).' },
            ]}
          />
        </LegalSection>

        <LegalSection id="how-we-use" n={5} title="How we use your data">
          <p>We use your data only to operate and improve the Service:</p>
          <ul className="dt-bullets space-y-1">
            <li>To provide the features you use — generate insights, run group analysis, deliver peer-review reports.</li>
            <li>To authenticate you, secure your account, and prevent abuse.</li>
            <li>To process subscriptions and send transactional email (verification, password reset, billing, notifications you've enabled).</li>
            <li>To comply with law and enforce these Terms.</li>
            <li>
              To improve the Service, including our in-house models, using{' '}
              <strong>anonymized and aggregated</strong> data only — see the
              reservation below.
            </li>
          </ul>
          <DevCallout kind="info" title="Improvement of our models (reserved right)">
            We reserve the right to use <strong>de-identified, aggregated</strong>{' '}
            data — data from which direct identifiers have been removed and
            which cannot reasonably be re-associated with you — to evaluate
            and improve Mirror and its in-house intelligence ("Dina"). We do
            not use your raw journals, raw face/voice recordings, or
            identifiable peer reviews to train models, and we never sell your
            data.
          </DevCallout>
          <p>
            <strong>We do not sell your personal data</strong>, and we do not
            share it with third parties for their own marketing.
          </p>
        </LegalSection>

        <LegalSection id="biometric" n={6} title="Biometric data (face & voice)">
          <DevCallout kind="security" title="Separate biometric consent is required">
            Facial and vocal features are <strong>biometric identifiers</strong>{' '}
            under laws including the Illinois Biometric Information Privacy Act
            (BIPA), the Texas CUBI, and the Washington biometric statute.
            Where those laws apply, we collect your{' '}
            <strong>separate, informed, written consent before capture</strong>{' '}
            at the relevant intake step — your acceptance of these Terms alone
            is not that consent.
          </DevCallout>
          <p>Our biometric commitments:</p>
          <ul className="dt-bullets space-y-1">
            <li><strong>Purpose limitation.</strong> Biometric features are used solely to generate your Mirror insights — never for identification, surveillance, or sale.</li>
            <li><strong>On-device derivation.</strong> Face features are computed in your browser; we do not store the raw photograph by default.</li>
            <li><strong>No disclosure.</strong> We do not disclose, lease, or sell biometric data, except as strictly required by valid legal process.</li>
          </ul>
          <p>
            <strong>Retention &amp; destruction.</strong> We retain biometric
            features only as long as needed to provide the Service and in any
            case destroy them no later than: (a) the date the purpose for
            collection is satisfied; or (b) 3 years after your last
            interaction with the Service; or (c) 30 days after you delete your
            account — whichever occurs first.
          </p>
        </LegalSection>

        <LegalSection id="ai" n={7} title="AI processing & Dina">
          <p>
            Mirror's insights, group analyses, and reports are generated with
            the help of an in-house intelligence layer called{' '}
            <strong>Dina</strong>, which runs on infrastructure we control. By
            using features that produce synthesis (MyMirror reports, group
            insights, TruthStream analysis, the in-group @Dina assistant), you
            understand that your relevant submissions are processed by Dina to
            produce those outputs.
          </p>
          <DevCallout kind="warning" title="AI output is informational, not authoritative">
            Automated output can be incomplete, inaccurate, or wrong. It is
            provided for reflection only. Do not rely on it as professional
            advice or as fact about yourself or any other person, and never
            use it for any of the prohibited purposes in §3.
          </DevCallout>
        </LegalSection>

        <LegalSection id="groups" n={8} title="MirrorGroups & encryption">
          <p>
            MirrorGroups lets you form small groups, share selected parts of
            your profile, chat, and receive collective analysis. Sharing is{' '}
            <strong>opt-in per data type</strong>; you choose what each group
            can see.
          </p>
          <DevCallout kind="success" title="We cannot read your group chat">
            Group chat messages and group-shared data are encrypted at rest
            with AES-256-GCM under keys derived from group members. As an
            architectural matter, the Operator{' '}
            <strong>cannot read the plaintext of group chat content</strong>{' '}
            without member-held key material. We will not circumvent this
            design, and we cannot produce plaintext we do not hold — including
            in response to a subpoena.
          </DevCallout>
          <p>
            You are responsible for what you share into a group and with whom.
            Other members may retain what you shared with them. Leaving a
            group stops future sharing but does not retract what was already
            shared.
          </p>
        </LegalSection>

        <LegalSection id="truthstream" n={9} title="TruthStream & peer reviews">
          <p>
            TruthStream lets users review one another against a stated goal.
            Reviews are <strong>anonymous to the person being reviewed</strong>.
          </p>
          <DevCallout kind="security" title="Anonymity commitment">
            We will not disclose the identity of a reviewer to the person they
            reviewed, except where required by valid legal process or to
            protect against imminent harm. Reviewers should nonetheless write
            as though their words may one day be examined.
          </DevCallout>
          <p>
            <strong>If you write reviews:</strong> you warrant that they are
            good-faith, first-person observations, not knowingly false, and
            not harassing. You grant us a non-exclusive, royalty-free license
            to display your review, aggregate it into the reviewed person's
            perception reports, and retain it{' '}
            <strong>even after you delete your account</strong> — because the
            review is anonymous and others have relied on it. Deleting your
            account detaches your identity from reviews you wrote; it does not
            delete their content.
          </p>
          <p>
            <strong>If you receive reviews:</strong> they reflect others'
            subjective perceptions, not facts about you. We are a neutral host
            of user-generated content. We may, but are not obligated to,
            moderate, remove, or refuse content; you can flag reviews you
            believe violate these Terms.
          </p>
        </LegalSection>

        <LegalSection id="acceptable-use" n={10} title="Acceptable use">
          <p>You agree not to, and not to attempt to:</p>
          <ul className="dt-bullets space-y-1">
            <li>Use the Service or its output for any purpose prohibited in §3.</li>
            <li>Submit another person's face, voice, likeness, or personal data, or impersonate anyone.</li>
            <li>Surveil, profile, or evaluate any person without their knowledge and consent.</li>
            <li>Use TruthStream to harass, defame, threaten, or coordinate attacks on any person.</li>
            <li>Upload unlawful, infringing, or malicious content.</li>
            <li>Scrape, reverse engineer, decompile, or use the Service to build or train a competing product or model.</li>
            <li>Circumvent rate limits, paywalls, encryption, or access controls.</li>
            <li>Use bots or automated means to create accounts or generate content.</li>
          </ul>
          <DevCallout kind="danger" title="Enforcement: immediate termination, no refund">
            We may <strong>suspend or terminate your account immediately and
            without refund</strong> for any violation of this section or other
            material breach of these Terms, at our discretion, and may report
            unlawful activity to authorities.
          </DevCallout>
        </LegalSection>

        <LegalSection id="billing" n={11} title="Subscriptions, billing & refunds">
          <p>
            Mirror offers a free tier and paid subscriptions. Payments are
            processed by <strong>PayPal</strong>; your use of PayPal is also
            governed by PayPal's own terms. We do not store your full payment
            instrument details.
          </p>
          <DevCallout kind="warning" title="Auto-renewal disclosure (please read)">
            Paid subscriptions <strong>automatically renew</strong> at the
            then-current price each billing period until you cancel. By
            subscribing, you <strong>authorize recurring charges</strong> to
            your payment method. You may <strong>cancel at any time</strong>{' '}
            from your account settings or via PayPal; cancellation stops the
            next renewal and takes effect at the end of the current paid
            period. We will send renewal and price-change reminders where
            required by law (including California and New York automatic-renewal
            laws).
          </DevCallout>
          <p>
            <strong>Trials and refunds.</strong> Where offered, a free trial
            converts to a paid subscription automatically unless you cancel
            before it ends. <strong>Once a trial converts to a paid
            subscription, all charges are final and non-refundable</strong>,
            except where a refund is required by applicable law. Canceling
            stops future charges but does not refund the current period.
          </p>
        </LegalSection>

        <LegalSection id="privacy-rights" n={12} title="Your privacy rights">
          <p>
            Regardless of where you live or which law governs these Terms (see
            §19), we honor the following rights for all users:
          </p>
          <ul className="dt-bullets space-y-1">
            <li><strong>Access</strong> — request a copy of the personal data we hold about you.</li>
            <li><strong>Portability</strong> — export your data in a portable format.</li>
            <li><strong>Correction</strong> — fix inaccurate data.</li>
            <li><strong>Deletion</strong> — delete your account and data (see §13).</li>
            <li><strong>Objection / restriction</strong> — object to or restrict certain processing.</li>
            <li><strong>Non-discrimination</strong> — we will not penalize you for exercising these rights.</li>
          </ul>
          <p>
            These mirror the protections of the EU/UK GDPR and U.S. state
            privacy laws including the California Consumer Privacy Act as
            amended (CCPA/CPRA). California residents have the right to know,
            delete, correct, and opt out of "sale" or "sharing" — and as
            stated in §5, <strong>we do not sell or share your personal data</strong>.
            To exercise any right, email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or use the
            in-app export and delete tools.
          </p>
        </LegalSection>

        <LegalSection id="retention" n={13} title="Data retention & deletion">
          <p>
            You can delete your account at any time. When you do, we purge
            your personal data on the following schedule:
          </p>
          <DevFieldList
            rows={[
              { name: 'Account, intake, journals, face/voice features, group membership', type: 'purged ≤ 30 days', description: 'Deleted from primary stores within 30 days of your deletion request; biometric features per §6.' },
              { name: 'Anonymized TruthStream review content', type: 'retained', description: 'Reviews you wrote are detached from your identity and retained, because they are anonymous and others have relied on them (see §9).' },
              { name: 'Billing & subscription event records', type: 'retained ~7 years', description: 'Kept as required for tax, accounting, and audit obligations, then deleted.' },
              { name: 'Backups', type: 'rolling expiry', description: 'Residual copies in encrypted backups expire on the normal backup rotation after deletion from primary stores.' },
              { name: 'Legal-hold data', type: 'as required', description: 'Data subject to a legal hold or active dispute is retained until the matter resolves.' },
            ]}
          />
        </LegalSection>

        <LegalSection id="termination" n={14} title="Account termination">
          <p>
            <strong>By you:</strong> you may stop using the Service and delete
            your account at any time.
          </p>
          <p>
            <strong>By us:</strong> we may suspend or terminate your access at
            any time for breach of these Terms (including §10), to comply with
            law, or if continuing to provide the Service to you poses risk to
            others or to the Service. Where termination is not for cause, we
            will make reasonable effort to give notice. Sections that by their
            nature should survive termination — including §§9, 15, 16, 17, 18,
            19 — survive.
          </p>
        </LegalSection>

        <LegalSection id="ip" n={15} title="Intellectual property">
          <p>
            The Service — its software, design, text, and the terminal and
            glass interfaces — is owned by the Operator and protected by
            intellectual-property law. We grant you a limited, revocable,
            non-transferable license to use the Service for personal,
            non-commercial purposes under these Terms.
          </p>
          <p>
            <strong>Your content</strong> (journals, group messages, reviews,
            intake responses) remains yours. You grant us the limited license
            necessary to host, process, and display it to operate the
            features you use, and — for peer reviews — the license described
            in §9. You represent you have the rights to the content you submit.
          </p>
        </LegalSection>

        <LegalSection id="disclaimers" n={16} title="Disclaimers">
          <p style={{ textTransform: 'none' }}>
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT
            WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY,
            INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
            PARTICULAR PURPOSE, ACCURACY, AND NON-INFRINGEMENT. WE DO NOT
            WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR
            ERROR-FREE, OR THAT ANY INSIGHT, SCORE, OR REPORT IS ACCURATE OR
            RELIABLE. YOU USE THE SERVICE AND ITS OUTPUT AT YOUR OWN RISK.
          </p>
        </LegalSection>

        <LegalSection id="liability" n={17} title="Limitation of liability">
          <p style={{ textTransform: 'none' }}>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE OPERATOR WILL NOT BE
            LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
            EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, DATA, OR
            GOODWILL, ARISING FROM OR RELATING TO THE SERVICE. THE OPERATOR'S
            TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS RELATING TO THE SERVICE
            WILL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID US IN THE
            12 MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM, OR (B) ONE
            HUNDRED U.S. DOLLARS ($100).
          </p>
          <p>
            Some jurisdictions do not allow certain limitations; in those
            places, the limitations apply to the fullest extent permitted.
            Nothing in these Terms limits liability that cannot be limited by
            law.
          </p>
        </LegalSection>

        <LegalSection id="indemnification" n={18} title="Indemnification">
          <p>
            You agree to indemnify and hold harmless the Operator from any
            claims, damages, liabilities, and reasonable legal fees arising
            from: (a) your misuse of the Service; (b) your violation of these
            Terms or of any law; (c) content you submit, including peer
            reviews; or (d) your infringement of another's rights.
          </p>
        </LegalSection>

        <LegalSection id="arbitration" n={19} title="Disputes & binding arbitration">
          <p>
            These Terms are governed by the laws of the{' '}
            <strong>State of New York</strong>, without regard to its
            conflict-of-laws rules, and subject to the mandatory
            consumer-protection laws of your home jurisdiction where those
            cannot be waived.
          </p>
          <p style={{ textTransform: 'none' }}>
            <strong>PLEASE READ — THIS AFFECTS HOW DISPUTES ARE RESOLVED.</strong>{' '}
            Except for small-claims matters and requests for injunctive relief,
            you and the Operator agree to resolve any dispute relating to the
            Service by <strong>binding individual arbitration</strong>, not in
            court, under the Federal Arbitration Act and the rules of a
            recognized arbitration provider. <strong>You and the Operator
            waive the right to a jury trial and to participate in a class
            action.</strong> Arbitration is on an individual basis only.
          </p>
          <DevCallout kind="info" title="Your 30-day right to opt out of arbitration">
            You may opt out of this arbitration agreement by emailing{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with the
            subject "Arbitration Opt-Out" within{' '}
            <strong>30 days</strong> of first accepting these Terms. If you
            opt out, disputes proceed in the state or federal courts located
            in New York. Opting out does not affect any other part of these
            Terms. For consumer claims, the Operator will pay arbitration
            filing fees to the extent required by the provider's consumer
            rules.
          </DevCallout>
        </LegalSection>

        <LegalSection id="changes" n={20} title="Changes to these terms">
          <p>
            We may update these Terms. For <strong>material</strong> changes,
            we will give <strong>at least 30 days' notice</strong> by email
            and an in-app notice before they take effect, and will ask you to
            re-accept where required. The "effective" date and version in the
            header always reflect the current version, and prior versions are
            summarized in the changelog below. Continued use after the
            effective date constitutes acceptance.
          </p>
        </LegalSection>

        <LegalSection id="misc" n={21} title="Miscellaneous">
          <ul className="dt-bullets space-y-1">
            <li><strong>Entire agreement.</strong> These Terms are the entire agreement between you and the Operator regarding the Service.</li>
            <li><strong>Severability.</strong> If any provision is unenforceable, the rest remain in effect.</li>
            <li><strong>No waiver.</strong> Our failure to enforce a provision is not a waiver of it.</li>
            <li><strong>Assignment.</strong> You may not assign these Terms; we may assign them, including to a successor entity (see §2).</li>
            <li><strong>Force majeure.</strong> We are not liable for failures caused by events beyond our reasonable control.</li>
          </ul>
        </LegalSection>

        <LegalSection id="contact" n={22} title="Contact">
          <p>
            Questions, privacy requests, or arbitration opt-outs:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </LegalSection>

        {/* Versioned footer + changelog. */}
        <footer
          className="mt-14 pt-6 text-sm"
          style={{ color: 'var(--dt-fg-muted)', borderTop: '1px solid var(--dt-border)' }}
        >
          <div
            className="mb-3 text-[11px] uppercase tracking-widest"
            style={{ color: 'var(--dt-fg-dim)' }}
          >
            <span style={{ color: 'var(--dt-green)' }}>$</span> git log --oneline terms
          </div>
          <ul className="space-y-1">
            <li>
              <span style={{ color: 'var(--dt-amber)' }}>{VERSION}</span>{' '}
              <span style={{ color: 'var(--dt-fg-dim)' }}>{EFFECTIVE_DATE}</span>{' '}
              — Initial publication.
            </li>
          </ul>
          <p className="mt-4" style={{ color: 'var(--dt-fg-dim)' }}>
            © {new Date().getFullYear()} {OPERATOR}. Operated at {SERVICE_DOMAIN}.
          </p>
        </footer>
      </main>

      {/* Status bar. */}
      <div className="dt-statusbar sticky bottom-0 z-10 flex items-center gap-3 px-3 py-1 text-[11px]">
        <span
          aria-hidden="true"
          style={{
            background: 'var(--dt-green)',
            color: 'var(--dt-bg)',
            padding: '0 0.4rem',
            borderRadius: '2px',
            fontWeight: 600,
          }}
        >
          NORMAL
        </span>
        <span style={{ color: 'var(--dt-fg)' }}>terms-and-conditions.md</span>
        <span style={{ color: 'var(--dt-fg-dim)' }}>·</span>
        <span style={{ color: 'var(--dt-fg-muted)' }}>{VERSION}</span>
        <span className="ml-auto" style={{ color: 'var(--dt-fg-muted)' }}>
          {scrollPct}%
        </span>
      </div>
    </div>
  );
};

export default TermsPage;