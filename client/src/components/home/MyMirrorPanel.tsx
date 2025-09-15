import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getPersonalIntelligenceApi, requestNewAnalysisApi } from '../../services/mirrorDashboard';

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
// THEME HELPERS
// ============================================================================

const THEME = {
  textPrimary: '#6a1f33',
  textBody: '#7e4151',
  textHeading: '#784552',
};

const chip = (text: string) =>
  <span key={text} className="text-xs bg-white/10 px-2 py-1 rounded-full" style={{ color: THEME.textPrimary, textShadow: '0px 1px 3px #7e4151' }}>{text}</span>;

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

export function MyMirrorPanel() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState('Seeker');
  const [active, setActive] = useState<'overview' | 'personality' | 'astrology' | 'cognitive' | 'emotional' | 'voice' | 'answers' | 'meta'>('overview');

  const fetchDashboard = async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      const res = await getPersonalIntelligenceApi();
      // Accepts: {success, data, ...} OR just data
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

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleRequestAnalysis = async (analysisType: string) => {
    try {
      await requestNewAnalysisApi(analysisType, 'normal');
      setTimeout(() => fetchDashboard(true), 2500);
    } catch (e) {
      console.error('Analysis request failed:', e);
    }
  };

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
          <span className="ml-4 enhanced-glass-text" style={{ color: THEME.textPrimary, textShadow: '0px 1px 3px #7e4151' }}>
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
              <span className="enhanced-glass-text font-medium" style={{ color: THEME.textPrimary, textShadow: '0px 1px 3px #7e4151' }}>Retry</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { personalitySnapshot: snap, mirrorScore, growthMetrics, liveInsights } = data;

  // ========================================================================
  // MAIN VIEW
  // ========================================================================

  return (
    <div className="enhanced-glass-panel enhanced-panel-mymirror h-full">
      {/* Header */}
      <div className="enhanced-glass-card">
        <div className="welcome-header mb-6">
          <h1 className="welcome-title" style={{ color: THEME.textPrimary, textShadow: '0px 1px 3px #7e4151' }}>
            Welcome back, {userName}
          </h1>
          <p className="welcome-subtitle" style={{ color: THEME.textPrimary, textShadow: '0px 1px 3px #7e4151' }}>
            {snap?.currentLifePhase || 'Your reflection journey continues'}
          </p>
          {(
            <div className="flex items-center gap-2 enhanced-glass-subtle text-sm mt-2" aria-live="polite">
              {refreshing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white/50" />
                  <span style={{ color: THEME.textPrimary, textShadow: '0px 1px 3px #7e4151' }}>Updating insights...</span>
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
            <p className="enhanced-glass-subtle text-sm mb-2" style={{ color: THEME.textPrimary, textShadow: '0px 1px 3px #7e4151' }}>
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

        {/* Live Insight */}
        {!!liveInsights?.length && (
          <div className="enhanced-glass-card border-l-4 border-purple-400/50" role="note" aria-label="Latest insight">
            <div className="flex items-center justify-between">
              <h3 className="enhanced-glass-heading text-lg" style={{ color: THEME.textHeading }}>Latest Insight</h3>
              <span className="enhanced-glass-subtle text-xs" style={{ color: THEME.textPrimary }}>
                {Math.round((liveInsights[0].confidence || 0) * 100)}% confidence
              </span>
            </div>
            <p className="enhanced-glass-body text-sm leading-relaxed mt-2" style={{ color: THEME.textBody }}>
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
          { id: 'personality', label: 'Personality', icon: '🧠' },
          { id: 'astrology', label: 'Astrology', icon: '♁' },
          { id: 'cognitive', label: 'Cognitive', icon: '📊' },
          { id: 'emotional', label: 'Emotional', icon: '💞' },
          { id: 'voice', label: 'Voice', icon: '🎙️' },
          { id: 'answers', label: 'Answers', icon: '🧾' },
          { id: 'meta', label: 'Metadata', icon: 'ℹ️' },
        ].map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === (t.id as any)}
            onClick={() => setActive(t.id as any)}
            className={`px-3 py-2 rounded-xl transition-all ${active === (t.id as any)
              ? 'bg-white/20 text-white shadow'
              : 'bg-white/10 text-white/80 hover:bg-white/20'} backdrop-blur-sm`}
            style={{ textShadow: '0px 1px 3px #7e4151' }}
          >
            <span className="mr-1">{t.icon}</span>{t.label}
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
                    <div className="text-xs" style={{ color: THEME.textPrimary, textShadow: '0px 1px 3px #7e4151' }}>{s.label}</div>
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
                <div className="space-y-3">
                  {data.growthMetrics.progressIndicators?.slice(0, 4).map((p) => (
                    <div key={p.area}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="enhanced-glass-body text-sm" style={{ color: THEME.textBody }}>{p.area}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs">{p.trend === 'up' ? '↗' : p.trend === 'down' ? '↘' : '→'}</span>
                          <span className="enhanced-glass-subtle text-xs" style={{ color: THEME.textPrimary }}>{p.progress}%</span>
                        </div>
                      </div>
                      <div className="relative h-1.5 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
                        <div
                          className="absolute top-0 left-0 h-full rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${p.progress}%`,
                            background:
                              p.trend === 'up'
                                ? 'linear-gradient(90deg, #10b981, #34d399)'
                                : p.trend === 'down'
                                  ? 'linear-gradient(90deg, #ef4444, #f87171)'
                                  : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                            boxShadow: '0 0 8px rgba(59, 130, 246, 0.4)',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {!!growthMetrics.areasOfFocus?.length && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {growthMetrics.areasOfFocus.map((a) => chip(a))}
                  </div>
                )}
              </div>
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
                    {new Date(data.assessmentMetadata.completionDate).toLocaleString()}
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

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        <button onClick={() => handleRequestAnalysis('pattern_analysis')} className="w-full enhanced-action-button">
          <span className="enhanced-glass-text font-medium" style={{ color: THEME.textPrimary, textShadow: '0px 1px 3px #7e4151' }}>
            Request Pattern Analysis
          </span>
        </button>
        <button onClick={() => handleRequestAnalysis('personality_summary')} className="w-full enhanced-action-button">
          <span className="enhanced-glass-text font-medium" style={{ color: THEME.textPrimary, textShadow: '0px 1px 3px #7e4151' }}>
            Generate Personality Summary
          </span>
        </button>
        <button onClick={() => (window.location.href = '/intake')} className="w-full enhanced-action-button">
          <span className="enhanced-glass-text font-medium" style={{ color: THEME.textPrimary, textShadow: '0px 1px 3px #7e4151' }}>
            Update Assessment
          </span>
        </button>
      </div>
    </div>
  );
}

export default MyMirrorPanel;
