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
        className="w-full"
        style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(217, 119, 6, 0.10))',
          borderBottom: '1px solid rgba(245, 158, 11, 0.25)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3 text-sm text-white/90">
            <span className="text-xl shrink-0">✉️</span>
            <div>
              <p className="font-medium leading-snug">
                Verify your email to unlock all Mirror features.
              </p>
              <p className="text-white/70 text-xs mt-0.5">
                We sent a link to <strong className="text-white/90">{user.email}</strong>. It expires in 24 hours.
                {message && <span className="ml-2 text-emerald-300">{message}</span>}
                {error && <span className="ml-2 text-red-300">{error}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleResend}
              disabled={sending || cooldown > 0}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                border border-white/20 backdrop-blur-sm
                ${sending || cooldown > 0
                  ? 'bg-white/5 opacity-60 cursor-not-allowed text-white/60'
                  : 'bg-white/10 hover:bg-white/20 text-white hover:border-white/40'}
              `}
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
              aria-label="Dismiss for this session"
              className="px-2 py-1.5 rounded-lg text-xs text-white/60 hover:text-white/90 hover:bg-white/10 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default VerifyEmailBanner;
