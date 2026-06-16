// ============================================================================
// FEEDBACK FORM
// ============================================================================
// File: client/src/components/feedback/FeedbackForm.tsx
// ----------------------------------------------------------------------------
// Main form panel for /feedback. Wires the kind selector, the star rating
// input and the dynamic per-kind fields into a single submit flow.
//
// UX notes:
//   * Per-kind required-field gating mirrors the server-side controller so
//     the user never gets a 400 back for something we could have validated.
//   * Submit button stays disabled until the form is valid; a sub-label
//     under the button explains what's missing.
//   * After submit we show a success state in-place with a "Submit another"
//     CTA — no full-page redirect, no modal stack.
//   * On 429 (rate limit) we keep the form filled and show a retry timer.
// ============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StarRating from './StarRating';
import FeedbackKindSelector, { kindMeta } from './FeedbackKindSelector';
import { createFeedback, FeedbackApiError, getRatingStats } from '../../services/feedbackApi';
import type { FeedbackKind, FeedbackSeverity, RatingStats } from '../../services/feedbackApi';

interface Props {
  defaultEmail?: string;
  onSubmitted?: () => void;
}

const MAX_SUBJECT = 200;
const MAX_MESSAGE = 5000;

const SEVERITY_OPTIONS: ReadonlyArray<{ value: FeedbackSeverity; label: string; color: string }> = [
  { value: 'low',      label: 'Low',      color: '#4ade80' },
  { value: 'medium',   label: 'Medium',   color: '#fb923c' },
  { value: 'high',     label: 'High',     color: '#f87171' },
  { value: 'critical', label: 'Critical', color: '#a78bfa' },
];

