// src/components/auth/RouteProtection.tsx
import React, { useEffect, useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, AccessLevel, SecurityLevel } from '../../context/AuthContext';
import { useIntake } from '../../context/IntakeContext';
import {
  type ProgressShape,
  getCurrentIntakeSegment,
  indexOfSeg,
  isAfter,
  getFirstIncompleteSegment,
  isSegmentCompleted,
  isIntakeRoute as isIntakeRoutePath,
  entrySatisfied,
  shouldRedirectToEntry,
} from './intakeRouting';

// ========== LOADING COMPONENT ==========
const AuthLoadingScreen: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
    <div className="glass-panel p-8 rounded-xl text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
      <p className="text-white/80">Verifying authentication...</p>
    </div>
  </div>
);

// ========== ERROR COMPONENT ==========
interface AuthErrorProps {
  error: string;
  onRetry?: () => void;
  redirectTo?: string;
}
const AuthErrorScreen: React.FC<AuthErrorProps> = ({ error, onRetry, redirectTo }) => {
  const navigate = () => {
    if (redirectTo) {
      window.location.href = redirectTo;
    } else if (onRetry) {
      onRetry();
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-900 via-purple-900 to-indigo-900">
      <div className="glass-panel p-8 rounded-xl text-center max-w-md">
        <div className="text-red-400 text-5xl mb-4">🚫</div>
        <h2 className="text-xl font-bold text-white mb-4">Access Denied</h2>
        <p className="text-white/80 mb-6">{error}</p>
        {(onRetry || redirectTo) && (
          <button
            onClick={navigate}
            className="glass-button px-6 py-2 rounded-lg text-white hover:bg-white/10 transition-all"
          >
            {redirectTo ? 'Continue' : 'Retry'}
          </button>
        )}
      </div>
    </div>
  );
};

// Intake routing helpers (getCurrentIntakeSegment, getFirstIncompleteSegment,
// isSegmentCompleted, isAfter, indexOfSeg) and the Entry-access decision
// (entrySatisfied / isEntryExemptRoute / shouldRedirectToEntry) are imported
// from ./intakeRouting so they can be unit-tested in isolation.

// ========== PROTECTED ROUTE COMPONENT ==========
interface ProtectedRouteProps {
  children: React.ReactNode;
  accessLevel?: AccessLevel;
  securityLevel?: SecurityLevel;
  customCheck?: (user: any) => boolean;
  redirectTo?: string;
  errorMessage?: string;
  fallback?: React.ReactNode;
  loadingComponent?: React.ComponentType;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  accessLevel = AccessLevel.AUTHENTICATED,
  securityLevel = SecurityLevel.BASIC,
  customCheck,
  redirectTo,
  errorMessage,
  fallback,
  loadingComponent: LoadingComponent = AuthLoadingScreen
}) => {
  const {
    isAuthenticated,
    isLoading,
    authChecked,
    user,
    isInitialIntakeCompleted,
    isIntakeCompleted,
    hasAccessLevel,
    hasSecurityLevel,
    setRedirectAfterLogin,
    error
  } = useAuth();

  const { getIntake } = useIntake();
  // handle both shapes: object or getter function
  const intake = useMemo(() => (typeof getIntake === 'function' ? (getIntake as any)() : (getIntake as any)), [getIntake]);
  const progress: ProgressShape = intake?.progress;

  const location = useLocation();
  const pathname = location.pathname;

  useEffect(() => {
    if (!isAuthenticated && authChecked) {
      setRedirectAfterLogin(location.pathname + location.search);
    }
  }, [isAuthenticated, authChecked, location, setRedirectAfterLogin]);

  // Loading
  if (isLoading || !authChecked) return <LoadingComponent />;

  // Access level
  if (!hasAccessLevel(accessLevel)) {
    const defaultRedirect = getDefaultRedirectForAccessLevel(accessLevel);
    if (redirectTo || defaultRedirect) return <Navigate to={redirectTo || defaultRedirect} replace />;
    const defaultError = getDefaultErrorForAccessLevel(accessLevel);
    return <AuthErrorScreen error={errorMessage || defaultError} redirectTo={redirectTo} />;
  }

  // Security level
  if (!hasSecurityLevel(securityLevel)) {
    const defaultRedirect = getDefaultRedirectForSecurityLevel(securityLevel);
    if (redirectTo || defaultRedirect) return <Navigate to={redirectTo || defaultRedirect} replace />;
    const defaultError = getDefaultErrorForSecurityLevel(securityLevel);
    return <AuthErrorScreen error={errorMessage || defaultError} redirectTo={redirectTo} />;
  }

  // Custom check
  if (customCheck && !customCheck(user)) {
    if (redirectTo) return <Navigate to={redirectTo} replace />;
    return <AuthErrorScreen error={errorMessage || 'Custom permission check failed'} redirectTo={redirectTo} />;
  }

  // ========== ENTRY-INTAKE ACCESS GATE (centralized) ==========
  // Day-one app access is gated on the fast ENTRY ("initial") intake — NOT the
  // deep Core intake. Core is optional, resumable per-step enrichment (driven
  // from the dashboard card), so it must never block general navigation here;
  // the specific deep surfaces that truly need core data keep their own
  // intakeCompleted customCheck (see /results, /review, /mymirror, /truthstream).
  //
  // Legacy-safe guard: a user who completed the OLD monolithic intake has
  // intakeCompleted=true but (per migration 022's backfill) may still have
  // initial_intake_completed=0. Treat core-complete as entry-satisfied so we
  // never bounce an established user into the Entry flow. New signups have
  // neither flag → they are routed to /entry (the fast onboarding).
  const isIntakeRoute = isIntakeRoutePath(pathname);

  // Read the first-class auth triggers (peers of isPremiumUser/isIntakeCompleted),
  // not user.* directly. The Entry-access decision (Entry done OR Core done —
  // core implies entry, also covering legacy users whose initial_intake_completed
  // was never backfilled) lives in intakeRouting so it is proven in isolation.
  //
  // Authenticated, has done NEITHER entry nor core, and this is not an
  // entry/intake/exempt route → send them to the fast Entry onboarding.
  if (shouldRedirectToEntry({ isAuthenticated, isInitialIntakeCompleted, isIntakeCompleted, pathname })) {
    return <Navigate to="/entry" replace />;
  }

  // ========== INTAKE FLOW ROUTING ==========
  if (isAuthenticated && isIntakeRoute) {
    const currentSegEarly = getCurrentIntakeSegment(pathname);

    // ====== DEEPEN MODE: per-step deep link from the "Deepen your Mirror" card ======
    // The user intentionally jumped to ONE Core step to enrich it, out of order
    // (?deepen=1). Bypass the LEGACY sequential routing entirely — no snap-back to
    // the first incomplete step, no auto-advance, and no "already completed ->
    // dashboard" bounce (they may be re-visiting a finished step on purpose).
    // Just render the exact step they asked for.
    const deepen = new URLSearchParams(location.search).get('deepen') === '1';
    if (deepen && currentSegEarly) {
      return <>{children}</>;
    }

    // completed? -> dashboard
    if (progress?.completed || user?.intakeCompleted) {
      return <Navigate to="/dashboard" replace />;
    }

    const state = (location.state || {}) as { fixMode?: boolean; returnTo?: string };
    const fixMode = Boolean(state.fixMode);
    const returnTo = state.returnTo || '/intake/submit';

    const requiredSeg = getFirstIncompleteSegment(progress);
    const currentSeg = getCurrentIntakeSegment(pathname);

    // ====== FIX MODE: came here from Submit to fix a requirement ======
    if (fixMode && currentSeg) {
      // 1) If current segment now completed → go back to Submit (or provided returnTo)
      if (isSegmentCompleted(progress, currentSeg)) {
        return <Navigate to={returnTo} replace />;
      }
      // 2) While in fix mode, do not snap back/forward; let the user complete this segment.
      return <>{children}</>;
    }

    // ====== NORMAL MODE ======
    // "/intake" with no seg, or trying to skip ahead -> snap back to required step
    if (!currentSeg || isAfter(currentSeg, requiredSeg)) {
      return <Navigate to={`/intake/${requiredSeg}`} replace state={{ from: location }} />;
    }

    // Auto-advance: if the current step is already complete, drive forward to the next incomplete step
    if (isSegmentCompleted(progress, currentSeg)) {
      const nextRequired = getFirstIncompleteSegment(progress);
      if (nextRequired !== currentSeg) {
        // Only advance forward (avoid bouncing backward)
        if (indexOfSeg(nextRequired) > indexOfSeg(currentSeg)) {
          return <Navigate to={`/intake/${nextRequired}`} replace />;
        }
      }
    }
  }

  // Fallback handling for auth error with provided fallback UI
  if (error && fallback) return <>{fallback}</>;

  return <>{children}</>;
};

