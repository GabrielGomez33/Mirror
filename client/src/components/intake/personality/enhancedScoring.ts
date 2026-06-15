// src/components/intake/personality/enhancedScoring.ts
//
// Big Five scoring engine. Design goals:
//   1. Legitimacy   — scores anchored to documented norms (see psychometricNorms)
//                     via scale-independent POMP transformation.
//   2. Honest error — reliability is estimated per-respondent from response
//                     consistency and data quality, capped at the published
//                     instrument reliability; confidence intervals use a real
//                     standard error of measurement (SEM = SD·√(1−reliability)).
//   3. Robustness   — never throws. Missing/sparse/garbage input degrades
//                     gracefully to a flagged, low-confidence neutral score.

import type { DataQualityMetrics } from './dataQualityMonitor';
import {
  BIG5_TRAITS,
  BIG5_NORMS,
  LIKERT_MIN,
  LIKERT_MAX,
  MAX_LIKERT_SD,
  RELIABILITY_FLOOR,
  PERCENTILE_FLOOR,
  PERCENTILE_CEILING,
  clamp,
  mean,
  standardDeviation,
  toPOMP,
  percentileFromPOMP,
  zFromPOMP,
  tScoreFromZ,
  ordinalSuffix,
} from './psychometricNorms';
import type { Big5Trait, TraitNorm } from './psychometricNorms';
import type { AnswerMap, AssessmentAnswer } from './types';

export interface TraitScore {
  /** Mean of the (reverse-keyed) item responses on the 1–7 scale. */
  rawScore: number;
  /** rawScore expressed in Percent-Of-Maximum-Possible (0–100). */
  pompScore: number;
  /** Reference norm mean (POMP units). */
  scaleMean: number;
  /** Reference norm SD (POMP units). */
  scaleSD: number;
  percentileRank: number;
  tScore: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  /** Estimated reliability for THIS protocol (≤ published instrument alpha). */
  reliability: number;
  /** 0–1 agreement among same-trait items after reverse-keying. */
  withinPersonConsistency: number;
  /** Number of valid item responses contributing to this trait. */
  itemsAnswered: number;
  interpretation: {
    level: 'very low' | 'low' | 'average' | 'high' | 'very high';
    description: string;
    percentileDescription: string;
  };
  /** Non-fatal data issues for this trait (e.g., 'insufficient_data'). */
  flags: string[];
}

export interface PersonalityProfile {
  traits: Record<string, TraitScore>;
  overallReliability: number;
  profileReliability: 'excellent' | 'good' | 'adequate' | 'questionable';
  /** Mean within-person consistency across the five domains (0–1). */
  overallConsistency: number;
  dataQuality: DataQualityMetrics;
  interpretation: {
    summary: string;
    strengths: string[];
    developmentAreas: string[];
    recommendations: string[];
  };
  disclaimers: string[];
}

