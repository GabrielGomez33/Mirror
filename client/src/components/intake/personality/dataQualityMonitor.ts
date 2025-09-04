// src/components/intake/personality/dataQualityMonitor.ts

export interface ResponseTiming {
  questionId: string;
  startTime: number;
  endTime: number;
  responseTime: number;
}

export interface DataQualityMetrics {
  overallQuality: 'excellent' | 'good' | 'fair' | 'poor';
  qualityScore: number; // 0-100
  attentionChecksPassed: number;
  attentionChecksTotal: number;
  attentionCheckRate: number;
  consistencyIndex: number;
  responseTimeStats: {
    median: number;
    mean: number;
    variance: number;
    extremelyFast: number;
    extremelySlow: number;
  };
  dataQualityFlags: string[];
  recommendations: string[];
  reliability: number; // Estimated reliability based on quality metrics
}

export class DataQualityMonitor {
  private responses: Map<string, any> = new Map();
  private timings: ResponseTiming[] = [];
  private attentionCheckResults: Map<string, boolean> = new Map();

  // Record a response with timing
  recordResponse(questionId: string, answer: any, startTime: number): void {
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    this.responses.set(questionId, answer);
    this.timings.push({
      questionId,
      startTime,
      endTime,
      responseTime
    });
  }

  // Validate attention check responses
  validateAttentionCheck(questionId: string, expectedValue: string, actualValue: string): boolean {
    const passed = expectedValue === actualValue;
    this.attentionCheckResults.set(questionId, passed);
    return passed;
  }

  // Calculate comprehensive quality metrics
  generateQualityMetrics(questions: any[]): DataQualityMetrics {
    const attentionRate = this.calculateAttentionCheckRate();
    const consistencyIndex = this.calculateConsistencyIndex(questions);
    const timeStats = this.calculateResponseTimeStats();
    const flags = this.generateQualityFlags(timeStats);
    
    // Overall quality score (0-100)
    const qualityScore = this.calculateOverallQuality(attentionRate, consistencyIndex, timeStats, flags);
    
    // Map to quality category
    const overallQuality = 
      qualityScore >= 85 ? 'excellent' :
      qualityScore >= 70 ? 'good' :
      qualityScore >= 50 ? 'fair' : 'poor';

    // Estimated reliability based on quality
    const reliability = Math.max(0.3, Math.min(0.95, qualityScore / 100 * 0.85 + 0.1));

    return {
      overallQuality,
      qualityScore,
      attentionChecksPassed: Array.from(this.attentionCheckResults.values()).filter(Boolean).length,
      attentionChecksTotal: this.attentionCheckResults.size,
      attentionCheckRate: attentionRate,
      consistencyIndex,
      responseTimeStats: timeStats,
      dataQualityFlags: flags,
      recommendations: this.generateRecommendations(qualityScore, flags),
      reliability
    };
  }

  private calculateAttentionCheckRate(): number {
    if (this.attentionCheckResults.size === 0) return 1;
    const passed = Array.from(this.attentionCheckResults.values()).filter(Boolean).length;
    return passed / this.attentionCheckResults.size;
  }

  private calculateConsistencyIndex(questions: any[]): number {
    // Simplified consistency analysis
    const big5Responses = Array.from(this.responses.entries())
      .filter(([id]) => questions.find(q => q.id === id)?.category === 'big5')
      .map(([, answer]) => answer.score);

    if (big5Responses.length < 5) return 0.5;

    // Check for straight-lining (same response repeatedly)
    const uniqueResponses = new Set(big5Responses).size;
    const straightLiningPenalty = uniqueResponses <= 2 ? 0.3 : 1.0;

    // Check for response patterns that suggest random responding
    const responseVariance = this.calculateVariance(big5Responses);
    const normalizedVariance = Math.min(1, responseVariance / 4); // Normalize for 7-point scale

    return Math.max(0, Math.min(1, normalizedVariance * straightLiningPenalty));
  }

  private calculateResponseTimeStats(): DataQualityMetrics['responseTimeStats'] {
    if (this.timings.length === 0) {
      return { median: 0, mean: 0, variance: 0, extremelyFast: 0, extremelySlow: 0 };
    }

    const times = this.timings.map(t => t.responseTime);
    const sortedTimes = [...times].sort((a, b) => a - b);
    
    const median = sortedTimes[Math.floor(sortedTimes.length / 2)];
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const variance = this.calculateVariance(times);
    
    // Count extreme responses (< 1 second or > 60 seconds)
    const extremelyFast = times.filter(t => t < 1000).length;
    const extremelySlow = times.filter(t => t > 60000).length;

    return {
      median,
      mean,
      variance,
      extremelyFast,
      extremelySlow
    };
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
  }

