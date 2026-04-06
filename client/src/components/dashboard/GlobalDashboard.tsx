// src/components/dashboard/GlobalDashboard.tsx
// System-wide dashboard with real user data, notifications, connection status,
// and subscription management. Uses MyMirror's dark-on-light color scheme.

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { useGroups } from '../../context/GroupContext';
import { getUserInfo } from '../../utils/token';
import { isWebSocketConnected } from '../../services/groupsWebSocket';
import SubscriptionManager from '../paywall/SubscriptionManager';
import { useSubscription } from '../../context/SubscriptionContext';
import type { Notification } from '../../types/notifications';

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
// USER AVATAR COMPONENT
// ============================================================================

function UserAvatar({ username, showStatus, isOnline }: { username: string; showStatus?: boolean; isOnline?: boolean }) {
  const initials = username.split(/[\s_-]/).map((w) => w[0]?.toUpperCase() || '').slice(0, 2).join('');

  return (
    <div className="relative">
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center font-semibold text-white relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #ff69b4, #da70d6, #ff1493)',
          boxShadow: '0 4px 16px rgba(255, 105, 180, 0.35)',
          border: '2px solid rgba(255, 255, 255, 0.5)',
          fontSize: '0.85rem',
        }}
      >
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 50%)' }} />
        <span className="relative z-10" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>{initials}</span>
      </div>
      {showStatus && (
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full" style={{
          background: isOnline ? 'linear-gradient(135deg, #22c55e, #16a34a)' : '#9ca3af',
          boxShadow: isOnline ? '0 0 6px rgba(34, 197, 94, 0.6)' : 'none',
          border: '2px solid rgba(255, 255, 255, 0.7)',
        }} />
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

  return (
    <div className="flex items-start gap-2.5 p-2 rounded-xl transition-colors" style={{ cursor: 'default' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
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
          <button key={a.action} onClick={() => { if (notification.actionUrl) { onNavigate(notification.actionUrl); onMarkRead(notification.id); } }}
            style={{ background: 'rgba(198, 70, 155, 0.1)', color: C.accent, border: '1px solid rgba(198, 70, 155, 0.2)', fontSize: '0.65rem', fontWeight: 600, padding: '2px 8px', borderRadius: 6, marginTop: 4 }}>
            {a.label}
          </button>
        ))}

        {done && <span style={{ fontSize: '0.65rem', fontWeight: 600, color: done === 'accepted' ? '#15803d' : C.muted }}>{done === 'accepted' ? 'Joined!' : 'Declined'}</span>}
      </div>

      {(!isInvite || done) && (
        <button onClick={() => onDismiss(notification.id)} style={{ color: C.muted, fontSize: '0.85rem', lineHeight: 1, opacity: 0.5 }}>×</button>
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
    setTimeout(() => { setShowDashboard(false); setIsClosing(false); document.body.classList.remove('dashboard-open'); }, 300);
  };
  const handleOpen = () => {
    setShowDashboard(true);
    setIsClosing(false);
    document.body.classList.add('dashboard-open');
    refreshSubscription(); // Fetch latest subscription + usage data
  };

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
              <div className="flex justify-between items-center p-4 pb-3" style={{ borderBottom: `1px solid rgba(61, 20, 40, 0.1)` }}>
                <div className="flex items-center gap-3">
                  {userInfo && <UserAvatar username={userInfo.username} showStatus isOnline={wsConnected} />}
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
                    {[['Version', '1.0.0'], ['Session', 'Active'], ['Dashboard', 'Online']].map(([l, v]) => (
                      <div key={l} className="flex justify-between">
                        <span style={{ color: C.muted, fontSize: '0.7rem', fontFamily: "'Inter', sans-serif" }}>{l}</span>
                        <span style={{ color: C.heading, fontSize: '0.7rem', fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              </div>

              {/* Footer */}
              <div style={{ padding: '10px 16px', borderTop: `1px solid rgba(61, 20, 40, 0.08)` }}>
                <p style={{ color: C.muted, fontSize: '0.6rem', textAlign: 'center', fontFamily: "'Inter', sans-serif" }}>
                  Mirror v1.0.0
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
