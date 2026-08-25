// src/components/dashboard/GlobalDashboard.tsx
// System-wide dashboard with real user data, notifications, connection status,
// and subscription management. Uses MyMirror's dark-on-light color scheme.

import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { useGroups } from '../../context/GroupContext';
import { useAuth } from '../../context/AuthContext';
import { getUserInfo, clearToken } from '../../utils/token';
import { isWebSocketConnected } from '../../services/groupsWebSocket';
import SubscriptionManager from '../paywall/SubscriptionManager';
import StudentAccessCard from '../paywall/StudentAccessCard';
import ThemeToggle from '../ui/ThemeToggle';
import { useSubscription } from '../../context/SubscriptionContext';
import { getPersonalIntelligenceApi } from '../../services/mirrorDashboard';
import { deleteAccountApi, changePasswordApi, changeEmailApi } from '../../services/authApi';
import { buildStorageRetrieveUrl } from '../../utils/storageUrl';
import type { Notification } from '../../types/notifications';
// Push notification opt-in / status panel (Phase 5). Embedded inside the
// "Notifications" section below so users can enable / manage push from the
// same drawer where they read their in-app notifications.
import PushSettings from '../notifications/PushSettings';

// ============================================================================
// COLORS — matches MyMirror / TruthStream / MirrorGroups
// ============================================================================

// Colorway-aware palette. Values resolve from CSS variables (see index.css
// --dash-* tokens) so the whole drawer flips between the sakura (pink) and
// cosmic (indigo) schemes with the active theme. rgb-channel tokens are used
// via rgba(var(--token), <alpha>) so each translucency level switches too.
const C = {
  heading: 'var(--dash-heading, #3d1428)',
  body: 'var(--dash-body, #2e1018)',
  subtle: 'var(--dash-subtle, #6b4050)',
  muted: 'var(--dash-muted, #8a6070)',
  accent: 'var(--dash-accent, #c6469b)',
  cardBg: 'rgba(var(--dash-surface, 255, 255, 255), 0.35)',
  cardBorder: 'rgba(var(--dash-surface, 255, 255, 255), 0.45)',
  cardHover: 'rgba(var(--dash-surface, 255, 255, 255), 0.5)',
};

const GLASS_CARD: React.CSSProperties = {
  background: C.cardBg,
  border: `1px solid ${C.cardBorder}`,
  borderRadius: 16,
  padding: '14px 16px',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(var(--dash-surface), 0.4)',
};

// ============================================================================
// PROFILE TOGGLE — chevron-only dropdown trigger
// (Replaces the prior initials avatar; per UX iteration we render the
// dropdown via a single chevron button. WebSocket-online status is shown as
// a small dot anchored to the chevron.)
// ============================================================================

function ProfileToggle({
  username,
  showStatus,
  isOnline,
  onClick,
  isOpen,
}: {
  username: string;
  showStatus?: boolean;
  isOnline?: boolean;
  onClick?: () => void;
  isOpen?: boolean;
}) {
  const isInteractive = typeof onClick === 'function';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isInteractive}
      aria-label={isInteractive ? `Toggle profile for ${username}` : `${username}'s profile`}
      aria-expanded={isInteractive ? !!isOpen : undefined}
      title={isInteractive ? (isOpen ? 'Hide profile details' : 'Show profile details') : undefined}
      className="relative flex items-center justify-center rounded-full p-0 transition-transform"
      style={{
        width: 36,
        height: 36,
        background: isOpen
          ? 'var(--dash-accent-grad)'
          : 'rgba(var(--dash-surface), 0.85)',
        border: isOpen ? '2px solid rgba(var(--dash-surface),0.7)' : '1.5px solid rgba(var(--dash-ink), 0.18)',
        boxShadow: isOpen
          ? '0 6px 20px rgba(255, 105, 180, 0.55)'
          : '0 3px 10px rgba(0,0,0,0.15)',
        cursor: isInteractive ? 'pointer' : 'default',
        outline: 'none',
        WebkitTapHighlightColor: 'transparent',
        transform: isOpen ? 'scale(1.04)' : 'scale(1)',
        flexShrink: 0,
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        aria-hidden
        style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease' }}
      >
        <path
          d="M4 7l5 5 5-5"
          stroke={isOpen ? '#ffffff' : C.accent}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showStatus && (
        <div
          aria-label={isOnline ? 'Online' : 'Offline'}
          className="absolute rounded-full"
          style={{
            width: 10,
            height: 10,
            right: -2,
            bottom: -2,
            background: isOnline ? 'linear-gradient(135deg, #22c55e, #16a34a)' : '#9ca3af',
            boxShadow: isOnline ? '0 0 6px rgba(34, 197, 94, 0.6)' : 'none',
            border: '2px solid rgba(var(--dash-surface), 0.9)',
          }}
        />
      )}
    </button>
  );
}

// ============================================================================
// FACIAL ANALYSIS COLOR WHEELS  — matches VisualStep + MyMirrorPanel styling
// Emotion palette intentionally identical to VisualStep's EXPRESSION_META.
// ============================================================================

type ExpressionKey = 'neutral' | 'happy' | 'sad' | 'angry' | 'fearful' | 'disgusted' | 'surprised';

const EXPRESSION_META: Record<ExpressionKey, { label: string; color: string; glow: string }> = {
  neutral:   { label: 'Neutral',   color: '#94a3b8', glow: 'rgba(148,163,184,0.45)' },
  happy:     { label: 'Happy',     color: '#4ade80', glow: 'rgba(74,222,128,0.45)' },
  sad:       { label: 'Sad',       color: '#60a5fa', glow: 'rgba(96,165,250,0.45)' },
  angry:     { label: 'Angry',     color: '#f87171', glow: 'rgba(248,113,113,0.45)' },
  fearful:   { label: 'Fearful',   color: '#c084fc', glow: 'rgba(192,132,252,0.45)' },
  disgusted: { label: 'Disgusted', color: '#fb923c', glow: 'rgba(251,146,60,0.45)' },
  surprised: { label: 'Surprised', color: '#facc15', glow: 'rgba(250,204,21,0.45)' },
};

function ColorWheelRing({
  value,
  color,
  glow,
  label,
  size = 56,
  strokeWidth = 5,
}: {
  value: number;
  color: string;
  glow: string;
  label: string;
  size?: number;
  strokeWidth?: number;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: size }}>
      <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(var(--dash-ink),0.08)" strokeWidth={strokeWidth} />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ filter: pct > 4 ? `drop-shadow(0 0 5px ${glow})` : 'none', transition: 'stroke-dashoffset 0.7s ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{
            fontSize: size * 0.26,
            fontFamily: 'monospace',
            fontWeight: 700,
            color,
            textShadow: '0 1px 2px rgba(var(--dash-surface),0.5)',
          }}>
            {pct}
          </span>
        </div>
      </div>
      <span style={{
        fontSize: '0.65rem',
        fontWeight: 600,
        color: C.body,
        fontFamily: "'Inter', sans-serif",
        textAlign: 'center',
        lineHeight: 1.2,
      }}>
        {label}
      </span>
    </div>
  );
}

