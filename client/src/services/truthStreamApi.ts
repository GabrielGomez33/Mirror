// src/services/truthStreamApi.ts
// TruthStream API Service - Complete backend communication

import { getToken } from '../utils/token';
import type {
  TruthStreamProfile,
  TruthCardData,
  CreateTruthProfileRequest,
  UpdateTruthProfileRequest,
  ReviewQueueBatch,
  QueueItem,
  AnonymousReview,
  TruthStreamReview,
  ReviewResponse,
  TruthMirrorReport,
  TemporalTrend,
  FeedbackRequest,
  CreateFeedbackRequestPayload,
  Milestone,
  TruthStreamStats,
  TruthStreamApiResponse,
  PaginatedTruthStreamResponse,
  QuestionnaireData,
} from '../types/truthstream';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/mirror/api`
  : '/mirror/api';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const RATE_LIMIT_WINDOW = 60000;
const MAX_REQUESTS_PER_WINDOW = 25;

// ============================================================================
// RATE LIMITING
// ============================================================================

class RateLimiter {
  private timestamps: number[] = [];

  canMakeRequest(): boolean {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);
    if (this.timestamps.length >= MAX_REQUESTS_PER_WINDOW) return false;
    this.timestamps.push(now);
    return true;
  }

  getWaitTime(): number {
    if (this.timestamps.length < MAX_REQUESTS_PER_WINDOW) return 0;
    return RATE_LIMIT_WINDOW - (Date.now() - this.timestamps[0]);
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

class TruthStreamCache {
  private cache = new Map<string, CacheEntry<unknown>>();

  set<T>(key: string, data: T, expiresIn: number = 300000): void {
    this.cache.set(key, { data, timestamp: Date.now(), expiresIn });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.expiresIn) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  invalidate(pattern?: string): void {
    if (!pattern) { this.cache.clear(); return; }
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) this.cache.delete(key);
    }
  }
}

const cache = new TruthStreamCache();

// ============================================================================
// INPUT SANITIZATION
// ============================================================================

function sanitizeString(input: string, maxLength: number = 2000): string {
  if (!input) return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .slice(0, maxLength)
    .trim();
}

// ============================================================================
// SNAKE_CASE TO CAMELCASE
// ============================================================================

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function transformKeys<T>(obj: unknown): T {
  if (obj === null || obj === undefined) return obj as T;
  if (Array.isArray(obj)) return obj.map((item) => transformKeys(item)) as T;
  if (typeof obj === 'object') {
    const transformed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      transformed[snakeToCamel(key)] = transformKeys(value);
    }
    return transformed as T;
  }
  return obj as T;
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
    if (response.status >= 400 && response.status < 500) return response;
    if (!response.ok && retries > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY));
      return fetchWithRetry(url, options, retries - 1);
    }
    return response;
  } catch (error) {
    if (retries > 0) {
      console.warn(`[TruthStreamAPI] Fetch failed, retrying (${retries} left)`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}

// ============================================================================
// TRUTHSTREAM API CLIENT
// ============================================================================

class TruthStreamApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_BASE}/truthstream`;
  }

  // ==================== PRIVATE HELPERS ====================

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    useCache: boolean = false,
    cacheTTL: number = 300000
  ): Promise<T> {
    const token = getToken();
    if (!token) throw new Error('No authentication token');

    // Serve GET cache hits BEFORE consuming rate-limit budget. A cached read makes
    // no network request and must not count against the shared 25/min client
    // limiter — previously the limiter was checked first, so mount-time fan-out and
    // WebSocket-driven refetches drained the budget even when served from cache.
    const cacheKey = `truthstream:${endpoint}`;
    if (useCache && (!options.method || options.method === 'GET')) {
      const cached = cache.get<T>(cacheKey);
      if (cached) return cached;
    }

    // Only genuine network requests count against the client rate limiter.
    if (!rateLimiter.canMakeRequest()) {
      const waitTime = rateLimiter.getWaitTime();
      throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
    }

    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string>),
    };

    const config: RequestInit = { ...options, headers, credentials: 'include' };

    try {
      const response = await fetchWithRetry(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw {
          error: data.error || 'Request failed',
          code: data.code || 'UNKNOWN_ERROR',
          status: response.status,
        };
      }

      if (useCache && (!options.method || options.method === 'GET')) {
        cache.set(cacheKey, data, cacheTTL);
      }

      return data;
    } catch (error) {
      console.error(`[TruthStreamAPI] Error on ${endpoint}:`, error);
      throw error;
    }
  }

  // ==================== PROFILE MANAGEMENT ====================

  async createProfile(request: CreateTruthProfileRequest): Promise<TruthStreamApiResponse<TruthStreamProfile>> {
    const sanitized: Record<string, unknown> = {
      displayAlias: sanitizeString(request.displayAlias, 50),
      ageRange: request.ageRange,
      selfStatement: sanitizeString(request.selfStatement, 500),
      feedbackAreas: request.feedbackAreas,
      sharedDataTypes: request.sharedDataTypes,
    };
    if (request.photoPath) sanitized.photoPath = sanitizeString(request.photoPath, 500);
    if (request.vocalSalutationPath) sanitized.vocalSalutationPath = sanitizeString(request.vocalSalutationPath, 500);

    const result = await this.makeRequest<TruthStreamApiResponse<TruthStreamProfile>>('/profile', {
      method: 'POST',
      body: JSON.stringify(sanitized),
    });

    cache.invalidate('truthstream:/profile');
    return transformKeys(result);
  }

  async getMyProfile(): Promise<TruthStreamApiResponse<TruthStreamProfile>> {
    const result = await this.makeRequest<TruthStreamApiResponse<TruthStreamProfile>>(
      '/profile',
      { method: 'GET' },
      true,
      60000
    );
    return transformKeys(result);
  }

  async updateProfile(request: UpdateTruthProfileRequest): Promise<TruthStreamApiResponse<TruthStreamProfile>> {
    const sanitized: Record<string, unknown> = {
      displayAlias: sanitizeString(request.displayAlias, 50),
    };
    if (request.ageRange !== undefined) sanitized.ageRange = request.ageRange;
    if (request.selfStatement !== undefined) sanitized.selfStatement = sanitizeString(request.selfStatement, 500);
    if (request.feedbackAreas !== undefined) sanitized.feedbackAreas = request.feedbackAreas;
    if (request.sharedDataTypes !== undefined) sanitized.sharedDataTypes = request.sharedDataTypes;
    if (request.isActive !== undefined) sanitized.isActive = request.isActive;
    if (request.photoPath !== undefined) sanitized.photoPath = sanitizeString(request.photoPath, 500);
    if (request.vocalSalutationPath !== undefined) sanitized.vocalSalutationPath = sanitizeString(request.vocalSalutationPath, 500);

    const result = await this.makeRequest<TruthStreamApiResponse<TruthStreamProfile>>('/profile', {
      method: 'PUT',
      body: JSON.stringify(sanitized),
    });

    cache.invalidate('truthstream:/profile');
    cache.invalidate('truthstream:/profile/'); // Also invalidate card cache for all users
    return transformKeys(result);
  }

  async getTruthCard(userId: number): Promise<TruthStreamApiResponse<TruthCardData>> {
    const result = await this.makeRequest<TruthStreamApiResponse<TruthCardData>>(
      `/profile/${userId}/card`,
      { method: 'GET' },
      true,
      30000
    );
    return transformKeys(result);
  }

  // ==================== REVIEW QUEUE ====================

  async getReviewQueue(): Promise<TruthStreamApiResponse<ReviewQueueBatch>> {
    const result = await this.makeRequest<TruthStreamApiResponse<ReviewQueueBatch>>(
      '/queue',
      { method: 'GET' },
      true,
      30000
    );
    return transformKeys(result);
  }

  async startQueueItem(queueId: string): Promise<TruthStreamApiResponse<QueueItem>> {
    const result = await this.makeRequest<TruthStreamApiResponse<QueueItem>>(
      `/queue/${queueId}/start`,
      { method: 'POST' }
    );
    cache.invalidate('truthstream:/queue');
    return transformKeys(result);
  }

  // ==================== REVIEWS ====================

  /**
   * Submit a review by completing a queue item.
   * Uses POST /queue/:queueId/complete with questionnaire-structured responses.
   */
  async submitReview(
    queueId: string,
    responses: Record<string, Record<string, unknown>>,
    timeSpentSeconds: number
  ): Promise<TruthStreamApiResponse<TruthStreamReview>> {
    // Sanitize all string values in responses
    const sanitizedResponses = this.sanitizeResponses(responses);

    const result = await this.makeRequest<TruthStreamApiResponse<TruthStreamReview>>(
      `/queue/${queueId}/complete`,
      {
        method: 'POST',
        body: JSON.stringify({ responses: sanitizedResponses, timeSpentSeconds }),
      }
    );

    cache.invalidate('truthstream:/queue');
    cache.invalidate('truthstream:/reviews');
    cache.invalidate('truthstream:/stats');
    return transformKeys(result);
  }

  /** Recursively sanitize string values in response data */
  private sanitizeResponses(
    responses: Record<string, Record<string, unknown>>
  ): Record<string, Record<string, unknown>> {
    const result: Record<string, Record<string, unknown>> = {};
    for (const [sectionId, section] of Object.entries(responses)) {
      result[sectionId] = {};
      for (const [questionId, answer] of Object.entries(section)) {
        if (typeof answer === 'string') {
          result[sectionId][questionId] = sanitizeString(answer, 5000);
        } else if (typeof answer === 'object' && answer !== null && !Array.isArray(answer)) {
          // Handle category_explain type: { categories: [...], explanation: "..." }
          const obj = answer as Record<string, unknown>;
          const sanitizedObj: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(obj)) {
            sanitizedObj[k] = typeof v === 'string' ? sanitizeString(v, 2000) : v;
          }
          result[sectionId][questionId] = sanitizedObj;
        } else {
          result[sectionId][questionId] = answer;
        }
      }
    }
    return result;
  }

  async getReceivedReviews(
    limit: number = 20,
    offset: number = 0
  ): Promise<TruthStreamApiResponse<PaginatedTruthStreamResponse<AnonymousReview>>> {
    const result = await this.makeRequest<TruthStreamApiResponse<PaginatedTruthStreamResponse<AnonymousReview>>>(
      `/reviews/received?limit=${limit}&offset=${offset}`,
      { method: 'GET' },
      true,
      30000
    );
    return transformKeys(result);
  }

  async getGivenReviews(
    limit: number = 20,
    offset: number = 0
  ): Promise<TruthStreamApiResponse<PaginatedTruthStreamResponse<TruthStreamReview>>> {
    const result = await this.makeRequest<TruthStreamApiResponse<PaginatedTruthStreamResponse<TruthStreamReview>>>(
      `/reviews/given?limit=${limit}&offset=${offset}`,
      { method: 'GET' },
      true,
      30000
    );
    return transformKeys(result);
  }

  async markReviewHelpful(reviewId: string): Promise<TruthStreamApiResponse<{ helpfulCount: number }>> {
    const result = await this.makeRequest<TruthStreamApiResponse<{ helpfulCount: number }>>(
      `/reviews/${reviewId}/helpful`,
      { method: 'POST' }
    );
    cache.invalidate('truthstream:/reviews');
    return result;
  }

  async unmarkReviewHelpful(reviewId: string): Promise<TruthStreamApiResponse<{ helpfulCount: number }>> {
    const result = await this.makeRequest<TruthStreamApiResponse<{ helpfulCount: number }>>(
      `/reviews/${reviewId}/helpful`,
      { method: 'DELETE' }
    );
    cache.invalidate('truthstream:/reviews');
    return result;
  }

  async respondToReview(
    reviewId: string,
    content: string
  ): Promise<TruthStreamApiResponse<ReviewResponse>> {
    const result = await this.makeRequest<TruthStreamApiResponse<ReviewResponse>>(
      `/reviews/${reviewId}/respond`,
      {
        method: 'POST',
        body: JSON.stringify({ content: sanitizeString(content, 1000) }),
      }
    );
    return transformKeys(result);
  }

  async getReviewResponses(reviewId: string): Promise<TruthStreamApiResponse<ReviewResponse[]>> {
    const result = await this.makeRequest<TruthStreamApiResponse<ReviewResponse[]>>(
      `/reviews/${reviewId}/dialogue`,
      { method: 'GET' }
    );
    return transformKeys(result);
  }

  async flagReview(
    reviewId: string,
    reason: string
  ): Promise<TruthStreamApiResponse<{ message: string }>> {
    return this.makeRequest<TruthStreamApiResponse<{ message: string }>>(
      `/reviews/${reviewId}/flag`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: sanitizeString(reason, 500) }),
      }
    );
  }

  // ==================== QUESTIONNAIRE ====================

  async getQuestionnaire(goalCategory: string): Promise<TruthStreamApiResponse<QuestionnaireData>> {
    const result = await this.makeRequest<TruthStreamApiResponse<QuestionnaireData>>(
      `/questionnaire/${encodeURIComponent(goalCategory)}`,
      { method: 'GET' },
      true,
      600000 // 10 minute cache — questionnaires rarely change
    );
    return transformKeys(result);
  }

  // ==================== ANALYSIS (DINA) ====================

  async getAnalysis(): Promise<TruthStreamApiResponse<TruthMirrorReport>> {
    const result = await this.makeRequest<TruthStreamApiResponse<TruthMirrorReport>>(
      '/analysis',
      { method: 'GET' },
      true,
      120000 // 2 minute cache - analysis is expensive
    );
    return transformKeys(result);
  }

  async generateAnalysis(): Promise<TruthStreamApiResponse<{ jobId: string; message: string }>> {
    const result = await this.makeRequest<TruthStreamApiResponse<{ jobId: string; message: string }>>(
      '/analysis/generate',
      { method: 'POST' }
    );
    cache.invalidate('truthstream:/analysis');
    return result;
  }

  async getPerceptionGap(): Promise<TruthStreamApiResponse<{
    score: number;
    level: string;
    summary: string;
    details: string[];
  }>> {
    const result = await this.makeRequest<TruthStreamApiResponse<{
      score: number;
      level: string;
      summary: string;
      details: string[];
    }>>(
      '/analysis/perception-gap',
      { method: 'GET' },
      true,
      120000
    );
    return transformKeys(result);
  }

  async getTrends(): Promise<TruthStreamApiResponse<TemporalTrend>> {
    const result = await this.makeRequest<TruthStreamApiResponse<TemporalTrend>>(
      '/analysis/trends',
      { method: 'GET' },
      true,
      120000
    );
    return transformKeys(result);
  }

  // ==================== FEEDBACK REQUESTS ====================

  async createFeedbackRequest(
    request: CreateFeedbackRequestPayload
  ): Promise<TruthStreamApiResponse<FeedbackRequest>> {
    const sanitized = {
      question: sanitizeString(request.question, 500),
      context: request.context ? sanitizeString(request.context, 1000) : undefined,
      expiresInHours: request.expiresInHours || 72,
    };

    const result = await this.makeRequest<TruthStreamApiResponse<FeedbackRequest>>(
      '/feedback-requests',
      {
        method: 'POST',
        body: JSON.stringify(sanitized),
      }
    );

    cache.invalidate('truthstream:/feedback-requests');
    return transformKeys(result);
  }

  async getMyFeedbackRequests(): Promise<TruthStreamApiResponse<FeedbackRequest[]>> {
    const result = await this.makeRequest<TruthStreamApiResponse<FeedbackRequest[]>>(
      '/feedback-requests',
      { method: 'GET' },
      true,
      30000
    );
    return transformKeys(result);
  }

  async getFeedbackRequestsFeed(
    limit: number = 20,
    offset: number = 0
  ): Promise<TruthStreamApiResponse<PaginatedTruthStreamResponse<FeedbackRequest>>> {
    const result = await this.makeRequest<TruthStreamApiResponse<PaginatedTruthStreamResponse<FeedbackRequest>>>(
      `/feedback-requests/feed?limit=${limit}&offset=${offset}`,
      { method: 'GET' },
      true,
      30000
    );
    return transformKeys(result);
  }

  // ==================== MILESTONES & STATS ====================

  async getMilestones(): Promise<TruthStreamApiResponse<Milestone[]>> {
    const result = await this.makeRequest<TruthStreamApiResponse<Milestone[]>>(
      '/milestones',
      { method: 'GET' },
      true,
      120000
    );
    return transformKeys(result);
  }

  async getStats(): Promise<TruthStreamApiResponse<TruthStreamStats>> {
    const result = await this.makeRequest<TruthStreamApiResponse<TruthStreamStats>>(
      '/stats',
      { method: 'GET' },
      true,
      60000
    );
    return transformKeys(result);
  }

  // ==================== UTILITY ====================

  clearCache(pattern?: string): void {
    cache.invalidate(pattern);
  }
}

