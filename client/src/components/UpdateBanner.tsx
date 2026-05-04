// src/components/UpdateBanner.tsx
//
// Shown at the bottom of the screen when a new service worker is installed
// and waiting to activate. Tapping "Reload" tells the waiting SW to skip
// waiting; pwa.ts's controllerchange handler then reloads the page so the
// user lands on the fresh shell.
//
// Self-contained: no external toast library, no portal, just a fixed div.

import React, { useEffect, useState } from 'react';
import { PWA_UPDATE_EVENT, applyPWAUpdate } from '../pwa';

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
			className="fixed bottom-4 left-1/2 z-[9999] -translate-x-1/2 transform"
			style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
		>
			<div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-[#0d0c1f]/95 px-4 py-3 text-sm text-white shadow-2xl backdrop-blur-xl">
				<span className="font-medium">A new version of Mirror is ready.</span>
				<button
					type="button"
					onClick={reload}
					className="rounded-full bg-white/15 px-3 py-1 font-semibold transition hover:bg-white/25"
				>
					Reload
				</button>
				<button
					type="button"
					onClick={() => setDismissed(true)}
					aria-label="Dismiss"
					className="text-white/60 transition hover:text-white"
				>
					×
				</button>
			</div>
		</div>
	);
};

export default UpdateBanner;