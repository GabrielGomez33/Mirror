// ============================================================================
// OpenInSafariActions
// ============================================================================
// File: components/install/OpenInSafariActions.tsx
//
// Helper buttons for the "you need to be in Safari" UX on iOS. Provides:
//   - Copy link to clipboard (one-tap, then user pastes in Safari)
//   - Web Share API entry (user picks Mail / Messages / etc., taps the
//     forwarded link, which opens in their default browser — usually
//     Safari)
//
// Both buttons gracefully no-op on platforms that lack the underlying
// API (older Safari versions, some in-app browsers). Failure is silent
// to the user — we never show a broken button.
//
// Used in:
//   - PushSettings.tsx       (iOS-need-Safari branches)
//   - IOSInstallTutorial.tsx (non-Safari iOS footer)
//   - SafariNudge.tsx        (top banner)
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';

interface OpenInSafariActionsProps {
	/** The URL the user should open in Safari. Defaults to current page. */
	url?: string;
	/** Subject line / share title. */
	shareTitle?: string;
	/** Compact = smaller buttons, used inline. Comfy = larger, used in modals. */
	size?: 'compact' | 'comfy';
}

const OpenInSafariActions: React.FC<OpenInSafariActionsProps> = ({
	url,
	shareTitle = 'Open Mirror in Safari',
	size = 'comfy',
}) => {
	const [copied, setCopied] = useState(false);
	const copiedTimerRef = useRef<number | null>(null);
	const [canShare, setCanShare] = useState(false);

	useEffect(() => {
		setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
	}, []);

	useEffect(() => {
		return () => {
			if (copiedTimerRef.current !== null) {
				window.clearTimeout(copiedTimerRef.current);
			}
		};
	}, []);

	const targetUrl = url || (typeof window !== 'undefined' ? window.location.href : '');

	const handleCopy = async () => {
		if (!targetUrl) return;
		try {
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(targetUrl);
			} else {
				// Fallback for ancient browsers — use a hidden textarea.
				const ta = document.createElement('textarea');
				ta.value = targetUrl;
				ta.setAttribute('readonly', '');
				ta.style.position = 'absolute';
				ta.style.left = '-9999px';
				document.body.appendChild(ta);
				ta.select();
				document.execCommand('copy');
				document.body.removeChild(ta);
			}
			setCopied(true);
			if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
			copiedTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard rejected (rare — some sandboxed contexts). Silent fail;
			// the Share button is still available.
		}
	};

	const handleShare = async () => {
		if (!targetUrl) return;
		if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return;
		try {
			await navigator.share({
				title: shareTitle,
				text: 'Open this in Safari to install Mirror with notifications',
				url: targetUrl,
			});
		} catch {
			// User cancelled the share sheet, or share threw. Silent.
		}
	};

	const padding = size === 'compact' ? '7px 12px' : '10px 16px';
	const fontSize = size === 'compact' ? 12 : 13;
	const gap = size === 'compact' ? 6 : 8;

	return (
		<div style={{ display: 'flex', alignItems: 'center', gap, flexWrap: 'wrap' }}>
			<button
				type="button"
				onClick={handleCopy}
				disabled={!targetUrl}
				style={{
					display: 'inline-flex',
					alignItems: 'center',
					gap: 6,
					padding,
					fontSize,
					fontWeight: 600,
					borderRadius: 999,
					background: copied
						? 'linear-gradient(135deg, #34d399, #10b981)'
						: 'linear-gradient(135deg, #f472b6, #fb7185)',
					color: '#ffffff',
					border: 'none',
					cursor: targetUrl ? 'pointer' : 'not-allowed',
					boxShadow: '0 4px 12px rgba(244, 114, 182, 0.3)',
					transition: 'background 0.2s ease, transform 0.15s ease',
					whiteSpace: 'nowrap',
				}}
				aria-label={copied ? 'Link copied' : 'Copy link to clipboard'}
			>
				{copied ? <CheckIcon /> : <LinkIcon />}
				<span>{copied ? 'Copied' : 'Copy link'}</span>
			</button>

			{canShare && (
				<button
					type="button"
					onClick={handleShare}
					style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: 6,
						padding,
						fontSize,
						fontWeight: 600,
						borderRadius: 999,
						background: 'rgba(26, 16, 36, 0.08)',
						color: 'rgba(26, 16, 36, 0.85)',
						border: '1px solid rgba(26, 16, 36, 0.12)',
						cursor: 'pointer',
						transition: 'background 0.2s ease',
						whiteSpace: 'nowrap',
					}}
					aria-label="Share link"
				>
					<ShareIcon />
					<span>Share</span>
				</button>
			)}
		</div>
	);
};

// ============================================================================
// ICONS
// ============================================================================

const LinkIcon: React.FC = () => (
	<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
		<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
	</svg>
);

const CheckIcon: React.FC = () => (
	<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<polyline points="20 6 9 17 4 12" />
	</svg>
);

const ShareIcon: React.FC = () => (
	<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<path d="M12 3v13" />
		<polyline points="7 8 12 3 17 8" />
		<path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
	</svg>
);

export default OpenInSafariActions;
