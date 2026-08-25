// components/intake/entry/logic/entryDraft.ts
// ----------------------------------------------------------------------------
// One-sitting resume for the Entry flow. The Entry draft is small and text-only
// (birth fields + resolved coordinates, Likert answers, step index) so
// localStorage is the right tool — no blobs, no cross-device requirement (per
// the design: server draft is for Core, client draft for Entry). The user's
// display name is NOT collected here — they already registered, so it comes from
// the authenticated session. Every access is try/caught for Safari private mode.
// Cleared on successful submit.
// ----------------------------------------------------------------------------

const KEY = 'mirror_entry_draft_v1';

export interface EntryDraft {
  step: number;
  birthDate?: string;
  birthTime?: string;
  /** The raw place query the user typed. */
  birthPlace?: string;
  /** The resolved, normalized place label (city, region, country). */
  birthPlaceLabel?: string;
  /** Resolved coordinates — enable a real Rising sign + houses on resume. */
  birthLat?: number;
  birthLon?: number;
  /** questionId -> { value, score } (a valid AssessmentAnswer) */
  answers?: Record<string, { value: string; score: number }>;
}

export function loadEntryDraft(): EntryDraft | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as EntryDraft) : null;
  } catch {
    return null;
  }
}

export function saveEntryDraft(draft: EntryDraft): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    /* storage unavailable — draft resume is best-effort */
  }
}

export function clearEntryDraft(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
