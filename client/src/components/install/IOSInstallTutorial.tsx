// ============================================================================
// IOSInstallTutorial
// ============================================================================
// File: components/install/IOSInstallTutorial.tsx
//
// Shown when:
//   - User is on iOS Safari (the only browser context where Add-to-Home-
//     Screen actually works on iOS — Chrome/Firefox/in-app browsers can't
//     install), AND
//   - App is NOT already running standalone, AND
//   - User has not dismissed-forever.
//
// What it does:
//   - A discreet bottom-anchored "Install Mirror" snackbar.
//   - Tapping it opens a modal with three illustrated steps showing the
//     iOS Share button → Add to Home Screen → Add.
//   - Modal dismisses on backdrop tap, X button, or escape key.
//
// Visual: matches Mirror's glass-card-enhanced aesthetic with sakura
// gradient accents. Layout-critical dimensions are inline-styled so
// global CSS rules can't break the proportions.
// ============================================================================

import React, { useEffect, useState } from 'react';
import { useInstallState } from '../../hooks/useInstallState';

const IOSInstallTutorial: React.FC = () => {
	const { shouldShowIOSTutorial, isIOSSafariBrowser, dismissPromptForever } = useInstallState();
	const [hiddenThisSession, setHiddenThisSession] = useState(false);
	const [modalOpen, setModalOpen] = useState(false);

	// Lock body scroll while modal is open (prevents iOS bounce-scroll behind).
	useEffect(() => {
		if (!modalOpen) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = prev;
		};
	}, [modalOpen]);

	// Esc to close modal.
	useEffect(() => {
		if (!modalOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setModalOpen(false);
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [modalOpen]);

	if (!shouldShowIOSTutorial || hiddenThisSession) return null;

	const handleNotNow = () => setHiddenThisSession(true);

	const handleDontAsk = () => {
		dismissPromptForever();
		setHiddenThisSession(true);
		setModalOpen(false);
	};

	return (
		<>
			{/* Snackbar */}
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
								Add to your Home Screen for offline access, notifications, and full-screen experience.
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
							onClick={() => setModalOpen(true)}
							style={{
								flex: 1,
								borderRadius: 999,
								padding: '9px 18px',
								fontSize: 13,
								fontWeight: 600,
								background: 'linear-gradient(135deg, #f472b6, #fb7185)',
								color: '#ffffff',
								border: 'none',
								cursor: 'pointer',
								boxShadow: '0 4px 12px rgba(244, 114, 182, 0.35)',
							}}
						>
							Show me how
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

			{/* Modal */}
			{modalOpen && (
				<div
					role="dialog"
					aria-modal="true"
					aria-label="How to install Mirror on iOS"
					style={{
						position: 'fixed',
						inset: 0,
						zIndex: 9999,
						display: 'flex',
						alignItems: 'flex-end',
						justifyContent: 'center',
						paddingTop: 'env(safe-area-inset-top)',
					}}
				>
					{/* Backdrop */}
					<div
						style={{
							position: 'absolute',
							inset: 0,
							background: 'rgba(26, 16, 36, 0.55)',
							backdropFilter: 'blur(6px)',
							WebkitBackdropFilter: 'blur(6px)',
						}}
						onClick={() => setModalOpen(false)}
						aria-hidden="true"
					/>

					{/* Card */}
					<div
						className="glass-card-enhanced"
						style={{
							position: 'relative',
							width: '100%',
							maxWidth: 440,
							margin: '0 auto',
							borderTopLeftRadius: 24,
							borderTopRightRadius: 24,
							borderBottomLeftRadius: 0,
							borderBottomRightRadius: 0,
							color: '#1a1024',
							maxHeight: '88vh',
							overflowY: 'auto',
							paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
						}}
					>
						<div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '24px 24px 4px' }}>
							<div>
								<h2 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: '#1a1024' }}>
									Install Mirror
								</h2>
								<p style={{ fontSize: 13, color: 'rgba(26, 16, 36, 0.6)', marginTop: 4, marginBottom: 0 }}>
									Three quick steps in Safari.
								</p>
							</div>
							<button
								type="button"
								onClick={() => setModalOpen(false)}
								aria-label="Close"
								style={{
									background: 'transparent',
									border: 'none',
									color: 'rgba(26, 16, 36, 0.4)',
									fontSize: 26,
									lineHeight: 1,
									cursor: 'pointer',
									padding: '0 4px',
									marginTop: -4,
								}}
							>
								×
							</button>
						</div>

						<ol style={{ listStyle: 'none', padding: '16px 24px', margin: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
							<Step
								n={1}
								title="Tap the Share button"
								body={
									<>
										Look at the bottom toolbar for the <ShareIcon style={{ display: 'inline-block', verticalAlign: 'text-bottom', width: 16, height: 16, margin: '0 2px' }} /> icon. (On iPad, it's at the top.)
									</>
								}
							/>
							<Step
								n={2}
								title='Choose "Add to Home Screen"'
								body={
									<>
										Scroll down in the share menu — it's near the bottom, with a <PlusIcon style={{ display: 'inline-block', verticalAlign: 'text-bottom', width: 16, height: 16, margin: '0 2px' }} /> icon.
									</>
								}
							/>
							<Step
								n={3}
								title='Tap "Add"'
								body={
									<>
										Confirm the name (Mirror) and tap Add. The app will appear on your Home Screen — open it from there for the full experience, including notifications.
									</>
								}
							/>
						</ol>

						<div style={{ padding: '12px 24px 0', borderTop: '1px solid rgba(26, 16, 36, 0.08)', marginTop: 8 }}>
							{isIOSSafariBrowser ? (
								<p style={{ fontSize: 12, color: 'rgba(26, 16, 36, 0.6)', lineHeight: 1.5, margin: 0 }}>
									<strong style={{ color: 'rgba(26, 16, 36, 0.85)' }}>Heads up:</strong> Push notifications on iPhone need Mirror installed to your Home Screen — they can't be enabled from the Safari tab.
								</p>
							) : (
								<p style={{ fontSize: 12, color: 'rgba(26, 16, 36, 0.6)', lineHeight: 1.5, margin: 0 }}>
									<strong style={{ color: 'rgba(26, 16, 36, 0.85)' }}>Heads up:</strong> If notifications don't work after install, try installing from <strong>Safari</strong> instead — it's the most consistent path on iPhone.
								</p>
							)}
							<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
								<button
									type="button"
									onClick={() => setModalOpen(false)}
									style={{
										flex: 1,
										borderRadius: 999,
										padding: '11px 20px',
										fontSize: 13,
										fontWeight: 600,
										background: 'linear-gradient(135deg, #f472b6, #fb7185)',
										color: '#ffffff',
										border: 'none',
										cursor: 'pointer',
										boxShadow: '0 4px 12px rgba(244, 114, 182, 0.35)',
									}}
								>
									Got it
								</button>
								<button
									type="button"
									onClick={handleDontAsk}
									style={{
										borderRadius: 999,
										padding: '10px 14px',
										fontSize: 11,
										color: 'rgba(26, 16, 36, 0.5)',
										background: 'transparent',
										border: 'none',
										cursor: 'pointer',
									}}
								>
									Don't show again
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</>
	);
};

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

interface StepProps {
	n: number;
	title: string;
	body: React.ReactNode;
}

const Step: React.FC<StepProps> = ({ n, title, body }) => (
	<li style={{ display: 'flex', gap: 12 }}>
		<div
			aria-hidden="true"
			style={{
				flexShrink: 0,
				width: 28,
				height: 28,
				borderRadius: 999,
				background: 'linear-gradient(135deg, #f472b6, #fb7185)',
				color: '#ffffff',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				fontSize: 12,
				fontWeight: 600,
				boxShadow: '0 2px 8px rgba(244, 114, 182, 0.35)',
			}}
		>
			{n}
		</div>
		<div style={{ flex: 1, paddingTop: 2 }}>
			<p style={{ fontWeight: 600, fontSize: 14, margin: 0, color: '#1a1024' }}>{title}</p>
			<p style={{ fontSize: 13, color: 'rgba(26, 16, 36, 0.65)', lineHeight: 1.45, margin: '2px 0 0 0' }}>{body}</p>
		</div>
	</li>
);

// iOS Share icon — square with up arrow.
const ShareIcon: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
		<path d="M12 3v13" />
		<polyline points="7 8 12 3 17 8" />
		<path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
	</svg>
);

// Plus-in-square icon (used for Add to Home Screen).
const PlusIcon: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
		<rect x="4" y="4" width="16" height="16" rx="3" />
		<path d="M12 8v8M8 12h8" />
	</svg>
);

export default IOSInstallTutorial;
