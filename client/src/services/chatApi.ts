// src/services/chatApi.ts
// MirrorGroups Chat API Service - REST API communication for chat features

import { getToken } from '../utils/token';
import type {
  ChatMessage,
  ChatApiResponse,
  SendMessageRequest,
  EditMessageRequest,
  GetMessagesResponse,
  SearchMessagesResponse,
  ReactionSummary,
  UserPresence,
  TypingIndicator,
  ChatPreferences,
  PresenceStatus,
  DeviceType,
} from '../types/chat';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/mirror/api`
  : '/mirror/api';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_MESSAGES_PER_WINDOW = 30;
const MAX_GENERAL_REQUESTS_PER_WINDOW = 100;

// ============================================================================
// RATE LIMITING
// ============================================================================

class RateLimiter {
  private timestamps: number[] = [];
  private limit: number;

  constructor(limit: number = MAX_GENERAL_REQUESTS_PER_WINDOW) {
    this.limit = limit;
  }

  canMakeRequest(): boolean {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);

    if (this.timestamps.length >= this.limit) {
      return false;
    }

    this.timestamps.push(now);
    return true;
  }

  getWaitTime(): number {
    if (this.timestamps.length < this.limit) return 0;
    const oldestTimestamp = this.timestamps[0];
    return RATE_LIMIT_WINDOW - (Date.now() - oldestTimestamp);
  }

  reset(): void {
    this.timestamps = [];
  }
}

const generalRateLimiter = new RateLimiter(MAX_GENERAL_REQUESTS_PER_WINDOW);
const messageRateLimiter = new RateLimiter(MAX_MESSAGES_PER_WINDOW);

// ============================================================================
// CACHING
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresIn: number;
}

class SimpleCache {
  private cache = new Map<string, CacheEntry<unknown>>();

  set<T>(key: string, data: T, expiresIn: number = 30000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresIn,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > entry.expiresIn) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  invalidateGroup(groupId: string): void {
    this.invalidate(`chat:${groupId}`);
  }
}

const cache = new SimpleCache();

// ============================================================================
// INPUT SANITIZATION
// ============================================================================

function sanitizeString(input: string, maxLength: number = 10000): string {
  if (!input) return '';

  let sanitized = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');

  return sanitized.slice(0, maxLength).trim();
}

// ============================================================================
// FETCH WITH RETRY
// ============================================================================

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries: number = MAX_RETRIES
): Promise<Response> {
  try {
    const response = await fetch(url, options);

    // Don't retry on 4xx errors (except 429)
    if (response.status >= 400 && response.status < 500 && response.status !== 429) {
      return response;
    }

    // Handle rate limit with backoff
    if (response.status === 429 && retries > 0) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
      await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfter * 1000, 60000)));
      return fetchWithRetry(url, options, retries - 1);
    }

    // Retry on 5xx errors
    if (!response.ok && retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * (MAX_RETRIES - retries + 1)));
      return fetchWithRetry(url, options, retries - 1);
    }

    return response;
  } catch (error) {
    if (retries > 0) {
      console.warn(`[ChatAPI] Fetch failed, retrying... (${retries} attempts left)`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * (MAX_RETRIES - retries + 1)));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}

// ============================================================================
// CHAT API CLIENT CLASS
// ============================================================================

class ChatApiClient {
  private getBaseUrl(groupId: string): string {
    return `${API_BASE}/groups/${groupId}/chat`;
  }

  // ==================== PRIVATE HELPERS ====================

  private async makeRequest<T>(
    groupId: string,
    endpoint: string,
    options: RequestInit = {},
    rateLimiter: RateLimiter = generalRateLimiter,
    useCache: boolean = false,
    cacheTTL: number = 30000
  ): Promise<T> {
    const token = getToken();
    if (!token) {
      throw {
        error: 'No authentication token',
        code: 'UNAUTHORIZED',
        status: 401,
      };
    }

    if (!rateLimiter.canMakeRequest()) {
      const waitTime = rateLimiter.getWaitTime();
      throw {
        error: `Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`,
        code: 'RATE_LIMIT_EXCEEDED',
        status: 429,
        details: { retryAfter: Math.ceil(waitTime / 1000) },
      };
    }

    // Check cache for GET requests
    const cacheKey = `chat:${groupId}:${endpoint}`;
    if (useCache && (!options.method || options.method === 'GET')) {
      const cached = cache.get<T>(cacheKey);
      if (cached) {
        console.log(`[ChatAPI] Cache hit: ${endpoint}`);
        return cached;
      }
    }

    const url = `${this.getBaseUrl(groupId)}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string>),
    };

    const config: RequestInit = {
      ...options,
      headers,
      credentials: 'include',
    };

    try {
      const response = await fetchWithRetry(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw {
          error: data.error || 'Request failed',
          code: data.code || 'UNKNOWN_ERROR',
          status: response.status,
          details: data.details,
        };
      }

      // Cache successful GET responses
      if (useCache && (!options.method || options.method === 'GET')) {
        cache.set(cacheKey, data, cacheTTL);
      }

      return data;
    } catch (error) {
      console.error(`[ChatAPI] Error on ${endpoint}:`, error);
      throw error;
    }
  }

  // ==================== MESSAGES ====================

  async sendMessage(
    groupId: string,
    request: SendMessageRequest
  ): Promise<ChatApiResponse<{ message: ChatMessage }>> {
    const sanitizedRequest = {
      content: sanitizeString(request.content, 10000),
      contentType: request.contentType || 'text',
      parentMessageId: request.parentMessageId,
      clientMessageId: request.clientMessageId || crypto.randomUUID(),
      metadata: request.metadata,
    };

    if (!sanitizedRequest.content) {
      throw {
        error: 'Message content is required',
        code: 'VALIDATION_ERROR',
        status: 400,
      };
    }

    const result = await this.makeRequest<ChatApiResponse<{ message: ChatMessage }>>(
      groupId,
      '/messages',
      {
        method: 'POST',
        body: JSON.stringify(sanitizedRequest),
      },
      messageRateLimiter
    );

    // Invalidate messages cache
    cache.invalidateGroup(groupId);

    return result;
  }

  async getMessages(
    groupId: string,
    options: {
      limit?: number;
      before?: string;
      after?: string;
      threadRootId?: string;
      includeReactions?: boolean;
      includeReadBy?: boolean;
    } = {}
  ): Promise<ChatApiResponse<GetMessagesResponse>> {
    const params = new URLSearchParams();
    if (options.limit) params.append('limit', String(Math.min(options.limit, 100)));
    if (options.before) params.append('before', options.before);
    if (options.after) params.append('after', options.after);
    if (options.threadRootId) params.append('threadRootId', options.threadRootId);
    if (options.includeReactions) params.append('includeReactions', 'true');
    if (options.includeReadBy) params.append('includeReadBy', 'true');

    const endpoint = `/messages${params.toString() ? `?${params.toString()}` : ''}`;

    return this.makeRequest<ChatApiResponse<GetMessagesResponse>>(
      groupId,
      endpoint,
      { method: 'GET' },
      generalRateLimiter,
      true,
      15000 // 15 second cache
    );
  }

  async getMessage(
    groupId: string,
    messageId: string
  ): Promise<ChatApiResponse<{ message: ChatMessage }>> {
    return this.makeRequest<ChatApiResponse<{ message: ChatMessage }>>(
      groupId,
      `/messages/${messageId}`,
      { method: 'GET' }
    );
  }

  async editMessage(
    groupId: string,
    messageId: string,
    request: EditMessageRequest
  ): Promise<ChatApiResponse<{ message: ChatMessage }>> {
    const sanitizedContent = sanitizeString(request.content, 10000);

    if (!sanitizedContent) {
      throw {
        error: 'Message content is required',
        code: 'VALIDATION_ERROR',
        status: 400,
      };
    }

    const result = await this.makeRequest<ChatApiResponse<{ message: ChatMessage }>>(
      groupId,
      `/messages/${messageId}`,
      {
        method: 'PUT',
        body: JSON.stringify({ content: sanitizedContent }),
      }
    );

    cache.invalidateGroup(groupId);
    return result;
  }

  async deleteMessage(
    groupId: string,
    messageId: string
  ): Promise<ChatApiResponse<{ deleted: boolean; messageId: string }>> {
    const result = await this.makeRequest<ChatApiResponse<{ deleted: boolean; messageId: string }>>(
      groupId,
      `/messages/${messageId}`,
      { method: 'DELETE' }
    );

    cache.invalidateGroup(groupId);
    return result;
  }

  // ==================== REACTIONS ====================

  async addReaction(
    groupId: string,
    messageId: string,
    emoji: string
  ): Promise<ChatApiResponse<{ reactions: ReactionSummary[] }>> {
    return this.makeRequest<ChatApiResponse<{ reactions: ReactionSummary[] }>>(
      groupId,
      `/messages/${messageId}/reactions`,
      {
        method: 'POST',
        body: JSON.stringify({ emoji }),
      }
    );
  }

  async removeReaction(
    groupId: string,
    messageId: string,
    emoji: string
  ): Promise<ChatApiResponse<{ reactions: ReactionSummary[] }>> {
    const encodedEmoji = encodeURIComponent(emoji);
    return this.makeRequest<ChatApiResponse<{ reactions: ReactionSummary[] }>>(
      groupId,
      `/messages/${messageId}/reactions/${encodedEmoji}`,
      { method: 'DELETE' }
    );
  }

  async getReactions(
    groupId: string,
    messageId: string
  ): Promise<ChatApiResponse<{ reactions: ReactionSummary[] }>> {
    return this.makeRequest<ChatApiResponse<{ reactions: ReactionSummary[] }>>(
      groupId,
      `/messages/${messageId}/reactions`,
      { method: 'GET' }
    );
  }

  // ==================== READ RECEIPTS ====================

  async markAsRead(
    groupId: string,
    messageId: string
  ): Promise<ChatApiResponse<{ marked: boolean; upToMessageId: string }>> {
    return this.makeRequest<ChatApiResponse<{ marked: boolean; upToMessageId: string }>>(
      groupId,
      '/read',
      {
        method: 'POST',
        body: JSON.stringify({ messageId }),
      }
    );
  }

  async getUnreadCount(groupId: string): Promise<ChatApiResponse<{ groupId: string; unreadCount: number }>> {
    return this.makeRequest<ChatApiResponse<{ groupId: string; unreadCount: number }>>(
      groupId,
      '/unread',
      { method: 'GET' },
      generalRateLimiter,
      true,
      10000
    );
  }

  // ==================== TYPING INDICATORS ====================

  async setTyping(groupId: string, isTyping: boolean): Promise<ChatApiResponse<{ groupId: string; isTyping: boolean }>> {
    return this.makeRequest<ChatApiResponse<{ groupId: string; isTyping: boolean }>>(
      groupId,
      '/typing',
      {
        method: 'POST',
        body: JSON.stringify({ isTyping }),
      }
    );
  }

  async getTypingUsers(groupId: string): Promise<ChatApiResponse<{ typingUsers: TypingIndicator[] }>> {
    return this.makeRequest<ChatApiResponse<{ typingUsers: TypingIndicator[] }>>(
      groupId,
      '/typing',
      { method: 'GET' }
    );
  }

  // ==================== PRESENCE ====================

  async updatePresence(
    groupId: string,
    status: PresenceStatus,
    deviceType?: DeviceType
  ): Promise<ChatApiResponse<{ groupId: string; status: PresenceStatus; deviceType?: DeviceType }>> {
    return this.makeRequest<ChatApiResponse<{ groupId: string; status: PresenceStatus; deviceType?: DeviceType }>>(
      groupId,
      '/presence',
      {
        method: 'POST',
        body: JSON.stringify({ status, deviceType }),
      }
    );
  }

  async getGroupPresence(groupId: string): Promise<ChatApiResponse<{ presence: UserPresence[] }>> {
    return this.makeRequest<ChatApiResponse<{ presence: UserPresence[] }>>(
      groupId,
      '/presence',
      { method: 'GET' },
      generalRateLimiter,
      true,
      10000
    );
  }

  // ==================== PINNED MESSAGES ====================

  async pinMessage(
    groupId: string,
    messageId: string,
    note?: string
  ): Promise<ChatApiResponse<{ pinned: boolean; messageId: string }>> {
    return this.makeRequest<ChatApiResponse<{ pinned: boolean; messageId: string }>>(
      groupId,
      `/messages/${messageId}/pin`,
      {
        method: 'POST',
        body: JSON.stringify({ note }),
      }
    );
  }

  async unpinMessage(
    groupId: string,
    messageId: string
  ): Promise<ChatApiResponse<{ unpinned: boolean; messageId: string }>> {
    return this.makeRequest<ChatApiResponse<{ unpinned: boolean; messageId: string }>>(
      groupId,
      `/messages/${messageId}/pin`,
      { method: 'DELETE' }
    );
  }

  async getPinnedMessages(groupId: string): Promise<ChatApiResponse<{ pinnedMessages: ChatMessage[]; count: number }>> {
    return this.makeRequest<ChatApiResponse<{ pinnedMessages: ChatMessage[]; count: number }>>(
      groupId,
      '/pinned',
      { method: 'GET' },
      generalRateLimiter,
      true,
      30000
    );
  }

  // ==================== SEARCH ====================

  async searchMessages(
    groupId: string,
    query: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<ChatApiResponse<SearchMessagesResponse>> {
    if (query.length < 2) {
      throw {
        error: 'Search query must be at least 2 characters',
        code: 'VALIDATION_ERROR',
        status: 400,
      };
    }

    const params = new URLSearchParams({
      q: sanitizeString(query, 200),
      limit: String(Math.min(limit, 50)),
      offset: String(offset),
    });

    return this.makeRequest<ChatApiResponse<SearchMessagesResponse>>(
      groupId,
      `/search?${params.toString()}`,
      { method: 'GET' }
    );
  }

  // ==================== PREFERENCES ====================

  async getPreferences(groupId: string): Promise<ChatApiResponse<{ preferences: ChatPreferences }>> {
    return this.makeRequest<ChatApiResponse<{ preferences: ChatPreferences }>>(
      groupId,
      '/preferences',
      { method: 'GET' },
      generalRateLimiter,
      true,
      60000
    );
  }

  async updatePreferences(
    groupId: string,
    updates: Partial<ChatPreferences>
  ): Promise<ChatApiResponse<{ preferences: ChatPreferences }>> {
    const result = await this.makeRequest<ChatApiResponse<{ preferences: ChatPreferences }>>(
      groupId,
      '/preferences',
      {
        method: 'PUT',
        body: JSON.stringify(updates),
      }
    );

    cache.invalidate(`chat:${groupId}:preferences`);
    return result;
  }

  // ==================== UTILITY ====================

  clearCache(groupId?: string): void {
    if (groupId) {
      cache.invalidateGroup(groupId);
    } else {
      cache.invalidate();
    }
  }

  resetRateLimiters(): void {
    generalRateLimiter.reset();
    messageRateLimiter.reset();
  }
}

