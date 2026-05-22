import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildSearchIndex, type SearchEntry } from './manifest';

export interface DevSearchProps {
  onMatchedSections?: (sectionIds: Set<string> | null) => void;
}

/**
 * Terminal-style search prompt:
 *
 *   $ grep -i <query>
 *
 * Matches all whitespace-separated terms (AND) against title + summary +
 * keyword blob. Returns a dropdown of direct jump targets and feeds the
 * sidebar so it can filter to matching sections.
 *
 * Keyboard:
 *   /       — focuses from anywhere on the page (unless already typing)
 *   Esc     — closes and clears
 *   ↑/↓     — moves highlight
 *   Enter   — jumps to highlighted result
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

  useEffect(() => {
    if (!onMatchedSections) return;
    if (query.trim().length === 0) onMatchedSections(null);
    else onMatchedSections(new Set(results.map((r) => r.sectionId)));
  }, [results, query, onMatchedSections]);

  useEffect(() => setActiveIdx(0), [results]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const jumpTo = useCallback((entry: SearchEntry) => {
    const id = entry.subsectionId || entry.sectionId;
    if (typeof window !== 'undefined') {
      window.location.hash = id;
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    <div className="dt-search relative w-full">
      <label htmlFor="dev-search" className="sr-only">
        Search documentation
      </label>
      <div
        className="flex items-center gap-2"
        style={{
          background: 'var(--dt-bg-elevated)',
          border: '1px solid var(--dt-border-hi)',
          borderRadius: '4px',
          padding: '0.35rem 0.7rem',
        }}
      >
        <span aria-hidden="true" style={{ color: 'var(--dt-green)' }}>$</span>
        <span aria-hidden="true" style={{ color: 'var(--dt-fg-muted)' }}>grep -i</span>
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
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          placeholder="search docs..."
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          style={{
            color: 'var(--dt-fg-strong)',
            fontFamily: 'inherit',
            border: 'none',
          }}
        />
        <kbd
          aria-hidden="true"
          className="dt-kbd hidden sm:inline-block"
        >
          /
        </kbd>
      </div>

      {open && query.trim().length > 0 && (
        <div
          role="listbox"
          aria-label="Search results"
          className="absolute left-0 right-0 z-30 mt-2 max-h-[60vh] overflow-y-auto"
          style={{
            background: 'var(--dt-bg-elevated)',
            border: '1px solid var(--dt-border-hi)',
            borderRadius: '4px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
          }}
        >
          {results.length === 0 ? (
            <div className="px-3 py-3 text-sm" style={{ color: 'var(--dt-fg-muted)' }}>
              <span style={{ color: 'var(--dt-red)' }}>!</span> no matches for{' '}
              <span style={{ color: 'var(--dt-fg-strong)' }}>{query}</span>
            </div>
          ) : (
            <ul>
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
                        e.preventDefault();
                        jumpTo(r);
                      }}
                      className="flex w-full items-start gap-3 px-3 py-2 text-left text-[13px] transition-colors"
                      style={{
                        background: active ? 'var(--dt-cyan-dim)' : 'transparent',
                        color: active ? 'var(--dt-fg-strong)' : 'var(--dt-fg)',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        style={{ color: 'var(--dt-fg-dim)', width: '5ch' }}
                        className="shrink-0 text-[10px] uppercase tracking-widest"
                      >
                        {r.category}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{r.label}</span>
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
