// src/types/truthstream.ts
// TruthStream TypeScript interfaces and types

// ============================================================================
// CORE TYPES
// ============================================================================

export type ReviewClassification = 'constructive' | 'affirming' | 'raw_truth' | 'hostile';
export type ReviewTone = 'encouraging' | 'constructive' | 'neutral' | 'brutally_honest' | 'critical';
export type QueueStatus = 'pending' | 'in_progress' | 'completed' | 'expired' | 'skipped';
export type GroupWant = 'yes' | 'maybe' | 'no';
export type CircleFrequency = 'weekly' | 'biweekly' | 'monthly';
export type AnalysisType = 'truth_mirror_report' | 'temporal_trend' | 'blind_spot' | 'growth_recommendation';
export type DialogueRole = 'reviewee' | 'reviewer';

// ============================================================================
// IMPRESSION WORDS (curated selection)
// ============================================================================

export const IMPRESSION_WORDS = [
  'Warm', 'Intimidating', 'Genuine', 'Guarded', 'Creative',
  'Analytical', 'Charismatic', 'Reserved', 'Trustworthy', 'Unpredictable',
  'Grounded', 'Intense', 'Approachable', 'Mysterious', 'Confident',
  'Anxious', 'Authentic', 'Performative', 'Kind', 'Sharp',
  'Magnetic', 'Distant', 'Thoughtful', 'Impulsive', 'Resilient',
  'Sensitive', 'Driven', 'Laid-back', 'Inspiring', 'Cautious'
] as const;

export type ImpressionWord = typeof IMPRESSION_WORDS[number];

// ============================================================================
// STRENGTH & STRUGGLE CATEGORIES
// ============================================================================

export const STRENGTH_CATEGORIES = [
  'Communication', 'Leadership', 'Empathy', 'Creativity', 'Resilience',
  'Intelligence', 'Humor', 'Authenticity', 'Ambition', 'Compassion'
] as const;

export const STRUGGLE_CATEGORIES = [
  'Self-confidence', 'Overthinking', 'Boundaries', 'Vulnerability',
  'Patience', 'Listening', 'Assertiveness', 'Perfectionism', 'Trust', 'Adaptability'
] as const;

export type StrengthCategory = typeof STRENGTH_CATEGORIES[number];
export type StruggleCategory = typeof STRUGGLE_CATEGORIES[number];

// ============================================================================
// FEEDBACK AREA TAGS
// ============================================================================

export const FEEDBACK_AREAS = [
  'Leadership', 'Communication', 'First Impressions', 'Emotional Intelligence',
  'Creativity', 'Professionalism', 'Social Skills', 'Confidence',
  'Authenticity', 'Approachability', 'Work Ethic', 'Sense of Humor',
  'Reliability', 'Open-mindedness', 'Conflict Resolution'
] as const;

export type FeedbackArea = typeof FEEDBACK_AREAS[number];

// ============================================================================
// SHAREABLE DATA TYPES (minimum 3 required for TruthStream)
// ============================================================================

export type TruthStreamShareableType =
  | 'personality'
  | 'cognitive'
  | 'facial'
  | 'voice'
  | 'astrological';

export const MINIMUM_SHARE_COUNT = 3;

// ============================================================================
// TRUTH CARD (Profile)
// ============================================================================

export interface TruthStreamProfile {
  id: string;
  userId: number;
  selfStatement: string;
  feedbackAreas: FeedbackArea[];
  sharedDataTypes: TruthStreamShareableType[];
  isActive: boolean;
  minimumShareMet: boolean;
  profileCompleteness: number;
  totalReviewsReceived: number;
  totalReviewsGiven: number;
  reviewerQualityScore: number;
  perceptionGapScore: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface TruthCardData {
  profile: TruthStreamProfile;
  // Populated from shared assessment data
  personalitySnapshot?: {
    mbtiType: string;
    mbtiDescription: string;
    big5: {
      openness: number;
      conscientiousness: number;
      extraversion: number;
      agreeableness: number;
      neuroticism: number;
    };
    dominantTraits: string[];
  };
  voiceSignature?: {
    characteristics: string[];
    communicationStyle: string;
  };
  astrologicalHighlights?: {
    sunSign: string;
    moonSign: string;
    risingSign: string;
    interpretation: string;
  };
  cognitiveStyle?: {
    problemSolvingApproach: string;
    learningStyle: string;
  };
  facialPresentation?: {
    photoUrl?: string;
    dominantExpression: string;
  };
  groupParticipation?: {
    groupCount: number;
    activityLevel: 'low' | 'moderate' | 'high' | 'very_high';
  };
}

export interface CreateTruthProfileRequest {
  selfStatement: string;
  feedbackAreas: FeedbackArea[];
  sharedDataTypes: TruthStreamShareableType[];
}

export interface UpdateTruthProfileRequest {
  selfStatement?: string;
  feedbackAreas?: FeedbackArea[];
  sharedDataTypes?: TruthStreamShareableType[];
  isActive?: boolean;
}

// ============================================================================
// REVIEW QUEUE
// ============================================================================

export interface QueueItem {
  id: string;
  reviewerId: number;
  revieweeId: number;
  batchNumber: number;
  status: QueueStatus;
  assignedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  expiresAt: string;
  timeSpentSeconds: number;
  // Populated for display
  truthCard?: TruthCardData;
}

export interface ReviewQueueBatch {
  items: QueueItem[];
  batchNumber: number;
  completedCount: number;
  totalCount: number;
  canReceiveReviews: boolean; // true only when current batch is completed
  nextBatchAvailableAt: string | null;
}

// ============================================================================
// REVIEW SUBMISSION
// ============================================================================

export interface ReviewSubmission {
  queueId: string;

