// src/components/intake/personality/mbtiScoring.ts
//
// MBTI preference scoring. The MBTI dichotomizes inherently continuous
// preferences, so the legitimacy work here is mostly about *honesty at the
// boundary*:
//   • Near-tie dimensions are flagged "borderline" and surfaced with the
//     alternate letter — we never present a coin-flip as a firm preference.
//   • Missing-data dimensions are marked indeterminate (clarity 0) rather than
//     silently defaulting to a fixed letter that would bias the reported type.
//   • A clean 4-letter `type` is always produced (downstream contract requires
//     length 4), but every weak letter is transparently disclosed.
//   • Never throws.

import type { MBTIQuestion } from './mbtiQuestionBank';
import { mbtiTypeDescriptions, preferenceStrengthDescriptions } from './mbtiQuestionBank';
import { LIKERT_MIN, LIKERT_MAX, clamp, mean } from './psychometricNorms';
import type { AnswerMap, AssessmentAnswer } from './types';

type Dimension = 'EI' | 'SN' | 'TF' | 'JP';
type Letter = 'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P';

export interface MBTIPreferenceScore {
  dimension: Dimension;
  preferredType: Letter;
  /** The opposite letter on this dimension (shown when borderline). */
  alternateType: Letter;
  strength: 'very strong' | 'strong' | 'moderate' | 'slight' | 'unclear';
  rawScore: number;
  alternateScore: number;
  scoreDifference: number;
  clarity: number; // 0–100
  /** True when the preference is too close to call or based on missing data. */
  borderline: boolean;
  confidenceInterval: { lower: number; upper: number };
  interpretation: string;
}

export interface MBTIResult {
  type: string; // always a clean 4-letter type
  preferences: Record<string, MBTIPreferenceScore>;
  typeDescription: string;
  overallClarity: number;
  reliabilityNote: string;
  strengthSummary: string[];
  developmentSuggestions: string[];
  validityWarnings: string[];
  /** Dimensions whose letter is too close to call. */
  borderlineDimensions: Dimension[];
  /** Plausible alternative types when borderline letters are toggled. */
  alternateTypes: string[];
  hasBorderlinePreferences: boolean;
}

const DIMENSION_LETTERS: Record<Dimension, [Letter, Letter]> = {
  EI: ['E', 'I'],
  SN: ['S', 'N'],
  TF: ['T', 'F'],
  JP: ['J', 'P'],
};

const PREFERENCE_NAMES: Record<Letter, string> = {
  E: 'Extraversion', I: 'Introversion',
  S: 'Sensing', N: 'Intuition',
  T: 'Thinking', F: 'Feeling',
  J: 'Judging', P: 'Perceiving',
};

const PREFERENCE_DESCRIPTIONS: Record<Letter, string> = {
  E: 'You tend to focus outward and gain energy from interacting with the external world.',
  I: 'You tend to focus inward and gain energy from your inner world of thoughts and reflections.',
  S: 'You tend to focus on concrete information and trust what you can observe directly.',
  N: 'You tend to focus on patterns, possibilities, and the bigger picture.',
  T: 'You tend to make decisions based on logical analysis and objective criteria.',
  F: 'You tend to make decisions based on values and consideration for the people involved.',
  J: 'You tend to prefer structure, closure, and having things decided.',
  P: 'You tend to prefer flexibility, openness, and keeping your options available.',
};

// scoreDifference (0–6) at/below this, or clarity below CLARITY_BORDERLINE,
// marks a dimension as too close to call.
const DIFF_BORDERLINE = 0.5;
const CLARITY_BORDERLINE = 12;
const MAX_DIFF = LIKERT_MAX - LIKERT_MIN; // 6

export class MBTIScorer {
  static calculateMBTIResult(
    answers: AnswerMap,
    questions: MBTIQuestion[],
    dataQuality: number
  ): MBTIResult {
    const safeAnswers = answers || {};
    const safeQuestions = Array.isArray(questions) ? questions : [];
    const quality = clamp(Number.isFinite(dataQuality) ? dataQuality : 0.6, 0, 1);

    const dimensions: Dimension[] = ['EI', 'SN', 'TF', 'JP'];
    const preferences: Record<string, MBTIPreferenceScore> = {};
    const borderlineDimensions: Dimension[] = [];

    for (const dimension of dimensions) {
      const pref = this.calculatePreference(dimension, safeAnswers, safeQuestions, quality);
      preferences[dimension] = pref;
      if (pref.borderline) borderlineDimensions.push(dimension);
    }

    const type = dimensions.map((d) => preferences[d].preferredType).join('');
    const overallClarity = Math.round(
      mean(dimensions.map((d) => preferences[d].clarity))
    );

    return {
      type,
      preferences,
      typeDescription: mbtiTypeDescriptions[type] || 'Type description not available.',
      overallClarity,
      reliabilityNote: this.generateReliabilityNote(overallClarity, quality, borderlineDimensions.length),
      strengthSummary: this.generateStrengthSummary(preferences),
      developmentSuggestions: this.generateDevelopmentSuggestions(preferences),
      validityWarnings: this.generateValidityWarnings(quality, borderlineDimensions),
      borderlineDimensions,
      alternateTypes: this.generateAlternateTypes(type, dimensions, preferences, borderlineDimensions),
      hasBorderlinePreferences: borderlineDimensions.length > 0,
    };
  }

