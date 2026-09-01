// Standalone runtime proof for the Core-draft merge/progress logic.
// Run:  tsx scripts/coreDraft.test.ts   (exit 0 = pass, throws on any failure)
//
// Proves "furthest progress wins" and the resume-banner math for the two long
// steps (IQ, Personality). Content-derived, clock-free — the whole point is that
// a cross-device conflict resolves from answers, not timestamps, and never
// throws on a malformed draft.

import {
  draftAnsweredCount,
  draftProgress,
  chooseFurthestDraft,
} from '../src/services/coreDraftMerge';

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + m); } };

// --- draftAnsweredCount: IQ (userAnswers record) ----------------------------
ok(draftAnsweredCount('iq', { userAnswers: { q1: 'a', q2: 'b', q3: null } }) === 2, 'IQ counts non-null answers');
ok(draftAnsweredCount('iq', { userAnswers: { q1: '', q2: 'b' } }) === 1, 'IQ ignores empty-string answers');
ok(draftAnsweredCount('iq', { currentQuestionIndex: 5 }) === 5, 'IQ falls back to currentQuestionIndex');
ok(draftAnsweredCount('iq', {}) === 0, 'IQ empty -> 0');

// --- draftAnsweredCount: Personality (answers map) --------------------------
ok(draftAnsweredCount('personality', { answers: { a: 1, b: 2, c: 3 } }) === 3, 'personality counts answer keys');
ok(draftAnsweredCount('personality', { index: 4 }) === 4, 'personality falls back to index');
ok(draftAnsweredCount('personality', {}) === 0, 'personality empty -> 0');

// --- robustness: never throws on garbage -----------------------------------
ok(draftAnsweredCount('iq', null) === 0, 'null draft -> 0');
ok(draftAnsweredCount('iq', 'nope' as any) === 0, 'string draft -> 0');
ok(draftAnsweredCount('personality', [] as any) === 0, 'array draft -> 0');
ok(draftAnsweredCount('iq', { userAnswers: 'bad' } as any) === 0, 'bad userAnswers -> 0');

// --- draftProgress: answered/total/percent ---------------------------------
{
  const p = draftProgress('iq', { questions: new Array(20), userAnswers: { q1: 'a', q2: 'b', q3: 'c' } });
  ok(p.answered === 3 && p.total === 20 && p.percent === 15, 'IQ progress 3/20 = 15%');
}
{
  const p = draftProgress('personality', { orderIds: new Array(50), answers: { a: 1, b: 2 } });
  ok(p.answered === 2 && p.total === 50 && p.percent === 4, 'personality 2/50 = 4%');
}
{
  const p = draftProgress('iq', { userAnswers: { q1: 'a' } }); // no questions[] -> total unknown
  ok(p.answered === 1 && p.total === 0 && p.percent === 0, 'unknown total -> percent 0 (no wrong %)');
}
ok(draftProgress('iq', { questions: new Array(3), userAnswers: { a: 1, b: 1, c: 1, d: 1 } }).percent === 100, 'percent capped at 100');

// --- chooseFurthestDraft: the conflict rule ---------------------------------
ok(chooseFurthestDraft('iq', null, null).source === 'none', 'no drafts -> none');
ok(chooseFurthestDraft('iq', { userAnswers: { a: 1 } }, null).source === 'local', 'only local -> local');
ok(chooseFurthestDraft('iq', null, { userAnswers: { a: 1 } }).source === 'server', 'only server -> server');

ok(chooseFurthestDraft('iq',
  { userAnswers: { a: 1, b: 1 } },              // local: 2
  { userAnswers: { a: 1, b: 1, c: 1, d: 1 } },  // server: 4
).source === 'server', 'server further -> server wins');

ok(chooseFurthestDraft('iq',
  { userAnswers: { a: 1, b: 1, c: 1 } },        // local: 3
  { userAnswers: { a: 1 } },                    // server: 1
).source === 'local', 'local further -> local wins');

ok(chooseFurthestDraft('personality',
  { answers: { a: 1, b: 1 } },                  // local: 2
  { answers: { a: 1, b: 1 } },                  // server: 2 (tie)
).source === 'local', 'tie -> local kept (no needless overwrite)');

{
  const c = chooseFurthestDraft('iq', { userAnswers: { a: 1 } }, { userAnswers: { a: 1, b: 1, c: 1 } });
  ok(c.localCount === 1 && c.serverCount === 3 && (c.draft as any).userAnswers.c === 1, 'choice carries counts + the winning draft');
}

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: coreDraft ${pass} passed, ${fail} failed`);
if (fail) throw new Error(`${fail} assertions failed`);