const TRAIT_DESCRIPTIONS: Record<Big5Trait, Record<TraitScore['interpretation']['level'], string>> = {
  openness: {
    'very low': 'You prefer familiar experiences and conventional approaches. You value tradition, practicality, and stability over novelty and creativity.',
    'low': 'You generally prefer practical, conventional approaches while occasionally being open to new experiences when they seem worthwhile.',
    'average': 'You balance openness to new experiences with a preference for familiar approaches, adapting based on the situation.',
    'high': 'You enjoy exploring new ideas, experiences, and creative possibilities. You appreciate art, culture, and intellectual pursuits.',
    'very high': 'You are highly creative, intellectually curious, and constantly seeking novel experiences and abstract ideas.',
  },
  conscientiousness: {
    'very low': 'You prefer spontaneity and flexibility over structure. You may find detailed organization and consistent follow-through challenging.',
    'low': 'You tend to be more spontaneous than organized, sometimes finding detailed planning and consistent follow-through challenging.',
    'average': 'You balance organization with flexibility, being reliable in important areas while maintaining some spontaneity.',
    'high': 'You are well-organized, reliable, and persistent. You set goals and work steadily to achieve them.',
    'very high': 'You are exceptionally organized, disciplined, and reliable. You have strong self-control and consistently follow through on commitments.',
  },
  extraversion: {
    'very low': 'You strongly prefer solitude and quiet environments. You find sustained social interaction draining and need significant alone time to recharge.',
    'low': 'You prefer smaller groups and quieter settings. While you can enjoy social interaction, you need time alone to recharge.',
    'average': 'You enjoy both social interaction and solitude, adapting your social energy to different situations.',
    'high': 'You are outgoing and social, drawing energy from interaction with others. You enjoy group activities and meeting new people.',
    'very high': 'You are highly sociable and energetic. You thrive in social situations and actively seek out interaction with others.',
  },
  agreeableness: {
    'very low': 'You prioritize your own perspective and can be skeptical of others\' motives. You tend to value candor over harmony.',
    'low': 'You balance cooperation with asserting your own needs. You can be direct while still being considerate of others.',
    'average': 'You are generally cooperative and trusting while maintaining healthy boundaries and realistic expectations.',
    'high': 'You are compassionate, trusting, and helpful. You value harmony and go out of your way to support others.',
    'very high': 'You are exceptionally empathetic, altruistic, and cooperative. You consistently consider others\' needs alongside your own.',
  },
  neuroticism: {
    'very low': 'You are exceptionally emotionally stable and resilient. You tend to remain calm and composed even in highly stressful situations.',
    'low': 'You are generally emotionally stable with good stress-management skills. You tend to recover quickly from setbacks.',
    'average': 'You experience a normal range of emotions and stress, with generally adequate coping mechanisms.',
    'high': 'You are emotionally sensitive and may experience stress, worry, or mood fluctuations more intensely than others.',
    'very high': 'You are highly sensitive to stress and may experience intense emotional reactions, including significant anxiety or mood changes.',
  },
};

interface MinimalQuestion {
  id: string;
  category?: string;
  dimension?: string;
  reverse?: boolean;
}

export class PersonalityScorer {
  static calculatePersonalityProfile(
    answers: AnswerMap,
    questions: MinimalQuestion[],
    qualityMetrics: DataQualityMetrics
  ): PersonalityProfile {
    const safeAnswers = answers || {};
    const safeQuestions = Array.isArray(questions) ? questions : [];
    const qualityReliability = clamp(qualityMetrics?.reliability ?? 0.6, 0, 1);

    const traitScores: Record<string, TraitScore> = {};
    const reliabilities: number[] = [];
    const consistencies: number[] = [];

    for (const trait of BIG5_TRAITS) {
      const traitScore = this.calculateTraitScore(
        trait,
        safeAnswers,
        safeQuestions,
        qualityReliability
      );
      traitScores[trait] = traitScore;
      reliabilities.push(traitScore.reliability);
      consistencies.push(traitScore.withinPersonConsistency);
    }

    const overallReliability = reliabilities.length ? mean(reliabilities) : RELIABILITY_FLOOR;
    const overallConsistency = consistencies.length ? mean(consistencies) : 0;
    const profileReliability = this.categorizeReliability(overallReliability);
    const interpretation = this.generateProfileInterpretation(traitScores);

    return {
      traits: traitScores,
      overallReliability,
      profileReliability,
      overallConsistency,
      dataQuality: qualityMetrics,
      interpretation,
      disclaimers: this.generateDisclaimers(qualityMetrics, overallReliability),
    };
  }

