// src/types/notifications.ts
// Type definitions for the notification system

export type NotificationType =
  | 'group_invite'
  | 'member_joined'
  | 'member_left'
  | 'vote_proposed'
  | 'vote_completed'
  | 'chat_mention'
  | 'analysis_complete'
  | 'system_alert'
  | 'connection_status';

export type NotificationPriority = 'immediate' | 'normal' | 'low';

export interface NotificationAction {
  label: string;
  action: string; // Action identifier (e.g., 'accept', 'decline', 'view')
  variant?: 'primary' | 'secondary' | 'danger';
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  timestamp: Date;
  read: boolean;
  dismissed: boolean;

  // Optional metadata
  groupId?: string;
  groupName?: string;
  userId?: number;
  username?: string;
  requestId?: string;
  actionUrl?: string;

  // Actions available for this notification
  actions?: NotificationAction[];

  // For invite notifications
  inviteData?: {
    requestId: string;
    groupId: string;
    groupName: string;
    inviterName: string;
    inviterUsername: string;
  };
}

export interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isConnected: boolean;
  isPanelOpen: boolean;
  isLoading: boolean;
  error: string | null;
}

export type NotificationAction_Type =
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'MARK_READ'; payload: string }
  | { type: 'MARK_ALL_READ' }
  | { type: 'DISMISS'; payload: string }
  | { type: 'CLEAR_ALL' }
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'SET_PANEL_OPEN'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'LOAD_NOTIFICATIONS'; payload: Notification[] };

// WebSocket notification message format (from backend)
export interface WSNotificationMessage {
  type: 'group_notification';
  data: {
    notificationType: NotificationType;
    title: string;
    message: string;
    timestamp: string;
    metadata?: {
      type: NotificationType;
      groupId?: string;
      groupName?: string;
      inviterName?: string;
      inviteCode?: string;
      requestId?: string;
      [key: string]: unknown;
    };
  };
}

