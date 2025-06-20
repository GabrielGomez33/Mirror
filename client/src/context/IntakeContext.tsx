// src/context/IntakeContext.tsx
import {createContext, useContext, useState} from 'react'
import type {ReactNode} from 'react'

// Define proper types to replace 'any'
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
  western: {
    sunSign: string;
    moonSign: string;
    risingSign: string;
    houses: Record<string, string>;
    planetaryPlacements: Record<string, string>;
    dominantElement: string;
    modality: string;
    chartRuler: string;
  };
  chinese: {
    animalSign: string;
    element: string;
    yinYang: string;
    innerAnimal: string;
    secretAnimal: string;
    luckyNumbers: number[];
    luckyColors: string[];
    personality: string[];
    compatibility: string[];
    lifePhase: string;
  };
  african: {
    orishaGuardian: string;
    ancestralSpirit: string;
    elementalForce: string;
    sacredAnimal: string;
    lifeDestiny: string;
    spiritualGifts: string[];
    challenges: string[];
    ceremonies: string[];
    seasons: string;
  };
  numerology: {
    lifePathNumber: number;
    destinyNumber: number;
    soulUrgeNumber: number;
    personalityNumber: number;
    birthDayNumber: number;
    meanings: Record<string, string>;
  };
  synthesis: {
    coreThemes: string[];
    lifeDirection: string;
    spiritualPath: string;
    relationships: string;
    career: string;
    wellness: string;
  };
}

// Your exact original structure - just replaced 'any' with proper types
type IntakeData = {
  [key:string]:any
  astrologicalResult?: AstrologicalResult
  photo?: File
  faceAnalysis?: any  // Keep as any since you're using it
  name?: string
  iqResults?: any     // Keep as any since you're using it
  iqAnswers?: any     // Keep as any since you're using it
  personality?: any
  personalityResult?: PersonalityResult
  personalityAnswers?: any
  fears?: string
  voice?: Blob
  voicePrompt?: string
  voiceDuration?: number
  voiceMetadata?: object  // Changed from object to any if needed
  userRegistered?: boolean
  userLoggedIn?: boolean
}

type IntakeContextType = {
  getIntake: IntakeData
  updateIntake: (data: Partial<IntakeData>) => void
}

const IntakeContext = createContext<IntakeContextType | undefined>(undefined)

export const IntakeProvider = ({children}: {children: ReactNode}) => {
  const [getIntake, setIntake] = useState<IntakeData>({})
  const updateIntake = (data: Partial<IntakeData>) => {
    setIntake((prev) => ({...prev, ...data}))
  }
  return (
    <IntakeContext.Provider value={{getIntake, updateIntake}}>
      {children}
    </IntakeContext.Provider>
  )
}

export const useIntake = () => {
  const context = useContext(IntakeContext)
  if(!context){
    throw new Error('useIntake must be used within IntakeProvider')
  }
  return context
}
