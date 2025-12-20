// src/context/ChatContext.tsx
// MirrorGroups Chat State Management Context

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { useAuth } from './AuthContext';
import { getCachedMessages, setCachedMessages } from '../services/chatCache';
import {
  getMessages,
  getMessage,
  sendMessage as sendMessageApi,
  editMessage as editMessageApi,
  deleteMessage as deleteMessageApi,
  addReaction as addReactionApi,
  removeReaction as removeReactionApi,
  getUnreadCount,
  getPinnedMessages,
  searchMessages as searchMessagesApi,
  getGroupPresence,
  getChatErrorMessage,
  isRateLimitError,
  getRetryAfter,
} from '../services/chatApi';
import {
  connectChatWebSocket,
  disconnectChatWebSocket,
  isChatWebSocketConnected,
  joinChatGroup,
  leaveChatGroup,
  startChatTyping,
  stopChatTyping,
  updateChatPresence,
  markChatRead,
  addChatReaction,
  removeChatReaction,
  onChatConnect,
  onChatDisconnect,
  onChatEvent,
} from '../services/chatWebSocket';
import type {
  ChatMessage,
  ChatState,
  ChatAction,
  UserPresence,
  WSNewMessagePayload,
  WSMessageEditedPayload,
  WSMessageDeletedPayload,
  WSTypingPayload,
  WSPresencePayload,
  WSReactionsUpdatedPayload,
  WSMessageReadPayload,
  WSMentionPayload,
  MessageContentType,
  MessageMetadata,
  PresenceStatus,
} from '../types/chat';
import { CHAT_CONFIG } from '../types/chat';

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: ChatState = {
  messages: [],
  pinnedMessages: [],
  hasMoreOlder: true,
  hasMoreNewer: false,
  oldestCursor: null,
  newestCursor: null,
  currentGroupId: null,
  typingUsers: [],
  presenceMap: new Map(),
  unreadCount: 0,
  lastReadMessageId: null,
  searchQuery: '',
  searchResults: [],
  isSearching: false,
  replyingTo: null,
  activeThread: null,
  threadMessages: [],
  pendingMessages: new Map(),
  failedMessages: new Map(),
  isLoading: false,
  isLoadingOlder: false,
  isLoadingNewer: false,
  isSending: false,
  isConnected: false,
  error: null,
  showEmojiPicker: false,
  selectedMessageId: null,
};

