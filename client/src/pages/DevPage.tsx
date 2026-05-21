import React, { useCallback, useEffect, useState } from 'react';
import DevSidebar from '../components/dev/DevSidebar';
import DevTOC from '../components/dev/DevTOC';
import DevSearch from '../components/dev/DevSearch';

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
 * Single-page, hash-anchored docs styled to match Mirror's glass aesthetic.
 * Authentication is enforced by the ProtectedRoute wrapper in App.tsx, so
 * this component assumes the user is logged in. It does NOT pull from any
 * Mirror context (auth, intake, groups, etc.) — keeping it isolated means
 * a broken context elsewhere can never break the documentation page.
 */
const DevPage: React.FC = () => {
  const [matchedSectionIds, setMatchedSectionIds] = useState<Set<string> | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // On first paint with a hash in the URL, scroll into view smoothly.
  // Browsers usually do this automatically, but we want the smooth behavior
  // and the scroll-mt margin defined on sections to be respected.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.location.hash) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    const el = document.getElementById(id);
    if (el) {
      // requestAnimationFrame so layout (sticky nav, etc.) settles first.
      window.requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, []);

  // Listen for `hashchange` so sidebar/search jumps also feel native.
  // The browser's default behavior on hashchange jumps without respecting
  // scroll-mt; this re-applies smooth scroll with proper offset.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onHashChange = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleMatchedSections = useCallback(
    (ids: Set<string> | null) => setMatchedSectionIds(ids),
    []
  );

  return (
    <div className="relative min-h-screen text-white">
      {/* Dev page uses a darker, calmer overlay than the rest of the app so
          long-form reading is comfortable on the same purple→indigo body. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(120,80,200,0.18),transparent_60%),radial-gradient(ellipse_at_bottom_right,rgba(70,40,140,0.18),transparent_60%)]"
      />

      {/* Top bar — sticky. Includes title, search, and a mobile nav toggle. */}
      <header
        className="sticky top-0 z-20 border-b border-white/10 bg-[#0c0a1e]/70 backdrop-blur-xl"
        role="banner"
      >
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 sm:px-6">
          <a
            href="/"
            className="flex shrink-0 items-center gap-2 text-white/90 hover:text-white"
            aria-label="Mirror — back to dashboard"
          >
            <span
              aria-hidden="true"
              className="inline-block h-7 w-7 rounded-md bg-gradient-to-br from-fuchsia-400/80 to-indigo-400/80 shadow-[0_4px_16px_rgba(180,120,255,0.4)]"
            />
            <span
              className="text-base font-semibold tracking-tight"
              style={{ fontFamily: 'Poppins, Inter, sans-serif' }}
            >
              Mirror
            </span>
            <span className="hidden text-white/40 sm:inline">/</span>
            <span className="hidden font-mono text-sm text-white/60 sm:inline">dev</span>
          </a>

          <div className="ml-auto flex flex-1 items-center justify-end gap-2 sm:gap-4">
            <div className="hidden flex-1 sm:block sm:max-w-md">
              <DevSearch onMatchedSections={handleMatchedSections} />
            </div>
            <a
              href="/dashboard"
              className="hidden whitespace-nowrap rounded-md border border-white/12 bg-white/5 px-3 py-1.5 text-sm text-white/85 transition-colors hover:bg-white/10 md:inline-block"
            >
              ← Dashboard
            </a>
            <button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              className="rounded-md border border-white/15 bg-white/5 p-2 text-white lg:hidden"
              aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={mobileNavOpen}
            >
              <span aria-hidden="true">{mobileNavOpen ? '×' : '☰'}</span>
            </button>
          </div>
        </div>
        {/* Mobile-only second row holds the search bar. */}
        <div className="border-t border-white/8 px-4 py-2 sm:hidden">
          <DevSearch onMatchedSections={handleMatchedSections} />
        </div>
      </header>

      {/* Mobile nav drawer — slides in from the left. */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Documentation navigation"
        >
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute left-0 top-0 h-full w-[85%] max-w-[340px] border-r border-white/10 bg-[#0c0a1e]/95 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/8 p-3">
              <span className="font-semibold">Navigation</span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="rounded p-1 text-white/70 hover:bg-white/5"
                aria-label="Close navigation"
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

      <div className="mx-auto grid max-w-[1400px] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[240px_1fr] xl:grid-cols-[240px_1fr_220px]">
        {/* Desktop sidebar. */}
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
          {/* Hero — page title + intro card. */}
          <header className="mb-2">
            <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-fuchsia-300/80">
              Developer documentation
            </p>
            <h1
              className="text-4xl font-semibold tracking-tight text-white sm:text-5xl"
              style={{ fontFamily: 'Poppins, Inter, sans-serif' }}
            >
              The Mirror manual
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/75">
              A complete A-to-Z reference for the Mirror platform: the React
              client, the mirror-server application, and the dina-server
              intelligence layer. Every page, every endpoint, every event,
              every guarantee.
            </p>
          </header>

          {/* Sections, in render order. */}
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

          {/* Footer — quiet, useful. */}
          <footer className="mt-16 border-t border-white/10 pt-6 text-sm text-white/55">
            <p>
              Found something out of date? These docs live with the code at{' '}
              <code className="rounded bg-white/8 px-1 py-0.5 font-mono text-[0.9em]">
                client/src/components/dev/sections
              </code>{' '}
              — each section is a single React file, easy to edit.
            </p>
          </footer>
        </main>

        {/* On-this-page TOC (xl+ only). */}
        <DevTOC />
      </div>
    </div>
  );
};

export default DevPage;
