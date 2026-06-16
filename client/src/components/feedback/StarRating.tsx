// ============================================================================
// STAR RATING
// ============================================================================
// File: client/src/components/feedback/StarRating.tsx
// ----------------------------------------------------------------------------
// Accessible 1-5 star rating input with keyboard, pointer and touch support.
// The star fill animates with framer-motion using the same pink→violet
// gradient family as the personal-analysis colour wheel in MyMirror.
//
// Props
//   value           — current rating (0 = not yet rated, 1..5 selected)
//   onChange        — invoked with the new rating
//   disabled        — read-only mode (e.g. while submitting)
//   size            — px size of each star (default 36)
//   showHelperText  — render the descriptive label under the row
//   ariaLabel       — accessible label for the radio group
// ============================================================================

import React, { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface StarRatingProps {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  size?: number;
  showHelperText?: boolean;
  ariaLabel?: string;
}

// Aligned with the MyMirror personal-analysis colour wheel: pink → violet → indigo.
const STAR_PALETTE = ['#f472b6', '#fb7185', '#a78bfa', '#818cf8', '#60a5fa'];

const HELPER_LABELS: Record<number, { text: string; color: string }> = {
  1: { text: "We're sorry — tell us what went wrong",   color: '#f87171' },
  2: { text: "Below expectations — what would help?",   color: '#fb923c' },
  3: { text: "It's okay — share what could be better",  color: '#facc15' },
  4: { text: "Great — what made it click for you?",     color: '#4ade80' },
  5: { text: "We love that — what do you love most?",   color: '#22d3ee' },
};

const StarShape: React.FC<{ filled: boolean; color: string; size: number }> = ({ filled, color, size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    aria-hidden="true"
    style={{ display: 'block', overflow: 'visible' }}
  >
    <defs>
      <linearGradient id={`starGrad-${color.slice(1)}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"  stopColor={color} stopOpacity="0.95" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0.45" />
      </linearGradient>
    </defs>
    <path
      d="M12 2.6l2.92 5.92 6.54.95-4.73 4.61 1.12 6.51L12 17.77l-5.85 3.07 1.12-6.51L2.54 9.47l6.54-.95L12 2.6z"
      fill={filled ? `url(#starGrad-${color.slice(1)})` : 'rgba(255,255,255,0.08)'}
      stroke={filled ? color : 'rgba(255,255,255,0.35)'}
      strokeWidth={1.25}
      strokeLinejoin="round"
      style={{
        filter: filled
          ? `drop-shadow(0 0 10px ${color}88) drop-shadow(0 2px 6px rgba(0,0,0,0.18))`
          : 'drop-shadow(0 1px 2px rgba(0,0,0,0.12))',
        transition: 'fill 200ms ease, stroke 200ms ease',
      }}
    />
  </svg>
);

const StarRating: React.FC<StarRatingProps> = ({
  value,
  onChange,
  disabled = false,
  size = 40,
  showHelperText = true,
  ariaLabel = 'Star rating',
}) => {
  const [hover, setHover] = useState(0);
  const display = hover || value;
  const helper  = display ? HELPER_LABELS[display] : null;

  const setRating = useCallback(
    (n: number) => {
      if (disabled) return;
      onChange(n);
    },
    [disabled, onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        setRating(Math.max(1, (value || 1) - 1));
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        setRating(Math.min(5, (value || 0) + 1));
      } else if (/^[1-5]$/.test(e.key)) {
        e.preventDefault();
        setRating(parseInt(e.key, 10));
      } else if (e.key === 'Home') {
        e.preventDefault();
        setRating(1);
      } else if (e.key === 'End') {
        e.preventDefault();
        setRating(5);
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setRating(value || 5);
      }
    },
    [disabled, value, setRating],
  );

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
      onMouseLeave={() => setHover(0)}
      style={{
        outline: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: Math.max(6, Math.round(size * 0.18)),
          padding: '4px 0',
        }}
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = display >= n;
          const color = STAR_PALETTE[n - 1];
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={`${n} star${n === 1 ? '' : 's'}`}
              tabIndex={-1}
              disabled={disabled}
              onMouseEnter={() => !disabled && setHover(n)}
              onFocus={() => !disabled && setHover(n)}
              onBlur={() => setHover(0)}
              onClick={() => setRating(n)}
              style={{
                background: 'none',
                border: 'none',
                padding: 4,
                cursor: disabled ? 'not-allowed' : 'pointer',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <motion.div
                initial={false}
                animate={{
                  scale: filled ? 1.06 : 1,
                  rotate: filled && hover === n ? -6 : 0,
                }}
                whileTap={!disabled ? { scale: 0.9 } : undefined}
                transition={{ type: 'spring', stiffness: 320, damping: 22 }}
              >
                <StarShape filled={filled} color={color} size={size} />
              </motion.div>
            </button>
          );
        })}
      </div>

      {showHelperText && (
        <div style={{ minHeight: 22, textAlign: 'center' }}>
          <AnimatePresence mode="wait" initial={false}>
            {helper ? (
              <motion.p
                key={display}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: helper.color,
                  fontWeight: 600,
                  textShadow: '0 1px 6px rgba(0,0,0,0.18)',
                  letterSpacing: '0.01em',
                }}
              >
                {helper.text}
              </motion.p>
            ) : (
              <motion.p
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0 }}
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: 'var(--dash-subtle, #7e4151)',
                  fontWeight: 500,
                }}
              >
                Tap a star to begin
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default StarRating;