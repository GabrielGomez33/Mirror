// src/components/mirrorgroups/GroupMembersList.tsx
// Group members management component

import { useState } from 'react';
import { useGroups } from '../../context/GroupContext';
import type { GroupMember, MemberRole } from '../../types/groups';

interface GroupMembersListProps {
  groupId: string;
  members: GroupMember[];
}

export default function GroupMembersList({ groupId, members }: GroupMembersListProps) {
  const { setShowInviteModal } = useGroups();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<GroupMember | null>(null);

  const filteredMembers = members.filter(
    (m) =>
      m.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.displayName && m.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const sortedMembers = [...filteredMembers].sort((a, b) => {
    const roleOrder: Record<MemberRole, number> = {
      creator: 0,
      admin: 1,
      moderator: 2,
      member: 3,
    };
    return roleOrder[a.role] - roleOrder[b.role];
  });

  const getRoleBadge = (role: MemberRole) => {
    const badges: Record<MemberRole, { label: string; color: string; icon: string }> = {
      creator: { label: 'Creator', color: 'bg-yellow-500/20 text-yellow-300', icon: '👑' },
      admin: { label: 'Admin', color: 'bg-purple-500/20 text-purple-300', icon: '⚡' },
      moderator: { label: 'Mod', color: 'bg-blue-500/20 text-blue-300', icon: '🛡️' },
      member: { label: 'Member', color: 'bg-white/10 text-white/70', icon: '' },
    };
    return badges[role];
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="enhanced-glass-heading text-lg" style={{ color: '#784552' }}>
          Members ({members.length})
        </h3>
        <button
          onClick={() => setShowInviteModal(true)}
          className="enhanced-action-button px-4 py-2"
        >
          <span className="enhanced-glass-text text-sm" style={{ color: '#6a1f33' }}>
            + Invite
          </span>
        </button>
      </div>

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
          <span className="enhanced-glass-subtle" style={{ color: '#6a1f33' }}>
            {members.filter((m) => m.status === 'active').length} Active
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-400"></div>
          <span className="enhanced-glass-subtle" style={{ color: '#6a1f33' }}>
            {members.filter((m) => m.hasSharedData).length} Sharing Data
          </span>
        </div>
      </div>

      {/* Members List */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {sortedMembers.map((member) => {
          const roleBadge = getRoleBadge(member.role);

          return (
            <div
              key={member.id}
              onClick={() => setSelectedMember(member)}
              className="enhanced-glass-card cursor-pointer hover:bg-white/10 transition-colors"
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
                      style={{ color: '#784552' }}
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

                {/* Status indicator */}
                <div className="flex flex-col items-end">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      member.status === 'active' ? 'bg-green-400' : 'bg-gray-400'
                    }`}
                  />
                  {member.lastActive && (
                    <span className="enhanced-glass-subtle text-xs mt-1" style={{ color: '#6a1f33' }}>
                      {formatRelativeTime(member.lastActive)}
                    </span>
                  )}
                </div>
              </div>

              {/* Shared Data Types */}
              {member.hasSharedData && member.sharedDataTypes.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="flex flex-wrap gap-1">
                    {member.sharedDataTypes.map((type) => (
                      <span
                        key={type}
                        className="px-2 py-0.5 rounded-full bg-white/10 text-xs text-white/70 capitalize"
                      >
                        {type}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {sortedMembers.length === 0 && (
        <div className="text-center py-8">
          <span className="text-4xl mb-4 block">👥</span>
          <p className="enhanced-glass-body" style={{ color: '#7e4151' }}>
            {searchQuery ? 'No members found' : 'No members yet'}
          </p>
        </div>
      )}

      {/* Member Detail Modal */}
      {selectedMember && (
        <MemberDetailModal
          member={selectedMember}
          groupId={groupId}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// MEMBER DETAIL MODAL
// ============================================================================

interface MemberDetailModalProps {
  member: GroupMember;
  groupId: string;
  onClose: () => void;
}

function MemberDetailModal({ member, onClose }: MemberDetailModalProps) {
  const getRoleBadge = (role: MemberRole) => {
    const badges: Record<MemberRole, { label: string; color: string; icon: string }> = {
      creator: { label: 'Creator', color: 'bg-yellow-500/20 text-yellow-300', icon: '👑' },
      admin: { label: 'Admin', color: 'bg-purple-500/20 text-purple-300', icon: '⚡' },
      moderator: { label: 'Mod', color: 'bg-blue-500/20 text-blue-300', icon: '🛡️' },
      member: { label: 'Member', color: 'bg-white/10 text-white/70', icon: '' },
    };
    return badges[role];
  };

  const roleBadge = getRoleBadge(member.role);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md enhanced-glass-panel p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-400/30 to-purple-400/30 flex items-center justify-center text-3xl">
            {member.avatar || '👤'}
          </div>
          <div>
            <h3 className="enhanced-glass-heading text-xl" style={{ color: '#784552' }}>
              {member.displayName || member.username}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded text-xs ${roleBadge.color}`}>
                {roleBadge.icon} {roleBadge.label}
              </span>
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
          </div>
        </div>

        {/* Details */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-lg p-3">
              <p className="enhanced-glass-subtle text-xs mb-1" style={{ color: '#6a1f33' }}>
                Joined
              </p>
              <p className="enhanced-glass-text text-sm" style={{ color: '#7e4151' }}>
                {new Date(member.joinedAt).toLocaleDateString()}
              </p>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <p className="enhanced-glass-subtle text-xs mb-1" style={{ color: '#6a1f33' }}>
                Last Active
              </p>
              <p className="enhanced-glass-text text-sm" style={{ color: '#7e4151' }}>
                {member.lastActive ? formatRelativeTime(member.lastActive) : 'Unknown'}
              </p>
            </div>
          </div>

          {/* Shared Data */}
          <div className="bg-white/5 rounded-lg p-3">
            <p className="enhanced-glass-subtle text-xs mb-2" style={{ color: '#6a1f33' }}>
              Shared Data
            </p>
            {member.hasSharedData && member.sharedDataTypes.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {member.sharedDataTypes.map((type) => (
                  <span
                    key={type}
                    className="px-2 py-1 rounded-full bg-green-500/20 text-green-300 text-xs capitalize"
                  >
                    {type}
                  </span>
                ))}
              </div>
            ) : (
              <p className="enhanced-glass-text text-sm" style={{ color: '#7e4151' }}>
                Not sharing data
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6">
          <button
            onClick={onClose}
            className="w-full enhanced-action-button py-2"
          >
            <span className="enhanced-glass-text" style={{ color: '#6a1f33' }}>
              Close
            </span>
          </button>
        </div>
      </div>
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
