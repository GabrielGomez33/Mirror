// client/src/services/journalApi.ts
// Robust Journal API with security, caching, retry logic, and rate limiting

import { getToken } from '../utils/token';
import { dispatchPaywallEvent } from './paywallInterceptor';

const API_BASE = '/mirror/api';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20;

// ============================================================================
// SECURITY: Input Sanitization
// ============================================================================

function sanitizeString(input: string, maxLength: number = 10000): string {
  if (!input) return '';
  
  // Remove any script tags and dangerous HTML
  let sanitized = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
  
  // Limit length
  return sanitized.slice(0, maxLength).trim();
}

function sanitizeArray(arr: string[], maxItems: number = 20): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .slice(0, maxItems)
    .map(item => sanitizeString(String(item), 100))
    .filter(Boolean);
}

// ============================================================================
// RATE LIMITING (Client-side)
// ============================================================================

class RateLimiter {
  private timestamps: number[] = [];
  
  canMakeRequest(): boolean {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
    
    if (this.timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
      return false;
    }
    
    this.timestamps.push(now);
    return true;
  }
  
  getWaitTime(): number {
    if (this.timestamps.length < MAX_REQUESTS_PER_WINDOW) return 0;
    const oldestTimestamp = this.timestamps[0];
    return RATE_LIMIT_WINDOW - (Date.now() - oldestTimestamp);
  }
}

const rateLimiter = new RateLimiter();

// ============================================================================
// CACHING
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresIn: number;
}

class SimpleCache {
  private cache = new Map<string, CacheEntry<any>>();
  
