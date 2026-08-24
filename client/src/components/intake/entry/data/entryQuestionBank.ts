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
    const forAxis = mbtiQuestions.filter((q) => q.dimension === axis);
    if (forAxis[0]) out.push(forAxis[0]);
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
