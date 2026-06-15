// src/components/intake/personality/dataQualityMonitor.ts
//
// Tracks response behavior during the assessment (timing, attention checks) and
// combines it with content-based response-validity analysis (validityScales) to
// produce an overall data-quality picture and a defensible reliability estimate.
//
// Public API is unchanged from the previous version (recordResponse,
// validateAttentionCheck, generateQualityMetrics, reset, getResponseCount,
// hasResponse) so existing callers keep working; new signal lives in the
// additive `validity` field of DataQualityMetrics.

import { clamp, mean, variance, median as medianOf } from './psychometricNorms';
import { ValidityScaleAnalyzer } from './validityScales';
import type { ValidityProfile } from './validityScales';
import type { AnswerMap, AssessmentAnswer, ScorableQuestion } from './types';

export interface ResponseTiming {
  questionId: string;
  startTime: number;
  endTime: number;
  responseTime: number;
}

export interface DataQualityMetrics {
  overallQuality: 'excellent' | 'good' | 'fair' | 'poor';
  qualityScore: number; // 0–100
  attentionChecksPassed: number;
  attentionChecksTotal: number;
  attentionCheckRate: number;
  /** 0–1, higher = same-trait items answered more consistently. */
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
  reliability: number; // 0–1 estimate feeding the scoring engines
  /** Content-based response-validity analysis (additive, always present). */
  validity: ValidityProfile;
}

// Response-time thresholds (ms).
const FAST_RESPONSE_MS = 1000;
const SLOW_RESPONSE_MS = 60000;
const TOO_FAST_MEDIAN_MS = 1500;

export class DataQualityMonitor {
  private responses: Map<string, AssessmentAnswer> = new Map();
  private timings: ResponseTiming[] = [];
  private attentionCheckResults: Map<string, boolean> = new Map();

  /**
   * Record (or replace) a response and its timing. Replacing the timing for an
   * already-answered question prevents duplicate entries when a respondent uses
   * the Back button to revise an answer.
   */
  recordResponse(questionId: string, answer: AssessmentAnswer, startTime: number): void {
    const endTime = Date.now();
    const responseTime = Math.max(0, endTime - (startTime || endTime));

    this.responses.set(questionId, answer);
    this.timings = this.timings.filter((t) => t.questionId !== questionId);
    this.timings.push({ questionId, startTime, endTime, responseTime });
  }

  /**
   * Re-hydrate a previously-saved answer (e.g. after a page refresh) so it
   * contributes to content-validity and consistency analysis, WITHOUT inventing
   * a response time. Timing stats therefore reflect only answers given live in
   * the current session, which keeps the speed-based flags honest.
   */
  restoreResponse(questionId: string, answer: AssessmentAnswer): void {
    this.responses.set(questionId, answer);
  }

  validateAttentionCheck(
    questionId: string,
    expectedValue: string,
    actualValue: string
  ): boolean {
    const passed = String(expectedValue) === String(actualValue);
    this.attentionCheckResults.set(questionId, passed);
    return passed;
  }

  generateQualityMetrics(questions: ScorableQuestion[]): DataQualityMetrics {
    const safeQuestions = Array.isArray(questions) ? questions : [];
    const big5Questions = safeQuestions.filter((q) => q?.category === 'big5');

    // Build a plain answers map for content-validity analysis.
    const answers: AnswerMap = {};
    for (const [id, ans] of this.responses.entries()) answers[id] = ans;

    const validity = ValidityScaleAnalyzer.analyze(answers, big5Questions);
    const attentionRate = this.calculateAttentionCheckRate();
    const timeStats = this.calculateResponseTimeStats();

    // Consistency now derives from the validity engine's within-trait
    // (forward vs reverse) inconsistency rather than a raw variance heuristic.
    const consistencyIndex =
      validity.flags.includes('insufficient_data')
        ? 0.5
        : clamp(1 - validity.inconsistencyScore, 0, 1);

    const flags = this.aggregateFlags(timeStats, attentionRate, validity);
    const qualityScore = this.calculateOverallQuality(attentionRate, timeStats, validity);

    const overallQuality =
      qualityScore >= 85 ? 'excellent' :
      qualityScore >= 70 ? 'good' :
      qualityScore >= 50 ? 'fair' : 'poor';

    const reliability = this.estimateReliability(qualityScore, validity);

    return {
      overallQuality,
      qualityScore,
      attentionChecksPassed: Array.from(this.attentionCheckResults.values()).filter(Boolean).length,
      attentionChecksTotal: this.attentionCheckResults.size,
      attentionCheckRate: attentionRate,
      consistencyIndex: Math.round(consistencyIndex * 1000) / 1000,
      responseTimeStats: timeStats,
      dataQualityFlags: flags,
      recommendations: this.generateRecommendations(qualityScore, flags, validity),
      reliability,
      validity,
    };
  }

  private calculateAttentionCheckRate(): number {
    if (this.attentionCheckResults.size === 0) return 1;
    const passed = Array.from(this.attentionCheckResults.values()).filter(Boolean).length;
    return passed / this.attentionCheckResults.size;
  }

  private calculateResponseTimeStats(): DataQualityMetrics['responseTimeStats'] {
    if (this.timings.length === 0) {
      return { median: 0, mean: 0, variance: 0, extremelyFast: 0, extremelySlow: 0 };
    }
    const times = this.timings.map((t) => t.responseTime);
    return {
      median: Math.round(medianOf(times)),
      mean: Math.round(mean(times)),
      variance: Math.round(variance(times)),
      extremelyFast: times.filter((t) => t < FAST_RESPONSE_MS).length,
      extremelySlow: times.filter((t) => t > SLOW_RESPONSE_MS).length,
    };
  }

