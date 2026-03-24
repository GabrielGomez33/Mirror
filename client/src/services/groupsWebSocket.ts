// src/services/groupsWebSocket.ts
// MirrorGroups WebSocket Service - Real-time communication
// Enterprise-grade connection management with robust reconnection,
// dead-connection detection, and mobile lifecycle handling.

import { getToken } from '../utils/token';
import type {
  WSEventType,
  WSMessage,
  WSVoteProposed,
  WSVoteCast,
  WSVoteCompleted,
  WSConversationInsight,
  WSMemberJoined,
  WSMemberLeft,
  WSAnalysisUpdate,
} from '../types/groups';

// ============================================================================
// CONFIGURATION
// ============================================================================

const WS_BASE = import.meta.env.VITE_WS_URL
  ? import.meta.env.VITE_WS_URL
  : import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/^http/, 'ws')
    : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

const WS_ENDPOINT = `${WS_BASE}/mirror/groups/ws`;

// Reconnection: base delays with jitter applied at runtime
const BASE_RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000, 30000];
const MAX_RECONNECT_ATTEMPTS = 50;
const HEARTBEAT_INTERVAL = 30_000;  // 30s - matches server ping interval
const HEARTBEAT_TIMEOUT = 10_000;   // 10s - must respond before next cycle
const MAX_PENDING_MESSAGES = 100;

// Close codes that should NOT trigger reconnection
const NON_RECOVERABLE_CODES = new Set([
  1000, // Normal closure
  1008, // Policy violation (auth rejected by server)
  4001, // Authentication failed
  4003, // Forbidden
]);

// ============================================================================
// HELPERS
// ============================================================================

/** Add +/-25% jitter to a delay to prevent thundering herd on server restart */
function withJitter(baseDelay: number): number {
  const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1);
  return Math.max(500, Math.round(baseDelay + jitter));
}

/** Structured log helper - all WS logs go through here for consistency */
function wsLog(level: 'info' | 'warn' | 'error', msg: string, data?: Record<string, unknown>): void {
  const prefix = '[GroupsWS]';
  const extra = data ? ` ${JSON.stringify(data)}` : '';
  if (level === 'error') console.error(`${prefix} ${msg}${extra}`);
  else if (level === 'warn') console.warn(`${prefix} ${msg}${extra}`);
  else console.log(`${prefix} ${msg}${extra}`);
}

// ============================================================================
// EVENT TYPES
// ============================================================================

type EventHandler<T = unknown> = (data: T) => void;
type ErrorHandler = (error: Error) => void;
type ConnectionHandler = (connected: boolean) => void;

interface EventHandlers {
  // Connection events
  onConnect: ConnectionHandler[];
  onDisconnect: ConnectionHandler[];
  onError: ErrorHandler[];

  // Group events
  'member:joined': EventHandler<WSMemberJoined>[];
  'member:left': EventHandler<WSMemberLeft>[];
  'member:updated': EventHandler<unknown>[];
  'data:shared': EventHandler<unknown>[];

  // Backend uses underscore format - map both
  'member_joined': EventHandler<WSMemberJoined>[];
  'member_left': EventHandler<WSMemberLeft>[];

  // Insights events
  'insights:updated': EventHandler<unknown>[];
  'analysis:started': EventHandler<WSAnalysisUpdate>[];
  'analysis:completed': EventHandler<WSAnalysisUpdate>[];

  // Voting events
  'vote:proposed': EventHandler<WSVoteProposed>[];
  'vote:cast': EventHandler<WSVoteCast>[];
  'vote:completed': EventHandler<WSVoteCompleted>[];

  // Conversation events
  'conversation:insight': EventHandler<WSConversationInsight>[];
  'conversation:summary': EventHandler<unknown>[];

  // Chat events
  'chat_message': EventHandler<unknown>[];
  'chat_typing': EventHandler<unknown>[];
  'chat_presence': EventHandler<unknown>[];
  'chat_mention': EventHandler<unknown>[];

  // Session events
  'session:started': EventHandler<unknown>[];
  'session:ended': EventHandler<unknown>[];
  'video_call_started': EventHandler<unknown>[];
  'drawing_session_started': EventHandler<unknown>[];

  // Notifications
  'notification:received': EventHandler<unknown>[];
  'group_notification': EventHandler<unknown>[];

  // TruthStream events
  'ts:review_received': EventHandler<unknown>[];
  'ts:dialogue_message': EventHandler<unknown>[];
  'ts:helpful_marked': EventHandler<unknown>[];
  'ts:review_classified': EventHandler<unknown>[];
  'ts:analysis_complete': EventHandler<unknown>[];
  'ts:milestone_earned': EventHandler<unknown>[];
  'ts:queue_assigned': EventHandler<unknown>[];
}

