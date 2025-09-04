// src/components/intake/personality/enhancedScoring.ts

import type { DataQualityMetrics } from './dataQualityMonitor';

export interface TraitScore {
  rawScore: number;
  scaleMean: number;
  scaleSD: number;
  percentileRank: number;
  tScore: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  reliability: number;
  interpretation: {
    level: 'very low' | 'low' | 'average' | 'high' | 'very high';
    description: string;
    percentileDescription: string;
  };
}

export interface PersonalityProfile {
  traits: Record<string, TraitScore>;
  overallReliability: number;
  profileReliability: 'excellent' | 'good' | 'adequate' | 'questionable';
  dataQuality: DataQualityMetrics;
  interpretation: {
    summary: string;
    strengths: string[];
    developmentAreas: string[];
    recommendations: string[];
  };
  disclaimers: string[];
}

// Normative data based on established Big Five research
const NORMATIVE_DATA = {
  openness: { mean: 4.0, sd: 1.1 },
  conscientiousness: { mean: 4.2, sd: 1.0 },
  extraversion: { mean: 3.8, sd: 1.2 },
  agreeableness: { mean: 4.1, sd: 0.9 },
  neuroticism: { mean: 3.5, sd: 1.3 }
};

// Trait descriptions for different levels
const TRAIT_DESCRIPTIONS = {
  openness: {
    'very low': 'You prefer familiar experiences and conventional approaches. You value tradition, practicality, and stability over novelty and creativity.',
    'low': 'You generally prefer practical, conventional approaches while occasionally being open to new experiences when they seem worthwhile.',
    'average': 'You balance openness to new experiences with preference for familiar approaches, adapting based on the situation.',
    'high': 'You enjoy exploring new ideas, experiences, and creative possibilities. You appreciate art, culture, and intellectual pursuits.',
    'very high': 'You are highly creative, intellectually curious, and constantly seeking novel experiences and abstract ideas.'
  },
  conscientiousness: {
    'very low': 'You prefer spontaneity and flexibility over structure. You may struggle with organization and following through on plans.',
    'low': 'You tend to be more spontaneous than organized, sometimes struggling with detailed planning and consistent follow-through.',
    'average': 'You balance organization with flexibility, being reliable in important areas while maintaining some spontaneity.',
    'high': 'You are well-organized, reliable, and persistent. You set goals and work steadily to achieve them.',
    'very high': 'You are exceptionally organized, disciplined, and reliable. You have strong self-control and always follow through on commitments.'
  },
  extraversion: {
    'very low': 'You strongly prefer solitude and quiet environments. You find social interaction draining and need significant alone time to recharge.',
    'low': 'You prefer smaller groups and quieter settings. While you can enjoy social interaction, you need time alone to recharge.',
    'average': 'You enjoy both social interaction and solitude, adapting your social energy to different situations.',
    'high': 'You are outgoing and social, drawing energy from interaction with others. You enjoy group activities and meeting new people.',
    'very high': 'You are highly sociable and energetic. You thrive in social situations and actively seek out interaction with others.'
  },
  agreeableness: {
    'very low': 'You prioritize your own interests and can be skeptical of others\' motives. You value honesty over harmony.',
    'low': 'You balance cooperation with asserting your own needs. You can be direct but also considerate of others.',
    'average': 'You are generally cooperative and trusting while maintaining healthy boundaries and realistic expectations.',
    'high': 'You are compassionate, trusting, and helpful. You value harmony and go out of your way to support others.',
    'very high': 'You are exceptionally empathetic, altruistic, and cooperative. You consistently put others\' needs before your own.'
  },
  neuroticism: {
    'very low': 'You are exceptionally emotionally stable and resilient. You remain calm and composed even in highly stressful situations.',
    'low': 'You are generally emotionally stable with good stress management skills. You recover quickly from setbacks.',
    'average': 'You experience normal ranges of emotions and stress, with generally adequate coping mechanisms.',
    'high': 'You are emotionally sensitive and may experience stress, anxiety, or mood fluctuations more intensely than others.',
    'very high': 'You are highly sensitive to stress and experience intense emotional reactions. You may struggle significantly with anxiety or mood regulation.'
  }
};

export class PersonalityScorer {
  // Calculate comprehensive personality profile
  static calculatePersonalityProfile(
    answers: Record<string, any>,
    questions: any[],
    qualityMetrics: DataQualityMetrics
  ): PersonalityProfile {
    const traits = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'];
    const traitScores: Record<string, TraitScore> = {};
    const reliabilities: number[] = [];

    // Calculate scores for each trait
    for (const trait of traits) {
      const traitScore = this.calculateTraitScore(trait, answers, questions, qualityMetrics.reliability);
      traitScores[trait] = traitScore;
      reliabilities.push(traitScore.reliability);
    }

    // Calculate overall reliability
    const overallReliability = reliabilities.reduce((sum, r) => sum + r, 0) / reliabilities.length;
    const profileReliability = this.categorizeReliability(overallReliability);

    // Generate interpretations
    const interpretation = this.generateProfileInterpretation(traitScores);

    return {
      traits: traitScores,
      overallReliability,
      profileReliability,
      dataQuality: qualityMetrics,
      interpretation,
      disclaimers: this.generateDisclaimers(qualityMetrics, overallReliability)
    };
  }