// ============================================================================
// REDUCER
// ============================================================================

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_LOADING_OLDER':
      return { ...state, isLoadingOlder: action.payload };

    case 'SET_LOADING_NEWER':
      return { ...state, isLoadingNewer: action.payload };

    case 'SET_SENDING':
      return { ...state, isSending: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };

    case 'SET_CONNECTED':
      return { ...state, isConnected: action.payload };

    case 'SET_CURRENT_GROUP':
      console.log('[ChatReducer] SET_CURRENT_GROUP:', action.payload, 'current:', state.currentGroupId);
      if (action.payload === state.currentGroupId) {
        console.log('[ChatReducer] Same group, no state change');
        return state;
      }
      // Don't reset messages - let them be loaded fresh or from cache
      // This prevents the flicker when switching tabs
      console.log('[ChatReducer] Switching to new group, preserving connection state');
      return {
        ...initialState,
        currentGroupId: action.payload,
        isConnected: state.isConnected,
        // Keep the WebSocket connected
      };

    case 'SET_MESSAGES': {
      const { messages, hasMore, cursor, prepend } = action.payload;
      if (prepend) {
        // Prepending older messages
        return {
          ...state,
          messages: [...state.messages, ...messages],
          hasMoreOlder: hasMore,
          oldestCursor: cursor,
          isLoadingOlder: false,
        };
      }
      // Initial load or newer messages
      return {
        ...state,
        messages: messages,
        hasMoreOlder: hasMore,
        oldestCursor: cursor,
        newestCursor: messages.length > 0 ? messages[0].id : null,
        isLoading: false,
      };
    }

    case 'ADD_MESSAGE': {
      const message = action.payload;
      // Check for duplicates
      if (state.messages.some((m) => m.id === message.id)) {
        return state;
      }
      // Check if resolving a pending message
      if (message.clientMessageId && state.pendingMessages.has(message.clientMessageId)) {
        const newPending = new Map(state.pendingMessages);
        newPending.delete(message.clientMessageId);
        return {
          ...state,
          messages: [message, ...state.messages],
          pendingMessages: newPending,
          newestCursor: message.id,
        };
      }
      return {
        ...state,
        messages: [message, ...state.messages],
        newestCursor: message.id,
      };
    }

    case 'UPDATE_MESSAGE': {
      const { id, updates } = action.payload;
      return {
        ...state,
        messages: state.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
      };
    }

    case 'REMOVE_MESSAGE':
      return {
        ...state,
        messages: state.messages.filter((m) => m.id !== action.payload),
      };

    case 'SET_PINNED_MESSAGES':
      return { ...state, pinnedMessages: action.payload };

    case 'ADD_PENDING_MESSAGE': {
      const newPending = new Map(state.pendingMessages);
      newPending.set(action.payload.clientMessageId!, action.payload);
      return {
        ...state,
        pendingMessages: newPending,
        isSending: true,
      };
    }

    case 'RESOLVE_PENDING_MESSAGE': {
      const { clientMessageId, message } = action.payload;
      const newPending = new Map(state.pendingMessages);
      newPending.delete(clientMessageId);
      // Add resolved message if not already present
      if (!state.messages.some((m) => m.id === message.id)) {
        return {
          ...state,
          messages: [message, ...state.messages],
          pendingMessages: newPending,
          isSending: newPending.size > 0,
          newestCursor: message.id,
        };
      }
      return {
        ...state,
        pendingMessages: newPending,
        isSending: newPending.size > 0,
      };
    }

    case 'FAIL_PENDING_MESSAGE': {
      const pending = state.pendingMessages.get(action.payload);
      if (!pending) return state;
      const newPending = new Map(state.pendingMessages);
      newPending.delete(action.payload);
      const newFailed = new Map(state.failedMessages);
      newFailed.set(action.payload, { ...pending, status: 'failed' });
      return {
        ...state,
        pendingMessages: newPending,
        failedMessages: newFailed,
        isSending: newPending.size > 0,
      };
    }

    case 'REMOVE_FAILED_MESSAGE': {
      const newFailed = new Map(state.failedMessages);
      newFailed.delete(action.payload);
      return { ...state, failedMessages: newFailed };
    }

    case 'RETRY_FAILED_MESSAGE': {
      const failed = state.failedMessages.get(action.payload);
      if (!failed) return state;
      const newFailed = new Map(state.failedMessages);
      newFailed.delete(action.payload);
      const newPending = new Map(state.pendingMessages);
      newPending.set(action.payload, { ...failed, status: 'sending' });
      return {
        ...state,
        failedMessages: newFailed,
        pendingMessages: newPending,
        isSending: true,
      };
    }

    case 'SET_TYPING_USERS':
      return { ...state, typingUsers: action.payload };

    case 'ADD_TYPING_USER': {
      const existing = state.typingUsers.find((t) => t.userId === action.payload.userId);
      if (existing) {
        return {
          ...state,
          typingUsers: state.typingUsers.map((t) =>
            t.userId === action.payload.userId ? action.payload : t
          ),
        };
      }
      return {
        ...state,
        typingUsers: [...state.typingUsers, action.payload],
      };
    }

    case 'REMOVE_TYPING_USER':
      return {
        ...state,
        typingUsers: state.typingUsers.filter((t) => t.userId !== action.payload),
      };

    case 'UPDATE_PRESENCE': {
      const newPresence = new Map(state.presenceMap);
      newPresence.set(action.payload.userId, action.payload);
      return { ...state, presenceMap: newPresence };
    }

    case 'SET_PRESENCE_MAP':
      return { ...state, presenceMap: action.payload };

    case 'UPDATE_REACTIONS': {
      const { messageId, reactions } = action.payload;
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === messageId ? { ...m, reactions } : m
        ),
      };
    }

    case 'SET_UNREAD_COUNT':
      return { ...state, unreadCount: action.payload };

    case 'SET_LAST_READ_MESSAGE':
      return { ...state, lastReadMessageId: action.payload };

    case 'SET_REPLYING_TO':
      return { ...state, replyingTo: action.payload };

    case 'SET_ACTIVE_THREAD':
      return { ...state, activeThread: action.payload, threadMessages: [] };

    case 'SET_THREAD_MESSAGES':
      return { ...state, threadMessages: action.payload };

    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };

    case 'SET_SEARCH_RESULTS':
      return { ...state, searchResults: action.payload, isSearching: false };

    case 'SET_SEARCHING':
      return { ...state, isSearching: action.payload };

    case 'SHOW_EMOJI_PICKER':
      return { ...state, showEmojiPicker: action.payload };

    case 'SET_SELECTED_MESSAGE':
      return { ...state, selectedMessageId: action.payload };

    case 'MARK_MESSAGE_EDITED': {
      const { messageId, editedAt } = action.payload;
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === messageId ? { ...m, isEdited: true, editedAt } : m
        ),
      };
    }

    case 'MARK_MESSAGE_DELETED': {
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.payload
            ? { ...m, isDeleted: true, content: 'This message was deleted' }
            : m
        ),
      };
    }

    case 'CLEAR_MESSAGES':
      return {
        ...state,
        messages: [],
        hasMoreOlder: true,
        oldestCursor: null,
        newestCursor: null,
      };

    case 'RESET_STATE':
      return initialState;

    default:
      return state;
  }
}