const FeedbackForm: React.FC<Props> = ({ defaultEmail, onSubmitted }) => {
  // --------------------------------------------------------------------------
  // STATE
  // --------------------------------------------------------------------------

  const [kind, setKind]         = useState<FeedbackKind>('rating');
  const [rating, setRating]     = useState<number>(0);
  const [subject, setSubject]   = useState<string>('');
  const [message, setMessage]   = useState<string>('');
  const [email, setEmail]       = useState<string>(defaultEmail || '');
  const [severity, setSeverity] = useState<FeedbackSeverity>('medium');

  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState<{ id: number; kind: FeedbackKind } | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [retryIn,    setRetryIn]    = useState<number>(0);

  const [stats, setStats] = useState<RatingStats | null>(null);

  // Keep the supplied default email in sync if it arrives after mount
  // (e.g. AuthContext hydrates later).
  useEffect(() => {
    if (defaultEmail && !email) setEmail(defaultEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultEmail]);

  // Live rating stats — pure flavour text, render-safe if it fails.
  useEffect(() => {
    let alive = true;
    getRatingStats()
      .then((s) => alive && setStats(s))
      .catch(() => { /* non-fatal */ });
    return () => { alive = false; };
  }, [submitted]);

  // Countdown for rate-limit retry.
  useEffect(() => {
    if (retryIn <= 0) return;
    const t = setInterval(() => setRetryIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [retryIn]);

  // --------------------------------------------------------------------------
  // VALIDATION
  // --------------------------------------------------------------------------

  const validation = useMemo(() => {
    const issues: string[] = [];
    if (kind === 'rating' && !rating) issues.push('Pick a star rating');
    if (kind !== 'rating' && !subject.trim()) issues.push('Add a subject');
    if (kind !== 'rating' && !message.trim()) issues.push('Add a description');
    if (kind === 'contact' && !validEmail(email))   issues.push('Add a valid reply-to email');
    if (kind === 'contact' && message.trim().length < 5) issues.push('Tell us a bit more — at least 5 characters');
    return { ok: issues.length === 0, issues };
  }, [kind, rating, subject, message, email]);

  // --------------------------------------------------------------------------
  // SUBMIT
  // --------------------------------------------------------------------------

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!validation.ok || submitting || retryIn > 0) return;

    setSubmitting(true);
    setError(null);
    try {
      const result = await createFeedback({
        kind,
        rating:  kind === 'rating' ? rating : null,
        subject: kind === 'rating' ? (subject.trim() || null) : subject.trim(),
        message: message.trim() || null,
        contactEmail: email.trim() ? email.trim().toLowerCase() : null,
        severity: kind === 'issue' ? severity : null,
      });

      setSubmitted({ id: result.id, kind });
      onSubmitted?.();
    } catch (err) {
      if (err instanceof FeedbackApiError) {
        if (err.status === 429 && err.retryAfterSec) {
          setRetryIn(err.retryAfterSec);
        }
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setSubmitted(null);
    setError(null);
    setSubject('');
    setMessage('');
    setRating(0);
    setSeverity('medium');
  }

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------

  const meta   = kindMeta(kind);
  const showSubject = kind !== 'rating'; // rating: optional and renamed below
  const messageLabel = kind === 'rating'
    ? "Anything you'd like to add? (optional)"
    : kind === 'issue'
    ? 'What happened? Steps to reproduce, what you expected, anything that helps.'
    : kind === 'recommendation'
    ? 'Describe the idea. What problem does it solve? Who benefits?'
    : 'Your message';

  const subjectLabel = kind === 'issue'
    ? 'Short summary of the issue'
    : kind === 'recommendation'
    ? 'One-line summary of the idea'
    : 'Subject';

  // --------------------------------------------------------------------------
  // SUCCESS STATE
  // --------------------------------------------------------------------------
  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={panelStyle}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 18,
            textAlign: 'center',
            padding: '12px 6px',
          }}
        >
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 18 }}
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: `radial-gradient(circle at 30% 30%, ${meta.color}cc, ${meta.color}55 60%, transparent 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 8px 32px ${meta.glow}`,
            }}
            aria-hidden="true"
          >
            <span style={{ fontSize: 30, color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,0.35)' }}>✓</span>
          </motion.div>

          <div>
            <h3 style={{ ...headingStyle, marginBottom: 6 }}>Thanks — we got it.</h3>
            <p style={{ ...bodyStyle, fontSize: 14, opacity: 0.85 }}>
              Reference&nbsp;
              <span style={{ fontFamily: 'monospace', color: meta.color, fontWeight: 600 }}>#{submitted.id}</span>
              {' · '}
              {submitted.kind === 'contact'
                ? "We'll reply by email shortly."
                : submitted.kind === 'issue'
                ? 'A human will take a look as soon as we can.'
                : submitted.kind === 'recommendation'
                ? 'Every great feature starts with a note like yours.'
                : 'Your rating is in — thank you.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={resetForm}
              style={{ ...primaryButton(meta.color), padding: '11px 22px', fontSize: 14 }}
            >
              Submit another
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={panelStyle} noValidate>
      {/* --- Kind selector ------------------------------------------------ */}
      <section style={{ marginBottom: 18 }}>
        <SectionLabel
          eyebrow="Step 1"
          title="What are you here for?"
          accent={meta.color}
        />
        <FeedbackKindSelector value={kind} onChange={setKind} disabled={submitting} />
      </section>

      {/* --- Star rating (only for rating kind) --------------------------- */}
      <AnimatePresence initial={false} mode="wait">
        {kind === 'rating' && (
          <motion.section
            key="rating"
            initial={{ opacity: 0, y: 6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden', marginBottom: 18 }}
          >
            <SectionLabel
              eyebrow="Step 2"
              title="How was your experience?"
              accent={meta.color}
            />
            <div
              style={{
                ...subPanel(meta.color),
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '22px 16px',
              }}
            >
              <StarRating value={rating} onChange={setRating} disabled={submitting} />
              {stats && stats.total > 0 && (
                <p style={{ ...bodyStyle, fontSize: 11.5, opacity: 0.7, marginTop: 14 }}>
                  {stats.total.toLocaleString()} ratings · avg{' '}
                  <span style={{ color: meta.color, fontWeight: 600 }}>
                    {stats.average.toFixed(2)} / 5
                  </span>
                </p>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* --- Subject ------------------------------------------------------ */}
      {showSubject && (
        <section style={{ marginBottom: 18 }}>
          <SectionLabel
            eyebrow="Step 2"
            title={subjectLabel}
            accent={meta.color}
          />
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value.slice(0, MAX_SUBJECT))}
            maxLength={MAX_SUBJECT}
            disabled={submitting}
            placeholder={kind === 'issue'
              ? "e.g. 'Star rating won't submit on iOS Safari'"
              : kind === 'recommendation'
              ? "e.g. 'Export journal entries as PDF'"
              : "e.g. 'Question about my subscription'"}
            style={inputStyle(meta.color)}
            autoComplete="off"
          />
          <CharCounter current={subject.length} max={MAX_SUBJECT} />
        </section>
      )}

      {/* --- Severity (issue only) --------------------------------------- */}
      <AnimatePresence initial={false} mode="wait">
        {kind === 'issue' && (
          <motion.section
            key="severity"
            initial={{ opacity: 0, y: 6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden', marginBottom: 18 }}
          >
            <SectionLabel eyebrow="Severity" title="How serious is this?" accent={meta.color} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {SEVERITY_OPTIONS.map((s) => {
                const active = severity === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setSeverity(s.value)}
                    disabled={submitting}
                    aria-pressed={active}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 999,
                      border: `1px solid ${active ? s.color : 'rgba(255,255,255,0.14)'}`,
                      background: active ? `${s.color}22` : 'rgba(255,255,255,0.04)',
                      color: active ? s.color : '#5a2d3e',
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      letterSpacing: '0.02em',
                      transition: 'all 200ms ease',
                      boxShadow: active ? `0 4px 16px ${s.color}33` : 'none',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* --- Message ------------------------------------------------------ */}
      <section style={{ marginBottom: 18 }}>
        <SectionLabel
          eyebrow={kind === 'rating' ? 'Comment' : 'Step 3'}
          title={messageLabel}
          accent={meta.color}
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
          maxLength={MAX_MESSAGE}
          disabled={submitting}
          rows={kind === 'rating' ? 3 : 6}
          placeholder={kind === 'rating'
            ? 'Share what made it click for you (or what didn’t).'
            : 'Tell us the details — the more we know, the better we can help.'}
          style={{ ...inputStyle(meta.color), resize: 'vertical', minHeight: 96 }}
        />
        <CharCounter current={message.length} max={MAX_MESSAGE} />
      </section>

      {/* --- Reply-to email ---------------------------------------------- */}
      <section style={{ marginBottom: 20 }}>
        <SectionLabel
          eyebrow={kind === 'contact' ? 'Reply-to' : 'Optional'}
          title={kind === 'contact' ? 'Where should we reply?' : 'Reply-to email'}
          accent={meta.color}
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          placeholder={defaultEmail || 'you@example.com'}
          style={inputStyle(meta.color)}
          inputMode="email"
          autoComplete="email"
        />
        <p style={{ ...bodyStyle, fontSize: 11.5, opacity: 0.7, marginTop: 6 }}>
          {kind === 'contact'
            ? 'We send all support replies by email.'
            : 'Defaults to the email on your account.'}
        </p>
      </section>

      {/* --- Error / rate-limit banner ------------------------------------ */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            role="alert"
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              background: 'rgba(248,113,113,0.12)',
              border: '1px solid rgba(248,113,113,0.35)',
              color: '#b91c1c',
              fontSize: 13,
              marginBottom: 14,
              fontWeight: 500,
            }}
          >
            {error}
            {retryIn > 0 && (
              <span style={{ marginLeft: 8, fontWeight: 600 }}>
                Retry in {retryIn}s.
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Submit ------------------------------------------------------- */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 8,
          marginTop: 4,
        }}
      >
        <button
          type="submit"
          disabled={!validation.ok || submitting || retryIn > 0}
          style={{
            ...primaryButton(meta.color),
            opacity: !validation.ok || submitting || retryIn > 0 ? 0.55 : 1,
            cursor: !validation.ok || submitting || retryIn > 0 ? 'not-allowed' : 'pointer',
          }}
          aria-disabled={!validation.ok || submitting || retryIn > 0}
        >
          {submitting ? (
            <>
              <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.45)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: 8, verticalAlign: 'middle' }} />
              Sending…
            </>
          ) : (
            <>
              {retryIn > 0 ? `Wait ${retryIn}s` : `Send ${meta.label.toLowerCase()}`}
            </>
          )}
        </button>

        {!validation.ok && (
          <p style={{ ...bodyStyle, fontSize: 12, opacity: 0.75, textAlign: 'center', margin: 0 }}>
            {validation.issues[0]}
          </p>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </form>
  );
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const SectionLabel: React.FC<{ eyebrow: string; title: string; accent: string }> = ({ eyebrow, title, accent }) => (
  <div style={{ marginBottom: 8 }}>
    <p
      style={{
        margin: 0,
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: accent,
        textShadow: '0 1px 2px rgba(0,0,0,0.05)',
      }}
    >
      {eyebrow}
    </p>
    <p
      style={{
        margin: '4px 0 0',
        fontFamily: "'Poppins', sans-serif",
        fontSize: 15,
        fontWeight: 600,
        color: 'var(--dash-heading, #3d1428)',
        letterSpacing: '-0.005em',
        textShadow: '0 1px 1px rgba(255,255,255,0.4)',
      }}
    >
      {title}
    </p>
  </div>
);

const CharCounter: React.FC<{ current: number; max: number }> = ({ current, max }) => {
  const close = current / max > 0.85;
  return (
    <div
      style={{
        marginTop: 4,
        fontSize: 11,
        textAlign: 'right',
        // Stay readable on both light (sakura) and dark (cosmic) surfaces.
        color: close ? '#fb923c' : 'var(--dash-subtle, #7e4151)',
        opacity: close ? 1 : 0.7,
        fontFamily: "'Inter', sans-serif",
      }}
      aria-live="polite"
    >
      {current.toLocaleString()} / {max.toLocaleString()}
    </div>
  );
};

// ============================================================================
// HELPERS
// ============================================================================

function validEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim().toLowerCase());
}

// ============================================================================
// STYLE TOKENS
// ============================================================================

const panelStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 24,
  padding: '1.5rem',
  backdropFilter: 'blur(30px)',
  WebkitBackdropFilter: 'blur(30px)',
  boxShadow: '0 8px 40px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.18)',
};

// Heading / body / input copy: route through CSS vars so flipping
// sakura ↔ cosmic in ThemeToggle re-skins the form without a remount.
// Sakura literal fallbacks are kept for first paint and for cases where
// the page is rendered outside a ThemeProvider (e.g. Storybook).

const headingStyle: React.CSSProperties = {
  fontFamily: "'Poppins', sans-serif",
  fontWeight: 700,
  fontSize: 22,
  color: 'var(--dash-heading, #3d1428)',
  textShadow: '0 1px 3px rgba(126,65,81,0.25)',
  margin: 0,
};

const bodyStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontSize: 14,
  color: 'var(--dash-body, #4a1a2e)',
  margin: 0,
  lineHeight: 1.6,
};

const inputStyle = (accent: string): React.CSSProperties => ({
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px 14px',
  borderRadius: 14,
  // The cosmic theme swaps from light glass surfaces to indigo so the
  // sakura's translucent-white input plate would become illegible. Reach
  // for a theme-aware surface var with the sakura value as default.
  background: 'var(--feedback-input-bg, rgba(255,255,255,0.65))',
  border: '1px solid var(--feedback-input-border, rgba(255,255,255,0.4))',
  fontFamily: "'Inter', sans-serif",
  fontSize: 14,
  color: 'var(--dash-heading, #3d1428)',
  outline: 'none',
  transition: 'border-color 180ms ease, box-shadow 180ms ease, background 180ms ease',
  WebkitAppearance: 'none',
  boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 1px 3px rgba(126,65,81,0.04)',
  // Note: :focus highlight is owned by FeedbackPage.tsx's <style> block
  // because pseudo-selectors aren't expressible in inline styles.
  caretColor: accent,
});

const primaryButton = (accent: string): React.CSSProperties => ({
  padding: '12px 24px',
  borderRadius: 14,
  background: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)`,
  color: '#fff',
  border: 'none',
  fontFamily: "'Inter', sans-serif",
  fontWeight: 600,
  fontSize: 14,
  letterSpacing: '0.01em',
  cursor: 'pointer',
  textShadow: '0 1px 1px rgba(0,0,0,0.18)',
  boxShadow: `0 8px 28px ${accent}55, inset 0 1px 0 rgba(255,255,255,0.25)`,
  transition: 'transform 150ms ease, box-shadow 200ms ease, opacity 150ms ease',
  WebkitTapHighlightColor: 'transparent',
});

const subPanel = (accent: string): React.CSSProperties => ({
  background: `linear-gradient(135deg, ${accent}10 0%, rgba(255,255,255,0.04) 100%)`,
  border: `1px solid ${accent}33`,
  borderRadius: 18,
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  padding: 14,
});

export default FeedbackForm;