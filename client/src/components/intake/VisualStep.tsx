// src/components/intake/VisualStep.tsx
// ENHANCED: Required analysis completion, better retry/redo UX, improved error handling, 3D background

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntake } from '../../context/IntakeContext';
import { useFaceApi } from '../../hooks/useFaceApi';
import GlassCard, { GlassButton, GlassProgress } from '../ui/GlassCard';
import { motion, AnimatePresence } from 'framer-motion';
import BasicScene from '../three/BasicScene';

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
  results: any;
  retryCount: number;
  qualityScore: number; // 0-100, based on detection confidence
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
    qualityScore: 0,
  });

  // Cleanup functions
  const revokePreview = useCallback(() => {
    if (captureState.preview) {
      URL.revokeObjectURL(captureState.preview);
    }
  }, [captureState.preview]);

  const stopCamera = useCallback(() => {
    setCameraState(prev => {
      if (prev.stream) {
        try {
          prev.stream.getTracks().forEach(track => track.stop());
        } catch {}
      }
      return { ...prev, stream: null, isActive: false };
    });
  }, []);

  // Camera permission and activation
  const checkCameraPermission = useCallback(async (): Promise<boolean> => {
    setCameraState(prev => ({ ...prev, permissionStatus: 'checking', error: null }));

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraState(prev => ({
          ...prev,
          hasPermission: false,
          permissionStatus: 'error',
          error: 'Camera not supported in this browser.',
        }));
        return false;
      }

      // Try a quick probe
      const probe = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      probe.getTracks().forEach(track => track.stop());

      setCameraState(prev => ({ ...prev, hasPermission: true, permissionStatus: 'granted' }));
      return true;
    } catch (err: unknown) {
      const e = err as DOMException & { name?: string; message?: string };
      let msg = `Camera error${e?.message ? `: ${e.message}` : ''}`;

      if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') {
        msg = 'Camera permission denied. Please allow camera access or use file upload.';
        setCameraState(prev => ({
          ...prev,
          hasPermission: false,
          permissionStatus: 'denied',
          error: msg,
        }));
      } else if (e?.name === 'NotFoundError' || e?.name === 'DevicesNotFoundError') {
        msg = 'No camera device found. Try connecting a camera or upload a photo.';
        setCameraState(prev => ({
          ...prev,
          hasPermission: false,
          permissionStatus: 'error',
          error: msg,
        }));
      } else if (e?.name === 'OverconstrainedError') {
        msg = 'The camera does not support the requested constraints. Try a different device or upload a photo.';
        setCameraState(prev => ({
          ...prev,
          hasPermission: false,
          permissionStatus: 'error',
          error: msg,
        }));
      } else {
        setCameraState(prev => ({
          ...prev,
          hasPermission: false,
          permissionStatus: 'error',
          error: msg,
        }));
      }
      return false;
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (!(await checkCameraPermission())) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setCameraState(prev => ({ ...prev, stream, isActive: true, error: null }));
      setCaptureState(prev => ({ ...prev, mode: 'camera', captureError: null }));
    } catch (err: any) {
      setCameraState(prev => ({
        ...prev,
        error: `Failed to start camera: ${err?.message ?? 'Unknown error'}`,
      }));
    }
  }, [checkCameraPermission]);

  // Face analysis - MOVED UP to avoid hoisting issues
  const analyzePhoto = useCallback(async () => {
    if (analysisState.isAnalyzing) return; // guard double-run
    if (!imgRef.current || !isModelLoaded) {
      setAnalysisState(prev => ({
        ...prev,
        error: 'Analysis system not ready. Please wait and try again.',
      }));
      return;
    }

    // Check if image is actually loaded
    if (!imgRef.current.complete || imgRef.current.naturalWidth === 0) {
      setAnalysisState(prev => ({
        ...prev,
        error: 'Image not fully loaded. Please wait a moment and try again.',
      }));
      return;
    }

    setAnalysisState(prev => ({
      ...prev,
      isAnalyzing: true,
      error: null,
    }));

    try {
      const result = await analyzeImage(imgRef.current);

      if (!result?.expressions) {
        throw new Error('No face detected. Please use a clear, well-lit photo showing your face.');
      }

      // Calculate quality score based on detection confidence
      const confidence = (result as any)?.detection?._score ?? 0;
      const qualityScore = Math.round(Math.max(0, Math.min(1, confidence)) * 100);

      setAnalysisState(prev => ({
        ...prev,
        isAnalyzing: false,
        hasAnalysis: true,
        results: result,
        qualityScore,
        error: null,
      }));

      updateIntake({ faceAnalysis: result });
    } catch (err: any) {
      setAnalysisState(prev => ({
        ...prev,
        isAnalyzing: false,
        hasAnalysis: false,
        error: err?.message || 'Analysis failed. Please try a different photo.',
        retryCount: prev.retryCount + 1,
      }));
    }
  }, [analyzeImage, isModelLoaded, updateIntake]);

  // File upload handling
  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setCaptureState(prev => ({
          ...prev,
          captureError: 'Please upload a JPEG, PNG, or WebP image.',
        }));
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setCaptureState(prev => ({
          ...prev,
          captureError: 'Image too large. Please upload an image smaller than 10MB.',
        }));
        return;
      }

      // Clear any previous errors + revoke old preview
      setCaptureState(prev => ({ ...prev, captureError: null }));
      revokePreview();

      const preview = URL.createObjectURL(file);
      setCaptureState({
        mode: 'upload',
        preview,
        hasPhoto: true,
        isCapturing: false,
        captureError: null,
      });

      // Store file
      updateIntake({ photo: file });

      // Wait for imgRef to load the image before analyzing
      if (imgRef.current) {
        // Clear any previous handlers before reassigning
        imgRef.current.onload = null;
        imgRef.current.onerror = null;

        imgRef.current.onload = () => {
          setTimeout(() => analyzePhoto(), 500);
        };

        imgRef.current.onerror = () => {
          setCaptureState(prev => ({
            ...prev,
            captureError: 'Failed to load image. Please try a different photo.',
          }));
        };

        imgRef.current.src = preview;
      }
    },
    [revokePreview, updateIntake, analyzePhoto],
  );

  // Camera capture
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setCaptureState(prev => ({ ...prev, isCapturing: true }));

    // Set canvas size to video dimensions
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0);

    const finalizeFromBlob = (blob: Blob | null) => {
      if (!blob) {
        setCaptureState(prev => ({
          ...prev,
          isCapturing: false,
          captureError: 'Failed to capture image.',
        }));
        return;
      }

      revokePreview();
      const preview = URL.createObjectURL(blob);

      const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });

      setCaptureState({
        mode: 'camera',
        preview,
        hasPhoto: true,
        isCapturing: false,
        captureError: null,
      });

      updateIntake({ photo: file });

      if (imgRef.current) {
        // Clear any previous handlers
        imgRef.current.onload = null;
        imgRef.current.onerror = null;

        imgRef.current.onload = () => {
          setTimeout(() => analyzePhoto(), 500);
        };

        imgRef.current.onerror = () => {
          setCaptureState(prev => ({
            ...prev,
            captureError: 'Failed to load captured image.',
          }));
        };

        imgRef.current.src = preview;
      }

      // Stop camera after successful capture
      stopCamera();
    };

    // Prefer toBlob; fallback to dataURL if unavailable
    if (canvas.toBlob) {
      canvas.toBlob(blob => finalizeFromBlob(blob), 'image/jpeg', 0.8);
    } else {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      fetch(dataUrl)
        .then(r => r.blob())
        .then(finalizeFromBlob)
        .catch(() =>
          setCaptureState(prev => ({
            ...prev,
            isCapturing: false,
            captureError: 'Failed to capture image.',
          })),
        );
    }
  }, [revokePreview, updateIntake, stopCamera, analyzePhoto]);

  // Reset everything for new photo
  const startOver = useCallback(() => {
    revokePreview();
    stopCamera();

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
      qualityScore: 0,
    });

    updateIntake({ photo: undefined, faceAnalysis: undefined });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [revokePreview, stopCamera, updateIntake]);

  // Navigation - REQUIRE successful analysis
  const handleNext = useCallback(async () => {
    if (!analysisState.hasAnalysis) {
      setAnalysisState(prev => ({
        ...prev,
        error: 'Face analysis must be completed before proceeding.',
      }));
      return;
    }

    try {
      markStepComplete('VisualStep', {
        hasPhoto: captureState.hasPhoto,
        hasAnalysis: analysisState.hasAnalysis,
        qualityScore: analysisState.qualityScore,
      });

      await new Promise(resolve => setTimeout(resolve, 50));
      navigate('/intake/vocal');
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }, [analysisState.hasAnalysis, captureState.hasPhoto, analysisState.qualityScore, markStepComplete, navigate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      revokePreview();
    };
  }, [stopCamera, revokePreview]);

  // Get face API loading progress
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

  // Render quality indicator
  const renderQualityIndicator = () => {
    if (!analysisState.hasAnalysis) return null;

    const score = analysisState.qualityScore;
    let color = 'text-red-400';
    let label = 'Poor Quality';

    if (score >= 80) {
      color = 'text-green-400';
      label = 'Excellent Quality';
    } else if (score >= 60) {
      color = 'text-yellow-400';
      label = 'Good Quality';
    } else if (score >= 40) {
      color = 'text-orange-400';
      label = 'Fair Quality';
    }

    return (
      <div className={`flex items-center space-x-2 ${color}`}>
        <div className="flex space-x-1">
          {[1, 2, 3, 4, 5].map(i => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${i <= score / 20 ? 'bg-current' : 'bg-white/20'}`}
            />
          ))}
        </div>
        <span className="text-sm">
          {label} ({score}%)
        </span>
      </div>
    );
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
        className="absolute inset-0 bg-gradient-to-br from-cyan-100/50 via-teal-50/30 to-blue-100/50 pointer-events-none"
      />

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-4xl"
        >
          <GlassCard className="p-8">
            <div className="text-center space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-white">Visual Analysis</h2>
                <p className="text-white/70 mt-2">
                  Upload a clear photo or use your camera for facial analysis
                </p>
                <p className="text-white/50 text-sm mt-1">
                  Required: Face analysis must complete successfully to continue
                </p>
              </div>

              {/* Face API Loading */}
              <AnimatePresence>
                {!isModelLoaded && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="glass-card-enhanced p-6 rounded-xl"
                  >
                    <div className="flex items-center justify-center space-x-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                      <div>
                        <p className="text-white font-medium">Loading Analysis Engine...</p>
                        <GlassProgress value={progressValue} max={100} className="w-64 mt-2" />
                        <p className="text-white/60 text-sm mt-1">{progressValue}%</p>
                        {loadingError && (
                          <p className="text-red-300 text-xs mt-1">{String(loadingError)}</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Mode Selection */}
              {isModelLoaded && !captureState.hasPhoto && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card-enhanced p-6 rounded-xl"
                >
                  <h3 className="text-xl font-semibold text-white mb-4">Choose Method</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Upload Option */}
                    <GlassButton
                      onClick={() => fileInputRef.current?.click()}
                      className="p-6 bg-gradient-to-br from-blue-500/20 to-purple-500/20 hover:from-blue-500/30 hover:to-purple-500/30"
                    >
                      <div className="text-center space-y-2">
                        <div className="text-4xl">📁</div>
                        <h4 className="text-lg font-medium text-white">Upload Photo</h4>
                        <p className="text-white/70 text-sm">Select from your device</p>
                      </div>
                    </GlassButton>

                    {/* Camera Option */}
                    <GlassButton
                      onClick={startCamera}
                      disabled={cameraState.permissionStatus === 'denied'}
                      className="p-6 bg-gradient-to-br from-green-500/20 to-blue-500/20 hover:from-green-500/30 hover:to-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="text-center space-y-2">
                        <div className="text-4xl">📷</div>
                        <h4 className="text-lg font-medium text-white">Use Camera</h4>
                        <p className="text-white/70 text-sm">Take photo now</p>
                      </div>
                    </GlassButton>
                  </div>

                  {/* Camera error */}
                  <AnimatePresence>
                    {cameraState.error && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="mt-4 p-3 bg-red-500/10 border border-red-400/30 rounded-lg"
                      >
                        <p className="text-red-100 text-sm">{cameraState.error}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* Camera View */}
              <AnimatePresence>
                {cameraState.isActive && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="glass-card-enhanced p-6 rounded-xl"
                  >
                    <div className="text-center space-y-4">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full max-w-md mx-auto rounded-lg"
                      />
                      <div className="flex gap-3 justify-center">
                        <GlassButton
                          onClick={capturePhoto}
                          disabled={captureState.isCapturing}
                          className="bg-gradient-to-r from-green-500/20 to-blue-500/20 hover:from-green-500/30 hover:to-blue-500/30"
                        >
                          {captureState.isCapturing ? 'Capturing...' : '📸 Capture Photo'}
                        </GlassButton>
                        <GlassButton
                          onClick={stopCamera}
                          className="bg-red-500/20 hover:bg-red-500/30"
                        >
                          Cancel
                        </GlassButton>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Photo Preview and Analysis */}
              <AnimatePresence>
                {captureState.hasPhoto && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="glass-card-enhanced p-6 rounded-xl"
                  >
                    <div className="space-y-6">
                      {/* Photo Preview */}
                      <div className="text-center">
                        <img
                          ref={imgRef}
                          src={captureState.preview || undefined}
                          alt="Captured"
                          className="w-full max-w-md mx-auto rounded-lg shadow-lg"
                          style={{ display: captureState.preview ? 'block' : 'none' }}
                        />
                      </div>

                      {/* Analysis State */}
                      <div className="text-center space-y-4">
                        {analysisState.isAnalyzing && (
                          <div className="flex items-center justify-center space-x-3">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                            <p className="text-white">Analyzing facial features...</p>
                          </div>
                        )}

                        {analysisState.hasAnalysis && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-center space-x-2">
                              <span className="text-green-400 text-2xl">✅</span>
                              <p className="text-green-400 font-medium">Analysis Complete!</p>
                            </div>
                            {renderQualityIndicator()}
                          </div>
                        )}

                        {analysisState.error && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-center space-x-2">
                              <span className="text-red-400 text-2xl">❌</span>
                              <p className="text-red-400 font-medium">Analysis Failed</p>
                            </div>
                            <p className="text-red-100/80 text-sm">{analysisState.error}</p>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-3 justify-center flex-wrap">
                        {!analysisState.isAnalyzing && !analysisState.hasAnalysis && (
                          <GlassButton
                            onClick={analyzePhoto}
                            className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 hover:from-purple-500/30 hover:to-blue-500/30"
                          >
                            🔍 Analyze Face
                          </GlassButton>
                        )}

                        {analysisState.error && analysisState.retryCount < 3 && (
                          <GlassButton
                            onClick={analyzePhoto}
                            className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 hover:from-yellow-500/30 hover:to-orange-500/30"
                          >
                            🔄 Retry Analysis
                          </GlassButton>
                        )}

                        {(analysisState.hasAnalysis || analysisState.error) && (
                          <GlassButton
                            onClick={startOver}
                            className="bg-gradient-to-r from-gray-500/20 to-slate-500/20 hover:from-gray-500/30 hover:to-slate-500/30"
                          >
                            📸 Take New Photo
                          </GlassButton>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Navigation */}
              <div className="flex justify-center pt-6 border-t border-white/10">
                <GlassButton
                  onClick={handleNext}
                  disabled={!analysisState.hasAnalysis || analysisState.isAnalyzing}
                  className={`px-8 py-3 ${
                    analysisState.hasAnalysis && !analysisState.isAnalyzing
                      ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600'
                      : 'bg-white/10 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <span className="flex items-center space-x-2">
                    <span>Continue to Voice</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </GlassButton>
              </div>

              {/* Help Text */}
              <div className="text-center text-white/50 text-sm space-y-1">
                <p>For best results, ensure good lighting and face the camera directly.</p>
                {!analysisState.hasAnalysis && (
                  <p className="text-yellow-400/70">⚠️ Successful facial analysis is required to proceed</p>
                )}
              </div>
            </div>
          </GlassCard>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Hidden canvas for camera capture */}
          <canvas ref={canvasRef} className="hidden" />
        </motion.div>
      </div>
    </div>
  );
};

export default VisualStep;
