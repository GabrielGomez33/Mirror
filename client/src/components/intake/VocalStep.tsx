// src/components/intake/VocalStep.tsx
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntake } from '../../context/IntakeContext';
import GlassCard, { GlassButton } from '../ui/GlassCard';
import { motion, AnimatePresence } from 'framer-motion';
import BasicScene from '../three/BasicScene';

// Device and codec detection utilities
interface DeviceInfo {
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isSafari: boolean;
  isChrome: boolean;
  isFirefox: boolean;
  browserVersion: number;
  supportedCodecs: string[];
  preferredCodec: string;
  sampleRate: number;
  channelCount: number;
}

interface AudioAnalysis {
  duration: number;
  avgVolume: number;
  maxVolume: number;
  wordsPerMinute?: number;
  silenceRatio?: number;
  peakFrequency?: number;
}

interface RecordingState {
  blob: Blob;
  url: string;
  mimeType: string;
  size: number;
  duration: number;
}

const VocalStep = () => {
  const navigate = useNavigate();
  const { updateIntake } = useIntake();
  
  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const volumeHistoryRef = useRef<number[]>([]);
  
  // State
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingState | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioWaveform, setAudioWaveform] = useState<number[]>(new Array(50).fill(0));
  const [analysis, setAnalysis] = useState<AudioAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Enhanced prompt with phonetic coverage
  const prompt = "Hello, my name is [your name]. Today is a beautiful day, and I'm excited to explore new possibilities. The sun rose behind the hills, painting the sky with golden hues. I believe that every moment brings a chance for growth and discovery. One, two, three, four, five - taking a deep breath - six, seven, eight, nine, ten.";

  // Detect device capabilities
  const detectDeviceInfo = useCallback((): DeviceInfo => {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isAndroid = /Android/.test(ua);
    const isMobile = isIOS || isAndroid || /Mobile/.test(ua);
    const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);
    const isChrome = /Chrome/.test(ua) && !/Edge/.test(ua);
    const isFirefox = /Firefox/.test(ua);
    
    // Extract browser version
    let browserVersion = 0;
    if (isChrome) {
      const match = ua.match(/Chrome\/(\d+)/);
      browserVersion = match ? parseInt(match[1]) : 0;
    } else if (isSafari) {
      const match = ua.match(/Version\/(\d+)/);
      browserVersion = match ? parseInt(match[1]) : 0;
    } else if (isFirefox) {
      const match = ua.match(/Firefox\/(\d+)/);
      browserVersion = match ? parseInt(match[1]) : 0;
    }
    
    // Detect supported codecs
    const supportedCodecs: string[] = [];
    const codecTests = [
      'audio/webm;codecs=opus',
      'audio/webm;codecs=vp8',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg;codecs=vorbis',
      'audio/ogg',
      'audio/mp4',
      'audio/mpeg',
      'audio/wav',
      'audio/3gpp',
      'audio/3gpp2',
      'audio/aac',
      'audio/flac'
    ];
    
    codecTests.forEach(codec => {
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(codec)) {
        supportedCodecs.push(codec);
      }
    });
    
    // Fallback for browsers without isTypeSupported
    if (supportedCodecs.length === 0) {
      if (isChrome || isFirefox) {
        supportedCodecs.push('audio/webm');
      } else if (isSafari || isIOS) {
        supportedCodecs.push('audio/mp4');
      }
    }
    
    // Determine preferred codec based on device
    let preferredCodec = 'audio/webm';
    if (isIOS || isSafari) {
      preferredCodec = supportedCodecs.find(c => c.includes('mp4')) || 'audio/mp4';
    } else if (isAndroid) {
      preferredCodec = supportedCodecs.find(c => c.includes('webm')) || 
                       supportedCodecs.find(c => c.includes('ogg')) || 
                       'audio/webm';
    } else {
      preferredCodec = supportedCodecs.find(c => c.includes('opus')) || 
                       supportedCodecs[0] || 
                       'audio/webm';
    }
    
    // Determine optimal sample rate
    const sampleRate = isMobile ? 16000 : 44100;
    const channelCount = 1; // Mono for smaller file size
    
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

  // Check microphone permission with fallbacks
  const checkPermission = useCallback(async () => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setPermissionStatus(result.state as 'prompt' | 'granted' | 'denied');
        
        result.addEventListener('change', () => {
          setPermissionStatus(result.state as 'prompt' | 'granted' | 'denied');
        });
      } else {
        // Fallback for browsers without permissions API
        console.log('Permissions API not supported, will check on getUserMedia');
      }
    } catch (err) {
      console.log('Permission check failed:', err);
    }
  }, []);

  useEffect(() => {
    const info = detectDeviceInfo();
    setDeviceInfo(info);
    console.log('Device info:', info);
    
    checkPermission();
    
    // Check browser support with detailed error messages
    if (!navigator.mediaDevices) {
      setError('Your browser does not support media devices. Please use a modern browser.');
    } else if (!navigator.mediaDevices.getUserMedia) {
      setError('Your browser does not support audio recording. Please update your browser.');
    } else if (!window.MediaRecorder) {
      setError('Your browser does not support MediaRecorder. Please use Chrome, Firefox, Safari 14.1+, or Edge.');
    }
    
    // iOS-specific warnings
    if (info.isIOS && info.isSafari && info.browserVersion < 14.1) {
      setError('Audio recording requires Safari 14.1 or later on iOS. Please update your browser.');
    }
    
    // Cleanup on unmount
    return () => {
      cleanup();
    };
  }, [detectDeviceInfo, checkPermission]);

  // Comprehensive cleanup function
  const cleanup = useCallback(() => {
    // Stop recording if active
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    
    // Clear timers
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    
    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }
    
    // Revoke object URLs
    if (recordingState?.url) {
      URL.revokeObjectURL(recordingState.url);
    }
  }, [recordingState]);

  // Enhanced audio visualization with frequency analysis
  const updateAudioVisualization = useCallback(() => {
    if (!analyserRef.current || !recording) return;
    
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const freqArray = new Float32Array(bufferLength);
    
    analyserRef.current.getByteFrequencyData(dataArray);
    analyserRef.current.getFloatFrequencyData(freqArray);
    
    // Calculate volume
    let sum = 0;
    let max = 0;
    for (let i = 0; i < bufferLength; i++) {
      const value = dataArray[i] / 255;
      sum += value;
      max = Math.max(max, value);
    }
    const average = sum / bufferLength;
    setAudioLevel(average);
    
    // Store volume history for analysis
    volumeHistoryRef.current.push(average);
    if (volumeHistoryRef.current.length > 100) {
      volumeHistoryRef.current.shift();
    }
    
    // Create waveform visualization
    const barCount = 50;
    const blockSize = Math.floor(bufferLength / barCount);
    const waveform = [];
    
    for (let i = 0; i < barCount; i++) {
      let blockSum = 0;
      for (let j = 0; j < blockSize; j++) {
        blockSum += dataArray[i * blockSize + j];
      }
      waveform.push(blockSum / blockSize / 255);
    }
    
    setAudioWaveform(waveform);
    animationFrameRef.current = requestAnimationFrame(updateAudioVisualization);
  }, [recording]);

  // Start recording with device-specific configuration
  const startRecording = async () => {
    try {
      setError(null);
      volumeHistoryRef.current = [];
      
      if (!deviceInfo) {
        throw new Error('Device information not available');
      }
      
      console.log('Starting recording with codec:', deviceInfo.preferredCodec);
      
      // Request microphone with device-specific constraints
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: !deviceInfo.isIOS, // iOS has issues with echo cancellation
          noiseSuppression: !deviceInfo.isIOS,
          autoGainControl: true,
          sampleRate: deviceInfo.sampleRate,
          channelCount: deviceInfo.channelCount
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setPermissionStatus('granted');
      
      // Create MediaRecorder with appropriate options
      const recorderOptions: MediaRecorderOptions = {};
      
      if (deviceInfo.preferredCodec && deviceInfo.preferredCodec !== 'audio/wav') {
        recorderOptions.mimeType = deviceInfo.preferredCodec;
      }
      
      // Add bitrate for better quality on desktop
      if (!deviceInfo.isMobile) {
        recorderOptions.audioBitsPerSecond = 128000;
      }
      
      const recorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      
      console.log('MediaRecorder created with mimeType:', recorder.mimeType);
      
      // Set up audio context for visualization
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass({ sampleRate: deviceInfo.sampleRate });
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      analyserRef.current.smoothingTimeConstant = 0.8;
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      // Event handlers
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      recorder.onstop = async () => {
        setIsProcessing(true);
        console.log('Processing audio chunks:', audioChunksRef.current.length);
        
        try {
          const mimeType = recorder.mimeType || deviceInfo.preferredCodec;
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          
          if (audioBlob.size === 0) {
            throw new Error('No audio data captured');
          }
          
          const url = URL.createObjectURL(audioBlob);
          const duration = (Date.now() - recordingStartTimeRef.current!) / 1000;
          
          // Calculate analysis metrics
          const avgVolume = volumeHistoryRef.current.reduce((a, b) => a + b, 0) / volumeHistoryRef.current.length;
          const maxVolume = Math.max(...volumeHistoryRef.current);
          const silenceRatio = volumeHistoryRef.current.filter(v => v < 0.1).length / volumeHistoryRef.current.length;
          const wordCount = prompt.split(' ').length;
          
          const recordingData: RecordingState = {
            blob: audioBlob,
            url,
            mimeType,
            size: audioBlob.size,
            duration
          };
          
          setRecordingState(recordingData);
          setAnalysis({
            duration,
            avgVolume,
            maxVolume,
            wordsPerMinute: Math.round((wordCount / duration) * 60),
            silenceRatio
          });
          
          // Update intake with comprehensive data
          updateIntake({ 
            voice: audioBlob,
            voiceMetadata: {
              mimeType,
              duration,
              size: audioBlob.size,
              deviceInfo: {
                isMobile: deviceInfo.isMobile,
                platform: deviceInfo.isIOS ? 'iOS' : deviceInfo.isAndroid ? 'Android' : 'Desktop',
                browser: deviceInfo.isChrome ? 'Chrome' : deviceInfo.isSafari ? 'Safari' : deviceInfo.isFirefox ? 'Firefox' : 'Other'
              },
              analysis: {
                avgVolume,
                maxVolume,
                silenceRatio,
                wordsPerMinute: Math.round((wordCount / duration) * 60)
              }
            },
            voicePrompt: prompt
          });
        } catch (err) {
          console.error('Error processing recording:', err);
          setError('Failed to process recording. Please try again.');
        } finally {
          setIsProcessing(false);
        }
      };
      
      recorder.onerror = (event: any) => {
        console.error('MediaRecorder error:', event);
        setError(`Recording error: ${event.error?.message || 'Unknown error'}`);
      };
      
      // Start countdown
      setCountdown(3);
      let countdownValue = 3;
      
      const countdownInterval = setInterval(() => {
        countdownValue--;
        setCountdown(countdownValue);
        
        if (countdownValue === 0) {
          clearInterval(countdownInterval);
          setCountdown(null);
          
          // Start recording with appropriate chunk size
          const timeslice = deviceInfo.isMobile ? 1000 : 100; // Larger chunks on mobile
          recorder.start(timeslice);
          console.log('Recording started with timeslice:', timeslice);
          
          setRecording(true);
          recordingStartTimeRef.current = Date.now();
          
          // Start visualization
          updateAudioVisualization();
          
          // Start timer
          timerIntervalRef.current = setInterval(() => {
            const elapsed = (Date.now() - recordingStartTimeRef.current!) / 1000;
            setRecordingTime(elapsed);
            
            // Auto-stop after 60 seconds
            if (elapsed >= 60) {
              console.log('Auto-stopping after 60 seconds');
              stopRecording();
            }
          }, 100);
        }
      }, 1000);
      
    } catch (err: any) {
      console.error('Error starting recording:', err);
      
      // Detailed error messages
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Microphone access denied. Please allow microphone access in your browser settings.');
        setPermissionStatus('denied');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No microphone found. Please connect a microphone and try again.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('Microphone is already in use by another application.');
      } else if (err.name === 'OverconstrainedError') {
        setError('Your device does not support the requested audio settings.');
      } else if (err.name === 'TypeError' && deviceInfo?.isIOS) {
        setError('Please ensure you are using Safari on iOS for audio recording.');
      } else {
        setError(`Failed to start recording: ${err.message || 'Unknown error'}`);
      }
    }
  };

  // Stop recording
  const stopRecording = () => {
    console.log('Stopping recording...');
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
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
    setAudioLevel(0);
    setAudioWaveform(new Array(50).fill(0));
  };

  // Reset recording
  const resetRecording = () => {
    if (recordingState?.url) {
      URL.revokeObjectURL(recordingState.url);
    }
    setRecordingState(null);
    setRecordingTime(0);
    setAnalysis(null);
    setError(null);
    audioChunksRef.current = [];
  };

  const handleNext = () => {
    navigate('/intake/personality');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Three.js Background */}
      <BasicScene />
      
      {/* Gradient overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ duration: 1.5 }}
        className="absolute inset-0 bg-gradient-to-br from-purple-100/50 via-pink-50/30 to-blue-100/50 pointer-events-none"
      />

      <div className="relative z-10 min-h-screen flex flex-col justify-center items-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="w-full max-w-2xl"
        >
          <GlassCard enhanced gradient className="text-center space-y-6 max-h-[85vh] overflow-y-auto overflow-x-hidden mx-4">
            {/* Header */}
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5 }}
              className="space-y-4"
            >
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
              </div>
              
              <h2 className="text-3xl font-bold text-white text-shadow-soft">Voice Analysis</h2>
              <p className="text-white/80">
                Record yourself reading the prompt below to analyze your unique vocal characteristics
              </p>
            </motion.div>

            {/* Device Info (Debug - can be hidden in production) */}
            {deviceInfo && process.env.NODE_ENV === 'development' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-card p-3 rounded-lg text-xs text-white/60"
              >
                <p>Device: {deviceInfo.isMobile ? 'Mobile' : 'Desktop'} | 
                   Browser: {deviceInfo.isChrome ? 'Chrome' : deviceInfo.isSafari ? 'Safari' : deviceInfo.isFirefox ? 'Firefox' : 'Other'} |
                   Codec: {deviceInfo.preferredCodec}</p>
              </motion.div>
            )}

            {/* Permission Status */}
            {permissionStatus === 'denied' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-card-enhanced bg-orange-500/10 border-orange-400/30 p-4 rounded-xl"
              >
                <p className="text-orange-100 text-sm mb-2">
                  Microphone access is blocked. 
                </p>
                <p className="text-orange-100/80 text-xs">
                  {deviceInfo?.isIOS 
                    ? 'Go to Settings > Safari > Microphone and allow access'
                    : 'Click the lock icon in your address bar and allow microphone access'}
                </p>
              </motion.div>
            )}

            {/* Prompt */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="glass-card-enhanced p-6 rounded-xl"
            >
              <p className="text-white/70 text-sm mb-3">Please read this text naturally:</p>
              <blockquote className="text-lg text-white font-medium leading-relaxed">
                "{prompt}"
              </blockquote>
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
                    transition={{ duration: 0.3 }}
                    className="text-6xl font-bold text-white"
                  >
                    {countdown}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Recording Status */}
              {recording && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-center space-x-3">
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="w-3 h-3 bg-red-500 rounded-full shadow-lg shadow-red-500/50"
                    />
                    <span className="text-white font-medium">Recording</span>
                    <span className="text-white/70 font-mono">{formatTime(recordingTime)}</span>
                  </div>
                  
                  {/* Audio Waveform Visualization */}
                  <div className="flex items-center justify-center space-x-1 h-16">
                    {audioWaveform.map((level, index) => (
                      <motion.div
                        key={index}
                        className="w-1 bg-gradient-to-t from-purple-400 to-blue-400 rounded-full"
                        animate={{ height: `${Math.max(4, level * 64)}px` }}
                        transition={{ duration: 0.1, ease: 'easeOut' }}
                        style={{ opacity: 0.7 + level * 0.3 }}
                      />
                    ))}
                  </div>
                  
                  {/* Volume Level */}
                  <div className="glass-card-enhanced p-3 rounded-lg">
                    <div className="flex justify-between text-sm text-white/70 mb-1">
                      <span>Volume Level</span>
                      <span>{Math.round(audioLevel * 100)}%</span>
                    </div>
                    <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full ${
                          audioLevel < 0.3 ? 'bg-yellow-400' : 
                          audioLevel < 0.7 ? 'bg-green-400' : 
                          'bg-red-400'
                        }`}
                        animate={{ width: `${audioLevel * 100}%` }}
                        transition={{ duration: 0.1 }}
                      />
                    </div>
                    {audioLevel < 0.2 && (
                      <p className="text-yellow-300 text-xs mt-1">Speak a bit louder</p>
                    )}
                  </div>

                  {/* Max recording time warning */}
                  {recordingTime > 50 && (
                    <p className="text-yellow-300 text-sm">
                      Recording will stop at 60 seconds
                    </p>
                  )}
                </motion.div>
              )}

              {/* Processing indicator */}
              {isProcessing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-center space-x-2 text-white"
                >
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                  <span>Processing audio...</span>
                </motion.div>
              )}

              {/* Control Buttons */}
              {!recordingState && !countdown && !isProcessing && (
                <GlassButton
                  onClick={recording ? stopRecording : startRecording}
                  disabled={permissionStatus === 'denied' || !!error}
                  className={`min-w-[200px] ${
                    recording 
                      ? 'bg-red-500/20 hover:bg-red-500/30 border-red-400/50' 
                      : 'bg-gradient-to-r from-purple-400/20 to-blue-400/20 hover:from-purple-400/30 hover:to-blue-400/30'
                  }`}
                >
                  <span className="flex items-center justify-center space-x-2">
                    {recording ? (
                      <>
                        <div className="w-4 h-4 bg-white rounded" />
                        <span>Stop Recording</span>
                      </>
                    ) : (
                      <>
                        <div className="w-4 h-4 bg-red-500 rounded-full" />
                        <span>Start Recording</span>
                      </>
                    )}
                  </span>
                </GlassButton>
              )}

              {/* Audio Preview */}
              <AnimatePresence>
                {recordingState && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-4"
                  >
                    <div className="glass-card-enhanced p-4 rounded-xl">
                      <p className="text-white/70 text-sm mb-3">Your Recording:</p>
                      <audio 
                        controls 
                        src={recordingState.url} 
                        className="w-full" 
                        style={{ filter: 'invert(1)' }}
                      />
                      
                      {/* Recording details */}
                      <div className="mt-3 flex justify-between text-xs text-white/60">
                        <span>Format: {recordingState.mimeType.split('/')[1].split(';')[0].toUpperCase()}</span>
                        <span>Size: {formatFileSize(recordingState.size)}</span>
                      </div>
                      
                      {analysis && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.3 }}
                          className="mt-4 grid grid-cols-2 gap-3 text-sm"
                        >
                          <div className="glass-card p-3 rounded-lg">
                            <p className="text-white/60">Duration</p>
                            <p className="text-white font-medium">{analysis.duration.toFixed(1)}s</p>
                          </div>
                          <div className="glass-card p-3 rounded-lg">
                            <p className="text-white/60">Speaking Rate</p>
                            <p className="text-white font-medium">~{analysis.wordsPerMinute} wpm</p>
                          </div>
                          <div className="glass-card p-3 rounded-lg">
                            <p className="text-white/60">Avg Volume</p>
                            <p className="text-white font-medium">{Math.round(analysis.avgVolume * 100)}%</p>
                          </div>
                          <div className="glass-card p-3 rounded-lg">
                            <p className="text-white/60">Voice Clarity</p>
                            <p className="text-white font-medium">
                              {analysis.silenceRatio! < 0.3 ? 'Good' : 'Fair'}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </div>

                    <div className="flex gap-3 justify-center">
                      <GlassButton
                        onClick={resetRecording}
                        className="bg-white/10 hover:bg-white/20"
                      >
                        <span className="flex items-center space-x-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span>Re-record</span>
                        </span>
                      </GlassButton>
                      
                      <GlassButton
                        onClick={handleNext}
                        className="bg-gradient-to-r from-purple-400/20 to-blue-400/20 hover:from-purple-400/30 hover:to-blue-400/30"
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
              </AnimatePresence>

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
                    {error.includes('microphone') && deviceInfo?.isMobile && (
                      <p className="text-red-100/80 text-xs mt-2">
                        Tip: Make sure no other apps are using your microphone
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Tips for better recording */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="glass-card p-4 rounded-lg"
            >
              <p className="text-white/70 text-sm font-medium mb-2">Tips for best results:</p>
              <ul className="text-white/60 text-xs space-y-1">
                <li>• Find a quiet environment</li>
                <li>• Speak clearly and at a natural pace</li>
                <li>• Keep your device 6-12 inches from your mouth</li>
                {deviceInfo?.isMobile && <li>• Hold your device steady while recording</li>}
              </ul>
            </motion.div>

            {/* Skip Option */}
            <div className="pt-4 border-t border-white/10">
              <button
                onClick={handleNext}
                className="text-white/50 hover:text-white/70 text-sm transition-colors"
              >
                Skip voice analysis →
              </button>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
};

export default VocalStep;
