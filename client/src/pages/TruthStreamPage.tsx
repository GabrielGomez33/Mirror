// src/pages/TruthStreamPage.tsx
// Main TruthStream page — delegates to sub-views based on context state
// Follows same layout pattern as MirrorGroupsPage (gradient + ZenGardenScene + glass header)

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSubscription } from '../context/SubscriptionContext';
import { TruthStreamProvider, useTruthStream, type TruthStreamView } from '../context/TruthStreamContext';
import TruthStreamOverview from '../components/truthstream/TruthStreamOverview';
import ProfileSetup from '../components/truthstream/ProfileSetup';
import ReviewQueue from '../components/truthstream/ReviewQueue';
import ReviewForm from '../components/truthstream/ReviewForm';
import AnalysisDashboard from '../components/truthstream/AnalysisDashboard';
import ReceivedReviews from '../components/truthstream/ReceivedReviews';
import GivenReviews from '../components/truthstream/GivenReviews';
import ZenBridgeScene from '../components/three/ZenBridgeScene';

// ============================================================================
// INLINE STYLE CONSTANTS (matching MirrorGroupsPage)
// ============================================================================

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

// ============================================================================
// HOOKS
// ============================================================================

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
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

// ============================================================================
// URL PARAM READER — reads ?view= and ?reviewId= for notification deep-links
// ============================================================================

const VALID_VIEWS: TruthStreamView[] = ['overview', 'profile-setup', 'queue', 'review', 'analysis', 'received', 'given'];

