// src/components/Login.tsx
//
// Sign-in flow — sakura-aesthetic parity with RegistrationStep, plus the
// same edge-case hardening:
//
//   1. Sakura aesthetics
//      - glass-card-sakura input cards with focus-within glow
//      - input-sakura (rounded-2xl + 16px font-size to defeat iOS auto-zoom,
//        pink focus ring)
//      - btn-sakura-ready / -idle / -busy states on Sign In, blooming when
//        every field is valid + online
//      - Sakura header avatar (pink-300 → rose-400 with halo), pink links.
//
//   2. Mobile + autofill
//      - autoComplete="email" / "current-password"  (iOS Keychain recognises
//        the form)
//      - autoCapitalize / autoCorrect / spellCheck off on credential inputs
//      - inputMode / enterKeyHint on each field
//      - scrollIntoView on focus so the input rides above the iOS keyboard
//      - Defensive 16px font-size (CSS) — kills iOS auto-zoom AND covers
//        older Android browsers that share the same heuristic.
//
//   3. Resilience
//      - Honeypot ("nickname", off the HTML autofill spec) silently rejects
//        bot submissions.
//      - submittingRef guards against React-StrictMode double-fires AND
//        rapid double-taps within the same event-loop tick.
//      - Offline detection — submit disabled + banner shown when
//        navigator.onLine is false.
//      - Password normalisation (iOS smart-quote / smart-dash → ASCII) so
//        a user who registered on desktop can sign in on iOS without
//        bcrypt drift.
//      - Email trim.
//      - Network retry with exponential backoff lives in AuthContext.login.
//      - Server error codes (INVALID_CREDENTIALS / ACCOUNT_LOCKED /
//        EMAIL_NOT_VERIFIED / RATE_LIMIT) are mapped to focused field
//        highlights with actionable messages.
//
//   4. Account-lockout behaviour PRESERVED
//      - Existing LoginSecurity tracks failed attempts in localStorage,
//        5 fails / 15 min triggers a client-side lockout with a live
//        countdown. We don't remove this — server-side rate limiting
//        (5 attempts/IP/15min) and client-side lockout (per-device,
//        per-account-attempt) are complementary defences.
//      - Wrote every localStorage write/read in try/catch for Safari
//        private-mode safety. Previously a private-mode setItem could
//        throw inside recordAttempt() and break the submit handler.
//
//   5. Accessibility
//      - role="alert" + aria-live on every error band
//      - aria-busy on the submit button while loading
//      - aria-invalid mirrors the visible error state on each input
//      - safe-area-inset-bottom on the submit so the iOS home indicator
//        doesn't sit on top of it in standalone PWA mode.

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useIntake } from '../context/IntakeContext';
import { setRememberMe } from '../utils/token';
import GlassCard from './ui/GlassCard';
import { motion, AnimatePresence } from 'framer-motion';
import BasicScene from './three/BasicScene';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Helpers (mirror RegistrationStep — same normalisation rules)
// ---------------------------------------------------------------------------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

function normalizePassword(raw: string): string {
  return raw
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—―]/g, '-')
    .replace(/…/g, '...');
}
function sanitizeEmail(raw: string): string {
  return raw.trim().replace(/\s+/g, '').slice(0, 254);
}

