// components/dashboard/intakeProgressLogic.ts
// ----------------------------------------------------------------------------
// PURE derivations for the "Deepen your Mirror" card — no React, no I/O — so the
// summary math is unit-testable and never hides in the component.
// ----------------------------------------------------------------------------

import type { IntakeStepProgress, StepStatus, CoreStepKey } from '../../services/intakeProgressApi';

export function completedCount(steps: IntakeStepProgress[]): number {
  return steps.filter((s) => s.status === 'completed').length;
}

/** Whole-percent completion (0–100). Empty list -> 0. */
export function progressPercent(steps: IntakeStepProgress[]): number {
  if (!steps.length) return 0;
  return Math.round((completedCount(steps) / steps.length) * 100);
}

/** Status for a given step key (missing -> 'not_started'). */
export function statusOf(steps: IntakeStepProgress[], key: CoreStepKey): StepStatus {
  return steps.find((s) => s.step === key)?.status ?? 'not_started';
}

/** True when every step is completed (card can then collapse / congratulate). */
export function allComplete(steps: IntakeStepProgress[]): boolean {
  return steps.length > 0 && steps.every((s) => s.status === 'completed');
}
