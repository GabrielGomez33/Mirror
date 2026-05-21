import React, { useEffect, useState } from 'react';
import { DEV_SECTIONS } from './manifest';

/**
 * On-this-page table of contents. Shows the subsections of the section
 * currently in view. Hidden on screens narrower than `xl`.
 */
const DevTOC: React.FC = () => {
  const [currentSectionId, setCurrentSectionId] = useState<string | null>(null);
  const [activeSubsectionId, setActiveSubsectionId] = useState<string | null>(null);

  // Track which section is most-visible (sets the subsection list).
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

  // Track active subsection within current section.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
      return;
    }
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

  return (
    <aside
      aria-label="On this page"
      className="sticky top-24 hidden max-h-[calc(100vh-7rem)] overflow-y-auto xl:block"
    >
      <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-white/40">
        On this page
      </div>
      <div className="mb-3 text-sm font-semibold text-white/90">
        {currentSection.title}
      </div>
      <ul className="space-y-0.5 border-l border-white/10 pl-3">
        {currentSection.subsections.map((sub) => {
          const isActive = activeSubsectionId === sub.id;
          return (
            <li key={sub.id}>
              <a
                href={`#${sub.id}`}
                className={
                  '-ml-3 block border-l-2 pl-3 py-1 text-xs transition-colors ' +
                  (isActive
                    ? 'border-fuchsia-300/80 text-white'
                    : 'border-transparent text-white/55 hover:border-white/30 hover:text-white/85')
                }
                aria-current={isActive ? 'location' : undefined}
              >
                {sub.title}
              </a>
            </li>
          );
        })}
      </ul>
    </aside>
  );
};

export default DevTOC;
