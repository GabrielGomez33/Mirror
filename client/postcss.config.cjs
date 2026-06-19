// postcss.config.cjs
//
// PostCSS pipeline. Order is load-bearing:
//
//   1. @tailwindcss/postcss        — generates the Tailwind v4 stylesheet.
//                                     v4 emits MODERN CSS: color-mix() for every
//                                     opacity modifier (bg-white/10, text-white/70,
//                                     placeholder-white/50, border-white/20, …) and
//                                     oklch() for the default palette.
//
//   2. @csstools/postcss-oklab-function  — adds an rgb()/display-p3 fallback in
//                                     front of every oklch()/oklab() value.
//
//   3. @csstools/postcss-color-mix-function — adds an rgba() fallback in front of
//                                     every color-mix() value (computed at build
//                                     time, since Tailwind inlines the literal
//                                     color — e.g. color-mix(in srgb, #fff 10%,
//                                     transparent) → rgba(255,255,255,.1)).
//
//   4. autoprefixer                — vendor prefixes (-webkit-backdrop-filter, …).
//
// WHY (the bug this fixes):
//   color-mix() shipped in Safari only at 16.2 (iOS 16.2, Dec 2022). On an iPhone
//   still on iOS 15.4–16.1, EVERY color-mix() declaration is invalid and silently
//   dropped by the parser. The result: translucent glass backgrounds on native
//   form controls (<input>, <button>, <select>) vanish, the controls fall back to
//   their UA-default OPAQUE WHITE (the app forces color-scheme: light), and the
//   white `text-white` text on top becomes invisible — "all-white fields, no
//   visible lettering" on login, intake, MirrorGroups and Journal. oklch() still
//   works at 15.4+, which is why pink/gradients render but opacity tints don't.
//
//   `preserve: true` keeps the original modern declarations AFTER the fallback, so
//   capable browsers are byte-for-byte unchanged (last valid declaration wins);
//   only browsers that can't parse the modern function fall back to the rgba/rgb
//   line. This is pure progressive enhancement — no behavioral change anywhere a
//   build previously rendered correctly.
//
// Both csstools plugins are the same battle-tested implementations bundled inside
// postcss-preset-env; we run just the two we need rather than the whole preset to
// keep the blast radius minimal.

module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
    '@csstools/postcss-oklab-function': { preserve: true },
    '@csstools/postcss-color-mix-function': { preserve: true },
    autoprefixer: {},
  },
};