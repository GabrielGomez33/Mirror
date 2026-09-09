// services/retakeIntake.ts
// ----------------------------------------------------------------------------
// RETAKE: let a user redo a single Core intake section from its MyMirror tab.
// A "retake" reuses the existing per-section Core flow end to end — the same
// step component, the same resumable-draft machinery, and the same
// saveCoreSection (`POST /mirror/api/intake/store`) that an initial Core intake
// uses. The read-model's leaf-level merge then overlays the fresh section over
// the old one (newer non-empty wins), so a completed section is never left with
// a gap while a retake is in flight, and an abandoned retake cannot downgrade a
// completed step (the server refuses that).
//
// This module is the SEAM between a MyMirror tab and that flow: it maps a tab to
// its Core step, builds the deep-link, and clears any stale draft so a retake
// starts fresh. Pure + tiny so it is unit-tested in isolation (see
// scripts/retakeIntake.test.ts) — the UI (RetakeSectionButton) only calls it.
// ----------------------------------------------------------------------------

import type { CoreStepKey } from './intakeProgressApi';
import { INTAKE_STEP_META } from '../components/dashboard/intakeStepCatalog';
import { clearLocalCoreDraft } from './coreDraftLocal';
import { clearCoreDraft } from './coreDraftApi';
import type { CoreDraftStep } from './coreDraftMerge';

/** MyMirror tab ids that map to a retakeable Core intake section. */
export type RetakeableTab = 'personality' | 'astrology' | 'cognitive' | 'emotional' | 'voice';

/**
 * Tab → Core step key. The names differ where the tab's THEME differs from the
 * step's MECHANISM: the "cognitive" tab is driven by the IQ step, the
 * "emotional" tab by the visual (face/expression) step, and the "voice" tab by
 * the vocal step. personality/astrology line up 1:1.
 */
export const TAB_TO_CORE_STEP: Record<RetakeableTab, CoreStepKey> = {
  personality: 'personality',
  astrology: 'astrology',
  cognitive: 'iq',
  emotional: 'visual',
  voice: 'vocal',
};

export function isRetakeableTab(tab: string): tab is RetakeableTab {
  return Object.prototype.hasOwnProperty.call(TAB_TO_CORE_STEP, tab);
}

/** The Core step a tab retakes, or null for a non-section tab (overview, etc.). */
export function coreStepForTab(tab: string): CoreStepKey | null {
  return isRetakeableTab(tab) ? TAB_TO_CORE_STEP[tab] : null;
}

/**
 * The route a retake must navigate to.
 *
 * CRITICAL: it MUST carry `?deepen=1`. Without it, RouteProtection bounces a
 * core-complete user straight back to /dashboard (its "completed → dashboard"
 * rule), so the retake step would never render. Deepen mode is exactly the
 * bypass that lets an already-completed step be re-entered on purpose. The
 * retakeIntake test pins this invariant so a refactor can't silently drop it.
 */
export function retakePathForStep(step: CoreStepKey): string {
  return `${INTAKE_STEP_META[step].route}?deepen=1`;
}

export function retakePathForTab(tab: string): string | null {
  const step = coreStepForTab(tab);
  return step ? retakePathForStep(step) : null;
}

// Only the two long steps carry a resumable draft (server + localStorage).
const RESUMABLE_DRAFT_STEPS: ReadonlySet<CoreStepKey> = new Set<CoreStepKey>(['iq', 'personality']);

/**
 * Start a retake from a clean slate. For the two long, resumable steps
 * (iq, personality) clear any lingering draft on BOTH tiers so the retake
 * begins fresh — like an initial intake — instead of silently resuming stale
 * answers from a half-finished earlier attempt. Best-effort and fail-safe: a
 * completed step has nothing to clear, and the server's draft-delete is a no-op
 * on a completed step (the erase endpoint never downgrades a completed step).
 * The short steps (astrology/visual/vocal) carry no draft — nothing to clear.
 */
export async function resetDraftForRetake(step: CoreStepKey): Promise<void> {
  if (!RESUMABLE_DRAFT_STEPS.has(step)) return;
  const draftStep = step as CoreDraftStep;
  clearLocalCoreDraft(draftStep);
  try {
    await clearCoreDraft(draftStep);
  } catch {
    /* fail-safe — a draft-clear failure must never block the retake */
  }
}

/** Confirmation copy shown before overwriting an existing (available) section. */
export const RETAKE_CONFIRM =
  'Retake this section? Your current results stay in place until you finish the new assessment.';
