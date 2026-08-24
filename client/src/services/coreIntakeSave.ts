// services/coreIntakeSave.ts
// ----------------------------------------------------------------------------
// Per-step Core intake save. Lets a user complete ONE deep-intake test at a
// time (from the "Deepen your Mirror" card) and have it persisted + marked
// complete independently — instead of only through the monolithic SubmitStep.
//
// It POSTs just that section to /mirror/api/intake/store. The backend accepts a
// payload with >= 1 section (EMPTY_INTAKE guard), the legacy bridge marks the
// corresponding step 'completed' and re-derives intake_completed, and the
// deep-merge read-model assembles this partial record into the full profile.
// Structured sections only (faceAnalysis / voiceMetadata / iqResults /
// astrologicalResult / personalityResult) — no file upload needed for the
// dashboard + Dina to light up.
// ----------------------------------------------------------------------------

import { getToken, getUserInfo } from '../utils/token';

const STORE_URL = '/mirror/api/intake/store';

/**
 * Persist a single Core section. Returns true on success. Never throws — the
 * caller decides how to surface failure. The backend derives the user from the
 * JWT; the body userId is legacy/compat only.
 */
export async function saveCoreSection(section: Record<string, unknown>): Promise<boolean> {
  const token = getToken('mirror_jwt');
  const user = getUserInfo();
  if (!token || !user) return false;
  try {
    const res = await fetch(STORE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      credentials: 'include',
      body: JSON.stringify({
        userId: user.userId,
        intakeData: { userLoggedIn: true, name: user.username, ...section },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
