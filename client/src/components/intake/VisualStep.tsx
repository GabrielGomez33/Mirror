// src/components/intake/VisualStep.tsx
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntake } from '../../context/IntakeContext';
import { useFaceApi } from '../../hooks/useFaceApi';
import GlassCard, { GlassButton, GlassProgress } from '../ui/GlassCard';
import { motion, AnimatePresence } from 'framer-motion';
import BasicScene from '../three/BasicScene';

const VisualStep = () => {
  const navigate = useNavigate();
  const { updateIntake } = useIntake();
  const [getPreview, setPreview] = useState<string | null>(null);
  const { isModelLoaded, loadingError, loadingProgress, analyzeImage } = useFaceApi();
  const [expressions, setExpressions] = useState<{ [key: string]: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset previous states
    setExpressions(null);
    setAnalysisError(null);

    updateIntake({ photo: file });
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!imgRef.current) return;

    console.log('Image loaded:', imgRef.current.complete);
    console.log('Image dimensions:', imgRef.current.naturalWidth, 'x', imgRef.current.naturalHeight);
    console.log('Image src length:', imgRef.current.src.length);

    setLoading(true);
    setAnalysisError(null);

    try {
      if (!isModelLoaded) {
        setAnalysisError("Models are not yet loaded. Please wait...");
        return;
      }

      const result = await analyzeImage(imgRef.current);
      if (result?.expressions) {
        setExpressions({ ...result.expressions });
        updateIntake({ faceAnalysis: result });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Face analysis failed';
      console.error('Face analysis failed:', error);
      setAnalysisError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => navigate('/intake/vocal');

  // Get dominant expression
  const getDominantExpression = () => {
    if (!expressions) return null;
    const sorted = Object.entries(expressions).sort((a, b) => b[1] - a[1]);
    return sorted[0];
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Three.js Background */}
      <BasicScene />
      
      {/* Animated gradient background overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ duration: 1.5 }}
        className="absolute inset-0 bg-gradient-to-br from-pink-100/50 via-pink-50/30 to-rose-100/50 pointer-events-none"
      />
      
      {/* Remove the floating orbs section since we have 3D petals now */}

      <div className="relative z-10 min-h-screen flex flex-col justify-center items-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="w-full max-w-xl"
        >
          <GlassCard enhanced gradient className="text-center space-y-6 max-h-[85vh] overflow-y-auto overflow-x-hidden mx-4 hover:scale-[1.03]">
            {/* Header with icon */}
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5 }}
              className="space-y-4"
            >
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-rose-400 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>
              
              <h2 className="text-3xl font-bold text-white text-shadow-soft">Your Visual Identity</h2>
              <p className="text-white/80">
                Upload a clear image of yourself. We'll analyze facial features to personalize your Mirror profile.
              </p>
            </motion.div>

            {/* Model Loading Status */}
            <AnimatePresence mode="wait">
              {!isModelLoaded && !loadingError && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="glass-card-enhanced p-4 rounded-xl"
                >
                  <div className="flex items-center justify-center space-x-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                    <p className="text-white/90 text-sm">{loadingProgress || 'Loading AI models...'}</p>
                  </div>
                  <GlassProgress value={loadingProgress.includes('Ready') ? 100 : 50} max={100} className="mt-3" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Model Loading Error */}
            <AnimatePresence>
              {loadingError && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="glass-card-enhanced bg-red-500/10 border-red-400/30 p-4 rounded-xl"
                >
                  <p className="font-semibold text-red-100 mb-1">Model Loading Error</p>
                  <p className="text-sm text-red-100/80">{loadingError}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* File Input Area */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="space-y-4"
            >
              {!getPreview ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="glass-card-enhanced p-12 rounded-2xl border-2 border-dashed border-white/30 cursor-pointer hover:border-white/50 transition-all duration-300 group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={!isModelLoaded}
                    className="hidden"
                  />
                  <div className="space-y-4">
                    <div className="w-12 h-12 mx-auto rounded-full bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <svg className=" w-32px text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-white font-medium">Click to upload image</p>
                      <p className="text-white/60 text-sm mt-1">JPG, PNG up to 10MB</p>
                    </div>
                  </div>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative"
                >
                  <div className="relative inline-block">
                    <img
                      src={getPreview}
                      alt="Preview"
                      ref={imgRef}
                      className="w-full max-w-[350px] aspect-square rounded-2xl object-cover shadow-2xl ring-4 ring-white/20"
                      onLoad={() => console.log('Image loaded successfully')}
                      onError={(e) => console.error('Image failed to load:', e)}
                    />
                    {/* Overlay gradient */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                    
                    {/* Change image button */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute top-4 right-4 p-2 rounded-full glass-card-enhanced hover:scale-110 transition-transform"
                    >
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </motion.div>
              )}

              {getPreview && isModelLoaded && !expressions && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <GlassButton
                    onClick={handleAnalyze}
                    disabled={loading}
                    className="min-w-[200px] bg-gradient-to-r from-pink-400/20 to-rose-400/20 hover:from-pink-400/30 hover:to-rose-400/30"
                  >
                    {loading ? (
                      <span className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                        <span>Analyzing...</span>
                      </span>
                    ) : (
                      'Analyze Face'
                    )}
                  </GlassButton>
                </motion.div>
              )}
            </motion.div>

            {/* Analysis Error */}
            <AnimatePresence>
              {analysisError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="glass-card-enhanced bg-orange-500/10 border-orange-400/30 p-4 rounded-xl"
                >
                  <p className="font-semibold text-orange-100 mb-1">Analysis Error</p>
                  <p className="text-sm text-orange-100/80">{analysisError}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Expression Results */}
            <AnimatePresence>
              {expressions && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="glass-card-enhanced p-6 rounded-xl space-y-4"
                >
                  {/* Dominant Expression Display */}
                  {getDominantExpression() && (
                    <motion.div
                      initial={{ scale: 0.9 }}
                      animate={{ scale: 1 }}
                      className="text-center mb-4"
                    >
                      <p className="text-white/70 text-sm mb-1">Dominant Expression</p>
                      <p className="text-3xl font-bold text-white capitalize">
                        {getDominantExpression()![0]}
                      </p>
                      <p className="text-white/80 text-lg">
                        {(getDominantExpression()![1] * 100).toFixed(1)}%
                      </p>
                    </motion.div>
                  )}

                  <div className="space-y-3">
                    <h4 className="font-semibold text-white/90 text-sm uppercase tracking-wider">All Expressions</h4>
                    {Object.entries(expressions)
                      .sort((a, b) => b[1] - a[1])
                      .map(([expression, confidence], index) => (
                        <motion.div
                          key={expression}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="space-y-1"
                        >
                          <div className="flex justify-between text-sm">
                            <span className="text-white/80 capitalize">{expression}</span>
                            <span className="text-white/90 font-medium">{(confidence * 100).toFixed(1)}%</span>
                          </div>
                          <div className="glass-progress-bg h-2 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${confidence * 100}%` }}
                              transition={{ duration: 0.8, delay: index * 0.05 }}
                              className="h-full bg-gradient-to-r from-pink-400 to-rose-400 rounded-full"
                            />
                          </div>
                        </motion.div>
                      ))}
                  </div>

                  {/* Success Message */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-center pt-4"
                  >
                    <p className="text-white/70 text-sm">Analysis complete! Ready to continue.</p>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Continue Button */}
            <AnimatePresence>
              {expressions && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: 0.3 }}
                  className="pt-4"
                >
                  <GlassButton
                    onClick={handleNext}
                    className="w-full bg-gradient-to-r from-pink-400/20 to-rose-400/20 hover:from-pink-400/30 hover:to-rose-400/30 py-4 text-lg font-semibold group"
                  >
                    <span className="flex items-center justify-center space-x-3">
                      <span>Continue to Voice Analysis</span>
                      <svg className="w-[1.25rem] h-[1.25rem] group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </GlassButton>
                </motion.div>
              )}
            </AnimatePresence>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
};

export default VisualStep;
