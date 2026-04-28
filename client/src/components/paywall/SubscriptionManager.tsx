// ============================================================================
// SUBSCRIPTION MANAGER COMPONENT
// ============================================================================
// File: components/paywall/SubscriptionManager.tsx
// Account-level subscription management panel for the dashboard.
// Uses dark-on-light color scheme matching MyMirror / GlobalDashboard.
// ============================================================================

import React, { useState, useCallback, useEffect } from 'react';
import { useSubscription } from '../../context/SubscriptionContext';
import { useAuth } from '../../context/AuthContext';
import { sendVerificationEmail } from '../../services/emailVerificationApi';

// ============================================================================
// COLORS — matches GlobalDashboard / MyMirror
// ============================================================================

const C = {
  heading: '#3d1428',
  body: '#2e1018',
  subtle: '#6b4050',
  muted: '#8a6070',
  accent: '#c6469b',
  cardBg: 'rgba(255, 255, 255, 0.3)',
  cardBorder: 'rgba(255, 255, 255, 0.4)',
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/** Usage meter bar */
const UsageMeter: React.FC<{ label: string; used: number; limit: number; resetsAt: string }> = ({ label, used, limit, resetsAt }) => {
  const pct = Math.min((used / limit) * 100, 100);
  const isNear = pct >= 80;
  const isAt = pct >= 100;
  const resetLabel = new Date(resetsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="mb-2.5">
      <div className="flex justify-between items-baseline mb-1">
        <span style={{ color: C.subtle, fontSize: '0.75rem', fontFamily: "'Inter', sans-serif" }}>{label}</span>
        <span style={{
          fontSize: '0.75rem', fontWeight: 600, fontFamily: "'Inter', sans-serif",
          color: isAt ? '#b91c1c' : isNear ? '#92400e' : C.heading,
        }}>
          {used}/{limit}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(61, 20, 40, 0.08)' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{
          width: `${pct}%`,
          background: isAt ? 'linear-gradient(90deg, #ef4444, #dc2626)'
            : isNear ? 'linear-gradient(90deg, #f59e0b, #d97706)'
            : 'linear-gradient(90deg, #ff69b4, #ff1493)',
        }} />
      </div>
      <p style={{ color: C.muted, fontSize: '0.6rem', fontFamily: "'Inter', sans-serif", marginTop: 2 }}>Resets {resetLabel}</p>
    </div>
  );
};

/** Status badge */
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const cfg: Record<string, { bg: string; text: string; label: string }> = {
    free: { bg: 'rgba(61, 20, 40, 0.08)', text: C.muted, label: 'Free' },
    trialing: { bg: 'rgba(198, 70, 155, 0.12)', text: C.accent, label: 'Trial' },
    active: { bg: 'rgba(34, 197, 94, 0.12)', text: '#15803d', label: 'Active' },
    past_due: { bg: 'rgba(245, 158, 11, 0.12)', text: '#92400e', label: 'Past Due' },
    cancelled: { bg: 'rgba(239, 68, 68, 0.08)', text: '#b91c1c', label: 'Cancelled' },
    expired: { bg: 'rgba(61, 20, 40, 0.06)', text: C.muted, label: 'Expired' },
  };
  const s = cfg[status] || cfg.free;

  return (
    <span style={{
      background: s.bg, color: s.text, fontSize: '0.7rem', fontWeight: 600,
      fontFamily: "'Inter', sans-serif", padding: '2px 10px', borderRadius: 10,
    }}>
      {s.label}
    </span>
  );
};