  private aggregateFlags(
    timeStats: DataQualityMetrics['responseTimeStats'],
    attentionRate: number,
    validity: ValidityProfile
  ): string[] {
    const flags = new Set<string>();

    if (this.attentionCheckResults.size > 0 && attentionRate < 0.8) {
      flags.add('attention_check_failure');
    }
    if (timeStats.extremelyFast > 2) flags.add('extremely_fast_responses');
    if (timeStats.extremelySlow > 3) flags.add('extremely_slow_responses');
    if (timeStats.median > 0 && timeStats.median < TOO_FAST_MEDIAN_MS) flags.add('overall_too_fast');

    // Content-validity flags (already human-meaningful identifiers).
    for (const f of validity.flags) {
      if (f !== 'insufficient_data') flags.add(f);
    }
    return Array.from(flags);
  }

  private calculateOverallQuality(
    attentionRate: number,
    timeStats: DataQualityMetrics['responseTimeStats'],
    validity: ValidityProfile
  ): number {
    let score = 100;

    // Attention checks (up to −30).
    score -= (1 - attentionRate) * 30;

    // Response time.
    if (timeStats.median > 0 && timeStats.median < TOO_FAST_MEDIAN_MS) score -= 15;
    if (timeStats.median > 0 && timeStats.median < 800) score -= 10;
    score -= Math.min(15, Math.max(0, timeStats.extremelyFast - 2) * 5);
    if (timeStats.extremelySlow > 5) score -= 5;

    // Content validity composite (up to −30). This already incorporates
    // inconsistency, contradictions, acquiescence and response style, so we do
    // NOT separately subtract a consistency penalty (avoids double counting).
    score -= validity.randomRespondingLikelihood * 30;

    return clamp(Math.round(score), 0, 100);
  }

  private estimateReliability(qualityScore: number, validity: ValidityProfile): number {
    let reliability = (qualityScore / 100) * 0.85 + 0.1; // 0.10–0.95
    const verdictFactor: Record<ValidityProfile['overallValidity'], number> = {
      valid: 1,
      acceptable: 0.95,
      questionable: 0.8,
      invalid: 0.6,
    };
    reliability *= verdictFactor[validity.overallValidity];
    return Math.round(clamp(reliability, 0.3, 0.95) * 1000) / 1000;
  }

  private generateRecommendations(
    qualityScore: number,
    flags: string[],
    validity: ValidityProfile
  ): string[] {
    const recommendations: string[] = [];

    if (qualityScore < 50) {
      recommendations.push('Consider retaking the assessment with careful attention to each statement');
    }
    if (flags.includes('attention_check_failure')) {
      recommendations.push('Please read each statement carefully and follow any instructions');
    }
    if (flags.includes('extremely_fast_responses') || flags.includes('overall_too_fast')) {
      recommendations.push('Take a little more time to consider each statement');
    }
    if (flags.includes('inconsistent_responding') || flags.includes('contradictory_responses')) {
      recommendations.push('Try to answer in a way that consistently reflects your true views');
    }
    // Surface the most important validity guidance (de-duplicated).
    for (const w of validity.warnings.slice(0, 1)) {
      if (!recommendations.includes(w)) recommendations.push(w);
    }
    if (qualityScore >= 85 && recommendations.length === 0) {
      recommendations.push('Excellent response quality — results should be highly reliable');
    } else if (qualityScore >= 70 && recommendations.length === 0) {
      recommendations.push('Good response quality — results are likely reliable');
    }
    return recommendations;
  }

  reset(): void {
    this.responses.clear();
    this.timings = [];
    this.attentionCheckResults.clear();
  }

  getResponseCount(): number {
    return this.responses.size;
  }

  hasResponse(questionId: string): boolean {
    return this.responses.has(questionId);
  }
}

// Utility for rendering a human-readable quality report (used in dev tooling).
export class QualityAnalyzer {
  static generateQualityReport(metrics: DataQualityMetrics): string {
    let report = `**Response Quality Assessment**\n\n`;
    report += `**Overall Quality: ${metrics.overallQuality.toUpperCase()}** (${metrics.qualityScore}/100)\n\n`;
    if (metrics.attentionChecksTotal > 0) {
      report += `**Attention Checks:** ${metrics.attentionChecksPassed}/${metrics.attentionChecksTotal} passed (${Math.round(
        metrics.attentionCheckRate * 100
      )}%)\n\n`;
    }
    report += `**Response Validity:** ${metrics.validity.overallValidity}\n`;
    report += `**Response Time Analysis:**\n`;
    report += `- Median: ${Math.round(metrics.responseTimeStats.median / 1000)}s\n`;
    report += `- Mean: ${Math.round(metrics.responseTimeStats.mean / 1000)}s\n`;
    if (metrics.dataQualityFlags.length > 0) {
      report += `\n**Quality Flags:**\n`;
      metrics.dataQualityFlags.forEach((flag) => {
        report += `- ${flag.replace(/_/g, ' ')}\n`;
      });
    }
    if (metrics.recommendations.length > 0) {
      report += `\n**Recommendations:**\n`;
      metrics.recommendations.forEach((rec) => {
        report += `- ${rec}\n`;
      });
    }
    return report;
  }
}

export default DataQualityMonitor;