// ============================================================================
// CONTEXT TYPE
// ============================================================================

interface ChatContextType extends ChatState {
  // Data fetching
  loadMessages: (groupId: string) => Promise<void>;
  loadOlderMessages: () => Promise<void>;
  loadNewerMessages: () => Promise<void>;
  refreshMessages: () => Promise<void>;
  loadPinnedMessages: (groupId: string) => Promise<void>;

  // Message actions
  sendMessage: (content: string, options?: {
    contentType?: MessageContentType;
    parentMessageId?: string;
    metadata?: Partial<MessageMetadata>;
  }) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  retryFailedMessage: (clientMessageId: string) => Promise<void>;
  cancelFailedMessage: (clientMessageId: string) => void;

  // Reactions
  addReaction: (messageId: string, emoji: string) => Promise<void>;
  removeReaction: (messageId: string, emoji: string) => Promise<void>;

  // Read receipts
  markAsRead: (messageId: string) => void;

  // Typing
  startTyping: () => void;
  stopTyping: () => void;

  // Presence
  updatePresence: (status: PresenceStatus) => void;

  // Reply/Thread
  setReplyingTo: (message: ChatMessage | null) => void;
  openThread: (messageId: string) => Promise<void>;
  closeThread: () => void;

  // Search
  searchMessages: (query: string) => Promise<void>;
  clearSearch: () => void;

  // Group management
  openGroupChat: (groupId: string) => Promise<void>;
  closeGroupChat: () => void;

  // WebSocket
  connectChat: () => void;
  disconnectChat: () => void;

  // UI state
  selectMessage: (messageId: string | null) => void;
  toggleEmojiPicker: (show: boolean) => void;
  clearError: () => void;

  // Computed
  currentUserId: number | null;
  onlineMembers: UserPresence[];
  sortedMessages: ChatMessage[];
  allMessages: ChatMessage[]; // Including pending
}

// ============================================================================
// CONTEXT
// ============================================================================

const ChatContext = createContext<ChatContextType | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

interface ChatProviderProps {
  children: React.ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const { isAuthenticated, user } = useAuth();
  const wsConnectedRef = useRef(false);
  const cleanupRef = useRef<Array<() => void>>([]);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markReadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to track currentGroupId without causing callback recreation
  const currentGroupIdRef = useRef<string | null>(null);

  const currentUserId = user?.id ?? null;

  // Keep ref in sync with state
  useEffect(() => {
    currentGroupIdRef.current = state.currentGroupId;
  }, [state.currentGroupId]);

  // ==================== DATA FETCHING ====================

  const loadMessages = useCallback(async (groupId: string) => {
    if (!isAuthenticated || !groupId) return;

    console.log('[ChatContext] loadMessages called for group:', groupId);
    console.time('[ChatContext] loadMessages total');

    dispatch({ type: 'SET_LOADING', payload: true });

    // First check if we have cached messages for instant display
    console.time('[ChatContext] getCachedMessages');
    const cachedMessages = getCachedMessages(groupId);
    console.timeEnd('[ChatContext] getCachedMessages');
    console.log('[ChatContext] Cached messages found:', cachedMessages?.length ?? 0);

    if (cachedMessages && cachedMessages.length > 0) {
      // Transform cached messages to ChatMessage format for immediate display
      const transformedCached = cachedMessages.map((m) => ({
        id: m.id,
        groupId,
        senderUserId: m.userId,
        senderUsername: m.username,
        content: m.content,
        contentType: 'text' as const,
        parentMessageId: null,
        threadRootId: null,
        status: 'sent' as const,
        isEdited: false,
        isDeleted: false,
        createdAt: m.createdAt,
        updatedAt: m.createdAt,
        reactions: [],
      }));

      // Immediately show cached messages while fetching fresh data
      console.log('[ChatContext] Dispatching cached messages to UI');
      dispatch({
        type: 'SET_MESSAGES',
        payload: {
          messages: transformedCached,
          hasMore: true, // Assume there might be more until we fetch
          cursor: null,
        },
      });
    }

    try {
      console.time('[ChatContext] API getMessages');
      console.log('[ChatContext] Fetching fresh messages from API...');
      const response = await getMessages(groupId, {
        limit: CHAT_CONFIG.DEFAULT_PAGE_SIZE,
        includeReactions: true,
      });
      console.timeEnd('[ChatContext] API getMessages');

      if (response.success && response.data) {
        dispatch({
          type: 'SET_MESSAGES',
          payload: {
            messages: response.data.messages,
            hasMore: response.data.hasMore,
            cursor: response.data.nextCursor || null,
          },
        });

        // Update cache with fresh data
        const cacheMessages = response.data.messages.map((m) => ({
          id: m.id,
          userId: m.senderUserId,
          username: m.senderUsername || '',
          content: m.content,
          createdAt: m.createdAt,
        }));
        setCachedMessages(groupId, cacheMessages);
      }
    } catch (error) {
      console.error('[ChatContext] API getMessages failed:', error);
      // If we showed cached data and fetch fails, keep the cached data visible
      if (!cachedMessages || cachedMessages.length === 0) {
        dispatch({ type: 'SET_ERROR', payload: getChatErrorMessage(error) });
      } else {
        console.warn('[ChatContext] Failed to refresh messages, showing cached data:', error);
      }
    }
    console.timeEnd('[ChatContext] loadMessages total');
  }, [isAuthenticated]);

