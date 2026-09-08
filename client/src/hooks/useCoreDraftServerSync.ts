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
import { decideHydrate, type CoreDraftStep } from '../services/coreDraftMerge';

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
   * The decision is a pure function (decideHydrate):
   *   - 'erase'  the server holds an erase tombstone → wipe this device's stale
   *              local draft and reset the step to fresh (erase is authoritative
   *              across every device, not just the one that clicked it).
   *   - 'apply'  the server draft is further along → adopt it (furthest wins).
   *   - 'none'   keep local (also the offline / never-started case).
   * The isTouched() gate (re-checked after the await) means a user who has
   * already started here is never overridden.
   */
  const hydrateOnce = useCallback((opts: {
    localDraft: () => Record<string, unknown> | null;
    isTouched: () => boolean;
    apply: (draft: Record<string, unknown>) => void;
    onServerErased?: () => void;
  }) => {
    let cancelled = false;
    void (async () => {
      const server = await loadCoreDraft(step);
      if (cancelled || opts.isTouched()) return;
      const action = decideHydrate(step, server, opts.localDraft());
      if (opts.isTouched()) return; // re-check post-await — never clobber active input
      if (action.type === 'erase') opts.onServerErased?.();
      else if (action.type === 'apply') opts.apply(action.draft);
    })();
    return () => { cancelled = true; };
  }, [step]);

  return { pushDraft, clearServerDraft, hydrateOnce };
}
