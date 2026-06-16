// ============================================================================
// FEEDBACK API SERVICE
// ============================================================================
// File: client/src/services/feedbackApi.ts
// ----------------------------------------------------------------------------
// Thin REST client for the user-facing Feedback & Support page. Mirrors the
// shape of `mirrorDashboard.ts` so the wider codebase stays consistent.
//
// Endpoints:
//   POST /mirror/api/feedback         — create a submission
//   GET  /mirror/api/feedback/mine    — list current user's submissions
//   GET  /mirror/api/feedback/stats   — aggregate rating stats
//   GET  /mirror/api/feedback/limits  — current rate-limit budget
// ============================================================================

import { getToken } from '../utils/token';
import { dispatchPaywallEvent } from './paywallInterceptor';

const ROOT = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const BASE = ROOT ? `${ROOT}/mirror/api/feedback` : '/mirror/api/feedback';

// ============================================================================
// TYPES
// ============================================================================

export type FeedbackKind = 'rating' | 'issue' | 'recommendation' | 'contact';
export type FeedbackSeverity = 'low' | 'medium' | 'high' | 'critical';
export type FeedbackStatus = 'new' | 'triaged' | 'in_progress' | 'resolved' | 'wontfix';

export interface CreateFeedbackInput {
  kind: FeedbackKind;
  rating?: number | null;
  subject?: string | null;
  message?: string | null;
  contactEmail?: string | null;
  severity?: FeedbackSeverity | null;
  metadata?: Record<string, unknown> | null;
}

export interface CreatedFeedback {
  id: number;
  kind: FeedbackKind;
  rating: number | null;
  createdAt: string;
  message: string;
}

export interface MyFeedbackItem {
  id: number;
  kind: FeedbackKind;
  rating: number | null;
  subject: string | null;
  message: string | null;
  contactEmail: string | null;
  severity: FeedbackSeverity | null;
  status: FeedbackStatus;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface MyFeedbackPage {
  items: MyFeedbackItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface RatingStats {
  total: number;
  average: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface RateLimitBudget {
  max: number;
  remaining: number;
  resetSec: number;
  windowSec: number;
}

export class FeedbackApiError extends Error {
  status: number;
  code: string;
  retryAfterSec?: number;
  constructor(message: string, status: number, code: string, retryAfterSec?: number) {
    super(message);
    this.name = 'FeedbackApiError';
    this.status = status;
    this.code = code;
    this.retryAfterSec = retryAfterSec;
  }
}

// ============================================================================
// HTTP HELPER
// ============================================================================

function authHeaders(): HeadersInit {
  const token = getToken(); // mirror_jwt
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { ...authHeaders(), ...(init.headers || {}) },
      credentials: 'include',
    });
  } catch (networkErr) {
    const message =
      networkErr instanceof Error
        ? networkErr.message
        : 'Network error — please check your connection.';
    throw new FeedbackApiError(message, 0, 'NETWORK_ERROR');
  }

  let json: Record<string, unknown> | null = null;
  try {
    json = (await res.json()) as Record<string, unknown> | null;
  } catch {
    // Tolerate empty / non-JSON bodies — fall through to status-only error.
  }

  if (!res.ok) {
    const code  = typeof json?.code  === 'string' ? json.code  : 'REQUEST_FAILED';
    const msg   = typeof json?.error === 'string' ? json.error : `Request failed (${res.status})`;
    const retry = typeof json?.retryAfterSec === 'number' ? json.retryAfterSec : undefined;

    // Forward paywall / usage gates to the existing global modal (parity with
    // mirrorDashboard.ts) so this page never has to know how the gate is shown.
    if (res.status === 403 && (code === 'USAGE_LIMIT' || code === 'UPGRADE_REQUIRED')) {
      dispatchPaywallEvent({
        code,
        feature: typeof json?.feature === 'string' ? json.feature : undefined,
        error: msg,
        used:  typeof json?.used  === 'number' ? json.used  : undefined,
        limit: typeof json?.limit === 'number' ? json.limit : undefined,
      });
    }

    throw new FeedbackApiError(msg, res.status, code, retry);
  }

  return json as T;
}

// ============================================================================
// PUBLIC API
// ============================================================================

export async function createFeedback(input: CreateFeedbackInput): Promise<CreatedFeedback> {
  const body = pruneNulls({
    kind: input.kind,
    rating: input.rating ?? null,
    subject: input.subject ?? null,
    message: input.message ?? null,
    contactEmail: input.contactEmail ?? null,
    severity: input.severity ?? null,
    metadata: collectMetadata(input.metadata),
  });

  const json = await request<{ success: boolean; data: CreatedFeedback; rateLimit?: { remaining: number; resetSec: number } }>(
    '',
    { method: 'POST', body: JSON.stringify(body) },
  );
  return json.data;
}

export async function listMyFeedback(opts?: {
  kind?: FeedbackKind;
  limit?: number;
  offset?: number;
}): Promise<MyFeedbackPage> {
  const qs = new URLSearchParams();
  if (opts?.kind)   qs.set('kind',   opts.kind);
  if (opts?.limit)  qs.set('limit',  String(opts.limit));
  if (opts?.offset) qs.set('offset', String(opts.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';

  const json = await request<{ success: boolean; data: MyFeedbackPage }>(`/mine${suffix}`);
  return json.data;
}

export async function getRatingStats(): Promise<RatingStats> {
  const json = await request<{ success: boolean; data: RatingStats }>('/stats');
  return json.data;
}

export async function getRateLimitBudget(): Promise<RateLimitBudget> {
  const json = await request<{ success: boolean; data: RateLimitBudget }>('/limits');
  return json.data;
}

// ============================================================================
// METADATA COLLECTION
// ============================================================================
// Best-effort browser/device context the operator can use for triage. Pure
// client-side, no PII beyond what the user is already exposing to support.

function collectMetadata(extra?: Record<string, unknown> | null): Record<string, unknown> {
  const md: Record<string, unknown> = { ...(extra || {}) };
  if (typeof window !== 'undefined') {
    md.pageUrl = window.location?.href;
    md.userAgent = navigator?.userAgent;
    md.language = navigator?.language;
    md.platform = (navigator as Navigator & { platform?: string }).platform;
    md.viewport = { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio };
    md.appVersion = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_APP_VERSION || 'dev';
    md.submittedAt = new Date().toISOString();
    try { md.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* ignore */ }
  }
  return md;
}

function pruneNulls<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k of Object.keys(obj) as Array<keyof T>) {
    const v = obj[k];
    if (v === null || v === undefined) continue;
    out[k] = v;
  }
  return out;
}