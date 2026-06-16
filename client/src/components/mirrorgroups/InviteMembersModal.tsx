// src/components/mirrorgroups/InviteMembersModal.tsx
// Inline panel for searching and inviting users to a group
// Slides down from the invite button

import { useState, useEffect, useCallback, useRef } from 'react';
import { searchUsers } from '../../services/userApi';
import type { SearchedUser } from '../../services/userApi';
import { inviteMember } from '../../services/groupsApi';
import type { GroupMember } from '../../types/groups';
import { getUserInfo } from '../../utils/token';

const THEME = {
  textHeading: 'var(--mg-heading, #784552)',
  textPrimary: 'var(--mg-body, #7e4151)',
  textSubtle: 'var(--mg-label, #6a1f33)',
};

interface InviteMembersPanelProps {
  groupId: string;
  currentMembers: GroupMember[];
  isOpen: boolean;
  onClose: () => void;
  onInviteSent: () => void;
}

export default function InviteMembersPanel({
  groupId,
  currentMembers,
  isOpen,
  onClose,
  onInviteSent,
}: InviteMembersPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchedUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<SearchedUser[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendingStatus, setSendingStatus] = useState<{ user: SearchedUser; status: 'pending' | 'success' | 'error'; message?: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentUserId = getUserInfo()?.userId ?? null;

  const currentMemberIds = new Set(
    currentMembers.map((m) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return m.userId ?? (m as any).user_id;
    })
  );

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Reset state when panel closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedUsers([]);
      setSendingStatus([]);
      setError(null);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setError(null);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await searchUsers(searchQuery, 20);

        if (response.success && response.data) {
          const selectedIds = new Set(selectedUsers.map((u) => u.id));
          const filtered = response.data.users.filter(
            (user) =>
              !currentMemberIds.has(user.id) &&
              !selectedIds.has(user.id) &&
              user.id !== currentUserId
          );
          setSearchResults(filtered);
        } else {
          setSearchResults([]);
          if (response.error) {
            setError(response.error);
          }
        }
      } catch (err) {
        setError('Failed to search users');
        setSearchResults([]);
      }
      setIsSearching(false);
    }, 350);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, selectedUsers, currentMemberIds, currentUserId]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setError(null);
  }, []);

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
        });

        if (response.success) {
          results.push({ user, status: 'success', message: 'Invitation sent' });
        } else {
          results.push({
            user,
            status: 'error',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      setSendingStatus([
        ...results,
        ...selectedUsers.slice(results.length).map((u) => ({ user: u, status: 'pending' as const })),
      ]);
    }

    setSendingStatus(results);
    setIsSending(false);

    const allSuccessful = results.every((r) => r.status === 'success');
    if (allSuccessful && results.length > 0) {
      setTimeout(() => {
        onInviteSent();
        onClose();
      }, 1200);
    }
  };

  const successCount = sendingStatus.filter((s) => s.status === 'success').length;
  const errorCount = sendingStatus.filter((s) => s.status === 'error').length;

  if (!isOpen) return null;

  return (
    <div
      className="mt-4 rounded-xl bg-white/5 border border-white/10 overflow-hidden animate-in slide-in-from-top duration-200"
      style={{ animation: 'slideDown 0.2s ease-out' }}
    >
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); max-height: 0; }
          to { opacity: 1; transform: translateY(0); max-height: 500px; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
        <span className="text-sm font-medium" style={{ color: THEME.textHeading }}>
          Invite Users
        </span>
        <button
          onClick={onClose}
          disabled={isSending}
          className="p-1 rounded-full hover:bg-white/10 transition-colors disabled:opacity-50"
          style={{ color: THEME.textSubtle }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Search Input */}
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search by username..."
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            disabled={isSending}
            className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400/50 focus:border-transparent transition-all disabled:opacity-50"
            style={{ color: THEME.textPrimary }}
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-pink-400/30 border-t-pink-400 rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="rounded-lg bg-white/5 border border-white/10 overflow-hidden max-h-32 overflow-y-auto">
            {searchResults.map((user) => (
              <button
                key={user.id}
                onClick={() => handleSelectUser(user)}
                className="w-full px-3 py-2 flex items-center gap-2 hover:bg-white/10 transition-colors text-left border-b border-white/5 last:border-b-0"
              >
                <div
                  className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-400/30 to-purple-400/30 flex items-center justify-center text-xs font-medium flex-shrink-0"
                  style={{ color: THEME.textPrimary }}
                >
                  {user.username[0]?.toUpperCase() || '?'}
                </div>
                <span className="flex-1 truncate text-sm" style={{ color: THEME.textPrimary }}>
                  {user.username}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-pink-400/20" style={{ color: THEME.textHeading }}>
                  Add
                </span>
              </button>
            ))}
          </div>
        )}

        {/* No Results */}
        {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && !error && (
          <p className="text-center py-2 text-xs" style={{ color: THEME.textSubtle }}>
            No users found
          </p>
        )}

        {/* Selected Users */}
        {selectedUsers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedUsers.map((user) => {
              const status = sendingStatus.find((s) => s.user.id === user.id);
              return (
                <div
                  key={user.id}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
                    status?.status === 'success'
                      ? 'bg-green-500/20 border border-green-500/30'
                      : status?.status === 'error'
                      ? 'bg-red-500/20 border border-red-500/30'
                      : 'bg-pink-400/20 border border-pink-400/30'
                  }`}
                >
                  <span style={{ color: THEME.textPrimary }}>{user.username}</span>
                  {status?.status === 'success' && <span className="text-green-500">✓</span>}
                  {status?.status === 'error' && <span className="text-red-400" title={status.message}>✗</span>}
                  {status?.status === 'pending' && (
                    <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  {!isSending && !status && (
                    <button
                      onClick={() => handleRemoveUser(user.id)}
                      className="hover:bg-white/20 rounded-full transition-colors"
                      style={{ color: THEME.textSubtle }}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-xs text-red-400 px-2">{error}</p>
        )}

        {/* Status Summary */}
        {sendingStatus.length > 0 && (
          <p className="text-xs" style={{ color: THEME.textPrimary }}>
            {successCount > 0 && <span className="text-green-500">{successCount} sent. </span>}
            {errorCount > 0 && <span className="text-red-400">{errorCount} failed. </span>}
          </p>
        )}

        {/* Send Button */}
        {selectedUsers.length > 0 && sendingStatus.length === 0 && (
          <button
            onClick={handleSendInvitations}
            disabled={isSending}
            className="w-full px-3 py-2 rounded-lg bg-gradient-to-r from-pink-500/30 to-purple-500/30 border border-pink-400/30 text-sm font-medium hover:from-pink-500/40 hover:to-purple-500/40 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ color: THEME.textHeading }}
          >
            {isSending ? (
              <>
                <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                Sending...
              </>
            ) : (
              `Send ${selectedUsers.length === 1 ? 'Invite' : `${selectedUsers.length} Invites`}`
            )}
          </button>
        )}
      </div>
    </div>
  );
}