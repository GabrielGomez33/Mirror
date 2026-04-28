// src/components/mirrorgroups/GroupDetailView.tsx
// Detailed view of a single MirrorGroup with tabs for different sections

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useGroups } from '../../context/GroupContext';
import GroupInsightsPanel from './GroupInsightsPanel';
import VotingSystem from './VotingSystem';
import GroupMembersList from './GroupMembersList';
import DataSharingPanel from './DataSharingPanel';
import ChatWindow from '../chat/ChatWindow';
import InviteMembersPanel from './InviteMembersModal';
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
  return userInfo?.userId ?? 0;
};

export default function GroupDetailView({ groupId, onBack }: GroupDetailViewProps) {
  const {
    currentGroup,
    currentMembers,
    currentInsights,
    activeVotes,
    voteHistory,
    isLoading,
    isLoadingInsights,
    fetchGroupDetails,
    fetchInsights,
    fetchActiveVotes,
    fetchVoteHistory,
    leaveGroup,
    deleteGroup,
    triggerAnalysis,
  } = useGroups();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Check permissions based on current user's membership
  const currentUserId = getCurrentUserId();

  // Find current user's membership (handle both camelCase and snake_case from API)
  const currentMember = currentMembers.find((m) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const memberId = m.userId ?? (m as any).user_id;
    return Number(memberId) === currentUserId;
  });

  // isOwner: true if member has 'owner' or 'creator' role
  // Using string cast to handle API returning 'owner' which may not be in the cached type
  const memberRole = currentMember?.role as string | undefined;
  const isOwner = memberRole === 'owner' || memberRole === 'creator';

  // canInvite: owner, creator, or admin can invite
  const canInvite = !!(currentMember && ['owner', 'creator', 'admin'].includes(memberRole as string));

  // Fetch group data on mount (including chat preload)
  useEffect(() => {
    // Fetch all group data in parallel
    fetchGroupDetails(groupId);
    fetchInsights(groupId);
    fetchActiveVotes(groupId);
    fetchVoteHistory(groupId);

    // Preload chat messages so they're ready when user clicks Chat tab
    preloadGroupMessages(groupId);
  }, [groupId, fetchGroupDetails, fetchInsights, fetchActiveVotes, fetchVoteHistory]);

  const [isLeaving, setIsLeaving] = useState(false);

  const handleLeaveGroup = async () => {
    if (isLeaving) return;
    setIsLeaving(true);

    // Navigate FIRST to prevent "Group not found" flash
    // (leaveGroup dispatches REMOVE_GROUP which sets currentGroup to null)
    onBack();

    try {
      // Process leave in background after navigation
      await leaveGroup(groupId);
    } catch (error) {
      console.error('Failed to leave group:', error);
      // User already navigated - they can rejoin if needed
    }
  };

  const handleDeleteGroup = useCallback(async () => {
    setIsDeleting(true);
    const success = await deleteGroup(groupId);
    setIsDeleting(false);
    if (success) {
      onBack();
    }
  }, [deleteGroup, groupId, onBack]);

  const handleTriggerAnalysis = useCallback(async (userContext?: string) => {
    await triggerAnalysis(groupId, userContext);
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
            style={{
               color: 'rgb(120, 69, 82)',
               textShadow: '0 3px 12px rgba(0, 0, 0, .4), 0 1px 3px rgba(255, 255, 255, .15)',
           }}
          >
            <span>←</span>
            <span >Back to Groups</span>
          </button>

          <div className="flex gap-2 relative z-20">
            {isOwner && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(true);
                }}
				className="mb-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 transition-all duration-200 group"
                type="button"
              >
                Delete
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowLeaveConfirm(!showLeaveConfirm);
              }}
              className={`px-4 py-2 rounded-lg border text-sm transition-colors cursor-pointer ${
                showLeaveConfirm
                  ? 'bg-red-500/40 border-red-500/50 text-red-200'
                  : 'bg-red-500/20 border-red-500/30 text-red-300 hover:bg-red-500/30'
              }`}
              type="button"
            >
              {showLeaveConfirm ? 'Cancel' : 'Leave'}
            </button>
          </div>
        </div>

        {/* Leave Confirmation Panel - Inline slide-down */}
        {showLeaveConfirm && (
          <div
            className="mt-4 rounded-xl bg-red-500/10 border border-red-500/20 overflow-hidden"
            style={{ animation: 'slideDown 0.2s ease-out' }}
          >
            <style>{`
              @keyframes slideDown {
                from { opacity: 0; transform: translateY(-10px); max-height: 0; }
                to { opacity: 1; transform: translateY(0); max-height: 200px; }
              }
            `}</style>

            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">⚠️</span>
                </div>
                <div className="flex-1">
                  <h4 className="text-red-200 font-medium mb-1">Leave this group?</h4>
                  <p className="text-red-300/70 text-sm mb-4">
                    Your shared data will be removed and you'll need to be invited again to rejoin.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowLeaveConfirm(false)}
                      className="px-4 py-2 rounded-lg bg-white/10 text-white/80 text-sm hover:bg-white/20 transition-colors"
                      type="button"
                    >
                      Keep Membership
                    </button>
                    <button
                      onClick={handleLeaveGroup}
                      disabled={isLeaving}
                      className="px-4 py-2 rounded-lg bg-red-500/30 text-red-200 text-sm hover:bg-red-500/40 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      type="button"
                    >
                      {isLeaving ? 'Leaving...' : 'Leave Group'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

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
            groupId={groupId}
            onInviteSent={() => fetchGroupDetails(groupId)}
          />
        )}

        {activeTab === 'chat' && <ChatWindow groupId={groupId} groupName={currentGroup.name} />}

        {activeTab === 'members' && (
          <GroupMembersList
            groupId={groupId}
            members={currentMembers}
            canInvite={canInvite}
            onRefresh={() => fetchGroupDetails(groupId)}
          />
        )}

        {activeTab === 'insights' && (
          <GroupInsightsPanel
            groupId={groupId}
            insights={currentInsights}
            isLoading={isLoadingInsights}
            onRefresh={handleTriggerAnalysis}
            currentUserRole={isOwner ? 'owner' : canInvite ? 'admin' : 'member'}
          />
        )}

        {activeTab === 'voting' && <VotingSystem groupId={groupId} votes={activeVotes} pastVotes={voteHistory} />}

        {activeTab === 'sharing' && <DataSharingPanel groupId={groupId} />}
      </div>

      {/* Delete Confirmation Modal — Portal + inline styles to bypass CSS cascade */}
      {showDeleteConfirm && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
          onClick={() => !isDeleting && setShowDeleteConfirm(false)}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '28rem',
              padding: '1.5rem',
              background: 'rgb(205 194 255 / 84%)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '24px',
              boxShadow: '0 16px 60px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.18)',
              backdropFilter: 'blur(30px)',
              WebkitBackdropFilter: 'blur(30px)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#dc2626', marginBottom: '1rem' }}>
              {'\u26A0\uFE0F'} Delete Group?
            </h3>
            <p style={{ color: '#7e4151', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              This action <strong>cannot be undone</strong>. All group data, chat history, and member
              connections will be permanently deleted.
            </p>
            <div style={{
              padding: '0.75rem',
              borderRadius: '0.5rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              marginBottom: '1.5rem',
            }}>
              <p style={{ color: '#7c63e3', fontSize: '0.875rem', margin: 0 }}>
                Deleting: <strong>{currentGroup.name}</strong>
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                type="button"
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  color: 'rgb(108 79 225)',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  opacity: isDeleting ? 0.5 : 1,
                  transition: 'background 0.2s ease',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteGroup}
                disabled={isDeleting}
                type="button"
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  background: 'rgb(205 194 255 / 84%);',
                  border: 'none',
                  color: '#7c63e3',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  opacity: isDeleting ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'background 0.2s ease',
                }}
              >
                {isDeleting ? (
                  <>
                    <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>{'\u23F3'}</span>
                    Deleting...
                  </>
                ) : (
                  <>Delete Permanently</>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
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
  groupId: string;
  onInviteSent: () => void;
}

function OverviewTab({ group, members, insights, onAnalyze, isAnalyzing, canInvite, groupId, onInviteSent }: OverviewTabProps) {
  const [showInvitePanel, setShowInvitePanel] = useState(false);

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
              onClick={() => setShowInvitePanel(!showInvitePanel)}
              className={`px-4 py-2 rounded-lg bg-gradient-to-r from-pink-400/20 to-purple-400/20 border border-pink-400/30 text-pink-200 text-sm hover:from-pink-400/30 hover:to-purple-400/30 transition-all ${showInvitePanel ? 'ring-2 ring-pink-400/50' : 'hover:scale-105'}`}
            >
              {showInvitePanel ? '− Close' : '+ Invite Members'}
            </button>
          )}
        </div>

        {/* Inline Invite Panel */}
        <InviteMembersPanel
          groupId={groupId}
          currentMembers={members}
          isOpen={showInvitePanel}
          onClose={() => setShowInvitePanel(false)}
          onInviteSent={() => {
            onInviteSent();
            setShowInvitePanel(false);
          }}
        />

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