  private static calculatePreference(
    dimension: Dimension,
    answers: AnswerMap,
    questions: MBTIQuestion[],
    dataQuality: number
  ): MBTIPreferenceScore {
    const [letter1, letter2] = DIMENSION_LETTERS[dimension];
    const dimQuestions = questions.filter((q) => q.dimension === dimension);

    const dir1Scores = dimQuestions
      .filter((q) => q.direction === letter1)
      .map((q) => this.readScore(answers[q.id]))
      .filter((s): s is number => s !== null);
    const dir2Scores = dimQuestions
      .filter((q) => q.direction === letter2)
      .map((q) => this.readScore(answers[q.id]))
      .filter((s): s is number => s !== null);

    // Edge case: a side has no usable answers → indeterminate (no contrast).
    // Flag it; do not let a default letter bias the reported type.
    if (dir1Scores.length === 0 || dir2Scores.length === 0) {
      return this.indeterminatePreference(dimension);
    }

    const dir1Average = mean(dir1Scores);
    const dir2Average = mean(dir2Scores);
    const scoreDifference = Math.abs(dir1Average - dir2Average);

    // On an exact tie we deterministically take letter1 but mark it borderline;
    // the UI shows both letters so the arbitrary pick is never presented as real.
    const prefersLetter1 = dir1Average >= dir2Average;
    const preferredType = prefersLetter1 ? letter1 : letter2;
    const alternateType = prefersLetter1 ? letter2 : letter1;
    const rawScore = prefersLetter1 ? dir1Average : dir2Average;
    const alternateScore = prefersLetter1 ? dir2Average : dir1Average;

    // Clarity scales with the preference gap and is attenuated by data quality,
    // but quality cannot zero it out (floor 0.5×) — a real gap still counts.
    const rawClarity = (scoreDifference / MAX_DIFF) * 100;
    const clarity = clamp(Math.round(rawClarity * (0.5 + 0.5 * dataQuality)), 0, 100);

    const borderline = scoreDifference < DIFF_BORDERLINE || clarity < CLARITY_BORDERLINE;
    const strength = this.categorizeStrength(clarity);

    const standardError = (1 - dataQuality) * 15 + 5;
    const confidenceInterval = {
      lower: clamp(Math.round(clarity - standardError), 0, 100),
      upper: clamp(Math.round(clarity + standardError), 0, 100),
    };

    return {
      dimension,
      preferredType,
      alternateType,
      strength,
      rawScore: Math.round(rawScore * 10) / 10,
      alternateScore: Math.round(alternateScore * 10) / 10,
      scoreDifference: Math.round(scoreDifference * 10) / 10,
      clarity,
      borderline,
      confidenceInterval,
      interpretation: this.generatePreferenceInterpretation(preferredType, alternateType, strength, borderline),
    };
  }

  private static readScore(answer: AssessmentAnswer | undefined): number | null {
    const raw = answer?.score;
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
    return clamp(Math.round(raw), LIKERT_MIN, LIKERT_MAX);
  }

