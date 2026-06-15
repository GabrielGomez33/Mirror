// src/components/intake/personality/psychometricNorms.ts
//
// Centralized psychometric constants and scoring mathematics for the Big Five
// assessment. Isolating these values in one audited module keeps the scoring
// engine honest, testable, and easy to re-calibrate without touching logic.
//
// ─────────────────────────────────────────────────────────────────────────────
// NORMATIVE BASIS (read before changing any number below)
// ─────────────────────────────────────────────────────────────────────────────
// Our instrument uses a 7-point Likert scale (1–7) with 8 items per domain
// (4 forward-keyed, 4 reverse-keyed). To express scores on a scale-independent
// metric we use POMP — "Percent Of Maximum Possible" (Cohen, Cohen, Aiken &
// West, 1999):  POMP = (rawMean - min) / (max - min) * 100.
//
// Reference norms (domain means / SDs) and base internal-consistency
// reliabilities below are anchored to the Big Five Inventory-2 (BFI-2;
// Soto & John, 2017, Journal of Personality and Social Psychology), the most
// widely validated public-domain Big Five instrument. BFI-2 domain means/SDs
// (reported on its native 1–5 scale) are converted to POMP via
// (M - 1) / (5 - 1) * 100 so they are directly comparable to our 1–7 POMP
// scores. Published BFI-2 domain alpha reliabilities are used verbatim as the
// per-domain `baseReliability` (the ceiling reliability our short form can
// inherit from the construct it measures).
//
// IMPORTANT — these are *reference* norms, not norms validated on THIS exact
// item set. Percentiles are therefore best interpreted as well-grounded
// approximations, and the UI must communicate that (see disclaimers). This is
// the honest, defensible enterprise posture: real construct anchoring + real
// per-respondent reliability + transparent limitations.
//
// Sources:
//   Soto, C. J., & John, O. P. (2017). The Next Big Five Inventory (BFI-2).
//     Journal of Personality and Social Psychology, 113(1), 117–143.
//   Cohen, P., Cohen, J., Aiken, L. S., & West, S. G. (1999). The problem of
//     units and the circumstance for POMP. Multivariate Behavioral Research.

export type Big5Trait =
  | 'openness'
  | 'conscientiousness'
  | 'extraversion'
  | 'agreeableness'
  | 'neuroticism';

export const BIG5_TRAITS: Big5Trait[] = [
  'openness',
  'conscientiousness',
  'extraversion',
  'agreeableness',
  'neuroticism',
];

// Likert scale bounds for the Big Five items.
export const LIKERT_MIN = 1;
export const LIKERT_MAX = 7;
export const LIKERT_MIDPOINT = (LIKERT_MIN + LIKERT_MAX) / 2; // 4
// Largest possible within-trait standard deviation on a 1–7 scale
// (half the responses at 1, half at 7) → used to normalize consistency.
export const MAX_LIKERT_SD = (LIKERT_MAX - LIKERT_MIN) / 2; // 3

export interface TraitNorm {
  /** Reference population mean, expressed in POMP (0–100) units. */
  meanPOMP: number;
  /** Reference population SD, expressed in POMP (0–100) units. */
  sdPOMP: number;
  /**
   * Published instrument internal-consistency reliability (Cronbach's alpha)
   * for this domain. Acts as the ceiling reliability for an individual
   * protocol; the live estimate is attenuated by this respondent's own
   * response consistency and data quality (see enhancedScoring).
   */
  baseReliability: number;
}

// BFI-2 1–5 descriptives → POMP, with published domain alphas.
//   meanPOMP = (M1to5 - 1) / 4 * 100      sdPOMP = SD1to5 / 4 * 100
//   openness:          M≈3.64 SD≈0.60 α=.84
//   conscientiousness: M≈3.55 SD≈0.65 α=.83
//   extraversion:      M≈3.21 SD≈0.68 α=.86
//   agreeableness:     M≈3.69 SD≈0.59 α=.82
//   neuroticism:       M≈2.91 SD≈0.79 α=.85
export const BIG5_NORMS: Record<Big5Trait, TraitNorm> = {
  openness: { meanPOMP: 66, sdPOMP: 15, baseReliability: 0.84 },
  conscientiousness: { meanPOMP: 64, sdPOMP: 16, baseReliability: 0.83 },
  extraversion: { meanPOMP: 55, sdPOMP: 17, baseReliability: 0.86 },
  agreeableness: { meanPOMP: 67, sdPOMP: 15, baseReliability: 0.82 },
  neuroticism: { meanPOMP: 48, sdPOMP: 20, baseReliability: 0.85 },
};

// Floors and ceilings to keep derived statistics in defensible ranges.
export const RELIABILITY_FLOOR = 0.3;
export const PERCENTILE_FLOOR = 1;
export const PERCENTILE_CEILING = 99;

// ─────────────────────────────────────────────────────────────────────────────
// Pure mathematical helpers (no domain logic, fully unit-testable)
// ─────────────────────────────────────────────────────────────────────────────

/** Clamp a number to [min, max]. Returns `min` for NaN to fail safe. */
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Arithmetic mean with empty-array safety. */
export function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Population variance with empty-array safety. */
export function variance(values: number[]): number {
  if (values.length < 1) return 0;
  const m = mean(values);
  return values.reduce((acc, v) => acc + (v - m) * (v - m), 0) / values.length;
}

/** Population standard deviation with empty-array safety. */
export function standardDeviation(values: number[]): number {
  return Math.sqrt(variance(values));
}

/** Median with empty-array safety. */
export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Convert a raw mean on [min, max] to POMP (0–100).
 * Out-of-range inputs are clamped first so the result is always 0–100.
 */
export function toPOMP(
  rawMean: number,
  min: number = LIKERT_MIN,
  max: number = LIKERT_MAX
): number {
  if (max <= min) return 0;
  const safe = clamp(rawMean, min, max);
  return ((safe - min) / (max - min)) * 100;
}

/**
 * Standard normal cumulative distribution function.
 * Abramowitz & Stegun 26.2.17 approximation (|error| < 7.5e-8).
 */
export function normalCDF(z: number): number {
  if (!Number.isFinite(z)) return z > 0 ? 1 : 0;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const prob =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - prob : prob;
}

/** Percentile rank (1–99) for a POMP score against a trait norm. */
export function percentileFromPOMP(pomp: number, norm: TraitNorm): number {
  if (norm.sdPOMP <= 0) return 50;
  const z = (pomp - norm.meanPOMP) / norm.sdPOMP;
  const pct = normalCDF(z) * 100;
  return clamp(pct, PERCENTILE_FLOOR, PERCENTILE_CEILING);
}

/** Linear T-score (mean 50, SD 10) from a z-score. */
export function tScoreFromZ(z: number): number {
  return 50 + z * 10;
}

/** z-score for a POMP value against a trait norm (0 if SD invalid). */
export function zFromPOMP(pomp: number, norm: TraitNorm): number {
  if (norm.sdPOMP <= 0) return 0;
  return (pomp - norm.meanPOMP) / norm.sdPOMP;
}

/** Ordinal suffix for an integer (1 → "st", 2 → "nd", 11 → "th"). */
export function ordinalSuffix(n: number): string {
  const j = Math.abs(n) % 10;
  const k = Math.abs(n) % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
}