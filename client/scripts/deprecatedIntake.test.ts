// Standalone source-guard for the deprecated-intake cleanup.
// Run:  tsx scripts/deprecatedIntake.test.ts   (exit 0 = pass, throws on failure)
//
// Principle being protected: the Core intake is ENRICHMENT, not a gate. More
// intake data → richer signal → a more accurate Mirror. So a premium feature
// must never HARD-BLOCK on Core-intake completion, and must never dump a user
// into the deprecated deep /intake flow. If access isn't satisfied, the user
// goes to /mymirror — the benefit-framed "Deepen your Mirror" hub — to enrich
// at their own pace.
//
// The conversion incident this memorialises: clicking TruthStream (a PREMIUM
// feature) bounced users into the deep Core /intake flow instead of letting the
// page's own premium wall handle them — swallowing premium intent entirely.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(join(__dirname, '../src/App.tsx'), 'utf8');

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + m); } };

// Extract the JSX block for a given route path: from `path="/x"` to the end of
// its <ProtectedRoute> element, so assertions are scoped to that one route.
function routeBlock(path: string): string {
  const anchor = APP.indexOf(`path="${path}"`);
  if (anchor < 0) return '';
  const end = APP.indexOf('</ProtectedRoute>', anchor);
  return end < 0 ? '' : APP.slice(anchor, end);
}

// --- TruthStream: premium feature, Entry-gated, page owns premium ------------
const ts = routeBlock('/truthstream');
ok(ts.length > 0, 'truthstream route block found');
ok(!ts.includes('redirectTo="/intake"'), 'truthstream does NOT redirect to the deprecated /intake');
ok(ts.includes('redirectTo="/mymirror"'), 'truthstream redirects to /mymirror (Deepen hub) instead');
ok(!ts.includes('INTAKE_REQUIRED'), 'truthstream does NOT hard-require Core intake (it is enrichment, not a gate)');
ok(ts.includes('ENTRY_REQUIRED'), 'truthstream gates on day-one ENTRY access');
ok(!ts.includes('intakeCompleted'), 'truthstream drops the Core intakeCompleted force (premium wall lives in the page)');

// --- The cleanup routed the premium feature to the enrichment hub -----------
ok(APP.includes('redirectTo="/mymirror"'), 'cleanup routes a feature bounce to /mymirror (the Deepen hub)');

// Scope note: /results and /review are deliberately NOT changed here. They are
// deep Core-data surfaces entangled with the TIER2 -> /upgrade premium flow, so
// their redirect is a separate, deliberate decision — not part of the TruthStream
// premium-click fix. This guard intentionally does NOT assert zero /intake
// redirects globally; it pins ONLY that TruthStream no longer dumps into it.

// --- /mymirror stays reachable on day-one Entry (the enrichment hub) ---------
const mm = routeBlock('/mymirror');
ok(mm.includes('ENTRY_REQUIRED'), '/mymirror is reachable after the fast Entry intake');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: deprecatedIntake ${pass} passed, ${fail} failed`);
if (fail) throw new Error(`${fail} assertions failed`);
