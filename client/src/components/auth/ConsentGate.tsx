import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getConsentStatus, acceptTerms } from '../../services/consentApi';
import { TERMS_VERSION, TERMS_PATH, MINIMUM_AGE } from '../../config/legal';

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
 * A freshly-registered user already accepted via RegistrationStep, so this
 * gate stays silent for them.
 */
const ConsentGate: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  const [needsConsent, setNeedsConsent] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // Avoid re-checking on every navigation; one check per authenticated session.
  const [checkedThisSession, setCheckedThisSession] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      // Reset so a future login re-checks.
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
      // Fail open: never block when the endpoint is unavailable.
      if (status.unavailable) return;
      if (status.termsVersion !== TERMS_VERSION) {
        setNeedsConsent(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, checkedThisSession]);

  const handleAccept = async () => {
    if (!agreed || submitting) return;
    setSubmitting(true);
    setError('');
    const ok = await acceptTerms(TERMS_VERSION);
    setSubmitting(false);
    if (ok) {
      setNeedsConsent(false);
    } else {
      setError('Could not record your acceptance. Please try again.');
    }
  };

  // Suppress on the Terms page so the user can read the document, and
  // whenever there's nothing to ask.
  if (!needsConsent || location.pathname === TERMS_PATH) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-gate-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(8, 6, 20, 0.72)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/15 bg-gradient-to-br from-indigo-900/90 to-purple-900/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop-blur-xl"
      >
        <h2
          id="consent-gate-title"
          className="text-xl font-semibold text-white"
          style={{ fontFamily: 'Poppins, Inter, sans-serif' }}
        >
          Our Terms have been updated
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-white/80">
          To keep using Mirror, please review and accept the current Terms &amp;
          Conditions ({TERMS_VERSION}). They cover how your data is handled,
          your privacy rights, and how disputes are resolved.
        </p>

        <a
          href={TERMS_PATH}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm font-semibold text-indigo-300 underline hover:text-indigo-200"
        >
          Read the Terms &amp; Conditions →
        </a>

        <label
          htmlFor="consent-gate-agree"
          className="mt-5 flex cursor-pointer items-start gap-3 text-sm text-white/90"
        >
          <input
            id="consent-gate-agree"
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-2 border-white/30 bg-white/10 accent-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300/50"
          />
          <span className="leading-relaxed">
            I am at least {MINIMUM_AGE} years old and I agree to the updated
            Terms &amp; Conditions.
          </span>
        </label>

        {error && (
          <p className="mt-3 text-sm text-rose-300" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleAccept}
          disabled={!agreed || submitting}
          className={`mt-5 w-full rounded-xl py-3 text-base font-semibold transition-all duration-300 ${
            !agreed || submitting
              ? 'cursor-not-allowed bg-white/10 text-white/40'
              : 'bg-gradient-to-r from-indigo-400 to-purple-400 text-white hover:from-indigo-300 hover:to-purple-300'
          }`}
        >
          {submitting ? 'Saving…' : 'Accept & continue'}
        </button>
      </div>
    </div>
  );
};

export default ConsentGate;