// src/pages/Dashboard.tsx
// Main dashboard — mobile-first, inline-styled, no scrollbars

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/enhanced-glass.css';
import ZenPondScene from '../components/three/ZenPondScene';
import MagicalSphereNavigation from '../components/home/MagicalSphereNavigation';
import { TruthStreamPanel } from '../components/home/EnhancedDashboardPanels';
import { MyMirrorPanel } from '../components/home/MyMirrorPanel';
import { MyJournalPanel } from '../components/home/MyJournalPanel';
import { useGroups } from '../context/GroupContext';
import CreateGroupModal from '../components/mirrorgroups/CreateGroupModal';

// ============================================================================
// INLINE STYLE CONSTANTS
// ============================================================================

const COLORS = {
  heading: 'rgb(120, 69, 82)',
  body: '#7e4151',
  label: '#6a1f33',
  panelBg: 'rgba(255, 255, 255, 0.06)',
  panelBorder: 'rgba(255, 255, 255, 0.12)',
  textShadow: '0 3px 12px rgba(0, 0, 0, .4), 0 1px 3px rgba(255, 255, 255, .15)',
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
// MOCK DATA
// ============================================================================

const mockReviews = [
  {
    id: '1',
    reviewer: 'Alex Chen',
    reviewerAvatar: '\u{1F468}\u200D\u{1F4BB}',
    type: 'strength' as const,
    content: 'Your ability to listen actively in our group discussions is remarkable. You always make sure everyone feels heard before sharing your own thoughts.',
    timestamp: '2 hours ago',
    helpful: 8,
    category: 'Communication'
  },
  {
    id: '2',
    reviewer: 'Maria Rodriguez',
    reviewerAvatar: '\u{1F469}\u200D\u{1F3A8}',
    type: 'opportunity' as const,
    content: 'I noticed you tend to undersell your achievements when sharing wins with the group. Your accomplishments deserve more celebration!',
    timestamp: '5 hours ago',
    helpful: 12,
    category: 'Self-Confidence'
  },
  {
    id: '3',
    reviewer: 'Jordan Kim',
    reviewerAvatar: '\u{1F9D1}\u200D\u{1F52C}',
    type: 'potential' as const,
    content: 'Your natural empathy combined with your analytical thinking could make you an excellent mentor. Have you considered leading a growth circle?',
    timestamp: '1 day ago',
    helpful: 15,
    category: 'Leadership'
  },
  {
    id: '4',
    reviewer: 'Anonymous',
    reviewerAvatar: '\u{1F3AD}',
    type: 'opportunity' as const,
    content: 'From our MirrorAnonym session: You have incredible insights but sometimes wait too long to share them. The group would benefit from hearing your thoughts sooner.',
    timestamp: '2 days ago',
    helpful: 9,
    category: 'Group Participation'
  }
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Dashboard() {
  const navigate = useNavigate();
  const [activePanel, setActivePanel] = useState('myjournal');
  const [reviews, setReviews] = useState(mockReviews);
  const [hasMoreReviews, setHasMoreReviews] = useState(true);
  const isMobile = useMediaQuery('(max-width: 640px)');

  const {
    showCreateModal,
    setShowCreateModal,
  } = useGroups();

  const handleLoadMore = () => {
    setTimeout(() => {
      const newReviews = [
        {
          id: Math.random().toString(),
          reviewer: 'Chris Taylor',
          reviewerAvatar: '\u{1F469}\u200D\u{1F4BC}',
          type: 'strength' as const,
          content: 'Your follow-through on commitments is exceptional. When you say you\'ll do something, it gets done.',
          timestamp: '3 days ago',
          helpful: 6,
          category: 'Reliability'
        }
      ];
      setReviews(prev => [...prev, ...newReviews]);
      if (reviews.length > 8) setHasMoreReviews(false);
    }, 1000);
  };

  const handleGroupCreated = useCallback((_groupId: string) => {
    navigate('/groups');
  }, [navigate]);

  // Panel max-widths for each section
  const panelMaxWidth = activePanel === 'myjournal' ? '56rem'
    : activePanel === 'truthstream' ? '48rem'
    : '32rem';

  const renderActivePanel = () => {
    switch (activePanel) {
      case 'mymirror':
        return <MyMirrorPanel />;
      case 'myjournal':
        return <MyJournalPanel />;
      case 'truthstream':
        return (
          <TruthStreamPanel reviews={reviews} onLoadMore={handleLoadMore} hasMore={hasMoreReviews} />
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* Global scrollbar hide for dashboard */}
      <style>{`
        .dashboard-root { scrollbar-width: none; -ms-overflow-style: none; }
        .dashboard-root::-webkit-scrollbar { display: none; }
        .dashboard-root *, .dashboard-root *::before, .dashboard-root *::after {
          scrollbar-width: none; -ms-overflow-style: none;
        }
        .dashboard-root *::-webkit-scrollbar { display: none; }
      `}</style>

      <div
        className="dashboard-root"
        style={{
          minHeight: '100vh',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background layers */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, #fff1f2, #fce7f3, #f3e8ff)',
          }}
        />
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <ZenPondScene />
        </div>

        {/* Main content area */}
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            minHeight: '100vh',
            display: 'flex',
            justifyContent: 'center',
            padding: isMobile ? '0.75rem 0.75rem 8rem' : '1.5rem 1rem 8rem',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: panelMaxWidth,
            }}
          >
            {renderActivePanel()}
          </div>
        </div>

        {/* Sphere Navigation */}
        <MagicalSphereNavigation
          activePanel={activePanel}
          onPanelChange={(panelId) => {
            if (panelId === 'mirrorgroups') {
              navigate('/groups');
            } else {
              setActivePanel(panelId);
            }
          }}
        />

        {/* TruthStream notification badge */}
        {activePanel === 'truthstream' && reviews.length > 0 && (
          <div
            style={{
              position: 'fixed',
              top: isMobile ? 12 : 24,
              left: isMobile ? 12 : 24,
              zIndex: 50,
            }}
          >
            <div
              style={{
                ...glassChip,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #f472b6, #a78bfa)',
                  boxShadow: '0 0 8px rgba(244,114,182,0.6)',
                }}
              />
              <span style={{ fontSize: '0.8rem', fontWeight: 500, color: COLORS.heading }}>
                {reviews.length} new insights
              </span>
            </div>
          </div>
        )}

        {/* Create Group Modal */}
        {showCreateModal && (
          <CreateGroupModal
            onClose={() => setShowCreateModal(false)}
            onGroupCreated={handleGroupCreated}
          />
        )}
      </div>
    </>
  );
}

// Small glass chip style for notification badge
const glassChip: React.CSSProperties = {
  padding: '0.5rem 1rem',
  borderRadius: 12,
  background: 'rgba(255,255,255,0.06)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.12)',
};
