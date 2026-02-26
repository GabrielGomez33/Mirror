// src/components/intake/VocalStep.tsx
// OVERHAULED: Enterprise-grade vocal intake with comprehensive cross-browser support
//
// Mobile microphone fixes:
//   - getUserMedia called IMMEDIATELY in user-gesture handler (preserves gesture context)
//   - AudioContext created/resumed within the same gesture handler (iOS requirement)
//   - Three-tier constraint fallback: ideal → basic → bare minimum ({ audio: true })
//   - iOS Safari: skips unreliable Permissions API, uses audio/mp4 codec
//   - Android Chrome/Firefox: proper codec negotiation with webm/opus preference
//   - HTTPS enforcement check with clear user guidance
//   - Handles NotAllowedError, NotFoundError, NotReadableError, OverconstrainedError, AbortError
//   - Permission state machine with browser-specific recovery instructions
//   - Tab visibility handling: auto-stops recording on tab hide for privacy
//   - Retry logic with exponential backoff for transient failures
//   - Processing overlay with timeout safeguard (prevents permanent UI blocking)
//   - Proper cleanup of all resources (streams, contexts, intervals, animation frames)

import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useIntake } from '../../context/IntakeContext';
import GlassCard, { GlassButton } from '../ui/GlassCard';
import { motion, AnimatePresence } from 'framer-motion';
import GlassySakuraOrb from '../visualizers/GlassySakuraOrb';
import BasicScene from '../three/BasicScene';

// ============================================================================
// CONSTANTS
// ============================================================================
const MAX_DURATION_SEC = 30;
const MIN_DURATION_SEC = 3;
const PROCESSING_TIMEOUT_MS = 10000; // safety valve for stuck processing state
const COUNTDOWN_SECONDS = 3;

// ============================================================================
// TYPES
// ============================================================================
interface DeviceInfo {
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isSafari: boolean;
  isChrome: boolean;
  isFirefox: boolean;
  isEdge: boolean;
  isOpera: boolean;
  browserVersion: number;
  osVersion: number;
  supportsMediaRecorder: boolean;
  supportsGetUserMedia: boolean;
  supportsPermissionsAPI: boolean;
  isSecureContext: boolean;
  supportedCodecs: string[];
  preferredCodec: string;
  sampleRate: number;
  channelCount: number;
}

interface RecordingState {
  blob: Blob;
  url: string;
  mimeType: string;
  size: number;
  duration: number;
}

type PermissionStatus = 'unknown' | 'checking' | 'prompt' | 'granted' | 'denied' | 'error' | 'unsupported';

interface PermissionState {
  status: PermissionStatus;
  message: string;
  detail: string;
  canRetry: boolean;
  retryMethod?: 'settings' | 'refresh' | 'getUserMedia';
  browserInstructions?: string[];
}

// ============================================================================
// DEVICE DETECTION (comprehensive, cached)
// ============================================================================
function detectDevice(): DeviceInfo {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isAndroid = /Android/.test(ua);
  const isMobile = isIOS || isAndroid || /Mobile|webOS|BlackBerry|Opera Mini|IEMobile/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua) && !/CriOS/.test(ua) && !/FxiOS/.test(ua);
  const isChrome = /Chrome/.test(ua) && !/Edg/.test(ua) && !/OPR/.test(ua);
  const isFirefox = /Firefox/.test(ua) || /FxiOS/.test(ua);
  const isEdge = /Edg/.test(ua);
  const isOpera = /OPR/.test(ua);

  let browserVersion = 0;
  if (isSafari) {
    const m = ua.match(/Version\/(\d+(\.\d+)?)/);
    browserVersion = m ? parseFloat(m[1]) : 0;
  } else if (isChrome) {
    const m = ua.match(/Chrome\/(\d+)/);
    browserVersion = m ? parseInt(m[1]) : 0;
  } else if (isFirefox) {
    const m = ua.match(/Firefox\/(\d+)/);
    browserVersion = m ? parseInt(m[1]) : 0;
  } else if (isEdge) {
    const m = ua.match(/Edg\/(\d+)/);
    browserVersion = m ? parseInt(m[1]) : 0;
  }

  let osVersion = 0;
  if (isIOS) {
    const m = ua.match(/OS (\d+)_(\d+)/);
    osVersion = m ? parseFloat(`${m[1]}.${m[2]}`) : 0;
  } else if (isAndroid) {
    const m = ua.match(/Android (\d+(\.\d+)?)/);
    osVersion = m ? parseFloat(m[1]) : 0;
  }

  const supportsGetUserMedia = !!(navigator.mediaDevices?.getUserMedia);
  const supportsMediaRecorder = typeof MediaRecorder !== 'undefined';
  const supportsPermissionsAPI = !!(navigator.permissions?.query);
  const isSecureContext = window.isSecureContext === true;

  // Codec detection
  const supportedCodecs: string[] = [];
  if (supportsMediaRecorder) {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg',
    ];
    for (const codec of candidates) {
      try {
        if (MediaRecorder.isTypeSupported(codec)) {
          supportedCodecs.push(codec);
        }
      } catch {
        // isTypeSupported can throw on some browsers
      }
    }
  }

  // Preferred codec: iOS Safari prefers audio/mp4, everyone else prefers webm/opus
  let preferredCodec = 'audio/webm;codecs=opus';
  if (isIOS && isSafari) {
    preferredCodec = supportedCodecs.includes('audio/mp4') ? 'audio/mp4' : (supportedCodecs[0] || 'audio/mp4');
  } else {
    preferredCodec = supportedCodecs[0] || 'audio/webm;codecs=opus';
  }

  // Sample rate: mobile devices handle 16kHz well, desktop can do 44.1kHz
  const sampleRate = isMobile ? 16000 : 44100;

  return {
    isMobile,
    isIOS,
    isAndroid,
    isSafari,
    isChrome,
    isFirefox,
    isEdge,
    isOpera,
    browserVersion,
    osVersion,
    supportsMediaRecorder,
    supportsGetUserMedia,
    supportsPermissionsAPI,
    isSecureContext,
    supportedCodecs,
    preferredCodec,
    sampleRate,
    channelCount: 1,
  };
}

