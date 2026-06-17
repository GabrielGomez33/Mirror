// src/pages/MirrorGroupsPage.tsx
// Main MirrorGroups page — mobile-first, inline-styled, no scrollbars

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGroups } from '../context/GroupContext';
import { isWebSocketConnected } from '../services/groupsWebSocket';
import CreateGroupModal from '../components/mirrorgroups/CreateGroupModal';
import GroupDetailView from '../components/mirrorgroups/GroupDetailView';
import ScrollToTopButton from '../components/ScrollToTopButton';
import ZenPondScene2 from '../components/three/ZenPondScene2';
import type { Group, GroupType } from '../types/groups';
import { searchPublicGroups } from '../services/groupsApi';

// ============================================================================
// INLINE STYLE CONSTANTS
// ============================================================================

const COLORS = {
  heading: 'var(--mg-heading, rgb(120, 69, 82))',
  body: 'var(--mg-body, #7e4151)',
  label: 'var(--mg-label, #6a1f33)',
  cardBg: 'rgba(255, 255, 255, 0.04)',
  cardBgHover: 'rgba(255, 255, 255, 0.07)',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  cardBorderHover: 'rgba(255, 255, 255, 0.16)',
  panelBg: 'rgba(255, 255, 255, 0.06)',
  panelBorder: 'rgba(255, 255, 255, 0.12)',
  inputBg: 'rgba(255, 255, 255, 0.08)',
  inputBorder: 'rgba(255, 255, 255, 0.18)',
  inputFocus: 'rgba(236, 72, 153, 0.5)',
  badgeGreen: 'rgba(74, 222, 128, 0.15)',
  badgeAmber: 'rgba(251, 191, 36, 0.15)',
  badgeRed: 'rgba(248, 113, 113, 0.15)',
  textShadow: '0 3px 12px rgba(0, 0, 0, .4), 0 1px 3px rgba(255, 255, 255, .15)',
};

const GLASS_PANEL: React.CSSProperties = {
  background: COLORS.panelBg,
  border: `1px solid ${COLORS.panelBorder}`,
  borderRadius: 24,
  padding: '1.25rem',
  WebkitBackdropFilter: 'blur(30px)',
  boxShadow: '0 8px 40px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.18)',
};

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem 1rem 0.75rem 2.5rem',
  borderRadius: 12,
  background: COLORS.inputBg,
  border: `1px solid ${COLORS.inputBorder}`,
  color: '#fff',
  fontSize: '0.875rem',
  outline: 'none',
  WebkitAppearance: 'none',
  boxSizing: 'border-box',
};

const SELECT_STYLE: React.CSSProperties = {
  padding: '0.75rem 1rem',
  borderRadius: 12,
  background: COLORS.inputBg,
  border: `1px solid ${COLORS.inputBorder}`,
  color: '#fff',
  fontSize: '0.875rem',
  outline: 'none',
  WebkitAppearance: 'none',
  minWidth: 0,
  boxSizing: 'border-box',
};

// ============================================================================
// HOOKS: useMediaQuery
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
// SUB-COMPONENTS
// ============================================================================

type ViewMode = 'my-groups' | 'directory';

interface GroupCardProps {
  group: Group;
  onClick: () => void;
  getGroupIcon: (t: Group['type']) => string;
}

