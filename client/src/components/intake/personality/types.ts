// src/components/intake/personality/types.ts
//
// Shared, precise types for the personality scoring pipeline. Keeping these in
// one place lets the scoring modules avoid `any` while staying compatible with
// the loosely-typed answer objects produced by the UI and IntakeContext.

/** A fully-specified answer option as defined in the question banks. */
export interface AssessmentOption {
  text: string;
  value: string;
  score: number;
}

/**
 * A recorded answer. Option answers carry text/value/score; the reflection
 * answer carries text (with value 'reflection', score 0). All fields are
 * optional so partially-formed/restored answers never break type checks.
 */
export interface AssessmentAnswer {
  text?: string;
  value?: string;
  score?: number;
}

/** Map of question id → recorded answer. */
export type AnswerMap = Record<string, AssessmentAnswer | undefined>;

/** Minimal question shape the scorers need (works for Big Five and MBTI items). */
export interface ScorableQuestion {
  id: string;
  category?: string;
  dimension?: string;
  direction?: string;
  reverse?: boolean;
}