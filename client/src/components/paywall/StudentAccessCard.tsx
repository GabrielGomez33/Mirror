// ============================================================================
// STUDENT ACCESS CARD
// ============================================================================
// File: components/paywall/StudentAccessCard.tsx
//
// Self-contained UI for the student free-Premium flow. Drop it into the
// account / upgrade area. It:
//   - reads current student status on mount (hides itself if already active),
//   - collects a school email + an EXPLICIT 18+ confirmation (required),
//   - posts to /mirror/api/student/request and shows a "check your inbox" state,
//   - surfaces server error codes (not accredited, already claimed, rate limit)
//     as friendly, specific messages.
//
// The actual entitlement is granted server-side after the emailed link is
// clicked (see StudentVerifyPage.tsx) — this card never grants anything itself.
// ============================================================================

import React, { useEffect, useState } from 'react';
import {
  requestStudentVerification,
  getStudentStatus,
  type ApiError,
  type StudentStatus,
} from '../../services/studentAccessApi';

type Phase = 'loading' | 'form' | 'submitting' | 'sent' | 'active' | 'disabled';

const wrap: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  padding: 24,
  color: '#e0e0e0',
  maxWidth: 480,
};
const btn: React.CSSProperties = {
  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  color: '#fff',
  border: 'none',
  padding: '12px 24px',
  borderRadius: 8,
  fontWeight: 600,
  cursor: 'pointer',
  width: '100%',
};
const input: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(0,0,0,0.25)',
  color: '#fff',
  boxSizing: 'border-box',
};

function friendlyError(err: ApiError): string {
  switch (err?.code) {
    case 'NOT_ACCREDITED':
      return "We couldn't confirm that domain belongs to a participating school. Double-check your address, or let us know your school.";
    case 'AGE_NOT_ATTESTED':
    case 'AGE_REQUIRED':
      return 'Please confirm you are 18 or older to continue.';
    case 'EMAIL_ALREADY_CLAIMED':
      return 'That school email is already linked to a Mirror account and can\'t be reused.';
    case 'BLOCKED_DOMAIN':
      return 'That email domain isn\'t eligible for student access.';
    case 'RATE_LIMITED':
      return err.retryAfter
        ? `Please wait ${err.retryAfter}s before requesting another email.`
        : 'Please wait a moment before trying again.';
    case 'DOMAIN_RATE_LIMITED':
      return 'A lot of students from your school signed up today — please try again tomorrow.';
    case 'STUDENT_ACCESS_DISABLED':
      return 'Student access isn\'t available right now.';
    case 'EMAIL_SEND_FAILED':
      return 'We couldn\'t send the email just now. Please try again in a few minutes.';
    default:
      return err?.error || 'Something went wrong. Please try again.';
  }
}

/**
 * Small collapsible wrapper so the student flow can live as a tidy field INSIDE
 * the dashboard's Subscription card instead of a separate card. Only wraps real
 * content — the parent renders nothing when StudentAccessCard returns null, so
 * no empty collapsible ever appears. Defaults open for intent-driven arrivals
 * (came from a "Students get Premium free" CTA) and for the active state.
 */
