// src/components/mirrorgroups/InviteMembersModal.tsx
// Modal for searching and inviting users to a group

import { useState, useEffect, useCallback, useRef } from 'react';
import { searchUsers } from '../../services/userApi';
import type { SearchedUser } from '../../services/userApi';
import { inviteMember } from '../../services/groupsApi';
import type { GroupMember } from '../../types/groups';

interface InviteMembersModalProps {
  groupId: string;
  groupName: string;
  currentMembers: GroupMember[];
  onClose: () => void;
  onInviteSent: () => void;
}

export default function InviteMembersModal({
  groupId,
  groupName,
  currentMembers,
  onClose,
  onInviteSent,
}: InviteMembersModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchedUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<SearchedUser[]>([]);
  const [inviteMessage, setInviteMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendingStatus, setSendingStatus] = useState<{ user: SearchedUser; status: 'pending' | 'success' | 'error'; message?: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get current member user IDs to filter out from search results
  const currentMemberIds = new Set(currentMembers.map((m) => m.userId));

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      const response = await searchUsers(searchQuery, 20);

      if (response.success && response.data) {
        // Filter out users who are already members or already selected
        const selectedIds = new Set(selectedUsers.map((u) => u.id));
        const filtered = response.data.users.filter(
          (user) => !currentMemberIds.has(user.id) && !selectedIds.has(user.id)
        );
        setSearchResults(filtered);
      } else {
        setSearchResults([]);
        if (response.error) {
          setError(response.error);
        }
      }
      setIsSearching(false);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, selectedUsers, currentMemberIds]);

  const handleSelectUser = useCallback((user: SearchedUser) => {
    setSelectedUsers((prev) => [...prev, user]);
    setSearchQuery('');
    setSearchResults([]);
    inputRef.current?.focus();
  }, []);

  const handleRemoveUser = useCallback((userId: number) => {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== userId));
  }, []);

  const handleSendInvitations = async () => {
    if (selectedUsers.length === 0) return;

    setIsSending(true);
    setError(null);
    setSendingStatus(selectedUsers.map((user) => ({ user, status: 'pending' })));

    const results: typeof sendingStatus = [];

    for (const user of selectedUsers) {
      try {
        const response = await inviteMember(groupId, {
          username: user.username,
          message: inviteMessage || undefined,
        });

        if (response.success) {
          results.push({ user, status: 'success', message: 'Invitation sent' });
        } else {
          results.push({
            user,
            status: 'error',
            message: (response as any).error || 'Failed to send invitation',
          });
        }
      } catch (err) {
        results.push({
          user,
          status: 'error',
          message: 'Network error',
        });
      }

      // Update status as we go
      setSendingStatus([...results, ...selectedUsers.slice(results.length).map((u) => ({ user: u, status: 'pending' as const }))]);
    }

    setSendingStatus(results);
    setIsSending(false);

    // If all successful, close after a short delay
    const allSuccessful = results.every((r) => r.status === 'success');
    if (allSuccessful) {
      setTimeout(() => {
        onInviteSent();
        onClose();
      }, 1500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const successCount = sendingStatus.filter((s) => s.status === 'success').length;
  const errorCount = sendingStatus.filter((s) => s.status === 'error').length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative enhanced-glass-panel p-6 max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="enhanced-glass-heading text-xl" style={{ color: '#784552' }}>
              Invite Members
            </h2>
            <p className="enhanced-glass-subtle text-sm mt-1" style={{ color: '#6a1f33' }}>
              to {groupName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
          >
            x
          </button>
        </div>

        {/* Search Input */}
        <div className="mb-4">
          <label className="block enhanced-glass-subtle text-sm mb-2" style={{ color: '#6a1f33' }}>
            Search users by username
          </label>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type at least 2 characters..."
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-pink-400/50"
              disabled={isSending}
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <span className="animate-spin text-white/50">...</span>
              </div>
            )}
          </div>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mb-4 max-h-40 overflow-y-auto rounded-xl bg-white/5 border border-white/10">
            {searchResults.map((user) => (
              <button
                key={user.id}
                onClick={() => handleSelectUser(user)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/10 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-pink-400/30 to-purple-400/30 flex items-center justify-center text-white font-medium">
                  {user.username[0]?.toUpperCase() || '?'}
                </div>
                <span className="enhanced-glass-body" style={{ color: '#7e4151' }}>
                  {user.username}
                </span>
                <span className="ml-auto text-white/30 text-sm">+ Add</span>
              </button>
            ))}
          </div>
        )}

        {/* Selected Users */}
        {selectedUsers.length > 0 && (
          <div className="mb-4">
            <label className="block enhanced-glass-subtle text-sm mb-2" style={{ color: '#6a1f33' }}>
              Selected ({selectedUsers.length})
            </label>
            <div className="flex flex-wrap gap-2">
              {selectedUsers.map((user) => {
                const status = sendingStatus.find((s) => s.user.id === user.id);
                return (
                  <div
                    key={user.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
                      status?.status === 'success'
                        ? 'bg-green-400/20 border border-green-400/30'
                        : status?.status === 'error'
                        ? 'bg-red-400/20 border border-red-400/30'
                        : 'bg-pink-400/20 border border-pink-400/30'
                    }`}
                  >
                    <span className="enhanced-glass-body text-sm" style={{ color: '#7e4151' }}>
                      {user.username}
                    </span>
                    {status?.status === 'success' && <span className="text-green-400 text-xs">OK</span>}
                    {status?.status === 'error' && (
                      <span className="text-red-400 text-xs" title={status.message}>
                        Failed
                      </span>
                    )}
                    {!isSending && !status && (
                      <button
                        onClick={() => handleRemoveUser(user.id)}
                        className="text-white/50 hover:text-white/80 text-xs"
                      >
                        x
                      </button>
                    )}
                    {status?.status === 'pending' && (
                      <span className="animate-pulse text-white/50 text-xs">...</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Optional Message */}
        {selectedUsers.length > 0 && !sendingStatus.length && (
          <div className="mb-4">
            <label className="block enhanced-glass-subtle text-sm mb-2" style={{ color: '#6a1f33' }}>
              Invitation message (optional)
            </label>
            <textarea
              value={inviteMessage}
              onChange={(e) => setInviteMessage(e.target.value)}
              placeholder="Add a personal message..."
              rows={2}
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-pink-400/50 resize-none"
              disabled={isSending}
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Status Summary */}
        {sendingStatus.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="enhanced-glass-body text-sm" style={{ color: '#7e4151' }}>
              {successCount > 0 && (
                <span className="text-green-400">{successCount} sent successfully. </span>
              )}
              {errorCount > 0 && (
                <span className="text-red-400">{errorCount} failed. </span>
              )}
              {successCount === selectedUsers.length && 'Closing...'}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end mt-auto pt-4 border-t border-white/10">
          <button
            onClick={onClose}
            disabled={isSending}
            className="px-4 py-2 rounded-lg bg-white/10 text-white/80 hover:bg-white/20 transition-colors disabled:opacity-50"
          >
            {sendingStatus.length > 0 ? 'Close' : 'Cancel'}
          </button>
          {selectedUsers.length > 0 && sendingStatus.length === 0 && (
            <button
              onClick={handleSendInvitations}
              disabled={isSending}
              className="px-6 py-2 rounded-lg bg-gradient-to-r from-pink-400/30 to-purple-400/30 border border-pink-400/30 text-white hover:from-pink-400/40 hover:to-purple-400/40 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isSending ? (
                <>
                  <span className="animate-spin">...</span>
                  Sending...
                </>
              ) : (
                <>
                  Send {selectedUsers.length === 1 ? 'Invitation' : `${selectedUsers.length} Invitations`}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
