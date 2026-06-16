import React, { useCallback, useEffect, useMemo, useState } from 'react';
// Side-effect import: pulls the terminal theme into the bundle only when the
// /dev route is reached. Avoids the PostCSS @import-after-@tailwind problem
// that silently drops stylesheets when chained from index.css.
import '../styles/dev-terminal.css';
import DevSidebar from '../components/dev/DevSidebar';
import DevTOC from '../components/dev/DevTOC';
import DevSearch from '../components/dev/DevSearch';
import { DEV_SECTIONS } from '../components/dev/manifest';

import Introduction from '../components/dev/sections/Introduction';
import Architecture from '../components/dev/sections/Architecture';
import Frontend from '../components/dev/sections/Frontend';
import Intake from '../components/dev/sections/Intake';
import MirrorServer from '../components/dev/sections/MirrorServer';
import DinaServer from '../components/dev/sections/DinaServer';
import Integration from '../components/dev/sections/Integration';
import DumpProtocol from '../components/dev/sections/DumpProtocol';
import Websocket from '../components/dev/sections/Websocket';
import ApiReference from '../components/dev/sections/ApiReference';
import Security from '../components/dev/sections/Security';
import Paywall from '../components/dev/sections/Paywall';
import Deployment from '../components/dev/sections/Deployment';
import Glossary from '../components/dev/sections/Glossary';

/**
 * /dev — Mirror developer documentation.
 *
 * Layout:
 *
 *   ┌───────────────────────────────────────────────────────┐
 *   │  header: prompt + search + nav                        │ <- sticky
 *   ├──────────┬────────────────────────────┬───────────────┤
 *   │ sidebar  │     content                │  on-this-page │
 *   │ (tree)   │     (sections)             │  (line nums)  │
 *   │          │                            │               │
 *   ├──────────┴────────────────────────────┴───────────────┤
 *   │  vim-style status bar                                 │ <- sticky
 *   └───────────────────────────────────────────────────────┘
 *
 * The page is fully scoped under `.dev-terminal`, which provides the
 * dark background, mono font, and accent CSS variables. Because this
 * wrapper has its own min-h-screen and solid background, the App-level
 * purple gradient does not bleed through.
 */