// ============================================================================
// WEBSOCKET CLIENT CLASS
// ============================================================================

class GroupsWebSocketClient {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  private isManualDisconnect = false;
  private subscribedGroups: Set<string> = new Set();
  private pendingMessages: Array<{ type: string; payload: unknown }> = [];
  private lastConnectedAt = 0;
  private visibilityHandler: (() => void) | null = null;

  private handlers: EventHandlers = {
    onConnect: [],
    onDisconnect: [],
    onError: [],
    'member:joined': [],
    'member:left': [],
    'member:updated': [],
    'data:shared': [],
    'member_joined': [],
    'member_left': [],
    'insights:updated': [],
    'analysis:started': [],
    'analysis:completed': [],
    'vote:proposed': [],
    'vote:cast': [],
    'vote:completed': [],
    'conversation:insight': [],
    'conversation:summary': [],
    'chat_message': [],
    'chat_typing': [],
    'chat_presence': [],
    'chat_mention': [],
    'session:started': [],
    'session:ended': [],
    'video_call_started': [],
    'drawing_session_started': [],
    'notification:received': [],
    'group_notification': [],
    'ts:review_received': [],
    'ts:dialogue_message': [],
    'ts:helpful_marked': [],
    'ts:review_classified': [],
    'ts:analysis_complete': [],
    'ts:milestone_earned': [],
    'ts:queue_assigned': [],
  };

  // ==================== CONNECTION MANAGEMENT ====================

