import React from 'react';
import { Link } from 'react-router-dom';
import {
  type RouteNode,
  CATEGORY_ACCENT,
  CATEGORY_DIM,
} from './siteRoutes';

export interface MapNodeProps {
  node: RouteNode;
  /** When true, the node is a category root (the "header" of a column). */
  isCategoryRoot?: boolean;
}

/**
 * MapNode — a single card in the site-map tree.
 *
 * Renders as a real Router <Link> when the node has a navigable path
 * (i.e. it isn't a category label and it isn't merely "planned"), and
 * as a non-interactive <div> otherwise. The accent color is driven by
 * the node's category via a CSS custom property so the card style stays
 * in one place (dev-map.css) and the data layer stays free of color
 * concerns.
 */
const MapNode: React.FC<MapNodeProps> = ({ node, isCategoryRoot }) => {
  const accent = CATEGORY_ACCENT[node.category];
  const accentDim = CATEGORY_DIM[node.category];
  const isNavigable =
    !node.isCategory && node.status === 'live' && node.path.startsWith('/');

  const commonProps = {
    'data-status': node.status,
    'data-category-root': isCategoryRoot ? 'true' : undefined,
    className: 'dt-node',
    style: {
      ['--dt-node-accent' as never]: accent,
      ['--dt-node-accent-dim' as never]: accentDim,
      position: 'relative' as const,
    },
  };

  const body = (
    <>
      <span className="dt-node-path">
        <span className="dt-node-glyph" aria-hidden="true">
          {node.glyph}
        </span>
        {node.path}
      </span>
      <span className="dt-node-title">{node.title}</span>
      <span className="dt-node-meta">
        <span className="dt-status" data-status={node.status}>
          {node.status === 'live'
            ? '● live'
            : node.status === 'planned'
              ? '◌ planned'
              : '○ dev'}
        </span>
        {node.access && (
          <span style={{ color: 'var(--dt-fg-dim)' }}>{node.access}</span>
        )}
      </span>
      {node.description && (
        <span
          className="sr-only"
          // sr-only so the description is available to screen readers
          // and on focus (via title fallback below) without cluttering
          // the visual node.
        >
          {node.description}
        </span>
      )}
    </>
  );

  // For navigable nodes we use a real Router Link so the click stays
  // inside the SPA. For category labels and planned routes we render
  // a button/div that still focuses for keyboard users (description
  // is exposed via `title`).
  if (isNavigable) {
    return (
      <Link
        to={node.path}
        title={node.description}
        aria-label={`${node.title} — ${node.path}`}
        {...commonProps}
      >
        {body}
      </Link>
    );
  }

  return (
    <div
      role="group"
      title={node.description}
      aria-label={`${node.title} — ${node.path}`}
      tabIndex={0}
      {...commonProps}
    >
      {body}
    </div>
  );
};

export default MapNode;
