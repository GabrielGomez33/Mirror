// ============================================================================
// PushSettings — push notification opt-in panel (Phase 5)
// ============================================================================
// File: components/notifications/PushSettings.tsx
//
// Rendered inside the GlobalDashboard drawer's "Notifications" section.
// Visual language matches that panel — light glass, sakura accent, plum
// text — and uses inline styles defensively so ambient CSS rules can't
// stretch icons or hijack layout (same issue we hit with InstallPrompt).
//
// Renders one of these states based on platform / install / permission:
//   - Unsupported browser           → quiet "not supported" line
//   - iOS, not standalone           → "Install Mirror to enable" + Show me how
//                                      (+ Copy/Share buttons for non-Safari iOS)
//   - iOS, standalone via non-Safari→ "Reinstall from Safari" + Copy/Share
//   - Permission denied             → "Notifications blocked" instruction
//   - Default                       → "Enable notifications" button
//   - Granted + subscribed          → "Enabled on N devices" + Disable (two-tap)
//
// Errors render inline below the action button, color-coded by severity.
// ============================================================================

import React, { useEffect, useState } from 'react';
import { usePushSubscription } from '../../hooks/usePushSubscription';
import { useInstallState } from '../../hooks/useInstallState';
import OpenInSafariActions from '../install/OpenInSafariActions';

// Match GlobalDashboard's color palette so this section looks native to
// the panel rather than imported from another visual world.
const C = {
	heading: '#3d1428',
	body: '#2e1018',
	subtle: '#6b4050',
	muted: '#8a6070',
	accent: '#c6469b',
	accentSoft: 'rgba(198, 70, 155, 0.12)',
	warning: '#b8770e',
	warningSoft: 'rgba(212, 138, 26, 0.12)',
	danger: '#a8324c',
	dangerSoft: 'rgba(168, 50, 76, 0.12)',
	success: '#1e7a52',
	successSoft: 'rgba(30, 122, 82, 0.12)',
};

// ============================================================================
// CONTAINER STYLES (match GlobalDashboard's glass cards but slightly tighter)
// ============================================================================

const containerStyle: React.CSSProperties = {
	background: 'rgba(255, 255, 255, 0.5)',
	border: '1px solid rgba(255, 255, 255, 0.55)',
	borderRadius: 12,
	padding: '10px 12px',
	backdropFilter: 'blur(12px)',
	WebkitBackdropFilter: 'blur(12px)',
	fontFamily: "'Inter', sans-serif",
};

const titleStyle: React.CSSProperties = {
	fontSize: '0.78rem',
	fontWeight: 600,
	color: C.heading,
	margin: 0,
	lineHeight: 1.3,
};

const bodyStyle: React.CSSProperties = {
	fontSize: '0.7rem',
	color: C.subtle,
	lineHeight: 1.4,
	margin: '2px 0 0 0',
};

const helperLinkStyle: React.CSSProperties = {
	fontSize: '0.7rem',
	fontWeight: 600,
	color: C.accent,
	background: 'transparent',
	border: 'none',
	cursor: 'pointer',
	padding: 0,
	marginTop: 6,
	textAlign: 'left',
};

const primaryButtonStyle: React.CSSProperties = {
	fontSize: '0.7rem',
	fontWeight: 600,
	color: '#ffffff',
	background: 'linear-gradient(135deg, #f472b6, #fb7185)',
	border: 'none',
	borderRadius: 999,
	padding: '7px 14px',
	cursor: 'pointer',
	boxShadow: '0 2px 8px rgba(244, 114, 182, 0.3)',
	transition: 'transform 0.15s ease',
};

const secondaryButtonStyle: React.CSSProperties = {
	fontSize: '0.7rem',
	fontWeight: 600,
	color: C.body,
	background: 'rgba(46, 16, 24, 0.06)',
	border: '1px solid rgba(46, 16, 24, 0.1)',
	borderRadius: 999,
	padding: '7px 12px',
	cursor: 'pointer',
};

