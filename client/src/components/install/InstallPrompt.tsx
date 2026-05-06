// ============================================================================
// InstallPrompt (Android / desktop one-tap install)
// ============================================================================
// File: components/install/InstallPrompt.tsx
//
// Shown when:
//   - Browser captured `beforeinstallprompt` (Android Chrome/Edge, desktop
//     Chrome/Edge), AND
//   - App is NOT already running standalone, AND
//   - User has not dismissed-forever.
//
// Visual: uses Mirror's `glass-card-enhanced` aesthetic — light frosted
// glass, matches the rest of the app. Inline styles for layout-critical
// dimensions (icon size, padding, spacing) so global CSS rules can't
// stretch the image out of proportion.
// ============================================================================

import React, { useState } from 'react';
import { useInstallState } from '../../hooks/useInstallState';

const InstallPrompt: React.FC = () => {
	const { canPromptInstall, promptInstall, dismissPromptForever } = useInstallState();
	const [hiddenThisSession, setHiddenThisSession] = useState(false);
	const [busy, setBusy] = useState(false);

	if (!canPromptInstall || hiddenThisSession) return null;

	const handleInstall = async () => {
		setBusy(true);
		try {
			const outcome = await promptInstall();
			if (outcome === 'dismissed') {
				setHiddenThisSession(true);
			}
		} finally {
			setBusy(false);
		}
	};

	const handleNotNow = () => setHiddenThisSession(true);

	const handleDontAsk = () => {
		dismissPromptForever();
		setHiddenThisSession(true);
	};

	return (
		<div
			role="status"
			aria-live="polite"
			style={{
				position: 'fixed',
				bottom: '1rem',
				left: '50%',
				transform: 'translateX(-50%)',
				zIndex: 9990,
				width: 'calc(100vw - 2rem)',
				maxWidth: '440px',
				paddingBottom: 'env(safe-area-inset-bottom)',
			}}
		>
			<div
				className="glass-card-enhanced"
				style={{
					borderRadius: 20,
					padding: '14px 14px 12px 14px',
					color: '#1a1024',
				}}
			>
				<div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
					<img
						src="/Mirror/pwa-192x192.png"
						alt=""
						aria-hidden="true"
						width={44}
						height={44}
						style={{
							width: 44,
							height: 44,
							flexShrink: 0,
							borderRadius: 12,
							objectFit: 'cover',
							boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
						}}
					/>
					<div style={{ flex: 1, minWidth: 0 }}>
						<p style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3, margin: 0, color: '#1a1024' }}>
							Install Mirror
						</p>
						<p style={{ fontSize: 12, lineHeight: 1.4, margin: '2px 0 0 0', color: 'rgba(26, 16, 36, 0.65)' }}>
							Add to your home screen for offline access and notifications.
						</p>
					</div>
					<button
						type="button"
						onClick={handleNotNow}
						aria-label="Dismiss"
						style={{
							flexShrink: 0,
							background: 'transparent',
							border: 'none',
							color: 'rgba(26, 16, 36, 0.4)',
							fontSize: 22,
							lineHeight: 1,
							cursor: 'pointer',
							padding: '0 2px',
							marginTop: -2,
						}}
					>
						×
					</button>
				</div>

				<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
					<button
						type="button"
						onClick={handleInstall}
						disabled={busy}
						style={{
							flex: 1,
							borderRadius: 999,
							padding: '9px 18px',
							fontSize: 13,
							fontWeight: 600,
							background: busy
								? 'linear-gradient(135deg, rgba(244, 114, 182, 0.6), rgba(251, 113, 133, 0.6))'
								: 'linear-gradient(135deg, #f472b6, #fb7185)',
							color: '#ffffff',
							border: 'none',
							cursor: busy ? 'not-allowed' : 'pointer',
							boxShadow: '0 4px 12px rgba(244, 114, 182, 0.35)',
							transition: 'transform 0.15s ease, box-shadow 0.15s ease',
						}}
						onMouseEnter={(e) => {
							if (!busy) e.currentTarget.style.transform = 'translateY(-1px)';
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.transform = 'translateY(0)';
						}}
					>
						{busy ? 'Installing…' : 'Install'}
					</button>
					<button
						type="button"
						onClick={handleDontAsk}
						style={{
							borderRadius: 999,
							padding: '8px 12px',
							fontSize: 11,
							color: 'rgba(26, 16, 36, 0.5)',
							background: 'transparent',
							border: 'none',
							cursor: 'pointer',
						}}
					>
						Don't ask again
					</button>
				</div>
			</div>
		</div>
	);
};

export default InstallPrompt;