  private static calculateTraitScore(
    trait: Big5Trait,
    answers: AnswerMap,
    questions: MinimalQuestion[],
    qualityReliability: number
  ): TraitScore {
    const norm = BIG5_NORMS[trait];
    const traitQuestions = questions.filter(
      (q) => q.category === 'big5' && q.dimension === trait
    );

    // Collect reverse-keyed, validated item scores.
    const keyedScores: number[] = [];
    for (const question of traitQuestions) {
      const raw = this.readScore(answers[question.id]);
      if (raw === null) continue;
      keyedScores.push(question.reverse ? LIKERT_MIN + LIKERT_MAX - raw : raw);
    }

    // Edge case: no usable responses → flagged neutral score, never throw.
    if (keyedScores.length === 0) {
      return this.neutralTraitScore(trait, norm, ['insufficient_data']);
    }

    const rawScore = mean(keyedScores);
    const pompScore = toPOMP(rawScore);
    const z = zFromPOMP(pompScore, norm);
    const percentileRank = percentileFromPOMP(pompScore, norm);
    const tScore = tScoreFromZ(z);

    // Within-person consistency: how tightly same-trait keyed items agree.
    // A straight-liner (same answer to forward AND reverse items) produces a
    // large keyed SD → low consistency → attenuated reliability. This is the
    // intended, defensible behavior.
    const keyedSD = standardDeviation(keyedScores);
    const withinPersonConsistency = clamp(1 - keyedSD / MAX_LIKERT_SD, 0, 1);

    const reliability = this.estimateReliability(
      norm.baseReliability,
      withinPersonConsistency,
      qualityReliability,
      keyedScores.length,
      traitQuestions.length
    );

    // Confidence interval via standard error of measurement (POMP units),
    // mapped back onto the percentile metric.
    const semPOMP = norm.sdPOMP * Math.sqrt(Math.max(0, 1 - reliability));
    const marginPOMP = 1.96 * semPOMP;
    const lower = Math.round(percentileFromPOMP(pompScore - marginPOMP, norm));
    const upper = Math.round(percentileFromPOMP(pompScore + marginPOMP, norm));

    const flags: string[] = [];
    if (keyedScores.length < traitQuestions.length) flags.push('partial_responses');
    if (withinPersonConsistency < 0.4) flags.push('low_internal_consistency');

    return {
      rawScore: Math.round(rawScore * 100) / 100,
      pompScore: Math.round(pompScore * 10) / 10,
      scaleMean: norm.meanPOMP,
      scaleSD: norm.sdPOMP,
      percentileRank: Math.round(percentileRank),
      tScore: Math.round(tScore),
      confidenceInterval: {
        lower: clamp(Math.min(lower, upper), PERCENTILE_FLOOR, PERCENTILE_CEILING),
        upper: clamp(Math.max(lower, upper), PERCENTILE_FLOOR, PERCENTILE_CEILING),
      },
      reliability: Math.round(reliability * 1000) / 1000,
      withinPersonConsistency: Math.round(withinPersonConsistency * 1000) / 1000,
      itemsAnswered: keyedScores.length,
      interpretation: this.generateTraitInterpretation(trait, Math.round(percentileRank)),
      flags,
    };
  }

  /** Safely read a 1–7 score from an answer object; null if missing/invalid. */
  private static readScore(answer: AssessmentAnswer | undefined): number | null {
    const raw = answer?.score;
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
    const clamped = clamp(Math.round(raw), LIKERT_MIN, LIKERT_MAX);
    return clamped;
  }

  /**
   * Per-respondent reliability estimate.
   *
   *   reliability = baseReliability × consistencyWeight × qualityWeight
   *
   * where the multiplicative weights map [0,1] inputs into bounded ranges so a
   * single weak signal cannot zero out the estimate, and the result is capped
   * at the published instrument alpha (we never claim better-than-published
   * reliability) and floored to keep CIs finite. Item-count attenuation guards
   * against partial protocols.
   */
  private static estimateReliability(
    baseReliability: number,
    consistency: number,
    qualityReliability: number,
    itemsAnswered: number,
    itemsExpected: number
  ): number {
    const consistencyWeight = 0.55 + 0.45 * clamp(consistency, 0, 1);
    const qualityWeight = 0.6 + 0.4 * clamp(qualityReliability, 0, 1);
    const completeness = itemsExpected > 0 ? clamp(itemsAnswered / itemsExpected, 0, 1) : 1;
    const coverageWeight = 0.7 + 0.3 * completeness;

    const estimate = baseReliability * consistencyWeight * qualityWeight * coverageWeight;
    return clamp(estimate, RELIABILITY_FLOOR, baseReliability);
  }

