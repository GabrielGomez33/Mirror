// src/components/mirrorgroups/GroupDetailView.tsx
// Detailed view of a single MirrorGroup with tabs for different sections

import { useState, useEffect, useCallback } from 'react';
import { useGroups } from '../../context/GroupContext';
import GroupInsightsPanel from './GroupInsightsPanel';
import VotingSystem from './VotingSystem';
import GroupMembersList from './GroupMembersList';
import DataSharingPanel from './DataSharingPanel';
import ChatWindow from '../chat/ChatWindow';
import InviteMembersModal from './InviteMembersModal';
import { preloadGroupMessages } from '../../services/chatCache';
import { getUserInfo } from '../../utils/token';
import type { Group, GroupMember } from '../../types/groups';

interface GroupDetailViewProps {
  groupId: string;
  onBack: () => void;
}

type TabType = 'overview' | 'chat' | 'members' | 'insights' | 'voting' | 'sharing';

const TABS: Array<{ id: TabType; label: string; icon: string }> = [
  { id: 'overview', label: 'Overview', icon: '📋' },
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'members', label: 'Members', icon: '👥' },
  { id: 'insights', label: 'Insights', icon: '🧠' },
  { id: 'voting', label: 'Voting', icon: '🗳️' },
  { id: 'sharing', label: 'Sharing', icon: '🔐' },
];

// Helper to get current user ID - uses getUserInfo from token.ts for consistency
const getCurrentUserId = (): number => {
  const userInfo = getUserInfo();
  console.log('[DEBUG] getUserInfo() returned:', userInfo);
  console.log('[DEBUG] localStorage userInfo:', localStorage.getItem('userInfo'));
  return userInfo?.userId ?? 0;
};

