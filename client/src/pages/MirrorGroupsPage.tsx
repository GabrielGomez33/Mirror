// src/pages/MirrorGroupsPage.tsx
// Main MirrorGroups page with full functionality

import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGroups } from '../context/GroupContext';
import CreateGroupModal from '../components/mirrorgroups/CreateGroupModal';
import GroupDetailView from '../components/mirrorgroups/GroupDetailView';
import ZenPondScene from '../components/three/ZenPondScene';
import '../styles/enhanced-glass.css';
import type { Group } from '../types/groups';

export default function MirrorGroupsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    myGroups,
    suggestedGroups,
    isLoading,
    error,
    showCreateModal,
    setShowCreateModal,
    fetchMyGroups,
    fetchSuggestedGroups,
    joinGroup,
    isConnected,
  } = useGroups();

  // Check for navigation state (e.g., from Dashboard clicking a group)
  const initialGroupId = (location.state as { selectedGroupId?: string } | null)?.selectedGroupId || null;
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialGroupId);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

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

  // Filter groups
  const filteredMyGroups = myGroups.filter((group: Group) => {
    const matchesSearch =
      group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || group.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleJoinGroup = async (groupId: string) => {
    await joinGroup(groupId);
  };

  const handleGroupCreated = (groupId: string) => {
    setSelectedGroupId(groupId);
  };

  const getGroupIcon = (type: Group['type']) => {
    const icons: Record<string, string> = {
      family: '👨‍👩‍👧‍👦',
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

  // Show group detail view when a group is selected
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

  return (
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

            {/* Search and Filter */}
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-3 pl-10 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-pink-400/50"
                  placeholder="Search groups..."
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50">🔍</span>
              </div>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:border-pink-400/50"
              >
                <option value="all">All Types</option>
                <option value="family">Family</option>
                <option value="friends">Friends</option>
                <option value="professional">Professional</option>
                <option value="therapy">Support</option>
                <option value="anonymous">Anonymous</option>
              </select>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/20 border border-red-500/30">
              <p className="text-red-300">{error}</p>
            </div>
          )}

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
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="enhanced-action-button px-6 py-2"
                >
                  <span className="enhanced-glass-text" style={{ color: '#6a1f33' }}>
                    Create Your First Group
                  </span>
                </button>
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
                        <div className="flex items-center gap-3 text-xs">
                          <span className="enhanced-glass-subtle" style={{ color: '#6a1f33' }}>
                            👥 {group.memberCount}
                          </span>
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
        </div>
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <CreateGroupModal
          onClose={() => setShowCreateModal(false)}
          onGroupCreated={handleGroupCreated}
        />
      )}
    </div>
  );
}

// ============================================================================
// UTILITY
// ============================================================================

function formatRelativeTime(dateString: string): string {
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
