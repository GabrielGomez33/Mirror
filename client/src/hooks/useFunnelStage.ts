// hooks/useFunnelStage.ts
// ----------------------------------------------------------------------------
// One-liner funnel instrumentation for "view" stages: fire a conversion event
// once, when `when` first becomes true, guarded against React StrictMode double
// mounts. Fire-and-forget + fail-safe (see services/conversionApi) — it can
// never block or break the component. Action stages (signup_completed,
// entry_first_value, premium_activated) call trackFunnelStage directly at the
// success point instead.
// ----------------------------------------------------------------------------

import { useEffect, useRef } from 'react';
import { trackFunnelStage } from '../services/conversionApi';
import type { FunnelStage } from '../services/conversionFunnel';

export function useFunnelStage(stage: FunnelStage, when: boolean = true): void {
  const fired = useRef(false);
  useEffect(() => {
    if (!when || fired.current) return;
    fired.current = true;
    trackFunnelStage(stage);
  }, [stage, when]);
}