export default function GroupDetailView({ groupId, onBack }: GroupDetailViewProps) {
  const {
    currentGroup,
    currentMembers,
    currentInsights,
    activeVotes,
    isLoading,
    isLoadingInsights,
    fetchGroupDetails,
    fetchInsights,
    fetchActiveVotes,
    leaveGroup,
    deleteGroup,
    triggerAnalysis,
  } = useGroups();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Check if current user is the owner (handle both camelCase and snake_case from API)
  const currentUserId = getCurrentUserId();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groupCreatorId = currentGroup?.creatorId ?? (currentGroup as any)?.creator_id;
  // eslint-disable-next-line eqeqeq
  const isOwner = groupCreatorId != null && groupCreatorId == currentUserId;

  // Check if user can invite (owner, admin, or creator role)
  // Handle both camelCase and snake_case for userId
  const currentMember = currentMembers.find((m) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const memberId = m.userId ?? (m as any).user_id;
    return Number(memberId) === currentUserId;
  });
  const canInvite = isOwner || !!(currentMember && ['owner', 'admin', 'creator'].includes(currentMember.role));

  // Debug logging
  console.log('[DEBUG] currentUserId:', currentUserId);
  console.log('[DEBUG] groupCreatorId:', groupCreatorId);
  console.log('[DEBUG] isOwner:', isOwner);
  console.log('[DEBUG] currentMembers:', currentMembers);
  console.log('[DEBUG] currentMember:', currentMember);
  console.log('[DEBUG] canInvite:', canInvite);

  // Fetch group data on mount (including chat preload)
  useEffect(() => {
    // Fetch all group data in parallel
    fetchGroupDetails(groupId);
    fetchInsights(groupId);
    fetchActiveVotes(groupId);

    // Preload chat messages so they're ready when user clicks Chat tab
    preloadGroupMessages(groupId);
  }, [groupId, fetchGroupDetails, fetchInsights, fetchActiveVotes]);

  const handleLeaveGroup = useCallback(async () => {
    const success = await leaveGroup(groupId);
    if (success) {
      onBack();
    }
  }, [leaveGroup, groupId, onBack]);

  const handleDeleteGroup = useCallback(async () => {
    setIsDeleting(true);
    const success = await deleteGroup(groupId);
    setIsDeleting(false);
    if (success) {
      onBack();
    }
  }, [deleteGroup, groupId, onBack]);

  const handleTriggerAnalysis = useCallback(async () => {
    await triggerAnalysis(groupId);
  }, [triggerAnalysis, groupId]);

  const getGroupTypeIcon = (type: Group['type']) => {
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

  const getPrivacyBadge = (privacy: Group['privacy']) => {
    const badges: Record<string, { label: string; color: string }> = {
      public: { label: 'Public', color: 'from-green-400/20 to-emerald-400/20' },
      private: { label: 'Private', color: 'from-amber-400/20 to-yellow-400/20' },
      secret: { label: 'Secret', color: 'from-red-400/20 to-pink-400/20' },
    };
    return badges[privacy] || badges.private;
  };

  if (isLoading && !currentGroup) {
    return (
      <div className="enhanced-glass-panel p-8 text-center">
        <div className="animate-spin text-4xl mb-4">⏳</div>
        <p className="enhanced-glass-text" style={{ color: '#7e4151' }}>
          Loading group details...
        </p>
      </div>
    );
  }

  if (!currentGroup) {
    return (
      <div className="enhanced-glass-panel p-8 text-center">
        <p className="enhanced-glass-text" style={{ color: '#7e4151' }}>
          Group not found
        </p>
        <button
          onClick={onBack}
          className="enhanced-action-button mt-4 px-6 py-2"
        >
          <span className="enhanced-glass-text" style={{ color: '#6a1f33' }}>
            Go Back
          </span>
        </button>
      </div>
    );
  }

  const privacyBadge = getPrivacyBadge(currentGroup.privacy);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="enhanced-glass-panel">
        <div className="flex items-start justify-between mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
          >
            <span>←</span>
            <span className="enhanced-glass-subtle text-sm">Back to Groups</span>
          </button>

          <div className="flex gap-2">
            {isOwner && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 rounded-lg bg-red-600/30 border border-red-600/50 text-red-200 text-sm hover:bg-red-600/40 transition-colors"
              >
                Delete
              </button>
            )}
            <button
              onClick={() => setShowLeaveConfirm(true)}
              className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm hover:bg-red-500/30 transition-colors"
            >
              Leave
            </button>
          </div>
        </div>

        {/* Group Info */}
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-400/30 to-pink-400/30 backdrop-blur-sm flex items-center justify-center text-4xl">
            {getGroupTypeIcon(currentGroup.type)}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="enhanced-glass-heading text-2xl" style={{ color: '#784552' }}>
                {currentGroup.name}
              </h1>
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${privacyBadge.color} backdrop-blur-sm`}
              >
                <span className="text-white/90">{privacyBadge.label}</span>
              </span>
            </div>

            <p className="enhanced-glass-body mb-4" style={{ color: '#7e4151' }}>
              {currentGroup.description || 'No description provided'}
            </p>

            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-white/50">👥</span>
                <span className="enhanced-glass-subtle" style={{ color: '#6a1f33' }}>
                  {currentGroup.memberCount} / {currentGroup.maxMembers} members
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/50">🕐</span>
                <span className="enhanced-glass-subtle" style={{ color: '#6a1f33' }}>
                  Active {formatRelativeTime(currentGroup.lastActivity)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="enhanced-stat-container">
            <div className="enhanced-stat-number text-2xl">{currentMembers.length}</div>
            <div className="enhanced-stat-label text-xs">Members</div>
          </div>
          <div className="enhanced-stat-container">
            <div className="enhanced-stat-number text-2xl">
              {currentMembers.filter((m: GroupMember) => m.hasSharedData).length}
            </div>
            <div className="enhanced-stat-label text-xs">Sharing</div>
          </div>
          <div className="enhanced-stat-container">
            <div className="enhanced-stat-number text-2xl">{activeVotes.length}</div>
            <div className="enhanced-stat-label text-xs">Active Votes</div>
          </div>
          <div className="enhanced-stat-container">
            <div className="enhanced-stat-number text-2xl">
              {currentInsights?.llmSynthesis?.qualityScore
                ? Math.round(currentInsights.llmSynthesis.qualityScore * 100)
                : '--'}
              %
            </div>
            <div className="enhanced-stat-label text-xs">Insight Score</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-pink-400/30 to-purple-400/30 border border-pink-400/30'
                : 'bg-white/5 border border-white/10 hover:bg-white/10'
            }`}
          >
            <span>{tab.icon}</span>
            <span
              className="enhanced-glass-text text-sm"
              style={{ color: activeTab === tab.id ? '#784552' : '#7e4151' }}
            >
              {tab.label}
            </span>
            {tab.id === 'voting' && activeVotes.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-pink-500 text-white text-xs flex items-center justify-center">
                {activeVotes.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="enhanced-glass-panel">
        {activeTab === 'overview' && (
          <OverviewTab
            group={currentGroup}
            members={currentMembers}
            insights={currentInsights}
            onAnalyze={handleTriggerAnalysis}
            isAnalyzing={isLoadingInsights}
            canInvite={canInvite}
            onInvite={() => setShowInviteModal(true)}
          />
        )}

        {activeTab === 'chat' && <ChatWindow groupId={groupId} groupName={currentGroup.name} />}

        {activeTab === 'members' && (
          <GroupMembersList groupId={groupId} members={currentMembers} />
        )}

        {activeTab === 'insights' && (
          <GroupInsightsPanel
            groupId={groupId}
            insights={currentInsights}
            isLoading={isLoadingInsights}
            onRefresh={handleTriggerAnalysis}
          />
        )}

        {activeTab === 'voting' && <VotingSystem groupId={groupId} votes={activeVotes} />}

        {activeTab === 'sharing' && <DataSharingPanel groupId={groupId} />}
      </div>

      {/* Leave Confirmation Modal */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowLeaveConfirm(false)}
          />
          <div className="relative enhanced-glass-panel p-6 max-w-md">
            <h3 className="enhanced-glass-heading text-lg mb-4" style={{ color: '#784552' }}>
              Leave Group?
            </h3>
            <p className="enhanced-glass-body mb-6" style={{ color: '#7e4151' }}>
              Are you sure you want to leave "{currentGroup.name}"? Your shared data will be removed
              and you'll need to be invited again to rejoin.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="px-4 py-2 rounded-lg bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLeaveGroup}
                className="px-4 py-2 rounded-lg bg-red-500/30 text-red-300 hover:bg-red-500/40 transition-colors"
              >
                Leave Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !isDeleting && setShowDeleteConfirm(false)}
          />
          <div className="relative enhanced-glass-panel p-6 max-w-md">
            <h3 className="enhanced-glass-heading text-lg mb-4" style={{ color: '#dc2626' }}>
              ⚠️ Delete Group?
            </h3>
            <p className="enhanced-glass-body mb-6" style={{ color: '#7e4151' }}>
              This action <strong>cannot be undone</strong>. All group data, chat history, and member
              connections will be permanently deleted.
            </p>
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 mb-6">
              <p className="text-red-300 text-sm">
                Deleting: <strong>{currentGroup.name}</strong>
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg bg-white/10 text-white/80 hover:bg-white/20 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteGroup}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg bg-red-600/50 text-white hover:bg-red-600/70 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Deleting...
                  </>
                ) : (
                  <>Delete Permanently</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Members Modal */}
      {showInviteModal && currentGroup && (
        <InviteMembersModal
          groupId={groupId}
          groupName={currentGroup.name}
          currentMembers={currentMembers}
          onClose={() => setShowInviteModal(false)}
          onInviteSent={() => {
            fetchGroupDetails(groupId);
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// OVERVIEW TAB COMPONENT
// ============================================================================

interface OverviewTabProps {
  group: Group;
  members: GroupMember[];
  insights: import('../../types/groups').GroupInsights | null;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  canInvite: boolean;
  onInvite: () => void;
}

function OverviewTab({ group, members, insights, onAnalyze, isAnalyzing, canInvite, onInvite }: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {insights?.llmSynthesis && (
        <div className="enhanced-glass-card">
          <h3 className="enhanced-glass-heading text-lg mb-3" style={{ color: '#784552' }}>
            Group Insights Summary
          </h3>
          <p className="enhanced-glass-body mb-4" style={{ color: '#7e4151' }}>
            {insights.llmSynthesis.overview}
          </p>
          {insights.llmSynthesis.keyInsights.length > 0 && (
            <div className="space-y-2">
              {insights.llmSynthesis.keyInsights.slice(0, 3).map((insight, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-pink-400">•</span>
                  <span className="enhanced-glass-subtle text-sm" style={{ color: '#7e4151' }}>
                    {insight}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!insights?.llmSynthesis && (
        <div className="enhanced-glass-card text-center">
          <span className="text-4xl mb-4 block">🧪</span>
          <p className="enhanced-glass-body mb-4" style={{ color: '#7e4151' }}>
            {members.filter((m) => m.hasSharedData).length < 2
              ? 'Need at least 2 members sharing data to generate insights'
              : 'No analysis has been run yet'}
          </p>
          <button
            onClick={onAnalyze}
            disabled={isAnalyzing || members.filter((m) => m.hasSharedData).length < 2}
            className="enhanced-action-button px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="enhanced-glass-text" style={{ color: '#6a1f33' }}>
              {isAnalyzing ? 'Analyzing...' : 'Run Analysis'}
            </span>
          </button>
        </div>
      )}

      <div className="enhanced-glass-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="enhanced-glass-heading text-lg" style={{ color: '#784552' }}>
            Members
          </h3>
          {canInvite && (
            <button
              onClick={onInvite}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-pink-400/20 to-purple-400/20 border border-pink-400/30 text-pink-200 text-sm hover:from-pink-400/30 hover:to-purple-400/30 transition-all hover:scale-105"
            >
              + Invite Members
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {members.slice(0, 8).map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10"
            >
              <span>{member.avatar || '👤'}</span>
              <span className="enhanced-glass-subtle text-sm" style={{ color: '#7e4151' }}>
                {member.displayName || member.username}
              </span>
              {member.role === 'creator' && <span className="text-yellow-400 text-xs">👑</span>}
              {member.hasSharedData && <span className="text-green-400 text-xs">✓</span>}
            </div>
          ))}
          {members.length > 8 && (
            <span className="px-3 py-1 text-white/50 text-sm">+{members.length - 8} more</span>
          )}
        </div>
      </div>

      <div className="enhanced-glass-card">
        <h3 className="enhanced-glass-heading text-lg mb-4" style={{ color: '#784552' }}>
          Group Settings
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="enhanced-glass-subtle" style={{ color: '#6a1f33' }}>
              Type:
            </span>
            <span className="enhanced-glass-body ml-2 capitalize" style={{ color: '#7e4151' }}>
              {group.type}
            </span>
          </div>
          <div>
            <span className="enhanced-glass-subtle" style={{ color: '#6a1f33' }}>
              Privacy:
            </span>
            <span className="enhanced-glass-body ml-2 capitalize" style={{ color: '#7e4151' }}>
              {group.privacy}
            </span>
          </div>
          <div>
            <span className="enhanced-glass-subtle" style={{ color: '#6a1f33' }}>
              Created:
            </span>
            <span className="enhanced-glass-body ml-2" style={{ color: '#7e4151' }}>
              {new Date(group.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div>
            <span className="enhanced-glass-subtle" style={{ color: '#6a1f33' }}>
              Max Members:
            </span>
            <span className="enhanced-glass-body ml-2" style={{ color: '#7e4151' }}>
              {group.maxMembers}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
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
