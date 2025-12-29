// src/components/dashboard/GlobalDashboard.tsx
// System-wide dashboard with real user data, notifications, and connection status

import { useState, useEffect } from 'react';
import GlassCard, { GlassOverlay } from '../ui/GlassCard';
import { useNotifications } from '../../context/NotificationContext';
import { getUserInfo } from '../../utils/token';
import { isWebSocketConnected } from '../../services/groupsWebSocket';
import type { Notification } from '../../types/notifications';

// ============================================================================
// USER AVATAR COMPONENT
// ============================================================================

interface UserAvatarProps {
  username: string;
  size?: 'sm' | 'md' | 'lg';
  showStatus?: boolean;
  isOnline?: boolean;
}

function UserAvatar({ username, size = 'md', showStatus = false, isOnline = false }: UserAvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-lg',
  };

  // Generate initials
  const initials = username
    .split(/[\s_-]/)
    .map((word) => word[0]?.toUpperCase() || '')
    .slice(0, 2)
    .join('');

  // Generate consistent color from username
  const hue = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;

  return (
    <div className="relative">
      <div
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-semibold text-white relative overflow-hidden`}
        style={{
          background: `linear-gradient(135deg, hsl(${hue}, 70%, 45%) 0%, hsl(${hue + 30}, 70%, 35%) 100%)`,
          boxShadow: `0 4px 12px hsla(${hue}, 70%, 40%, 0.3)`,
        }}
      >
        {/* Shine effect */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 50%)',
          }}
        />
        <span className="relative z-10">{initials}</span>
      </div>

      {/* Online status indicator */}
      {showStatus && (
        <div
          className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-gray-900"
          style={{
            background: isOnline
              ? 'linear-gradient(135deg, #4ade80, #22c55e)'
              : 'linear-gradient(135deg, #6b7280, #4b5563)',
            boxShadow: isOnline ? '0 0 6px rgba(74, 222, 128, 0.6)' : 'none',
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// CONNECTION STATUS COMPONENT
// ============================================================================

interface ConnectionStatusProps {
  isConnected: boolean;
  label?: string;
}

function ConnectionStatus({ isConnected, label }: ConnectionStatusProps) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-2 h-2 rounded-full"
        style={{
          background: isConnected
            ? 'linear-gradient(135deg, #4ade80, #22c55e)'
            : 'linear-gradient(135deg, #f87171, #ef4444)',
          boxShadow: isConnected
            ? '0 0 8px rgba(74, 222, 128, 0.6)'
            : '0 0 8px rgba(248, 113, 113, 0.6)',
        }}
      />
      <span className={`text-sm ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
        {label || (isConnected ? 'Connected' : 'Disconnected')}
      </span>
    </div>
  );
}

// ============================================================================
// NOTIFICATION ITEM COMPONENT
// ============================================================================

interface NotificationItemProps {
  notification: Notification;
  onAccept: (notification: Notification) => Promise<boolean>;
  onDecline: (notification: Notification) => Promise<boolean>;
  onDismiss: (id: string) => void;
}

