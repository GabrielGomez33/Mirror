// ============================================================================
// intakeRouting — PURE routing/access decisions for the two-tier intake.
// ============================================================================
// Extracted from RouteProtection so the exact decisions that caused the
// conversion incident are unit-testable without React/DOM. The component and
// AuthContext import these; there is ONE definition of "entry satisfied" so the
// gate and the route guard can never drift apart.
//
// The incident this memorialises: newly-registered users (initial_intake_completed
// = false, no core progress) were routed into the deep Core intake instead of the
// fast Entry onboarding, and near-zero signups converted. The fix routes such
// users to /entry, while NEVER bouncing an established user (core done, or the
// legacy monolithic intake done) back into Entry.
// ============================================================================

// URL segments used in routes under /intake/*
export const INTAKE_SEGMENTS = ['visual', 'vocal', 'iq', 'astrology', 'personality', 'submit', 'results'] as const;
export type IntakeSegment = typeof INTAKE_SEGMENTS[number];

// IntakeContext progress step keys
export type ProgressStepKey =
  | 'VisualStep'
  | 'VocalStep'
  | 'IQStep'
  | 'AstroLogicalStep'
  | 'PersonalityStep'
  | 'SubmitStep'
  | 'ResultsStep';

// Map URL segment → progress step key
export const SEGMENT_TO_PROGRESS: Record<IntakeSegment, ProgressStepKey> = {
  visual: 'VisualStep',
  vocal: 'VocalStep',
  iq: 'IQStep',
  astrology: 'AstroLogicalStep',
  personality: 'PersonalityStep',
  submit: 'SubmitStep',
  results: 'ResultsStep',
};

export type StepStatus = { completed: boolean; data?: Record<string, unknown> };
export type ProgressShape = {
  lastStep?: string;
  completed?: boolean;
  steps?: Partial<Record<ProgressStepKey, StepStatus>>;
} | undefined;

export function getCurrentIntakeSegment(pathname: string): IntakeSegment | null {
  const parts = pathname.split('/').filter(Boolean);
  const idx = parts.indexOf('intake');
  if (idx < 0) return null;
  const seg = parts[idx + 1] || null;
  return (seg && INTAKE_SEGMENTS.includes(seg as IntakeSegment)) ? (seg as IntakeSegment) : null;
}

export function indexOfSeg(seg: IntakeSegment): number {
  return INTAKE_SEGMENTS.indexOf(seg);
}

export function isAfter(a: IntakeSegment, b: IntakeSegment): boolean {
  return indexOfSeg(a) > indexOfSeg(b);
}

export function getFirstIncompleteSegment(progress: ProgressShape): IntakeSegment {
  for (const seg of INTAKE_SEGMENTS) {
    const stepKey = SEGMENT_TO_PROGRESS[seg];
    const s = progress?.steps?.[stepKey];
    if (!s?.completed) return seg;
  }
  return 'results';
}

export function isSegmentCompleted(progress: ProgressShape, seg: IntakeSegment): boolean {
  const stepKey = SEGMENT_TO_PROGRESS[seg];
  return Boolean(progress?.steps?.[stepKey]?.completed);
}

// ============================================================================
// ENTRY ACCESS — the conversion-critical decision
// ============================================================================

// Routes that must NEVER trigger an Entry-intake bounce (you are already there,
// authenticating, or on a public surface). Intake routes are exempt too so the
// Core flow's own routing owns them.
export const ENTRY_EXEMPT_ROUTES: ReadonlySet<string> = new Set([
  '/entry', '/intake', '/login', '/register', '/home', '/landing', '/test',
]);

export function isIntakeRoute(pathname: string): boolean {
  return pathname === '/intake' || pathname.startsWith('/intake/');
}

export function isEntryExemptRoute(pathname: string): boolean {
  return ENTRY_EXEMPT_ROUTES.has(pathname) || isIntakeRoute(pathname);
}

/**
 * The single definition of "entry satisfied": the fast Entry intake is done OR
 * the deeper Core intake is done (core implies entry — this also covers legacy
 * users whose initial_intake_completed was never backfilled). Used by BOTH the
 * AuthContext ENTRY_REQUIRED access level and the RouteProtection guard.
 */
export function entrySatisfied(isInitialIntakeCompleted: boolean, isIntakeCompleted: boolean): boolean {
  return Boolean(isInitialIntakeCompleted) || Boolean(isIntakeCompleted);
}

export interface EntryRedirectInput {
  isAuthenticated: boolean;
  isInitialIntakeCompleted: boolean;
  isIntakeCompleted: boolean;
  pathname: string;
}

/**
 * Should an authenticated user be redirected to /entry? True only when they are
 * authenticated, have satisfied NEITHER entry nor core, and are on a
 * non-exempt route. This is the exact predicate behind the conversion fix.
 */
export function shouldRedirectToEntry(input: EntryRedirectInput): boolean {
  return (
    input.isAuthenticated &&
    !entrySatisfied(input.isInitialIntakeCompleted, input.isIntakeCompleted) &&
    !isEntryExemptRoute(input.pathname)
  );
}
