// src/pages/ForgotPasswordPage.tsx
//
// Forgotten-password request page. Aesthetic copied from the Login page:
//   - BasicScene Three.js background
//   - Gradient overlay + floating particles
//   - GlassCard with the same indigo/purple palette and animation timing
//
// Security model (mirrors backend):
//   - The backend NEVER tells us whether an email is registered. After
//     submitting we always show the same "Check your inbox" success state.
//   - We rate-limit the form client-side to avoid trivial spam, but the
//     server has its own (Redis + DB) rate limits regardless.

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '../components/ui/GlassCard';
import BasicScene from '../components/three/BasicScene';
import { requestPasswordResetApi } from '../services/authApi';

const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // Local cooldown timer — purely UX, the real limit is server-side.
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const t = setInterval(() => setCooldownSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldownSeconds]);

  const validateEmail = (value: string): string | null => {
    if (!value) return 'Email is required';
    if (value.length > 254) return 'That email looks too long';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldownSeconds > 0 || submitting) return;

    const err = validateEmail(email.trim());
    if (err) {
      setEmailError(err);
      return;
    }
    setEmailError(null);
    setSubmitting(true);

    try {
      // Server always returns 200 here — we don't need to inspect the body.
      // If the network fails entirely, we still show the generic success
      // state because the user can retry from the same screen. Showing the
      // raw network error would leak retry semantics that an attacker could
      // use to detect when a real user existed.
      await requestPasswordResetApi(email.trim());
    } catch (err) {
      // Swallow — generic UX
      // eslint-disable-next-line no-console
      console.warn('forgot-password request errored (showing generic UX):', err);
    } finally {
      setSubmitting(false);
      setSubmitted(true);
      setCooldownSeconds(60); // server cooldown matches this
    }
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      <BasicScene />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ duration: 1.5 }}
        className="absolute inset-0 bg-gradient-to-br from-indigo-100/50 via-purple-50/30 to-pink-100/50 pointer-events-none"
      />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            initial={{
              x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
              y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
              scale: 0,
            }}
            animate={{
              y: [null, Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800)],
              scale: [0, 1, 0],
              opacity: [0, 0.4, 0],
            }}
            transition={{
              duration: Math.random() * 8 + 6,
              repeat: Infinity,
              ease: 'easeInOut',
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
          className="max-w-md w-full"
          style={{ minWidth: '65vw', maxWidth: '75vw' }}
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
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center"
                >
                  <span className="text-2xl">🔑</span>
                </motion.div>
              </div>

              <h2 className="text-3xl font-bold text-white text-shadow-soft">
                {submitted ? 'Check your inbox' : 'Reset your password'}
              </h2>
              <p className="text-white/80 text-sm">
                {submitted
                  ? 'If an account exists for that email, we just sent a reset link. It expires in 60 minutes.'
                  : 'Enter the email you signed up with and we\'ll send you a secure reset link.'}
              </p>
            </motion.div>

            {/* Form OR success state */}
            <AnimatePresence mode="wait">
              {!submitted ? (
                <motion.form
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onSubmit={handleSubmit}
                  className="space-y-4"
                >
                  {/* Email field */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                  >
                    <div className="glass-card-enhanced flex justify-center p-4 rounded-xl">
                      <div className="flex items-center space-x-3 w-full">
                        <div className="flex-1">
                          <span className="text-sm shrink-0 opacity-70">📧</span>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => {
                              setEmail(e.target.value);
                              if (emailError) setEmailError(null);
                            }}
                            className={`
                              w-full p-3 bg-white/10 border-2 rounded-lg text-white placeholder-white/50
                              focus:outline-none focus:border-white/40 transition-all duration-300
                              ${emailError ? 'border-red-400' :
                                email && !emailError ? 'border-green-400' : 'border-white/20'}
                            `}
                            placeholder="Enter your email address"
                            autoComplete="email"
                            disabled={submitting}
                            maxLength={254}
                          />

                          <AnimatePresence>
                            {emailError && (
                              <motion.p
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="text-red-400 text-sm mt-2"
                              >
                                {emailError}
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Submit */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <button
                      type="submit"
                      disabled={submitting || cooldownSeconds > 0}
                      className={`
                        w-full py-4 text-lg font-semibold transition-all duration-300 rounded-xl
                        glass-card-enhanced border border-white/20 backdrop-blur-sm
                        ${submitting || cooldownSeconds > 0
                          ? 'bg-white/5 opacity-50 cursor-not-allowed text-white/50'
                          : 'bg-gradient-to-r from-indigo-400/20 to-purple-400/20 hover:from-indigo-400/30 hover:to-purple-400/30 hover:scale-105 text-white hover:border-white/40'}
                      `}
                    >
                      {submitting ? (
                        <span className="flex items-center justify-center space-x-2">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                          />
                          <span>Sending link…</span>
                        </span>
                      ) : (
                        <span className="flex items-center justify-center space-x-2">
                          <span>✉️</span>
                          <span style={{ color: 'black', fontSize: '0.7rem', textShadow: '0 4px 20px rgba(0,0,0,.3)' }}>
                            Send reset link
                          </span>
                        </span>
                      )}
                    </button>
                  </motion.div>
                </motion.form>
              ) : (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="space-y-4"
                >
                  <div className="glass-card-enhanced p-4 rounded-xl text-center text-white/90 text-sm leading-relaxed">
                    <p>
                      We've sent reset instructions to <strong>{email}</strong> if it matches a Mirror account.
                    </p>
                    <p className="mt-2 text-white/70">
                      Don't see it? Check your spam folder, or wait 60 seconds and try again.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (cooldownSeconds > 0) return;
                      setSubmitted(false);
                    }}
                    disabled={cooldownSeconds > 0}
                    className={`
                      w-full py-3 rounded-xl text-sm
                      glass-card-enhanced border border-white/20 backdrop-blur-sm
                      ${cooldownSeconds > 0
                        ? 'opacity-50 cursor-not-allowed text-white/50'
                        : 'text-white hover:bg-white/10'}
                    `}
                  >
                    {cooldownSeconds > 0
                      ? `Try a different email in ${cooldownSeconds}s`
                      : 'Try a different email'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Footer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="text-center pt-4 border-t border-white/10 space-y-2"
            >
              <p className="text-white/60 text-sm">
                Remembered it?{' '}
                <Link to="/login" className="text-indigo-300 hover:text-indigo-200 underline transition-colors">
                  Back to sign in
                </Link>
              </p>
              <p className="text-white/60 text-sm">
                No account?{' '}
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

export default ForgotPasswordPage;
