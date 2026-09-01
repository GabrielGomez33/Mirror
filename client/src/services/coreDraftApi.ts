// services/coreDraftApi.ts
// ----------------------------------------------------------------------------
// Client for the server-backed RESUMABLE Core-draft endpoints (Phase 2). Lets
// the two long steps (IQ, Personality) sync partial answers to the server so a
// user can resume on another device. Same-origin relative URLs + JWT Bearer,
// exactly like intakeProgressApi.
//
// Two deliberate design choices:
//  - withAuthRetry: a draft autosaves *during* a long step, which is precisely
//    when a 15-min access token expires; refresh-and-retry-once prevents a
//    silent lost save (same pattern entryApi uses).
//  - FAIL-SAFE: every function swallows errors and returns a boolean / null.
//    Draft sync is a convenience layered on top of the existing localStorage
//    resume; it must NEVER throw into a step's render or block the user.
// ----------------------------------------------------------------------------

import { getToken } from '../utils/token';
import { withAuthRetry } from '../utils/authRetry';
import { refreshTokenApi } from './authApi';
import type { CoreDraftStep } from './coreDraftMerge';

const stepUrl = (step: CoreDraftStep) => `/mirror/api/intake/progress/${encodeURIComponent(step)}`;

interface Attempt { ok: boolean; status: number; json: any }

// One HTTP attempt. Reads the token at call time so a post-refresh retry uses
// the fresh token. 12s timeout — a draft save must not hang a step.
async function attempt(method: 'GET' | 'PUT' | 'DELETE', step: CoreDraftStep, body?: unknown): Promise<Attempt> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 12_000);
  const token = getToken('mirror_jwt');
  try {
    const res = await fetch(stepUrl(step), {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      signal: controller.signal,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    let json: any = null;
    try { const t = await res.text(); json = t ? JSON.parse(t) : null; } catch { /* non-JSON */ }
    return { ok: res.ok, status: res.status, json };
  } finally {
    clearTimeout(id);
  }
}

/**
 * Load one step's server draft. Returns { status, draftState } or null when
 * there is no session, no draft, or any failure (caller falls back to local).
 */
export async function loadCoreDraft(
  step: CoreDraftStep,
): Promise<{ status: string; draftState: Record<string, unknown> | null } | null> {
  if (!getToken('mirror_jwt')) return null;
  try {
    const r = await withAuthRetry(() => attempt('GET', step), refreshTokenApi);
    if (!r.ok || !r.json?.success) return null;
    return { status: String(r.json.status ?? 'not_started'), draftState: r.json.draftState ?? null };
  } catch {
    return null;
  }
}

/** Save one step's draft (partial answers). Returns true on success, never throws. */
export async function saveCoreDraft(step: CoreDraftStep, draftState: unknown): Promise<boolean> {
  if (!getToken('mirror_jwt')) return false;
  try {
    const r = await withAuthRetry(() => attempt('PUT', step, { draftState }), refreshTokenApi);
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * Erase one step's server draft, resetting the step to not_started (the "start
 * over / erase progress" affordance). Uses DELETE, which the server guards so a
 * COMPLETED step is never affected — safe to call on commit AND on restart,
 * in any order relative to the completion write. Fail-safe: returns false, never
 * throws.
 */
export async function clearCoreDraft(step: CoreDraftStep): Promise<boolean> {
  if (!getToken('mirror_jwt')) return false;
  try {
    const r = await withAuthRetry(() => attempt('DELETE', step), refreshTokenApi);
    return r.ok;
  } catch {
    return false;
  }
}
