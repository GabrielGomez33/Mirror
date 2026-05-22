import React from 'react';

type CalloutKind = 'info' | 'success' | 'warning' | 'danger' | 'tip' | 'security';

interface KindStyle {
  label: string;
  /** CSS variable name for the accent color (defined in dev-terminal.css). */
  accentVar: string;
  accentDimVar: string;
  /** Single-character glyph rendered before the title. */
  glyph: string;
}

const KIND_STYLES: Record<CalloutKind, KindStyle> = {
  info:     { label: 'NOTE',     glyph: 'i', accentVar: 'var(--dt-cyan)',    accentDimVar: 'var(--dt-cyan-dim)' },
  success:  { label: 'OK',       glyph: '✓', accentVar: 'var(--dt-green)',   accentDimVar: 'var(--dt-green-dim)' },
  warning:  { label: 'WARN',     glyph: '!', accentVar: 'var(--dt-amber)',   accentDimVar: 'var(--dt-amber-dim)' },
  danger:   { label: 'DANGER',   glyph: 'x', accentVar: 'var(--dt-red)',     accentDimVar: 'var(--dt-red-dim)' },
  tip:      { label: 'TIP',      glyph: '*', accentVar: 'var(--dt-magenta)', accentDimVar: 'var(--dt-magenta-dim)' },
  security: { label: 'SECURITY', glyph: '#', accentVar: 'var(--dt-magenta)', accentDimVar: 'var(--dt-magenta-dim)' },
};

export interface DevCalloutProps {
  kind?: CalloutKind;
  title?: string;
  children: React.ReactNode;
}

/**
 * DevCallout — terminal-style boxed note. Uses a left-rule + label-tag
 * pattern that reads cleanly even when callouts stack. Stays within
 * standard semantic <aside> for accessibility.
 */
const DevCallout: React.FC<DevCalloutProps> = ({ kind = 'info', title, children }) => {
  const style = KIND_STYLES[kind];
  return (
    <aside
      role="note"
      aria-label={title || style.label}
      className="dt-callout my-5"
      style={{
        background: 'var(--dt-bg-elevated)',
        borderLeft: `3px solid ${style.accentVar}`,
        borderTop: '1px solid var(--dt-border)',
        borderRight: '1px solid var(--dt-border)',
        borderBottom: '1px solid var(--dt-border)',
        borderRadius: '0 4px 4px 0',
      }}
    >
      <div className="flex items-start gap-3 px-3 py-3 sm:px-4">
        <span
          aria-hidden="true"
          className="mt-0.5 inline-flex h-5 shrink-0 items-center justify-center font-bold"
          style={{
            color: style.accentVar,
            background: style.accentDimVar,
            padding: '0 0.5rem',
            borderRadius: '2px',
            fontSize: '0.7rem',
            lineHeight: 1.4,
          }}
        >
          {style.glyph} {style.label}
        </span>
        <div className="min-w-0 flex-1 text-sm leading-relaxed">
          {title && (
            <div
              className="mb-1.5 font-semibold"
              style={{ color: 'var(--dt-fg-strong)' }}
            >
              {title}
            </div>
          )}
          <div style={{ color: 'var(--dt-fg)' }}>{children}</div>
        </div>
      </div>
    </aside>
  );
};

export default DevCallout;
