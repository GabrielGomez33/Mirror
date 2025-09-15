// src/components/Login.tsx - Fixed version with proper TypeScript
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useIntake } from '../context/IntakeContext';

interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface ValidationErrors {
  email?: string;
  password?: string;
  general?: string;
}

interface LoginAttempt {
  timestamp: number;
  failed: boolean;
}

interface LockoutInfo {
  locked: boolean;
  timeRemaining: number;
}

// Security class for login attempts
class LoginSecurity {
  private static readonly STORAGE_KEY = 'loginAttempts';
  private static readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
  
  // Make MAX_ATTEMPTS public
  static readonly MAX_ATTEMPTS = 5;

  static getAttempts(): LoginAttempt[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  static recordAttempt(failed: boolean): void {
    const attempts = this.getAttempts();
    const newAttempt: LoginAttempt = {
      timestamp: Date.now(),
      failed
    };
    
    // Keep only recent attempts (last 24 hours)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentAttempts = attempts.filter(a => a.timestamp > oneDayAgo);
    recentAttempts.push(newAttempt);
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(recentAttempts));
  }

  static isAccountLocked(): LockoutInfo {
    const attempts = this.getAttempts();
    const recentFailures = attempts.filter(a => 
      a.failed && 
      Date.now() - a.timestamp < this.LOCKOUT_DURATION
    );

    if (recentFailures.length >= this.MAX_ATTEMPTS) {
      const oldestFailure = Math.min(...recentFailures.map(a => a.timestamp));
      const timeRemaining = this.LOCKOUT_DURATION - (Date.now() - oldestFailure);
      
      return {
        locked: timeRemaining > 0,
        timeRemaining: Math.max(0, Math.ceil(timeRemaining / 1000))
      };
    }

    return { locked: false, timeRemaining: 0 };
  }

  static getFailedAttemptCount(): number {
    const attempts = this.getAttempts();
    return attempts.filter(a => 
      a.failed && 
      Date.now() - a.timestamp < this.LOCKOUT_DURATION
    ).length;
  }
}

