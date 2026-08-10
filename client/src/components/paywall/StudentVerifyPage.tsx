// ============================================================================
// STUDENT VERIFY PAGE
// ============================================================================
// File: components/paywall/StudentVerifyPage.tsx
//
// Landing page for the emailed confirmation link:
//   /students/verify?token=<64-hex>
//
// It reads the token from the URL, posts it to /mirror/api/student/verify
// (no auth needed — the token IS the credential), and shows the outcome.
// Wire it into your router, e.g.:
//   <Route path="/students/verify" element={<StudentVerifyPage />} />
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { verifyStudentToken, type ApiError } from '../../services/studentAccessApi';

type State =
  | { kind: 'verifying' }
  | { kind: 'success'; message: string; accessUntil?: string }
  | { kind: 'error'; message: string };

const wrap: React.CSSProperties = {
  maxWidth: 480,
  margin: '64px auto',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  padding: 32,
  color: '#e0e0e0',
  textAlign: 'center',
};

function friendly(err: ApiError): string {
  switch (err?.code) {
    case 'TOKEN_EXPIRED':
      return 'This confirmation link has expired. Please request a new one from your account.';
    case 'TOKEN_USED':
      return 'This link has already been used. If Premium isn\'t active, request a fresh link.';
    case 'TOKEN_NOT_FOUND':
    case 'INVALID_TOKEN':
      return 'This confirmation link is invalid.';
    case 'EMAIL_ALREADY_CLAIMED':
      return 'That school email is already linked to another Mirror account.';
    case 'STUDENT_ACCESS_DISABLED':
      return 'Student access isn\'t available right now.';
    default:
      return err?.error || 'We couldn\'t verify this link. Please try again.';
  }
}

export default function StudentVerifyPage() {
  const [state, setState] = useState<State>({ kind: 'verifying' });
  // Guard against double-invoke (React 18/19 StrictMode mounts effects twice).
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const token = new URLSearchParams(window.location.search).get('token') || '';
    if (!/^[a-f0-9]{64}$/.test(token)) {
      setState({ kind: 'error', message: 'This confirmation link is invalid.' });
      return;
    }

    verifyStudentToken(token)
      .then((res) => {
        setState({
          kind: 'success',
          message: res.message || 'Your student status is confirmed.',
          accessUntil: res.accessUntil,
        });
      })
      .catch((err) => setState({ kind: 'error', message: friendly(err as ApiError) }));
  }, []);

  return (
    <div style={wrap}>
      <h1 style={{ color: '#fff', fontSize: 24, margin: '0 0 16px' }}>Mirror</h1>
      {state.kind === 'verifying' && <p style={{ color: '#ccc' }}>Confirming your student status…</p>}
      {state.kind === 'success' && (
        <>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🎓</div>
          <h2 style={{ color: '#fff', margin: '0 0 8px' }}>You're in</h2>
          <p style={{ color: '#ccc', lineHeight: 1.6 }}>{state.message}</p>
          {state.accessUntil && (
            <p style={{ color: '#888', fontSize: 13 }}>
              Free through {new Date(state.accessUntil).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.
            </p>
          )}
          <a href="/dashboard" style={{ display: 'inline-block', marginTop: 16, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', textDecoration: 'none', padding: '12px 24px', borderRadius: 8, fontWeight: 600 }}>
            Open Mirror
          </a>
        </>
      )}
      {state.kind === 'error' && (
        <>
          <h2 style={{ color: '#fff', margin: '0 0 8px' }}>Couldn't confirm</h2>
          <p style={{ color: '#fca5a5', lineHeight: 1.6 }}>{state.message}</p>
          <a href="/dashboard" style={{ color: '#a5b4fc' }}>Back to Mirror</a>
        </>
      )}
    </div>
  );
}
