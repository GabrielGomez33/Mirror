// hooks/useCoreDraftServerSync.ts
// ----------------------------------------------------------------------------
// Server-backed cross-device draft sync for the two long Core steps (IQ,
// Personality). ONE concern, isolated here so the step components stay thin:
//   - pushDraft(snapshot): debounced, fail-safe save to the server (mirrors the
//     step's existing localStorage write; never affects render).
//   - hydrateOnce(...): one-shot cross-device resume — load the server draft and,
//     IF it is further along than local AND the user has NOT interacted since
//     mount, apply it. The isTouched() gate is the race guard: once the user
//     answers, a late-arriving server load can NEVER clobber their input.
//   - clearServerDraft(): the "start over / erase" affordance.
//
// All network is best-effort (coreDraftApi is fail-safe): server sync is a
// convenience on top of the existing on-device localStorage resume — it must
// never throw into a step's render or block the user.
// ----------------------------------------------------------------------------

import { useCallback, useEffect, useRef } from 'react';
import { loadCoreDraft, saveCoreDraft, clearCoreDraft } from '../services/coreDraftApi';
import { chooseFurthestDraft, type CoreDraftStep } from '../services/coreDraftMerge';

const SAVE_DEBOUNCE_MS = 1500;

export function useCoreDraftServerSync(step: CoreDraftStep) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flush any pending debounce on unmount so a final edit isn't dropped silently
  // and no timer fires after teardown.
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const pushDraft = useCallback((draft: unknown) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void saveCoreDraft(step, draft); }, SAVE_DEBOUNCE_MS);
  }, [step]);

  const clearServerDraft = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    void clearCoreDraft(step);
  }, [step]);

  /**
   * One-shot cross-device hydrate. Returns a cleanup that cancels a late load.
   * Applies the server draft only when it wins "furthest progress" over the
   * current local draft AND the user has not touched the step since mount.
   */
  const hydrateOnce = useCallback((opts: {
    localDraft: () => Record<string, unknown> | null;
    isTouched: () => boolean;
    apply: (draft: Record<string, unknown>) => void;
  }) => {
    let cancelled = false;
    void (async () => {
      const server = await loadCoreDraft(step);
      if (cancelled || opts.isTouched() || !server?.draftState) return;
      const choice = chooseFurthestDraft(step, opts.localDraft(), server.draftState);
      // Re-check isTouched() after the await: the user may have started while the
      // request was in flight — never override active input.
      if (choice.source === 'server' && choice.draft && !opts.isTouched()) {
        opts.apply(choice.draft as Record<string, unknown>);
      }
    })();
    return () => { cancelled = true; };
  }, [step]);

  return { pushDraft, clearServerDraft, hydrateOnce };
}
