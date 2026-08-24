// services/intakeProgressApi.ts
// ----------------------------------------------------------------------------
// Client for the authenticated Core per-step progress endpoint built + verified
// in the backend (Phase 2). Read-only here — the dashboard "Deepen your Mirror"
// card reads this to show which deep-intake steps remain. Same auth pattern as
// the other intake calls: JWT from getToken('mirror_jwt') as a Bearer header.
// ----------------------------------------------------------------------------

import { getToken } from '../utils/token';

const PROGRESS_URL = '/mirror/api/intake/progress';

export type CoreStepKey = 'visual' | 'vocal' | 'iq' | 'astrology' | 'personality';
export type StepStatus = 'not_started' | 'in_progress' | 'completed';

export interface IntakeStepProgress {
  step: CoreStepKey;
  status: StepStatus;
  completedAt: string | null;
}

export interface IntakeProgressResponse {
  steps: IntakeStepProgress[];
  intakeCompleted: boolean;
}

/**
 * Fetch the five Core steps' progress. Returns null (never throws) when there
 * is no session or the request fails — the card then simply hides, rather than
 * breaking the dashboard.
 */
export async function fetchIntakeProgress(): Promise<IntakeProgressResponse | null> {
  const token = getToken('mirror_jwt');
  if (!token) return null;
  try {
    const res = await fetch(PROGRESS_URL, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      credentials: 'include',
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.success || !Array.isArray(json.steps)) return null;
    return { steps: json.steps as IntakeStepProgress[], intakeCompleted: !!json.intakeCompleted };
  } catch {
    return null;
  }
}
