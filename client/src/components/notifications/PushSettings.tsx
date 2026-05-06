// ============================================================================
// PushSettings — push notification opt-in panel (Phase 5)
// ============================================================================
// File: components/notifications/PushSettings.tsx
//
// Where it appears: header section of NotificationPanel, above the
// notification list. Always visible when the panel is open.
//
// What it shows (state machine):
//   - Unsupported browser → quiet "Notifications not supported" line.
//   - iOS Safari, not installed → "Install first to enable notifications"
//     CTA that opens the iOS install tutorial.
//   - Permission default + ready → "Enable notifications" button.
//   - Permission denied → "Blocked — change in browser settings" with
//     short instruction.
//   - Permission granted + subscribed → "Enabled on N devices" with a
//     Disable button.
//
// All errors render inline below the button, color-coded, with the
// specific actionable message from usePushSubscription.
// ============================================================================

import React, { useEffect, useState } from 'react';
import { usePushSubscription } from '../../hooks/usePushSubscription';
import { useInstallState } from '../../hooks/useInstallState';
import OpenInSafariActions from '../install/OpenInSafariActions';

interface PushSettingsProps {
	/** Optional: invoked when the user clicks the iOS-install CTA so the
	 *  parent (NotificationPanel) can close itself before the tutorial opens. */
	onIOSInstallNudge?: () => void;
}

