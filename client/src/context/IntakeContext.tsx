// src/context/IntakeContext.tsx - FIXED VERSION
// Corrected TypeScript errors and removed unused variables

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';

interface PersonalityResult {
  big5Profile: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  };
  mbtiType: string;
  dominantTraits: string[];
  description: string;
}

interface AstrologicalResult {
  western: Record<string, any>;
  chinese: Record<string, any>;
  african: Record<string, any>;
  numerology: Record<string, any>;
  synthesis: Record<string, any>;
}

export interface VoicePayload {
  blobUrl: string;
  mimeType: string;
  size: number;
  durationMs: number;
  createdAt: number;
  deviceInfo?: {
    isMobile?: boolean;
    platform?: 'Mobile' | 'Desktop';
    browser?: 'Chrome' | 'Safari' | 'Firefox' | 'Other';
  };
}

type StepStatus = {
  completed: boolean;
  data?: Record<string, unknown>;
};

// FIXED: Define allowed step keys as a union type for better TypeScript support
type StepKey = 
  | 'VisualStep'
  | 'VocalStep'
  | 'PersonalityStep'
  | 'IQStep'
  | 'AstroLogicalStep'
  | 'SubmitStep'
  | 'ResultsStep';

type IntakeData = {
  [key: string]: any;
  astrologicalResult?: AstrologicalResult;
  photo?: File;
  faceAnalysis?: any;
  name?: string;
  iqResults?: any;
  iqAnswers?: any;
  personality?: any;
  personalityResult?: PersonalityResult;
  personalityAnswers?: any;
  fears?: string;
  voice?: Blob;
  voicePrompt?: string;
  voiceDuration?: number;
  voiceMetadata?: object;
  userRegistered?: boolean;
  userLoggedIn?: boolean;

  // Progress tracking with proper typing
  progress?: {
    lastStep: string;
    completed: boolean;
    steps: Partial<Record<StepKey, StepStatus>>;
  };
};

type IntakeContextType = {
  getIntake: IntakeData;
  updateIntake: (data: Partial<IntakeData>) => void;
  markStepComplete: (step: string, data?: Record<string, unknown>) => void;
  isStepComplete: (step: string) => boolean;
  getCompletionStatus: () => { completed: boolean; currentStep: string; completedSteps: string[] };
  resetIntake: () => void;
};

const STORAGE_KEY = 'mirror_intake_v1';

const IntakeContext = createContext<IntakeContextType | undefined>(undefined);

export const IntakeProvider = ({ children }: { children: ReactNode }) => {
  const [getIntake, setIntake] = useState<IntakeData>({});

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        console.log('🔄 IntakeContext hydrated from storage:', parsed);
        setIntake(parsed);
      }
    } catch (err) {
      console.warn('⚠️  Failed to hydrate intake from localStorage:', err);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Persist to localStorage on change (skip blobs)
  useEffect(() => {
    try {
      const { photo, voice, ...safe } = getIntake;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
      console.log('💾 IntakeContext persisted to storage');
    } catch (err) {
      console.warn('⚠️  Failed to persist intake:', err);
    }
  }, [getIntake]);

  const updateIntake = (data: Partial<IntakeData>) => {
    console.log('📝 IntakeContext updating with:', data);
    setIntake((prev) => {
      const updated = { ...prev, ...data };
      console.log('📊 IntakeContext new state:', {
        ...updated,
        photo: updated.photo ? `[File: ${updated.photo.name}]` : undefined,
        voice: updated.voice ? `[Blob: ${updated.voice.size} bytes]` : undefined,
      });
      return updated;
    });
  };

  const markStepComplete = useCallback((step: string, data: Record<string, unknown> = {}) => {
    console.log(`✅ Marking step complete: ${step}`, data);
    
    setIntake((prev) => {
      // Calculate if entire process should be completed
      const updatedSteps = {
        ...prev.progress?.steps,
        [step]: { completed: true, data },
      };

      // Check if we're completing the SubmitStep - if so, mark process as complete
      const isProcessComplete = step === 'SubmitStep' || step === 'ResultsStep' || prev.progress?.completed;

      // If completing SubmitStep, also prepare ResultsStep
      if (step === 'SubmitStep') {
        updatedSteps.ResultsStep = { completed: true, data: { ready: true } };
      }

      const updated = {
        ...prev,
        progress: {
          lastStep: step,
          completed: isProcessComplete,
          steps: updatedSteps,
        },
      };

      console.log('📊 Step completion updated:', {
        step,
        isProcessComplete,
        lastStep: updated.progress.lastStep,
        completedSteps: Object.entries(updated.progress.steps)
          .filter(([, status]) => status?.completed)
          .map(([stepName]) => stepName),
      });

      return updated;
    });
  }, []);

  // FIXED: Properly handle string indexing with type assertion
  const isStepComplete = useCallback((step: string): boolean => {
    const stepStatus = getIntake.progress?.steps?.[step as StepKey];
    return stepStatus?.completed || false;
  }, [getIntake.progress?.steps]);

  const getCompletionStatus = useCallback(() => {
    const progress = getIntake.progress;
    const completedSteps = Object.entries(progress?.steps || {})
      .filter(([, status]) => status?.completed)
      .map(([stepName]) => stepName);
    
    return {
      completed: progress?.completed || false,
      currentStep: progress?.lastStep || 'PersonalityStep',
      completedSteps,
    };
  }, [getIntake.progress]);

  const resetIntake = useCallback(() => {
    console.log('🔄 Resetting intake context');
    setIntake({});
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <IntakeContext.Provider 
      value={{ 
        getIntake, 
        updateIntake, 
        markStepComplete, 
        isStepComplete,
        getCompletionStatus,
        resetIntake 
      }}
    >
      {children}
    </IntakeContext.Provider>
  );
};

export const useIntake = () => {
  const context = useContext(IntakeContext);
  if (!context) {
    throw new Error('useIntake must be used within IntakeProvider');
  }
  return context;
};
