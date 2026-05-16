// ============================================================================
// SkipLink — keyboard-only shortcut past header/nav chrome (Phase 7)
// ============================================================================
// File: components/a11y/SkipLink.tsx
//
// Renders an anchor that is visually-hidden by default and becomes
// focusable + visible the moment a keyboard user tabs into it (first
// tab from the URL bar / address bar). Activating it moves focus to
// the element with id="main-content".
//
// Why this matters:
//   - Screen reader + keyboard users would otherwise tab through every
//     header / nav item before reaching the page body on every route.
//   - Lighthouse a11y audit checks for a working skip link.
//   - WCAG 2.4.1 — Bypass Blocks.
//
// Pairing requirement:
//   The App shell must render an element with id="main-content" and
//   tabIndex={-1} (so it can receive programmatic focus). See App.tsx.
//
// Visual styling lives in styles/pwa-shell.css under .pwa-skip-link —
// keeping the CSS centralized so other a11y primitives can re-use it.
// ============================================================================

import React, { useCallback } from 'react';

const SkipLink: React.FC = () => {
	// Use an onClick that imperatively focuses the target after letting
	// the default anchor jump run. Without explicit focus, browsers move
	// SCROLL position but leave focus on the anchor — keyboard users
	// then have to tab through the chrome anyway.
	const handleClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
		const target = document.getElementById('main-content');
		if (!target) return;
		// Don't prevent default — the URL fragment update is useful for
		// "back" navigation. Just supplement it with explicit focus.
		// Defer to next tick so the browser has finished its scroll.
		requestAnimationFrame(() => {
			target.focus({ preventScroll: false });
		});
		// Avoid an unused-arg lint by referencing e once.
		void e;
	}, []);

	return (
		<a href="#main-content" className="pwa-skip-link" onClick={handleClick}>
			Skip to main content
		</a>
	);
};

export default SkipLink;
