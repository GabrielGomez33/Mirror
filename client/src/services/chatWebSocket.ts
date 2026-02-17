// src/services/chatWebSocket.ts
// MirrorGroups Chat WebSocket Service - Real-time chat communication

import { getToken } from '../utils/token';
import type {
  ChatWSMessageType,
  ChatWSMessage,
  WSGroupJoinedPayload,
  WSSendMessagePayload,
  WSMessageAckPayload,
  WSNewMessagePayload,
  WSMessageEditedPayload,
  WSMessageDeletedPayload,
  WSTypingPayload,
  WSPresencePayload,
  WSReactionsUpdatedPayload,
  WSMessageReadPayload,
  WSMentionPayload,
  WSErrorPayload,
  MessageContentType,
  PresenceStatus,
  MessageMetadata,
} from '../types/chat';
import { CHAT_CONFIG } from '../types/chat';

// ============================================================================
// CONFIGURATION
// ============================================================================

const WS_BASE = import.meta.env.VITE_WS_URL
  ? import.meta.env.VITE_WS_URL
  : import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/^http/, 'ws')
    : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

const WS_ENDPOINT = `${WS_BASE}/mirror/groups/chat`;

const RECONNECT_DELAYS = CHAT_CONFIG.RECONNECT_DELAYS;
const HEARTBEAT_INTERVAL = CHAT_CONFIG.HEARTBEAT_INTERVAL;
const HEARTBEAT_TIMEOUT = CHAT_CONFIG.HEARTBEAT_TIMEOUT;

// ============================================================================
// EVENT TYPES
// ============================================================================

type EventHandler<T = unknown> = (data: T) => void;
type ErrorHandler = (error: Error) => void;
type ConnectionHandler = (connected: boolean) => void;

interface ChatEventHandlers {
  // Connection events
  onConnect: ConnectionHandler[];
  onDisconnect: ConnectionHandler[];
  onError: ErrorHandler[];

  // Message events
  'chat:message': EventHandler<WSNewMessagePayload>[];
  'chat:message_edited': EventHandler<WSMessageEditedPayload>[];
  'chat:message_deleted': EventHandler<WSMessageDeletedPayload>[];
  'chat:ack': EventHandler<WSMessageAckPayload>[];

  // Typing events
  'chat:typing': EventHandler<WSTypingPayload>[];

  // Presence events
  'chat:presence': EventHandler<WSPresencePayload>[];

  // Reaction events
  'chat:reactions_updated': EventHandler<WSReactionsUpdatedPayload>[];

  // Read receipt events
  'chat:message_read': EventHandler<WSMessageReadPayload>[];

  // Mention events
  'chat:mention': EventHandler<WSMentionPayload>[];

  // Group events
  'chat:group_joined': EventHandler<WSGroupJoinedPayload>[];
  'chat:group_left': EventHandler<{ groupId: string }>[];

  // Error events
  'chat:error': EventHandler<WSErrorPayload>[];

  // Dina AI events
  'dina:processing_start': EventHandler[];
  'dina:stream_start': EventHandler[];
  'dina:stream_chunk': EventHandler[];
  'dina:stream_complete': EventHandler[];
}

type ChatEventType = keyof Omit<ChatEventHandlers, 'onConnect' | 'onDisconnect' | 'onError'>;

// ============================================================================
// PENDING REQUEST MANAGEMENT
// ============================================================================

