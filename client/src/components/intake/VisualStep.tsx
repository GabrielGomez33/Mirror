// src/components/intake/VisualStep.tsx
// OVERHAULED: Professional camera UI, fixed black screen bug, mobile-first design
//
// Black screen fixes:
//   - Removed double-stream acquisition (old code opened+closed a probe stream,
//     then opened a second — mobile devices can't handle rapid open/close)
//   - Single stream acquisition with three-tier constraint fallback
//   - Wait for video 'loadedmetadata' + 'canplay' before showing camera UI
//   - Explicit video dimensions and object-fit for mobile rendering
//   - Mirror transform on front-facing camera (users expect mirrored preview)
//   - webkit-playsinline for older iOS WebKit
//
// Cross-browser edge cases handled:
//   - iOS Safari: getUserMedia in gesture handler, webkit-playsinline, no autoplay
//   - iOS Chrome/Firefox (WKWebView): same constraints as Safari
//   - Android Chrome: facingMode 'user', three-tier fallback
//   - Android Firefox: basic constraint fallback
//   - Samsung Internet: bare-minimum { video: true } fallback
//   - Desktop Safari: video.play() promise handling
//   - Older browsers without getUserMedia: graceful fallback to upload-only
//   - Browsers without canvas.toBlob: dataURL fallback
//   - HEIC files from iOS: accept attribute includes image/heic
//   - Tab visibility: stops camera on hide for privacy
//   - Orientation change: handles resize gracefully via CSS object-fit
//
// UX/UI improvements:
//   - Mobile-first responsive layout
//   - Professional SVG icons (no emojis)
//   - Face oval guide overlay on camera viewfinder
//   - Shutter flash animation on capture
//   - Quality ring indicator
//   - Better error recovery with retry
//   - capture="user" on file input for mobile camera shortcut

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useIntake } from '../../context/IntakeContext';
import { useFaceApi } from '../../hooks/useFaceApi';
import GlassCard, { GlassButton, GlassProgress } from '../ui/GlassCard';
import { motion, AnimatePresence } from 'framer-motion';
import BasicScene from '../three/BasicScene';

// ============================================================================
// TYPES
// ============================================================================
type PermissionStatus = 'unknown' | 'checking' | 'granted' | 'denied' | 'error';

interface CameraState {
  permissionStatus: PermissionStatus;
  stream: MediaStream | null;
  isActive: boolean;
  isReady: boolean; // true once video has renderable frames
  error: string | null;
}

interface CaptureState {
  mode: 'idle' | 'camera' | 'upload';
  preview: string | null;
  hasPhoto: boolean;
  isCapturing: boolean;
  showFlash: boolean;
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
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua) && !/CriOS/.test(ua) && !/FxiOS/.test(ua);
  const isFirefox = /Firefox/.test(ua) || /FxiOS/.test(ua);
  const isSamsungInternet = /SamsungBrowser/.test(ua);
  const supportsGetUserMedia = !!(navigator.mediaDevices?.getUserMedia);
  const isSecureContext = window.isSecureContext === true;
  return { isIOS, isAndroid, isMobile, isSafari, isFirefox, isSamsungInternet, supportsGetUserMedia, isSecureContext };
}

// ============================================================================
// SVG ICONS
// ============================================================================
const UploadIcon = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
  </svg>
);

const CameraIcon = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
  </svg>
);

const CameraIconSmall = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
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
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

// ============================================================================
// FACE OVAL GUIDE OVERLAY
// ============================================================================
const FaceGuideOverlay: React.FC<{ isReady: boolean }> = ({ isReady }) => (
  <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: isReady ? 1 : 0.3, scale: 1 }}
      className="relative"
      style={{ width: '55%', maxWidth: 220, aspectRatio: '3/4' }}
    >
      <svg viewBox="0 0 150 200" className="w-full h-full" fill="none">
        <ellipse
          cx="75" cy="95" rx="60" ry="78"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth="2"
          strokeDasharray="8 4"
        />
      </svg>
      {isReady && (
        <div className="absolute -bottom-6 left-0 right-0 text-center">
          <span className="text-white/60 text-xs bg-black/30 px-2 py-0.5 rounded-full">
            Align your face
          </span>
        </div>
      )}
    </motion.div>
  </div>
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
        {/* Quality ring — SVG with number overlaid */}
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
// ERROR BANNER COMPONENT
// ============================================================================
const ErrorBanner: React.FC<{ message: string }> = ({ message }) => (
  <motion.div
    initial={{ opacity: 0, y: -5 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -5 }}
    className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-400/20 rounded-lg"
  >
    <div className="text-red-400 mt-0.5"><AlertIcon /></div>
    <p className="text-red-100/90 text-xs">{message}</p>
  </motion.div>
);