  private static indeterminatePreference(dimension: Dimension): MBTIPreferenceScore {
    const [letter1, letter2] = DIMENSION_LETTERS[dimension];
    return {
      dimension,
      preferredType: letter1, // deterministic placeholder, explicitly borderline
      alternateType: letter2,
      strength: 'unclear',
      rawScore: 4,
      alternateScore: 4,
      scoreDifference: 0,
      clarity: 0,
      borderline: true,
      confidenceInterval: { lower: 0, upper: 100 },
      interpretation:
        'There was not enough information to determine this preference, so it is shown as balanced between both styles.',
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
    preferredType: Letter,
    alternateType: Letter,
    strength: string,
    borderline: boolean
  ): string {
    const prefName = PREFERENCE_NAMES[preferredType];
    const altName = PREFERENCE_NAMES[alternateType];
    const strengthDesc =
      preferenceStrengthDescriptions[strength as keyof typeof preferenceStrengthDescriptions];
    const base = PREFERENCE_DESCRIPTIONS[preferredType];

    if (borderline) {
      return `You appear nearly balanced between ${prefName} and ${altName}; you likely draw on both depending on the situation. ${base}`;
    }
    if (strength === 'slight') {
      return `You show a ${strengthDesc} lean toward ${prefName}, but may use both approaches depending on the situation. ${base}`;
    }
    return `You show a ${strengthDesc} preference for ${prefName}. ${base}`;
  }

  private static generateReliabilityNote(
    overallClarity: number,
    dataQuality: number,
    borderlineCount: number
  ): string {
    if (dataQuality < 0.6) {
      return 'These preferences should be interpreted with caution due to response-quality concerns.';
    }
    if (borderlineCount >= 2) {
      return 'Several of your preferences are nearly balanced — your type may shift between sittings, which is normal and reflects flexibility.';
    }
    if (overallClarity >= 70) return 'Your type preferences are quite clear and likely to be stable.';
    if (overallClarity >= 50) return 'Your type preferences show moderate clarity. Retaking later may refine borderline letters.';
    return 'Many preferences are nearly balanced — you may be flexible across these styles rather than firmly typed.';
  }

  private static generateStrengthSummary(
    preferences: Record<string, MBTIPreferenceScore>
  ): string[] {
    const strengths: string[] = [];
    const map: Record<Dimension, Partial<Record<Letter, string>>> = {
      EI: { E: 'Strong social energy and external focus', I: 'Strong internal focus and independent thinking' },
      SN: { S: 'Strong attention to practical details and concrete information', N: 'Strong intuitive insight and future-oriented thinking' },
      TF: { T: 'Strong logical analysis and objective decision-making', F: 'Strong empathy and values-based decision-making' },
      JP: { J: 'Strong organizational skills and preference for closure', P: 'Strong adaptability and openness to new possibilities' },
    };
    for (const [dimension, pref] of Object.entries(preferences)) {
      if (pref.borderline) continue;
      if (pref.strength === 'very strong' || pref.strength === 'strong') {
        const text = map[dimension as Dimension]?.[pref.preferredType];
        if (text) strengths.push(text);
      }
    }
    return strengths.slice(0, 3);
  }

  private static generateDevelopmentSuggestions(
    preferences: Record<string, MBTIPreferenceScore>
  ): string[] {
    const suggestions: string[] = [];
    const map: Record<Dimension, Partial<Record<Letter, string>>> = {
      EI: { E: 'Consider developing your reflection and listening skills', I: 'Consider developing your verbal communication and group-interaction skills' },
      SN: { S: 'Consider exploring big-picture thinking and future possibilities', N: 'Consider developing attention to practical details and implementation' },
      TF: { T: 'Consider developing empathy and awareness of emotional factors', F: 'Consider developing analytical thinking and objective evaluation skills' },
      JP: { J: 'Consider developing flexibility and spontaneity', P: 'Consider developing planning and organizational systems' },
    };
    for (const [dimension, pref] of Object.entries(preferences)) {
      if (pref.borderline) continue;
      if (pref.strength === 'very strong') {
        const text = map[dimension as Dimension]?.[pref.preferredType];
        if (text) suggestions.push(text);
      }
    }
    return suggestions.slice(0, 2);
  }

  private static generateValidityWarnings(
    dataQuality: number,
    borderlineDimensions: Dimension[]
  ): string[] {
    const warnings: string[] = [];
    if (borderlineDimensions.length >= 3) {
      warnings.push('Most preferences are nearly balanced — a single four-letter type may not capture you well.');
    } else if (borderlineDimensions.length > 0) {
      warnings.push(
        `Your ${borderlineDimensions.join(', ')} ${
          borderlineDimensions.length === 1 ? 'preference is' : 'preferences are'
        } close to balanced and could shift between sittings.`
      );
    }
    if (dataQuality < 0.5) {
      warnings.push('Response-quality issues were detected — consider retaking the assessment.');
    }
    return warnings;
  }

  /**
   * Enumerate plausible types by toggling borderline letters (capped), so the
   * UI can say "you may also relate to …". Returns [] when nothing is borderline.
   */
  private static generateAlternateTypes(
    type: string,
    dimensions: Dimension[],
    preferences: Record<string, MBTIPreferenceScore>,
    borderlineDimensions: Dimension[]
  ): string[] {
    if (borderlineDimensions.length === 0) return [];
    // Limit combinatorial blow-up: toggle at most the 2 closest borderline dims.
    const toToggle = [...borderlineDimensions]
      .sort((a, b) => preferences[a].clarity - preferences[b].clarity)
      .slice(0, 2);

    const results = new Set<string>();
    const total = 1 << toToggle.length;
    for (let mask = 1; mask < total; mask++) {
      const letters = dimensions.map((d) => preferences[d].preferredType) as Letter[];
      toToggle.forEach((dim, i) => {
        if (mask & (1 << i)) {
          const idx = dimensions.indexOf(dim);
          letters[idx] = preferences[dim].alternateType;
        }
      });
      const alt = letters.join('');
      if (alt !== type) results.add(alt);
    }
    return Array.from(results).slice(0, 3);
  }
}

export default MBTIScorer;