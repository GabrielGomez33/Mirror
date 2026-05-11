// src/components/UpdateBanner.tsx
//
// Shown at the bottom of the screen when a new service worker is installed
// and waiting to activate. Tapping "Reload" tells the waiting SW to skip
// waiting; pwa.ts's controllerchange handler then reloads the page so the
// user lands on the fresh shell.
//
// Phase 6a.9 — restyled to match the install banners / PushSettings light
// glass aesthetic. Sakura gradient Reload button, dark plum text on a
// frosted glass container. Replaces the original dark-navy palette which
// clashed with the sakura page background.

import React, { useEffect, useState } from 'react';
import { PWA_UPDATE_EVENT, applyPWAUpdate } from '../pwa';

const C = {
	heading: '#3d1428',
	subtle: '#6b4050',
	muted: '#8a6070',
};

const UpdateBanner: React.FC = () => {
	const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
	const [dismissed, setDismissed] = useState(false);

	useEffect(() => {
		const onUpdate = (e: WindowEventMap[typeof PWA_UPDATE_EVENT]) => {
			setRegistration(e.detail.registration);
			setDismissed(false);
		};
		window.addEventListener(PWA_UPDATE_EVENT, onUpdate);
		return () => window.removeEventListener(PWA_UPDATE_EVENT, onUpdate);
	}, []);

	if (!registration || dismissed) return null;

	const reload = () => applyPWAUpdate(registration);

	return (
		<div
			role="status"
			aria-live="polite"
			style={{
				position: 'fixed',
				bottom: '1rem',
				left: '50%',
				transform: 'translateX(-50%)',
				zIndex: 9999,
				width: 'calc(100vw - 2rem)',
				maxWidth: '440px',
				paddingBottom: 'env(safe-area-inset-bottom)',
			}}
		>
			<div
				className="glass-card-enhanced"
				style={{
					borderRadius: 20,
					padding: '12px 14px',
					color: C.heading,
					fontFamily: "'Inter', sans-serif",
					display: 'flex',
					alignItems: 'center',
					gap: 10,
				}}
			>
				<SparkleIcon />
				<div style={{ flex: 1, minWidth: 0 }}>
					<p style={{ margin: 0, fontWeight: 600, fontSize: 13, lineHeight: 1.3, color: C.heading }}>
						A new version of Mirror is ready
					</p>
					<p style={{ margin: '2px 0 0 0', fontSize: 11, color: C.subtle, lineHeight: 1.4 }}>
						Reload to pick up the latest improvements.
					</p>
				</div>
				<button
					type="button"
					onClick={reload}
					style={{
						flexShrink: 0,
						padding: '7px 14px',
						fontSize: 12,
						fontWeight: 600,
						borderRadius: 999,
						background: 'linear-gradient(135deg, #f472b6, #fb7185)',
						color: '#ffffff',
						border: 'none',
						cursor: 'pointer',
						boxShadow: '0 4px 12px rgba(244, 114, 182, 0.3)',
						whiteSpace: 'nowrap',
					}}
				>
					Reload
				</button>
				<button
					type="button"
					onClick={() => setDismissed(true)}
					aria-label="Dismiss"
					style={{
						flexShrink: 0,
						background: 'transparent',
						border: 'none',
						color: C.muted,
						fontSize: 18,
						lineHeight: 1,
						cursor: 'pointer',
						padding: '0 4px',
						opacity: 0.6,
					}}
				>
					×
				</button>
			</div>
		</div>
	);
};

// Small sparkle icon on a sakura-gradient circle — visual nod to "fresh".
const SparkleIcon: React.FC = () => (
	<div
		aria-hidden="true"
		style={{
			flexShrink: 0,
			width: 28,
			height: 28,
			borderRadius: 999,
			background: 'linear-gradient(135deg, #f472b6, #fb7185)',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			boxShadow: '0 4px 10px rgba(244, 114, 182, 0.3)',
		}}
	>
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z" />
		</svg>
	</div>
);

export default UpdateBanner;