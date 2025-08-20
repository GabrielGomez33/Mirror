// src/components/intake/VocalStep.tsx
// ENHANCED: Comprehensive permission handling and error recovery (debugged & hardened)
// Now showing live audio level (vertical black bar) and an isProcessing loading state.

import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntake } from '../../context/IntakeContext';
import GlassCard, { GlassButton } from '../ui/GlassCard';
import { motion, AnimatePresence } from 'framer-motion';

interface DeviceInfo {
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isSafari: boolean;
  isChrome: boolean;
  isFirefox: boolean;
  browserVersion: number;
  supportedCodecs: string[];
  preferredCodec: string; // e.g. 'audio/webm;codecs=opus' | 'audio/mp4'
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

interface PermissionState {
  status: 'unknown' | 'checking' | 'prompt' | 'granted' | 'denied' | 'error';
  message: string;
  canRetry: boolean;
  retryMethod?: 'settings' | 'refresh' | 'getUserMedia';
}

const VocalStep = () => {
  const navigate = useNavigate();
  const { updateIntake, markStepComplete, getIntake } = useIntake();

  useEffect(() => {
    try {
      localStorage.setItem('mirror:intake:lastStep', 'vocal');
    } catch {}
  }, []);

  useEffect(() => {
    const meta = (getIntake as any)?.voiceMeta as
      | { blobUrl?: string; durationMs?: number }
      | undefined;
  
    if (meta?.blobUrl) {
      setRecordingState(prev => {
        if (!prev) return prev; // no prior blob → can't build a full RecordingState safely
        return {
          ...prev, // keeps the required `blob`
          url: meta.blobUrl!,
          duration:
            typeof meta.durationMs === 'number' ? meta.durationMs : prev.duration,
        };
      });
    }
  }, [getIntake]);
  

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // State
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [permissionState, setPermissionState] = useState<PermissionState>({
    status: 'unknown',
    message: 'Checking microphone access...',
    canRetry: false
  });
  const [recording, setRecording] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingState | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);

  // NOW USED: audio level + processing flag
  const [audioLevel, setAudioLevel] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const [audioWaveform, setAudioWaveform] = useState<number[]>(new Array(50).fill(0));
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const prompt =
    "Hello, my name is [your name]. Today is a beautiful day, and I'm excited to explore new possibilities. The sun rose behind the hills, painting the sky with golden hues. I believe that every moment brings a chance for growth and discovery. One, two, three, four, five - taking a deep breath - six, seven, eight, nine, ten.";

