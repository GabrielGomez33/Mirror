// src/components/intake/personality/mbtiScoring.ts
import type { MBTIQuestion } from './mbtiQuestionBank';
import { mbtiTypeDescriptions, preferenceStrengthDescriptions } from './mbtiQuestionBank';

export interface MBTIPreferenceScore {
  dimension: 'EI' | 'SN' | 'TF' | 'JP';
  preferredType: 'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P';
  strength: 'very strong' | 'strong' | 'moderate' | 'slight' | 'unclear';
  rawScore: number; // Average score for preferred direction
  alternateScore: number; // Average score for alternate direction
  scoreDifference: number; // Difference between preferred and alternate
  clarity: number; // 0-100, how clear the preference is
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  interpretation: string;
}

export interface MBTIResult {
  type: string; // Four-letter type (e.g., "ENFP")
  preferences: Record<string, MBTIPreferenceScore>;
  typeDescription: string;
  overallClarity: number; // Average clarity across all dimensions
  reliabilityNote: string;
  strengthSummary: string[];
  developmentSuggestions: string[];
  validityWarnings: string[];
}

export class MBTIScorer {
  static calculateMBTIResult(
    answers: Record<string, any>,
    questions: MBTIQuestion[],
    dataQuality: number // 0-1 quality score from main assessment
  ): MBTIResult {
    const dimensions = ['EI', 'SN', 'TF', 'JP'] as const;
    const preferences: Record<string, MBTIPreferenceScore> = {};
    
    // Calculate each dimension
    for (const dimension of dimensions) {
      preferences[dimension] = this.calculatePreference(dimension, answers, questions, dataQuality);
    }

    // Determine overall type
    const type = dimensions.map(dim => preferences[dim].preferredType).join('');
    
    // Calculate overall metrics
    const overallClarity = Object.values(preferences)
      .reduce((sum, pref) => sum + pref.clarity, 0) / dimensions.length;
    
    const reliabilityNote = this.generateReliabilityNote(overallClarity, dataQuality);
    const typeDescription = mbtiTypeDescriptions[type] || 'Type description not available.';
    
    // Generate insights
    const strengthSummary = this.generateStrengthSummary(preferences);
    const developmentSuggestions = this.generateDevelopmentSuggestions(preferences);
    const validityWarnings = this.generateValidityWarnings(preferences, dataQuality);

    return {
      type,
      preferences,
      typeDescription,
      overallClarity: Math.round(overallClarity),
      reliabilityNote,
      strengthSummary,
      developmentSuggestions,
      validityWarnings
    };
  }

