// src/components/intake/VisualStep.tsx
// REBUILT (intake hardening — Goal #1: Visual step)
//
// What changed and why
// ─────────────────────────────────────────────────────────────────────────
// 1. Photo intake is upload-only (no camera capture).
//      - The original in-browser getUserMedia <video>/<canvas> capture path was
//        fragile (black-screen on mobile WebKit, double-stream races, gesture
//        timing) and was removed.
//      - A later native-camera "Take Photo" tile (a file <input capture="user">)
//        was ALSO removed: it was gated on UA-based device detection that
//        rendered inconsistently ("sometimes it shows, sometimes it doesn't")
//        and offered nothing over picking a library photo — which on iOS also
//        transcodes HEIC → JPEG automatically on selection.
//      - All users (mobile + desktop) now upload a file through one reliable
//        chooser, with no native webcam/camera dependency.
//
// 2. Fixed "some photos never auto-analyze".
//      - The <img> now has an explicit onError handler. Previously, an image
//        the browser could not decode (HEIC on Chrome/Firefox, truncated
//        files) silently never fired 'load', so analysis silently stalled and
//        even the manual "Analyze" button bailed (naturalWidth === 0). Now we
//        surface a clear, actionable error and let the user pick another file.
//      - Accepted types are aligned with the backend (JPEG/PNG/WebP). HEIC is
//        detected up-front with friendly guidance instead of a silent failure.
//      - An analysis watchdog clears any stuck "Analyzing…" state after 20s.
//
// 3. Fixed "analysis succeeds but Continue does not show".
//      - qualityScore now reads the public detection.score (with _score as a
//        fallback) so it is never NaN/undefined.
//      - The action area auto-scrolls into view once analysis completes — the
//        Continue button was previously pushed below the fold inside the
//        max-h-[85vh] scroll container.
//
// 4. Facial analysis is REQUIRED — there is no skip path.
//      - When detection fails, the user gets a "Try Again" action plus an
//        actionable tips panel (lighting, framing, remove glasses, …) to help
//        them capture a usable photo.
//      - If the analysis engine fails to load, it is recoverable: a "Retry"
//        button re-loads the models in place (useFaceApi.reload()) without a
//        full page refresh; the user still cannot continue until analysis
//        succeeds.
//
// 5. Robustness / UX / a11y.
//      - Photo can be selected while the analysis engine is still loading;
//        analysis runs automatically once the model is ready.
//      - Buttons carry aria-labels; inputs reset value so re-selecting the
//        same file still fires onChange.

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useIntake } from '../../context/IntakeContext';
import { useFaceApi } from '../../hooks/useFaceApi';
import GlassCard, { GlassButton, GlassProgress } from '../ui/GlassCard';
import { motion, AnimatePresence } from 'framer-motion';
import BasicScene from '../three/BasicScene';

// ============================================================================
// CONSTANTS
// ============================================================================
// Keep in lockstep with SubmitStep ALLOWED_IMAGE_TYPES and the backend.
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXT_RE = /\.(jpe?g|png|webp)$/i;
const HEIC_RE = /\.(heic|heif)$/i;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10MB (matches SubmitStep)
const MIN_PHOTO_BYTES = 1024;             // reject empty/corrupt files
const ANALYSIS_WATCHDOG_MS = 20000;       // clear stuck "Analyzing…" state

// Actionable guidance shown when face detection fails. Facial analysis is
// required to continue, so the goal is to help the user get a usable photo.
const FACE_TIPS = [
  'Make sure your whole face is visible and centered in the frame',
  'Use bright, even lighting — face a window or lamp, avoid backlight',
  'Remove sunglasses, hats, or anything covering your face',
  'Hold the camera at eye level, about an arm’s length away',
  'Keep a fairly neutral, forward-facing pose',
];

// ============================================================================
// TYPES
// ============================================================================
interface CaptureState {
  source: 'upload' | 'camera' | null;
  preview: string | null;
  hasPhoto: boolean;
  error: string | null;
}

