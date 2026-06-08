// src/components/intake/RegistrationStep.tsx
//
// Mobile-registration hardening — goal #1 (Phase 2b).
//
// PHASE A (first pass) addressed the core mobile failures: progressive
// disclosure unmounted password fields and broke iOS autofill, autoComplete
// was "off" everywhere, autoCapitalize / autoCorrect were never set on the
// username, the client and server disagreed on which characters counted as
// "special", and a setTimeout-driven auto-step opened Confirm/Terms/Submit
// below the keyboard.
//
// PHASE B (this revision) covers the edge cases that survived phase A.
// Registration is the user's first interaction with the product — a glitch
// here is a hard churn signal, not a recoverable bug. So we cover:
//
//    1. Bot defence — a hidden honeypot input ("organisation") that humans
//       never see and never fill but bot scripts will dutifully populate.
//       Server doesn't have to know about it; we just refuse to submit
//       client-side if it's non-empty. (Server-side rate limiting catches
//       the rest — see mirror-server-updates/routes/auth.ts.)
//
//    2. Idempotent submit — a ref guards against a React-StrictMode-style
//       double-fire AND against a user double-tapping the submit button
//       inside the same event-loop tick. The existing `loading` state
//       flag isn't enough on its own because state updates batch.
//
//    3. Offline detection — `navigator.onLine` plus online/offline events.
//       Submit is disabled with an explicit banner when offline; we don't
//       silently fire-and-forget a request the browser will queue.
//
//    4. Field-progress persistence — username + email are checkpointed
//       to sessionStorage so an accidental refresh / pull-down-to-reload
//       on iOS doesn't make the user start over. Password is NEVER
//       persisted.
//
//    5. scrollIntoView on focus — iOS Safari does not auto-scroll inputs
//       above the on-screen keyboard reliably. We do it ourselves on
//       focus so the user never has to fight the keyboard.
//
//    6. HIBP password breach warning — k-anonymity SHA-1 prefix check
//       against api.pwnedpasswords.com. Only the first 5 hex chars of
//       the hash leave the device; the password itself never does. The
//       warning is a soft nudge, never a block — false positives on
//       memorable passwords are common and we don't want to gatekeep
//       intent.
//
//    7. Stronger ARIA — every error is a live region, the submit button
//       advertises its busy state, the honeypot is `aria-hidden`.
//
//    8. Safe-area-aware submit — the button carries
//       `paddingBottom: env(safe-area-inset-bottom)` so it never sits
//       under the iOS home indicator on standalone PWAs.
//
// What did NOT change from Phase A:
//    - Visual layout, framer-motion choreography, GlassCard styling.
//    - The single source of truth on password policy (matches the server
//      regex landing in this same change set).

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntake } from '../../context/IntakeContext';
import { useAuth } from '../../context/AuthContext';
import GlassCard from '../ui/GlassCard';
import { motion, AnimatePresence } from 'framer-motion';
import BasicScene from '../three/BasicScene';
import { acceptTerms } from '../../services/consentApi';
import { TERMS_VERSION, TERMS_HREF, MINIMUM_AGE } from '../../config/legal';

// ---------------------------------------------------------------------------
// Constants — kept identical between client and server.
// ---------------------------------------------------------------------------
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 20;
const USERNAME_ALLOWED = /^[a-zA-Z0-9_]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_SPECIAL_RE = /[^A-Za-z0-9\s]/;

const PROGRESS_STORAGE_KEY = 'mirror.registration.progress.v1';

interface ValidationErrors {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  terms?: string;
  general?: string;
}

// iOS substitutes ASCII apostrophes / quotes / hyphens with their "smart"
// Unicode equivalents when Smart Punctuation is on (the default). Bcrypt
// hashes raw bytes so we normalise these before sending. Mirrored on the
// server side as a belt-and-braces guarantee.
function normalizePassword(raw: string): string {
  return raw
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—―]/g, '-')
    .replace(/…/g, '...');
}
function sanitizeUsername(raw: string): string {
  return raw.replace(/\s+/g, '').slice(0, USERNAME_MAX_LENGTH);
}
function sanitizeEmail(raw: string): string {
  return raw.trim().slice(0, 254);
}

