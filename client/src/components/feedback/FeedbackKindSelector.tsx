// ============================================================================
// FEEDBACK KIND SELECTOR
// ============================================================================
// File: client/src/components/feedback/FeedbackKindSelector.tsx
// ----------------------------------------------------------------------------
// Segmented control for switching between the four feedback flavours. Colour
// palette is the same one used by the personal-analysis colour wheel in
// MyMirror so the page feels native to the rest of the app.
//
// Active tab gets a soft conic-gradient halo behind the orb; inactive tabs
// stay flat to keep the surface calm. Fully keyboard-navigable.
// ============================================================================

import React from 'react';
import { motion } from 'framer-motion';
import type { FeedbackKind } from '../../services/feedbackApi';

interface OptionDef {
  kind: FeedbackKind;
  label: string;
  blurb: string;
  color: string;
  glow: string;
  icon: string;
}

export const FEEDBACK_OPTIONS: ReadonlyArray<OptionDef> = [
  {
    kind: 'rating',
    label: 'Rate Mirror',
    blurb: 'Quick star rating with an optional comment.',
    color: '#f472b6',
    glow: 'rgba(244,114,182,0.45)',
    icon: '★',
  },
  {
    kind: 'issue',
    label: 'Report an issue',
    blurb: 'Something broken or off? Help us reproduce it.',
    color: '#fb923c',
    glow: 'rgba(251,146,60,0.4)',
    icon: '⚑',
  },
  {
    kind: 'recommendation',
    label: 'Recommendation',
    blurb: 'Wish Mirror could do something new? Tell us.',
    color: '#4ade80',
    glow: 'rgba(74,222,128,0.4)',
    icon: '✦',
  },
  {
    kind: 'contact',
    label: 'Contact support',
    blurb: 'Talk to a human — we reply by email.',
    color: '#60a5fa',
    glow: 'rgba(96,165,250,0.4)',
    icon: '✉',
  },
];

export function kindMeta(kind: FeedbackKind): OptionDef {
  return FEEDBACK_OPTIONS.find((o) => o.kind === kind) || FEEDBACK_OPTIONS[0];
}

interface Props {
  value: FeedbackKind;
  onChange: (k: FeedbackKind) => void;
  disabled?: boolean;
}

const FeedbackKindSelector: React.FC<Props> = ({ value, onChange, disabled }) => {
  return (
    <div
      role="tablist"
      aria-label="Feedback type"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 10,
        opacity: disabled ? 0.7 : 1,
        pointerEvents: disabled ? 'none' : undefined,
      }}
    >
      {FEEDBACK_OPTIONS.map((opt) => {
        const active = value === opt.kind;
        return (
          <button
            key={opt.kind}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.kind)}
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 6,
              padding: '14px 14px 12px',
              borderRadius: 16,
              cursor: 'pointer',
              textAlign: 'left',
              background: active
                ? `linear-gradient(135deg, ${opt.color}22 0%, rgba(255,255,255,0.04) 100%)`
                : 'rgba(255,255,255,0.04)',
              border: `1px solid ${active ? opt.color + '66' : 'rgba(255,255,255,0.12)'}`,
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              transition: 'border-color 200ms ease, background 200ms ease, transform 200ms ease',
              boxShadow: active
                ? `0 6px 24px ${opt.glow}, inset 0 1px 0 rgba(255,255,255,0.18)`
                : '0 1px 0 rgba(255,255,255,0.04) inset',
              WebkitTapHighlightColor: 'transparent',
              outline: 'none',
            }}
            onFocus={(e) => { e.currentTarget.style.outline = `2px solid ${opt.color}aa`; e.currentTarget.style.outlineOffset = '2px'; }}
            onBlur={(e)  => { e.currentTarget.style.outline = 'none'; }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 2,
              }}
            >
              <motion.span
                aria-hidden="true"
                initial={false}
                animate={{ scale: active ? 1.1 : 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 20 }}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `radial-gradient(circle at 30% 30%, ${opt.color}cc, ${opt.color}55 60%, transparent 100%)`,
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 14,
                  textShadow: '0 1px 2px rgba(0,0,0,0.35)',
                  boxShadow: active ? `0 0 16px ${opt.glow}` : 'none',
                  flexShrink: 0,
                }}
              >
                {opt.icon}
              </motion.span>
              <span
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--dash-heading, #3d1428)',
                  textShadow: '0 1px 2px rgba(255,255,255,0.4)',
                  lineHeight: 1.1,
                }}
              >
                {opt.label}
              </span>
            </div>
            <span
              style={{
                fontSize: 11.5,
                color: 'var(--dash-subtle, #5a2d3e)',
                fontWeight: 400,
                lineHeight: 1.4,
                opacity: 0.9,
              }}
            >
              {opt.blurb}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default FeedbackKindSelector;