// ---------------------------------------------------------------------------
// Client-side account-lockout tracking. Independent of the server's
// IP-based rate limit — they protect against different things. The
// server stops scripted brute force from a single IP; this stops a
// single device from spamming the same account.
//
// Every public method is wrapped in try/catch because Safari private-
// mode throws on every localStorage call. A throw in the original
// implementation broke the submit handler entirely.
// ---------------------------------------------------------------------------
class LoginSecurity {
  private static readonly STORAGE_KEY = 'loginAttempts';
  private static readonly LOCKOUT_DURATION = 15 * 60 * 1000;
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
    try {
      const attempts = this.getAttempts();
      const newAttempt: LoginAttempt = { timestamp: Date.now(), failed };
      const horizon = Date.now() - this.LOCKOUT_DURATION;
      const recent = attempts.filter((a) => a.timestamp > horizon);
      recent.push(newAttempt);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(recent));
    } catch {
      /* non-fatal — submit handler stays alive */
    }
  }

  static clearFailures(): void {
    try { localStorage.removeItem(this.STORAGE_KEY); } catch { /* non-fatal */ }
  }

  static isAccountLocked(): LockoutInfo {
    const attempts = this.getAttempts();
    const recentFailures = attempts.filter(
      (a) => a.failed && Date.now() - a.timestamp < this.LOCKOUT_DURATION
    );
    if (recentFailures.length >= this.MAX_ATTEMPTS) {
      const oldestFailure = Math.min(...recentFailures.map((a) => a.timestamp));
      const timeRemaining = this.LOCKOUT_DURATION - (Date.now() - oldestFailure);
      return {
        locked: timeRemaining > 0,
        timeRemaining: Math.max(0, Math.ceil(timeRemaining / 1000)),
      };
    }
    return { locked: false, timeRemaining: 0 };
  }

  static getFailedAttemptCount(): number {
    const attempts = this.getAttempts();
    return attempts.filter(
      (a) => a.failed && Date.now() - a.timestamp < this.LOCKOUT_DURATION
    ).length;
  }
}

