// src/components/mirrorgroups/GroupInsightsPanel.tsx
// AI-powered group insights display with history

import { useState, useEffect } from 'react';
import type { GroupInsights, CompatibilityScore, CollectivePattern, ConflictRisk, LLMSynthesis } from '../../types/groups';
import { getInsightsHistory } from '../../services/groupsApi';

interface GroupInsightsPanelProps {
  groupId: string;
  insights: GroupInsights | null;
  isLoading: boolean;
  onRefresh: (userContext?: string) => void;
  currentUserRole?: string; // Optional: 'owner', 'admin', or 'member'
}

export default function GroupInsightsPanel({
  groupId,
  insights,
  isLoading,
  onRefresh,
  currentUserRole,
}: GroupInsightsPanelProps) {
  const [insightsHistory, setInsightsHistory] = useState<LLMSynthesis[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [userContext, setUserContext] = useState('');
  const [showContextInput, setShowContextInput] = useState(false);
  const isOwner = currentUserRole === 'owner';

  const handleRefreshWithContext = () => {
    onRefresh(userContext.trim() || undefined);
  };

  // Fetch insights history
  useEffect(() => {
    const fetchHistory = async () => {
      if (!groupId) return;
      setIsLoadingHistory(true);
      try {
        const result = await getInsightsHistory(groupId, 20, 0);
        // Filter out the current insight (first one) since we display it separately
        setInsightsHistory(result.insights.slice(1));
      } catch (error) {
        console.error('Failed to fetch insights history:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    };
    fetchHistory();
  }, [groupId, insights]);

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin text-4xl mb-4">🧠</div>
        <p className="enhanced-glass-body" style={{ color: '#7e4151' }}>
          Generating AI insights...
        </p>
        <p className="enhanced-glass-subtle text-sm mt-2" style={{ color: '#6a1f33' }}>
          This may take a moment as we analyze group dynamics
        </p>
      </div>
    );
  }

  if (!insights || insights.analysisStatus === 'none') {
    return (
      <div className="text-center py-8">
        <span className="text-5xl mb-4 block">🔮</span>
        <p className="enhanced-glass-body mb-4" style={{ color: '#7e4151' }}>
          No insights available yet
        </p>
        <p className="enhanced-glass-subtle text-sm mb-6" style={{ color: '#6a1f33' }}>
          Run an analysis to discover group dynamics, compatibility, and collective patterns
        </p>

        {/* Extra Context Input */}
        {isOwner && (
          <div className="mb-4 max-w-md mx-auto text-left">
            <button
              onClick={() => setShowContextInput(!showContextInput)}
              className="text-sm text-white/60 hover:text-white/80 transition-colors mb-2 flex items-center gap-1 mx-auto"
            >
              <span>{showContextInput ? '▾' : '▸'}</span>
              <span>Add context to guide analysis</span>
            </button>
            {showContextInput && (
              <div className="space-y-2">
                <textarea
                  value={userContext}
                  onChange={(e) => setUserContext(e.target.value.slice(0, 2000))}
                  placeholder="E.g., We've been working on improving communication this month... Focus on how our personality types complement each other..."
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white/90 placeholder-white/30 text-sm resize-none focus:outline-none focus:border-purple-400/50 transition-colors"
                  rows={3}
                  maxLength={2000}
                />
                <div className="flex justify-between text-xs text-white/40">
                  <span>Optional: Help Dina focus the analysis</span>
                  <span>{userContext.length}/2000</span>
                </div>
              </div>
            )}
          </div>
        )}

        <button onClick={handleRefreshWithContext} className="enhanced-action-button px-6 py-2">
          <span className="enhanced-glass-text" style={{ color: '#6a1f33' }}>
            Generate Insights
          </span>
        </button>
      </div>
    );
  }

  const { llmSynthesis, compatibility, patterns = [], conflicts = [] } = insights;

  return (
    <div className="space-y-6">
      {/* LLM Synthesis Section */}
      {llmSynthesis && (
        <div className="enhanced-glass-card border-l-4 border-purple-400">
          <div className="flex items-center justify-between mb-4">
            <h3 className="enhanced-glass-heading text-lg" style={{ color: '#784552' }}>
              {llmSynthesis.title || 'Group Intelligence Summary'}
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/50">Quality Score</span>
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${
                  llmSynthesis.qualityScore >= 0.8
                    ? 'bg-green-500/20 text-green-300'
                    : llmSynthesis.qualityScore >= 0.6
                      ? 'bg-yellow-500/20 text-yellow-300'
                      : 'bg-red-500/20 text-red-300'
                }`}
              >
                {Math.round(llmSynthesis.qualityScore * 100)}%
              </span>
            </div>
          </div>

          <p className="enhanced-glass-body mb-4" style={{ color: '#7e4151' }}>
            {llmSynthesis.overview}
          </p>

          {/* Key Insights */}
          {llmSynthesis.keyInsights?.length > 0 && (
            <div className="mb-4">
              <h4 className="enhanced-glass-text text-sm mb-2" style={{ color: '#6a1f33' }}>
                Key Insights
              </h4>
              <ul className="space-y-2">
                {llmSynthesis.keyInsights.map((insight, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-pink-400 mt-1">✦</span>
                    <span className="enhanced-glass-subtle text-sm" style={{ color: '#7e4151' }}>
                      {insight}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {llmSynthesis.recommendations?.length > 0 && (
            <div className="bg-white/5 rounded-lg p-4">
              <h4 className="enhanced-glass-text text-sm mb-2" style={{ color: '#6a1f33' }}>
                Recommendations
              </h4>
              <ul className="space-y-2">
                {llmSynthesis.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">→</span>
                    <span className="enhanced-glass-subtle text-sm" style={{ color: '#7e4151' }}>
                      {rec}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Narrative */}
          {llmSynthesis.narrative && (
            <div className="grid grid-cols-3 gap-4 mt-4">
              {llmSynthesis.narrative.strengths && (
                <div className="bg-green-500/10 rounded-lg p-3">
                  <h5 className="text-green-300 text-xs font-medium mb-1">Strengths</h5>
                  <p className="enhanced-glass-subtle text-xs" style={{ color: '#7e4151' }}>
                    {llmSynthesis.narrative.strengths}
                  </p>
                </div>
              )}
              {llmSynthesis.narrative.challenges && (
                <div className="bg-amber-500/10 rounded-lg p-3">
                  <h5 className="text-amber-300 text-xs font-medium mb-1">Challenges</h5>
                  <p className="enhanced-glass-subtle text-xs" style={{ color: '#7e4151' }}>
                    {llmSynthesis.narrative.challenges}
                  </p>
                </div>
              )}
              {llmSynthesis.narrative.opportunities && (
                <div className="bg-blue-500/10 rounded-lg p-3">
                  <h5 className="text-blue-300 text-xs font-medium mb-1">Opportunities</h5>
                  <p className="enhanced-glass-subtle text-xs" style={{ color: '#7e4151' }}>
                    {llmSynthesis.narrative.opportunities}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Compatibility Matrix */}
      {compatibility && compatibility.scores?.length > 0 && (
        <div className="enhanced-glass-card">
          <h3 className="enhanced-glass-heading text-lg mb-4" style={{ color: '#784552' }}>
            Compatibility Matrix
          </h3>

          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-pink-400">
                {Math.round(compatibility.statistics.averageScore * 100)}%
              </div>
              <div className="text-xs text-white/50">Average</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-400">
                {Math.round(compatibility.statistics.highestScore * 100)}%
              </div>
              <div className="text-xs text-white/50">Highest</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-amber-400">
                {Math.round(compatibility.statistics.lowestScore * 100)}%
              </div>
              <div className="text-xs text-white/50">Lowest</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-purple-400">
                {compatibility.statistics.totalPairs}
              </div>
              <div className="text-xs text-white/50">Pairs</div>
            </div>
          </div>

          {/* Top Pairs */}
          <div className="space-y-2">
            <h4 className="enhanced-glass-text text-sm" style={{ color: '#6a1f33' }}>
              Top Compatible Pairs
            </h4>
            {compatibility.scores
              .sort((a, b) => b.overallScore - a.overallScore)
              .slice(0, 5)
              .map((pair, i) => (
                <CompatibilityPair key={i} pair={pair} rank={i + 1} />
              ))}
          </div>
        </div>
      )}

      {/* Collective Patterns */}
      {patterns.length > 0 && (
        <div className="enhanced-glass-card">
          <h3 className="enhanced-glass-heading text-lg mb-4" style={{ color: '#784552' }}>
            Collective Patterns
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {patterns.map((pattern, i) => (
              <PatternCard key={i} pattern={pattern} />
            ))}
          </div>
        </div>
      )}

      {/* Conflict Risks */}
      {conflicts.length > 0 && (
        <div className="enhanced-glass-card">
          <h3 className="enhanced-glass-heading text-lg mb-4" style={{ color: '#784552' }}>
            Potential Friction Points
          </h3>
          <div className="space-y-3">
            {conflicts
              .sort((a, b) => {
                const order = { critical: 0, high: 1, medium: 2, low: 3 };
                return order[a.severity] - order[b.severity];
              })
              .map((conflict, i) => (
                <ConflictCard key={i} conflict={conflict} />
              ))}
          </div>
        </div>
      )}

      {/* Insights History */}
      <div className="enhanced-glass-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="enhanced-glass-heading text-lg" style={{ color: '#784552' }}>
            Insights History
          </h3>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="px-3 py-1 rounded-lg bg-white/10 text-white/70 text-sm hover:bg-white/20 transition-colors"
          >
            {showHistory ? 'Hide' : 'Show'} ({insightsHistory.length})
          </button>
        </div>

        {showHistory && (
          <div className="space-y-3">
            {isLoadingHistory ? (
              <div className="text-center py-4">
                <div className="animate-spin text-2xl mb-2">⏳</div>
                <p className="text-white/50 text-sm">Loading history...</p>
              </div>
            ) : insightsHistory.length === 0 ? (
              <p className="text-center text-white/50 py-4">No previous insights available</p>
            ) : (
              insightsHistory.map((historyInsight) => (
                <div
                  key={historyInsight.id}
                  className="bg-white/5 rounded-lg border border-white/10 overflow-hidden"
                >
                  <button
                    onClick={() =>
                      setExpandedHistoryId(
                        expandedHistoryId === historyInsight.id ? null : historyInsight.id
                      )
                    }
                    className="w-full p-3 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
                  >
                    <div>
                      <h4 className="enhanced-glass-text text-sm" style={{ color: '#7e4151' }}>
                        {historyInsight.title || 'Group Analysis'}
                      </h4>
                      <p className="text-white/50 text-xs mt-1">
                        {new Date(historyInsight.generatedAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {historyInsight.qualityScore && (
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            historyInsight.qualityScore >= 0.8
                              ? 'bg-green-500/20 text-green-300'
                              : historyInsight.qualityScore >= 0.6
                                ? 'bg-yellow-500/20 text-yellow-300'
                                : 'bg-red-500/20 text-red-300'
                          }`}
                        >
                          {Math.round(historyInsight.qualityScore * 100)}%
                        </span>
                      )}
                      <span className="text-white/50">
                        {expandedHistoryId === historyInsight.id ? '▲' : '▼'}
                      </span>
                    </div>
                  </button>

                  {expandedHistoryId === historyInsight.id && (
                    <div className="p-4 border-t border-white/10 space-y-3">
                      <p className="enhanced-glass-subtle text-sm" style={{ color: '#7e4151' }}>
                        {historyInsight.overview}
                      </p>

                      {historyInsight.keyInsights && historyInsight.keyInsights.length > 0 && (
                        <div>
                          <h5 className="text-white/60 text-xs mb-2">Key Insights</h5>
                          <ul className="space-y-1">
                            {historyInsight.keyInsights.map((insight, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-pink-400 text-xs mt-1">•</span>
                                <span className="text-white/70 text-xs">{insight}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {historyInsight.recommendations && historyInsight.recommendations.length > 0 && (
                        <div>
                          <h5 className="text-white/60 text-xs mb-2">Recommendations</h5>
                          <ul className="space-y-1">
                            {historyInsight.recommendations.map((rec, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-green-400 text-xs mt-1">→</span>
                                <span className="text-white/70 text-xs">{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Extra Context + Refresh Button */}
      <div className="space-y-4">
        {isOwner && (
          <div className="max-w-md mx-auto">
            <button
              onClick={() => setShowContextInput(!showContextInput)}
              className="text-sm text-white/60 hover:text-white/80 transition-colors mb-2 flex items-center gap-1 mx-auto"
            >
              <span>{showContextInput ? '▾' : '▸'}</span>
              <span>Add context for next analysis</span>
            </button>
            {showContextInput && (
              <div className="space-y-2">
                <textarea
                  value={userContext}
                  onChange={(e) => setUserContext(e.target.value.slice(0, 2000))}
                  placeholder="E.g., We recently had a conflict about project priorities... Focus on team dynamics and communication patterns..."
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white/90 placeholder-white/30 text-sm resize-none focus:outline-none focus:border-purple-400/50 transition-colors"
                  rows={3}
                  maxLength={2000}
                />
                <div className="flex justify-between text-xs text-white/40">
                  <span>Optional: Help Dina focus the analysis</span>
                  <span>{userContext.length}/2000</span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="text-center">
          <button onClick={handleRefreshWithContext} className="enhanced-action-button px-6 py-2">
            <span className="enhanced-glass-text" style={{ color: '#6a1f33' }}>
              Refresh Analysis
            </span>
          </button>
          <p className="enhanced-glass-subtle text-xs mt-2" style={{ color: '#6a1f33' }}>
            Last analyzed: {insights.lastAnalyzed ? new Date(insights.lastAnalyzed).toLocaleString() : 'Never'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function CompatibilityPair({ pair, rank }: { pair: CompatibilityScore; rank: number }) {
  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-400';
    if (score >= 0.6) return 'text-yellow-400';
    if (score >= 0.4) return 'text-orange-400';
    return 'text-red-400';
  };

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
      <span className="w-6 h-6 rounded-full bg-gradient-to-r from-pink-400/30 to-purple-400/30 flex items-center justify-center text-xs text-white/70">
        {rank}
      </span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="enhanced-glass-text text-sm" style={{ color: '#7e4151' }}>
            {pair.username1}
          </span>
          <span className="text-white/30">↔</span>
          <span className="enhanced-glass-text text-sm" style={{ color: '#7e4151' }}>
            {pair.username2}
          </span>
        </div>
      </div>
      <span className={`font-bold ${getScoreColor(pair.overallScore)}`}>
        {Math.round(pair.overallScore * 100)}%
      </span>
    </div>
  );
}

function PatternCard({ pattern }: { pattern: CollectivePattern }) {
  const typeConfig = {
    strength: { icon: '💪', bg: 'bg-green-500/10', border: 'border-green-500/30' },
    weakness: { icon: '⚠️', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
    opportunity: { icon: '🌟', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
    threat: { icon: '⚡', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  };

  const config = typeConfig[pattern.patternType];

  return (
    <div className={`p-3 rounded-lg ${config.bg} border ${config.border}`}>
      <div className="flex items-center gap-2 mb-2">
        <span>{config.icon}</span>
        <span className="enhanced-glass-text text-sm capitalize" style={{ color: '#784552' }}>
          {pattern.category}
        </span>
      </div>
      <p className="enhanced-glass-subtle text-xs mb-2" style={{ color: '#7e4151' }}>
        {pattern.description}
      </p>
      <div className="flex items-center justify-between text-xs text-white/50">
        <span>{Math.round(pattern.prevalence * 100)}% of members</span>
        <span>{Math.round(pattern.confidence * 100)}% confidence</span>
      </div>
    </div>
  );
}

function ConflictCard({ conflict }: { conflict: ConflictRisk }) {
  const severityConfig = {
    critical: { color: 'bg-red-500/20 border-red-500/50', text: 'text-red-300' },
    high: { color: 'bg-orange-500/20 border-orange-500/50', text: 'text-orange-300' },
    medium: { color: 'bg-yellow-500/20 border-yellow-500/50', text: 'text-yellow-300' },
    low: { color: 'bg-blue-500/20 border-blue-500/50', text: 'text-blue-300' },
  };

  const config = severityConfig[conflict.severity];

  return (
    <div className={`p-3 rounded-lg border ${config.color}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="enhanced-glass-text text-sm" style={{ color: '#7e4151' }}>
            {conflict.username1} ↔ {conflict.username2}
          </span>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded ${config.text} bg-white/10`}>
          {conflict.severity.toUpperCase()}
        </span>
      </div>
      <p className="enhanced-glass-subtle text-sm mb-2" style={{ color: '#7e4151' }}>
        {conflict.description}
      </p>
      {conflict.mitigationStrategies?.length > 0 && (
        <div className="bg-white/5 rounded p-2 mt-2">
          <p className="text-xs text-green-300 mb-1">Suggested:</p>
          <p className="enhanced-glass-subtle text-xs" style={{ color: '#7e4151' }}>
            {conflict.mitigationStrategies[0]}
          </p>
        </div>
      )}
    </div>
  );
}