const LogUserIn: React.FC = () => {
  const navigate = useNavigate();
  const { 
    login, 
    error: authError, 
    isLoading, 
    clearError,
    getRedirectAfterLogin 
  } = useAuth();
  const { updateIntake } = useIntake();

  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
    rememberMe: false
  });

  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [isSuccess, setIsSuccess] = useState(false);
  const [lockoutInfo, setLockoutInfo] = useState<LockoutInfo>({ locked: false, timeRemaining: 0 });

  // Load remembered email
  useEffect(() => {
    const rememberedEmail = localStorage.getItem('rememberedEmail');
    if (rememberedEmail) {
      setFormData(prev => ({ ...prev, email: rememberedEmail, rememberMe: true }));
    }
  }, []);

  // Check lockout status
  useEffect(() => {
    const checkLockout = () => {
      const lockStatus = LoginSecurity.isAccountLocked();
      setLockoutInfo(lockStatus);
    };

    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, []);

  // Clear auth errors when form changes
  useEffect(() => {
    if (authError) {
      clearError();
    }
  }, [formData, authError, clearError]);

  // Validate form
  const validateForm = () => {
    const errors: ValidationErrors = {};

    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 3) {
      errors.password = 'Password is too short';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if account is locked
    if (lockoutInfo.locked) {
      const minutes = Math.floor(lockoutInfo.timeRemaining / 60);
      const seconds = lockoutInfo.timeRemaining % 60;
      setValidationErrors({
        general: `Account temporarily locked. Please wait ${minutes}:${seconds.toString().padStart(2, '0')}`
      });
      return;
    }

    if (!validateForm()) {
      return;
    }

    try {
      await login(formData.email, formData.password);
      
      // Record successful attempt
      LoginSecurity.recordAttempt(false);
      
      // Handle remember me
      if (formData.rememberMe) {
        localStorage.setItem('rememberedEmail', formData.email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }

      // Update intake context with user info
      updateIntake({ 
        userLoggedIn: true,
        name: formData.email.split('@')[0]
      });

      setIsSuccess(true);
      
      // Navigate after success animation
      setTimeout(() => {
        const redirectTo = getRedirectAfterLogin();
        navigate(redirectTo);
      }, 1500);

    } catch (error: any) {
      // Record failed attempt
      LoginSecurity.recordAttempt(true);
      
      const failedCount = LoginSecurity.getFailedAttemptCount();
      const attemptsRemaining = LoginSecurity.MAX_ATTEMPTS - failedCount;
      
      let errorMessage = error.message || 'Login failed. Please check your credentials.';
      
      if (attemptsRemaining > 0 && attemptsRemaining <= 2) {
        errorMessage += ` (${attemptsRemaining} attempts remaining)`;
      }
      
      setValidationErrors({ general: errorMessage });
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-900 via-blue-900 to-indigo-900">
        <div className="glass-panel p-8 rounded-xl text-center">
          <div className="text-green-400 text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-white mb-2">Login Successful!</h2>
          <p className="text-white/80">Redirecting you to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 px-4">
      <div className="glass-panel p-8 rounded-xl w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-4">🌟</div>
          <h2 className="text-2xl font-bold text-white mb-2">Welcome Back</h2>
          <p className="text-white/60">Sign in to your account</p>
        </div>

        {/* Lockout Warning */}
        {lockoutInfo.locked && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2">
              <span className="text-red-400">🔒</span>
              <span className="text-white text-sm">
                Account locked due to multiple failed attempts. Try again in{' '}
                <span className="font-bold">
                  {Math.floor(lockoutInfo.timeRemaining / 60)}:{(lockoutInfo.timeRemaining % 60).toString().padStart(2, '0')}
                </span>
              </span>
            </div>
          </div>
        )}

        {/* Error Messages */}
        {(validationErrors.general || authError) && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-6">
            <p className="text-red-200 text-sm">
              {validationErrors.general || authError}
            </p>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Field */}
          <div>
            <label className="block text-white/80 text-sm font-medium mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className={`w-full glass-input px-4 py-3 rounded-lg text-white placeholder-white/50 ${
                validationErrors.email ? 'border-red-500/50' : 'border-white/20'
              }`}
              placeholder="Enter your email"
              autoComplete="email"
              disabled={lockoutInfo.locked}
            />
            {validationErrors.email && (
              <p className="text-red-400 text-xs mt-1">{validationErrors.email}</p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-white/80 text-sm font-medium mb-2">
              Password
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              className={`w-full glass-input px-4 py-3 rounded-lg text-white placeholder-white/50 ${
                validationErrors.password ? 'border-red-500/50' : 'border-white/20'
              }`}
              placeholder="Enter your password"
              autoComplete="current-password"
              disabled={lockoutInfo.locked}
            />
            {validationErrors.password && (
              <p className="text-red-400 text-xs mt-1">{validationErrors.password}</p>
            )}
          </div>

          {/* Remember Me */}
          <div className="flex items-center justify-between">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.rememberMe}
                onChange={(e) => setFormData(prev => ({ ...prev, rememberMe: e.target.checked }))}
                className="glass-checkbox"
                disabled={lockoutInfo.locked}
              />
              <span className="text-white/80 text-sm">Remember me</span>
            </label>
            
            <Link
              to="/forgot-password"
              className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
            >
              Forgot password?
            </Link>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || lockoutInfo.locked}
            className="w-full glass-button bg-blue-600/30 hover:bg-blue-600/40 text-white py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Signing in...</span>
              </div>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Register Link */}
        <div className="text-center mt-6">
          <p className="text-white/60 text-sm">
            Don't have an account?{' '}
            <Link 
              to="/register" 
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              Sign up
            </Link>
          </p>
        </div>

        {/* Security Info */}
        {LoginSecurity.getFailedAttemptCount() > 0 && !lockoutInfo.locked && (
          <div className="mt-4 text-center">
            <p className="text-yellow-400/80 text-xs">
              {LoginSecurity.getFailedAttemptCount()} failed attempts detected
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LogUserIn;
