// ============================================================================
// NotificationPreferencesPanel — per-event-type push toggles (Phase 6b)
// ============================================================================
// File: components/notifications/NotificationPreferencesPanel.tsx
//
// Renders a collapsible list of toggles, one per server-defined category
// (group chat, mentions, replies, reactions, group invites, etc.). Each
// toggle is for the global mute of that category; per-group mutes live
// in the group settings UI and are not exposed here (we keep this panel
// focused on broad-strokes control).
//
// UX behavior:
//   - Section is collapsed by default; toggles fetch lazily on first
//     expand so the closed state has zero network cost.
//   - Toggles are optimistic — flip the UI immediately, fire PUT in
//     background. On failure, revert and show an inline error.
//   - Per-toggle "saving" dot prevents double-taps from racing.
//   - Single in-flight PUT at a time per (category, scope) — chained.
//
// This panel ONLY makes sense when push is subscribed; the parent
// (PushSettings) decides whether to mount it.
// ============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	getNotificationPreferences,
	updateNotificationPreferences,
	NotificationPrefsError,
	NotificationPrefsAuthError,
	NotificationPrefsRateLimitError,
	type NotificationCategory,
} from '../../services/notificationPreferencesApi';

// Match PushSettings' palette so the two cards read as one panel.
const C = {
	heading: 'var(--dash-heading, #3d1428)',
	body: 'var(--dash-body, #2e1018)',
	subtle: 'var(--dash-subtle, #6b4050)',
	muted: 'var(--dash-muted, #8a6070)',
	accent: 'var(--dash-accent, #c6469b)',
	accentSoft: 'rgba(var(--dash-glow), 0.12)',
	warning: 'var(--mirror-amber, #b8770e)',
	danger: 'var(--mirror-error, #a8324c)',
	success: 'var(--mirror-success, #1e7a52)',
};

const GLOBAL_SCOPE = 'global';

// ============================================================================
// STYLES
// ============================================================================

const containerStyle: React.CSSProperties = {
	background: 'rgba(var(--dash-surface), 0.5)',
	border: '1px solid rgba(var(--dash-surface), 0.55)',
	borderRadius: 12,
	padding: '10px 12px',
	backdropFilter: 'blur(12px)',
	WebkitBackdropFilter: 'blur(12px)',
	fontFamily: "'Inter', sans-serif",
};

const headerButtonStyle: React.CSSProperties = {
	width: '100%',
	display: 'flex',
	alignItems: 'center',
	gap: 10,
	background: 'transparent',
	border: 'none',
	padding: 0,
	cursor: 'pointer',
	textAlign: 'left',
};

const titleStyle: React.CSSProperties = {
	fontSize: '0.78rem',
	fontWeight: 600,
	color: C.heading,
	margin: 0,
	lineHeight: 1.3,
	flex: 1,
	minWidth: 0,
};

const subtitleStyle: React.CSSProperties = {
	fontSize: '0.7rem',
	color: C.subtle,
	lineHeight: 1.4,
	margin: '2px 0 0 0',
};

const rowStyle: React.CSSProperties = {
	display: 'flex',
	alignItems: 'flex-start',
	gap: 10,
	padding: '8px 0',
	borderTop: '1px solid rgba(var(--dash-ink), 0.08)',
};

const rowLabelStyle: React.CSSProperties = {
	fontSize: '0.72rem',
	fontWeight: 600,
	color: C.heading,
	margin: 0,
	lineHeight: 1.3,
};

const rowDescStyle: React.CSSProperties = {
	fontSize: '0.66rem',
	color: C.subtle,
	lineHeight: 1.4,
	margin: '2px 0 0 0',
};

const chevronStyle: React.CSSProperties = {
	flexShrink: 0,
	transition: 'transform 0.2s ease',
	color: C.muted,
};

// ============================================================================
// COMPONENT
// ============================================================================

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

interface PanelState {
	categories: NotificationCategory[];
	mutedGlobal: Set<string>; // category keys muted at global scope
}

