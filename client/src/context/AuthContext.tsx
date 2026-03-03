// src/context/AuthContext.tsx
import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { getToken, setToken, clearToken } from '../utils/token';
import { verifyTokenApi, refreshTokenApi, logoutApi } from '../services/authApi';

// ========== TYPES & INTERFACES ==========

export const SecurityLevel = {
  PUBLIC: 0,           // No authentication required
  BASIC: 1,           // Valid JWT required
  VERIFIED: 2,        // Valid JWT + email verification
  TIER2_ACCESS: 3,    // VERIFIED + tier2 data access permissions
  TIER3_ACCESS: 4,    // VERIFIED + tier3 data access permissions
  ADMIN: 5            // Admin privileges required
} as const;

export type SecurityLevel = typeof SecurityLevel[keyof typeof SecurityLevel];

export const UserTier = {
  GUEST: 'guest',
  BASIC: 'basic',
  VERIFIED: 'verified',
  PREMIUM: 'premium',
  ADMIN: 'admin'
} as const;

export type UserTier = typeof UserTier[keyof typeof UserTier];

export const AccessLevel = {
  PUBLIC: 'public',           // Anyone can access
  AUTHENTICATED: 'authenticated',   // Must be logged in
  VERIFIED: 'verified',       // Must have verified email
  INTAKE_REQUIRED: 'intake_required',    // Must complete intake process
  PREMIUM: 'premium',         // Must be premium user
  ADMIN: 'admin'             // Admin only
} as const;

export type AccessLevel = typeof AccessLevel[keyof typeof AccessLevel];

export interface User {
  id: number;
  username: string;
  email: string;
  tier: UserTier;
  emailVerified: boolean;
  intakeCompleted: boolean;
  subscriptionStatus: 'free' | 'premium' | 'enterprise';
  lastLogin?: string;
  sessionId: string;
}

export interface Permission {
  route: string;
  accessLevel: AccessLevel;
  securityLevel: SecurityLevel;
  requiredTier?: UserTier;
  customCheck?: (user: User | null) => boolean;
  redirectTo?: string;
  errorMessage?: string;
}

export interface AuthState {
  // User & Session
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Verification States
  isEmailVerified: boolean;
  isIntakeCompleted: boolean;
  isPremiumUser: boolean;
  isAdmin: boolean;
  
  // Token Management
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiry: number | null;
  
  // Session Management
  sessionValid: boolean;
  lastActivity: number;
  
  // Error Handling
  error: string | null;
  authChecked: boolean;
  
  // Permission Cache
  permissionCache: Map<string, boolean>;
  cacheTimestamp: number;
}

type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_USER'; payload: User }
  | { type: 'SET_TOKENS'; payload: { accessToken: string; refreshToken: string; expiresIn: number } }
  | { type: 'CLEAR_USER' }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_AUTH_CHECKED'; payload: boolean }
  | { type: 'UPDATE_USER_PROPERTY'; payload: { key: keyof User; value: any } }
  | { type: 'UPDATE_LAST_ACTIVITY' }
  | { type: 'CACHE_PERMISSION'; payload: { route: string; allowed: boolean } }
  | { type: 'CLEAR_PERMISSION_CACHE' }
  | { type: 'SET_SESSION_VALID'; payload: boolean };

// ========== PERMISSION CONFIGURATION ==========

