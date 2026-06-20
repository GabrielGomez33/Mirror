// src/components/intake/RegistrationStep.tsx
//
// Mobile-registration hardening — goal #1 (Phase 2b + aesthetic pass).
//
// Phase A fixed the dominant mobile failures (autofill / password-policy
// mismatch). Phase B closed the remaining edge cases (honeypot, idempotent
// submit, offline detection, sessionStorage progress, scrollIntoView,
// HIBP, ARIA, safe-area). This pass is the visual round:
//
//   1. Progressive disclosure RESTORED (cards expand as steps are earned)
//      but every input stays mounted in the DOM from first paint so iOS
//      Keychain / 1Password can still see the full form and offer Strong
//      Password and autofill. We achieve "appears later" with a CSS
//      reveal (max-height + opacity transition) instead of conditional
//      mounting — the only technique that satisfies both "appear when
//      ready" and "autofill works."
//   2. Sakura glow on the Create Account button when every field is
//      valid + terms accepted + online. Idle button is neutral glass;
//      ready button blooms with a soft pink halo and breathes once
//      every 3s. Reduced-motion users get the static glow. Replaces
//      the previous blue from-indigo-100→purple-100 affordance.
//   3. Sakura-tinted glass-card-sakura on individual input cards —
//      same silhouette as glass-card-enhanced but with a pink wash
//      that brightens on focus-within, so the card the keyboard is
//      anchored to feels alive on mobile.
//   4. Rounded-2xl input fields with a pink focus ring (input-sakura).
//
// Phase A/B behaviour preserved verbatim: honeypot, submittingRef,
// online/offline events, sessionStorage progress, scrollIntoView on
// focus, HIBP debounce, server-error-code → field-hint mapping,
// safe-area-inset-bottom.

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntake } from '../../context/IntakeContext';
import { useAuth } from '../../context/AuthContext';
import GlassCard from '../ui/GlassCard';
import { motion, AnimatePresence } from 'framer-motion';
import BasicScene from '../three/BasicScene';
import { acceptTerms } from '../../services/consentApi';
import { TERMS_VERSION, TERMS_HREF, MINIMUM_AGE } from '../../config/legal';
import { checkUsernameAvailability, type UsernameCheckStatus } from '../../services/usernameAvailability';

// ---------------------------------------------------------------------------
// Constants — kept identical between client and server.
// ---------------------------------------------------------------------------
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 20;
const USERNAME_ALLOWED = /^[a-zA-Z0-9_]+$/;
// Strict-enough-for-progressive-disclosure email check. We require a
// real-looking TLD of 2+ letters (the previous `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
// matched `test@gmail.c` and would let the password card pop open while the
// user was still typing the dot-com). All current public TLDs are 2+
// alphabetic chars; emails like `test@host.co.uk` still pass because the
// FINAL segment is what we check. The server-side EMAIL_RE stays at the
// looser pattern so we don't accidentally reject obscure-but-real TLDs at
// account creation time — this stricter form only gates the next-field
// reveal in the UI.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
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
// HIBP k-anonymity breach check (unchanged from Phase B).
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