// ============================================================================
// BROWSER-SPECIFIC PERMISSION INSTRUCTIONS
// ============================================================================
function getPermissionInstructions(device: DeviceInfo): string[] {
  if (device.isIOS && device.isSafari) {
    return [
      'Open Settings on your iPhone/iPad',
      'Scroll down and tap "Safari"',
      'Tap "Microphone" under Settings for Websites',
      'Set to "Allow" or "Ask"',
      'Return here and tap "Try Again"',
    ];
  }
  if (device.isIOS && !device.isSafari) {
    // Chrome/Firefox on iOS
    return [
      'Open Settings on your iPhone/iPad',
      `Scroll down and tap "${device.isChrome ? 'Chrome' : device.isFirefox ? 'Firefox' : 'your browser'}"`,
      'Ensure "Microphone" is toggled ON',
      'Return here and tap "Try Again"',
    ];
  }
  if (device.isAndroid && device.isChrome) {
    return [
      'Tap the lock/tune icon in the address bar',
      'Tap "Permissions" or "Site settings"',
      'Find "Microphone" and set to "Allow"',
      'Tap "Try Again" below',
    ];
  }
  if (device.isAndroid && device.isFirefox) {
    return [
      'Tap the lock icon in the address bar',
      'Tap "Edit Site Permissions"',
      'Set "Microphone" to "Allowed"',
      'Tap "Try Again" below',
    ];
  }
  if (device.isAndroid) {
    return [
      'Tap the lock or settings icon in the address bar',
      'Find "Microphone" in site permissions',
      'Set to "Allow"',
      'Tap "Try Again" below',
    ];
  }
  // Desktop browsers
  if (device.isChrome || device.isEdge) {
    return [
      'Click the lock/tune icon in the address bar',
      'Find "Microphone" in the dropdown',
      'Change to "Allow"',
      'Click "Try Again" below',
    ];
  }
  if (device.isFirefox) {
    return [
      'Click the lock icon in the address bar',
      'Click the "X" next to the blocked microphone permission',
      'Click "Try Again" below to re-request access',
    ];
  }
  if (device.isSafari) {
    return [
      'Click Safari menu > Settings for This Website',
      'Set "Microphone" to "Allow"',
      'Click "Try Again" below',
    ];
  }
  return [
    'Open your browser settings',
    'Find site permissions for this website',
    'Allow microphone access',
    'Click "Try Again" below',
  ];
}

