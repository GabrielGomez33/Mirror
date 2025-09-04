// src/components/intake/personality/integratedScoring.ts

import type { DataQualityMetrics } from './dataQualityMonitor';
import { PersonalityScorer } from './enhancedScoring';
import type { TraitScore } from './enhancedScoring';
import { MBTIScorer } from './mbtiScoring';
import type { MBTIResult } from './mbtiScoring';
import type { Question } from './scientificQuestionBank';
import type { MBTIQuestion } from './mbtiQuestionBank';

export interface ComprehensivePersonalityResult {
  // Big Five Results
  big5: {
    traits: Record<string, TraitScore>;
    overallReliability: number;
    profileReliability: 'excellent' | 'good' | 'adequate' | 'questionable';
    interpretation: {
      summary: string;
      strengths: string[];
      developmentAreas: string[];
      recommendations: string[];
    };
  };

  // MBTI Results
  mbti: MBTIResult;

  // Combined Insights
  integration: {
    combinedSummary: string;
    keyPatterns: string[];
    unifiedRecommendations: string[];
  };

  // Quality and Validity
  dataQuality: DataQualityMetrics;
  disclaimers: {
    big5: string[];
    mbti: string[];
    combined: string[];
  };
  
  // Reflection
  personalReflection?: {
    text: string;
    insights: string[];
  };
}

