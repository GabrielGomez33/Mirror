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

export default function StudentAccessCard() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [status, setStatus] = useState<StudentStatus | null>(null);
  const [email, setEmail] = useState('');
  const [attest18, setAttest18] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setPhase('sent');
    } catch (err) {
      setError(friendlyError(err as ApiError));
      setPhase('form');
    }
  }

  if (phase === 'loading' || phase === 'disabled') return null;

  if (phase === 'active' && status) {
    return (
      <div style={wrap}>
        <h3 style={{ color: '#fff', margin: '0 0 8px' }}>🎓 Student Premium is active</h3>
        <p style={{ color: '#ccc', lineHeight: 1.6, margin: 0 }}>
          Verified via <strong>{status.institutionDomain}</strong>.
          {status.daysLeft != null && (
            <> Free Premium for {status.daysLeft} more day{status.daysLeft === 1 ? '' : 's'} — we'll remind you to re-verify.</>
          )}
        </p>
      </div>
    );
  }

  if (phase === 'sent') {
    return (
      <div style={wrap}>
        <h3 style={{ color: '#fff', margin: '0 0 8px' }}>Check your school inbox 📬</h3>
        <p style={{ color: '#ccc', lineHeight: 1.6, margin: 0 }}>
          We sent a confirmation link to <strong>{email.trim()}</strong>. Click it to activate free
          Premium. The link expires soon, so grab it while it's fresh.
        </p>
      </div>
    );
  }

  // form / submitting
  return (
    <div style={wrap}>
      <h3 style={{ color: '#fff', margin: '0 0 6px' }}>Students get Premium, free 🎓</h3>
      <p style={{ color: '#aaa', fontSize: 14, margin: '0 0 16px', lineHeight: 1.5 }}>
        Confirm your school email to unlock everything, on us — for as long as you're enrolled.
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
    </div>
  );
}
