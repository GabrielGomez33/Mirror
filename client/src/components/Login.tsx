// src/components/Login.tsx - Styled to match RegistrationStep with BasicScene background
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useIntake } from '../context/IntakeContext';
import GlassCard from './ui/GlassCard';
import { motion, AnimatePresence } from 'framer-motion';
import BasicScene from './three/BasicScene';

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
  const [showPassword, setShowPassword] = useState(false);

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

  // Success state
  if (isSuccess) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <BasicScene />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ duration: 1.5 }}
          className="absolute inset-0 bg-gradient-to-br from-green-100/50 via-emerald-50/30 to-teal-100/50 pointer-events-none"
        />

        <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", duration: 0.8 }}
            className=""
          >
            <GlassCard enhanced gradient className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: "spring", duration: 0.6 }}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 mx-auto flex items-center justify-center"
                
              />

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <h2 className="text-3xl font-bold text-white mb-2">Welcome Back</h2>
                <p className="text-white/80">Redirecting you to your dashboard...</p>
              </motion.div>
            </GlassCard>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      {/* Three.js Background */}
      <BasicScene />

      {/* Gradient overlay - EXACT same as RegistrationStep */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ duration: 1.5 }}
        className="absolute inset-0 bg-gradient-to-br from-indigo-100/50 via-purple-50/30 to-pink-100/50 pointer-events-none"
      />

      {/* Floating Particles - EXACT same as RegistrationStep */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            initial={{
              x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
              y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
              scale: 0
            }}
            animate={{
              y: [null, Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800)],
              scale: [0, 1, 0],
              opacity: [0, 0.4, 0]
            }}
            transition={{
              duration: Math.random() * 8 + 6,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute w-2 h-2 bg-gradient-to-r from-white to-indigo-300 rounded-full"
          />
        ))}
      </div>

      {/* Content layer - matches RegistrationStep structure */}
      <div className="relative z-10 min-h-screen flex flex-col justify-center items-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-md"
          style={{minWidth:"65vw", maxWidth:"75vw"}}
        >
          <GlassCard enhanced gradient className="space-y-4 rounded-[20px]">
            {/* Header */}
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5 }}
              className="text-center space-y-3"
            >
              <div className="flex justify-center mb-2">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center"
                >
                  <span className="text-2xl">🌟</span>
                </motion.div>
              </div>

              <h2 className="text-3xl font-bold text-white text-shadow-soft">Welcome Back</h2>
              <p className="text-white/80 text-sm">"He who has a why to live can bear almost any how."</p>
            </motion.div>

            {/* Lockout Warning */}
            <AnimatePresence>
              {lockoutInfo.locked && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.3 }}
                  className="bg-red-400/20 border border-red-400/30 rounded-xl p-3"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">🔒</span>
                    <span className="text-white text-xs">
                      Account locked. Try again in{' '}
                      <span className="font-bold text-red-300">
                        {Math.floor(lockoutInfo.timeRemaining / 60)}:{(lockoutInfo.timeRemaining % 60).toString().padStart(2, '0')}
                      </span>
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error Messages */}
            <AnimatePresence>
              {(validationErrors.general || authError) && !lockoutInfo.locked && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.3 }}
                  className="p-3 rounded-xl text-center font-medium bg-red-400/20 text-red-200 border border-red-400/30 text-sm"
                >
                  {validationErrors.general || authError}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Field - glass-card-enhanced wrapper like RegistrationStep */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                <div className="glass-card-enhanced flex justify-center d p-4 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <div className="flex-1">
                      <span className="text-sm shrink-0 opacity-70">📧</span>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        className={`
                          w-lg sm:max-w-lg p-3 bg-white/10 border-2 rounded-lg text-white placeholder-white/50
                          focus:outline-none focus:border-white/40 transition-all duration-300
                          ${validationErrors.email ? 'border-red-400' :
                            formData.email && !validationErrors.email ? 'border-green-400' : 'border-white/20'}
                        `}
                        placeholder="Enter your email address"
                        autoComplete="email"
                        disabled={lockoutInfo.locked}
                      />

                      <AnimatePresence>
                        {validationErrors.email && (
                          <motion.p
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="text-red-400 text-sm mt-2"
                          >
                            {validationErrors.email}
                          </motion.p>
                        )}
                      </AnimatePresence>

                      {formData.email && !validationErrors.email && (
                        <motion.p
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="text-green-400 text-sm mt-2 flex items-center space-x-1"
                        >
                          <span>✓</span>
                          <span>Looks good!</span>
                        </motion.p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Password Field - glass-card-enhanced wrapper like RegistrationStep */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                <div className="glass-card-enhanced flex justify-center p-4 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">🔒</span>
                    <div className="flex-1">
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                          className={`
                            w-lg sm:max-w-lg p-3 bg-white/10 border-2 rounded-lg text-white placeholder-white/50
                            focus:outline-none focus:border-white/40 transition-all duration-300
                            ${validationErrors.password ? 'border-red-400' :
                              formData.password && !validationErrors.password ? 'border-green-400' : 'border-white/20'}
                          `}
                          placeholder="Enter your password"
                          autoComplete="current-password"
                          disabled={lockoutInfo.locked}
                        />

                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white"
                        >
                          {showPassword ? '🙈' : '👁️'}
                        </button>
                      </div>

                      <AnimatePresence>
                        {validationErrors.password && (
                          <motion.p
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="text-red-400 text-sm mt-2"
                          >
                            {validationErrors.password}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Remember Me & Forgot Password */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="flex items-center justify-between px-1"
              >
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
                  className="text-indigo-300 hover:text-indigo-200 text-sm transition-colors"
                >
                  Forgot password?
                </Link>
              </motion.div>

              {/* Submit Button - matches RegistrationStep button style */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <button
                  type="submit"
                  disabled={isLoading || lockoutInfo.locked}
                  className={`
                    w-full py-4 text-lg font-semibold transition-all duration-300 rounded-xl
                    glass-card-enhanced border border-white/20 backdrop-blur-sm
                    ${isLoading || lockoutInfo.locked
                      ? 'bg-white/5 opacity-50 cursor-not-allowed text-white/50'
                      : 'bg-gradient-to-r from-indigo-400/20 to-purple-400/20 hover:from-indigo-400/30 hover:to-purple-400/30 hover:scale-105 text-white hover:border-white/40'
                    }
                  `}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center space-x-2">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                      />
                      <span>Signing in...</span>
                    </span>
                  ) : (
                    <span className="flex items-center justify-center space-x-2">
                      <span>🚀</span>
                      <span style={{color:"black", fontSize:"0.6rem", textShadow:"0 4px 20px rgba(0, 0, 0, .3)"}}>Sign In</span>
                    </span>
                  )}
                </button>
              </motion.div>
            </form>

            {/* Failed Attempts Warning */}
            <AnimatePresence>
              {LoginSecurity.getFailedAttemptCount() > 0 && !lockoutInfo.locked && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="text-center"
                >
                  <p className="text-yellow-400/80 text-xs">
                    {LoginSecurity.getFailedAttemptCount()} failed attempt{LoginSecurity.getFailedAttemptCount() !== 1 ? 's' : ''} detected
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Footer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="text-center pt-4 border-t border-white/10"
            >
              <p className="text-white/60 text-sm">
                Don't have an account?{' '}
                <button
                  onClick={() => navigate('/register')}
                  className="text-indigo-300 hover:text-indigo-200 underline transition-colors"
                >
                  Sign up here
                </button>
              </p>
            </motion.div>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
};

export default LogUserIn;

