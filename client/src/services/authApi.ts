// src/services/authApi.ts
import { getToken, setToken, clearToken } from '../utils/token';

const BASE_URL = import.meta.env.VITE_API_URL;

// ========== TYPES ==========

export interface LoginRequest {
  email: string;
  password: string;
  deviceFingerprint?: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  deviceFingerprint?: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  expiresIn: number;
}

export interface VerifyTokenResponse {
  valid: boolean;
  user?: {
    id: number;
    username: string;
    email: string;
    tier?: string;
    emailVerified: boolean;
    intakeCompleted: boolean;
    subscriptionStatus: string;
    sessionId: string;
  };
  expiresAt?: string;
  error?: string;
  code?: string;
}

export interface AuthResponse {
  message: string;
  user: {
    id: number;
    username: string;
    email: string;
    tier?: string;
    emailVerified: boolean;
    intakeCompleted: boolean;
    subscriptionStatus: string;
    lastLogin?: string;
    sessionId: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  security?: {
    suspicious: boolean;
    newDevice: boolean;
  };
}

export interface ApiError {
  error: string;
  code: string;
  details?: any;
}

// ========== API CLIENT CLASS ==========

class AuthApiClient {
  private baseUrl: string;
  private maxRetries: number = 3;

  constructor() {
    this.baseUrl = `${BASE_URL}/mirror/api/auth`;
  }

  // ========== PRIVATE METHODS ==========

