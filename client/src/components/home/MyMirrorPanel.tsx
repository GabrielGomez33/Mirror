import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getPersonalIntelligenceApi,
  requestPersonalAnalysisApi,
  getLatestAnalysisApi,
  clearAnalysisCache,
} from '../../services/mirrorDashboard';
const DataExportTab = lazy(() => import('./DataExportTab'));

import type {
  PersonalAnalysisResult,
} from '../../services/mirrorDashboard';

// ============================================================================
// TYPES (aligned to new server payload)
// ============================================================================

type Trend = 'up' | 'down' | 'stable';

interface PersonalityAnswersMap {
  [key: string]: {
    text: string;
    value: string;
    score: number;
  } | {
    text: string; // free text (e.g., reflection-essence)
    value: string;
    score: number;
  };
}

interface CompletePersonalityData {
  available: boolean;
  mbti?: { type: string; description: string };
  big5Profile?: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  };
  dominantTraits?: string[];
  assessmentQuality?: string;
  personalityAnswers?: PersonalityAnswersMap;
}

interface WesternAstrology {
  sunSign: string;
  moonSign: string;
  risingSign: string;
  houses: Record<string, string>;
  planetaryPlacements: Record<string, string>;
  dominantElement: string;
  modality: string;
  chartRuler: string;
}

interface ChineseAstrology {
  animalSign: string;
  element: string;
  yinYang: string;
  innerAnimal?: string;
  luckyNumbers: number[];
  lifePhase?: string;
  secretAnimal?: string;
  luckyColors?: string[];
  personality?: string[];
}

interface AfricanAstrology {
  orishaGuardian: string;
  element: string | undefined; // legacy
  elementalForce: string;
  sacredAnimal: string;
  lifeDestiny: string;
  spiritualGifts: string[];
  challenges: string[];
  ceremonies?: string[];
}

interface Numerology {
  lifePathNumber: number;
  destinyNumber: number;
  soulUrgeNumber: number;
  personalityNumber: number;
  birthDayNumber: number;
  meanings: Record<string, string>;
}

interface AstroSynthesis {
  coreThemes: string[];
  lifeDirection: string;
  spiritualPath: string;
  relationships: string;
  career: string;
  wellness: string;
}

interface CompleteAstrologicalData {
  available: boolean;
  western: WesternAstrology;
  chinese: ChineseAstrology;
  african: AfricanAstrology;
  numerology: Numerology;
  synthesis: AstroSynthesis;
}

interface CompleteCognitiveData {
  available: boolean;
  iqScore: number;
  category: string;
  rawScore: number;
  totalQuestions: number;
  strengths: string[];
  description: string;
  percentile: number;
  iqAnswers?: Record<string, string>;
}

interface EmotionPoint { emotion: string; intensity: number; }

interface CompleteEmotionalData {
  available: boolean;
  expressions: Record<string, number>;
  facialAngles: { roll: number; pitch: number; yaw: number };
  detection: { confidence: number; landmarks: number };
  dominantEmotion: { emotion: string; confidence: number };
  emotionalSpectrum: EmotionPoint[];
}

interface CompleteVoiceData {
  available: boolean;
  duration: number;
  mimeType: string;
  size: number;
  deviceInfo: { isMobile: boolean; platform: string; browser: string };
  quality: 'Excellent' | 'Good' | 'Fair' | 'Poor' | string;
  voiceFileRef?: {
    filename: string;
    tier: string;
    size: number;
    mimetype: string;
    uploadedAt: string;
    originalname: string;
    duration: number;
    deviceInfo: { isMobile: boolean; platform: string; browser: string };
  };
}

interface AssessmentMetadata {
  completionDate: string;
  sectionsCompleted: {
    personality: boolean;
    astrology: boolean;
    cognitive: boolean;
    emotional: boolean;
    voice: boolean;
  };
  totalSections: number;
  completionPercentage: number;
  dataIntegrity: 'Complete' | 'Partial' | string;
}

interface Snapshot {
  dominantTraits: string[];
  currentLifePhase: string;
  cognitiveStrengths: string[];
  emotionalProfile: {
    primaryEmotions: string[];
    emotionalStability: number;
    expressiveness: number;
  };
  astrologicalHighlights: {
    sunSign: string;
    moonSign: string;
    dominantElement: string;
    currentTransits: string[];
  };
}

interface LiveInsight {
  id: string;
  text: string;
  category: string;
  confidence: number;
  timestamp: string | Date;
  sourceModalities: string[];
  actionable?: string;
}

interface MirrorScore {
  selfAwarenessIndex: number;
  growthMomentum: number;
  reflectionDepth: number;
  authenticity: number;
  overall: number;
}

interface GrowthMetrics {
  areasOfFocus: string[];
  progressIndicators: { area: string; progress: number; trend: Trend }[];
  consistencyScore: number;
  developmentVelocity: number;
}

interface DashboardData {
  personalitySnapshot: Snapshot;
  liveInsights: LiveInsight[];
  mirrorScore: MirrorScore;
  growthMetrics: GrowthMetrics;
  recentActivity: any[];
  completePersonalityData: CompletePersonalityData;
  completeAstrologicalData: CompleteAstrologicalData;
  completeCognitiveData: CompleteCognitiveData;
  completeEmotionalData: CompleteEmotionalData;
  completeVoiceData: CompleteVoiceData;
  assessmentMetadata: AssessmentMetadata;
}

interface ServerEnvelope {
  success: boolean;
  data: DashboardData;
  timestamp: string;
  sources: { intake: boolean; insights: number; dina_server: string };
}

// ============================================================================
// SCORE COLORS (from TruthStream AnalysisDashboard — identical palette)
// ============================================================================

const SCORE_COLORS: Record<string, { color: string; glow: string }> = {
  selfAwareness:         { color: '#60a5fa', glow: 'rgba(96,165,250,0.35)' },
  emotionalIntelligence: { color: '#fb923c', glow: 'rgba(251,146,60,0.35)' },
  growthMomentum:        { color: '#4ade80', glow: 'rgba(74,222,128,0.35)' },
  authenticity:          { color: '#f472b6', glow: 'rgba(244,114,182,0.35)' },
  resilience:            { color: '#818cf8', glow: 'rgba(129,140,248,0.35)' },
  mindfulness:           { color: '#2dd4bf', glow: 'rgba(45,212,191,0.35)' },
};

const FALLBACK_COLORS = [
  { color: '#f472b6', glow: 'rgba(244,114,182,0.35)' },
  { color: '#a78bfa', glow: 'rgba(167,139,250,0.35)' },
  { color: '#60a5fa', glow: 'rgba(96,165,250,0.35)' },
  { color: '#4ade80', glow: 'rgba(74,222,128,0.35)' },
  { color: '#facc15', glow: 'rgba(250,204,21,0.35)' },
  { color: '#fb923c', glow: 'rgba(251,146,60,0.35)' },
  { color: '#2dd4bf', glow: 'rgba(45,212,191,0.35)' },
  { color: '#f87171', glow: 'rgba(248,113,113,0.35)' },
];

function getScoreColor(key: string, index: number) {
  return SCORE_COLORS[key] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function trendColor(trend: string) {
  switch (trend) {
    case 'improving': case 'ascending': case 'increasing': case 'deepening':
      return { color: '#4ade80', glow: 'rgba(74,222,128,0.35)' };
    case 'declining': case 'descending': case 'decreasing':
      return { color: '#f87171', glow: 'rgba(248,113,113,0.35)' };
    case 'volatile': case 'cyclical':
      return { color: '#facc15', glow: 'rgba(250,204,21,0.35)' };
    default:
      return { color: '#60a5fa', glow: 'rgba(96,165,250,0.35)' };
  }
}

function priorityColor(priority: string) {
  switch (priority) {
    case 'high':   return { color: '#f87171', glow: 'rgba(248,113,113,0.3)' };
    case 'medium': return { color: '#fb923c', glow: 'rgba(251,146,60,0.3)' };
    default:       return { color: '#4ade80', glow: 'rgba(74,222,128,0.3)' };
  }
}

// Polling for analysis (same as AnalysisDashboard)
const POLL_INTERVAL = 8000;
const MAX_POLL_DURATION = 200000;

// ============================================================================
// SVG SCORE RING (from TruthStream AnalysisDashboard)
// ============================================================================

const ScoreRing: React.FC<{
  score: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  glow: string;
  label?: string;
}> = ({ score, size = 72, strokeWidth = 4, color, glow, label }) => {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} />
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
            style={{ filter: `drop-shadow(0 0 6px ${glow})` }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="enhanced-glass-heading" style={{ fontSize: size * 0.28, color, margin: 0 }}>
            {Math.round(score)}
          </span>
        </div>
      </div>
      {label && (
        <span style={{ fontSize: 10, textAlign: 'center', margin: 0, color: 'var(--mg-body, #4a1a2e)', textShadow: '0 1px 3px rgba(126,65,81,0.3)', fontWeight: 500 }}>{label}</span>
      )}
    </div>
  );
};

// ============================================================================
// ANIMATED BAR (from TruthStream AnalysisDashboard)
// ============================================================================

