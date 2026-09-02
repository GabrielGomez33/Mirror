// src/components/auth/rootGate.ts
// ----------------------------------------------------------------------------
// PURE decision for the root ("/") IntakeGate: where to send a visitor, based
// on their identity and the OUTCOME of resolving their merged intake.
//
// Extracted from App.tsx's IntakeGate so the exact decision is unit-testable
// without React/DOM — and so the conversion-critical invariant below is proven,
// not assumed. One definition, one test.
//
// THE INVARIANT THIS FIXES
//   getResolvedIntake() RETURNS null only for a DEFINITIVE "no intake" (HTTP
//   404). It THROWS for auth/transport failures (401/403/5xx/network). The old
//   gate collapsed BOTH the null case and the throw case to /entry — so an
//   already-onboarded user whose access token had merely EXPIRED at root-load (a
//   race with AuthContext's silent refresh) got a 401 on /intake/latest and was
//   stranded in the Entry onboarding: /entry is in ENTRY_EXEMPT_ROUTES, so
//   RouteProtection never routes them back off it.
//
//   A failed READ is not the same as "the user has no data". Only a 404 means
//   "not onboarded". An auth/transport error must fall through to /dashboard and
//   let the authenticated routing + token refresh make the real call — stay if
//   it re-hydrates, /login if truly unauthenticated, /entry ONLY if
//   authenticated AND genuinely not onboarded — but NEVER bounce an onboarded
//   user straight into onboarding on a transient blip.
// ----------------------------------------------------------------------------

/** Outcome of resolving a visitor's merged intake at the root gate. */
export type RootResolveOutcome =
  | 'data'   // resolver returned NON-EMPTY intake (Entry or Core) → app
  | 'empty'  // resolver returned null / empty (HTTP 404 "no intake yet")
  | 'error'; // resolver THREW (401/403/5xx/network) — a READ failure, NOT "no data"

export type RootRoute = '/register' | '/dashboard' | '/entry';

/**
 * Decide the root ("/") destination.
 *
 * @param hasIdentity a stored userId AND a token are both present
 * @param outcome     the merged-intake resolve outcome (see RootResolveOutcome)
 */
export function decideRootRoute(hasIdentity: boolean, outcome: RootResolveOutcome): RootRoute {
  // Cold, logged-out visitor → signup (the front door); the resolver is never
  // consulted without an identity.
  if (!hasIdentity) return '/register';

  switch (outcome) {
    // Has resolvable intake (Entry or Core) → straight into the app.
    case 'data':
      return '/dashboard';
    // Definitively no intake (HTTP 404) → the fast Entry onboarding.
    case 'empty':
      return '/entry';
    // Auth/transport READ failure → NEVER strand an onboarded user in
    // onboarding. Hand off to /dashboard, where RouteProtection + AuthContext's
    // token refresh make the authoritative call.
    case 'error':
      return '/dashboard';
  }
}