function GroupCard({ group, onClick, getGroupIcon }: GroupCardProps) {
  const [hovered, setHovered] = useState(false);

  const privacyColor = {
    public: { bg: 'rgba(74, 222, 128, 0.12)', border: 'rgba(74, 222, 128, 0.3)', text: '#86efac' },
    private: { bg: 'rgba(251, 191, 36, 0.12)', border: 'rgba(251, 191, 36, 0.3)', text: '#fde68a' },
    secret: { bg: 'rgba(248, 113, 113, 0.12)', border: 'rgba(248, 113, 113, 0.3)', text: '#fca5a5' },
  }[group.privacy] || { bg: 'rgba(251, 191, 36, 0.12)', border: 'rgba(251, 191, 36, 0.3)', text: '#fde68a' };

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      type="button"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.875rem',
        width: '100%',
        textAlign: 'left',
        padding: '1rem',
        borderRadius: 16,
        background: hovered ? COLORS.cardBgHover : COLORS.cardBg,
        border: `1px solid ${hovered ? COLORS.cardBorderHover : COLORS.cardBorder}`,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.12)' : 'none',
        outline: 'none',
        WebkitTapHighlightColor: 'transparent',
        backdropFilter: 'blur(30px)'
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 48,
          height: 48,
          minWidth: 48,
          borderRadius: 12,
          background: `linear-gradient(135deg, ${privacyColor.bg}, rgba(168, 85, 247, 0.1))`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem',
        }}
      >
        {getGroupIcon(group.type)}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* 2-line clamp so long names wrap instead of being cut off
            mid-word; matches the "My Groups" card style. */}
        <p
          style={{
            fontWeight: 600,
            fontSize: '0.95rem',
            color: COLORS.heading,
            margin: 0,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            lineHeight: 1.3,
            wordBreak: 'break-word',
          }}
        >
          {group.name}
        </p>
        <p
          style={{
            fontSize: '0.75rem',
            color: COLORS.body,
            margin: '4px 0 8px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            lineHeight: 1.4,
          }}
        >
          {group.description || 'No description'}
        </p>

        {/* Meta row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.7rem', color: COLORS.label }}>
            {'\u{1F465}'} {group.memberCount}
          </span>
          {group.goal && (
            <span
              style={{
                fontSize: '0.65rem',
                padding: '2px 6px',
                borderRadius: 99,
                background: 'rgba(168, 85, 247, 0.1)',
                color: '#c084fc',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 120,
              }}
              title={group.goal}
            >
              {'\u{1F3AF}'} {group.goal}
            </span>
          )}
          <span style={{ fontSize: '0.65rem', color: COLORS.label }}>
            {formatRelativeTime(group.lastActivity)}
          </span>
        </div>
      </div>
    </button>
  );
}

interface DirectoryCardProps {
  group: Group;
  isAlreadyMember: boolean;
  getGroupIcon: (t: Group['type']) => string;
  onView: () => void;
  onJoin: () => void;
}

function DirectoryCard({ group, isAlreadyMember, getGroupIcon, onView, onJoin }: DirectoryCardProps) {
  const [hovered, setHovered] = useState(false);

  const privacyBadge = {
    public: { text: 'Public', bg: COLORS.badgeGreen, border: 'rgba(74,222,128,0.3)', color: '#86efac' },
    private: { text: 'Private', bg: COLORS.badgeAmber, border: 'rgba(251,191,36,0.3)', color: '#fde68a' },
    secret: { text: 'Secret', bg: COLORS.badgeRed, border: 'rgba(248,113,113,0.3)', color: '#fca5a5' },
  }[group.privacy] || { text: 'Private', bg: COLORS.badgeAmber, border: 'rgba(251,191,36,0.3)', color: '#fde68a' };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '1rem',
        borderRadius: 16,
        background: hovered ? COLORS.cardBgHover : COLORS.cardBg,
        border: `1px solid ${hovered ? COLORS.cardBorderHover : COLORS.cardBorder}`,
        transition: 'all 0.2s ease',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.12)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
        <div
          style={{
            width: 48,
            height: 48,
            minWidth: 48,
            borderRadius: 12,
            background: `linear-gradient(135deg, ${privacyBadge.bg}, rgba(168,85,247,0.1))`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
          }}
        >
          {getGroupIcon(group.type)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <p
              style={{
                fontWeight: 600,
                fontSize: '0.95rem',
                color: COLORS.heading,
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {group.name}
            </p>
            <span
              style={{
                fontSize: '0.6rem',
                padding: '1px 6px',
                borderRadius: 99,
                background: privacyBadge.bg,
                border: `1px solid ${privacyBadge.border}`,
                color: privacyBadge.color,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {privacyBadge.text}
            </span>
          </div>
          <p
            style={{
              fontSize: '0.75rem',
              color: COLORS.body,
              margin: '0 0 6px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              lineHeight: 1.4,
            }}
          >
            {group.description || 'No description'}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.7rem', color: COLORS.label }}>
              {'\u{1F465}'} {group.memberCount}/{group.maxMembers}
            </span>
            <span
              style={{
                fontSize: '0.6rem',
                padding: '1px 6px',
                borderRadius: 99,
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.5)',
              }}
            >
              {getGroupIcon(group.type)} {group.type}
            </span>
          </div>
          {group.goal && (
            <p
              style={{
                fontSize: '0.65rem',
                marginTop: 6,
                padding: '2px 8px',
                borderRadius: 99,
                background: 'rgba(168,85,247,0.1)',
                color: '#c084fc',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'inline-block',
                maxWidth: '100%',
              }}
              title={group.goal}
            >
              {'\u{1F3AF}'} {group.goal}
            </p>
          )}
        </div>
      </div>

      {/* Action */}
      {isAlreadyMember ? (
        <button
          onClick={onView}
          type="button"
          style={{
            width: '100%',
            padding: '0.5rem',
            borderRadius: 10,
            background: 'rgba(74,222,128,0.08)',
            border: '1px solid rgba(74,222,128,0.2)',
            color: '#86efac',
            fontSize: '0.8rem',
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          Already a Member — View
        </button>
      ) : (
        <button
          onClick={onJoin}
          type="button"
          style={{
            width: '100%',
            padding: '0.5rem',
            borderRadius: 10,
            background: 'linear-gradient(135deg, rgba(236,72,153,0.15), rgba(168,85,247,0.15))',
            border: '1px solid rgba(236,72,153,0.3)',
            color: COLORS.label,
            fontSize: '0.8rem',
            fontWeight: 500,
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          Request to Join
        </button>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MirrorGroupsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    myGroups,
    suggestedGroups,
    isLoading,
    error,
    fetchMyGroups,
    fetchSuggestedGroups,
    joinGroup,
  } = useGroups();

  // Poll actual WebSocket readyState directly every 2s for reliable live/offline dot
  const [wsLive, setWsLive] = useState(() => isWebSocketConnected());
  useEffect(() => {
    const id = setInterval(() => setWsLive(isWebSocketConnected()), 2000);
    return () => clearInterval(id);
  }, []);

  const [showCreateModal, setShowCreateModal] = useState(false);
  // Phase 6a.7: prefer ?groupId=<id> from the URL query when present so
  // deep-links from push notifications (e.g. chat_message taps) open the
  // exact group. Fall back to location.state for in-app `navigate('/groups',
  // { state: { selectedGroupId } })` callers.
  const initialGroupId = (() => {
    const query = new URLSearchParams(location.search);
    const fromQuery = query.get('groupId');
    if (fromQuery) return fromQuery;
    return (location.state as { selectedGroupId?: string } | null)?.selectedGroupId || null;
  })();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialGroupId);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('my-groups');

  // Phase 6a.7: react to ?groupId= changing while we're already on this
  // page. Covers the case where the user tapped a push notification
  // while the app was open on /groups — React Router doesn't remount the
  // page, so the useState initializer above only runs once. This effect
  // syncs selectedGroupId whenever the query string updates.
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const fromQuery = query.get('groupId');
    if (fromQuery && fromQuery !== selectedGroupId) {
      setSelectedGroupId(fromQuery);
    }
  }, [location.search]);

  // Directory state
  const [directoryGroups, setDirectoryGroups] = useState<Group[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directorySearchQuery, setDirectorySearchQuery] = useState('');
  const [directoryFilterType, setDirectoryFilterType] = useState<string>('all');
  const [directoryTotal, setDirectoryTotal] = useState(0);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Responsive breakpoint
  const isMobile = useMediaQuery('(max-width: 640px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');

  // Stable polling refs
  const fetchMyGroupsRef = useRef(fetchMyGroups);
  const fetchSuggestedGroupsRef = useRef(fetchSuggestedGroups);

  useEffect(() => {
    fetchMyGroupsRef.current = fetchMyGroups;
    fetchSuggestedGroupsRef.current = fetchSuggestedGroups;
  }, [fetchMyGroups, fetchSuggestedGroups]);

  useEffect(() => {
    fetchMyGroupsRef.current();
    fetchSuggestedGroupsRef.current();
    const pollInterval = setInterval(() => { fetchMyGroupsRef.current(); }, 3000);
    return () => clearInterval(pollInterval);
  }, []);

  // ==================== DIRECTORY SEARCH ====================

  const fetchDirectoryGroups = useCallback(async (query: string, type: string) => {
    setDirectoryLoading(true);
    try {
      const response = await searchPublicGroups({
        query: query || undefined,
        type: type !== 'all' ? (type as GroupType) : undefined,
        limit: 50,
        offset: 0,
      });
      setDirectoryGroups(response.groups || []);
      setDirectoryTotal(response.total || 0);
    } catch (err) {
      console.error('Failed to search public groups:', err);
      setDirectoryGroups([]);
      setDirectoryTotal(0);
    } finally {
      setDirectoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (viewMode !== 'directory') return;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      fetchDirectoryGroups(directorySearchQuery, directoryFilterType);
    }, 350);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [directorySearchQuery, directoryFilterType, viewMode, fetchDirectoryGroups]);

  useEffect(() => {
    if (viewMode === 'directory') fetchDirectoryGroups(directorySearchQuery, directoryFilterType);
  }, [viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ==================== FILTER LOGIC ====================

  const filteredMyGroups = myGroups.filter((group: Group) => {
    const matchesSearch =
      group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || group.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleJoinGroup = async (groupId: string) => {
    await joinGroup(groupId);
    if (viewMode === 'directory') fetchDirectoryGroups(directorySearchQuery, directoryFilterType);
  };

  const handleGroupCreated = (groupId: string) => { setSelectedGroupId(groupId); };

  const getGroupIcon = (type: Group['type']) => {
    const icons: Record<string, string> = {
      family: '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}',
      partners: '\u{1F49E}',
      teamwork: '\u{1F680}',
      friends: '\u{1F91D}',
      professional: '\u{1F4BC}',
      therapy: '\u{1F49A}',
      anonymous: '\u{1F3AD}',
      open: '\u{1F310}',
      private: '\u{1F512}',
    };
    return icons[type] || '\u{1F465}';
  };

  const typeFilterOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'family', label: 'Family' },
    { value: 'partners', label: 'Partners' },
    { value: 'teamwork', label: 'Teamwork' },
    { value: 'friends', label: 'Friends' },
    { value: 'professional', label: 'Professional' },
    { value: 'therapy', label: 'Support' },
    { value: 'anonymous', label: 'Anonymous' },
  ];

  // Grid column count based on screen width
  const gridColumns = isMobile ? 1 : isTablet ? 2 : 3;

  // ==================== GROUP DETAIL VIEW ====================

  if (selectedGroupId) {
    return (
      <div style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'var(--mg-page-bg, linear-gradient(135deg, #fff1f2, #fce7f3, #f3e8ff))' }} />
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <ZenPondScene2 />
        </div>
        <div style={{ position: 'relative', zIndex: 10, minHeight: '100vh', padding: isMobile ? '1rem' : '1.5rem', paddingTop: `calc(${isMobile ? '1rem' : '1.5rem'} + env(safe-area-inset-top, 0px))` }}>
          <div style={{ maxWidth: '56rem', margin: '0 auto' }}>
            <GroupDetailView groupId={selectedGroupId} onBack={() => setSelectedGroupId(null)} />
          </div>
        </div>
        {/* Page-level scroll-to-top (not the chat's internal scroll) — helps
            users return to the header when the chat pane fills the screen. */}
        <ScrollToTopButton />
      </div>
    );
  }

  // ==================== MAIN VIEW ====================

  return (
    <>
      {/* Global scrollbar hide */}
      <style>{`
        .mirrorgroups-page { scrollbar-width: none; -ms-overflow-style: none; }
        .mirrorgroups-page::-webkit-scrollbar { display: none; }
        .mirrorgroups-page *, .mirrorgroups-page *::before, .mirrorgroups-page *::after {
          scrollbar-width: none; -ms-overflow-style: none;
        }
        .mirrorgroups-page *::-webkit-scrollbar { display: none; }
      `}</style>

      <div
        className="mirrorgroups-page"
        style={{
          minHeight: '100vh',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background */}
        <div style={{ position: 'absolute', inset: 0, background: 'var(--mg-page-bg, linear-gradient(135deg, #fff1f2, #fce7f3, #f3e8ff))' }} />
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}><ZenPondScene2 /></div>

        {/* Content */}
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            minHeight: '100vh',
            padding: isMobile ? '0.75rem' : '1.5rem',
            // Clear the device notch / status bar so the "Back to Dashboard"
            // header isn't tucked under it on mobile (full-bleed page, no NavBar).
            paddingTop: `calc(${isMobile ? '0.75rem' : '1.5rem'} + env(safe-area-inset-top, 0px))`,
          }}
        >
          <div style={{ maxWidth: '72rem', margin: '0 auto' }}>

            {/* ==================== HEADER PANEL ==================== */}
            <div style={{ ...GLASS_PANEL, marginBottom: isMobile ? '0.75rem' : '1.5rem' }}>

              {/* Back button */}
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

              {/* Title row */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  alignItems: isMobile ? 'flex-start' : 'center',
                  justifyContent: 'space-between',
                  gap: isMobile ? '0.75rem' : '1rem',
                  marginBottom: '1rem',
                }}
              >
                <div>
                  <h1
                    style={{
                      fontSize: isMobile ? '1.5rem' : '1.75rem',
                      fontWeight: 700,
                      color: COLORS.heading,
                      textShadow: COLORS.textShadow,
                      margin: 0,
                    }}
                  >
                    MirrorGroups
                  </h1>
                  <p
                    style={{
                      fontSize: '0.85rem',
                      color: COLORS.body,
                      textShadow: COLORS.textShadow,
                      margin: '4px 0 0',
                    }}
                  >
                    Connect with others for collective intelligence
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Connection dot — polls actual socket readyState */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: wsLive ? '#4ade80' : '#9ca3af',
                        boxShadow: wsLive ? '0 0 6px rgba(74,222,128,0.6)' : 'none',
                      }}
                    />
                    <span style={{ fontSize: '0.7rem', color: COLORS.label }}>
                      {wsLive ? 'Live' : 'Offline'}
                    </span>
                  </div>

                  <button
                    onClick={() => setShowCreateModal(true)}
                    type="button"
                    style={{
                      padding: isMobile ? '0.6rem 1rem' : '0.65rem 1.5rem',
                      borderRadius: 12,
                      background: 'linear-gradient(135deg, rgba(236,72,153,0.15), rgba(168,85,247,0.15))',
                      border: '1px solid rgba(236,72,153,0.3)',
                      color: COLORS.label,
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    + Create Group
                  </button>
                </div>
              </div>

              {/* View mode toggle */}
              <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
                {(['my-groups', 'directory'] as const).map((mode) => {
                  const active = viewMode === mode;
                  const label = mode === 'my-groups' ? 'My Groups' : '\u{1F310} Public Directory';
                  return (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      type="button"
                      style={{
                        padding: '0.45rem 1rem',
                        borderRadius: 12,
                        border: `1px solid ${active ? 'rgba(236,72,153,0.5)' : 'rgba(255,255,255,0.1)'}`,
                        background: active
                          ? 'linear-gradient(135deg, rgba(236,72,153,0.2), rgba(168,85,247,0.2))'
                          : 'rgba(255,255,255,0.04)',
                        color: COLORS.heading,
                        fontSize: '0.8rem',
                        fontWeight: active ? 600 : 400,
                        cursor: 'pointer',
                        WebkitTapHighlightColor: 'transparent',
                        backdropFilter: 'blur(30px)'
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Search + Filter */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: isMobile ? 8 : 12,
                }}
              >
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    type="text"
                    value={viewMode === 'my-groups' ? searchQuery : directorySearchQuery}
                    onChange={(e) =>
                      viewMode === 'my-groups'
                        ? setSearchQuery(e.target.value)
                        : setDirectorySearchQuery(e.target.value)
                    }
                    placeholder={
                      viewMode === 'my-groups'
                        ? 'Search your groups...'
                        : 'Search public groups...'
                    }
                    style={INPUT_STYLE}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '0.85rem',
                      opacity: 0.5,
                      pointerEvents: 'none',
                    }}
                  >
                    {'\u{1F50D}'}
                  </span>
                </div>
                <select
                  value={viewMode === 'my-groups' ? filterType : directoryFilterType}
                  onChange={(e) =>
                    viewMode === 'my-groups'
                      ? setFilterType(e.target.value)
                      : setDirectoryFilterType(e.target.value)
                  }
                  style={{
                    ...SELECT_STYLE,
                    width: isMobile ? '100%' : 'auto',
                  }}
                >
                  {typeFilterOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ==================== ERROR ==================== */}
            {error && (
              <div
                style={{
                  marginBottom: '1rem',
                  padding: '0.75rem 1rem',
                  borderRadius: 12,
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.3)',
                }}
              >
                <p style={{ color: '#fca5a5', margin: 0, fontSize: '0.85rem' }}>{error}</p>
              </div>
            )}

            {/* ==================== MY GROUPS VIEW ==================== */}
            {viewMode === 'my-groups' && (
              <>
                {/* Loading */}
                {isLoading && myGroups.length === 0 && (
                  <div style={{ ...GLASS_PANEL, textAlign: 'center', padding: '3rem 1.5rem' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 12, animation: 'spin 1s linear infinite', display: 'inline-block' }}>{'\u23F3'}</div>
                    <p style={{ color: COLORS.body, margin: 0 }}>Loading your groups...</p>
                  </div>
                )}

                {/* My Groups Section.
                    Horizontal padding matches the header glass card's
                    internal padding (1.25rem) so the "My Groups (N)"
                    heading and the cards below align with the header
                    content above instead of sitting 20px further left. */}
                <div style={{ marginBottom: '2rem', backdropFilter: 'blur(5px)', paddingLeft: '0.25rem', paddingRight: '0.25rem' }}>
                  <h2
                    style={{
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      color: COLORS.heading,
                      margin: '0 0 0.75rem',
                    }}
                  >
                    My Groups ({filteredMyGroups.length})
                  </h2>

                  {filteredMyGroups.length === 0 && !isLoading ? (
                    <div style={{ ...GLASS_PANEL, textAlign: 'center', padding: '3rem 1.5rem' }}>
                      <span style={{ fontSize: '3rem', display: 'block', marginBottom: 12 }}>{'\u{1F31F}'}</span>
                      <p style={{ color: COLORS.body, margin: '0 0 1rem' }}>
                        {searchQuery ? 'No groups match your search' : "You haven't joined any groups yet"}
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => setShowCreateModal(true)}
                          type="button"
                          style={{
                            padding: '0.5rem 1.25rem',
                            borderRadius: 10,
                            background: 'linear-gradient(135deg, rgba(236,72,153,0.15), rgba(168,85,247,0.15))',
                            border: '1px solid rgba(236,72,153,0.3)',
                            color: COLORS.label,
                            fontWeight: 500,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                          }}
                        >
                          Create Your First Group
                        </button>
                        <button
                          onClick={() => setViewMode('directory')}
                          type="button"
                          style={{
                            padding: '0.5rem 1.25rem',
                            borderRadius: 10,
                            background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            color: COLORS.heading,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                          }}
                        >
                          Browse Directory
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
                        gap: isMobile ? '0.5rem' : '0.75rem',
                      }}
                    >
                      {filteredMyGroups.map((group: Group) => (
                        <GroupCard
                          key={group.id}
                          group={group}
                          onClick={() => setSelectedGroupId(group.id)}
                          getGroupIcon={getGroupIcon}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Suggested Groups */}
                {suggestedGroups.length > 0 && (
                  <div>
                    <h2
                      style={{
                        fontSize: '1.1rem',
                        fontWeight: 600,
                        color: COLORS.heading,
                        margin: '0 0 0.75rem',
                      }}
                    >
                      Suggested Groups
                    </h2>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
                        gap: isMobile ? '0.5rem' : '0.75rem',
                      }}
                    >
                      {suggestedGroups.map((group: Group) => (
                        <div
                          key={group.id}
                          style={{
                            padding: '1rem',
                            borderRadius: 16,
                            background: COLORS.cardBg,
                            border: `1px solid ${COLORS.cardBorder}`,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
                            <div
                              style={{
                                width: 48,
                                height: 48,
                                minWidth: 48,
                                borderRadius: 12,
                                background: 'linear-gradient(135deg, rgba(251,191,36,0.12), rgba(168,85,247,0.1))',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.5rem',
                              }}
                            >
                              {getGroupIcon(group.type)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {/* Title: 2-line clamp instead of single-line
                                  truncate so long group names ("Let's get to
                                  know each other. Brothers unite!!") wrap
                                  instead of being cut off mid-word. */}
                              <p style={{ fontWeight: 600, fontSize: '0.95rem', color: COLORS.heading, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.3, wordBreak: 'break-word' }}>
                                {group.name}
                              </p>
                              <p style={{ fontSize: '0.75rem', color: COLORS.body, margin: '4px 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.4 }}>
                                {group.description || 'No description'}
                              </p>
                              <span style={{ fontSize: '0.7rem', color: COLORS.label }}>
                                {'\u{1F465}'} {group.memberCount} members
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleJoinGroup(group.id)}
                            type="button"
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              borderRadius: 10,
                              background: 'linear-gradient(135deg, rgba(236,72,153,0.15), rgba(168,85,247,0.15))',
                              border: '1px solid rgba(236,72,153,0.3)',
                              color: COLORS.label,
                              fontSize: '0.8rem',
                              fontWeight: 500,
                              cursor: 'pointer',
                              WebkitTapHighlightColor: 'transparent',
                            }}
                          >
                            Join Group
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ==================== DIRECTORY VIEW ==================== */}
            {viewMode === 'directory' && (
              /* Match the inset of the "My Groups" section above so the
                 heading and cards align with the header card's content. */
              <div style={{ paddingLeft: '0.25rem', paddingRight: '0.25rem' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.75rem',
                  }}
                >
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: COLORS.heading, margin: 0 }}>
                    Public Group Directory
                    {directoryTotal > 0 && (
                      <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>
                        ({directoryTotal} groups)
                      </span>
                    )}
                  </h2>
                </div>

                {directoryLoading ? (
                  <div style={{ ...GLASS_PANEL, textAlign: 'center', padding: '3rem 1.5rem' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 12, animation: 'spin 1s linear infinite', display: 'inline-block' }}>{'\u23F3'}</div>
                    <p style={{ color: COLORS.body, margin: 0 }}>Searching public groups...</p>
                  </div>
                ) : directoryGroups.length === 0 ? (
                  <div style={{ ...GLASS_PANEL, textAlign: 'center', padding: '3rem 1.5rem' }}>
                    <span style={{ fontSize: '3rem', display: 'block', marginBottom: 12 }}>{'\u{1F50D}'}</span>
                    <p style={{ color: COLORS.body, margin: '0 0 8px' }}>
                      {directorySearchQuery ? 'No public groups match your search' : 'No public groups available yet'}
                    </p>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', margin: 0 }}>
                      Create a public group to list it in the directory!
                    </p>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
                      gap: isMobile ? '0.5rem' : '0.75rem',
                    }}
                  >
                    {directoryGroups.map((group: Group) => (
                      <DirectoryCard
                        key={group.id}
                        group={group}
                        isAlreadyMember={myGroups.some((g) => g.id === group.id)}
                        getGroupIcon={getGroupIcon}
                        onView={() => setSelectedGroupId(group.id)}
                        onJoin={() => handleJoinGroup(group.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <CreateGroupModal
          onClose={() => setShowCreateModal(false)}
          onGroupCreated={handleGroupCreated}
        />
      )}
    </>
  );
}

// ============================================================================
// UTILITY
// ============================================================================

function formatRelativeTime(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}