  connect(): void {
    // Guard: already open
    if (this.socket?.readyState === WebSocket.OPEN) {
      wsLog('info', 'Already connected, skipping');
      return;
    }

    // Guard: connection in progress - don't create duplicate sockets
    if (this.socket?.readyState === WebSocket.CONNECTING) {
      wsLog('info', 'Connection already in progress, skipping');
      return;
    }

    const token = getToken();
    if (!token) {
      wsLog('warn', 'No auth token available, cannot connect');
      return;
    }

    this.isManualDisconnect = false;

    // Clean up any stale socket before creating a new one
    this.destroySocket();

    try {
      const url = `${WS_ENDPOINT}?token=${encodeURIComponent(token)}`;
      wsLog('info', 'Connecting', { endpoint: WS_ENDPOINT, attempt: this.reconnectAttempts });

      this.socket = new WebSocket(url);
      this.setupSocketHandlers();
      this.setupVisibilityHandler();
    } catch (error) {
      wsLog('error', 'Failed to create WebSocket', { error: String(error) });
      this.handleError(new Error(`Connection creation failed: ${String(error)}`));
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    wsLog('info', 'Manual disconnect requested');
    this.isManualDisconnect = true;
    this.cleanup();
    this.teardownVisibilityHandler();

    if (this.socket) {
      try {
        if (this.socket.readyState === WebSocket.OPEN ||
            this.socket.readyState === WebSocket.CONNECTING) {
          this.socket.close(1000, 'Client disconnect');
        }
      } catch {
        // Socket may already be in a broken state
      }
      this.socket = null;
    }

    this.subscribedGroups.clear();
    this.pendingMessages = [];
    this.reconnectAttempts = 0;
    this.notifyDisconnect();
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  /** Tear down socket event handlers and null the reference */
  private destroySocket(): void {
    if (!this.socket) return;
    try {
      // Remove handlers to prevent stale callbacks
      this.socket.onopen = null;
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.onmessage = null;
      // Force-close if still lingering
      if (this.socket.readyState === WebSocket.OPEN ||
          this.socket.readyState === WebSocket.CONNECTING) {
        this.socket.close(1000, 'Replacing connection');
      }
    } catch {
      // Ignore errors during teardown
    }
    this.socket = null;
  }

  private setupSocketHandlers(): void {
    if (!this.socket) return;

    this.socket.onopen = () => {
      this.lastConnectedAt = Date.now();
      this.reconnectAttempts = 0;
      wsLog('info', 'Connected successfully');

      this.startHeartbeat();
      this.notifyConnect();

      // Resubscribe to previously subscribed groups
      this.subscribedGroups.forEach((groupId) => {
        this.sendMessage('subscribe', { groupId });
      });

      // Drain pending message queue
      this.drainPendingMessages();
    };

    this.socket.onclose = (event) => {
      const sessionDuration = this.lastConnectedAt
        ? Math.round((Date.now() - this.lastConnectedAt) / 1000)
        : 0;

      wsLog('info', 'Connection closed', {
        code: event.code,
        reason: event.reason || '(none)',
        wasClean: event.wasClean,
        sessionSeconds: sessionDuration,
      });

      this.cleanup();
      this.notifyDisconnect();

      // Decide whether to reconnect based on close code
      if (this.isManualDisconnect) {
        wsLog('info', 'Manual disconnect - will not reconnect');
        return;
      }

      if (NON_RECOVERABLE_CODES.has(event.code)) {
        wsLog('warn', 'Non-recoverable close code, will not auto-reconnect', { code: event.code });
        if (event.code === 4001 || event.code === 1008) {
          this.handleError(new Error(`Authentication rejected (code ${event.code})`));
        }
        return;
      }

      this.scheduleReconnect();
    };

    this.socket.onerror = (_event) => {
      // The error event fires BEFORE close, so we log but don't reconnect here.
      // Reconnection is handled in onclose to prevent duplicate attempts.
      wsLog('error', 'Socket error occurred (close event will follow)');
      this.handleError(new Error('WebSocket transport error'));
    };

    this.socket.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  // ==================== VISIBILITY LIFECYCLE ====================

  /**
   * Handle Page Visibility API for mobile lifecycle.
   * Mobile browsers aggressively suspend WebSocket connections when backgrounded.
   * When the page becomes visible again, we check the connection and reconnect
   * if it was dropped while in the background.
   */
  private setupVisibilityHandler(): void {
    if (this.visibilityHandler) return; // Already set up

    this.visibilityHandler = () => {
      if (document.visibilityState !== 'visible') return;

      // Page is back in foreground - check connection health
      if (this.isManualDisconnect) return;

      if (!this.isConnected()) {
        wsLog('info', 'Page visible, connection lost while backgrounded - reconnecting');
        // Reset attempts for visibility-triggered reconnect (fresh chance)
        this.reconnectAttempts = 0;
        this.cleanup(); // Clear any existing reconnect timer
        this.connect();
      }
    };

    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private teardownVisibilityHandler(): void {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  // ==================== MESSAGE HANDLING ====================

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as WSMessage & { data?: unknown };

      // Handle pong (application-level heartbeat response)
      if ((message.type as string) === 'pong') {
        this.clearHeartbeatTimeout();
        return;
      }

      // Handle connection established
      if ((message.type as string) === 'connection_established' || message.type === 'connection:established') {
        wsLog('info', 'Server confirmed connection', { data: message.payload ?? message.data });
        return;
      }

      // Route message to appropriate handlers
      // Support both 'payload' and 'data' fields (server may use either)
      let eventType = message.type as WSEventType;
      let messageData = message.payload ?? message.data;

      // Handle 'group_notification' wrapper: the server's notification system
      // wraps all notifications with type='group_notification' and includes
      // the actual notification type in data.notificationType.
      // Map these to the correct event handlers the client has registered.
      if (eventType === ('group_notification' as WSEventType) && messageData && typeof messageData === 'object') {
        const wrapped = messageData as Record<string, unknown>;
        const notificationType = wrapped.notificationType as string;

        // Map server notification types to client event types
        const notificationTypeMap: Record<string, string> = {
          'analysis_completed': 'analysis:completed',
          'compatibility_updated': 'insights:updated',
          'conversation_insight': 'conversation:insight',
          'conversation_summary': 'conversation:insight',
          // TruthStream events
          'ts_review_received': 'ts:review_received',
          'ts_dialogue_message': 'ts:dialogue_message',
          'ts_helpful_marked': 'ts:helpful_marked',
          'ts_review_classified': 'ts:review_classified',
          'ts_analysis_complete': 'ts:analysis_complete',
          'ts_milestone_earned': 'ts:milestone_earned',
          'ts_queue_assigned': 'ts:queue_assigned',
        };

        const mappedType = notificationTypeMap[notificationType];
        if (mappedType) {
          eventType = mappedType as WSEventType;
          // Pass the full notification data as the event payload
          messageData = wrapped;

          // ALSO dispatch to 'group_notification' handlers so the
          // NotificationContext (notification panel) picks up the event.
          const groupNotifHandlers = this.handlers['group_notification'];
          if (Array.isArray(groupNotifHandlers) && groupNotifHandlers.length > 0) {
            groupNotifHandlers.forEach((handler) => {
              try {
                (handler as EventHandler)(wrapped);
              } catch (err) {
                wsLog('error', 'group_notification handler threw for remapped event', { error: String(err) });
              }
            });
          }
        }
      }

      const handlers = this.handlers[eventType as keyof EventHandlers];

      if (Array.isArray(handlers) && handlers.length > 0) {
        handlers.forEach((handler) => {
          try {
            (handler as EventHandler)(messageData);
          } catch (err) {
            wsLog('error', `Handler threw for event "${eventType}"`, { error: String(err) });
          }
        });
      }
    } catch (error) {
      wsLog('error', 'Failed to parse incoming message', { error: String(error) });
    }
  }

  private handleError(error: Error): void {
    this.handlers.onError.forEach((handler) => {
      try {
        handler(error);
      } catch (err) {
        wsLog('error', 'Error handler threw', { error: String(err) });
      }
    });
  }

  private notifyConnect(): void {
    this.handlers.onConnect.forEach((handler) => {
      try {
        handler(true);
      } catch (err) {
        wsLog('error', 'Connect handler threw', { error: String(err) });
      }
    });
  }

  private notifyDisconnect(): void {
    this.handlers.onDisconnect.forEach((handler) => {
      try {
        handler(false);
      } catch (err) {
        wsLog('error', 'Disconnect handler threw', { error: String(err) });
      }
    });
  }

  // ==================== RECONNECTION WITH JITTER ====================

  private scheduleReconnect(): void {
    // Guard: already have a reconnect scheduled
    if (this.reconnectTimer) return;

    // Guard: exceeded max attempts
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      wsLog('error', 'Max reconnection attempts reached, giving up', {
        attempts: this.reconnectAttempts,
        max: MAX_RECONNECT_ATTEMPTS,
      });
      this.handleError(new Error(`Connection lost after ${this.reconnectAttempts} reconnection attempts`));
      return;
    }

    const baseDelay = BASE_RECONNECT_DELAYS[
      Math.min(this.reconnectAttempts, BASE_RECONNECT_DELAYS.length - 1)
    ];
    const delay = withJitter(baseDelay);

    wsLog('info', 'Scheduling reconnect', {
      attempt: this.reconnectAttempts + 1,
      maxAttempts: MAX_RECONNECT_ATTEMPTS,
      delayMs: delay,
    });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  /** Reset reconnect counter. Called externally when user takes an action indicating
   *  the network is available (e.g. successful API call). */
  resetReconnectAttempts(): void {
    this.reconnectAttempts = 0;
  }

  // ==================== HEARTBEAT ====================

  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.sendMessage('ping', {});
        this.setHeartbeatTimeout();
      }
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.clearHeartbeatTimeout();
  }

  private setHeartbeatTimeout(): void {
    this.clearHeartbeatTimeout();
    this.heartbeatTimeout = setTimeout(() => {
      wsLog('warn', 'Heartbeat pong not received within timeout, closing connection', {
        timeoutMs: HEARTBEAT_TIMEOUT,
      });
      // Use close (not terminate) so the onclose handler fires normally
      try {
        this.socket?.close(4000, 'Heartbeat timeout');
      } catch {
        // If close fails, force-destroy
        this.destroySocket();
        this.cleanup();
        this.notifyDisconnect();
        this.scheduleReconnect();
      }
    }, HEARTBEAT_TIMEOUT);
  }

  private clearHeartbeatTimeout(): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  private cleanup(): void {
    this.stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ==================== MESSAGING ====================

  private sendMessage(type: string, payload: unknown): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      // Queue message for later if not connected (never queue pings)
      if (type !== 'ping') {
        if (this.pendingMessages.length >= MAX_PENDING_MESSAGES) {
          // Drop oldest message to make room (FIFO eviction)
          const dropped = this.pendingMessages.shift();
          wsLog('warn', 'Pending message queue full, dropped oldest message', {
            droppedType: dropped?.type,
            queueSize: MAX_PENDING_MESSAGES,
          });
        }
        this.pendingMessages.push({ type, payload });
      }
      return false;
    }

    try {
      this.socket.send(
        JSON.stringify({
          type,
          payload,
          timestamp: new Date().toISOString(),
        })
      );
      return true;
    } catch (error) {
      wsLog('error', 'Send failed', { type, error: String(error) });
      return false;
    }
  }

