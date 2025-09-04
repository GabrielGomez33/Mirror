// src/components/intake/personality/personalityResultAdapter.ts
// Adapts comprehensive results to existing PersonalityResult interface

import type { ComprehensivePersonalityResult } from './integratedScoring';

// Your existing PersonalityResult interface (keeping it unchanged)
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

export class PersonalityResultAdapter {
  /**
   * Converts comprehensive personality results to the existing PersonalityResult format
   * This ensures backward compatibility with your existing IntakeContext and other components
   */
  static adaptToExistingFormat(
    comprehensiveResult: ComprehensivePersonalityResult
  ): PersonalityResult {
    // Convert Big Five traits to simple percentages (your existing format)
    const big5Profile = {
      openness: comprehensiveResult.big5.traits.openness?.percentileRank || 50,
      conscientiousness: comprehensiveResult.big5.traits.conscientiousness?.percentileRank || 50,
      extraversion: comprehensiveResult.big5.traits.extraversion?.percentileRank || 50,
      agreeableness: comprehensiveResult.big5.traits.agreeableness?.percentileRank || 50,
      neuroticism: comprehensiveResult.big5.traits.neuroticism?.percentileRank || 50
    };

    // Get MBTI type
    const mbtiType = comprehensiveResult.mbti.type;

    // Extract dominant traits from both assessments
    const dominantTraits: string[] = [];
    
    // Add Big Five strengths
    Object.entries(comprehensiveResult.big5.traits).forEach(([trait, score]) => {
      if (score.percentileRank >= 75) {
        const traitMappings: Record<string, string> = {
          openness: 'Creative & Open-minded',
          conscientiousness: 'Organized & Reliable',
          extraversion: 'Outgoing & Energetic',
          agreeableness: 'Compassionate & Cooperative',
          neuroticism: 'Sensitive & Reflective'
        };
        const mappedTrait = traitMappings[trait];
        if (mappedTrait) dominantTraits.push(mappedTrait);
      }
    });

    // Add emotional stability if neuroticism is low
    if (comprehensiveResult.big5.traits.neuroticism?.percentileRank <= 25) {
      dominantTraits.push('Emotionally Stable');
    }

    // Add MBTI strengths from the comprehensive results
    comprehensiveResult.mbti.strengthSummary.forEach(strength => {
      if (!dominantTraits.some(trait => trait.toLowerCase().includes(strength.toLowerCase().split(' ')[0]))) {
        dominantTraits.push(strength);
      }
    });

    // Combine MBTI description with key insights
    let description = comprehensiveResult.mbti.typeDescription;
    
    // Add reliability context if there are quality concerns
    if (comprehensiveResult.dataQuality.overallQuality === 'poor') {
      description += ' Note: Results should be interpreted with caution due to response quality concerns.';
    } else if (comprehensiveResult.big5.overallReliability < 0.7) {
      description += ' Results show moderate reliability - consider as general tendencies.';
    }

    return {
      big5Profile,
      mbtiType,
      dominantTraits: dominantTraits.slice(0, 5), // Limit to 5 traits to match existing expectations
      description
    };
  }

  /**
   * Creates a detailed summary that can be stored separately if needed
   * This preserves the rich information while maintaining compatibility
   */
  static createDetailedSummary(
    comprehensiveResult: ComprehensivePersonalityResult
  ): {
    qualityMetrics: any;
    detailedInsights: string[];
    unifiedRecommendations: string[];
    reliabilityInfo: string;
  } {
    return {
      qualityMetrics: {
        overallQuality: comprehensiveResult.dataQuality.overallQuality,
        qualityScore: comprehensiveResult.dataQuality.qualityScore,
        big5Reliability: Math.round(comprehensiveResult.big5.overallReliability * 100),
        mbtiClarity: comprehensiveResult.mbti.overallClarity
      },
      detailedInsights: [
        comprehensiveResult.integration.combinedSummary,
        ...comprehensiveResult.integration.keyPatterns
      ],
      unifiedRecommendations: comprehensiveResult.integration.unifiedRecommendations,
      reliabilityInfo: `Big Five reliability: ${Math.round(comprehensiveResult.big5.overallReliability * 100)}%, MBTI clarity: ${comprehensiveResult.mbti.overallClarity}%`
    };
  }
}