interface FacialAnalysis {
  available: boolean;
  expressions: Partial<Record<ExpressionKey, number>>;
  dominant: { emotion: string; confidence: number } | null;
  detectionConfidence: number;
  photoUrl: string | null;
}

function normalizeFacialAnalysis(emotional: any, userId: number | string | undefined): FacialAnalysis | null {
  if (!emotional) return null;
  if (emotional.available === false) {
    return { available: false, expressions: {}, dominant: null, detectionConfidence: 0, photoUrl: null };
  }

  const rawExpressions = emotional.expressions || {};
  const expressions: Partial<Record<ExpressionKey, number>> = {};
  for (const key of Object.keys(rawExpressions)) {
    if (key in EXPRESSION_META) {
      const raw = Number(rawExpressions[key]);
      if (!Number.isFinite(raw)) continue;
      const v = raw > 1 ? raw : raw * 100;
      expressions[key as ExpressionKey] = Math.max(0, Math.min(100, v));
    }
  }

  const dom = emotional.dominantEmotion;
  const domConf = Number(dom?.confidence);
  const dominant = dom && Number.isFinite(domConf)
    ? { emotion: String(dom.emotion || ''), confidence: domConf > 1 ? domConf : domConf * 100 }
    : null;

  const dRaw = Number(emotional.detection?.confidence ?? emotional.detection?._score);
  const detectionConfidence = Number.isFinite(dRaw)
    ? Math.max(0, Math.min(100, dRaw > 1 ? dRaw : dRaw * 100))
    : 0;

  // photoFileRef is { filename, tier, size, mimetype, uploadedAt, originalname }
  // Build a secure JWT-tokenized retrieve URL. The util refuses absolute paths,
  // path traversal, and cross-origin URLs.
  const photoRef = emotional.photoFileRef;
  let photoUrl: string | null = null;
  if (photoRef && photoRef.filename && userId !== undefined && userId !== null) {
    const tier = (photoRef.tier === 'tier1' || photoRef.tier === 'tier2' || photoRef.tier === 'tier3')
      ? photoRef.tier
      : undefined;
    photoUrl = buildStorageRetrieveUrl(String(photoRef.filename), userId, tier);
  }

  return { available: true, expressions, dominant, detectionConfidence, photoUrl };
}