const AnimatedBar: React.FC<{
  label: string;
  value: number;
  maxValue: number;
  color: string;
  glow: string;
  index: number;
  suffix?: string;
}> = ({ label, value, maxValue, color, glow, index, suffix = '' }) => {
  const pctVal = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      style={{ display: 'flex', alignItems: 'center', gap: 10 }}
    >
      <span style={{ fontSize: 12, width: 120, textAlign: 'right', flexShrink: 0, margin: 0, color: 'var(--mg-body, #4a1a2e)', textShadow: '0 1px 2px rgba(126,65,81,0.25)', fontWeight: 500 }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(pctVal, 2)}%` }}
          transition={{ delay: 0.1 + index * 0.04, duration: 0.5, ease: 'easeOut' }}
          style={{
            height: '100%',
            borderRadius: 3,
            background: `linear-gradient(90deg, ${color}99, ${color})`,
            boxShadow: pctVal > 5 ? `0 0 8px ${glow}, 0 0 2px ${color}` : 'none',
          }}
        />
      </div>
      <span className="enhanced-glass-text" style={{ fontSize: 11, fontWeight: 600, width: 38, textAlign: 'right', flexShrink: 0, margin: 0, fontFamily: 'monospace' }}>
        {typeof value === 'number' ? value.toFixed(suffix === '%' ? 0 : 1) : value}{suffix}
      </span>
    </motion.div>
  );
};

// ============================================================================
// ORBITAL LOADER (from TruthStream AnalysisDashboard)
// ============================================================================

const OrbitalLoader: React.FC<{ elapsed: number; maxDuration: number; message?: string }> = ({ elapsed, maxDuration, message }) => {
  const progress = Math.min((elapsed / maxDuration) * 100, 95);
  const seconds = Math.floor((elapsed % 60000) / 1000);
  const minutes = Math.floor(elapsed / 60000);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px' }}
    >
      <div style={{ position: 'relative', width: 100, height: 100, marginBottom: 20 }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid transparent', borderTopColor: '#f472b6', borderRightColor: 'rgba(244,114,182,0.3)', filter: 'drop-shadow(0 0 8px rgba(244,114,182,0.4))' }} />
        <motion.div animate={{ rotate: -360 }} transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
          style={{ position: 'absolute', inset: 14, borderRadius: '50%', border: '2px solid transparent', borderTopColor: '#a78bfa', borderLeftColor: 'rgba(167,139,250,0.3)', filter: 'drop-shadow(0 0 6px rgba(167,139,250,0.4))' }} />
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          style={{ position: 'absolute', inset: 28, borderRadius: '50%', border: '2px solid transparent', borderBottomColor: '#60a5fa', borderRightColor: 'rgba(96,165,250,0.3)', filter: 'drop-shadow(0 0 6px rgba(96,165,250,0.4))' }} />
        <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ position: 'absolute', inset: 38, borderRadius: '50%', background: 'radial-gradient(circle, rgba(244,114,182,0.3), rgba(167,139,250,0.1))', boxShadow: '0 0 20px rgba(244,114,182,0.2)' }} />
      </div>
      <motion.h3 className="enhanced-glass-heading" style={{ fontSize: 14, marginBottom: 6, textAlign: 'center' }}
        animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
        {message || 'Generating Your Personal Analysis'}
      </motion.h3>
      <p className="enhanced-glass-body" style={{ fontSize: 11, marginBottom: 12, textAlign: 'center', maxWidth: 260 }}>
        Dina is analyzing your intake data and journal entries. This typically takes 1-2 minutes.
      </p>
      <div style={{ width: 180, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 6 }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 1.5, ease: 'easeOut' }}
          style={{ height: '100%', borderRadius: 2, background: 'linear-gradient(90deg, #f472b6, #a78bfa, #60a5fa)', boxShadow: '0 0 8px rgba(244,114,182,0.35)' }} />
      </div>
      <p className="enhanced-glass-subtle" style={{ fontSize: 10, margin: 0, fontFamily: 'monospace' }}>
        {minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`} elapsed
      </p>
    </motion.div>
  );
};

// ============================================================================
// GLASS BADGE (from TruthStream AnalysisDashboard)
// ============================================================================

const GlassBadge: React.FC<{ label: string; sublabel?: string; color: string }> = ({ label, sublabel, color }) => (
  <div
    className="enhanced-glass-card"
    style={{ display: 'inline-flex', flexDirection: 'column', padding: '6px 14px', borderRadius: 12, borderLeft: `3px solid ${color}`, marginBottom: 0, textAlign: 'center' }}
  >
    <span className="enhanced-glass-text" style={{ fontSize: 12, fontWeight: 600, margin: 0 }}>{label}</span>
    {sublabel && <span className="enhanced-glass-subtle" style={{ fontSize: 10, margin: 0 }}>{sublabel}</span>}
  </div>
);

// ============================================================================
// THEME HELPERS
// ============================================================================

const THEME = {
  textPrimary: 'var(--mg-label, #6a1f33)',
  textBody: 'var(--mg-body, #7e4151)',
  textHeading: 'var(--mg-heading, #784552)',
};

