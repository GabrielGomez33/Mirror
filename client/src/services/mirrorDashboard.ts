// client/src/services/mirrorDashboard.ts
// Mirror Dashboard + Personal Analysis API Service
// Follows the same patterns as truthStreamApi.ts (caching, retry, rate limiting)

import { getToken } from '../utils/token';
import { dispatchPaywallEvent } from './paywallInterceptor';

const BASE_URL = import.meta.env.VITE_API_URL;

// ============================================================================
// CACHING (matches truthStreamApi.ts pattern)
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresIn: number;
}

class DashboardCache {
  private cache = new Map<string, CacheEntry<any>>();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.expiresIn) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, expiresIn: number = 300000): void {
    this.cache.set(key, { data, timestamp: Date.now(), expiresIn });
  }

  invalidate(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) this.cache.delete(key);
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

const cache = new DashboardCache();

// ============================================================================
// MIRROR DASHBOARD API SERVICE
// ============================================================================

class MirrorDashboardService {
  private baseUrl: string;
  private analysisBaseUrl: string;

  constructor() {
    this.baseUrl = `${BASE_URL}/mirror/api/dashboard`;
    this.analysisBaseUrl = `${BASE_URL}/mirror/api/personal-analysis`;
  }

  private getAuthHeaders(): Record<string, string> {
    const token = getToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  private async makeRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...(options.headers || {})
      },
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 403 && (errorData.code === 'USAGE_LIMIT' || errorData.code === 'UPGRADE_REQUIRED')) {
        dispatchPaywallEvent({ code: errorData.code, feature: errorData.feature, error: errorData.error, used: errorData.used, limit: errorData.limit });
      }
      // Preserve the HTTP status and structured fields on the thrown error so callers
      // can react to rate limits (429 / RATE_LIMIT_EXCEEDED) with an accurate,
      // user-facing retry message instead of a generic failure. Message is unchanged
      // for backward compatibility with existing `error.message` consumers.
      const err = new Error(errorData.error || `Request failed: ${response.statusText}`) as Error & {
        status?: number; code?: string; retryAfter?: number;
      };
      err.status = response.status;
      if (errorData.code) err.code = errorData.code;
      if (typeof errorData.retryAfter === 'number') err.retryAfter = errorData.retryAfter;
      throw err;
    }

    return response.json();
  }

  // ==========================================================================
  // PERSONAL INTELLIGENCE (existing endpoint — unchanged)
  // ==========================================================================

  async getPersonalIntelligence(): Promise<any> {
    // Check cache first
    const cached = cache.get<any>('dashboard:personal-intelligence');
    if (cached) return cached;

    try {
      console.log('[Dashboard] Fetching personal intelligence');
      const result = await this.makeRequest<any>(`${this.baseUrl}/personal-intelligence`);

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch personal intelligence');
      }

      cache.set('dashboard:personal-intelligence', result.data, 120000); // 2 min cache
      return result.data;
    } catch (error) {
      console.error('[Dashboard] Failed to fetch personal intelligence:', error);
      throw error;
    }
  }

  // ==========================================================================
  // PERSONAL ANALYSIS — New endpoints (follows TruthStream pattern)
  // ==========================================================================

  /**
   * Request new personal analysis generation.
   * Returns immediately with jobId — analysis runs async on backend.
   * Frontend should poll getLatestAnalysis() to get results.
   */
  async requestPersonalAnalysis(
    analysisType: string = 'comprehensive'
  ): Promise<{ jobId: string; message: string; analysisType: string }> {
    try {
      console.log(`[Dashboard] Requesting ${analysisType} personal analysis`);

      const result = await this.makeRequest<any>(`${this.analysisBaseUrl}/generate`, {
        method: 'POST',
        body: JSON.stringify({ analysisType }),
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to request analysis');
      }

      // Invalidate analysis cache so next poll gets fresh data
      cache.invalidate('analysis:');

      return result.data;
    } catch (error) {
      console.error('[Dashboard] Failed to request personal analysis:', error);
      throw error;
    }
  }

  /**
   * Get the latest personal analysis for the current user.
   * Returns null if no analysis exists yet.
   */
  async getLatestAnalysis(): Promise<PersonalAnalysisResult | null> {
    try {
      const result = await this.makeRequest<any>(`${this.analysisBaseUrl}/latest`);

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch analysis');
      }

      return result.data || null;
    } catch (error) {
      console.error('[Dashboard] Failed to fetch latest analysis:', error);
      throw error;
    }
  }

  /**
   * Get analysis history for trend comparison.
   */
  async getAnalysisHistory(limit: number = 10): Promise<PersonalAnalysisHistoryItem[]> {
    const cacheKey = `analysis:history:${limit}`;
    const cached = cache.get<PersonalAnalysisHistoryItem[]>(cacheKey);
    if (cached) return cached;

    try {
      const result = await this.makeRequest<any>(
        `${this.analysisBaseUrl}/history?limit=${limit}`
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch history');
      }

      const data = result.data || [];
      cache.set(cacheKey, data, 300000); // 5 min cache
      return data;
    } catch (error) {
      console.error('[Dashboard] Failed to fetch analysis history:', error);
      throw error;
    }
  }

  /**
   * Clear analysis cache (used before polling for new results).
   */
  clearAnalysisCache(): void {
    cache.invalidate('analysis:');
  }

  /**
   * Clear all dashboard caches.
   */
  clearAllCache(): void {
    cache.clear();
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface PersonalAnalysisResult {
  id: string;
  analysisType: string;
  analysisData: PersonalMirrorReportData;
  overallScore: number;
  confidenceLevel: number;
  journalEntriesAnalyzed: number;
  intakeSectionsAvailable: number;
  createdAt: string;
}

export interface PersonalAnalysisHistoryItem {
  id: string;
  analysisType: string;
  overallScore: number;
  confidenceLevel: number;
  journalEntriesAnalyzed: number;
  intakeSectionsAvailable: number;
  createdAt: string;
}

export interface PersonalMirrorReportData {
  executiveSummary: string;

  dimensionScores: {
    selfAwareness: number;
    emotionalIntelligence: number;
    growthMomentum: number;
    authenticity: number;
    resilience: number;
    mindfulness: number;
  };

  personalityInsights: {
    overview: string;
    strengths: string[];
    growthEdges: string[];
    blindSpots: string[];
  };

  journalAnalysis: {
    moodTrend: 'improving' | 'stable' | 'declining' | 'volatile';
    moodTrendDescription: string;
    emotionalPatterns: Array<{
      pattern: string;
      frequency: string;
      significance: 'high' | 'medium' | 'low';
    }>;
    energyPatterns: {
      peakTimeOfDay: string;
      averageEnergy: number;
      trend: 'increasing' | 'stable' | 'decreasing';
    };
    thematicThreads: Array<{
      theme: string;
      occurrences: number;
      sentiment: 'positive' | 'neutral' | 'negative';
      evolution: string;
    }>;
    writingDepthTrend: 'deepening' | 'stable' | 'surface';
    reflectionQuality: number;
  };

  temporalTrends: {
    overallTrajectory: 'ascending' | 'plateau' | 'descending' | 'cyclical';
    trajectoryDescription: string;
    milestones: Array<{
      date: string;
      description: string;
      type: 'breakthrough' | 'challenge' | 'insight' | 'shift';
    }>;
    comparedToPrevious?: {
      scoreChange: number;
      improvingAreas: string[];
      decliningAreas: string[];
      newInsights: string[];
    };
  };

  crossModalCorrelations: Array<{
    modalities: string[];
    correlation: string;
    insight: string;
    confidence: number;
  }>;

  growthRecommendations: Array<{
    area: string;
    recommendation: string;
    priority: 'high' | 'medium' | 'low';
    actionSteps: string[];
    relatedModalities: string[];
  }>;

  dailyPractices: Array<{
    practice: string;
    targetArea: string;
    frequency: string;
    expectedImpact: string;
  }>;
}

// ============================================================================
// SINGLETON EXPORT (matches truthStreamApi pattern)
// ============================================================================

export const mirrorDashboardApi = new MirrorDashboardService();
export const getPersonalIntelligenceApi = () => mirrorDashboardApi.getPersonalIntelligence();
export const requestPersonalAnalysisApi = (analysisType?: string) =>
  mirrorDashboardApi.requestPersonalAnalysis(analysisType);
export const getLatestAnalysisApi = () => mirrorDashboardApi.getLatestAnalysis();
export const getAnalysisHistoryApi = (limit?: number) =>
  mirrorDashboardApi.getAnalysisHistory(limit);
export const clearAnalysisCache = () => mirrorDashboardApi.clearAnalysisCache();

export default mirrorDashboardApi;