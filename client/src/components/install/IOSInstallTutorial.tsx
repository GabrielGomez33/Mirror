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
// Why this specifically (not a generic install prompt):
//   - iOS push REQUIRES standalone install. Without this UI, iOS users
//     have no way to discover that "enable notifications" demands the
//     install step first.
//   - Apple's Share button is invisible to most users until pointed out.
//     The arrow + screenshot is high-leverage UX.
// ============================================================================

import React, { useEffect, useState } from 'react';
import { useInstallState } from '../../hooks/useInstallState';

const IOSInstallTutorial: React.FC = () => {
	const { shouldShowIOSTutorial, dismissPromptForever } = useInstallState();
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
				className="fixed bottom-4 left-1/2 z-[9990] -translate-x-1/2 transform w-[calc(100vw-2rem)] max-w-md"
				style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
			>
				<div
					className="rounded-2xl border border-white/15 bg-[#0d0c1f]/95 px-4 py-3 text-white shadow-2xl backdrop-blur-xl"
					style={{ backdropFilter: 'blur(20px)' }}
				>
					<div className="flex items-start gap-3">
						<img
							src="/Mirror/pwa-192x192.png"
							alt=""
							aria-hidden="true"
							className="h-10 w-10 flex-shrink-0 rounded-lg"
						/>
						<div className="flex-1 min-w-0">
							<p className="font-semibold text-sm">Install Mirror</p>
							<p className="text-xs text-white/70 mt-0.5 leading-snug">
								Add to your Home Screen for offline access, notifications, and full-screen experience.
							</p>
						</div>
						<button
							type="button"
							onClick={handleNotNow}
							aria-label="Dismiss"
							className="text-white/40 transition hover:text-white -mt-1 -mr-1"
						>
							×
						</button>
					</div>
					<div className="flex items-center gap-2 mt-3">
						<button
							type="button"
							onClick={() => setModalOpen(true)}
							className="flex-1 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold transition hover:bg-white/25"
						>
							Show me how
						</button>
						<button
							type="button"
							onClick={handleDontAsk}
							className="rounded-full px-3 py-2 text-xs text-white/50 transition hover:text-white/80"
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
					className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
					style={{ paddingTop: 'env(safe-area-inset-top)' }}
				>
					{/* Backdrop */}
					<div
						className="absolute inset-0 bg-black/60"
						style={{ backdropFilter: 'blur(4px)' }}
						onClick={() => setModalOpen(false)}
						aria-hidden="true"
					/>

					{/* Card */}
					<div
						className="relative w-full sm:max-w-md mx-0 sm:mx-4 rounded-t-3xl sm:rounded-3xl bg-[#0d0c1f] text-white shadow-2xl border border-white/10"
						style={{
							paddingBottom: 'env(safe-area-inset-bottom, 1rem)',
							maxHeight: '85vh',
							overflowY: 'auto',
						}}
					>
						<div className="px-6 pt-6 pb-2 flex items-start justify-between">
							<div>
								<h2 className="text-xl font-semibold">Install Mirror</h2>
								<p className="text-sm text-white/60 mt-1">Three quick steps in Safari.</p>
							</div>
							<button
								type="button"
								onClick={() => setModalOpen(false)}
								aria-label="Close"
								className="text-white/40 hover:text-white text-2xl leading-none -mt-1"
							>
								×
							</button>
						</div>

						<ol className="px-6 py-4 space-y-5 text-sm">
							<Step
								n={1}
								title="Tap the Share button"
								body={
									<>
										Look at the bottom toolbar for the <ShareIcon className="inline h-4 w-4 mx-0.5 align-text-bottom" /> icon. (On iPad, it's at the top.)
									</>
								}
							/>
							<Step
								n={2}
								title='Choose "Add to Home Screen"'
								body={
									<>
										Scroll down in the share menu — it's near the bottom, with a <PlusIcon className="inline h-4 w-4 mx-0.5 align-text-bottom" /> icon.
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

						<div className="px-6 pt-2 pb-5 border-t border-white/5 mt-2">
							<p className="text-xs text-white/50 leading-relaxed">
								<strong className="text-white/70">Important:</strong> Notifications on iPhone only work after installing. They cannot be enabled while browsing in Safari.
							</p>
							<div className="flex items-center gap-2 mt-4">
								<button
									type="button"
									onClick={() => setModalOpen(false)}
									className="flex-1 rounded-full bg-white/15 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/25"
								>
									Got it
								</button>
								<button
									type="button"
									onClick={handleDontAsk}
									className="rounded-full px-3 py-2.5 text-xs text-white/50 transition hover:text-white/80"
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
	<li className="flex gap-3">
		<div
			className="flex-shrink-0 h-7 w-7 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-xs font-semibold"
			aria-hidden="true"
		>
			{n}
		</div>
		<div className="flex-1 pt-0.5">
			<p className="font-medium">{title}</p>
			<p className="text-white/60 leading-snug mt-0.5">{body}</p>
		</div>
	</li>
);

// iOS Share icon — square with up arrow.
const ShareIcon: React.FC<{ className?: string }> = ({ className }) => (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
		<path d="M12 3v13" />
		<polyline points="7 8 12 3 17 8" />
		<path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
	</svg>
);

// Plus-in-square icon (used for Add to Home Screen).
const PlusIcon: React.FC<{ className?: string }> = ({ className }) => (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
		<rect x="4" y="4" width="16" height="16" rx="3" />
		<path d="M12 8v8M8 12h8" />
	</svg>
);

export default IOSInstallTutorial;
