// ============================================================================
// SafariNudge
// ============================================================================
// File: components/install/SafariNudge.tsx
//
// Persistent top banner for non-Safari iOS users. iOS gates Web Push on
// Safari-installed PWAs, so users on Chrome/Firefox/Edge/Opera iOS need
// to switch to Safari before they can enable notifications. This banner
// makes the path discoverable and persistent without being a blocking
// modal.
//
// SHOWN WHEN
//   - User is on iOS, AND
//   - Browser is NOT Safari (CriOS / FxiOS / EdgiOS / OPT / etc.), AND
//   - Browser is not an in-app webview (Instagram, FB, etc.), AND
//   - User has not dismissed it this session
//
// HIDDEN WHEN
//   - User is in standalone mode (already installed)
//   - User is in Safari (the iOS install tutorial handles them)
//   - User is on any non-iOS platform
//   - User dismissed the banner this session (sessionStorage, NOT
//     persistent — they should keep being reminded across sessions
//     because push really is essential)
//
// COPY DISMISSAL is per-session, NOT forever:
//   For the "Don't ask again" forever path the user can use the standard
//   install tutorial controls. This banner re-appears next visit because
//   push is core functionality and the issue is recoverable (one-time
//   reinstall via Safari).
// ============================================================================

import React, { useEffect, useState } from 'react';
import { useInstallState } from '../../hooks/useInstallState';
import OpenInSafariActions from './OpenInSafariActions';

const SESSION_KEY = 'mirror.safariNudge.dismissedThisSession';

const SafariNudge: React.FC = () => {
	const { isIOS, isIOSInstallable, isIOSSafariBrowser, isStandalone } = useInstallState();
	const [dismissed, setDismissed] = useState<boolean>(() => {
		try {
			return sessionStorage.getItem(SESSION_KEY) === '1';
		} catch {
			return false;
		}
	});
	const [expanded, setExpanded] = useState(false);

	// Only on iOS, only in non-Safari browsers, only if not already standalone.
	const shouldShow =
		isIOS && isIOSInstallable && !isIOSSafariBrowser && !isStandalone && !dismissed;

	useEffect(() => {
		if (!shouldShow) setExpanded(false);
	}, [shouldShow]);

	if (!shouldShow) return null;

	const handleDismiss = () => {
		try {
			sessionStorage.setItem(SESSION_KEY, '1');
		} catch {
			// Some browsers in private mode reject sessionStorage writes; we
			// fall back to in-memory dismissal — banner reappears on next reload.
		}
		setDismissed(true);
	};

	return (
		<div
			role="status"
			aria-live="polite"
			style={{
				position: 'fixed',
				top: 0,
				left: 0,
				right: 0,
				zIndex: 9985,
				paddingTop: 'env(safe-area-inset-top, 0)',
				display: 'flex',
				justifyContent: 'center',
				pointerEvents: 'none',
			}}
		>
			<div
				className="glass-card-enhanced"
				style={{
					margin: '8px',
					maxWidth: 560,
					width: 'calc(100% - 16px)',
					borderRadius: 16,
					padding: expanded ? '14px 16px 16px' : '10px 14px',
					color: '#1a1024',
					pointerEvents: 'auto',
					boxShadow: '0 8px 24px rgba(26, 16, 36, 0.12)',
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
					<SafariSparkleIcon />
					<div style={{ flex: 1, minWidth: 0 }}>
						<p style={{ margin: 0, fontSize: 13, fontWeight: 600, lineHeight: 1.3, color: '#1a1024' }}>
							Open Mirror in Safari for notifications
						</p>
						{!expanded && (
							<p style={{ margin: '2px 0 0 0', fontSize: 11, color: 'rgba(26, 16, 36, 0.6)', lineHeight: 1.35 }}>
								iPhone push notifications require installing from Safari.
							</p>
						)}
					</div>
					{!expanded && (
						<button
							type="button"
							onClick={() => setExpanded(true)}
							style={{
								flexShrink: 0,
								padding: '6px 12px',
								fontSize: 12,
								fontWeight: 600,
								borderRadius: 999,
								background: 'linear-gradient(135deg, #f472b6, #fb7185)',
								color: '#ffffff',
								border: 'none',
								cursor: 'pointer',
								whiteSpace: 'nowrap',
								boxShadow: '0 4px 10px rgba(244, 114, 182, 0.3)',
							}}
						>
							How
						</button>
					)}
					<button
						type="button"
						onClick={handleDismiss}
						aria-label="Dismiss"
						style={{
							flexShrink: 0,
							background: 'transparent',
							border: 'none',
							color: 'rgba(26, 16, 36, 0.4)',
							fontSize: 20,
							lineHeight: 1,
							cursor: 'pointer',
							padding: '0 4px',
						}}
					>
						×
					</button>
				</div>

				{expanded && (
					<div style={{ marginTop: 12 }}>
						<ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'rgba(26, 16, 36, 0.75)', lineHeight: 1.5 }}>
							<li>Copy the link below (or share it to yourself).</li>
							<li>Open Safari on your iPhone.</li>
							<li>Paste the link in the Safari address bar.</li>
							<li>Tap Share → Add to Home Screen.</li>
						</ol>
						<div style={{ marginTop: 12 }}>
							<OpenInSafariActions size="compact" />
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

// Sparkle-on-Safari-compass icon — subtle, on-brand.
const SafariSparkleIcon: React.FC = () => (
	<div
		aria-hidden="true"
		style={{
			flexShrink: 0,
			width: 32,
			height: 32,
			borderRadius: 999,
			background: 'linear-gradient(135deg, #f472b6, #fb7185)',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			boxShadow: '0 4px 10px rgba(244, 114, 182, 0.3)',
		}}
	>
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
			<circle cx="12" cy="12" r="3" />
		</svg>
	</div>
);

export default SafariNudge;