// ============================================================================
// SINGLETON & EXPORTS
// ============================================================================

const truthStreamApi = new TruthStreamApiClient();

// Profile
export const createTruthProfile = (data: CreateTruthProfileRequest) => truthStreamApi.createProfile(data);
export const getMyTruthProfile = () => truthStreamApi.getMyProfile();
export const updateTruthProfile = (data: UpdateTruthProfileRequest) => truthStreamApi.updateProfile(data);
export const getTruthCard = (userId: number) => truthStreamApi.getTruthCard(userId);

// Queue
export const getReviewQueue = () => truthStreamApi.getReviewQueue();
export const startQueueItem = (queueId: string) => truthStreamApi.startQueueItem(queueId);

// Questionnaire
export const getQuestionnaire = (goalCategory: string) => truthStreamApi.getQuestionnaire(goalCategory);

// Reviews
export const submitReview = (
  queueId: string,
  responses: Record<string, Record<string, unknown>>,
  timeSpentSeconds: number
) => truthStreamApi.submitReview(queueId, responses, timeSpentSeconds);
export const getReceivedReviews = (limit?: number, offset?: number) => truthStreamApi.getReceivedReviews(limit, offset);
export const getGivenReviews = (limit?: number, offset?: number) => truthStreamApi.getGivenReviews(limit, offset);
export const markReviewHelpful = (reviewId: string) => truthStreamApi.markReviewHelpful(reviewId);
export const unmarkReviewHelpful = (reviewId: string) => truthStreamApi.unmarkReviewHelpful(reviewId);
export const respondToReview = (reviewId: string, content: string) => truthStreamApi.respondToReview(reviewId, content);
export const getReviewResponses = (reviewId: string) => truthStreamApi.getReviewResponses(reviewId);
export const flagReview = (reviewId: string, reason: string) => truthStreamApi.flagReview(reviewId, reason);

