// components/home/RetakeSectionButton.tsx
// ----------------------------------------------------------------------------
// The per-tab "Retake" affordance on MyMirror's section tabs (personality,
// astrology, cognitive, emotional, voice). Renders nothing for a non-section
// tab. On click it (1) confirms when there is existing data to overwrite,
// (2) clears any stale draft so the retake starts fresh, then (3) deep-links
// into the section's Core step in deepen mode. All the intake/storage/draft
// logic lives in services/retakeIntake + the existing Core flow — this file is
// only the button.
// ----------------------------------------------------------------------------

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  coreStepForTab,
  resetDraftForRetake,
  retakePathForStep,
  RETAKE_CONFIRM,
} from '../../services/retakeIntake';

interface RetakeSectionButtonProps {
  /** The active MyMirror tab id. */
  tab: string;
  /** Whether this section already has data (drives the label + confirm prompt). */
  available: boolean;
}

export default function RetakeSectionButton({ tab, available }: RetakeSectionButtonProps) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const step = coreStepForTab(tab);

  // Not a retakeable section (overview / analysis / answers / meta / export).
  if (!step) return null;

  const handleClick = async () => {
    if (busy) return;
    // Only guard with a confirm when there is real data that a retake overwrites.
    // A first-time "Take now" needs no confirmation.
    if (available && typeof window !== 'undefined' && !window.confirm(RETAKE_CONFIRM)) return;
    setBusy(true);
    try {
      await resetDraftForRetake(step);
    } finally {
      // Navigate even if the best-effort draft clear rejected — the step still
      // starts correctly, and resetDraftForRetake already swallows its own errors.
      navigate(retakePathForStep(step));
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
      <button
        type="button"
        className="enhanced-action-button"
        onClick={() => void handleClick()}
        disabled={busy}
        aria-label={available ? 'Retake this assessment' : 'Take this assessment'}
        title={available ? 'Retake this assessment' : 'Take this assessment'}
        style={{ fontSize: 12, padding: '6px 14px', opacity: busy ? 0.6 : 1, cursor: busy ? 'default' : 'pointer' }}
      >
        {busy ? 'Opening…' : available ? '↻ Retake' : '+ Take now'}
      </button>
    </div>
  );
}
