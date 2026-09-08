// Proof for the root ("/") IntakeGate decision (rootGate.decideRootRoute).
//
// The conversion-critical invariant: an auth/transport READ FAILURE ('error')
// must NEVER route an authenticated user to /entry — only a DEFINITIVE 404
// ('empty') does. Regression guard for the bug where an access token that had
// expired at root-load 401'd GET /mirror/api/intake/latest and stranded an
// already-onboarded user in the Entry onboarding (/entry is exempt from
// RouteProtection, so nothing routed them back out).
//
// Run: tsx scripts/rootGate.test.ts

import { decideRootRoute } from '../src/components/auth/rootGate';

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + m); } };

// --- No identity → signup front door; the resolver outcome is irrelevant. ---
ok(decideRootRoute(false, 'empty') === '/register', 'no identity → /register (empty)');
ok(decideRootRoute(false, 'data')  === '/register', 'no identity → /register (data ignored)');
ok(decideRootRoute(false, 'error') === '/register', 'no identity → /register (error ignored)');

// --- Authenticated + resolvable intake → the app. ---
ok(decideRootRoute(true, 'data') === '/dashboard', 'identity + data → /dashboard');

// --- Authenticated + definitively no intake (HTTP 404) → fast onboarding. ---
ok(decideRootRoute(true, 'empty') === '/entry', 'identity + empty(404) → /entry');

// --- THE FIX: authenticated + READ FAILURE (401/403/5xx/network) → /dashboard,
//     NEVER /entry. RouteProtection + token refresh then make the real call. ---
ok(decideRootRoute(true, 'error') === '/dashboard', 'identity + error → /dashboard');
ok(decideRootRoute(true, 'error') !== '/entry', 'identity + error must NOT strand user in /entry');

// --- Exhaustive: every (identity × outcome) pair yields a real route, and the
//     only path to /entry is (authenticated, empty). ---
const outcomes = ['data', 'empty', 'error'] as const;
for (const id of [true, false]) {
  for (const o of outcomes) {
    const r = decideRootRoute(id, o);
    ok(r === '/register' || r === '/dashboard' || r === '/entry', `(${id},${o}) → valid route`);
    if (r === '/entry') ok(id === true && o === 'empty', `only (true,empty) may reach /entry — got (${id},${o})`);
  }
}

if (fail) { console.error(`\nrootGate: ${pass} passed, ${fail} FAILED`); process.exit(1); }
console.log(`rootGate: ${pass} passed`);