  // Section A: First Impression
  firstImpressionScore: number;           // 1-10
  firstImpressionExplanation: string;
  impressionWords: ImpressionWord[];      // 3-5 words

  // Section B: Attractiveness
  physicalPresentationScore: number;      // 1-10
  intellectualAttractivenessScore: number; // 1-10
  emotionalAttractivenessScore: number;   // 1-10
  socialEnergyScore: number;              // 1-10
  socialEnergyExplanation: string;

  // Section C: Perspective
  greatestStrengthCategory: StrengthCategory;
  greatestStrengthExplanation: string;
  struggleCategory: StruggleCategory;
  struggleExplanation: string;
  selfAlignmentScore: number;             // 1-10

  // Section D: Overall
  advice: string;
  overallScore: number;                   // 1-10
  wouldWantInGroup: GroupWant;
  groupReason: string;

  // Section E: Free-Form (optional)
  freeFormText?: string;
  reviewTone: ReviewTone;
}

// ============================================================================
// REVIEW (received/given)
// ============================================================================

export interface TruthStreamReview {
  id: string;
  queueId: string;
  reviewerId: number;    // only visible server-side, never sent to reviewee
  revieweeId: number;

  // Scores
  firstImpressionScore: number;
  firstImpressionExplanation: string;
  impressionWords: ImpressionWord[];
  physicalPresentationScore: number;
  intellectualAttractivenessScore: number;
  emotionalAttractivenessScore: number;
  socialEnergyScore: number;
  socialEnergyExplanation: string;
  greatestStrengthCategory: StrengthCategory;
  greatestStrengthExplanation: string;
  struggleCategory: StruggleCategory;
  struggleExplanation: string;
  selfAlignmentScore: number;
  advice: string;
  overallScore: number;
  wouldWantInGroup: GroupWant;
  groupReason: string;
  freeFormText?: string;
  reviewTone: ReviewTone;

  // Dina Classification
  classification: ReviewClassification | null;
  classificationConfidence: number | null;
  classificationReasoning: string | null;
  dinaCounterAnalysis: string | null;

  // Metadata
  completenessScore: number;
  qualityScore: number;
  timeSpentSeconds: number;
  helpfulCount: number;
  isFlagged: boolean;
  flagReason: string | null;
  hasUserMarkedHelpful: boolean;  // for current user
  responseCount: number;

