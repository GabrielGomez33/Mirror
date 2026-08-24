// components/intake/entry/logic/entryScoring.ts
// ----------------------------------------------------------------------------
// Mini-personality scorer for the Entry intake. It REUSES the full pipeline —
// DataQualityMonitor -> IntegratedPersonalityScorer -> PersonalityResultAdapter
// — but feeds it the curated mini question subset. Because the pipeline derives
// reliability from the data it's given, fewer items naturally yield lower
// reliability (an honest reflection of the reduced sample), and we stamp the
// output 'preliminary'. The wire shape is the frozen PersonalityResult the
// backend + Dina already consume, so an Entry result is a first-class (if
// lighter-weight) personality result.
// ----------------------------------------------------------------------------

import IntegratedPersonalityScorer from '../../personality/integratedScoring';
import { DataQualityMonitor } from '../../personality/dataQualityMonitor';
import PersonalityResultAdapter, { type PersonalityResult } from '../../personality/personalityResultAdapter';
import type { AnswerMap, ScorableQuestion } from '../../personality/types';
import { entryBig5Questions, entryMbtiQuestions } from '../data/entryQuestionBank';

export interface EntryPersonalityResult extends PersonalityResult {
  /** Always 'preliminary' — Entry uses a reduced item set. */
  confidence: 'preliminary';
}

/**
 * Score the Entry mini-personality answers into the frozen PersonalityResult
 * shape (+ a 'preliminary' confidence marker). `answers` maps questionId ->
 * { value, score } for the curated Entry questions.
 */
export function scoreEntryPersonality(answers: AnswerMap): EntryPersonalityResult {
  const allQuestions = [...entryBig5Questions, ...entryMbtiQuestions];

  // Rebuild the quality signal from the answers we have (no live timing needed).
  const monitor = new DataQualityMonitor();
  for (const q of allQuestions) {
    const a = answers[q.id];
    if (a) monitor.restoreResponse(q.id, a);
  }
  const quality = monitor.generateQualityMetrics(allQuestions as unknown as ScorableQuestion[]);

  const comprehensive = IntegratedPersonalityScorer.calculateComprehensiveResult(
    answers,
    entryBig5Questions,
    entryMbtiQuestions,
    quality
  );

  const base = PersonalityResultAdapter.adaptToExistingFormat(comprehensive);
  return { ...base, confidence: 'preliminary' };
}
