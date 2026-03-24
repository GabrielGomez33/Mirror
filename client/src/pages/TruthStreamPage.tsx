// src/pages/TruthStreamPage.tsx
// Main TruthStream page — delegates to sub-views based on context state
// Follows same layout pattern as MirrorGroupsPage (gradient + ZenGardenScene + glass header)

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TruthStreamProvider, useTruthStream, type TruthStreamView } from '../context/TruthStreamContext';
import TruthStreamOverview from '../components/truthstream/TruthStreamOverview';
import ProfileSetup from '../components/truthstream/ProfileSetup';
import ReviewQueue from '../components/truthstream/ReviewQueue';
import ReviewForm from '../components/truthstream/ReviewForm';
import AnalysisDashboard from '../components/truthstream/AnalysisDashboard';
import ReceivedReviews from '../components/truthstream/ReceivedReviews';
import GivenReviews from '../components/truthstream/GivenReviews';
import ZenBridgeScene from '../components/three/ZenBridgeScene';
import '../styles/enhanced-glass.css';

// ============================================================================
// INLINE STYLE CONSTANTS (matching MirrorGroupsPage)
// ============================================================================

const COLORS = {
  heading: '#3d1428',
  body: '#2e1018',
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
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #fff1f2, #fce7f3, #f3e8ff)' }} />
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