  private drainPendingMessages(): void {
    const batch = this.pendingMessages.splice(0);
    let sent = 0;
    for (const msg of batch) {
      if (this.sendMessage(msg.type, msg.payload)) {
        sent++;
      }
    }
    if (sent > 0) {
      wsLog('info', 'Drained pending message queue', { sent, total: batch.length });
    }
  }

  // ==================== SUBSCRIPTIONS ====================

  subscribeToGroup(groupId: string): void {
    this.subscribedGroups.add(groupId);

    if (this.isConnected()) {
      this.sendMessage('subscribe', { groupId });
    }
  }

  unsubscribeFromGroup(groupId: string): void {
    this.subscribedGroups.delete(groupId);

    if (this.isConnected()) {
      this.sendMessage('unsubscribe', { groupId });
    }
  }

  // ==================== PRESENCE ====================

  updatePresence(groupId: string, status: 'active' | 'idle' | 'offline'): void {
    this.sendMessage('presence:update', { groupId, status });
  }

  // ==================== VOTING ACTIONS ====================

  sendVoteResponse(groupId: string, voteId: string, response: string): void {
    this.sendMessage('vote:response', { groupId, voteId, response });
  }

  // ==================== EVENT HANDLERS ====================

  onConnect(handler: ConnectionHandler): () => void {
    this.handlers.onConnect.push(handler);
    return () => {
      const idx = this.handlers.onConnect.indexOf(handler);
      if (idx >= 0) this.handlers.onConnect.splice(idx, 1);
    };
  }