// ============================================================================
// VISUAL STEP COMPONENT
// ============================================================================
const VisualStep: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { updateIntake, markStepComplete } = useIntake();
  const { isModelLoaded, loadingError, loadingProgress, analyzeImage } = useFaceApi();

  // Fix-mode support (coming from SubmitStep to re-do photo)
  const fixMode = (location.state as any)?.fixMode === true;
  const returnTo = (location.state as any)?.returnTo || '/intake/vocal';

  // Refs
  const imgRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const startingCameraRef = useRef(false);
  const isAnalyzingRef = useRef(false);

  // Callback ref: triggers re-render when <img> mounts/unmounts so the
  // auto-analysis useEffect can fire after AnimatePresence mode="wait" enters.
  const [imgMounted, setImgMounted] = useState(false);
  const imgCallbackRef = useCallback((node: HTMLImageElement | null) => {
    imgRef.current = node;
    setImgMounted(!!node);
  }, []);

  // Device info (stable, computed once)
  const [device] = useState(() => detectDeviceInfo());

  // State
  const [cameraState, setCameraState] = useState<CameraState>({
    permissionStatus: 'unknown',
    stream: null,
    isActive: false,
    isReady: false,
    error: null,
  });

  const [captureState, setCaptureState] = useState<CaptureState>({
    mode: 'idle',
    preview: null,
    hasPhoto: false,
    isCapturing: false,
    showFlash: false,
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
    try { localStorage.setItem('mirror:intake:lastStep', 'visual'); } catch {}
  }, []);

  // ============================================================================
  // CLEANUP
  // ============================================================================
  const revokePreview = useCallback(() => {
    if (captureState.preview) {
      try { URL.revokeObjectURL(captureState.preview); } catch {}
    }
  }, [captureState.preview]);

  const stopCamera = useCallback(() => {
    setCameraState(prev => {
      if (prev.stream) {
        try { prev.stream.getTracks().forEach(t => t.stop()); } catch {}
      }
      return { ...prev, stream: null, isActive: false, isReady: false };
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Stop stream on unmount (separate effect to avoid stale closure)
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (cameraState.stream) {
        try { cameraState.stream.getTracks().forEach(t => t.stop()); } catch {}
      }
    };
  }, [cameraState.stream]);

  // Revoke preview URL on unmount
  useEffect(() => {
    const url = captureState.preview;
    return () => {
      if (url) { try { URL.revokeObjectURL(url); } catch {} }
    };
  }, [captureState.preview]);

  // Tab visibility: stop camera on hide for privacy
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && cameraState.isActive) {
        stopCamera();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [cameraState.isActive, stopCamera]);

  // ============================================================================
  // START CAMERA
  // Split into two phases:
  //   Phase 1 (startCamera): acquire stream via getUserMedia, store in state,
  //            set isActive=true so React renders the <video> element.
  //   Phase 2 (useEffect): once the <video> element mounts and stream exists,
  //            attach srcObject and wait for loadedmetadata+canplay (frames).
  //            Then set isReady=true so the capture button enables.
  //
  // This split is REQUIRED because the <video> is conditionally rendered —
  // videoRef.current is null until isActive causes it to mount.
  // ============================================================================
  const startCamera = useCallback(async () => {
    if (cameraState.isActive || startingCameraRef.current) return;
    startingCameraRef.current = true;

    setCameraState(prev => ({ ...prev, permissionStatus: 'checking', error: null, isReady: false }));
    setCaptureState(prev => ({ ...prev, error: null }));

    // Pre-flight: getUserMedia support
    if (!device.supportsGetUserMedia) {
      setCameraState(prev => ({
        ...prev,
        permissionStatus: 'error',
        error: 'Camera not supported in this browser. Please use the upload option.',
      }));
      startingCameraRef.current = false;
      return;
    }

    // Pre-flight: HTTPS check (except localhost)
    if (!device.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setCameraState(prev => ({
        ...prev,
        permissionStatus: 'error',
        error: 'Camera requires a secure connection (HTTPS). Please use the upload option.',
      }));
      startingCameraRef.current = false;
      return;
    }

    let stream: MediaStream | null = null;

    try {
      // ── getUserMedia IMMEDIATELY in gesture handler (critical for iOS) ──

      // Tier 1: Ideal constraints (front camera, reasonable resolution)
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 960 },
          },
          audio: false,
        });
      } catch (err1: any) {
        if (err1.name === 'NotAllowedError' || err1.name === 'SecurityError') throw err1;
        if (err1.name === 'NotFoundError' || err1.name === 'DevicesNotFoundError') throw err1;

        // Tier 2: Basic constraints (just front camera)
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' },
            audio: false,
          });
        } catch (err2: any) {
          if (err2.name === 'NotAllowedError' || err2.name === 'SecurityError') throw err2;
          if (err2.name === 'NotFoundError' || err2.name === 'DevicesNotFoundError') throw err2;

          // Tier 3: Bare minimum (any camera — Samsung Internet, old Android)
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
      }

      if (!stream || !mountedRef.current) {
        if (stream) stream.getTracks().forEach(t => t.stop());
        startingCameraRef.current = false;
        return;
      }

      // ── Phase 1 complete: store stream and set isActive so <video> renders ──
      setCameraState({
        permissionStatus: 'granted',
        stream,
        isActive: true,
        isReady: false, // Phase 2 (useEffect) will set this to true once frames arrive
        error: null,
      });
      setCaptureState(prev => ({ ...prev, mode: 'camera' }));

    } catch (err: any) {
      if (stream) {
        try { stream.getTracks().forEach(t => t.stop()); } catch {}
      }

      const name = err?.name || '';
      let msg = err?.message || 'Camera error. Please try again or use file upload.';

      if (name === 'NotAllowedError' || name === 'SecurityError') {
        msg = device.isMobile
          ? 'Camera permission denied. Please allow camera access in your browser settings, then try again.'
          : 'Camera permission denied. Click the lock/tune icon in the address bar to allow camera access.';
        setCameraState(prev => ({ ...prev, permissionStatus: 'denied', error: msg, isActive: false, isReady: false, stream: null }));
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        msg = 'No camera found on this device. Please use the upload option.';
        setCameraState(prev => ({ ...prev, permissionStatus: 'error', error: msg, isActive: false, isReady: false, stream: null }));
      } else if (name === 'NotReadableError') {
        msg = 'Camera is in use by another app. Close other apps and try again.';
        setCameraState(prev => ({ ...prev, permissionStatus: 'error', error: msg, isActive: false, isReady: false, stream: null }));
      } else if (name === 'OverconstrainedError') {
        msg = 'Camera constraints not supported. Please use the upload option.';
        setCameraState(prev => ({ ...prev, permissionStatus: 'error', error: msg, isActive: false, isReady: false, stream: null }));
      } else if (name === 'AbortError') {
        msg = 'Camera was interrupted. Please try again.';
        setCameraState(prev => ({ ...prev, permissionStatus: 'error', error: msg, isActive: false, isReady: false, stream: null }));
      } else {
        setCameraState(prev => ({ ...prev, permissionStatus: 'error', error: msg, isActive: false, isReady: false, stream: null }));
      }
    } finally {
      startingCameraRef.current = false;
    }
  }, [cameraState.isActive, device]);

  // ============================================================================
  // Phase 2: Attach stream to <video> once it mounts, wait for renderable frames.
  // Runs when cameraState.stream changes (set by startCamera above).
  // At this point isActive=true so the <video> element exists in the DOM.
  //
  // Uses polling (up to 2s) instead of single RAF because AnimatePresence
  // can delay the actual DOM mount of the <video> beyond one animation frame.
  // ============================================================================
  useEffect(() => {
    const stream = cameraState.stream;
    if (!stream || !cameraState.isActive) return;

    let cancelled = false;
    let pollCount = 0;
    const MAX_POLLS = 40; // 40 × 50ms = 2 seconds max wait for <video> to mount

    const tryAttach = () => {
      if (cancelled) return;

      const video = videoRef.current;
      if (!video) {
        pollCount++;
        if (pollCount < MAX_POLLS) {
          setTimeout(tryAttach, 50);
        } else {
          console.warn('[VisualStep] Video element never appeared after 2s');
        }
        return;
      }

      // Don't re-attach if already wired to this stream
      if (video.srcObject === stream) {
        if (video.readyState >= 2) {
          setCameraState(prev => prev.isReady ? prev : { ...prev, isReady: true });
        }
        return;
      }

      video.srcObject = stream;

      // Safety timeout — force ready after 5s even if canplay never fires
      const timeout = setTimeout(() => {
        if (!cancelled && mountedRef.current) {
          console.warn('[VisualStep] Video frame timeout — forcing ready state');
          setCameraState(prev => prev.isReady ? prev : { ...prev, isReady: true });
        }
      }, 5000);

      const markReady = () => {
        clearTimeout(timeout);
        if (!cancelled && mountedRef.current) {
          setCameraState(prev => prev.isReady ? prev : { ...prev, isReady: true });
        }
      };

      const onCanPlay = () => markReady();
      const onPlaying = () => markReady();

      const onLoadedMetadata = () => {
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
        video.addEventListener('canplay', onCanPlay, { once: true });
        video.addEventListener('playing', onPlaying, { once: true });
        video.play().catch(() => {});
      };

      // Handle different readyState scenarios
      if (video.readyState >= 2) {
        // HAVE_CURRENT_DATA or better — already has at least one frame
        video.play().catch(() => {});
        markReady();
      } else if (video.readyState >= 1) {
        // HAVE_METADATA — wait for frames
        video.addEventListener('canplay', onCanPlay, { once: true });
        video.addEventListener('playing', onPlaying, { once: true });
        video.play().catch(() => {});
      } else {
        // HAVE_NOTHING — wait for metadata first
        video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
      }
    };

    // Start attempting on next frame
    requestAnimationFrame(tryAttach);

    return () => { cancelled = true; };
  }, [cameraState.stream, cameraState.isActive]);

  // ============================================================================
  // FACE ANALYSIS
  // ============================================================================
  const analyzePhoto = useCallback(async () => {
    // Use ref to avoid stale-closure reads of analysisState.isAnalyzing
    if (isAnalyzingRef.current) return;
    // Silently bail if preconditions not met — useEffect will retry when they are
    if (!imgRef.current || !isModelLoaded) return;
    if (!imgRef.current.complete || imgRef.current.naturalWidth === 0) return;

    isAnalyzingRef.current = true;
    setAnalysisState(prev => ({ ...prev, isAnalyzing: true, error: null }));

    try {
      const result = await analyzeImage(imgRef.current);

      if (!result?.expressions) {
        throw new Error('No face detected. Please use a clear, well-lit photo showing your face.');
      }

      const confidence = (result as any)?.detection?._score ?? 0;
      const qualityScore = Math.round(Math.max(0, Math.min(1, confidence)) * 100);

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
  }, [analyzeImage, isModelLoaded, updateIntake]);

  // Auto-trigger analysis after React mounts the <img> with the new photo.
  // This solves the race: setCaptureState({ hasPhoto: true }) is async, so
  // imgRef.current is null when capturePhoto/handleFileUpload try to attach
  // onload imperatively. By the time this effect fires, React has re-rendered,
  // the <img> is in the DOM, and imgRef.current is valid.
  useEffect(() => {
    if (!captureState.hasPhoto || !captureState.preview) return;
    if (isAnalyzingRef.current) return;
    if (analysisState.hasAnalysis) return;
    if (!isModelLoaded) return;

    const img = imgRef.current;
    if (!img) return;

    const runAnalysis = () => {
      if (mountedRef.current && !isAnalyzingRef.current) {
        analyzePhoto();
      }
    };

    // Image already loaded (cached or fast blob URL)
    if (img.complete && img.naturalWidth > 0) {
      const timer = setTimeout(runAnalysis, 300);
      return () => clearTimeout(timer);
    }

    // Wait for image to finish loading
    const onLoad = () => setTimeout(runAnalysis, 300);
    img.addEventListener('load', onLoad);
    return () => img.removeEventListener('load', onLoad);
  }, [captureState.hasPhoto, captureState.preview, analysisState.hasAnalysis, isModelLoaded, analyzePhoto, imgMounted]);

  // ============================================================================
  // FILE UPLOAD
  // ============================================================================
  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Accept common image types + HEIC from iOS
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
      if (!allowedTypes.includes(file.type) && !file.name.toLowerCase().match(/\.(jpe?g|png|webp|heic|heif)$/)) {
        setCaptureState(prev => ({ ...prev, error: 'Please upload a JPEG, PNG, WebP, or HEIC image.' }));
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setCaptureState(prev => ({ ...prev, error: 'Image too large. Maximum 10MB.' }));
        return;
      }
      if (file.size < 1024) {
        setCaptureState(prev => ({ ...prev, error: 'File appears empty or corrupted.' }));
        return;
      }

      revokePreview();
      stopCamera();

      const preview = URL.createObjectURL(file);
      isAnalyzingRef.current = false;
      setCaptureState({ mode: 'upload', preview, hasPhoto: true, isCapturing: false, showFlash: false, error: null });
      setAnalysisState(prev => ({ ...prev, isAnalyzing: false, hasAnalysis: false, error: null, results: null, qualityScore: 0 }));
      updateIntake({ photo: file });
      // Analysis is auto-triggered by the useEffect once React mounts the <img>
    },
    [revokePreview, stopCamera, updateIntake],
  );

  // ============================================================================
  // CAMERA CAPTURE (with shutter flash + mirror correction)
  // ============================================================================
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Verify video actually has frames (prevents blank capture)
    if (video.videoWidth === 0 || video.videoHeight === 0 || video.readyState < 2) {
      setCaptureState(prev => ({ ...prev, error: 'Camera not ready yet. Please wait a moment.' }));
      return;
    }

    setCaptureState(prev => ({ ...prev, isCapturing: true, showFlash: true }));

    // Clear flash after animation
    setTimeout(() => {
      if (mountedRef.current) setCaptureState(prev => ({ ...prev, showFlash: false }));
    }, 200);

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Mirror the capture to match the mirrored preview (front camera is shown mirrored)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const finalizeBlob = (blob: Blob | null) => {
      if (!blob || !mountedRef.current) {
        if (mountedRef.current) {
          setCaptureState(prev => ({ ...prev, isCapturing: false, error: 'Capture failed. Please try again.' }));
        }
        return;
      }

      revokePreview();
      const preview = URL.createObjectURL(blob);
      const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });

      isAnalyzingRef.current = false;
      setCaptureState({ mode: 'camera', preview, hasPhoto: true, isCapturing: false, showFlash: false, error: null });
      setAnalysisState(prev => ({ ...prev, isAnalyzing: false, hasAnalysis: false, error: null, results: null, qualityScore: 0 }));
      updateIntake({ photo: file });
      stopCamera();
      // Analysis is auto-triggered by the useEffect once React mounts the <img>
    };

    // Prefer toBlob; fallback to dataURL for older browsers
    if (canvas.toBlob) {
      canvas.toBlob(blob => finalizeBlob(blob), 'image/jpeg', 0.85);
    } else {
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        fetch(dataUrl)
          .then(r => r.blob())
          .then(finalizeBlob)
          .catch(() => {
            if (mountedRef.current) {
              setCaptureState(prev => ({ ...prev, isCapturing: false, error: 'Capture failed.' }));
            }
          });
      } catch {
        if (mountedRef.current) {
          setCaptureState(prev => ({ ...prev, isCapturing: false, error: 'Capture failed.' }));
        }
      }
    }
  }, [revokePreview, updateIntake, stopCamera]);

  // ============================================================================
  // RESET
  // ============================================================================
  const startOver = useCallback(() => {
    revokePreview();
    stopCamera();
    isAnalyzingRef.current = false;
    setCaptureState({ mode: 'idle', preview: null, hasPhoto: false, isCapturing: false, showFlash: false, error: null });
    setAnalysisState({ isAnalyzing: false, hasAnalysis: false, error: null, results: null, retryCount: 0, qualityScore: 0 });
    updateIntake({ photo: undefined, faceAnalysis: undefined });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [revokePreview, stopCamera, updateIntake]);

  // ============================================================================
  // NAVIGATION
  // ============================================================================
  const handleNext = useCallback(() => {
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
  }, [analysisState.hasAnalysis, analysisState.qualityScore, captureState.hasPhoto, markStepComplete, navigate, fixMode, returnTo]);

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

  const showMethodPicker = isModelLoaded && !captureState.hasPhoto && !cameraState.isActive;

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
                <p className="text-white/70 text-sm">Upload or capture a clear photo for facial analysis</p>
              </div>

              {/* Face API Loading */}
              <AnimatePresence>
                {!isModelLoaded && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="glass-card-enhanced p-5 rounded-xl"
                  >
                    <div className="flex items-center justify-center space-x-4">
                      <div className="animate-spin rounded-full h-7 w-7 border-2 border-white/20 border-t-white" />
                      <div className="text-left">
                        <p className="text-white font-medium text-sm">Loading Analysis Engine</p>
                        <GlassProgress value={progressValue} max={100} className="w-48 mt-2" />
                        <p className="text-white/50 text-xs mt-1">{progressValue}%</p>
                        {loadingError && (
                          <p className="text-red-300 text-xs mt-1">{String(loadingError)}</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Method Picker */}
              {showMethodPicker && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <div className="grid grid-cols-2 gap-3">
                    {/* Upload */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="enhanced-glass-card group relative text-center"
                      style={{ padding: 20, borderRadius: 16, cursor: 'pointer', marginBottom: 0 }}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className="text-white/70 group-hover:text-white transition-colors">
                          <UploadIcon />
                        </div>
                        <div>
                          <p className="glass-card-text" style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Upload</p>
                          <p className="glass-card-text" style={{ fontSize: 12, margin: 0, opacity: 0.5 }}>From device</p>
                        </div>
                      </div>
                    </button>

                    {/* Camera */}
                    <button
                      onClick={startCamera}
                      disabled={cameraState.permissionStatus === 'denied' || !device.supportsGetUserMedia}
                      className="enhanced-glass-card group relative text-center disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ padding: 20, borderRadius: 16, cursor: 'pointer', marginBottom: 0 }}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className="text-white/70 group-hover:text-white transition-colors">
                          <CameraIcon />
                        </div>
                        <div>
                          <p className="glass-card-text" style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Camera</p>
                          <p className="glass-card-text" style={{ fontSize: 12, margin: 0, opacity: 0.5 }}>
                            {!device.supportsGetUserMedia ? 'Not available' : 'Take photo'}
                          </p>
                        </div>
                      </div>
                      {cameraState.permissionStatus === 'checking' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl">
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/20 border-t-white" />
                        </div>
                      )}
                    </button>
                  </div>

                  {/* Errors */}
                  <AnimatePresence>
                    {cameraState.error && <ErrorBanner message={cameraState.error} />}
                    {captureState.error && <ErrorBanner message={captureState.error} />}
                  </AnimatePresence>

                  {/* Tips */}
                  <div className="glass-card" style={{ padding: 12, borderRadius: 12 }}>
                    <p className="glass-card-text" style={{ fontSize: 12, margin: 0, opacity: 0.6, lineHeight: 1.5 }}>
                      For best results: good lighting, face the camera directly, neutral expression.
                      {device.isIOS && ' On iOS, Safari provides the best camera experience.'}
                      {device.isAndroid && ' Ensure your browser has camera permission enabled.'}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Camera / Photo — single AnimatePresence so exit completes before enter (no layout shift) */}
              <AnimatePresence mode="wait">
                {cameraState.isActive && (
                  <motion.div
                    key="viewfinder"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    <div className="relative rounded-xl overflow-hidden bg-black mx-auto" style={{ maxWidth: 400 }}>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        // @ts-ignore — webkit-playsinline needed for older iOS Safari
                        webkit-playsinline="true"
                        className="w-full block"
                        style={{
                          transform: 'scaleX(-1)',
                          objectFit: 'cover',
                          minHeight: 280,
                          maxHeight: 400,
                        }}
                      />
                      <FaceGuideOverlay isReady={cameraState.isReady} />
                      <AnimatePresence>
                        {captureState.showFlash && (
                          <motion.div
                            initial={{ opacity: 1 }}
                            animate={{ opacity: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="absolute inset-0 bg-white z-20"
                          />
                        )}
                      </AnimatePresence>
                      {!cameraState.isReady && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/20 border-t-white mx-auto mb-2" />
                            <p className="text-white/60 text-xs">Starting camera...</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {!cameraState.isActive && captureState.hasPhoto && (
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
                        alt="Your photo"
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
                            <span className="text-white text-sm">Analyzing...</span>
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

                    {/* Errors */}
                    <AnimatePresence>
                      {analysisState.error && <ErrorBanner message={analysisState.error} />}
                    </AnimatePresence>
                    <AnimatePresence>
                      {captureState.error && <ErrorBanner message={captureState.error} />}
                    </AnimatePresence>

                    {/* Action buttons */}
                    <div className="flex gap-3 justify-center flex-wrap">
                      <GlassButton
                        onClick={startOver}
                        disabled={analysisState.isAnalyzing}
                        className="bg-white/5 hover:bg-white/10 text-sm py-2 px-4"
                      >
                        <span className="flex items-center gap-1.5">
                          <CameraIconSmall />
                          <span>New Photo</span>
                        </span>
                      </GlassButton>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bottom action area */}
              <div className="pt-4 border-t border-white/10 space-y-3">
                {cameraState.isActive && (
                  <>
                    <GlassButton
                      onClick={capturePhoto}
                      disabled={captureState.isCapturing}
                      className="w-full py-3 text-sm bg-gradient-to-r from-purple-500/30 to-blue-500/30 hover:from-purple-500/40 hover:to-blue-500/40 border-purple-400/30"
                    >
                      {captureState.isCapturing ? 'Capturing...' : cameraState.isReady ? 'Capture Photo' : 'Camera loading...'}
                    </GlassButton>
                    <GlassButton
                      onClick={() => { stopCamera(); setCaptureState(prev => ({ ...prev, mode: 'idle' })); }}
                      className="w-full py-2 text-sm bg-white/5 hover:bg-white/10"
                    >
                      Cancel
                    </GlassButton>
                  </>
                )}
                {!cameraState.isActive && analysisState.hasAnalysis && (
                  <GlassButton
                    onClick={handleNext}
                    className="w-full py-3 text-sm bg-gradient-to-r from-purple-500/30 to-blue-500/30 hover:from-purple-500/40 hover:to-blue-500/40 border-purple-400/30"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <span>Continue to Voice</span>
                      <ArrowRightIcon />
                    </span>
                  </GlassButton>
                )}
                {!cameraState.isActive && !analysisState.hasAnalysis && analysisState.isAnalyzing && (
                  <p className="text-white/40 text-xs text-center">Analyzing photo...</p>
                )}
                {!cameraState.isActive && !analysisState.hasAnalysis && !analysisState.isAnalyzing && captureState.hasPhoto && (
                  <GlassButton
                    onClick={analyzePhoto}
                    className="w-full py-3 text-sm bg-gradient-to-r from-purple-500/30 to-blue-500/30 hover:from-purple-500/40 hover:to-blue-500/40 border-purple-400/30"
                  >
                    Analyze Photo
                  </GlassButton>
                )}
                {!cameraState.isActive && !analysisState.hasAnalysis && !analysisState.isAnalyzing && !captureState.hasPhoto && (
                  <p className="text-white/40 text-xs text-center">Take or upload a photo to continue</p>
                )}
              </div>
            </div>
          </GlassCard>
          </div>

          {/* Hidden file input — capture="user" opens front camera on mobile */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            onChange={handleFileUpload}
            className="hidden"
          />
          <canvas ref={canvasRef} className="hidden" />
        </motion.div>
      </div>
    </div>
  );
};

export default VisualStep;