interface PendingRequest {
  resolve: (data: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

// ============================================================================
// WEBSOCKET CLIENT CLASS
// ============================================================================

class ChatWebSocketClient {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  private isManualDisconnect = false;
  private subscribedGroups: Set<string> = new Set();
  private pendingMessages: Array<{ type: string; payload: unknown; requestId?: string }> = [];
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private typingTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  private handlers: ChatEventHandlers = {
    onConnect: [],
    onDisconnect: [],
    onError: [],
    'chat:message': [],
    'chat:message_edited': [],
    'chat:message_deleted': [],
    'chat:ack': [],
    'chat:typing': [],
    'chat:presence': [],
    'chat:reactions_updated': [],
    'chat:message_read': [],
    'chat:mention': [],
    'chat:group_joined': [],
    'chat:group_left': [],
    'chat:error': [],
    'dina:processing_start': [],
    'dina:stream_start': [],
    'dina:stream_chunk': [],
    'dina:stream_complete': [],
  };

  // ==================== CONNECTION MANAGEMENT ====================

  connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      console.log('[ChatWS] Already connected');
      return;
    }

    const token = getToken();
    if (!token) {
      console.warn('[ChatWS] No auth token, cannot connect');
      return;
    }

    this.isManualDisconnect = false;

    try {
      const url = `${WS_ENDPOINT}?token=${encodeURIComponent(token)}`;
      console.log('[ChatWS] Connecting to:', WS_ENDPOINT);

      this.socket = new WebSocket(url);
      this.setupSocketHandlers();
    } catch (error) {
      console.error('[ChatWS] Connection error:', error);
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
    this.clearAllTypingTimers();
    this.rejectAllPendingRequests('Connection closed');
    this.notifyDisconnect();
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  getConnectionState(): number {
    return this.socket?.readyState ?? WebSocket.CLOSED;
  }

  private setupSocketHandlers(): void {
    if (!this.socket) return;

    this.socket.onopen = () => {
      console.log('[ChatWS] Connected');
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.notifyConnect();

      // Resubscribe to previously subscribed groups
      this.subscribedGroups.forEach((groupId) => {
        this.sendMessage('chat:join_group', { groupId });
      });

      // Send pending messages
      while (this.pendingMessages.length > 0) {
        const msg = this.pendingMessages.shift();
        if (msg) {
          this.sendMessage(msg.type as ChatWSMessageType, msg.payload, msg.requestId);
        }
      }
    };

    this.socket.onclose = (event) => {
      console.log('[ChatWS] Disconnected:', event.code, event.reason);
      this.cleanup();
      this.notifyDisconnect();

      // Handle specific close codes
      if (event.code === 4001) {
        // Authentication failed - don't reconnect
        this.handleError(new Error('Authentication failed'));
        return;
      }

      if (event.code === 4003) {
        // Forbidden - not a member
        this.handleError(new Error('Access forbidden'));
        return;
      }

      if (!this.isManualDisconnect && event.code !== 1000) {
        this.scheduleReconnect();
      }
    };

    this.socket.onerror = (event) => {
      console.error('[ChatWS] Error:', event);
      this.handleError(new Error('WebSocket error'));
    };

    this.socket.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  private handleMessage(data: string): void {
    try {
      const message: ChatWSMessage = JSON.parse(data);

      // Handle pong (heartbeat response)
      if (message.type === 'pong') {
        this.clearHeartbeatTimeout();
        return;
      }

      // Handle acknowledgment with requestId
      if (message.type === 'chat:ack' && message.requestId) {
        const pending = this.pendingRequests.get(message.requestId);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(message.requestId);
          pending.resolve(message.payload);
        }
      }

      // Handle error with requestId
      if (message.type === 'chat:error' && message.requestId) {
        const pending = this.pendingRequests.get(message.requestId);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(message.requestId);
          pending.reject(new Error((message.payload as WSErrorPayload).error));
        }
      }

      // Route message to appropriate handlers
      const eventType = message.type as ChatEventType;
      const handlers = this.handlers[eventType];

      if (Array.isArray(handlers)) {
        handlers.forEach((handler) => {
          try {
            (handler as EventHandler)(message.payload);
          } catch (err) {
            console.error(`[ChatWS] Handler error for ${eventType}:`, err);
          }
        });
      }
    } catch (error) {
      console.error('[ChatWS] Message parse error:', error);
    }
  }

  private handleError(error: Error): void {
    this.handlers.onError.forEach((handler) => {
      try {
        handler(error);
      } catch (err) {
        console.error('[ChatWS] Error handler threw:', err);
      }
    });
  }

  private notifyConnect(): void {
    this.handlers.onConnect.forEach((handler) => {
      try {
        handler(true);
      } catch (err) {
        console.error('[ChatWS] Connect handler threw:', err);
      }
    });
  }

  private notifyDisconnect(): void {
    this.handlers.onDisconnect.forEach((handler) => {
      try {
        handler(false);
      } catch (err) {
        console.error('[ChatWS] Disconnect handler threw:', err);
      }
    });
  }

  // ==================== RECONNECTION ====================

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    const delay = RECONNECT_DELAYS[Math.min(this.reconnectAttempts, RECONNECT_DELAYS.length - 1)];
    console.log(`[ChatWS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

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
      console.warn('[ChatWS] Heartbeat timeout, reconnecting...');
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

  private sendMessage(type: ChatWSMessageType | 'ping', payload: unknown, requestId?: string): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      // Queue message for later if not connected (except ping)
      if (type !== 'ping') {
        this.pendingMessages.push({ type, payload, requestId });
      }
      return false;
    }

    try {
      const message: ChatWSMessage = {
        type: type as ChatWSMessageType,
        payload,
        requestId,
        timestamp: new Date().toISOString(),
      };
      this.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('[ChatWS] Send error:', error);
      return false;
    }
  }

  private sendWithAck<T>(
    type: ChatWSMessageType,
    payload: unknown,
    timeout: number = 10000
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();

      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }, timeout);

      this.pendingRequests.set(requestId, {
        resolve: resolve as (data: unknown) => void,
        reject,
        timeout: timeoutHandle,
      });

      if (!this.sendMessage(type, payload, requestId)) {
        clearTimeout(timeoutHandle);
        this.pendingRequests.delete(requestId);
        reject(new Error('Failed to send message'));
      }
    });
  }

  private rejectAllPendingRequests(reason: string): void {
    this.pendingRequests.forEach((pending, requestId) => {
      clearTimeout(pending.timeout);
      pending.reject(new Error(reason));
      this.pendingRequests.delete(requestId);
    });
  }

  // ==================== GROUP SUBSCRIPTIONS ====================

  joinGroup(groupId: string): Promise<WSGroupJoinedPayload> {
    this.subscribedGroups.add(groupId);

    if (this.isConnected()) {
      return this.sendWithAck<WSGroupJoinedPayload>('chat:join_group', { groupId });
    }

    return Promise.resolve({ groupId, subscriberCount: 0 });
  }

  leaveGroup(groupId: string): void {
    this.subscribedGroups.delete(groupId);
    this.clearTypingTimer(groupId);

    if (this.isConnected()) {
      this.sendMessage('chat:leave_group', { groupId });
    }
  }

  // ==================== CHAT ACTIONS ====================

  sendChatMessage(
    groupId: string,
    content: string,
    options: {
      contentType?: MessageContentType;
      parentMessageId?: string;
      clientMessageId?: string;
      metadata?: Partial<MessageMetadata>;
    } = {}
  ): Promise<WSMessageAckPayload> {
    const payload: WSSendMessagePayload = {
      groupId,
      content,
      contentType: options.contentType || 'text',
      parentMessageId: options.parentMessageId,
      clientMessageId: options.clientMessageId || crypto.randomUUID(),
      metadata: options.metadata,
    };

    return this.sendWithAck<WSMessageAckPayload>('chat:send_message', payload);
  }

  editChatMessage(groupId: string, messageId: string, content: string): Promise<WSMessageAckPayload> {
    return this.sendWithAck<WSMessageAckPayload>('chat:edit_message', {
      groupId,
      messageId,
      content,
    });
  }

  deleteChatMessage(groupId: string, messageId: string): Promise<WSMessageAckPayload> {
    return this.sendWithAck<WSMessageAckPayload>('chat:delete_message', {
      groupId,
      messageId,
    });
  }

  // ==================== TYPING INDICATORS ====================

  private clearTypingTimer(groupId: string): void {
    const timer = this.typingTimers.get(groupId);
    if (timer) {
      clearTimeout(timer);
      this.typingTimers.delete(groupId);
    }
  }

  private clearAllTypingTimers(): void {
    this.typingTimers.forEach((timer) => clearTimeout(timer));
    this.typingTimers.clear();
  }

  startTyping(groupId: string): void {
    // Clear any existing timer
    this.clearTypingTimer(groupId);

    // Send typing start
    this.sendMessage('chat:typing_start', { groupId });

    // Auto-stop after 5 seconds
    const timer = setTimeout(() => {
      this.stopTyping(groupId);
    }, 5000);

    this.typingTimers.set(groupId, timer);
  }

  stopTyping(groupId: string): void {
    this.clearTypingTimer(groupId);
    this.sendMessage('chat:typing_stop', { groupId });
  }

  // ==================== PRESENCE ====================

  updatePresence(groupId: string, status: PresenceStatus, deviceType?: string): void {
    this.sendMessage('chat:presence_update', {
      groupId,
      status,
      deviceType,
    });
  }

  // ==================== READ RECEIPTS ====================

  markRead(groupId: string, messageId: string): void {
    this.sendMessage('chat:mark_read', {
      groupId,
      messageId,
    });
  }

  // ==================== REACTIONS ====================

  addReaction(groupId: string, messageId: string, emoji: string): void {
    this.sendMessage('chat:add_reaction', {
      groupId,
      messageId,
      emoji,
    });
  }

  removeReaction(groupId: string, messageId: string, emoji: string): void {
    this.sendMessage('chat:remove_reaction', {
      groupId,
      messageId,
      emoji,
    });
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

  on<K extends ChatEventType>(event: K, handler: EventHandler): () => void {
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

  off<K extends ChatEventType>(event: K, handler: EventHandler): void {
    const handlers = this.handlers[event];
    if (Array.isArray(handlers)) {
      const idx = handlers.indexOf(handler as EventHandler);
      if (idx >= 0) handlers.splice(idx, 1);
    }
  }

  offAll<K extends keyof ChatEventHandlers>(event: K): void {
    if (event in this.handlers) {
      (this.handlers[event] as unknown[]).length = 0;
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE & EXPORTS
// ============================================================================

const chatWebSocket = new ChatWebSocketClient();

// Connection management
export const connectChatWebSocket = () => chatWebSocket.connect();
export const disconnectChatWebSocket = () => chatWebSocket.disconnect();
export const isChatWebSocketConnected = () => chatWebSocket.isConnected();
export const getChatConnectionState = () => chatWebSocket.getConnectionState();

// Group subscriptions
export const joinChatGroup = (groupId: string) => chatWebSocket.joinGroup(groupId);
export const leaveChatGroup = (groupId: string) => chatWebSocket.leaveGroup(groupId);

// Chat actions
export const sendChatMessageWS = (
  groupId: string,
  content: string,
  options?: {
    contentType?: MessageContentType;
    parentMessageId?: string;
    clientMessageId?: string;
    metadata?: Partial<MessageMetadata>;
  }
) => chatWebSocket.sendChatMessage(groupId, content, options);
export const editChatMessageWS = (groupId: string, messageId: string, content: string) =>
  chatWebSocket.editChatMessage(groupId, messageId, content);
export const deleteChatMessageWS = (groupId: string, messageId: string) =>
  chatWebSocket.deleteChatMessage(groupId, messageId);

// Typing indicators
export const startChatTyping = (groupId: string) => chatWebSocket.startTyping(groupId);
export const stopChatTyping = (groupId: string) => chatWebSocket.stopTyping(groupId);

// Presence
export const updateChatPresence = (groupId: string, status: PresenceStatus, deviceType?: string) =>
  chatWebSocket.updatePresence(groupId, status, deviceType);

// Read receipts
export const markChatRead = (groupId: string, messageId: string) =>
  chatWebSocket.markRead(groupId, messageId);

// Reactions
export const addChatReaction = (groupId: string, messageId: string, emoji: string) =>
  chatWebSocket.addReaction(groupId, messageId, emoji);
export const removeChatReaction = (groupId: string, messageId: string, emoji: string) =>
  chatWebSocket.removeReaction(groupId, messageId, emoji);

// Event handlers
export const onChatConnect = (handler: ConnectionHandler) => chatWebSocket.onConnect(handler);
export const onChatDisconnect = (handler: ConnectionHandler) => chatWebSocket.onDisconnect(handler);
export const onChatError = (handler: ErrorHandler) => chatWebSocket.onError(handler);
export const onChatEvent = <K extends ChatEventType>(event: K, handler: EventHandler) =>
  chatWebSocket.on(event, handler);
export const offChatEvent = <K extends ChatEventType>(event: K, handler: EventHandler) =>
  chatWebSocket.off(event, handler);

// Export instance for advanced usage
export { chatWebSocket };
