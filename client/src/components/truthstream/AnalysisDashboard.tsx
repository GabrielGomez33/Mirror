// src/components/truthstream/AnalysisDashboard.tsx
// Display Truth Mirror Report, perception gap, and growth recommendations

import { useEffect, useState } from 'react';
import { useTruthStream } from '../../context/TruthStreamContext';

const COLORS = {
  heading: '#784552',
  body: '#7e4151',
  label: '#6a1f33',
};

function gapLevelColor(level: string): string {
  switch (level) {
    case 'exceptional': return 'rgba(34,197,94,0.25)';
    case 'good': return 'rgba(59,130,246,0.25)';
    case 'significant_gaps': return 'rgba(251,191,36,0.25)';
    case 'major_disconnect': return 'rgba(239,68,68,0.25)';
    default: return 'rgba(255,255,255,0.1)';
  }
}

function gapLevelLabel(level: string): string {
  switch (level) {
    case 'exceptional': return 'Exceptional Self-Awareness';
    case 'good': return 'Good Self-Awareness';
    case 'significant_gaps': return 'Significant Gaps';
    case 'major_disconnect': return 'Major Disconnect';
    default: return level;
  }
}

export default function AnalysisDashboard() {
  const { analysis, stats, isLoading, isSubmitting, loadAnalysis, requestAnalysis, setView } = useTruthStream();

  useEffect(() => {
    loadAnalysis();
  }, [loadAnalysis]);

  if (isLoading) {
    return (
      <div className="enhanced-glass-card text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-3" style={{ borderColor: COLORS.heading }} />
        <p className="text-sm" style={{ color: COLORS.body }}>Loading analysis...</p>
      </div>
    );
  }

  if (!analysis) {
    const reviewCount = stats?.totalReviewsReceived || 0;
    const canRequest = reviewCount >= 5;

    return (
      <div className="space-y-4">
        <div className="enhanced-glass-card text-center py-12">
          <span className="text-4xl block mb-4">🔮</span>
          <h3 className="text-lg font-medium mb-2" style={{ color: COLORS.heading }}>No Analysis Yet</h3>
          <p className="text-sm mb-4" style={{ color: COLORS.body }}>
            {canRequest
              ? 'You have enough reviews to generate your Truth Mirror Report!'
              : `You need at least 5 reviews to generate an analysis. You have ${reviewCount}.`}
          </p>
          {canRequest && (
            <button
              onClick={requestAnalysis}
              disabled={isSubmitting}
              className="enhanced-action-button px-8 py-3"
              style={{ opacity: isSubmitting ? 0.6 : 1 }}
            >
              <span className="font-medium" style={{ color: COLORS.label }}>
                {isSubmitting ? 'Requesting...' : 'Generate Report'}
              </span>
            </button>
          )}
        </div>
        <button onClick={() => setView('overview')} className="enhanced-action-button w-full py-3">
          <span className="font-medium" style={{ color: COLORS.label }}>Back to Overview</span>
        </button>
      </div>
    );
  }

  const { analysisData, perceptionGapScore, confidenceLevel, reviewCountAtGeneration, createdAt } = analysis;
  const { perceptionSummary, patternDetection, blindSpots, perceptionGap, growthRecommendations } = analysisData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="enhanced-glass-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setView('overview')} className="text-xs px-3 py-1 rounded-lg" style={{ color: COLORS.label, background: 'rgba(255,255,255,0.08)' }}>
              Back
            </button>
            <h2 className="text-xl font-semibold" style={{ color: COLORS.heading }}>Truth Mirror Report</h2>
          </div>
          <span className="text-xs px-3 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.08)', color: COLORS.label }}>
            Based on {reviewCountAtGeneration} reviews
          </span>
        </div>
        <p className="text-xs" style={{ color: COLORS.label }}>
          Generated {new Date(createdAt).toLocaleDateString()} · Confidence: {Math.round(confidenceLevel * 100)}%
        </p>
      </div>

      {/* Perception Gap Score */}
      <div className="enhanced-glass-card" style={{ background: gapLevelColor(perceptionGap.level) }}>
        <div className="text-center">
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: COLORS.label }}>Perception Gap Score</p>
          <div className="text-4xl font-bold mb-1" style={{ color: COLORS.heading }}>
            {Math.round(perceptionGapScore)}
          </div>
          <p className="text-sm font-medium mb-2" style={{ color: COLORS.heading }}>
            {gapLevelLabel(perceptionGap.level)}
          </p>
          <p className="text-xs leading-relaxed" style={{ color: COLORS.body }}>
            {perceptionGap.summary}
          </p>
        </div>
      </div>

      {/* Average Scores */}
      <div className="enhanced-glass-card">
        <h3 className="text-sm font-medium mb-3" style={{ color: COLORS.heading }}>Average Scores</h3>
        <div className="space-y-2">
          {Object.entries(perceptionSummary.averageScores).map(([key, value]) => {
            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="text-xs w-40 truncate" style={{ color: COLORS.body }}>{label}</span>
                <div className="flex-1 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(value as number) * 10}%`,
                      background: 'linear-gradient(90deg, #f472b6, #a78bfa)',
                    }}
                  />
                </div>
                <span className="text-xs font-medium w-8 text-right" style={{ color: COLORS.heading }}>
                  {(value as number).toFixed(1)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Impression Words */}
      {perceptionSummary.topImpressionWords.length > 0 && (
        <div className="enhanced-glass-card">
          <h3 className="text-sm font-medium mb-3" style={{ color: COLORS.heading }}>How Others See You</h3>
          <div className="flex flex-wrap gap-2">
            {perceptionSummary.topImpressionWords.map((w) => (
              <span
                key={w.word}
                className="px-3 py-1.5 rounded-full text-xs"
                style={{
                  background: 'linear-gradient(135deg, rgba(244,114,182,0.15), rgba(167,139,250,0.15))',
                  border: '1px solid rgba(244,114,182,0.3)',
                  color: COLORS.body,
                }}
              >
                {w.word} ({w.count})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Patterns */}
      {patternDetection.length > 0 && (
        <div className="enhanced-glass-card">
          <h3 className="text-sm font-medium mb-3" style={{ color: COLORS.heading }}>Detected Patterns</h3>
          <div className="space-y-3">
            {patternDetection.map((p, i) => (
              <div
                key={i}
                className="p-3 rounded-lg"
                style={{
                  background: p.significance === 'high' ? 'rgba(244,114,182,0.1)' : 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium" style={{ color: COLORS.heading }}>{p.pattern}</span>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full capitalize"
                    style={{
                      background: p.significance === 'high' ? 'rgba(244,114,182,0.2)' : 'rgba(255,255,255,0.08)',
                      color: COLORS.label,
                    }}
                  >
                    {p.significance}
                  </span>
                </div>
                <p className="text-xs" style={{ color: COLORS.body }}>{p.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Blind Spots */}
      {blindSpots.length > 0 && (
        <div className="enhanced-glass-card">
          <h3 className="text-sm font-medium mb-3" style={{ color: COLORS.heading }}>Blind Spots</h3>
          <div className="space-y-3">
            {blindSpots.map((bs, i) => (
              <div
                key={i}
                className="p-3 rounded-lg"
                style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium" style={{ color: COLORS.heading }}>{bs.dimension}</span>
                  <span className="text-xs" style={{ color: COLORS.label }}>
                    Self: {bs.selfScore.toFixed(1)} vs Others: {bs.externalScore.toFixed(1)}
                  </span>
                </div>
                <p className="text-xs" style={{ color: COLORS.body }}>{bs.interpretation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Growth Recommendations */}
      {growthRecommendations.length > 0 && (
        <div className="enhanced-glass-card">
          <h3 className="text-sm font-medium mb-3" style={{ color: COLORS.heading }}>Growth Recommendations</h3>
          <div className="space-y-3">
            {growthRecommendations.map((rec, i) => (
              <div
                key={i}
                className="p-3 rounded-lg"
                style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium" style={{ color: COLORS.heading }}>{rec.area}</span>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full capitalize"
                    style={{
                      background: rec.priority === 'high' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.08)',
                      color: COLORS.label,
                    }}
                  >
                    {rec.priority}
                  </span>
                </div>
                <p className="text-xs mb-1" style={{ color: COLORS.body }}>{rec.recommendation}</p>
                {rec.journalPrompt && (
                  <p className="text-[10px] italic" style={{ color: COLORS.label }}>
                    Journal prompt: "{rec.journalPrompt}"
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Regenerate */}
      <RegenerateSection requestAnalysis={requestAnalysis} isSubmitting={isSubmitting} />
    </div>
  );
}

// Isolated component to manage confirm dialog state without re-rendering entire dashboard
function RegenerateSection({ requestAnalysis, isSubmitting }: { requestAnalysis: () => Promise<boolean>; isSubmitting: boolean }) {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleConfirm = async () => {
    setShowConfirm(false);
    await requestAnalysis();
  };

  return (
    <div className="space-y-3">
      {showConfirm && (
        <div
          className="enhanced-glass-card"
          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)' }}
          role="alert"
        >
          <p className="text-xs mb-3" style={{ color: COLORS.body }}>
            Generating a new analysis will replace your current report. This uses AI processing and may take a few minutes. Continue?
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowConfirm(false)}
              className="text-xs px-4 py-1.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.08)', color: COLORS.label }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="enhanced-action-button px-4 py-1.5 text-xs"
              style={{ opacity: isSubmitting ? 0.6 : 1 }}
            >
              <span className="font-medium" style={{ color: COLORS.label }}>
                {isSubmitting ? 'Requesting...' : 'Yes, Regenerate'}
              </span>
            </button>
          </div>
        </div>
      )}

      {!showConfirm && (
        <button
          onClick={() => setShowConfirm(true)}
          disabled={isSubmitting}
          className="w-full enhanced-action-button py-3"
          style={{ opacity: isSubmitting ? 0.6 : 1 }}
        >
          <span className="font-medium" style={{ color: COLORS.label }}>
            {isSubmitting ? 'Requesting...' : 'Request New Analysis'}
          </span>
        </button>
      )}
    </div>
  );
}