  private generateQualityFlags(timeStats: DataQualityMetrics['responseTimeStats']): string[] {
    const flags: string[] = [];

    // Attention check failures
    if (this.attentionCheckResults.size > 0 && this.calculateAttentionCheckRate() < 0.8) {
      flags.push('attention_check_failure');
    }

    // Response time flags
    if (timeStats.extremelyFast > 2) {
      flags.push('extremely_fast_responses');
    }

    if (timeStats.extremelySlow > 3) {
      flags.push('extremely_slow_responses');
    }

    if (timeStats.median < 2000) {
      flags.push('overall_too_fast');
    }

    // Consistency flags
    const big5Values = Array.from(this.responses.values())
      .filter(v => v.score !== undefined)
      .map(v => v.score);
    
    if (big5Values.length > 0) {
      const uniqueValues = new Set(big5Values).size;
      if (uniqueValues <= 2 && big5Values.length > 10) {
        flags.push('straight_lining');
      }
    }

    return flags;
  }

  private calculateOverallQuality(
    attentionRate: number,
    consistencyIndex: number,
    timeStats: DataQualityMetrics['responseTimeStats'],
    flags: string[]
  ): number {
    let score = 100;

    // Attention check penalty
    score -= (1 - attentionRate) * 30;

    // Consistency penalty
    score -= (1 - consistencyIndex) * 25;

    // Response time penalties
    if (timeStats.median < 1500) score -= 20; // Too fast overall
    if (timeStats.extremelyFast > 2) score -= 15; // Multiple extremely fast
    if (timeStats.extremelySlow > 5) score -= 10; // Multiple extremely slow

    // Flag penalties
    flags.forEach(flag => {
      switch (flag) {
        case 'straight_lining':
          score -= 25;
          break;
        case 'attention_check_failure':
          score -= 20;
          break;
        case 'extremely_fast_responses':
          score -= 15;
          break;
        default:
          score -= 5;
      }
    });

    return Math.max(0, Math.min(100, score));
  }

  private generateRecommendations(qualityScore: number, flags: string[]): string[] {
    const recommendations: string[] = [];

    if (qualityScore < 50) {
      recommendations.push('Consider retaking the assessment with more careful attention to each question');
    }

    if (flags.includes('attention_check_failure')) {
      recommendations.push('Please read questions more carefully and follow instructions');
    }

    if (flags.includes('extremely_fast_responses')) {
      recommendations.push('Take more time to thoughtfully consider each question');
    }

    if (flags.includes('straight_lining')) {
      recommendations.push('Try to provide more varied responses that reflect your true opinions');
    }

    if (qualityScore >= 85) {
      recommendations.push('Excellent response quality - results should be highly reliable');
    } else if (qualityScore >= 70) {
      recommendations.push('Good response quality - results are likely reliable');
    }

    return recommendations;
  }

  // Reset monitor for new assessment
  reset(): void {
    this.responses.clear();
    this.timings = [];
    this.attentionCheckResults.clear();
  }

  // Get current response count
  getResponseCount(): number {
    return this.responses.size;
  }

  // Check if specific question was answered
  hasResponse(questionId: string): boolean {
    return this.responses.has(questionId);
  }
}

// Utility functions for quality analysis
export class QualityAnalyzer {
  // Generate quality report text
  static generateQualityReport(metrics: DataQualityMetrics): string {
    let report = `**Response Quality Assessment**\n\n`;
    
    report += `**Overall Quality: ${metrics.overallQuality.toUpperCase()}** (${metrics.qualityScore}/100)\n\n`;
    
    if (metrics.attentionChecksTotal > 0) {
      report += `**Attention Checks:** ${metrics.attentionChecksPassed}/${metrics.attentionChecksTotal} passed (${Math.round(metrics.attentionCheckRate * 100)}%)\n\n`;
    }
    
    report += `**Response Time Analysis:**\n`;
    report += `- Median response time: ${Math.round(metrics.responseTimeStats.median / 1000)}s\n`;
    report += `- Average response time: ${Math.round(metrics.responseTimeStats.mean / 1000)}s\n`;
    
    if (metrics.dataQualityFlags.length > 0) {
      report += `\n**Quality Flags:**\n`;
      metrics.dataQualityFlags.forEach(flag => {
        report += `- ${flag.replace(/_/g, ' ')}\n`;
      });
    }
    
    if (metrics.recommendations.length > 0) {
      report += `\n**Recommendations:**\n`;
      metrics.recommendations.forEach(rec => {
        report += `- ${rec}\n`;
      });
    }
    
    return report;
  }
}

export default DataQualityMonitor;
