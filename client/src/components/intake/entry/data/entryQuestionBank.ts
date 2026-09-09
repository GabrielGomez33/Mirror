// components/intake/entry/data/entryQuestionBank.ts
// ----------------------------------------------------------------------------
// The curated MINI personality bank for the fast Entry intake. It does NOT
// duplicate questions — it selects a balanced subset from the REAL banks
// (scientificQuestionBank + mbtiQuestionBank) at module load, so the items,
// keying, and scoring stay identical to the full Core assessment. Fewer items
// = lower reliability, which the scorer reflects honestly (Entry stamps the
// result 'preliminary').
//   Big-5: one forward + one reverse item per dimension (~10 items).
//   MBTI : one item per axis (~4 items).
// ----------------------------------------------------------------------------

import { scientificQuestions, type Question } from '../../personality/scientificQuestionBank';
import { mbtiQuestions, type MBTIQuestion } from '../../personality/mbtiQuestionBank';

const BIG5_DIMENSIONS = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'] as const;
const MBTI_AXES = ['EI', 'SN', 'TF', 'JP'] as const;

// The two poles of each axis, in the SAME order the scorer's DIMENSION_LETTERS
// uses (mbtiScoring.ts). The scorer computes a preference by comparing the mean
// of items keyed toward letter1 against items keyed toward letter2 — so the
// Entry bank MUST include at least one item of EACH direction per axis, or the
// axis is "indeterminate" and collapses to letter1 (E/S/T/J = "ESTJ") for every
// user regardless of their answers. (Regression-tested in scripts/entryMbti.test.ts.)
const AXIS_LETTERS: Record<(typeof MBTI_AXES)[number], readonly [string, string]> = {
  EI: ['E', 'I'],
  SN: ['S', 'N'],
  TF: ['T', 'F'],
  JP: ['J', 'P'],
};

function pickEntryBig5(): Question[] {
  const out: Question[] = [];
  for (const dim of BIG5_DIMENSIONS) {
    const forDim = scientificQuestions.filter((q) => q.category === 'big5' && q.dimension === dim);
    const forward = forDim.find((q) => !q.reverse);
    const reverse = forDim.find((q) => q.reverse);
    if (forward) out.push(forward);
    if (reverse) out.push(reverse);
    // If a dimension somehow lacks a forward/reverse pair, fall back to whatever exists.
    if (!forward && !reverse && forDim[0]) out.push(forDim[0]);
  }
  return out;
}

function pickEntryMbti(): MBTIQuestion[] {
  const out: MBTIQuestion[] = [];
  for (const axis of MBTI_AXES) {
    const [letter1, letter2] = AXIS_LETTERS[axis];
    const forAxis = mbtiQuestions.filter((q) => q.dimension === axis);
    // One item keyed toward EACH pole — the scorer needs both sides to compute a
    // real preference. Without the letter2 item the axis is indeterminate and
    // collapses to letter1 (the ESTJ bug).
    const toward1 = forAxis.find((q) => q.direction === letter1);
    const toward2 = forAxis.find((q) => q.direction === letter2);
    if (toward1) out.push(toward1);
    if (toward2) out.push(toward2);
    // Defensive fallback: if the bank somehow lacks one pole, keep whatever
    // exists so the step still renders (the axis stays honestly indeterminate).
    if (!toward1 && !toward2 && forAxis[0]) out.push(forAxis[0]);
  }
  return out;
}

export const entryBig5Questions: Question[] = pickEntryBig5();
export const entryMbtiQuestions: MBTIQuestion[] = pickEntryMbti();

/** The full ordered list the Entry mini-personality step presents. */
export const entryPersonalityQuestions: Array<Question | MBTIQuestion> = [
  ...entryBig5Questions,
  ...entryMbtiQuestions,
];
