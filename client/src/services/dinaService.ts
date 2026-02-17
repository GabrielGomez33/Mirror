// ============================================================================
// DINA SERVICE - Frontend service for @Dina interactions
// ============================================================================
// File: src/services/dinaService.ts
//
// Purpose: Provides utility functions for @Dina mentions in chat.
// This service handles detection, formatting, and tracking of @Dina messages.
// ============================================================================

import { getToken } from '../utils/token';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/mirror/api`
  : '/mirror/api';

// ============================================================================
// TYPES
// ============================================================================

export interface DinaMessage {
  id: string;
  groupId: string;
  query: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  response?: string;
  createdAt: string;
  completedAt?: string;
  processingTimeMs?: number;
}

export interface DinaQueryResponse {
  success: boolean;
  data?: {
    queueId: string;
    message: string;
    estimatedTime?: string;
  };
  error?: string;
}

// ============================================================================
// DINA MENTION DETECTION
// ============================================================================

/**
 * Check if a message contains an @Dina mention
 * Case-insensitive, matches @Dina followed by word boundary
 */
export function containsDinaMention(content: string): boolean {
  if (!content) return false;
  const dinaPattern = /@dina\b/i;
  return dinaPattern.test(content);
}

/**
 * Extract the query part from a message (text after @Dina)
 */
export function extractDinaQuery(content: string): string {
  if (!content) return '';
  return content.replace(/@dina\b/gi, '').trim();
}

/**
 * Get @Dina mention positions in a message for highlighting
 */
export function getDinaMentionPositions(content: string): Array<{ start: number; end: number }> {
  if (!content) return [];

  const positions: Array<{ start: number; end: number }> = [];
  const pattern = /@dina\b/gi;
  let match;

  while ((match = pattern.exec(content)) !== null) {
    positions.push({
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return positions;
}

/**
 * Format content with @Dina mentions highlighted
 */
export function formatDinaMention(content: string): string {
  if (!content) return '';

  // Replace @Dina mentions with styled spans
  return content.replace(
    /@dina\b/gi,
    '<span class="dina-mention">@Dina</span>'
  );
}

// ============================================================================
// MESSAGE TYPE DETECTION
// ============================================================================

/**
 * Check if a message is from the Dina system user
 */
export function isDinaMessage(message: {
  senderUsername?: string;
  senderUserId?: number;
  metadata?: { isDinaResponse?: boolean };
}): boolean {
  // Check by username
  if (message.senderUsername?.toLowerCase() === 'dina') {
    return true;
  }

  // Check by metadata
  if (message.metadata?.isDinaResponse === true) {
    return true;
  }

  // Check by system user ID (configured in env)
  const dinaUserId = parseInt(import.meta.env.VITE_DINA_USER_ID || '59', 10);
  if (message.senderUserId === dinaUserId) {
    return true;
  }

  return false;
}

/**
 * Check if a message is a question to Dina (contains @Dina)
 */
export function isDinaQuery(message: { content?: string }): boolean {
  return containsDinaMention(message.content || '');
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get the status of a pending Dina query
 */
export async function getDinaQueryStatus(groupId: string, queueId: string): Promise<{
  success: boolean;
  data?: DinaMessage;
  error?: string;
}> {
  const token = getToken();
  if (!token) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const response = await fetch(
      `${API_BASE}/groups/${groupId}/dina/status/${queueId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      }
    );

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[DinaService] Failed to get query status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get pending Dina queries for a group
 */
export async function getPendingDinaQueries(groupId: string): Promise<{
  success: boolean;
  data?: DinaMessage[];
  error?: string;
}> {
  const token = getToken();
  if (!token) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const response = await fetch(
      `${API_BASE}/groups/${groupId}/dina/pending`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      }
    );

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[DinaService] Failed to get pending queries:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// UI HELPERS
// ============================================================================

/**
 * Get CSS class for Dina-related message styling
 */
export function getDinaMessageClass(message: {
  senderUsername?: string;
  senderUserId?: number;
  content?: string;
  metadata?: { isDinaResponse?: boolean };
}): string {
  if (isDinaMessage(message)) {
    return 'message-from-dina';
  }
  if (isDinaQuery(message)) {
    return 'message-to-dina';
  }
  return '';
}

/**
 * Get a friendly loading message for Dina responses
 */
export function getDinaLoadingMessage(): string {
  const messages = [
    'Dina is thinking...',
    'Consulting the wisdom...',
    'Analyzing your question...',
    'Dina is formulating a response...',
    'Processing your request...',
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Get placeholder text for the message input when @Dina is detected
 */
export function getDinaPlaceholder(content: string): string {
  if (containsDinaMention(content)) {
    return 'Ask Dina anything about the group...';
  }
  return 'Type a message... (use @Dina to ask questions)';
}

// ============================================================================
// AUTOCOMPLETE HELPERS
// ============================================================================

/**
 * Get autocomplete suggestions for @D mentions
 */
export function getDinaAutocompleteSuggestions(
  prefix: string
): Array<{ value: string; label: string; description: string }> {
  const normalizedPrefix = prefix.toLowerCase();

  if (normalizedPrefix === '@' || normalizedPrefix === '@d' || normalizedPrefix.startsWith('@di')) {
    return [
      {
        value: '@Dina',
        label: '@Dina',
        description: 'Ask Dina a question',
      },
    ];
  }

  return [];
}

/**
 * Check if text ends with partial @Dina mention (for autocomplete)
 */
export function hasPartialDinaMention(content: string): boolean {
  if (!content) return false;
  const pattern = /@d(i(n(a)?)?)?$/i;
  return pattern.test(content);
}

// ============================================================================
// EXPORTS
// ============================================================================

export const dinaService = {
  containsDinaMention,
  extractDinaQuery,
  getDinaMentionPositions,
  formatDinaMention,
  isDinaMessage,
  isDinaQuery,
  getDinaQueryStatus,
  getPendingDinaQueries,
  getDinaMessageClass,
  getDinaLoadingMessage,
  getDinaPlaceholder,
  getDinaAutocompleteSuggestions,
  hasPartialDinaMention,
};

export default dinaService;