interface AnalysisState {
  isAnalyzing: boolean;
  hasAnalysis: boolean;
  error: string | null;
  results: any;
  retryCount: number;
  qualityScore: number;
}

// ============================================================================
// DEVICE DETECTION
// ============================================================================
function detectDeviceInfo() {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isAndroid = /Android/.test(ua);
  const isMobile = isIOS || isAndroid || /Mobile|webOS|BlackBerry|Opera Mini|IEMobile/.test(ua);
  return { isIOS, isAndroid, isMobile };
}

// ============================================================================
// FILE VALIDATION (security + clear UX errors)
// ============================================================================
function validateImageFile(file: File): string | null {
  const nameLower = (file.name || '').toLowerCase();

  if (HEIC_RE.test(nameLower) || file.type === 'image/heic' || file.type === 'image/heif') {
    return 'HEIC/HEIF photos aren’t supported directly. On iPhone, choosing the photo from your library usually converts it to JPEG automatically — otherwise set Camera → Formats → "Most Compatible", or pick a JPEG/PNG.';
  }

  const typeOk = ALLOWED_IMAGE_TYPES.includes(file.type);
  const extOk = ALLOWED_EXT_RE.test(nameLower);
  // Some platforms report an empty MIME type — accept if the extension is valid.
  if (!typeOk && !(file.type === '' && extOk)) {
    return 'Please choose a JPEG, PNG, or WebP image.';
  }

  if (file.size > MAX_PHOTO_BYTES) {
    return 'Image is too large. Maximum size is 10 MB.';
  }
  if (file.size < MIN_PHOTO_BYTES) {
    return 'That file looks empty or corrupted. Please choose another photo.';
  }
  return null;
}

// ============================================================================
// SVG ICONS
// ============================================================================
const UploadIcon = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
  </svg>
);

const RefreshIconSmall = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356m-.001 5.043l-3.181-3.182a8.25 8.25 0 00-11.667 0L3.985 8.4m0 0H8.97m-4.985 0V4.356m0 9.292l3.181 3.182a8.25 8.25 0 0011.667 0l2.181-2.183m0 0h-4.985m4.985 0v4.992" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const AlertIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg className="w-4 h-4" style={{ maxHeight: '50px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

// ============================================================================
// ANALYSIS METRICS PANEL (glass-styled)
// ============================================================================
const EXPRESSION_META: Record<string, { label: string; color: string; glow: string }> = {
  neutral:   { label: 'Neutral',   color: '#94a3b8', glow: 'rgba(148,163,184,0.35)' },
  happy:     { label: 'Happy',     color: '#4ade80', glow: 'rgba(74,222,128,0.35)' },
  sad:       { label: 'Sad',       color: '#60a5fa', glow: 'rgba(96,165,250,0.35)' },
  angry:     { label: 'Angry',     color: '#f87171', glow: 'rgba(248,113,113,0.35)' },
  fearful:   { label: 'Fearful',   color: '#c084fc', glow: 'rgba(192,132,252,0.35)' },
  disgusted: { label: 'Disgusted', color: '#fb923c', glow: 'rgba(251,146,60,0.35)' },
  surprised: { label: 'Surprised', color: '#facc15', glow: 'rgba(250,204,21,0.35)' },
};

