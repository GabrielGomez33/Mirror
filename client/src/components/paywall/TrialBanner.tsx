// ============================================================================
// TRIAL BANNER COMPONENT
// ============================================================================
// File: components/paywall/TrialBanner.tsx
// Top banner showing trial countdown with urgency-driven color.
// Dismissible per session; re-asserts at 2 days remaining regardless
// of dismissal.
//
// Phase 6a.9 — restyled to match the install banners / PushSettings
// glass-card-enhanced aesthetic. Light frosted glass container with
// dark plum text. Urgency colors preserved (red / amber / sakura) but
// applied to the accent + button gradient instead of the entire
// background, which previously used dark-mode text on dark gradients
// and clashed with Mirror's light sakura page.
// ============================================================================

import React, { useState, useCallback } from 'react';
import { useSubscription } from '../../context/SubscriptionContext';

const C = {
	heading: 'var(--dash-heading, #3d1428)',
	subtle: 'var(--dash-subtle, #6b4050)',
	muted: 'var(--dash-muted, #8a6070)',
};

const TrialBanner: React.FC = () => {
	const { status, trialDaysLeft, openUpgradeModal } = useSubscription();
	const [dismissed, setDismissed] = useState(false);

	const handleDismiss = useCallback(() => {
		setDismissed(true);
		sessionStorage.setItem('mirror_trial_banner_dismissed', 'true');
	}, []);

	const handleUpgrade = useCallback(() => {
		openUpgradeModal('trial_banner');
	}, [openUpgradeModal]);

	// Only show for trialing users
	if (status !== 'trialing' || trialDaysLeft === null) return null;

	// Check session dismissal
	if (dismissed || sessionStorage.getItem('mirror_trial_banner_dismissed') === 'true') {
		// Re-show at 2 days left regardless of dismissal
		if (trialDaysLeft > 2) return null;
	}

	// Urgency drives the accent + button gradient. Card stays light glass
	// for visual consistency with install / update / push UX.
	let urgencyLabel: string;
	let accentColor: string;
	let buttonGradient: string;
	let buttonShadow: string;

	if (trialDaysLeft <= 1) {
		urgencyLabel = trialDaysLeft === 0 ? 'Trial ends today!' : 'Trial ends tomorrow!';
		accentColor = '#dc2626';
		buttonGradient = 'linear-gradient(135deg, #ef4444, #dc2626)';
		buttonShadow = '0 4px 12px rgba(239, 68, 68, 0.4)';
	} else if (trialDaysLeft <= 3) {
		urgencyLabel = `${trialDaysLeft} days left in your trial`;
		accentColor = '#b45309';
		buttonGradient = 'linear-gradient(135deg, #f59e0b, #d97706)';
		buttonShadow = '0 4px 12px rgba(245, 158, 11, 0.4)';
	} else {
		urgencyLabel = `${trialDaysLeft} days left in your free trial`;
		accentColor = 'var(--dash-accent, #c6469b)';
		buttonGradient = 'var(--dash-accent-grad, linear-gradient(135deg, #f472b6, #fb7185))';
		buttonShadow = '0 4px 12px rgba(244, 114, 182, 0.3)';
	}

	return (
		<div
			style={{
				position: 'sticky',
				top: 0,
				zIndex: 50,
				width: '100%',
				padding: 'calc(8px + var(--safe-area-inset-top, 0px)) 12px 8px 12px',
				display: 'flex',
				justifyContent: 'center',
				fontFamily: "'Inter', sans-serif",
				pointerEvents: 'none',
			}}
		>
			<div
				className="glass-card-enhanced"
				style={{
					pointerEvents: 'auto',
					maxWidth: 600,
					width: '100%',
					borderRadius: 16,
					padding: '8px 14px',
					color: C.heading,
					display: 'flex',
					alignItems: 'center',
					gap: 10,
				}}
			>
				<UrgencyDot color={accentColor} />

				<span
					style={{
						flex: 1,
						minWidth: 0,
						fontSize: 13,
						fontWeight: 600,
						color: C.heading,
						lineHeight: 1.3,
					}}
				>
					{urgencyLabel}
				</span>

				<button
					type="button"
					onClick={handleUpgrade}
					style={{
						flexShrink: 0,
						padding: '6px 14px',
						fontSize: 12,
						fontWeight: 600,
						borderRadius: 999,
						background: buttonGradient,
						color: '#ffffff',
						border: 'none',
						cursor: 'pointer',
						boxShadow: buttonShadow,
						whiteSpace: 'nowrap',
					}}
				>
					Subscribe now
				</button>

				{trialDaysLeft > 2 && (
					<button
						type="button"
						onClick={handleDismiss}
						aria-label="Dismiss"
						style={{
							flexShrink: 0,
							background: 'transparent',
							border: 'none',
							color: C.muted,
							fontSize: 16,
							lineHeight: 1,
							cursor: 'pointer',
							padding: '0 4px',
							opacity: 0.6,
						}}
					>
						×
					</button>
				)}
			</div>
		</div>
	);
};

const UrgencyDot: React.FC<{ color: string }> = ({ color }) => (
	<div
		aria-hidden="true"
		style={{
			flexShrink: 0,
			width: 8,
			height: 8,
			borderRadius: 999,
			background: color,
			boxShadow: `0 0 8px ${color}, 0 0 2px ${color}`,
		}}
	/>
);

export default TrialBanner;