// components/intake/entry/logic/entryDraft.ts
// ----------------------------------------------------------------------------
// One-sitting resume for the Entry flow. The Entry draft is small and text-only
// (name, birth fields, Likert answers, step index) so localStorage is the right
// tool — no blobs, no cross-device requirement (per the design: server draft is
// for Core, client draft for Entry). Every access is try/caught for Safari
// private mode. Cleared on successful submit.
// ----------------------------------------------------------------------------

const KEY = 'mirror_entry_draft_v1';

export interface EntryDraft {
  step: number;
  name?: string;
  birthDate?: string;
  birthTime?: string;
  birthPlace?: string;
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