// ---------------------------------------------------------------------------
// HIBP k-anonymity breach check.
//
// We SHA-1 the password locally, send the first 5 hex chars over HTTPS,
// and scan the response for the rest of the hash. The plaintext password
// never leaves the device. We hit this on a debounce so it doesn't fire
// on every keystroke (one request per ~600ms of typing-quiet).
//
// Designed to be silently best-effort:
//   - If the network call fails, we return `null` and the UI just doesn't
//     surface a warning. Users with strict CSPs, ad-blockers, captive-portal
//     situations, or offline conditions all see the same "no warning"
//     behaviour they would have seen without this feature.
//   - We use AbortController so a fast typist isn't waiting on stale
//     requests once they've moved on.
// ---------------------------------------------------------------------------
async function sha1Hex(text: string): Promise<string | null> {
  try {
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-1', enc);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  } catch {
    return null;
  }
}

async function checkPasswordBreached(
  password: string,
  signal: AbortSignal
): Promise<{ breached: boolean; count: number } | null> {
  const hash = await sha1Hex(password);
  if (!hash) return null;
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      method: 'GET',
      headers: { 'Add-Padding': 'true' },
      signal,
    });
    if (!res.ok) return null;
    const text = await res.text();
    const line = text.split('\n').find((l) => l.startsWith(suffix + ':'));
    if (!line) return { breached: false, count: 0 };
    const countStr = line.slice(suffix.length + 1).trim();
    const count = parseInt(countStr, 10);
    return { breached: count > 0, count: Number.isFinite(count) ? count : 0 };
  } catch {
    return null;
  }
}

