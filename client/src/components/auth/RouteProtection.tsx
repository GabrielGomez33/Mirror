// src/components/auth/RouteProtection.tsx
import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, AccessLevel, SecurityLevel } from '../../context/AuthContext';

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
  
  const location = useLocation();

  useEffect(() => {
    // Store current location for redirect after login
    if (!isAuthenticated && authChecked) {
      setRedirectAfterLogin(location.pathname + location.search);
    }
  }, [isAuthenticated, authChecked, location, setRedirectAfterLogin]);

  // Show loading while auth is being checked
  if (isLoading || !authChecked) {
    return <LoadingComponent />;
  }

  // Check access level
  if (!hasAccessLevel(accessLevel)) {
    const defaultRedirect = getDefaultRedirectForAccessLevel(accessLevel);
    if (redirectTo || defaultRedirect) {
      return <Navigate to={redirectTo || defaultRedirect} replace />;
    }
    
    const defaultError = getDefaultErrorForAccessLevel(accessLevel);
    return (
      <AuthErrorScreen 
        error={errorMessage || defaultError}
        redirectTo={redirectTo}
      />
    );
  }

  // Check security level
  if (!hasSecurityLevel(securityLevel)) {
    const defaultRedirect = getDefaultRedirectForSecurityLevel(securityLevel);
    if (redirectTo || defaultRedirect) {
      return <Navigate to={redirectTo || defaultRedirect} replace />;
    }
    
    const defaultError = getDefaultErrorForSecurityLevel(securityLevel);
    return (
      <AuthErrorScreen 
        error={errorMessage || defaultError}
        redirectTo={redirectTo}
      />
    );
  }

  // Check custom validation
  if (customCheck && !customCheck(user)) {
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }
    
    return (
      <AuthErrorScreen 
        error={errorMessage || 'Custom permission check failed'}
        redirectTo={redirectTo}
      />
    );
  }

  // Show fallback if provided and there's an auth error
  if (error && fallback) {
    return <>{fallback}</>;
  }

  // All checks passed, render children
  return <>{children}</>;
};

// ========== ROUTE-BASED PROTECTION ==========

interface RouteGuardProps {
  children: React.ReactNode;
  route?: string; // Auto-detect if not provided
}

export const RouteGuard: React.FC<RouteGuardProps> = ({ children, route }) => {
  const location = useLocation();
  const { canAccessRoute, isLoading, authChecked } = useAuth();
  const currentRoute = route || location.pathname;

  if (isLoading || !authChecked) {
    return <AuthLoadingScreen />;
  }

  const accessCheck = canAccessRoute(currentRoute);
  
  if (!accessCheck.allowed) {
    if (accessCheck.redirectTo) {
      return <Navigate to={accessCheck.redirectTo} replace />;
    }
    
    return (
      <AuthErrorScreen 
        error={accessCheck.reason || 'Access denied'}
        redirectTo={accessCheck.redirectTo}
      />
    );
  }

  return <>{children}</>;
};

// ========== CONDITIONAL RENDERING ==========

interface ConditionalRenderProps {
  children: React.ReactNode;
  condition: 'authenticated' | 'unauthenticated' | 'verified' | 'unverified' | 'premium' | 'admin' | 'intake-completed';
  fallback?: React.ReactNode;
}

export const ConditionalRender: React.FC<ConditionalRenderProps> = ({ 
  children, 
  condition, 
  fallback = null 
}) => {
  const { 
    isAuthenticated, 
    isEmailVerified, 
    isPremiumUser, 
    isAdmin, 
    isIntakeCompleted,
    isLoading 
  } = useAuth();

  if (isLoading) {
    return null; // Don't render anything while loading
  }

  const shouldRender = (() => {
    switch (condition) {
      case 'authenticated':
        return isAuthenticated;
      case 'unauthenticated':
        return !isAuthenticated;
      case 'verified':
        return isAuthenticated && isEmailVerified;
      case 'unverified':
        return isAuthenticated && !isEmailVerified;
      case 'premium':
        return isAuthenticated && isPremiumUser;
      case 'admin':
        return isAuthenticated && isAdmin;
      case 'intake-completed':
        return isAuthenticated && isIntakeCompleted;
      default:
        return false;
    }
  })();

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
    hasSecurity: (level: SecurityLevel) => hasSecurityLevel(level)
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
