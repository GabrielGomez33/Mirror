// src/context/NotificationContext.tsx
// Global notification state management with WebSocket integration

import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import type {
  Notification,
  NotificationState,
  NotificationAction_Type,
  WSNotificationMessage,
} from '../types/notifications';
import {
  onWebSocketConnect,
  onWebSocketDisconnect,
  onWebSocketEvent,
  connectWebSocket,
  isWebSocketConnected,
} from '../services/groupsWebSocket';
import { getToken } from '../utils/token';
import { acceptInvitation, declineInvitation, getMyInvitations } from '../services/groupsApi';

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = 'mirror_notifications';
const MAX_NOTIFICATIONS = 50;

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  isConnected: false,
  isPanelOpen: false,
  isLoading: false,
  error: null,
};

// ============================================================================
// REDUCER
// ============================================================================

function notificationReducer(state: NotificationState, action: NotificationAction_Type): NotificationState {
  switch (action.type) {
    case 'ADD_NOTIFICATION': {
      // Prevent duplicates
      if (state.notifications.some((n) => n.id === action.payload.id)) {
        return state;
      }
      const notifications = [action.payload, ...state.notifications].slice(0, MAX_NOTIFICATIONS);
      const unreadCount = notifications.filter((n) => !n.read && !n.dismissed).length;
      return { ...state, notifications, unreadCount };
    }

    case 'REMOVE_NOTIFICATION': {
      const notifications = state.notifications.filter((n) => n.id !== action.payload);
      const unreadCount = notifications.filter((n) => !n.read && !n.dismissed).length;
      return { ...state, notifications, unreadCount };
    }

    case 'MARK_READ': {
      const notifications = state.notifications.map((n) =>
        n.id === action.payload ? { ...n, read: true } : n
      );
      const unreadCount = notifications.filter((n) => !n.read && !n.dismissed).length;
      return { ...state, notifications, unreadCount };
    }

    case 'MARK_ALL_READ': {
      const notifications = state.notifications.map((n) => ({ ...n, read: true }));
      return { ...state, notifications, unreadCount: 0 };
    }

    case 'DISMISS': {
      const notifications = state.notifications.map((n) =>
        n.id === action.payload ? { ...n, dismissed: true, read: true } : n
      );
      const unreadCount = notifications.filter((n) => !n.read && !n.dismissed).length;
      return { ...state, notifications, unreadCount };
    }

    case 'CLEAR_ALL': {
      return { ...state, notifications: [], unreadCount: 0 };
    }

    case 'SET_CONNECTED':
      return { ...state, isConnected: action.payload };

    case 'SET_PANEL_OPEN':
      return { ...state, isPanelOpen: action.payload };

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'LOAD_NOTIFICATIONS': {
      const unreadCount = action.payload.filter((n) => !n.read && !n.dismissed).length;
      return { ...state, notifications: action.payload, unreadCount };
    }

    default:
      return state;
  }
}

// ============================================================================
// CONTEXT
// ============================================================================

interface NotificationContextValue extends NotificationState {
  // Actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read' | 'dismissed'>) => void;
  removeNotification: (id: string) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;

  // Invite actions
  acceptInvite: (notification: Notification) => Promise<boolean>;
  declineInvite: (notification: Notification) => Promise<boolean>;

  // Connection
  reconnect: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(notificationReducer, initialState);
  const initialized = useRef(false);
  const notificationsRef = useRef(state.notifications);

  // Keep ref in sync with state for polling
  useEffect(() => {
    notificationsRef.current = state.notifications;
  }, [state.notifications]);

