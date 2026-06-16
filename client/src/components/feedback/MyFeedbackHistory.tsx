// ============================================================================
// MY FEEDBACK HISTORY
// ============================================================================
// File: client/src/components/feedback/MyFeedbackHistory.tsx
// ----------------------------------------------------------------------------
// Compact list of the current user's previous submissions. Read-only —
// status changes happen operator-side in the admin tool. Renders inline on
// the feedback page below the form.
// ============================================================================

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { listMyFeedback } from '../../services/feedbackApi';
import type { MyFeedbackItem, FeedbackStatus, FeedbackKind } from '../../services/feedbackApi';
import { kindMeta } from './FeedbackKindSelector';

const PAGE_SIZE = 10;

const STATUS_LABEL: Record<FeedbackStatus, { label: string; color: string }> = {
  new:         { label: 'New',          color: '#60a5fa' },
  triaged:     { label: 'Triaged',      color: '#a78bfa' },
  in_progress: { label: 'In progress',  color: '#fb923c' },
  resolved:    { label: 'Resolved',     color: '#4ade80' },
  wontfix:     { label: 'Closed',       color: '#94a3b8' },
};

const MyFeedbackHistory: React.FC<{ refreshKey?: number }> = ({ refreshKey = 0 }) => {
  const [items,   setItems]   = useState<MyFeedbackItem[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [offset,  setOffset]  = useState(0);
  const [filter,  setFilter]  = useState<FeedbackKind | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    listMyFeedback({
      kind: filter || undefined,
      limit: PAGE_SIZE,
      offset,
    })
      .then((page) => {
        if (!alive) return;
        setItems(page.items);
        setTotal(page.total);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : 'Could not load your submissions.');
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [filter, offset, refreshKey]);

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <p style={eyebrow}>Your submissions</p>
          <h3 style={heading}>What you've shared</h3>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {([null, 'rating', 'issue', 'recommendation', 'contact'] as const).map((k) => {
            const active = filter === k;
            const meta = k ? kindMeta(k) : null;
            return (
              <button
                key={String(k)}
                type="button"
                onClick={() => { setFilter(k); setOffset(0); }}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  fontSize: 11.5,
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  cursor: 'pointer',
                  border: `1px solid ${active && meta ? meta.color : 'rgba(255,255,255,0.12)'}`,
                  background: active && meta ? `${meta.color}22` : 'rgba(255,255,255,0.04)',
                  color: active && meta ? meta.color : 'var(--dash-subtle, #5a2d3e)',
                  transition: 'all 200ms ease',
                  WebkitTapHighlightColor: 'transparent',
                  fontFamily: "'Inter', sans-serif",
                }}
                aria-pressed={active}
              >
                {k ? meta!.label : 'All'}
              </button>
            );
          })}
        </div>
      </div>

      {loading && items.length === 0 ? (
        <SkeletonList />
      ) : error ? (
        <p style={{ color: '#b91c1c', fontSize: 13 }}>{error}</p>
      ) : items.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((it) => <Row key={it.id} item={it} />)}
        </ul>
      )}

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            style={pagerBtn(offset === 0)}
          >
            ← Newer
          </button>
          <span style={{ fontSize: 11.5, color: 'var(--dash-subtle, #5a2d3e)', opacity: 0.75 }}>
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
          </span>
          <button
            type="button"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            style={pagerBtn(offset + PAGE_SIZE >= total)}
          >
            Older →
          </button>
        </div>
      )}
    </div>
  );
};

const Row: React.FC<{ item: MyFeedbackItem }> = ({ item }) => {
  const meta   = kindMeta(item.kind);
  const status = STATUS_LABEL[item.status] || STATUS_LABEL.new;
  return (
    <motion.li
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      style={{
        padding: 14,
        borderRadius: 16,
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${meta.color}22`,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          flexShrink: 0,
          background: `radial-gradient(circle at 30% 30%, ${meta.color}cc, ${meta.color}55 60%, transparent 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 14,
          fontWeight: 700,
          textShadow: '0 1px 2px rgba(0,0,0,0.3)',
          boxShadow: `0 4px 14px ${meta.color}33`,
        }}
      >
        {meta.icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--dash-heading, #3d1428)', fontFamily: "'Inter', sans-serif" }}>
            {item.subject || meta.label}
          </span>
          {item.kind === 'rating' && item.rating != null && (
            <span style={{ fontSize: 12, color: meta.color, fontWeight: 600 }}>
              {'★'.repeat(item.rating)}{'☆'.repeat(Math.max(0, 5 - item.rating))}
            </span>
          )}
          <span
            style={{
              marginLeft: 'auto',
              padding: '2px 10px',
              borderRadius: 999,
              fontSize: 10.5,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontWeight: 600,
              background: `${status.color}22`,
              color: status.color,
            }}
          >
            {status.label}
          </span>
        </div>

        {item.message && (
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 12.5,
              color: 'var(--dash-body, #5a2d3e)',
              lineHeight: 1.55,
              opacity: 0.88,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {item.message}
          </p>
        )}

        <p style={{ margin: '6px 0 0', fontSize: 10.5, color: 'var(--dash-muted, #7e4151)', opacity: 0.75 }}>
          #{item.id} · {formatDate(item.createdAt)}
        </p>
      </div>
    </motion.li>
  );
};

const SkeletonList: React.FC = () => (
  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
    {Array.from({ length: 3 }).map((_, i) => (
      <li
        key={i}
        style={{
          height: 64,
          borderRadius: 16,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          animation: 'pulse 1.4s ease-in-out infinite',
        }}
      />
    ))}
    <style>{`@keyframes pulse { 0%,100%{opacity:.55} 50%{opacity:.95} }`}</style>
  </ul>
);

const EmptyState: React.FC<{ filter: FeedbackKind | null }> = ({ filter }) => (
  <div style={{ textAlign: 'center', padding: '24px 12px' }}>
    <p style={{ ...bodyStyle, fontSize: 13, opacity: 0.8 }}>
      {filter
        ? `No ${kindMeta(filter).label.toLowerCase()} yet — you'll see them here after you submit.`
        : "Nothing here yet. Your submissions will show up here as soon as you send one."}
    </p>
  </div>
);

// ============================================================================
// HELPERS
// ============================================================================

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

const pagerBtn = (disabled: boolean): React.CSSProperties => ({
  padding: '6px 14px',
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 600,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: disabled ? 'var(--dash-muted, #94a3b8)' : 'var(--dash-heading, #3d1428)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
  fontFamily: "'Inter', sans-serif",
  WebkitTapHighlightColor: 'transparent',
});

const panelStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 24,
  padding: '1.5rem',
  backdropFilter: 'blur(30px)',
  WebkitBackdropFilter: 'blur(30px)',
  boxShadow: '0 8px 40px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.18)',
};

const eyebrow: React.CSSProperties = {
  margin: 0,
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  // Sakura→magenta, cosmic→light-indigo: both readable on their surface.
  color: 'var(--dash-accent, #a78bfa)',
};

const heading: React.CSSProperties = {
  margin: '4px 0 0',
  fontFamily: "'Poppins', sans-serif",
  fontSize: 18,
  fontWeight: 600,
  color: 'var(--dash-heading, #3d1428)',
  textShadow: '0 1px 2px rgba(255,255,255,0.4)',
};

const bodyStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontSize: 13,
  color: 'var(--dash-body, #4a1a2e)',
  margin: 0,
  lineHeight: 1.6,
};

export default MyFeedbackHistory;