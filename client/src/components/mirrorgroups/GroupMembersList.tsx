// src/components/mirrorgroups/GroupMembersList.tsx
// Group members management component with inline expandable details

import { useState, useEffect } from 'react';
import InviteMembersPanel from './InviteMembersModal';
import type { GroupMember, MemberRole, ExtendedGroupMember } from '../../types/groups';
import {
  getMemberDetails,
  banMember,
  removeMember,
  updateMemberRole,
  transferOwnership,
} from '../../services/groupsApi';

interface GroupMembersListProps {
  groupId: string;
  members: GroupMember[];
  canInvite?: boolean;
  currentUserRole?: string;
  currentUserId?: number;
  groupType?: string;
  onRefresh?: () => void;
}

export default function GroupMembersList({ groupId, members, canInvite = false, currentUserRole, currentUserId, groupType, onRefresh }: GroupMembersListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMemberId, setExpandedMemberId] = useState<number | null>(null);
  const [showInvitePanel, setShowInvitePanel] = useState(false);

  const filteredMembers = members.filter(
    (m) =>
      m.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.displayName && m.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const sortedMembers = [...filteredMembers].sort((a, b) => {
    const roleOrder: Record<string, number> = {
      owner: 0,
      creator: 0,
      admin: 1,
      moderator: 2,
      member: 3,
    };
    return (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3);
  });

  const handleToggleExpand = (memberId: number) => {
    setExpandedMemberId(expandedMemberId === memberId ? null : memberId);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="enhanced-glass-heading text-lg" style={{ color: 'var(--mg-heading, #784552)' }}>
          Members ({members.length})
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
      {canInvite && (
        <InviteMembersPanel
          groupId={groupId}
          currentMembers={members}
          isOpen={showInvitePanel}
          onClose={() => setShowInvitePanel(false)}
          onInviteSent={() => {
            onRefresh?.();
            setShowInvitePanel(false);
          }}
        />
      )}

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-3 pl-10 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-pink-400/50"
          placeholder="Search members..."
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50">🔍</span>
      </div>

      {/* Stats Bar */}
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400"></div>
          <span className="enhanced-glass-subtle" style={{ color: 'var(--mg-label, #6a1f33)' }}>
            {members.filter((m) => m.isOnline).length}{' Online & '} {members.filter((m) => m.hasSharedData).length} Sharing Data
          </span>
        </div>
      </div>

      {/* Members List */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {sortedMembers.map((member) => (
          <MemberCard
            key={member.id}
            member={member}
            groupId={groupId}
            isExpanded={expandedMemberId === member.userId}
            onToggleExpand={() => handleToggleExpand(member.userId)}
            currentUserRole={currentUserRole}
            currentUserId={currentUserId}
            groupType={groupType}
            onRefresh={onRefresh}
          />
        ))}
      </div>

      {/* Empty State */}
      {sortedMembers.length === 0 && (
        <div className="text-center py-8">
          <span className="text-4xl mb-4 block">👥</span>
          <p className="enhanced-glass-body" style={{ color: 'var(--mg-body, #7e4151)' }}>
            {searchQuery ? 'No members found' : 'No members yet'}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MEMBER CARD WITH INLINE EXPANDABLE DETAILS
// ============================================================================

interface MemberCardProps {
  member: GroupMember;
  groupId: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  currentUserRole?: string;
  currentUserId?: number;
  groupType?: string;
  onRefresh?: () => void;
}

function MemberCard({ member, groupId, isExpanded, onToggleExpand, currentUserRole, currentUserId, groupType, onRefresh }: MemberCardProps) {
  const [extendedDetails, setExtendedDetails] = useState<ExtendedGroupMember | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'ban' | 'remove' | 'transfer' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const isOwner = currentUserRole === 'owner';
  const isAdmin = currentUserRole === 'admin' || isOwner;
  const isSelf = currentUserId === member.userId;
  const isAnonymous = groupType === 'anonymous';
  // In anonymous groups, only the owner can manage members (admins don't see real identities)
  const canManage = (isAnonymous ? isOwner : isAdmin) && !isSelf && member.role !== 'owner';
  const canChangeRole = isOwner && !isSelf && member.role !== 'owner';
  const canTransfer = isOwner && !isSelf && member.role !== 'owner';

  const handleAction = async (action: 'ban' | 'remove' | 'transfer') => {
    setActionPending(true);
    setActionError(null);
    try {
      if (action === 'ban') {
        await banMember(groupId, member.userId);
      } else if (action === 'remove') {
        await removeMember(groupId, member.userId);
      } else if (action === 'transfer') {
        await transferOwnership(groupId, member.userId);
      }
      setConfirmAction(null);
      onRefresh?.();
    } catch (err: any) {
      setActionError(err?.error || err?.message || 'Action failed');
    } finally {
      setActionPending(false);
    }
  };

  const handleRoleChange = async (newRole: string) => {
    setActionPending(true);
    setActionError(null);
    try {
      await updateMemberRole(groupId, member.userId, newRole);
      setSelectedRole(null);
      onRefresh?.();
    } catch (err: any) {
      setActionError(err?.error || err?.message || 'Failed to update role');
    } finally {
      setActionPending(false);
    }
  };
  const [hasSharedProfile, setHasSharedProfile] = useState(false);

  // Fetch details when expanded
  useEffect(() => {
    if (isExpanded && !extendedDetails) {
      const fetchDetails = async () => {
        setIsLoading(true);
        try {
          const details = await getMemberDetails(groupId, member.userId);
          if (details) {
            setExtendedDetails(details);
            setHasSharedProfile(
              member.sharedDataTypes?.includes('profile') ||
              member.sharedDataTypes?.includes('full_profile') ||
              false
            );
          }
        } catch (error) {
          console.error('Failed to fetch member details:', error);
        } finally {
          setIsLoading(false);
        }
      };
      fetchDetails();
    }
  }, [isExpanded, groupId, member.userId, member.sharedDataTypes, extendedDetails]);

  const getRoleBadge = (role: MemberRole) => {
    const badges: Record<string, { label: string; color: string; icon: string }> = {
      owner: { label: 'Owner', color: 'bg-yellow-500/20 text-yellow-300', icon: '👑' },
      creator: { label: 'Creator', color: 'bg-yellow-500/20 text-yellow-300', icon: '👑' },
      admin: { label: 'Admin', color: 'bg-purple-500/20 text-purple-300', icon: '⚡' },
      moderator: { label: 'Mod', color: 'bg-blue-500/20 text-blue-300', icon: '🛡️' },
      member: { label: 'Member', color: 'bg-white/10 text-white/70', icon: '' },
    };
    return badges[role] || badges['member'];
  };

  const formatBirthdate = (birthdate: string | undefined) => {
    if (!birthdate) return null;
    const date = new Date(birthdate);
    const today = new Date();
    const age = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();
    const adjustedAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate()) ? age - 1 : age;
    return `${date.toLocaleDateString()} (${adjustedAge} years old)`;
  };

  const roleBadge = getRoleBadge(member.role);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand();
  };
  const types = member.sharedDataTypes.includes("full_profile")
    ? ["Full Profile"]
    : member.sharedDataTypes;

  return (
    <div className="enhanced-glass-card">
      {/* Clickable Header */}
      <div
        className="cursor-pointer select-none"
        onClick={handleClick}
      >
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400/30 to-purple-400/30 flex items-center justify-center text-xl">
            {member.avatar || '👤'}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="enhanced-glass-text font-medium truncate"
                style={{ color: 'var(--mg-heading, #784552)' }}
              >
                {member.displayName || member.username}
              </span>
              {roleBadge.icon && <span className="text-sm">{roleBadge.icon}</span>}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`px-2 py-0.5 rounded text-xs ${roleBadge.color}`}
              >
                {roleBadge.label}
              </span>
              {member.hasSharedData && (
                <span className="text-green-400 text-xs">✓ Sharing</span>
              )}
            </div>
          </div>

          {/* Status & Expand Arrow */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <div
                className={`w-2 h-2 rounded-full ${
                  member.isOnline ? 'bg-green-400' : 'bg-gray-400'
                }`}
              />
              <span className="enhanced-glass-subtle text-xs mt-1" style={{ color: 'var(--mg-label, #6a1f33)' }}>
                {member.isOnline
                  ? 'Online'
                  : member.lastActive
                    ? formatRelativeTime(member.lastActive)
                    : 'Offline'}
              </span>
            </div>
            <span
              className="text-white/40 text-sm transition-transform duration-200"
              style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              ▼
            </span>
          </div>
        </div>

        {/* Shared Data Types Preview (collapsed) */}
        {!isExpanded && member.hasSharedData && member.sharedDataTypes.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <div style={{ display: "flex", gap: 6 }}>
              {types.map((type, i) => (
                <span
                  key={type}
                  className="px-2.5 py-0.5 rounded-full bg-white/10 text-xs text-white/70"
                >
                  {formatDataType(type)}
                  {i < types.length - 1 && ", "}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-white/10 space-y-4">
          {isLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin text-2xl mb-2">⏳</div>
              <p className="text-white/50 text-sm">Loading details...</p>
            </div>
          ) : (
            <>
              {/* Username & Status */}
              <div className="flex items-center gap-2">
                <span className="text-white/50 text-sm">@{member.username}</span>
                <span
                  className={`px-2 py-0.5 rounded text-xs ${
                    member.status === 'active'
                      ? 'bg-green-500/20 text-green-300'
                      : 'bg-gray-500/20 text-gray-300'
                  }`}
                >
                  {member.status}
                </span>
              </div>

              {/* Bio - only if profile shared */}
              {hasSharedProfile && extendedDetails?.bio && (
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="enhanced-glass-subtle text-xs mb-1" style={{ color: 'var(--mg-label, #6a1f33)' }}>
                    Bio
                  </p>
                  <p className="enhanced-glass-text text-sm" style={{ color: 'var(--mg-body, #7e4151)' }}>
                    {extendedDetails.bio}
                  </p>
                </div>
              )}

              {/* Basic Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="enhanced-glass-subtle text-xs mb-1" style={{ color: 'var(--mg-label, #6a1f33)' }}>
                    Joined Group
                  </p>
                  <p className="enhanced-glass-text text-sm" style={{ color: 'var(--mg-body, #7e4151)' }}>
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="enhanced-glass-subtle text-xs mb-1" style={{ color: 'var(--mg-label, #6a1f33)' }}>
                    Last Active
                  </p>
                  <p className="enhanced-glass-text text-sm" style={{ color: 'var(--mg-body, #7e4151)' }}>
                    {member.isOnline
                      ? 'Online now'
                      : member.lastActive
                        ? formatRelativeTime(member.lastActive)
                        : 'No activity yet'}
                  </p>
                </div>
              </div>

              {/* Contact Info - only if profile shared */}
              {hasSharedProfile && (
                <div className="grid grid-cols-2 gap-3">
                  {extendedDetails?.email && (
                    <div className="bg-white/5 rounded-lg p-3">
                      <p className="enhanced-glass-subtle text-xs mb-1" style={{ color: 'var(--mg-label, #6a1f33)' }}>
                        Email
                      </p>
                      <p className="enhanced-glass-text text-sm truncate" style={{ color: 'var(--mg-body, #7e4151)' }}>
                        {extendedDetails.email}
                      </p>
                    </div>
                  )}
                  {extendedDetails?.phone && (
                    <div className="bg-white/5 rounded-lg p-3">
                      <p className="enhanced-glass-subtle text-xs mb-1" style={{ color: 'var(--mg-label, #6a1f33)' }}>
                        Phone
                      </p>
                      <p className="enhanced-glass-text text-sm" style={{ color: 'var(--mg-body, #7e4151)' }}>
                        {extendedDetails.phone}
                      </p>
                    </div>
                  )}
                  {extendedDetails?.birthdate && (
                    <div className="bg-white/5 rounded-lg p-3">
                      <p className="enhanced-glass-subtle text-xs mb-1" style={{ color: 'var(--mg-label, #6a1f33)' }}>
                        Birthdate
                      </p>
                      <p className="enhanced-glass-text text-sm" style={{ color: 'var(--mg-body, #7e4151)' }}>
                        {formatBirthdate(extendedDetails.birthdate)}
                      </p>
                    </div>
                  )}
                  {extendedDetails?.location && (
                    <div className="bg-white/5 rounded-lg p-3">
                      <p className="enhanced-glass-subtle text-xs mb-1" style={{ color: 'var(--mg-label, #6a1f33)' }}>
                        Location
                      </p>
                      <p className="enhanced-glass-text text-sm" style={{ color: 'var(--mg-body, #7e4151)' }}>
                        {extendedDetails.location}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Shared Data */}
              <div className="bg-white/5 rounded-lg p-3">
                <p className="enhanced-glass-subtle text-xs mb-2" style={{ color: 'var(--mg-label, #6a1f33)' }}>
                  Shared Data with Group
                </p>
                {member.hasSharedData && member.sharedDataTypes.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {types.map((type, i) => (
                      <span
                        key={type}
                        className="px-2.5 py-0.5 rounded-full bg-white/10 text-xs text-white/70"
                      >
                        {formatDataType(type)}
                        {i < types.length - 1 && ", "}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="enhanced-glass-text text-sm" style={{ color: 'var(--mg-body, #7e4151)' }}>
                    Not sharing data
                  </p>
                )}
              </div>

              {/* Privacy note if profile not shared */}
              {!hasSharedProfile && (
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <p className="text-white/50 text-xs text-center">
                    Contact info is only visible when the member shares their profile
                  </p>
                </div>
              )}

              {/* ==================== MEMBER MANAGEMENT ACTIONS ==================== */}
              {canManage && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  {actionError && (
                    <div className="mb-2 p-2 rounded bg-red-500/15 border border-red-500/30">
                      <p className="text-red-300 text-xs">{actionError}</p>
                    </div>
                  )}

                  {/* Confirmation dialog */}
                  {confirmAction && (
                    <div className="mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/25">
                      <p className="text-white/80 text-sm mb-2">
                        {confirmAction === 'ban' && `Ban ${member.displayName || member.username} from this group? They will not be able to rejoin.`}
                        {confirmAction === 'remove' && `Remove ${member.displayName || member.username} from this group? They can rejoin later.`}
                        {confirmAction === 'transfer' && `Transfer group ownership to ${member.displayName || member.username}? You will become an admin.`}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAction(confirmAction)}
                          disabled={actionPending}
                          type="button"
                          className="px-3 py-1.5 rounded text-xs font-medium"
                          style={{
                            background: confirmAction === 'transfer'
                              ? 'rgba(251,191,36,0.2)'
                              : 'rgba(239,68,68,0.2)',
                            border: `1px solid ${confirmAction === 'transfer'
                              ? 'rgba(251,191,36,0.4)'
                              : 'rgba(239,68,68,0.4)'}`,
                            color: confirmAction === 'transfer' ? '#fde68a' : '#fca5a5',
                            opacity: actionPending ? 0.5 : 1,
                            cursor: actionPending ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {actionPending ? 'Processing...' : 'Confirm'}
                        </button>
                        <button
                          onClick={() => { setConfirmAction(null); setActionError(null); }}
                          disabled={actionPending}
                          type="button"
                          className="px-3 py-1.5 rounded text-xs text-white/50"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Role change dropdown */}
                  {canChangeRole && selectedRole === null && !confirmAction && (
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-white/40 text-xs">Role:</span>
                      <select
                        value={member.role}
                        onChange={(e) => {
                          if (e.target.value !== member.role) {
                            handleRoleChange(e.target.value);
                          }
                        }}
                        disabled={actionPending}
                        className="text-xs rounded px-2 py-1"
                        style={{
                          background: 'rgba(255,255,255,0.08)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          color: '#d4a0ad',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="member">Member</option>
                        <option value="moderator">Moderator</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  )}

                  {/* Action buttons */}
                  {!confirmAction && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setConfirmAction('remove')}
                        type="button"
                        className="px-3 py-1.5 rounded text-xs"
                        style={{
                          background: 'rgba(239,68,68,0.1)',
                          border: '1px solid rgba(239,68,68,0.25)',
                          color: '#fca5a5',
                          cursor: 'pointer',
                        }}
                      >
                        Remove
                      </button>
                      <button
                        onClick={() => setConfirmAction('ban')}
                        type="button"
                        className="px-3 py-1.5 rounded text-xs"
                        style={{
                          background: 'rgba(239,68,68,0.15)',
                          border: '1px solid rgba(239,68,68,0.35)',
                          color: '#f87171',
                          cursor: 'pointer',
                        }}
                      >
                        Ban
                      </button>
                      {canTransfer && (
                        <button
                          onClick={() => setConfirmAction('transfer')}
                          type="button"
                          className="px-3 py-1.5 rounded text-xs"
                          style={{
                            background: 'rgba(251,191,36,0.1)',
                            border: '1px solid rgba(251,191,36,0.25)',
                            color: '#fde68a',
                            cursor: 'pointer',
                          }}
                        >
                          Transfer Ownership
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
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

const DATA_TYPE_LABELS: Record<string, string> = {
  personality: 'Personality',
  cognitive: 'Cognitive',
  facial: 'Visual Analysis',
  voice: 'Voice',
  astrological: 'Astrological',
  profile: 'Profile',
  full_profile: 'Full Profile',
};

function formatDataType(type: string): string {
  const label = DATA_TYPE_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return label + ' ';
}