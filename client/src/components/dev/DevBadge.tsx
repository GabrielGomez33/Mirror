import React from 'react';

export type BadgeTone =
  | 'neutral'
  | 'public'
  | 'auth'
  | 'premium'
  | 'admin'
  | 'get'
  | 'post'
  | 'put'
  | 'delete'
  | 'patch'
  | 'ws'
  | 'queue'
  | 'danger'
  | 'success'
  | 'info'
  | 'warning';

/** Each tone maps to a single accent variable from dev-terminal.css. */
const TONE_VAR: Record<BadgeTone, { fg: string; border: string }> = {
  neutral:  { fg: 'var(--dt-fg-muted)', border: 'var(--dt-border-hi)' },
  public:   { fg: 'var(--dt-green)',    border: 'var(--dt-green)' },
  auth:     { fg: 'var(--dt-cyan)',     border: 'var(--dt-cyan)' },
  premium:  { fg: 'var(--dt-amber)',    border: 'var(--dt-amber)' },
  admin:    { fg: 'var(--dt-red)',      border: 'var(--dt-red)' },
  get:      { fg: 'var(--dt-green)',    border: 'var(--dt-green)' },
  post:     { fg: 'var(--dt-cyan)',     border: 'var(--dt-cyan)' },
  put:      { fg: 'var(--dt-magenta)',  border: 'var(--dt-magenta)' },
  delete:   { fg: 'var(--dt-red)',      border: 'var(--dt-red)' },
  patch:    { fg: 'var(--dt-magenta)',  border: 'var(--dt-magenta)' },
  ws:       { fg: 'var(--dt-magenta)',  border: 'var(--dt-magenta)' },
  queue:    { fg: 'var(--dt-amber)',    border: 'var(--dt-amber)' },
  danger:   { fg: 'var(--dt-red)',      border: 'var(--dt-red)' },
  success:  { fg: 'var(--dt-green)',    border: 'var(--dt-green)' },
  info:     { fg: 'var(--dt-cyan)',     border: 'var(--dt-cyan)' },
  warning:  { fg: 'var(--dt-amber)',    border: 'var(--dt-amber)' },
};

export interface DevBadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
  /** Whether to wrap the label in [brackets] (terminal flag style). Defaults to true. */
  bracketed?: boolean;
  ariaLabel?: string;
}

/**
 * DevBadge — terminal "[FLAG]" tag. Bracket-wrapped by default to read like
 * a CLI option or HTTP method header. Tone is purely visual.
 */
const DevBadge: React.FC<DevBadgeProps> = ({
  children,
  tone = 'neutral',
  bracketed = true,
  ariaLabel,
}) => {
  const { fg, border } = TONE_VAR[tone];
  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className="inline-flex items-center font-semibold tracking-wider whitespace-nowrap select-none"
      style={{
        color: fg,
        border: `1px solid ${border}`,
        background: 'transparent',
        padding: '0 0.45rem',
        borderRadius: '2px',
        fontSize: '0.68rem',
        lineHeight: 1.6,
        textTransform: 'uppercase',
      }}
    >
      {bracketed ? <span aria-hidden="true">[</span> : null}
      {children}
      {bracketed ? <span aria-hidden="true">]</span> : null}
    </span>
  );
};

export default DevBadge;
