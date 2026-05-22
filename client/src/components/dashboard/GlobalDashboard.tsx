// src/components/dashboard/GlobalDashboard.tsx
// System-wide dashboard with real user data, notifications, connection status,
// and subscription management. Uses MyMirror's dark-on-light color scheme.

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { useGroups } from '../../context/GroupContext';
import { getUserInfo } from '../../utils/token';
import { isWebSocketConnected } from '../../services/groupsWebSocket';
import SubscriptionManager from '../paywall/SubscriptionManager';
import { useSubscription } from '../../context/SubscriptionContext';
import { getPersonalIntelligenceApi } from '../../services/mirrorDashboard';
import { buildStorageRetrieveUrl } from '../../utils/storageUrl';
import type { Notification } from '../../types/notifications';
// Push notification opt-in / status panel (Phase 5). Embedded inside the
// "Notifications" section below so users can enable / manage push from the
// same drawer where they read their in-app notifications.
import PushSettings from '../notifications/PushSettings';

// ============================================================================
// COLORS — matches MyMirror / TruthStream / MirrorGroups
// ============================================================================

const C = {
  heading: '#3d1428',
  body: '#2e1018',
  subtle: '#6b4050',
  muted: '#8a6070',
  accent: '#c6469b',
  cardBg: 'rgba(255, 255, 255, 0.35)',
  cardBorder: 'rgba(255, 255, 255, 0.45)',
  cardHover: 'rgba(255, 255, 255, 0.5)',
};

const GLASS_CARD: React.CSSProperties = {
  background: C.cardBg,
  border: `1px solid ${C.cardBorder}`,
  borderRadius: 16,
  padding: '14px 16px',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
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
          ? 'linear-gradient(135deg, #ff69b4, #da70d6, #ff1493)'
          : 'rgba(255, 255, 255, 0.85)',
        border: isOpen ? '2px solid rgba(255,255,255,0.7)' : '1.5px solid rgba(61, 20, 40, 0.18)',
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
            border: '2px solid rgba(255, 255, 255, 0.9)',
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
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(61,20,40,0.08)" strokeWidth={strokeWidth} />
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
            textShadow: '0 1px 2px rgba(255,255,255,0.5)',
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
    background: 'rgba(255, 255, 255, 0.5)',
    borderColor: 'rgba(255, 255, 255, 0.55)',
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
            style={{ borderColor: 'rgba(198, 70, 155, 0.2)', borderTopColor: C.accent }} />
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
            background: 'rgba(198, 70, 155, 0.12)',
            color: C.accent,
            border: '1px solid rgba(198, 70, 155, 0.25)',
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
            background: 'rgba(198, 70, 155, 0.15)',
            color: C.accent,
            border: '1px solid rgba(198, 70, 155, 0.25)',
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
          background: 'rgba(61, 20, 40, 0.06)',
          border: '1px solid rgba(255, 255, 255, 0.55)',
          boxShadow: '0 4px 16px rgba(61, 20, 40, 0.15), inset 0 1px 0 rgba(255,255,255,0.4)',
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
              background: 'rgba(255,255,255,0.85)',
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
            background: 'rgba(255,255,255,0.45)',
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
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid rgba(61, 20, 40, 0.1)` }}>
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
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      onClick={isRowClickable ? handleRowClick : undefined}
      role={isRowClickable ? 'button' : undefined}
      tabIndex={isRowClickable ? 0 : undefined}
      onKeyDown={isRowClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(); } } : undefined}
    >
      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0" style={{
        background: 'rgba(198, 70, 155, 0.12)', border: '1px solid rgba(198, 70, 155, 0.2)',
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
            style={{ background: 'rgba(198, 70, 155, 0.1)', color: C.accent, border: '1px solid rgba(198, 70, 155, 0.2)', fontSize: '0.65rem', fontWeight: 600, padding: '2px 8px', borderRadius: 6, marginTop: 4 }}>
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
          background: 'linear-gradient(180deg, rgba(212, 171, 175, 0.8), rgba(198, 70, 155, 0.6))',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '0 8px 8px 0', border: '1px solid rgba(255, 255, 255, 0.4)', borderLeft: 'none',
          boxShadow: '2px 0 12px rgba(198, 70, 155, 0.15)',
        }}
        onMouseEnter={(e) => { (e.currentTarget.style.width as any) = '26px'; e.currentTarget.style.boxShadow = '3px 0 18px rgba(198, 70, 155, 0.3)'; }}
        onMouseLeave={(e) => { (e.currentTarget.style.width as any) = '20px'; e.currentTarget.style.boxShadow = '2px 0 12px rgba(198, 70, 155, 0.15)'; }}
      >
        <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
          <path d="M1 1l6 6-6 6" stroke={C.heading} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unreadCount > 0 && (
          <div className="absolute -top-2 -right-2 min-w-4 h-4 px-1 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #ff69b4, #ff1493)', boxShadow: '0 2px 8px rgba(255, 20, 147, 0.5)' }}>
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
              background: 'linear-gradient(180deg, rgb(212, 171, 175) 0%, rgba(198, 70, 155, 0.68) 100%)',
              backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
              borderRight: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '6px 0 30px rgba(198, 70, 155, 0.12)',
            }}>

              {/* Top glow line */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 1,
                background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), rgba(255, 182, 193, 0.5), transparent)' }} />

              {/* Header */}
              <div className="p-4 pb-3" style={{ borderBottom: `1px solid rgba(61, 20, 40, 0.1)` }}>
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
                        textShadow: '0 1px 3px rgba(255, 255, 255, 0.3)' }}>
                        {userInfo?.username || 'Guest'}
                      </h2>
                      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.7rem', color: C.subtle }} className="truncate max-w-[150px]">
                        {userInfo?.email || 'Not logged in'}
                      </p>
                    </div>
                  </div>
                  <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
                    style={{ background: 'rgba(61, 20, 40, 0.06)', border: '1px solid rgba(61, 20, 40, 0.1)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(61, 20, 40, 0.12)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(61, 20, 40, 0.06)'; }}>
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
                    <span style={{ background: 'rgba(198, 70, 155, 0.15)', color: C.accent, fontSize: '0.6rem', fontWeight: 700,
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

                {/* Subscription */}
                <Section title="Subscription" icon="✦" onToggle={(isOpen) => { if (isOpen) refreshSubscription(); }}>
                  <SubscriptionManager />
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
              <div style={{ padding: '10px 16px', borderTop: `1px solid rgba(61, 20, 40, 0.08)` }}>
                <p style={{ color: C.muted, fontSize: '0.6rem', textAlign: 'center', fontFamily: "'Inter', sans-serif" }}>
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
        .gd-scroll { scrollbar-width: thin; scrollbar-color: rgba(61, 20, 40, 0.15) transparent; }
        .gd-scroll::-webkit-scrollbar { width: 3px; }
        .gd-scroll::-webkit-scrollbar-track { background: transparent; }
        .gd-scroll::-webkit-scrollbar-thumb { background: rgba(61, 20, 40, 0.15); border-radius: 3px; }
        .gd-scroll::-webkit-scrollbar-thumb:hover { background: rgba(61, 20, 40, 0.3); }
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