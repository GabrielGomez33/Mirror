// Standalone runtime proof for the two-tier intake ROUTING decisions.
// Run:  tsx scripts/routing.test.ts   (exit 0 = pass, throws on any failure)
//
// Memorialises the conversion incident: newly-registered users were routed into
// the deep Core intake instead of the fast Entry onboarding, and signups did not
// convert. These assertions pin the fix — new users go to /entry, established and
// legacy users are NEVER bounced there — so it can never silently regress.

import {
  INTAKE_SEGMENTS,
  SEGMENT_TO_PROGRESS,
  getCurrentIntakeSegment,
  indexOfSeg,
  isAfter,
  getFirstIncompleteSegment,
  isSegmentCompleted,
  isIntakeRoute,
  isEntryExemptRoute,
  entrySatisfied,
  shouldRedirectToEntry,
  type ProgressShape,
} from '../src/components/auth/intakeRouting';

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + m); } };

// --- entrySatisfied: the single "entry done?" rule --------------------------
ok(entrySatisfied(false, false) === false, 'neither entry nor core -> not satisfied');
ok(entrySatisfied(true, false) === true, 'entry done -> satisfied');
ok(entrySatisfied(false, true) === true, 'core done (implies entry) -> satisfied');
ok(entrySatisfied(true, true) === true, 'both done -> satisfied');
// robustness: truthy/falsy coercion
ok(entrySatisfied(undefined as any, undefined as any) === false, 'undefined flags -> not satisfied');

// --- shouldRedirectToEntry: THE conversion decision -------------------------
const authNew = { isAuthenticated: true, isInitialIntakeCompleted: false, isIntakeCompleted: false };
ok(shouldRedirectToEntry({ ...authNew, pathname: '/dashboard' }) === true, 'NEW user on /dashboard -> redirect to /entry');
ok(shouldRedirectToEntry({ ...authNew, pathname: '/mymirror' }) === true, 'NEW user on /mymirror -> redirect');
ok(shouldRedirectToEntry({ ...authNew, pathname: '/truthstream' }) === true, 'NEW user on /truthstream -> redirect');

// Exempt routes: never bounce
for (const p of ['/entry', '/intake', '/login', '/register', '/home', '/landing', '/test']) {
  ok(shouldRedirectToEntry({ ...authNew, pathname: p }) === false, `NEW user on exempt ${p} -> NO redirect`);
}
ok(shouldRedirectToEntry({ ...authNew, pathname: '/intake/visual' }) === false, 'NEW user on /intake/visual -> NO redirect (intake owns it)');

// Not authenticated: the auth guard handles it, not the entry gate
ok(shouldRedirectToEntry({ ...authNew, isAuthenticated: false, pathname: '/dashboard' }) === false, 'unauth user -> NOT entry-redirected');

// Established users must NEVER be bounced into Entry
ok(shouldRedirectToEntry({ isAuthenticated: true, isInitialIntakeCompleted: true, isIntakeCompleted: false, pathname: '/dashboard' }) === false, 'ENTRY-done user -> NO redirect');
ok(shouldRedirectToEntry({ isAuthenticated: true, isInitialIntakeCompleted: false, isIntakeCompleted: true, pathname: '/dashboard' }) === false, 'LEGACY core-done (initial not backfilled) -> NO redirect');
ok(shouldRedirectToEntry({ isAuthenticated: true, isInitialIntakeCompleted: true, isIntakeCompleted: true, pathname: '/dashboard' }) === false, 'both-done user -> NO redirect');

// --- exempt/intake route predicates -----------------------------------------
ok(isIntakeRoute('/intake') === true, '/intake is an intake route');
ok(isIntakeRoute('/intake/astrology') === true, '/intake/astrology is an intake route');
ok(isIntakeRoute('/dashboard') === false, '/dashboard is not an intake route');
ok(isEntryExemptRoute('/login') === true, '/login exempt');
ok(isEntryExemptRoute('/intake/iq') === true, 'intake sub-route exempt');
ok(isEntryExemptRoute('/dashboard') === false, '/dashboard not exempt');

// --- intake segment ordering + progress -------------------------------------
ok(INTAKE_SEGMENTS.length === 7, 'seven intake segments');
ok(getCurrentIntakeSegment('/intake/astrology') === 'astrology', 'current segment parsed');
ok(getCurrentIntakeSegment('/intake') === null, 'no segment on bare /intake');
ok(getCurrentIntakeSegment('/intake/bogus') === null, 'unknown segment -> null');
ok(indexOfSeg('visual') === 0 && indexOfSeg('results') === 6, 'segment indices ordered');
ok(isAfter('iq', 'visual') === true, 'iq is after visual');
ok(isAfter('visual', 'iq') === false, 'visual is not after iq');

// first incomplete + completed checks over a partial progress object
const progress: ProgressShape = {
  steps: {
    VisualStep: { completed: true },
    VocalStep: { completed: true },
    IQStep: { completed: false },
  },
};
ok(getFirstIncompleteSegment(progress) === 'iq', 'first incomplete = iq (visual+vocal done)');
ok(isSegmentCompleted(progress, 'visual') === true, 'visual completed');
ok(isSegmentCompleted(progress, 'iq') === false, 'iq not completed');
ok(getFirstIncompleteSegment(undefined) === 'visual', 'no progress -> first segment');
ok(getFirstIncompleteSegment({ steps: {
  VisualStep: { completed: true }, VocalStep: { completed: true }, IQStep: { completed: true },
  AstroLogicalStep: { completed: true }, PersonalityStep: { completed: true },
  SubmitStep: { completed: true }, ResultsStep: { completed: true },
} }) === 'results', 'all complete -> results');

// SEGMENT_TO_PROGRESS covers every segment
ok(INTAKE_SEGMENTS.every((s) => !!SEGMENT_TO_PROGRESS[s]), 'every segment maps to a progress key');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: routing ${pass} passed, ${fail} failed`);
if (fail) throw new Error(`${fail} assertions failed`);
