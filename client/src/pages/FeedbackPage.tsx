// ============================================================================
// FEEDBACK & SUPPORT PAGE
// ============================================================================
// File: client/src/pages/FeedbackPage.tsx
// ----------------------------------------------------------------------------
// Full-page experience for Goal #1. Follows the same shell pattern as
// MyJournalPage / MyMirrorPage / TruthStreamPage:
//   * Theme-aware backdrop (sakura pastel / cosmic indigo via --mg-page-bg)
//   * Theme-aware Three.js sakura scene (auto-swaps to its cosmic variant)
//   * Glass header with "← Back to Dashboard"
//   * Below the form: the user's own submission history
// ============================================================================

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SakuraForestScene from '../components/three/SakuraForestScene';
import FeedbackForm from '../components/feedback/FeedbackForm';
import MyFeedbackHistory from '../components/feedback/MyFeedbackHistory';
import { useAuth } from '../context/AuthContext';

// ----------------------------------------------------------------------------
// STYLE CONSTANTS (parity with MyMirrorPage / MyJournalPage)
// ----------------------------------------------------------------------------
// Colour reads route through CSS custom properties so the page automatically
// re-skins when the user flips between sakura ↔ cosmic via ThemeToggle.
// Inline literal fallbacks mirror sakura defaults for safety on first paint
// before ThemeContext mounts.

const COLORS = {
  heading: 'var(--dash-heading, #3d1428)',
  body: 'var(--dash-body, #2e1018)',
};

const GLASS_PANEL: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.06)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: 24,
  padding: '1.25rem',
  backdropFilter: 'blur(30px)',
  WebkitBackdropFilter: 'blur(30px)',
  boxShadow: '0 8px 40px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.18)',
};

// ----------------------------------------------------------------------------
// HOOKS
// ----------------------------------------------------------------------------

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener('change', handler);
    setMatches(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

// ----------------------------------------------------------------------------
// PAGE
// ----------------------------------------------------------------------------

const FeedbackPage: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 640px)');
  const { user } = useAuth();
  const [historyKey, setHistoryKey] = useState(0);

  return (
    <>
      {/* Page-scoped style: theme tokens + input focus rings + scrollbar hide.
          We declare a small set of feedback-only custom properties that
          shadow the theme-wide ones — the FeedbackForm reads them via
          var(--feedback-input-bg, ...) so flipping themes re-skins inputs
          without remounting any React state. */}
      <style>{`
        .feedback-page {
          /* Sakura: translucent white glass plates */
          --feedback-input-bg: rgba(255,255,255,0.65);
          --feedback-input-bg-focus: rgba(255,255,255,0.78);
          --feedback-input-border: rgba(255,255,255,0.4);
          --feedback-focus-ring: rgba(167, 139, 250, 0.7);
          --feedback-focus-glow: rgba(167, 139, 250, 0.18);
          --feedback-placeholder: rgba(126, 65, 81, 0.5);

          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        [data-theme='cosmic'] .feedback-page {
          /* Cosmic: dark indigo glass — keep contrast against the night bg.
             Lifting alpha + lightening border so input fields read on a
             dark backdrop without becoming a flat white block. */
          --feedback-input-bg: rgba(34, 44, 86, 0.55);
          --feedback-input-bg-focus: rgba(46, 58, 110, 0.7);
          --feedback-input-border: rgba(170, 179, 230, 0.28);
          --feedback-focus-ring: rgba(165, 180, 252, 0.7);
          --feedback-focus-glow: rgba(165, 180, 252, 0.22);
          --feedback-placeholder: rgba(214, 222, 255, 0.45);
        }
        .feedback-page::-webkit-scrollbar { display: none; }
        .feedback-page *, .feedback-page *::before, .feedback-page *::after {
          scrollbar-width: none; -ms-overflow-style: none;
        }
        .feedback-page *::-webkit-scrollbar { display: none; }

        .feedback-page input:focus,
        .feedback-page textarea:focus {
          border-color: var(--feedback-focus-ring) !important;
          background: var(--feedback-input-bg-focus) !important;
          box-shadow:
            0 0 0 4px var(--feedback-focus-glow),
            0 4px 16px rgba(0, 0, 0, 0.06) !important;
        }
        .feedback-page input::placeholder,
        .feedback-page textarea::placeholder {
          color: var(--feedback-placeholder);
        }

        @media (prefers-reduced-motion: reduce) {
          .feedback-page * {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      <div
        className="feedback-page"
        style={{
          minHeight: '100vh',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Theme-aware backdrop (sakura pastel / cosmic indigo) */}
        <div style={{ position: 'absolute', inset: 0, background: 'var(--mg-page-bg, linear-gradient(135deg, #fff1f2, #fce7f3, #f3e8ff))' }} />

        {/* Three.js ambient scene — auto-swaps sakura ↔ cosmic via ThemeContext */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <SakuraForestScene />
        </div>

        {/* Content */}
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            minHeight: '100vh',
            padding: isMobile ? '0.75rem' : '1.5rem',
          }}
        >
          <div style={{ maxWidth: '56rem', margin: '0 auto' }}>
            {/* Header card */}
            <div style={{ ...GLASS_PANEL, marginBottom: isMobile ? '0.75rem' : '1.25rem' }}>
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '0.5rem 1rem',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  cursor: 'pointer',
                  marginBottom: '1rem',
                  color: COLORS.heading,
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {'←'} Back to Dashboard
              </button>

              <h1
                style={{
                  fontSize: isMobile ? '1.5rem' : '1.85rem',
                  fontWeight: 700,
                  color: COLORS.heading,
                  textShadow: '0 3px 12px rgba(0, 0, 0, .4), 0 1px 3px rgba(255, 255, 255, .15)',
                  margin: 0,
                  fontFamily: "'Poppins', sans-serif",
                  letterSpacing: '-0.01em',
                }}
              >
                Feedback &amp; Support
              </h1>
              <p
                style={{
                  fontSize: '0.92rem',
                  color: COLORS.body,
                  textShadow: '0 3px 12px rgba(0, 0, 0, .4), 0 1px 3px rgba(255, 255, 255, .15)',
                  margin: '6px 0 0',
                  fontFamily: "'Inter', sans-serif",
                  lineHeight: 1.55,
                }}
              >
                Rate Mirror, report an issue, share an idea, or reach out to a human.
                Every note goes to the team.
              </p>
            </div>

            {/* Form */}
            <div style={{ marginBottom: '1.25rem' }}>
              <FeedbackForm
                defaultEmail={user?.email}
                onSubmitted={() => setHistoryKey((k) => k + 1)}
              />
            </div>

            {/* User's own history */}
            <div style={{ paddingBottom: '4rem' }}>
              <MyFeedbackHistory refreshKey={historyKey} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default FeedbackPage;