// src/components/intake/personality/validityScales.ts
//
// Response-validity scales for the Big Five protocol. These detect the response
// styles that silently corrupt self-report data and that enterprise-grade
// instruments are expected to screen for:
//
//   • Acquiescence (yea-/nay-saying): agreeing/disagreeing regardless of content.
//     Detectable here because each domain is balanced (4 forward + 4 reverse
//     items); a content-blind responder pushes the *raw* mean away from the
//     scale midpoint while remaining internally contradictory.
//   • Inconsistency: low agreement among items that, after reverse-keying,
//     measure the same construct — the hallmark of careless/random responding.
//   • Infrequency / contradiction: extreme disagreement between same-trait items
//     (e.g., "strongly agree" to both a statement and its opposite).
//   • Extreme responding & central-tendency (midpoint) bias: response-style
//     artifacts that distort trait estimates.
//
// All indices are computable from a SINGLE respondent's answers (unlike
// Cronbach's alpha, which is a between-persons statistic and is therefore NOT
// claimed here). Thresholds are documented inline and intentionally
// conservative — we flag, attenuate reliability, and disclaim rather than
// silently discard.
//
// References: Meade & Craig (2012) on careless responding; Soto & John (2017)
// on balanced-keying acquiescence control.

import {
  BIG5_TRAITS,
  LIKERT_MIN,
  LIKERT_MAX,
  LIKERT_MIDPOINT,
  MAX_LIKERT_SD,
  clamp,
  mean,
  standardDeviation,
} from './psychometricNorms';
import type { AnswerMap, AssessmentAnswer } from './types';

export type ValidityVerdict = 'valid' | 'acceptable' | 'questionable' | 'invalid';

export interface ValidityProfile {
  /** Signed deviation of the raw (un-keyed) item mean from the midpoint (4). */
  acquiescenceIndex: number;
  acquiescenceFlag: boolean;

  /** Proportion of responses at a scale extreme (1 or 7). */
  extremeResponseRate: number;
  extremeResponseFlag: boolean;

  /** Proportion of responses at the scale midpoint (4). */
  midpointResponseRate: number;
  midpointResponseFlag: boolean;

  /** 0–1 mean within-trait disagreement among keyed items (higher = worse). */
  inconsistencyScore: number;
  inconsistencyFlag: boolean;

  /** Count of same-trait item pairs in extreme contradiction (|diff| ≥ 5). */
  infrequencyCount: number;
  infrequencyFlag: boolean;

  /** 0–1 composite likelihood of careless/random/biased responding. */
  randomRespondingLikelihood: number;

  /** How many Big Five items were available for validity analysis. */
  itemsAnalyzed: number;

  overallValidity: ValidityVerdict;
  flags: string[];
  warnings: string[];
}

// Tunable thresholds — documented so they can be defended/recalibrated.
const THRESHOLDS = {
  /** |raw mean − midpoint| at/above this signals acquiescence/nay-saying. */
  acquiescence: 1.0,
  /** Extreme-response proportion at/above this signals extreme style. */
  extremeRate: 0.65,
  /** Midpoint proportion at/above this signals central-tendency bias. */
  midpointRate: 0.5,
  /** Normalized within-trait SD at/above this signals inconsistency. */
  inconsistency: 0.6,
  /** Contradictory same-trait pairs at/above this signals infrequency. */
  infrequencyPairs: 3,
  /** Minimum Big Five items required to assess validity at all. */
  minItems: 10,
} as const;

interface MinimalQuestion {
  id: string;
  category?: string;
  dimension?: string;
  reverse?: boolean;
}