const PushSettings: React.FC<PushSettingsProps> = ({ onIOSInstallNudge }) => {
	const push = usePushSubscription();
	const install = useInstallState();
	const [confirmingDisable, setConfirmingDisable] = useState(false);

	// Reset confirm state when subscription changes.
	useEffect(() => {
		if (!push.subscription) setConfirmingDisable(false);
	}, [push.subscription]);

	if (!push.supported) {
		return (
			<div className="px-5 py-3 border-b border-white/5 text-xs text-white/40">
				Push notifications aren't supported in this browser.
			</div>
		);
	}

	// Loading skeleton — keep height stable to avoid layout shift.
	if (!push.ready) {
		return (
			<div className="px-5 py-4 border-b border-white/5">
				<div className="h-4 w-32 rounded bg-white/5 animate-pulse" />
			</div>
		);
	}

	// iOS, not yet installed — on iPhone/iPad, push notifications require
	// the user installing FROM SAFARI specifically (verified against Apple
	// docs / WebKit blog as of iOS 26 / 2026). Other iOS browsers can put
	// an icon on the Home Screen, but Notification.requestPermission()
	// rejects in those installs. So the install nudge is shown to all
	// iOS users (any browser can install at all), but the Safari
	// requirement for push is called out explicitly to non-Safari users.
	if (install.isIOS && !install.isStandalone) {
		return (
			<div className="px-5 py-4 border-b border-white/5">
				<div className="flex items-start gap-3">
					<BellIcon className="h-5 w-5 text-amber-300 flex-shrink-0 mt-0.5" />
					<div className="flex-1 min-w-0">
						<p className="text-sm font-medium text-white">Install Mirror to enable notifications</p>
						<p className="text-xs text-white/60 mt-0.5 leading-snug">
							{install.isIOSSafariBrowser
								? 'iPhone notifications need Mirror on your Home Screen — install from Safari to enable.'
								: 'iPhone notifications require installing from Safari specifically. Open this page in Safari first.'}
						</p>
						{!install.isIOSSafariBrowser && (
							<div className="mt-2">
								<OpenInSafariActions size="compact" />
							</div>
						)}
						<button
							type="button"
							onClick={() => {
								onIOSInstallNudge?.();
							}}
							className="mt-2 text-xs font-semibold text-amber-300 hover:text-amber-200 transition"
						>
							Show me how →
						</button>
					</div>
				</div>
			</div>
		);
	}

	// iOS, INSTALLED, but installed via a non-Safari iOS browser
	// (Chrome/Firefox/Edge iOS each get their own isolated WebView; the
	// Home Screen icon launches in that browser's WebView, not Safari's).
	// Such installs cannot register for push as of iOS 26 — Apple still
	// gates push on Safari-installed PWAs. Without this branch, the user
	// would tap "Enable", we'd burn their permission prompt, and the
	// subscribe call would silently reject.
	if (install.isIOS && install.isStandalone && !install.isIOSSafariBrowser) {
		return (
			<div className="px-5 py-4 border-b border-white/5">
				<div className="flex items-start gap-3">
					<BellIcon className="h-5 w-5 text-amber-300 flex-shrink-0 mt-0.5" />
					<div className="flex-1 min-w-0">
						<p className="text-sm font-medium text-white">Reinstall from Safari to enable notifications</p>
						<p className="text-xs text-white/60 mt-0.5 leading-snug">
							This copy of Mirror was installed from another browser. iPhone push notifications only work for installs from Safari. Open Mirror in Safari and add it to your Home Screen from there.
						</p>
						<div className="mt-2">
							<OpenInSafariActions size="compact" />
						</div>
					</div>
				</div>
			</div>
		);
	}

	// Permission denied at the OS/browser level. We can't re-prompt; user
	// must change settings manually.
	if (push.permission === 'denied') {
		return (
			<div className="px-5 py-4 border-b border-white/5">
				<div className="flex items-start gap-3">
					<BellOffIcon className="h-5 w-5 text-rose-300 flex-shrink-0 mt-0.5" />
					<div className="flex-1 min-w-0">
						<p className="text-sm font-medium text-white">Notifications blocked</p>
						<p className="text-xs text-white/60 mt-0.5 leading-snug">
							You blocked notifications for Mirror. Enable them in your browser site settings, then reload the page.
						</p>
					</div>
				</div>
			</div>
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
		<div className="px-5 py-4 border-b border-white/5">
			<div className="flex items-start gap-3">
				{enabled ? (
					<BellOnIcon className="h-5 w-5 text-emerald-300 flex-shrink-0 mt-0.5" />
				) : (
					<BellIcon className="h-5 w-5 text-white/60 flex-shrink-0 mt-0.5" />
				)}

				<div className="flex-1 min-w-0">
					<p className="text-sm font-medium text-white">
						{enabled ? 'Notifications enabled' : 'Push notifications'}
					</p>
					<p className="text-xs text-white/60 mt-0.5 leading-snug">
						{enabled
							? push.activeDevices !== null
								? `Active on ${push.activeDevices} ${push.activeDevices === 1 ? 'device' : 'devices'}.`
								: 'Active on this device.'
							: 'Get notified about reviews, replies, and group activity even when Mirror is closed.'}
					</p>

					<div className="flex items-center gap-2 mt-2">
						{enabled ? (
							<>
								<button
									type="button"
									onClick={handleDisable}
									disabled={push.busy}
									className={`text-xs font-semibold px-3 py-1.5 rounded-full transition disabled:opacity-50 ${
										confirmingDisable
											? 'bg-rose-500/20 text-rose-200 hover:bg-rose-500/30'
											: 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
									}`}
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
										className="text-xs text-white/50 hover:text-white/80 transition"
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
								className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500/20 text-violet-200 hover:bg-violet-500/30 transition disabled:opacity-50"
							>
								{push.busy ? 'Enabling…' : 'Enable notifications'}
							</button>
						)}
					</div>

					{push.error && (
						<p
							className={`text-xs mt-2 leading-snug ${
								push.error.code === 'rate-limited'
									? 'text-amber-300'
									: push.error.code === 'device-limit'
										? 'text-amber-300'
										: 'text-rose-300'
							}`}
							role="alert"
						>
							{push.error.message}
						</p>
					)}
				</div>
			</div>
		</div>
	);
};

// ============================================================================
// ICONS
// ============================================================================

const BellIcon: React.FC<{ className?: string }> = ({ className }) => (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
		<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
		<path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
	</svg>
);

const BellOnIcon: React.FC<{ className?: string }> = ({ className }) => (
	<svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
		<path d="M12 2a6 6 0 0 0-6 6c0 7-3 9-3 9h18s-3-2-3-9a6 6 0 0 0-6-6zm0 20a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2z" />
	</svg>
);

const BellOffIcon: React.FC<{ className?: string }> = ({ className }) => (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
		<path d="M13.73 21a2 2 0 0 1-3.46 0" />
		<path d="M18.63 13A17.89 17.89 0 0 1 18 8" />
		<path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
		<path d="M18 8a6 6 0 0 0-9.33-5" />
		<line x1="1" y1="1" x2="23" y2="23" />
	</svg>
);

export default PushSettings;
