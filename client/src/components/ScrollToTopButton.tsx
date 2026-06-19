// src/components/ScrollToTopButton.tsx
//
// Floating "scroll to the top of the PAGE" control.
//
// This is deliberately distinct from any in-pane scroll affordance (e.g. the
// chat's own scroll-to-bottom button): it scrolls the document/window, returning
// the user to the page header from deep inside long, scroll-heavy views — most
// notably the MirrorGroup detail view's Chat tab, where the chat pane can fill
// most of the screen and push the "Back to Groups" header off-screen.
//
// Visually it MIRRORS .chat-scroll-bottom-btn (chat-glass.css): same 36px round
// dark-glass pill, same hover (darken + scale 1.1), same right-edge column — so
// the two controls read as a matched pair. It just sits lower, on the bottom
// right "lip" below the message box, while the chat button floats higher (7rem).
//
// Behaviour / robustness:
//   - Reveals only after the window has scrolled past `threshold` px.
//   - Rendered through a portal to <body> so a transformed/blurred ancestor can
//     never trap its `position: fixed` (a real gotcha on this page, which uses
//     backdrop-filter heavily).
//   - Honors prefers-reduced-motion (instant jump instead of smooth scroll).
//   - Clears the device safe-area on the bottom/right so it isn't under a home
//     indicator or rounded corner.
//   - Stays out of the focus order and is hidden from a11y tools while invisible.

import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface ScrollToTopButtonProps {
  /** Reveal the button once the window has scrolled this many px. */
  threshold?: number;
  /** Accessible label / tooltip. */
  label?: string;
}

const ScrollToTopButton: React.FC<ScrollToTopButtonProps> = ({
  threshold = 320,
  label = 'Scroll to top of page',
}) => {
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const read = () =>
      window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const onScroll = () => setVisible(read() > threshold);
    onScroll(); // sync on mount (e.g. returning to an already-scrolled view)
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [threshold]);

  const handleClick = useCallback(() => {
    const reduce =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      aria-label={label}
      title={label}
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      style={{
        // Same right column as .chat-scroll-bottom-btn; sits on the bottom lip
        // (the chat button floats higher at 7rem, so the two stack without
        // overlapping).
        position: 'fixed',
        right: 'calc(1rem + env(safe-area-inset-right, 0px))',
        bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
        zIndex: 60,
        width: 36,
        height: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        borderRadius: '50%',
        // Matches .chat-scroll-bottom-btn dark-glass palette + hover.
        background: hovered ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.6)',
        color: hovered ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        opacity: visible ? 1 : 0,
        transform: hovered ? 'scale(1.1)' : 'scale(1)',
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'all 0.2s ease',
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 19V5" />
        <path d="M5 12l7-7 7 7" />
      </svg>
    </button>,
    document.body,
  );
};

export default ScrollToTopButton;