// ============================================================================
// SINGLETON INSTANCE & EXPORTS
// ============================================================================

const chatApi = new ChatApiClient();

// Messages
export const sendMessage = (groupId: string, request: SendMessageRequest) =>
  chatApi.sendMessage(groupId, request);
export const getMessages = (
  groupId: string,
  options?: {
    limit?: number;
    before?: string;
    after?: string;
    threadRootId?: string;
    includeReactions?: boolean;
    includeReadBy?: boolean;
  }
) => chatApi.getMessages(groupId, options);
export const getMessage = (groupId: string, messageId: string) =>
  chatApi.getMessage(groupId, messageId);
export const editMessage = (groupId: string, messageId: string, request: EditMessageRequest) =>
  chatApi.editMessage(groupId, messageId, request);
export const deleteMessage = (groupId: string, messageId: string) =>
  chatApi.deleteMessage(groupId, messageId);

// Reactions
export const addReaction = (groupId: string, messageId: string, emoji: string) =>
  chatApi.addReaction(groupId, messageId, emoji);
export const removeReaction = (groupId: string, messageId: string, emoji: string) =>
  chatApi.removeReaction(groupId, messageId, emoji);
export const getReactions = (groupId: string, messageId: string) =>
  chatApi.getReactions(groupId, messageId);

