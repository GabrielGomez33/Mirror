import React, { useEffect, useState } from 'react';
import { DEV_CATEGORIES, DEV_SECTIONS } from './manifest';

export interface DevSidebarProps {
  /** Optional filtered list of section ids to render. If undefined, render all. */
  filteredSectionIds?: Set<string>;
  /** Called when a sidebar link is clicked, so the parent can close mobile drawer. */
  onNavigate?: () => void;
  /** Whether to render in mobile drawer style (no sticky positioning). */
  mobile?: boolean;
}

/**
 * Left-rail navigation. Each category is a header; sections under it are
 * scroll-target anchors. The currently-visible section is tracked via an
 * IntersectionObserver on [data-dev-section] elements.
 */
const DevSidebar: React.FC<DevSidebarProps> = ({
  filteredSectionIds,
  onNavigate,
  mobile,
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);

  // IntersectionObserver — sets activeId to the section closest to the top
  // of the viewport. Safe-guards against SSR by checking window.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
      return;
    }
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
          if (entry.isIntersecting) {
            visible.set(id, entry.intersectionRatio);
          } else {
            visible.delete(id);
          }
        }
        if (visible.size === 0) return;
        // Pick the section with the highest ratio (closest to fully-visible).
        let best: string | null = null;
        let bestRatio = -1;
        for (const [id, ratio] of visible) {
          if (ratio > bestRatio) {
            best = id;
            bestRatio = ratio;
          }
        }
        setActiveId(best);
      },
      {
        // Top sentinel ~120px below the page top so the active item updates
        // before the section fully fills the viewport.
        rootMargin: '-120px 0px -50% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return (
    <nav
      aria-label="Documentation"
      className={
        mobile
          ? 'h-full overflow-y-auto p-4'
          : 'sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-4'
      }
    >
      {DEV_CATEGORIES.map((cat) => {
        const sectionsInCat = DEV_SECTIONS.filter((s) => s.category === cat.id).filter(
          (s) => !filteredSectionIds || filteredSectionIds.has(s.id)
        );
        if (sectionsInCat.length === 0) return null;
        return (
          <div key={cat.id} className="mb-5">
            <div className="mb-1.5 px-2 font-mono text-[10px] uppercase tracking-widest text-white/40">
              {cat.label}
            </div>
            <ul className="space-y-0.5">
              {sectionsInCat.map((s) => {
                const isActive = activeId === s.id;
                return (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      onClick={onNavigate}
                      className={
                        'block rounded-md px-2 py-1.5 text-sm transition-colors ' +
                        (isActive
                          ? 'bg-fuchsia-500/15 text-white ring-1 ring-fuchsia-300/30'
                          : 'text-white/70 hover:bg-white/5 hover:text-white')
                      }
                      aria-current={isActive ? 'location' : undefined}
                    >
                      {s.title}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      {filteredSectionIds && filteredSectionIds.size === 0 && (
        <p className="px-2 text-sm text-white/50">No sections match your search.</p>
      )}
    </nav>
  );
};

export default DevSidebar;
