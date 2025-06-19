// src/components/intake/VocalStep.tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntake } from '../../context/IntakeContext';
import GlassCard, { GlassButton, GlassProgress } from '../ui/GlassCard';
import { motion, AnimatePresence } from 'framer-motion';
import BasicScene from '../three/BasicScene';

interface AudioAnalysis {
  duration: number;
  avgPitch?: number;
  pitchRange?: { min: number; max: number };
  avgVolume?: number;
  speakingRate?: number;
  silenceRatio?: number;
}

const VocalStep = () => {
  const navigate = useNavigate();
  const { updateIntake } = useIntake();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const [recording, setRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [analysis, setAnalysis] = useState<AudioAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Multi-part prompt for comprehensive voice analysis
  const prompts = [
    {
      type: "statement",
      text: "Our sun rose behind the hills, painting the sky with golden hues.",
      emotion: "calm"
    },
    {
      type: "question",
      text: "Have you ever wondered what makes you truly unique?",
      emotion: "curious"
    },
    {
      type: "exclamation",
      text: "Today is the first day of my incredible new journey!",
      emotion: "excited"
    },
    {
      type: "reflection",
      text: "Sometimes I pause and think about all the memories that shaped who I am.",
      emotion: "thoughtful"
    },
    {
      type: "counting",
      text: "One, two, three, four, five... taking a deep breath... six, seven, eight, nine, ten.",
      emotion: "neutral"
    }
  ];

  const currentPrompt = prompts[currentPromptIndex];

  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Audio recording is not supported in this browser');
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Monitor audio levels during recording
  const monitorAudioLevel = (stream: MediaStream) => {
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(stream);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    microphone.connect(analyser);
    analyserRef.current = analyser;
    
    const checkAudioLevel = () => {
      if (!recording) return;
      
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setAudioLevel(average / 255);
      
      animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
    };
    
    checkAudioLevel();
  };

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunks.current = [];
      
      recorder.ondataavailable = (e: BlobEvent) => {
        audioChunks.current.push(e.data);
      };
      
      recorder.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
        setAudioURL(URL.createObjectURL(blob));
        updateIntake({ 
          voice: blob,
          //voicePromptIndex: currentPromptIndex,
          //voicePromptText: currentPrompt.text
        });
        
        // Simple duration analysis
        const duration = recordingTime;
        setAnalysis({
          duration,
          speakingRate: currentPrompt.text.split(' ').length / (duration / 60)
        });
      };
      
      // Start countdown
      setCountdown(3);
      const countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev === 1) {
            clearInterval(countdownInterval);
            recorder.start();
            setRecording(true);
            monitorAudioLevel(stream);
            
            // Start recording timer
            const startTime = Date.now();
            const timerInterval = setInterval(() => {
              if (recording) {
                setRecordingTime((Date.now() - startTime) / 1000);
              } else {
                clearInterval(timerInterval);
              }
            }, 100);
            
            return null;
          }
          return prev! - 1;
        });
      }, 1000);
      
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setRecording(false);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  };

  const nextPrompt = () => {
    if (currentPromptIndex < prompts.length - 1) {
      setCurrentPromptIndex(prev => prev + 1);
      setAudioURL(null);
      setRecordingTime(0);
      setAnalysis(null);
    }
  };

  const handleNext = () => {
    navigate('/intake/personality');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
                We'll analyze your voice to understand your unique vocal characteristics
              </p>
            </motion.div>

            {/* Progress indicator */}
            <div className="glass-card-enhanced p-4 rounded-xl">
              <div className="flex justify-between text-sm text-white/70 mb-2">
                <span>Progress</span>
                <span>{currentPromptIndex + 1} of {prompts.length}</span>
              </div>
              <GlassProgress value={currentPromptIndex + 1} max={prompts.length} />
            </div>

            {/* Current Prompt */}
            <motion.div
              key={currentPromptIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-4"
            >
              <div className="glass-card-enhanced p-6 rounded-xl">
                <p className="text-white/70 text-sm mb-2">
                  Read this {currentPrompt.type} naturally:
                </p>
                <blockquote className="text-xl text-white font-medium leading-relaxed">
                  "{currentPrompt.text}"
                </blockquote>
                <div className="mt-2 flex justify-center">
                  <span className="text-xs text-white/50 bg-white/10 px-3 py-1 rounded-full">
                    {currentPrompt.emotion} tone
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Recording Controls */}
            <div className="space-y-6">
              {/* Countdown */}
              <AnimatePresence>
                {countdown !== null && (
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.5, opacity: 0 }}
                    className="text-6xl font-bold text-white"
                  >
                    {countdown}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Recording indicator */}
              {recording && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-center space-x-3">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-white font-medium">Recording...</span>
                    <span className="text-white/70">{formatTime(recordingTime)}</span>
                  </div>
                  
                  {/* Audio level visualizer */}
                  <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-blue-400 to-purple-400"
                      animate={{ width: `${audioLevel * 100}%` }}
                      transition={{ duration: 0.1 }}
                    />
                  </div>
                </motion.div>
              )}

              {/* Record/Stop button */}
              {!audioURL && countdown === null && (
                <GlassButton
                  onClick={recording ? stopRecording : startRecording}
                  className={`min-w-[200px] ${
                    recording 
                      ? 'bg-red-500/20 hover:bg-red-500/30' 
                      : 'bg-gradient-to-r from-purple-400/20 to-blue-400/20 hover:from-purple-400/30 hover:to-blue-400/30'
                  }`}
                >
                  {recording ? (
                    <span className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 bg-white rounded-sm" />
                      <span>Stop Recording</span>
                    </span>
                  ) : (
                    <span className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 bg-red-500 rounded-full" />
                      <span>Start Recording</span>
                    </span>
                  )}
                </GlassButton>
              )}

              {/* Audio preview */}
              <AnimatePresence>
                {audioURL && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-4"
                  >
                    <div className="glass-card-enhanced p-4 rounded-xl">
                      <p className="text-white/70 text-sm mb-3">Preview your recording:</p>
                      <audio controls src={audioURL} className="w-full" />
                      
                      {analysis && (
                        <div className="mt-3 text-sm text-white/60">
                          Duration: {analysis.duration.toFixed(1)}s | 
                          Speaking rate: ~{Math.round(analysis.speakingRate || 0)} words/min
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3 justify-center">
                      <GlassButton
                        onClick={() => {
                          setAudioURL(null);
                          setRecordingTime(0);
                          setAnalysis(null);
                        }}
                        className="bg-white/10 hover:bg-white/20"
                      >
                        Re-record
                      </GlassButton>
                      
                      {currentPromptIndex < prompts.length - 1 ? (
                        <GlassButton
                          onClick={nextPrompt}
                          className="bg-gradient-to-r from-purple-400/20 to-blue-400/20 hover:from-purple-400/30 hover:to-blue-400/30"
                        >
                          Next Prompt →
                        </GlassButton>
                      ) : (
                        <GlassButton
                          onClick={handleNext}
                          className="bg-gradient-to-r from-purple-400/20 to-blue-400/20 hover:from-purple-400/30 hover:to-blue-400/30"
                        >
                          Continue →
                        </GlassButton>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error display */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="glass-card-enhanced bg-red-500/10 border-red-400/30 p-4 rounded-xl"
                  >
                    <p className="text-red-100">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Skip option */}
            <div className="pt-4 border-t border-white/10">
              <button
                onClick={handleNext}
                className="text-white/50 hover:text-white/70 text-sm transition-colors"
              >
                Skip voice analysis for now →
              </button>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
};

export default VocalStep;