  private static calculateTraitScore(
    trait: string,
    answers: Record<string, any>,
    questions: any[],
    qualityReliability: number
  ): TraitScore {
    // Get questions for this trait
    const traitQuestions = questions.filter(q => 
      q.category === 'big5' && q.dimension === trait
    );

    if (traitQuestions.length === 0) {
      throw new Error(`No questions found for trait: ${trait}`);
    }

    // Calculate raw scores with reverse-keying
    const rawScores: number[] = [];
    for (const question of traitQuestions) {
      const answer = answers[question.id];
      if (answer && typeof answer.score === 'number') {
        let score = answer.score;
        // Apply reverse-keying (7-point scale: 1↔7, 2↔6, 3↔5, 4↔4)
        if (question.reverse) {
          score = 8 - score;
        }
        rawScores.push(score);
      }
    }

    if (rawScores.length === 0) {
      throw new Error(`No valid responses for trait: ${trait}`);
    }

    // Calculate trait mean
    const rawScore = rawScores.reduce((sum, score) => sum + score, 0) / rawScores.length;

    // Get normative data
    const normData = NORMATIVE_DATA[trait as keyof typeof NORMATIVE_DATA];
    
    // Calculate percentile rank using normal distribution approximation
    const zScore = (rawScore - normData.mean) / normData.sd;
    const percentileRank = this.normalCDF(zScore) * 100;
    
    // Calculate T-score (mean=50, SD=10)
    const tScore = 50 + (zScore * 10);
    
    // Estimate reliability based on number of items and quality
    const reliability = this.estimateReliability(rawScores.length, qualityReliability);
    
    // Calculate confidence interval
    const standardError = normData.sd * Math.sqrt(1 - reliability);
    const marginOfError = 1.96 * standardError; // 95% CI
    const confidenceInterval = {
      lower: Math.max(1, Math.min(99, this.normalCDF((rawScore - marginOfError - normData.mean) / normData.sd) * 100)),
      upper: Math.max(1, Math.min(99, this.normalCDF((rawScore + marginOfError - normData.mean) / normData.sd) * 100))
    };

    // Generate interpretation
    const interpretation = this.generateTraitInterpretation(trait, percentileRank);

    return {
      rawScore,
      scaleMean: normData.mean,
      scaleSD: normData.sd,
      percentileRank: Math.round(percentileRank),
      tScore: Math.round(tScore),
      confidenceInterval,
      reliability,
      interpretation
    };
  }

