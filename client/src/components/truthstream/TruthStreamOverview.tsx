// src/components/truthstream/TruthStreamOverview.tsx
// Main TruthStream overview — stats, quick actions, profile status

import { useTruthStream } from '../../context/TruthStreamContext';
import { MILESTONE_DEFINITIONS } from '../../types/truthstream';

const COLORS = {
  heading: '#784552',
  body: '#7e4151',
  label: '#6a1f33',
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
  const { profile, stats, queue, milestones, analysis, isLoading, setView, refreshAll, successMessage } = useTruthStream();

  const pendingCount = queue?.items.filter((i) => i.status === 'pending' || i.status === 'in_progress').length || 0;

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
            {/* Queue */}
            <ActionButton
              icon="📋"
              label="Review Queue"
              description={pendingCount > 0 ? `${pendingCount} profile${pendingCount > 1 ? 's' : ''} waiting for review` : 'No reviews pending'}
              badge={pendingCount > 0 ? String(pendingCount) : undefined}
              onClick={() => setView('queue')}
            />

            {/* Received */}
            <ActionButton
              icon="📥"
              label="Reviews Received"
              description="See what others think about you (anonymous)"
              badge={stats?.totalReviewsReceived ? String(stats.totalReviewsReceived) : undefined}
              onClick={() => setView('received')}
            />

            {/* Analysis */}
            <ActionButton
              icon="🔮"
              label="Truth Mirror Report"
              description={analysis ? 'View your latest analysis' : 'Generate your perception gap analysis'}
              onClick={() => setView('analysis')}
            />

            {/* Edit Profile */}
            <ActionButton
              icon="✏️"
              label="Edit Truth Card"
              description="Update your self-statement and feedback areas"
              onClick={() => setView('profile-setup')}
            />
          </div>

          {/* Profile Summary */}
          <div className="enhanced-glass-card">
            <h3 className="text-sm font-medium mb-2" style={{ color: COLORS.heading }}>Your Truth Card</h3>
            <p className="text-xs leading-relaxed mb-3" style={{ color: COLORS.body }}>
              "{profile.selfStatement}"
            </p>
            <div className="flex flex-wrap gap-1">
              {profile.feedbackAreas.map((area) => (
                <span
                  key={area}
                  className="text-[10px] px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.08)', color: COLORS.label }}
                >
                  {area}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2 text-[10px]" style={{ color: COLORS.label }}>
              <span>{profile.sharedDataTypes.length} data types shared</span>
              <span>·</span>
              <span>{profile.profileCompleteness}% complete</span>
              <span>·</span>
              <span>{profile.isActive ? 'Active' : 'Inactive'}</span>
            </div>
          </div>

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