// ========== ROUTE-BASED PROTECTION ==========
interface RouteGuardProps {
  children: React.ReactNode;
  route?: string; // Auto-detect if not provided
}
export const RouteGuard: React.FC<RouteGuardProps> = ({ children }) => {
  const location = useLocation();
  const { canAccessRoute, isLoading, authChecked } = useAuth();
  if (isLoading || !authChecked) return <AuthLoadingScreen />;
  const accessCheck = canAccessRoute(location.pathname);
  if (!accessCheck.allowed) {
    if (accessCheck.redirectTo) return <Navigate to={accessCheck.redirectTo} replace />;
    return <AuthErrorScreen error={accessCheck.reason || 'Access denied'} redirectTo={accessCheck.redirectTo} />;
  }
  return <>{children}</>;
};

// ========== CONDITIONAL RENDERING ==========
interface ConditionalRenderProps {
  children: React.ReactNode;
  condition: 'authenticated' | 'unauthenticated' | 'verified' | 'unverified' | 'premium' | 'admin' | 'entry-completed' | 'intake-completed';
  fallback?: React.ReactNode;
}
export const ConditionalRender: React.FC<ConditionalRenderProps> = ({ children, condition, fallback = null }) => {
  const {
    isAuthenticated,
    isEmailVerified,
    isPremiumUser,
    isAdmin,
    isInitialIntakeCompleted,
    isIntakeCompleted,
    authChecked
  } = useAuth();
  // Gate on the INITIAL auth determination only — NOT on isLoading.
  //
  // isLoading also flips true during in-page auth operations: submitting the
  // registration form calls register(), which dispatches SET_LOADING:true for
  // the duration of the request. The previous `if (isLoading) return null`
  // therefore UNMOUNTED the /register (and /login) subtree the instant the user
  // hit submit, then remounted a fresh copy when the request settled. That blank
  // flash looked like a page reload AND discarded the error the form's catch had
  // just set ("email already registered" / "username taken") on the now-unmounted
  // instance — in both dev and prod. authChecked flips true once after the first
  // check and stays true, so later operations no longer blank the tree.
  if (!authChecked) return null;
  const shouldRender =
    (condition === 'authenticated' && isAuthenticated) ||
    (condition === 'unauthenticated' && !isAuthenticated) ||
    (condition === 'verified' && isAuthenticated && isEmailVerified) ||
    (condition === 'unverified' && isAuthenticated && !isEmailVerified) ||
    (condition === 'premium' && isAuthenticated && isPremiumUser) ||
    (condition === 'admin' && isAuthenticated && isAdmin) ||
    // Entry-satisfied: fast intake done OR the deeper core intake done (core implies entry).
    (condition === 'entry-completed' && isAuthenticated && entrySatisfied(isInitialIntakeCompleted, isIntakeCompleted)) ||
    (condition === 'intake-completed' && isAuthenticated && isIntakeCompleted);
  return shouldRender ? <>{children}</> : <>{fallback}</>;
};

