// src/services/groupsWebSocket.ts
// MirrorGroups WebSocket Service - Real-time communication

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

const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000]; // Exponential backoff
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const HEARTBEAT_TIMEOUT = 10000; // 10 seconds for pong response

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

  // Session events
  'session:started': EventHandler<unknown>[];
  'session:ended': EventHandler<unknown>[];

  // Notifications
  'notification:received': EventHandler<unknown>[];
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

  private handlers: EventHandlers = {
    onConnect: [],
    onDisconnect: [],
    onError: [],
    'member:joined': [],
    'member:left': [],
    'member:updated': [],
    'data:shared': [],
    'insights:updated': [],
    'analysis:started': [],
    'analysis:completed': [],
    'vote:proposed': [],
    'vote:cast': [],
    'vote:completed': [],
    'conversation:insight': [],
    'conversation:summary': [],
    'session:started': [],
    'session:ended': [],
    'notification:received': [],
  };

  // ==================== CONNECTION MANAGEMENT ====================

  connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      console.log('[GroupsWS] Already connected');
      return;
    }

    const token = getToken();
    if (!token) {
      console.warn('[GroupsWS] No auth token, cannot connect');
      return;
    }

    this.isManualDisconnect = false;

    try {
      const url = `${WS_ENDPOINT}?token=${encodeURIComponent(token)}`;
      console.log('[GroupsWS] Connecting to:', WS_ENDPOINT);

      this.socket = new WebSocket(url);
      this.setupSocketHandlers();
    } catch (error) {
      console.error('[GroupsWS] Connection error:', error);
      this.handleError(error as Error);
    }
  }

  disconnect(): void {
    this.isManualDisconnect = true;
    this.cleanup();

    if (this.socket) {
      this.socket.close(1000, 'Client disconnect');
      this.socket = null;
    }

    this.subscribedGroups.clear();
    this.notifyDisconnect();
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  private setupSocketHandlers(): void {
    if (!this.socket) return;

    this.socket.onopen = () => {
      console.log('[GroupsWS] Connected');
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.notifyConnect();

      // Resubscribe to previously subscribed groups
      this.subscribedGroups.forEach((groupId) => {
        this.sendMessage('subscribe', { groupId });
      });

      // Send pending messages
      while (this.pendingMessages.length > 0) {
        const msg = this.pendingMessages.shift();
        if (msg) {
          this.sendMessage(msg.type, msg.payload);
        }
      }
    };

    this.socket.onclose = (event) => {
      console.log('[GroupsWS] Disconnected:', event.code, event.reason);
      this.cleanup();
      this.notifyDisconnect();

      if (!this.isManualDisconnect && event.code !== 1000) {
        this.scheduleReconnect();
      }
    };

    this.socket.onerror = (event) => {
      console.error('[GroupsWS] Error:', event);
      this.handleError(new Error('WebSocket error'));
    };

    this.socket.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  private handleMessage(data: string): void {
    try {
      const message: WSMessage = JSON.parse(data);

      // Handle pong (heartbeat response)
      if ((message.type as string) === 'pong') {
        this.clearHeartbeatTimeout();
        return;
      }

      // Handle connection established
      if (message.type === 'connection:established') {
        console.log('[GroupsWS] Connection established:', message.payload);
        return;
      }

      // Route message to appropriate handlers
      const eventType = message.type as WSEventType;
      const handlers = this.handlers[eventType as keyof EventHandlers];

      if (Array.isArray(handlers)) {
        handlers.forEach((handler) => {
          try {
            (handler as EventHandler)(message.payload);
          } catch (err) {
            console.error(`[GroupsWS] Handler error for ${eventType}:`, err);
          }
        });
      }
    } catch (error) {
      console.error('[GroupsWS] Message parse error:', error);
    }
  }

  private handleError(error: Error): void {
    this.handlers.onError.forEach((handler) => {
      try {
        handler(error);
      } catch (err) {
        console.error('[GroupsWS] Error handler threw:', err);
      }
    });
  }

  private notifyConnect(): void {
    this.handlers.onConnect.forEach((handler) => {
      try {
        handler(true);
      } catch (err) {
        console.error('[GroupsWS] Connect handler threw:', err);
      }
    });
  }

  private notifyDisconnect(): void {
    this.handlers.onDisconnect.forEach((handler) => {
      try {
        handler(false);
      } catch (err) {
        console.error('[GroupsWS] Disconnect handler threw:', err);
      }
    });
  }

  // ==================== RECONNECTION ====================

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    const delay = RECONNECT_DELAYS[Math.min(this.reconnectAttempts, RECONNECT_DELAYS.length - 1)];
    console.log(`[GroupsWS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttempts++;
      this.connect();
    }, delay);
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
      console.warn('[GroupsWS] Heartbeat timeout, reconnecting...');
      this.socket?.close(4000, 'Heartbeat timeout');
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
      // Queue message for later if not connected
      if (type !== 'ping') {
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
      console.error('[GroupsWS] Send error:', error);
      return false;
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