const RegistrationStep: React.FC = () => {
  const navigate = useNavigate();
  const { updateIntake } = useIntake();
  const { register: registerWithAuth } = useAuth();

  // ----- Form state --------------------------------------------------------
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Honeypot — humans never see this. Bots that fill every form field
  // will populate it and we'll silently refuse to submit.
  const [honeypot, setHoneypot] = useState('');

  // ----- UI state ----------------------------------------------------------
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const [breachWarning, setBreachWarning] = useState<string | null>(null);

  // Connectivity. `navigator.onLine` defaults to `true` server-side / in
  // tests, which is the safe default.
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Password-strength state
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordCriteria, setPasswordCriteria] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
  });

  // Refs ------------------------------------------------------------------
  // Field refs so the mobile keyboard's Enter / Next moves focus instead
  // of submitting a half-empty form, and so we can `scrollIntoView` on
  // focus / error.
  const usernameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  // Idempotent-submit guard — defends against React StrictMode firing
  // event handlers twice in dev AND against rapid double-tap on the
  // submit button (a single render between taps can leave `loading`
  // false even though we're already submitting).
  const submittingRef = useRef<boolean>(false);

  // Abort handle for the in-flight HIBP request so we don't leak fetches.
  const hibpAbortRef = useRef<AbortController | null>(null);

  // ----- Field-progress persistence (sessionStorage) ---------------------
  // Rehydrate username + email on mount so a pull-to-refresh doesn't make
  // the user re-type. Password and Confirm Password are NEVER persisted.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PROGRESS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { username?: string; email?: string };
      if (parsed?.username) setUsername(sanitizeUsername(parsed.username));
      if (parsed?.email) setEmail(sanitizeEmail(parsed.email));
    } catch { /* corrupt blob — ignore */ }
  }, []);

  // Save progress as the user types. Debounce is implicit — these fields
  // change at typing speed, and the writes are tiny.
  useEffect(() => {
    try {
      sessionStorage.setItem(
        PROGRESS_STORAGE_KEY,
        JSON.stringify({ username, email })
      );
    } catch { /* private mode / quota — non-fatal */ }
  }, [username, email]);

  // ----- Connectivity listeners -----------------------------------------
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

  // ----- Real-time validation -------------------------------------------
  useEffect(() => {
    const errors: ValidationErrors = {};

    if (username) {
      if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
        errors.username = `Username must be ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters`;
      } else if (!USERNAME_ALLOWED.test(username)) {
        errors.username = 'Letters, numbers, and underscores only';
      }
    }

    if (email && !EMAIL_RE.test(email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (password) {
      const criteria = {
        length: password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /\d/.test(password),
        special: PASSWORD_SPECIAL_RE.test(password),
      };
      setPasswordCriteria(criteria);
      const strength = Object.values(criteria).filter(Boolean).length;
      setPasswordStrength(strength);

      if (!criteria.length) {
        errors.password = `Password must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters`;
      } else if (strength < 5) {
        errors.password = 'Password must meet every requirement below';
      }
    } else {
      setPasswordStrength(0);
      setPasswordCriteria({
        length: false, uppercase: false, lowercase: false, number: false, special: false,
      });
    }

    if (confirmPassword && password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setValidationErrors(errors);
  }, [username, email, password, confirmPassword]);

  // ----- HIBP debounced breach check -------------------------------------
  // Run only when the password passes local validation, so we don't burn
  // requests on every keystroke as the user types up to "Strong".
  useEffect(() => {
    setBreachWarning(null);
    if (!password) return;
    if (password.length < PASSWORD_MIN_LENGTH) return;

    // Cancel any pending request — the user kept typing.
    hibpAbortRef.current?.abort();
    const ctrl = new AbortController();
    hibpAbortRef.current = ctrl;

    const timer = setTimeout(async () => {
      const result = await checkPasswordBreached(password, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (!result) return; // network or crypto unavailable — fail silent
      if (result.breached) {
        setBreachWarning(
          `Heads up — this password has appeared in ${result.count.toLocaleString()} known data breaches. ` +
            `It will work, but consider a unique one for your security.`
        );
      }
    }, 600);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [password]);

  // ----- Step progression -------------------------------------------------
  useEffect(() => {
    let next = 0;
    if (username && !validationErrors.username) next = Math.max(next, 1);
    if (email && !validationErrors.email) next = Math.max(next, 2);
    if (password && !validationErrors.password) next = Math.max(next, 3);
    if (confirmPassword && !validationErrors.confirmPassword) next = Math.max(next, 3);
    if (next > currentStep) setCurrentStep(next);
  }, [username, email, password, confirmPassword, validationErrors, currentStep]);

  // ----- Mobile-keyboard scroll helper -----------------------------------
  // iOS Safari does NOT reliably scroll a focused input above the on-screen
  // keyboard once the form contains taller content. We do it ourselves.
  // `block: 'center'` puts the field comfortably above the keyboard on
  // every screen size we've tested.
  const scrollFieldIntoView = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    // Defer past the keyboard's own opening animation (~250ms on iOS).
    setTimeout(() => {
      try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch { /* noop */ }
    }, 300);
  }, []);

  // ----- Enter-key handling ----------------------------------------------
  const focusNext = useCallback(
    (current: 'username' | 'email' | 'password' | 'confirm') => {
      if (current === 'username') emailRef.current?.focus();
      else if (current === 'email') passwordRef.current?.focus();
      else if (current === 'password') confirmPasswordRef.current?.focus();
    },
    []
  );

  const handleEnter = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, field: 'username' | 'email' | 'password' | 'confirm') => {
      if (e.key !== 'Enter') return;
      if (field !== 'confirm') {
        e.preventDefault();
        focusNext(field);
      }
    },
    [focusNext]
  );

  // ----- Submit -----------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Honeypot triggered → silently refuse. Don't say WHY (real users
    // would never see this; bots get no signal to refine against).
    if (honeypot.trim().length > 0) {
      setLoading(false);
      return;
    }

    // Idempotent guard. submittingRef beats `loading` because state
    // updates batch — two synchronous taps can both pass `if (!loading)`.
    if (submittingRef.current) return;
    submittingRef.current = true;

    // Offline guard. The browser would happily queue the fetch and fail
    // later; better to tell the user now.
    if (!online) {
      setMessage('❌ You appear to be offline. Reconnect and try again.');
      submittingRef.current = false;
      return;
    }

    const trimmedUsername = sanitizeUsername(username);
    const trimmedEmail = sanitizeEmail(email);
    const normalizedPassword = normalizePassword(password);
    const normalizedConfirm = normalizePassword(confirmPassword);

    const finalErrors: ValidationErrors = {};
    if (!trimmedUsername) finalErrors.username = 'Username is required';
    else if (trimmedUsername.length < USERNAME_MIN_LENGTH || trimmedUsername.length > USERNAME_MAX_LENGTH) {
      finalErrors.username = `Username must be ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters`;
    } else if (!USERNAME_ALLOWED.test(trimmedUsername)) {
      finalErrors.username = 'Letters, numbers, and underscores only';
    }

    if (!trimmedEmail) finalErrors.email = 'Email is required';
    else if (!EMAIL_RE.test(trimmedEmail)) finalErrors.email = 'Please enter a valid email address';

    if (!normalizedPassword) finalErrors.password = 'Password is required';
    else {
      const ok =
        normalizedPassword.length >= PASSWORD_MIN_LENGTH &&
        normalizedPassword.length <= PASSWORD_MAX_LENGTH &&
        /[a-z]/.test(normalizedPassword) &&
        /[A-Z]/.test(normalizedPassword) &&
        /\d/.test(normalizedPassword) &&
        PASSWORD_SPECIAL_RE.test(normalizedPassword);
      if (!ok) finalErrors.password = 'Password does not meet every requirement';
    }

    if (normalizedPassword !== normalizedConfirm) {
      finalErrors.confirmPassword = 'Passwords do not match';
    }

    if (!agreedToTerms) {
      finalErrors.terms = `Please confirm your age and agree to the Terms & Conditions`;
    }

    if (Object.keys(finalErrors).length > 0) {
      setValidationErrors((prev) => ({ ...prev, ...finalErrors }));
      const firstKey = Object.keys(finalErrors)[0] as keyof ValidationErrors;
      setMessage(`❌ ${finalErrors[firstKey]}`);
      if (finalErrors.username) { usernameRef.current?.focus(); scrollFieldIntoView(usernameRef.current); }
      else if (finalErrors.email) { emailRef.current?.focus(); scrollFieldIntoView(emailRef.current); }
      else if (finalErrors.password) { passwordRef.current?.focus(); scrollFieldIntoView(passwordRef.current); }
      else if (finalErrors.confirmPassword) { confirmPasswordRef.current?.focus(); scrollFieldIntoView(confirmPasswordRef.current); }
      submittingRef.current = false;
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      await registerWithAuth(trimmedUsername, trimmedEmail, normalizedPassword);

      // Best-effort consent record.
      void acceptTerms(TERMS_VERSION).catch(() => undefined);

      updateIntake({
        userRegistered: true,
        userLoggedIn: true,
        name: trimmedUsername,
      });

      // Clear persisted progress on success so a returning unauthenticated
      // user on this device doesn't see the previous signup's draft.
      try { sessionStorage.removeItem(PROGRESS_STORAGE_KEY); } catch { /* noop */ }

      setIsSuccess(true);
      setMessage('Registration successful!');
      setTimeout(() => navigate('/intake/visual'), 3500);
    } catch (err: any) {
      const raw: string = err?.message || '';
      // The server's per-field error code travels through to here via
      // AuthContext's thrown Error. Map back to a focused field + a
      // human-friendly message.
      let display = raw || 'Registration failed. Please try again.';
      let focusField: 'username' | 'email' | 'password' | null = null;

      if (/email[_ ]?(exists|already)/i.test(raw) || /EMAIL_EXISTS/.test(raw) || /EMAIL_ALREADY/.test(raw)) {
        display = 'That email is already registered. Try logging in instead.';
        focusField = 'email';
        setValidationErrors((prev) => ({ ...prev, email: 'Email already registered' }));
      } else if (/USERNAME_TAKEN/.test(raw) || /username.*taken/i.test(raw)) {
        display = 'That username is taken. Please pick another.';
        focusField = 'username';
        setValidationErrors((prev) => ({ ...prev, username: 'Username already taken' }));
      } else if (/DISPOSABLE_EMAIL/.test(raw) || /disposable/i.test(raw)) {
        display = 'Disposable email addresses are not supported. Please use your regular inbox.';
        focusField = 'email';
        setValidationErrors((prev) => ({ ...prev, email: 'Disposable inboxes are not supported' }));
      } else if (/RATE_LIMIT/.test(raw) || /rate limit/i.test(raw) || /\b429\b/.test(raw)) {
        display = 'Too many attempts from this network. Please wait a minute and try again.';
      } else if (/weak[_ ]?password/i.test(raw) || /WEAK_PASSWORD/.test(raw)) {
        display = 'Password rejected. Make sure it meets every requirement below.';
        focusField = 'password';
      } else if (/network|fetch|failed to fetch/i.test(raw)) {
        display = 'Network problem — check your connection and try again.';
      } else if (/missing[_ ]?fields/i.test(raw) || /MISSING_FIELDS/.test(raw)) {
        display = 'Some required fields were missing. Please review the form.';
      }

      setMessage('❌ ' + display);
      if (focusField === 'email') { emailRef.current?.focus(); scrollFieldIntoView(emailRef.current); }
      else if (focusField === 'username') { usernameRef.current?.focus(); scrollFieldIntoView(usernameRef.current); }
      else if (focusField === 'password') { passwordRef.current?.focus(); scrollFieldIntoView(passwordRef.current); }
      console.error('REGISTRATION FAILED:', err);
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  // ----- Style helpers ----------------------------------------------------
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
  const cardEmphasis = (index: number) => {
    if (index === currentStep) return 'opacity-100';
    if (index < currentStep) return 'opacity-100';
    return 'opacity-70';
  };

  // Honeypot styles — must NOT be `display: none` (some bots skip those).
  // We make it visually unreachable + zero-tab-index + aria-hidden so
  // screen readers don't announce it.
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
          className="absolute inset-0 bg-gradient-to-br from-green-100/50 via-emerald-50/30 to-teal-100/50 pointer-events-none"
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
                className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 mx-auto flex items-center justify-center"
              />
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="space-y-3"
              >
                <h2 className="text-3xl font-bold text-white mb-2">Welcome, {username || 'friend'}!</h2>
                <p className="text-white/85 leading-relaxed">
                  Your account has been created. We just sent a verification link to{' '}
                  <strong className="text-white">{email}</strong>.
                </p>
                <p className="text-white/65 text-sm">
                  You can continue to your intake now — we'll show a banner with a "Resend" option
                  until your email is verified.
                </p>
              </motion.div>
            </GlassCard>
          </motion.div>
        </div>
      </div>
    );
  }

  // ----- Main form --------------------------------------------------------
  return (
    <div className="min-h-screen relative overflow-hidden">
      <BasicScene />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ duration: 1.5 }}
        className="absolute inset-0 bg-gradient-to-br from-indigo-100/50 via-purple-50/30 to-pink-100/50 pointer-events-none"
      />

      {/* Floating petals — pointer-events-none so they never steal taps. */}
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
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center"
                >
                  <span className="text-2xl">🔆</span>
                </motion.div>
              </div>

              <h2 className="text-3xl font-bold text-white text-shadow-soft">Register </h2>
              <p className="text-white/80">
                "Whoever fights monsters should see to it that in the process he does not become a monster."
              </p>
            </motion.div>

            {/* Offline banner */}
            <AnimatePresence>
              {!online && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-3 rounded-xl text-center text-sm bg-yellow-400/20 text-yellow-100 border border-yellow-400/30"
                  role="alert"
                >
                  You're offline. We'll re-enable the Create Account button once you're back online.
                </motion.div>
              )}
            </AnimatePresence>

            {/* Progress indicator */}
            <div className="glass-card-enhanced p-4 rounded-xl">
              <div className="mx-auto w-full max-w-[18rem]">
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
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-6"
              autoComplete="on"
              noValidate
              aria-label="Create your Mirror account"
            >
              {/*
                Honeypot — hidden from users, irresistible to dumb bots.
                Field name deliberately uses `nickname` — it is NOT a name
                in the HTML autofill spec, so neither Safari, Chrome, nor
                1Password / iOS Keychain will populate it. A human won't
                see it (position + size + opacity); a bot fills every
                input it parses and trips the silent-reject path below.
                aria-hidden + tabIndex={-1} keep screen readers and
                keyboard nav clear of it.
              */}
              <div aria-hidden="true" style={honeypotStyle}>
                <label htmlFor="reg-nickname-hp">Leave this field empty</label>
                <input
                  id="reg-nickname-hp"
                  type="text"
                  name="nickname"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>

              {/* --------- USERNAME --------- */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-3"
              >
                <div className={`glass-card-enhanced p-4 rounded-xl transition-opacity duration-300 ${cardEmphasis(0)}`}>
                  <div className="flex flex-col items-center space-y-2 w-full">
                    <span className="text-2xl" aria-hidden="true">👤</span>

                    <div className="relative w-full max-w-[16rem]">
                      <input
                        ref={usernameRef}
                        id="reg-username"
                        name="username"
                        type="text"
                        placeholder="Choose a unique username"
                        value={username}
                        onChange={(e) => setUsername(sanitizeUsername(e.target.value))}
                        onFocus={(e) => scrollFieldIntoView(e.currentTarget)}
                        onKeyDown={(e) => handleEnter(e, 'username')}
                        className={`
                          w-full p-3 bg-white/10 border-2 rounded-lg
                          text-white placeholder-white/50 text-center
                          focus:outline-none focus:border-white/40 transition-all duration-300
                          ${validationErrors.username ? 'border-red-400' :
                            username && !validationErrors.username ? 'border-green-400' : 'border-white/20'}
                        `}
                        required
                        autoComplete="username"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        inputMode="text"
                        enterKeyHint="next"
                        maxLength={USERNAME_MAX_LENGTH}
                        aria-label="Username"
                        aria-invalid={!!validationErrors.username}
                        aria-describedby="reg-username-help"
                        disabled={loading}
                      />
                    </div>

                    <AnimatePresence>
                      {validationErrors.username && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="text-red-400 text-xs text-center"
                          role="alert"
                          aria-live="polite"
                        >
                          {validationErrors.username}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    {username && !validationErrors.username && (
                      <motion.p
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-green-400 text-xs flex items-center justify-center space-x-1"
                      >
                        <span>✓</span>
                        <span>Looks good!</span>
                      </motion.p>
                    )}
                  </div>

                  <div id="reg-username-help" className="mt-3 p-3 bg-white/5 rounded-lg mx-auto max-w-[18rem]">
                    <p className="text-white/70 text-xs mb-2 text-center">Requirements</p>
                    <ul className="space-y-1">
                      <li className="text-white/60 text-xs flex items-center justify-center space-x-2">
                        <span className="w-1 h-1 bg-white/40 rounded-full"></span>
                        <span>{USERNAME_MIN_LENGTH}-{USERNAME_MAX_LENGTH} characters</span>
                      </li>
                      <li className="text-white/60 text-xs flex items-center justify-center space-x-2">
                        <span className="w-1 h-1 bg-white/40 rounded-full"></span>
                        <span>Letters, numbers, underscores only</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </motion.div>

              {/* --------- EMAIL --------- */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.05 }}
                className="space-y-3"
              >
                <div className={`glass-card-enhanced p-4 rounded-xl transition-opacity duration-300 ${cardEmphasis(1)}`}>
                  <div className="flex flex-col items-center space-y-2 w-full">
                    <span className="text-2xl" aria-hidden="true">📧</span>

                    <div className="relative w-full max-w-[16rem]">
                      <input
                        ref={emailRef}
                        id="reg-email"
                        name="email"
                        type="email"
                        placeholder="Enter your email address"
                        value={email}
                        onChange={(e) => setEmail(sanitizeEmail(e.target.value))}
                        onFocus={(e) => scrollFieldIntoView(e.currentTarget)}
                        onKeyDown={(e) => handleEnter(e, 'email')}
                        className={`
                          w-full p-3 bg-white/10 border-2 rounded-lg
                          text-white placeholder-white/50 text-center
                          focus:outline-none focus:border-white/40 transition-all duration-300
                          ${validationErrors.email ? 'border-red-400' :
                            email && !validationErrors.email ? 'border-green-400' : 'border-white/20'}
                        `}
                        required
                        autoComplete="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        inputMode="email"
                        enterKeyHint="next"
                        maxLength={254}
                        aria-label="Email address"
                        aria-invalid={!!validationErrors.email}
                        aria-describedby="reg-email-help"
                        disabled={loading}
                      />
                    </div>

                    <AnimatePresence>
                      {validationErrors.email && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="text-red-400 text-xs text-center"
                          role="alert"
                          aria-live="polite"
                        >
                          {validationErrors.email}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    {email && !validationErrors.email && (
                      <motion.p
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-green-400 text-xs flex items-center justify-center space-x-1"
                      >
                        <span>✓</span>
                        <span>Looks good!</span>
                      </motion.p>
                    )}
                  </div>

                  <div id="reg-email-help" className="mt-3 p-3 bg-white/5 rounded-lg mx-auto max-w-[18rem]">
                    <p className="text-white/70 text-xs mb-2 text-center">Requirements</p>
                    <ul className="space-y-1">
                      <li className="text-white/60 text-xs flex items-center justify-center space-x-2">
                        <span className="w-1 h-1 bg-white/40 rounded-full"></span>
                        <span>Valid email format</span>
                      </li>
                      <li className="text-white/60 text-xs flex items-center justify-center space-x-2">
                        <span className="w-1 h-1 bg-white/40 rounded-full"></span>
                        <span>Will be used for account recovery</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </motion.div>

              {/* --------- PASSWORD --------- */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="space-y-3"
              >
                <div className={`glass-card-enhanced p-4 rounded-xl transition-opacity duration-300 ${cardEmphasis(2)}`}>
                  <div className="flex flex-col items-center space-y-2 w-full">
                    <span className="text-2xl" aria-hidden="true">🔒</span>

                    <div className="relative w-full max-w-[16rem]">
                      <input
                        ref={passwordRef}
                        id="reg-password"
                        name="new-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Create a secure password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={(e) => scrollFieldIntoView(e.currentTarget)}
                        onKeyDown={(e) => handleEnter(e, 'password')}
                        className={`
                          w-full p-3 pr-10 bg-white/10 border-2 rounded-lg
                          text-white placeholder-white/50 text-center
                          focus:outline-none focus:border-white/40 transition-all duration-300
                          ${validationErrors.password ? 'border-red-400' :
                            password && !validationErrors.password ? 'border-green-400' : 'border-white/20'}
                        `}
                        required
                        autoComplete="new-password"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        enterKeyHint="next"
                        maxLength={PASSWORD_MAX_LENGTH}
                        aria-label="Password"
                        aria-invalid={!!validationErrors.password}
                        aria-describedby="reg-password-help"
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                        tabIndex={-1}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
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
                          className="text-red-400 text-xs text-center"
                          role="alert"
                          aria-live="polite"
                        >
                          {validationErrors.password}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    {password && !validationErrors.password && (
                      <motion.p
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-green-400 text-xs flex items-center justify-center space-x-1"
                      >
                        <span>✓</span>
                        <span>Looks good!</span>
                      </motion.p>
                    )}
                  </div>

                  <div id="reg-password-help" className="mt-3 p-3 bg-white/5 rounded-lg mx-auto max-w-[18rem]">
                    <p className="text-white/70 text-xs mb-2 text-center">Requirements</p>
                    <ul className="space-y-1">
                      <li className="text-white/60 text-xs flex items-center justify-center space-x-2">
                        <span className="w-1 h-1 bg-white/40 rounded-full"></span>
                        <span>At least {PASSWORD_MIN_LENGTH} characters</span>
                      </li>
                      <li className="text-white/60 text-xs flex items-center justify-center space-x-2">
                        <span className="w-1 h-1 bg-white/40 rounded-full"></span>
                        <span>One uppercase letter</span>
                      </li>
                      <li className="text-white/60 text-xs flex items-center justify-center space-x-2">
                        <span className="w-1 h-1 bg-white/40 rounded-full"></span>
                        <span>One lowercase letter</span>
                      </li>
                      <li className="text-white/60 text-xs flex items-center justify-center space-x-2">
                        <span className="w-1 h-1 bg-white/40 rounded-full"></span>
                        <span>One number</span>
                      </li>
                      <li className="text-white/60 text-xs flex items-center justify-center space-x-2">
                        <span className="w-1 h-1 bg-white/40 rounded-full"></span>
                        <span>One symbol (any non-letter / non-digit)</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </motion.div>

              {/* HIBP breach warning — soft nudge, never a block. */}
              <AnimatePresence>
                {breachWarning && password && !validationErrors.password && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-3 rounded-xl text-center text-xs bg-amber-400/20 text-amber-100 border border-amber-400/30"
                    role="status"
                    aria-live="polite"
                  >
                    {breachWarning}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Password strength meter */}
              {password && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card-enhanced p-4 rounded-xl"
                >
                  <div className="mx-auto w-full max-w-[18rem]">
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

                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      {Object.entries(passwordCriteria).map(([key, met]) => (
                        <div key={key} className={`flex items-center space-x-2 ${met ? 'text-green-400' : 'text-white/40'}`}>
                          <span>{met ? '✓' : '○'}</span>
                          <span className="capitalize">
                            {key === 'length' ? `${PASSWORD_MIN_LENGTH}+ chars` : key}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* --------- CONFIRM PASSWORD --------- */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.15 }}
                className={`glass-card-enhanced p-4 rounded-xl transition-opacity duration-300 ${cardEmphasis(3)}`}
              >
                <div className="flex flex-col items-center space-y-2 w-full">
                  <span className="text-2xl" aria-hidden="true">🔑</span>

                  <div className="relative w-full max-w-[16rem]">
                    <input
                      ref={confirmPasswordRef}
                      id="reg-confirm-password"
                      name="confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onFocus={(e) => scrollFieldIntoView(e.currentTarget)}
                      onKeyDown={(e) => handleEnter(e, 'confirm')}
                      className={`
                        w-full p-3 pr-10 bg-white/10 border-2 rounded-lg text-white placeholder-white/50
                        text-center focus:outline-none focus:border-white/40 transition-all duration-300
                        ${confirmPassword && password !== confirmPassword ? 'border-red-400' :
                          confirmPassword && password === confirmPassword ? 'border-green-400' : 'border-white/20'}
                      `}
                      required
                      autoComplete="new-password"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      enterKeyHint="go"
                      maxLength={PASSWORD_MAX_LENGTH}
                      aria-label="Confirm password"
                      aria-invalid={!!validationErrors.confirmPassword}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                      tabIndex={-1}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? '🙈' : '👁️'}
                    </button>
                  </div>

                  {confirmPassword && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`text-xs flex items-center justify-center space-x-1 ${
                        password === confirmPassword ? 'text-green-400' : 'text-red-400'
                      }`}
                      role={password === confirmPassword ? undefined : 'alert'}
                      aria-live="polite"
                    >
                      <span>{password === confirmPassword ? '✓' : '✗'}</span>
                      <span>{password === confirmPassword ? 'Passwords match' : 'Passwords do not match'}</span>
                    </motion.p>
                  )}
                </div>
              </motion.div>

              {/* --------- TERMS --------- */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="glass-card-enhanced p-4 rounded-xl"
              >
                <label
                  htmlFor="agree-terms"
                  className="mx-auto flex w-full max-w-[18rem] cursor-pointer items-start gap-3 text-sm text-white/85"
                >
                  <input
                    id="agree-terms"
                    name="agree-terms"
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-2 border-white/30 bg-white/10 accent-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300/50"
                    disabled={loading}
                    aria-invalid={!!validationErrors.terms}
                  />
                  <span className="leading-relaxed">
                    I am at least {MINIMUM_AGE} years old and I agree to the{' '}
                    <a
                      href={TERMS_HREF}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-indigo-300 underline hover:text-indigo-200"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Terms &amp; Conditions
                    </a>
                    .
                  </span>
                </label>

                <AnimatePresence>
                  {validationErrors.terms && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="text-red-400 text-xs text-center mt-2"
                      role="alert"
                      aria-live="polite"
                    >
                      {validationErrors.terms}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* --------- SUBMIT --------- */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
              >
                <button
                  type="submit"
                  disabled={loading || !online}
                  className={`
                    w-full py-4 text-lg font-semibold transition-all duration-300 rounded-xl
                    border border-gray-300 backdrop-blur-sm shadow-sm
                    ${loading || !online
                      ? 'bg-gray-100 opacity-50 cursor-not-allowed text-gray-400'
                      : 'bg-gradient-to-r from-indigo-100 to-purple-100 hover:from-indigo-200 hover:to-purple-200 text-black hover:border-indigo-300 hover:shadow-md'}
                  `}
                  aria-busy={loading}
                >
                  {loading ? (
                    <span className="flex items-center justify-center space-x-2">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
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

              {/* --------- BANNER MESSAGE --------- */}
              <AnimatePresence>
                {message && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.3 }}
                    className={`
                      p-4 rounded-xl text-center font-medium
                      ${/^(?!.*❌).*success/i.test(message)
                        ? 'bg-green-400/20 text-green-200 border border-green-400/30'
                        : 'bg-red-400/20 text-red-200 border border-red-400/30'}
                    `}
                    role="status"
                    aria-live="assertive"
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
                  type="button"
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