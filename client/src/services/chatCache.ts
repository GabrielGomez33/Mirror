// src/services/chatCache.ts
// Simple cache for preloading chat messages before the Chat tab is opened

import { getToken } from '../utils/token';

interface CachedMessage {
  id: string;
  userId: number;
  username: string;
  content: string;
  createdAt: string;
}

interface CacheEntry {
  messages: CachedMessage[];
  timestamp: number;
  groupId: string;
}

// Cache TTL: 2 minutes
const CACHE_TTL_MS = 2 * 60 * 1000;

// In-memory cache
const messageCache = new Map<string, CacheEntry>();

/**
 * Check if cache entry is still valid
 */
function isCacheValid(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp < CACHE_TTL_MS;
}

/**
 * Get cached messages for a group
 */
export function getCachedMessages(groupId: string): CachedMessage[] | null {
  const entry = messageCache.get(groupId);
  if (entry && isCacheValid(entry)) {
    console.log(`[ChatCache] Cache hit for group ${groupId} (${entry.messages.length} messages)`);
    return entry.messages;
  }
  return null;
}

/**
 * Store messages in cache
 */
export function setCachedMessages(groupId: string, messages: CachedMessage[]): void {
  messageCache.set(groupId, {
    messages,
    timestamp: Date.now(),
    groupId,
  });
  console.log(`[ChatCache] Cached ${messages.length} messages for group ${groupId}`);
}

/**
 * Clear cache for a specific group
 */
export function clearGroupCache(groupId: string): void {
  messageCache.delete(groupId);
}

/**
 * Clear all cached messages
 */
export function clearAllCache(): void {
  messageCache.clear();
}

/**
 * Preload messages for a group (called when entering GroupDetailView)
 * Returns true if successfully preloaded, false otherwise
 */
export async function preloadGroupMessages(groupId: string): Promise<boolean> {
  // Check if we already have valid cached data
  const existingCache = getCachedMessages(groupId);
  if (existingCache) {
    console.log(`[ChatCache] Group ${groupId} already cached, skipping preload`);
    return true;
  }

  try {
    const token = getToken();
    if (!token) {
      console.warn('[ChatCache] No auth token available for preloading');
      return false;
    }

    console.log(`[ChatCache] Preloading messages for group ${groupId}`);
    const response = await fetch(`/mirror/api/groups/${groupId}/chat/messages`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      const messages = data.messages || [];
      setCachedMessages(groupId, messages);
      return true;
    } else {
      console.error(`[ChatCache] Failed to preload: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('[ChatCache] Error preloading messages:', error);
    return false;
  }
}

/**
 * Update cache with a new message (for optimistic updates)
 */
export function addMessageToCache(groupId: string, message: CachedMessage): void {
  const entry = messageCache.get(groupId);
  if (entry) {
    entry.messages = [...entry.messages, message];
    entry.timestamp = Date.now();
  }
}

/**
 * Remove a message from cache
 */
export function removeMessageFromCache(groupId: string, messageId: string): void {
  const entry = messageCache.get(groupId);
  if (entry) {
    entry.messages = entry.messages.filter((m) => m.id !== messageId);
  }
}