  private static neutralTraitScore(
    trait: Big5Trait,
    norm: TraitNorm,
    flags: string[]
  ): TraitScore {
    return {
      rawScore: 4,
      pompScore: 50,
      scaleMean: norm.meanPOMP,
      scaleSD: norm.sdPOMP,
      percentileRank: 50,
      tScore: 50,
      confidenceInterval: { lower: PERCENTILE_FLOOR, upper: PERCENTILE_CEILING },
      reliability: RELIABILITY_FLOOR,
      withinPersonConsistency: 0,
      itemsAnswered: 0,
      interpretation: this.generateTraitInterpretation(trait, 50),
      flags,
    };
  }

  private static generateTraitInterpretation(
    trait: Big5Trait,
    percentileRank: number
  ): TraitScore['interpretation'] {
    let level: TraitScore['interpretation']['level'];
    if (percentileRank <= 10) level = 'very low';
    else if (percentileRank <= 30) level = 'low';
    else if (percentileRank <= 70) level = 'average';
    else if (percentileRank <= 90) level = 'high';
    else level = 'very high';

    const description = TRAIT_DESCRIPTIONS[trait][level];
    const comparison =
      level === 'very low' || level === 'low'
        ? 'lower than most people'
        : level === 'average'
        ? 'similarly to most people'
        : 'higher than most people';
    const percentileDescription = `This places you around the ${percentileRank}${ordinalSuffix(
      percentileRank
    )} percentile of the reference population, meaning you describe yourself as scoring ${comparison} on this trait.`;

    return { level, description, percentileDescription };
  }

  private static categorizeReliability(
    reliability: number
  ): PersonalityProfile['profileReliability'] {
    if (reliability >= 0.85) return 'excellent';
    if (reliability >= 0.75) return 'good';
    if (reliability >= 0.6) return 'adequate';
    return 'questionable';
  }

  private static generateProfileInterpretation(
    traitScores: Record<string, TraitScore>
  ): PersonalityProfile['interpretation'] {
    const traits = Object.entries(traitScores);

    const strengths = traits
      .filter(([, s]) => s.interpretation.level === 'high' || s.interpretation.level === 'very high')
      .map(([trait, s]) => this.formatStrengthDescription(trait as Big5Trait, s.interpretation.level));

    const developmentAreas = traits
      .filter(([, s]) => s.interpretation.level === 'low' || s.interpretation.level === 'very low')
      .map(([trait]) => this.formatDevelopmentDescription(trait as Big5Trait));

    return {
      summary: this.generateProfileSummary(traitScores),
      strengths,
      developmentAreas,
      recommendations: this.generateRecommendations(traitScores),
    };
  }

  private static formatStrengthDescription(trait: Big5Trait, level: string): string {
    const levelWord = level === 'very high' ? 'exceptional' : 'strong';
    const map: Record<Big5Trait, string> = {
      openness: `${levelWord} creativity and intellectual curiosity`,
      conscientiousness: `${levelWord} organization and self-discipline`,
      extraversion: `${levelWord} social energy and assertiveness`,
      agreeableness: `${levelWord} empathy and cooperation`,
      neuroticism:
        level === 'very high'
          ? 'high emotional sensitivity (which may benefit from support strategies)'
          : 'emotional sensitivity and depth',
    };
    return map[trait];
  }