const AnalysisMetrics: React.FC<{ results: any; qualityScore: number }> = ({ results, qualityScore }) => {
  const expressions: Record<string, number> = results?.expressions || {};
  const qualityLabel = qualityScore >= 80 ? 'Excellent' : qualityScore >= 60 ? 'Good' : qualityScore >= 40 ? 'Fair' : 'Poor';
  const ringColor = qualityScore >= 80 ? '#4ade80' : qualityScore >= 60 ? '#facc15' : qualityScore >= 40 ? '#fb923c' : '#f87171';
  const ringGlow = qualityScore >= 80 ? 'rgba(74,222,128,0.4)' : qualityScore >= 60 ? 'rgba(250,204,21,0.4)' : qualityScore >= 40 ? 'rgba(251,146,60,0.4)' : 'rgba(248,113,113,0.4)';

  const sorted = Object.entries(expressions)
    .filter(([key]) => key in EXPRESSION_META)
    .sort(([, a], [, b]) => b - a);

  const dominant = sorted[0];
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (qualityScore / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-card-enhanced"
      style={{ padding: 16, borderRadius: 16 }}
    >
      {/* Header row: quality ring + labels + dominant */}
      <div className="flex items-center gap-3 mb-4">
        <div style={{ width: 52, height: 52, position: 'relative', flexShrink: 0 }}>
          <svg width="52" height="52" viewBox="0 0 52 52" style={{ transform: 'rotate(-90deg)', display: 'block' }}>
            <circle cx="26" cy="26" r={radius} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3.5" />
            <circle
              cx="26" cy="26" r={radius} fill="none"
              stroke={ringColor} strokeWidth="3.5" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 0.8s ease', filter: `drop-shadow(0 0 6px ${ringGlow})` }}
            />
          </svg>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="glass-card-text" style={{ fontSize: 15, fontWeight: 700, margin: 0, color: ringColor }}>{qualityScore}</span>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="glass-card-text" style={{ fontSize: 14, fontWeight: 600, margin: 0, color: ringColor }}>{qualityLabel}</p>
          <p className="glass-card-text" style={{ fontSize: 11, margin: 0, opacity: 0.6 }}>Detection confidence</p>
        </div>
        {dominant && (
          <div
            className="glass-card-enhanced"
            style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 12, borderLeft: `3px solid ${EXPRESSION_META[dominant[0]].color}`, textAlign: 'center' }}
          >
            <p className="glass-card-text" style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{EXPRESSION_META[dominant[0]].label}</p>
            <p className="glass-card-text" style={{ fontSize: 10, margin: 0, opacity: 0.5 }}>Dominant</p>
          </div>
        )}
      </div>

      {/* Expression bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.map(([key, value], i) => {
          const meta = EXPRESSION_META[key];
          const pct = Math.round(value * 100);
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.25 }}
              style={{ display: 'flex', alignItems: 'center', gap: 10 }}
            >
              <span className="glass-card-text" style={{ fontSize: 11, width: 68, textAlign: 'right', flexShrink: 0, margin: 0, opacity: 0.7 }}>
                {meta.label}
              </span>
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(pct, 1)}%` }}
                  transition={{ delay: 0.1 + i * 0.04, duration: 0.5, ease: 'easeOut' }}
                  style={{
                    height: '100%',
                    borderRadius: 3,
                    background: `linear-gradient(90deg, ${meta.color}99, ${meta.color})`,
                    boxShadow: pct > 5 ? `0 0 8px ${meta.glow}, 0 0 2px ${meta.color}` : 'none',
                  }}
                />
              </div>
              <span className="glass-card-text" style={{ fontSize: 11, fontWeight: 600, width: 34, textAlign: 'right', flexShrink: 0, margin: 0, fontFamily: 'monospace' }}>
                {pct}%
              </span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

// ============================================================================
// BANNERS
// ============================================================================
const ErrorBanner: React.FC<{ message: string }> = ({ message }) => (
  <motion.div
    initial={{ opacity: 0, y: -5 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -5 }}
    className="flex items-start justify-center gap-2 p-3 bg-red-500/10 border border-red-400/20 rounded-lg text-center"
    style={{border:'none'}}
    role="alert"
  >
    <div className="text-red-400 mt-0.5"><AlertIcon /></div>
    <p className="text-red-100/90 text-xs">{message}</p>
  </motion.div>
);

const SuggestionsPanel: React.FC = () => (
  <motion.div
    initial={{ opacity: 0, y: -4 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -4 }}
    className="glass-card text-left"
    style={{ padding: 12, borderRadius: 12 }}
  >
    <p className="glass-card-text" style={{ fontSize: 12, fontWeight: 600, margin: 0, marginBottom: 6 }}>
      Tips for a successful scan
    </p>
    <ul style={{ margin: 0, paddingLeft: 16, listStyleType: 'disc' }}>
      {FACE_TIPS.map((tip, i) => (
        <li key={i} className="glass-card-text" style={{ fontSize: 11, opacity: 0.7, lineHeight: 1.5 }}>
          {tip}
        </li>
      ))}
    </ul>
  </motion.div>
);

// ============================================================================
// VISUAL STEP COMPONENT
// ============================================================================
const VisualStep: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { updateIntake, markStepComplete } = useIntake();
  const { isModelLoaded, loadingError, loadingProgress, analyzeImage, reload } = useFaceApi();

  // Fix-mode support (coming from SubmitStep to re-do photo)
  const fixMode = (location.state as any)?.fixMode === true;
  const returnTo = (location.state as any)?.returnTo || '/intake/vocal';

  // Refs
  const imgRef = useRef<HTMLImageElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const actionAreaRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const isAnalyzingRef = useRef(false);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Callback ref: triggers re-render when <img> mounts so the auto-analysis
  // effect can fire after AnimatePresence mode="wait" enters.
  const [imgMounted, setImgMounted] = useState(false);
  const imgCallbackRef = useCallback((node: HTMLImageElement | null) => {
    imgRef.current = node;
    setImgMounted(!!node);
  }, []);

  // Device info (stable, computed once)
  const [device] = useState(() => detectDeviceInfo());

  // State
  const [captureState, setCaptureState] = useState<CaptureState>({
    source: null,
    preview: null,
    hasPhoto: false,
    error: null,
  });

  const [analysisState, setAnalysisState] = useState<AnalysisState>({
    isAnalyzing: false,
    hasAnalysis: false,
    error: null,
    results: null,
    retryCount: 0,
    qualityScore: 0,
  });

  // Persist last step
  useEffect(() => {
    try { localStorage.setItem('mirror:intake:lastStep', 'visual'); } catch { /* storage unavailable */ }
  }, []);

  // ============================================================================
  // CLEANUP
  // ============================================================================
  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearWatchdog();
    };
  }, [clearWatchdog]);

  // Revoke object URL when preview changes / on unmount (prevents memory leaks)
  useEffect(() => {
    const url = captureState.preview;
    return () => {
      if (url && url.startsWith('blob:')) {
        try { URL.revokeObjectURL(url); } catch { /* noop */ }
      }
    };
  }, [captureState.preview]);

  // ============================================================================
  // FACE ANALYSIS
  // ============================================================================
  const analyzePhoto = useCallback(async () => {
    // Use a ref to avoid stale-closure reads of analysisState.isAnalyzing
    if (isAnalyzingRef.current) return;
    if (!imgRef.current || !isModelLoaded) return;
    if (!imgRef.current.complete || imgRef.current.naturalWidth === 0) return;

    isAnalyzingRef.current = true;
    setAnalysisState(prev => ({ ...prev, isAnalyzing: true, error: null }));

    // Watchdog: never let the UI hang on "Analyzing…" forever.
    clearWatchdog();
    watchdogRef.current = setTimeout(() => {
      if (mountedRef.current && isAnalyzingRef.current) {
        isAnalyzingRef.current = false;
        setAnalysisState(prev => ({
          ...prev,
          isAnalyzing: false,
          hasAnalysis: false,
          error: 'Analysis timed out. Please tap "Analyze Photo" to retry, or choose a different image.',
          retryCount: prev.retryCount + 1,
        }));
      }
    }, ANALYSIS_WATCHDOG_MS);

    try {
      const result = await analyzeImage(imgRef.current);

      if (!result?.expressions) {
        throw new Error('No face detected. Please use a clear, well-lit photo that shows your whole face.');
      }

      // Public getter is `score`; `_score` is the private fallback.
      const rawScore =
        (result as any)?.detection?.score ??
        (result as any)?.detection?._score ??
        0;
      const qualityScore = Math.round(Math.max(0, Math.min(1, Number(rawScore) || 0)) * 100);

      clearWatchdog();
      if (mountedRef.current) {
        isAnalyzingRef.current = false;
        setAnalysisState({
          isAnalyzing: false,
          hasAnalysis: true,
          results: result,
          qualityScore,
          error: null,
          retryCount: 0,
        });
        updateIntake({ faceAnalysis: result });
      }
    } catch (err: any) {
      clearWatchdog();
      if (mountedRef.current) {
        isAnalyzingRef.current = false;
        setAnalysisState(prev => ({
          ...prev,
          isAnalyzing: false,
          hasAnalysis: false,
          error: err?.message || 'Analysis failed. Please try a different photo.',
          retryCount: prev.retryCount + 1,
        }));
      }
    }
  }, [analyzeImage, isModelLoaded, updateIntake, clearWatchdog]);

  // Auto-trigger analysis after React mounts the <img> with the new photo.
  // Solves the race where setCaptureState({ hasPhoto: true }) is async, so
  // imgRef.current is null when the imperative onload would attach. By the time
  // this effect fires, React has re-rendered and imgRef.current is valid.
  useEffect(() => {
    if (!captureState.hasPhoto || !captureState.preview) return;
    if (isAnalyzingRef.current || analysisState.hasAnalysis) return;
    if (!isModelLoaded) return; // re-runs when the model finishes loading (deps)

    const img = imgRef.current;
    if (!img) return;

    // Image already decoded (cached / fast blob URL)
    if (img.complete && img.naturalWidth > 0) {
      const timer = setTimeout(() => {
        if (mountedRef.current && !isAnalyzingRef.current) analyzePhoto();
      }, 250);
      return () => clearTimeout(timer);
    }
    // Otherwise the <img> onLoad handler (below) will kick off analysis.
  }, [
    captureState.hasPhoto,
    captureState.preview,
    analysisState.hasAnalysis,
    isModelLoaded,
    analyzePhoto,
    imgMounted,
  ]);

  // Auto-scroll the action area into view once analysis completes — the
  // Continue button can otherwise sit below the fold inside the scroll card.
  useEffect(() => {
    if (analysisState.hasAnalysis && actionAreaRef.current) {
      const t = setTimeout(() => {
        try {
          actionAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch { /* older browsers */ }
      }, 300);
      return () => clearTimeout(t);
    }
  }, [analysisState.hasAnalysis]);

  // ============================================================================
  // IMAGE LOAD / ERROR (decode handling — fixes silent "never analyzes")
  // ============================================================================
  const handleImgLoad = useCallback(() => {
    if (!mountedRef.current) return;
    if (analysisState.hasAnalysis) return;
    if (isAnalyzingRef.current || !isModelLoaded) return;
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setTimeout(() => {
        if (mountedRef.current && !isAnalyzingRef.current) analyzePhoto();
      }, 250);
    }
  }, [analysisState.hasAnalysis, isModelLoaded, analyzePhoto]);

  const handleImgError = useCallback(() => {
    if (!mountedRef.current) return;
    clearWatchdog();
    isAnalyzingRef.current = false;
    setCaptureState(prev => ({
      ...prev,
      source: null,
      hasPhoto: false,
      preview: null,
      error: 'We could not read that image. It may be a HEIC/HEIF or corrupted file. Please choose a JPEG, PNG, or WebP photo.',
    }));
    setAnalysisState({
      isAnalyzing: false, hasAnalysis: false, error: null,
      results: null, retryCount: 0, qualityScore: 0,
    });
    updateIntake({ photo: undefined, faceAnalysis: undefined });
  }, [clearWatchdog, updateIntake]);

  // ============================================================================
  // FILE INTAKE (photo upload)
  // ============================================================================
  const acceptFile = useCallback((file: File, source: 'upload' | 'camera') => {
    const validationError = validateImageFile(file);
    if (validationError) {
      setCaptureState(prev => ({ ...prev, error: validationError }));
      return;
    }

    // Revoke any previous blob URL before replacing.
    setCaptureState(prev => {
      if (prev.preview && prev.preview.startsWith('blob:')) {
        try { URL.revokeObjectURL(prev.preview); } catch { /* noop */ }
      }
      return prev;
    });

    clearWatchdog();
    isAnalyzingRef.current = false;
    const preview = URL.createObjectURL(file);
    setCaptureState({ source, preview, hasPhoto: true, error: null });
    setAnalysisState({
      isAnalyzing: false, hasAnalysis: false, error: null,
      results: null, retryCount: 0, qualityScore: 0,
    });
    updateIntake({ photo: file, faceAnalysis: undefined });
    // Analysis auto-triggers via the effect / <img> onLoad once decoded.
  }, [clearWatchdog, updateIntake]);

  const onUploadChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so picking the same file again still fires onChange.
    event.target.value = '';
    if (file) acceptFile(file, 'upload');
  }, [acceptFile]);

  // ============================================================================
  // RESET / NAVIGATION
  // ============================================================================
  const startOver = useCallback(() => {
    clearWatchdog();
    isAnalyzingRef.current = false;
    setCaptureState(prev => {
      if (prev.preview && prev.preview.startsWith('blob:')) {
        try { URL.revokeObjectURL(prev.preview); } catch { /* noop */ }
      }
      return { source: null, preview: null, hasPhoto: false, error: null };
    });
    setAnalysisState({
      isAnalyzing: false, hasAnalysis: false, error: null,
      results: null, retryCount: 0, qualityScore: 0,
    });
    updateIntake({ photo: undefined, faceAnalysis: undefined });
    if (uploadInputRef.current) uploadInputRef.current.value = '';
  }, [clearWatchdog, updateIntake]);

  // Facial analysis is REQUIRED — handleNext only advances once a face has
  // been successfully analyzed. There is intentionally no skip path.
  const handleNext = useCallback(() => {
    if (!captureState.hasPhoto) {
      setCaptureState(prev => ({ ...prev, error: 'Please add a photo before continuing.' }));
      return;
    }
    if (!analysisState.hasAnalysis) {
      setAnalysisState(prev => ({ ...prev, error: 'Face analysis must complete before continuing.' }));
      return;
    }

    markStepComplete('VisualStep', {
      hasPhoto: captureState.hasPhoto,
      hasAnalysis: true,
      qualityScore: analysisState.qualityScore,
    });

    if (fixMode && returnTo) {
      navigate(returnTo, { replace: true });
    } else {
      navigate('/intake/vocal');
    }
  }, [
    captureState.hasPhoto,
    analysisState.hasAnalysis,
    analysisState.qualityScore,
    markStepComplete,
    navigate,
    fixMode,
    returnTo,
  ]);

  // ============================================================================
  // COMPUTED
  // ============================================================================
  const progressValue: number = (() => {
    const val = loadingProgress as unknown;
    if (typeof val === 'number' && Number.isFinite(val)) return Math.max(0, Math.min(100, val));
    if (typeof val === 'string') {
      const match = val.match(/(\d{1,3})\s*%/);
      if (match) return Math.max(0, Math.min(100, parseInt(match[1], 10)));
      if (val.toLowerCase().includes('ready')) return 100;
    }
    return 0;
  })();

  const showMethodPicker = !captureState.hasPhoto;
  const engineFailed = !!loadingError && !isModelLoaded;
  // Show actionable tips once an analysis attempt has failed.
  const showTips = captureState.hasPhoto && !analysisState.hasAnalysis && analysisState.retryCount >= 1 && !analysisState.isAnalyzing;

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* 3D Background */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <BasicScene />
      </div>

      {/* Gradient overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ duration: 1.5 }}
        className="absolute inset-0 bg-gradient-to-br from-cyan-100/50 via-teal-50/30 to-blue-100/50 pointer-events-none"
      />

      {/* Main content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl"
        >
          <div style={{ borderRadius: 24, boxShadow: 'rgba(0, 0, 0, 0.15) 0px 8px 40px, rgba(255, 255, 255, 0.18) 0px 1px 0px inset', overflow: 'hidden', margin: 40 }}>
          <GlassCard enhanced gradient className="text-center space-y-6 max-h-[85vh] overflow-y-auto overflow-x-hidden">
            <div className="space-y-6">

              {/* Header */}
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">Visual Analysis</h2>
                <p className="text-white/70 text-sm">Add a clear, front-facing photo for facial analysis</p>
              </div>

              {/* Analysis engine loading */}
              <AnimatePresence>
                {!isModelLoaded && !loadingError && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="glass-card-enhanced p-5 rounded-xl"
                  >
                    <div className="flex items-center justify-center space-x-4">
                      <div className="animate-spin rounded-full h-7 w-7 border-2 border-white/20 border-t-white" />
                      <div className="text-left">
                        <p className="text-white font-medium text-sm">Loading analysis engine</p>
                        <GlassProgress value={progressValue} max={100} className="w-48 mt-2" />
                        <p className="text-white/50 text-xs mt-1">{progressValue}% · you can pick a photo now</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Engine failed to load — recoverable, not a dead-end */}
              {engineFailed && (
                <div className="glass-card-enhanced bg-amber-500/10 border-amber-400/30 p-4 rounded-xl text-left">
                  <p className="text-amber-100 text-sm font-medium">Analysis engine didn’t load</p>
                  <p className="text-amber-100/70 text-xs mt-1">
                    We couldn’t load the on-device analysis engine ({String(loadingError)}). Check your connection
                    and try again — facial analysis is required to continue.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <GlassButton
                      onClick={reload}
                      aria-label="Retry loading the analysis engine"
                      className="bg-white/10 hover:bg-white/20 text-xs py-1.5 px-3"
                    >
                      <span className="flex items-center gap-1.5"><RefreshIconSmall /><span>Retry</span></span>
                    </GlassButton>
                    <GlassButton
                      onClick={() => window.location.reload()}
                      aria-label="Reload the page"
                      className="bg-white/5 hover:bg-white/10 text-xs py-1.5 px-3"
                    >
                      Reload page
                    </GlassButton>
                  </div>
                </div>
              )}

              {/* Method picker */}
              {showMethodPicker && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  {/* Single, reliable intake path: upload from the device.
                      The native-camera "Take Photo" tile was removed — it was
                      gated on flaky UA-based device detection (hence the
                      "sometimes it shows, sometimes it doesn't" behavior) and
                      offered no capability over picking a library photo, which
                      on iOS also transcodes HEIC → JPEG automatically. */}
                  <div className="grid grid-cols-1 gap-3">
                    {/* Upload */}
                    <button
                      type="button"
                      onClick={() => uploadInputRef.current?.click()}
                      aria-label="Upload a photo from your device"
                      className="enhanced-glass-card group relative text-center"
                      style={{ padding: 20, borderRadius: 16, cursor: 'pointer', marginBottom: 0 }}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className="text-white/70 group-hover:text-white transition-colors">
                          <UploadIcon />
                        </div>
                        <div>
                          <p className="glass-card-text" style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Upload a photo</p>
                          <p className="glass-card-text" style={{ fontSize: 12, margin: 0, opacity: 0.5 }}>
                            {device.isMobile ? 'From your photo library' : 'JPEG, PNG, or WebP'}
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Errors */}
                  <AnimatePresence>
                    {captureState.error && <ErrorBanner message={captureState.error} />}
                  </AnimatePresence>

                  {/* Tips */}
                  <div className="glass-card" style={{ padding: 12, borderRadius: 12 }}>
                    <p className="glass-card-text" style={{ fontSize: 12, margin: 0, opacity: 0.6, lineHeight: 1.5 }}>
                      For best results: good lighting, face the camera directly, neutral expression, no sunglasses.
                      {device.isIOS && ' iPhone HEIC photos are converted to JPEG automatically when you upload from your library.'}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Photo preview + analysis */}
              <AnimatePresence mode="wait">
                {captureState.hasPhoto && (
                  <motion.div
                    key="preview"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    {/* Photo */}
                    <div className="relative rounded-xl overflow-hidden mx-auto" style={{ maxWidth: 320 }}>
                      <img
                        ref={imgCallbackRef}
                        src={captureState.preview || undefined}
                        alt="Your selected photo"
                        onLoad={handleImgLoad}
                        onError={handleImgError}
                        className="w-full block rounded-xl"
                        style={{
                          display: captureState.preview ? 'block' : 'none',
                          objectFit: 'cover',
                          maxHeight: 320,
                        }}
                      />
                      {analysisState.isAnalyzing && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
                          <div className="flex items-center gap-2 bg-black/60 px-4 py-2 rounded-lg">
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white" />
                            <span className="text-white text-sm">Analyzing…</span>
                          </div>
                        </div>
                      )}
                      {analysisState.hasAnalysis && (
                        <div className="absolute top-3 right-3">
                          <div className="flex items-center gap-1 bg-green-500/90 text-white text-xs font-medium px-2.5 py-1 rounded-full shadow-lg">
                            <CheckIcon />
                            <span>Analyzed</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Analysis metrics */}
                    {analysisState.hasAnalysis && analysisState.results && (
                      <AnalysisMetrics results={analysisState.results} qualityScore={analysisState.qualityScore} />
                    )}

                    {/* Errors + actionable suggestions */}
                    <AnimatePresence>
                      {analysisState.error && <ErrorBanner message={analysisState.error} />}
                      {captureState.error && <ErrorBanner message={captureState.error} />}
                      {showTips && <SuggestionsPanel />}
                    </AnimatePresence>

                    {/* Re-pick */}
                    <div className="flex gap-3 justify-center flex-wrap">
                      <GlassButton
                        onClick={startOver}
                        disabled={analysisState.isAnalyzing}
                        aria-label="Choose a different photo"
                        className="bg-white/5 hover:bg-white/10 text-sm py-2 px-4"
                      >
                        <span className="flex items-center gap-1.5">
                          <RefreshIconSmall />
                          <span>New Photo</span>
                        </span>
                      </GlassButton>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bottom action area */}
              <div ref={actionAreaRef} className="pt-4  border-white/10 space-y-3">
                {analysisState.hasAnalysis && (
                  <GlassButton
                    onClick={handleNext}
                    aria-label="Continue to the voice step"
                    className="w-full py-3 text-sm bg-gradient-to-r from-purple-500/30 to-blue-500/30 hover:from-purple-500/40 hover:to-blue-500/40 border-purple-400/30"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <span>Continue to Voice</span>
                      <ArrowRightIcon />
                    </span>
                  </GlassButton>
                )}

                {captureState.hasPhoto && !analysisState.hasAnalysis && analysisState.isAnalyzing && (
                  <p className="text-white/40 text-xs text-center">Analyzing photo…</p>
                )}

                {captureState.hasPhoto && !analysisState.hasAnalysis && !analysisState.isAnalyzing && (
                  <GlassButton
                    onClick={engineFailed ? reload : analyzePhoto}
                    disabled={!isModelLoaded && !engineFailed}
                    aria-label={analysisState.retryCount > 0 ? 'Try analyzing again' : 'Analyze the selected photo'}
                    className="w-full py-3 text-sm bg-gradient-to-r from-purple-500/30 to-blue-500/30 hover:from-purple-500/40 hover:to-blue-500/40 border-purple-400/30 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {engineFailed
                      ? 'Retry analysis engine'
                      : !isModelLoaded
                        ? 'Waiting for analysis engine…'
                        : analysisState.retryCount > 0
                          ? 'Try Again'
                          : 'Analyze Photo'}
                  </GlassButton>
                )}

                {!captureState.hasPhoto && (
                  <p className="text-white/40 text-xs text-center">Add a photo to continue</p>
                )}
              </div>
            </div>
          </GlassCard>
          </div>

          {/* Hidden input — Upload: library/file chooser. On iOS, selecting a
              HEIC photo through this chooser transcodes it to JPEG here because
              the accept list omits HEIC. */}
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onUploadChange}
            className="hidden"
          />
        </motion.div>
      </div>
    </div>
  );
};

export default VisualStep;