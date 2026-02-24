// src/pages/MirrorGroupsPage.tsx
// Main MirrorGroups page with full functionality - Enhanced with public directory & search

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGroups } from '../context/GroupContext';
import CreateGroupModal from '../components/mirrorgroups/CreateGroupModal';
import GroupDetailView from '../components/mirrorgroups/GroupDetailView';
import ZenPondScene from '../components/three/ZenPondScene';
import '../styles/enhanced-glass.css';
import type { Group, GroupType } from '../types/groups';
import { searchPublicGroups } from '../services/groupsApi';

type ViewMode = 'my-groups' | 'directory';

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
    isConnected,
  } = useGroups();

  // Local state for modal visibility (matches MyJournal pattern - avoids
  // context dispatch issues and CSS stacking-context race conditions)
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Check for navigation state (e.g., from Dashboard clicking a group)
  const initialGroupId = (location.state as { selectedGroupId?: string } | null)?.selectedGroupId || null;
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialGroupId);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('my-groups');

  // Directory state
  const [directoryGroups, setDirectoryGroups] = useState<Group[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directorySearchQuery, setDirectorySearchQuery] = useState('');
  const [directoryFilterType, setDirectoryFilterType] = useState<string>('all');
  const [directoryTotal, setDirectoryTotal] = useState(0);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use refs for stable polling (prevents interval reset on function recreation)
  const fetchMyGroupsRef = useRef(fetchMyGroups);
  const fetchSuggestedGroupsRef = useRef(fetchSuggestedGroups);

  // Keep refs in sync with latest functions
  useEffect(() => {
    fetchMyGroupsRef.current = fetchMyGroups;
    fetchSuggestedGroupsRef.current = fetchSuggestedGroups;
  }, [fetchMyGroups, fetchSuggestedGroups]);

  // Initial fetch and polling every 3 seconds
  useEffect(() => {
    // Initial fetch
    fetchMyGroupsRef.current();
    fetchSuggestedGroupsRef.current();

    // Poll for updates every 3 seconds using refs (stable interval)
    const pollInterval = setInterval(() => {
      fetchMyGroupsRef.current();
    }, 3000);

    return () => clearInterval(pollInterval);
  }, []); // Empty deps - uses refs for stability

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

  // Debounced directory search
  useEffect(() => {
    if (viewMode !== 'directory') return;

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(() => {
      fetchDirectoryGroups(directorySearchQuery, directoryFilterType);
    }, 350);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [directorySearchQuery, directoryFilterType, viewMode, fetchDirectoryGroups]);

  // Fetch directory groups when switching to directory view
  useEffect(() => {
    if (viewMode === 'directory') {
      fetchDirectoryGroups(directorySearchQuery, directoryFilterType);
    }
  }, [viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ==================== FILTER LOGIC ====================

  // Filter groups (client-side for my groups)
  const filteredMyGroups = myGroups.filter((group: Group) => {
    const matchesSearch =
      group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || group.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleJoinGroup = async (groupId: string) => {
    await joinGroup(groupId);
    if (viewMode === 'directory') {
      fetchDirectoryGroups(directorySearchQuery, directoryFilterType);
    }
  };

  const handleGroupCreated = (groupId: string) => {
    setSelectedGroupId(groupId);
  };

  const getGroupIcon = (type: Group['type']) => {
    const icons: Record<string, string> = {
      family: '👨‍👩‍👧‍👦',
      partners: '💞',
      teamwork: '🚀',
      friends: '🤝',
      professional: '💼',
      therapy: '💚',
      anonymous: '🎭',
      open: '🌐',
      private: '🔒',
    };
    return icons[type] || '👥';
  };

  const getPrivacyColor = (privacy: Group['privacy']) => {
    const colors: Record<string, string> = {
      public: 'from-green-400/20 to-emerald-400/20',
      private: 'from-amber-400/20 to-yellow-400/20',
      secret: 'from-red-400/20 to-pink-400/20',
    };
    return colors[privacy] || colors.private;
  };

  const getPrivacyBadge = (privacy: Group['privacy']) => {
    const badges: Record<string, { text: string; color: string }> = {
      public: { text: 'Public', color: 'bg-green-400/20 text-green-300 border-green-400/30' },
      private: { text: 'Private', color: 'bg-amber-400/20 text-amber-300 border-amber-400/30' },
      secret: { text: 'Secret', color: 'bg-red-400/20 text-red-300 border-red-400/30' },
    };
    return badges[privacy] || badges.private;
  };

  // ==================== GROUP DETAIL VIEW ====================

  if (selectedGroupId) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50" />
        <div className="absolute inset-0 z-0">
          <ZenPondScene />
        </div>
        <div className="relative z-10 min-h-screen p-6">
          <div className="max-w-4xl mx-auto">
            <GroupDetailView groupId={selectedGroupId} onBack={() => setSelectedGroupId(null)} />
          </div>
        </div>
      </div>
    );
  }

  // ==================== TYPE FILTER OPTIONS ====================

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

  // ==================== MAIN VIEW ====================

  return (
    <>
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50" />
      <div className="absolute inset-0 z-0">
        <ZenPondScene />
      </div>

      <div className="relative z-10 min-h-screen p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="enhanced-glass-panel mb-6">
            {/* Back to Dashboard Button */}
            <button
              onClick={() => navigate('/dashboard')}
              className="mb-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 transition-all duration-200 group"
            >
              <span className="text-lg group-hover:-translate-x-1 transition-transform">←</span>
              <span
                className="font-medium"
                style={{
                  color: 'rgb(120, 69, 82)',
                  textShadow: '0 3px 12px rgba(0, 0, 0, .4), 0 1px 3px rgba(255, 255, 255, .15)',
                }}
              >
                Back to Dashboard
              </span>
            </button>

            <div className="flex items-center justify-between mb-6">
              <div>
                <h1
                  className="enhanced-glass-heading text-3xl mb-2"
                  style={{
                    color: 'rgb(120, 69, 82)',
                    textShadow: '0 3px 12px rgba(0, 0, 0, .4), 0 1px 3px rgba(255, 255, 255, .15)',
                  }}
                >
                  MirrorGroups
                </h1>
                <p
                  className="enhanced-glass-body"
                  style={{
                    color: 'rgb(120, 69, 82)',
                    textShadow: '0 3px 12px rgba(0, 0, 0, .4), 0 1px 3px rgba(255, 255, 255, .15)',
                  }}
                >
                  Connect with others for collective intelligence and deeper insights
                </p>
              </div>
              <div className="flex items-center gap-4">
                {/* Connection Status */}
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isConnected ? 'bg-green-400 animate-pulse' : 'bg-gray-400'
                    }`}
                  />
                  <span className="enhanced-glass-subtle text-xs" style={{ color: '#6a1f33' }}>
                    {isConnected ? 'Live' : 'Offline'}
                  </span>
                </div>

                <button
                  onClick={() => setShowCreateModal(true)}
                  className="enhanced-action-button px-6 py-3"
                >
                  <span className="enhanced-glass-text font-medium" style={{ color: '#6a1f33' }}>
                    + Create Group
                  </span>
                </button>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setViewMode('my-groups')}
                className={`px-4 py-2 rounded-xl border transition-all text-sm ${
                  viewMode === 'my-groups'
                    ? 'bg-gradient-to-r from-pink-400/20 to-purple-400/20 border-pink-400/50'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <span style={{ color: '#784552' }}>My Groups</span>
              </button>
              <button
                onClick={() => setViewMode('directory')}
                className={`px-4 py-2 rounded-xl border transition-all text-sm ${
                  viewMode === 'directory'
                    ? 'bg-gradient-to-r from-pink-400/20 to-purple-400/20 border-pink-400/50'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <span style={{ color: '#784552' }}>🌐 Public Directory</span>
              </button>
            </div>

            {/* Search and Filter - Context sensitive */}
            {viewMode === 'my-groups' ? (
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-3 pl-10 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-pink-400/50"
                    placeholder="Search your groups..."
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50">🔍</span>
                </div>

                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:border-pink-400/50"
                >
                  {typeFilterOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={directorySearchQuery}
                    onChange={(e) => setDirectorySearchQuery(e.target.value)}
                    className="w-full px-4 py-3 pl-10 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-pink-400/50"
                    placeholder="Search public groups by name or description..."
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50">🔍</span>
                </div>

                <select
                  value={directoryFilterType}
                  onChange={(e) => setDirectoryFilterType(e.target.value)}
                  className="px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:border-pink-400/50"
                >
                  {typeFilterOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/20 border border-red-500/30">
              <p className="text-red-300">{error}</p>
            </div>
          )}

          {/* ============================================ */}
          {/* MY GROUPS VIEW */}
          {/* ============================================ */}
          {viewMode === 'my-groups' && (
            <>
              {/* Loading State */}
              {isLoading && myGroups.length === 0 && (
                <div className="enhanced-glass-panel text-center py-12">
                  <div className="animate-spin text-4xl mb-4">⏳</div>
                  <p className="enhanced-glass-body" style={{ color: '#7e4151' }}>
                    Loading your groups...
                  </p>
                </div>
              )}

              {/* My Groups */}
              <div className="mb-8">
                <h2 className="enhanced-glass-heading text-xl mb-4" style={{ color: '#784552' }}>
                  My Groups ({filteredMyGroups.length})
                </h2>

                {filteredMyGroups.length === 0 && !isLoading ? (
                  <div className="enhanced-glass-panel text-center py-12">
                    <span className="text-5xl mb-4 block">🌟</span>
                    <p className="enhanced-glass-body mb-4" style={{ color: '#7e4151' }}>
                      {searchQuery ? 'No groups match your search' : "You haven't joined any groups yet"}
                    </p>
                    <div className="flex justify-center gap-3">
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="enhanced-action-button px-6 py-2"
                      >
                        <span className="enhanced-glass-text" style={{ color: '#6a1f33' }}>
                          Create Your First Group
                        </span>
                      </button>
                      <button
                        onClick={() => setViewMode('directory')}
                        className="px-6 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 transition-colors"
                      >
                        <span style={{ color: '#784552' }}>Browse Directory</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredMyGroups.map((group: Group) => (
                      <div
                        key={group.id}
                        onClick={() => setSelectedGroupId(group.id)}
                        className="enhanced-glass-card cursor-pointer hover:scale-[1.02] transition-transform"
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className={`w-14 h-14 rounded-xl bg-gradient-to-r ${getPrivacyColor(
                              group.privacy
                            )} backdrop-blur-sm flex items-center justify-center text-2xl flex-shrink-0`}
                          >
                            {getGroupIcon(group.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3
                                className="enhanced-glass-heading text-base truncate mb-1"
                                style={{ color: '#784552' }}
                              >
                                {group.name}
                              </h3>
                            </div>
                            <p
                              className="enhanced-glass-subtle text-xs mb-2 line-clamp-2"
                              style={{ color: '#7e4151' }}
                            >
                              {group.description || 'No description'}
                            </p>
                            <div className="flex items-center gap-3 text-xs flex-wrap">
                              <span className="enhanced-glass-subtle" style={{ color: '#6a1f33' }}>
                                👥 {group.memberCount}
                              </span>
                              {group.goal && (
                                <span
                                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-400/10 text-purple-300 truncate max-w-[120px]"
                                  title={group.goal}
                                >
                                  🎯 {group.goal}
                                </span>
                              )}
                              <span className="enhanced-glass-subtle" style={{ color: '#6a1f33' }}>
                                {formatRelativeTime(group.lastActivity)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Suggested Groups */}
              {suggestedGroups.length > 0 && (
                <div>
                  <h2 className="enhanced-glass-heading text-xl mb-4" style={{ color: '#784552' }}>
                    Suggested Groups
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {suggestedGroups.map((group: Group) => (
                      <div key={group.id} className="enhanced-glass-card">
                        <div className="flex items-start gap-4 mb-4">
                          <div
                            className={`w-14 h-14 rounded-xl bg-gradient-to-r ${getPrivacyColor(
                              group.privacy
                            )} backdrop-blur-sm flex items-center justify-center text-2xl flex-shrink-0`}
                          >
                            {getGroupIcon(group.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3
                              className="enhanced-glass-heading text-base truncate mb-1"
                              style={{ color: '#784552' }}
                            >
                              {group.name}
                            </h3>
                            <p
                              className="enhanced-glass-subtle text-xs mb-2 line-clamp-2"
                              style={{ color: '#7e4151' }}
                            >
                              {group.description || 'No description'}
                            </p>
                            <span className="enhanced-glass-subtle text-xs" style={{ color: '#6a1f33' }}>
                              👥 {group.memberCount} members
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleJoinGroup(group.id)}
                          className="w-full enhanced-action-button py-2"
                        >
                          <span className="enhanced-glass-text text-sm" style={{ color: '#6a1f33' }}>
                            Join Group
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ============================================ */}
          {/* PUBLIC DIRECTORY VIEW */}
          {/* ============================================ */}
          {viewMode === 'directory' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="enhanced-glass-heading text-xl" style={{ color: '#784552' }}>
                  Public Group Directory
                  {directoryTotal > 0 && (
                    <span className="text-sm text-white/40 ml-2">({directoryTotal} groups)</span>
                  )}
                </h2>
              </div>

              {directoryLoading ? (
                <div className="enhanced-glass-panel text-center py-12">
                  <div className="animate-spin text-4xl mb-4">⏳</div>
                  <p className="enhanced-glass-body" style={{ color: '#7e4151' }}>
                    Searching public groups...
                  </p>
                </div>
              ) : directoryGroups.length === 0 ? (
                <div className="enhanced-glass-panel text-center py-12">
                  <span className="text-5xl mb-4 block">🔍</span>
                  <p className="enhanced-glass-body mb-2" style={{ color: '#7e4151' }}>
                    {directorySearchQuery
                      ? 'No public groups match your search'
                      : 'No public groups available yet'}
                  </p>
                  <p className="text-white/40 text-sm">
                    Create a public group to list it in the directory!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {directoryGroups.map((group: Group) => {
                    const privacyBadge = getPrivacyBadge(group.privacy);
                    const isAlreadyMember = myGroups.some((g) => g.id === group.id);

                    return (
                      <div key={group.id} className="enhanced-glass-card">
                        <div className="flex items-start gap-4 mb-3">
                          <div
                            className={`w-14 h-14 rounded-xl bg-gradient-to-r ${getPrivacyColor(
                              group.privacy
                            )} backdrop-blur-sm flex items-center justify-center text-2xl flex-shrink-0`}
                          >
                            {getGroupIcon(group.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3
                                className="enhanced-glass-heading text-base truncate"
                                style={{ color: '#784552' }}
                              >
                                {group.name}
                              </h3>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${privacyBadge.color}`}>
                                {privacyBadge.text}
                              </span>
                            </div>
                            <p
                              className="enhanced-glass-subtle text-xs mb-2 line-clamp-2"
                              style={{ color: '#7e4151' }}
                            >
                              {group.description || 'No description'}
                            </p>
                            <div className="flex items-center gap-3 text-xs flex-wrap">
                              <span className="enhanced-glass-subtle" style={{ color: '#6a1f33' }}>
                                👥 {group.memberCount}/{group.maxMembers}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/50">
                                {getGroupIcon(group.type)} {group.type}
                              </span>
                            </div>
                            {group.goal && (
                              <p
                                className="text-[10px] mt-1.5 px-2 py-0.5 rounded-full bg-purple-400/10 text-purple-300 truncate"
                                title={group.goal}
                              >
                                🎯 {group.goal}
                              </p>
                            )}
                          </div>
                        </div>

                        {isAlreadyMember ? (
                          <button
                            onClick={() => setSelectedGroupId(group.id)}
                            className="w-full py-2 rounded-lg bg-green-400/10 border border-green-400/20 text-green-300 text-sm"
                          >
                            Already a Member - View
                          </button>
                        ) : (
                          <button
                            onClick={() => handleJoinGroup(group.id)}
                            className="w-full enhanced-action-button py-2"
                          >
                            <span className="enhanced-glass-text text-sm" style={{ color: '#6a1f33' }}>
                              Request to Join
                            </span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </div>

    {/* Create Group Modal - rendered outside overflow-hidden container
        to avoid stacking context / backdrop-filter clipping issues.
        Uses local useState (like MyJournal) for reliable toggling. */}
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
