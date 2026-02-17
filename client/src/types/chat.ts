// src/types/chat.ts
// MirrorGroups Chat TypeScript interfaces and types
// Following the backend specification for Phase 5: Real-Time Chat

// ============================================================================
// MESSAGE CONTENT TYPES
// ============================================================================

export type MessageContentType =
  | 'text'
  | 'image'
  | 'file'
  | 'audio'
  | 'video'
  | 'system'
  | 'reply';

export type MessageStatus =
  | 'sending'   // Client-side only, before server confirms
  | 'sent'      // Server received
  | 'delivered' // Delivered to recipients
  | 'failed';   // Failed to send

export type PresenceStatus =
  | 'online'
  | 'away'
  | 'busy'
  | 'offline';

export type NotificationLevel =
  | 'all'       // All messages
  | 'mentions'  // Only @mentions
  | 'none';     // Muted

export type DeviceType =
  | 'web'
  | 'mobile_ios'
  | 'mobile_android'
  | 'desktop';

// ============================================================================
// MESSAGE METADATA TYPES
// ============================================================================

export interface MentionInfo {
  userId: number;
  username: string;
  startIndex: number;
  endIndex: number;
  type: 'user' | 'everyone' | 'role';
}

export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  startIndex: number;
  endIndex: number;
}

export interface FormattingInfo {
  bold?: Array<[number, number]>;
  italic?: Array<[number, number]>;
  code?: Array<[number, number]>;
  links?: Array<[number, number, string]>;
}

export interface ReplyPreview {
  messageId: string;
  senderUsername: string;
  content: string;
}

export interface MessageMetadata {
  mentions?: MentionInfo[];
  links?: LinkPreview[];
  formatting?: FormattingInfo;
  replyPreview?: ReplyPreview;
  custom?: Record<string, unknown>;
  // Pin-related (only on pinned messages)
  pinNote?: string | null;
  pinnedAt?: string | null;
  pinnedBy?: number | null;
}

// ============================================================================
// MAIN CHAT MESSAGE INTERFACE
// ============================================================================

export interface ChatMessage {
  id: string;
  groupId: string;
  senderUserId: number;
  senderUsername?: string;
  content: string;
  contentType: MessageContentType;
  parentMessageId?: string | null;
  threadRootId?: string | null;
  threadReplyCount?: number;
  metadata?: MessageMetadata;
  status: MessageStatus;
  isEdited: boolean;
  editedAt?: string | null;
  isDeleted: boolean;
  deletedAt?: string | null;
  encryptionKeyId?: string | null;
  clientMessageId?: string | null;
  createdAt: string;
  updatedAt: string;
  reactions?: ReactionSummary[];
  attachments?: ChatAttachment[];
  readBy?: number[];
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  users?: number[];
  hasReacted?: boolean;
}

export interface ChatAttachment {
  id: string;
  messageId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  thumbnailPath?: string | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  isEncrypted: boolean;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
}

// ============================================================================
// TYPING & PRESENCE INTERFACES
// ============================================================================

export interface TypingIndicator {
  userId: number;
  username: string;
  groupId: string;
  isTyping: boolean;
  startedAt: string;
}

export interface UserPresence {
  userId: number;
  username?: string;
  groupId: string;
  status: PresenceStatus;
  customStatus?: string;
  lastSeenAt: string;
  deviceType?: DeviceType;
}

// ============================================================================
// CHAT PREFERENCES
// ============================================================================

export interface ChatPreferences {
  groupId: string;
  userId: number;
  mutedUntil?: string | null;
  notificationLevel: NotificationLevel;
  pinned: boolean;
  archived: boolean;
  lastReadMessageId?: string | null;
  lastReadAt?: string | null;
  unreadCount: number;
  showPreviews: boolean;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface SendMessageRequest {
  content: string;
  contentType?: MessageContentType;
  parentMessageId?: string;
  clientMessageId?: string;
  metadata?: Partial<MessageMetadata>;
}

export interface EditMessageRequest {
  content: string;
}

export interface GetMessagesRequest {
  limit?: number;
  before?: string;
  after?: string;
  threadRootId?: string;
  includeReactions?: boolean;
  includeReadBy?: boolean;
}

export interface GetMessagesResponse {
  messages: ChatMessage[];
  hasMore: boolean;
  nextCursor?: string | null;
}

export interface SearchMessagesRequest {
  q: string;
  limit?: number;
  offset?: number;
}

export interface SearchMessagesResponse {
  messages: ChatMessage[];
  query: string;
  count: number;
}

export interface AddReactionRequest {
  emoji: string;
}

export interface MarkReadRequest {
  messageId: string;
}

export interface UpdatePresenceRequest {
  status: PresenceStatus;
  deviceType?: DeviceType;
}

export interface SetTypingRequest {
  isTyping: boolean;
}

export interface PinMessageRequest {
  note?: string;
}

export interface ChatApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  validationErrors?: Array<{
    field: string;
    message: string;
  }>;
  details?: {
    retryAfter?: number;
    limit?: number;
    remaining?: number;
    resetAt?: string;
  };
  timestamp: string;
}

