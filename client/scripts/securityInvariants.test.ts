// scripts/securityInvariants.test.ts
// ============================================================================
// CLIENT SECURITY REVIEW, AS A BLOCKING GATE.
// ----------------------------------------------------------------------------
// The Phase-6 client security review came back clean. This encodes its findings
// as executable invariants so a regression fails CI (npm run test:ci, which the
// pipeline blocks on) instead of shipping. Static/source-level assertions — fast,
// no browser, no network.
//
// Run: tsx scripts/securityInvariants.test.ts
// ============================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + m); } };
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function walkSrc(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(ent.name)) out.push(full);
    }
  };
  walk(SRC);
  return out;
}
const allSrc = walkSrc();
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

// --- 1. API base never resolves to the literal string "undefined" ------------
// The regression: dropping the `|| ''` fallback made BASE_URL the string
// "undefined", producing request URLs like `/Mirror/undefined/mirror/api/...`.
// The two files that broke MUST keep an explicit empty-string fallback so a
// same-origin (Apache-proxied) deploy builds a relative path.
{
  ok(/VITE_API_URL\s*\|\|\s*''/.test(read('src/services/authApi.ts')),
    'authApi BASE_URL falls back to "" (no literal "undefined")');
  ok(/VITE_API_URL\s*\|\|\s*''/.test(read('src/services/mirrorDashboard.ts')),
    'mirrorDashboard BASE_URL falls back to "" (no literal "undefined")');
  // Repo-wide: no service may build a base as `${VITE_API_URL}/...` WITHOUT a
  // guard — that is exactly what yields "undefined/..." on a same-origin build.
  // (The safe forms are `VITE_API_URL || ''` and `VITE_API_URL ? ... : ...`.)
  const offenders: string[] = [];
  for (const f of allSrc) {
    const txt = stripComments(fs.readFileSync(f, 'utf8'));
    // a template literal that interpolates VITE_API_URL directly at the START
    // of a path, with no `||`/ternary guard anywhere on the line.
    const bad = /=\s*`\$\{\s*import\.meta\.env\.VITE_API_URL\s*\}\/[a-z]/.test(txt);
    if (bad) offenders.push(path.relative(ROOT, f));
  }
  ok(offenders.length === 0, `no unguarded \${VITE_API_URL}/path base (offenders: ${offenders.join(', ') || 'none'})`);
}

// --- 2. No XSS sinks in client source ----------------------------------------
{
  const sinks = [/dangerouslySetInnerHTML/, /\.innerHTML\s*=/, /\beval\s*\(/, /new\s+Function\s*\(/];
  const offenders: string[] = [];
  for (const f of allSrc) {
    const txt = stripComments(fs.readFileSync(f, 'utf8'));
    if (sinks.some((re) => re.test(txt))) offenders.push(path.relative(ROOT, f));
  }
  ok(offenders.length === 0, `no XSS sinks (dangerouslySetInnerHTML/innerHTML=/eval/new Function) (offenders: ${offenders.join(', ') || 'none'})`);
}

// --- 3. No TLS-verification bypass in client source --------------------------
{
  const bad = [/rejectUnauthorized\s*[:=]\s*false/, /NODE_TLS_REJECT_UNAUTHORIZED/];
  const offenders: string[] = [];
  for (const f of allSrc) {
    const txt = stripComments(fs.readFileSync(f, 'utf8'));
    if (bad.some((re) => re.test(txt))) offenders.push(path.relative(ROOT, f));
  }
  ok(offenders.length === 0, `no TLS bypass in client source (offenders: ${offenders.join(', ') || 'none'})`);
}

// --- 4. PWA under Basic Auth: credentialed manifest + favicons ---------------
// Without credentials the manifest/favicon fetch 401s under staging Basic Auth,
// re-triggering the browser sign-in popup on every refresh.
{
  ok(/useCredentials:\s*true/.test(read('vite.config.ts')),
    'VitePWA manifest link is credentialed (useCredentials: true)');
  ok(/crossorigin=["']use-credentials["']/.test(read('index.html')),
    'favicon links use crossorigin="use-credentials"');
}

if (fail) { console.error(`\nsecurityInvariants(client): ${pass} passed, ${fail} FAILED`); process.exit(1); }
console.log(`securityInvariants(client): ${pass} passed — client security-review invariants hold`);
