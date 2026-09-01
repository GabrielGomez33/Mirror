// Proof that erasing a Core draft clears the ON-DEVICE localStorage entry — the
// bug where the dashboard "Erase" only cleared the server, so Start still
// resumed from localStorage. Run: tsx scripts/coreDraftLocal.test.ts

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

import { LOCAL_DRAFT_KEYS, localDraftKey, clearLocalCoreDraft } from '../src/services/coreDraftLocal';

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + m); } };

// Registry pins the exact keys the step components read on mount.
ok(localDraftKey('iq') === 'mirror:intake:iq:progress', 'iq key matches the step key');
ok(localDraftKey('personality') === 'mirror:intake:personality:progress:v3', 'personality key matches the step key');
ok(Object.keys(LOCAL_DRAFT_KEYS).sort().join(',') === 'iq,personality', 'registry covers exactly the two long steps');

// The core fix: erasing removes the on-device draft so the next mount starts fresh.
localStorage.setItem('mirror:intake:iq:progress', JSON.stringify({ currentQuestionIndex: 12 }));
ok(localStorage.getItem('mirror:intake:iq:progress') !== null, 'iq draft present before erase');
clearLocalCoreDraft('iq');
ok(localStorage.getItem('mirror:intake:iq:progress') === null, 'iq draft gone after erase (Start now begins fresh)');

localStorage.setItem('mirror:intake:personality:progress:v3', JSON.stringify({ index: 8, answers: { a: 1 } }));
clearLocalCoreDraft('personality');
ok(localStorage.getItem('mirror:intake:personality:progress:v3') === null, 'personality draft gone after erase');

// Fail-safe: throwing storage must not throw into the caller.
{
  const saved = (globalThis as any).localStorage;
  (globalThis as any).localStorage = { removeItem() { throw new Error('SecurityError'); } };
  let threw = false;
  try { clearLocalCoreDraft('iq'); } catch { threw = true; }
  ok(!threw, 'clearLocalCoreDraft never throws even if storage is unavailable');
  (globalThis as any).localStorage = saved;
}

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: coreDraftLocal ${pass} passed, ${fail} failed`);
if (fail) throw new Error(`${fail} assertions failed`);