  const loadOlderMessages = useCallback(async () => {
    if (!state.currentGroupId || !state.hasMoreOlder || state.isLoadingOlder) return;

    dispatch({ type: 'SET_LOADING_OLDER', payload: true });
    try {
      const response = await getMessages(state.currentGroupId, {
        limit: CHAT_CONFIG.DEFAULT_PAGE_SIZE,
        before: state.oldestCursor || undefined,
        includeReactions: true,
      });

      if (response.success && response.data) {
        dispatch({
          type: 'SET_MESSAGES',
          payload: {
            messages: response.data.messages,
            hasMore: response.data.hasMore,
            cursor: response.data.nextCursor || null,
            prepend: true,
          },
        });
      }
    } catch (error) {
      dispatch({ type: 'SET_LOADING_OLDER', payload: false });
      console.error('Failed to load older messages:', error);
    }
  }, [state.currentGroupId, state.hasMoreOlder, state.isLoadingOlder, state.oldestCursor]);

  const loadNewerMessages = useCallback(async () => {
    if (!state.currentGroupId || state.isLoadingNewer) return;

    dispatch({ type: 'SET_LOADING_NEWER', payload: true });
    try {
      const response = await getMessages(state.currentGroupId, {
        limit: CHAT_CONFIG.DEFAULT_PAGE_SIZE,
        after: state.newestCursor || undefined,
        includeReactions: true,
      });

      if (response.success && response.data && response.data.messages.length > 0) {
        response.data.messages.forEach((message) => {
          dispatch({ type: 'ADD_MESSAGE', payload: message });
        });
      }
    } catch (error) {
      console.error('Failed to load newer messages:', error);
    } finally {
      dispatch({ type: 'SET_LOADING_NEWER', payload: false });
    }
  }, [state.currentGroupId, state.isLoadingNewer, state.newestCursor]);

  const refreshMessages = useCallback(async () => {
    if (state.currentGroupId) {
      await loadMessages(state.currentGroupId);
    }
  }, [state.currentGroupId, loadMessages]);

  const loadPinnedMessages = useCallback(async (groupId: string) => {
    if (!isAuthenticated || !groupId) return;

    try {
      const response = await getPinnedMessages(groupId);
      if (response.success && response.data) {
        dispatch({ type: 'SET_PINNED_MESSAGES', payload: response.data.pinnedMessages });
      }
    } catch (error) {
      console.error('Failed to load pinned messages:', error);
    }
  }, [isAuthenticated]);

  // ==================== MESSAGE ACTIONS ====================

  const sendMessage = useCallback(async (
    content: string,
    options: {
      contentType?: MessageContentType;
      parentMessageId?: string;
      metadata?: Partial<MessageMetadata>;
    } = {}
  ) => {
    if (!state.currentGroupId || !content.trim() || !currentUserId) return;

    const clientMessageId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Create optimistic message
    const optimisticMessage: ChatMessage = {
      id: clientMessageId,
      groupId: state.currentGroupId,
      senderUserId: currentUserId,
      senderUsername: user?.username,
      content: content.trim(),
      contentType: options.contentType || 'text',
      parentMessageId: options.parentMessageId || null,
      threadRootId: null,
      metadata: options.metadata,
      status: 'sending',
      isEdited: false,
      isDeleted: false,
      clientMessageId,
      createdAt: now,
      updatedAt: now,
      reactions: [],
    };

    // Add optimistic message
    dispatch({ type: 'ADD_PENDING_MESSAGE', payload: optimisticMessage });

    // Clear reply state
    if (state.replyingTo) {
      dispatch({ type: 'SET_REPLYING_TO', payload: null });
    }

    try {
      const response = await sendMessageApi(state.currentGroupId, {
        content: content.trim(),
        contentType: options.contentType,
        parentMessageId: options.parentMessageId,
        clientMessageId,
        metadata: options.metadata,
      });

      if (response.success && response.data) {
        dispatch({
          type: 'RESOLVE_PENDING_MESSAGE',
          payload: {
            clientMessageId,
            message: response.data.message,
          },
        });
      }
    } catch (error) {
      dispatch({ type: 'FAIL_PENDING_MESSAGE', payload: clientMessageId });

      if (isRateLimitError(error)) {
        const retryAfter = getRetryAfter(error);
        dispatch({
          type: 'SET_ERROR',
          payload: `Rate limited. Please wait ${retryAfter} seconds.`,
        });
      } else {
        dispatch({ type: 'SET_ERROR', payload: getChatErrorMessage(error) });
      }
    }
  }, [state.currentGroupId, state.replyingTo, currentUserId, user?.username]);