function NotificationItem({ notification, onAccept, onDecline, onDismiss }: NotificationItemProps) {
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

  const isInvite = notification.type === 'group_invite';

  return (
    <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
        style={{
          background: 'linear-gradient(135deg, #a78bfa40, #a78bfa20)',
          border: '1px solid #a78bfa40',
        }}
      >
        {isInvite ? '👋' : '🔔'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white/90 text-sm font-medium truncate">{notification.title}</p>
        <p className="text-white/50 text-xs truncate">{notification.message}</p>

        {/* Action buttons for invites */}
        {isInvite && notification.inviteData && !actionTaken && (
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleAccept}
              disabled={isProcessing}
              className="px-2 py-1 text-xs rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-50"
            >
              {isProcessing ? '...' : 'Accept'}
            </button>
            <button
              onClick={handleDecline}
              disabled={isProcessing}
              className="px-2 py-1 text-xs rounded bg-white/10 text-white/60 hover:bg-white/20 disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        )}

        {actionTaken && (
          <span className={`text-xs ${actionTaken === 'accepted' ? 'text-green-400' : 'text-white/50'}`}>
            {actionTaken === 'accepted' ? 'Joined!' : 'Declined'}
          </span>
        )}
      </div>

      {(!isInvite || actionTaken) && (
        <button
          onClick={() => onDismiss(notification.id)}
          className="text-white/30 hover:text-white/60 text-xs"
        >
          ×
        </button>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function GlobalDashboard() {
  const [showDashboard, setShowDashboard] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  const {
    notifications,
    unreadCount,
    isConnected: notificationConnected,
    acceptInvite,
    declineInvite,
    dismiss,
    markAllRead,
    clearAll,
  } = useNotifications();

  const userInfo = getUserInfo();
  const visibleNotifications = notifications.filter((n) => !n.dismissed);

  // Check WebSocket status periodically
  useEffect(() => {
    const checkConnection = () => {
      setWsConnected(isWebSocketConnected());
    };

    checkConnection();
    const interval = setInterval(checkConnection, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Dashboard toggle button - moved to top-20 to avoid overlap with settings, increased size and z-index */}
      <button
        onClick={() => setShowDashboard(true)}
        className="fixed top-20 right-4 z-[60] w-16 h-16 bg-white/15 backdrop-blur-xl border-2 border-white/30 rounded-full flex items-center justify-center text-white hover:bg-white/25 transition-all duration-300 hover:scale-105 shadow-xl group"
        title="Open Dashboard"
        style={{ minWidth: '25px', minHeight: '25px' }}
      >
        <svg className="w-7 h-7 transition-transform group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>

        {/* Unread badge */}
        {unreadCount > 0 && (
          <div
            className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center text-xs font-semibold text-white"
            style={{
              background: 'linear-gradient(135deg, #f472b6, #ec4899)',
              boxShadow: '0 2px 8px rgba(236, 72, 153, 0.4)',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </button>

      {/* Dashboard overlay */}
      {showDashboard && (
        <>
          <GlassOverlay
            className="fixed inset-0 z-[70]"
            onClose={() => setShowDashboard(false)}
          >
            <div />
          </GlassOverlay>

          {/* Dashboard panel - responsive width, proper z-index, better margins */}
          <div className="fixed top-0 right-0 h-full w-[min(400px,90vw)] z-[80] transform transition-transform duration-500">
            <div className="h-full m-3 sm:m-4 flex flex-col">
              <GlassCard enhanced hover={false} className="h-full flex flex-col overflow-hidden">
                {/* Header with user info - increased close button touch target */}
                <div className="flex justify-between items-start mb-6 px-1">
                  <div className="flex items-center gap-3">
                    {userInfo && (
                      <UserAvatar
                        username={userInfo.username}
                        size="md"
                        showStatus
                        isOnline={wsConnected}
                      />
                    )}
                    <div>
                      <h2 className="text-xl font-semibold text-white">
                        {userInfo?.username || 'Guest'}
                      </h2>
                      <p className="text-white/50 text-sm truncate max-w-[180px]">
                        {userInfo?.email || 'Not logged in'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDashboard(false)}
                    className="w-12 h-12 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 text-3xl transition-all rounded-full -mr-2 -mt-1"
                    aria-label="Close dashboard"
                    type="button"
                  >
                    ×
                  </button>
                </div>

                {/* Scrollable content area with proper padding */}
                <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar px-1 pb-2">
                  {/* Connection Status Card */}
                  <GlassCard hover={false} className="p-4 mx-1">
                    <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                      <span className="text-lg">🔗</span>
                      Connection Status
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-1">
                        <span className="text-white/70 text-sm">WebSocket</span>
                        <ConnectionStatus isConnected={wsConnected} />
                      </div>
                      <div className="flex justify-between items-center p-1">
                        <span className="text-white/70 text-sm">Notifications</span>
                        <ConnectionStatus isConnected={notificationConnected} label={notificationConnected ? 'Live' : 'Offline'} />
                      </div>
                      <div className="flex justify-between items-center p-1">
                        <span className="text-white/70 text-sm">API</span>
                        <ConnectionStatus isConnected={true} label="Online" />
                      </div>
                    </div>
                  </GlassCard>

                  {/* Notifications Card - REPLACED My Groups */}
                  <GlassCard hover={false} className="p-4 mx-1">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-white font-medium flex items-center gap-2">
                        <span className="text-lg">🔔</span>
                        Notifications
                        {unreadCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-pink-500/30 text-pink-300">
                            {unreadCount} new
                          </span>
                        )}
                      </h3>
                      {visibleNotifications.length > 0 && (
                        <div className="flex gap-2 text-xs">
                          <button
                            onClick={markAllRead}
                            className="text-purple-400 hover:text-purple-300"
                            disabled={unreadCount === 0}
                          >
                            Read
                          </button>
                          <button
                            onClick={clearAll}
                            className="text-white/40 hover:text-white/60"
                          >
                            Clear
                          </button>
                        </div>
                      )}
                    </div>

                    {visibleNotifications.length > 0 ? (
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {visibleNotifications.slice(0, 5).map((notification) => (
                          <NotificationItem
                            key={notification.id}
                            notification={notification}
                            onAccept={acceptInvite}
                            onDecline={declineInvite}
                            onDismiss={dismiss}
                          />
                        ))}
                        {visibleNotifications.length > 5 && (
                          <p className="text-white/40 text-xs text-center pt-2">
                            +{visibleNotifications.length - 5} more notifications
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-white/50 text-sm text-center py-4">
                        No notifications
                      </p>
                    )}
                  </GlassCard>

                  {/* System Info */}
                  <GlassCard hover={false} className="p-4 mx-1">
                    <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                      <span className="text-lg">ℹ️</span>
                      System Info
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between p-1">
                        <span className="text-white/50">Version</span>
                        <span className="text-white/70 whitespace-nowrap">1.0.0</span>
                      </div>
                      <div className="flex justify-between p-1">
                        <span className="text-white/50">Last Sync</span>
                        <span className="text-white/70 whitespace-nowrap">Just now</span>
                      </div>
                      <div className="flex justify-between p-1">
                        <span className="text-white/50">Session</span>
                        <span className="text-white/70 whitespace-nowrap">Active</span>
                      </div>
                      <div className="flex justify-between p-1">
                        <span className="text-white/50">Mirror Dashboard</span>
                        <span className="text-white/70 whitespace-nowrap">Online</span>
                      </div>
                    </div>
                  </GlassCard>
                </div>

                {/* Footer */}
                <div className="mt-4 pt-4 border-t border-white/10 px-2">
                </div>
              </GlassCard>
            </div>
          </div>
        </>
      )}

      {/* Scoped CSS */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </>
  );
}
