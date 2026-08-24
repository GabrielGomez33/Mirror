// components/intake/entry/logic/entryFlowLogic.ts
// ----------------------------------------------------------------------------
// PURE decision logic for the Entry flow — no React, no I/O — so the completion
// / navigation rules are unit-testable in isolation and can't hide UX
// dead-ends inside the component.
// ----------------------------------------------------------------------------

export type AnswerRecord = Record<string, { value: string; score: number } | undefined>;

/** How many of the given question ids have a stored answer. */
export function answeredCount(questionIds: string[], answers: AnswerRecord): number {
  return questionIds.reduce((n, id) => (answers[id] ? n + 1 : n), 0);
}

/** Are all questions answered? (empty list => not complete; there is nothing to answer) */
export function allAnswered(questionIds: string[], answers: AnswerRecord): boolean {
  return questionIds.length > 0 && questionIds.every((id) => !!answers[id]);
}

/** Index of the first unanswered question, or -1 if all are answered. */
export function firstUnansweredIndex(questionIds: string[], answers: AnswerRecord): number {
  return questionIds.findIndex((id) => !answers[id]);
}

/**
 * Clamp a (possibly stale / out-of-range) restored draft step into the valid
 * pre-result range [minStep, maxStep]. Never restore straight to the result.
 */
export function clampDraftStep(step: unknown, minStep: number, maxStep: number): number {
  const n = Number(step);
  if (!Number.isFinite(n)) return minStep;
  return Math.min(maxStep, Math.max(minStep, Math.trunc(n)));
}

/** Basic YYYY-MM-DD sanity: correct shape AND a real calendar date. */
export function isValidBirthDate(date: string | undefined): boolean {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T00:00:00`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}