  const editMessage = useCallback(async (messageId: string, content: string) => {
    if (!state.currentGroupId || !content.trim()) return;

    try {
      const response = await editMessageApi(state.currentGroupId, messageId, { content: content.trim() });
      if (response.success && response.data) {
        dispatch({
          type: 'UPDATE_MESSAGE',
          payload: {
            id: messageId,
            updates: {
              content: content.trim(),
              isEdited: true,
              editedAt: response.data.message.editedAt,
            },
          },
        });
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: getChatErrorMessage(error) });
    }
  }, [state.currentGroupId]);

  const deleteMessage = useCallback(async (messageId: string) => {
    if (!state.currentGroupId) return;

    try {
      const response = await deleteMessageApi(state.currentGroupId, messageId);
      if (response.success) {
        dispatch({ type: 'MARK_MESSAGE_DELETED', payload: messageId });
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: getChatErrorMessage(error) });
    }
  }, [state.currentGroupId]);

  const retryFailedMessage = useCallback(async (clientMessageId: string) => {
    const failed = state.failedMessages.get(clientMessageId);
    if (!failed || !state.currentGroupId) return;

    dispatch({ type: 'RETRY_FAILED_MESSAGE', payload: clientMessageId });

    try {
      const response = await sendMessageApi(state.currentGroupId, {
        content: failed.content,
        contentType: failed.contentType,
        parentMessageId: failed.parentMessageId || undefined,
        clientMessageId,
        metadata: failed.metadata,
      });

      if (response.success && response.data) {
        dispatch({
          type: 'RESOLVE_PENDING_MESSAGE',
          payload: {
            clientMessageId,
            message: response.data.message,
          },
        });
      }
    } catch (error) {
      dispatch({ type: 'FAIL_PENDING_MESSAGE', payload: clientMessageId });
    }
  }, [state.failedMessages, state.currentGroupId]);

  const cancelFailedMessage = useCallback((clientMessageId: string) => {
    dispatch({ type: 'REMOVE_FAILED_MESSAGE', payload: clientMessageId });
  }, []);

  // ==================== REACTIONS ====================

  const addReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!state.currentGroupId) return;

    // Optimistic update
    const message = state.messages.find((m) => m.id === messageId);
    if (message && currentUserId) {
      const reactions = [...(message.reactions || [])];
      const existing = reactions.find((r) => r.emoji === emoji);
      if (existing) {
        existing.count++;
        existing.users = [...(existing.users || []), currentUserId];
        existing.hasReacted = true;
      } else {
        reactions.push({
          emoji,
          count: 1,
          users: [currentUserId],
          hasReacted: true,
        });
      }
      dispatch({ type: 'UPDATE_REACTIONS', payload: { messageId, reactions } });
    }

    // Use REST API as primary (more reliable), WebSocket for real-time broadcast
    try {
      await addReactionApi(state.currentGroupId, messageId, emoji);
      // Also send via WebSocket for real-time notification to others
      addChatReaction(state.currentGroupId, messageId, emoji);
    } catch (error) {
      // Revert optimistic update on failure
      if (message) {
        dispatch({ type: 'UPDATE_REACTIONS', payload: { messageId, reactions: message.reactions || [] } });
      }
      console.error('Failed to add reaction:', error);
    }
  }, [state.currentGroupId, state.messages, currentUserId]);

  const removeReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!state.currentGroupId) return;

    // Store original reactions for rollback
    const message = state.messages.find((m) => m.id === messageId);
    const originalReactions = message?.reactions || [];

    // Optimistic update
    if (message && currentUserId) {
      const reactions = (message.reactions || [])
        .map((r) => {
          if (r.emoji === emoji) {
            return {
              ...r,
              count: r.count - 1,
              users: (r.users || []).filter((id) => id !== currentUserId),
              hasReacted: false,
            };
          }
          return r;
        })
        .filter((r) => r.count > 0);
      dispatch({ type: 'UPDATE_REACTIONS', payload: { messageId, reactions } });
    }

    // Use REST API as primary (more reliable), WebSocket for real-time broadcast
    try {
      await removeReactionApi(state.currentGroupId, messageId, emoji);
      // Also send via WebSocket for real-time notification to others
      removeChatReaction(state.currentGroupId, messageId, emoji);
    } catch (error) {
      // Revert optimistic update on failure
      dispatch({ type: 'UPDATE_REACTIONS', payload: { messageId, reactions: originalReactions } });
      console.error('Failed to remove reaction:', error);
    }
  }, [state.currentGroupId, state.messages, currentUserId]);

  // ==================== READ RECEIPTS ====================

  const markAsRead = useCallback((messageId: string) => {
    if (!state.currentGroupId) return;

    // Debounce to avoid excessive calls
    if (markReadDebounceRef.current) {
      clearTimeout(markReadDebounceRef.current);
    }

    markReadDebounceRef.current = setTimeout(() => {
      markChatRead(state.currentGroupId!, messageId);
      dispatch({ type: 'SET_LAST_READ_MESSAGE', payload: messageId });
      dispatch({ type: 'SET_UNREAD_COUNT', payload: 0 });
    }, 1000);
  }, [state.currentGroupId]);

  // ==================== TYPING ====================

  const startTyping = useCallback(() => {
    if (!state.currentGroupId) return;

    startChatTyping(state.currentGroupId);

    // Auto-stop after timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, CHAT_CONFIG.TYPING_TIMEOUT_MS);
  }, [state.currentGroupId]);

  const stopTyping = useCallback(() => {
    if (!state.currentGroupId) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    stopChatTyping(state.currentGroupId);
  }, [state.currentGroupId]);

  // ==================== PRESENCE ====================

  const updatePresence = useCallback((status: PresenceStatus) => {
    if (!state.currentGroupId) return;
    updateChatPresence(state.currentGroupId, status, 'web');
  }, [state.currentGroupId]);

  // ==================== REPLY/THREAD ====================

  const setReplyingTo = useCallback((message: ChatMessage | null) => {
    dispatch({ type: 'SET_REPLYING_TO', payload: message });
  }, []);

  const openThread = useCallback(async (messageId: string) => {
    if (!state.currentGroupId) return;

    dispatch({ type: 'SET_ACTIVE_THREAD', payload: messageId });

    try {
      const response = await getMessages(state.currentGroupId, {
        threadRootId: messageId,
        limit: 50,
        includeReactions: true,
      });

      if (response.success && response.data) {
        dispatch({ type: 'SET_THREAD_MESSAGES', payload: response.data.messages });
      }
    } catch (error) {
      console.error('Failed to load thread messages:', error);
    }
  }, [state.currentGroupId]);

  const closeThread = useCallback(() => {
    dispatch({ type: 'SET_ACTIVE_THREAD', payload: null });
  }, []);

  // ==================== SEARCH ====================

  const searchMessages = useCallback(async (query: string) => {
    if (!state.currentGroupId || query.length < 2) return;

    dispatch({ type: 'SET_SEARCH_QUERY', payload: query });
    dispatch({ type: 'SET_SEARCHING', payload: true });

    try {
      const response = await searchMessagesApi(state.currentGroupId, query);
      if (response.success && response.data) {
        dispatch({ type: 'SET_SEARCH_RESULTS', payload: response.data.messages });
      }
    } catch (error) {
      dispatch({ type: 'SET_SEARCHING', payload: false });
      console.error('Search failed:', error);
    }
  }, [state.currentGroupId]);

  const clearSearch = useCallback(() => {
    dispatch({ type: 'SET_SEARCH_QUERY', payload: '' });
    dispatch({ type: 'SET_SEARCH_RESULTS', payload: [] });
  }, []);

  // ==================== GROUP MANAGEMENT ====================

  const openGroupChat = useCallback(async (groupId: string) => {
    console.log('[ChatContext] openGroupChat called:', groupId);
    console.log('[ChatContext] currentGroupIdRef:', currentGroupIdRef.current);
    console.time('[ChatContext] openGroupChat total');

    // Use ref to check current group to avoid infinite loops
    if (currentGroupIdRef.current === groupId) {
      console.log('[ChatContext] Already in this group, skipping reload');
      console.timeEnd('[ChatContext] openGroupChat total');
      return;
    }

    dispatch({ type: 'SET_CURRENT_GROUP', payload: groupId });

    // Join WebSocket room (don't await - let it happen in background)
    if (wsConnectedRef.current) {
      console.log('[ChatContext] Joining WebSocket room...');
      joinChatGroup(groupId).catch((error) => {
        console.error('[ChatContext] Failed to join chat group:', error);
      });
    }

    // Load initial data - messages are critical, others can be parallel
    console.time('[ChatContext] Load messages + pinned');
    await Promise.all([
      loadMessages(groupId),
      loadPinnedMessages(groupId),
    ]);
    console.timeEnd('[ChatContext] Load messages + pinned');

    // Load presence and unread in background (non-blocking)
    getGroupPresence(groupId).then((response) => {
      if (response.success && response.data) {
        const presenceMap = new Map<number, UserPresence>();
        response.data.presence.forEach((p) => presenceMap.set(p.userId, p));
        dispatch({ type: 'SET_PRESENCE_MAP', payload: presenceMap });
      }
    }).catch((error) => {
      console.error('[ChatContext] Failed to load presence:', error);
    });

    getUnreadCount(groupId).then((response) => {
      if (response.success && response.data) {
        dispatch({ type: 'SET_UNREAD_COUNT', payload: response.data.unreadCount });
      }
    }).catch((error) => {
      console.error('[ChatContext] Failed to load unread count:', error);
    });

    // Update presence to online
    updateChatPresence(groupId, 'online', 'web');
    console.timeEnd('[ChatContext] openGroupChat total');
  }, [loadMessages, loadPinnedMessages]); // Removed state.currentGroupId - using ref instead

  const closeGroupChat = useCallback(() => {
    // Use ref to get current group to avoid infinite loops
    const groupId = currentGroupIdRef.current;
    if (groupId) {
      // Update presence to offline
      updateChatPresence(groupId, 'offline', 'web');

      // Leave WebSocket room
      leaveChatGroup(groupId);
    }

    dispatch({ type: 'SET_CURRENT_GROUP', payload: null });
  }, []); // Removed state.currentGroupId - using ref instead

  // ==================== WEBSOCKET ====================

  const connectChat = useCallback(() => {
    if (!isAuthenticated || wsConnectedRef.current) return;

    connectChatWebSocket();
    wsConnectedRef.current = true;
  }, [isAuthenticated]);

  const disconnectChat = useCallback(() => {
    if (!wsConnectedRef.current) return;

    disconnectChatWebSocket();
    wsConnectedRef.current = false;
    dispatch({ type: 'SET_CONNECTED', payload: false });
  }, []);

  // ==================== UI STATE ====================

  const selectMessage = useCallback((messageId: string | null) => {
    dispatch({ type: 'SET_SELECTED_MESSAGE', payload: messageId });
  }, []);

  const toggleEmojiPicker = useCallback((show: boolean) => {
    dispatch({ type: 'SHOW_EMOJI_PICKER', payload: show });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null });
  }, []);

  // ==================== COMPUTED VALUES ====================

  const onlineMembers = useMemo(() => {
    return Array.from(state.presenceMap.values()).filter(
      (p) => p.status === 'online' || p.status === 'away'
    );
  }, [state.presenceMap]);

  const sortedMessages = useMemo(() => {
    return [...state.messages].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [state.messages]);

  const allMessages = useMemo(() => {
    const pending = Array.from(state.pendingMessages.values());
    const failed = Array.from(state.failedMessages.values());
    return [...pending, ...failed, ...sortedMessages];
  }, [sortedMessages, state.pendingMessages, state.failedMessages]);

  // ==================== EFFECTS ====================

  // Setup WebSocket event handlers
  useEffect(() => {
    if (!isAuthenticated) return;

    // Connection handlers
    const unsubConnect = onChatConnect(async () => {
      dispatch({ type: 'SET_CONNECTED', payload: true });

      // Rejoin current group and reload messages if any
      const groupId = currentGroupIdRef.current;
      if (groupId) {
        joinChatGroup(groupId);
        // Reload messages after reconnection to ensure we have latest
        try {
          const response = await getMessages(groupId, {
            limit: CHAT_CONFIG.DEFAULT_PAGE_SIZE,
            includeReactions: true,
          });
          if (response.success && response.data) {
            dispatch({
              type: 'SET_MESSAGES',
              payload: {
                messages: response.data.messages,
                hasMore: response.data.hasMore,
                cursor: response.data.nextCursor || null,
              },
            });
          }
        } catch (error) {
          console.error('Failed to reload messages after reconnection:', error);
        }
      }
    });
    cleanupRef.current.push(unsubConnect);

    const unsubDisconnect = onChatDisconnect(() => {
      dispatch({ type: 'SET_CONNECTED', payload: false });
    });
    cleanupRef.current.push(unsubDisconnect);

    // Message events
    const unsubMessage = onChatEvent('chat:message', async (data: unknown) => {
      const payload = data as WSNewMessagePayload;

      // Only process messages for current group
      if (payload.groupId !== state.currentGroupId) return;

      // Skip if we already have this message or it's our own pending message
      if (state.messages.some((m) => m.id === payload.id)) return;
      if (payload.clientMessageId && state.pendingMessages.has(payload.clientMessageId)) return;

      // Fetch full message content
      try {
        const response = await getMessage(payload.groupId, payload.id);
        if (response.success && response.data) {
          dispatch({ type: 'ADD_MESSAGE', payload: response.data.message });
        }
      } catch (error) {
        console.error('Failed to fetch message:', error);
      }
    });
    cleanupRef.current.push(unsubMessage);

    const unsubEdited = onChatEvent('chat:message_edited', async (data: unknown) => {
      const payload = data as WSMessageEditedPayload;
      if (payload.groupId !== state.currentGroupId) return;

      // Fetch updated message
      try {
        const response = await getMessage(payload.groupId, payload.messageId);
        if (response.success && response.data) {
          dispatch({
            type: 'UPDATE_MESSAGE',
            payload: { id: payload.messageId, updates: response.data.message },
          });
        }
      } catch (error) {
        dispatch({
          type: 'MARK_MESSAGE_EDITED',
          payload: { messageId: payload.messageId, editedAt: payload.editedAt },
        });
      }
    });
    cleanupRef.current.push(unsubEdited);

    const unsubDeleted = onChatEvent('chat:message_deleted', (data: unknown) => {
      const payload = data as WSMessageDeletedPayload;
      if (payload.groupId !== state.currentGroupId) return;
      dispatch({ type: 'MARK_MESSAGE_DELETED', payload: payload.messageId });
    });
    cleanupRef.current.push(unsubDeleted);

    // Typing events
    const unsubTyping = onChatEvent('chat:typing', (data: unknown) => {
      const payload = data as WSTypingPayload;
      if (payload.groupId !== state.currentGroupId) return;
      if (payload.userId === currentUserId) return; // Ignore own typing

      if (payload.isTyping) {
        dispatch({
          type: 'ADD_TYPING_USER',
          payload: {
            userId: payload.userId,
            username: payload.username,
            groupId: payload.groupId,
            isTyping: true,
            startedAt: new Date().toISOString(),
          },
        });
      } else {
        dispatch({ type: 'REMOVE_TYPING_USER', payload: payload.userId });
      }
    });
    cleanupRef.current.push(unsubTyping);

    // Presence events
    const unsubPresence = onChatEvent('chat:presence', (data: unknown) => {
      const payload = data as WSPresencePayload;
      if (payload.groupId !== state.currentGroupId) return;

      dispatch({
        type: 'UPDATE_PRESENCE',
        payload: {
          userId: payload.userId,
          username: payload.username,
          groupId: payload.groupId,
          status: payload.status,
          lastSeenAt: payload.lastSeenAt,
        },
      });
    });
    cleanupRef.current.push(unsubPresence);

    // Reaction events
    const unsubReactions = onChatEvent('chat:reactions_updated', (data: unknown) => {
      const payload = data as WSReactionsUpdatedPayload;
      if (payload.groupId !== state.currentGroupId) return;

      dispatch({
        type: 'UPDATE_REACTIONS',
        payload: { messageId: payload.messageId, reactions: payload.reactions },
      });
    });
    cleanupRef.current.push(unsubReactions);

    // Read receipt events
    const unsubRead = onChatEvent('chat:message_read', (data: unknown) => {
      const payload = data as WSMessageReadPayload;
      if (payload.groupId !== state.currentGroupId) return;

      payload.messageIds.forEach((messageId) => {
        const message = state.messages.find((m) => m.id === messageId);
        if (message) {
          const readBy = [...(message.readBy || [])];
          if (!readBy.includes(payload.userId)) {
            readBy.push(payload.userId);
            dispatch({
              type: 'UPDATE_MESSAGE',
              payload: { id: messageId, updates: { readBy } },
            });
          }
        }
      });
    });
    cleanupRef.current.push(unsubRead);

    // Mention events
    const unsubMention = onChatEvent('chat:mention', (data: unknown) => {
      const payload = data as WSMentionPayload;
      // Could show a notification here
      console.log('Mentioned in message:', payload);
    });
    cleanupRef.current.push(unsubMention);

    // Cleanup
    return () => {
      cleanupRef.current.forEach((cleanup) => cleanup());
      cleanupRef.current = [];
    };
  }, [isAuthenticated, state.currentGroupId, state.messages, state.pendingMessages, currentUserId]);

  // Auto-connect WebSocket
  useEffect(() => {
    if (isAuthenticated && !isChatWebSocketConnected()) {
      connectChat();
    }

    return () => {
      if (wsConnectedRef.current) {
        disconnectChat();
      }
    };
  }, [isAuthenticated, connectChat, disconnectChat]);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (markReadDebounceRef.current) {
        clearTimeout(markReadDebounceRef.current);
      }
    };
  }, []);

  // ==================== CONTEXT VALUE ====================

  const contextValue: ChatContextType = {
    ...state,
    loadMessages,
    loadOlderMessages,
    loadNewerMessages,
    refreshMessages,
    loadPinnedMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    retryFailedMessage,
    cancelFailedMessage,
    addReaction,
    removeReaction,
    markAsRead,
    startTyping,
    stopTyping,
    updatePresence,
    setReplyingTo,
    openThread,
    closeThread,
    searchMessages,
    clearSearch,
    openGroupChat,
    closeGroupChat,
    connectChat,
    disconnectChat,
    selectMessage,
    toggleEmojiPicker,
    clearError,
    currentUserId,
    onlineMembers,
    sortedMessages,
    allMessages,
  };

  return <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>;
};

// ============================================================================
// HOOK
// ============================================================================

export const useChat = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

export default ChatContext;