  // Enhanced device detection
  const detectDeviceInfo = useCallback((): DeviceInfo => {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isAndroid = /Android/.test(ua);
    const isMobile = isIOS || isAndroid || /Mobile/.test(ua);
    const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);
    const isChrome = /Chrome/.test(ua) && !/Edg/.test(ua) && !/OPR/.test(ua);
    const isFirefox = /Firefox/.test(ua);

    let browserVersion = 0;
    if (isSafari) {
      const m = ua.match(/Version\/(\d+)/);
      browserVersion = m ? parseInt(m[1]) : 0;
    } else if (isChrome) {
      const m = ua.match(/Chrome\/(\d+)/);
      browserVersion = m ? parseInt(m[1]) : 0;
    } else if (isFirefox) {
      const m = ua.match(/Firefox\/(\d+)/);
      browserVersion = m ? parseInt(m[1]) : 0;
    }

    const supportedCodecs: string[] = [];
    let preferredCodec = isIOS ? 'audio/mp4' : 'audio/webm;codecs=opus';

    if (typeof MediaRecorder !== 'undefined') {
      const order = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
      for (const c of order) {
        if ((MediaRecorder as any).isTypeSupported?.(c)) supportedCodecs.push(c);
      }
      const pick = order.find((c) => supportedCodecs.includes(c));
      if (pick) preferredCodec = pick;
    }

    const sampleRate = isMobile ? 16000 : 44100;
    const channelCount = 1;

    return {
      isMobile,
      isIOS,
      isAndroid,
      isSafari,
      isChrome,
      isFirefox,
      browserVersion,
      supportedCodecs,
      preferredCodec,
      sampleRate,
      channelCount
    };
  }, []);

  // Comprehensive permission checking
  const checkMicrophonePermission = useCallback(async (): Promise<PermissionState> => {
    setPermissionState({
      status: 'checking',
      message: 'Checking microphone permissions...',
      canRetry: false
    });

    try {
      // Method 1: Permissions API
      if ('permissions' in navigator && (navigator as any).permissions?.query) {
        try {
          const permissionStatus = await (navigator as any).permissions.query({
            name: 'microphone' as PermissionName
          });

          if (permissionStatus.state === 'granted') {
            return { status: 'granted', message: 'Microphone access granted', canRetry: false };
          } else if (permissionStatus.state === 'denied') {
            return {
              status: 'denied',
              message:
                'Microphone access denied. Use your browser site settings to enable microphone.',
              canRetry: true,
              retryMethod: 'settings'
            };
          } else {
            return {
              status: 'prompt',
              message: 'Click "Allow" to enable microphone for recording.',
              canRetry: true,
              retryMethod: 'getUserMedia'
            };
          }
        } catch {
          // fall through
        }
      }

      // Method 2: getUserMedia probe
      try {
        const testStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false }
        });
        testStream.getTracks().forEach((t) => t.stop());
        return { status: 'granted', message: 'Microphone access granted', canRetry: false };
      } catch (getUserMediaError: any) {
        if (getUserMediaError.name === 'NotAllowedError') {
          return {
            status: 'denied',
            message: 'Microphone access denied. Please allow access and refresh.',
            canRetry: true,
            retryMethod: 'refresh'
          };
        } else if (getUserMediaError.name === 'NotFoundError') {
          return {
            status: 'error',
            message: 'No microphone found. Connect a microphone and try again.',
            canRetry: true,
            retryMethod: 'refresh'
          };
        } else {
          return {
            status: 'error',
            message: `Microphone error: ${getUserMediaError.message || getUserMediaError}`,
            canRetry: true,
            retryMethod: 'refresh'
          };
        }
      }
    } catch {
      return {
        status: 'error',
        message: 'Unable to check microphone permissions. Please use a modern browser.',
        canRetry: true,
        retryMethod: 'refresh'
      };
    }
  }, []);

  // Cleanup (securely release all resources)
  const cleanup = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
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
    try {
      sourceNodeRef.current?.disconnect();
      analyserRef.current?.disconnect();
    } catch {}
    sourceNodeRef.current = null;
    analyserRef.current = null;

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    if (recordingState?.url) {
      URL.revokeObjectURL(recordingState.url);
    }
  }, [recordingState?.url]);

  // Init device & initial permission check
  useEffect(() => {
    const info = detectDeviceInfo();
    setDeviceInfo(info);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Your browser does not support audio recording. Please update your browser.');
      return;
    }
    if (typeof (window as any).MediaRecorder === 'undefined') {
      setError('MediaRecorder is not supported. Use Chrome, Firefox, Safari 14.1+, or Edge.');
      return;
    }
    if (info.isIOS && info.isSafari && info.browserVersion < 14) {
      setError('Audio recording requires Safari 14+ on iOS. Please update your browser.');
      return;
    }

    let mounted = true;
    checkMicrophonePermission().then((st) => {
      if (mounted) setPermissionState(st);
    });

    return () => {
      mounted = false;
      cleanup();
    };
  }, [detectDeviceInfo, checkMicrophonePermission, cleanup]);

  // Permission retry
  const retryPermission = useCallback(async () => {
    setRetryCount((prev) => prev + 1);
    setError(null);
    const newState = await checkMicrophonePermission();
    setPermissionState(newState);

    if (newState.status === 'denied' && retryCount >= 2) {
      setError('Microphone is blocked. Use your browser site settings (🔒 icon) to allow microphone.');
    }
  }, [checkMicrophonePermission, retryCount]);

  // Visualization loop (updates audioLevel + waveform)
  const updateAudioVisualization = useCallback(() => {
    if (!analyserRef.current || !recording) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < bufferLength; i++) sum += dataArray[i] / 255;
    const average = sum / bufferLength;
    setAudioLevel(average); // 0..1

    const barCount = 50;
    const blockSize = Math.max(1, Math.floor(bufferLength / barCount));
    const waveform: number[] = [];
    for (let i = 0; i < barCount; i++) {
      let blockSum = 0;
      for (let j = 0; j < blockSize; j++) {
        const idx = i * blockSize + j;
        if (idx < bufferLength) blockSum += dataArray[idx];
      }
      waveform.push(blockSum / blockSize / 255);
    }
    setAudioWaveform(waveform);

    animationFrameRef.current = requestAnimationFrame(updateAudioVisualization);
  }, [recording]);

  // Common init path once we have a stream
  const initWithStream = useCallback(
    async (stream: MediaStream) => {
      streamRef.current = stream;
      setPermissionState((prev) => ({
        ...(prev || { status: 'granted', message: '', canRetry: false }),
        status: 'granted'
      }));

      // recorder options
      const options: MediaRecorderOptions = {};
      if (deviceInfo?.preferredCodec && (MediaRecorder as any).isTypeSupported?.(deviceInfo.preferredCodec)) {
        options.mimeType = deviceInfo.preferredCodec;
      }

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      // audio context + analyser
      if (!audioContextRef.current) {
        const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
        audioContextRef.current = new AC();
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      sourceNodeRef.current = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      sourceNodeRef.current.connect(analyserRef.current);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        setIsProcessing(true); // finalize blob + update intake securely
        try {
          const chunks = audioChunksRef.current;
          if (chunks && chunks.length > 0) {
            const type = options.mimeType || deviceInfo?.preferredCodec || 'audio/webm';
            const blob = new Blob(chunks, { type });
            const url = URL.createObjectURL(blob);
            const duration = recordingTime || 0;
      
            setRecordingState({
              blob,
              url,
              mimeType: blob.type,
              size: blob.size,
              duration,
            });
      
            // Blob stays only in memory (context), IntakeProvider already avoids
            // persisting `voice` to localStorage. Metadata is serializable.
            updateIntake({
              voice: blob,
              voiceMetadata: {
                mimeType: blob.type,
                duration,
                size: blob.size,
                deviceInfo: {
                  isMobile: !!deviceInfo?.isMobile,
                  platform: deviceInfo?.isMobile ? 'Mobile' : 'Desktop',
                  browser: deviceInfo?.isChrome
                    ? 'Chrome'
                    : deviceInfo?.isSafari
                    ? 'Safari'
                    : deviceInfo?.isFirefox
                    ? 'Firefox'
                    : 'Other',
                },
              },
            });
          }
        } finally {
          setIsProcessing(false);
        }
      };
      
      

      // countdown then start
      setRecordingTime(0);
      setCountdown(3);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null) return prev;
          if (prev <= 1) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }
            try {
              const timeslice = deviceInfo?.isMobile ? 1000 : 100;
              recorder.start(timeslice);
              setRecording(true);
              recordingStartTimeRef.current = Date.now();

              updateAudioVisualization();
              if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
              timerIntervalRef.current = setInterval(() => {
                if (!recordingStartTimeRef.current) return;
                const elapsed = (Date.now() - recordingStartTimeRef.current) / 1000;
                setRecordingTime(elapsed);
                if (elapsed >= 60) stopRecording(); // auto-stop
              }, 100);
            } finally {
              setIsProcessing(false); // we’re actively recording now
            }
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [deviceInfo, updateIntake, updateAudioVisualization, recordingTime]
  );

  // Start recording with constraints
  const startRecording = async () => {
    try {
      setError(null);
      setIsProcessing(true); // show loading while we secure mic access & init

      if (!deviceInfo) throw new Error('Device information not available');

      // re-check permission
      if (permissionState.status !== 'granted') {
        const st = await checkMicrophonePermission();
        setPermissionState(st);
        if (st.status !== 'granted') {
          setError('Microphone permission required. Please allow access and try again.');
          setIsProcessing(false);
          return;
        }
      }

      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: !deviceInfo.isIOS,
          noiseSuppression: !deviceInfo.isIOS,
          autoGainControl: true,
          sampleRate: deviceInfo.sampleRate,
          channelCount: deviceInfo.channelCount
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      await initWithStream(stream);
      // `initWithStream` will set isProcessing false right after recorder starts
    } catch (err: any) {
      console.error('Error starting recording:', err);
      setIsProcessing(false);

      if (err?.name === 'NotAllowedError') {
        setError('Microphone access denied. Please click "Allow" when prompted.');
        setPermissionState({
          status: 'denied',
          message: 'Please allow microphone access',
          canRetry: true,
          retryMethod: 'getUserMedia'
        });
      } else if (err?.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone and try again.');
      } else if (err?.name === 'NotReadableError') {
        setError('Microphone is being used by another application. Close other apps and try again.');
      } else if (err?.name === 'OverconstrainedError') {
        setError('Requested audio settings not supported. Retrying with basic settings…');
        setTimeout(() => retryWithBasicConstraints(), 300);
      } else {
        setError(`Recording failed: ${err?.message || 'Unknown error'}`);
      }
    }
  };

  // Retry with basic constraints if initial attempt fails
  const retryWithBasicConstraints = async () => {
    try {
      setIsProcessing(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      await initWithStream(stream);
    } catch {
      setError('Unable to access microphone with any settings. Please check your device.');
    } finally {
      // initWithStream handles setting processing off when recording starts
    }
  };

  // Stop recording
  const stopRecording = () => {
    // Indicate we’re finalizing
    setIsProcessing(true);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    setRecording(false);
    setCountdown(null);
    setAudioLevel(0);
    setAudioWaveform(new Array(50).fill(0));
    // isProcessing will be turned off in recorder.onstop after blob is finalized
  };

  // Reset recording
  const resetRecording = () => {
    if (recordingState?.url) {
      URL.revokeObjectURL(recordingState.url);
    }
    setRecordingState(null);
    setRecordingTime(0);
    setError(null);
    audioChunksRef.current = [];
    setAudioLevel(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleNext = () => {
  	markStepComplete('VocalStep', {
  	  hasRecording: !!recordingState?.url,
  	  durationMs: recordingState?.duration ?? 0
  	});
    navigate('/intake/iq');
  };

  useEffect(() => {
    return () => {
      // stop any running interval timers you may have
      try {
        if (timerIntervalRef.current != null) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
      } catch {}
  
      // stop recorder gracefully
      try {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      } catch {}
  
      // stop mic tracks
      try {
        streamRef.current?.getTracks()?.forEach((t) => t.stop());
      } catch {}
  
      // revoke any blob URL we created this session
      try {
        if (recordingState?.url) URL.revokeObjectURL(recordingState.url);
      } catch {}
    };
    // include refs/state you actually use here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      {/* Processing overlay (blocks interaction during sensitive transitions) */}
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
            <div className="pointer-events-auto px-4 py-2 rounded-lg bg-white/90 text-black text-sm font-medium shadow-lg">
              Processing…
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl">
        <GlassCard className="p-8">
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-white mb-2">Voice Analysis</h2>
              <p className="text-white/70">Record your voice for personality insights</p>
            </div>

            {/* Device & Permission Status */}
            {deviceInfo && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card-enhanced bg-blue-500/10 border-blue-400/30 p-4 rounded-xl">
                <p className="text-blue-100 text-sm">
                  Device: {deviceInfo.isMobile ? 'Mobile' : 'Desktop'} | Browser:{' '}
                  {deviceInfo.isChrome ? 'Chrome' : deviceInfo.isSafari ? 'Safari' : deviceInfo.isFirefox ? 'Firefox' : 'Other'} | Codec: {deviceInfo.preferredCodec}
                </p>
              </motion.div>
            )}

            {/* Permission Status */}
            <AnimatePresence>
              {permissionState.status !== 'granted' && (
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
                  <p
                    className={`text-sm mb-2 ${
                      permissionState.status === 'denied' || permissionState.status === 'error' ? 'text-red-100' : 'text-yellow-100'
                    }`}
                  >
                    {permissionState.message}
                  </p>
                  {permissionState.canRetry && (
                    <GlassButton onClick={retryPermission} className="bg-white/10 hover:bg-white/20 text-sm py-2 px-4">
                      🔄 Try Again
                    </GlassButton>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Recording Prompt */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="glass-card-enhanced p-6 rounded-xl">
              <p className="text-white/70 text-sm mb-3">Please read this text naturally:</p>
              <blockquote className="text-lg text-white font-medium leading-relaxed">"{prompt}"</blockquote>
            </motion.div>

            {/* Recording Interface */}
            <div className="space-y-6">
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
                    <p className="text-white/70">Get ready...</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Recording Controls */}
              {!recording && !recordingState && permissionState.status === 'granted' && (
                <div className="text-center">
                  <GlassButton
                    onClick={startRecording}
                    className="bg-red-500/20 border-red-400/30 hover:bg-red-500/30 px-8 py-4"
                    disabled={isProcessing}
                  >
                    <span className="flex items-center space-x-2">
                      <span className="w-3 h-3 bg-red-400 rounded-full animate-pulse"></span>
                      <span>Start Recording</span>
                    </span>
                  </GlassButton>
                </div>
              )}

              {/* Recording Status */}
              {recording && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-4">
                  <div className="text-2xl font-bold text-white">{formatTime(recordingTime)}</div>

                  {/* Simple vertical black bar (audio level meter) */}
                  <div className="flex items-end justify-center h-24">
                    <div className="w-[4px] bg-black rounded-full transition-[height] duration-100"
                      style={{ height: `${Math.max(6, Math.min(1, audioLevel)) * 96}px` }}
                      aria-label="Audio level meter"
                    />
                  </div>

                  {/* (Keeping waveform for future—can remove if you want it ultra-minimal) */}
                  <div className="flex justify-center space-x-1 h-16">
                    {audioWaveform.map((level, index) => (
                      <div
                        key={index}
                        className="bg-gradient-to-t from-purple-500 to-blue-400 rounded-full transition-all duration-100"
                        style={{
                          width: '3px',
                          height: `${Math.max(4, level * 60)}px`,
                          opacity: 0.7 + level * 0.3
                        }}
                      />
                    ))}
                  </div>

                  <GlassButton onClick={stopRecording} className="bg-gray-500/20 border-gray-400/30 hover:bg-gray-500/30" disabled={isProcessing}>
                    ⏹️ Stop Recording
                  </GlassButton>
                </motion.div>
              )}

              {/* Playback */}
              {recordingState && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4">
                  <div className="glass-card-enhanced p-4 rounded-xl">
                    <p className="text-white/70 text-sm mb-2">Recording complete!</p>
                    <audio controls src={recordingState.url} className="w-full" style={{ filter: 'invert(1) hue-rotate(180deg)' }} />
                    <p className="text-white/60 text-xs mt-2">
                      Duration: {formatTime(recordingState.duration)} | Size: {(recordingState.size / 1024).toFixed(1)}KB
                    </p>
                  </div>

                  <div className="flex gap-4 justify-center">
                    <GlassButton onClick={resetRecording} className="bg-yellow-500/20 border-yellow-400/30 hover:bg-yellow-500/30" disabled={isProcessing}>
                      🔄 Record Again
                    </GlassButton>
                    <GlassButton onClick={handleNext} className="bg-green-500/20 border-green-400/30 hover:bg-green-500/30" disabled={isProcessing}>
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
                    <p className="text-red-100 text-sm">{error}</p>
                    {error.toLowerCase().includes('microphone') && deviceInfo?.isMobile && (
                      <p className="text-red-100/80 text-xs mt-2">Tip: Ensure no other apps are using your microphone.</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Tips */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="glass-card p-4 rounded-lg">
              <p className="text-white/70 text-sm font-medium mb-2">Tips for best results:</p>
              <ul className="text-white/60 text-xs space-y-1">
                <li>• Find a quiet environment</li>
                <li>• Speak clearly and at a natural pace</li>
                <li>• Keep your device 6–12 inches from your mouth</li>
                {deviceInfo?.isMobile && <li>• Hold your device steady while recording</li>}
              </ul>
            </motion.div>

      
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
};

export default VocalStep;
