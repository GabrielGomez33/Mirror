// src/components/intake/personality/personalityResultAdapter.ts
//
// Adapts the rich ComprehensivePersonalityResult down to the EXACT legacy
// PersonalityResult shape that the rest of the app, mirror-server validation,
// and the Dina mirror module depend on. This contract is intentionally frozen:
//   big5Profile: 5 numeric percentiles (0–100), mbtiType: 4-char string,
//   dominantTraits: string[], description: string.
// Do not change these field names/types without coordinating a backend change.

import type { ComprehensivePersonalityResult } from './integratedScoring';
import type { TraitScore } from './enhancedScoring';

export interface PersonalityResult {
  big5Profile: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  };
  mbtiType: string;
  dominantTraits: string[];
  description: string;
}

const MBTI_PATTERN = /^[EI][SN][TF][JP]$/;

export class PersonalityResultAdapter {
  /** Convert to the frozen legacy format consumed across the ecosystem. */
  static adaptToExistingFormat(
    comprehensiveResult: ComprehensivePersonalityResult
  ): PersonalityResult {
    const traits: Record<string, TraitScore> = comprehensiveResult?.big5?.traits ?? {};
    const pct = (t: string): number => this.clampPercentile(traits[t]?.percentileRank);

    const big5Profile = {
      openness: pct('openness'),
      conscientiousness: pct('conscientiousness'),
      extraversion: pct('extraversion'),
      agreeableness: pct('agreeableness'),
      neuroticism: pct('neuroticism'),
    };

    const mbtiType = this.sanitizeMbtiType(comprehensiveResult?.mbti?.type);

    const dominantTraits = this.buildDominantTraits(comprehensiveResult);
    const description = this.buildDescription(comprehensiveResult);

    return { big5Profile, mbtiType, dominantTraits, description };
  }

  private static clampPercentile(value: unknown): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return 50;
    return Math.round(Math.max(0, Math.min(100, n)));
  }

  /**
   * Guarantee a valid 4-letter MBTI type. The scorer already produces one, but
   * mirror-server hard-validates `length === 4`, so we defend the contract here.
   */
  private static sanitizeMbtiType(type: unknown): string {
    const candidate = String(type ?? '').toUpperCase().trim();
    if (MBTI_PATTERN.test(candidate)) return candidate;
    // Rebuild from any salvageable letters, else fall back to a neutral type.
    const slots: Array<[string, string]> = [['E', 'I'], ['S', 'N'], ['T', 'F'], ['J', 'P']];
    let rebuilt = '';
    for (let i = 0; i < 4; i++) {
      const ch = candidate[i];
      rebuilt += ch === slots[i][0] || ch === slots[i][1] ? ch : slots[i][0];
    }
    return MBTI_PATTERN.test(rebuilt) ? rebuilt : 'ENFP';
  }

  private static buildDominantTraits(
    comprehensiveResult: ComprehensivePersonalityResult
  ): string[] {
    const dominantTraits: string[] = [];
    const traits: Record<string, TraitScore> = comprehensiveResult?.big5?.traits ?? {};

    const traitMappings: Record<string, string> = {
      openness: 'Creative & Open-minded',
      conscientiousness: 'Organized & Reliable',
      extraversion: 'Outgoing & Energetic',
      agreeableness: 'Compassionate & Cooperative',
      neuroticism: 'Sensitive & Reflective',
    };

    Object.entries(traits).forEach(([trait, score]) => {
      if (Number(score?.percentileRank) >= 75 && traitMappings[trait]) {
        dominantTraits.push(traitMappings[trait]);
      }
    });

    if (Number(traits?.neuroticism?.percentileRank) <= 25) {
      dominantTraits.push('Emotionally Stable');
    }

    (comprehensiveResult?.mbti?.strengthSummary ?? []).forEach((strength: string) => {
      const firstWord = strength.toLowerCase().split(' ')[0];
      if (!dominantTraits.some((t) => t.toLowerCase().includes(firstWord))) {
        dominantTraits.push(strength);
      }
    });

    return dominantTraits.slice(0, 5);
  }

  private static buildDescription(
    comprehensiveResult: ComprehensivePersonalityResult
  ): string {
    let description = comprehensiveResult?.mbti?.typeDescription || 'Personality profile generated.';

    const validity = comprehensiveResult?.validity?.overallValidity;
    if (validity === 'invalid' || validity === 'questionable') {
      description += ' Note: response patterns reduced confidence in these results — consider retaking.';
    } else if (comprehensiveResult?.dataQuality?.overallQuality === 'poor') {
      description += ' Note: results should be interpreted with caution due to response-quality concerns.';
    } else if (Number(comprehensiveResult?.big5?.overallReliability) < 0.7) {
      description += ' Results show moderate reliability — consider them as general tendencies.';
    }
    if (comprehensiveResult?.mbti?.hasBorderlinePreferences) {
      const alts = comprehensiveResult.mbti.alternateTypes ?? [];
      if (alts.length) description += ` You may also relate to ${alts.join(', ')}.`;
    }
    return description;
  }

  /**
   * Rich, NON-transmitted summary for client-side display / future use.
   * Safe to extend freely — it is not part of the backend wire contract.
   */
  static createDetailedSummary(comprehensiveResult: ComprehensivePersonalityResult): {
    qualityMetrics: Record<string, unknown>;
    detailedInsights: string[];
    unifiedRecommendations: string[];
    reliabilityInfo: string;
    validity: Record<string, unknown>;
  } {
    const big5 = comprehensiveResult?.big5;
    const validity = comprehensiveResult?.validity;
    return {
      qualityMetrics: {
        overallQuality: comprehensiveResult?.dataQuality?.overallQuality,
        qualityScore: comprehensiveResult?.dataQuality?.qualityScore,
        big5Reliability: Math.round((big5?.overallReliability ?? 0) * 100),
        big5Consistency: Math.round((big5?.overallConsistency ?? 0) * 100),
        mbtiClarity: comprehensiveResult?.mbti?.overallClarity,
      },
      detailedInsights: [
        comprehensiveResult?.integration?.combinedSummary,
        ...(comprehensiveResult?.integration?.keyPatterns ?? []),
      ].filter(Boolean) as string[],
      unifiedRecommendations: comprehensiveResult?.integration?.unifiedRecommendations ?? [],
      reliabilityInfo: `Big Five reliability: ${Math.round(
        (big5?.overallReliability ?? 0) * 100
      )}%, MBTI clarity: ${comprehensiveResult?.mbti?.overallClarity ?? 0}%`,
      validity: {
        verdict: validity?.overallValidity,
        flags: validity?.flags ?? [],
        warnings: validity?.warnings ?? [],
        borderlineDimensions: comprehensiveResult?.mbti?.borderlineDimensions ?? [],
      },
    };
  }
}

export default PersonalityResultAdapter;