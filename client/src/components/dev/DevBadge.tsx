import React from 'react';

type BadgeTone =
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
  | 'info';

const TONE_STYLES: Record<BadgeTone, string> = {
  neutral:  'bg-white/8 text-white/80 border-white/15',
  public:   'bg-emerald-400/15 text-emerald-200 border-emerald-300/30',
  auth:     'bg-sky-400/15 text-sky-200 border-sky-300/30',
  premium:  'bg-amber-400/15 text-amber-200 border-amber-300/30',
  admin:    'bg-rose-400/15 text-rose-200 border-rose-300/30',
  get:      'bg-emerald-400/15 text-emerald-200 border-emerald-300/30',
  post:     'bg-sky-400/15 text-sky-200 border-sky-300/30',
  put:      'bg-indigo-400/15 text-indigo-200 border-indigo-300/30',
  delete:   'bg-rose-400/15 text-rose-200 border-rose-300/30',
  patch:    'bg-violet-400/15 text-violet-200 border-violet-300/30',
  ws:       'bg-fuchsia-400/15 text-fuchsia-200 border-fuchsia-300/30',
  queue:    'bg-amber-400/15 text-amber-200 border-amber-300/30',
  danger:   'bg-rose-500/20 text-rose-200 border-rose-300/30',
  success:  'bg-emerald-500/20 text-emerald-200 border-emerald-300/30',
  info:     'bg-sky-500/20 text-sky-200 border-sky-300/30',
};

export interface DevBadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
  /** Optional explicit accessible label when the visible text is an abbreviation (e.g. "GET"). */
  ariaLabel?: string;
  className?: string;
}

/**
 * DevBadge — small, neutral-by-default chip used to tag HTTP methods, auth levels,
 * subscription tiers, queue priorities, etc. Tone is purely visual; it does not
 * encode behavior.
 */
const DevBadge: React.FC<DevBadgeProps> = ({ children, tone = 'neutral', ariaLabel, className }) => {
  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className={
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 ' +
        'text-[11px] font-semibold uppercase tracking-wider font-mono ' +
        'whitespace-nowrap select-none ' +
        TONE_STYLES[tone] +
        (className ? ' ' + className : '')
      }
    >
      {children}
    </span>
  );
};

export default DevBadge;
