// Standalone runtime proof for Entry pure logic. Run:
//   npx ts-node --compiler-options '{"module":"commonjs","moduleResolution":"node","esModuleInterop":true,"skipLibCheck":true}' scripts/entryLogic.test.ts
import { computeAstrology } from '../src/components/intake/shared/astrology/computeAstrology';
import { scoreEntryPersonality } from '../src/components/intake/entry/logic/entryScoring';
import { entryPersonalityQuestions, entryBig5Questions, entryMbtiQuestions } from '../src/components/intake/entry/data/entryQuestionBank';
import {
  allAnswered, answeredCount, firstUnansweredIndex, clampDraftStep, isValidBirthDate,
} from '../src/components/intake/entry/logic/entryFlowLogic';

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + m); } };
const throws = (fn: () => unknown, m: string) => {
  try { fn(); ok(false, m + ' (expected throw)'); } catch { ok(true, m); }
};

// --- Astrology: real birthday March 30, 1996 must be Aries ---
const chart = computeAstrology({ date: '1996-03-30' });
ok(chart.western.sunSign === 'Aries', 'sun=Aries for 1996-03-30, got ' + chart.western.sunSign);
ok(!!chart.western.risingSign, 'rising present');
ok(!!chart.chinese.animalSign, 'chinese animal present (' + chart.chinese.animalSign + ')');
ok(typeof chart.numerology.lifePathNumber === 'number', 'life path is number (' + chart.numerology.lifePathNumber + ')');
ok(!!chart.synthesis.lifeDirection, 'synthesis lifeDirection present');
// A different date yields a different sun (sanity)
ok(computeAstrology({ date: '1990-07-30' }).western.sunSign === 'Leo', 'sun=Leo for 1990-07-30');

// --- Bank curation ---
ok(entryBig5Questions.length >= 5, 'has Big5 items (' + entryBig5Questions.length + ')');
ok(entryMbtiQuestions.length === 4, 'one MBTI item per axis (' + entryMbtiQuestions.length + ')');

// --- Personality: answer every mini question -> valid frozen result ---
const answers: Record<string, { value: string; score: number }> = {};
for (const q of entryPersonalityQuestions) {
  const opt = q.options[Math.floor(q.options.length / 2)]; // middle Likert option
  answers[q.id] = { value: opt.value, score: opt.score };
}
const p = scoreEntryPersonality(answers);
ok(/^[EI][SN][TF][JP]$/.test(p.mbtiType), 'valid MBTI type, got ' + p.mbtiType);
ok(p.confidence === 'preliminary', 'confidence=preliminary');
const b5 = p.big5Profile;
const vals = [b5.openness, b5.conscientiousness, b5.extraversion, b5.agreeableness, b5.neuroticism];
ok(vals.every((n) => typeof n === 'number' && n >= 0 && n <= 100), 'big5 all 0-100: ' + JSON.stringify(b5));
ok(Array.isArray(p.dominantTraits), 'dominantTraits is array');
ok(typeof p.description === 'string' && p.description.length > 0, 'description present');

// --- EDGE: invalid / empty birth date must throw, not mis-compute ---
throws(() => computeAstrology({ date: '' }), 'empty date throws');
throws(() => computeAstrology({ date: 'not-a-date' }), 'garbage date throws');
throws(() => computeAstrology({ date: '1996-13-40' }), 'impossible date throws');

// --- EDGE: missing time defaults to noon -> identical to explicit 12:00 ---
ok(
  JSON.stringify(computeAstrology({ date: '1996-03-30' })) ===
  JSON.stringify(computeAstrology({ date: '1996-03-30', time: '12:00' })),
  'missing time == noon (deterministic)'
);

// --- EDGE: PARTIAL answers still yield a valid preliminary result ---
{
  const partial: Record<string, { value: string; score: number }> = {};
  // Answer only the first half of the questions.
  entryPersonalityQuestions.slice(0, Math.ceil(entryPersonalityQuestions.length / 2)).forEach((q) => {
    const opt = q.options[0];
    partial[q.id] = { value: opt.value, score: opt.score };
  });
  const pr = scoreEntryPersonality(partial);
  ok(/^[EI][SN][TF][JP]$/.test(pr.mbtiType), 'partial answers -> valid MBTI (' + pr.mbtiType + ')');
  ok(pr.confidence === 'preliminary', 'partial -> still preliminary');
}
// --- EDGE: empty answers must not crash the scorer ---
{
  const pr = scoreEntryPersonality({});
  ok(/^[EI][SN][TF][JP]$/.test(pr.mbtiType), 'empty answers -> defaulted valid MBTI (' + pr.mbtiType + ')');
}

// --- Flow logic (pure) ---
const ids = ['a', 'b', 'c'];
ok(answeredCount(ids, {}) === 0, 'answeredCount none');
ok(answeredCount(ids, { a: { value: '1', score: 1 } }) === 1, 'answeredCount one');
ok(allAnswered(ids, { a: { value: '1', score: 1 }, b: { value: '1', score: 1 }, c: { value: '1', score: 1 } }) === true, 'allAnswered true');
ok(allAnswered(ids, { a: { value: '1', score: 1 } }) === false, 'allAnswered false with gaps');
ok(allAnswered([], {}) === false, 'allAnswered false for empty list');
ok(firstUnansweredIndex(ids, { a: { value: '1', score: 1 } }) === 1, 'firstUnanswered = 1');
ok(firstUnansweredIndex(ids, { a: { value: '1', score: 1 }, b: { value: '1', score: 1 }, c: { value: '1', score: 1 } }) === -1, 'firstUnanswered = -1 when complete');
ok(clampDraftStep(99, 0, 2) === 2, 'clampDraftStep upper');
ok(clampDraftStep(-5, 0, 2) === 0, 'clampDraftStep lower');
ok(clampDraftStep('bad', 0, 2) === 0, 'clampDraftStep non-numeric -> min');
ok(clampDraftStep(1, 0, 2) === 1, 'clampDraftStep in-range');
ok(isValidBirthDate('1996-03-30') === true, 'valid date');
ok(isValidBirthDate('1996-13-40') === false, 'invalid date rejected');
ok(isValidBirthDate('03/30/1996') === false, 'wrong format rejected');
ok(isValidBirthDate(undefined) === false, 'undefined date rejected');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: ${pass} passed, ${fail} failed`);
if (fail) throw new Error(`${fail} assertions failed`);
