// components/dashboard/intakeStepCatalog.ts
// ----------------------------------------------------------------------------
// Static, human-facing content for the five Core intake steps — titles,
// descriptions, benefits, time estimates, and the route each step deep-links to.
// Kept as data, separate from the progress logic and the card UI, so copy can be
// edited without touching behavior. Ordered by "deepen next" value: the two
// sections Entry already seeds (personality, astrology) come first as upgrades,
// then cognitive, then the heavier media steps.
// ----------------------------------------------------------------------------

import type { CoreStepKey } from '../../services/intakeProgressApi';

export interface IntakeStepMeta {
  key: CoreStepKey;
  title: string;
  description: string;
  benefit: string;
  estMinutes: number;
  route: string;
  emoji: string;
}

export const INTAKE_STEP_CATALOG: IntakeStepMeta[] = [
  {
    key: 'personality',
    title: 'Personality Deep-Dive',
    description: 'The full Big Five + MBTI assessment.',
    benefit: 'Upgrades your preliminary type into a precise, high-confidence profile.',
    estMinutes: 15,
    route: '/intake/personality',
    emoji: '🧠',
  },
  {
    key: 'astrology',
    title: 'Full Astrology',
    description: 'A precise birth chart with rising sign and houses.',
    benefit: 'Adds moon, rising, and house placements to your chart.',
    estMinutes: 2,
    route: '/intake/astrology',
    emoji: '☾',
  },
  {
    key: 'iq',
    title: 'Cognitive Assessment',
    description: 'A 30-item reasoning assessment.',
    benefit: 'Reveals your cognitive strengths and percentile.',
    estMinutes: 8,
    route: '/intake/iq',
    emoji: '📊',
  },
  {
    key: 'visual',
    title: 'Facial Reflection',
    description: 'A single photo for expression analysis.',
    benefit: 'Adds an emotional-expression layer to your Mirror.',
    estMinutes: 2,
    route: '/intake/visual',
    emoji: '🪞',
  },
  {
    key: 'vocal',
    title: 'Voice Reflection',
    description: 'A short spoken introduction.',
    benefit: 'Adds vocal tone and quality to your profile.',
    estMinutes: 2,
    route: '/intake/vocal',
    emoji: '🎙️',
  },
];

/** Stable lookup by step key. */
export const INTAKE_STEP_META: Record<CoreStepKey, IntakeStepMeta> = INTAKE_STEP_CATALOG.reduce(
  (acc, m) => { acc[m.key] = m; return acc; },
  {} as Record<CoreStepKey, IntakeStepMeta>
);
