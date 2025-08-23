// src/components/intake/VisualStep.tsx
// ENHANCED: Camera permission handling, retry logic, robust error handling, and strict TS safety

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntake } from '../../context/IntakeContext';
import { useFaceApi } from '../../hooks/useFaceApi';
import GlassCard, { GlassButton, GlassProgress } from '../ui/GlassCard';
import { motion, AnimatePresence } from 'framer-motion';

interface CameraState {
  hasPermission: boolean;
  permissionStatus: 'unknown' | 'checking' | 'granted' | 'denied' | 'error';
  stream: MediaStream | null;
  isActive: boolean;
  error: string | null;
}

interface CaptureState {
  mode: 'upload' | 'camera';
  preview: string | null;
  hasPhoto: boolean;
  isCapturing: boolean;
  captureError: string | null;
}

interface AnalysisState {
  isAnalyzing: boolean;
  hasAnalysis: boolean;
  error: string | null;
  // result type is any because face-api.js typing varies; keep flexible but safe
  results: any;
  retryCount: number;
}

const VisualStep: React.FC = () => {
  const navigate = useNavigate();
  const { updateIntake, markStepComplete } = useIntake();
  const { isModelLoaded, loadingError, loadingProgress, analyzeImage } = useFaceApi();

  // Refs
  const imgRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State
  const [cameraState, setCameraState] = useState<CameraState>({
    hasPermission: false,
    permissionStatus: 'unknown',
    stream: null,
    isActive: false,
    error: null,
  });

  const [captureState, setCaptureState] = useState<CaptureState>({
    mode: 'upload',
    preview: null,
    hasPhoto: false,
    isCapturing: false,
    captureError: null,
  });

  const [analysisState, setAnalysisState] = useState<AnalysisState>({
    isAnalyzing: false,
    hasAnalysis: false,
    error: null,
    results: null,
    retryCount: 0,
  });

  const mountId = useRef(Math.random().toString(36).substr(2, 9));
  	  
  useEffect(() => {
  	console.log(`🔄 VisualStep MOUNTED (ID: ${mountId.current})`);
  	return () => console.log(`💀 VisualStep UNMOUNTED (ID: ${mountId.current})`);
  }, []);	
  
  // --- Helpers ---------------------------------------------------------------

  // Coerce loadingProgress from the face API into a 0–100 number
  const progressValue = (() => {
    const val: unknown = loadingProgress as unknown;
    if (typeof val === 'number' && isFinite(val)) return Math.max(0, Math.min(100, val));
    if (typeof val === 'string') {
      const m = val.match(/(\d{1,3})\s*%/); // e.g., "57%"
      if (m) return Math.max(0, Math.min(100, parseInt(m[1], 10)));
      if (val.toLowerCase().includes('ready')) return 100;
    }
    return 0;
  })();
  

  // Revoke preview URL safely
  const revokePreview = useCallback(() => {
    if (captureState.preview) {
      URL.revokeObjectURL(captureState.preview);
    }
  }, [captureState.preview]);

  // Stop camera tracks safely
  const stopCameraTracks = useCallback(() => {
    if (cameraState.stream) {
      try {
        cameraState.stream.getTracks().forEach((t) => t.stop());
      } catch {
        // noop
      }
    }
  }, [cameraState.stream]);

  // --- Permissions -----------------------------------------------------------

  const checkCameraPermission = useCallback(async (): Promise<boolean> => {
    setCameraState((prev) => ({ ...prev, permissionStatus: 'checking', error: null }));

    try {
      // Prefer Permissions API if available
      // TS lib.dom doesn't yet include "camera" in PermissionName everywhere → cast guardedly
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const navAny = navigator as any;

      if (navAny?.permissions?.query) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const permission: any = await navAny.permissions.query({ name: 'camera' as any });
          if (permission?.state === 'granted') {
            setCameraState((p) => ({ ...p, hasPermission: true, permissionStatus: 'granted' }));
            return true;
          }
          if (permission?.state === 'denied') {
            setCameraState((p) => ({
              ...p,
              hasPermission: false,
              permissionStatus: 'denied',
              error:
                'Camera access denied. Please enable camera access in your browser settings or use file upload.',
            }));
            return false;
          }
          // If 'prompt' or unknown → fall through to getUserMedia test
        } catch {
          // Fall back to getUserMedia probe
        }
      }

      // Fallback: try a tiny getUserMedia probe to infer permission/device presence
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraState((p) => ({
          ...p,
          hasPermission: false,
          permissionStatus: 'error',
          error: 'Camera not supported in this browser.',
        }));
        return false;
      }

      let testStream: MediaStream | null = null;
      try {
        testStream = await navigator.mediaDevices.getUserMedia({ video: { width: 160, height: 120 } });
        testStream.getTracks().forEach((t) => t.stop());
        setCameraState((p) => ({ ...p, hasPermission: true, permissionStatus: 'granted' }));
        return true;
      } catch (err) {
        const e = err as DOMException;
        if (e.name === 'NotAllowedError' || e.name === 'SecurityError') {
          setCameraState((p) => ({
            ...p,
            hasPermission: false,
            permissionStatus: 'denied',
            error: 'Camera access denied. Click “Allow” in the permission prompt or use file upload.',
          }));
        } else if (e.name === 'NotFoundError' || e.name === 'OverconstrainedError') {
          setCameraState((p) => ({
            ...p,
            hasPermission: false,
            permissionStatus: 'error',
            error: 'No camera device found. Connect a camera or use file upload.',
          }));
        } else {
          setCameraState((p) => ({
            ...p,
            hasPermission: false,
            permissionStatus: 'error',
            error: `Camera error: ${e.message || 'Unknown error'}`,
          }));
        }
        return false;
      }
    } catch {
      setCameraState((p) => ({
        ...p,
        hasPermission: false,
        permissionStatus: 'error',
        error: 'Unable to check camera permissions on this device.',
      }));
      return false;
    }
  }, []);

  // --- Camera Controls -------------------------------------------------------

  const startCamera = useCallback(async () => {
    try {
      setCameraState((p) => ({ ...p, error: null }));
      const allowed = await checkCameraPermission();
      if (!allowed) return;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Some mobile browsers require play() to be awaited/caught
        try {
          await videoRef.current.play();
        } catch {
          // ignore autoplay restrictions; user will trigger via UI if needed
        }
      }

      setCameraState((p) => ({
        ...p,
        stream,
        isActive: true,
        hasPermission: true,
        permissionStatus: 'granted',
      }));

      setCaptureState((p) => ({ ...p, mode: 'camera' }));
    } catch (err) {
      const e = err as Error;
      setCameraState((p) => ({
        ...p,
        error: `Failed to start camera: ${e.message}`,
        isActive: false,
      }));
    }
  }, [checkCameraPermission]);

  const stopCamera = useCallback(() => {
    stopCameraTracks();
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraState((p) => ({ ...p, stream: null, isActive: false }));
  }, [stopCameraTracks]);

  // --- Capture ---------------------------------------------------------------

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setCaptureState((p) => ({ ...p, isCapturing: true, captureError: null }));

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context not available');

      // Ensure video is ready
      if (video.readyState < 2) {
        await new Promise<void>((res) => {
          const onLoaded = () => {
            video.removeEventListener('loadeddata', onLoaded);
            res();
          };
          video.addEventListener('loadeddata', onLoaded, { once: true });
        });
      }

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 640;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to blob (wrap in Promise for await usage)
      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to capture image'))), 'image/jpeg', 0.9);
      });

      // Clean up old preview URL if any
      revokePreview();

      const file = new File([blob], 'camera_capture.jpg', { type: 'image/jpeg' });
      const preview = URL.createObjectURL(blob);

      updateIntake({ photo: file });
      setCaptureState((p) => ({ ...p, preview, hasPhoto: true, isCapturing: false }));

      // Optional: stop the camera after capture for privacy/power
      stopCamera();
    } catch (err) {
      const e = err as Error;
      setCaptureState((p) => ({ ...p, isCapturing: false, captureError: `Capture failed: ${e.message}` }));
    }
  }, [revokePreview, stopCamera, updateIntake]);

  // --- Upload ---------------------------------------------------------------

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate type and size
      if (!file.type.startsWith('image/')) {
        setCaptureState((p) => ({ ...p, captureError: 'Please select a valid image file (JPG/PNG).' }));
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setCaptureState((p) => ({ ...p, captureError: 'Image must be smaller than 10MB.' }));
        return;
      }

      // Reset previous analysis and errors
      setAnalysisState((p) => ({ ...p, hasAnalysis: false, error: null, results: null, retryCount: 0 }));
      setCaptureState((p) => ({ ...p, captureError: null }));

      // Clean up old preview
      revokePreview();

      // Persist to intake and preview
      updateIntake({ photo: file });

      const reader = new FileReader();
      reader.onloadend = () => {
        setCaptureState((p) => ({
          ...p,
          preview: (reader.result as string) || null,
          hasPhoto: true,
          mode: 'upload',
        }));
      };
      reader.readAsDataURL(file);
    },
    [revokePreview, updateIntake]
  );

  // --- Analysis --------------------------------------------------------------

  const analyzePhoto = useCallback(async () => {
    if (!imgRef.current) return;

    setAnalysisState((p) => ({ ...p, isAnalyzing: true, error: null, retryCount: p.retryCount + 1 }));

    try {
      if (!isModelLoaded) {
        throw new Error('Face detection models are not yet loaded. Please wait…');
      }

      const result = await analyzeImage(imgRef.current);
      if (result?.expressions) {
        setAnalysisState((p) => ({ ...p, isAnalyzing: false, hasAnalysis: true, results: result }));
        updateIntake({ faceAnalysis: result });
      } else {
        throw new Error('No face detected in the image. Try a clearer, well-lit photo.');
      }
    } catch (err) {
      const e = err as Error;
      setAnalysisState((p) => ({ ...p, isAnalyzing: false, error: e.message || 'Analysis failed' }));
    }
  }, [analyzeImage, isModelLoaded, updateIntake]);

  // --- Mode / Retry ----------------------------------------------------------

  const retryCapture = useCallback(() => {
    revokePreview();
    setCaptureState({
      mode: 'upload',
      preview: null,
      hasPhoto: false,
      isCapturing: false,
      captureError: null,
    });
    setAnalysisState({
      isAnalyzing: false,
      hasAnalysis: false,
      error: null,
      results: null,
      retryCount: 0,
    });
    updateIntake({ photo: undefined, faceAnalysis: undefined });
  }, [revokePreview, updateIntake]);

  const switchMode = useCallback(
    (mode: 'upload' | 'camera') => {
      if (mode === 'camera') {
        startCamera();
      } else {
        stopCamera();
        setCaptureState((p) => ({ ...p, mode: 'upload' }));
      }
    },
    [startCamera, stopCamera]
  );

  // --- Mount / Unmount -------------------------------------------------------

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState((p) => ({
        ...p,
        permissionStatus: 'error',
        error: 'Camera not supported in this browser.',
      }));
    }
    return () => {
      stopCamera();
      revokePreview();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Navigation ------------------------------------------------------------

  const handleNext = useCallback(async () => {
    try {
      // Allow skip, but if we *do* have results, persist them
      if (analysisState.results) {
        updateIntake({ faceAnalysis: analysisState.results });
      }
  
      // ✅ Canonical progress update for the guard
      markStepComplete('VisualStep', {
        hasPhoto: captureState.hasPhoto,
        hasAnalysis: analysisState.hasAnalysis
      });
  
      // tiny delay so the guard sees updated progress
      await new Promise(res => setTimeout(res, 50));
  
      navigate('/intake/vocal', { state: { fromVisual: true, hasAnalysis: analysisState.hasAnalysis } });
    } catch (error) {
      console.error('Navigation error:', error);
      window.location.href = '/intake/vocal';
    }
  }, [analysisState, captureState.hasPhoto, updateIntake, markStepComplete, navigate]);

  // --- UI --------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl">
        <GlassCard className="p-8">
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-white mb-2">Visual Analysis</h2>
              <p className="text-white/70">Capture or upload a clear photo of your face</p>
            </div>

            {/* Model Loading Status */}
            {!isModelLoaded && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-card-enhanced bg-blue-500/10 border-blue-400/30 p-4 rounded-xl"
              >
                <div className="flex items-center space-x-3">
                  <div className="animate-spin w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full"></div>
                  <div>
                    <p className="text-blue-100 text-sm">Loading face detection models...</p>
                    <div className="mt-2">
                      <GlassProgress value={progressValue} max={100} />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Model Loading Error */}
            {loadingError && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card-enhanced bg-red-500/10 border-red-400/30 p-4 rounded-xl">
                <p className="text-red-100 text-sm">Model loading failed: {loadingError}</p>
              </motion.div>
            )}

            {/* Mode Toggle */}
            <div className="flex gap-4 justify-center">
              <GlassButton
                onClick={() => switchMode('upload')}
                className={`px-6 py-3 ${captureState.mode === 'upload' ? 'bg-purple-500/30 border-purple-400/50' : 'bg-white/10 border-white/20'}`}
              >
                📁 Upload Photo
              </GlassButton>
              <GlassButton
                onClick={() => switchMode('camera')}
                disabled={cameraState.permissionStatus === 'error'}
                className={`px-6 py-3 ${captureState.mode === 'camera' ? 'bg-purple-500/30 border-purple-400/50' : 'bg-white/10 border-white/20'}`}
              >
                📷 Use Camera
              </GlassButton>
            </div>

            {/* Camera Permission / Error Notice */}
            <AnimatePresence>
              {cameraState.error && captureState.mode === 'camera' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="glass-card-enhanced bg-orange-500/10 border-orange-400/30 p-4 rounded-xl"
                >
                  <p className="text-orange-100 text-sm mb-2">{cameraState.error}</p>
                  {cameraState.permissionStatus === 'denied' && (
                    <div className="space-y-2">
                      <p className="text-orange-100/80 text-xs">To enable camera access:</p>
                      <ul className="text-orange-100/80 text-xs space-y-1">
                        <li>• Click the camera icon in your address bar</li>
                        <li>• Select “Allow” for camera access</li>
                        <li>• Refresh the page if needed</li>
                      </ul>
                      <GlassButton onClick={checkCameraPermission} className="bg-white/10 hover:bg-white/20 text-sm py-2 px-4 mt-2">
                        🔄 Check Again
                      </GlassButton>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main Content */}
            <div className="space-y-6">
              {/* Upload mode — no photo yet */}
              {captureState.mode === 'upload' && !captureState.hasPhoto && (
                <div onClick={() => fileInputRef.current?.click()} className="glass-card-enhanced p-12 rounded-2xl border-2 border-dashed border-white/30 cursor-pointer hover:border-white/50 transition-all duration-300 group">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} disabled={!isModelLoaded} className="hidden" />
                  <div className="space-y-4">
                    <div className="w-12 h-12 mx-auto rounded-full bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <svg className="w-6 h-6 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-white font-medium">{isModelLoaded ? 'Click to upload image' : 'Loading models…'}</p>
                      <p className="text-white/60 text-sm mt-1">JPG, PNG up to 10MB</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Camera mode — active */}
              {captureState.mode === 'camera' && cameraState.isActive && !captureState.hasPhoto && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                  <div className="relative inline-block mx-auto">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full max-w-[400px] aspect-square rounded-2xl object-cover shadow-2xl ring-4 ring-white/20"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                  <div className="text-center">
                    <GlassButton onClick={capturePhoto} disabled={captureState.isCapturing} className="bg-white/20 hover:bg-white/30 px-8 py-4">
                      {captureState.isCapturing ? (
                        <span className="flex items-center space-x-2">
                          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                          <span>Capturing…</span>
                        </span>
                      ) : (
                        <span className="flex items-center space-x-2">
                          <span>📷</span>
                          <span>Capture Photo</span>
                        </span>
                      )}
                    </GlassButton>
                  </div>
                </motion.div>
              )}

              {/* Photo Preview */}
              {captureState.hasPhoto && captureState.preview && (
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                  <div className="relative inline-block mx-auto">
                    <img
                      src={captureState.preview}
                      alt="Preview"
                      ref={imgRef}
                      className="w-full max-w-[350px] aspect-square rounded-2xl object-cover shadow-2xl ring-4 ring-white/20"
                    />
                    {/* Change / Reset photo */}
                    <button
                      onClick={retryCapture}
                      className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                      aria-label="Remove photo"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Analysis Controls */}
                  {!analysisState.hasAnalysis && (
                    <div className="text-center">
                      <GlassButton
                        onClick={analyzePhoto}
                        disabled={analysisState.isAnalyzing || !isModelLoaded}
                        className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 px-8 py-4"
                      >
                        {analysisState.isAnalyzing ? (
                          <span className="flex items-center space-x-2">
                            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                            <span>Analyzing Face…</span>
                          </span>
                        ) : (
                          <span className="flex items-center space-x-2">
                            <span>🔍</span>
                            <span>Analyze Face</span>
                          </span>
                        )}
                      </GlassButton>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Analysis Results */}
              {analysisState.hasAnalysis && analysisState.results?.expressions && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card-enhanced p-6 rounded-xl">
                  <h3 className="text-xl font-semibold text-white mb-4">Analysis Complete ✅</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(analysisState.results.expressions).map(([emotion, value]) => {
                      const pct = Math.round((value as number) * 100);
                      return (
                        <div key={emotion} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-white/70 capitalize">{emotion}</span>
                            <span className="text-white">{pct}%</span>
                          </div>
                          <div className="w-full bg-white/10 rounded-full h-2">
                            <div className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-1000" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Capture/Analysis Errors */}
              <AnimatePresence>
                {(captureState.captureError || analysisState.error) && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="glass-card-enhanced bg-red-500/10 border-red-400/30 p-4 rounded-xl"
                  >
                    <p className="text-red-100 text-sm mb-2">{captureState.captureError || analysisState.error}</p>
                    {analysisState.error && analysisState.retryCount < 3 && (
                      <GlassButton onClick={analyzePhoto} className="bg-white/10 hover:bg-white/20 text-sm py-2 px-4">
                        🔄 Retry Analysis
                      </GlassButton>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Navigation */}
            <div className="flex gap-4 justify-center pt-6 border-t border-white/10">
              <GlassButton
                onClick={handleNext}
                className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 px-8 py-3"
              >
                <span className="flex items-center space-x-2">
                  <span>Continue</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </GlassButton>
            </div>

           
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
};

export default VisualStep;
