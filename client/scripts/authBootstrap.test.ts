// Proof for the auth-bootstrap safety logic behind the optimistic-hydration
// refresh fix. Run: tsx scripts/authBootstrap.test.ts
//
// Two guarantees:
//  1) isTransientVerifyError decides whether a verify() failure during bootstrap
//     logs the user out. A TRANSIENT failure (network blip, or the server's 503
//     CONTEXT_UNAVAILABLE — token still valid) must NEVER nuke the token or blank
//     the optimistically-hydrated session; only a DEFINITIVE auth failure may.
//  2) entrySatisfied is the ONE definition of "onboarded" the IntakeGate cached
//     fast-path uses to route straight to /dashboard without a network wait.

class MemStore {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key() { return null; }
  get length() { return this.m.size; }
}
(globalThis as any).localStorage = new MemStore();

import { isTransientVerifyError } from '../src/services/authApi';
import { entrySatisfied } from '../src/components/auth/intakeRouting';

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + m); } };

// --- TRANSIENT (must NOT log out) -------------------------------------------
ok(isTransientVerifyError(new TypeError('Failed to fetch')) === true, 'network "Failed to fetch" → transient (keep session)');
ok(isTransientVerifyError({ error: 'unavailable', code: 'CONTEXT_UNAVAILABLE' }) === true, 'server 503 CONTEXT_UNAVAILABLE → transient (token still valid)');

// --- DEFINITIVE auth failures (these DO log out) ----------------------------
ok(isTransientVerifyError({ error: 'x', code: 'INVALID_TOKEN' }) === false, 'INVALID_TOKEN → definitive');
ok(isTransientVerifyError({ error: 'x', code: 'INVALID_SESSION' }) === false, 'INVALID_SESSION → definitive');
ok(isTransientVerifyError({ error: 'x', code: 'NO_TOKEN' }) === false, 'NO_TOKEN → definitive');
ok(isTransientVerifyError({ error: 'x', code: 'SESSION_EXPIRED' }) === false, 'SESSION_EXPIRED → definitive');

// --- shape guards: only a well-formed ApiError with the right code is transient
ok(isTransientVerifyError(new Error('boom')) === false, 'plain Error → not transient');
ok(isTransientVerifyError({ code: 'CONTEXT_UNAVAILABLE' }) === false, 'missing .error field → not an ApiError → not transient');
ok(isTransientVerifyError(null) === false, 'null → not transient');
ok(isTransientVerifyError(undefined) === false, 'undefined → not transient');

// --- cached fast-path "onboarded" predicate (IntakeGate) --------------------
ok(entrySatisfied(true, false) === true, 'cached initialIntakeCompleted → onboarded → fast-path /dashboard');
ok(entrySatisfied(false, true) === true, 'cached intakeCompleted → onboarded → fast-path /dashboard');
ok(entrySatisfied(true, true) === true, 'both flags → onboarded');
ok(entrySatisfied(false, false) === false, 'neither flag → must resolve over network (no fast-path)');

if (fail) { console.error(`\nauthBootstrap: ${pass} passed, ${fail} FAILED`); process.exit(1); }
console.log(`authBootstrap: ${pass} passed`);