  set<T>(key: string, data: T, expiresIn: number = 300000): void { // 5 min default
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
    
    return entry.data;
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
}

const cache = new SimpleCache();

// ============================================================================
// RETRY LOGIC
// ============================================================================

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries: number = MAX_RETRIES
): Promise<Response> {
  try {
    const response = await fetch(url, options);
    
    // Don't retry on 4xx errors (client errors)
    if (response.status >= 400 && response.status < 500) {
      return response;
    }
    
    // Retry on 5xx errors (server errors) or network issues
    if (!response.ok && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return fetchWithRetry(url, options, retries - 1);
    }
    
    return response;
  } catch (error) {
    if (retries > 0) {
      console.warn(`Fetch failed, retrying... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface JournalEntry {
  id: string;
  entryDate: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  moodRating: number;
  primaryEmotion: string;
  emotionIntensity: number;
  energyLevel: number;
  promptResponses: {
    howAreYou?: string;
    gratefulFor?: string[];
    challenges?: string;
    wins?: string;
    intentions?: string;
    [key: string]: any;
  };
  freeFormEntry: string;
  tags: string[];
  category: string | null;
  wordCount: number;
  sentimentScore: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEntryPayload {
  entryDate: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  moodRating: number;
  primaryEmotion: string;
  emotionIntensity: number;
  energyLevel: number;
  promptResponses?: Record<string, any>;
  freeFormEntry?: string;
  tags?: string[];
  category?: string;
}

export interface MoodTrendData {
  date: string;
  avgMood: number;
  avgEnergy: number;
  avgIntensity: number;
  entryCount: number;
}

// ============================================================================
// VALIDATION
// ============================================================================

function validateCreatePayload(payload: CreateEntryPayload): string | null {
  // Date validation
  if (!payload.entryDate || !/^\d{4}-\d{2}-\d{2}$/.test(payload.entryDate)) {
    return 'Invalid date format. Use YYYY-MM-DD.';
  }
  
  // Time of day validation
  const validTimes = ['morning', 'afternoon', 'evening', 'night'];
  if (!validTimes.includes(payload.timeOfDay)) {
    return 'Invalid time of day.';
  }
  
  // Mood rating validation
  if (payload.moodRating < 1 || payload.moodRating > 10) {
    return 'Mood rating must be between 1 and 10.';
  }
  
  // Energy level validation
  if (payload.energyLevel < 1 || payload.energyLevel > 10) {
    return 'Energy level must be between 1 and 10.';
  }
  
  // Emotion intensity validation
  if (payload.emotionIntensity < 1 || payload.emotionIntensity > 10) {
    return 'Emotion intensity must be between 1 and 10.';
  }
  
  // Primary emotion validation
  if (!payload.primaryEmotion || payload.primaryEmotion.length > 50) {
    return 'Primary emotion is required and must be under 50 characters.';
  }
  
  // Free form entry validation
  if (payload.freeFormEntry && payload.freeFormEntry.length > 10000) {
    return 'Entry text is too long (max 10,000 characters).';
  }
  
  // Tags validation
  if (payload.tags && payload.tags.length > 20) {
    return 'Too many tags (max 20).';
  }
  
  return null; // No errors
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get journal entries for a specific date (with caching)
 */
export async function getEntriesByDate(
  date: string,
  timeOfDay?: string,
  useCache: boolean = true
): Promise<JournalEntry[]> {
  try {
    const token = getToken();
    if (!token) throw new Error('No authentication token');
    
    // Check rate limit
    if (!rateLimiter.canMakeRequest()) {
      const waitTime = rateLimiter.getWaitTime();
      throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
    }
    
    // Check cache
    const cacheKey = `entries-${date}-${timeOfDay || 'all'}`;
    if (useCache) {
      const cached = cache.get<JournalEntry[]>(cacheKey);
      if (cached) {
        console.log('📦 Using cached entries for', date);
        return cached;
      }
    }
    
    const url = timeOfDay
      ? `${API_BASE}/journal/entry/date/${date}?timeOfDay=${timeOfDay}`
      : `${API_BASE}/journal/entry/date/${date}`;

    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 404) {
        // No entries found - cache empty array
        cache.set(cacheKey, [], 60000); // Cache for 1 minute
        return [];
      }
      throw new Error(`Failed to fetch entries: ${response.statusText}`);
    }

    const data = await response.json();
    const entries = data.data.entries || [];
    
    // Cache the result
    cache.set(cacheKey, entries, 300000); // Cache for 5 minutes
    
    return entries;
  } catch (error) {
    console.error('❌ Error fetching entries by date:', error);
    throw error;
  }
}

/**
 * Get all journal entries with pagination
 */
export async function getAllEntries(
  startDate?: string,
  endDate?: string,
  limit = 50,
  offset = 0
): Promise<{ entries: JournalEntry[]; count: number }> {
  try {
    const token = getToken();
    if (!token) throw new Error('No authentication token');
    
    if (!rateLimiter.canMakeRequest()) {
      const waitTime = rateLimiter.getWaitTime();
      throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
    }

    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    params.append('limit', String(limit));
    params.append('offset', String(offset));

    const response = await fetchWithRetry(
      `${API_BASE}/journal/entries?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch entries: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('❌ Error fetching all entries:', error);
    throw error;
  }
}

/**
 * Create a new journal entry (with validation and sanitization)
 */
export async function createEntry(
  payload: CreateEntryPayload
): Promise<{ entryId: string; message: string }> {
  try {
    const token = getToken();
    if (!token) throw new Error('No authentication token');
    
    // Rate limiting
    if (!rateLimiter.canMakeRequest()) {
      const waitTime = rateLimiter.getWaitTime();
      throw new Error(`Too many requests. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
    }
    
    // Validation
    const validationError = validateCreatePayload(payload);
    if (validationError) {
      throw new Error(validationError);
    }
    
    // Sanitize inputs
    const sanitizedPayload = {
      ...payload,
      primaryEmotion: sanitizeString(payload.primaryEmotion, 50),
      freeFormEntry: payload.freeFormEntry ? sanitizeString(payload.freeFormEntry, 10000) : undefined,
      tags: payload.tags ? sanitizeArray(payload.tags, 20) : undefined,
      category: payload.category ? sanitizeString(payload.category, 100) : undefined,
      promptResponses: payload.promptResponses ? {
        howAreYou: payload.promptResponses.howAreYou ? sanitizeString(payload.promptResponses.howAreYou, 500) : undefined,
        gratefulFor: payload.promptResponses.gratefulFor ? sanitizeArray(payload.promptResponses.gratefulFor, 10) : undefined,
        challenges: payload.promptResponses.challenges ? sanitizeString(payload.promptResponses.challenges, 500) : undefined,
        wins: payload.promptResponses.wins ? sanitizeString(payload.promptResponses.wins, 500) : undefined,
        intentions: payload.promptResponses.intentions ? sanitizeString(payload.promptResponses.intentions, 500) : undefined,
      } : undefined,
    };

    const response = await fetchWithRetry(`${API_BASE}/journal/entry`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(sanitizedPayload),
    }, 2); // Only 2 retries for POST

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // Intercept paywall responses — trigger upgrade modal
      if (response.status === 403 && (errorData.code === 'USAGE_LIMIT' || errorData.code === 'UPGRADE_REQUIRED')) {
        dispatchPaywallEvent({ code: errorData.code, feature: errorData.feature, error: errorData.error, used: errorData.used, limit: errorData.limit });
      }
      throw new Error(errorData.error || `Failed to create entry: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Invalidate cache for this date
    cache.invalidate(payload.entryDate);
    
    return data.data;
  } catch (error) {
    console.error('❌ Error creating journal entry:', error);
    throw error;
  }
}

/**
 * Get mood trend analytics
 */
export async function getMoodTrend(
  startDate?: string,
  endDate?: string
): Promise<MoodTrendData[]> {
  try {
    const token = getToken();
    if (!token) throw new Error('No authentication token');
    
    if (!rateLimiter.canMakeRequest()) {
      const waitTime = rateLimiter.getWaitTime();
      throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
    }

    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await fetchWithRetry(
      `${API_BASE}/journal/analytics/mood-trend?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch mood trend: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data.trend || [];
  } catch (error) {
    console.error('❌ Error fetching mood trend:', error);
    throw error;
  }
}

/**
 * Search entries by text
 */
export async function searchEntries(
  query: string,
  limit = 20
): Promise<JournalEntry[]> {
  try {
    const token = getToken();
    if (!token) throw new Error('No authentication token');
    
    if (!query.trim()) return [];
    
    // Sanitize search query
    const sanitizedQuery = sanitizeString(query, 200);
    
    // For now, fetch recent entries and filter client-side
    // TODO: Add server-side search endpoint
    const { entries } = await getAllEntries(undefined, undefined, 100, 0);
    
    const lowerQuery = sanitizedQuery.toLowerCase();
    return entries.filter(entry => 
      entry.freeFormEntry?.toLowerCase().includes(lowerQuery) ||
      entry.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      entry.primaryEmotion.toLowerCase().includes(lowerQuery)
    ).slice(0, limit);
  } catch (error) {
    console.error('❌ Error searching entries:', error);
    throw error;
  }
}

/**
 * Clear cache (useful after logout or manual refresh)
 */
export function clearJournalCache(): void {
  cache.invalidate();
}

/**
 * Utility: Format date to YYYY-MM-DD
 */
export function formatDateForAPI(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Utility: Get today's date in YYYY-MM-DD format
 */
export function getTodayDate(): string {
  return formatDateForAPI(new Date());
}

/**
 * Utility: Get date range for last N days
 */
export function getDateRange(days: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);

  return {
    start: formatDateForAPI(start),
    end: formatDateForAPI(end),
  };
}