// src/context/IntakeContext.tsx
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
  blobUrl: string;          // object URL for same-session preview
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

  // Progress tracking
  progress?: {
    lastStep: string;
    completed: boolean;
    steps: {
      VisualStep?: StepStatus;
      VocalStep?: StepStatus;
      PersonalityStep?: StepStatus;
      IQStep?: StepStatus;
      SubmitStep?: StepStatus;
      ResultsStep?: StepStatus;
    };
  };
};

type IntakeContextType = {
  getIntake: IntakeData;
  updateIntake: (data: Partial<IntakeData>) => void;
  markStepComplete: (step: string, data?: Record<string, unknown>) => void;
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
        setIntake(parsed);
      }
    } catch (err) {
      console.warn('Failed to hydrate intake from localStorage:', err);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Persist to localStorage on change (skip blobs)
  useEffect(() => {
    try {
      const { photo, voice, ...safe } = getIntake;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    } catch (err) {
      console.warn('Failed to persist intake:', err);
    }
  }, [getIntake]);

  const updateIntake = (data: Partial<IntakeData>) => {
    console.log('📝 IntakeContext updating with:', data);
    setIntake((prev) => {
      const updated = { ...prev, ...data };
      console.log('📊 IntakeContext new state:', updated);
      return updated;
    });
  };

  const markStepComplete = useCallback((step: string, data: Record<string, unknown> = {}) => {
    setIntake((prev) => {
      const updated = {
        ...prev,
        progress: {
          lastStep: step,
          completed: step === 'ResultsStep' ? true : prev.progress?.completed || false,
          steps: {
            ...prev.progress?.steps,
            [step]: { completed: true, data },
          },
        },
      };
      return updated;
    });
  }, []);

  const resetIntake = useCallback(() => {
    setIntake({});
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <IntakeContext.Provider value={{ getIntake, updateIntake, markStepComplete, resetIntake }}>
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