// High-performance permission lookup table
const ROUTE_PERMISSIONS = new Map<string, Permission>([
  // Public routes (unchanged)
    ['/', { route: '/', accessLevel: AccessLevel.PUBLIC, securityLevel: SecurityLevel.PUBLIC }],
    ['/home', { route: '/home', accessLevel: AccessLevel.PUBLIC, securityLevel: SecurityLevel.PUBLIC }],
    ['/landing', { route: '/landing', accessLevel: AccessLevel.PUBLIC, securityLevel: SecurityLevel.PUBLIC }],
    ['/login', { route: '/login', accessLevel: AccessLevel.PUBLIC, securityLevel: SecurityLevel.PUBLIC }],
    
    // Authenticated routes (unchanged)
    ['/dashboard', { 
      route: '/dashboard', 
      accessLevel: AccessLevel.AUTHENTICATED, 
      securityLevel: SecurityLevel.BASIC,
      redirectTo: '/login'
    }],
    
    // FIXED: Intake flow routes - Use consistent security levels
    ['/intake', { 
      route: '/intake', 
      accessLevel: AccessLevel.AUTHENTICATED, 
      securityLevel: SecurityLevel.BASIC,  // ✅ BASIC for intake
      redirectTo: '/login'
    }],
    ['/intake/personality', { 
      route: '/intake/personality', 
      accessLevel: AccessLevel.AUTHENTICATED, 
      securityLevel: SecurityLevel.BASIC,  // ✅ Changed from VERIFIED to BASIC
      redirectTo: '/login'
    }],
    ['/intake/visual', { 
      route: '/intake/visual', 
      accessLevel: AccessLevel.AUTHENTICATED, 
      securityLevel: SecurityLevel.BASIC,  // ✅ Add visual route explicitly
      redirectTo: '/login'
    }],
    ['/intake/vocal', { 
      route: '/intake/vocal', 
      accessLevel: AccessLevel.AUTHENTICATED, 
      securityLevel: SecurityLevel.BASIC,  // ✅ FIXED: Changed from TIER2_ACCESS to BASIC
      redirectTo: '/login'
    }],
    ['/intake/astrology', { 
      route: '/intake/astrology', 
      accessLevel: AccessLevel.AUTHENTICATED, 
      securityLevel: SecurityLevel.BASIC,  // ✅ Add astrology route
      redirectTo: '/login'
    }],
    ['/intake/iq', { 
      route: '/intake/iq', 
      accessLevel: AccessLevel.AUTHENTICATED, 
      securityLevel: SecurityLevel.BASIC,  // ✅ Add IQ route
      redirectTo: '/login'
    }],
    ['/intake/register', { 
      route: '/intake/register', 
      accessLevel: AccessLevel.AUTHENTICATED, 
      securityLevel: SecurityLevel.BASIC,  // ✅ Add register route
      redirectTo: '/login'
    }],
    ['/intake/submit', { 
      route: '/intake/submit', 
      accessLevel: AccessLevel.AUTHENTICATED, 
      securityLevel: SecurityLevel.BASIC,  // ✅ Add submit route
      redirectTo: '/login'
    }],
    ['/intake/results', { 
      route: '/intake/results', 
      accessLevel: AccessLevel.AUTHENTICATED, 
      securityLevel: SecurityLevel.BASIC,  // ✅ Add results route
      redirectTo: '/login'
    }],
    
    // Results and analysis (keep higher security for final results)
    ['/results', { 
      route: '/results', 
      accessLevel: AccessLevel.INTAKE_REQUIRED, 
      securityLevel: SecurityLevel.TIER2_ACCESS,  // Keep higher security for final results
      customCheck: (user: User | null) => user?.intakeCompleted === true,
      redirectTo: '/intake',
      errorMessage: 'Please complete the intake process to view results.'
    }],
    ['/review', {
      route: '/review',
      accessLevel: AccessLevel.INTAKE_REQUIRED,
      securityLevel: SecurityLevel.TIER2_ACCESS,  // Keep higher security for review
      customCheck: (user: User | null) => user?.intakeCompleted === true,
      redirectTo: '/intake'
    }],
    ['/truthstream', {
      route: '/truthstream',
      accessLevel: AccessLevel.INTAKE_REQUIRED,
      securityLevel: SecurityLevel.BASIC,
      customCheck: (user: User | null) => user?.intakeCompleted === true,
      redirectTo: '/intake',
      errorMessage: 'Please complete the intake process to access TruthStream.'
    }],
    
    // Premium features (unchanged)
    ['/insights/advanced', { 
      route: '/insights/advanced', 
      accessLevel: AccessLevel.PREMIUM, 
      securityLevel: SecurityLevel.TIER3_ACCESS,
      requiredTier: UserTier.PREMIUM,
      redirectTo: '/upgrade',
      errorMessage: 'Premium subscription required for advanced insights.'
    }],
  ['/analytics', { 
    route: '/analytics', 
    accessLevel: AccessLevel.PREMIUM, 
    securityLevel: SecurityLevel.TIER3_ACCESS,
    requiredTier: UserTier.PREMIUM,
    redirectTo: '/upgrade'
  }],
  
  // Admin routes
  ['/admin', { 
    route: '/admin', 
    accessLevel: AccessLevel.ADMIN, 
    securityLevel: SecurityLevel.ADMIN,
    requiredTier: UserTier.ADMIN,
    redirectTo: '/dashboard',
    errorMessage: 'Administrative privileges required.'
  }],
  
  // Test routes
  ['/test', { route: '/test', accessLevel: AccessLevel.PUBLIC, securityLevel: SecurityLevel.PUBLIC }]
]);

