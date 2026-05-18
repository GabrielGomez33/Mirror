// src/pages/ResetPasswordPage.tsx
//
// Lands the user from the password-reset email. Reads the token from
// `?token=…`, validates it (read-only) with the backend before showing the
// form, accepts a new password, and applies it.
//
// Aesthetic: same BasicScene + GlassCard treatment as Login / Forgot pages.
//
// Security model:
//   - Token validation is a SEPARATE GET endpoint so we can render the
//     "expired link" state without burning the token.
//   - Password rules enforced client AND server-side. Client side blocks
//     submission so the user sees instant feedback.
//   - On success, the backend has already revoked every session for this
//     user, so we just send them to /login.

import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '../components/ui/GlassCard';
import BasicScene from '../components/three/BasicScene';
import { validateResetTokenApi, resetPasswordApi } from '../services/authApi';

type PageStatus = 'validating' | 'ready' | 'invalid' | 'submitting' | 'success';

const PASSWORD_RULES = [
  { id: 'length',    label: '8+ characters', test: (p: string) => p.length >= 8 },
  { id: 'uppercase', label: 'Uppercase',      test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lowercase', label: 'Lowercase',      test: (p: string) => /[a-z]/.test(p) },
  { id: 'number',    label: 'Number',         test: (p: string) => /\d/.test(p) },
  { id: 'special',   label: 'Symbol (@$!%*?&)', test: (p: string) => /[@$!%*?&]/.test(p) },
];

const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [status, setStatus] = useState<PageStatus>('validating');
  const [invalidMessage, setInvalidMessage] = useState<string>('');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ---- Token format guard + server-side validation -----------------------
  useEffect(() => {
    if (!/^[a-f0-9]{64}$/.test(token)) {
      setStatus('invalid');
      setInvalidMessage('This reset link is malformed. Request a new one.');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const result = await validateResetTokenApi(token);
        if (cancelled) return;
        if (result?.valid) {
          setStatus('ready');
        } else {
          setStatus('invalid');
          setInvalidMessage(result?.error || 'This reset link is no longer valid.');
        }
      } catch (err: any) {
        if (cancelled) return;
        setStatus('invalid');
        setInvalidMessage(err?.error || err?.message || 'This reset link is no longer valid.');
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  // ---- Derived password-strength state -----------------------------------
  const passwordCriteria = PASSWORD_RULES.map(r => ({ ...r, met: r.test(password) }));
  const strength = passwordCriteria.filter(r => r.met).length;
  const allCriteriaMet = strength === PASSWORD_RULES.length;
  const passwordsMatch = password.length > 0 && password === confirm;
  const canSubmit = status === 'ready' && allCriteriaMet && passwordsMatch;

  const strengthColor =
    strength <= 2 ? 'from-red-400 to-red-600' :
    strength === 3 ? 'from-yellow-400 to-orange-500' :
    strength === 4 ? 'from-blue-400 to-indigo-500' :
                     'from-green-400 to-emerald-500';
  const strengthLabel =
    strength <= 2 ? 'Weak' :
    strength === 3 ? 'Fair' :
    strength === 4 ? 'Good' : 'Strong';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setErrorMessage(null);
    setStatus('submitting');

    try {
      await resetPasswordApi(token, password);
      setStatus('success');
      // Backend revoked every active session for this user. Send them to login.
      setTimeout(() => navigate('/login', { replace: true }), 2200);
    } catch (err: any) {
      const code = err?.code || '';
      const friendly =
        code === 'TOKEN_EXPIRED' ? 'This reset link has expired. Request a new one.' :
        code === 'TOKEN_USED'    ? 'This reset link has already been used.' :
        code === 'TOKEN_NOT_FOUND' ? 'This reset link is no longer valid.' :
        code === 'WEAK_PASSWORD' ? (err?.error || 'Password doesn\'t meet requirements.') :
        code === 'PASSWORD_UNCHANGED' ? 'Choose a password different from your current one.' :
        (err?.error || err?.message || 'Could not reset password. Please try again.');

      // For "terminal" token states, drop back to the invalid view.
      if (code === 'TOKEN_EXPIRED' || code === 'TOKEN_USED' || code === 'TOKEN_NOT_FOUND') {
        setStatus('invalid');
        setInvalidMessage(friendly);
      } else {
        setStatus('ready');
        setErrorMessage(friendly);
      }
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
            transition={{ duration: Math.random() * 8 + 6, repeat: Infinity, ease: 'easeInOut' }}
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
                  <span className="text-2xl">🔒</span>
                </motion.div>
              </div>

              <h2 className="text-3xl font-bold text-white text-shadow-soft">
                {status === 'success' ? 'Password updated' :
                 status === 'invalid' ? 'Link unavailable' :
                 'Choose a new password'}
              </h2>
              <p className="text-white/80 text-sm">
                {status === 'success' ? 'Redirecting you to sign in…' :
                 status === 'invalid' ? invalidMessage :
                 'Pick a strong password. You\'ll be signed out everywhere after we save it.'}
              </p>
            </motion.div>

            {/* --------- Validating ---------- */}
            {status === 'validating' && (
              <div className="flex justify-center py-6">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full"
                />
              </div>
            )}

            {/* --------- Invalid link ---------- */}
            {status === 'invalid' && (
              <div className="space-y-3">
                <Link
                  to="/forgot-password"
                  className="block text-center w-full py-3 rounded-xl glass-card-enhanced border border-white/20 backdrop-blur-sm text-white hover:bg-white/10 transition-colors"
                >
                  Request a new reset link
                </Link>
                <Link
                  to="/login"
                  className="block text-center text-indigo-300 hover:text-indigo-200 underline text-sm"
                >
                  Back to sign in
                </Link>
              </div>
            )}

            {/* --------- Success ---------- */}
            {status === 'success' && (
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring' }}
                  className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-2xl"
                >
                  ✓
                </motion.div>
                <p className="text-white/80 mt-4 text-sm">
                  Use your new password on the sign-in page.
                </p>
              </div>
            )}

            {/* --------- Form (ready / submitting) ---------- */}
            {(status === 'ready' || status === 'submitting') && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* New password */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                >
                  <div className="glass-card-enhanced flex items-center justify-center p-4 rounded-xl">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">🆕</span>
                      <div className="flex-1">
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={`
                              w-lg sm:max-w-lg p-3 bg-white/10 border-2 rounded-lg text-white placeholder-white/50
                              focus:outline-none focus:border-white/40 transition-all duration-300
                              ${password && !allCriteriaMet ? 'border-yellow-400' :
                                password && allCriteriaMet ? 'border-green-400' : 'border-white/20'}
                            `}
                            placeholder="New password"
                            autoComplete="new-password"
                            disabled={status === 'submitting'}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white"
                            tabIndex={-1}
                          >
                            {showPassword ? '🙈' : '👁️'}
                          </button>
                        </div>

                        {password && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-white/70 text-xs">Strength</span>
                              <span className={`text-xs font-medium bg-gradient-to-r ${strengthColor} bg-clip-text text-transparent`}>
                                {strengthLabel}
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden mb-2">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${(strength / PASSWORD_RULES.length) * 100}%` }}
                                transition={{ duration: 0.4 }}
                                className={`h-full bg-gradient-to-r ${strengthColor} rounded-full`}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-1 text-xs">
                              {passwordCriteria.map(c => (
                                <div key={c.id} className={`flex items-center space-x-1 ${c.met ? 'text-green-400' : 'text-white/40'}`}>
                                  <span>{c.met ? '✓' : '○'}</span>
                                  <span>{c.label}</span>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Confirm */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                >
                  <div className="glass-card-enhanced flex items-center justify-center p-4 rounded-xl">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">🔑</span>
                      <div className="flex-1">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={confirm}
                          onChange={(e) => setConfirm(e.target.value)}
                          className={`
                            w-full p-3 bg-white/10 border-2 rounded-lg text-white placeholder-white/50
                            focus:outline-none focus:border-white/40 transition-all duration-300
                            ${confirm && password !== confirm ? 'border-red-400' :
                              confirm && passwordsMatch ? 'border-green-400' : 'border-white/20'}
                          `}
                          placeholder="Confirm new password"
                          autoComplete="new-password"
                          disabled={status === 'submitting'}
                        />
                        {confirm && (
                          <p className={`text-sm mt-2 flex items-center space-x-1 ${passwordsMatch ? 'text-green-400' : 'text-red-400'}`}>
                            <span>{passwordsMatch ? '✓' : '✗'}</span>
                            <span>{passwordsMatch ? 'Passwords match' : 'Passwords do not match'}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>

                <AnimatePresence>
                  {errorMessage && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="p-3 rounded-xl text-center font-medium bg-red-400/20 text-red-200 border border-red-400/30 text-sm"
                    >
                      {errorMessage}
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={`
                    w-full py-4 text-lg font-semibold transition-all duration-300 rounded-xl
                    glass-card-enhanced border border-white/20 backdrop-blur-sm
                    ${!canSubmit
                      ? 'bg-white/5 opacity-50 cursor-not-allowed text-white/50'
                      : 'bg-gradient-to-r from-indigo-400/20 to-purple-400/20 hover:from-indigo-400/30 hover:to-purple-400/30 hover:scale-105 text-white hover:border-white/40'}
                  `}
                >
                  {status === 'submitting' ? (
                    <span className="flex items-center justify-center space-x-2">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                      />
                      <span>Saving…</span>
                    </span>
                  ) : (
                    <span className="flex items-center justify-center space-x-2">
                      <span>🔒</span>
                      <span style={{ color: 'black', fontSize: '0.7rem', textShadow: '0 4px 20px rgba(0,0,0,.3)' }}>
                        Set new password
                      </span>
                    </span>
                  )}
                </button>
              </form>
            )}

            {status !== 'success' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="text-center pt-4 border-t border-white/10"
              >
                <Link
                  to="/login"
                  className="text-indigo-300 hover:text-indigo-200 underline text-sm transition-colors"
                >
                  Back to sign in
                </Link>
              </motion.div>
            )}
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
