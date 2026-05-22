import React, { useEffect, useState } from 'react';
import { DEV_CATEGORIES, DEV_SECTIONS } from './manifest';

export interface DevSidebarProps {
  filteredSectionIds?: Set<string>;
  onNavigate?: () => void;
  mobile?: boolean;
}

/**
 * Left-rail navigation rendered as an ASCII file tree.
 *
 *   docs/
 *   ├── overview/
 *   │   ├── introduction.md
 *   │   └── architecture.md
 *   ├── frontend/
 *   │   └── ...
 *   └── ...
 *
 * The currently visible section is tracked via IntersectionObserver and
 * marked with a leading "▸" plus the cyan accent color.
 */
const DevSidebar: React.FC<DevSidebarProps> = ({
  filteredSectionIds,
  onNavigate,
  mobile,
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);

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
        setActiveId(best);
      },
      { rootMargin: '-120px 0px -50% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  // Build category buckets with the filter applied.
  const buckets = DEV_CATEGORIES.map((cat) => ({
    cat,
    sections: DEV_SECTIONS.filter((s) => s.category === cat.id).filter(
      (s) => !filteredSectionIds || filteredSectionIds.has(s.id)
    ),
  })).filter((b) => b.sections.length > 0);

  return (
    <nav
      aria-label="Documentation"
      className={
        'dt-sidebar text-[13px] ' +
        (mobile
          ? 'h-full overflow-y-auto p-4'
          : 'sticky top-[var(--dt-header-h,4rem)] max-h-[calc(100vh-5rem)] overflow-y-auto pr-3')
      }
      style={{ fontFamily: 'inherit' }}
    >
      {/* Root label: "docs/" */}
      <div
        className="mb-1"
        style={{ color: 'var(--dt-fg-strong)' }}
      >
        <span style={{ color: 'var(--dt-green)' }}>~/</span>docs/
      </div>

      {buckets.map((bucket, bIdx) => {
        const isLastBucket = bIdx === buckets.length - 1;
        return (
          <div key={bucket.cat.id} className="mb-1">
            {/* Category line: "├── overview/" */}
            <div className="flex items-baseline gap-1" style={{ color: 'var(--dt-fg-muted)' }}>
              <span aria-hidden="true">{isLastBucket ? '└──' : '├──'}</span>
              <span style={{ color: 'var(--dt-amber)' }}>{bucket.cat.id}/</span>
              <span
                className="ml-auto truncate text-[10px] opacity-60"
                aria-hidden="true"
                style={{ color: 'var(--dt-fg-dim)' }}
              >
                {bucket.cat.label}
              </span>
            </div>

            <ul>
              {bucket.sections.map((s, sIdx) => {
                const isLastSection = sIdx === bucket.sections.length - 1;
                const isActive = activeId === s.id;
                // Tree glyphs: parent vertical for non-last bucket; leaf branch per section.
                const trunk = isLastBucket ? '    ' : '│   ';
                const leaf = isLastSection ? '└──' : '├──';
                return (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      onClick={onNavigate}
                      aria-current={isActive ? 'location' : undefined}
                      className="dt-tree-link flex items-baseline gap-1 py-0.5 transition-colors"
                      style={{
                        color: isActive ? 'var(--dt-cyan)' : 'var(--dt-fg)',
                        background: isActive ? 'var(--dt-cyan-dim)' : 'transparent',
                        borderBottom: 'none',
                      }}
                    >
                      <span aria-hidden="true" style={{ color: 'var(--dt-fg-dim)' }}>
                        {trunk}{leaf}
                      </span>
                      <span
                        aria-hidden="true"
                        style={{
                          color: isActive ? 'var(--dt-green)' : 'transparent',
                          width: '1ch',
                        }}
                      >
                        ▸
                      </span>
                      <span className="truncate">{s.id}.md</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      {filteredSectionIds && filteredSectionIds.size === 0 && (
        <p
          className="mt-3 text-sm"
          style={{ color: 'var(--dt-fg-muted)' }}
        >
          <span style={{ color: 'var(--dt-red)' }}>!</span> no matches
        </p>
      )}
    </nav>
  );
};

export default DevSidebar;