export class ValidityScaleAnalyzer {
  /**
   * Analyze the Big Five responses for response-validity threats.
   * Never throws: malformed/sparse input yields a neutral, low-confidence
   * profile flagged as `insufficient_data`.
   */
  static analyze(
    answers: AnswerMap,
    big5Questions: MinimalQuestion[]
  ): ValidityProfile {
    const rawScores: number[] = [];
    const keyedByTrait: Record<string, number[]> = {};
    for (const trait of BIG5_TRAITS) keyedByTrait[trait] = [];

    for (const q of big5Questions) {
      if (!q || q.category !== 'big5') continue;
      const raw = this.readScore(answers[q.id]);
      if (raw === null) continue;
      rawScores.push(raw);
      const keyed = q.reverse ? LIKERT_MIN + LIKERT_MAX - raw : raw;
      if (q.dimension && keyedByTrait[q.dimension]) {
        keyedByTrait[q.dimension].push(keyed);
      }
    }

    const itemsAnalyzed = rawScores.length;

    if (itemsAnalyzed < THRESHOLDS.minItems) {
      return this.insufficientProfile(itemsAnalyzed);
    }

    // ── Acquiescence: raw mean vs midpoint (balanced keying makes this valid).
    const acquiescenceIndex =
      Math.round((mean(rawScores) - LIKERT_MIDPOINT) * 100) / 100;
    const acquiescenceFlag =
      Math.abs(acquiescenceIndex) >= THRESHOLDS.acquiescence;

    // ── Response-style rates.
    const extremeCount = rawScores.filter(
      (s) => s === LIKERT_MIN || s === LIKERT_MAX
    ).length;
    const midpointCount = rawScores.filter((s) => s === LIKERT_MIDPOINT).length;
    const extremeResponseRate =
      Math.round((extremeCount / itemsAnalyzed) * 1000) / 1000;
    const midpointResponseRate =
      Math.round((midpointCount / itemsAnalyzed) * 1000) / 1000;
    const extremeResponseFlag = extremeResponseRate >= THRESHOLDS.extremeRate;
    const midpointResponseFlag = midpointResponseRate >= THRESHOLDS.midpointRate;

    // ── Within-trait inconsistency & extreme contradictions.
    const traitSDs: number[] = [];
    let infrequencyCount = 0;
    for (const trait of BIG5_TRAITS) {
      const keyed = keyedByTrait[trait];
      if (keyed.length >= 2) {
        traitSDs.push(standardDeviation(keyed));
        infrequencyCount += this.countContradictions(keyed);
      }
    }
    const inconsistencyScore = traitSDs.length
      ? clamp(mean(traitSDs) / MAX_LIKERT_SD, 0, 1)
      : 0;
    const inconsistencyFlag = inconsistencyScore >= THRESHOLDS.inconsistency;
    const infrequencyFlag = infrequencyCount >= THRESHOLDS.infrequencyPairs;

    // ── Composite likelihood of careless/biased responding (documented weights).
    const incFactor = inconsistencyScore;
    const infFactor = clamp(infrequencyCount / 6, 0, 1);
    const acqFactor = clamp((Math.abs(acquiescenceIndex) - 0.5) / 1.5, 0, 1);
    const extFactor = clamp(
      (extremeResponseRate - THRESHOLDS.extremeRate) / (1 - THRESHOLDS.extremeRate),
      0,
      1
    );
    const midFactor = clamp(
      (midpointResponseRate - THRESHOLDS.midpointRate) / (1 - THRESHOLDS.midpointRate),
      0,
      1
    );
    const randomRespondingLikelihood =
      Math.round(
        clamp(
          0.45 * incFactor +
            0.25 * infFactor +
            0.15 * acqFactor +
            0.075 * extFactor +
            0.075 * midFactor,
          0,
          1
        ) * 1000
      ) / 1000;

    const flags: string[] = [];
    if (acquiescenceFlag)
      flags.push(acquiescenceIndex > 0 ? 'acquiescence_yea_saying' : 'acquiescence_nay_saying');
    if (extremeResponseFlag) flags.push('extreme_response_style');
    if (midpointResponseFlag) flags.push('central_tendency_bias');
    if (inconsistencyFlag) flags.push('inconsistent_responding');
    if (infrequencyFlag) flags.push('contradictory_responses');

    const overallValidity = this.deriveVerdict(
      randomRespondingLikelihood,
      flags.length,
      inconsistencyFlag,
      infrequencyFlag,
      acquiescenceFlag
    );

    return {
      acquiescenceIndex,
      acquiescenceFlag,
      extremeResponseRate,
      extremeResponseFlag,
      midpointResponseRate,
      midpointResponseFlag,
      inconsistencyScore: Math.round(inconsistencyScore * 1000) / 1000,
      inconsistencyFlag,
      infrequencyCount,
      infrequencyFlag,
      randomRespondingLikelihood,
      itemsAnalyzed,
      overallValidity,
      flags,
      warnings: this.buildWarnings(overallValidity, flags),
    };
  }

