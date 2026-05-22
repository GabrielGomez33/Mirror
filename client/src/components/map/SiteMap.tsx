import React from 'react';
import MapNode from './MapNode';
import { SITE_ROOT, type RouteNode, flattenRoutes } from './siteRoutes';

/**
 * SiteMap — recursive tree renderer.
 *
 * Two responsibilities, kept apart from each other:
 *
 *   1. <Branch /> — one level of the tree. Renders the node card and, if
 *      it has children, a row of branches below it. The connector lines
 *      between parent and children are drawn entirely in CSS via
 *      ::before / ::after on the .dt-tree-row li elements (see
 *      dev-map.css). No JS positioning — naturally responsive.
 *
 *   2. <SiteMap /> — public entry. Renders the root branch wrapped in
 *      the .dt-tree container, plus a small summary (live/planned counts)
 *      and a legend below.
 *
 * Mobile reflow is also pure CSS (see the @media block in dev-map.css):
 * under 768px, the row becomes a vertical ASCII-style list, indented one
 * level per depth.
 */

interface BranchProps {
  node: RouteNode;
  isRoot?: boolean;
}

const Branch: React.FC<BranchProps> = ({ node, isRoot }) => {
  const hasChildren = !!node.children && node.children.length > 0;
  return (
    <div
      className={`dt-branch${hasChildren ? '' : ' dt-branch-leaf'}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <MapNode node={node} isCategoryRoot={isRoot || !!node.isCategory} />
      {hasChildren && (
        <ul className="dt-tree-row" role="list">
          {node.children!.map((child) => (
            <li key={child.path + child.title}>
              <Branch node={child} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const SiteMap: React.FC = () => {
  // Quick summary counters so the page can show "N routes mapped".
  const all = flattenRoutes(SITE_ROOT).filter((n) => !n.isCategory && n.path.startsWith('/'));
  const live = all.filter((n) => n.status === 'live').length;
  const planned = all.filter((n) => n.status === 'planned').length;
  const devOnly = all.filter((n) => n.status === 'dev-only').length;

  return (
    <section aria-label="Mirror site map" className="dt-sitemap">
      {/* Header summary — terminal command + counters. */}
      <header className="mb-3">
        <div
          className="text-[11px] uppercase tracking-widest"
          style={{ color: 'var(--dt-fg-dim)' }}
        >
          <span style={{ color: 'var(--dt-green)' }}>$</span>{' '}
          tree <span style={{ color: 'var(--dt-amber)' }}>/</span>
        </div>
        <div
          className="mt-1 flex flex-wrap items-baseline gap-3 text-xs"
          style={{ color: 'var(--dt-fg-muted)' }}
        >
          <span>
            <span style={{ color: 'var(--dt-fg-strong)' }}>{all.length}</span> routes mapped
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <span style={{ color: 'var(--dt-green)' }}>{live}</span> live
          </span>
          {planned > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                <span style={{ color: 'var(--dt-amber)' }}>{planned}</span> planned
              </span>
            </>
          )}
          {devOnly > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                <span style={{ color: 'var(--dt-fg-dim)' }}>{devOnly}</span> dev-only
              </span>
            </>
          )}
        </div>
      </header>

      {/* The tree itself. */}
      <div
        className="dt-tree"
        style={{
          background: 'var(--dt-bg)',
          border: '1px solid var(--dt-border)',
          borderRadius: '4px',
        }}
      >
        <Branch node={SITE_ROOT} isRoot />
      </div>

      {/* Legend — drawn in the same node style for cohesion. */}
      <footer className="mt-6">
        <div
          className="mb-2 text-[11px] uppercase tracking-widest"
          style={{ color: 'var(--dt-fg-dim)' }}
        >
          <span style={{ color: 'var(--dt-green)' }}>$</span>{' '}
          cat <span style={{ color: 'var(--dt-amber)' }}>LEGEND</span>
        </div>
        <div className="dt-legend">
          <span className="dt-legend-item">
            <span
              className="dt-legend-swatch"
              aria-hidden="true"
              style={{ borderLeftColor: 'var(--dt-amber)' }}
            />
            root / meta
          </span>
          <span className="dt-legend-item">
            <span
              className="dt-legend-swatch"
              aria-hidden="true"
              style={{ borderLeftColor: 'var(--dt-green)' }}
            />
            public
          </span>
          <span className="dt-legend-item">
            <span
              className="dt-legend-swatch"
              aria-hidden="true"
              style={{ borderLeftColor: 'var(--dt-cyan)' }}
            />
            auth / app
          </span>
          <span className="dt-legend-item">
            <span
              className="dt-legend-swatch"
              aria-hidden="true"
              style={{ borderLeftColor: 'var(--dt-magenta)' }}
            />
            personal
          </span>
          <span className="dt-legend-item">
            <span className="dt-status" data-status="live">● live</span>
          </span>
          <span className="dt-legend-item">
            <span className="dt-status" data-status="planned">◌ planned</span>
          </span>
          <span className="dt-legend-item">
            <span className="dt-status" data-status="dev-only">○ dev</span>
          </span>
        </div>
      </footer>
    </section>
  );
};

export default SiteMap;
