// ============================================================================
// EMAIL VERIFICATION API SERVICE
// ============================================================================
// File: services/emailVerificationApi.ts
// Frontend API calls for email verification flow.
// ============================================================================

import { getToken } from '../utils/token';

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/mirror/api/auth`
  : '/mirror/api/auth';

async function authRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({ error: 'Request failed', code: 'UNKNOWN' }));

  if (!response.ok) {
    throw { status: response.status, ...data };
  }

  return data;
}

/** Send a verification email to the authenticated user */
export async function sendVerificationEmail(): Promise<{
  message: string;
  expiresIn?: string;
  verified?: boolean;
}> {
  return authRequest('/send-verification', { method: 'POST' });
}

/** Verify an email token (from the verification link) */
export async function verifyEmailToken(token: string): Promise<{
  message: string;
  verified: boolean;
}> {
  return authRequest('/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

/** Check current verification status */
export async function getVerificationStatus(): Promise<{
  email: string;
  verified: boolean;
  pendingVerification: boolean;
  lastSentAt: string | null;
  canResend: boolean;
}> {
  return authRequest('/verification-status');
}
