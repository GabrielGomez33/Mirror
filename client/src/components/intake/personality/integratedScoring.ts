// src/components/intake/personality/integratedScoring.ts
//
// Orchestrates the Big Five and MBTI engines into a single comprehensive result
// and weaves in response-validity signal so disclaimers and summaries reflect
// how much the data can actually be trusted.

import type { DataQualityMetrics } from './dataQualityMonitor';
import { PersonalityScorer } from './enhancedScoring';
import type { TraitScore, PersonalityProfile } from './enhancedScoring';
import { MBTIScorer } from './mbtiScoring';
import type { MBTIResult } from './mbtiScoring';
import type { Question } from './scientificQuestionBank';
import type { MBTIQuestion } from './mbtiQuestionBank';
import type { ValidityProfile } from './validityScales';
import { ordinalSuffix } from './psychometricNorms';
import type { AnswerMap } from './types';

export interface ComprehensivePersonalityResult {
  big5: {
    traits: Record<string, TraitScore>;
    overallReliability: number;
    profileReliability: 'excellent' | 'good' | 'adequate' | 'questionable';
    overallConsistency: number;
    interpretation: {
      summary: string;
      strengths: string[];
      developmentAreas: string[];
      recommendations: string[];
    };
  };
  mbti: MBTIResult;
  integration: {
    combinedSummary: string;
    keyPatterns: string[];
    unifiedRecommendations: string[];
  };
  dataQuality: DataQualityMetrics;
  /** Content-based response validity (surfaced from dataQuality for convenience). */
  validity: ValidityProfile;
  disclaimers: {
    big5: string[];
    mbti: string[];
    combined: string[];
  };
  personalReflection?: {
    text: string;
    insights: string[];
  };
}

const REFLECTION_MIN_LENGTH = 20;

export class IntegratedPersonalityScorer {
  static calculateComprehensiveResult(
    answers: AnswerMap,
    big5Questions: Question[],
    mbtiQuestions: MBTIQuestion[],
    qualityMetrics: DataQualityMetrics
  ): ComprehensivePersonalityResult {
    const big5Profile = PersonalityScorer.calculatePersonalityProfile(
      answers,
      big5Questions,
      qualityMetrics
    );

    const mbtiResult = MBTIScorer.calculateMBTIResult(
      answers,
      mbtiQuestions,
      qualityMetrics.reliability
    );

    const integration = this.generateIntegratedInsights(big5Profile, mbtiResult);
    const personalReflection = this.processPersonalReflection(answers);
    const disclaimers = this.generateComprehensiveDisclaimers(
      qualityMetrics,
      big5Profile.overallReliability,
      mbtiResult.overallClarity
    );

    return {
      big5: {
        traits: big5Profile.traits,
        overallReliability: big5Profile.overallReliability,
        profileReliability: big5Profile.profileReliability,
        overallConsistency: big5Profile.overallConsistency,
        interpretation: big5Profile.interpretation,
      },
      mbti: mbtiResult,
      integration,
      dataQuality: qualityMetrics,
      validity: qualityMetrics.validity,
      disclaimers,
      personalReflection,
    };
  }

  private static generateIntegratedInsights(
    big5Profile: PersonalityProfile,
    mbtiResult: MBTIResult
  ): ComprehensivePersonalityResult['integration'] {
    const patterns = this.identifyPatterns(big5Profile, mbtiResult);
    const combinedSummary = this.createCombinedSummary(big5Profile, mbtiResult, patterns);
    const unifiedRecommendations = this.createUnifiedRecommendations(
      big5Profile.interpretation.recommendations,
      mbtiResult.developmentSuggestions,
      patterns
    );
    return { combinedSummary, keyPatterns: patterns, unifiedRecommendations };
  }

