// services/coreDraftLocal.ts
// ----------------------------------------------------------------------------
// SINGLE SOURCE OF TRUTH for the on-device (localStorage) resume keys of the two
// long Core steps. The step components read/write their own draft through these
// constants, and the dashboard "Erase" affordance clears them through
// clearLocalCoreDraft — so an erase wipes progress on BOTH tiers (server draft
// + this device's localStorage), not just the server.
//
// Why this module exists: before it, the dashboard erase called only the server
// DELETE, leaving the localStorage draft intact — so clicking Start still
// resumed where the user left off. Centralizing the keys here means the card and
// the steps can never disagree about what "erase" must remove.
// ----------------------------------------------------------------------------

import type { CoreDraftStep } from './coreDraftMerge';

// Per-step localStorage keys. If a step's key changes, change it HERE only.
export const LOCAL_DRAFT_KEYS: Record<CoreDraftStep, readonly string[]> = {
  iq: ['mirror:intake:iq:progress'],
  personality: ['mirror:intake:personality:progress:v3'],
};

/** The primary resume key for a step (what the step reads/writes on device). */
export function localDraftKey(step: CoreDraftStep): string {
  return LOCAL_DRAFT_KEYS[step][0];
}

/**
 * Remove a step's on-device draft so the next mount starts fresh. Fail-safe
 * (Safari private mode / disabled storage throw) — never throws into the caller.
 */
export function clearLocalCoreDraft(step: CoreDraftStep): void {
  try {
    for (const key of LOCAL_DRAFT_KEYS[step] ?? []) {
      localStorage.removeItem(key);
    }
  } catch {
    /* localStorage unavailable — nothing to clear */
  }
}