const NotificationPreferencesPanel: React.FC = () => {
	const [expanded, setExpanded] = useState(false);
	const [loadState, setLoadState] = useState<LoadState>('idle');
	const [data, setData] = useState<PanelState | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);

	// Per-row saving + error state. Keyed by category.
	const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
	const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

	// Track an in-flight controller per category so rapid-fire toggles
	// abort the previous request rather than racing it.
	const inFlightRef = useRef<Map<string, AbortController>>(new Map());
	const mountedRef = useRef(true);

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			// Cancel any pending requests on unmount.
			for (const c of inFlightRef.current.values()) c.abort();
			inFlightRef.current.clear();
		};
	}, []);

	const load = useCallback(async () => {
		setLoadState('loading');
		setLoadError(null);
		const controller = new AbortController();
		try {
			const result = await getNotificationPreferences(controller.signal);
			if (!mountedRef.current) return;
			const mutedGlobal = new Set<string>();
			for (const m of result.muted) {
				if (m.scope === GLOBAL_SCOPE) mutedGlobal.add(m.category);
			}
			setData({ categories: result.categories, mutedGlobal });
			setLoadState('ready');
		} catch (err) {
			if (!mountedRef.current) return;
			if (controller.signal.aborted) return;
			setLoadError(messageFor(err));
			setLoadState('error');
		}
	}, []);

	const handleExpandClick = useCallback(() => {
		const next = !expanded;
		setExpanded(next);
		if (next && loadState === 'idle') {
			void load();
		}
	}, [expanded, loadState, load]);

	const handleToggle = useCallback(
		async (category: NotificationCategory) => {
			if (!data) return;
			const key = category.key;
			if (savingKeys.has(key)) return; // already saving — ignore re-tap

			const wasMuted = data.mutedGlobal.has(key);
			const nextMuted = !wasMuted;

			// Optimistic flip
			const nextSet = new Set(data.mutedGlobal);
			if (nextMuted) nextSet.add(key);
			else nextSet.delete(key);
			setData({ ...data, mutedGlobal: nextSet });

			setSavingKeys((prev) => {
				const s = new Set(prev);
				s.add(key);
				return s;
			});
			setRowErrors((prev) => {
				if (!(key in prev)) return prev;
				const next = { ...prev };
				delete next[key];
				return next;
			});

			// Abort any prior in-flight for this category before issuing new one.
			const existing = inFlightRef.current.get(key);
			if (existing) existing.abort();
			const controller = new AbortController();
			inFlightRef.current.set(key, controller);

			try {
				const muted = await updateNotificationPreferences(
					[{ category: key, scope: GLOBAL_SCOPE, muted: nextMuted }],
					controller.signal,
				);
				if (!mountedRef.current) return;
				// Reconcile with server response (defensive — also reflects any
				// other changes that happened on another device).
				const reconciled = new Set<string>();
				for (const m of muted) {
					if (m.scope === GLOBAL_SCOPE) reconciled.add(m.category);
				}
				setData((prev) => (prev ? { ...prev, mutedGlobal: reconciled } : prev));
			} catch (err) {
				if (!mountedRef.current) return;
				if (controller.signal.aborted) return;
				// Revert optimistic update.
				setData((prev) => {
					if (!prev) return prev;
					const revertedSet = new Set(prev.mutedGlobal);
					if (wasMuted) revertedSet.add(key);
					else revertedSet.delete(key);
					return { ...prev, mutedGlobal: revertedSet };
				});
				setRowErrors((prev) => ({ ...prev, [key]: messageFor(err) }));
			} finally {
				if (mountedRef.current) {
					setSavingKeys((prev) => {
						if (!prev.has(key)) return prev;
						const s = new Set(prev);
						s.delete(key);
						return s;
					});
				}
				if (inFlightRef.current.get(key) === controller) {
					inFlightRef.current.delete(key);
				}
			}
		},
		[data, savingKeys],
	);

	const summary = useMemo(() => {
		if (loadState !== 'ready' || !data) return null;
		const total = data.categories.length;
		const muted = data.mutedGlobal.size;
		if (muted === 0) return `All ${total} categories on`;
		return `${total - muted} of ${total} categories on`;
	}, [data, loadState]);

	return (
		<div style={containerStyle}>
			<button
				type="button"
				onClick={handleExpandClick}
				style={headerButtonStyle}
				aria-expanded={expanded}
				aria-controls="notification-prefs-list"
			>
				<div style={{ flex: 1, minWidth: 0 }}>
					<p style={titleStyle}>Customize what triggers a push</p>
					<p style={subtitleStyle}>
						{summary ?? 'Pick categories that wake your phone vs. only show in-app.'}
					</p>
				</div>
				<svg
					width={16}
					height={16}
					viewBox="0 0 24 24"
					fill="none"
					stroke={C.muted}
					strokeWidth={2}
					strokeLinecap="round"
					strokeLinejoin="round"
					style={{ ...chevronStyle, transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
					aria-hidden="true"
				>
					<polyline points="6 9 12 15 18 9" />
				</svg>
			</button>

			{expanded && (
				<div id="notification-prefs-list" style={{ marginTop: 8 }}>
					{loadState === 'loading' && (
						<p style={{ ...subtitleStyle, marginTop: 6 }}>Loading…</p>
					)}

					{loadState === 'error' && (
						<div style={{ marginTop: 6 }}>
							<p style={{ ...subtitleStyle, color: C.danger, margin: 0 }} role="alert">
								{loadError || 'Failed to load preferences.'}
							</p>
							<button
								type="button"
								onClick={() => void load()}
								style={{
									fontSize: '0.7rem',
									fontWeight: 600,
									color: C.accent,
									background: 'transparent',
									border: 'none',
									cursor: 'pointer',
									padding: '4px 0 0 0',
								}}
							>
								Try again →
							</button>
						</div>
					)}

					{loadState === 'ready' && data && (
						<div role="group" aria-label="Notification categories">
							{data.categories.map((cat) => {
								const muted = data.mutedGlobal.has(cat.key);
								const saving = savingKeys.has(cat.key);
								const err = rowErrors[cat.key];
								return (
									<div key={cat.key} style={rowStyle}>
										<div style={{ flex: 1, minWidth: 0 }}>
											<p style={rowLabelStyle}>{cat.label}</p>
											<p style={rowDescStyle}>{cat.description}</p>
											{err && (
												<p
													style={{ ...rowDescStyle, color: C.danger, marginTop: 4 }}
													role="alert"
												>
													{err}
												</p>
											)}
										</div>
										<ToggleSwitch
											on={!muted}
											saving={saving}
											ariaLabel={`${cat.label} push notifications`}
											onClick={() => void handleToggle(cat)}
										/>
									</div>
								);
							})}
						</div>
					)}
				</div>
			)}
		</div>
	);
};

// ============================================================================
// TOGGLE SWITCH — accessible, keyboard-operable, defensive inline styles
// ============================================================================

interface ToggleSwitchProps {
	on: boolean;
	saving: boolean;
	ariaLabel: string;
	onClick: () => void;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ on, saving, ariaLabel, onClick }) => {
	const trackBg = on
		? 'linear-gradient(135deg, #f472b6, #fb7185)'
		: 'rgba(var(--dash-ink), 0.18)';
	return (
		<button
			type="button"
			role="switch"
			aria-checked={on}
			aria-label={ariaLabel}
			aria-busy={saving}
			onClick={onClick}
			disabled={saving}
			style={{
				flexShrink: 0,
				width: 40,
				height: 22,
				borderRadius: 999,
				border: 'none',
				background: trackBg,
				position: 'relative',
				cursor: saving ? 'wait' : 'pointer',
				transition: 'background 0.2s ease',
				padding: 0,
				marginTop: 1,
				opacity: saving ? 0.7 : 1,
				boxShadow: on ? '0 2px 6px rgba(244, 114, 182, 0.3)' : 'none',
			}}
		>
			<span
				aria-hidden="true"
				style={{
					position: 'absolute',
					top: 2,
					left: on ? 20 : 2,
					width: 18,
					height: 18,
					borderRadius: 999,
					background: '#ffffff',
					boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
					transition: 'left 0.2s ease',
				}}
			/>
		</button>
	);
};

// ============================================================================
// HELPERS
// ============================================================================

function messageFor(err: unknown): string {
	if (err instanceof NotificationPrefsAuthError) return 'Please sign in again to manage notifications.';
	if (err instanceof NotificationPrefsRateLimitError) return 'Too many changes too quickly. Try again in a moment.';
	if (err instanceof NotificationPrefsError) return err.message;
	if (err instanceof Error) return err.message;
	return 'Something went wrong. Try again.';
}

export default NotificationPreferencesPanel;