// Analysis
export const getTruthAnalysis = () => truthStreamApi.getAnalysis();
export const generateTruthAnalysis = () => truthStreamApi.generateAnalysis();
export const getPerceptionGap = () => truthStreamApi.getPerceptionGap();
export const getTruthTrends = () => truthStreamApi.getTrends();

// Feedback Requests
export const createFeedbackRequest = (data: CreateFeedbackRequestPayload) => truthStreamApi.createFeedbackRequest(data);
export const getMyFeedbackRequests = () => truthStreamApi.getMyFeedbackRequests();
export const getFeedbackRequestsFeed = (limit?: number, offset?: number) => truthStreamApi.getFeedbackRequestsFeed(limit, offset);

// Milestones & Stats
export const getTruthMilestones = () => truthStreamApi.getMilestones();
export const getTruthStats = () => truthStreamApi.getStats();

// Cache
export const clearTruthStreamCache = (pattern?: string) => truthStreamApi.clearCache(pattern);

// Export instance
export { truthStreamApi };

// ============================================================================
// ERROR HANDLING
// ============================================================================

export interface TruthStreamApiError {
  error: string;
  code: string;
  status?: number;
}

export const isTruthStreamApiError = (error: unknown): error is TruthStreamApiError => {
  return typeof error === 'object' && error !== null && 'error' in error;
};

export const getTruthStreamErrorMessage = (error: unknown): string => {
  if (isTruthStreamApiError(error)) return error.error;
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
};