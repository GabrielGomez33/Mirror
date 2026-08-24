// Standalone runtime proof for Entry pure logic. Run:
//   npx ts-node --compiler-options '{"module":"commonjs","moduleResolution":"node","esModuleInterop":true,"skipLibCheck":true}' scripts/entryLogic.test.ts
import { computeAstrology } from '../src/components/intake/shared/astrology/computeAstrology';
import { scoreEntryPersonality } from '../src/components/intake/entry/logic/entryScoring';
import { entryPersonalityQuestions, entryBig5Questions, entryMbtiQuestions } from '../src/components/intake/entry/data/entryQuestionBank';

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + m); } };

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

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: ${pass} passed, ${fail} failed`);
if (fail) throw new Error(`${fail} assertions failed`);
