// ============================================================================
// useInstallState (Phase 5)
// ============================================================================
// File: hooks/useInstallState.ts
// Description: Single source of truth for "can the user install Mirror?",
//              "are they running it installed?", and "what platform are
//              they on?" — for the install-prompt UI and the push opt-in
//              flow (iOS push REQUIRES standalone install).
//
// What it exposes:
//   {
//     isStandalone        true if launched from home screen / installed PWA
//     isInstallable       true if browser captured beforeinstallprompt
//     isIOS               true on iOS / iPadOS Safari (any version)
//     isIOSSafariBrowser  true ONLY in Safari-the-browser (not standalone)
//     canPromptInstall    Android one-tap is available
//     promptInstall()     fires the captured beforeinstallprompt
//     dismissPromptForever()
//     wasDismissed        user previously closed the install banner
//   }
//
// SAFETY
//   - All listeners are cleaned up on unmount.
//   - beforeinstallprompt handler is registered ONCE at module level (not
//     per-mount) because the event only fires once per page load and we
//     don't want to miss it racing against React mount.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';

// ============================================================================
// MODULE-LEVEL CAPTURE
// ============================================================================
// beforeinstallprompt fires before any React component mounts. Capture it
// at module init so it isn't lost.

interface BeforeInstallPromptEvent extends Event {
	readonly platforms: string[];
	prompt(): Promise<void>;
	readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let capturedPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();

function notifyPromptListeners(): void {
	for (const fn of promptListeners) {
		try {
			fn();
		} catch {
			/* never let a single listener break others */
		}
	}
}

if (typeof window !== 'undefined') {
	window.addEventListener('beforeinstallprompt', (e) => {
		// Prevent Chrome's default mini-infobar; we'll surface our own UI.
		e.preventDefault();
		capturedPrompt = e as BeforeInstallPromptEvent;
		notifyPromptListeners();
	});

	window.addEventListener('appinstalled', () => {
		// After successful install the captured prompt is no longer usable.
		capturedPrompt = null;
		notifyPromptListeners();
	});
}

// ============================================================================
// PLATFORM DETECTION
// ============================================================================

function detectIsIOS(): boolean {
	if (typeof navigator === 'undefined') return false;
	const ua = navigator.userAgent || '';
	// iPadOS 13+ reports as Mac. Disambiguate by touch.
	const isiPadOS =
		/Macintosh/.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1;
	return /iPhone|iPad|iPod/.test(ua) || isiPadOS;
}

function detectIsIOSSafariBrowser(isIOS: boolean): boolean {
	if (!isIOS) return false;
	if (typeof navigator === 'undefined') return false;
	const ua = navigator.userAgent || '';
	// Strict Safari detection (used to gate features that only work in
	// "true" Safari on iOS — namely standalone-mode push notifications).
	// Excludes wrapper browsers that embed WebKit but use a different UA tag:
	//   CriOS  = Chrome iOS
	//   FxiOS  = Firefox iOS
	//   EdgiOS = Edge iOS
	//   OPiOS  = Opera Mini iOS (legacy)
	//   OPT/   = Opera Touch / modern Opera iOS (no OPiOS tag)
	//   GSA/   = Google Search App embedded webview
	const isWebKit =
		/Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\//.test(ua);
	return isWebKit && !detectIsIOSInAppBrowser();
}

/**
 * In-app browsers (Instagram, Facebook, Line, Twitter, TikTok, etc.) embed
 * WebKit but disable / hide the share sheet's "Add to Home Screen" entry.
 * No install path = no install tutorial.
 */
function detectIsIOSInAppBrowser(): boolean {
	if (typeof navigator === 'undefined') return false;
	const ua = navigator.userAgent || '';
	return /FBAN|FBAV|Instagram|Line\/|Twitter|TikTok|Snapchat|MicroMessenger|WeChat/.test(ua);
}

/**
 * Any iOS browser that exposes "Add to Home Screen" via its share sheet.
 * Includes Safari, Chrome iOS, Firefox iOS, Edge iOS, Opera iOS, etc. —
 * every iOS browser uses Apple's WebKit and exposes the same install path
 * (with the caveat that only Safari-installed icons launch as full PWAs
 * pre-iOS-17.4; Chrome/Firefox installs are bookmarks). Excludes in-app
 * browsers where the share sheet hides the install entry entirely.
 */
function detectIsIOSInstallable(isIOS: boolean): boolean {
	if (!isIOS) return false;
	return !detectIsIOSInAppBrowser();
}

function detectIsStandalone(): boolean {
	if (typeof window === 'undefined') return false;
	// Modern: matchMedia. iOS legacy: navigator.standalone.
	if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
	if ((navigator as Navigator & { standalone?: boolean }).standalone) return true;
	return false;
}

// ============================================================================
// DISMISS-FOREVER PERSISTENCE
// ============================================================================
// Stored under a versioned key so future UX changes can reset dismissal.

const DISMISS_KEY = 'mirror.installBanner.dismissedV1';

function readDismissed(): boolean {
	try {
		return localStorage.getItem(DISMISS_KEY) === '1';
	} catch {
		return false;
	}
}

function writeDismissed(): void {
	try {
		localStorage.setItem(DISMISS_KEY, '1');
	} catch {
		// Private browsing or storage full — accept loss. Banner will
		// reappear next visit; not catastrophic.
	}
}

// ============================================================================
// HOOK
// ============================================================================

export interface InstallState {
	/** Launched standalone (home-screen icon) — full PWA experience. */
	isStandalone: boolean;
	/** Browser indicated install is supported (Android / desktop Chrome/Edge). */
	isInstallable: boolean;
	/** iOS / iPadOS device, any browser. */
	isIOS: boolean;
	/** iOS device AND Safari specifically — where Add-to-Home-Screen produces a full PWA (push, standalone). */
	isIOSSafariBrowser: boolean;
	/** iOS device AND any non-in-app browser — where Add-to-Home-Screen at least works as an icon. */
	isIOSInstallable: boolean;
	/** Convenience: should we show the Android one-tap install button? */
	canPromptInstall: boolean;
	/** Convenience: should we show the iOS-specific tutorial? */
	shouldShowIOSTutorial: boolean;
	/** User dismissed the install nag previously. */
	wasDismissed: boolean;
	/** Fires the captured beforeinstallprompt. Resolves with the user's choice. */
	promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
	/** Persist "don't show me the install banner again". */
	dismissPromptForever: () => void;
}

export function useInstallState(): InstallState {
	const [isStandalone, setIsStandalone] = useState<boolean>(detectIsStandalone);
	const [hasPrompt, setHasPrompt] = useState<boolean>(() => capturedPrompt !== null);
	const [wasDismissed, setWasDismissed] = useState<boolean>(readDismissed);
	const [isIOS] = useState<boolean>(detectIsIOS);
	const [isIOSSafariBrowser] = useState<boolean>(() => detectIsIOSSafariBrowser(detectIsIOS()));
	const [isIOSInstallable] = useState<boolean>(() => detectIsIOSInstallable(detectIsIOS()));

	// Subscribe to module-level prompt lifecycle.
	useEffect(() => {
		const update = () => setHasPrompt(capturedPrompt !== null);
		promptListeners.add(update);
		return () => {
			promptListeners.delete(update);
		};
	}, []);

	// Watch for display-mode changes (user installs from browser UI without
	// us calling promptInstall — we still want to flip isStandalone).
	useEffect(() => {
		if (typeof window === 'undefined' || !window.matchMedia) return;
		const mql = window.matchMedia('(display-mode: standalone)');
		const update = () => setIsStandalone(detectIsStandalone());
		// Older Safari uses addListener instead of addEventListener.
		if (mql.addEventListener) {
			mql.addEventListener('change', update);
			return () => mql.removeEventListener('change', update);
		} else if (mql.addListener) {
			mql.addListener(update);
			return () => mql.removeListener(update);
		}
	}, []);

	const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
		const prompt = capturedPrompt;
		if (!prompt) return 'unavailable';
		try {
			await prompt.prompt();
			const choice = await prompt.userChoice;
			capturedPrompt = null;
			notifyPromptListeners();
			return choice.outcome;
		} catch {
			// Some browsers throw if the user navigates away mid-prompt.
			capturedPrompt = null;
			notifyPromptListeners();
			return 'dismissed';
		}
	}, []);

	const dismissPromptForever = useCallback(() => {
		writeDismissed();
		setWasDismissed(true);
	}, []);

	return {
		isStandalone,
		isInstallable: hasPrompt,
		isIOS,
		isIOSSafariBrowser,
		isIOSInstallable,
		canPromptInstall: hasPrompt && !isStandalone && !wasDismissed,
		// Show on ANY iOS browser that exposes the share-sheet install path
		// (Safari, Chrome iOS, Firefox iOS, Edge iOS, Opera iOS). Excludes
		// in-app browsers where install is impossible.
		shouldShowIOSTutorial: isIOSInstallable && !isStandalone && !wasDismissed,
		wasDismissed,
		promptInstall,
		dismissPromptForever,
	};
}
