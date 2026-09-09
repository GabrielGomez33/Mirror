// Regression proof for the Entry-intake MBTI collapse bug.
//
// THE BUG (fixed): the Entry MBTI mini-bank had ONE one-directional item per
// axis, but MBTIScoring.calculatePreference needs items on BOTH poles of an axis
// to compute a preference — with only one side it returns "indeterminate", which
// defaults to the axis's FIRST letter (E/S/T/J). Result: EVERY entry user scored
// "ESTJ" regardless of answers. This test pins the fix: the entry bank must carry
// both poles per axis, and differential answers must move the type off ESTJ.
//
// Run: tsx scripts/entryMbti.test.ts

import { scoreEntryPersonality } from '../src/components/intake/entry/logic/entryScoring';
import { entryMbtiQuestions, entryPersonalityQuestions } from '../src/components/intake/entry/data/entryQuestionBank';

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + m); } };

const AXES = { EI: ['E', 'I'], SN: ['S', 'N'], TF: ['T', 'F'], JP: ['J', 'P'] } as const;

// 1) Structural: the bank must contain BOTH poles for every axis (the fix).
for (const [axis, [l1, l2]] of Object.entries(AXES)) {
  const dirs = entryMbtiQuestions.filter((q: any) => q.dimension === axis).map((q: any) => q.direction);
  ok(dirs.includes(l1) && dirs.includes(l2), `axis ${axis} has both poles (${l1} & ${l2}); got [${dirs.join(',')}]`);
}

// Build an answer map that leans every axis toward a chosen pole: score the
// item keyed to the target letter HIGH and the opposite item LOW. Big-5 items
// are given a neutral mid score (they don't affect MBTI letters).
function leanToward(target: (q: any) => boolean) {
  const m: Record<string, { value: string; score: number }> = {};
  entryPersonalityQuestions.forEach((q: any) => {
    const isMbti = 'direction' in q;
    m[q.id] = { value: 'v', score: isMbti ? (target(q) ? 7 : 1) : 4 };
  });
  return m;
}

// 2) Leaning every axis toward its SECOND pole must yield the all-second-letter
//    type (INFP) — the exact opposite of the old stuck "ESTJ". Proves each axis
//    actually responds to answers.
const secondPoleLetters = new Set(['I', 'N', 'F', 'P']);
const infp = (scoreEntryPersonality(leanToward((q) => secondPoleLetters.has(q.direction))) as any).mbtiType;
ok(infp === 'INFP', `leaning all axes to second pole yields INFP (not stuck ESTJ); got ${infp}`);

// 3) Leaning toward the FIRST pole yields ESTJ — confirms directionality both ways.
const firstPoleLetters = new Set(['E', 'S', 'T', 'J']);
const estj = (scoreEntryPersonality(leanToward((q) => firstPoleLetters.has(q.direction))) as any).mbtiType;
ok(estj === 'ESTJ', `leaning all axes to first pole yields ESTJ; got ${estj}`);

// 4) The scorer is NOT stuck on one constant type: differential sweeps produce
//    multiple distinct types (the old code produced exactly {"ESTJ"}).
const types = new Set<string>();
const letters = [['E', 'I'], ['S', 'N'], ['T', 'F'], ['J', 'P']];
for (let mask = 0; mask < 16; mask++) {
  const want = new Set(letters.map((pair, i) => pair[(mask >> i) & 1]));
  types.add((scoreEntryPersonality(leanToward((q) => want.has(q.direction))) as any).mbtiType);
}
ok(types.size >= 8, `differential answers produce many distinct MBTI types; got ${types.size} (${[...types].join(',')})`);

if (fail) { console.error(`\nentryMbti: ${pass} passed, ${fail} FAILED`); process.exit(1); }
console.log(`entryMbti: ${pass} passed — entry MBTI responds to answers across all axes`);
