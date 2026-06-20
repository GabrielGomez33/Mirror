// src/components/auth/RouteProtection.tsx
import React, { useEffect, useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, AccessLevel, SecurityLevel } from '../../context/AuthContext';
import { useIntake } from '../../context/IntakeContext';

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

// ========== INTAKE ROUTING HELPERS ==========

// URL segments used in routes under /intake/*
const INTAKE_SEGMENTS = ['visual', 'vocal', 'iq', 'astrology', 'personality', 'submit', 'results'] as const;
type IntakeSegment = typeof INTAKE_SEGMENTS[number];

// Your IntakeContext progress step keys
type ProgressStepKey =
  | 'VisualStep'
  | 'VocalStep'
  | 'IQStep'
  | 'AstroLogicalStep'
  | 'PersonalityStep'
  | 'SubmitStep'
  | 'ResultsStep'
  | 'IQStep';

// Map URL segment → progress step key
const SEGMENT_TO_PROGRESS: Record<IntakeSegment, ProgressStepKey> = {
  visual: 'VisualStep',
  vocal: 'VocalStep',
  iq: 'IQStep',
  astrology: 'AstroLogicalStep',
  personality: 'PersonalityStep',
  submit: 'SubmitStep',
  results: 'ResultsStep',
};

// Minimal shape from your IntakeContext
type StepStatus = { completed: boolean; data?: Record<string, unknown> };
type ProgressShape = {
  lastStep?: string;
  completed?: boolean;
  steps?: Partial<Record<ProgressStepKey, StepStatus>>;
} | undefined;

function getCurrentIntakeSegment(pathname: string): IntakeSegment | null {
  const parts = pathname.split('/').filter(Boolean);
  const idx = parts.indexOf('intake');
  if (idx < 0) return null;
  const seg = parts[idx + 1] || null;
  return (seg && INTAKE_SEGMENTS.includes(seg as IntakeSegment)) ? (seg as IntakeSegment) : null;
}

function indexOfSeg(seg: IntakeSegment) {
  return INTAKE_SEGMENTS.indexOf(seg);
}

function isAfter(a: IntakeSegment, b: IntakeSegment) {
  return indexOfSeg(a) > indexOfSeg(b);
}

function getFirstIncompleteSegment(progress: ProgressShape): IntakeSegment {
  for (const seg of INTAKE_SEGMENTS) {
    const stepKey = SEGMENT_TO_PROGRESS[seg];
    const s = progress?.steps?.[stepKey];
    if (!s?.completed) return seg;
  }
  return 'results';
}

function isSegmentCompleted(progress: ProgressShape, seg: IntakeSegment): boolean {
  const stepKey = SEGMENT_TO_PROGRESS[seg];
  return Boolean(progress?.steps?.[stepKey]?.completed);
}

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

  // ========== INTAKE-COMPLETION GATE (centralized) ==========
  // Routes exempt from intake-completion requirement (user must be able to reach these
  // even when intake is incomplete, otherwise they'd be stuck in a redirect loop).
  const INTAKE_EXEMPT_ROUTES = new Set([
    '/intake', '/login', '/register', '/home', '/landing', '/test',
  ]);
  const isIntakeRoute = pathname === '/intake' || pathname.startsWith('/intake/');
  const isExemptRoute = INTAKE_EXEMPT_ROUTES.has(pathname) || isIntakeRoute;

  // If authenticated, intake NOT completed, and this is NOT an intake/exempt route → redirect to intake
  if (isAuthenticated && !user?.intakeCompleted && !isExemptRoute) {
    return <Navigate to="/intake" replace />;
  }

  // ========== INTAKE FLOW ROUTING ==========
  if (isAuthenticated && isIntakeRoute) {
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
  condition: 'authenticated' | 'unauthenticated' | 'verified' | 'unverified' | 'premium' | 'admin' | 'intake-completed';
  fallback?: React.ReactNode;
}
export const ConditionalRender: React.FC<ConditionalRenderProps> = ({ children, condition, fallback = null }) => {
  const {
    isAuthenticated,
    isEmailVerified,
    isPremiumUser,
    isAdmin,
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