// ============================================================================
// WEBSOCKET MESSAGE TYPES
// ============================================================================

export type ChatWSMessageType =
  // Client -> Server
  | 'chat:join_group'
  | 'chat:leave_group'
  | 'chat:send_message'
  | 'chat:edit_message'
  | 'chat:delete_message'
  | 'chat:typing_start'
  | 'chat:typing_stop'
  | 'chat:presence_update'
  | 'chat:mark_read'
  | 'chat:add_reaction'
  | 'chat:remove_reaction'
  | 'ping'
  // Server -> Client
  | 'chat:message'
  | 'chat:message_edited'
  | 'chat:message_deleted'
  | 'chat:typing'
  | 'chat:presence'
  | 'chat:reactions_updated'
  | 'chat:message_read'
  | 'chat:mention'
  | 'chat:group_joined'
  | 'chat:group_left'
  | 'chat:ack'
  | 'chat:error'
  | 'pong'
  // Dina AI events
  | 'dina:processing_start'
  | 'dina:stream_start'
  | 'dina:stream_chunk'
  | 'dina:stream_complete';

export interface ChatWSMessage<T = unknown> {
  type: ChatWSMessageType;
  payload: T;
  requestId?: string;
  timestamp?: string;
}

// WebSocket Event Payloads
export interface WSJoinGroupPayload {
  groupId: string;
}

export interface WSGroupJoinedPayload {
  groupId: string;
  subscriberCount: number;
}

export interface WSSendMessagePayload {
  groupId: string;
  content: string;
  contentType?: MessageContentType;
  parentMessageId?: string;
  clientMessageId?: string;
  metadata?: Partial<MessageMetadata>;
}

export interface WSMessageAckPayload {
  success: boolean;
  messageId?: string;
  clientMessageId?: string;
}

export interface WSNewMessagePayload {
  id: string;
  groupId: string;
  senderUserId: number;
  senderUsername: string;
  content?: string; // Present when broadcast includes full message (e.g. Dina responses)
  contentType: MessageContentType;
  parentMessageId: string | null;
  threadRootId: string | null;
  metadata: MessageMetadata;
  status: MessageStatus;
  clientMessageId: string | null;
  createdAt: string;
  encryptedContent: boolean;
}

export interface WSMessageEditedPayload {
  messageId: string;
  groupId: string;
  editedAt: string;
}

export interface WSMessageDeletedPayload {
  messageId: string;
  groupId: string;
  deletedBy: number;
}

export interface WSTypingPayload {
  groupId: string;
  userId: number;
  username: string;
  isTyping: boolean;
}

export interface WSPresencePayload {
  groupId: string;
  userId: number;
  username: string;
  status: PresenceStatus;
  lastSeenAt: string;
}

export interface WSReactionsUpdatedPayload {
  messageId: string;
  groupId: string;
  reactions: ReactionSummary[];
}

export interface WSMessageReadPayload {
  messageIds: string[];
  groupId: string;
  userId: number;
  readAt: string;
}

export interface WSMentionPayload {
  message: ChatMessage;
  groupId: string;
  mentionType: 'user' | 'everyone';
}

export interface WSErrorPayload {
  error: string;
  code?: string;
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

export interface ChatState {
  // Messages
  messages: ChatMessage[];
  pinnedMessages: ChatMessage[];

  // Pagination
  hasMoreOlder: boolean;
  hasMoreNewer: boolean;
  oldestCursor: string | null;
  newestCursor: string | null;

  // Current context
  currentGroupId: string | null;

  // Typing & Presence
  typingUsers: TypingIndicator[];
  presenceMap: Map<number, UserPresence>;

  // Unread tracking
  unreadCount: number;
  lastReadMessageId: string | null;

  // Search
  searchQuery: string;
  searchResults: ChatMessage[];
  isSearching: boolean;

  // Reply/Thread
  replyingTo: ChatMessage | null;
  activeThread: string | null;
  threadMessages: ChatMessage[];

  // Pending messages (optimistic updates)
  pendingMessages: Map<string, ChatMessage>;
  failedMessages: Map<string, ChatMessage>;

  // Loading states
  isLoading: boolean;
  isLoadingOlder: boolean;
  isLoadingNewer: boolean;
  isSending: boolean;

  // Connection
  isConnected: boolean;

  // Errors
  error: string | null;

  // UI state
  showEmojiPicker: boolean;
  selectedMessageId: string | null;

