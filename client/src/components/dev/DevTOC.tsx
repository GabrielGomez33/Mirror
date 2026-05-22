import React, { useEffect, useState } from 'react';
import { DEV_SECTIONS } from './manifest';

/**
 * On-this-page table of contents, terminal style.
 *
 * Renders the subsections of the section currently in view, line-numbered:
 *
 *   ┌─ on:section.md ─┐
 *   │ 01  subsection  │
 *   │ 02  subsection  │
 *   └─────────────────┘
 *
 * Hidden below xl (kept on phones to avoid stealing horizontal space).
 */
const DevTOC: React.FC = () => {
  const [currentSectionId, setCurrentSectionId] = useState<string | null>(null);
  const [activeSubsectionId, setActiveSubsectionId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>('[data-dev-section]')
    );
    if (sections.length === 0) return;
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute('data-dev-section');
          if (!id) continue;
          if (entry.isIntersecting) visible.set(id, entry.intersectionRatio);
          else visible.delete(id);
        }
        if (visible.size === 0) return;
        let best: string | null = null;
        let bestRatio = -1;
        for (const [id, ratio] of visible) {
          if (ratio > bestRatio) {
            best = id;
            bestRatio = ratio;
          }
        }
        setCurrentSectionId(best);
      },
      { rootMargin: '-120px 0px -50% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;
    const subs = Array.from(
      document.querySelectorAll<HTMLElement>('[data-dev-subsection]')
    );
    if (subs.length === 0) return;
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute('data-dev-subsection');
          if (!id) continue;
          if (entry.isIntersecting) visible.set(id, entry.intersectionRatio);
          else visible.delete(id);
        }
        if (visible.size === 0) return;
        let best: string | null = null;
        let bestRatio = -1;
        for (const [id, ratio] of visible) {
          if (ratio > bestRatio) {
            best = id;
            bestRatio = ratio;
          }
        }
        setActiveSubsectionId(best);
      },
      { rootMargin: '-140px 0px -60% 0px', threshold: [0, 0.5, 1] }
    );
    subs.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  const currentSection =
    DEV_SECTIONS.find((s) => s.id === currentSectionId) || DEV_SECTIONS[0];
  if (!currentSection) return null;

  const width = String(currentSection.subsections.length).length;

  return (
    <aside
      aria-label="On this page"
      className="dt-toc sticky top-[var(--dt-header-h,4rem)] hidden max-h-[calc(100vh-5rem)] overflow-y-auto xl:block"
      style={{ fontFamily: 'inherit', fontSize: '12px' }}
    >
      <div
        className="mb-2 text-[10.5px] uppercase tracking-widest"
        style={{ color: 'var(--dt-fg-dim)' }}
      >
        <span style={{ color: 'var(--dt-green)' }}>$</span>{' '}
        cat <span style={{ color: 'var(--dt-amber)' }}>{currentSection.id}.md</span>
      </div>
      <ul>
        {currentSection.subsections.map((sub, idx) => {
          const isActive = activeSubsectionId === sub.id;
          const n = String(idx + 1).padStart(width, '0');
          return (
            <li key={sub.id}>
              <a
                href={`#${sub.id}`}
                aria-current={isActive ? 'location' : undefined}
                className="flex items-baseline gap-2 py-1 transition-colors"
                style={{
                  color: isActive ? 'var(--dt-cyan)' : 'var(--dt-fg-muted)',
                  borderBottom: 'none',
                }}
              >
                <span aria-hidden="true" style={{ color: 'var(--dt-fg-dim)' }}>
                  {n}
                </span>
                <span aria-hidden="true" style={{ color: isActive ? 'var(--dt-green)' : 'transparent' }}>
                  ▸
                </span>
                <span className="truncate">{sub.title}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </aside>
  );
};

export default DevTOC;