  createdAt: string;
  updatedAt: string;
}

// For reviewee view - reviewer identity is stripped
export interface AnonymousReview extends Omit<TruthStreamReview, 'reviewerId' | 'queueId'> {
  reviewerLabel: string; // "Reviewer #3" or "Anonymous"
}

// ============================================================================
// REVIEW RESPONSES (Anonymous Dialogue)
// ============================================================================

export interface ReviewResponse {
  id: string;
  reviewId: string;
  authorRole: DialogueRole;
  content: string;
  createdAt: string;
}

// ============================================================================
// DINA ANALYSIS
// ============================================================================

export interface TruthMirrorReport {
  id: string;
  userId: number;
  analysisType: 'truth_mirror_report';
  reviewCountAtGeneration: number;
  confidenceLevel: number;
  perceptionGapScore: number;
  analysisData: {
    perceptionSummary: {
      overview: string;
      averageScores: {
        firstImpression: number;
        physicalPresentation: number;
        intellectualAttractiveness: number;
        emotionalAttractiveness: number;
        socialEnergy: number;
        overall: number;
        selfAlignment: number;
      };
      topImpressionWords: Array<{ word: string; count: number; percentage: number }>;
      strengthDistribution: Array<{ category: string; count: number; percentage: number }>;
      struggleDistribution: Array<{ category: string; count: number; percentage: number }>;
    };
    patternDetection: Array<{
      pattern: string;
      frequency: number;
      reviewerCount: number;
      significance: 'high' | 'medium' | 'low';
      description: string;
    }>;
    blindSpots: Array<{
      dimension: string;
      selfScore: number;
      externalScore: number;
      gap: number;
      interpretation: string;
    }>;
    perceptionGap: {
      score: number;
      level: 'exceptional' | 'good' | 'significant_gaps' | 'major_disconnect';
      summary: string;
      details: string[];
    };
    growthRecommendations: Array<{
      area: string;
      recommendation: string;
      journalPrompt?: string;
      suggestedGroupType?: string;
      priority: 'high' | 'medium' | 'low';
    }>;
    communityInsights: {
      personalityTypeComparison: string;
      percentileScores: Record<string, number>;
    };
  };
  createdAt: string;
}

export interface TemporalTrend {
  id: string;
  userId: number;
  analysisType: 'temporal_trend';
  analysisData: {
    timeRange: { start: string; end: string };
    dimensions: Array<{
      name: string;
      dataPoints: Array<{ date: string; score: number; reviewCount: number }>;
      trend: 'improving' | 'declining' | 'stable';
      changePercent: number;
    }>;
    summary: string;
    insights: string[];
  };
  createdAt: string;
}

// ============================================================================
// TRUTH CIRCLES
// ============================================================================

export interface TruthCircle {
  id: string;
  name: string;
  description: string;
  creatorId: number;
  reviewFrequency: CircleFrequency;
  maxMembers: number;
  memberCount: number;
  isActive: boolean;
  createdAt: string;
}

export interface TruthCircleMember {
  id: string;
  circleId: string;
  userId: number;
  username: string;
  joinedAt: string;
  status: 'active' | 'inactive' | 'removed';
}

export interface CreateCircleRequest {
  name: string;
  description: string;
  reviewFrequency: CircleFrequency;
  maxMembers: number;
}

// ============================================================================
// FEEDBACK REQUESTS
// ============================================================================

export interface FeedbackRequest {
  id: string;
  userId: number;
  username: string;
  question: string;
  context?: string;
  isActive: boolean;
  responseCount: number;
  createdAt: string;
  expiresAt: string | null;
}

export interface CreateFeedbackRequestPayload {
  question: string;
  context?: string;
  expiresInHours?: number;
}

// ============================================================================
// MILESTONES
// ============================================================================

export interface Milestone {
  id: string;
  userId: number;
  milestoneType: string;
  milestoneName: string;
  milestoneDescription: string;
  achievedAt: string;
}

export const MILESTONE_DEFINITIONS: Record<string, { name: string; description: string; icon: string }> = {
  perception_pioneer: {
    name: 'Perception Pioneer',
    description: 'Received first 10 reviews',
    icon: 'compass'
  },
  self_aware: {
    name: 'Self-Aware',
    description: 'Perception Gap Score above 80',
    icon: 'eye'
  },
  growth_champion: {
    name: 'Growth Champion',
    description: 'Improvement in 3+ dimensions over 30 days',
    icon: 'trending-up'
  },
  trusted_voice: {
    name: 'Trusted Voice',
    description: 'High reviewer quality score (top 20%)',
    icon: 'star'
  },
  mirror_master: {
    name: 'Mirror Master',
    description: '100+ quality reviews given',
    icon: 'award'
  },
  truth_seeker: {
    name: 'Truth Seeker',
    description: 'Completed 50 reviews with high quality',
    icon: 'search'
  },
  circle_builder: {
    name: 'Circle Builder',
    description: 'Created and maintained a Truth Circle for 30 days',
    icon: 'users'
  }
};

// ============================================================================
// STATISTICS
// ============================================================================

export interface TruthStreamStats {
  totalReviewsReceived: number;
  totalReviewsGiven: number;
  averageOverallScore: number;
  averageQualityScore: number;
  reviewerQualityScore: number;
  perceptionGapScore: number | null;
  currentQueueSize: number;
  completedBatches: number;
  milestonesEarned: number;
  circlesJoined: number;
  activeFeedbackRequests: number;
  classificationBreakdown: {
    constructive: number;
    affirming: number;
    rawTruth: number;
    hostile: number;
  };
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface TruthStreamApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface PaginatedTruthStreamResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
