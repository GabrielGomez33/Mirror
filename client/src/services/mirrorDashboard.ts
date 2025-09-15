// client/src/services/mirrorDashboard.ts
import { getToken } from '../utils/token';

const BASE_URL = import.meta.env.VITE_API_URL;

// ============================================================================
// MIRROR DASHBOARD API SERVICE
// ============================================================================

class MirrorDashboardService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${BASE_URL}/mirror/api/dashboard`;
  }

  private getAuthHeaders(): Record<string, string> {
    const token = getToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...(options.headers || {})
      },
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Request failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get personal intelligence dashboard data
   */
  async getPersonalIntelligence(): Promise<any> {
    try {
      console.log('📊 Fetching personal intelligence dashboard');
      const result = await this.makeRequest<any>('/personal-intelligence');
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch personal intelligence');
      }

      return result.data;
    } catch (error) {
      console.error('Failed to fetch personal intelligence:', error);
      throw error;
    }
  }

  /**
   * Request new analysis from DINA server
   */
  async requestNewAnalysis(analysisType: string, priority: string = 'normal'): Promise<void> {
    try {
      console.log(`🔄 Requesting ${analysisType} analysis from DINA`);
      
      // Call existing DINA endpoint directly
      const response = await fetch(`${BASE_URL.replace('/mirror', '')}/api/mirror/analyze`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ 
          analysis_type: analysisType,
          data: {},
          options: { priority }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to request analysis: ${response.statusText}`);
      }

      console.log(`✅ ${analysisType} analysis requested successfully`);
    } catch (error) {
      console.error('Failed to request analysis:', error);
      throw error;
    }
  }
}

export const mirrorDashboardApi = new MirrorDashboardService();
export const getPersonalIntelligenceApi = () => mirrorDashboardApi.getPersonalIntelligence();
export const requestNewAnalysisApi = (analysisType: string, priority?: string) => 
  mirrorDashboardApi.requestNewAnalysis(analysisType, priority);

export default mirrorDashboardApi;