const dangerButtonStyle: React.CSSProperties = {
	fontSize: '0.7rem',
	fontWeight: 600,
	color: C.danger,
	background: C.dangerSoft,
	border: '1px solid rgba(168, 50, 76, 0.18)',
	borderRadius: 999,
	padding: '7px 12px',
	cursor: 'pointer',
};

// ============================================================================
// COMPONENT
// ============================================================================

interface PushSettingsProps {
	onIOSInstallNudge?: () => void;
}

const PushSettings: React.FC<PushSettingsProps> = ({ onIOSInstallNudge }) => {
	const push = usePushSubscription();
	const install = useInstallState();
	const [confirmingDisable, setConfirmingDisable] = useState(false);

	useEffect(() => {
		if (!push.subscription) setConfirmingDisable(false);
	}, [push.subscription]);

	if (!push.supported) {
		return (
			<Frame icon={<BellSlashIcon color={C.muted} />} tone="muted">
				<p style={titleStyle}>Push notifications</p>
				<p style={bodyStyle}>This browser doesn't support push notifications.</p>
			</Frame>
		);
	}

	if (!push.ready) {
		return (
			<Frame icon={<BellIcon color={C.muted} />} tone="muted">
				<div style={{ height: 12, width: 100, background: 'rgba(0,0,0,0.06)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
			</Frame>
		);
	}

	// iOS, not yet installed — push needs install (verified for iOS 26).
	if (install.isIOS && !install.isStandalone) {
		return (
			<Frame icon={<BellIcon color={C.warning} />} tone="warning">
				<p style={titleStyle}>Install Mirror to enable notifications</p>
				<p style={bodyStyle}>
					{install.isIOSSafariBrowser
						? 'iPhone notifications need Mirror on your Home Screen — install from Safari to enable.'
						: 'iPhone notifications require installing from Safari specifically.'}
				</p>
				{!install.isIOSSafariBrowser && (
					<div style={{ marginTop: 8 }}>
						<OpenInSafariActions size="compact" />
					</div>
				)}
				<button type="button" onClick={() => onIOSInstallNudge?.()} style={helperLinkStyle}>
					Show me how →
				</button>
			</Frame>
		);
	}

	// iOS, INSTALLED via a non-Safari iOS browser — push won't work.
	if (install.isIOS && install.isStandalone && !install.isIOSSafariBrowser) {
		return (
			<Frame icon={<BellIcon color={C.warning} />} tone="warning">
				<p style={titleStyle}>Reinstall from Safari to enable notifications</p>
				<p style={bodyStyle}>
					This copy of Mirror was installed from another browser. iPhone push notifications only work for installs from Safari.
				</p>
				<div style={{ marginTop: 8 }}>
					<OpenInSafariActions size="compact" />
				</div>
			</Frame>
		);
	}

	if (push.permission === 'denied') {
		return (
			<Frame icon={<BellSlashIcon color={C.danger} />} tone="danger">
				<p style={titleStyle}>Notifications blocked</p>
				<p style={bodyStyle}>
					You blocked notifications for Mirror. Enable them in your browser site settings, then reload the page.
				</p>
			</Frame>
		);
	}

	const enabled = push.permission === 'granted' && !!push.subscription;

	const handleEnable = async () => {
		await push.enable();
	};

	const handleDisable = async () => {
		if (!confirmingDisable) {
			setConfirmingDisable(true);
			return;
		}
		await push.disable();
	};

	return (
		<Frame icon={enabled ? <BellOnIcon color={C.accent} /> : <BellIcon color={C.muted} />} tone={enabled ? 'accent' : 'muted'}>
			<p style={titleStyle}>{enabled ? 'Notifications enabled' : 'Push notifications'}</p>
			<p style={bodyStyle}>
				{enabled
					? push.activeDevices !== null
						? `Active on ${push.activeDevices} ${push.activeDevices === 1 ? 'device' : 'devices'}.`
						: 'Active on this device.'
					: 'Get notified about reviews, replies, and group activity even when Mirror is closed.'}
			</p>

			<div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
				{enabled ? (
					<>
						<button
							type="button"
							onClick={handleDisable}
							disabled={push.busy}
							style={{
								...(confirmingDisable ? dangerButtonStyle : secondaryButtonStyle),
								opacity: push.busy ? 0.5 : 1,
								cursor: push.busy ? 'not-allowed' : 'pointer',
							}}
						>
							{push.busy
								? 'Disabling…'
								: confirmingDisable
									? 'Tap again to confirm'
									: 'Disable on this device'}
						</button>
						{confirmingDisable && !push.busy && (
							<button
								type="button"
								onClick={() => setConfirmingDisable(false)}
								style={{ ...secondaryButtonStyle, background: 'transparent', border: 'none', color: C.muted }}
							>
								Cancel
							</button>
						)}
					</>
				) : (
					<button
						type="button"
						onClick={handleEnable}
						disabled={push.busy}
						style={{
							...primaryButtonStyle,
							opacity: push.busy ? 0.5 : 1,
							cursor: push.busy ? 'not-allowed' : 'pointer',
						}}
					>
						{push.busy ? 'Enabling…' : 'Enable notifications'}
					</button>
				)}
			</div>

			{push.error && (
				<p
					style={{
						...bodyStyle,
						marginTop: 8,
						color:
							push.error.code === 'rate-limited' || push.error.code === 'device-limit'
								? C.warning
								: C.danger,
					}}
					role="alert"
				>
					{push.error.message}
				</p>
			)}
		</Frame>
	);
};

// ============================================================================
// FRAME — shared layout: bordered card, icon + content row
// ============================================================================

interface FrameProps {
	icon: React.ReactNode;
	tone: 'accent' | 'warning' | 'danger' | 'muted';
	children: React.ReactNode;
}

const Frame: React.FC<FrameProps> = ({ icon, children }) => (
	<div style={containerStyle}>
		<div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
			<div
				style={{
					flexShrink: 0,
					width: 24,
					height: 24,
					borderRadius: 999,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					marginTop: 1,
				}}
				aria-hidden="true"
			>
				{icon}
			</div>
			<div style={{ flex: 1, minWidth: 0 }}>{children}</div>
		</div>
	</div>
);

// ============================================================================
// ICONS — explicit width/height so ambient CSS can't balloon them
// ============================================================================

interface IconProps {
	color: string;
}

const BellIcon: React.FC<IconProps> = ({ color }) => (
	<svg
		width={18}
		height={18}
		viewBox="0 0 24 24"
		fill="none"
		stroke={color}
		strokeWidth={1.8}
		strokeLinecap="round"
		strokeLinejoin="round"
		style={{ width: 18, height: 18, flexShrink: 0 }}
		aria-hidden="true"
	>
		<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
		<path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
	</svg>
);

const BellOnIcon: React.FC<IconProps> = ({ color }) => (
	<svg
		width={18}
		height={18}
		viewBox="0 0 24 24"
		fill={color}
		style={{ width: 18, height: 18, flexShrink: 0 }}
		aria-hidden="true"
	>
		<path d="M12 2a6 6 0 0 0-6 6c0 7-3 9-3 9h18s-3-2-3-9a6 6 0 0 0-6-6zm0 20a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2z" />
	</svg>
);

const BellSlashIcon: React.FC<IconProps> = ({ color }) => (
	<svg
		width={18}
		height={18}
		viewBox="0 0 24 24"
		fill="none"
		stroke={color}
		strokeWidth={1.8}
		strokeLinecap="round"
		strokeLinejoin="round"
		style={{ width: 18, height: 18, flexShrink: 0 }}
		aria-hidden="true"
	>
		<path d="M13.73 21a2 2 0 0 1-3.46 0" />
		<path d="M18.63 13A17.89 17.89 0 0 1 18 8" />
		<path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
		<path d="M18 8a6 6 0 0 0-9.33-5" />
		<line x1={1} y1={1} x2={23} y2={23} />
	</svg>
);

export default PushSettings;