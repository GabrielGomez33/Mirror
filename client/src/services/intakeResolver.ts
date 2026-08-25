// services/intakeResolver.ts
// ----------------------------------------------------------------------------
// THE single client-side entry point for reading a user's stored intake.
//
// It returns ALL data the client possesses for the user, already merged
// server-side: Entry ("initial") intake ⊕ Core (deep) intake, with CORE TAKING
// PRECEDENCE at every leaf (Core is the more valuable, more thorough source).
// Consumers must never hand-assemble intake from a single source again — read
// through getResolvedIntake() so an Entry-only user is never treated as empty
// and a partial Core save never masks an earlier fuller one.
//
// The merge itself lives on the server (services/intakeReadModel.resolveLatest),
// exposed over GET /mirror/api/intake/latest/:userId. This module is the thin,
// auth-aware, storage-backend-aware client seam over that endpoint.
// ----------------------------------------------------------------------------

import { getToken, getUserInfo } from '../utils/token';

const ROOT = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const API_BASE = ROOT ? `${ROOT}/mirror/api` : '/mirror/api';

/** The client's complete, merged view of a user's intake. */
export interface ResolvedIntake {
  /** Merged intake sections (personalityResult, astrologicalResult, iqResults,
   *  faceAnalysis, voiceMetadata, …). Core overlays Entry. Never partial-masked. */
  intakeData: Record<string, unknown> | null;
  /** Core-only media references (photo/voice); Entry carries no media. */
  fileReferences?: unknown;
}

export class IntakeResolverError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'IntakeResolverError';
    this.status = status;
  }
}

/**
 * Resolve the merged intake for a user.
 *
 * @param userId  Optional — defaults to the authenticated user from the stored
 *                userInfo blob. Pass explicitly only when reading on behalf of a
 *                known id you already hold.
 * @returns ResolvedIntake when the user has ANY intake (Entry or Core), or
 *          `null` when the user has none at all (HTTP 404). Throws
 *          IntakeResolverError only for auth/transport failures the caller
 *          should react to (401/403/5xx), never for the ordinary "no data yet".
 */
export async function getResolvedIntake(userId?: number | string): Promise<ResolvedIntake | null> {
  const id = userId ?? getUserInfo()?.userId;
  if (id === undefined || id === null || id === '') {
    // No identity to resolve — treat as "no data" rather than throwing, so
    // callers (e.g. the root gate) fall through to their unauthenticated path.
    return null;
  }

  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/intake/latest/${id}`, {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch (e) {
    // Network failure — surface as a typed error so the caller can retry/route.
    throw new IntakeResolverError(
      e instanceof Error ? e.message : 'Network error resolving intake',
      0,
    );
  }

  // 404 is the endpoint's canonical "this user has no intake at all" (neither
  // Entry nor Core). Return null — this is an expected state, not an error.
  if (res.status === 404) return null;

  if (!res.ok) {
    throw new IntakeResolverError(`Failed to resolve intake (HTTP ${res.status})`, res.status);
  }

  const json = await res.json().catch(() => null);
  if (!json || json.success === false) return null;

  return {
    intakeData: (json.intakeData as Record<string, unknown> | null) ?? null,
    fileReferences: json.fileReferences,
  };
}

/** Convenience: does this user have ANY resolvable intake (Entry or Core)? */
export async function hasAnyResolvableIntake(userId?: number | string): Promise<boolean> {
  const resolved = await getResolvedIntake(userId).catch(() => null);
  return Boolean(resolved && resolved.intakeData && Object.keys(resolved.intakeData).length > 0);
}