  /**
   * Wrapper around fetch with bounded, per-call retry on network failure.
   * NOTE: retry count is a LOCAL variable, not a class field — previously this
   * was tracked on the instance and a single bad network blip could lock all
   * subsequent calls into retry mode if the success-reset path didn't run.
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    requireAuth: boolean = false,
    attempt: number = 0
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (requireAuth) {
      const token = getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const config: RequestInit = {
      ...options,
      headers,
      credentials: 'include'
    };

    try {
      const response = await fetch(url, config);
      // Some endpoints (HEAD/204) may not return JSON — guard against it.
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const error: ApiError = {
          error: (data as any).error || 'Request failed',
          code: (data as any).code || 'UNKNOWN_ERROR',
          details: data
        };
        // Surface retryAfter when the server emits one.
        if ((data as any).retryAfter !== undefined) {
          (error as any).retryAfter = (data as any).retryAfter;
        }
        throw error;
      }

      return data as T;
    } catch (error) {
      // Retry only on genuine network failures, bounded per-call.
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        if (attempt < this.maxRetries) {
          await this.delay(1000 * (attempt + 1));
          return this.makeRequest<T>(endpoint, options, requireAuth, attempt + 1);
        }
      }
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateDeviceFingerprint(): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx?.fillText('fingerprint', 10, 10);
    
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL(),
      navigator.hardwareConcurrency || 0,
      navigator.maxTouchPoints || 0
    ].join('|');

    return btoa(fingerprint).slice(0, 32);
  }

  // ========== PUBLIC METHODS ==========

  async register(data: RegisterRequest): Promise<AuthResponse> {
    console.log('FUNCTION: registerUser');
    
    const requestData = {
      ...data,
      deviceFingerprint: data.deviceFingerprint || this.generateDeviceFingerprint()
    };

    try {
      const response = await this.makeRequest<AuthResponse>('/register', {
        method: 'POST',
        body: JSON.stringify(requestData)
      });

      // Store tokens immediately
      setToken(response.tokens.accessToken);
      setToken(response.tokens.refreshToken, 'refreshToken');

      return response;
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    console.log('FUNCTION: loginUser');
    
    const requestData = {
      ...data,
      deviceFingerprint: data.deviceFingerprint || this.generateDeviceFingerprint()
    };

    try {
      const response = await this.makeRequest<AuthResponse>('/login', {
        method: 'POST',
        body: JSON.stringify(requestData)
      });

      console.log(`/mirror/api/auth/login: Login Attempt ->`, response);
      
      // Store tokens
      setToken(response.tokens.accessToken);
      setToken(response.tokens.refreshToken, 'refreshToken');

      return response;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  async logout(allDevices: boolean = false): Promise<{ message: string }> {
    console.log('FUNCTION: logoutUser');
    
    try {
      const endpoint = allDevices ? '/logout-all' : '/logout';
      const response = await this.makeRequest<{ message: string }>(endpoint, {
        method: 'POST'
      }, true);

      return response;
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    } finally {
      // Always clear tokens locally
      clearToken();
      clearToken('refreshToken');
    }
  }

  async refreshToken(): Promise<RefreshTokenResponse> {
    console.log('FUNCTION: refreshToken');

    const refreshToken = getToken('refreshToken');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await this.makeRequest<RefreshTokenResponse>('/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken })
      });

      // Update access token
      setToken(response.accessToken);

      return response;
    } catch (error) {
      console.error('Token refresh failed:', error);
      // Clear tokens on refresh failure
      clearToken();
      clearToken('refreshToken');
      throw error;
    }
  }

  async verifyToken(): Promise<VerifyTokenResponse> {
    console.log('FUNCTION: verifyToken');
    
    try {
      const response = await this.makeRequest<VerifyTokenResponse>('/verify', {
        method: 'GET'
      }, true);

      return response;
    } catch (error) {
      console.error('Token verification failed:', error);
      throw error;
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    try {
      const response = await this.makeRequest<{ message: string }>('/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      }, true);

      return response;
    } catch (error) {
      console.error('Password change failed:', error);
      throw error;
    }
  }

  // Starts the re-verify email change: stages a pending change server-side and
  // emails a single-use confirmation link to `newEmail`. The address is NOT
  // changed until that link is confirmed via confirmEmailChange().
  async changeEmail(newEmail: string, currentPassword: string): Promise<{ message: string; expiresIn?: string }> {
    try {
      const response = await this.makeRequest<{ message: string; expiresIn?: string }>('/change-email', {
        method: 'POST',
        body: JSON.stringify({ newEmail, currentPassword })
      }, true);

      return response;
    } catch (error) {
      console.error('Email change request failed:', error);
      throw error;
    }
  }

  // Confirms a pending email change from the emailed token. Unauthenticated —
  // the token is the credential (same model as verifyEmail).
  async confirmEmailChange(token: string): Promise<{ message: string; email?: string }> {
    try {
      const response = await this.makeRequest<{ message: string; email?: string }>('/change-email/confirm', {
        method: 'POST',
        body: JSON.stringify({ token })
      });

      return response;
    } catch (error) {
      console.error('Email change confirmation failed:', error);
      throw error;
    }
  }

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    console.log('FUNCTION: requestPasswordReset');
    
    try {
      const response = await this.makeRequest<{ message: string }>('/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email })
      });

      return response;
    } catch (error) {
      console.error('Password reset request failed:', error);
      throw error;
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    console.log('FUNCTION: resetPassword');

    try {
      const response = await this.makeRequest<{ message: string }>('/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword })
      });

      return response;
    } catch (error) {
      console.error('Password reset failed:', error);
      throw error;
    }
  }

  async validateResetToken(token: string): Promise<{ valid: boolean; expiresAt?: string; error?: string; code?: string }> {
    // Read-only token check. Does NOT consume the token.
    try {
      const qs = encodeURIComponent(token);
      const response = await this.makeRequest<{ valid: boolean; expiresAt?: string }>(
        `/reset-password/validate?token=${qs}`,
        { method: 'GET' }
      );
      return response;
    } catch (error: any) {
      // Normalize the failure shape so callers can switch on { valid, code }.
      return {
        valid: false,
        error: error?.error || error?.message || 'Reset link could not be validated.',
        code: error?.code || 'UNKNOWN_ERROR',
      };
    }
  }

  async requestEmailVerification(): Promise<{ message: string }> {
    console.log('FUNCTION: requestEmailVerification');
    
    try {
      const response = await this.makeRequest<{ message: string }>('/send-verification', {
        method: 'POST'
      }, true);

      return response;
    } catch (error) {
      console.error('Email verification request failed:', error);
      throw error;
    }
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    console.log('FUNCTION: verifyEmail');
    
    try {
      const response = await this.makeRequest<{ message: string }>('/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token })
      });

      return response;
    } catch (error) {
      console.error('Email verification failed:', error);
      throw error;
    }
  }

  async getUserProfile(): Promise<any> {
    console.log('FUNCTION: getUserProfile');
    
    try {
      const response = await this.makeRequest<any>('/profile', {
        method: 'GET'
      }, true);

      return response;
    } catch (error) {
      console.error('Get user profile failed:', error);
      throw error;
    }
  }

  async updateUserProfile(updates: Partial<{
    username: string;
    email: string;
    preferences: any;
  }>): Promise<{ message: string; user: any }> {
    console.log('FUNCTION: updateUserProfile');
    
    try {
      const response = await this.makeRequest<{ message: string; user: any }>('/profile', {
        method: 'PUT',
        body: JSON.stringify(updates)
      }, true);

      return response;
    } catch (error) {
      console.error('Update user profile failed:', error);
      throw error;
    }
  }

  async getSessions(): Promise<{ sessions: any[] }> {
    console.log('FUNCTION: getSessions');
    
    try {
      const response = await this.makeRequest<{ sessions: any[] }>('/sessions', {
        method: 'GET'
      }, true);

      return response;
    } catch (error) {
      console.error('Get sessions failed:', error);
      throw error;
    }
  }

  async revokeSession(sessionId: string): Promise<{ message: string }> {
    console.log('FUNCTION: revokeSession');
    
    try {
      const response = await this.makeRequest<{ message: string }>(`/sessions/${sessionId}`, {
        method: 'DELETE'
      }, true);

      return response;
    } catch (error) {
      console.error('Revoke session failed:', error);
      throw error;
    }
  }

  async deleteAccount(
    password: string,
    confirmation: string = 'DELETE',
  ): Promise<{ message: string; dinaNotified?: boolean; dinaDetail?: string }> {
    console.log('FUNCTION: deleteAccount');

    try {
      const response = await this.makeRequest<{
        message: string;
        dinaNotified?: boolean;
        dinaDetail?: string;
      }>(
        '/delete-account',
        {
          method: 'DELETE',
          body: JSON.stringify({ password, confirmation }),
        },
        true,
      );

      // Wipe every client-side artefact so a refresh redirects to /login and
      // no stale "rememberedEmail" / userInfo blob leaks across to the next
      // user of this device. Each removeItem is wrapped because Safari
      // private-mode can throw on localStorage writes.
      clearToken();              // mirror_jwt
      clearToken('refreshToken');
      clearToken('userInfo');
      try { localStorage.removeItem('rememberedEmail'); } catch { /* non-fatal */ }
      try { localStorage.removeItem('loginAttempts'); } catch { /* non-fatal */ }