function URLParamReader() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { setView, setFocusReview } = useTruthStream();

  useEffect(() => {
    const viewParam = searchParams.get('view');
    const reviewIdParam = searchParams.get('reviewId');

    if (viewParam && VALID_VIEWS.includes(viewParam as TruthStreamView)) {
      setView(viewParam as TruthStreamView);
    }

    if (reviewIdParam) {
      setFocusReview(reviewIdParam);
    }

    // Clear query params after reading so back-navigation doesn't re-trigger
    if (viewParam || reviewIdParam) {
      setSearchParams({}, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

// ============================================================================
// ROUTER (delegates to sub-views)
// ============================================================================

function TruthStreamRouter() {
  const { currentView, error, clearError } = useTruthStream();

  return (
    <div style={{ maxWidth: '48rem', margin: '0 auto', paddingBottom: '8rem' }}>
      {/* Global error banner */}
      {error && (
        <div
          className="rounded-lg p-3 text-sm mb-4 flex items-center justify-between"
          style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}
        >
          <span>{error}</span>
          <button onClick={clearError} className="ml-3 text-xs opacity-70 hover:opacity-100">{'\u2715'}</button>
        </div>
      )}

      {currentView === 'overview' && <TruthStreamOverview />}
      {currentView === 'profile-setup' && <ProfileSetup />}
      {currentView === 'queue' && <ReviewQueue />}
      {currentView === 'review' && <ReviewForm />}
      {currentView === 'analysis' && <AnalysisDashboard />}
      {currentView === 'received' && <ReceivedReviews />}
      {currentView === 'given' && <GivenReviews />}
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function TruthStreamPage() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 640px)');
  const { isPremium, isTrialing, status, isLoading, openUpgradeModal, refreshSubscription } = useSubscription();
  const [showGate, setShowGate] = useState(false);
  // Whether we've completed at least one subscription check while on this page.
  // We must NOT decide access until the subscription has actually resolved —
  // SubscriptionContext starts with tier='free' and loads asynchronously, so the
  // first render is always "not premium" until the fetch lands. Gating on that
  // initial state is what made the premium wall flicker (block → redirect →
  // repeat) for users who ARE premium, until the fetch finally returned.
  const [checked, setChecked] = useState(false);

  const hasAccess = isPremium() || isTrialing() || status === 'past_due';

  // Force a fresh subscription read on landing, so a just-granted premium (or a
  // stale cached 'free') is reflected before we gate.
  useEffect(() => {
    let alive = true;
    refreshSubscription().finally(() => { if (alive) setChecked(true); });
    return () => { alive = false; };
  }, [refreshSubscription]);

  // Only show the gate once the subscription has RESOLVED and the user genuinely
  // lacks access. Clear it the moment access is confirmed.
  useEffect(() => {
    if (!checked || isLoading) return;
    if (!hasAccess) {
      setShowGate(true);
      const timer = setTimeout(() => navigate(-1), 2500);
      return () => clearTimeout(timer);
    }
    setShowGate(false);
  }, [checked, isLoading, hasAccess, navigate]);

  // While the subscription is still resolving, show a neutral loader — never the
  // premium gate — so a premium user is never bounced mid-load.
  if (!checked || isLoading) {
    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a0a10, #2d1220, #1a0a15)',
        color: 'rgba(255,255,255,0.7)', fontFamily: "'Inter', sans-serif", fontSize: '0.95rem', zIndex: 9999,
      }}>
        Loading TruthStream…
      </div>
    );
  }

  if (showGate) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1a0a10, #2d1220, #1a0a15)',
          zIndex: 9999,
        }}
      >
        <div
          style={{
            textAlign: 'center',
            padding: '40px',
            borderRadius: '24px',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(20px)',
            maxWidth: '400px',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <h2 style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: '1.5rem',
            fontWeight: 600,
            color: '#fff',
            marginBottom: '8px',
          }}>
            Premium Feature
          </h2>
          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '0.9rem',
            color: 'rgba(255, 255, 255, 0.6)',
            marginBottom: '20px',
            lineHeight: 1.5,
          }}>
            TruthStream is available exclusively for Premium members. Upgrade to unlock anonymous peer reviews, Truth Mirror reports, and deep self-insight.
          </p>
          <button
            onClick={() => { openUpgradeModal('truthstream'); }}
            style={{
              padding: '10px 28px',
              borderRadius: '9999px',
              border: 'none',
              background: 'linear-gradient(135deg, #ff69b4, #ff1493)',
              color: '#fff',
              fontFamily: "'Inter', sans-serif",
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: '12px',
            }}
          >
            Upgrade to Premium
          </button>
          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '0.7rem',
            color: 'rgba(255, 255, 255, 0.3)',
          }}>
            Redirecting back...
          </p>
        </div>
      </div>
    );
  }

  return (
    <TruthStreamProvider>
      <URLParamReader />
      {/* Global scrollbar hide */}
      <style>{`
        .truthstream-page { scrollbar-width: none; -ms-overflow-style: none; }
        .truthstream-page::-webkit-scrollbar { display: none; }
        .truthstream-page *, .truthstream-page *::before, .truthstream-page *::after {
          scrollbar-width: none; -ms-overflow-style: none;
        }
        .truthstream-page *::-webkit-scrollbar { display: none; }
      `}</style>

      <div
        className="truthstream-page"
        style={{
          minHeight: '100vh',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background gradient + Three.js scene */}
        <div style={{ position: 'absolute', inset: 0, background: 'var(--mg-page-bg, linear-gradient(135deg, #fff1f2, #fce7f3, #f3e8ff))' }} />
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <ZenBridgeScene />
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
          <div style={{ maxWidth: '72rem', margin: '0 auto' }}>

            {/* Header panel with back button */}
            <div style={{ ...GLASS_PANEL, marginBottom: isMobile ? '0.75rem' : '1.5rem' }}>
              <button
                onClick={() => navigate('/dashboard')}
                type="button"
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
                {'\u2190'} Back to Dashboard
              </button>

              <h1
                style={{
                  fontSize: isMobile ? '1.5rem' : '1.75rem',
                  fontWeight: 700,
                  color: COLORS.heading,
                  textShadow: '0 3px 12px rgba(0, 0, 0, .4), 0 1px 3px rgba(255, 255, 255, .15)',
                  margin: 0,
                }}
              >
                TruthStream
              </h1>
              <p
                style={{
                  fontSize: '0.85rem',
                  color: COLORS.body,
                  textShadow: '0 3px 12px rgba(0, 0, 0, .4), 0 1px 3px rgba(255, 255, 255, .15)',
                  margin: '4px 0 0',
                }}
              >
                Anonymous peer reviews for genuine self-discovery
              </p>
            </div>

            {/* Sub-view content */}
            <TruthStreamRouter />

          </div>
        </div>
      </div>
    </TruthStreamProvider>
  );
}