  // Dina AI state
  dinaProcessing: boolean;
  dinaProcessingQuery: string | null;
  dinaStreamingMessage: { messageId: string; content: string } | null;
  dinaProcessingMessages: Set<string>;
}

export type ChatAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_LOADING_OLDER'; payload: boolean }
  | { type: 'SET_LOADING_NEWER'; payload: boolean }
  | { type: 'SET_SENDING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'SET_CURRENT_GROUP'; payload: string | null }
  | { type: 'SET_MESSAGES'; payload: { messages: ChatMessage[]; hasMore: boolean; cursor: string | null; prepend?: boolean } }
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'UPDATE_MESSAGE'; payload: { id: string; updates: Partial<ChatMessage> } }
  | { type: 'REMOVE_MESSAGE'; payload: string }
  | { type: 'SET_PINNED_MESSAGES'; payload: ChatMessage[] }
  | { type: 'ADD_PENDING_MESSAGE'; payload: ChatMessage }
  | { type: 'RESOLVE_PENDING_MESSAGE'; payload: { clientMessageId: string; message: ChatMessage } }
  | { type: 'FAIL_PENDING_MESSAGE'; payload: string }
  | { type: 'REMOVE_FAILED_MESSAGE'; payload: string }
  | { type: 'RETRY_FAILED_MESSAGE'; payload: string }
  | { type: 'SET_TYPING_USERS'; payload: TypingIndicator[] }
  | { type: 'ADD_TYPING_USER'; payload: TypingIndicator }
  | { type: 'REMOVE_TYPING_USER'; payload: number }
  | { type: 'UPDATE_PRESENCE'; payload: UserPresence }
  | { type: 'SET_PRESENCE_MAP'; payload: Map<number, UserPresence> }
  | { type: 'UPDATE_REACTIONS'; payload: { messageId: string; reactions: ReactionSummary[] } }
  | { type: 'SET_UNREAD_COUNT'; payload: number }
  | { type: 'SET_LAST_READ_MESSAGE'; payload: string }
  | { type: 'SET_REPLYING_TO'; payload: ChatMessage | null }
  | { type: 'SET_ACTIVE_THREAD'; payload: string | null }
  | { type: 'SET_THREAD_MESSAGES'; payload: ChatMessage[] }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_SEARCH_RESULTS'; payload: ChatMessage[] }
  | { type: 'SET_SEARCHING'; payload: boolean }
  | { type: 'SHOW_EMOJI_PICKER'; payload: boolean }
  | { type: 'SET_SELECTED_MESSAGE'; payload: string | null }
  | { type: 'MARK_MESSAGE_EDITED'; payload: { messageId: string; editedAt: string } }
  | { type: 'MARK_MESSAGE_DELETED'; payload: string }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'RESET_STATE' }
  | { type: 'SET_DINA_PROCESSING'; payload: { groupId: string; isProcessing: boolean; query?: string; messageId?: string } }
  | { type: 'SET_DINA_STREAMING'; payload: { messageId: string; content: string } | null }
  | { type: 'ADD_DINA_PROCESSING_MESSAGE'; payload: string }
  | { type: 'REMOVE_DINA_PROCESSING_MESSAGE'; payload: string }
  | { type: 'CLEAR_DINA_PROCESSING_MESSAGES' };

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface ChatApiError {
  error: string;
  code: string;
  status?: number;
  details?: {
    retryAfter?: number;
  };
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface MessageGroup {
  date: string;
  messages: ChatMessage[];
}

export interface MemberMention {
  id: number;
  username: string;
  displayName?: string;
}

export interface EmojiReaction {
  emoji: string;
  label: string;
}

// Dina AI system user ID (matches DINA_USER_ID_SQL in mirror-server env)
export const DINA_USER_ID = 59;
export const DINA_USERNAME = 'Dina';

// Common emoji reactions
export const QUICK_REACTIONS: EmojiReaction[] = [
  { emoji: '👍', label: 'Thumbs up' },
  { emoji: '❤️', label: 'Heart' },
  { emoji: '😂', label: 'Laughing' },
  { emoji: '😮', label: 'Surprised' },
  { emoji: '😢', label: 'Sad' },
  { emoji: '🎉', label: 'Celebration' },
];

// ============================================================================
// CONSTANTS
// ============================================================================

export const CHAT_CONFIG = {
  // Pagination
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,

  // Rate limits
  MESSAGES_PER_MINUTE: 30,
  TYPING_DEBOUNCE_MS: 300,
  TYPING_TIMEOUT_MS: 5000,

  // UI
  MAX_MESSAGE_LENGTH: 10000,
  SCROLL_THRESHOLD: 100,

  // WebSocket
  RECONNECT_DELAYS: [1000, 2000, 5000, 10000, 30000],
  HEARTBEAT_INTERVAL: 30000,
  HEARTBEAT_TIMEOUT: 10000,
} as const;
