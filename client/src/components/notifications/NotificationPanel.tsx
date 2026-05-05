// src/components/notifications/NotificationPanel.tsx
// Slide-out notification panel with invite acceptance UI
// Beautiful glass morphism design with smooth animations

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import type { Notification, NotificationType } from '../../types/notifications';
import PushSettings from './PushSettings';

// ============================================================================
// NOTIFICATION ITEM COMPONENT
// ============================================================================

interface NotificationItemProps {
  notification: Notification;
  onAccept: (notification: Notification) => Promise<void>;
  onDecline: (notification: Notification) => Promise<void>;
  onDismiss: (id: string) => void;
  onMarkRead: (id: string) => void;
  onNavigate: (url: string) => void;
}

function NotificationItem({
  notification,
  onAccept,
  onDecline,
  onDismiss,
  onMarkRead,
  onNavigate,
}: NotificationItemProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionTaken, setActionTaken] = useState<'accepted' | 'declined' | null>(null);

  const handleAccept = async () => {
    setIsProcessing(true);
    try {
      await onAccept(notification);
      setActionTaken('accepted');
    } catch {
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    setIsProcessing(true);
    try {
      await onDecline(notification);
      setActionTaken('declined');
    } catch {
      setIsProcessing(false);
    }
  };

  const getIcon = (type: NotificationType) => {
    const iconMap: Record<NotificationType, { icon: string; color: string }> = {
      group_invite: { icon: '👋', color: '#a78bfa' },
      member_joined: { icon: '🎉', color: '#4ade80' },
      member_left: { icon: '👋', color: '#fbbf24' },
      vote_proposed: { icon: '🗳️', color: '#60a5fa' },
      vote_cast: { icon: '✋', color: '#a78bfa' },
      vote_completed: { icon: '✅', color: '#22c55e' },
      chat_mention: { icon: '💬', color: '#f472b6' },
      chat_message: { icon: '💬', color: '#60a5fa' },
      chat_typing: { icon: '✍️', color: '#94a3b8' },
      chat_presence: { icon: '🟢', color: '#4ade80' },
      video_call_started: { icon: '📹', color: '#8b5cf6' },
      drawing_session_started: { icon: '🎨', color: '#f472b6' },
      admin_promoted: { icon: '⬆️', color: '#fbbf24' },
      admin_demoted: { icon: '⬇️', color: '#f97316' },
      peer_review_received: { icon: '📝', color: '#a78bfa' },
      compatibility_updated: { icon: '🔄', color: '#22d3ee' },
      conversation_insight: { icon: '💡', color: '#fbbf24' },
      conversation_summary: { icon: '📋', color: '#8b5cf6' },
      analysis_complete: { icon: '📊', color: '#8b5cf6' },
      system_alert: { icon: '⚡', color: '#f97316' },
      connection_status: { icon: '🔌', color: '#06b6d4' },
      // TruthStream
      ts_review_received: { icon: '🎭', color: '#f472b6' },
      ts_review_classified: { icon: '🏷️', color: '#a78bfa' },
      ts_analysis_complete: { icon: '🔮', color: '#8b5cf6' },
      ts_dialogue_message: { icon: '💬', color: '#f472b6' },
      ts_queue_assigned: { icon: '📋', color: '#60a5fa' },
      ts_milestone_earned: { icon: '🏆', color: '#fbbf24' },
      ts_helpful_marked: { icon: '❤️', color: '#f472b6' },
    };
    return iconMap[type] || { icon: '📢', color: '#94a3b8' };
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const { icon, color } = getIcon(notification.type);
  const isInvite = notification.type === 'group_invite';

  return (
    <div
      className={`relative p-4 rounded-xl transition-all duration-300 ${
        notification.read ? 'bg-white/5' : 'bg-white/10'
      }`}
      style={{
        borderLeft: `3px solid ${color}`,
        opacity: notification.dismissed ? 0.5 : 1,
      }}
      onMouseEnter={() => !notification.read && onMarkRead(notification.id)}
    >
      {/* Unread indicator */}
      {!notification.read && !notification.dismissed && (
        <div
          className="absolute top-4 right-4 w-2 h-2 rounded-full"
          style={{ background: color, boxShadow: `0 0 8px ${color}` }}
        />
      )}

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, ${color}20, ${color}10)`,
            border: `1px solid ${color}40`,
          }}
        >
          {icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-white font-medium text-sm truncate">
              {notification.title}
            </h4>
            <span className="text-white/40 text-xs flex-shrink-0">
              {formatTime(notification.timestamp)}
            </span>
          </div>

          <p className="text-white/70 text-sm mt-1 line-clamp-2">
            {notification.message}
          </p>

          {/* Invite-specific content */}
          {isInvite && notification.inviteData && !actionTaken && (
            <div className="mt-3">
              <div className="flex items-center gap-2 mb-3 text-xs text-white/50">
                <span>From: {notification.inviteData.inviterName}</span>
                {notification.inviteData.inviterUsername && (
                  <span className="text-white/30">
                    @{notification.inviteData.inviterUsername}
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleAccept}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, #4ade80, #22c55e)',
                    boxShadow: '0 4px 12px rgba(74, 222, 128, 0.3)',
                  }}
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Joining...
                    </span>
                  ) : (
                    'Accept'
                  )}
                </button>

                <button
                  onClick={handleDecline}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white/80 transition-all duration-200 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  Decline
                </button>
              </div>
            </div>
          )}

          {/* Action taken feedback */}
          {actionTaken && (
            <div
              className={`mt-3 py-2 px-3 rounded-lg text-sm font-medium ${
                actionTaken === 'accepted'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-white/5 text-white/50'
              }`}
            >
              {actionTaken === 'accepted'
                ? `You've joined ${notification.inviteData?.groupName || 'the group'}!`
                : 'Invitation declined'}
            </div>
          )}

          {/* Generic actions */}
          {notification.actions && !isInvite && (
            <div className="flex gap-2 mt-3">
              {notification.actions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (notification.actionUrl) {
                      onNavigate(notification.actionUrl);
                      onMarkRead(notification.id);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                    action.variant === 'primary'
                      ? 'bg-purple-500/30 text-purple-300 hover:bg-purple-500/40'
                      : action.variant === 'danger'
                        ? 'bg-red-500/30 text-red-300 hover:bg-red-500/40'
                        : 'bg-white/10 text-white/70 hover:bg-white/15'
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dismiss button - only for non-invite or already-handled invites */}
      {(!isInvite || actionTaken) && (
        <button
          onClick={() => onDismiss(notification.id)}
          className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/10 transition-all duration-200"
          aria-label="Dismiss notification"
        >
          ×
        </button>
      )}
    </div>
  );
}

// ============================================================================
// MAIN PANEL COMPONENT
// ============================================================================

export default function NotificationPanel() {
  const {
    notifications,
    unreadCount,
    isPanelOpen,
    isLoading,
    closePanel,
    markAllRead,
    clearAll,
    acceptInvite,
    declineInvite,
    dismiss,
    markRead,
    isConnected,
  } = useNotifications();

  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        // Check if click is on the orb button
        const orbButton = document.querySelector('[aria-label*="Notifications"]');
        if (orbButton && orbButton.contains(e.target as Node)) {
          return; // Let the orb handle the toggle
        }
        closePanel();
      }
    };

    if (isPanelOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPanelOpen, closePanel]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPanelOpen) {
        closePanel();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isPanelOpen, closePanel]);

  const handleAccept = async (notification: Notification) => {
    await acceptInvite(notification);
  };

  const handleDecline = async (notification: Notification) => {
    await declineInvite(notification);
  };

  const navigate = useNavigate();
  const handleNavigate = (url: string) => {
    closePanel();
    navigate(url);
  };

  // Filter out dismissed notifications
  const visibleNotifications = notifications.filter((n) => !n.dismissed);
  const inviteNotifications = visibleNotifications.filter(
    (n) => n.type === 'group_invite'
  );
  const otherNotifications = visibleNotifications.filter(
    (n) => n.type !== 'group_invite'
  );

  if (!isPanelOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{
          background: 'rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(2px)',
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={closePanel}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed top-16 right-4 w-96 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-5rem)] z-50 rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: 'linear-gradient(180deg, rgba(30, 30, 45, 0.95) 0%, rgba(20, 20, 35, 0.98) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: `
            0 25px 50px -12px rgba(0, 0, 0, 0.5),
            0 0 0 1px rgba(255, 255, 255, 0.05),
            inset 0 1px 0 rgba(255, 255, 255, 0.1)
          `,
          animation: 'slideIn 0.3s ease-out',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div className="flex items-center gap-3">
            <h3 className="text-white font-semibold text-lg">Notifications</h3>
            {unreadCount > 0 && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                style={{
                  background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)',
                }}
              >
                {unreadCount} new
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Connection status */}
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
              }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: isConnected ? '#4ade80' : '#f87171',
                  boxShadow: isConnected
                    ? '0 0 4px rgba(74, 222, 128, 0.6)'
                    : '0 0 4px rgba(248, 113, 113, 0.6)',
                }}
              />
              <span className="text-white/50">
                {isConnected ? 'Live' : 'Offline'}
              </span>
            </div>

            {/* Close button */}
            <button
              onClick={closePanel}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all duration-200"
              aria-label="Close notifications"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Push notification opt-in / status (Phase 5) */}
        <PushSettings onIOSInstallNudge={closePanel} />

        {/* Actions bar */}
        {visibleNotifications.length > 0 && (
          <div
            className="flex items-center justify-between px-5 py-2 text-xs"
            style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}
          >
            <button
              onClick={markAllRead}
              className="text-purple-400 hover:text-purple-300 transition-colors"
              disabled={unreadCount === 0}
            >
              Mark all read
            </button>
            <button
              onClick={clearAll}
              className="text-white/40 hover:text-white/60 transition-colors"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            </div>
          )}

          {!isLoading && visibleNotifications.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-4"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                ✨
              </div>
              <p className="text-white/70 text-center">
                You're all caught up!
              </p>
              <p className="text-white/40 text-sm text-center mt-1">
                New notifications will appear here
              </p>
            </div>
          )}

          {/* Pending invites section */}
          {inviteNotifications.length > 0 && (
            <div className="p-4">
              <h4 className="text-white/60 text-xs font-medium uppercase tracking-wider mb-3">
                Pending Invites
              </h4>
              <div className="space-y-3">
                {inviteNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onAccept={handleAccept}
                    onDecline={handleDecline}
                    onDismiss={dismiss}
                    onMarkRead={markRead}
                    onNavigate={handleNavigate}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Other notifications section */}
          {otherNotifications.length > 0 && (
            <div className="p-4">
              {inviteNotifications.length > 0 && (
                <h4 className="text-white/60 text-xs font-medium uppercase tracking-wider mb-3">
                  Other Notifications
                </h4>
              )}
              <div className="space-y-3">
                {otherNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onAccept={handleAccept}
                    onDecline={handleDecline}
                    onDismiss={dismiss}
                    onMarkRead={markRead}
                    onNavigate={handleNavigate}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3 text-center"
          style={{
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            background: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          <p className="text-white/30 text-xs">
            Notifications are stored locally
          </p>
        </div>

        {/* CSS */}
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(-10px) scale(0.95);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }

          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }

          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 3px;
          }

          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.2);
          }

          .line-clamp-2 {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
        `}</style>
      </div>
    </>
  );
}
