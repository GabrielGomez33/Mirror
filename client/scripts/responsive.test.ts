// Standalone runtime proof for mobile responsiveness / notch / UX invariants.
// Run:  tsx scripts/responsive.test.ts   (exit 0 = pass, throws on any failure)
//
// These are STRUCTURAL guards for the whole app: viewport-fit for the notch,
// the safe-area-inset token system, a horizontal-overflow guard (the classic
// iOS/Galaxy sideways-scroll bug), iOS zoom-on-focus prevention, and the a11y/UX
// baselines (reduced-motion, focus-visible). Removing any of them silently
// re-introduces a device-specific regression — this gate makes that a red build.

import { readFileSync } from 'fs';
import { execSync } from 'child_process';

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + m); } };
const read = (p: string) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };

const html = read('index.html');
const shell = read('src/styles/pwa-shell.css');
const indexCss = read('src/index.css');

// --- Viewport: notch draw-under + mobile width -----------------------------
const viewport = (html.match(/<meta[^>]*name=["']viewport["'][^>]*>/i) || [''])[0];
ok(/width=device-width/i.test(viewport), 'viewport meta sets width=device-width');
ok(/viewport-fit=cover/i.test(viewport), 'viewport meta sets viewport-fit=cover (draw under the notch)');
ok(/initial-scale=1/i.test(viewport), 'viewport meta pins initial-scale=1');
// iOS standalone status bar (notch area) styling present
ok(/apple-mobile-web-app-status-bar-style/i.test(html), 'iOS status-bar-style meta present (notch/standalone)');

// --- Safe-area inset token system (notches / home indicator) ---------------
for (const side of ['top', 'right', 'bottom', 'left']) {
  ok(new RegExp(`--safe-area-inset-${side}\\s*:\\s*env\\(safe-area-inset-${side}`, 'i').test(shell),
    `--safe-area-inset-${side} defined from env() in pwa-shell.css`);
}
ok(/@import\s+['"][^'"]*pwa-shell\.css/i.test(indexCss), 'pwa-shell.css is imported (so the safe-area vars actually load)');

// --- Horizontal-overflow guard (no sideways scroll on mobile) --------------
ok(/overflow-x\s*:\s*(clip|hidden)/i.test(shell), 'global horizontal-overflow guard (overflow-x: clip/hidden) on html/body');

// --- iOS zoom-on-focus prevention (inputs >= 16px on touch) ----------------
ok(/pointer\s*:\s*coarse/i.test(shell) && /font-size\s*:\s*16px/i.test(shell),
  'inputs pinned to 16px under (pointer: coarse) — prevents iOS zoom-on-focus');

// --- Overscroll / tap-highlight polish (mobile feel) -----------------------
ok(/overscroll-behavior/i.test(shell), 'overscroll-behavior set (no iOS rubber-band on the document)');
ok(/-webkit-tap-highlight-color\s*:\s*transparent/i.test(shell), 'tap-highlight suppressed (custom active states)');

// --- A11y / UX baselines ---------------------------------------------------
ok(/prefers-reduced-motion/i.test(shell), 'prefers-reduced-motion accommodation present (WCAG 2.3.3)');
ok(/:focus-visible/i.test(shell), 'focus-visible ring baseline present (keyboard a11y)');

// --- Theme-token system (aesthetics: components read tokens, not hardcodes) -
ok(/--mg-[a-z-]+\s*:/i.test(indexCss), 'theme-token palette (--mg-*) defined for theme-aware components');
ok(/prefers-color-scheme|data-theme|\.dark|\[data-theme/i.test(indexCss) || /--dash-/i.test(indexCss),
  'light/dark or dashboard theme variants defined');

// --- Regression note: raw unbounded 100vw widths (overflow risk) -----------
// Not a hard fail (the overflow-x guard neutralises them), but surface the count
// so a growth trend is visible in CI logs.
{
  let rawVw = 0;
  try {
    rawVw = parseInt(execSync(`grep -rIlE "width:\\s*['\\"]?100vw" src/ | wc -l`).toString().trim(), 10) || 0;
  } catch { /* grep miss is fine */ }
  console.log(`  note: ${rawVw} file(s) use a raw 100vw width (guarded by overflow-x: clip).`);
}

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: responsive ${pass} passed, ${fail} failed`);
if (fail) throw new Error(`${fail} responsive/UX invariant(s) violated`);
