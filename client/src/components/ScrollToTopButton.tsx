// src/components/ScrollToTopButton.tsx
//
// Floating "scroll to the top of the PAGE" control.
//
// Distinct from any in-pane scroll affordance (e.g. the chat's scroll-to-bottom
// button): it scrolls the document/window, returning the user to the page header
// from deep inside long, scroll-heavy views — most notably the MirrorGroup chat
// tab, where the chat pane can fill the screen and push the header off-screen.
//
// All positioning/visuals live in ScrollToTopButton.css so they can be
// responsive (desktop hugs the bottom; mobile sits above the iOS home
// indicator). This component only owns behaviour + the show/hide state.
//
// Robustness:
//   - Reveals only after the window has scrolled past `threshold` px.
//   - Portaled to <body> so a transformed/blurred ancestor can't trap its
//     position:fixed (the group page uses backdrop-filter heavily), and so it
//     shares the exact same viewport anchor as the chat scroll-to-bottom button.
//   - Honors prefers-reduced-motion (instant jump instead of smooth scroll).
//   - Out of the focus order / hidden from a11y tools while invisible.

import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import '../styles/ScrollToTopButton.css';

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
      aria-label={label}
      title={label}
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      className={`scroll-to-top-btn${visible ? ' is-visible' : ''}`}
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