const DevPage: React.FC = () => {
  const [matchedSectionIds, setMatchedSectionIds] = useState<Set<string> | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [currentSectionId, setCurrentSectionId] = useState<string | null>(null);
  const [scrollPct, setScrollPct] = useState(0);

  // First-paint deep link: respect URL hash with smooth scroll.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.location.hash) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    const el = document.getElementById(id);
    if (el) {
      window.requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, []);

  // Hash changes (sidebar / search jumps) — smooth scroll with sticky offset.
  useEffect(() => {
    const onHashChange = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Track scroll progress for the status bar.
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop;
      const max = (doc.scrollHeight - doc.clientHeight) || 1;
      setScrollPct(Math.round((scrollTop / max) * 100));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Track current section for the status bar.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>('[data-dev-section]')
    );
    if (sections.length === 0) return;
    const visible = new Map<string, number>();
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = e.target.getAttribute('data-dev-section');
          if (!id) continue;
          if (e.isIntersecting) visible.set(id, e.intersectionRatio);
          else visible.delete(id);
        }
        if (visible.size === 0) return;
        let best: string | null = null;
        let bestRatio = -1;
        for (const [id, r] of visible) {
          if (r > bestRatio) {
            best = id;
            bestRatio = r;
          }
        }
        setCurrentSectionId(best);
      },
      { rootMargin: '-120px 0px -50% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, []);

  const handleMatchedSections = useCallback(
    (ids: Set<string> | null) => setMatchedSectionIds(ids),
    []
  );

  const currentSection = useMemo(
    () =>
      DEV_SECTIONS.find((s) => s.id === currentSectionId) || DEV_SECTIONS[0],
    [currentSectionId]
  );

  return (
    <div
      className="dev-terminal min-h-screen"
      style={{
        // CSS var consumed by the sticky offsets in sidebar/TOC.
        // The header height is fixed: 1 row top bar + (mobile) 1 row search.
        // We override per-breakpoint in the markup below by inline style.
        ['--dt-header-h' as never]: '6.5rem',
      }}
    >
      {/* ─── Sticky terminal header ──────────────────────────────────── */}
      <header
        role="banner"
        className="dt-header sticky top-0 z-20"
        style={{
          background: 'var(--dt-bg-elevated)',
          borderBottom: '1px solid var(--dt-border)',
        }}
      >
        {/* Row 1: prompt / nav. Always visible. */}
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-3 py-2 sm:px-5">
          {/* Mobile nav toggle. */}
          <button
            type="button"
            onClick={() => setMobileNavOpen((v) => !v)}
            className="shrink-0 lg:hidden"
            aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileNavOpen}
            style={{
              color: 'var(--dt-fg)',
              border: '1px solid var(--dt-border-hi)',
              borderRadius: '3px',
              padding: '0.25rem 0.5rem',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            <span aria-hidden="true" className="font-mono">
              {mobileNavOpen ? '×' : '≡'}
            </span>
          </button>

          {/* Prompt + logo. */}
          <a
            href="/dashboard"
            className="flex shrink-0 items-baseline gap-1.5 text-[13px] sm:text-sm"
            aria-label="Mirror — back to dashboard"
            style={{ borderBottom: 'none' }}
          >
            <span style={{ color: 'var(--dt-magenta)' }}>mirror</span>
            <span style={{ color: 'var(--dt-fg-dim)' }}>@</span>
            <span style={{ color: 'var(--dt-cyan)' }}>dev</span>
            <span style={{ color: 'var(--dt-fg-dim)' }}>:</span>
            <span style={{ color: 'var(--dt-amber)' }}>~/docs</span>
            <span style={{ color: 'var(--dt-green)' }}>$</span>
          </a>

          {/* Search expands to fill remaining space. */}
          <div className="ml-1 flex-1 sm:ml-3">
            <DevSearch onMatchedSections={handleMatchedSections} />
          </div>

          {/* Cross-page links. */}
          <a
            href="/map"
            className="hidden whitespace-nowrap text-[12px] sm:inline-block"
            style={{
              color: 'var(--dt-fg-muted)',
              border: '1px solid var(--dt-border-hi)',
              padding: '0.25rem 0.6rem',
              borderRadius: '3px',
              borderBottom: '1px solid var(--dt-border-hi)',
            }}
          >
            /map
          </a>
          <a
            href="/dashboard"
            className="hidden whitespace-nowrap text-[12px] md:inline-block"
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
        </div>
      </header>

      {/* ─── Mobile drawer ─────────────────────────────────────────── */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Documentation navigation"
        >
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.7)' }}
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <div
            className="absolute left-0 top-0 h-full w-[86%] max-w-[360px] overflow-y-auto"
            style={{
              background: 'var(--dt-bg)',
              borderRight: '1px solid var(--dt-border-hi)',
            }}
          >
            <div
              className="flex items-center justify-between px-3 py-3"
              style={{
                borderBottom: '1px solid var(--dt-border)',
              }}
            >
              <span style={{ color: 'var(--dt-fg-strong)' }}>navigation</span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation"
                style={{
                  color: 'var(--dt-fg)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                }}
              >
                ×
              </button>
            </div>
            <DevSidebar
              mobile
              filteredSectionIds={matchedSectionIds || undefined}
              onNavigate={() => setMobileNavOpen(false)}
            />
          </div>
        </div>
      )}

      {/* ─── Main layout grid ──────────────────────────────────────── */}
      <div className="mx-auto max-w-[1440px] px-3 sm:px-5">
        <div className="grid gap-6 py-6 lg:grid-cols-[240px_1fr] xl:grid-cols-[240px_1fr_240px] xl:gap-8">
          {/* Sidebar (desktop). */}
          <div className="hidden lg:block">
            <DevSidebar filteredSectionIds={matchedSectionIds || undefined} />
          </div>

          {/* Main content. */}
          <main
            id="dev-content"
            role="main"
            aria-label="Documentation"
            className="min-w-0"
          >
            {/* Hero — terminal banner. */}
            <header className="mb-8">
              <pre
                aria-hidden="true"
                className="mb-4 overflow-x-auto text-[10px] leading-tight sm:text-xs"
                style={{ color: 'var(--dt-magenta)' }}
              >{`
 __  __ _                       _                                  _
|  \\/  (_)_ __ _ __ ___  _ __  | |_ ___ _ __ _ __ ___ (_)_ __  __ _| |
| |\\/| | | '__| '__/ _ \\| '__| | __/ _ \\ '__| '_ \` _ \\| | '_ \\/ _\` | |
| |  | | | |  | | | (_) | |    | ||  __/ |  | | | | | | | | | (_| | |
|_|  |_|_|_|  |_|  \\___/|_|     \\__\\___|_|  |_| |_| |_|_|_| |_\\__,_|_|
                  developer documentation · v1`}</pre>

              <div
                className="text-[11px] uppercase tracking-widest"
                style={{ color: 'var(--dt-fg-dim)' }}
              >
                $ man <span style={{ color: 'var(--dt-amber)' }}>mirror</span>
              </div>
              <h1
                className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl"
                style={{ color: 'var(--dt-fg-strong)' }}
              >
                The Mirror manual
                <span className="dt-cursor" aria-hidden="true" />
              </h1>
              <p
                className="mt-3 max-w-2xl text-sm leading-relaxed"
                style={{ color: 'var(--dt-fg-muted)' }}
              >
                A complete, A-to-Z reference for the Mirror platform: the
                React client, the <span style={{ color: 'var(--dt-cyan)' }}>mirror-server</span>{' '}
                application, and the{' '}
                <span style={{ color: 'var(--dt-cyan)' }}>dina-server</span>{' '}
                intelligence layer. Every page, every endpoint, every event,
                every guarantee, every edge case. Press{' '}
                <kbd className="dt-kbd">/</kbd> to search.
              </p>
            </header>

            <Introduction />
            <Architecture />

            <Frontend />
            <Intake />

            <MirrorServer />
            <DinaServer />

            <Integration />
            <DumpProtocol />
            <Websocket />
            <ApiReference />

            <Security />

            <Deployment />
            <Paywall />
            <Glossary />

            {/* Footer — quiet. */}
            <footer
              className="mt-16 pt-6 text-sm"
              style={{
                color: 'var(--dt-fg-muted)',
                borderTop: '1px solid var(--dt-border)',
              }}
            >
              
            </footer>
          </main>

          {/* TOC (xl+). */}
          <DevTOC />
        </div>
      </div>

      {/* ─── Sticky bottom status bar (vim/tmux feel) ──────────────── */}
      <div
        className="dt-statusbar sticky bottom-0 z-10 flex items-center gap-3 px-3 py-1 text-[11px]"
      >
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
        <span style={{ color: 'var(--dt-fg)' }}>
          {currentSection ? `${currentSection.id}.md` : 'docs.md'}
        </span>
        <span style={{ color: 'var(--dt-fg-dim)' }}>·</span>
        <span style={{ color: 'var(--dt-fg-muted)' }}>
          {currentSection ? currentSection.title : ''}
        </span>
        <span className="ml-auto flex items-center gap-3">
          <span className="hidden sm:inline" style={{ color: 'var(--dt-fg-dim)' }}>
            <kbd className="dt-kbd">/</kbd> search
          </span>
          <span style={{ color: 'var(--dt-fg-muted)' }}>{scrollPct}%</span>
        </span>
      </div>
    </div>
  );
};

export default DevPage;
