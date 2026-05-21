import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildSearchIndex, type SearchEntry } from './manifest';

export interface DevSearchProps {
  /** Notifies parent which section ids match the current query, for sidebar filtering. */
  onMatchedSections?: (sectionIds: Set<string> | null) => void;
}

/**
 * Lightweight client-side search across the manifest. Matches against the
 * section/subsection title plus a short keyword blob. Returns a dropdown of
 * direct jump targets, and (via onMatchedSections) feeds the sidebar so it
 * can filter to matching sections only.
 *
 * Keyboard:
 *   /        — focuses the input from anywhere on the page
 *   Escape   — closes the dropdown and clears the query
 *   ↑/↓      — moves the highlight
 *   Enter    — jumps to the highlighted result
 */
const DevSearch: React.FC<DevSearchProps> = ({ onMatchedSections }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const index = useMemo(() => buildSearchIndex(), []);

  const results = useMemo<SearchEntry[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return [];
    // Split into terms and require all of them to appear in the blob (AND).
    // Short circuit at 12 results for keyboard usability.
    const terms = q.split(/\s+/).filter(Boolean);
    const out: SearchEntry[] = [];
    for (const entry of index) {
      let ok = true;
      for (const t of terms) {
        if (!entry.blob.includes(t)) {
          ok = false;
          break;
        }
      }
      if (ok) out.push(entry);
      if (out.length >= 60) break;
    }
    return out;
  }, [query, index]);

  // Push matched section ids upstream for sidebar filtering.
  useEffect(() => {
    if (!onMatchedSections) return;
    if (query.trim().length === 0) {
      onMatchedSections(null);
    } else {
      onMatchedSections(new Set(results.map((r) => r.sectionId)));
    }
  }, [results, query, onMatchedSections]);

  // Reset active index whenever results change.
  useEffect(() => {
    setActiveIdx(0);
  }, [results]);

  // Global "/" shortcut to focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/') return;
      // Don't hijack if the user is already typing somewhere.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
        return;
      }
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const jumpTo = useCallback((entry: SearchEntry) => {
    const id = entry.subsectionId || entry.sectionId;
    // Update hash; the section/subsection has scroll-mt that respects the sticky nav.
    if (typeof window !== 'undefined') {
      window.location.hash = id;
      // hashchange doesn't trigger smooth scroll cross-browser, so do it manually.
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
    setOpen(false);
    setQuery('');
  }, []);

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Escape') {
      setQuery('');
      setOpen(false);
      e.currentTarget.blur();
      return;
    }
    if (results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = results[activeIdx];
      if (r) jumpTo(r);
    }
  };

  return (
    <div className="relative">
      <label htmlFor="dev-search" className="sr-only">
        Search documentation
      </label>
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
        >
          {/* magnifying glass glyph, no external icon dep */}
          ⌕
        </span>
        <input
          ref={inputRef}
          id="dev-search"
          type="search"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Delay so click on result registers before close.
            window.setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search docs — press / to focus"
          className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-16 text-sm text-white placeholder:text-white/40 backdrop-blur-md focus:border-fuchsia-300/40 focus:outline-none focus:ring-2 focus:ring-fuchsia-300/30"
        />
        <kbd
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/55 sm:inline-block"
        >
          /
        </kbd>
      </div>

      {open && query.trim().length > 0 && (
        <div
          role="listbox"
          aria-label="Search results"
          className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[60vh] overflow-y-auto rounded-xl border border-white/10 bg-[#0c0a1e]/95 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop-blur-xl"
        >
          {results.length === 0 ? (
            <div className="px-3 py-4 text-sm text-white/50">
              No matches for <span className="font-mono text-white/80">{query}</span>.
            </div>
          ) : (
            <ul className="space-y-0.5">
              {results.map((r, idx) => {
                const active = idx === activeIdx;
                return (
                  <li key={`${r.sectionId}-${r.subsectionId || 'root'}-${idx}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onMouseDown={(e) => {
                        // mousedown beats input blur, so we can jump cleanly.
                        e.preventDefault();
                        jumpTo(r);
                      }}
                      className={
                        'flex w-full items-start gap-3 rounded-md px-3 py-2 text-left text-sm ' +
                        (active ? 'bg-fuchsia-500/15 text-white' : 'text-white/85 hover:bg-white/5')
                      }
                    >
                      <span className="font-mono text-[10px] uppercase tracking-widest text-white/45">
                        {r.category}
                      </span>
                      <span className="min-w-0 flex-1">
                        <div className="truncate">{r.label}</div>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default DevSearch;