export class IntegratedPersonalityScorer {
  static calculateComprehensiveResult(
    answers: Record<string, any>,
    big5Questions: Question[],
    mbtiQuestions: MBTIQuestion[],
    qualityMetrics: DataQualityMetrics
  ): ComprehensivePersonalityResult {

    // Calculate Big Five profile
    const big5Profile = PersonalityScorer.calculatePersonalityProfile(
      answers, 
      big5Questions, 
      qualityMetrics
    );

    // Calculate MBTI result
    const mbtiResult = MBTIScorer.calculateMBTIResult(
      answers,
      mbtiQuestions,
      qualityMetrics.reliability
    );

    // Generate integrated insights
    const integration = this.generateIntegratedInsights(big5Profile, mbtiResult);

    // Process personal reflection if available
    const personalReflection = this.processPersonalReflection(answers);

    // Generate comprehensive disclaimers
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
        interpretation: big5Profile.interpretation
      },
      mbti: mbtiResult,
      integration,
      dataQuality: qualityMetrics,
      disclaimers,
      personalReflection
    };
  }

  private static generateIntegratedInsights(
    big5Profile: any,
    mbtiResult: MBTIResult
  ): ComprehensivePersonalityResult['integration'] {
    
    // Find connections between Big Five and MBTI results
    const patterns = this.identifyPatterns(big5Profile, mbtiResult);
    
    // Generate combined summary
    const combinedSummary = this.createCombinedSummary(big5Profile, mbtiResult, patterns);
    
    // Create unified recommendations
    const unifiedRecommendations = this.createUnifiedRecommendations(
      big5Profile.interpretation.recommendations,
      mbtiResult.developmentSuggestions,
      patterns
    );

    return {
      combinedSummary,
      keyPatterns: patterns,
      unifiedRecommendations
    };
  }

  private static identifyPatterns(big5Profile: any, mbtiResult: MBTIResult): string[] {
    const patterns: string[] = [];
    
    // Check for consistency between Big Five Extraversion and MBTI E/I
    const extraversion = big5Profile.traits.extraversion;
    const mbtiEI = mbtiResult.preferences.EI;
    
    if (extraversion && mbtiEI) {
      const isConsistent = 
        (extraversion.percentileRank > 60 && mbtiEI.preferredType === 'E') ||
        (extraversion.percentileRank < 40 && mbtiEI.preferredType === 'I');
      
      if (isConsistent) {
        patterns.push('Your Big Five extraversion and MBTI energy preference align consistently');
      } else {
        patterns.push('Interesting contrast between your Big Five social tendencies and MBTI energy preference');
      }
    }

    // Check for Openness and Intuition patterns
    const openness = big5Profile.traits.openness;
    const mbtiSN = mbtiResult.preferences.SN;
    
    if (openness && mbtiSN) {
      const isConsistent = 
        (openness.percentileRank > 60 && mbtiSN.preferredType === 'N') ||
        (openness.percentileRank < 40 && mbtiSN.preferredType === 'S');
      
      if (isConsistent) {
        patterns.push('Your creativity/openness patterns show consistency across both assessments');
      } else {
        patterns.push('You show an interesting mix of practical and creative tendencies');
      }
    }

    // Check for Agreeableness and Thinking/Feeling
    const agreeableness = big5Profile.traits.agreeableness;
    const mbtiTF = mbtiResult.preferences.TF;
    
    if (agreeableness && mbtiTF) {
      const isConsistent = 
        (agreeableness.percentileRank > 60 && mbtiTF.preferredType === 'F') ||
        (agreeableness.percentileRank < 40 && mbtiTF.preferredType === 'T');
      
      if (isConsistent) {
        patterns.push('Your decision-making style shows clear consistency between assessments');
      } else {
        patterns.push('You balance logical analysis with interpersonal consideration in decision-making');
      }
    }

    // Check for Conscientiousness and Judging/Perceiving
    const conscientiousness = big5Profile.traits.conscientiousness;
    const mbtiJP = mbtiResult.preferences.JP;
    
    if (conscientiousness && mbtiJP) {
      const isConsistent = 
        (conscientiousness.percentileRank > 60 && mbtiJP.preferredType === 'J') ||
        (conscientiousness.percentileRank < 40 && mbtiJP.preferredType === 'P');
      
      if (isConsistent) {
        patterns.push('Your organizational preferences align well across both assessment approaches');
      } else {
        patterns.push('You show flexibility in your approach to structure and planning');
      }
    }

    return patterns.slice(0, 3); // Limit to most significant patterns
  }

  private static createCombinedSummary(
    big5Profile: any,
    mbtiResult: MBTIResult,
    patterns: string[]
  ): string {
    const mbtiType = mbtiResult.type;
    const dominantBig5Trait = this.getDominantTrait(big5Profile.traits);
    
    let summary = `Your personality profile reveals a ${mbtiType} type with particularly strong ${dominantBig5Trait.name.toLowerCase()} tendencies (${dominantBig5Trait.percentile}th percentile). `;
    
    if (patterns.length > 0) {
      summary += `The assessments show ${patterns.length > 1 ? 'consistent patterns' : 'an interesting pattern'} in how you approach ${this.getPatternThemes(patterns).join(' and ')}.`;
    }
    
    return summary;
  }

  private static getDominantTrait(traits: Record<string, TraitScore>): { name: string; percentile: number } {
    const entries = Object.entries(traits);
    const dominant = entries.reduce((max, [name, trait]) => 
      trait.percentileRank > max.percentile ? { name, percentile: trait.percentileRank } : max,
      { name: entries[0][0], percentile: entries[0][1].percentileRank }
    );
    
    return dominant;
  }

  private static getPatternThemes(patterns: string[]): string[] {
    const themes: string[] = [];
    
    patterns.forEach(pattern => {
      if (pattern.includes('social') || pattern.includes('energy')) themes.push('social energy');
      if (pattern.includes('creative') || pattern.includes('practical')) themes.push('information processing');
      if (pattern.includes('decision') || pattern.includes('logical')) themes.push('decision-making');
      if (pattern.includes('organizational') || pattern.includes('structure')) themes.push('organization');
    });
    
    return [...new Set(themes)]; // Remove duplicates
  }

  private static createUnifiedRecommendations(
    big5Recommendations: string[],
    mbtiSuggestions: string[],
    patterns: string[]
  ): string[] {
    const unified: string[] = [];
    
    // Add pattern-based recommendations
    if (patterns.some(p => p.includes('contrast') || p.includes('balance'))) {
      unified.push('Your personality shows interesting contrasts - embrace this flexibility as a strength in different situations');
    }
    
    if (patterns.some(p => p.includes('consistent'))) {
      unified.push('Your consistent patterns across assessments suggest strong self-awareness - trust your instincts');
    }
    
    // Merge other recommendations, avoiding duplicates
    const allRecommendations = [...big5Recommendations, ...mbtiSuggestions];
    const uniqueRecommendations = allRecommendations.filter((rec, index) => 
      allRecommendations.findIndex(r => r.toLowerCase().includes(rec.toLowerCase().split(' ')[0])) === index
    );
    
    unified.push(...uniqueRecommendations.slice(0, 3));
    
    return unified.slice(0, 4); // Limit to 4 total recommendations
  }

  private static processPersonalReflection(answers: Record<string, any>): ComprehensivePersonalityResult['personalReflection'] | undefined {
    const reflectionAnswer = answers['reflection-essence'];
    
    if (!reflectionAnswer?.text || reflectionAnswer.text.length < 10) {
      return undefined;
    }
    
    // Simple analysis of reflection text
    const text = reflectionAnswer.text.toLowerCase();
    const insights: string[] = [];
    
    // Look for key themes
    if (text.includes('family') || text.includes('relationship')) {
      insights.push('Values close relationships and family connections');
    }
    
    if (text.includes('creative') || text.includes('art') || text.includes('music')) {
      insights.push('Identifies with creative and artistic expression');
    }
    
    if (text.includes('help') || text.includes('support') || text.includes('care')) {
      insights.push('Shows strong service orientation and care for others');
    }
    
    if (text.includes('learn') || text.includes('grow') || text.includes('knowledge')) {
      insights.push('Values learning and personal growth');
    }
    
    if (text.includes('authentic') || text.includes('genuine') || text.includes('honest')) {
      insights.push('Prioritizes authenticity and genuineness');
    }

    return {
      text: reflectionAnswer.text,
      insights: insights.slice(0, 3)
    };
  }

  private static generateComprehensiveDisclaimers(
    qualityMetrics: DataQualityMetrics,
    big5Reliability: number,
    mbtiClarity: number
  ): ComprehensivePersonalityResult['disclaimers'] {
    
    const big5Disclaimers = [
      'Big Five results are based on established personality research with good scientific support',
      'Traits represent general tendencies, not fixed characteristics',
      'Results reflect your current self-perception and may change over time'
    ];
    
    const mbtiDisclaimers = [
      'MBTI results are based on popular typology with limited scientific validation',
      'Type preferences may vary by situation and should not be considered absolute',
      'MBTI is best used for self-reflection rather than definitive categorization'
    ];
    
    const combined = [
      'Both assessments are designed for personal insight and growth, not for clinical or employment decisions',
      'No personality assessment can capture the full complexity of human personality',
      'Consider results as starting points for self-reflection rather than complete descriptions'
    ];
    
    // Add quality-specific disclaimers
    if (qualityMetrics.overallQuality === 'poor') {
      combined.unshift('⚠️ Data quality concerns detected - interpret all results with extra caution');
    }
    
    if (big5Reliability < 0.6) {
      big5Disclaimers.push('Big Five reliability is lower than ideal - consider retaking for more stable results');
    }
    
    if (mbtiClarity < 40) {
      mbtiDisclaimers.push('Many MBTI preferences are unclear - you may be flexible in your approaches');
    }

    return {
      big5: big5Disclaimers,
      mbti: mbtiDisclaimers,
      combined
    };
  }
}

export default IntegratedPersonalityScorer;