// ---------------------------------------------------------------------------
// LogUserIn component
// ---------------------------------------------------------------------------
const LogUserIn: React.FC = () => {
  const navigate = useNavigate();
  const {
    login,
    error: authError,
    isLoading,
    clearError,
    getRedirectAfterLogin,
  } = useAuth();
  const { updateIntake } = useIntake();

  // ----- Form state -------------------------------------------------------
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
    rememberMe: false,
  });
  // Honeypot — humans never see this. Bots that fill every form field
  // will populate it and the submit handler will silently bail.
  const [honeypot, setHoneypot] = useState('');

  // ----- UI state ---------------------------------------------------------
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [isSuccess, setIsSuccess] = useState(false);
  const [lockoutInfo, setLockoutInfo] = useState<LockoutInfo>({ locked: false, timeRemaining: 0 });
  const [showPassword, setShowPassword] = useState(false);
  const [failedCount, setFailedCount] = useState<number>(0);
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // ----- Refs -------------------------------------------------------------
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  // Idempotent-submit guard. Defeats React StrictMode double-fires AND
  // rapid double-taps inside the same event-loop tick (where `isLoading`
  // hasn't propagated yet).
  const submittingRef = useRef<boolean>(false);

  // ----- Remembered-email hydration --------------------------------------
  useEffect(() => {
    try {
      const rememberedEmail = localStorage.getItem('rememberedEmail');
      if (rememberedEmail) {
        setFormData((prev) => ({ ...prev, email: rememberedEmail, rememberMe: true }));
      }
    } catch { /* private mode — non-fatal */ }
  }, []);

  // ----- Lockout tick + initial failed-count read ------------------------
  // Tick every 1s so the countdown stays accurate; bail out as soon as we
  // unlock so the user can submit again.
  useEffect(() => {
    const check = () => {
      const lockStatus = LoginSecurity.isAccountLocked();
      setLockoutInfo(lockStatus);
      setFailedCount(LoginSecurity.getFailedAttemptCount());
    };
    check();
    const id = setInterval(check, 1000);
    return () => clearInterval(id);
  }, []);

  // ----- Connectivity listeners ------------------------------------------
  useEffect(() => {
    const onUp = () => setOnline(true);
    const onDown = () => setOnline(false);
    window.addEventListener('online', onUp);
    window.addEventListener('offline', onDown);
    return () => {
      window.removeEventListener('online', onUp);
      window.removeEventListener('offline', onDown);
    };
  }, []);

  // ----- Clear stale auth errors when form changes -----------------------
  useEffect(() => {
    if (authError) clearError();
    // Intentionally only depend on authError + form contents — clearError
    // is stable from AuthContext.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.email, formData.password]);

  // ----- Validation -------------------------------------------------------
  // Login validation is intentionally lighter than register. We do NOT
  // enforce password length here — the server is the source of truth,
  // and a too-short check would lock out any pre-policy-update account
  // whose password is 6-7 chars. We just need a non-empty password and
  // a well-formed email.
  //
  // Returns the freshly-computed errors so the caller can react to them
  // immediately without waiting for the setValidationErrors React update
  // to land (handleSubmit needs to know WHICH field to focus this tick).
  const validateForm = (): ValidationErrors => {
    const errors: ValidationErrors = {};
    const trimmedEmail = sanitizeEmail(formData.email);
    if (!trimmedEmail) {
      errors.email = 'Email is required';
    } else if (!EMAIL_RE.test(trimmedEmail)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!formData.password) {
      errors.password = 'Password is required';
    }
    setValidationErrors(errors);
    return errors;
  };

  // ----- scrollIntoView (mobile keyboard alignment) ----------------------
  const scrollFieldIntoView = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    setTimeout(() => {
      try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch { /* noop */ }
    }, 300);
  }, []);

  // ----- Submit -----------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Honeypot tripped → silently refuse. Don't tell the bot WHY.
    if (honeypot.trim().length > 0) return;

    if (submittingRef.current) return;
    submittingRef.current = true;

    if (!online) {
      setValidationErrors({ general: 'You appear to be offline. Reconnect and try again.' });
      submittingRef.current = false;
      return;
    }

    if (lockoutInfo.locked) {
      const minutes = Math.floor(lockoutInfo.timeRemaining / 60);
      const seconds = lockoutInfo.timeRemaining % 60;
      setValidationErrors({
        general: `Account temporarily locked. Please wait ${minutes}:${seconds.toString().padStart(2, '0')}.`,
      });
      submittingRef.current = false;
      return;
    }

    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      submittingRef.current = false;
      // Focus the first invalid field so the keyboard scrolls it into view.
      // Use the freshly-computed errors — React state from setValidationErrors
      // hasn't propagated yet this tick.
      if (formErrors.email) {
        emailRef.current?.focus();
        scrollFieldIntoView(emailRef.current);
      } else {
        passwordRef.current?.focus();
        scrollFieldIntoView(passwordRef.current);
      }
      return;
    }

    // Belt-and-suspenders read on the actual input refs. Some password
    // managers (iOS Keychain, certain 1Password versions, autofill
    // extensions) set `.value` directly on the DOM element without
    // dispatching a real `input` event, so React's onChange never fires
    // and formData.email / .password stay empty even though the inputs
    // look filled. Prefer the live ref value whenever React state is
    // empty so we don't submit two empty strings on a successfully-
    // autofilled form.
    const liveEmail = sanitizeEmail(emailRef.current?.value || formData.email || '');
    const livePassword = normalizePassword(passwordRef.current?.value || formData.password || '');
    const trimmedEmail = liveEmail;
    const normalizedPassword = livePassword;

    if (!trimmedEmail || !normalizedPassword) {
      // Re-run validation against the live values in case the form
      // looked complete via autofill but the refs disagreed.
      setValidationErrors({
        general: 'Please enter both your email and password.',
      });
      submittingRef.current = false;
      return;
    }

    // CRITICAL: flip the storage flag BEFORE login() fires so the
    // response tokens land in the right Storage object. Doing it after
    // would write to whichever backend the previous session used.
    //
    //   rememberMe TRUE  → localStorage → tokens survive browser restart
    //   rememberMe FALSE → sessionStorage → tokens die with the tab
    //
    // The flag itself lives in localStorage either way so we can read it
    // on the next page load to pick the right Storage for token reads.
    setRememberMe(formData.rememberMe);

    try {
      await login(trimmedEmail, normalizedPassword);

      LoginSecurity.clearFailures();
      try {
        if (formData.rememberMe) localStorage.setItem('rememberedEmail', trimmedEmail);
        else localStorage.removeItem('rememberedEmail');
      } catch { /* non-fatal */ }

      updateIntake({
        userLoggedIn: true,
        name: trimmedEmail.split('@')[0],
      });

      setIsSuccess(true);

      // Post-login destination preference, most-specific-wins:
      //   1. explicit redirectAfterLogin (set by RouteProtection)
      //   2. /intake/visual if intake isn't done yet
      //   3. /dashboard
      setTimeout(() => {
        const explicit = getRedirectAfterLogin();
        if (explicit && explicit !== '/dashboard') {
          navigate(explicit);
          return;
        }
        try {
          const raw = localStorage.getItem('userInfo');
          const parsed = raw ? JSON.parse(raw) : null;
          if (parsed && parsed.intakeCompleted === false) {
            navigate('/intake/visual');
            return;
          }
        } catch { /* fall through */ }
        navigate(explicit || '/dashboard');
      }, 1500);
    } catch (error: any) {
      // Record failed attempt + recompute failed count immediately so the
      // banner updates this tick.
      LoginSecurity.recordAttempt(true);
      const count = LoginSecurity.getFailedAttemptCount();
      setFailedCount(count);
      const attemptsRemaining = LoginSecurity.MAX_ATTEMPTS - count;

      const raw: string = error?.message || '';
      let display: string;
      let focusField: 'email' | 'password' | null = null;

      if (/EMAIL_NOT_VERIFIED/.test(raw) || /verify your email/i.test(raw)) {
        display = 'Please verify your email before logging in. Check your inbox for the link we sent at sign-up.';
      } else if (/ACCOUNT_LOCKED/.test(raw) || /locked/i.test(raw)) {
        display = 'Your account is locked. Please contact support.';
      } else if (/RATE_LIMIT/.test(raw) || /rate limit/i.test(raw) || /\b429\b/.test(raw) || /wait \d+s/i.test(raw)) {
        display = 'Too many sign-in attempts from this network. Please wait a minute and try again.';
      } else if (/INVALID_CREDENTIALS/.test(raw) || /invalid credentials/i.test(raw)) {
        display = 'Email or password is incorrect.';
        focusField = 'password';
      } else if (/network|fetch|failed to fetch/i.test(raw) || /offline/i.test(raw)) {
        display = 'Network problem — check your connection and try again.';
      } else if (/MISSING_CREDENTIALS/.test(raw)) {
        display = 'Email and password are both required.';
      } else {
        display = raw || 'Login failed. Please try again.';
      }

      if (attemptsRemaining > 0 && attemptsRemaining <= 2) {
        display += ` (${attemptsRemaining} ${attemptsRemaining === 1 ? 'attempt' : 'attempts'} remaining)`;
      }

      setValidationErrors({ general: display });
      // Only `focusField = 'password'` is reachable today (INVALID_CREDENTIALS).
      // If a future branch wants to focus the email field, set focusField there
      // and add a matching block here.
      if (focusField === 'password') { passwordRef.current?.focus(); scrollFieldIntoView(passwordRef.current); }
    } finally {
      submittingRef.current = false;
    }
  };

  // ----- Derived: form ready (drives sakura glow) ------------------------
  const trimmedEmail = sanitizeEmail(formData.email);
  const formReady = useMemo(() => {
    return (
      trimmedEmail.length > 0 &&
      EMAIL_RE.test(trimmedEmail) &&
      formData.password.length > 0 &&
      !lockoutInfo.locked &&
      online
    );
  }, [trimmedEmail, formData.password, lockoutInfo.locked, online]);

  // Button-state class selection — same trio used by Create Account.
  const submitButtonClass = useMemo(() => {
    const base =
      'w-full py-4 text-lg font-semibold rounded-2xl transition-all duration-300 backdrop-blur-sm flex items-center justify-center gap-2';
    if (isLoading) return `${base} btn-sakura-busy`;
    if (!formReady) return `${base} btn-sakura-idle`;
    return `${base} btn-sakura-ready`;
  }, [isLoading, formReady]);

  const honeypotStyle: React.CSSProperties = {
    position: 'absolute',
    left: '-10000px',
    top: 'auto',
    width: '1px',
    height: '1px',
    overflow: 'hidden',
    opacity: 0,
  };

  // ----- Success state ----------------------------------------------------
  if (isSuccess) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <BasicScene />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ duration: 1.5 }}
          className="absolute inset-0 bg-gradient-to-br from-pink-100/50 via-rose-50/30 to-pink-100/50 pointer-events-none"
        />
        <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', duration: 0.8 }}
          >
            <GlassCard enhanced gradient className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: 'spring', duration: 0.6 }}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-300 to-rose-400 mx-auto flex items-center justify-center shadow-[0_0_24px_rgba(244,114,182,0.45)]"
              >
                <span className="text-3xl">🌸</span>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <h2 className="text-3xl font-bold text-white mb-2">Welcome Back</h2>
                <p className="text-white/80">Redirecting you to your dashboard…</p>
              </motion.div>
            </GlassCard>
          </motion.div>
        </div>
      </div>
    );
  }

  // ----- Form -------------------------------------------------------------
  return (
    <div className="min-h-screen relative overflow-x-hidden">
      <BasicScene />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ duration: 1.5 }}
        className="absolute inset-0 bg-gradient-to-br from-pink-100/50 via-rose-50/30 to-pink-100/50 pointer-events-none"
      />

      {/* Floating petals — pointer-events-none, decorative. */}
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
            className="absolute w-2 h-2 bg-gradient-to-r from-white to-pink-200 rounded-full"
          />
        ))}
      </div>

      <div className="relative z-10 min-h-screen flex flex-col justify-center items-center p-6">
        {/* Outer GlassCard wrapper — viewport-relative width. Phone
            stays full-screen-comfortable; desktop is ~25% wider than
            the previous 38vw so the form has more presence on a wide
            monitor without losing the centered, petals-visible-on-
            both-sides aesthetic. */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-md"
          style={{ minWidth: 'min(95vw, 380px)', maxWidth: 'min(48vw, 36rem)' }}
        >
          {/* rounded-[2rem] (32px) reads visibly rounded at the outer
              corners; the previous rounded-3xl (24px) wasn't soft
              enough against the GlassCard's bright background.
              overflow-hidden removed — it was clipping the rotating
              avatar's box-shadow halo at the top edge of the card. */}
          <GlassCard enhanced gradient className="space-y-5 rounded-[2rem]">
            {/* Header */}
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5 }}
              className="text-center space-y-3"
            >
              {/* mt-4 pushes the rotating avatar far enough below the
                  GlassCard's top edge that its sakura-tinted halo has
                  room to breathe — the previous mb-2 alone left the
                  glow flush against the corner. */}
              <div className="flex justify-center mt-4 mb-2">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-pink-300 to-rose-400 flex items-center justify-center shadow-[0_0_24px_rgba(244,114,182,0.35)]"
                >
                  <span className="text-2xl leading-none">🌸</span>
                </motion.div>
              </div>

              <h2 className="text-3xl font-bold text-white text-shadow-soft">Welcome Back</h2>
              <p className="text-white/80 text-sm" style={{textAlign:'center'}}>
                "May the mirror continue to reflect that which is."
              </p>
            </motion.div>

            {/* Offline banner */}
            <AnimatePresence>
              {!online && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-3 rounded-2xl text-center text-sm bg-yellow-400/20 text-yellow-100 border border-yellow-400/30"
                  role="alert"
                  aria-live="polite"
                >
                  You're offline. We'll re-enable Sign In once you're back online.
                </motion.div>
              )}
            </AnimatePresence>

            {/* Lockout banner */}
            <AnimatePresence>
              {lockoutInfo.locked && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="p-3 rounded-2xl bg-red-400/20 border border-red-400/30"
                  role="alert"
                  aria-live="polite"
                >
                  <div className="flex items-center justify-center space-x-2 text-sm text-white">
                    <span aria-hidden="true">🔒</span>
                    <span>
                      Locked. Try again in{' '}
                      <span className="font-bold text-red-200">
                        {Math.floor(lockoutInfo.timeRemaining / 60)}:
                        {(lockoutInfo.timeRemaining % 60).toString().padStart(2, '0')}
                      </span>
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* General-error banner */}
            <AnimatePresence>
              {(validationErrors.general || authError) && !lockoutInfo.locked && !(!online) && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="p-3 rounded-2xl text-center text-sm font-medium bg-red-400/20 text-red-100 border border-red-400/30"
                  role="alert"
                  aria-live="assertive"
                >
                  {validationErrors.general || authError}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form */}
            {/* flex flex-col gap-6 — gap survives wrapper changes and
                isn't affected by Tailwind's content-scan quirks the way
                space-y-* can be. items-center physically centers each
                card on the cross-axis so the field-card-shell's
                margin-inline: auto isn't fighting the parent's stretch
                default on mobile. w-full keeps the form spanning the
                GlassCard's inner width so items-center has a real
                axis to center against. */}
            <form
  onSubmit={handleSubmit}
  className="flex flex-col items-center gap-5 w-full"
  autoComplete="on"
  noValidate
  aria-label="Sign in to Mirror"
