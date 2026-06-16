// src/components/auth/VerifyEmailBanner.tsx
//
// Persistent inline banner shown to authenticated users whose email isn't yet
// verified. Place near the top of authenticated layouts (Dashboard, IntakeFlow,
// etc). Self-fetches verification status on mount and exposes a "Resend"
// button with a server-aligned 60s cooldown.
//
// Renders NOTHING for:
//   - unauthenticated users
//   - users whose `user.emailVerified === true`
//   - users who explicitly dismissed it this session (sessionStorage)
//
// The banner is dismissible per-session but never permanently — the only way
// to make it go away forever is to verify.

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import {
  sendVerificationEmail,
  getVerificationStatus,
} from '../../services/emailVerificationApi';

const DISMISS_KEY = 'mirror.verifyBanner.dismissedAt';
const RESEND_COOLDOWN_SEC = 60;

const VerifyEmailBanner: React.FC = () => {
  const { isAuthenticated, user, markEmailVerified } = useAuth();

  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return Boolean(sessionStorage.getItem(DISMISS_KEY));
    } catch {
      return false;
    }
  });

  const [verifiedFromServer, setVerifiedFromServer] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch authoritative server state on mount + when auth state flips.
  useEffect(() => {
    let cancelled = false;

    if (!isAuthenticated || !user || user.emailVerified) {
      setVerifiedFromServer(user?.emailVerified ?? null);
      return;
    }

    (async () => {
      try {
        const status = await getVerificationStatus();
        if (cancelled) return;
        setVerifiedFromServer(status.verified);
        if (status.verified) markEmailVerified();
      } catch {
        // If the call fails, fall back to whatever the context says.
        if (!cancelled) setVerifiedFromServer(user.emailVerified);
      }
    })();

    return () => { cancelled = true; };
  }, [isAuthenticated, user?.id, user?.emailVerified, markEmailVerified, user]);

  // Resend cooldown tick.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleResend = async () => {
    if (sending || cooldown > 0) return;
    setSending(true);
    setError(null);
    setMessage(null);
    try {
      const result = await sendVerificationEmail();
      setMessage(result?.message || 'Verification email sent. Check your inbox.');
      setCooldown(RESEND_COOLDOWN_SEC);
      if (result?.verified) {
        markEmailVerified();
        setVerifiedFromServer(true);
      }
    } catch (err: any) {
      const code = err?.code || '';
      const retryAfter: number | undefined = err?.retryAfter;
      if (code === 'RATE_LIMITED' && typeof retryAfter === 'number') {
        setCooldown(retryAfter);
        setError(err?.error || `Please wait ${retryAfter}s before trying again.`);
      } else {
        setError(err?.error || err?.message || 'Could not send verification email. Try again shortly.');
      }
    } finally {
      setSending(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* sessionStorage unavailable — no-op */
    }
  };

  // Visibility gate.
  if (!isAuthenticated || !user) return null;
  if (user.emailVerified || verifiedFromServer === true) return null;
  if (dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25 }}
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed',
          top: 'calc(1rem + var(--safe-area-inset-top, 0px))',
          left: 0,
          right: 0,
          margin: '0 auto',
          zIndex: 9990,
          width: 'calc(100vw - 2rem)',
          maxWidth: '440px',
        }}
      >
        <div
          className="glass-card-enhanced"
          style={{
            borderRadius: 20,
            padding: '14px 14px 12px 14px',
            color: '#1a1024',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div
              style={{
                width: 44, height: 44, flexShrink: 0, borderRadius: 12,
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
              }}
            >
              <span style={{ fontSize: '1.3rem', filter: 'brightness(10)' }}>✉</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3, margin: 0, color: '#1a1024' }}>
                Verify your email to unlock all Mirror features.
              </p>
              <p style={{ fontSize: 12, lineHeight: 1.4, margin: '2px 0 0 0', color: 'rgba(26, 16, 36, 0.65)' }}>
                We sent a link to <strong style={{ color: '#1a1024' }}>{user.email}</strong>. It expires in 24 hours.
                {message && <span style={{ marginLeft: 8, color: '#15803d' }}>{message}</span>}
                {error && <span style={{ marginLeft: 8, color: '#b91c1c' }}>{error}</span>}
              </p>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss"
              style={{
                flexShrink: 0, background: 'transparent', border: 'none',
                color: 'rgba(26, 16, 36, 0.4)', fontSize: 22, lineHeight: 1,
                cursor: 'pointer', padding: '0 2px', marginTop: -2,
              }}
            >
              ×
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <button
              type="button"
              onClick={handleResend}
              disabled={sending || cooldown > 0}
              style={{
                flex: 1,
                borderRadius: 999,
                padding: '9px 18px',
                fontSize: 13,
                fontWeight: 600,
                background: sending || cooldown > 0
                  ? 'rgba(245, 158, 11, 0.15)'
                  : 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: sending || cooldown > 0 ? 'rgba(26, 16, 36, 0.4)' : '#ffffff',
                border: 'none',
                cursor: sending || cooldown > 0 ? 'not-allowed' : 'pointer',
                boxShadow: sending || cooldown > 0 ? 'none' : '0 4px 12px rgba(245, 158, 11, 0.35)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
            >
              {sending
                ? 'Sending…'
                : cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : 'Resend email'}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              style={{
                borderRadius: 999,
                padding: '8px 12px',
                fontSize: 11,
                color: 'rgba(26, 16, 36, 0.5)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {"Don't show again"}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default VerifyEmailBanner;