// Read Receipts
export const markAsRead = (groupId: string, messageId: string) =>
  chatApi.markAsRead(groupId, messageId);
export const getUnreadCount = (groupId: string) => chatApi.getUnreadCount(groupId);

// Typing
export const setTyping = (groupId: string, isTyping: boolean) =>
  chatApi.setTyping(groupId, isTyping);
export const getTypingUsers = (groupId: string) => chatApi.getTypingUsers(groupId);

// Presence
export const updatePresence = (groupId: string, status: PresenceStatus, deviceType?: DeviceType) =>
  chatApi.updatePresence(groupId, status, deviceType);
export const getGroupPresence = (groupId: string) => chatApi.getGroupPresence(groupId);

// Pinned Messages
export const pinMessage = (groupId: string, messageId: string, note?: string) =>
  chatApi.pinMessage(groupId, messageId, note);
export const unpinMessage = (groupId: string, messageId: string) =>
  chatApi.unpinMessage(groupId, messageId);
export const getPinnedMessages = (groupId: string) => chatApi.getPinnedMessages(groupId);

// Search
export const searchMessages = (groupId: string, query: string, limit?: number, offset?: number) =>
  chatApi.searchMessages(groupId, query, limit, offset);

// Preferences
export const getChatPreferences = (groupId: string) => chatApi.getPreferences(groupId);
export const updateChatPreferences = (groupId: string, updates: Partial<ChatPreferences>) =>
  chatApi.updatePreferences(groupId, updates);

// Utility
export const clearChatCache = (groupId?: string) => chatApi.clearCache(groupId);
export const resetChatRateLimiters = () => chatApi.resetRateLimiters();

// Export instance for advanced usage
export { chatApi };

// ============================================================================
// ERROR HANDLING UTILITIES
// ============================================================================

export interface ChatApiError {
  error: string;
  code: string;
  status?: number;
  details?: {
    retryAfter?: number;
  };
}

export const isChatApiError = (error: unknown): error is ChatApiError => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    typeof (error as ChatApiError).error === 'string'
  );
};

export const getChatErrorMessage = (error: unknown): string => {
  if (isChatApiError(error)) {
    return error.error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
};

export const isRateLimitError = (error: unknown): boolean => {
  return isChatApiError(error) && error.code === 'RATE_LIMIT_EXCEEDED';
};

export const getRetryAfter = (error: unknown): number => {
  if (isChatApiError(error) && error.details?.retryAfter) {
    return error.details.retryAfter;
  }
  return 60; // Default 60 seconds
};
