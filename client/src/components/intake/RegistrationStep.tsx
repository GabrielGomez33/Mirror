// src/components/intake/RegistrationStep.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntake } from '../../context/IntakeContext';
import { registerUser } from '../../services/api';
import GlassCard from '../ui/GlassCard';
import { motion, AnimatePresence } from 'framer-motion';
import BasicScene from '../three/BasicScene';

interface ValidationErrors {
  username?: string;
  email?: string;
  password?: string;
}

interface FormField {
  id: keyof ValidationErrors;
  type: string;
  placeholder: string;
  value: string;
  setter: (value: string) => void;
  icon: string;
  requirements?: string[];
}

const RegistrationStep = () => {
  const navigate = useNavigate();
  const { updateIntake } = useIntake();
  
  // Form State
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // UI State
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  
  // Password strength tracking
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordCriteria, setPasswordCriteria] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  });

  // Form fields configuration
  const formFields: FormField[] = [
    {
      id: 'username',
      type: 'text',
      placeholder: 'Choose a unique username',
      value: username,
      setter: setUsername,
      icon: '👤',
      requirements: ['3-20 characters', 'Letters, numbers, underscores only']
    },
    {
      id: 'email',
      type: 'email',
      placeholder: 'Enter your email address',
      value: email,
      setter: setEmail,
      icon: '📧',
      requirements: ['Valid email format', 'Will be used for account recovery']
    },
    {
      id: 'password',
      type: showPassword ? 'text' : 'password',
      placeholder: 'Create a secure password',
      value: password,
      setter: setPassword,
      icon: '🔒',
      requirements: ['At least 8 characters', 'One uppercase letter', 'One lowercase letter', 'One number', 'One special character']
    }
  ];

  // Real-time validation
  useEffect(() => {
    const errors: ValidationErrors = {};
    
    // Username validation
    if (username && (username.length < 3 || username.length > 20)) {
      errors.username = 'Username must be 3-20 characters';
    } else if (username && !/^[a-zA-Z0-9_]+$/.test(username)) {
      errors.username = 'Username can only contain letters, numbers, and underscores';
    }
    
    // Email validation
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    // Password validation and strength
    if (password) {
      const criteria = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /\d/.test(password),
        special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
      };
      
      setPasswordCriteria(criteria);
      const strength = Object.values(criteria).filter(Boolean).length;
      setPasswordStrength(strength);
      
      if (password.length < 8) {
        errors.password = 'Password must be at least 8 characters';
      } else if (strength < 4) {
        errors.password = 'Password must meet more security requirements';
      }
    }
    
    setValidationErrors(errors);
  }, [username, email, password]);

  // Auto-advance through steps
  useEffect(() => {
    if (currentStep === 0 && username && !validationErrors.username) {
      setTimeout(() => setCurrentStep(1), 800);
    } else if (currentStep === 1 && email && !validationErrors.email) {
      setTimeout(() => setCurrentStep(2), 800);
    } else if (currentStep === 2 && password && !validationErrors.password) {
      setTimeout(() => setCurrentStep(3), 800);
    }
  }, [username, email, password, validationErrors, currentStep]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Final validation
    if (password !== confirmPassword) {
      setMessage('❌ Passwords do not match');
      return;
    }
    
    if (Object.keys(validationErrors).length > 0) {
      setMessage('❌ Please fix all validation errors');
      return;
    }
    
    setLoading(true);
    setMessage('');
    
    try {
      await registerUser({ username, email, password });
      updateIntake({ 
        userRegistered: true,
        name: username // Store username as name
      });
      
      setIsSuccess(true);
      setMessage('Registration successful!');
      
      // Navigate after success animation
      setTimeout(() => {
        navigate('/intake/visual');
      }, 2000);
      
    } catch (err: any) {
      setMessage('❌ ' + (err.message || 'Registration failed. Please try again.'));
      console.error('REGISTRATION FAILED: ', err);
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength <= 2) return 'from-red-400 to-red-600';
    if (passwordStrength <= 3) return 'from-yellow-400 to-orange-500';
    if (passwordStrength <= 4) return 'from-blue-400 to-indigo-500';
    return 'from-green-400 to-emerald-500';
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength <= 2) return 'Weak';
    if (passwordStrength <= 3) return 'Fair';
    if (passwordStrength <= 4) return 'Good';
    return 'Strong';
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
            <GlassCard enhanced gradient className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: "spring", duration: 0.6 }}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 mx-auto flex items-center justify-center"
              >
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <h2 className="text-3xl font-bold text-white mb-2">Welcome</h2>
                <p className="text-white/80">Your account has been created successfully.</p>
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
        className="absolute inset-0 bg-gradient-to-br from-indigo-100/50 via-purple-50/30 to-pink-100/50 pointer-events-none"
      />

      {/* Floating Registration Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
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
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center"
                >
                  <span className="text-2xl">🔆</span>
                </motion.div>
              </div>
              
              <h2 className="text-3xl font-bold text-white text-shadow-soft">Register </h2>
              <p className="text-white/80">"Whoever fights monsters should see to it that in the process he does not become a monster."</p>
            </motion.div>

            {/* Progress Indicator */}
            <div className="glass-card-enhanced p-4 rounded-xl">
              <div className="flex justify-between text-sm text-white/70 mb-2">
                <span>Progress</span>
                <span>Step {Math.min(currentStep + 1, 4)} of 4</span>
              </div>
              <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(Math.min(currentStep + 1, 4) / 4) * 100}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full"
                />
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <AnimatePresence mode="wait">
                {formFields.map((field, index) => (
                  currentStep >= index && (
                    <motion.div
                      key={field.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.4 }}
                      className="space-y-3"
                    >
                      <div className="glass-card-enhanced p-4 rounded-xl">
                        <div className="flex items-center space-x-3 mb-3">
                          <span className="text-2xl">{field.icon}</span>
                          <div className="flex-1">
                            <div className="relative">
                              <input
                                type={field.type}
                                placeholder={field.placeholder}
                                value={field.value}
                                onChange={(e) => field.setter(e.target.value)}
                                className={`
                                  w-full p-3 bg-white/10 border-2 rounded-lg text-white placeholder-white/50 
                                  focus:outline-none focus:border-white/40 transition-all duration-300
                                  ${validationErrors[field.id] ? 'border-red-400' : 
                                    field.value && !validationErrors[field.id] ? 'border-green-400' : 'border-white/20'}
                                `}
                                required
                                autoComplete="off"
                              />
                              
                              {/* Password visibility toggle */}
                              {field.id === 'password' && (
                                <button
                                  type="button"
                                  onClick={() => setShowPassword(!showPassword)}
                                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white"
                                >
                                  {showPassword ? '🙈' : '👁️'}
                                </button>
                              )}
                            </div>
                            
                            {/* Validation Error */}
                            <AnimatePresence>
                              {validationErrors[field.id] && (
                                <motion.p
                                  initial={{ opacity: 0, y: -10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -10 }}
                                  className="text-red-400 text-sm mt-2"
                                >
                                  {validationErrors[field.id]}
                                </motion.p>
                              )}
                            </AnimatePresence>
                            
                            {/* Success Indicator */}
                            {field.value && !validationErrors[field.id] && (
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
                        
                        {/* Field Requirements */}
                        {field.requirements && currentStep === index && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            transition={{ delay: 0.2 }}
                            className="mt-3 p-3 bg-white/5 rounded-lg"
                          >
                            <p className="text-white/70 text-xs mb-2">Requirements:</p>
                            <ul className="space-y-1">
                              {field.requirements.map((req, i) => (
                                <li key={i} className="text-white/60 text-xs flex items-center space-x-2">
                                  <span className="w-1 h-1 bg-white/40 rounded-full"></span>
                                  <span>{req}</span>
                                </li>
                              ))}
                            </ul>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  )
                ))}
              </AnimatePresence>

              {/* Password Strength Indicator */}
              {currentStep >= 2 && password && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card-enhanced p-4 rounded-xl"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white/80 text-sm">Password Strength</span>
                    <span className={`text-sm font-medium bg-gradient-to-r ${getPasswordStrengthColor()} bg-clip-text text-transparent`}>
                      {getPasswordStrengthText()}
                    </span>
                  </div>
                  
                  <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden mb-3">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(passwordStrength / 5) * 100}%` }}
                      transition={{ duration: 0.5 }}
                      className={`h-full bg-gradient-to-r ${getPasswordStrengthColor()} rounded-full`}
                    />
                  </div>
                  
                  {/* Password Criteria */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(passwordCriteria).map(([key, met]) => (
                      <div key={key} className={`flex items-center space-x-2 ${met ? 'text-green-400' : 'text-white/40'}`}>
                        <span>{met ? '✓' : '○'}</span>
                        <span className="capitalize">
                          {key === 'length' ? '8+ chars' : key}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Confirm Password */}
              {currentStep >= 3 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4 }}
                  className="glass-card-enhanced p-4 rounded-xl"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">🔑</span>
                    <div className="flex-1">
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="Confirm your password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className={`
                            w-full p-3 bg-white/10 border-2 rounded-lg text-white placeholder-white/50 
                            focus:outline-none focus:border-white/40 transition-all duration-300
                            ${confirmPassword && password !== confirmPassword ? 'border-red-400' : 
                              confirmPassword && password === confirmPassword ? 'border-green-400' : 'border-white/20'}
                          `}
                          required
                        />
                        
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white"
                        >
                          {showConfirmPassword ? '🙈' : '👁️'}
                        </button>
                      </div>
                      
                      {/* Password Match Indicator */}
                      {confirmPassword && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`text-sm mt-2 flex items-center space-x-1 ${
                            password === confirmPassword ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          <span>{password === confirmPassword ? '✓' : '✗'}</span>
                          <span>{password === confirmPassword ? 'Passwords match' : 'Passwords do not match'}</span>
                        </motion.p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Submit Button */}
              {currentStep >= 3 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <button
                    type="submit"
                    disabled={loading || Object.keys(validationErrors).length > 0 || password !== confirmPassword}
                    className={`
                      w-full py-4 text-lg font-semibold transition-all duration-300 rounded-xl
                      glass-card-enhanced border border-white/20 backdrop-blur-sm
                      ${loading || Object.keys(validationErrors).length > 0 || password !== confirmPassword
                        ? 'bg-white/5 opacity-50 cursor-not-allowed text-white/50' 
                        : 'bg-gradient-to-r from-indigo-400/20 to-purple-400/20 hover:from-indigo-400/30 hover:to-purple-400/30 hover:scale-105 text-white hover:border-white/40'
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
                        <span>Creating Account...</span>
                      </span>
                    ) : (
                      <span className="flex items-center justify-center space-x-2">
                        <span>🚀</span>
                        <span>Create Account</span>
                      </span>
                    )}
                  </button>
                </motion.div>
              )}

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

            {/* Footer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="text-center pt-4 border-t border-white/10"
            >
              <p className="text-white/60 text-sm">
                Already have an account?{' '}
                <button
                  onClick={() => navigate('/login')}
                  className="text-indigo-300 hover:text-indigo-200 underline transition-colors"
                >
                  Sign in here
                </button>
              </p>
            </motion.div>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
};

export default RegistrationStep;
