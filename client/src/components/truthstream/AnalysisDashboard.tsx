// src/components/truthstream/AnalysisDashboard.tsx
// Display Truth Mirror Report, perception gap, and growth recommendations
// Styled to match VisualStep glass morphism with animated bars, SVG rings, and glow effects

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTruthStream } from '../../context/TruthStreamContext';
import { clearTruthStreamCache } from '../../services/truthStreamApi';

// ============================================================================
// COLOR PALETTE — matches VisualStep expression colors + app pink/purple theme
// ============================================================================
const SCORE_COLORS: Record<string, { color: string; glow: string }> = {
  authenticity:      { color: '#4ade80', glow: 'rgba(74,222,128,0.35)' },
  selfAwareness:     { color: '#60a5fa', glow: 'rgba(96,165,250,0.35)' },
  empathy:           { color: '#c084fc', glow: 'rgba(192,132,252,0.35)' },
  communication:     { color: '#f472b6', glow: 'rgba(244,114,182,0.35)' },
  emotionalIntel:    { color: '#fb923c', glow: 'rgba(251,146,60,0.35)' },
  openness:          { color: '#facc15', glow: 'rgba(250,204,21,0.35)' },
  trustworthiness:   { color: '#2dd4bf', glow: 'rgba(45,212,191,0.35)' },
  resilience:        { color: '#818cf8', glow: 'rgba(129,140,248,0.35)' },
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
  const normalized = key.replace(/([A-Z])/g, (m) => m).replace(/\s+/g, '');
  const camel = normalized.charAt(0).toLowerCase() + normalized.slice(1);
  return SCORE_COLORS[camel] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

// Gap level config — color, glow, label
function gapLevelMeta(level: string) {
  switch (level) {
    case 'exceptional':       return { color: '#4ade80', glow: 'rgba(74,222,128,0.4)', label: 'Exceptional Self-Awareness' };
    case 'good':              return { color: '#60a5fa', glow: 'rgba(96,165,250,0.4)', label: 'Good Self-Awareness' };
    case 'significant_gaps':  return { color: '#facc15', glow: 'rgba(250,204,21,0.4)', label: 'Significant Gaps' };
    case 'major_disconnect':  return { color: '#f87171', glow: 'rgba(248,113,113,0.4)', label: 'Major Disconnect' };
    default:                  return { color: '#94a3b8', glow: 'rgba(148,163,184,0.4)', label: level };
  }
}

// Pattern significance colors
function significanceColor(sig: string) {
  switch (sig) {
    case 'high':   return { color: '#f472b6', glow: 'rgba(244,114,182,0.3)' };
    case 'medium': return { color: '#a78bfa', glow: 'rgba(167,139,250,0.3)' };
    default:       return { color: '#94a3b8', glow: 'rgba(148,163,184,0.3)' };
  }
}

// Priority colors for growth recommendations
function priorityColor(priority: string) {
  switch (priority) {
    case 'high':   return { color: '#f87171', glow: 'rgba(248,113,113,0.3)' };
    case 'medium': return { color: '#fb923c', glow: 'rgba(251,146,60,0.3)' };
    default:       return { color: '#4ade80', glow: 'rgba(74,222,128,0.3)' };
  }
}

// How often to poll for analysis completion (ms)
const POLL_INTERVAL = 8000;
// Max time to poll before giving up (ms)
const MAX_POLL_DURATION = 200000;

// ============================================================================
// ORBITAL LOADING ANIMATION — beautiful pulsing rings + floating particles
// ============================================================================
const OrbitalLoader: React.FC<{ elapsed: number; maxDuration: number }> = ({ elapsed, maxDuration }) => {
  const progress = Math.min((elapsed / maxDuration) * 100, 95);
  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px' }}
    >
      {/* Orbital rings container */}
      <div style={{ position: 'relative', width: 120, height: 120, marginBottom: 24 }}>
        {/* Outer ring — slow rotation */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          style={{
            position: 'absolute', inset: 0,
            borderRadius: '50%',
            border: '2px solid transparent',
            borderTopColor: '#f472b6',
            borderRightColor: 'rgba(244,114,182,0.3)',
            filter: 'drop-shadow(0 0 8px rgba(244,114,182,0.4))',
          }}
        />
        {/* Middle ring — counter-rotation */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
          style={{
            position: 'absolute', inset: 14,
            borderRadius: '50%',
            border: '2px solid transparent',
            borderTopColor: '#a78bfa',
            borderLeftColor: 'rgba(167,139,250,0.3)',
            filter: 'drop-shadow(0 0 6px rgba(167,139,250,0.4))',
          }}
        />
        {/* Inner ring — fast rotation */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          style={{
            position: 'absolute', inset: 28,
            borderRadius: '50%',
            border: '2px solid transparent',
            borderBottomColor: '#60a5fa',
            borderRightColor: 'rgba(96,165,250,0.3)',
            filter: 'drop-shadow(0 0 6px rgba(96,165,250,0.4))',
          }}
        />
        {/* Center pulsing core */}
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', inset: 42,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(244,114,182,0.3), rgba(167,139,250,0.1))',
            boxShadow: '0 0 20px rgba(244,114,182,0.2), 0 0 40px rgba(167,139,250,0.1)',
          }}
        />
        {/* Floating particles */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <motion.div
            key={i}
            animate={{
              rotate: [i * 60, i * 60 + 360],
              scale: [0.8, 1.2, 0.8],
            }}
            transition={{
              rotate: { duration: 6 + i * 0.5, repeat: Infinity, ease: 'linear' },
              scale: { duration: 2 + i * 0.3, repeat: Infinity, ease: 'easeInOut' },
            }}
            style={{
              position: 'absolute',
              top: '50%', left: '50%',
              width: 4, height: 4,
              marginTop: -2, marginLeft: -2,
              transformOrigin: `2px ${-48 + i * 4}px`,
            }}
          >
            <div style={{
              width: 4, height: 4, borderRadius: '50%',
              background: FALLBACK_COLORS[i % FALLBACK_COLORS.length].color,
              boxShadow: `0 0 6px ${FALLBACK_COLORS[i % FALLBACK_COLORS.length].glow}`,
            }} />
          </motion.div>
        ))}
      </div>

      {/* Status text */}
      <motion.h3
        className="enhanced-glass-heading"
        style={{ fontSize: 16, marginBottom: 8, textAlign: 'center' }}
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        Generating Your Report
      </motion.h3>
      <p className="enhanced-glass-body" style={{ fontSize: 12, marginBottom: 16, textAlign: 'center', maxWidth: 280 }}>
        Dina is analyzing your reviews and synthesizing insights. This typically takes 1-2 minutes.
      </p>

      {/* Progress bar */}
      <div style={{ width: 200, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 8 }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          style={{
            height: '100%', borderRadius: 2,
            background: 'linear-gradient(90deg, #f472b6, #a78bfa, #60a5fa)',
            boxShadow: '0 0 8px rgba(244,114,182,0.35), 0 0 4px rgba(167,139,250,0.3)',
          }}
        />
      </div>
      <p className="enhanced-glass-subtle" style={{ fontSize: 10, margin: 0, fontFamily: 'monospace' }}>
        {minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`} elapsed
      </p>
    </motion.div>
  );
};

// ============================================================================
// SVG SCORE RING — circular progress indicator (matches VisualStep quality ring)
// ============================================================================
const ScoreRing: React.FC<{
  score: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  glow: string;
}> = ({ score, size = 72, strokeWidth = 4, color, glow }) => {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth}
        />
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
  );
};

// ============================================================================
// ANIMATED BAR — horizontal progress bar with gradient + glow
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
  const pct = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      style={{ display: 'flex', alignItems: 'center', gap: 10 }}
    >
      <span className="enhanced-glass-subtle" style={{ fontSize: 12, width: 100, textAlign: 'right', flexShrink: 0, margin: 0 }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(pct, 2)}%` }}
          transition={{ delay: 0.1 + index * 0.04, duration: 0.5, ease: 'easeOut' }}
          style={{
            height: '100%',
            borderRadius: 3,
            background: `linear-gradient(90deg, ${color}99, ${color})`,
            boxShadow: pct > 5 ? `0 0 8px ${glow}, 0 0 2px ${color}` : 'none',
          }}
        />
      </div>
      <span className="enhanced-glass-text" style={{ fontSize: 11, fontWeight: 600, width: 38, textAlign: 'right', flexShrink: 0, margin: 0, fontFamily: 'monospace' }}>
        {value.toFixed(1)}{suffix}
      </span>
    </motion.div>
  );
};

