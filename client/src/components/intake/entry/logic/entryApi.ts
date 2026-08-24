// components/intake/entry/logic/entryApi.ts
// ----------------------------------------------------------------------------
// Client for the authenticated Entry intake endpoints (built + verified in the
// backend Phase 3). Mirrors SubmitStep's auth pattern: same-origin relative URL,
// JWT from getToken('mirror_jwt') as a Bearer header, credentials included.
// ----------------------------------------------------------------------------

import { getToken } from '../../../../utils/token';

const ENTRY_SUBMIT = '/mirror/api/intake/entry/submit';
const ENTRY_STATUS = '/mirror/api/intake/entry/status';

export interface EntrySubmitPayload {
  personalityResult?: unknown;
  astrologyResult?: unknown;
  birthDate?: string;
  birthTime?: string;
  birthPlace?: string;
  displayName?: string;
}

async function authFetch(
  url: string,
  init: RequestInit = {},
  timeoutMs = 30000
): Promise<{ ok: boolean; status: number; json: any }> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  const token = getToken('mirror_jwt');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init.headers as Record<string, string>) || {}),
  };
  try {
    const res = await fetch(url, { ...init, headers, credentials: 'include', signal: controller.signal });
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
    return { ok: res.ok, status: res.status, json };
  } finally {
    clearTimeout(id);
  }
}

/** Error thrown by the Entry API, carrying the HTTP status for the caller. */
export class EntryApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'EntryApiError';
    this.status = status;
  }
}

/** POST the Entry result. Throws EntryApiError (with .status) on failure. */
export async function submitEntryIntake(payload: EntrySubmitPayload): Promise<any> {
  const { ok, status, json } = await authFetch(ENTRY_SUBMIT, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!ok) throw new EntryApiError(json?.error || `Entry submission failed (HTTP ${status}).`, status);
  return json;
}

/** GET Entry completion status ({ completed, result }) or null on failure. */
export async function getEntryStatus(): Promise<{ completed: boolean; result: any } | null> {
  const { ok, json } = await authFetch(ENTRY_STATUS, { method: 'GET' });
  return ok ? json : null;
}