  // Load persisted notifications on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const notifications = parsed.map((n: Notification) => ({
          ...n,
          timestamp: new Date(n.timestamp),
        }));
        dispatch({ type: 'LOAD_NOTIFICATIONS', payload: notifications });
      }
    } catch (err) {
      console.error('[NotificationContext] Failed to load stored notifications:', err);
    }
  }, []);

  // Persist notifications to localStorage
  useEffect(() => {
    try {
      const toStore = state.notifications.slice(0, 20); // Only persist recent 20
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch (err) {
      console.error('[NotificationContext] Failed to persist notifications:', err);
    }
  }, [state.notifications]);

  // Fetch pending invitations - uses ref to avoid stale closure
  const fetchPendingInvitations = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const response = await getMyInvitations();
      if (response.success && response.data?.invitations) {
        const invitations = response.data.invitations;

        // Convert invitations to notifications, avoiding duplicates
        invitations.forEach((inv) => {
          // Use ref to check for existing notifications (stable reference)
          const exists = notificationsRef.current.some(
            (n) => n.inviteData?.requestId === inv.request_id
          );

          if (!exists) {
            const notification: Notification = {
              id: `invite-${inv.request_id}`,
              type: 'group_invite',
              title: `Group Invitation: ${inv.group_name}`,
              message: `${inv.inviter_username || 'Someone'} invited you to join "${inv.group_name}"`,
              priority: 'normal',
              timestamp: new Date(inv.requested_at),
              read: false,
              dismissed: false,
              groupId: inv.group_id,
              groupName: inv.group_name,
              requestId: inv.request_id,
              inviteData: {
                requestId: inv.request_id,
                groupId: inv.group_id,
                groupName: inv.group_name,
                inviterName: inv.inviter_username || 'Someone',
                inviterUsername: inv.inviter_username || '',
              },
              actions: [
                { label: 'Accept', action: 'accept', variant: 'primary' },
                { label: 'Decline', action: 'decline', variant: 'secondary' },
              ],
            };

            dispatch({ type: 'ADD_NOTIFICATION', payload: notification });
          }
        });
      }
    } catch (err) {
      console.error('[NotificationContext] Failed to fetch pending invitations:', err);
    }
  }, []); // No dependencies - uses ref

  // Handle incoming WebSocket notification - defined BEFORE useEffect that uses it
  const handleIncomingNotification = useCallback((data: WSNotificationMessage['data']) => {
    console.log('[NotificationContext] Processing notification:', data);

    // Backend sends inviteCode, map it to requestId for consistency
    const requestId = data.metadata?.requestId || data.metadata?.inviteCode;
    const notificationType = data.notificationType || 'system_alert';

    // Skip transient notifications that shouldn't be stored in the panel
    const transientTypes = ['chat_typing', 'chat_presence'];
    if (transientTypes.includes(notificationType)) {
      console.log(`[NotificationContext] Skipping transient notification: ${notificationType}`);
      // These are handled by other components (e.g., chat UI) - just emit event
      return;
    }

    const notification: Notification = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: notificationType,
      title: data.title || 'Notification',
      message: data.message || '',
      priority: 'normal',
      timestamp: new Date(data.timestamp || Date.now()),
      read: false,
      dismissed: false,
      groupId: data.metadata?.groupId,
      groupName: data.metadata?.groupName,
      requestId: requestId,
      userId: data.metadata?.userId,
      username: data.metadata?.username || data.metadata?.memberName,
    };

    // Add invite-specific data
    if (notificationType === 'group_invite' && data.metadata) {
      notification.inviteData = {
        requestId: requestId as string,
        groupId: data.metadata.groupId as string,
        groupName: data.metadata.groupName as string,
        inviterName: data.metadata.inviterName as string,
        inviterUsername: (data.metadata.inviterUsername as string) || '',
      };
      notification.actions = [
        { label: 'Accept', action: 'accept', variant: 'primary' },
        { label: 'Decline', action: 'decline', variant: 'secondary' },
      ];
    }

    // Add action URL for certain notification types
    if (notificationType === 'member_joined' || notificationType === 'member_left') {
      if (data.metadata?.groupId) {
        notification.actionUrl = `/groups/${data.metadata.groupId}`;
      }
    }

    // Add action for video calls
    if (notificationType === 'video_call_started' && data.metadata) {
      notification.actionUrl = data.metadata.joinUrl as string;
      notification.actions = [
        { label: 'Join', action: 'join', variant: 'primary' },
      ];
    }

    // Add action for drawing sessions
    if (notificationType === 'drawing_session_started' && data.metadata) {
      notification.actionUrl = data.metadata.joinUrl as string;
      notification.actions = [
        { label: 'Join', action: 'join', variant: 'primary' },
      ];
    }

    dispatch({ type: 'ADD_NOTIFICATION', payload: notification });
  }, []);

  // Initial fetch only (WebSocket handles real-time updates)
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    // Fetch existing pending invitations on mount
    const initialTimeout = setTimeout(fetchPendingInvitations, 500);

    return () => clearTimeout(initialTimeout);
  }, [fetchPendingInvitations]);

  // Connect WebSocket and set up handlers
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    // Connect if not already connected
    if (!isWebSocketConnected()) {
      connectWebSocket();
    }

    // Connection status handlers
    const unsubConnect = onWebSocketConnect(() => {
      dispatch({ type: 'SET_CONNECTED', payload: true });
      // Fetch any missed notifications on reconnect
      fetchPendingInvitations();
    });

    const unsubDisconnect = onWebSocketDisconnect(() => {
      dispatch({ type: 'SET_CONNECTED', payload: false });
    });

    // Set initial connection state
    dispatch({ type: 'SET_CONNECTED', payload: isWebSocketConnected() });

    // Periodic sync of connection status (in case events are missed)
    const syncInterval = setInterval(() => {
      const connected = isWebSocketConnected();
      dispatch({ type: 'SET_CONNECTED', payload: connected });
    }, 2000);

    // Notification handlers - listen for both event types
    const unsubNotification = onWebSocketEvent('notification:received', (data: unknown) => {
      handleIncomingNotification(data as WSNotificationMessage['data']);
    });

    // Handle group_notification events from server
    const unsubGroupNotification = onWebSocketEvent('group_notification', (data: unknown) => {
      console.log('[NotificationContext] Received group_notification:', data);
      handleIncomingNotification(data as WSNotificationMessage['data']);
    });

    return () => {
      unsubConnect();
      unsubDisconnect();
      unsubNotification();
      unsubGroupNotification();
      clearInterval(syncInterval);
    };
  }, [handleIncomingNotification, fetchPendingInvitations]);

  // Actions
  const addNotification = useCallback(
    (notification: Omit<Notification, 'id' | 'timestamp' | 'read' | 'dismissed'>) => {
      const fullNotification: Notification = {
        ...notification,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        read: false,
        dismissed: false,
      };
      dispatch({ type: 'ADD_NOTIFICATION', payload: fullNotification });
    },
    []
  );

  const removeNotification = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
  }, []);

  const markRead = useCallback((id: string) => {
    dispatch({ type: 'MARK_READ', payload: id });
  }, []);

  const markAllRead = useCallback(() => {
    dispatch({ type: 'MARK_ALL_READ' });
  }, []);

  const dismiss = useCallback((id: string) => {
    dispatch({ type: 'DISMISS', payload: id });
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
  }, []);

  const togglePanel = useCallback(() => {
    dispatch({ type: 'SET_PANEL_OPEN', payload: !state.isPanelOpen });
  }, [state.isPanelOpen]);

  const openPanel = useCallback(() => {
    dispatch({ type: 'SET_PANEL_OPEN', payload: true });
  }, []);

  const closePanel = useCallback(() => {
    dispatch({ type: 'SET_PANEL_OPEN', payload: false });
  }, []);

  const reconnect = useCallback(() => {
    connectWebSocket();
  }, []);

  // Accept invite
  const acceptInvite = useCallback(async (notification: Notification): Promise<boolean> => {
    if (!notification.inviteData) return false;

    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await acceptInvitation(
        notification.inviteData.groupId,
        notification.inviteData.requestId
      );

      if (response.success) {
        dispatch({ type: 'DISMISS', payload: notification.id });
        // Add success notification
        addNotification({
          type: 'member_joined',
          title: 'Joined Group',
          message: `You have joined "${notification.inviteData.groupName}"`,
          priority: 'normal',
          groupId: notification.inviteData.groupId,
          groupName: notification.inviteData.groupName,
        });
        return true;
      } else {
        dispatch({ type: 'SET_ERROR', payload: response.error || 'Failed to accept invitation' });
        return false;
      }
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to accept invitation' });
      return false;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [addNotification]);

  // Decline invite
  const declineInvite = useCallback(async (notification: Notification): Promise<boolean> => {
    if (!notification.inviteData) return false;

    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await declineInvitation(
        notification.inviteData.groupId,
        notification.inviteData.requestId
      );

      if (response.success) {
        dispatch({ type: 'DISMISS', payload: notification.id });
        return true;
      } else {
        dispatch({ type: 'SET_ERROR', payload: response.error || 'Failed to decline invitation' });
        return false;
      }
    } catch (err) {
      console.error('[NotificationContext] Failed to decline invitation:', err);
      // Still dismiss locally even if API fails
      dispatch({ type: 'DISMISS', payload: notification.id });
      return true;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const value: NotificationContextValue = {
    ...state,
    addNotification,
    removeNotification,
    markRead,
    markAllRead,
    dismiss,
    clearAll,
    togglePanel,
    openPanel,
    closePanel,
    acceptInvite,
    declineInvite,
    reconnect,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

export default NotificationContext;