  // Normal cumulative distribution function approximation
  private static normalCDF(x: number): number {
    // Abramowitz and Stegun approximation
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.453152027 + t * 1.330274))));
    return x > 0 ? 1 - prob : prob;
  }

  // Estimate reliability based on test length and quality
  private static estimateReliability(numItems: number, qualityReliability: number): number {
    // Spearman-Brown prediction formula approximation
    const baseReliability = 0.65; // Typical single-item reliability
    const testLengthReliability = (numItems * baseReliability) / (1 + (numItems - 1) * baseReliability);
    
    // Adjust for data quality
    const adjustedReliability = testLengthReliability * qualityReliability;
    
    return Math.max(0.3, Math.min(0.95, adjustedReliability));
  }

  private static generateTraitInterpretation(trait: string, percentileRank: number): TraitScore['interpretation'] {
    let level: TraitScore['interpretation']['level'];
    
    if (percentileRank <= 10) level = 'very low';
    else if (percentileRank <= 30) level = 'low';
    else if (percentileRank <= 70) level = 'average';
    else if (percentileRank <= 90) level = 'high';
    else level = 'very high';

    const descriptions = TRAIT_DESCRIPTIONS[trait as keyof typeof TRAIT_DESCRIPTIONS];
    const description = descriptions[level];

    const percentileDescription = `This places you at the ${percentileRank}${this.getOrdinalSuffix(percentileRank)} percentile, meaning you score ${level === 'very low' || level === 'low' ? 'lower' : level === 'average' ? 'similarly to' : 'higher'} than ${level === 'very low' ? '90%' : level === 'low' ? '70%' : level === 'average' ? 'most people' : level === 'high' ? '70%' : '90%'} of people on this trait.`;

    return {
      level,
      description,
      percentileDescription
    };
  }

  private static getOrdinalSuffix(n: number): string {
    const j = n % 10;
    const k = n % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  }

  private static categorizeReliability(reliability: number): PersonalityProfile['profileReliability'] {
    if (reliability >= 0.85) return 'excellent';
    if (reliability >= 0.75) return 'good';
    if (reliability >= 0.60) return 'adequate';
    return 'questionable';
  }

  private static generateProfileInterpretation(
    traitScores: Record<string, TraitScore>
  ): PersonalityProfile['interpretation'] {
    const traits = Object.entries(traitScores);
    
    // Identify strengths (high scores) and development areas (low scores)
    const strengths = traits
      .filter(([_, score]) => score.interpretation.level === 'high' || score.interpretation.level === 'very high')
      .map(([trait, score]) => this.formatStrengthDescription(trait, score.interpretation.level));
    
    const developmentAreas = traits
      .filter(([_, score]) => score.interpretation.level === 'low' || score.interpretation.level === 'very low')
      .map(([trait, score]) => this.formatDevelopmentDescription(trait, score.interpretation.level));

    // Generate summary
    const summary = this.generateProfileSummary(traitScores);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(traitScores);

    return {
      summary,
      strengths,
      developmentAreas,
      recommendations
    };
  }

  private static formatStrengthDescription(trait: string, level: string): string {
    const traitName = trait.charAt(0).toUpperCase() + trait.slice(1);
    const levelDescription = level === 'very high' ? 'exceptional' : 'strong';
    
    const strengthMappings: Record<string, string> = {
      openness: `${levelDescription} creativity and intellectual curiosity`,
      conscientiousness: `${levelDescription} organization and self-discipline`,
      extraversion: `${levelDescription} social energy and assertiveness`,
      agreeableness: `${levelDescription} empathy and cooperation`,
      neuroticism: level === 'very high' ? 'high emotional sensitivity (may need support)' : 'emotional sensitivity and depth'
    };
    
    return strengthMappings[trait] || `${levelDescription} ${traitName.toLowerCase()}`;
  }

  private static formatDevelopmentDescription(trait: string, _level: string): string {
    const developmentMappings: Record<string, string> = {
      openness: `Consider exploring new experiences and creative activities`,
      conscientiousness: `Focus on developing organizational systems and follow-through habits`,
      extraversion: `Practice social skills if desired, while honoring your preference for quieter environments`,
      agreeableness: `Balance assertiveness with cooperation in relationships`,
      neuroticism: `Excellent emotional stability - a significant strength`
    };
    
    return developmentMappings[trait] || `Consider developing ${trait} skills`;
  }

  private static generateProfileSummary(traitScores: Record<string, TraitScore>): string {
    const traits = Object.entries(traitScores);
    const dominantTrait = traits.reduce((max, [trait, score]) => 
      score.percentileRank > max[1].percentileRank ? [trait, score] : max
    );
    
    const traitName = dominantTrait[0].charAt(0).toUpperCase() + dominantTrait[0].slice(1);
    
    return `Your personality profile shows ${traitName.toLowerCase()} as your most prominent trait (${dominantTrait[1].percentileRank}th percentile). This suggests a personality style characterized by ${dominantTrait[1].interpretation.description.toLowerCase().substring(0, 100)}...`;
  }

  private static generateRecommendations(traitScores: Record<string, TraitScore>): string[] {
    const recommendations: string[] = [];
    
    // Add trait-specific recommendations based on scores
    Object.entries(traitScores).forEach(([trait, score]) => {
      if (score.interpretation.level === 'very high' || score.interpretation.level === 'very low') {
        recommendations.push(this.getTraitRecommendation(trait, score.interpretation.level));
      }
    });
    
    // Add general recommendations
    recommendations.push('Consider sharing these results with trusted friends or mentors for their perspective');
    recommendations.push('Remember that personality can evolve over time with conscious effort and new experiences');
    
    return recommendations.slice(0, 5); // Limit to 5 recommendations
  }

  private static getTraitRecommendation(trait: string, level: string): string {
    const recommendations: Record<string, Record<string, string>> = {
      openness: {
        'very high': 'Channel your creativity into meaningful projects and be patient with others who prefer more conventional approaches',
        'very low': 'Try incorporating small new experiences into your routine to gradually expand your comfort zone'
      },
      conscientiousness: {
        'very high': 'Remember to balance your high standards with flexibility and self-compassion',
        'very low': 'Start with small, achievable organizational systems to build momentum gradually'
      },
      extraversion: {
        'very high': 'Make sure to include some quiet reflection time in your busy social schedule',
        'very low': 'Honor your need for solitude while maintaining important social connections'
      },
      agreeableness: {
        'very high': 'Practice asserting your own needs and boundaries in relationships',
        'very low': 'Consider how your direct approach affects others and look for opportunities to show empathy'
      },
      neuroticism: {
        'very high': 'Develop stress management techniques and consider professional support if needed',
        'very low': 'Your emotional stability is a great asset - use it to support others during difficult times'
      }
    };
    
    return recommendations[trait]?.[level] || `Consider how your ${trait} level affects your daily life and relationships`;
  }

  private static generateDisclaimers(
    qualityMetrics: DataQualityMetrics,
    reliability: number
  ): string[] {
    const disclaimers = [
      'This assessment is for personal insight and exploration only, not for clinical or employment decisions',
      'Personality traits exist on a spectrum and can change over time with experience and effort',
      'Results reflect your current self-perception and may vary based on your mood or recent experiences'
    ];

    if (qualityMetrics.overallQuality === 'poor' || reliability < 0.60) {
      disclaimers.unshift('⚠️ Data quality concerns detected - results should be interpreted with caution');
    }

    if (reliability < 0.75) {
      disclaimers.push('Consider retaking the assessment for more reliable results');
    }

    return disclaimers;
  }
}

export default PersonalityScorer;