function FacialAnalysisDropdown({
  open,
  loading,
  error,
  data,
  onRetry,
  onCompleteIntake,
}: {
  open: boolean;
  loading: boolean;
  error: string | null;
  data: FacialAnalysis | null;
  onRetry: () => void;
  onCompleteIntake: () => void;
}) {
  if (!open) return null;

  const wrapperStyle: React.CSSProperties = {
    ...GLASS_CARD,
    marginTop: 10,
    padding: '14px 14px 12px',
    background: 'rgba(var(--dash-surface), 0.5)',
    borderColor: 'rgba(var(--dash-surface), 0.55)',
    animation: 'avatarDropIn 0.25s ease-out',
  };

  const headingStyle: React.CSSProperties = {
    fontFamily: "'Poppins', sans-serif",
    fontWeight: 600,
    fontSize: '0.8rem',
    color: C.heading,
    margin: 0,
  };
  const subtleStyle: React.CSSProperties = {
    fontSize: '0.65rem',
    color: C.muted,
    fontFamily: "'Inter', sans-serif",
    margin: 0,
  };

  if (loading) {
    return (
      <div style={wrapperStyle} role="status" aria-live="polite">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="w-5 h-5 border-2 rounded-full animate-spin"
            style={{ borderColor: 'rgba(var(--dash-glow), 0.2)', borderTopColor: C.accent }} />
          <span style={subtleStyle}>Loading your facial analysis…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={wrapperStyle}>
        <p style={{ ...subtleStyle, color: '#b91c1c', marginBottom: 8 }}>{error}</p>
        <button
          type="button"
          onClick={onRetry}
          style={{
            background: 'rgba(var(--dash-glow), 0.12)',
            color: C.accent,
            border: '1px solid rgba(var(--dash-glow), 0.25)',
            fontSize: '0.7rem',
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data || data.available === false) {
    return (
      <div style={wrapperStyle}>
        <p style={{ ...headingStyle, marginBottom: 4 }}>No facial analysis yet</p>
        <p style={{ ...subtleStyle, marginBottom: 10 }}>
          Complete the visual step of your intake to unlock emotional insights.
        </p>
        <button
          type="button"
          onClick={onCompleteIntake}
          style={{
            background: 'rgba(var(--dash-glow), 0.15)',
            color: C.accent,
            border: '1px solid rgba(var(--dash-glow), 0.25)',
            fontSize: '0.7rem',
            fontWeight: 600,
            padding: '5px 12px',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          Complete visual intake
        </button>
      </div>
    );
  }

  const dominantKey = (data.dominant?.emotion || '').toLowerCase();
  const dominantMeta = (dominantKey in EXPRESSION_META)
    ? EXPRESSION_META[dominantKey as ExpressionKey]
    : null;

  const entries = (Object.keys(EXPRESSION_META) as ExpressionKey[])
    .map((k) => [k, data.expressions[k] ?? 0] as const)
    .filter(([, v]) => Number.isFinite(v))
    .sort((a, b) => b[1] - a[1]);

  const qualityColor = data.detectionConfidence >= 80 ? '#16a34a'
    : data.detectionConfidence >= 60 ? '#ca8a04'
    : data.detectionConfidence >= 40 ? '#ea580c'
    : '#dc2626';
  const qualityGlow = data.detectionConfidence >= 80 ? 'rgba(22,163,74,0.45)'
    : data.detectionConfidence >= 60 ? 'rgba(202,138,4,0.45)'
    : data.detectionConfidence >= 40 ? 'rgba(234,88,12,0.45)'
    : 'rgba(220,38,38,0.45)';

  return (
    <div style={wrapperStyle}>
      {data.photoUrl && (
        <div style={{
          position: 'relative',
          margin: '0 auto 12px',
          width: '100%',
          maxWidth: 180,
          aspectRatio: '1 / 1',
          borderRadius: 14,
          overflow: 'hidden',
          background: 'rgba(var(--dash-ink), 0.06)',
          border: '1px solid rgba(var(--dash-surface), 0.55)',
          boxShadow: '0 4px 16px rgba(var(--dash-ink), 0.15), inset 0 1px 0 rgba(var(--dash-surface),0.4)',
        }}>
          <img
            src={data.photoUrl}
            alt="Your intake photo"
            referrerPolicy="no-referrer"
            draggable={false}
            onError={(e) => {
              // If the retrieve URL fails (expired token, deleted file), drop
              // the broken image silently — the wheels still convey the data.
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
          {dominantMeta && (
            <div style={{
              position: 'absolute',
              left: 8,
              bottom: 8,
              padding: '3px 8px',
              borderRadius: 8,
              borderLeft: `3px solid ${dominantMeta.color}`,
              background: 'rgba(var(--dash-surface),0.85)',
              fontSize: '0.65rem',
              fontWeight: 700,
              color: C.heading,
              fontFamily: "'Inter', sans-serif",
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }}>
              {dominantMeta.label} {data.dominant ? `${Math.round(data.dominant.confidence)}%` : ''}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <ColorWheelRing
          value={data.detectionConfidence}
          color={qualityColor}
          glow={qualityGlow}
          label="Quality"
          size={56}
          strokeWidth={5}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={headingStyle}>Facial Analysis</p>
          <p style={subtleStyle}>
            {dominantMeta && data.dominant
              ? `Dominant: ${dominantMeta.label} (${Math.round(data.dominant.confidence)}%)`
              : 'Emotional spectrum'}
          </p>
        </div>
        {dominantMeta && !data.photoUrl && (
          <div style={{
            padding: '4px 9px',
            borderRadius: 10,
            borderLeft: `3px solid ${dominantMeta.color}`,
            background: 'rgba(var(--dash-surface),0.45)',
            fontSize: '0.65rem',
            fontWeight: 600,
            color: C.heading,
            fontFamily: "'Inter', sans-serif",
            flexShrink: 0,
          }}>
            {dominantMeta.label}
          </div>
        )}
      </div>

      {entries.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8,
          }}
          className="gd-emotion-grid"
        >
          {entries.map(([key, value]) => {
            const meta = EXPRESSION_META[key];
            return (
              <ColorWheelRing
                key={key}
                value={value}
                color={meta.color}
                glow={meta.glow}
                label={meta.label}
                size={48}
                strokeWidth={4}
              />
            );
          })}
        </div>
      ) : (
        <p style={subtleStyle}>No emotion data available.</p>
      )}
    </div>
  );
}

// ============================================================================
// CONNECTION DOT
// ============================================================================

function StatusDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full" style={{
        background: ok ? '#22c55e' : '#ef4444',
        boxShadow: ok ? '0 0 6px rgba(34, 197, 94, 0.5)' : '0 0 6px rgba(239, 68, 68, 0.5)',
      }} />
      <span style={{ color: ok ? '#15803d' : '#b91c1c', fontSize: '0.75rem', fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>
        {label}
      </span>
    </div>
  );
}

// ============================================================================
// COLLAPSIBLE SECTION
// ============================================================================

function Section({ title, icon, open = false, badge, onToggle, children }: {
  title: string; icon: string; open?: boolean; badge?: React.ReactNode; onToggle?: (isOpen: boolean) => void; children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(open);

  const handleToggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (onToggle) onToggle(next);
  };

  return (
    <div style={GLASS_CARD}>
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        <div className="flex items-center gap-2">
          <span style={{ fontSize: '1rem' }}>{icon}</span>
          <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: '0.85rem', color: C.heading }}>
            {title}
          </span>
          {badge}
        </div>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease' }}>
          <path d="M3 5l4 4 4-4" stroke={C.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {isOpen && (
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid rgba(var(--dash-ink), 0.1)` }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// NOTIFICATION ITEM
// ============================================================================

function getNotifIcon(type: string): string {
  const m: Record<string, string> = {
    group_invite: '👋', member_joined: '👤', member_left: '👤', ts_review_received: '📝',
    ts_dialogue_message: '💬', ts_helpful_marked: '❤️', ts_review_classified: '🏷️',
    ts_analysis_complete: '📊', ts_queue_assigned: '📋', ts_milestone_earned: '🏆',
    video_call_started: '📹', drawing_session_started: '🎨', chat_message: '💬', chat_mention: '📢',
  };
  return m[type] || '🔔';
}

interface NItemProps {
  notification: Notification;
  onAccept: (n: Notification) => Promise<boolean>;
  onDecline: (n: Notification) => Promise<boolean>;
  onDismiss: (id: string) => void;
  onNavigate: (url: string) => void;
  onMarkRead: (id: string) => void;
}

function NItem({ notification, onAccept, onDecline, onDismiss, onNavigate, onMarkRead }: NItemProps) {
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState<'accepted' | 'declined' | null>(null);

  const isInvite = notification.type === 'group_invite';
  const hasActions = notification.actions && notification.actions.length > 0 && !isInvite;
  // Phase 6a.9: the whole row is tappable when the notification has a
  // deep-link AND isn't an invite (invites need Accept/Decline kept as
  // dedicated buttons). Action-button notifications also keep dedicated
  // buttons; the row tap is the fallback for everything else
  // (chat_message, chat_reply, chat_mention, member_joined, reactions,
  // read receipts, personal_analysis_complete, etc. — anywhere we've set
  // notification.actionUrl in NotificationContext).
  const isRowClickable = !isInvite && !!notification.actionUrl;

  const handleRowClick = () => {
    if (!isRowClickable) return;
    onNavigate(notification.actionUrl!);
    onMarkRead(notification.id);
  };

  return (
    <div
      className="flex items-start gap-2.5 p-2 rounded-xl transition-colors"
      style={{ cursor: isRowClickable ? 'pointer' : 'default' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(var(--dash-surface), 0.25)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      onClick={isRowClickable ? handleRowClick : undefined}
      role={isRowClickable ? 'button' : undefined}
      tabIndex={isRowClickable ? 0 : undefined}
      onKeyDown={isRowClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(); } } : undefined}
    >
      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0" style={{
        background: 'rgba(var(--dash-glow), 0.12)', border: '1px solid rgba(var(--dash-glow), 0.2)',
      }}>
        {getNotifIcon(notification.type)}
      </div>
      <div className="flex-1 min-w-0">
        <p style={{ color: C.heading, fontSize: '0.75rem', fontWeight: 600, fontFamily: "'Inter', sans-serif" }} className="truncate">
          {notification.title}
        </p>
        <p style={{ color: C.muted, fontSize: '0.7rem', fontFamily: "'Inter', sans-serif" }} className="truncate">
          {notification.message}
        </p>

        {isInvite && notification.inviteData && !done && (
          <div className="flex gap-2 mt-1.5">
            <button onClick={async () => { setProcessing(true); try { await onAccept(notification); setDone('accepted'); } catch { setProcessing(false); } }}
              disabled={processing} style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#15803d', border: '1px solid rgba(34, 197, 94, 0.25)', fontSize: '0.65rem', fontWeight: 600, padding: '2px 8px', borderRadius: 6 }}>
              {processing ? '...' : 'Accept'}
            </button>
            <button onClick={async () => { setProcessing(true); try { await onDecline(notification); setDone('declined'); } catch { setProcessing(false); } }}
              disabled={processing} style={{ background: 'rgba(0,0,0,0.04)', color: C.muted, border: '1px solid rgba(0,0,0,0.08)', fontSize: '0.65rem', fontWeight: 500, padding: '2px 8px', borderRadius: 6 }}>
              Decline
            </button>
          </div>
        )}

        {hasActions && notification.actions!.map((a) => (
          <button key={a.action} onClick={(e) => { e.stopPropagation(); if (notification.actionUrl) { onNavigate(notification.actionUrl); onMarkRead(notification.id); } }}
            style={{ background: 'rgba(var(--dash-glow), 0.1)', color: C.accent, border: '1px solid rgba(var(--dash-glow), 0.2)', fontSize: '0.65rem', fontWeight: 600, padding: '2px 8px', borderRadius: 6, marginTop: 4 }}>
            {a.label}
          </button>
        ))}

        {done && <span style={{ fontSize: '0.65rem', fontWeight: 600, color: done === 'accepted' ? '#15803d' : C.muted }}>{done === 'accepted' ? 'Joined!' : 'Declined'}</span>}
      </div>

      {(!isInvite || done) && (
        <button onClick={(e) => { e.stopPropagation(); onDismiss(notification.id); }} style={{ color: C.muted, fontSize: '0.85rem', lineHeight: 1, opacity: 0.5 }}>×</button>
      )}
    </div>
  );
}

// ============================================================================
// CREDENTIAL CHANGES — change password / change email
// ============================================================================
// Both are non-destructive self-service flows. Each is a trigger button that
// expands into an in-place form, mirroring the delete flow's idle->form shape.
// Server is the authority; client validation only saves a round-trip and gives
// instant feedback. Password rules below MUST mirror the backend policy.
// ============================================================================

const PW_POLICY = /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/;
const isStrongPw = (p: string) => p.length >= 8 && p.length <= 256 && PW_POLICY.test(p);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Shared field styles (neutral, non-destructive palette).
const credLabelSpan: React.CSSProperties = {
  display: 'block',
  color: C.body,
  fontSize: '0.65rem',
  fontWeight: 600,
  marginBottom: 4,
  fontFamily: "'Inter', sans-serif",
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};
const credInputBase: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '7px 10px',
  borderRadius: 8,
  border: '1px solid rgba(var(--dash-ink), 0.18)',
  background: 'rgba(var(--dash-surface),0.85)',
  fontFamily: "'Inter', sans-serif",
  fontSize: '0.78rem',
  color: C.heading,
  outline: 'none',
};
const credTriggerBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background: 'rgba(var(--dash-ink), 0.06)',
  color: C.heading,
  border: '1px solid rgba(var(--dash-ink), 0.18)',
  fontSize: '0.72rem',
  fontWeight: 600,
  padding: '6px 12px',
  borderRadius: 8,
  cursor: 'pointer',
  fontFamily: "'Inter', sans-serif",
  WebkitTapHighlightColor: 'transparent',
};
const credPrimaryBtn = (enabled: boolean): React.CSSProperties => ({
  flex: 1,
  background: enabled ? 'var(--dash-accent-grad)' : 'rgba(var(--dash-ink), 0.18)',
  color: '#fff',
  border: 'none',
  fontSize: '0.74rem',
  fontWeight: 700,
  padding: '8px 12px',
  borderRadius: 8,
  cursor: enabled ? 'pointer' : 'not-allowed',
  fontFamily: "'Inter', sans-serif",
});
const credGhostBtn: React.CSSProperties = {
  background: 'transparent',
  color: C.subtle,
  border: '1px solid rgba(var(--dash-ink), 0.18)',
  fontSize: '0.74rem',
  fontWeight: 600,
  padding: '8px 12px',
  borderRadius: 8,
  cursor: 'pointer',
  fontFamily: "'Inter', sans-serif",
};
const credNote: React.CSSProperties = {
  color: C.muted,
  fontSize: '0.7rem',
  fontFamily: "'Inter', sans-serif",
  margin: 0,
  lineHeight: 1.45,
};

function PasswordField({
  label, value, onChange, disabled, autoComplete,
}: {
  label: string; value: string; onChange: (v: string) => void; disabled?: boolean; autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <label style={{ display: 'block', marginBottom: 8 }}>
      <span style={credLabelSpan}>{label}</span>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          autoComplete={autoComplete}
          style={{ ...credInputBase, padding: '7px 32px 7px 10px' }}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          tabIndex={-1}
          aria-label={show ? 'Hide' : 'Show'}
          disabled={disabled}
          style={{
            position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
            background: 'transparent', border: 'none', color: C.muted, fontSize: '0.85rem',
            cursor: 'pointer', padding: 4, lineHeight: 1,
          }}
        >
          {show ? '🙈' : '👁'}
        </button>
      </div>
    </label>
  );
}

function FormStatus({ error, success }: { error?: string | null; success?: string | null }) {
  if (success) {
    return (
      <p role="status" aria-live="polite" style={{
        color: '#166534', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
        borderRadius: 8, padding: '7px 10px', fontSize: '0.72rem', margin: '0 0 8px', fontFamily: "'Inter', sans-serif",
      }}>{success}</p>
    );
  }
  if (error) {
    return (
      <p role="alert" style={{
        color: '#b91c1c', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)',
        borderRadius: 8, padding: '7px 10px', fontSize: '0.72rem', margin: '0 0 8px', fontFamily: "'Inter', sans-serif",
      }}>{error}</p>
    );
  }
  return null;
}

function ChangePasswordForm() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const reset = useCallback(() => {
    setOpen(false); setBusy(false); setCurrent(''); setNext(''); setConfirm('');
    setError(null); setSuccess(null);
  }, []);

  const newValid = isStrongPw(next);
  const matches = next.length > 0 && next === confirm;
  const distinct = next.length === 0 || next !== current;
  const canSubmit = !busy && current.length > 0 && newValid && matches && distinct;

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setBusy(true); setError(null); setSuccess(null);
    try {
      const res = await changePasswordApi(current, next);
      setSuccess(res?.message || 'Password changed. Other devices have been signed out.');
      setCurrent(''); setNext(''); setConfirm('');
      setTimeout(() => { setOpen(false); setSuccess(null); }, 2600);
    } catch (err: any) {
      setError(err?.error || err?.message || 'Could not change password. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [canSubmit, current, next]);

  if (!open) {
    return (
      <div className="space-y-2">
        <p style={credNote}>Update the password you use to sign in. Changing it signs you out of other devices.</p>
        <button type="button" onClick={() => { setSuccess(null); setError(null); setOpen(true); }} style={credTriggerBtn}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(var(--dash-ink), 0.12)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(var(--dash-ink), 0.06)'; }}>
          Change Password
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: 'rgba(var(--dash-ink),0.04)', border: '1px solid rgba(var(--dash-ink),0.12)', borderRadius: 12, padding: '12px 12px 14px' }}>
      <FormStatus error={error} success={success} />
      <PasswordField label="Current password" value={current} onChange={setCurrent} disabled={busy} autoComplete="current-password" />
      <PasswordField label="New password" value={next} onChange={setNext} disabled={busy} autoComplete="new-password" />
      {next.length > 0 && !newValid && (
        <p style={{ ...credNote, color: '#b45309', margin: '-2px 0 8px' }}>
          At least 8 chars with uppercase, lowercase, number, and special character.
        </p>
      )}
      <PasswordField label="Confirm new password" value={confirm} onChange={setConfirm} disabled={busy} autoComplete="new-password" />
      {confirm.length > 0 && !matches && (
        <p style={{ ...credNote, color: '#b45309', margin: '-2px 0 8px' }}>Passwords don't match.</p>
      )}
      {!distinct && (
        <p style={{ ...credNote, color: '#b45309', margin: '-2px 0 8px' }}>New password must differ from the current one.</p>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button type="button" onClick={submit} disabled={!canSubmit} style={credPrimaryBtn(canSubmit)}>
          {busy ? 'Saving…' : 'Update Password'}
        </button>
        <button type="button" onClick={reset} disabled={busy} style={credGhostBtn}>Cancel</button>
      </div>
    </div>
  );
}

function ChangeEmailForm({ currentEmail }: { currentEmail?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const reset = useCallback(() => {
    setOpen(false); setBusy(false); setEmail(''); setPassword(''); setError(null); setSent(null);
  }, []);

  const normalized = email.trim().toLowerCase();
  const emailValid = EMAIL_RE.test(normalized) && normalized.length <= 255;
  const distinct = !currentEmail || normalized !== currentEmail.trim().toLowerCase();
  const canSubmit = !busy && emailValid && distinct && password.length > 0;

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setBusy(true); setError(null); setSent(null);
    try {
      const res = await changeEmailApi(normalized, password);
      setSent(res?.message || `Confirmation link sent to ${normalized}. Click it to finish changing your email.`);
      setPassword('');
    } catch (err: any) {
      setError(err?.error || err?.message || 'Could not start the email change. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [canSubmit, normalized, password]);

  if (!open) {
    return (
      <div className="space-y-2">
        <p style={credNote}>
          Change your sign-in email. We'll send a confirmation link to the new address — it isn't changed until you click it.
        </p>
        <button type="button" onClick={() => { setSent(null); setError(null); setOpen(true); }} style={credTriggerBtn}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(var(--dash-ink), 0.12)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(var(--dash-ink), 0.06)'; }}>
          Change Email
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: 'rgba(var(--dash-ink),0.04)', border: '1px solid rgba(var(--dash-ink),0.12)', borderRadius: 12, padding: '12px 12px 14px' }}>
      <FormStatus error={error} success={sent} />
      {!sent && (
        <>
          {currentEmail && (
            <p style={{ ...credNote, marginBottom: 8 }}>Current: <span style={{ color: C.heading, fontWeight: 600 }}>{currentEmail}</span></p>
          )}
          <label style={{ display: 'block', marginBottom: 8 }}>
            <span style={credLabelSpan}>New email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              style={credInputBase}
            />
          </label>
          {email.length > 0 && !emailValid && (
            <p style={{ ...credNote, color: '#b45309', margin: '-2px 0 8px' }}>Enter a valid email address.</p>
          )}
          {emailValid && !distinct && (
            <p style={{ ...credNote, color: '#b45309', margin: '-2px 0 8px' }}>That's already your email.</p>
          )}
          <PasswordField label="Current password" value={password} onChange={setPassword} disabled={busy} autoComplete="current-password" />
        </>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        {!sent ? (
          <>
            <button type="button" onClick={submit} disabled={!canSubmit} style={credPrimaryBtn(canSubmit)}>
              {busy ? 'Sending…' : 'Send Confirmation'}
            </button>
            <button type="button" onClick={reset} disabled={busy} style={credGhostBtn}>Cancel</button>
          </>
        ) : (
          <button type="button" onClick={reset} style={credGhostBtn}>Done</button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// ACCOUNT SETTINGS — destructive actions (Phase 2a)
// ============================================================================
//
// Two-step delete flow:
//   Step 1: click "Delete Account" -> open confirmation card in place
//   Step 2: type "DELETE" + current password + click "Permanently delete"
// On success we wipe local storage, clear AuthContext state, and route to
// /login. On error we surface the server's message and let the user retry
// without losing what they already typed.
// ============================================================================

interface AccountSettingsProps {
  onDeleted: () => void;
}

function AccountSettings({ onDeleted }: AccountSettingsProps) {
  const [stage, setStage] = useState<'idle' | 'confirming' | 'deleting' | 'done'>('idle');
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const confirmInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStage('idle');
    setConfirmation('');
    setPassword('');
    setShowPassword(false);
    setError(null);
    setServerMessage(null);
  }, []);

  const beginConfirm = useCallback(() => {
    setStage('confirming');
    setError(null);
    setServerMessage(null);
    // Focus the confirmation input next paint
    setTimeout(() => confirmInputRef.current?.focus(), 30);
  }, []);

  const canSubmit = stage === 'confirming'
    && confirmation.trim().toUpperCase() === 'DELETE'
    && password.length >= 1;

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setStage('deleting');
    setError(null);
    try {
      const result = await deleteAccountApi(password, confirmation.trim().toUpperCase());
      setServerMessage(result?.message || 'Account deleted.');
      setStage('done');
      // Brief acknowledgement, then bubble up to the parent so it can route
      // away from the dashboard and back to /login.
      setTimeout(() => onDeleted(), 800);
    } catch (err: any) {
      const msg = err?.message || 'Account deletion failed. Please try again.';
      setError(msg);
      // Re-arm the form so the user can fix and retry without losing the
      // already-typed confirmation string.
      setStage('confirming');
      setPassword('');
    }
  }, [canSubmit, password, confirmation, onDeleted]);

  // Trigger button — the resting state
  if (stage === 'idle') {
    return (
      <div className="space-y-2">
        <p style={{
          color: C.muted,
          fontSize: '0.7rem',
          fontFamily: "'Inter', sans-serif",
          margin: 0,
          lineHeight: 1.45,
        }}>
          Permanently delete your account and every piece of data tied to it. This action cannot be undone.
        </p>
        <button
          type="button"
          onClick={beginConfirm}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(220, 38, 38, 0.12)',
            color: '#b91c1c',
            border: '1px solid rgba(220, 38, 38, 0.3)',
            fontSize: '0.72rem',
            fontWeight: 600,
            padding: '6px 12px',
            borderRadius: 8,
            cursor: 'pointer',
            fontFamily: "'Inter', sans-serif",
            WebkitTapHighlightColor: 'transparent',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(220, 38, 38, 0.18)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(220, 38, 38, 0.12)'; }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
            <path d="M10 11v6M14 11v6"></path>
            <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
          </svg>
          Delete Account
        </button>
      </div>
    );
  }

  // Success state — brief acknowledgement; parent will redirect shortly.
  if (stage === 'done') {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          background: 'rgba(34, 197, 94, 0.12)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: 10,
          padding: '10px 12px',
        }}
      >
        <p style={{
          color: '#166534',
          fontSize: '0.75rem',
          fontWeight: 600,
          margin: 0,
          fontFamily: "'Inter', sans-serif",
        }}>
          {serverMessage || 'Account deleted.'} Redirecting…
        </p>
      </div>
    );
  }

  // Confirmation card — stages 'confirming' and 'deleting'
  const busy = stage === 'deleting';

  return (
    <div
      style={{
        background: 'rgba(220, 38, 38, 0.07)',
        border: '1px solid rgba(220, 38, 38, 0.25)',
        borderRadius: 12,
        padding: '12px 12px 14px',
      }}
    >
      <p style={{
        color: '#7f1d1d',
        fontSize: '0.78rem',
        fontWeight: 700,
        margin: '0 0 4px',
        fontFamily: "'Poppins', sans-serif",
      }}>
        Are you sure?
      </p>
      <p style={{
        color: '#991b1b',
        fontSize: '0.7rem',
        margin: '0 0 10px',
        fontFamily: "'Inter', sans-serif",
        lineHeight: 1.4,
      }}>
        This action cannot be undone. Every photo, voice sample, journal entry,
        analysis, and notification tied to your account will be permanently
        removed.
      </p>

      <label style={{ display: 'block', marginBottom: 8 }}>
        <span style={{
          display: 'block',
          color: C.body,
          fontSize: '0.65rem',
          fontWeight: 600,
          marginBottom: 4,
          fontFamily: "'Inter', sans-serif",
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          Type <span style={{ fontFamily: 'monospace', color: '#7f1d1d' }}>DELETE</span> to confirm
        </span>
        <input
          ref={confirmInputRef}
          type="text"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          disabled={busy}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '7px 10px',
            borderRadius: 8,
            border: '1px solid rgba(var(--dash-ink), 0.18)',
            background: 'rgba(var(--dash-surface),0.85)',
            fontFamily: 'monospace',
            fontSize: '0.78rem',
            color: C.heading,
            outline: 'none',
          }}
        />
      </label>

      <label style={{ display: 'block', marginBottom: 10 }}>
        <span style={{
          display: 'block',
          color: C.body,
          fontSize: '0.65rem',
          fontWeight: 600,
          marginBottom: 4,
          fontFamily: "'Inter', sans-serif",
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          Current password
        </span>
        <div style={{ position: 'relative' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            autoComplete="current-password"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '7px 32px 7px 10px',
              borderRadius: 8,
              border: '1px solid rgba(var(--dash-ink), 0.18)',
              background: 'rgba(var(--dash-surface),0.85)',
              fontFamily: "'Inter', sans-serif",
              fontSize: '0.78rem',
              color: C.heading,
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            disabled={busy}
            style={{
              position: 'absolute',
              right: 6,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              color: C.muted,
              fontSize: '0.85rem',
              cursor: 'pointer',
              padding: 4,
              lineHeight: 1,
            }}
          >
            {showPassword ? '🙈' : '👁'}
          </button>
        </div>
      </label>

      {error && (
        <p
          role="alert"
          style={{
            color: '#b91c1c',
            fontSize: '0.7rem',
            margin: '0 0 8px',
            fontFamily: "'Inter', sans-serif",
            background: 'rgba(220, 38, 38, 0.08)',
            border: '1px solid rgba(220, 38, 38, 0.18)',
            borderRadius: 8,
            padding: '6px 8px',
          }}
        >
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit || busy}
          style={{
            background: !canSubmit || busy
              ? 'rgba(220, 38, 38, 0.25)'
              : 'linear-gradient(135deg, #dc2626, #b91c1c)',
            color: '#ffffff',
            border: 'none',
            fontSize: '0.72rem',
            fontWeight: 700,
            padding: '7px 14px',
            borderRadius: 8,
            cursor: !canSubmit || busy ? 'not-allowed' : 'pointer',
            opacity: !canSubmit || busy ? 0.7 : 1,
            fontFamily: "'Inter', sans-serif",
            boxShadow: !canSubmit || busy
              ? 'none'
              : '0 4px 14px rgba(220, 38, 38, 0.35)',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {busy ? 'Deleting…' : 'Permanently delete'}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={busy}
          style={{
            background: 'rgba(var(--dash-surface), 0.55)',
            color: C.heading,
            border: '1px solid rgba(var(--dash-ink), 0.18)',
            fontSize: '0.72rem',
            fontWeight: 600,
            padding: '7px 12px',
            borderRadius: 8,
            cursor: busy ? 'not-allowed' : 'pointer',
            fontFamily: "'Inter', sans-serif",
            opacity: busy ? 0.6 : 1,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function GlobalDashboard() {
  const [showDashboard, setShowDashboard] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Avatar dropdown (Phase 1a) — facial analysis from completed intake.
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [faceLoading, setFaceLoading] = useState(false);
  const [faceError, setFaceError] = useState<string | null>(null);
  const [faceData, setFaceData] = useState<FacialAnalysis | null>(null);
  const faceFetchedRef = useRef(false);
  const faceAbortRef = useRef<AbortController | null>(null);

  const {
    notifications, unreadCount, isConnected: notifConnected,
    acceptInvite, declineInvite, dismiss, markRead, markAllRead, clearAll,
  } = useNotifications();

  const { fetchMyGroups } = useGroups();
  const { refreshSubscription } = useSubscription();
  // logout() clears tokens, wipes AuthContext state, and triggers re-render of
  // protected routes. After a successful account deletion we still call it to
  // ensure the in-memory auth tree mirrors the now-wiped localStorage.
  const { logout } = useAuth();
  const navigate = useNavigate();
  const userInfo = getUserInfo();
  const visible = notifications.filter((n) => !n.dismissed);

  const handleAccept = async (n: Notification) => { const ok = await acceptInvite(n); if (ok) await fetchMyGroups(); return ok; };
  const handleNav = (url: string) => { handleClose(); navigate(url); };

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      setShowDashboard(false);
      setIsClosing(false);
      setAvatarOpen(false);
      document.body.classList.remove('dashboard-open');
    }, 300);
  };
  const handleOpen = () => {
    setShowDashboard(true);
    setIsClosing(false);
    document.body.classList.add('dashboard-open');
    refreshSubscription(); // Fetch latest subscription + usage data
  };

  const fetchFaceAnalysis = useCallback(async () => {
    // Avoid overlapping requests; if a fetch is mid-flight, cancel it.
    if (faceAbortRef.current) {
      try { faceAbortRef.current.abort(); } catch { /* noop */ }
    }
    const ctrl = new AbortController();
    faceAbortRef.current = ctrl;

    setFaceLoading(true);
    setFaceError(null);
    try {
      const data = await getPersonalIntelligenceApi();
      if (ctrl.signal.aborted) return;
      // Read userInfo at fetch-time (not closure-time) so the userId reflects
      // whoever is currently signed in, not whoever was signed in when the
      // useCallback was first created.
      const currentUserId = getUserInfo()?.userId;
      const normalized = normalizeFacialAnalysis(data?.completeEmotionalData, currentUserId);
      setFaceData(normalized);
      faceFetchedRef.current = true;
    } catch (err: any) {
      if (ctrl.signal.aborted) return;
      const msg = err?.message || 'Could not load facial analysis.';
      setFaceError(msg);
    } finally {
      if (!ctrl.signal.aborted) setFaceLoading(false);
    }
  }, []);

  const handleAvatarToggle = useCallback(() => {
    setAvatarOpen((prev) => {
      const next = !prev;
      if (next && !faceFetchedRef.current && !faceLoading) {
        fetchFaceAnalysis();
      }
      return next;
    });
  }, [faceLoading, fetchFaceAnalysis]);

  const handleGoToVisualIntake = useCallback(() => {
    handleClose();
    navigate('/intake/visual');
  }, [navigate]);

  // Called by AccountSettings after a successful deletion. authApi.deleteAccount
  // has already wiped localStorage tokens. We still call logout() so any
  // listeners on AuthContext re-render with the cleared state, and we forcibly
  // navigate to /login (replace: true) so the user can't hit Back into a
  // half-authenticated dashboard.
  const handleAccountDeleted = useCallback(() => {
    // Belt-and-braces: ensure ALL known auth-related local-storage entries are
    // cleared on the path back to /login (authApi already does this on
    // success, but if there is some race we want to be safe).
    try { clearToken(); } catch { /* non-fatal */ }
    try { clearToken('refreshToken'); } catch { /* non-fatal */ }
    try { clearToken('userInfo'); } catch { /* non-fatal */ }
    try { localStorage.removeItem('rememberedEmail'); } catch { /* non-fatal */ }
    try { localStorage.removeItem('loginAttempts'); } catch { /* non-fatal */ }

    // Drop the dashboard chrome before navigating so the slide-out animation
    // plays nicely instead of being torn out mid-frame.
    handleClose();
    // logout() is best-effort — the API call may 401 because the user row
    // is gone. We swallow that.
    logout(false).catch(() => { /* expected */ });
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  // Normal sign-out (non-destructive). logout() revokes the current session
  // server-side and clears the JWT/refresh token + AuthContext state; we also
  // wipe the remaining auth-adjacent local-storage keys here so a logout
  // leaves nothing behind, then route to /login.
  const handleLogout = useCallback(() => {
    handleClose();
    try { clearToken('userInfo'); } catch { /* non-fatal */ }
    try { localStorage.removeItem('rememberedEmail'); } catch { /* non-fatal */ }
    try { localStorage.removeItem('loginAttempts'); } catch { /* non-fatal */ }
    // logout() clears local state in its finally block regardless of API
    // outcome, so a network/401 failure still ends in a clean logged-out state.
    logout(false).catch(() => { /* non-fatal */ });
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  // Cancel in-flight face fetch on unmount.
  useEffect(() => {
    return () => {
      if (faceAbortRef.current) {
        try { faceAbortRef.current.abort(); } catch { /* noop */ }
      }
    };
  }, []);

  useEffect(() => {
    if (!showDashboard) return;
    const onClick = (e: MouseEvent) => { if (panelRef.current && !panelRef.current.contains(e.target as Node)) handleClose(); };
    const tid = setTimeout(() => document.addEventListener('mousedown', onClick), 100);
    return () => { clearTimeout(tid); document.removeEventListener('mousedown', onClick); };
  }, [showDashboard]);

  useEffect(() => {
    const check = () => setWsConnected(isWebSocketConnected());
    check();
    const iv = setInterval(check, 2000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => { return () => { document.body.classList.remove('dashboard-open'); }; }, []);

  return (
    <>
      {/* Pull tab — thin vertical bar on left edge */}
      <button
        onClick={handleOpen}
        className={`fixed top-1/2 left-0 z-[60] flex items-center justify-center transition-all duration-300 ${showDashboard ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        title="Open Dashboard"
        style={{
          width: 20, height: 40, transform: 'translateY(-50%)',
          background: 'var(--dash-drawer-tab)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '0 8px 8px 0', border: '1px solid rgba(var(--dash-surface), 0.4)', borderLeft: 'none',
          boxShadow: '2px 0 12px rgba(var(--dash-glow), 0.15)',
        }}
        onMouseEnter={(e) => { (e.currentTarget.style.width as any) = '26px'; e.currentTarget.style.boxShadow = '3px 0 18px rgba(var(--dash-glow), 0.3)'; }}
        onMouseLeave={(e) => { (e.currentTarget.style.width as any) = '20px'; e.currentTarget.style.boxShadow = '2px 0 12px rgba(var(--dash-glow), 0.15)'; }}
      >
        <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
          <path d="M1 1l6 6-6 6" stroke={C.heading} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unreadCount > 0 && (
          <div className="absolute -top-2 -right-2 min-w-4 h-4 px-1 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
            style={{ background: 'var(--dash-accent-grad)', boxShadow: '0 2px 8px rgba(var(--dash-glow), 0.5)' }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </button>

      {/* Dashboard panel */}
      {showDashboard && (
        <>
          <div className={`fixed inset-0 z-[70] transition-opacity duration-300 cursor-pointer ${isClosing ? 'opacity-0' : 'opacity-100'}`}
            style={{ background: 'rgba(0, 0, 0, 0.3)', backdropFilter: 'blur(3px)' }} onClick={handleClose} />

          <div ref={panelRef}
            className={`fixed top-0 left-0 h-full z-[80] transition-transform duration-300 ease-out ${isClosing ? '-translate-x-full' : 'translate-x-0'}`}
            style={{ width: 'min(360px, 88vw)', animation: isClosing ? undefined : 'slideIn .3s ease-out' }}>

            <div className="h-full flex flex-col overflow-hidden" style={{
              background: 'var(--dash-drawer)',
              backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
              borderRight: '1px solid rgba(var(--dash-surface), 0.3)',
              boxShadow: '6px 0 30px rgba(var(--dash-glow), 0.12)',
            }}>

              {/* Top glow line */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 1,
                background: 'linear-gradient(90deg, transparent, rgba(var(--dash-surface), 0.6), rgba(var(--dash-glow), 0.5), transparent)' }} />

              {/* Header */}
              <div className="p-4 pb-3" style={{ borderBottom: `1px solid rgba(var(--dash-ink), 0.1)`, paddingTop: 'calc(1rem + var(--safe-area-inset-top, 0px))' }}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    {userInfo && (
                      <ProfileToggle
                        username={userInfo.username}
                        showStatus
                        isOnline={wsConnected}
                        onClick={handleAvatarToggle}
                        isOpen={avatarOpen}
                      />
                    )}
                    <div>
                      <h2 style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: '1.1rem', color: C.heading,
                        textShadow: '0 1px 3px rgba(var(--dash-surface), 0.3)' }}>
                        {userInfo?.username || 'Guest'}
                      </h2>
                      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.7rem', color: C.subtle }} className="truncate max-w-[150px]">
                        {userInfo?.email || 'Not logged in'}
                      </p>
                    </div>
                  </div>
                  <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
                    style={{ background: 'rgba(var(--dash-ink), 0.06)', border: '1px solid rgba(var(--dash-ink), 0.1)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(var(--dash-ink), 0.12)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(var(--dash-ink), 0.06)'; }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M9 3L3 9M3 3l6 6" stroke={C.heading} strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>

                {/* Avatar dropdown — facial analysis (Phase 1a) */}
                {userInfo && (
                  <FacialAnalysisDropdown
                    open={avatarOpen}
                    loading={faceLoading}
                    error={faceError}
                    data={faceData}
                    onRetry={fetchFaceAnalysis}
                    onCompleteIntake={handleGoToVisualIntake}
                  />
                )}
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5 gd-scroll">

                {/* Connection */}
                <Section title="Connection" icon="🔗">
                  <div className="space-y-2">
                    {[['WebSocket', wsConnected], ['Notifications', notifConnected], ['API', true]].map(([label, ok]) => (
                      <div key={label as string} className="flex justify-between items-center">
                        <span style={{ color: C.subtle, fontSize: '0.75rem', fontFamily: "'Inter', sans-serif" }}>{label as string}</span>
                        <StatusDot ok={ok as boolean} label={(ok as boolean) ? (label === 'Notifications' ? 'Live' : 'Connected') : 'Offline'} />
                      </div>
                    ))}
                  </div>
                </Section>

                {/* Notifications */}
                <Section title="Notifications" icon="🔔" open={true}
                  badge={unreadCount > 0 ? (
                    <span style={{ background: 'rgba(var(--dash-glow), 0.15)', color: C.accent, fontSize: '0.6rem', fontWeight: 700,
                      padding: '1px 7px', borderRadius: 10, fontFamily: "'Inter', sans-serif" }}>
                      {unreadCount} new
                    </span>
                  ) : undefined}>

                  {/* Push notification opt-in / status (Phase 5). Renders the
                      Enable button, active-device count, iOS install nudges,
                      and the Reinstall-via-Safari path. Self-suppresses to a
                      one-line message on unsupported browsers. */}
                  <div style={{ marginBottom: 8 }}>
                    <PushSettings onIOSInstallNudge={handleClose} />
                  </div>

                  {visible.length > 0 && (
                    <div className="flex justify-end gap-3 mb-1.5">
                      <button onClick={markAllRead} disabled={unreadCount === 0}
                        style={{ fontSize: '0.65rem', fontWeight: 600, color: C.accent, fontFamily: "'Inter', sans-serif", opacity: unreadCount === 0 ? 0.3 : 1 }}>
                        Mark read
                      </button>
                      <button onClick={clearAll} style={{ fontSize: '0.65rem', fontWeight: 500, color: C.muted, fontFamily: "'Inter', sans-serif" }}>
                        Clear
                      </button>
                    </div>
                  )}

                  {visible.length > 0 ? (
                    <div className="space-y-0.5 max-h-44 overflow-y-auto gd-scroll">
                      {visible.slice(0, 8).map((n) => (
                        <NItem key={n.id} notification={n} onAccept={handleAccept} onDecline={declineInvite}
                          onDismiss={dismiss} onNavigate={handleNav} onMarkRead={markRead} />
                      ))}
                      {visible.length > 8 && (
                        <p style={{ color: C.muted, fontSize: '0.65rem', textAlign: 'center', paddingTop: 6 }}>
                          +{visible.length - 8} more
                        </p>
                      )}
                    </div>
                  ) : (
                    <p style={{ color: C.muted, fontSize: '0.8rem', textAlign: 'center', padding: '12px 0', fontFamily: "'Inter', sans-serif" }}>
                      No notifications
                    </p>
                  )}
                </Section>

                {/* Subscription — the Student Premium flow lives INSIDE this card
                    as a collapsible field (StudentAccessCard collapsible mode),
                    which self-hides entirely when student access isn't applicable
                    (already loading/disabled), so no empty field ever renders. */}
                <Section title="Subscription" icon="✦" onToggle={(isOpen) => { if (isOpen) refreshSubscription(); }}>
                  <SubscriptionManager />
                  <div style={{ marginTop: 12 }}>
                    <StudentAccessCard collapsible />
                  </div>
                </Section>

                {/* Account Settings — sign-out + destructive actions */}
                <Section title="Account Settings" icon="⚙️">
                  <button
                    type="button"
                    onClick={handleLogout}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'rgba(var(--dash-ink), 0.06)',
                      color: C.heading,
                      border: '1px solid rgba(var(--dash-ink), 0.18)',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      padding: '6px 12px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontFamily: "'Inter', sans-serif",
                      WebkitTapHighlightColor: 'transparent',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(var(--dash-ink), 0.12)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(var(--dash-ink), 0.06)'; }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Log Out
                  </button>
                  <div style={{ height: 1, background: 'rgba(var(--dash-ink), 0.08)', margin: '12px 0' }} />
                  <ChangePasswordForm />
                  <div style={{ height: 1, background: 'rgba(var(--dash-ink), 0.08)', margin: '12px 0' }} />
                  <ChangeEmailForm currentEmail={userInfo?.email} />
                  <div style={{ height: 1, background: 'rgba(var(--dash-ink), 0.08)', margin: '12px 0' }} />
                  <AccountSettings onDeleted={handleAccountDeleted} />
                </Section>

                {/* Appearance — app-wide colorway toggle */}
                <Section title="Appearance" icon="🎨">
                  <ThemeToggle />
                </Section>

                {/* System */}
                <Section title="System" icon="ℹ️">
                  <div className="space-y-1.5">
                    {[
                      // Build-time-injected release tag. See vite.config.ts and
                      // .github/workflows/ci-cd.yml — single source of truth for
                      // the version. Defaults to 'dev' on local builds.
                      ['Version', (import.meta.env.VITE_APP_VERSION || 'dev').trim()],
                      ['Session', 'Active'],
                      ['Dashboard', 'Online'],
                    ].map(([l, v]) => (
                      <div key={l} className="flex justify-between">
                        <span style={{ color: C.muted, fontSize: '0.7rem', fontFamily: "'Inter', sans-serif" }}>{l}</span>
                        <span
                          style={{
                            color: C.heading,
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            fontFamily: l === 'Version' ? 'monospace' : "'Inter', sans-serif",
                            maxWidth: '60%',
                            textAlign: 'right',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={l === 'Version' ? String(v) : undefined}
                        >
                          {v}
                        </span>
                      </div>
                    ))}
                  </div>
                </Section>
              </div>

              {/* Footer */}
              <div style={{ padding: '10px 16px', borderTop: `1px solid rgba(var(--dash-ink), 0.08)` }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                    gap: '4px 10px',
                    marginBottom: 8,
                  }}
                >
                  {([
                    ['Feedback & Support', '/feedback'],
                    ['Site Map', '/map'],
                    ['Terms & Conditions', '/termsandconditions'],
                    ['Dev', '/dev'],
                  ] as [string, string][]).map(([label, path], i) => (
                    <Fragment key={path}>
                      {i > 0 && (
                        <span aria-hidden="true" style={{ color: C.muted, fontSize: '0.6rem', opacity: 0.5 }}>·</span>
                      )}
                      <button
                        type="button"
                        onClick={() => { handleClose(); navigate(path); }}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          color: C.subtle,
                          fontSize: '0.62rem',
                          fontFamily: "'Inter', sans-serif",
                          WebkitTapHighlightColor: 'transparent',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = C.accent; e.currentTarget.style.textDecoration = 'underline'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = C.subtle; e.currentTarget.style.textDecoration = 'none'; }}
                      >
                        {label}
                      </button>
                    </Fragment>
                  ))}
                </div>
                <p style={{ color: C.muted, fontSize: '0.6rem', textAlign: 'center', fontFamily: "'Inter', sans-serif", margin: 0 }}>
                  Mirror <span style={{ fontFamily: 'monospace' }}>{(import.meta.env.VITE_APP_VERSION || 'dev').trim()}</span>
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(-100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes avatarDropIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 360px) {
          .gd-emotion-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
        .gd-scroll { scrollbar-width: thin; scrollbar-color: rgba(var(--dash-ink), 0.15) transparent; }
        .gd-scroll::-webkit-scrollbar { width: 3px; }
        .gd-scroll::-webkit-scrollbar-track { background: transparent; }
        .gd-scroll::-webkit-scrollbar-thumb { background: rgba(var(--dash-ink), 0.15); border-radius: 3px; }
        .gd-scroll::-webkit-scrollbar-thumb:hover { background: rgba(var(--dash-ink), 0.3); }
        body.dashboard-open .sphere-nav-container {
          opacity: 0 !important; pointer-events: none !important;
          transition: opacity 0.3s ease-out !important;
        }
        body:not(.dashboard-open) .sphere-nav-container {
          transition: opacity 0.3s ease-in !important;
        }
      `}</style>
    </>
  );
}