>
  {/* Honeypot */}
  <div aria-hidden="true" style={honeypotStyle}>
    <label htmlFor="login-nickname-hp">Leave this field empty</label>
    <input
      id="login-nickname-hp"
      type="text"
      name="nickname"
      tabIndex={-1}
      autoComplete="off"
      value={honeypot}
      onChange={(e) => setHoneypot(e.target.value)}
    />
  </div>

  {/* Email Field Shell */}
  <div className="field-card-shell glass-card-sakura p-4 rounded-3xl w-full max-w-[18rem] mx-auto" style={{boxShadow:'none',border:'none'}}>
    <div className="flex flex-col items-center w-full">
      <div className="relative w-full">
        <input
          ref={emailRef}
          id="login-email"
          type="email"
          name="email"
          value={formData.email}
          onChange={(e) => setFormData((p) => ({ ...p, email: sanitizeEmail(e.target.value) }))}
          onFocus={(e) => scrollFieldIntoView(e.currentTarget)}
          className={`
            input-sakura w-full p-3 bg-white/10 border-2
            text-white placeholder-white/50 text-center rounded-2xl
            focus:outline-none transition-colors
            ${validationErrors.email ? 'border-red-400' :
              formData.email && !validationErrors.email && EMAIL_RE.test(trimmedEmail) ? 'border-pink-300/70' : 'border-white/20'}
          `}
          placeholder="Enter your email address"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode="email"
          enterKeyHint="next"
          maxLength={254}
          aria-label="Email address"
          aria-invalid={!!validationErrors.email}
          disabled={isLoading || lockoutInfo.locked}
        />
      </div>

      <AnimatePresence>
        {validationErrors.email && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="text-red-400 text-xs mt-1.5 text-center w-full"
            role="alert"
            aria-live="polite"
          >
            {validationErrors.email}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  </div>

  {/* Password Field Shell */}
  <div className="field-card-shell glass-card-sakura p-4 rounded-3xl w-full max-w-[18rem] mx-auto" style={{boxShadow:'none',border:'none'}}>
    <div className="flex flex-col items-center w-full">
      <div className="relative w-full">
        <input
          ref={passwordRef}
          id="login-password"
          type={showPassword ? 'text' : 'password'}
          name="current-password"
          value={formData.password}
          onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
          onFocus={(e) => scrollFieldIntoView(e.currentTarget)}
          className={`
            input-sakura w-full p-3 px-10 bg-white/10 border-2
            text-white placeholder-white/50 text-center rounded-2xl
            focus:outline-none transition-colors
            ${validationErrors.password ? 'border-red-400' :
              formData.password ? 'border-pink-300/70' : 'border-white/20'}
          `}
          placeholder="Enter your password"
          autoComplete="current-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          maxLength={256}
          aria-label="Password"
          aria-invalid={!!validationErrors.password}
          disabled={isLoading || lockoutInfo.locked}
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="absolute left-3 top-1/2 -translate-y-1/2 border-0 bg-transparent p-1 leading-none text-white/60 hover:text-pink-200 transition-colors focus:outline-none"
          style={{borderRadius:'1rem'}}
          tabIndex={-1}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? '🙈' : '👁️'}
        </button>
      </div>

      <AnimatePresence>
        {validationErrors.password && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="text-red-400 text-xs mt-1.5 text-center w-full"
            role="alert"
            aria-live="polite"
          >
            {validationErrors.password}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  </div>

  {/* Remember + Forgot Links */}
  {/* Removed px-1 to avoid pushing things off-center, forced symmetrical alignment boundaries */}
  <div className="flex items-center justify-between w-full max-w-[17rem] mx-auto select-none">
    <label className="flex items-center space-x-2 cursor-pointer">
      <input
        type="checkbox"
        name="remember-me"
        checked={formData.rememberMe}
        onChange={(e) => setFormData((p) => ({ ...p, rememberMe: e.target.checked }))}
        className="h-4 w-4 cursor-pointer rounded border-2 border-white/30 bg-white/10 accent-pink-400 focus:outline-none"
        disabled={isLoading || lockoutInfo.locked}
      />
      <span className="text-white/80 text-xs sm:text-sm">Remember me</span>
    </label>

    <Link to="/forgot-password" className="link-mono text-xs sm:text-sm">
      Forgot password?
    </Link>
  </div>

  {/* Submit Button Section */}
  {/* Standardized width boundary down slightly to cleanly float inside the parent text margins */}
  <div 
    className="w-full max-w-[17rem] mx-auto flex flex-col items-center justify-center text-center"
    style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
  >
    <AnimatePresence mode="wait" initial={false}>
      {(!formReady && !isLoading) ? (
        <motion.div
          key="flower-placeholder"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="w-full flex justify-center items-center py-3 mx-auto text-center"
          aria-hidden="true"
        >
          <motion.span
            animate={{ y: [0, -4, 0], rotate: [0, 4, -4, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            className="text-4xl select-none drop-shadow-[0_0_14px_rgba(244,114,182,0.45)] mx-auto block text-center"
          >
            🌸
          </motion.span>
        </motion.div>
      ) : (
        <motion.div
          key="signin-button"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="w-full flex justify-center mx-auto"
        >
          <button
            type="submit"
            disabled={isLoading || lockoutInfo.locked || !formReady}
            className={`${submitButtonClass} w-full`}
            style={{ borderRadius: '1rem' }}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-5 h-5 border-2 border-rose-300/40 border-t-rose-700 rounded-full"
                />
                <span>Signing in…</span>
              </>
            ) : (
              <>
                <span>🌸</span>
                <span>Sign In</span>
              </>
            )}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
</form>

            {/* Failed-attempts hint */}
            <AnimatePresence>
              {failedCount > 0 && !lockoutInfo.locked && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="text-center"
                >
                  <p className="text-yellow-300/80 text-xs">
                    {failedCount} failed {failedCount === 1 ? 'attempt' : 'attempts'} detected
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Footer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-center pt-3 border-t border-white/10"
              style={{ border: 'none' }}
            >
              <p className="text-white/60 text-sm">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="link-mono"
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