  onDisconnect(handler: ConnectionHandler): () => void {
    this.handlers.onDisconnect.push(handler);
    return () => {
      const idx = this.handlers.onDisconnect.indexOf(handler);
      if (idx >= 0) this.handlers.onDisconnect.splice(idx, 1);
    };
  }

  onError(handler: ErrorHandler): () => void {
    this.handlers.onError.push(handler);
    return () => {
      const idx = this.handlers.onError.indexOf(handler);
      if (idx >= 0) this.handlers.onError.splice(idx, 1);
    };
  }

  on<K extends keyof Omit<EventHandlers, 'onConnect' | 'onDisconnect' | 'onError'>>(
    event: K,
    handler: EventHandler
  ): () => void {
    const handlers = this.handlers[event];
    if (Array.isArray(handlers)) {
      handlers.push(handler as EventHandler);
      return () => {
        const idx = handlers.indexOf(handler as EventHandler);
        if (idx >= 0) handlers.splice(idx, 1);
      };
    }
    return () => {};
  }

  off<K extends keyof Omit<EventHandlers, 'onConnect' | 'onDisconnect' | 'onError'>>(
    event: K,
    handler: EventHandler
  ): void {
    const handlers = this.handlers[event];
    if (Array.isArray(handlers)) {
      const idx = handlers.indexOf(handler as EventHandler);
      if (idx >= 0) handlers.splice(idx, 1);
    }
  }

  // Remove all handlers for an event
  offAll<K extends keyof EventHandlers>(event: K): void {
    if (event in this.handlers) {
      (this.handlers[event] as unknown[]).length = 0;
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE & EXPORTS
// ============================================================================

const groupsWebSocket = new GroupsWebSocketClient();

// Connection management
export const connectWebSocket = () => groupsWebSocket.connect();
export const disconnectWebSocket = () => groupsWebSocket.disconnect();
export const isWebSocketConnected = () => groupsWebSocket.isConnected();

// Subscriptions
export const subscribeToGroup = (groupId: string) => groupsWebSocket.subscribeToGroup(groupId);
export const unsubscribeFromGroup = (groupId: string) =>
  groupsWebSocket.unsubscribeFromGroup(groupId);

// Presence
export const updatePresence = (groupId: string, status: 'active' | 'idle' | 'offline') =>
  groupsWebSocket.updatePresence(groupId, status);

// Voting
export const sendVoteResponse = (groupId: string, voteId: string, response: string) =>
  groupsWebSocket.sendVoteResponse(groupId, voteId, response);

// Event handlers
export const onWebSocketConnect = (handler: ConnectionHandler) =>
  groupsWebSocket.onConnect(handler);
export const onWebSocketDisconnect = (handler: ConnectionHandler) =>
  groupsWebSocket.onDisconnect(handler);
export const onWebSocketError = (handler: ErrorHandler) => groupsWebSocket.onError(handler);
export const onWebSocketEvent = <
  K extends keyof Omit<EventHandlers, 'onConnect' | 'onDisconnect' | 'onError'>,
>(
  event: K,
  handler: EventHandler<unknown>
) => groupsWebSocket.on(event, handler);
export const offWebSocketEvent = <
  K extends keyof Omit<EventHandlers, 'onConnect' | 'onDisconnect' | 'onError'>,
>(
  event: K,
  handler: EventHandler<unknown>
) => groupsWebSocket.off(event, handler);

// Export instance for advanced usage
export { groupsWebSocket };