// ---------------------------------------------------------------------------
// RevealCard — progressive disclosure that PRESERVES the DOM.
//
// The original pre-Phase-A code rendered later steps with
// `currentStep >= index && <motion.div>...</motion.div>`. Mounting the
// password fields only after the user "earned" them broke iOS Keychain
// (which scans the form once when the user taps a field and needs all
// credential inputs present at scan time).
//
// This component keeps the children mounted in the DOM at all times.
// Visual progression is achieved by animating max-height + opacity
// from collapsed-with-overflow-hidden to expanded. autoComplete /
// name / type attributes on the inputs inside are unchanged, so iOS
// still classifies the form correctly.
//
// `maxHeightPx` is a generous upper bound — we don't measure the
// child's natural height because that would require a layout-observer
// dance for a result that adds nothing. The child can never exceed
// this value in our form.
// ---------------------------------------------------------------------------
interface RevealCardProps {
  show: boolean;
  delayIndex?: number;
  children: React.ReactNode;
}
const RevealCard: React.FC<RevealCardProps> = ({ show, delayIndex = 0, children }) => {
  return (
    <motion.div
      initial={false}
      animate={{
        maxHeight: show ? 900 : 0,
        opacity: show ? 1 : 0,
        marginTop: show ? '1.5rem' : 0,
        pointerEvents: show ? 'auto' : 'none',
      }}
      transition={{
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1],
        delay: show ? delayIndex * 0.05 : 0,
      }}
      style={{ overflow: 'hidden' }}
      // Critical: even when collapsed, the children stay in the DOM,
      // tab-reachable, and discoverable by autofill. `aria-hidden`
      // updates so screen readers don't announce a hidden card.
      aria-hidden={!show}
    >
      {children}
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Live username availability indicator.
//
// 'idle'     — empty or format-invalid (the format error is shown separately)
// 'checking' — request in flight (debounced)
// then one of the server-reported UsernameCheckStatus values.
// Neutral states ('idle' / 'unknown' / 'invalid') render nothing so we never
// hard-block on a flaky network — the submit-time server check is the backstop.
// ---------------------------------------------------------------------------
type UsernameFieldStatus = 'idle' | 'checking' | UsernameCheckStatus;

const UsernameAvailabilityHint: React.FC<{ status: UsernameFieldStatus }> = ({ status }) => {
  if (status === 'checking') {
    return (
      <p className="text-white/60 text-xs flex items-center justify-center gap-1.5" role="status" aria-live="polite">
        <span
          className="inline-block w-3 h-3 rounded-full border-2 border-white/30 border-t-white/70 animate-spin"
          aria-hidden="true"
        />
        <span>Checking availability…</span>
      </p>
    );
  }
  if (status === 'available') {
    return (
      <motion.p
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-pink-200 text-xs flex items-center justify-center space-x-1"
        role="status"
        aria-live="polite"
      >
        <span aria-hidden="true">✓</span>
        <span>Username is available</span>
      </motion.p>
    );
  }
  if (status === 'taken' || status === 'reserved') {
    return (
      <motion.p
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-red-400 text-xs flex items-center justify-center space-x-1"
        role="alert"
        aria-live="polite"
      >
        <span aria-hidden="true">✗</span>
        <span>{status === 'reserved' ? 'That username is reserved' : 'That username is taken'}</span>
      </motion.p>
    );
  }
  // idle / unknown / invalid → stay neutral.
  return null;
};

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
  // Live username availability (debounced server check). Public data, so we
  // surface it as the user types; see the effect + UsernameAvailabilityHint.
  const [usernameStatus, setUsernameStatus] = useState<UsernameFieldStatus>('idle');
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

  // Refs
  const usernameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef<boolean>(false);
  const hibpAbortRef = useRef<AbortController | null>(null);

  // ----- sessionStorage progress (hydrate + persist) ---------------------
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PROGRESS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { username?: string; email?: string };
      if (parsed?.username) setUsername(sanitizeUsername(parsed.username));
      if (parsed?.email) setEmail(sanitizeEmail(parsed.email));
    } catch { /* corrupt blob — ignore */ }
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(
        PROGRESS_STORAGE_KEY,
        JSON.stringify({ username, email })
      );
    } catch { /* private mode / quota — non-fatal */ }
  }, [username, email]);

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

  // ----- Real-time validation --------------------------------------------
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
  useEffect(() => {
    setBreachWarning(null);
    if (!password) return;
    if (password.length < PASSWORD_MIN_LENGTH) return;
    hibpAbortRef.current?.abort();
    const ctrl = new AbortController();
    hibpAbortRef.current = ctrl;
    const timer = setTimeout(async () => {
      const result = await checkPasswordBreached(password, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (!result) return;
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

  // ----- Live username availability (debounced + abortable) --------------
  // Only checks once the format is valid (format errors are surfaced via
  // validationErrors). Each keystroke aborts the prior in-flight request and
  // restarts the 450ms debounce, and the aborted-guard prevents a stale
  // response from overwriting a newer one. Any ambiguous outcome resolves to a
  // neutral state inside checkUsernameAvailability() — the authoritative check
  // is the submit-time USERNAME_TAKEN gate, so a flaky network never blocks.
  useEffect(() => {
    const formatValid =
      username.length >= USERNAME_MIN_LENGTH &&
      username.length <= USERNAME_MAX_LENGTH &&
      USERNAME_ALLOWED.test(username);

    if (!formatValid) {
      setUsernameStatus('idle');
      return;
    }

    setUsernameStatus('checking');
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const status = await checkUsernameAvailability(username, controller.signal);
      if (!controller.signal.aborted) setUsernameStatus(status);
    }, 450);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [username]);

  // ----- Step progression -------------------------------------------------
  // Drives the visual reveal. The step is a CASCADING gate: each rung
  // requires the previous rung to currently hold, and the step is
  // RECOMPUTED on every state change — not monotonic-max. That means
  // backing up and editing an earlier field collapses everything below
  // it again, which is what "do not display the next field until
  // requirements are met" actually demands. Without that, a user who
  // typed a valid email and then deleted half of it would still see the
  // password card hanging open.
  //
  // The rungs:
  //   step 1 — username valid                  ⇒ email card reveals
  //   step 2 — + email valid                   ⇒ password card reveals
  //   step 3 — + password valid                ⇒ confirm card reveals
  //   step 4 — + confirm matches password      ⇒ terms card reveals
  //   step 5 — + terms checkbox agreed         ⇒ submit button reveals
  //
  // Every input stays mounted in the DOM from first paint regardless of
  // step (see <RevealCard>) so iOS Keychain / 1Password can offer Strong
  // Password and autofill the whole form at once.
  useEffect(() => {
    let next = 0;
    if (username && !validationErrors.username) {
      next = 1;
      if (email && !validationErrors.email) {
        next = 2;
        if (password && !validationErrors.password) {
          next = 3;
          if (confirmPassword && password === confirmPassword) {
            next = 4;
            if (agreedToTerms) {
              next = 5;
            }
          }
        }
      }
    }
    if (next !== currentStep) setCurrentStep(next);
  }, [
    username, email, password, confirmPassword, agreedToTerms,
    validationErrors.username, validationErrors.email, validationErrors.password,
    currentStep,
  ]);

  // ----- All-fields-ready (drives the sakura glow on submit) -------------
  const allFieldsReady = useMemo(() => {
    return (
      username.length >= USERNAME_MIN_LENGTH &&
      !validationErrors.username &&
      // Block on a CONFIRMED unavailable username only. 'checking' / 'unknown'
      // stay enabled — the submit-time server check is the backstop, so we
      // never trap the user behind a slow or undeployed availability endpoint.
      usernameStatus !== 'taken' &&
      usernameStatus !== 'reserved' &&
      email.length > 0 &&
      EMAIL_RE.test(email) &&
      !validationErrors.email &&
      password.length >= PASSWORD_MIN_LENGTH &&
      !validationErrors.password &&
      confirmPassword.length > 0 &&
      password === confirmPassword &&
      agreedToTerms
    );
  }, [
    username,
    email,
    password,
    confirmPassword,
    agreedToTerms,
    usernameStatus,
    validationErrors.username,
    validationErrors.email,
    validationErrors.password,
  ]);

  // ----- Mobile-keyboard scroll helper -----------------------------------
  const scrollFieldIntoView = useCallback((el: HTMLElement | null) => {
    if (!el) return;
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

    if (honeypot.trim().length > 0) {
      setLoading(false);
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;

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
    } else if (usernameStatus === 'taken') {
      finalErrors.username = 'That username is taken. Please pick another.';
    } else if (usernameStatus === 'reserved') {
      finalErrors.username = 'That username is reserved. Please choose another.';
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
      void acceptTerms(TERMS_VERSION).catch(() => undefined);

      updateIntake({
        userRegistered: true,
        userLoggedIn: true,
        name: trimmedUsername,
      });

      try { sessionStorage.removeItem(PROGRESS_STORAGE_KEY); } catch { /* noop */ }

      setIsSuccess(true);
      setMessage('Registration successful!');
      setTimeout(() => navigate('/intake/visual'), 3500);
    } catch (err: any) {
      // The server speaks a structured error contract: { error, code, field }.
      // Consume it directly — `code` is the stable signal, `field` says which
      // input to flag, and `error` is the human-readable fallback. We also
      // tolerate the two legacy shapes (an Error whose only signal is the
      // message string, or the raw ApiError object under `details`) so the
      // inline hint renders no matter which layer threw.
      const code: string = err?.code || err?.details?.code || '';
      const field: string = err?.field || err?.details?.field || '';
      const serverMsg: string = err?.error || err?.details?.error || err?.message || '';
      const haystack = `${code} ${serverMsg}`; // regex fallback only

      let display = serverMsg || 'Registration failed. Please try again.';
      let focusField: 'username' | 'email' | 'password' | null = null;

      const emailExists =
        code === 'EMAIL_EXISTS' ||
        /EMAIL_EXISTS|EMAIL_ALREADY/i.test(haystack) ||
        (field === 'email' && /already|exists|registered/i.test(serverMsg));
      const usernameTaken =
        code === 'USERNAME_TAKEN' ||
        /USERNAME_TAKEN/i.test(haystack) ||
        (field === 'username' && /taken|already|exists/i.test(serverMsg));

      if (emailExists) {
        display = 'That email is already registered. Try logging in instead.';
        focusField = 'email';
        setValidationErrors((prev) => ({ ...prev, email: 'Email already registered' }));
      } else if (usernameTaken) {
        display = 'That username is taken. Please pick another.';
        focusField = 'username';
        setValidationErrors((prev) => ({ ...prev, username: 'Username already taken' }));
      } else if (code === 'DISPOSABLE_EMAIL' || /DISPOSABLE/i.test(haystack)) {
        display = 'Disposable email addresses are not supported. Please use your regular inbox.';
        focusField = 'email';
        setValidationErrors((prev) => ({ ...prev, email: 'Disposable inboxes are not supported' }));
      } else if (code === 'INVALID_EMAIL') {
        display = 'Please enter a valid email address.';
        focusField = 'email';
        setValidationErrors((prev) => ({ ...prev, email: 'Please enter a valid email address' }));
      } else if (code === 'INVALID_USERNAME') {
        display = `Username must be ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters: letters, numbers, underscores.`;
        focusField = 'username';
        setValidationErrors((prev) => ({ ...prev, username: 'Letters, numbers, and underscores only' }));
      } else if (code === 'WEAK_PASSWORD' || /weak[_ ]?password/i.test(haystack)) {
        display = 'Password rejected. Make sure it meets every requirement below.';
        focusField = 'password';
        setValidationErrors((prev) => ({ ...prev, password: 'Does not meet every requirement' }));
      } else if (err?.status === 429 || code === 'RATE_LIMIT' || /rate limit|RATE_LIMIT|\b429\b/i.test(haystack)) {
        // The server's message already carries "wait Ns" when it knows the
        // window; prefer it, else fall back to a generic cooldown notice.
        display = /wait/i.test(serverMsg)
          ? serverMsg
          : 'Too many attempts from this network. Please wait a minute and try again.';
      } else if (code === 'MISSING_FIELDS' || /MISSING_FIELDS/i.test(haystack)) {
        display = 'Some required fields were missing. Please review the form.';
        if (field === 'email' || field === 'username' || field === 'password') focusField = field;
      } else if (/network|fetch|failed to fetch/i.test(serverMsg)) {
        display = 'Network problem — check your connection and try again.';
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

  // Button class selection — drives the sakura glow when ready, idle
  // glass when not, muted-busy when in flight.
  const submitButtonClass = useMemo(() => {
    const base =
      'w-full py-4 text-lg font-semibold rounded-2xl transition-all duration-300 backdrop-blur-sm flex items-center justify-center gap-2';
    if (loading) return `${base} btn-sakura-busy`;
    if (!allFieldsReady || !online) return `${base} btn-sakura-idle`;
    return `${base} btn-sakura-ready`;
  }, [loading, allFieldsReady, online]);

  // Honeypot — see Phase B notes.
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
        {/* Outer GlassCard wrapper — same width constraints as
            Login.tsx so both auth surfaces look symmetric.
            Desktop maxWidth bumped ~25% (38vw → 48vw, 28rem →
            36rem cap) to give the form more presence on wide
            monitors; mobile minWidth unchanged. */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-md"
          style={{ minWidth: 'min(95vw, 380px)', maxWidth: 'min(48vw, 36rem)' }}
        >
          <GlassCard enhanced gradient className="space-y-6 rounded-[2rem]">
            {/* Header */}
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5 }}
              className="text-center space-y-4"
            >
              <div className="flex justify-center mt-4 mb-4">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-300 to-rose-400 flex items-center justify-center shadow-[0_0_24px_rgba(244,114,182,0.35)]"
                >
                  <span className="text-2xl">🌸</span>
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
                  className="p-3 rounded-2xl text-center text-sm bg-yellow-400/20 text-yellow-100 border border-yellow-400/30"
                  role="alert"
                >
                  You're offline. We'll re-enable the Create Account button once you're back online.
                </motion.div>
              )}
            </AnimatePresence>

            {/* Progress indicator */}
            <div className="field-card-shell glass-card-sakura p-4 rounded-3xl">
              <div className="mx-auto w-full max-w-[18rem]">
                <div className="flex justify-between text-sm text-white/70 mb-2">
                  <span>Progress</span>
                  <span>Step {Math.min(currentStep + 1, 4)} of 4</span>
                </div>
                <div className="w-full h-2 bg-white/15 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(Math.min(currentStep + 1, 4) / 4) * 100}%` }}
                    transition={{ duration: 0.5 }}
                    className="h-full rounded-full"
                    style={{
                      background: 'linear-gradient(90deg, #f9a8d4 0%, #f472b6 50%, #fb7185 100%)',
                      boxShadow: '0 0 12px rgba(244, 114, 182, 0.5)',
                    }}
                  />
                </div>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-0"
              autoComplete="on"
              noValidate
              aria-label="Create your Mirror account"
            >
              {/* Honeypot — hidden, off-spec name `nickname` so no autofill triggers. */}
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

              {/* --------- USERNAME (always visible — step 0) --------- */}
              <div className="field-card-shell glass-card-sakura p-5 rounded-3xl">
                <div className="flex flex-col items-center space-y-2 w-full">
                  <span className="text-2xl" aria-hidden="true">👤</span>

                  <div className="relative  max-w-[16rem]">
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
                        input-sakura w-full p-3 bg-white/10 border-2
                        text-white placeholder-white/50 text-center
                        focus:outline-none
                        ${validationErrors.username ? 'border-red-400' :
                          username && !validationErrors.username ? 'border-pink-300/70' : 'border-white/20'}
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
                    <UsernameAvailabilityHint status={usernameStatus} />
                  )}
                </div>

                <div id="reg-username-help" className="mt-3 p-3 bg-white/5 rounded-2xl mx-auto max-w-[18rem]">
                  <p className="text-white/70 text-xs mb-2 text-center">Requirements</p>
                  <ul className="space-y-1">
                    <li className="text-white/60 text-xs flex items-center justify-center space-x-2">
                      <span className="w-1 h-1 bg-pink-200/60 rounded-full"></span>
                      <span>{USERNAME_MIN_LENGTH}-{USERNAME_MAX_LENGTH} characters</span>
                    </li>
                    <li className="text-white/60 text-xs flex items-center justify-center space-x-2">
                      <span className="w-1 h-1 bg-pink-200/60 rounded-full"></span>
                      <span>Letters, numbers, underscores only</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* --------- EMAIL — appears once username is valid ---------
                  Children stay mounted at all times so iOS autofill sees
                  every credential input on first paint; the RevealCard
                  collapses the visual to zero height when not yet earned. */}
              <RevealCard show={currentStep >= 1} delayIndex={1}>
                <div className="field-card-shell glass-card-sakura p-5 rounded-3xl">
                  <div className="flex flex-col items-center space-y-2 w-full">
                    <span className="text-2xl" aria-hidden="true">📧</span>

                    <div className="relative  max-w-[16rem]">
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
                          input-sakura w-full p-3 bg-white/10 border-2
                          text-white placeholder-white/50 text-center
                          focus:outline-none
                          ${validationErrors.email ? 'border-red-400' :
                            email && !validationErrors.email ? 'border-pink-300/70' : 'border-white/20'}
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
                        className="text-pink-200 text-xs flex items-center justify-center space-x-1"
                      >
                        <span>✓</span>
                        <span>Looks good!</span>
                      </motion.p>
                    )}
                  </div>

                  <div id="reg-email-help" className="mt-3 p-3 bg-white/5 rounded-2xl mx-auto max-w-[18rem]">
                    <p className="text-white/70 text-xs mb-2 text-center">Requirements</p>
                    <ul className="space-y-1">
                      <li className="text-white/60 text-xs flex items-center justify-center space-x-2">
                        <span className="w-1 h-1 bg-pink-200/60 rounded-full"></span>
                        <span>Valid email format</span>
                      </li>
                      <li className="text-white/60 text-xs flex items-center justify-center space-x-2">
                        <span className="w-1 h-1 bg-pink-200/60 rounded-full"></span>
                        <span>Will be used for account recovery</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </RevealCard>

              {/* --------- PASSWORD — appears once email is valid --------- */}
              <RevealCard show={currentStep >= 2} delayIndex={2}>
                <div className="field-card-shell glass-card-sakura p-5 rounded-3xl">
                  <div className="flex flex-col items-center space-y-2 w-full">
                    <span className="text-2xl" aria-hidden="true">🔒</span>

                    <div className="relative  max-w-[16rem]">
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
                          input-sakura w-full p-3 pr-10 bg-white/10 border-2
                          text-white placeholder-white/50 text-center
                          focus:outline-none
                          ${validationErrors.password ? 'border-red-400' :
                            password && !validationErrors.password ? 'border-pink-300/70' : 'border-white/20'}
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
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-pink-200 transition-colors"
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
                        className="text-pink-200 text-xs flex items-center justify-center space-x-1"
                      >
                        <span>✓</span>
                        <span>Looks good!</span>
                      </motion.p>
                    )}
                  </div>

                  <div id="reg-password-help" className="mt-3 p-3 bg-white/5 rounded-2xl mx-auto max-w-[18rem]">
                    <p className="text-white/70 text-xs mb-2 text-center">Requirements</p>
                    <ul className="space-y-1">
                      <li className="text-white/60 text-xs flex items-center justify-center space-x-2">
                        <span className="w-1 h-1 bg-pink-200/60 rounded-full"></span>
                        <span>At least {PASSWORD_MIN_LENGTH} characters</span>
                      </li>
                      <li className="text-white/60 text-xs flex items-center justify-center space-x-2">
                        <span className="w-1 h-1 bg-pink-200/60 rounded-full"></span>
                        <span>One uppercase letter</span>
                      </li>
                      <li className="text-white/60 text-xs flex items-center justify-center space-x-2">
                        <span className="w-1 h-1 bg-pink-200/60 rounded-full"></span>
                        <span>One lowercase letter</span>
                      </li>
                      <li className="text-white/60 text-xs flex items-center justify-center space-x-2">
                        <span className="w-1 h-1 bg-pink-200/60 rounded-full"></span>
                        <span>One number</span>
                      </li>
                      <li className="text-white/60 text-xs flex items-center justify-center space-x-2">
                        <span className="w-1 h-1 bg-pink-200/60 rounded-full"></span>
                        <span>One symbol (any non-letter / non-digit)</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </RevealCard>

              {/* HIBP breach warning — only renders when meaningful + visible. */}
              <AnimatePresence>
                {breachWarning && password && !validationErrors.password && currentStep >= 2 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, marginTop: 0 }}
                    animate={{ opacity: 1, y: 0, marginTop: '1.5rem' }}
                    exit={{ opacity: 0, y: -10, marginTop: 0 }}
                    className="p-3 rounded-2xl text-center text-xs bg-amber-400/20 text-amber-100 border border-amber-400/30"
                    role="status"
                    aria-live="polite"
                  >
                    {breachWarning}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Password strength meter — sakura-tinted, appears with password */}
              <AnimatePresence>
                {password && currentStep >= 2 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, marginTop: 0 }}
                    animate={{ opacity: 1, y: 0, marginTop: '1.5rem' }}
                    exit={{ opacity: 0, y: -10, marginTop: 0 }}
                    className="field-card-shell glass-card-sakura p-4 rounded-3xl"
                  >
                    <div className="mx-auto w-full max-w-[18rem]">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-white/80 text-sm">Password Strength</span>
                        <span className={`text-sm font-medium bg-gradient-to-r ${getPasswordStrengthColor()} bg-clip-text text-transparent`}>
                          {getPasswordStrengthText()}
                        </span>
                      </div>

                      <div className="w-full h-2 bg-white/15 rounded-full overflow-hidden mb-3">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(passwordStrength / 5) * 100}%` }}
                          transition={{ duration: 0.5 }}
                          className={`h-full bg-gradient-to-r ${getPasswordStrengthColor()} rounded-full`}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        {Object.entries(passwordCriteria).map(([key, met]) => (
                          <div key={key} className={`flex items-center space-x-2 ${met ? 'text-pink-200' : 'text-white/40'}`}>
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
              </AnimatePresence>

              {/* --------- CONFIRM PASSWORD — appears once password is valid --------- */}
              <RevealCard show={currentStep >= 3} delayIndex={3}>
                <div className="field-card-shell glass-card-sakura p-5 rounded-3xl">
                  <div className="flex flex-col items-center space-y-2 w-full">
                    <span className="text-2xl" aria-hidden="true">🔑</span>

                    <div className="relative  max-w-[16rem]">
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
                          input-sakura w-full p-3 pr-10 bg-white/10 border-2
                          text-white placeholder-white/50 text-center
                          focus:outline-none
                          ${confirmPassword && password !== confirmPassword ? 'border-red-400' :
                            confirmPassword && password === confirmPassword ? 'border-pink-300/70' : 'border-white/20'}
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
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-pink-200 transition-colors"
                        style={{borderRadius:'1rem'}}
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
                          password === confirmPassword ? 'text-pink-200' : 'text-red-400'
                        }`}
                        role={password === confirmPassword ? undefined : 'alert'}
                        aria-live="polite"
                      >
                        <span>{password === confirmPassword ? '✓' : '✗'}</span>
                        <span>{password === confirmPassword ? 'Passwords match' : 'Passwords do not match'}</span>
                      </motion.p>
                    )}
                  </div>
                </div>
              </RevealCard>

              {/* --------- TERMS — appears once confirm matches password --------- */}
              <RevealCard show={currentStep >= 4} delayIndex={4}>
                <div className="field-card-shell glass-card-sakura p-5 rounded-3xl">
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
                      className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded-md border-2 border-white/30 bg-white/10 accent-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-300/50"
                      disabled={loading}
                      aria-invalid={!!validationErrors.terms}
                    />
                    <span className="leading-relaxed">
                      I am at least {MINIMUM_AGE} years old and I agree to the{' '}
                      <a
                        href={TERMS_HREF}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-pink-200 underline hover:text-pink-100"
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
                </div>
              </RevealCard>

              {/* --------- SUBMIT — appears once the terms checkbox is ticked ---------
                  px-3 keeps the ready-state halo inside the GlassCard's
                  padding so the bloom doesn't spill out onto the page
                  background. paddingBottom carries the iOS safe-area inset. */}
              <RevealCard show={currentStep >= 5} delayIndex={5}>
                <div className="px-3" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                  <button
                    type="submit"
                    disabled={loading || !online || !allFieldsReady}
                    className={submitButtonClass}
                    aria-busy={loading}
                  >
                    {loading ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="w-5 h-5 border-2 border-rose-300/40 border-t-rose-700 rounded-full"
                        />
                        <span>Creating Account...</span>
                      </>
                    ) : (
                      <>
                        <span>🌸</span>
                        <span>Create Account</span>
                      </>
                    )}
                  </button>
                </div>
              </RevealCard>

              {/* --------- BANNER MESSAGE --------- */}
              <AnimatePresence>
                {message && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8, marginTop: 0 }}
                    animate={{ opacity: 1, scale: 1, marginTop: '1.5rem' }}
                    exit={{ opacity: 0, scale: 0.8, marginTop: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`
                      p-4 rounded-2xl text-center font-medium
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
              style={{ border: 'none' }}
            >
              <p className="text-white/60 text-sm">
                Already have an account?{' '}
                <button
                  onClick={() => navigate('/login')}
                  className="link-mono"
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