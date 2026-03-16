// src/components/truthstream/TruthStreamOverview.tsx
// Main TruthStream overview — stats, quick actions, profile status
// Security: All shared data is gated by profile.sharedDataTypes — only opted-in data is displayed.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTruthStream } from '../../context/TruthStreamContext';
import { getPersonalIntelligenceApi } from '../../services/mirrorDashboard';
import { MILESTONE_DEFINITIONS, type TruthCardData, type TruthCardSharedData } from '../../types/truthstream';
import RevieweeTruthCard from './RevieweeTruthCard';

const COLORS = {
  heading: '#3d1428',
  body: '#4a1c30',
  label: '#2d0a16',
};

const MILESTONE_ICON_MAP: Record<string, string> = {
  compass: '🧭',
  eye: '👁',
  'trending-up': '📈',
  star: '⭐',
  award: '🏅',
  search: '🔍',
  users: '👥',
  shield: '🛡',
  heart: '❤️',
  zap: '⚡',
  target: '🎯',
};

export default function TruthStreamOverview() {
  const { user } = useAuth();
  const { profile, stats, queue, milestones, analysis, isLoading, setView, refreshAll, successMessage } = useTruthStream();

  const pendingCount = queue?.items.filter((i) => i.status === 'pending' || i.status === 'in_progress').length || 0;

  // Dashboard data for building a self-view Truth Card (getTruthCard fails for self)
  const [dashData, setDashData] = useState<any>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [truthCardCollapsed, setTruthCardCollapsed] = useState(false);
  const fetchAbortRef = useRef<AbortController | null>(null);

  const fetchDashData = useCallback(async () => {
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    setCardLoading(true);
    try {
      const data = await getPersonalIntelligenceApi();
      if (!controller.signal.aborted) setDashData(data);
    } catch (err: any) {
      if (!controller.signal.aborted) {
        console.error('[TruthStreamOverview] Dashboard fetch failed:', err?.message || err);
      }
    }
    if (!controller.signal.aborted) setCardLoading(false);
  }, []);

  useEffect(() => {
    if (profile && !dashData) fetchDashData();
    return () => { fetchAbortRef.current?.abort(); };
  }, [profile, fetchDashData, dashData]);

  // Build TruthCardData from profile + dashboard data for self-view preview
  const selfTruthCard: TruthCardData | null = (() => {
    if (!profile) return null;
    const sharedTypes = profile.sharedDataTypes || [];
    const sharedData: TruthCardSharedData = {};

    // Only include data types the user opted to share (mirrors reviewer view)
    if (sharedTypes.includes('personality') && dashData?.personalityResult) {
      sharedData.personality = {
        mbtiType: dashData.personalityResult.mbtiType || '',
        dominantTraits: dashData.personalityResult.dominantTraits || [],
        description: dashData.personalityResult.description || '',
        big5: dashData.personalityResult.big5Profile,
      };
    }
    if (sharedTypes.includes('cognitive') && dashData?.iqResults) {
      sharedData.cognitive = {
        category: dashData.iqResults.category || '',
        strengths: dashData.iqResults.strengths || [],
      };
    }
    if (sharedTypes.includes('facial') && dashData?.facialExpression) {
      sharedData.facial = {
        dominantExpression: dashData.facialExpression.dominantExpression || '',
        expressionProfile: dashData.facialExpression.expressionProfile,
      };
    }
    if (sharedTypes.includes('voice')) {
      sharedData.voice = { duration: 0 }; // Duration not available from dashboard
    }
    if (sharedTypes.includes('astrological') && dashData?.completeAstrologicalData) {
      const astro = dashData.completeAstrologicalData;
      sharedData.astrological = {
        westernSign: astro.western?.sunSign || '',
        chineseSign: astro.chinese?.animalSign || '',
        synthesis: astro.synthesis?.lifeDirection || '',
        western: astro.western || null,
        chinese: astro.chinese || null,
        african: astro.african || null,
        numerology: astro.numerology || null,
        synthesisData: astro.synthesis || null,
      };
    }

    return {
      displayAlias: profile.displayAlias,
      ageRange: profile.ageRange,
      photoPath: sharedTypes.includes('facial') ? profile.photoPath : undefined,
      vocalSalutationPath: sharedTypes.includes('voice') ? profile.vocalSalutationPath : undefined,
      selfStatement: profile.selfStatement,
      feedbackAreas: profile.feedbackAreas,
      goal: profile.goal,
      goalCategory: profile.goalCategory,
      sharedData: sharedData,
    };
  })();

  return (
    <div className="space-y-6">
      {/* Success toast */}
      {successMessage && (
        <div
          className="rounded-lg p-3 text-sm"
          style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#86efac' }}
          role="alert"
        >
          {successMessage}
        </div>
      )}

      {/* Header */}
      <div className="enhanced-glass-card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold" style={{ color: COLORS.heading }}>TruthStream</h2>
            <p className="text-sm mt-1" style={{ color: COLORS.body }}>Anonymous peer feedback for self-awareness</p>
          </div>
          <button
            onClick={refreshAll}
            disabled={isLoading}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-transform"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            <span className={`text-lg ${isLoading ? 'animate-spin' : ''}`}>🔄</span>
          </button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && !profile && (
        <div className="enhanced-glass-card text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-3" style={{ borderColor: COLORS.heading }} />
          <p className="text-sm" style={{ color: COLORS.body }}>Loading your TruthStream data...</p>
        </div>
      )}

      {/* No Profile — Setup CTA */}
      {!profile && !isLoading && (
        <div className="enhanced-glass-card text-center py-8">
          <span className="text-4xl block mb-4">🎭</span>
          <h3 className="text-lg font-medium mb-2" style={{ color: COLORS.heading }}>Create Your Truth Card</h3>
          <p className="text-sm mb-4" style={{ color: COLORS.body }}>
            Share your self-perception and choose what data reviewers can see.
            Then you'll receive honest, anonymous feedback from peers.
          </p>
          <button onClick={() => setView('profile-setup')} className="enhanced-action-button px-8 py-3">
            <span className="font-medium" style={{ color: COLORS.label }}>Get Started</span>
          </button>
        </div>
      )}

      {/* Has Profile — Stats + Actions */}
      {profile && (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Reviews Received" value={stats?.totalReviewsReceived ?? 0} icon="📥" />
            <StatCard label="Reviews Given" value={stats?.totalReviewsGiven ?? 0} icon="📤" />
            <StatCard
              label="Perception Gap"
              value={stats?.perceptionGapScore != null ? `${Math.round(stats.perceptionGapScore)}` : '—'}
              icon="🔮"
            />
            <StatCard label="Milestones" value={milestones.length} icon="🏆" />
          </div>

          {/* Quick Actions */}
          <div className="space-y-3">
            <ActionButton
              icon="📋"
              label="Review Queue"
              description={pendingCount > 0 ? `${pendingCount} profile${pendingCount > 1 ? 's' : ''} waiting for review` : 'No reviews pending'}
              badge={pendingCount > 0 ? String(pendingCount) : undefined}
              onClick={() => setView('queue')}
            />
            <ActionButton
              icon="📥"
              label="Reviews Received"
              description="See what others think about you (anonymous)"
              badge={stats?.totalReviewsReceived ? String(stats.totalReviewsReceived) : undefined}
              onClick={() => setView('received')}
            />
            <ActionButton
              icon="🔮"
              label="Truth Mirror Report"
              description={analysis ? 'View your latest analysis' : 'Generate your perception gap analysis'}
              onClick={() => setView('analysis')}
            />
            <ActionButton
              icon="✏️"
              label="Edit Truth Card"
              description="Update your self-statement, shared data, photo, and voice"
              onClick={() => setView('profile-setup')}
            />
          </div>

          {/* Your Truth Card — Reuses RevieweeTruthCard for consistent display */}
          {cardLoading && !selfTruthCard && (
            <div className="enhanced-glass-card text-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-pink-400/20 border-t-pink-400 mx-auto mb-2" />
              <p className="text-xs" style={{ color: COLORS.label }}>Loading your Truth Card preview...</p>
            </div>
          )}
          {selfTruthCard && user?.id && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(244,114,182,0.2)', color: COLORS.heading }}>
                    Your Truth Card
                  </span>
                  <span className="text-[10px]" style={{ color: COLORS.label }}>as reviewers see it</span>
                </div>
                <button
                  onClick={() => setView('profile-setup')}
                  className="text-[10px] px-2 py-0.5 rounded-lg"
                  style={{ color: COLORS.label, background: 'rgba(255,255,255,0.08)' }}
                >
                  Edit
                </button>
              </div>
              <RevieweeTruthCard
                truthCard={selfTruthCard}
                revieweeUserId={user.id}
                isCollapsed={truthCardCollapsed}
                onToggleCollapse={() => setTruthCardCollapsed(prev => !prev)}
              />
            </div>
          )}

          {/* Milestones */}
          {milestones.length > 0 && (
            <div className="enhanced-glass-card">
              <h3 className="text-sm font-medium mb-3" style={{ color: COLORS.heading }}>Milestones Earned</h3>
              <div className="space-y-2">
                {milestones.map((m) => {
                  const def = MILESTONE_DEFINITIONS[m.milestoneType];
                  return (
                    <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <span className="text-lg">{(def?.icon && MILESTONE_ICON_MAP[def.icon]) || '🏆'}</span>
                      <div>
                        <p className="text-xs font-medium" style={{ color: COLORS.heading }}>{m.milestoneName}</p>
                        <p className="text-[10px]" style={{ color: COLORS.label }}>
                          {m.milestoneDescription} · {new Date(m.achievedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="enhanced-glass-card text-center py-4">
      <span className="text-xl block mb-1">{icon}</span>
      <div className="text-xl font-bold" style={{ color: COLORS.heading }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider" style={{ color: COLORS.label }}>{label}</div>
    </div>
  );
}

function ActionButton({
  icon, label, description, badge, onClick,
}: {
  icon: string; label: string; description: string; badge?: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full enhanced-glass-card flex items-center gap-3 text-left transition-all hover:scale-[1.01]"
      style={{ cursor: 'pointer' }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, rgba(244,114,182,0.15), rgba(167,139,250,0.15))' }}
      >
        <span className="text-lg">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: COLORS.heading }}>{label}</p>
        <p className="text-xs truncate" style={{ color: COLORS.body }}>{description}</p>
      </div>
      {badge && (
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #f472b6, #a78bfa)', color: 'white' }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