  private static identifyPatterns(
    big5Profile: PersonalityProfile,
    mbtiResult: MBTIResult
  ): string[] {
    const patterns: string[] = [];

    const checks: Array<{
      trait: keyof typeof big5Profile.traits;
      dim: 'EI' | 'SN' | 'TF' | 'JP';
      highLetter: string;
      lowLetter: string;
      consistentMsg: string;
      contrastMsg: string;
    }> = [
      { trait: 'extraversion', dim: 'EI', highLetter: 'E', lowLetter: 'I',
        consistentMsg: 'Your Big Five extraversion and MBTI energy preference align consistently',
        contrastMsg: 'An interesting contrast appears between your Big Five social tendencies and your MBTI energy preference' },
      { trait: 'openness', dim: 'SN', highLetter: 'N', lowLetter: 'S',
        consistentMsg: 'Your openness/creativity patterns show consistency across both assessments',
        contrastMsg: 'You show an interesting mix of practical and creative tendencies' },
      { trait: 'agreeableness', dim: 'TF', highLetter: 'F', lowLetter: 'T',
        consistentMsg: 'Your decision-making style shows clear consistency between assessments',
        contrastMsg: 'You balance logical analysis with interpersonal consideration in decisions' },
      { trait: 'conscientiousness', dim: 'JP', highLetter: 'J', lowLetter: 'P',
        consistentMsg: 'Your organizational preferences align well across both approaches',
        contrastMsg: 'You show flexibility in your approach to structure and planning' },
    ];

    for (const c of checks) {
      const trait = big5Profile.traits[c.trait];
      const pref = mbtiResult.preferences[c.dim];
      if (!trait || !pref || pref.borderline) continue; // skip unstable comparisons
      const consistent =
        (trait.percentileRank > 60 && pref.preferredType === c.highLetter) ||
        (trait.percentileRank < 40 && pref.preferredType === c.lowLetter);
      patterns.push(consistent ? c.consistentMsg : c.contrastMsg);
    }

    return patterns.slice(0, 3);
  }

  private static createCombinedSummary(
    big5Profile: PersonalityProfile,
    mbtiResult: MBTIResult,
    patterns: string[]
  ): string {
    const dominant = this.getDominantTrait(big5Profile.traits);
    const typePhrase = mbtiResult.hasBorderlinePreferences
      ? `a personality type close to ${mbtiResult.type} (with some balanced preferences)`
      : `a ${mbtiResult.type} type`;

    let summary = `Your profile reveals ${typePhrase} with particularly strong ${dominant.name.toLowerCase()} tendencies (${dominant.percentile}${ordinalSuffix(
      dominant.percentile
    )} percentile). `;

    if (patterns.length > 0) {
      summary += `The two assessments show ${
        patterns.length > 1 ? 'consistent patterns' : 'an interesting pattern'
      } in how you approach ${this.getPatternThemes(patterns).join(' and ')}.`;
    } else if (mbtiResult.hasBorderlinePreferences) {
      summary += `Several preferences sit close to the middle, suggesting flexibility rather than fixed tendencies.`;
    }
    return summary;
  }

  private static getDominantTrait(
    traits: Record<string, TraitScore>
  ): { name: string; percentile: number } {
    const entries = Object.entries(traits);
    if (!entries.length) return { name: 'balance', percentile: 50 };
    const [name, trait] = entries.reduce((max, cur) =>
      cur[1].percentileRank > max[1].percentileRank ? cur : max
    );
    return { name, percentile: trait.percentileRank };
  }

  private static getPatternThemes(patterns: string[]): string[] {
    const themes: string[] = [];
    patterns.forEach((p) => {
      if (p.includes('social') || p.includes('energy')) themes.push('social energy');
      if (p.includes('creative') || p.includes('practical')) themes.push('information processing');
      if (p.includes('decision') || p.includes('logical')) themes.push('decision-making');
      if (p.includes('organizational') || p.includes('structure') || p.includes('planning'))
        themes.push('organization');
    });
    return themes.length ? [...new Set(themes)] : ['several areas'];
  }