  private static calculatePreference(
    dimension: 'EI' | 'SN' | 'TF' | 'JP',
    answers: Record<string, any>,
    questions: MBTIQuestion[],
    dataQuality: number
  ): MBTIPreferenceScore {
    
    // Get questions for this dimension
    const dimQuestions = questions.filter(q => q.dimension === dimension);
    
    // Separate by direction
    const directions = {
      EI: ['E', 'I'],
      SN: ['S', 'N'], 
      TF: ['T', 'F'],
      JP: ['J', 'P']
    }[dimension];

    const [direction1, direction2] = directions;
    
    const dir1Questions = dimQuestions.filter(q => q.direction === direction1);
    const dir2Questions = dimQuestions.filter(q => q.direction === direction2);
    
    // Calculate average scores for each direction
    const dir1Scores = dir1Questions
      .map(q => answers[q.id]?.score)
      .filter(score => score !== undefined);
    
    const dir2Scores = dir2Questions
      .map(q => answers[q.id]?.score)
      .filter(score => score !== undefined);
    
    if (dir1Scores.length === 0 || dir2Scores.length === 0) {
      // Fallback for missing data
      return this.createUnclearPreference(dimension);
    }

    const dir1Average = dir1Scores.reduce((a, b) => a + b, 0) / dir1Scores.length;
    const dir2Average = dir2Scores.reduce((a, b) => a + b, 0) / dir2Scores.length;
    
    // Determine preferred direction and strength
    const preferredType = dir1Average >= dir2Average ? direction1 : direction2;
    const rawScore = preferredType === direction1 ? dir1Average : dir2Average;
    const alternateScore = preferredType === direction1 ? dir2Average : dir1Average;
    const scoreDifference = Math.abs(dir1Average - dir2Average);
    
    // Calculate clarity (0-100) - how clear the preference is
    // Based on score difference and consistency
    const maxDifference = 6; // Maximum possible difference on 7-point scale
    const clarityFromDifference = (scoreDifference / maxDifference) * 100;
    
    // Adjust for data quality
    const clarity = Math.round(clarityFromDifference * dataQuality);
    
    // Determine strength category
    const strength = this.categorizeStrength(clarity);
    
    // Calculate confidence interval (simplified)
    const standardError = (1 - dataQuality) * 15; // Rough estimate
    const confidenceInterval = {
      lower: Math.max(0, clarity - standardError),
      upper: Math.min(100, clarity + standardError)
    };
    
    const interpretation = this.generatePreferenceInterpretation(
      dimension, preferredType, strength
    );

    return {
      dimension,
      preferredType: preferredType as any,
      strength,
      rawScore: Math.round(rawScore * 10) / 10,
      alternateScore: Math.round(alternateScore * 10) / 10,
      scoreDifference: Math.round(scoreDifference * 10) / 10,
      clarity,
      confidenceInterval,
      interpretation
    };
  }

  private static createUnclearPreference(dimension: 'EI' | 'SN' | 'TF' | 'JP'): MBTIPreferenceScore {
    const fallbackTypes = {
      EI: 'E',
      SN: 'N', 
      TF: 'F',
      JP: 'P'
    };

    return {
      dimension,
      preferredType: fallbackTypes[dimension] as any,
      strength: 'unclear',
      rawScore: 4.0,
      alternateScore: 4.0,
      scoreDifference: 0,
      clarity: 0,
      confidenceInterval: { lower: 0, upper: 100 },
      interpretation: 'Insufficient data to determine clear preference.'
    };
  }

  private static categorizeStrength(clarity: number): MBTIPreferenceScore['strength'] {
    if (clarity >= 75) return 'very strong';
    if (clarity >= 60) return 'strong';
    if (clarity >= 40) return 'moderate';
    if (clarity >= 20) return 'slight';
    return 'unclear';
  }

  private static generatePreferenceInterpretation(
    dimension: string,
    preferredType: string,
    strength: string
  ): string {
    const preferenceNames = {
      E: 'Extraversion', I: 'Introversion',
      S: 'Sensing', N: 'Intuition', 
      T: 'Thinking', F: 'Feeling',
      J: 'Judging', P: 'Perceiving'
    };

    const prefName = preferenceNames[preferredType as keyof typeof preferenceNames];
    const strengthDesc = preferenceStrengthDescriptions[strength as keyof typeof preferenceStrengthDescriptions];
    
    const descriptions = {
      E: 'You tend to focus outward and gain energy from interacting with the external world.',
      I: 'You tend to focus inward and gain energy from your inner world of thoughts and reflections.',
      S: 'You tend to focus on concrete information and trust what you can observe directly.',
      N: 'You tend to focus on patterns, possibilities, and the bigger picture.',
      T: 'You tend to make decisions based on logical analysis and objective criteria.',
      F: 'You tend to make decisions based on values and consideration for people involved.',
      J: 'You tend to prefer structure, closure, and having things decided.',
      P: 'You tend to prefer flexibility, openness, and keeping options available.'
    };

    const baseDescription = descriptions[preferredType as keyof typeof descriptions];
    
    if (strength === 'unclear' || strength === 'slight') {
      return `Your ${dimension} preference is ${strengthDesc}, suggesting you may use both approaches depending on the situation. ${baseDescription}`;
    }
    
    return `You show a ${strengthDesc} preference for ${prefName}. ${baseDescription}`;
  }