      return response;
    } catch (error) {
      console.error('Account deletion failed:', error);
      // makeRequest throws ApiError ({ error, code, details }). The
      // confirmation modal reads err.message, so promote any server-supplied
      // `detail` (added in Phase 2a) into a proper Error instance so the
      // underlying cause makes it to the UI when something goes wrong.
      const apiErr = error as any;
      if (apiErr && typeof apiErr === 'object' && !(apiErr instanceof Error)) {
        const userMsg = apiErr.error || 'Account deletion failed.';
        const debugDetail = apiErr.details?.detail || apiErr.detail;
        const composed = debugDetail ? `${userMsg} — ${debugDetail}` : userMsg;
        const promoted = new Error(composed);
        (promoted as any).code = apiErr.code;
        (promoted as any).details = apiErr.details;
        throw promoted;
      }
      throw error;
    }
  }
}

// ========== SINGLETON INSTANCE ==========

const authApi = new AuthApiClient();

// ========== EXPORTED FUNCTIONS ==========

export const registerUser = (data: RegisterRequest) => authApi.register(data);
export const loginUser = (data: LoginRequest) => authApi.login(data);
export const logoutUser = (allDevices?: boolean) => authApi.logout(allDevices);
export const refreshTokenApi = () => authApi.refreshToken();
export const verifyTokenApi = () => authApi.verifyToken();
export const logoutApi = (allDevices?: boolean) => authApi.logout(allDevices); // This was missing!
export const changePasswordApi = (currentPassword: string, newPassword: string) =>
  authApi.changePassword(currentPassword, newPassword);
export const changeEmailApi = (newEmail: string, currentPassword: string) =>
  authApi.changeEmail(newEmail, currentPassword);
export const confirmEmailChangeApi = (token: string) =>
  authApi.confirmEmailChange(token);
export const requestPasswordResetApi = (email: string) => 
  authApi.requestPasswordReset(email);
export const resetPasswordApi = (token: string, newPassword: string) =>
  authApi.resetPassword(token, newPassword);
export const validateResetTokenApi = (token: string) =>
  authApi.validateResetToken(token);
export const requestEmailVerificationApi = () => 
  authApi.requestEmailVerification();
export const verifyEmailApi = (token: string) => 
  authApi.verifyEmail(token);
export const getUserProfileApi = () => 
  authApi.getUserProfile();
export const updateUserProfileApi = (updates: any) => 
  authApi.updateUserProfile(updates);
export const getSessionsApi = () => 
  authApi.getSessions();
export const revokeSessionApi = (sessionId: string) => 
  authApi.revokeSession(sessionId);
export const deleteAccountApi = (password: string, confirmation: string = 'DELETE') =>
  authApi.deleteAccount(password, confirmation);

// Export the instance for advanced usage
export { authApi };

// ========== ERROR HANDLING UTILITIES ==========

export const isAuthError = (error: any): error is ApiError => {
  return error && typeof error.error === 'string' && typeof error.code === 'string';
};

export const getErrorMessage = (error: any): string => {
  if (isAuthError(error)) {
    return error.error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
};

export const isNetworkError = (error: any): boolean => {
  return error instanceof TypeError && error.message === 'Failed to fetch';
};

export const isTokenExpiredError = (error: any): boolean => {
  return isAuthError(error) && (
    error.code === 'INVALID_TOKEN' || 
    error.code === 'SESSION_EXPIRED' ||
    error.code === 'TOKEN_EXPIRED'
  );
};

export const isAuthenticationRequiredError = (error: any): boolean => {
  return isAuthError(error) && (
    error.code === 'NO_TOKEN' ||
    error.code === 'AUTH_REQUIRED' ||
    error.code === 'UNAUTHORIZED'
  );
};