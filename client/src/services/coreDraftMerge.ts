// services/coreDraftMerge.ts
// ----------------------------------------------------------------------------
// PURE draft-progress + conflict-resolution logic for the two long Core steps
// (IQ, Personality). No I/O, no React — unit-tested in isolation.
//
// "Furthest progress wins": when a user has a local (this-device) draft and a
// server (other-device) draft, we hydrate whichever has MORE answered — decided
// from the draft CONTENT itself, so we never depend on a device clock. Ties keep
// the LOCAL draft (the device they're on), avoiding a needless overwrite.
//
// Draft shapes (must match the step components exactly):
//   IQ:          { questions[], currentQuestionIndex, userAnswers: {id: string|null}, showResult }
//   Personality: { orderIds[], index, answers: {id: ...} }
// ----------------------------------------------------------------------------

export type CoreDraftStep = 'iq' | 'personality';

function isObj(x: unknown): x is Record<string, any> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

/**
 * How many questions a draft has answered. Content-derived, defensive against
 * malformed drafts (returns 0, never throws). This is the sole basis for the
 * furthest-progress decision, so it must count real answers, not cursor drift.
 */
export function draftAnsweredCount(step: CoreDraftStep, draft: unknown): number {
  if (!isObj(draft)) return 0;
  if (step === 'iq') {
    if (isObj(draft.userAnswers)) {
      return Object.values(draft.userAnswers).filter((v) => v !== null && v !== undefined && v !== '').length;
    }
    return typeof draft.currentQuestionIndex === 'number' && draft.currentQuestionIndex > 0
      ? Math.floor(draft.currentQuestionIndex)
      : 0;
  }
  // personality
  if (isObj(draft.answers)) return Object.keys(draft.answers).length;
  return typeof draft.index === 'number' && draft.index > 0 ? Math.floor(draft.index) : 0;
}

export interface DraftProgress {
  answered: number;
  total: number;      // 0 when unknown
  percent: number;    // 0..100, integer; 0 when total unknown
}

/**
 * Answered/total/percent for a draft — powers the MyMirror "resume" banner.
 * `total` comes from the draft's own question list (questions[]/orderIds[]);
 * unknown total yields percent 0 (we show "in progress" rather than a wrong %).
 */
export function draftProgress(step: CoreDraftStep, draft: unknown): DraftProgress {
  const answered = draftAnsweredCount(step, draft);
  let total = 0;
  if (isObj(draft)) {
    if (step === 'iq' && Array.isArray(draft.questions)) total = draft.questions.length;
    else if (step === 'personality' && Array.isArray(draft.orderIds)) total = draft.orderIds.length;
  }
  const percent = total > 0 ? Math.min(100, Math.round((answered / total) * 100)) : 0;
  return { answered, total, percent };
}

export interface DraftChoice<T = unknown> {
  source: 'local' | 'server' | 'none';
  draft: T | null;
  localCount: number;
  serverCount: number;
}

/**
 * Furthest-progress wins; a tie (or local ahead) keeps LOCAL. Absent drafts
 * score -1 so a present draft always beats nothing. Never throws.
 */
/** What the server returned for a step's draft on hydrate (subset we act on). */
export interface ServerDraftView {
  erased?: boolean;
  draftState?: Record<string, unknown> | null;
}

/** The one-shot hydrate decision, as a pure value the hook dispatches on. */
export type HydrateAction =
  | { type: 'none' }
  | { type: 'erase' }
  | { type: 'apply'; draft: Record<string, unknown> };

/**
 * Decide what a device should do on mount given the server's view and the local
 * draft. Precedence:
 *   1. erase tombstone  -> 'erase'  (authoritative across devices; wipe local)
 *   2. server draft further along than local -> 'apply' (furthest-progress-wins)
 *   3. otherwise -> 'none' (keep local; also the offline / never-started case)
 * Pure + total: never throws, safe on null/garbage.
 */
export function decideHydrate(
  step: CoreDraftStep,
  server: ServerDraftView | null | undefined,
  local: Record<string, unknown> | null,
): HydrateAction {
  if (!server) return { type: 'none' };
  if (server.erased) return { type: 'erase' };
  if (!server.draftState) return { type: 'none' };
  const choice = chooseFurthestDraft(step, local, server.draftState);
  return choice.source === 'server' && choice.draft
    ? { type: 'apply', draft: choice.draft as Record<string, unknown> }
    : { type: 'none' };
}

export function chooseFurthestDraft<T>(step: CoreDraftStep, local: T | null | undefined, server: T | null | undefined): DraftChoice<T> {
  const hasLocal = local !== null && local !== undefined;
  const hasServer = server !== null && server !== undefined;
  const localCount = hasLocal ? draftAnsweredCount(step, local) : -1;
  const serverCount = hasServer ? draftAnsweredCount(step, server) : -1;

  if (!hasLocal && !hasServer) return { source: 'none', draft: null, localCount: 0, serverCount: 0 };
  if (serverCount > localCount) {
    return { source: 'server', draft: (server as T), localCount: Math.max(localCount, 0), serverCount };
  }
  if (hasLocal) {
    return { source: 'local', draft: (local as T), localCount, serverCount: Math.max(serverCount, 0) };
  }
  return { source: 'server', draft: (server as T), localCount: 0, serverCount };
}