const chip = (text: string) =>
  <span key={text} className="text-xs px-3 py-1.5 rounded-full" style={{ color: THEME.textPrimary, textShadow: '0px 1px 3px var(--mg-body, #7e4151)', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.08)', letterSpacing: '0.01em' }}>{text}</span>;

const getElementSymbol = (element?: string) => {
  switch ((element || '').toLowerCase()) {
    case 'fire': return '🔥';
    case 'water': return '🌊';
    case 'earth': return '🌍';
    case 'air': return '💨';
    default: return '✨';
  }
};

const pct = (n?: number) => `${Math.max(0, Math.min(100, Math.round(n || 0)))}%`;

// ============================================================================
// MICRO NARRATIVES (derived, concise story beats)
// ============================================================================

type Narrative = { title: string; text: string };

function buildMicroNarratives(d: DashboardData): Narrative[] {
  const big5 = d.completePersonalityData.big5Profile || {
    openness: 0, conscientiousness: 0, extraversion: 0, agreeableness: 0, neuroticism: 0,
  };
  const mbti = d.completePersonalityData.mbti?.type || '—';
  const sun = d.completeAstrologicalData.western?.sunSign;
  const moon = d.completeAstrologicalData.western?.moonSign;
  const lifePath = d.completeAstrologicalData.numerology?.lifePathNumber;
  const strength = d.personalitySnapshot.cognitiveStrengths?.[0] || d.completeCognitiveData.strengths?.[0];
  const domEmotion = d.completeEmotionalData.dominantEmotion?.emotion;
  const domEmotionPct = Math.round((d.completeEmotionalData.dominantEmotion?.confidence || 0) * 100);

  const selfTone = big5.neuroticism >= 70
    ? 'You experience strong emotional currents; grounding and pacing will multiply your clarity.'
    : 'Your emotional base is steady; you thrive when you choose deliberate challenges.';

  const socialTone = big5.extraversion <= 45
    ? 'You invest energy in fewer, deeper bonds; authentic visibility beats broad exposure.'
    : 'You recharge through shared momentum and fast feedback loops.';

  const workTone = lifePath === 4
    ? 'Builder energy favors consistent systems and outcomes you can measure.'
    : 'Lean into projects that mirror your natural cadence and attention span.';

  const astroBlend = `${sun} Sun / ${moon} Moon`.replace('undefined', '—');

  return [
    {
      title: 'Self',
      text: `As a ${mbti} with ${astroBlend}, your center of gravity skews toward action with reflection. ${selfTone}`,
    },
    {
      title: 'Relationships',
      text: `${moon} moon shapes your emotional cadence; you signal safety through consistency more than words. ${socialTone}`,
    },
    {
      title: 'Career',
      text: `Your ${strength || 'key strength'} meets Life Path ${lifePath}. ${workTone}`,
    },
    {
      title: 'Wellness',
      text: `Dominant emotion detected: ${domEmotion} (${domEmotionPct}%). Micro-shifts in routine and breath lengthen your buffer before reactivity.`,
    },
    {
      title: 'Momentum',
      text: `Current phase: ${d.personalitySnapshot.currentLifePhase}. Focus on "${d.growthMetrics.areasOfFocus?.[0] || 'consistent practice'}" to convert insight into velocity.`,
    },
  ];
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

type TabId = 'overview' | 'analysis' | 'personality' | 'astrology' | 'cognitive' | 'emotional' | 'voice' | 'answers' | 'meta' | 'export';

export function MyMirrorPanel() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState('Seeker');
  const [active, setActive] = useState<TabId>('overview');

  // === Insight dropdown state ===
  const [insightExpanded, setInsightExpanded] = useState(false);

  // === Personal Analysis state (follows AnalysisDashboard polling pattern) ===
  const [analysis, setAnalysis] = useState<PersonalAnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [pollElapsed, setPollElapsed] = useState(0);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);
  const analysisIdBeforeRegen = useRef<string | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDashboard = async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      const res = await getPersonalIntelligenceApi();
      const payload: ServerEnvelope | DashboardData = res?.data ?? res;
      const next = (payload as ServerEnvelope)?.data ? (payload as ServerEnvelope).data : (payload as DashboardData);
      if (!next) throw new Error('Empty dashboard response');
      setData(next);

      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const u = JSON.parse(storedUser);
        setUserName(u.username || u.name || u.email?.split('@')[0] || 'Seeker');
      }
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
      if (showRefresh) setRefreshing(false);
    }
  };

  // Load latest analysis
  const loadAnalysis = useCallback(async () => {
    try {
      setAnalysisLoading(true);
      const result = await getLatestAnalysisApi();
      setAnalysis(result);
    } catch {
      // Non-critical — analysis may not exist yet
    } finally {
      setAnalysisLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    loadAnalysis();
  }, [loadAnalysis]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, []);

  // Stop polling when new analysis arrives (same as AnalysisDashboard)
  useEffect(() => {
    if (analysis && isPolling) {
      const isNewAnalysis = !analysisIdBeforeRegen.current || analysis.id !== analysisIdBeforeRegen.current;
      if (isNewAnalysis) {
        setIsPolling(false);
        setIsRegenerating(false);
        setPollElapsed(0);
        analysisIdBeforeRegen.current = null;
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        if (elapsedTimerRef.current) { clearInterval(elapsedTimerRef.current); elapsedTimerRef.current = null; }
      }
    }
  }, [analysis, isPolling]);

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);

    analysisIdBeforeRegen.current = analysis?.id ?? null;
    if (analysis) setIsRegenerating(true);

    setIsPolling(true);
    setPollElapsed(0);
    pollStartRef.current = Date.now();

    elapsedTimerRef.current = setInterval(() => {
      setPollElapsed(Date.now() - pollStartRef.current);
    }, 1000);

    pollRef.current = setInterval(async () => {
      const elapsed = Date.now() - pollStartRef.current;
      if (elapsed >= MAX_POLL_DURATION) {
        setIsPolling(false);
        setIsRegenerating(false);
        setPollTimedOut(true);
        if (pollRef.current) clearInterval(pollRef.current);
        if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
        pollRef.current = null;
        elapsedTimerRef.current = null;
        return;
      }
      try {
        clearAnalysisCache();
        await loadAnalysis();
      } catch {
        // Silently continue polling
      }
    }, POLL_INTERVAL);
  }, [loadAnalysis, analysis]);

  const handleRequestAnalysis = useCallback(async () => {
    setPollTimedOut(false);
    try {
      await requestPersonalAnalysisApi('comprehensive');
      startPolling();
    } catch (e) {
      console.error('Analysis request failed:', e);
    }
  }, [startPolling]);

  const micro = useMemo(() => (data ? buildMicroNarratives(data) : []), [data]);

  // Derived quick metrics for the Overview grid
  const quickStats = useMemo(() => {
    if (!data) return [];
    const p = data.completePersonalityData;
    const a = data.completeAstrologicalData;
    const c = data.completeCognitiveData;
    const e = data.completeEmotionalData;

    const big5 = p.big5Profile || { openness: 0, conscientiousness: 0, extraversion: 0, agreeableness: 0, neuroticism: 0 };

    const extremes = [
      { k: 'neuroticism', v: big5.neuroticism, label: 'Neuroticism' },
      { k: 'openness', v: big5.openness, label: 'Openness' },
      { k: 'conscientiousness', v: big5.conscientiousness, label: 'Conscientiousness' },
      { k: 'extraversion', v: big5.extraversion, label: 'Extraversion' },
      { k: 'agreeableness', v: big5.agreeableness, label: 'Agreeableness' },
    ]
      .sort((x, y) => (y.v || 0) - (x.v || 0))
      .slice(0, 2)
      .map((t) => `${t.label} ${Math.round(t.v)}%`)
      .join(' · ');

    return [
      { icon: '🧠', label: 'MBTI', value: p.mbti?.type || '—' },
      { icon: '☀️', label: 'Sun', value: a.western?.sunSign || '—' },
      { icon: '☽', label: 'Moon', value: a.western?.moonSign || '—' },
      { icon: '🔢', label: 'Life Path', value: String(a.numerology?.lifePathNumber ?? '—') },
      { icon: '📈', label: 'IQ (pct)', value: c.percentile ? `${c.percentile}th` : '—' },
      { icon: '🎛️', label: 'Stability', value: pct(data.personalitySnapshot.emotionalProfile?.emotionalStability) },
      { icon: '🎙️', label: 'Voice Quality', value: data.completeVoiceData.quality || '—' },
      { icon: '🧩', label: 'Big Five Peak', value: extremes || '—' },
      { icon: '💫', label: 'Dominant Emotion', value: e.dominantEmotion?.emotion ? `${e.dominantEmotion.emotion} (${Math.round((e.dominantEmotion.confidence || 0) * 100)}%)` : '—' },
      { icon: '✅', label: 'Completion', value: `${data.assessmentMetadata.completionPercentage}%` },
    ];
  }, [data]);

  // ========================================================================
  // RENDER STATES
  // ========================================================================

  if (loading) {
    return (
      <div className="enhanced-glass-panel enhanced-panel-mymirror h-full">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/30" />
          <span className="ml-4 enhanced-glass-text" style={{ color: THEME.textPrimary, textShadow: '0px 1px 3px var(--mg-body, #7e4151)' }}>
            Loading your Mirror...
          </span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="enhanced-glass-panel enhanced-panel-mymirror h-full">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="enhanced-glass-text mb-4" style={{ color: THEME.textPrimary }}>Unable to load your Mirror</p>
            <button onClick={() => fetchDashboard()} className="enhanced-action-button px-6 py-2">
              <span className="enhanced-glass-text font-medium" style={{ color: THEME.textPrimary, textShadow: '0px 1px 3px var(--mg-body, #7e4151)' }}>Retry</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { personalitySnapshot: snap, mirrorScore, growthMetrics } = data;
  const liveInsights = data.liveInsights;

  // ========================================================================
  // MAIN VIEW
  // ========================================================================

  return (
    <div className="enhanced-glass-panel enhanced-panel-mymirror h-full">
      {/* Header */}
      <div className="enhanced-glass-card">
        <div className="welcome-header mb-6">
          <h1 className="welcome-title" style={{ color: THEME.textPrimary, textShadow: '0px 1px 3px var(--mg-body, #7e4151)' }}>
            Welcome back, {userName}
          </h1>
          <p className="welcome-subtitle" style={{ color: THEME.textPrimary, textShadow: '0px 1px 3px var(--mg-body, #7e4151)' }}>
            {snap?.currentLifePhase || 'Your reflection journey continues'}
          </p>
          {(
            <div className="flex items-center gap-2 enhanced-glass-subtle text-sm mt-2" aria-live="polite">
              {refreshing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white/50" />
                  <span style={{ color: THEME.textPrimary, textShadow: '0px 1px 3px var(--mg-body, #7e4151)' }}>Updating insights...</span>
                </>
              ) : null}
            </div>
          )}
        </div>

        {/* Score & Refresh */}
        <div className="flex items-center gap-6 mb-6">
          <div className="enhanced-avatar-container" aria-hidden="true">
            <div className={`w-full h-full rounded-full bg-gradient-to-r ${mirrorScore?.overall >= 80
                ? 'from-emerald-400/30 to-green-400/30'
                : mirrorScore?.overall >= 60
                  ? 'from-blue-400/30 to-cyan-400/30'
                  : mirrorScore?.overall >= 40
                    ? 'from-yellow-400/30 to-amber-400/30'
                    : 'from-red-400/30 to-pink-400/30'
              } backdrop-blur-sm flex items-center justify-center border-2 border-white/20`}>
              <span className="text-2xl font-bold enhanced-glass-heading" style={{ color: THEME.textHeading }}>
                {mirrorScore?.overall ?? 0}
              </span>
            </div>
          </div>

          <div className="flex-1">
            <h2 className="enhanced-glass-heading text-xl mb-1" style={{ color: THEME.textHeading }}>Mirror Intelligence</h2>
            <p className="enhanced-glass-subtle text-sm mb-2" style={{ color: THEME.textPrimary, textShadow: '0px 1px 3px var(--mg-body, #7e4151)' }}>
              {snap?.dominantTraits?.[0] || 'Authentic Self'} • {snap?.astrologicalHighlights?.sunSign} ☉ / {snap?.astrologicalHighlights?.moonSign} ☽ {getElementSymbol(snap?.astrologicalHighlights?.dominantElement)}
            </p>
            <button
              onClick={() => fetchDashboard(true)}
              className="enhanced-glass-card hover:text-white transition-colors text-xs"
              aria-label="Refresh insights"
              disabled={refreshing}
              style={{ color: THEME.textPrimary }}
            >
              {refreshing ? '⟳ Updating' : '🔄 Refresh'}
            </button>
          </div>
        </div>

        {/* AI Insight — two states: analysis exists or encourage generation */}
        <div className="enhanced-glass-card" style={{ borderLeft: '3px solid rgba(167,139,250,0.5)' }}>
          {analysis?.analysisData ? (
            <div className="flex items-center gap-4">
              <ScoreRing
                score={analysis.overallScore}
                size={64}
                strokeWidth={4}
                color="#a78bfa"
                glow="rgba(167,139,250,0.4)"
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="enhanced-glass-heading text-base" style={{ color: THEME.textHeading, margin: 0 }}>Personal Analysis</h3>
                  <span className="text-xs" style={{ color: THEME.textPrimary }}>
                    {Math.round((analysis.confidenceLevel || 0) * 100)}% confidence
                  </span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: THEME.textBody, margin: '0 0 6px', lineHeight: 1.6 }}>
                  {analysis.analysisData.executiveSummary?.substring(0, 120)}{(analysis.analysisData.executiveSummary?.length || 0) > 120 ? '...' : ''}
                </p>
                <button onClick={() => setActive('analysis')} className="text-xs" style={{
                  color: THEME.textPrimary, cursor: 'pointer', background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '3px 10px',
                }}>
                  View full report →
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div style={{
                width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                background: 'radial-gradient(circle, rgba(167,139,250,0.15), rgba(244,114,182,0.08), transparent)',
                border: '2px dashed rgba(167,139,250,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 20 }}>🔮</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 className="enhanced-glass-heading text-base" style={{ color: THEME.textHeading, margin: '0 0 4px' }}>
                  Unlock Your Personal Analysis
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: THEME.textBody, margin: '0 0 8px', lineHeight: 1.6 }}>
                  Generate a comprehensive AI-powered report synthesizing your intake data and journal entries into actionable growth insights.
                </p>
                <button onClick={() => setActive('analysis')} className="text-xs" style={{
                  color: THEME.textPrimary, cursor: 'pointer', background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '4px 12px',
                }}>
                  Generate Report →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Live Insights from DINA (when real insights exist) */}
        {liveInsights && liveInsights.length > 0 && (
          <div className="enhanced-glass-card border-l-4 border-purple-400/50">
            <div className="flex items-center justify-between mb-1">
              <h3 className="enhanced-glass-heading text-sm" style={{ color: THEME.textHeading }}>Latest Insight</h3>
              <span className="text-xs" style={{ color: THEME.textPrimary }}>
                {Math.round((liveInsights[0].confidence || 0) * 100)}% confidence
              </span>
            </div>
            <p className="enhanced-glass-body text-sm leading-relaxed" style={{ color: THEME.textBody }}>
              {liveInsights[0].text}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {chip(liveInsights[0].category)}
              {liveInsights[0].sourceModalities?.map((m) => chip(m))}
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <div className="flex flex-wrap gap-2 my-4" role="tablist" aria-label="Mirror sections">
        {[
          { id: 'overview', label: 'Overview', icon: '✨' },
          { id: 'analysis', label: 'Analysis', icon: '🔮' },
          { id: 'personality', label: 'Personality', icon: '🧠' },
          { id: 'astrology', label: 'Astrology', icon: '♁' },
          { id: 'cognitive', label: 'Cognitive', icon: '📊' },
          { id: 'emotional', label: 'Emotional', icon: '💞' },
          { id: 'voice', label: 'Voice', icon: '🎙️' },
          { id: 'answers', label: 'Answers', icon: '🧾' },
          { id: 'meta', label: 'Metadata', icon: 'ℹ️' },
          { id: 'export', label: 'Export', icon: '📥' },
        ].map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === (t.id as TabId)}
            onClick={() => setActive(t.id as TabId)}
            className={`px-3 py-2 rounded-xl transition-all ${active === (t.id as TabId)
              ? 'bg-white/20 text-white shadow'
              : 'bg-white/10 text-white/80 hover:bg-white/20'} backdrop-blur-sm`}
            style={{
              textShadow: '0px 1px 3px var(--mg-body, #7e4151)',
              ...(t.id === 'analysis' && !analysis ? {
                borderBottom: '2px solid rgba(244,114,182,0.5)',
              } : {}),
            }}
          >
            <span className="mr-1">{t.icon}</span>{t.label}
            {t.id === 'analysis' && analysis && (
              <span style={{ marginLeft: 4, fontSize: 9, background: 'rgba(74,222,128,0.2)', padding: '1px 6px', borderRadius: 8, color: '#4ade80' }}>
                {analysis.overallScore}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >

          {/* OVERVIEW */}
          {active === 'overview' && (
            <>
              {/* Micro Narratives */}
              <div className="enhanced-glass-card">
                <h3 className="enhanced-glass-heading text-lg mb-3" style={{ color: THEME.textHeading }}>Micro Narratives</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {micro.map((n) => (
                    <div key={n.title} className="enhanced-glass-card">
                      <div className="flex items-center justify-between mb-2">
                        <span className="enhanced-glass-heading text-sm font-medium" style={{ color: THEME.textHeading }}>{n.title}</span>
                        <span className="text-lg">✧</span>
                      </div>
                      <p className="enhanced-glass-body text-sm leading-relaxed" style={{ color: THEME.textBody }}>{n.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {quickStats.map((s) => (
                  <div key={s.label} className="enhanced-glass-card text-center">
                    <div className="text-2xl mb-1">{s.icon}</div>
                    <div className="font-bold" style={{ color: THEME.textHeading }}>{s.value}</div>
                    <div className="text-xs" style={{ color: THEME.textPrimary, textShadow: '0px 1px 3px var(--mg-body, #7e4151)' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Development Journey */}
              <div className="enhanced-glass-card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="enhanced-glass-heading text-lg" style={{ color: THEME.textHeading }}>Development Journey</h3>
                  <span className="enhanced-glass-body text-sm" style={{ color: THEME.textBody }}>
                    Velocity {data.growthMetrics.developmentVelocity || 0}/10
                  </span>
                </div>

                {/* Analysis-powered trajectory indicator */}
                {analysis?.analysisData?.temporalTrends?.overallTrajectory && (
                  <div className="mb-4 p-3 rounded-xl" style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderLeft: `3px solid ${
                      analysis.analysisData.temporalTrends.overallTrajectory === 'ascending' ? '#10b981'
                      : analysis.analysisData.temporalTrends.overallTrajectory === 'descending' ? '#ef4444'
                      : '#3b82f6'
                    }`,
                  }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium" style={{ color: THEME.textHeading }}>
                        {analysis.analysisData.temporalTrends.overallTrajectory === 'ascending' ? '↗ Ascending'
                          : analysis.analysisData.temporalTrends.overallTrajectory === 'descending' ? '↘ Descending'
                          : analysis.analysisData.temporalTrends.overallTrajectory === 'cyclical' ? '↺ Cyclical'
                          : '→ Plateau'}
                      </span>
                      <span className="text-xs" style={{ color: THEME.textPrimary }}>
                        based on {analysis.journalEntriesAnalyzed} journal entries
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: THEME.textBody }}>
                      {analysis.analysisData.temporalTrends.trajectoryDescription}
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  {data.growthMetrics.progressIndicators?.slice(0, 4).map((p) => {
                    const isAIInsight = p.area.toLowerCase().includes('ai insight') || p.area.toLowerCase().includes('insight generation');
                    const aiProgress = analysis ? Math.round(analysis.overallScore || 0) : p.progress;
                    const aiTrend: Trend = analysis ? 'up' : p.trend;
                    const displayProgress = isAIInsight ? aiProgress : p.progress;
                    const displayTrend = isAIInsight ? aiTrend : p.trend;

                    return (
                      <div key={p.area}>
                        {/* Row — clickable if AI Insight */}
                        <button
                          type="button"
                          onClick={isAIInsight ? () => setInsightExpanded(!insightExpanded) : undefined}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%',
                            background: 'none', border: 'none', padding: 0, cursor: isAIInsight ? 'pointer' : 'default', textAlign: 'left', marginBottom: 4,
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="enhanced-glass-body text-sm" style={{ color: THEME.textBody }}>{p.area}</span>
                            {isAIInsight && (
                              <span style={{ color: THEME.textPrimary, fontSize: 10, transition: 'transform 0.2s', transform: insightExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs">{displayTrend === 'up' ? '↗' : displayTrend === 'down' ? '↘' : '→'}</span>
                            <span className="enhanced-glass-subtle text-xs" style={{ color: THEME.textPrimary }}>{displayProgress}%</span>
                          </div>
                        </button>

                        {/* Progress bar */}
                        <div className="relative h-1.5 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
                          <div
                            className="absolute top-0 left-0 h-full rounded-full transition-all duration-500 ease-out"
                            style={{
                              width: `${displayProgress}%`,
                              background:
                                displayTrend === 'up'
                                  ? 'linear-gradient(90deg, #10b981, #34d399)'
                                  : displayTrend === 'down'
                                    ? 'linear-gradient(90deg, #ef4444, #f87171)'
                                    : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                              boxShadow: '0 0 8px rgba(59, 130, 246, 0.4)',
                            }}
                          />
                        </div>

                        {/* AI Insight dropdown content */}
                        {isAIInsight && (
                          <AnimatePresence>
                            {insightExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25, ease: 'easeInOut' }}
                                style={{ overflow: 'hidden' }}
                              >
                                <div style={{ padding: '10px 0 4px' }}>
                                  {analysis?.analysisData ? (
                                    <>
                                      {/* Score + Confidence */}
                                      <div className="flex items-center gap-3 mb-2">
                                        <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{
                                          background: 'rgba(244,114,182,0.15)', color: 'var(--mirror-pink, #be185d)',
                                        }}>
                                          Score: {analysis.overallScore}
                                        </span>
                                        <span className="text-xs" style={{ color: THEME.textPrimary }}>
                                          {Math.round((analysis.confidenceLevel || 0) * 100)}% confidence
                                        </span>
                                        <span className="text-xs" style={{ color: THEME.textPrimary }}>
                                          {new Date(analysis.createdAt).toLocaleDateString()}
                                        </span>
                                      </div>

                                      <p className="text-xs leading-relaxed" style={{ color: THEME.textBody, margin: '0 0 8px', lineHeight: 1.7 }}>
                                        {analysis.analysisData.executiveSummary}
                                      </p>

                                      {/* Dimension scores mini-grid */}
                                      {analysis.analysisData.dimensionScores && (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 8 }}>
                                          {Object.entries(analysis.analysisData.dimensionScores).map(([key, value]) => {
                                            const colors = getScoreColor(key, 0);
                                            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
                                            return (
                                              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.05)' }}>
                                                <div style={{ width: 5, height: 5, borderRadius: '50%', background: colors.color, boxShadow: `0 0 4px ${colors.glow}`, flexShrink: 0 }} />
                                                <span style={{ fontSize: 10, color: THEME.textBody, flex: 1 }}>{label}</span>
                                                <span style={{ fontSize: 10, fontWeight: 600, color: THEME.textHeading }}>{typeof value === 'number' ? value : 0}</span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}

                                      <div className="flex flex-wrap gap-2" style={{ marginBottom: 6 }}>
                                        {chip(`${analysis.journalEntriesAnalyzed} entries`)}
                                        {chip(`${analysis.intakeSectionsAvailable} modalities`)}
                                        {analysis.analysisData.journalAnalysis?.moodTrend && chip(`Mood: ${analysis.analysisData.journalAnalysis.moodTrend}`)}
                                      </div>

                                      <button onClick={() => setActive('analysis')} className="text-xs" style={{
                                        color: THEME.textPrimary, cursor: 'pointer', background: 'rgba(255,255,255,0.08)',
                                        border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '4px 10px',
                                      }}>
                                        View full report →
                                      </button>
                                    </>
                                  ) : (
                                    <div style={{ textAlign: 'center', padding: '8px 0' }}>
                                      <p className="text-xs" style={{ color: THEME.textBody, margin: '0 0 8px' }}>
                                        No analysis generated yet. Generate your personal report to populate this section.
                                      </p>
                                      <button onClick={() => setActive('analysis')} className="text-xs" style={{
                                        color: THEME.textPrimary, cursor: 'pointer', background: 'rgba(255,255,255,0.08)',
                                        border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '4px 10px',
                                      }}>
                                        Go to Analysis →
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        )}
                      </div>
                    );
                  })}
                </div>
                {!!growthMetrics.areasOfFocus?.length && (
                  <div className="mt-4">
                    <div className="text-xs mb-2 font-medium" style={{ color: THEME.textPrimary, textShadow: '0 1px 2px rgba(0,0,0,0.1)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>Focus Areas</div>
                    <div className="flex flex-wrap gap-2.5">
                      {growthMetrics.areasOfFocus.map((a) => chip(a))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* PERSONAL ANALYSIS — TruthStream-style report for the individual */}
          {active === 'analysis' && (
            <>
              {/* Loading state */}
              {analysisLoading && !isPolling && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="enhanced-glass-card text-center py-12">
                  <OrbitalLoader elapsed={0} maxDuration={MAX_POLL_DURATION} message="Loading analysis..." />
                </motion.div>
              )}

              {/* Polling / generating state */}
              {isPolling && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="enhanced-glass-card">
                  <OrbitalLoader elapsed={pollElapsed} maxDuration={MAX_POLL_DURATION} />
                </motion.div>
              )}

              {/* No analysis yet */}
              {!analysisLoading && !isPolling && !analysis && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="enhanced-glass-card text-center py-12">
                  <h3 className="text-lg mb-2 font-bold" style={{ color: THEME.textPrimary, textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                    {pollTimedOut ? 'Analysis Taking Longer Than Expected' : 'Personal Mirror Report'}
                  </h3>
                  {pollTimedOut && (
                    <p className="text-sm mb-2" style={{ color: 'var(--mirror-amber, #b45309)', textShadow: '0 1px 3px rgba(0,0,0,0.15)' }}>
                      Generation is still processing in the background. Check back shortly.
                    </p>
                  )}
                  <p className="text-sm mb-4" style={{ color: THEME.textBody, textShadow: '0 1px 4px rgba(0,0,0,0.15)' }}>
                    Generate your comprehensive personal analysis. Dina will synthesize your intake assessment, journal entries,
                    and temporal patterns into an actionable growth report.
                  </p>
                  <button onClick={handleRequestAnalysis} className="enhanced-action-button px-8 py-3" style={{ opacity: isPolling ? 0.6 : 1 }}>
                    <span className="font-medium" style={{ color: THEME.textPrimary, textShadow: '0 1px 3px rgba(126,65,81,0.3)' }}>Generate Report</span>
                  </button>
                </motion.div>
              )}

              {/* Analysis text visibility overrides */}
              <style>{`
                .mirror-analysis-report .enhanced-glass-heading {
                  color: var(--dash-heading, #3d1428) !important;
                  text-shadow: 0 2px 8px rgba(0,0,0,0.3), 0 1px 2px rgba(255,255,255,0.1) !important;
                }
                .mirror-analysis-report .enhanced-glass-body {
                  color: var(--mg-body, #4a1a2e) !important;
                  text-shadow: 0 1px 4px rgba(0,0,0,0.2) !important;
                }
                .mirror-analysis-report .enhanced-glass-text {
                  color: var(--dash-heading, #3d1428) !important;
                  text-shadow: 0 1px 3px rgba(126,65,81,0.3) !important;
                }
                .mirror-analysis-report .enhanced-glass-subtle {
                  color: var(--mg-label, #5a2d3e) !important;
                  text-shadow: 0 1px 3px rgba(126,65,81,0.25) !important;
                }
                .mirror-analysis-report h2, .mirror-analysis-report h3 {
                  color: var(--dash-heading, #3d1428) !important;
                  text-shadow: 0 2px 8px rgba(0,0,0,0.3), 0 1px 2px rgba(255,255,255,0.1) !important;
                }
                .mirror-analysis-report p {
                  color: var(--mg-body, #4a1a2e) !important;
                  text-shadow: 0 1px 4px rgba(0,0,0,0.15) !important;
                }
                .mirror-analysis-report ul li {
                  color: var(--mg-body, #4a1a2e) !important;
                  text-shadow: 0 1px 3px rgba(0,0,0,0.15) !important;
                }
              `}</style>

              {/* Full analysis report (not regenerating) */}
              {analysis && !isRegenerating && (() => {
                const report = analysis.analysisData;
                const dims = report?.dimensionScores;
                const journal = report?.journalAnalysis;
                const temporal = report?.temporalTrends;
                const recs = report?.growthRecommendations || [];
                const crossModal = report?.crossModalCorrelations || [];
                const personality = report?.personalityInsights;
                const practices = report?.dailyPractices || [];
                const confidencePct = Math.round((analysis.confidenceLevel ?? 0) * 100);

                return (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="space-y-5 mirror-analysis-report">

                    {/* Header with overall score ring */}
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="enhanced-glass-card" style={{ padding: 20 }}>
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="enhanced-glass-heading" style={{ fontSize: 18 }}>Personal Mirror Report</h2>
                        <GlassBadge label={`${analysis.journalEntriesAnalyzed} entries`} color="#f472b6" />
                      </div>
                      <div className="flex items-center gap-4 mb-4">
                        <ScoreRing score={analysis.overallScore} size={80} strokeWidth={5} color="#f472b6" glow="rgba(244,114,182,0.4)" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p className="enhanced-glass-subtle" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>
                            Overall Score
                          </p>
                          <p className="enhanced-glass-body" style={{ fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                            {report?.executiveSummary || 'Analysis complete.'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="enhanced-glass-subtle">Generated {new Date(analysis.createdAt).toLocaleDateString()}</span>
                        <span className="enhanced-glass-subtle">Confidence: {confidencePct}%</span>
                        <span className="enhanced-glass-subtle">{analysis.intakeSectionsAvailable} intake sections</span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button onClick={handleRequestAnalysis} disabled={isPolling} className="enhanced-action-button text-xs px-3 py-1" style={{ padding: '6px 12px', borderRadius: 10 }}>
                          <span className="enhanced-glass-subtle" style={{ fontSize: 11 }}>Regenerate</span>
                        </button>
                      </div>
                    </motion.div>

                    {/* Dimension Scores — Score rings grid */}
                    {dims && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="enhanced-glass-card" style={{ padding: 16 }}>
                        <h3 className="enhanced-glass-heading" style={{ fontSize: 14, marginBottom: 16 }}>Dimension Scores</h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 16 }}>
                          {Object.entries(dims).map(([key, value], i) => {
                            const colors = getScoreColor(key, i);
                            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
                            return (
                              <ScoreRing
                                key={key}
                                score={typeof value === 'number' ? value : 0}
                                size={68}
                                strokeWidth={4}
                                color={colors.color}
                                glow={colors.glow}
                                label={label}
                              />
                            );
                          })}
                        </div>
                      </motion.div>
                    )}

                    {/* Personality Insights */}
                    {personality && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="enhanced-glass-card">
                        <h3 className="enhanced-glass-heading" style={{ fontSize: 14, marginBottom: 8 }}>Personality Insights</h3>
                        <p className="enhanced-glass-body" style={{ fontSize: 12, lineHeight: 1.6, margin: '0 0 12px' }}>
                          {personality.overview}
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {personality.strengths?.length > 0 && (
                            <div style={{ padding: 10, borderRadius: 12, borderLeft: '3px solid #4ade80', background: 'rgba(74,222,128,0.04)' }}>
                              <span className="enhanced-glass-text" style={{ fontSize: 11, fontWeight: 600, color: '#4ade80' }}>Strengths</span>
                              <ul style={{ margin: '6px 0 0', paddingLeft: 14 }}>
                                {personality.strengths.map((s: string, i: number) => (
                                  <li key={i} className="enhanced-glass-body" style={{ fontSize: 11, marginBottom: 2 }}>{s}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {personality.growthEdges?.length > 0 && (
                            <div style={{ padding: 10, borderRadius: 12, borderLeft: '3px solid #fb923c', background: 'rgba(251,146,60,0.04)' }}>
                              <span className="enhanced-glass-text" style={{ fontSize: 11, fontWeight: 600, color: '#fb923c' }}>Growth Edges</span>
                              <ul style={{ margin: '6px 0 0', paddingLeft: 14 }}>
                                {personality.growthEdges.map((s: string, i: number) => (
                                  <li key={i} className="enhanced-glass-body" style={{ fontSize: 11, marginBottom: 2 }}>{s}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {personality.blindSpots?.length > 0 && (
                            <div style={{ padding: 10, borderRadius: 12, borderLeft: '3px solid #facc15', background: 'rgba(250,204,21,0.04)' }}>
                              <span className="enhanced-glass-text" style={{ fontSize: 11, fontWeight: 600, color: '#facc15' }}>Blind Spots</span>
                              <ul style={{ margin: '6px 0 0', paddingLeft: 14 }}>
                                {personality.blindSpots.map((s: string, i: number) => (
                                  <li key={i} className="enhanced-glass-body" style={{ fontSize: 11, marginBottom: 2 }}>{s}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {/* Journal Analysis */}
                    {journal && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="enhanced-glass-card" style={{ padding: 16 }}>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="enhanced-glass-heading" style={{ fontSize: 14 }}>Journal Analysis</h3>
                          {(() => {
                            const tc = trendColor(journal.moodTrend);
                            return (
                              <span className="px-2 py-0.5 rounded-full capitalize" style={{ fontSize: 10, background: `${tc.color}20`, color: tc.color, boxShadow: `0 0 4px ${tc.glow}` }}>
                                {journal.moodTrend}
                              </span>
                            );
                          })()}
                        </div>
                        <p className="enhanced-glass-body" style={{ fontSize: 12, lineHeight: 1.5, margin: '0 0 12px' }}>
                          {journal.moodTrendDescription}
                        </p>

                        {/* Emotional Patterns */}
                        {journal.emotionalPatterns && journal.emotionalPatterns.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <p className="enhanced-glass-subtle" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>Emotional Patterns</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {journal.emotionalPatterns.map((ep: any, i: number) => {
                                const sig = ep.significance === 'high' ? { color: '#f472b6', glow: 'rgba(244,114,182,0.3)' }
                                  : ep.significance === 'medium' ? { color: '#a78bfa', glow: 'rgba(167,139,250,0.3)' }
                                  : { color: '#94a3b8', glow: 'rgba(148,163,184,0.3)' };
                                return (
                                  <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.04 }}
                                    style={{ padding: '8px 12px', borderRadius: 10, borderLeft: `3px solid ${sig.color}`, background: 'rgba(255,255,255,0.03)' }}>
                                    <div className="flex items-center gap-2">
                                      <span className="enhanced-glass-text" style={{ fontSize: 12, fontWeight: 600 }}>{ep.pattern}</span>
                                      <span className="px-2 py-0.5 rounded-full capitalize" style={{ fontSize: 9, background: `${sig.color}20`, color: sig.color }}>{ep.significance}</span>
                                    </div>
                                    <span className="enhanced-glass-subtle" style={{ fontSize: 10 }}>{ep.frequency}</span>
                                  </motion.div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Energy & Reflection */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3" style={{ marginBottom: 12 }}>
                          {journal.energyPatterns && (
                            <div className="enhanced-glass-card" style={{ padding: '10px 14px' }}>
                              <span className="enhanced-glass-subtle" style={{ fontSize: 10 }}>Energy Peak</span>
                              <div className="enhanced-glass-heading" style={{ fontSize: 14, color: THEME.textHeading }}>{journal.energyPatterns.peakTimeOfDay || '—'}</div>
                              <span className="enhanced-glass-subtle" style={{ fontSize: 10 }}>Avg: {journal.energyPatterns.averageEnergy?.toFixed(1) || '—'}/10</span>
                            </div>
                          )}
                          <div className="enhanced-glass-card" style={{ padding: '10px 14px' }}>
                            <span className="enhanced-glass-subtle" style={{ fontSize: 10 }}>Reflection Depth</span>
                            <div className="enhanced-glass-heading capitalize" style={{ fontSize: 14, color: THEME.textHeading }}>{journal.writingDepthTrend || '—'}</div>
                            <span className="enhanced-glass-subtle" style={{ fontSize: 10 }}>Quality: {journal.reflectionQuality || 0}/100</span>
                          </div>
                          {journal.thematicThreads && journal.thematicThreads.length > 0 && (
                            <div className="enhanced-glass-card" style={{ padding: '10px 14px' }}>
                              <span className="enhanced-glass-subtle" style={{ fontSize: 10 }}>Top Theme</span>
                              <div className="enhanced-glass-heading" style={{ fontSize: 14, color: THEME.textHeading }}>{journal.thematicThreads[0]?.theme || '—'}</div>
                              <span className="enhanced-glass-subtle" style={{ fontSize: 10 }}>{journal.thematicThreads[0]?.occurrences || 0} occurrences</span>
                            </div>
                          )}
                        </div>

                        {/* Thematic Threads */}
                        {journal.thematicThreads && journal.thematicThreads.length > 1 && (
                          <div>
                            <p className="enhanced-glass-subtle" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>Thematic Threads</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {journal.thematicThreads.map((thread: any, i: number) => {
                                const sentColor = thread.sentiment === 'positive' ? '#4ade80' : thread.sentiment === 'negative' ? '#f87171' : '#94a3b8';
                                return (
                                  <AnimatedBar
                                    key={thread.theme}
                                    label={thread.theme}
                                    value={thread.occurrences}
                                    maxValue={Math.max(...journal.thematicThreads.map((t: any) => t.occurrences || 0), 1)}
                                    color={sentColor}
                                    glow={`${sentColor}55`}
                                    index={i}
                                    suffix=""
                                  />
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* Temporal Trends */}
                    {temporal && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="enhanced-glass-card">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="enhanced-glass-heading" style={{ fontSize: 14 }}>Temporal Trends</h3>
                          {(() => {
                            const tc = trendColor(temporal.overallTrajectory);
                            return (
                              <span className="px-2 py-0.5 rounded-full capitalize" style={{ fontSize: 10, background: `${tc.color}20`, color: tc.color, boxShadow: `0 0 4px ${tc.glow}` }}>
                                {temporal.overallTrajectory}
                              </span>
                            );
                          })()}
                        </div>
                        <p className="enhanced-glass-body" style={{ fontSize: 12, lineHeight: 1.5, margin: '0 0 12px' }}>
                          {temporal.trajectoryDescription}
                        </p>

                        {/* Milestones */}
                        {temporal.milestones && temporal.milestones.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <p className="enhanced-glass-subtle" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>Milestones</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {temporal.milestones.map((m: any, i: number) => {
                                const typeColor = m.type === 'breakthrough' ? '#4ade80' : m.type === 'challenge' ? '#f87171' : m.type === 'insight' ? '#60a5fa' : '#a78bfa';
                                return (
                                  <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.04 }}
                                    style={{ padding: '8px 12px', borderRadius: 10, borderLeft: `3px solid ${typeColor}`, background: `${typeColor}08` }}>
                                    <div className="flex items-center justify-between">
                                      <span className="enhanced-glass-text" style={{ fontSize: 12, fontWeight: 600 }}>{m.description}</span>
                                      <span className="enhanced-glass-subtle" style={{ fontSize: 10 }}>{m.date}</span>
                                    </div>
                                    <span className="px-2 py-0.5 rounded-full capitalize" style={{ fontSize: 9, background: `${typeColor}20`, color: typeColor }}>{m.type}</span>
                                  </motion.div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Compared to Previous */}
                        {temporal.comparedToPrevious && (
                          <div className="enhanced-glass-card" style={{ padding: 12, borderLeft: '3px solid #a78bfa', background: 'rgba(167,139,250,0.04)' }}>
                            <p className="enhanced-glass-text" style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Compared to Previous</p>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="enhanced-glass-subtle" style={{ fontSize: 11 }}>Score Change:</span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: temporal.comparedToPrevious.scoreChange >= 0 ? '#4ade80' : '#f87171', fontFamily: 'monospace' }}>
                                {temporal.comparedToPrevious.scoreChange >= 0 ? '+' : ''}{temporal.comparedToPrevious.scoreChange}
                              </span>
                            </div>
                            {temporal.comparedToPrevious.improvingAreas?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-1">
                                <span className="enhanced-glass-subtle" style={{ fontSize: 10 }}>Improving:</span>
                                {temporal.comparedToPrevious.improvingAreas.map((a: string) => (
                                  <span key={a} className="px-2 py-0.5 rounded-full" style={{ fontSize: 9, background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}>{a}</span>
                                ))}
                              </div>
                            )}
                            {temporal.comparedToPrevious.decliningAreas?.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                <span className="enhanced-glass-subtle" style={{ fontSize: 10 }}>Needs attention:</span>
                                {temporal.comparedToPrevious.decliningAreas.map((a: string) => (
                                  <span key={a} className="px-2 py-0.5 rounded-full" style={{ fontSize: 9, background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>{a}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* Cross-Modal Insights */}
                    {crossModal.length > 0 && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="enhanced-glass-card">
                        <h3 className="enhanced-glass-heading" style={{ fontSize: 14, marginBottom: 12 }}>Cross-Modal Insights</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {crossModal.map((cm: any, i: number) => {
                            const confColor = cm.confidence >= 0.7 ? '#4ade80' : cm.confidence >= 0.4 ? '#facc15' : '#94a3b8';
                            return (
                              <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 + i * 0.04 }}
                                style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <p className="enhanced-glass-body" style={{ fontSize: 12, margin: '0 0 6px' }}>{cm.correlation || cm.insight}</p>
                                <div className="flex items-center gap-2">
                                  {(cm.modalities || cm.sources || []).map((m: string) => (
                                    <span key={m} className="px-2 py-0.5 rounded-full" style={{ fontSize: 9, background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>{m}</span>
                                  ))}
                                  <span className="enhanced-glass-subtle" style={{ fontSize: 10, marginLeft: 'auto', color: confColor }}>
                                    {Math.round((cm.confidence || 0) * 100)}% conf
                                  </span>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}

                    {/* Growth Recommendations */}
                    {recs.length > 0 && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="enhanced-glass-card">
                        <h3 className="enhanced-glass-heading" style={{ fontSize: 14, marginBottom: 12 }}>Growth Recommendations</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {recs.map((rec: any, i: number) => {
                            const pri = priorityColor(rec.priority);
                            return (
                              <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.05 }}
                                style={{ padding: 12, borderRadius: 12, borderLeft: `3px solid #4ade80`, background: 'rgba(74,222,128,0.03)', border: '1px solid rgba(74,222,128,0.1)', borderLeftWidth: 3, borderLeftColor: '#4ade80' }}>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="enhanced-glass-text" style={{ fontSize: 13, fontWeight: 600 }}>{rec.area}</span>
                                  <span className="px-2 py-0.5 rounded-full capitalize" style={{ fontSize: 10, background: `${pri.color}20`, color: pri.color }}>{rec.priority}</span>
                                </div>
                                <p className="enhanced-glass-body" style={{ fontSize: 12, margin: '0 0 6px' }}>{rec.recommendation}</p>
                                {rec.actionSteps && rec.actionSteps.length > 0 && (
                                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                                    {rec.actionSteps.map((step: string, si: number) => (
                                      <li key={si} className="enhanced-glass-subtle" style={{ fontSize: 11, marginBottom: 2 }}>{step}</li>
                                    ))}
                                  </ul>
                                )}
                                {rec.relatedModalities && rec.relatedModalities.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {rec.relatedModalities.map((m: string) => (
                                      <span key={m} className="px-2 py-0.5 rounded-full" style={{ fontSize: 9, background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>{m}</span>
                                    ))}
                                  </div>
                                )}
                              </motion.div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}

                    {/* Daily Practices */}
                    {practices.length > 0 && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="enhanced-glass-card">
                        <h3 className="enhanced-glass-heading" style={{ fontSize: 14, marginBottom: 12 }}>Daily Practices</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {practices.map((p: any, i: number) => (
                            <motion.div key={i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.45 + i * 0.05 }}
                              className="enhanced-glass-card" style={{ padding: '10px 14px' }}>
                              <div className="enhanced-glass-text" style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{p.practice}</div>
                              <div className="enhanced-glass-subtle" style={{ fontSize: 10 }}>{p.targetArea} &middot; {p.frequency}</div>
                              <div className="enhanced-glass-body" style={{ fontSize: 11, marginTop: 4 }}>{p.expectedImpact}</div>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })()}
            </>
          )}

          {/* PERSONALITY */}
          {active === 'personality' && (
            <div className="enhanced-glass-card">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* MBTI */}
                <div className="enhanced-glass-card">
                  <h3 className="enhanced-glass-heading text-lg mb-2" style={{ color: THEME.textHeading }}>MBTI</h3>
                  <div className="text-4xl font-bold mb-2" style={{ color: THEME.textHeading }}>
                    {data.completePersonalityData.mbti?.type || '—'}
                  </div>
                  <p className="enhanced-glass-body" style={{ color: THEME.textBody }}>
                    {data.completePersonalityData.mbti?.description || 'No description available.'}
                  </p>
                  {!!data.completePersonalityData.dominantTraits?.length && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {data.completePersonalityData.dominantTraits.map((t) => chip(t))}
                    </div>
                  )}
                </div>

                {/* Big Five */}
                <div className="enhanced-glass-card">
                  <h3 className="enhanced-glass-heading text-lg mb-2" style={{ color: THEME.textHeading }}>Big Five Profile</h3>
                  <div className="space-y-3">
                    {Object.entries(data.completePersonalityData.big5Profile || {}).map(([trait, score]) => (
                      <div key={trait}>
                        <div className="flex justify-between text-sm">
                          <span className="capitalize" style={{ color: THEME.textPrimary }}>{trait}</span>
                          <span className="font-medium" style={{ color: THEME.textHeading }}>{Math.round(score as number)}%</span>
                        </div>
                        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{
                            width: `${score}%`,
                            background: 'linear-gradient(90deg, rgba(125,79,94,0.5), rgba(218,112,162,0.6))',
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-xs" style={{ color: THEME.textPrimary }}>
                    Quality: {data.completePersonalityData.assessmentQuality || '—'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ASTROLOGY */}
          {active === 'astrology' && (
            <div className="enhanced-glass-card">
              {/* Western */}
              <div className="enhanced-glass-card mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="enhanced-glass-heading text-lg" style={{ color: THEME.textHeading }}>Western Astrology</h3>
                  <div className="text-2xl">{getElementSymbol(data.completeAstrologicalData.western?.dominantElement)}</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { k: 'Sun', v: data.completeAstrologicalData.western?.sunSign, d: 'Core identity' },
                    { k: 'Moon', v: data.completeAstrologicalData.western?.moonSign, d: 'Emotional pattern' },
                    { k: 'Rising', v: data.completeAstrologicalData.western?.risingSign, d: 'Outer persona' },
                  ].map((x) => (
                    <div key={x.k} className="enhanced-glass-card text-center">
                      <div className="text-sm" style={{ color: THEME.textPrimary }}>{x.k}</div>
                      <div className="text-xl font-bold" style={{ color: THEME.textHeading }}>{x.v || '—'}</div>
                      <div className="text-xs" style={{ color: THEME.textPrimary }}>{x.d}</div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-4">
                  <div className="enhanced-glass-card">
                    <h4 className="enhanced-glass-heading text-sm mb-2" style={{ color: THEME.textHeading }}>Houses</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {Object.entries(data.completeAstrologicalData.western?.houses || {}).map(([house, sign]) => (
                        <div key={house} className="flex justify-between bg-white/10 rounded px-2 py-1">
                          <span style={{ color: THEME.textPrimary }}>{house}</span>
                          <span className="font-medium" style={{ color: THEME.textHeading }}>{sign}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="enhanced-glass-card">
                    <h4 className="enhanced-glass-heading text-sm mb-2" style={{ color: THEME.textHeading }}>Planets</h4>
                    <div className="space-y-1 text-sm">
                      {Object.entries(data.completeAstrologicalData.western?.planetaryPlacements || {}).map(([planet, sign]) => (
                        <div key={planet} className="flex justify-between bg-white/10 rounded px-2 py-1">
                          <span style={{ color: THEME.textPrimary }}>{planet}</span>
                          <span className="font-medium" style={{ color: THEME.textHeading }}>{sign}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-white/10 rounded px-2 py-1" style={{ color: THEME.textPrimary }}>Modality: <span className="font-medium" style={{ color: THEME.textHeading }}>{data.completeAstrologicalData.western?.modality || '—'}</span></div>
                      <div className="bg-white/10 rounded px-2 py-1" style={{ color: THEME.textPrimary }}>Element: <span className="font-medium" style={{ color: THEME.textHeading }}>{data.completeAstrologicalData.western?.dominantElement || '—'}</span></div>
                      <div className="bg-white/10 rounded px-2 py-1" style={{ color: THEME.textPrimary }}>Chart Ruler: <span className="font-medium" style={{ color: THEME.textHeading }}>{data.completeAstrologicalData.western?.chartRuler || '—'}</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chinese */}
              <div className="enhanced-glass-card mb-4">
                <h3 className="enhanced-glass-heading text-lg mb-2" style={{ color: THEME.textHeading }}>Chinese Astrology</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { k: 'Animal', v: data.completeAstrologicalData.chinese?.animalSign },
                    { k: 'Element', v: data.completeAstrologicalData.chinese?.element },
                    { k: 'Polarity', v: data.completeAstrologicalData.chinese?.yinYang },
                    { k: 'Inner Animal', v: data.completeAstrologicalData.chinese?.innerAnimal || '—' },
                  ].map((x) => (
                    <div key={x.k} className="enhanced-glass-card text-center">
                      <div className="text-xs" style={{ color: THEME.textPrimary }}>{x.k}</div>
                      <div className="text-lg font-bold" style={{ color: THEME.textHeading }}>{x.v || '—'}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-xs" style={{ color: THEME.textPrimary }}>Lucky Numbers:</span>
                  {data.completeAstrologicalData.chinese?.luckyNumbers?.map((n) => chip(String(n)))}
                </div>
                {!!data.completeAstrologicalData.chinese?.luckyColors?.length && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="text-xs" style={{ color: THEME.textPrimary }}>Lucky Colors:</span>
                    {data.completeAstrologicalData.chinese?.luckyColors?.map((c) => chip(c))}
                  </div>
                )}
                {!!data.completeAstrologicalData.chinese?.personality?.length && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {data.completeAstrologicalData.chinese.personality.map((t) => chip(t))}
                  </div>
                )}
              </div>

              {/* African */}
              <div className="enhanced-glass-card mb-4">
                <h3 className="enhanced-glass-heading text-lg mb-2" style={{ color: THEME.textHeading }}>African Traditions</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { k: 'Orisha Guardian', v: data.completeAstrologicalData.african?.orishaGuardian },
                    { k: 'Elemental Force', v: data.completeAstrologicalData.african?.elementalForce },
                    { k: 'Sacred Animal', v: data.completeAstrologicalData.african?.sacredAnimal },
                    { k: 'Life Destiny', v: data.completeAstrologicalData.african?.lifeDestiny },
                  ].map((x) => (
                    <div key={x.k} className="enhanced-glass-card text-center">
                      <div className="text-xs" style={{ color: THEME.textPrimary }}>{x.k}</div>
                      <div className="text-lg font-bold" style={{ color: THEME.textHeading }}>{x.v || '—'}</div>
                    </div>
                  ))}
                </div>
                {!!data.completeAstrologicalData.african?.spiritualGifts?.length && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {data.completeAstrologicalData.african.spiritualGifts.map((g) => chip(g))}
                  </div>
                )}
                {!!data.completeAstrologicalData.african?.challenges?.length && (
                  <div className="mt-2">
                    <div className="text-xs mb-1" style={{ color: THEME.textPrimary }}>Growth Challenges</div>
                    <div className="flex flex-wrap gap-2">
                      {data.completeAstrologicalData.african.challenges.map((c) => chip(c))}
                    </div>
                  </div>
                )}
              </div>

              {/* Numerology & Synthesis */}
              <div className="enhanced-glass-card">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { k: 'Life Path', v: data.completeAstrologicalData.numerology?.lifePathNumber },
                    { k: 'Destiny', v: data.completeAstrologicalData.numerology?.destinyNumber },
                    { k: 'Soul Urge', v: data.completeAstrologicalData.numerology?.soulUrgeNumber },
                    { k: 'Personality', v: data.completeAstrologicalData.numerology?.personalityNumber },
                    { k: 'Birth Day', v: data.completeAstrologicalData.numerology?.birthDayNumber },
                  ].map((x) => (
                    <div key={x.k} className="enhanced-glass-card text-center">
                      <div className="text-xs" style={{ color: THEME.textPrimary }}>{x.k}</div>
                      <div className="text-2xl font-bold" style={{ color: THEME.textHeading }}>{x.v ?? '—'}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { t: 'Life Direction', v: data.completeAstrologicalData.synthesis?.lifeDirection },
                    { t: 'Spiritual Path', v: data.completeAstrologicalData.synthesis?.spiritualPath },
                    { t: 'Relationships', v: data.completeAstrologicalData.synthesis?.relationships },
                    { t: 'Career', v: data.completeAstrologicalData.synthesis?.career },
                    { t: 'Wellness', v: data.completeAstrologicalData.synthesis?.wellness },
                  ].map((x) => (
                    <div key={x.t} className="enhanced-glass-card">
                      <div className="enhanced-glass-heading text-sm mb-1" style={{ color: THEME.textHeading }}>{x.t}</div>
                      <p className="enhanced-glass-body text-sm" style={{ color: THEME.textBody }}>{x.v || '—'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* COGNITIVE */}
          {active === 'cognitive' && (
            <div className="enhanced-glass-card">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                {[
                  { k: 'IQ Score', v: data.completeCognitiveData.iqScore },
                  { k: 'Percentile', v: `${data.completeCognitiveData.percentile || 0}th` },
                  { k: 'Category', v: data.completeCognitiveData.category },
                  { k: 'Strength', v: data.completeCognitiveData.strengths?.[0] || '—' },
                ].map((x) => (
                  <div key={x.k} className="enhanced-glass-card text-center">
                    <div className="text-xs" style={{ color: THEME.textPrimary }}>{x.k}</div>
                    <div className="text-xl font-bold" style={{ color: THEME.textHeading }}>{x.v ?? '—'}</div>
                  </div>
                ))}
              </div>
              <p className="enhanced-glass-body" style={{ color: THEME.textBody }}>{data.completeCognitiveData.description}</p>
              <div className="mt-3 text-xs" style={{ color: THEME.textPrimary }}>
                Raw: {data.completeCognitiveData.rawScore}/{data.completeCognitiveData.totalQuestions}
              </div>
            </div>
          )}

          {/* EMOTIONAL */}
          {active === 'emotional' && (
            <div className="enhanced-glass-card">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="enhanced-glass-card">
                  <h3 className="enhanced-glass-heading text-lg mb-2" style={{ color: THEME.textHeading }}>Emotional Profile</h3>
                  <div className="mb-3">
                    <div className="flex justify-between text-sm">
                      <span style={{ color: THEME.textPrimary }}>Stability</span>
                      <span style={{ color: THEME.textHeading }}>{pct(data.personalitySnapshot.emotionalProfile?.emotionalStability)}</span>
                    </div>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{
                        width: `${data.personalitySnapshot.emotionalProfile?.emotionalStability || 0}%`,
                        background: '#10b981',
                        boxShadow: '0 0 10px rgba(16,185,129,0.4)',
                      }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm">
                      <span style={{ color: THEME.textPrimary }}>Expressiveness</span>
                      <span style={{ color: THEME.textHeading }}>{pct(data.personalitySnapshot.emotionalProfile?.expressiveness)}</span>
                    </div>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{
                        width: `${data.personalitySnapshot.emotionalProfile?.expressiveness || 0}%`,
                        background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                        boxShadow: '0 0 10px rgba(59,130,246,0.4)',
                      }} />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {data.personalitySnapshot.emotionalProfile?.primaryEmotions?.map((e) => chip(e))}
                  </div>
                </div>

                <div className="enhanced-glass-card">
                  <h3 className="enhanced-glass-heading text-lg mb-2" style={{ color: THEME.textHeading }}>Detected Emotions</h3>
                  <div className="space-y-2">
                    {(data.completeEmotionalData.emotionalSpectrum || []).map((p) => (
                      <div key={p.emotion}>
                        <div className="flex justify-between text-sm">
                          <span style={{ color: THEME.textPrimary }}>{p.emotion}</span>
                          <span style={{ color: THEME.textHeading }}>{Math.round(p.intensity * 100)}%</span>
                        </div>
                        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{
                            width: `${Math.round(p.intensity * 100)}%`,
                            background: 'linear-gradient(90deg, rgba(255,105,180,0.6), rgba(218,112,214,0.6))',
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs mt-3">
                    <div className="bg-white/10 rounded px-2 py-1" style={{ color: THEME.textPrimary }}>Dominant: <span className="font-medium" style={{ color: THEME.textHeading }}>{data.completeEmotionalData.dominantEmotion?.emotion || '—'}</span></div>
                    <div className="bg-white/10 rounded px-2 py-1" style={{ color: THEME.textPrimary }}>Conf: <span className="font-medium" style={{ color: THEME.textHeading }}>{Math.round((data.completeEmotionalData.dominantEmotion?.confidence || 0) * 100)}%</span></div>
                    <div className="bg-white/10 rounded px-2 py-1" style={{ color: THEME.textPrimary }}>Angles: <span className="font-medium" style={{ color: THEME.textHeading }}>r{data.completeEmotionalData.facialAngles?.roll} p{data.completeEmotionalData.facialAngles?.pitch} y{data.completeEmotionalData.facialAngles?.yaw}</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VOICE */}
          {active === 'voice' && (
            <div className="enhanced-glass-card">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
                {[
                  { k: 'Quality', v: data.completeVoiceData.quality },
                  { k: 'Duration', v: `${(data.completeVoiceData.voiceFileRef?.duration || data.completeVoiceData.duration || 0).toFixed(1)}s` },
                  { k: 'Size', v: `${Math.round((data.completeVoiceData.voiceFileRef?.size || data.completeVoiceData.size || 0) / 1024)} KB` },
                  { k: 'MIME', v: data.completeVoiceData.mimeType || data.completeVoiceData.voiceFileRef?.mimetype },
                  { k: 'Device', v: `${data.completeVoiceData.deviceInfo.platform}/${data.completeVoiceData.deviceInfo.browser}` },
                ].map((x) => (
                  <div key={x.k} className="enhanced-glass-card text-center">
                    <div className="text-xs" style={{ color: THEME.textPrimary }}>{x.k}</div>
                    <div className="text-sm font-semibold" style={{ color: THEME.textHeading }}>{x.v || '—'}</div>
                  </div>
                ))}
              </div>
              <div className="text-xs" style={{ color: THEME.textPrimary }}>
                Uploaded: <span className="font-medium" style={{ color: THEME.textHeading }}>
                  {data.completeVoiceData.voiceFileRef?.uploadedAt ? new Date(data.completeVoiceData.voiceFileRef.uploadedAt).toLocaleString() : '—'}
                </span>
              </div>
            </div>
          )}

          {/* ANSWERS */}
          {active === 'answers' && (
            <div className="enhanced-glass-card">
              <h3 className="enhanced-glass-heading text-lg mb-3" style={{ color: THEME.textHeading }}>Assessment Answers</h3>
              {data.completePersonalityData.personalityAnswers ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {Object.entries(data.completePersonalityData.personalityAnswers).map(([k, v]) => (
                    <div key={k} className="enhanced-glass-card">
                      <div className="text-xs mb-1" style={{ color: THEME.textPrimary }}>{k}</div>
                      {'text' in (v as any) && (
                        <div className="text-sm" style={{ color: THEME.textBody }}>
                          {(v as any).text} <span className="opacity-70">(score {(v as any).score})</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="enhanced-glass-card" style={{ color: THEME.textPrimary }}>No answer data available.</div>
              )}
            </div>
          )}

          {/* METADATA */}
          {active === 'meta' && (
            <div className="enhanced-glass-card">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="enhanced-glass-card text-center">
                  <div className="text-xs" style={{ color: THEME.textPrimary }}>Completed</div>
                  <div className="text-lg font-bold" style={{ color: THEME.textHeading }}>
                    {data.assessmentMetadata.completionDate
                      ? new Date(data.assessmentMetadata.completionDate).toLocaleDateString()
                      : (data.completeVoiceData?.voiceFileRef?.uploadedAt
                        ? new Date(data.completeVoiceData.voiceFileRef.uploadedAt).toLocaleDateString()
                        : '—')}
                  </div>
                </div>
                <div className="enhanced-glass-card text-center">
                  <div className="text-xs" style={{ color: THEME.textPrimary }}>Sections</div>
                  <div className="text-lg font-bold" style={{ color: THEME.textHeading }}>
                    {data.assessmentMetadata.totalSections} ({data.assessmentMetadata.completionPercentage}%)
                  </div>
                </div>
                <div className="enhanced-glass-card text-center">
                  <div className="text-xs" style={{ color: THEME.textPrimary }}>Integrity</div>
                  <div className="text-lg font-bold" style={{ color: THEME.textHeading }}>{data.assessmentMetadata.dataIntegrity}</div>
                </div>
                <div className="enhanced-glass-card text-center">
                  <div className="text-xs" style={{ color: THEME.textPrimary }}>Consistency</div>
                  <div className="text-lg font-bold" style={{ color: THEME.textHeading }}>{data.growthMetrics.consistencyScore}%</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(data.assessmentMetadata.sectionsCompleted).map(([k, v]) => chip(`${k}: ${v ? '✓' : '—'}`))}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Export tab (lazy loaded) */}
      {active === 'export' && (
        <Suspense fallback={
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div className="animate-spin" style={{ display: 'inline-block', width: '24px', height: '24px', border: '3px solid #e8c4d0', borderTopColor: '#c6469b', borderRadius: '50%' }} />
          </div>
        }>
          <DataExportTab />
        </Suspense>
      )}

    </div>
  );
}

export default MyMirrorPanel;