  private static createUnifiedRecommendations(
    big5Recommendations: string[],
    mbtiSuggestions: string[],
    patterns: string[]
  ): string[] {
    const unified: string[] = [];
    if (patterns.some((p) => p.includes('contrast') || p.includes('balance'))) {
      unified.push('Your personality shows interesting contrasts — embrace this flexibility as a strength across different situations');
    }
    if (patterns.some((p) => p.includes('consistency') || p.includes('consistent'))) {
      unified.push('Consistent patterns across both assessments suggest strong self-awareness — trust your instincts');
    }

    const all = [...big5Recommendations, ...mbtiSuggestions];
    const unique = all.filter(
      (rec, index) =>
        all.findIndex((r) => r.toLowerCase().includes(rec.toLowerCase().split(' ')[0])) === index
    );
    unified.push(...unique.slice(0, 3));
    return unified.slice(0, 4);
  }

  private static processPersonalReflection(
    answers: AnswerMap
  ): ComprehensivePersonalityResult['personalReflection'] | undefined {
    const reflectionAnswer = answers?.['reflection-essence'];
    const text: string | undefined = reflectionAnswer?.text;
    if (!text || typeof text !== 'string' || text.trim().length < REFLECTION_MIN_LENGTH) {
      return undefined;
    }

    const lower = text.toLowerCase();
    const insights: string[] = [];
    const themeMap: Array<{ keys: string[]; insight: string }> = [
      { keys: ['family', 'relationship', 'friend'], insight: 'Values close relationships and connection' },
      { keys: ['creative', 'art', 'music', 'write', 'design'], insight: 'Identifies with creative and artistic expression' },
      { keys: ['help', 'support', 'care', 'give'], insight: 'Shows a strong service orientation and care for others' },
      { keys: ['learn', 'grow', 'knowledge', 'curious'], insight: 'Values learning and personal growth' },
      { keys: ['authentic', 'genuine', 'honest', 'true'], insight: 'Prioritizes authenticity and genuineness' },
    ];
    for (const t of themeMap) {
      if (t.keys.some((k) => lower.includes(k))) insights.push(t.insight);
    }

    return { text: text.trim(), insights: insights.slice(0, 3) };
  }

  private static generateComprehensiveDisclaimers(
    qualityMetrics: DataQualityMetrics,
    big5Reliability: number,
    mbtiClarity: number
  ): ComprehensivePersonalityResult['disclaimers'] {
    const big5: string[] = [
      'Big Five results are grounded in established personality research with strong scientific support',
      'Traits represent general tendencies, not fixed characteristics',
      'Percentiles are estimated against published reference norms (BFI-2) and may shift with mood or context',
    ];
    const mbti: string[] = [
      'MBTI results are based on a popular typology with limited scientific validation',
      'Type preferences can vary by situation and should not be treated as absolute',
      'MBTI is best used for self-reflection rather than definitive categorization',
    ];
    const combined: string[] = [
      'Both assessments are for personal insight and growth, not for clinical or employment decisions',
      'No assessment can capture the full complexity of a person',
      'Treat these results as a starting point for reflection rather than a complete description',
    ];

    const validity = qualityMetrics?.validity;
    if (validity && (validity.overallValidity === 'invalid' || validity.overallValidity === 'questionable')) {
      combined.unshift('⚠️ Response patterns reduced our confidence in these results — interpret them cautiously and consider retaking');
    } else if (qualityMetrics?.overallQuality === 'poor') {
      combined.unshift('⚠️ Data-quality concerns were detected — interpret all results with extra caution');
    }
    if (big5Reliability < 0.6) {
      big5.push('Big Five reliability is lower than ideal for this protocol — consider retaking for a more stable profile');
    }
    if (mbtiClarity < 40) {
      mbti.push('Many MBTI preferences are close to balanced — you may be flexible across these styles');
    }
    return { big5, mbti, combined };
  }
}

export default IntegratedPersonalityScorer;