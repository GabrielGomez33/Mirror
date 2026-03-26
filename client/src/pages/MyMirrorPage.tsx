// src/pages/MyMirrorPage.tsx
// Full-page MyMirror view — follows same layout pattern as TruthStreamPage
// (gradient + Three.js scene + glass header + back to dashboard)

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MyMirrorPanel } from '../components/home/MyMirrorPanel';
import SakuraForestScene from '../components/three/SakuraForestScene';
import '../styles/enhanced-glass.css';

// ============================================================================
// INLINE STYLE CONSTANTS (matching TruthStreamPage / MirrorGroupsPage)
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
// MAIN PAGE
// ============================================================================

export default function MyMirrorPage() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 640px)');

  return (
    <>
      {/* Global scrollbar hide */}
      <style>{`
        .mymirror-page { scrollbar-width: none; -ms-overflow-style: none; }
        .mymirror-page::-webkit-scrollbar { display: none; }
        .mymirror-page *, .mymirror-page *::before, .mymirror-page *::after {
          scrollbar-width: none; -ms-overflow-style: none;
        }
        .mymirror-page *::-webkit-scrollbar { display: none; }
      `}</style>

      <div
        className="mymirror-page"
        style={{
          minHeight: '100vh',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background gradient + Three.js scene */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #fff1f2, #fce7f3, #f3e8ff)' }} />
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
          <div style={{ maxWidth: '48rem', margin: '0 auto' }}>

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
                MyMirror
              </h1>
              <p
                style={{
                  fontSize: '0.85rem',
                  color: COLORS.body,
                  textShadow: '0 3px 12px rgba(0, 0, 0, .4), 0 1px 3px rgba(255, 255, 255, .15)',
                  margin: '4px 0 0',
                }}
              >
                Your personal intelligence dashboard
              </p>
            </div>

            {/* Mirror content */}
            <div style={{ paddingBottom: '4rem' }}>
              <MyMirrorPanel />
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