function CollapsibleField({
  title, badge, defaultOpen, children,
}: { title: string; badge?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, overflow: 'hidden', background: 'rgba(255,255,255,0.04)' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10, padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#e8e8f0', fontWeight: 600, fontSize: 14 }}>
          🎓 {title}
          {badge && (
            <span style={{ fontSize: 11, fontWeight: 600, color: '#a7f3d0', background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: 999, padding: '1px 8px' }}>
              {badge}
            </span>
          )}
        </span>
        <span aria-hidden style={{ color: '#a78bfa', fontSize: 13, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>▾</span>
      </button>
      {open && <div style={{ padding: '0 14px 14px' }}>{children}</div>}
    </div>
  );
}

export default function StudentAccessCard({ collapsible = false }: { collapsible?: boolean }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [status, setStatus] = useState<StudentStatus | null>(null);
  const [email, setEmail] = useState('');
  const [attest18, setAttest18] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set by the Home/Login "Student? Get Premium free" CTAs so we can greet
  // intent-driven arrivals. Cleared once they successfully request/verify.
  const [cameForStudent] = useState<boolean>(() => {
    try { return localStorage.getItem('student_intent') === '1'; } catch { return false; }
  });

  useEffect(() => {
    let alive = true;
    getStudentStatus()
      .then((s) => {
        if (!alive) return;
        setStatus(s);
        if (!s.enabled) setPhase('disabled');
        else if (s.isStudent) setPhase('active');
        else setPhase('form');
      })
      .catch(() => alive && setPhase('form')); // fail open to the form
    return () => {
      alive = false;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!attest18) {
      setError('Please confirm you are 18 or older to continue.');
      return;
    }
    setPhase('submitting');
    try {
      await requestStudentVerification(email.trim(), attest18);
      try { localStorage.removeItem('student_intent'); } catch { /* ignore */ }
      setPhase('sent');
    } catch (err) {
      setError(friendlyError(err as ApiError));
      setPhase('form');
    }
  }

  if (phase === 'loading' || phase === 'disabled') return null;

  // Build the phase-specific body (no outer chrome), then render it either as a
  // standalone card (default) or as a collapsible field inside another card.
  let body: React.ReactNode;
  let badge: string | undefined;
  let defaultOpen = cameForStudent;

  if (phase === 'active' && status) {
    badge = 'Active';
    body = (
      <>
        <h3 style={{ color: '#fff', margin: '0 0 8px' }}>🎓 Student Premium is active</h3>
        <p style={{ color: '#ccc', lineHeight: 1.6, margin: 0 }}>
          Verified via <strong>{status.institutionDomain}</strong>.
          {status.daysLeft != null && (
            <> Free Premium for {status.daysLeft} more day{status.daysLeft === 1 ? '' : 's'} — we'll remind you to re-verify.</>
          )}
        </p>
      </>
    );
  } else if (phase === 'sent') {
    badge = 'Check inbox';
    defaultOpen = true; // they just submitted — keep the confirmation visible
    body = (
      <>
        <h3 style={{ color: '#fff', margin: '0 0 8px' }}>Check your school inbox 📬</h3>
        <p style={{ color: '#ccc', lineHeight: 1.6, margin: 0 }}>
          We sent a confirmation link to <strong>{email.trim()}</strong>. Click it to activate free
          Premium. The link expires soon, so grab it while it's fresh.
        </p>
      </>
    );
  } else {
    // form / submitting
    body = (
      <>
        <h3 style={{ color: '#fff', margin: '0 0 6px' }}>Students get Premium, free 🎓</h3>
        <p style={{ color: '#aaa', fontSize: 14, margin: '0 0 16px', lineHeight: 1.5 }}>
          {cameForStudent
            ? "You're one step away — confirm your school email to unlock everything, on us, for as long as you're enrolled."
            : "Confirm your school email to unlock everything, on us — for as long as you're enrolled."}
        </p>
        <form onSubmit={submit}>
          <label htmlFor="campusEmail" style={{ display: 'block', fontSize: 13, color: '#bbb', marginBottom: 6 }}>
            School email
          </label>
          <input
            id="campusEmail"
            type="email"
            required
            autoComplete="email"
            placeholder="you@school.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={input}
          />
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, margin: '16px 0', color: '#ccc', fontSize: 14, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={attest18}
              onChange={(e) => setAttest18(e.target.checked)}
              style={{ marginTop: 3 }}
            />
            <span>I confirm I am 18 years of age or older.</span>
          </label>

          {error && (
            <div role="alert" style={{ color: '#fca5a5', fontSize: 14, marginBottom: 12 }}>
              {error}
            </div>
          )}

          <button type="submit" style={{ ...btn, opacity: phase === 'submitting' || !attest18 ? 0.6 : 1 }} disabled={phase === 'submitting' || !attest18}>
            {phase === 'submitting' ? 'Sending…' : 'Send confirmation link'}
          </button>
        </form>
        <p style={{ color: '#666', fontSize: 12, marginTop: 14, marginBottom: 0 }}>
          We only use your school email to confirm eligibility. Premium as a student is free — no card required.
        </p>
      </>
    );
  }

  if (collapsible) {
    return <CollapsibleField title="Student Premium" badge={badge} defaultOpen={defaultOpen}>{body}</CollapsibleField>;
  }
  return <div style={wrap}>{body}</div>;
}