  private static formatDevelopmentDescription(trait: Big5Trait): string {
    const map: Record<Big5Trait, string> = {
      openness: 'Exploring new experiences and creative activities may broaden your perspective',
      conscientiousness: 'Building organizational systems and follow-through habits could be valuable',
      extraversion: 'Practicing social engagement when desired, while honoring your need for quieter settings',
      agreeableness: 'Balancing candor with cooperation can strengthen relationships',
      neuroticism: 'Your strong emotional stability is itself a significant asset',
    };
    return map[trait];
  }

  private static generateProfileSummary(traitScores: Record<string, TraitScore>): string {
    const entries = Object.entries(traitScores);
    if (!entries.length) return 'Your personality profile could not be summarized due to insufficient data.';

    const [domTrait, domScore] = entries.reduce((max, cur) =>
      cur[1].percentileRank > max[1].percentileRank ? cur : max
    );
    const traitName = domTrait.charAt(0).toUpperCase() + domTrait.slice(1);
    const snippet = domScore.interpretation.description
      .replace(/^You (are|tend to|enjoy|prefer|balance|experience)\b/i, 'a tendency to')
      .toLowerCase();

    return `Your profile shows ${traitName} as your most prominent trait (${domScore.percentileRank}${ordinalSuffix(
      domScore.percentileRank
    )} percentile), reflecting ${snippet.substring(0, 110)}${snippet.length > 110 ? '…' : ''}`;
  }

  private static generateRecommendations(traitScores: Record<string, TraitScore>): string[] {
    const recommendations: string[] = [];
    for (const [trait, score] of Object.entries(traitScores)) {
      if (score.interpretation.level === 'very high' || score.interpretation.level === 'very low') {
        const rec = this.getTraitRecommendation(trait as Big5Trait, score.interpretation.level);
        if (rec) recommendations.push(rec);
      }
    }
    recommendations.push('Consider sharing these results with trusted friends or mentors for their perspective');
    recommendations.push('Remember that personality can evolve over time with conscious effort and new experiences');
    return recommendations.slice(0, 5);
  }

  private static getTraitRecommendation(trait: Big5Trait, level: string): string {
    const map: Record<Big5Trait, Record<string, string>> = {
      openness: {
        'very high': 'Channel your creativity into meaningful projects, and be patient with those who prefer conventional approaches',
        'very low': 'Introducing small new experiences into your routine can gradually expand your comfort zone',
      },
      conscientiousness: {
        'very high': 'Balance your high standards with flexibility and self-compassion',
        'very low': 'Starting with small, achievable organizational systems can build momentum gradually',
      },
      extraversion: {
        'very high': 'Reserve some quiet reflection time within your active social schedule',
        'very low': 'Honor your need for solitude while maintaining the social connections that matter to you',
      },
      agreeableness: {
        'very high': 'Practice asserting your own needs and boundaries alongside your care for others',
        'very low': 'Noticing how a direct approach affects others can create opportunities to show empathy',
      },
      neuroticism: {
        'very high': 'Developing stress-management techniques — and seeking support when helpful — can be valuable',
        'very low': 'Your emotional stability is a real asset; it can help you support others during difficult times',
      },
    };
    return map[trait]?.[level] || '';
  }

  private static generateDisclaimers(
    qualityMetrics: DataQualityMetrics,
    reliability: number
  ): string[] {
    const disclaimers = [
      'This assessment is for personal insight and exploration only, not for clinical, employment, or other high-stakes decisions',
      'Personality traits exist on a spectrum and can change over time with experience and effort',
      'Percentiles are estimated against published reference norms (BFI-2) and are best read as well-grounded approximations',
    ];
    if (qualityMetrics?.overallQuality === 'poor' || reliability < 0.6) {
      disclaimers.unshift('⚠️ Reliability of this profile is lower than ideal — interpret with extra caution');
    }
    if (reliability < 0.75) {
      disclaimers.push('Retaking the assessment carefully may yield a more reliable profile');
    }
    return disclaimers;
  }
}

export default PersonalityScorer;