// ============================================================================
// GLASS BADGE — small pill with colored left border (matches VisualStep dominant badge)
// ============================================================================
const GlassBadge: React.FC<{
  label: string;
  sublabel?: string;
  color: string;
}> = ({ label, sublabel, color }) => (
  <div
    className="enhanced-glass-card"
    style={{ display: 'inline-flex', flexDirection: 'column', padding: '6px 14px', borderRadius: 12, borderLeft: `3px solid ${color}`, marginBottom: 0, textAlign: 'center' }}
  >
    <span className="enhanced-glass-text" style={{ fontSize: 12, fontWeight: 600, margin: 0 }}>{label}</span>
    {sublabel && <span className="enhanced-glass-subtle" style={{ fontSize: 10, margin: 0 }}>{sublabel}</span>}
  </div>
);

// ============================================================================
// MAIN DASHBOARD
// ============================================================================
export default function AnalysisDashboard() {
  const { analysis, stats, isLoading, isSubmitting, loadAnalysis, requestAnalysis, setView } = useTruthStream();
  const [isPolling, setIsPolling] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [pollElapsed, setPollElapsed] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);
  const analysisIdBeforeRegen = useRef<string | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadAnalysis();
  }, [loadAnalysis]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, []);

  // Stop polling when new analysis arrives (different from pre-regen ID, or first load)
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

    // Track pre-regen analysis ID so we know when a NEW one arrives
    analysisIdBeforeRegen.current = analysis?.id ?? null;
    if (analysis) setIsRegenerating(true);

    setIsPolling(true);
    setPollElapsed(0);
    pollStartRef.current = Date.now();

    // Smooth elapsed counter (updates every second for the UI)
    elapsedTimerRef.current = setInterval(() => {
      setPollElapsed(Date.now() - pollStartRef.current);
    }, 1000);

    pollRef.current = setInterval(async () => {
      const elapsed = Date.now() - pollStartRef.current;

      if (elapsed >= MAX_POLL_DURATION) {
        setIsPolling(false);
        setIsRegenerating(false);
        if (pollRef.current) clearInterval(pollRef.current);
        if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
        pollRef.current = null;
        elapsedTimerRef.current = null;
        return;
      }

      try {
        clearTruthStreamCache('analysis');
        await loadAnalysis();
      } catch {
        // Silently continue polling
      }
    }, POLL_INTERVAL);
  }, [loadAnalysis, analysis]);

  const handleRequestAnalysis = useCallback(async (): Promise<boolean> => {
    const success = await requestAnalysis();
    if (success) {
      startPolling();
    }
    return success;
  }, [requestAnalysis, startPolling]);

  // ── Loading state ──────────────────────────────────────────────────────
  if (isLoading && !isPolling) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="enhanced-glass-card text-center py-12"
      >
        <OrbitalLoader elapsed={0} maxDuration={MAX_POLL_DURATION} />
        <p className="enhanced-glass-body text-sm" style={{ marginTop: 8 }}>Loading analysis...</p>
      </motion.div>
    );
  }

  // ── No analysis yet ────────────────────────────────────────────────────
  if (!analysis) {
    const reviewCount = stats?.totalReviewsReceived || 0;
    const canRequest = reviewCount >= 5;

    return (
      <div className="space-y-4">
        <AnimatePresence mode="wait">
          {isPolling ? (
            <motion.div
              key="polling"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="enhanced-glass-card"
            >
              <OrbitalLoader elapsed={pollElapsed} maxDuration={MAX_POLL_DURATION} />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="enhanced-glass-card text-center py-12"
            >
              <h3 className="enhanced-glass-heading text-lg mb-2">No Analysis Yet</h3>
              <p className="enhanced-glass-body text-sm mb-4">
                {canRequest
                  ? 'You have enough reviews to generate your Truth Mirror Report!'
                  : `You need at least 5 reviews to generate an analysis. You have ${reviewCount}.`}
              </p>
              {canRequest && (
                <button
                  onClick={handleRequestAnalysis}
                  disabled={isSubmitting}
                  className="enhanced-action-button px-8 py-3"
                  style={{ opacity: isSubmitting ? 0.6 : 1 }}
                >
                  <span className="enhanced-glass-text font-medium">
                    {isSubmitting ? 'Requesting...' : 'Generate Report'}
                  </span>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <button onClick={() => setView('overview')} className="enhanced-action-button w-full py-3">
          <span className="enhanced-glass-text font-medium">Back to Overview</span>
        </button>
      </div>
    );
  }

  // ── Full analysis report ───────────────────────────────────────────────
  const { analysisData, perceptionGapScore, confidenceLevel, reviewCountAtGeneration, createdAt } = analysis;
  const perceptionSummary = analysisData?.perceptionSummary;
  const patternDetection = analysisData?.patternDetection || [];
  const blindSpots = analysisData?.blindSpots || [];
  const perceptionGap = analysisData?.perceptionGap;
  const growthRecommendations = analysisData?.growthRecommendations || [];

  const gapScore = Math.round(perceptionGapScore ?? perceptionGap?.score ?? 0);
  const gapLevel = perceptionGap?.level || (
    gapScore <= 25 ? 'exceptional' :
    gapScore <= 50 ? 'good' :
    gapScore <= 75 ? 'significant_gaps' : 'major_disconnect'
  );
  const gapMeta = gapLevelMeta(gapLevel);
  const gapSummary = perceptionGap?.summary || '';
  const confidencePct = Math.round((confidenceLevel ?? 0) * 100);

  // ── Collect notable quotes from all analysis data sources ─────────────
  const notableQuotes: Array<{ quote: string; source: string }> = [];
  // keyQuotes from perception summary
  (perceptionSummary?.keyQuotes || []).forEach((q: unknown) => {
    const s = typeof q === 'string' ? q : '';
    if (s.trim().length > 5) notableQuotes.push({ quote: s, source: 'Perception Summary' });
  });
  // supportingQuotes from pattern detection
  patternDetection.forEach((p: any) => {
    (p.supportingQuotes || []).forEach((q: unknown) => {
      const s = typeof q === 'string' ? q : '';
      if (s.trim().length > 5) notableQuotes.push({ quote: s, source: p.pattern || 'Pattern' });
    });
  });
  // reviewerQuotes from dimension breakdown
  const dimensionBreakdown = analysisData?.dimensionBreakdown || [];
  dimensionBreakdown.forEach((d: any) => {
    (d.reviewerQuotes || []).forEach((q: unknown) => {
      const s = typeof q === 'string' ? q : '';
      if (s.trim().length > 5) notableQuotes.push({ quote: s, source: d.name || 'Dimension' });
    });
  });
  // evidence from blind spots
  blindSpots.forEach((bs: any) => {
    const ev = typeof bs.evidence === 'string' ? bs.evidence : '';
    if (ev.trim().length > 5) {
      notableQuotes.push({ quote: ev, source: bs.dimension || 'Blind Spot' });
    }
  });
  // Deduplicate by quote text
  const seenQuotes = new Set<string>();
  const uniqueQuotes = notableQuotes.filter((q) => {
    const key = q.quote.toLowerCase().trim();
    if (seenQuotes.has(key)) return false;
    seenQuotes.add(key);
    return true;
  });

  // ── If regenerating, show loading overlay instead of report ───────────
  if (isRegenerating && isPolling) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-5"
      >
        <motion.div className="enhanced-glass-card">
          <OrbitalLoader elapsed={pollElapsed} maxDuration={MAX_POLL_DURATION} />
        </motion.div>
        <button onClick={() => setView('overview')} className="enhanced-action-button w-full py-3">
          <span className="enhanced-glass-text font-medium">Back to Overview</span>
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="enhanced-glass-card"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView('overview')}
              className="enhanced-action-button text-xs px-3 py-1"
              style={{ padding: '6px 12px', borderRadius: 10 }}
            >
              <span className="enhanced-glass-subtle" style={{ fontSize: 12 }}>Back</span>
            </button>
            <h2 className="enhanced-glass-heading" style={{ fontSize: 18 }}>Truth Mirror Report</h2>
          </div>
          <GlassBadge label={`${reviewCountAtGeneration} reviews`} color="#f472b6" />
        </div>
        <div className="flex items-center gap-4">
          <span className="enhanced-glass-subtle" style={{ fontSize: 11 }}>
            Generated {new Date(createdAt).toLocaleDateString()}
          </span>
          <span className="enhanced-glass-subtle" style={{ fontSize: 11 }}>
            Confidence: {confidencePct}%
          </span>
        </div>
      </motion.div>

      {/* ── Perception Gap Score — SVG ring + label ────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="enhanced-glass-card"
        style={{ padding: 20, borderRadius: 16 }}
      >
        <div className="flex items-center gap-4">
          <ScoreRing score={gapScore} size={72} strokeWidth={4} color={gapMeta.color} glow={gapMeta.glow} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="enhanced-glass-subtle" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>
              Perception Gap Score
            </p>
            <p className="enhanced-glass-heading" style={{ fontSize: 15, color: gapMeta.color, margin: '0 0 4px' }}>
              {gapMeta.label}
            </p>
            {gapSummary && (
              <p className="enhanced-glass-body" style={{ fontSize: 12, margin: 0, lineHeight: 1.5 }}>{gapSummary}</p>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Average Scores — animated bars ─────────────────────────────── */}
      {perceptionSummary?.averageScores && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="enhanced-glass-card"
          style={{ padding: 16, borderRadius: 16 }}
        >
          <h3 className="enhanced-glass-heading" style={{ fontSize: 14, marginBottom: 12 }}>Average Scores</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(perceptionSummary.averageScores).map(([key, value], i) => {
              const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
              const numValue = typeof value === 'number' ? value : 0;
              const colors = getScoreColor(key, i);
              return (
                <AnimatedBar
                  key={key}
                  label={label}
                  value={numValue}
                  maxValue={10}
                  color={colors.color}
                  glow={colors.glow}
                  index={i}
                />
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── Overview ───────────────────────────────────────────────────── */}
      {perceptionSummary?.overview && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="enhanced-glass-card"
        >
          <h3 className="enhanced-glass-heading" style={{ fontSize: 14, marginBottom: 8 }}>Overview</h3>
          <p className="enhanced-glass-body" style={{ fontSize: 13, margin: 0, lineHeight: 1.6 }}>{perceptionSummary.overview}</p>
        </motion.div>
      )}

      {/* ── Top Impression Words — glass pills with glow borders ──────── */}
      {(perceptionSummary?.topImpressionWords?.length ?? 0) > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="enhanced-glass-card"
        >
          <h3 className="enhanced-glass-heading" style={{ fontSize: 14, marginBottom: 12 }}>How Others See You</h3>
          <div className="flex flex-wrap gap-2">
            {perceptionSummary!.topImpressionWords.map((w: any, i: number) => {
              const pill = FALLBACK_COLORS[i % FALLBACK_COLORS.length];
              return (
                <motion.span
                  key={w.word}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.05, duration: 0.25 }}
                  className="px-3 py-1.5 rounded-full"
                  style={{
                    fontSize: 12,
                    background: `linear-gradient(135deg, ${pill.color}18, ${pill.color}08)`,
                    border: `1px solid ${pill.color}40`,
                    color: pill.color,
                    boxShadow: `0 0 6px ${pill.glow}`,
                  }}
                >
                  {w.word} ({w.count})
                </motion.span>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── Detected Patterns — cards with colored left border ─────────── */}
      {patternDetection.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="enhanced-glass-card"
        >
          <h3 className="enhanced-glass-heading" style={{ fontSize: 14, marginBottom: 12 }}>Detected Patterns</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {patternDetection.map((p: any, i: number) => {
              const sig = significanceColor(p.significance);
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + i * 0.05, duration: 0.25 }}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    borderLeft: `3px solid ${sig.color}`,
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid rgba(255,255,255,0.06)`,
                    borderLeftWidth: 3,
                    borderLeftColor: sig.color,
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="enhanced-glass-text" style={{ fontSize: 13, fontWeight: 600 }}>{p.pattern}</span>
                    <span
                      className="px-2 py-0.5 rounded-full capitalize"
                      style={{
                        fontSize: 10,
                        background: `${sig.color}20`,
                        color: sig.color,
                        boxShadow: `0 0 4px ${sig.glow}`,
                      }}
                    >
                      {p.significance}
                    </span>
                  </div>
                  <p className="enhanced-glass-body" style={{ fontSize: 12, margin: 0 }}>{p.description}</p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── Blind Spots — amber-accented cards with score comparison ──── */}
      {blindSpots.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="enhanced-glass-card"
        >
          <h3 className="enhanced-glass-heading" style={{ fontSize: 14, marginBottom: 12 }}>Blind Spots</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {blindSpots.map((bs: any, i: number) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.05, duration: 0.25 }}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  borderLeft: '3px solid #facc15',
                  background: 'rgba(250,204,21,0.04)',
                  border: '1px solid rgba(250,204,21,0.12)',
                  borderLeftWidth: 3,
                  borderLeftColor: '#facc15',
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="enhanced-glass-text" style={{ fontSize: 13, fontWeight: 600 }}>{bs.dimension}</span>
                  <div className="flex items-center gap-3">
                    <span style={{ fontSize: 11, color: '#60a5fa', fontFamily: 'monospace' }}>
                      Self {(bs.selfScore ?? 0).toFixed(1)}
                    </span>
                    <span className="enhanced-glass-subtle" style={{ fontSize: 10 }}>vs</span>
                    <span style={{ fontSize: 11, color: '#f472b6', fontFamily: 'monospace' }}>
                      Others {(bs.externalScore ?? 0).toFixed(1)}
                    </span>
                  </div>
                </div>
                <p className="enhanced-glass-body" style={{ fontSize: 12, margin: 0 }}>{bs.interpretation}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Growth Recommendations — green-accented with priority pills ── */}
      {growthRecommendations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="enhanced-glass-card"
        >
          <h3 className="enhanced-glass-heading" style={{ fontSize: 14, marginBottom: 12 }}>Growth Recommendations</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {growthRecommendations.map((rec: any, i: number) => {
              const pri = priorityColor(rec.priority);
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.45 + i * 0.05, duration: 0.25 }}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    borderLeft: `3px solid #4ade80`,
                    background: 'rgba(74,222,128,0.03)',
                    border: '1px solid rgba(74,222,128,0.1)',
                    borderLeftWidth: 3,
                    borderLeftColor: '#4ade80',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="enhanced-glass-text" style={{ fontSize: 13, fontWeight: 600 }}>{rec.area}</span>
                    <span
                      className="px-2 py-0.5 rounded-full capitalize"
                      style={{
                        fontSize: 10,
                        background: `${pri.color}20`,
                        color: pri.color,
                        boxShadow: `0 0 4px ${pri.glow}`,
                      }}
                    >
                      {rec.priority}
                    </span>
                  </div>
                  <p className="enhanced-glass-body" style={{ fontSize: 12, margin: '0 0 4px' }}>{rec.recommendation}</p>
                  {rec.journalPrompt && (
                    <p className="enhanced-glass-subtle" style={{ fontSize: 11, fontStyle: 'italic', margin: 0 }}>
                      Journal prompt: &ldquo;{rec.journalPrompt}&rdquo;
                    </p>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── Notable Quotes — reviewer quotes as evidence ──────────────── */}
      {uniqueQuotes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.45 }}
          className="enhanced-glass-card"
        >
          <h3 className="enhanced-glass-heading" style={{ fontSize: 14, marginBottom: 12 }}>Notable Quotes</h3>
          <p className="enhanced-glass-subtle" style={{ fontSize: 11, marginBottom: 14, marginTop: -4 }}>
            Standout quotes from your reviewers that support these findings
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {uniqueQuotes.map((q, i) => {
              const quoteColor = FALLBACK_COLORS[i % FALLBACK_COLORS.length];
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.06, duration: 0.25 }}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 12,
                    borderLeft: `3px solid ${quoteColor.color}`,
                    background: `linear-gradient(135deg, ${quoteColor.color}08, transparent)`,
                    border: `1px solid rgba(255,255,255,0.06)`,
                    borderLeftWidth: 3,
                    borderLeftColor: quoteColor.color,
                    position: 'relative',
                  }}
                >
                  {/* Quote mark */}
                  <span style={{
                    position: 'absolute', top: 6, left: 12,
                    fontSize: 24, lineHeight: 1, fontFamily: 'Georgia, serif',
                    color: quoteColor.color, opacity: 0.3,
                  }}>&ldquo;</span>
                  <p className="enhanced-glass-body" style={{
                    fontSize: 12, margin: 0, fontStyle: 'italic',
                    lineHeight: 1.6, paddingLeft: 16, paddingRight: 8,
                  }}>
                    {q.quote}
                  </p>
                  <span className="enhanced-glass-subtle" style={{
                    fontSize: 10, marginTop: 6, display: 'block', paddingLeft: 16,
                  }}>
                    Related to: {q.source}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── Regenerate ─────────────────────────────────────────────────── */}
      <RegenerateSection requestAnalysis={handleRequestAnalysis} isSubmitting={isSubmitting} />
    </motion.div>
  );
}

// ============================================================================
// REGENERATE SECTION
// ============================================================================
function RegenerateSection({ requestAnalysis, isSubmitting }: { requestAnalysis: () => Promise<boolean>; isSubmitting: boolean }) {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleConfirm = async () => {
    setShowConfirm(false);
    await requestAnalysis();
  };

  return (
    <div className="space-y-3">
      <AnimatePresence mode="wait">
        {showConfirm && (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="enhanced-glass-card"
            style={{
              borderLeft: '3px solid #facc15',
              background: 'rgba(250,204,21,0.04)',
            }}
            role="alert"
          >
            <p className="enhanced-glass-body" style={{ fontSize: 12, marginBottom: 12 }}>
              Generating a new analysis will replace your current report. This uses AI processing and may take a few minutes. Continue?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="enhanced-action-button text-xs px-4 py-1.5"
                style={{ padding: '6px 16px' }}
              >
                <span className="enhanced-glass-subtle" style={{ fontSize: 12 }}>Cancel</span>
              </button>
              <button
                onClick={handleConfirm}
                disabled={isSubmitting}
                className="enhanced-action-button px-4 py-1.5 text-xs"
                style={{
                  opacity: isSubmitting ? 0.6 : 1,
                  borderColor: 'rgba(244,114,182,0.3)',
                  background: 'rgba(244,114,182,0.1)',
                }}
              >
                <span className="enhanced-glass-text font-medium" style={{ fontSize: 12 }}>
                  {isSubmitting ? 'Requesting...' : 'Yes, Regenerate'}
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!showConfirm && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setShowConfirm(true)}
          disabled={isSubmitting}
          className="w-full enhanced-action-button py-3"
          style={{ opacity: isSubmitting ? 0.6 : 1 }}
        >
          <span className="enhanced-glass-text font-medium">
            {isSubmitting ? 'Requesting...' : 'Request New Analysis'}
          </span>
        </motion.button>
      )}
    </div>
  );
}
