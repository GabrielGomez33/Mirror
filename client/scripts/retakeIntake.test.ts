// Proof for the RETAKE seam (services/retakeIntake).
//
// Retake lets a user redo a single Core section from its MyMirror tab. The
// conversion-critical invariant this pins: the retake deep-link MUST carry
// `?deepen=1`. Without it, RouteProtection bounces a core-complete user back to
// /dashboard and the retake step never renders — so the whole feature would
// silently no-op for exactly the users it exists for. This also pins the
// tab→step mapping (so a renamed tab can't quietly drop a section) and that
// non-section tabs are not retakeable.
//
// Run: tsx scripts/retakeIntake.test.ts

import {
  TAB_TO_CORE_STEP,
  isRetakeableTab,
  coreStepForTab,
  retakePathForStep,
  retakePathForTab,
  type RetakeableTab,
} from '../src/services/retakeIntake';
import { INTAKE_STEP_META } from '../src/components/dashboard/intakeStepCatalog';

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + m); } };

// --- The five data-section tabs are exactly the retakeable set. --------------
const RETAKEABLE: RetakeableTab[] = ['personality', 'astrology', 'cognitive', 'emotional', 'voice'];
ok(Object.keys(TAB_TO_CORE_STEP).length === 5, 'exactly 5 tabs are retakeable');
for (const t of RETAKEABLE) ok(isRetakeableTab(t), `${t} is retakeable`);

// --- Non-section tabs are NOT retakeable (no button, no route). --------------
for (const t of ['overview', 'analysis', 'answers', 'meta', 'export', 'nonsense']) {
  ok(!isRetakeableTab(t), `${t} is not retakeable`);
  ok(coreStepForTab(t) === null, `${t} → no core step`);
  ok(retakePathForTab(t) === null, `${t} → no retake path`);
}

// --- Tab → Core step mapping is correct (theme names vs mechanism names). ----
ok(TAB_TO_CORE_STEP.personality === 'personality', 'personality → personality step');
ok(TAB_TO_CORE_STEP.astrology === 'astrology', 'astrology → astrology step');
ok(TAB_TO_CORE_STEP.cognitive === 'iq', 'cognitive tab → iq step');
ok(TAB_TO_CORE_STEP.emotional === 'visual', 'emotional tab → visual (face) step');
ok(TAB_TO_CORE_STEP.voice === 'vocal', 'voice tab → vocal step');

// --- Every mapped step resolves to a real catalog route. ---------------------
for (const t of RETAKEABLE) {
  const step = TAB_TO_CORE_STEP[t];
  ok(!!INTAKE_STEP_META[step], `step ${step} exists in the intake catalog`);
}

// --- THE INVARIANT: every retake path carries ?deepen=1 and the right base. --
for (const t of RETAKEABLE) {
  const step = TAB_TO_CORE_STEP[t];
  const viaTab = retakePathForTab(t)!;
  const viaStep = retakePathForStep(step);
  ok(viaTab === viaStep, `${t}: tab path === step path`);
  ok(viaTab.includes('?deepen=1'), `${t}: retake path carries ?deepen=1 (else RouteProtection bounces)`);
  ok(viaTab.startsWith(INTAKE_STEP_META[step].route + '?'), `${t}: retake path is the step's route + query`);
}

// Spot-check the exact strings.
ok(retakePathForTab('cognitive') === '/intake/iq?deepen=1', 'cognitive retake → /intake/iq?deepen=1');
ok(retakePathForTab('emotional') === '/intake/visual?deepen=1', 'emotional retake → /intake/visual?deepen=1');
ok(retakePathForTab('voice') === '/intake/vocal?deepen=1', 'voice retake → /intake/vocal?deepen=1');

if (fail) { console.error(`\nretakeIntake: ${pass} passed, ${fail} FAILED`); process.exit(1); }
console.log(`retakeIntake: ${pass} passed — retake maps every section to its Core step in deepen mode`);
