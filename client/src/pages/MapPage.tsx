import React, { useEffect, useState } from 'react';
// Side-effect imports: pull the terminal theme + map-specific tree styles
// into the bundle only when /map is reached.
import '../styles/dev-terminal.css';
import '../styles/dev-map.css';

import SiteMap from '../components/map/SiteMap';

/**
 * /map — Mirror site tree.
 *
 * Same terminal aesthetic as /dev (mirror@map:~/sitemap$ prompt, sticky
 * header + vim-style status bar). The page itself is intentionally
 * lightweight — all the structure lives in components/map/. Auth is
 * enforced by ProtectedRoute in App.tsx; this component does not pull
 * from Mirror contexts.
 */
const MapPage: React.FC = () => {
  const [scrollPct, setScrollPct] = useState(0);

  // Scroll progress for the status bar.
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop;
      const max = doc.scrollHeight - doc.clientHeight || 1;
      setScrollPct(Math.round((scrollTop / max) * 100));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="dev-terminal min-h-screen">
      {/* ─── Sticky terminal header ─────────────────────────────────── */}
      <header
        role="banner"
        className="sticky top-0 z-20"
        style={{
          background: 'var(--dt-bg-elevated)',
          borderBottom: '1px solid var(--dt-border)',
        }}
      >
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-3 py-2 sm:px-5">
          <a
            href="/dashboard"
            className="flex shrink-0 items-baseline gap-1.5 text-[13px] sm:text-sm"
            aria-label="Mirror — back to dashboard"
            style={{ borderBottom: 'none' }}
          >
            <span style={{ color: 'var(--dt-magenta)' }}>mirror</span>
            <span style={{ color: 'var(--dt-fg-dim)' }}>@</span>
            <span style={{ color: 'var(--dt-cyan)' }}>map</span>
            <span style={{ color: 'var(--dt-fg-dim)' }}>:</span>
            <span style={{ color: 'var(--dt-amber)' }}>~/sitemap</span>
            <span style={{ color: 'var(--dt-green)' }}>$</span>
          </a>

          {/* Cross-page links. */}
          <nav
            aria-label="Section links"
            className="ml-auto flex items-center gap-1 text-[12px]"
          >
            <a
              href="/dev"
              className="whitespace-nowrap"
              style={{
                color: 'var(--dt-fg-muted)',
                border: '1px solid var(--dt-border-hi)',
                padding: '0.25rem 0.6rem',
                borderRadius: '3px',
                borderBottom: '1px solid var(--dt-border-hi)',
              }}
            >
              /dev
            </a>
            <a
              href="/dashboard"
              className="hidden whitespace-nowrap md:inline-block"
              style={{
                color: 'var(--dt-fg-muted)',
                border: '1px solid var(--dt-border-hi)',
                padding: '0.25rem 0.6rem',
                borderRadius: '3px',
                borderBottom: '1px solid var(--dt-border-hi)',
              }}
            >
              ← dashboard
            </a>
          </nav>
        </div>
      </header>

      {/* ─── Main content ───────────────────────────────────────────── */}
      <main
        role="main"
        aria-label="Site map"
        className="mx-auto max-w-[1440px] px-3 py-6 sm:px-5"
      >
        {/* Hero — terminal banner. */}
        <header className="mb-8">
          <pre
            aria-hidden="true"
            className="mb-4 overflow-x-auto text-[10px] leading-tight sm:text-xs"
            style={{ color: 'var(--dt-magenta)' }}
          >{`
 ____  _ _                                  _
/ ___|(_) |_ ___   _ __ ___   __ _ _ __    / |
\\___ \\| | __/ _ \\ | '_ \` _ \\ / _\` | '_ \\   | |
 ___) | | ||  __/ | | | | | | (_| | |_) |  |_|
|____/|_|\\__\\___| |_| |_| |_|\\__,_| .__/   (_)
                                  |_|
                                a tree of every route in Mirror`}</pre>

          <div
            className="text-[11px] uppercase tracking-widest"
            style={{ color: 'var(--dt-fg-dim)' }}
          >
            $ man <span style={{ color: 'var(--dt-amber)' }}>mirror-sitemap</span>
          </div>
          <h1
            className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl"
            style={{ color: 'var(--dt-fg-strong)' }}
          >
            Site map
            <span className="dt-cursor" aria-hidden="true" />
          </h1>
          <p
            className="mt-3 max-w-2xl text-sm leading-relaxed"
            style={{ color: 'var(--dt-fg-muted)' }}
          >
            A descending tree of every Mirror route. Cards are real links
            wherever the route is live — click to navigate. Categories
            ({' '}
            <span style={{ color: 'var(--dt-green)' }}>public</span>,{' '}
            <span style={{ color: 'var(--dt-cyan)' }}>auth/app</span>,{' '}
            <span style={{ color: 'var(--dt-magenta)' }}>personal</span>,{' '}
            <span style={{ color: 'var(--dt-amber)' }}>meta</span>
            {' '}) drive the accent color on each card. Planned routes are
            shown with a dashed border so the future shape of the app is
            visible at a glance.
          </p>
        </header>

        {/* The tree. */}
        <SiteMap />

        {/* Footer note. */}
        <footer
          className="mt-12 pt-6 text-sm"
          style={{
            color: 'var(--dt-fg-muted)',
            borderTop: '1px solid var(--dt-border)',
          }}
        >
          
        </footer>
      </main>

      {/* ─── Sticky status bar ──────────────────────────────────────── */}
      <div className="dt-statusbar sticky bottom-0 z-10 flex items-center gap-3 px-3 py-1 text-[11px]">
        <span
          aria-hidden="true"
          style={{
            background: 'var(--dt-green)',
            color: 'var(--dt-bg)',
            padding: '0 0.4rem',
            borderRadius: '2px',
            fontWeight: 600,
          }}
        >
          NORMAL
        </span>
        <span style={{ color: 'var(--dt-fg)' }}>sitemap.tree</span>
        <span style={{ color: 'var(--dt-fg-dim)' }}>·</span>
        <span style={{ color: 'var(--dt-fg-muted)' }}>Mirror routes</span>
        <span className="ml-auto" style={{ color: 'var(--dt-fg-muted)' }}>
          {scrollPct}%
        </span>
      </div>
    </div>
  );
};

export default MapPage;
