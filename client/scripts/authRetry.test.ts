// Standalone runtime proof for withAuthRetry — the refresh-on-401 orchestration
// that keeps a slow Entry-intake submit from dying on an expired access token.
// Run:  tsx scripts/authRetry.test.ts   (exit 0 = pass, throws on any failure)
//
// Memorialises the incident: access tokens live 15 minutes; a new user who
// lingers on the Entry questions outlives the token and, on submit, gets a
// 401 "Invalid token" that discards their intake. These assertions pin the
// contract — refresh once, retry once, never loop, never lose the original 401.

import { withAuthRetry } from '../src/utils/authRetry';

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + m); } };

// helper: an attempt that returns the given sequence of statuses, one per call
function sequence(...statuses: number[]) {
  let i = 0;
  const calls: number[] = [];
  const attempt = async () => {
    const status = statuses[Math.min(i, statuses.length - 1)];
    i++;
    calls.push(status);
    return { status, body: `resp-${status}` };
  };
  return { attempt, calls: () => calls, count: () => i };
}

// --- 1. Happy path: first attempt succeeds -> no refresh, no retry -----------
{
  const seq = sequence(200);
  let refreshed = 0;
  const res = await withAuthRetry(seq.attempt, async () => { refreshed++; });
  ok(res.status === 200, '200 passes straight through');
  ok(seq.count() === 1, 'exactly one attempt on success');
  ok(refreshed === 0, 'no refresh when not 401');
}

// --- 2. Non-401 error: passes through, NOT retried --------------------------
for (const code of [400, 403, 404, 409, 422, 500, 503]) {
  const seq = sequence(code);
  let refreshed = 0;
  const res = await withAuthRetry(seq.attempt, async () => { refreshed++; });
  ok(res.status === code, `${code} passes through untouched`);
  ok(seq.count() === 1, `${code} is not retried`);
  ok(refreshed === 0, `${code} does not trigger refresh`);
}

// --- 3. THE fix: 401 -> refresh -> retry succeeds ---------------------------
{
  const seq = sequence(401, 200);
  let refreshed = 0;
  const res = await withAuthRetry(seq.attempt, async () => { refreshed++; });
  ok(res.status === 200, '401 then refresh then retry -> 200');
  ok(refreshed === 1, 'refresh called exactly once');
  ok(seq.count() === 2, 'attempted exactly twice (original + one retry)');
}

// --- 4. Refresh fails (no/expired refresh token) -> original 401 returned ----
{
  const seq = sequence(401, 200); // would succeed IF retried — but refresh throws
  let refreshed = 0;
  const res = await withAuthRetry(seq.attempt, async () => { refreshed++; throw new Error('no refresh token'); });
  ok(res.status === 401, 'refresh failure surfaces the ORIGINAL 401');
  ok(refreshed === 1, 'refresh attempted once');
  ok(seq.count() === 1, 'no retry when refresh fails (no data loss masking)');
}

// --- 5. Still 401 after refresh -> returned, NO infinite loop ----------------
{
  const seq = sequence(401, 401, 401, 401);
  let refreshed = 0;
  const res = await withAuthRetry(seq.attempt, async () => { refreshed++; });
  ok(res.status === 401, 'persistent 401 is returned, not looped');
  ok(refreshed === 1, 'refresh attempted exactly once even on repeat 401');
  ok(seq.count() === 2, 'at most one retry — bounded work');
}

// --- 6. Result identity: the retried response object is what we return -------
{
  let i = 0;
  const attempt = async () => (i++ === 0 ? { status: 401, tag: 'stale' } : { status: 200, tag: 'fresh' });
  const res = await withAuthRetry(attempt, async () => {});
  ok((res as any).tag === 'fresh', 'returns the RETRIED response, not the stale one');
}

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: authRetry ${pass} passed, ${fail} failed`);
if (fail) throw new Error(`${fail} assertions failed`);