// ========== PERMISSION HOOK ==========
export const usePermission = (route?: string) => {
  const location = useLocation();
  const { canAccessRoute, hasAccessLevel, hasSecurityLevel } = useAuth();
  const currentRoute = route || location.pathname;
  return {
    canAccess: (route: string) => canAccessRoute(route),
    canAccessCurrent: () => canAccessRoute(currentRoute),
    hasAccess: (level: AccessLevel) => hasAccessLevel(level),
    hasSecurity: (level: SecurityLevel) => hasSecurityLevel(level),
  };
};

// ========== UTILITY FUNCTIONS ==========
function getDefaultRedirectForAccessLevel(level: AccessLevel): string {
  switch (level) {
    case AccessLevel.AUTHENTICATED:
    case AccessLevel.VERIFIED:
      return '/login';
    case AccessLevel.ENTRY_REQUIRED:
      return '/entry';
    case AccessLevel.INTAKE_REQUIRED:
      return '/intake';
    case AccessLevel.PREMIUM:
      return '/upgrade';
    case AccessLevel.ADMIN:
      return '/dashboard';
    default:
      return '/';
  }
}
function getDefaultRedirectForSecurityLevel(level: SecurityLevel): string {
  switch (level) {
    case SecurityLevel.BASIC:
      return '/login';
    case SecurityLevel.VERIFIED:
      return '/verify-email';
    case SecurityLevel.TIER2_ACCESS:
    case SecurityLevel.TIER3_ACCESS:
      return '/upgrade';
    case SecurityLevel.ADMIN:
      return '/dashboard';
    default:
      return '/';
  }
}
function getDefaultErrorForAccessLevel(level: AccessLevel): string {
  switch (level) {
    case AccessLevel.AUTHENTICATED:
      return 'Please log in to access this page.';
    case AccessLevel.VERIFIED:
      return 'Email verification required.';
    case AccessLevel.ENTRY_REQUIRED:
      return 'Please complete your quick intro to continue.';
    case AccessLevel.INTAKE_REQUIRED:
      return 'Please complete the intake process first.';
    case AccessLevel.PREMIUM:
      return 'Premium subscription required.';
    case AccessLevel.ADMIN:
      return 'Administrative privileges required.';
    default:
      return 'Access denied.';
  }
}
function getDefaultErrorForSecurityLevel(level: SecurityLevel): string {
  switch (level) {
    case SecurityLevel.BASIC:
      return 'Authentication required.';
    case SecurityLevel.VERIFIED:
      return 'Email verification required.';
    case SecurityLevel.TIER2_ACCESS:
      return 'Verified account with tier 2 access required.';
    case SecurityLevel.TIER3_ACCESS:
      return 'Premium account with tier 3 access required.';
    case SecurityLevel.ADMIN:
      return 'Administrative privileges required.';
    default:
      return 'Access denied.';
  }
}