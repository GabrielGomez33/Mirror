// ============================================================================
// EMAIL CHANGE CONFIRMATION PAGE
// ============================================================================
// File: pages/VerifyEmailChangePage.tsx
// Handles the confirmation link sent to a user's NEW email address when they
// request an email change from Account Settings. Extracts the token from the
// URL query and calls the backend to apply the change.
// Route: /verify-email-change?token=xxxxx
// ============================================================================

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { confirmEmailChangeApi } from '../services/authApi';
import '../styles/enhanced-glass.css';

export default function VerifyEmailChangePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');
  const [newEmail, setNewEmail] = useState('');
  // StrictMode double-invokes effects in dev; the token is single-use, so guard
  // against the second call consuming-then-reporting "already used".
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    if (!token) {
      setStatus('error');
      setMessage('No confirmation token provided.');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const result = await confirmEmailChangeApi(token);
        if (cancelled) return;
        setStatus('success');
        setMessage(result.message || 'Your email address has been updated.');
        if (result.email) setNewEmail(result.email);
      } catch (err: any) {
        if (cancelled) return;
        setStatus('error');
        setMessage(
          err?.error ||
          err?.message ||
          'Confirmation failed. The link may have expired or already been used.'
        );
      }
    })();

    return () => { cancelled = true; };
  }, [token]);

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #1a0a10, #2d1220, #1a0a15)' }}
    >
      <div className="enhanced-glass-panel max-w-md w-full mx-4 text-center">
        {/* Verifying */}
        {status === 'verifying' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-400 mx-auto mb-4" />
            <h2 className="enhanced-glass-heading text-xl mb-2">Confirming your new email...</h2>
            <p className="enhanced-glass-subtle text-sm">Please wait a moment.</p>
          </>
        )}

        {/* Success */}
        {status === 'success' && (
          <>
            <div
              className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(34, 197, 94, 0.15)' }}
            >
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M8 16l5.5 5.5L24 10" stroke="rgba(134,239,172,0.95)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="enhanced-glass-heading text-xl mb-2">Email updated</h2>
            <p className="enhanced-glass-subtle text-sm mb-6">
              {newEmail
                ? <>Your account email is now <strong>{newEmail}</strong>. Use it next time you sign in.</>
                : message}
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="enhanced-action-button px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{
                background: 'linear-gradient(135deg, #ff69b4, #ff1493)',
                boxShadow: '0 4px 20px rgba(255, 105, 180, 0.3)',
                transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 28px rgba(255, 105, 180, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(255, 105, 180, 0.3)';
              }}
            >
              Go to Dashboard
            </button>
          </>
        )}

        {/* Error */}
        {status === 'error' && (
          <>
            <div
              className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(239, 68, 68, 0.15)' }}
            >
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M20 12L12 20M12 12l8 8" stroke="rgba(252,165,165,0.95)" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
            <h2 className="enhanced-glass-heading text-xl mb-2">Confirmation Failed</h2>
            <p className="enhanced-glass-body text-sm mb-6">{message}</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-5 py-2 rounded-xl text-sm enhanced-glass-subtle hover:text-white/90 transition-colors"
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
              }}
            >
              Go to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}