/** Email verification card */
const EmailVerificationCard: React.FC<{ emailVerified: boolean }> = ({ emailVerified: initial }) => {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(initial);

  useEffect(() => {
    if (!initial) {
      import('../../services/emailVerificationApi').then(({ getVerificationStatus }) => {
        getVerificationStatus().then(s => { if (s.verified) setVerified(true); }).catch(() => {});
      });
    }
  }, [initial]);

  const handleSend = async () => {
    setSending(true); setError(null);
    try {
      const r = await sendVerificationEmail();
      if (r.verified) { window.location.reload(); return; }
      setSent(true);
    } catch (e: any) {
      setError(e?.code === 'RATE_LIMITED' ? `Wait ${e.retryAfter}s` : (e?.error || 'Failed to send'));
    } finally { setSending(false); }
  };

  return (
    <div className="rounded-xl p-3 mb-3" style={{
      background: verified ? 'rgba(34, 197, 94, 0.08)' : 'rgba(245, 158, 11, 0.08)',
      border: `1px solid ${verified ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
    }}>
      <div className="flex items-center gap-2.5">
        {verified ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="#15803d" strokeWidth="1.5" />
            <path d="M5 8l2 2 4-4.5" stroke="#15803d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="#92400e" strokeWidth="1.5" />
            <path d="M8 5v3.5M8 11h.005" stroke="#92400e" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
        <div>
          <p style={{ color: verified ? '#15803d' : '#92400e', fontSize: '0.8rem', fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>
            {verified ? 'Email verified' : 'Email not verified'}
          </p>
          {!verified && <p style={{ color: C.muted, fontSize: '0.65rem', fontFamily: "'Inter', sans-serif" }}>Required for Premium</p>}
        </div>
      </div>
      {!verified && !sent && (
        <button onClick={handleSend} disabled={sending}
          className="w-full mt-2.5 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors"
          style={{ fontFamily: "'Inter', sans-serif", background: 'rgba(198, 70, 155, 0.12)', border: '1px solid rgba(198, 70, 155, 0.2)', color: C.accent }}>
          {sending ? 'Sending...' : 'Send Verification Email'}
        </button>
      )}
      {sent && <p style={{ color: '#15803d', fontSize: '0.7rem', fontFamily: "'Inter', sans-serif", marginTop: 6 }}>Sent! Check your inbox.</p>}
      {error && <p style={{ color: '#b91c1c', fontSize: '0.7rem', fontFamily: "'Inter', sans-serif", marginTop: 6 }}>{error}</p>}
    </div>
  );
};

// ============================================================================
// USAGE LABELS
// ============================================================================

const USAGE_LABELS: Record<string, string> = {
  journal_entries_per_month: 'Journal entries',
  groups_joined: 'Groups joined',
  dina_queries_per_day: '@Dina queries',
  personal_analysis_per_week: 'Personal analysis',
  truth_mirror_per_week: 'Truth Mirror',
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const SubscriptionManager: React.FC = () => {
  const {
    tier, status, trialDaysLeft, graceDaysLeft, accessUntil, currentPeriodEnd,
    usage, isLoading, refreshSubscription, requestCancel, requestTrial, openUpgradeModal, isPremium,
  } = useSubscription();
  const { user } = useAuth();

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => { refreshSubscription(); }, [refreshSubscription]);

  const handleCancel = useCallback(async () => {
    setCancelling(true);
    try { await requestCancel(cancelReason || undefined); setShowCancelConfirm(false); setCancelReason(''); }
    catch {} finally { setCancelling(false); }
  }, [requestCancel, cancelReason]);

  const handleStartTrial = useCallback(async () => {
    try { await requestTrial(); } catch {}
  }, [requestTrial]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: '0.9rem', color: C.heading }}>
          Subscription
        </h3>
        <StatusBadge status={status} />
      </div>

      {/* Plan card */}
      <div className="rounded-xl p-3 mb-3" style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12 }}>
        <div className="flex items-baseline justify-between mb-1">
          <span style={{ color: C.heading, fontSize: '0.8rem', fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>
            {tier === 'free' ? 'Free Plan' : 'Premium Plan'}
          </span>
          {tier !== 'free' && (
            <span style={{ color: C.subtle, fontSize: '0.75rem', fontFamily: "'Inter', sans-serif" }}>$9.99/mo</span>
          )}
        </div>

        {status === 'trialing' && trialDaysLeft !== null && (
          <p style={{ color: C.accent, fontSize: '0.75rem', fontFamily: "'Inter', sans-serif" }}>
            {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''} remaining in your free trial
          </p>
        )}
        {status === 'active' && currentPeriodEnd && (
          <p style={{ color: C.subtle, fontSize: '0.75rem', fontFamily: "'Inter', sans-serif" }}>
            Next billing: {new Date(currentPeriodEnd).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        )}
        {status === 'past_due' && graceDaysLeft !== null && (
          <p style={{ color: '#92400e', fontSize: '0.75rem', fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>
            Payment failed — {graceDaysLeft} day{graceDaysLeft !== 1 ? 's' : ''} to resolve
          </p>
        )}
        {status === 'cancelled' && accessUntil && (
          <p style={{ color: '#b91c1c', fontSize: '0.75rem', fontFamily: "'Inter', sans-serif" }}>
            Access until {new Date(accessUntil).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        )}
      </div>

      {/* Email verification */}
      <EmailVerificationCard emailVerified={!!user?.emailVerified} />

      {/* Usage meters */}
      {!isPremium() && Object.keys(usage).length > 0 && (
        <div className="mb-3">
          <p style={{ color: C.subtle, fontSize: '0.65rem', fontWeight: 600, fontFamily: "'Inter', sans-serif", textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
            Usage
          </p>
          {Object.entries(usage).map(([key, data]) => (
            <UsageMeter key={key} label={USAGE_LABELS[key] || key} used={data.used} limit={data.limit} resetsAt={data.resetsAt} />
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2 mt-3">
        {status === 'free' && (
          <>
            <button onClick={handleStartTrial} disabled={isLoading}
              className="w-full py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50 transition-all duration-200"
              style={{
                fontFamily: "'Inter', sans-serif",
                background: 'linear-gradient(135deg, #ff69b4, #ff1493)',
                boxShadow: '0 4px 16px rgba(255, 105, 180, 0.3)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(255, 105, 180, 0.45)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(255, 105, 180, 0.3)'; }}>
              {isLoading ? 'Starting...' : 'Start 7-Day Free Trial'}
            </button>
            <button onClick={() => openUpgradeModal()}
              className="w-full py-1.5 rounded-xl text-xs transition-colors"
              style={{ fontFamily: "'Inter', sans-serif", color: C.subtle, background: 'rgba(61, 20, 40, 0.05)', border: `1px solid rgba(61, 20, 40, 0.1)` }}>
              Subscribe directly
            </button>
          </>
        )}

        {status === 'trialing' && (
          <button onClick={() => openUpgradeModal()}
            className="w-full py-2 rounded-xl text-xs font-bold text-white transition-all duration-200"
            style={{ fontFamily: "'Inter', sans-serif", background: 'linear-gradient(135deg, #ff69b4, #ff1493)', boxShadow: '0 4px 16px rgba(255, 105, 180, 0.3)' }}>
            Subscribe now — $9.99/mo
          </button>
        )}

        {(status === 'cancelled' || status === 'expired') && (
          <div className="rounded-xl p-3" style={{ background: 'rgba(198, 70, 155, 0.06)', border: '1px solid rgba(198, 70, 155, 0.15)' }}>
            <p style={{ color: C.body, fontSize: '0.75rem', fontFamily: "'Inter', sans-serif", marginBottom: 8, textAlign: 'center' }}>
              {status === 'cancelled' ? 'Your subscription has been cancelled.' : 'Your subscription has expired.'} Resubscribe to restore unlimited access to all Premium features.
            </p>
            <button onClick={() => openUpgradeModal()}
              className="w-full py-2 rounded-xl text-xs font-bold text-white transition-all duration-200"
              style={{ fontFamily: "'Inter', sans-serif", background: 'linear-gradient(135deg, #ff69b4, #ff1493)', boxShadow: '0 4px 16px rgba(255, 105, 180, 0.3)' }}>
              Resubscribe — $9.99/mo
            </button>
          </div>
        )}

        {(status === 'active' || status === 'trialing') && !showCancelConfirm && (
          <button onClick={() => setShowCancelConfirm(true)}
            className="w-full py-1.5 rounded-xl text-xs transition-colors"
            style={{ fontFamily: "'Inter', sans-serif", color: C.muted }}>
            Cancel subscription
          </button>
        )}

        {showCancelConfirm && (
          <div className="rounded-xl p-3 mt-1" style={{ background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
            <p style={{ color: '#b91c1c', fontSize: '0.8rem', fontWeight: 600, fontFamily: "'Inter', sans-serif", marginBottom: 6 }}>
              You will lose access to:
            </p>
            <div style={{ marginBottom: 10, paddingLeft: 4 }}>
              {[
                'Unlimited journal entries',
                'AI-powered journal analysis',
                'Personal Mirror Reports',
                'Creating MirrorGroups',
                'Group AI insights',
                'TruthStream peer reviews',
                'Unlimited @Dina queries',
                'Data export',
              ].map((feature, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ color: '#b91c1c', fontSize: '0.6rem' }}>✕</span>
                  <span style={{ color: C.body, fontSize: '0.7rem', fontFamily: "'Inter', sans-serif" }}>{feature}</span>
                </div>
              ))}
            </div>
            <p style={{ color: C.subtle, fontSize: '0.7rem', fontFamily: "'Inter', sans-serif", marginBottom: 8 }}>
              {status === 'active' ? "You'll retain access until your billing period ends." : 'Your trial will end immediately.'}
            </p>
            <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Optional: why are you cancelling?"
              className="w-full p-2 rounded-lg text-xs resize-none mb-2"
              style={{ fontFamily: "'Inter', sans-serif", background: 'rgba(255, 255, 255, 0.3)', border: `1px solid rgba(61, 20, 40, 0.1)`, color: C.body }}
              rows={2} maxLength={500} />
            <div className="flex gap-2">
              <button onClick={handleCancel} disabled={cancelling}
                className="flex-1 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors"
                style={{ fontFamily: "'Inter', sans-serif", background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#b91c1c' }}>
                {cancelling ? 'Cancelling...' : 'Yes, cancel'}
              </button>
              <button onClick={() => { setShowCancelConfirm(false); setCancelReason(''); }}
                className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ fontFamily: "'Inter', sans-serif", background: 'rgba(61, 20, 40, 0.05)', border: `1px solid rgba(61, 20, 40, 0.1)`, color: C.subtle }}>
                Keep subscription
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionManager;