  private static generateReliabilityNote(overallClarity: number, dataQuality: number): string {
    if (dataQuality < 0.6) {
      return 'Results should be interpreted with caution due to data quality concerns.';
    }
    
    if (overallClarity >= 70) {
      return 'Your type preferences are quite clear and the results are likely reliable.';
    } else if (overallClarity >= 50) {
      return 'Your type preferences show moderate clarity. Consider retaking if you want more definitive results.';
    } else {
      return 'Many of your preferences are unclear. You may be flexible in your approach or need more specific questions.';
    }
  }

  private static generateStrengthSummary(preferences: Record<string, MBTIPreferenceScore>): string[] {
    const strengths: string[] = [];
    
    Object.entries(preferences).forEach(([dimension, pref]) => {
      if (pref.strength === 'very strong' || pref.strength === 'strong') {
        const dimensionStrengths = {
          EI: {
            E: 'Strong social energy and external focus',
            I: 'Strong internal focus and independent thinking'
          } as const,
          SN: {
            S: 'Strong attention to practical details and concrete information',
            N: 'Strong intuitive insight and future-oriented thinking'  
          } as const,
          TF: {
            T: 'Strong logical analysis and objective decision-making',
            F: 'Strong empathy and values-based decision-making'
          } as const,
          JP: {
            J: 'Strong organizational skills and preference for closure',
            P: 'Strong adaptability and openness to new possibilities'
          } as const
        };
        
        const dimGroup = dimensionStrengths[dimension as keyof typeof dimensionStrengths];
        const strength = dimGroup?.[pref.preferredType as keyof typeof dimGroup];
        if (strength) strengths.push(strength);
      }
    });

    return strengths.slice(0, 3); // Limit to top 3 strengths
  }

  private static generateDevelopmentSuggestions(preferences: Record<string, MBTIPreferenceScore>): string[] {
    const suggestions: string[] = [];
    
    Object.entries(preferences).forEach(([dimension, pref]) => {
      if (pref.strength === 'very strong') {
        const developmentSuggestions = {
          EI: {
            E: 'Consider developing your reflection and listening skills',
            I: 'Consider developing your verbal communication and group interaction skills'
          } as const,
          SN: {
            S: 'Consider exploring big-picture thinking and future possibilities',
            N: 'Consider developing attention to practical details and implementation'
          } as const,
          TF: {
            T: 'Consider developing empathy and awareness of emotional factors',
            F: 'Consider developing analytical thinking and objective evaluation skills'
          } as const,
          JP: {
            J: 'Consider developing flexibility and spontaneity',
            P: 'Consider developing planning and organizational systems'
          } as const
        };
        
        const dimGroup = developmentSuggestions[dimension as keyof typeof developmentSuggestions];
        const suggestion = dimGroup?.[pref.preferredType as keyof typeof dimGroup];
        if (suggestion) suggestions.push(suggestion);
      }
    });

    return suggestions.slice(0, 2); // Limit to 2 suggestions
  }

  private static generateValidityWarnings(
    preferences: Record<string, MBTIPreferenceScore>, 
    dataQuality: number
  ): string[] {
    const warnings: string[] = [];
    
    const unclearCount = Object.values(preferences).filter(p => p.clarity < 30).length;
    
    if (unclearCount >= 3) {
      warnings.push('Most preferences are unclear - results may not reflect stable patterns');
    }
    
    if (dataQuality < 0.5) {
      warnings.push('Data quality issues detected - consider retaking the assessment');
    }
    
    const averageClarity = Object.values(preferences)
      .reduce((sum, pref) => sum + pref.clarity, 0) / 4;
    
    if (averageClarity < 40) {
      warnings.push('Low overall preference clarity suggests flexible or situational approaches');
    }

    return warnings;
  }
}

export default MBTIScorer;