// ========== REDUCER ==========

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isEmailVerified: false,
  isIntakeCompleted: false,
  isPremiumUser: false,
  isAdmin: false,
  accessToken: null,
  refreshToken: null,
  tokenExpiry: null,
  sessionValid: false,
  lastActivity: Date.now(),
  error: null,
  authChecked: false,
  permissionCache: new Map(),
  cacheTimestamp: Date.now()
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
      
    case 'SET_USER':
      const user = action.payload;
      return {
        ...state,
        user,
        isAuthenticated: true,
        isEmailVerified: user.emailVerified,
        isIntakeCompleted: user.intakeCompleted,
        isPremiumUser: user.subscriptionStatus === 'premium' || user.subscriptionStatus === 'enterprise',
        isAdmin: user.tier === UserTier.ADMIN,
        sessionValid: true,
        error: null,
        isLoading: false
      };
      
    case 'SET_TOKENS':
      const { accessToken, refreshToken, expiresIn } = action.payload;
      const tokenExpiry = Date.now() + (expiresIn * 1000);
      return {
        ...state,
        accessToken,
        refreshToken,
        tokenExpiry,
        sessionValid: true
      };
      
    case 'CLEAR_USER':
      return {
        ...initialState,
        isLoading: false,
        authChecked: true,
        permissionCache: new Map(),
        cacheTimestamp: Date.now()
      };
      
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
      
    case 'CLEAR_ERROR':
      return { ...state, error: null };
      
    case 'SET_AUTH_CHECKED':
      return { ...state, authChecked: action.payload };
      
    case 'UPDATE_USER_PROPERTY':
      if (!state.user) return state;
      const updatedUser = { ...state.user, [action.payload.key]: action.payload.value };
      return {
        ...state,
        user: updatedUser,
        isEmailVerified: updatedUser.emailVerified,
        isIntakeCompleted: updatedUser.intakeCompleted,
        isPremiumUser: updatedUser.subscriptionStatus === 'premium' || updatedUser.subscriptionStatus === 'enterprise',
        isAdmin: updatedUser.tier === UserTier.ADMIN
      };
      
    case 'UPDATE_LAST_ACTIVITY':
      return { ...state, lastActivity: Date.now() };
      
    case 'CACHE_PERMISSION':
      const newCache = new Map(state.permissionCache);
      newCache.set(action.payload.route, action.payload.allowed);
      return { 
        ...state, 
        permissionCache: newCache,
        cacheTimestamp: Date.now()
      };
      
    case 'CLEAR_PERMISSION_CACHE':
      return { 
        ...state, 
        permissionCache: new Map(),
        cacheTimestamp: Date.now()
      };
      
    case 'SET_SESSION_VALID':
      return { ...state, sessionValid: action.payload };
      
    default:
      return state;
  }
}

// ========== CONTEXT ==========

interface AuthContextType extends AuthState {
  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: (allDevices?: boolean) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  refreshTokens: () => Promise<boolean>;
  
  // Permission Checking
  hasPermission: (route: string) => boolean;
  hasSecurityLevel: (level: SecurityLevel) => boolean;
  hasAccessLevel: (level: AccessLevel) => boolean;
  canAccessRoute: (route: string) => { allowed: boolean; reason?: string; redirectTo?: string };
  
  // User Updates
  updateUserProperty: (key: keyof User, value: any) => void;
  markEmailVerified: () => void;
  markIntakeCompleted: () => void;
  
  // Utility
  clearError: () => void;
  isTokenExpiring: () => boolean;
  getRedirectAfterLogin: () => string;
  setRedirectAfterLogin: (path: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ========== PROVIDER ==========

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const redirectAfterLogin = React.useRef<string>('/dashboard');

  // ========== CORE AUTH FUNCTIONS ==========

  const login = useCallback(async (email: string, password: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'CLEAR_ERROR' });
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/mirror/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Login failed');
      }

