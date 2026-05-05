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
// One tap on the Install button calls promptInstall(), which surfaces the
// browser's native install dialog. After the dialog the captured prompt
// is consumed; if the user accepts, the browser fires `appinstalled` and
// useInstallState flips isStandalone (eventually, after relaunch) /
// nulls the prompt.
//
// UX rules:
//   - Bottom-anchored; respects iOS-style safe-area insets.
//   - Dismiss has TWO levels: temporary (just close this session) and
//     "don't show again" (persisted in localStorage). We only persist
//     when the user explicitly says no — closing the snackbar is
//     temporary so users on the fence aren't permanently lost.
//   - role="status" + aria-live so assistive tech announces the prompt.
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
				// User said no via the native dialog — respect that for the session.
				setHiddenThisSession(true);
			}
			// If accepted, the prompt is consumed and canPromptInstall flips false
			// on its own; component unmounts naturally.
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
							Add to your home screen for offline access and notifications.
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
						onClick={handleInstall}
						disabled={busy}
						className="flex-1 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold transition hover:bg-white/25 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{busy ? 'Installing…' : 'Install'}
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
	);
};

export default InstallPrompt;
