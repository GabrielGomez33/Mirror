// Runtime proof for the dashboard intake-progress logic. Run:
//   npx tsx scripts/intakeProgress.test.ts
import { completedCount, progressPercent, statusOf, allComplete } from '../src/components/dashboard/intakeProgressLogic';
import { INTAKE_STEP_CATALOG, INTAKE_STEP_META } from '../src/components/dashboard/intakeStepCatalog';
import type { IntakeStepProgress } from '../src/services/intakeProgressApi';

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + m); } };

const steps: IntakeStepProgress[] = [
  { step: 'visual', status: 'completed', completedAt: null },
  { step: 'vocal', status: 'not_started', completedAt: null },
  { step: 'iq', status: 'in_progress', completedAt: null },
  { step: 'astrology', status: 'completed', completedAt: null },
  { step: 'personality', status: 'not_started', completedAt: null },
];

ok(completedCount(steps) === 2, 'completedCount = 2, got ' + completedCount(steps));
ok(progressPercent(steps) === 40, 'progressPercent = 40, got ' + progressPercent(steps));
ok(statusOf(steps, 'iq') === 'in_progress', 'statusOf iq');
ok(statusOf(steps, 'personality') === 'not_started', 'statusOf personality');
ok(statusOf([], 'iq') === 'not_started', 'statusOf missing -> not_started');
ok(allComplete(steps) === false, 'allComplete false with gaps');
ok(allComplete([]) === false, 'allComplete false for empty');
ok(progressPercent([]) === 0, 'progressPercent empty -> 0');

const allDone: IntakeStepProgress[] = steps.map((s) => ({ ...s, status: 'completed' as const }));
ok(allComplete(allDone) === true, 'allComplete true when all completed');
ok(progressPercent(allDone) === 100, 'progressPercent 100 when all done');

// Catalog integrity: 5 unique steps, each with content + a route + a lookup.
ok(INTAKE_STEP_CATALOG.length === 5, 'catalog has 5 steps');
ok(new Set(INTAKE_STEP_CATALOG.map((m) => m.key)).size === 5, 'catalog keys unique');
ok(INTAKE_STEP_CATALOG.every((m) => m.title && m.description && m.benefit && m.route.startsWith('/intake/')), 'every step has content + /intake route');
ok(INTAKE_STEP_META.personality.route === '/intake/personality', 'lookup map works');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: ${pass} passed, ${fail} failed`);
if (fail) throw new Error(`${fail} failed`);