  /** Safely read a numeric Likert score from an answer object; null if absent. */
  private static readScore(answer: AssessmentAnswer | undefined): number | null {
    const raw = answer?.score;
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
    const rounded = Math.round(raw);
    if (rounded < LIKERT_MIN || rounded > LIKERT_MAX) return null;
    return rounded;
  }

  /** Count item pairs within a keyed trait set that contradict by ≥ 5 points. */
  private static countContradictions(keyed: number[]): number {
    let count = 0;
    for (let i = 0; i < keyed.length; i++) {
      for (let j = i + 1; j < keyed.length; j++) {
        if (Math.abs(keyed[i] - keyed[j]) >= 5) count++;
      }
    }
    return count;
  }

  private static deriveVerdict(
    likelihood: number,
    flagCount: number,
    inconsistencyFlag: boolean,
    infrequencyFlag: boolean,
    acquiescenceFlag: boolean
  ): ValidityVerdict {
    const severeCombo =
      inconsistencyFlag && (infrequencyFlag || acquiescenceFlag);
    if (likelihood >= 0.75 || severeCombo) return 'invalid';
    if (likelihood >= 0.5 || flagCount >= 2) return 'questionable';
    if (likelihood >= 0.3 || flagCount >= 1) return 'acceptable';
    return 'valid';
  }

  private static buildWarnings(verdict: ValidityVerdict, flags: string[]): string[] {
    const warnings: string[] = [];
    const human: Record<string, string> = {
      acquiescence_yea_saying:
        'Responses lean toward agreement regardless of the statement, which can inflate trait estimates.',
      acquiescence_nay_saying:
        'Responses lean toward disagreement regardless of the statement, which can deflate trait estimates.',
      extreme_response_style:
        'A high share of answers used the scale extremes, which can exaggerate differences between traits.',
      central_tendency_bias:
        'A high share of answers stayed neutral, which can blur real differences between traits.',
      inconsistent_responding:
        'Items measuring the same trait were answered inconsistently, reducing confidence in the results.',
      contradictory_responses:
        'Some closely related statements received contradictory answers.',
    };
    for (const f of flags) if (human[f]) warnings.push(human[f]);

    if (verdict === 'invalid') {
      warnings.unshift(
        'Response patterns suggest the answers may not reflect genuine self-assessment. We strongly recommend retaking the assessment carefully.'
      );
    } else if (verdict === 'questionable') {
      warnings.unshift(
        'Some response patterns reduce confidence in these results. Consider retaking for a more reliable profile.'
      );
    }
    return warnings;
  }

  private static insufficientProfile(itemsAnalyzed: number): ValidityProfile {
    return {
      acquiescenceIndex: 0,
      acquiescenceFlag: false,
      extremeResponseRate: 0,
      extremeResponseFlag: false,
      midpointResponseRate: 0,
      midpointResponseFlag: false,
      inconsistencyScore: 0,
      inconsistencyFlag: false,
      infrequencyCount: 0,
      infrequencyFlag: false,
      randomRespondingLikelihood: 0,
      itemsAnalyzed,
      overallValidity: 'valid',
      flags: ['insufficient_data'],
      warnings: [
        'Not enough responses were available to run the full validity analysis.',
      ],
    };
  }
}

export default ValidityScaleAnalyzer;