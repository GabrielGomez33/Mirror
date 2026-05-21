import React from 'react';

type CalloutKind = 'info' | 'success' | 'warning' | 'danger' | 'tip' | 'security';

interface KindStyle {
  icon: string;
  label: string;
  bg: string;
  border: string;
  text: string;
  accent: string;
}

const KIND_STYLES: Record<CalloutKind, KindStyle> = {
  info: {
    icon: 'i',
    label: 'Note',
    bg: 'bg-sky-500/8',
    border: 'border-sky-300/30',
    text: 'text-sky-100',
    accent: 'bg-sky-300/80 text-sky-950',
  },
  success: {
    icon: '✓',
    label: 'Confirmed',
    bg: 'bg-emerald-500/8',
    border: 'border-emerald-300/30',
    text: 'text-emerald-100',
    accent: 'bg-emerald-300/80 text-emerald-950',
  },
  warning: {
    icon: '!',
    label: 'Caution',
    bg: 'bg-amber-500/8',
    border: 'border-amber-300/30',
    text: 'text-amber-100',
    accent: 'bg-amber-300/80 text-amber-950',
  },
  danger: {
    icon: '×',
    label: 'Danger',
    bg: 'bg-rose-500/8',
    border: 'border-rose-300/30',
    text: 'text-rose-100',
    accent: 'bg-rose-300/80 text-rose-950',
  },
  tip: {
    icon: '★',
    label: 'Tip',
    bg: 'bg-violet-500/8',
    border: 'border-violet-300/30',
    text: 'text-violet-100',
    accent: 'bg-violet-300/80 text-violet-950',
  },
  security: {
    icon: '⚑',
    label: 'Security',
    bg: 'bg-fuchsia-500/8',
    border: 'border-fuchsia-300/30',
    text: 'text-fuchsia-100',
    accent: 'bg-fuchsia-300/80 text-fuchsia-950',
  },
};

export interface DevCalloutProps {
  kind?: CalloutKind;
  title?: string;
  children: React.ReactNode;
}

const DevCallout: React.FC<DevCalloutProps> = ({ kind = 'info', title, children }) => {
  const style = KIND_STYLES[kind];
  return (
    <aside
      role="note"
      aria-label={title || style.label}
      className={
        'my-5 rounded-xl border ' +
        style.bg +
        ' ' +
        style.border +
        ' ' +
        style.text +
        ' backdrop-blur-md'
      }
    >
      <div className="flex items-start gap-3 p-4">
        <span
          aria-hidden="true"
          className={
            'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ' +
            style.accent
          }
        >
          {style.icon}
        </span>
        <div className="min-w-0 flex-1">
          {title && (
            <div className="mb-1 text-sm font-semibold tracking-wide">{title}</div>
          )}
          <div className="text-sm leading-relaxed [&_a]:underline [&_code]:rounded [&_code]:bg-white/8 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]">
            {children}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default DevCallout;
