// src/components/Login.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntake } from '../context/IntakeContext';
import { loginUser } from '../services/api';
import GlassCard from './ui/GlassCard';
import { motion, AnimatePresence } from 'framer-motion';
import BasicScene from './three/BasicScene';

interface ValidationErrors {
  email?: string;
  password?: string;
}

interface LoginAttempt {
  timestamp: number;
  failed: boolean;
}

const LogUserIn = () => {
  const navigate = useNavigate();
  const { updateIntake } = useIntake();
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  
  // UI State
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [loginAttempts, setLoginAttempts] = useState<LoginAttempt[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [lockTimeRemaining, setLockTimeRemaining] = useState(0);

  // Security: Track failed login attempts
  useEffect(() => {
    const storedAttempts = localStorage.getItem('loginAttempts');
    if (storedAttempts) {
      const attempts: LoginAttempt[] = JSON.parse(storedAttempts);
      const recentFailedAttempts = attempts.filter(
        attempt => attempt.failed && Date.now() - attempt.timestamp < 15 * 60 * 1000 // 15 minutes
      );
      
      setLoginAttempts(recentFailedAttempts);
      
      if (recentFailedAttempts.length >= 3) {
        const lastAttempt = recentFailedAttempts[recentFailedAttempts.length - 1];
        const lockTime = 15 * 60 * 1000; // 15 minutes
        const timeElapsed = Date.now() - lastAttempt.timestamp;
        
        if (timeElapsed < lockTime) {
          setIsLocked(true);
          setLockTimeRemaining(Math.ceil((lockTime - timeElapsed) / 1000));
        }
      }
    }
  }, []);

  // Countdown timer for locked account
  useEffect(() => {
    if (isLocked && lockTimeRemaining > 0) {
      const timer = setInterval(() => {
        setLockTimeRemaining(prev => {
          if (prev <= 1) {
            setIsLocked(false);
            setLoginAttempts([]);
            localStorage.removeItem('loginAttempts');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [isLocked, lockTimeRemaining]);

  // Real-time validation
  useEffect(() => {
    const errors: ValidationErrors = {};
    
    // Email validation
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    // Password validation
    if (password && password.length < 3) {
      errors.password = 'Password is too short';
    }
    
    setValidationErrors(errors);
  }, [email, password]);

  const recordLoginAttempt = (failed: boolean) => {
    const attempt: LoginAttempt = {
      timestamp: Date.now(),
      failed
    };
    
    const updatedAttempts = [...loginAttempts, attempt];
    setLoginAttempts(updatedAttempts);
    localStorage.setItem('loginAttempts', JSON.stringify(updatedAttempts));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLocked) {
      setMessage(`❌ Account temporarily locked. Please wait ${Math.floor(lockTimeRemaining / 60)}:${(lockTimeRemaining % 60).toString().padStart(2, '0')}`);
      return;
    }
    
    if (Object.keys(validationErrors).length > 0) {
      setMessage('❌ Please fix all validation errors');
      return;
    }
    
    setLoading(true);
    setMessage('');
    
    try {
      const result = await loginUser({ email, password });
      console.log(result);
      
      recordLoginAttempt(false);
      updateIntake({ 
        userLoggedIn: true,
        name: email.split('@')[0] // Use email username as name
      });
      
      setIsSuccess(true);
      setMessage('✅ Login successful!');
      
      // Store remember me preference
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }
      
      // Navigate after success animation
      setTimeout(() => {
        navigate('/intake');
      }, 1500);
      
    } catch (err: any) {
      recordLoginAttempt(true);
      
      const failedCount = loginAttempts.filter(a => a.failed).length + 1;
      let errorMessage = '❌ ' + (err.message || 'Login failed. Please check your credentials.');
      
      if (failedCount >= 2) {
        errorMessage += ` (${3 - failedCount} attempts remaining)`;
      }
      
      setMessage(errorMessage);
      console.error('LOGIN FAILED: ', err);
      
      // Check if we should lock the account
      if (failedCount >= 3) {
        setIsLocked(true);
        setLockTimeRemaining(15 * 60); // 15 minutes
        setMessage('❌ Too many failed attempts. Account locked for 15 minutes.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Load remembered email on component mount
  useEffect(() => {
    const rememberedEmail = localStorage.getItem('rememberedEmail');
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, []);

  const formatLockTime = () => {
    const minutes = Math.floor(lockTimeRemaining / 60);
    const seconds = lockTimeRemaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
          >
            <GlassCard enhanced gradient className="text-center space-y-6 max-w-md">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: "spring", duration: 0.6 }}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 mx-auto flex items-center justify-center"
              >
                <span className="text-4xl">✅</span>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <h2 className="text-3xl font-bold text-white mb-2">Welcome Back!</h2>
                <p className="text-white/80">Successfully logged in to your account.</p>
                <p className="text-white/60 text-sm mt-3">Redirecting to your dashboard...</p>
              </motion.div>
            </GlassCard>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Three.js Background */}
      <BasicScene />
      
      {/* Gradient overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ duration: 1.5 }}
        className="absolute inset-0 bg-gradient-to-br from-blue-100/50 via-indigo-50/30 to-purple-100/50 pointer-events-none"
      />

      {/* Floating Login Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(10)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ 
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
              scale: 0
            }}
            animate={{
              y: [null, Math.random() * window.innerHeight],
              scale: [0, 1, 0],
              opacity: [0, 0.3, 0]
            }}
            transition={{
              duration: Math.random() * 10 + 8,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute w-2 h-2 bg-gradient-to-r from-white to-blue-300 rounded-full"
          />
        ))}
      </div>

      <div className="relative z-10 min-h-screen flex flex-col justify-center items-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="w-full max-w-md"
        >
          <GlassCard enhanced gradient className="space-y-6">
            {/* Header */}
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5 }}
              className="text-center space-y-4"
            >
              <div className="flex justify-center mb-4">
                <motion.div
                  animate={{ 
                    rotate: [0, 10, -10, 0],
                    scale: [1, 1.05, 1]
                  }}
                  transition={{ 
                    duration: 3, 
                    repeat: Infinity, 
                    ease: "easeInOut"
                  }}
                  className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center"
                >
                  <span className="text-2xl">🔐</span>
                </motion.div>
              </div>
              
              <h2 className="text-3xl font-bold text-white text-shadow-soft">Welcome Back</h2>
              <p className="text-white/80">Sign in to continue your cosmic journey</p>
            </motion.div>

            {/* Account Lock Warning */}
            <AnimatePresence>
              {isLocked && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="glass-card-enhanced p-4 rounded-xl border border-red-400/30 bg-red-400/10"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">🚫</span>
                    <div>
                      <h3 className="text-red-200 font-semibold">Account Temporarily Locked</h3>
                      <p className="text-red-300/80 text-sm">
                        Too many failed attempts. Try again in {formatLockTime()}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Field */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="space-y-2"
              >
                <div className="glass-card-enhanced p-4 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <motion.span 
                      animate={{ 
                        scale: focusedField === 'email' ? 1.2 : 1,
                        rotate: focusedField === 'email' ? [0, -10, 10, 0] : 0
                      }}
                      transition={{ duration: 0.3 }}
                      className="text-2xl"
                    >
                      📧
                    </motion.span>
                    <div className="flex-1">
                      <input
                        type="email"
                        placeholder="Enter your email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onFocus={() => setFocusedField('email')}
                        onBlur={() => setFocusedField(null)}
                        disabled={isLocked}
                        className={`
                          w-full p-3 bg-white/10 border-2 rounded-lg text-white placeholder-white/50 
                          focus:outline-none focus:border-white/40 transition-all duration-300
                          ${validationErrors.email ? 'border-red-400' : 
                            email && !validationErrors.email ? 'border-green-400' : 'border-white/20'}
                          ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                        required
                        autoComplete="email"
                      />
                    </div>
                  </div>
                  
                  {/* Email Validation */}
                  <AnimatePresence>
                    {validationErrors.email && (
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="text-red-400 text-sm mt-2 ml-11"
                      >
                        {validationErrors.email}
                      </motion.p>
                    )}
                  </AnimatePresence>
                  
                  {/* Email Success */}
                  {email && !validationErrors.email && (
                    <motion.p
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-green-400 text-sm mt-2 ml-11 flex items-center space-x-1"
                    >
                      <span>✓</span>
                      <span>Valid email format</span>
                    </motion.p>
                  )}
                </div>
              </motion.div>

              {/* Password Field */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="space-y-2"
              >
                <div className="glass-card-enhanced p-4 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <motion.span 
                      animate={{ 
                        scale: focusedField === 'password' ? 1.2 : 1,
                        rotate: focusedField === 'password' ? [0, -10, 10, 0] : 0
                      }}
                      transition={{ duration: 0.3 }}
                      className="text-2xl"
                    >
                      🔑
                    </motion.span>
                    <div className="flex-1 relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={() => setFocusedField('password')}
                        onBlur={() => setFocusedField(null)}
                        disabled={isLocked}
                        className={`
                          w-full p-3 bg-white/10 border-2 rounded-lg text-white placeholder-white/50 
                          focus:outline-none focus:border-white/40 transition-all duration-300 pr-12
                          ${validationErrors.password ? 'border-red-400' : 
                            password && !validationErrors.password ? 'border-green-400' : 'border-white/20'}
                          ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                        required
                        autoComplete="current-password"
                      />
                      
                      {/* Password visibility toggle */}
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        disabled={isLocked}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white transition-colors disabled:opacity-50"
                      >
                        {showPassword ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>
                  
                  {/* Password Validation */}
                  <AnimatePresence>
                    {validationErrors.password && (
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="text-red-400 text-sm mt-2 ml-11"
                      >
                        {validationErrors.password}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>

              {/* Remember Me & Forgot Password */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="flex items-center justify-between"
              >
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={isLocked}
                    className="rounded border-white/20 bg-white/10 text-indigo-400 focus:ring-indigo-400 focus:ring-2 disabled:opacity-50"
                  />
                  <span className="text-white/80 text-sm">Remember me</span>
                </label>
                
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="text-indigo-300 hover:text-indigo-200 text-sm underline transition-colors"
                >
                  Forgot password?
                </button>
              </motion.div>

              {/* Login Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <button
                  type="submit"
                  disabled={loading || Object.keys(validationErrors).length > 0 || isLocked}
                  className={`
                    w-full py-4 text-lg font-semibold transition-all duration-300 rounded-xl
                    glass-card-enhanced border border-white/20 backdrop-blur-sm
                    ${loading || Object.keys(validationErrors).length > 0 || isLocked
                      ? 'bg-white/5 opacity-50 cursor-not-allowed text-white/50' 
                      : 'bg-gradient-to-r from-blue-400/20 to-indigo-400/20 hover:from-blue-400/30 hover:to-indigo-400/30 hover:scale-105 text-white hover:border-white/40'
                    }
                  `}
                >
                  {loading ? (
                    <span className="flex items-center justify-center space-x-2">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                      />
                      <span>Signing In...</span>
                    </span>
                  ) : isLocked ? (
                    <span className="flex items-center justify-center space-x-2">
                      <span>🔒</span>
                      <span>Account Locked</span>
                    </span>
                  ) : (
                    <span className="flex items-center justify-center space-x-2">
                      <span>🚀</span>
                      <span>Sign In</span>
                    </span>
                  )}
                </button>
              </motion.div>

              {/* Message Display */}
              <AnimatePresence>
                {message && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.3 }}
                    className={`
                      p-4 rounded-xl text-center font-medium
                      ${message.includes('✅') 
                        ? 'bg-green-400/20 text-green-200 border border-green-400/30' 
                        : 'bg-red-400/20 text-red-200 border border-red-400/30'
                      }
                    `}
                  >
                    {message}
                  </motion.div>
                )}
              </AnimatePresence>
            </form>

            {/* Security Info */}
            {loginAttempts.filter(a => a.failed).length > 0 && !isLocked && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card-enhanced p-3 rounded-xl border border-yellow-400/30 bg-yellow-400/10"
              >
                <div className="flex items-center space-x-2">
                  <span className="text-yellow-400">⚠️</span>
                  <p className="text-yellow-200 text-sm">
                    {3 - loginAttempts.filter(a => a.failed).length} login attempts remaining
                  </p>
                </div>
              </motion.div>
            )}

            {/* Footer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-center pt-4 border-t border-white/10"
            >
              <p className="text-white/60 text-sm">
                Don't have an account?{' '}
                <button
                  onClick={() => navigate('/intake/registration')}
                  className="text-blue-300 hover:text-blue-200 underline transition-colors"
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