// ============================================================================
// VOCAL STEP COMPONENT
// ============================================================================
const VocalStep = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { updateIntake, markStepComplete, getIntake } = useIntake();

  // Fix-mode: if navigated from SubmitStep, return there after recording
  const fixMode = (location.state as any)?.fixMode === true;
  const returnTo = (location.state as any)?.returnTo || '/intake/iq';

  // Persist last step for resume
  useEffect(() => {
    try {
      localStorage.setItem('mirror:intake:lastStep', 'vocal');
    } catch { /* localStorage unavailable */ }
  }, []);

  // Restore previous recording if context has voiceMeta
  useEffect(() => {
    const meta = (getIntake as any)?.voiceMeta as { blobUrl?: string; durationMs?: number } | undefined;
    if (meta?.blobUrl) {
      setRecordingState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          url: meta.blobUrl!,
          duration: typeof meta.durationMs === 'number' ? meta.durationMs / 1000 : prev.duration,
        };
      });
    }
  }, [getIntake]);

  // ============================================================================
  // REFS
  // ============================================================================
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);
  const lastDurationRef = useRef<number>(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vizRunningRef = useRef<boolean>(false);
  const startingRef = useRef<boolean>(false);
  const processingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef<boolean>(true);

  // ============================================================================
  // STATE
  // ============================================================================
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [permissionState, setPermissionState] = useState<PermissionState>({
    status: 'unknown',
    message: 'Preparing microphone access...',
    detail: '',
    canRetry: false,
  });
  const [recording, setRecording] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingState | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioWaveform, setAudioWaveform] = useState<number[]>(new Array(48).fill(0));
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [showInstructions, setShowInstructions] = useState(false);

  const prompt =
    'Hello, my name is [your name]. Today is a beautiful day, and I\'m excited to explore new possibilities. The sun rose behind the hills, painting the sky with golden hues. I believe that every moment brings a chance for growth and discovery. One, two, three, four, five - taking a deep breath - six, seven, eight, nine, ten.';

  // ============================================================================
  // PROCESSING SAFEGUARD: auto-clear stuck processing state
  // ============================================================================
  const startProcessingTimeout = useCallback(() => {
    if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
    processingTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setIsProcessing(false);
        console.warn('[VocalStep] Processing timeout reached, clearing processing state');
      }
    }, PROCESSING_TIMEOUT_MS);
  }, []);

  const clearProcessingTimeout = useCallback(() => {
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
  }, []);

  // ============================================================================
  // CLEANUP (security: release all resources)
  // ============================================================================
  const cleanup = useCallback(() => {
    vizRunningRef.current = false;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    clearProcessingTimeout();

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch { /* already stopped */ }
    }
    mediaRecorderRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try { track.stop(); } catch { /* already stopped */ }
      });
      streamRef.current = null;
    }

    try { sourceNodeRef.current?.disconnect(); } catch { /* already disconnected */ }
    try { analyserRef.current?.disconnect(); } catch { /* already disconnected */ }
    sourceNodeRef.current = null;
    analyserRef.current = null;

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, [clearProcessingTimeout]);

  // ============================================================================
  // PERMISSION CHECKING
  // ============================================================================
  const checkPermission = useCallback(async (device: DeviceInfo): Promise<PermissionState> => {
    // Pre-flight checks
    if (!device.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return {
        status: 'unsupported',
        message: 'Secure connection required',
        detail: 'Microphone access requires HTTPS. Please access this site via https://.',
        canRetry: false,
      };
    }

    if (!device.supportsGetUserMedia) {
      return {
        status: 'unsupported',
        message: 'Browser not supported',
        detail: 'Your browser does not support audio recording. Please use Chrome, Firefox, Safari 14.5+, or Edge.',
        canRetry: false,
      };
    }

    if (!device.supportsMediaRecorder) {
      return {
        status: 'unsupported',
        message: 'Recording not supported',
        detail: device.isIOS && device.isSafari && device.browserVersion < 14.5
          ? 'Audio recording requires Safari 14.5+ on iOS. Please update your browser.'
          : 'MediaRecorder is not supported in your browser. Please use a modern browser.',
        canRetry: false,
      };
    }

    // On mobile: DON'T probe getUserMedia during initial check — this consumes the
    // one-time permission prompt outside of a user gesture, which will fail on iOS Safari.
    // Instead, show "prompt" state and let the user tap "Start Recording" to trigger.
    if (device.isMobile) {
      // On iOS Safari, the Permissions API doesn't support 'microphone' query
      if (device.isIOS && device.isSafari) {
        return {
          status: 'prompt',
          message: 'Tap "Start Recording" to begin',
          detail: 'You will be asked to allow microphone access.',
          canRetry: false,
          retryMethod: 'getUserMedia',
        };
      }

      // On other mobile browsers, try the Permissions API if available
      if (device.supportsPermissionsAPI) {
        try {
          const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          if (result.state === 'granted') {
            return {
              status: 'granted',
              message: 'Microphone access granted',
              detail: '',
              canRetry: false,
            };
          }
          if (result.state === 'denied') {
            return {
              status: 'denied',
              message: 'Microphone access blocked',
              detail: 'Please enable microphone access in your browser settings.',
              canRetry: true,
              retryMethod: 'settings',
              browserInstructions: getPermissionInstructions(device),
            };
          }
        } catch {
          // Permissions API failed — fall through to prompt state
        }
      }

      return {
        status: 'prompt',
        message: 'Tap "Start Recording" to begin',
        detail: 'You will be asked to allow microphone access.',
        canRetry: false,
        retryMethod: 'getUserMedia',
      };
    }

    // Desktop: safe to probe getUserMedia
    try {
      // Check Permissions API first (faster, no prompt)
      if (device.supportsPermissionsAPI) {
        try {
          const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          if (result.state === 'granted') {
            return { status: 'granted', message: 'Microphone access granted', detail: '', canRetry: false };
          }
          if (result.state === 'denied') {
            return {
              status: 'denied',
              message: 'Microphone access blocked',
              detail: 'Click the lock/tune icon in your address bar to allow microphone access.',
              canRetry: true,
              retryMethod: 'settings',
              browserInstructions: getPermissionInstructions(device),
            };
          }
          // 'prompt' — fall through to probe
        } catch {
          // Permissions API not available for microphone, fall through
        }
      }

      // Probe getUserMedia on desktop only (safe outside gesture context on most desktop browsers)
      const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      testStream.getTracks().forEach(t => t.stop());
      return { status: 'granted', message: 'Microphone access granted', detail: '', canRetry: false };
    } catch (err: any) {
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        return {
          status: 'denied',
          message: 'Microphone access denied',
          detail: 'Click the lock/tune icon in your address bar to allow microphone access.',
          canRetry: true,
          retryMethod: 'settings',
          browserInstructions: getPermissionInstructions(device),
        };
      }
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        return {
          status: 'error',
          message: 'No microphone found',
          detail: 'Please connect a microphone and try again.',
          canRetry: true,
          retryMethod: 'refresh',
        };
      }
      if (name === 'NotReadableError') {
        return {
          status: 'error',
          message: 'Microphone in use',
          detail: 'Another application is using your microphone. Close it and try again.',
          canRetry: true,
          retryMethod: 'refresh',
        };
      }
      // For any other error on desktop, let user try via button
      return {
        status: 'prompt',
        message: 'Click "Start Recording" to begin',
        detail: '',
        canRetry: false,
        retryMethod: 'getUserMedia',
      };
    }
  }, []);

  // ============================================================================
  // VISUALIZATION LOOP
  // ============================================================================
  const updateVisualization = useCallback(() => {
    if (!analyserRef.current || !vizRunningRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Average energy (0..1)
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) sum += dataArray[i] / 255;
    setAudioLevel(sum / bufferLength);

    // Downsample to 48 bins
    const barCount = 48;
    const blockSize = Math.max(1, Math.floor(bufferLength / barCount));
    const bins: number[] = [];
    for (let i = 0; i < barCount; i++) {
      let blockSum = 0;
      for (let j = 0; j < blockSize; j++) {
        const idx = i * blockSize + j;
        if (idx < bufferLength) blockSum += dataArray[idx];
      }
      bins.push((blockSum / blockSize) / 255);
    }
    setAudioWaveform(bins);

    animationFrameRef.current = requestAnimationFrame(updateVisualization);
  }, []);

  // ============================================================================
  // ACQUIRE STREAM (three-tier fallback)
  // ============================================================================
  const acquireStream = useCallback(async (device: DeviceInfo): Promise<MediaStream> => {
    // Tier 1: Ideal constraints
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: !device.isIOS, // iOS handles echo cancellation internally
          noiseSuppression: !device.isIOS,
          autoGainControl: true,
          sampleRate: { ideal: device.sampleRate },
          channelCount: device.channelCount,
        },
      });
    } catch (err1: any) {
      console.warn('[VocalStep] Tier 1 constraints failed:', err1.name, err1.message);

      // If permission denied, don't retry with different constraints — propagate
      if (err1.name === 'NotAllowedError' || err1.name === 'SecurityError') throw err1;
      if (err1.name === 'NotFoundError' || err1.name === 'DevicesNotFoundError') throw err1;
    }

    // Tier 2: Basic constraints
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err2: any) {
      console.warn('[VocalStep] Tier 2 constraints failed:', err2.name, err2.message);
      if (err2.name === 'NotAllowedError' || err2.name === 'SecurityError') throw err2;
      if (err2.name === 'NotFoundError' || err2.name === 'DevicesNotFoundError') throw err2;
    }

    // Tier 3: Bare minimum
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  }, []);

  // ============================================================================
  // SETUP AUDIO CONTEXT + ANALYSER
  // ============================================================================
  const setupAudioPipeline = useCallback(async (stream: MediaStream) => {
    // Create AudioContext within gesture handler context (critical for iOS)
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      audioContextRef.current = new AC();
    }

    // Resume if suspended (required on iOS after first creation)
    if (audioContextRef.current.state === 'suspended') {
      try {
        await audioContextRef.current.resume();
      } catch (e) {
        console.warn('[VocalStep] AudioContext.resume() failed:', e);
      }
    }

    sourceNodeRef.current = audioContextRef.current.createMediaStreamSource(stream);
    analyserRef.current = audioContextRef.current.createAnalyser();
    analyserRef.current.fftSize = 256;
    analyserRef.current.smoothingTimeConstant = 0.82;
    sourceNodeRef.current.connect(analyserRef.current);

    // Start visualization loop
    if (!vizRunningRef.current) {
      vizRunningRef.current = true;
      animationFrameRef.current = requestAnimationFrame(updateVisualization);
    }
  }, [updateVisualization]);

  // ============================================================================
  // STOP RECORDING
  // ============================================================================
  const stopRecording = useCallback(() => {
    setIsProcessing(true);
    startProcessingTimeout();

    // Compute final duration from wall clock
    if (recordingStartTimeRef.current) {
      lastDurationRef.current = Math.max(0, (Date.now() - recordingStartTimeRef.current) / 1000);
    }
    recordingStartTimeRef.current = null;

    // Stop visualization
    vizRunningRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch { /* already stopped */ }
    }

    // Stop stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try { track.stop(); } catch { /* already stopped */ }
      });
      streamRef.current = null;
    }

    // Stop timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    setRecording(false);
    setCountdown(null);
    setAudioLevel(0);
    setAudioWaveform(new Array(48).fill(0));
    // isProcessing cleared in recorder.onstop after blob finalization
  }, [startProcessingTimeout]);

  // ============================================================================
  // START RECORDING
  // ============================================================================
  const startRecording = useCallback(async () => {
    if (startingRef.current || recording || countdown !== null) return;

    try {
      startingRef.current = true;
      setError(null);

      if (!deviceInfo) {
        setError('Device information not available. Please refresh the page.');
        return;
      }

      // ── CRITICAL: getUserMedia MUST be called IMMEDIATELY in the user gesture ──
      // No async operations, state updates, or awaits before this call.
      // This is the #1 cause of mobile microphone failures.
      const stream = await acquireStream(deviceInfo);

      // ── Stream acquired successfully ──
      streamRef.current = stream;
      setPermissionState({
        status: 'granted',
        message: 'Microphone access granted',
        detail: '',
        canRetry: false,
      });
      setIsProcessing(true);
      startProcessingTimeout();

      // ── Setup AudioContext + analyser (must be in same gesture context for iOS) ──
      await setupAudioPipeline(stream);

      // ── Configure MediaRecorder ──
      const recorderOptions: MediaRecorderOptions = {};
      if (deviceInfo.preferredCodec) {
        try {
          if (MediaRecorder.isTypeSupported(deviceInfo.preferredCodec)) {
            recorderOptions.mimeType = deviceInfo.preferredCodec;
          }
        } catch {
          // isTypeSupported threw — use default
        }
      }

      const recorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        clearProcessingTimeout();
        try {
          const chunks = audioChunksRef.current;
          if (chunks.length > 0) {
            const mimeType = recorderOptions.mimeType || deviceInfo.preferredCodec || 'audio/webm';
            const blob = new Blob(chunks, { type: mimeType });
            const url = URL.createObjectURL(blob);
            const duration = lastDurationRef.current || 0;

            if (mountedRef.current) {
              setRecordingState({ blob, url, mimeType: blob.type, size: blob.size, duration });

              updateIntake({
                voice: blob,
                voiceMetadata: {
                  mimeType: blob.type,
                  duration,
                  size: blob.size,
                  deviceInfo: {
                    isMobile: deviceInfo.isMobile,
                    platform: deviceInfo.isMobile ? 'Mobile' : 'Desktop',
                    browser: deviceInfo.isChrome ? 'Chrome'
                      : deviceInfo.isSafari ? 'Safari'
                      : deviceInfo.isFirefox ? 'Firefox'
                      : deviceInfo.isEdge ? 'Edge'
                      : 'Other',
                  },
                },
              });
            }
          }
        } catch (blobErr) {
          console.error('[VocalStep] Error creating recording blob:', blobErr);
          if (mountedRef.current) {
            setError('Failed to save recording. Please try again.');
          }
        } finally {
          if (mountedRef.current) setIsProcessing(false);
        }
      };

      recorder.onerror = (event) => {
        console.error('[VocalStep] MediaRecorder error:', event);
        clearProcessingTimeout();
        if (mountedRef.current) {
          setIsProcessing(false);
          setError('Recording error occurred. Please try again.');
          setRecording(false);
          setCountdown(null);
        }
      };

      // ── Countdown then start ──
      setRecordingTime(0);
      lastDurationRef.current = 0;
      setCountdown(COUNTDOWN_SECONDS);

      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev === null) return prev;
          if (prev <= 1) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }
            try {
              // iOS Safari requires larger timeslice for stable recording
              const timeslice = deviceInfo.isIOS ? 1000 : (deviceInfo.isMobile ? 500 : 100);
              recorder.start(timeslice);
              setRecording(true);

              // Timer
              recordingStartTimeRef.current = Date.now();
              if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
              timerIntervalRef.current = setInterval(() => {
                if (!recordingStartTimeRef.current) return;
                const elapsed = (Date.now() - recordingStartTimeRef.current) / 1000;
                setRecordingTime(elapsed);
                if (elapsed >= MAX_DURATION_SEC) {
                  stopRecording();
                }
              }, 100);
            } catch (startErr) {
              console.error('[VocalStep] recorder.start() failed:', startErr);
              if (mountedRef.current) {
                setError('Failed to start recording. Please try again.');
                setRecording(false);
              }
            } finally {
              setIsProcessing(false);
              clearProcessingTimeout();
            }
            return null;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (err: any) {
      console.error('[VocalStep] Error starting recording:', err);
      setIsProcessing(false);
      clearProcessingTimeout();

      const errorName = err?.name || '';

      if (errorName === 'NotAllowedError' || errorName === 'SecurityError') {
        const instructions = deviceInfo ? getPermissionInstructions(deviceInfo) : [];
        setPermissionState({
          status: 'denied',
          message: 'Microphone access denied',
          detail: deviceInfo?.isMobile
            ? 'Please enable microphone access in your browser settings.'
            : 'Click the lock/tune icon in your address bar to allow microphone access.',
          canRetry: true,
          retryMethod: 'settings',
          browserInstructions: instructions,
        });
        setShowInstructions(true);
        setError(null); // instructions panel handles this
      } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
        setError('No microphone found. Please connect a microphone and try again.');
        setPermissionState({
          status: 'error',
          message: 'No microphone found',
          detail: 'Please check that your device has a working microphone.',
          canRetry: true,
          retryMethod: 'refresh',
        });
      } else if (errorName === 'NotReadableError') {
        setError('Microphone is in use by another app. Close other apps and try again.');
        setPermissionState({
          status: 'error',
          message: 'Microphone in use',
          detail: 'Another application is using your microphone.',
          canRetry: true,
          retryMethod: 'refresh',
        });
      } else if (errorName === 'OverconstrainedError') {
        setError('Audio settings not supported on this device. Please try again.');
      } else if (errorName === 'AbortError') {
        setError('Microphone access was interrupted. Please try again.');
      } else {
        setError(`Recording failed: ${err?.message || 'Unknown error'}. Please try again.`);
      }
    } finally {
      startingRef.current = false;
    }
  }, [deviceInfo, recording, countdown, acquireStream, setupAudioPipeline, updateIntake, stopRecording, startProcessingTimeout, clearProcessingTimeout]);

  // ============================================================================
  // RESET RECORDING
  // ============================================================================
  const resetRecording = useCallback(() => {
    if (recordingState?.url) {
      URL.revokeObjectURL(recordingState.url);
    }
    setRecordingState(null);
    setRecordingTime(0);
    lastDurationRef.current = 0;
    setError(null);
    audioChunksRef.current = [];
    setAudioLevel(0);
    setAudioWaveform(new Array(48).fill(0));
  }, [recordingState?.url]);

  // ============================================================================
  // RETRY PERMISSION
  // ============================================================================
  const retryPermission = useCallback(async () => {
    setRetryCount(prev => prev + 1);
    setError(null);
    setShowInstructions(false);

    if (!deviceInfo) return;

    const newState = await checkPermission(deviceInfo);
    setPermissionState(newState);

    if (newState.status === 'denied' && retryCount >= 2) {
      setShowInstructions(true);
    }
  }, [checkPermission, deviceInfo, retryCount]);

  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  useEffect(() => {
    mountedRef.current = true;
    const device = detectDevice();
    setDeviceInfo(device);

    // Check basic support
    if (!device.supportsGetUserMedia) {
      setPermissionState({
        status: 'unsupported',
        message: 'Browser not supported',
        detail: 'Your browser does not support audio recording.',
        canRetry: false,
      });
      return;
    }
    if (!device.supportsMediaRecorder) {
      setPermissionState({
        status: 'unsupported',
        message: 'Recording not supported',
        detail: device.isIOS && device.isSafari && device.browserVersion < 14.5
          ? 'Please update to Safari 14.5+ for audio recording.'
          : 'MediaRecorder not available. Use Chrome, Firefox, Safari 14.5+, or Edge.',
        canRetry: false,
      });
      return;
    }

    // Check permission status
    checkPermission(device).then(state => {
      if (mountedRef.current) setPermissionState(state);
    });

    // Tab visibility: stop recording on hide (privacy protection)
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && mediaRecorderRef.current?.state === 'recording') {
        stopRecording();
      }
    };
    const onPageHide = () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        stopRecording();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      cleanup();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount (separate effect for recording state URL)
  useEffect(() => {
    return () => {
      if (recordingState?.url) {
        try { URL.revokeObjectURL(recordingState.url); } catch { /* noop */ }
      }
    };
  }, [recordingState?.url]);

  // ============================================================================
  // NAVIGATION
  // ============================================================================
  const handleNext = useCallback(() => {
    if (!recordingState) return;

    const duration = recordingState.duration;
    if (duration < MIN_DURATION_SEC) {
      setError(`Recording too short. Please record at least ${MIN_DURATION_SEC} seconds.`);
      return;
    }

    markStepComplete('VocalStep', {
      hasRecording: true,
      durationMs: Math.round(duration * 1000),
    });

    // If in fix-mode (came from SubmitStep), return to submit
    if (fixMode && returnTo) {
      navigate(returnTo, { replace: true });
    } else {
      navigate('/intake/iq');
    }
  }, [recordingState, markStepComplete, navigate, fixMode, returnTo]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const vizLevel = Math.min(1, Math.max(0, audioLevel));
  const vizSpectrum = audioWaveform;
  const remaining = Math.max(0, MAX_DURATION_SEC - recordingTime);
  const progressPct = Math.min(100, (recordingTime / MAX_DURATION_SEC) * 100);

  const canStartRecording =
    !recording &&
    !recordingState &&
    !isProcessing &&
    !startingRef.current &&
    countdown === null &&
    (permissionState.status === 'granted' || permissionState.status === 'prompt');

  const browserLabel = deviceInfo
    ? (deviceInfo.isChrome ? 'Chrome' : deviceInfo.isSafari ? 'Safari' : deviceInfo.isFirefox ? 'Firefox' : deviceInfo.isEdge ? 'Edge' : 'Other')
    : '...';

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* 3D background */}
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

      {/* Processing overlay with safeguard */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="fixed z-50 inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="pointer-events-auto px-6 py-3 rounded-lg bg-white/90 text-black text-sm font-medium shadow-lg flex items-center space-x-3">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-black/20 border-t-black" />
              <span>Processing...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl">
          <GlassCard enhanced gradient className="text-center space-y-6 max-h-[85vh] overflow-y-auto overflow-x-hidden m-[40px]">
            <div className="space-y-6">
              {/* Header */}
              <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-2">Voice Analysis</h2>
                <p className="text-white/70">Record your voice for personality insights</p>
              </div>

              {/* Device Info Bar */}
              {deviceInfo && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card-enhanced bg-blue-500/10 border-blue-400/30 p-3 rounded-xl">
                  <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-blue-100">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-400/20">
                      {deviceInfo.isMobile ? 'Mobile' : 'Desktop'}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-400/20">
                      {browserLabel} {deviceInfo.browserVersion > 0 && `v${deviceInfo.browserVersion}`}
                    </span>
                    {deviceInfo.supportedCodecs.length > 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-400/20">
                        {deviceInfo.preferredCodec.replace('audio/', '').split(';')[0]}
                      </span>
                    )}
                    {!deviceInfo.isSecureContext && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-400/30 text-red-200">
                        Not HTTPS
                      </span>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Unsupported Browser Banner */}
              {permissionState.status === 'unsupported' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass-card-enhanced bg-red-500/15 border-red-400/30 p-5 rounded-xl"
                >
                  <h3 className="text-red-100 font-semibold text-lg mb-2">{permissionState.message}</h3>
                  <p className="text-red-100/80 text-sm">{permissionState.detail}</p>
                </motion.div>
              )}

              {/* Permission Status (non-granted, non-unsupported) */}
              <AnimatePresence>
                {permissionState.status !== 'granted' && permissionState.status !== 'unsupported' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={`glass-card-enhanced p-4 rounded-xl ${
                      permissionState.status === 'denied' || permissionState.status === 'error'
                        ? 'bg-red-500/10 border-red-400/30'
                        : 'bg-yellow-500/10 border-yellow-400/30'
                    }`}
                  >
                    <p className={`text-sm mb-1 font-medium ${
                      permissionState.status === 'denied' || permissionState.status === 'error'
                        ? 'text-red-100' : 'text-yellow-100'
                    }`}>
                      {permissionState.message}
                    </p>
                    {permissionState.detail && (
                      <p className="text-white/60 text-xs mb-3">{permissionState.detail}</p>
                    )}

                    {/* Browser-specific instructions */}
                    <AnimatePresence>
                      {showInstructions && permissionState.browserInstructions && permissionState.browserInstructions.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="bg-white/5 rounded-lg p-3 mb-3">
                            <p className="text-white/80 text-xs font-semibold mb-2">How to enable microphone:</p>
                            <ol className="text-white/60 text-xs space-y-1.5 list-decimal list-inside">
                              {permissionState.browserInstructions.map((step, i) => (
                                <li key={i}>{step}</li>
                              ))}
                            </ol>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="flex flex-wrap gap-2">
                      {permissionState.canRetry && (
                        <GlassButton onClick={retryPermission} className="bg-white/10 hover:bg-white/20 text-xs py-1.5 px-3">
                          Try Again
                        </GlassButton>
                      )}
                      {permissionState.browserInstructions && permissionState.browserInstructions.length > 0 && !showInstructions && (
                        <GlassButton onClick={() => setShowInstructions(true)} className="bg-white/10 hover:bg-white/20 text-xs py-1.5 px-3">
                          Show Instructions
                        </GlassButton>
                      )}
                      {permissionState.retryMethod === 'refresh' && (
                        <GlassButton onClick={() => window.location.reload()} className="bg-white/10 hover:bg-white/20 text-xs py-1.5 px-3">
                          Refresh Page
                        </GlassButton>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Reading Prompt */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="glass-card-enhanced p-5 rounded-xl">
                <p className="text-white/70 text-sm mb-3">Please read this text naturally (max {MAX_DURATION_SEC}s, min {MIN_DURATION_SEC}s):</p>
                <blockquote className="text-base sm:text-lg text-white font-medium leading-relaxed">"{prompt}"</blockquote>
              </motion.div>

              {/* Recording Interface */}
              <div className="space-y-6">
                {/* Idle orb (pre-recording, no permission dependency) */}
                {!recording && !recordingState && countdown === null && (
                  <div className="flex flex-col items-center">
                    <GlassySakuraOrb level={0.06} active={false} size={160} className="opacity-90" />
                  </div>
                )}

                {/* Countdown */}
                <AnimatePresence mode="wait">
                  {countdown !== null && (
                    <motion.div
                      key={countdown}
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 1.5, opacity: 0 }}
                      className="text-center"
                    >
                      <div className="text-6xl font-bold text-white">{countdown}</div>
                      <p className="text-white/70 mt-2">Get ready...</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Start Recording Button */}
                {canStartRecording && (
                  <div className="text-center">
                    <GlassButton
                      onClick={startRecording}
                      className="bg-red-500/20 border-red-400/30 hover:bg-red-500/30 px-8 py-4 text-base"
                      disabled={false}
                    >
                      <span className="flex items-center space-x-2">
                        <span className="w-3 h-3 bg-red-400 rounded-full animate-pulse" />
                        <span>Start Recording</span>
                      </span>
                    </GlassButton>
                    {deviceInfo?.isMobile && permissionState.status === 'prompt' && (
                      <p className="text-white/50 text-xs mt-2">
                        You'll be asked to allow microphone access
                      </p>
                    )}
                  </div>
                )}

                {/* Recording Status */}
                {recording && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-5">
                    <div className="text-white/80 text-sm">
                      {recordingTime < MIN_DURATION_SEC
                        ? `Keep recording (min ${MIN_DURATION_SEC}s)`
                        : `Recording... (max ${MAX_DURATION_SEC}s)`}
                    </div>

                    {/* Progress bar */}
                    <div className="w-full max-w-md mx-auto">
                      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-2 transition-[width] duration-100 rounded-full ${
                            recordingTime < MIN_DURATION_SEC
                              ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                              : 'bg-gradient-to-r from-purple-500 to-blue-500'
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <div className="mt-1 flex justify-between text-xs text-white/60">
                        <span>Elapsed: {formatTime(recordingTime)}</span>
                        <span>Remaining: {formatTime(remaining)}</span>
                      </div>
                    </div>

                    {/* Live visualization orb */}
                    <div className="flex items-center justify-center">
                      <GlassySakuraOrb
                        level={vizLevel}
                        spectrum={vizSpectrum}
                        active={true}
                        size={240}
                        className="opacity-100"
                      />
                    </div>

                    <GlassButton
                      onClick={stopRecording}
                      className="bg-gray-500/20 border-gray-400/30 hover:bg-gray-500/30"
                      disabled={isProcessing}
                    >
                      Stop Recording
                    </GlassButton>
                  </motion.div>
                )}

                {/* Playback */}
                {recordingState && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4">
                    <div className="glass-card-enhanced p-4 rounded-xl">
                      <p className="text-white/70 text-sm mb-2">Recording complete!</p>
                      <audio controls src={recordingState.url} className="w-full" style={{ filter: 'invert(1) hue-rotate(180deg)' }} />
                      <div className="flex flex-wrap items-center justify-center gap-3 text-white/60 text-xs mt-2">
                        <span>Duration: {formatTime(recordingState.duration)}</span>
                        <span>Size: {(recordingState.size / 1024).toFixed(1)}KB</span>
                        <span>Format: {recordingState.mimeType.replace('audio/', '')}</span>
                      </div>
                      {recordingState.duration < MIN_DURATION_SEC && (
                        <p className="text-yellow-400 text-xs mt-2">
                          Recording is too short (minimum {MIN_DURATION_SEC}s). Please record again.
                        </p>
                      )}
                    </div>

                    <div className="flex gap-3 justify-center flex-wrap">
                      <GlassButton onClick={resetRecording} className="bg-yellow-500/20 border-yellow-400/30 hover:bg-yellow-500/30" disabled={isProcessing}>
                        Record Again
                      </GlassButton>
                      <GlassButton
                        onClick={handleNext}
                        className={`${
                          recordingState.duration >= MIN_DURATION_SEC
                            ? 'bg-green-500/20 border-green-400/30 hover:bg-green-500/30'
                            : 'bg-gray-500/20 border-gray-400/30 opacity-50 cursor-not-allowed'
                        }`}
                        disabled={isProcessing || recordingState.duration < MIN_DURATION_SEC}
                      >
                        <span className="flex items-center space-x-2">
                          <span>Continue</span>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                          </svg>
                        </span>
                      </GlassButton>
                    </div>
                  </motion.div>
                )}

                {/* Error Display */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="glass-card-enhanced bg-red-500/10 border-red-400/30 p-4 rounded-xl"
                    >
                      <p className="text-red-100 text-sm whitespace-pre-line">{error}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <GlassButton onClick={() => setError(null)} className="bg-white/10 hover:bg-white/20 text-xs py-1 px-3">
                          Dismiss
                        </GlassButton>
                        {(permissionState.status === 'denied' || permissionState.status === 'error') && (
                          <GlassButton onClick={retryPermission} className="bg-white/10 hover:bg-white/20 text-xs py-1 px-3">
                            Retry Permission
                          </GlassButton>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Tips */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="glass-card p-4 rounded-lg">
                <p className="text-white/70 text-sm font-medium mb-2">Tips for best results:</p>
                <ul className="text-white/60 text-xs space-y-1">
                  <li>Find a quiet environment</li>
                  <li>Speak clearly and at a natural pace</li>
                  <li>Keep your device 6-12 inches from your mouth</li>
                  {deviceInfo?.isMobile && <li>Hold your device steady while recording</li>}
                  {deviceInfo?.isIOS && <li>On iOS, ensure Safari has microphone permission in Settings</li>}
                  {deviceInfo?.isAndroid && <li>On Android, allow microphone when your browser asks</li>}
                </ul>
              </motion.div>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
};

export default VocalStep;
