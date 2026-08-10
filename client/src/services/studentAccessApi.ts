// ============================================================================
// STUDENT ACCESS API SERVICE
// ============================================================================
// File: services/studentAccessApi.ts
// Frontend API calls for the student free-Premium flow.
// Mirrors services/emailVerificationApi.ts (same auth + error contract).
// ============================================================================

import { getToken } from '../utils/token';

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/mirror/api/student`
  : '/mirror/api/student';

export interface ApiError {
  status: number;
  error: string;
  code?: string;
  retryAfter?: number;
}

async function request<T>(path: string, options: RequestInit = {}, withAuth = true): Promise<T> {
  const token = withAuth ? getToken() : null;
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({ error: 'Request failed', code: 'UNKNOWN' }));
  if (!response.ok) {
    throw { status: response.status, ...data } as ApiError;
  }
  return data as T;
}

export interface StudentStatus {
  enabled: boolean;
  isStudent: boolean;
  status: 'active' | 'expired' | 'revoked' | null;
  campusEmail?: string;
  institutionDomain?: string;
  verifiedAt?: string | null;
  expiresAt?: string | null;
  daysLeft?: number | null;
}

/** Start verification: emails a confirmation link to the campus address. */
export async function requestStudentVerification(
  campusEmail: string,
  attest18: boolean,
): Promise<{ message: string; expiresIn?: string }> {
  return request('/request', {
    method: 'POST',
    body: JSON.stringify({ campusEmail, attest18 }),
  });
}

/** Confirm the emailed token (grants the comp). No auth needed — token is the credential. */
export async function verifyStudentToken(token: string): Promise<{
  verified: boolean;
  premiumGranted?: boolean;
  alreadyPremium?: boolean;
  accessUntil?: string;
  message?: string;
}> {
  return request('/verify', { method: 'POST', body: JSON.stringify({ token }) }, false);
}

/** Current student state for the authenticated user (drives the UI). */
export async function getStudentStatus(): Promise<StudentStatus> {
  return request('/status');
}
