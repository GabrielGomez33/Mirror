import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { getConsentStatus, acceptTerms } from '../../services/consentApi';
import { TERMS_VERSION, TERMS_PATH, TERMS_HREF, MINIMUM_AGE } from '../../config/legal';

/**
 * ConsentGate — re-acceptance backstop.
 *
 * Mounted once at the app root. For authenticated users, it checks the
 * latest Terms version the user has on record and, if it does not match
 * the current TERMS_VERSION, shows a blocking modal requiring acceptance.
 *
 * Covers two cases the registration checkbox cannot:
 *   1. Users who registered before consent tracking existed (no row).
 *   2. A material terms change (version bump) requiring re-acceptance.
 *
 * Fail-open by construction:
 *   - Unauthenticated users are never gated.
 *   - On the /termsandconditions route itself, the modal is suppressed so
 *     the user can read what they're agreeing to.
 *   - If the consent endpoint is unavailable (not yet deployed, network,
 *     5xx), the gate does NOT show — deploying the client ahead of the
 *     backend can never lock users out.
 *
 * Visual: emulates Mirror's glass-card-enhanced aesthetic (see
 * IOSInstallTutorial / VerifyEmailBanner) — dark text on light frosted
 * glass, gradient icon tile, pill buttons. Layout-critical dimensions are
 * inline-styled so global CSS can't break the proportions.
 */

// Sakura/violet accent to match Mirror's identity without copying the
// install (pink) or verify (amber) palettes verbatim.
const ACCENT_GRADIENT = 'linear-gradient(135deg, #a78bfa, #7c3aed)';
const ACCENT_SHADOW = '0 4px 12px rgba(124, 58, 237, 0.35)';
const INK = '#1a1024';
const INK_MUTED = 'rgba(26, 16, 36, 0.65)';

const ConsentGate: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  const [needsConsent, setNeedsConsent] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [checkedThisSession, setCheckedThisSession] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setCheckedThisSession(false);
      setNeedsConsent(false);
      return;
    }
    if (checkedThisSession) return;

    let cancelled = false;
    (async () => {
      const status = await getConsentStatus();
      if (cancelled) return;
      setCheckedThisSession(true);
      if (status.unavailable) return; // fail open
      if (status.termsVersion !== TERMS_VERSION) setNeedsConsent(true);
    })();

    return () => { cancelled = true; };
  }, [isAuthenticated, checkedThisSession]);

  const suppressed = !needsConsent || location.pathname === TERMS_PATH;

  // Lock body scroll while the modal is up (prevents background scroll bleed).
  useEffect(() => {
    if (suppressed) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [suppressed]);

  const handleAccept = async () => {
    if (!agreed || submitting) return;
    setSubmitting(true);
    setError('');
    const ok = await acceptTerms(TERMS_VERSION);
    setSubmitting(false);
    if (ok) setNeedsConsent(false);
    else setError('Could not record your acceptance. Please try again.');
  };

  if (suppressed) return null;

  return (
    <AnimatePresence>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-gate-title"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)',
        }}
      >
        {/* Backdrop */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(26, 16, 36, 0.55)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}
        />

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="glass-card-enhanced"
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 440,
            borderRadius: 24,
            color: INK,
            padding: 24,
            maxHeight: '88vh',
            overflowY: 'auto',
          }}
        >
          {/* Header: icon tile + title */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div
              aria-hidden="true"
              style={{
                width: 44,
                height: 44,
                flexShrink: 0,
                borderRadius: 12,
                background: ACCENT_GRADIENT,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: ACCENT_SHADOW,
                color: '#fff',
                fontSize: '1.35rem',
                fontWeight: 700,
              }}
            >
              ¶
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2
                id="consent-gate-title"
                style={{ fontSize: 19, fontWeight: 600, margin: 0, color: INK, lineHeight: 1.25 }}
              >
                Our Terms have been updated
              </h2>
              <p style={{ fontSize: 12.5, color: INK_MUTED, margin: '4px 0 0 0', lineHeight: 1.45 }}>
                Version {TERMS_VERSION}
              </p>
            </div>
          </div>

          {/* Body */}
          <p style={{ fontSize: 14, color: 'rgba(26,16,36,0.8)', lineHeight: 1.55, margin: '16px 0 0 0' }}>
            To keep using Mirror, please review and accept the current Terms &amp;
            Conditions. They cover how your data is handled, your privacy rights,
            and how disputes are resolved.
          </p>

          {/* Read link */}
          <a
            href={TERMS_HREF}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              marginTop: 12,
              fontSize: 13,
              fontWeight: 600,
              color: '#7c3aed',
              textDecoration: 'none',
            }}
          >
            Read the Terms &amp; Conditions
            <span aria-hidden="true">→</span>
          </a>

          {/* Consent checkbox */}
          <label
            htmlFor="consent-gate-agree"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              marginTop: 18,
              padding: '12px 14px',
              borderRadius: 14,
              background: 'rgba(124, 58, 237, 0.06)',
              border: '1px solid rgba(124, 58, 237, 0.18)',
              cursor: 'pointer',
              fontSize: 13.5,
              lineHeight: 1.45,
              color: INK,
            }}
          >
            <input
              id="consent-gate-agree"
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              style={{
                marginTop: 2,
                width: 18,
                height: 18,
                flexShrink: 0,
                accentColor: '#7c3aed',
                cursor: 'pointer',
              }}
            />
            <span>
              I am at least {MINIMUM_AGE} years old and I agree to the updated
              Terms &amp; Conditions.
            </span>
          </label>

          {error && (
            <p role="alert" style={{ marginTop: 10, fontSize: 12.5, color: '#b91c1c' }}>
              {error}
            </p>
          )}

          {/* Primary action */}
          <button
            type="button"
            onClick={handleAccept}
            disabled={!agreed || submitting}
            style={{
              width: '100%',
              marginTop: 18,
              borderRadius: 999,
              padding: '12px 20px',
              fontSize: 14,
              fontWeight: 600,
              border: 'none',
              cursor: !agreed || submitting ? 'not-allowed' : 'pointer',
              color: !agreed || submitting ? 'rgba(26, 16, 36, 0.4)' : '#ffffff',
              background: !agreed || submitting
                ? 'rgba(124, 58, 237, 0.15)'
                : ACCENT_GRADIENT,
              boxShadow: !agreed || submitting ? 'none' : ACCENT_SHADOW,
              transition: 'background 0.15s ease, box-shadow 0.15s ease',
            }}
          >
            {submitting ? 'Saving…' : 'Accept & continue'}
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ConsentGate;