      const data = await response.json();
      const userInfo = {
      	userId: data.user.id,
      	username: data.user.username,
      	email: data.user.email,
      	lastLogin: data.user.lastLogin
      }
      // Store tokens
      setToken(data.tokens.accessToken);
      setToken(data.tokens.refreshToken, 'refreshToken');
      setToken(JSON.stringify(userInfo),'userInfo');
      
      // Update state
      dispatch({ 
        type: 'SET_TOKENS', 
        payload: {
          accessToken: data.tokens.accessToken,
          refreshToken: data.tokens.refreshToken,
          expiresIn: data.tokens.expiresIn
        }
      });
      
      const user: User = {
        id: data.user.id,
        username: data.user.username,
        email: data.user.email,
        tier: mapBackendTierToUserTier(data.user.tier),
        emailVerified: data.user.emailVerified || false,
        intakeCompleted: data.user.intakeCompleted || false,
        subscriptionStatus: data.user.subscriptionStatus || 'free',
        lastLogin: data.user.lastLogin,
        sessionId: data.user.sessionId
      };
      
      dispatch({ type: 'SET_USER', payload: user });
      dispatch({ type: 'CLEAR_PERMISSION_CACHE' });
      
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
      throw error;
    }
  }, []);

  const register = useCallback(async (username: string, email: string, password: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'CLEAR_ERROR' });
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/mirror/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Registration failed');
      }

      // Registration automatically logs in the user
      await login(email, password);
      
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
      throw error;
    }
  }, [login]);

  const logout = useCallback(async (allDevices = false) => {
    try {
      await logoutApi(allDevices);
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      // Always clear local state regardless of API call success
      clearToken();
      clearToken('refreshToken');
      dispatch({ type: 'CLEAR_USER' });
    }
  }, []);

  const refreshTokens = useCallback(async (): Promise<boolean> => {
    try {
      const data = await refreshTokenApi();
      
      setToken(data.accessToken);
      dispatch({ 
        type: 'SET_TOKENS', 
        payload: {
          accessToken: data.accessToken,
          refreshToken: getToken('refreshToken') || '',
          expiresIn: data.expiresIn
        }
      });
      
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }, []);

  // ========== PERMISSION CHECKING ==========

  const hasPermission = useCallback((route: string): boolean => {
    const permission = ROUTE_PERMISSIONS.get(route);
    if (!permission) return true; // Default allow for undefined routes
    
    return canAccessRoute(route).allowed;
  }, [state.user, state.isAuthenticated, state.isEmailVerified, state.isIntakeCompleted, state.isPremiumUser, state.isAdmin]);

  const hasSecurityLevel = useCallback((level: SecurityLevel): boolean => {
    switch (level) {
      case SecurityLevel.PUBLIC:
        return true;
      case SecurityLevel.BASIC:
        return state.isAuthenticated;
      case SecurityLevel.VERIFIED:
        return state.isAuthenticated && state.isEmailVerified;
      case SecurityLevel.TIER2_ACCESS:
        return state.isAuthenticated && state.isEmailVerified;
      case SecurityLevel.TIER3_ACCESS:
        return state.isAuthenticated && state.isEmailVerified && state.isPremiumUser;
      case SecurityLevel.ADMIN:
        return state.isAuthenticated && state.isAdmin;
      default:
        return false;
    }
  }, [state.isAuthenticated, state.isEmailVerified, state.isPremiumUser, state.isAdmin]);

  const hasAccessLevel = useCallback((level: AccessLevel): boolean => {
    switch (level) {
      case AccessLevel.PUBLIC:
        return true;
      case AccessLevel.AUTHENTICATED:
        return state.isAuthenticated;
      case AccessLevel.VERIFIED:
        return state.isAuthenticated && state.isEmailVerified;
      case AccessLevel.INTAKE_REQUIRED:
        return state.isAuthenticated && state.isIntakeCompleted;
      case AccessLevel.PREMIUM:
        return state.isAuthenticated && state.isPremiumUser;
      case AccessLevel.ADMIN:
        return state.isAuthenticated && state.isAdmin;
      default:
        return false;
    }
  }, [state.isAuthenticated, state.isEmailVerified, state.isIntakeCompleted, state.isPremiumUser, state.isAdmin]);

  const canAccessRoute = useCallback((route: string): { allowed: boolean; reason?: string; redirectTo?: string } => {
    // Check cache first (5 minute cache)
    const cacheAge = Date.now() - state.cacheTimestamp;
    if (cacheAge < 300000 && state.permissionCache.has(route)) {
      const cached = state.permissionCache.get(route)!;
      const permission = ROUTE_PERMISSIONS.get(route);
      return {
        allowed: cached,
        reason: permission?.errorMessage,
        redirectTo: permission?.redirectTo
      };
    }

    const permission = ROUTE_PERMISSIONS.get(route);
    if (!permission) {
      // Cache and allow undefined routes
      dispatch({ type: 'CACHE_PERMISSION', payload: { route, allowed: true } });
      return { allowed: true };
    }

    // Check access level
    if (!hasAccessLevel(permission.accessLevel)) {
      dispatch({ type: 'CACHE_PERMISSION', payload: { route, allowed: false } });
      return {
        allowed: false,
        reason: permission.errorMessage || `Access level ${permission.accessLevel} required`,
        redirectTo: permission.redirectTo
      };
    }

    // Check security level
    if (!hasSecurityLevel(permission.securityLevel)) {
      dispatch({ type: 'CACHE_PERMISSION', payload: { route, allowed: false } });
      return {
        allowed: false,
        reason: permission.errorMessage || `Security level ${permission.securityLevel} required`,
        redirectTo: permission.redirectTo
      };
    }

    // Check required tier
    if (permission.requiredTier && state.user?.tier !== permission.requiredTier) {
      dispatch({ type: 'CACHE_PERMISSION', payload: { route, allowed: false } });
      return {
        allowed: false,
        reason: permission.errorMessage || `Tier ${permission.requiredTier} required`,
        redirectTo: permission.redirectTo
      };
    }

    // Check custom validation
    if (permission.customCheck && !permission.customCheck(state.user)) {
      dispatch({ type: 'CACHE_PERMISSION', payload: { route, allowed: false } });
      return {
        allowed: false,
        reason: permission.errorMessage || 'Custom permission check failed',
        redirectTo: permission.redirectTo
      };
    }

    // All checks passed
    dispatch({ type: 'CACHE_PERMISSION', payload: { route, allowed: true } });
    return { allowed: true };
  }, [state.user, state.permissionCache, state.cacheTimestamp, hasAccessLevel, hasSecurityLevel]);

  // ========== USER UPDATES ==========

  const updateUserProperty = useCallback((key: keyof User, value: any) => {
    dispatch({ type: 'UPDATE_USER_PROPERTY', payload: { key, value } });
    dispatch({ type: 'CLEAR_PERMISSION_CACHE' });
  }, []);

  const markEmailVerified = useCallback(() => {
    updateUserProperty('emailVerified', true);
  }, [updateUserProperty]);

  const markIntakeCompleted = useCallback(() => {
    updateUserProperty('intakeCompleted', true);
  }, [updateUserProperty]);

  // ========== UTILITY FUNCTIONS ==========

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const isTokenExpiring = useCallback((): boolean => {
    if (!state.tokenExpiry) return true;
    const timeUntilExpiry = state.tokenExpiry - Date.now();
    return timeUntilExpiry < 300000; // Less than 5 minutes
  }, [state.tokenExpiry]);

  const getRedirectAfterLogin = useCallback(() => {
    return redirectAfterLogin.current;
  }, []);

  const setRedirectAfterLogin = useCallback((path: string) => {
    redirectAfterLogin.current = path;
  }, []);

  // ========== INITIALIZATION & TOKEN MANAGEMENT ==========

  useEffect(() => {
    const initializeAuth = async () => {
      const token = getToken();
      
      if (!token) {
        dispatch({ type: 'SET_AUTH_CHECKED', payload: true });
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }

      try {
        // Verify existing token using API service
        const data = await verifyTokenApi();
        
        if (data.valid) {
          const user: User = {
            id: data.user!.id,
            username: data.user!.username,
            email: data.user!.email,
            tier: mapBackendTierToUserTier(data.user!.tier || 'basic'),
            emailVerified: data.user!.emailVerified || false,
            intakeCompleted: data.user!.intakeCompleted || false,
            subscriptionStatus: ['free', 'premium', 'enterprise'].includes(data.user!.subscriptionStatus) 
              ? data.user!.subscriptionStatus as 'free' | 'premium' | 'enterprise'
              : 'free',
            sessionId: data.user!.sessionId
          };
          
          dispatch({ type: 'SET_USER', payload: user });
          dispatch({ type: 'SET_TOKENS', payload: { 
            accessToken: token, 
            refreshToken: getToken('refreshToken') || '', 
            expiresIn: 900 
          }});
        } else {
          // Try to refresh token
          const refreshed = await refreshTokens();
          if (!refreshed) {
            clearToken();
            clearToken('refreshToken');
          }
        }
      } catch (error) {
        console.error('Auth initialization failed:', error);
        // Try to refresh token on verification failure
        const refreshed = await refreshTokens();
        if (!refreshed) {
          clearToken();
          clearToken('refreshToken');
        }
      } finally {
        dispatch({ type: 'SET_AUTH_CHECKED', payload: true });
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    initializeAuth();
  }, []);

  // Refs for stable token refresh (prevents timer reset on function recreation)
  const refreshTokensRef = useRef(refreshTokens);
  const logoutRef = useRef(logout);
  const tokenExpiryRef = useRef(state.tokenExpiry);

  // Keep refs in sync
  useEffect(() => {
    refreshTokensRef.current = refreshTokens;
    logoutRef.current = logout;
    tokenExpiryRef.current = state.tokenExpiry;
  }, [refreshTokens, logout, state.tokenExpiry]);

  // Auto-refresh tokens before expiry
  useEffect(() => {
    if (!state.isAuthenticated) return;

    // Check if token is expiring using ref (stable reference)
    const isExpiring = (): boolean => {
      const expiry = tokenExpiryRef.current;
      if (!expiry) return true;
      const timeUntilExpiry = expiry - Date.now();
      return timeUntilExpiry < 300000; // Less than 5 minutes
    };

    const checkAndRefresh = async () => {
      if (isExpiring()) {
        console.log('[AuthContext] Token expiring, attempting refresh...');
        const success = await refreshTokensRef.current();
        if (!success) {
          console.log('[AuthContext] Token refresh failed, logging out');
          await logoutRef.current();
        } else {
          console.log('[AuthContext] Token refreshed successfully');
        }
      }
    };

    // Check immediately
    checkAndRefresh();

    // Then check every 30 seconds (stable interval)
    const refreshTimer = setInterval(checkAndRefresh, 30000);

    return () => clearInterval(refreshTimer);
  }, [state.isAuthenticated]); // Only re-run when auth state changes

  // Update activity timestamp on user interaction
  useEffect(() => {
    const updateActivity = () => {
      if (state.isAuthenticated) {
        dispatch({ type: 'UPDATE_LAST_ACTIVITY' });
      }
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, updateActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity, true);
      });
    };
  }, []);

  // ========== CONTEXT VALUE ==========

  const contextValue: AuthContextType = {
    // State
    ...state,
    
    // Actions
    login,
    logout,
    register,
    refreshTokens,
    
    // Permission Checking
    hasPermission,
    hasSecurityLevel,
    hasAccessLevel,
    canAccessRoute,
    
    // User Updates
    updateUserProperty,
    markEmailVerified,
    markIntakeCompleted,
    
    // Utility
    clearError,
    isTokenExpiring,
    getRedirectAfterLogin,
    setRedirectAfterLogin
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// ========== HOOKS ==========

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// ========== UTILITY FUNCTIONS ==========

function mapBackendTierToUserTier(backendTier: string): UserTier {
  switch (backendTier?.toLowerCase()) {
    case 'admin': return UserTier.ADMIN;
    case 'premium': return UserTier.PREMIUM;
    case 'verified': return UserTier.VERIFIED;
    case 'basic': return UserTier.BASIC;
    default: return UserTier.GUEST;
  }
}

// Export additional utilities
export { ROUTE_PERMISSIONS };
