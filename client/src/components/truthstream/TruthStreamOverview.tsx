// src/components/truthstream/TruthStreamOverview.tsx
// Main TruthStream overview — stats, quick actions, profile status
// Security: All shared data is gated by profile.sharedDataTypes — only opted-in data is displayed.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTruthStream } from '../../context/TruthStreamContext';
import { getTruthCard } from '../../services/truthStreamApi';
import { getPersonalIntelligenceApi } from '../../services/mirrorDashboard';
import { MILESTONE_DEFINITIONS, type TruthCardData, type TruthStreamShareableType } from '../../types/truthstream';
import { buildStorageRetrieveUrl } from '../../utils/storageUrl';

const SHAREABLE_ICONS: Record<string, { label: string; icon: string }> = {
  personality: { label: 'Personality Profile', icon: '🧠' },
  cognitive: { label: 'Cognitive Style', icon: '💡' },
  facial: { label: 'Photo / Facial', icon: '📸' },
  voice: { label: 'Voice Signature', icon: '🎙' },
  astrological: { label: 'Astrological', icon: '✨' },
};

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

/**
 * Safely build a storage URL from a filename returned by the storage API.
 * Delegates to shared utility that uses the correct /retrieve/:userId/:tier/:filename endpoint.
 */
function buildStorageUrl(path: string, userId: number, tier?: 'tier1' | 'tier2' | 'tier3'): string | null {
  return buildStorageRetrieveUrl(path, userId, tier);
}

export default function TruthStreamOverview() {
  const { user } = useAuth();
  const { profile, stats, queue, milestones, analysis, isLoading, setView, refreshAll, successMessage } = useTruthStream();

  const pendingCount = queue?.items.filter((i) => i.status === 'pending' || i.status === 'in_progress').length || 0;

  // Fetch enriched card data for the "Your Truth Card" preview
  const [cardData, setCardData] = useState<TruthCardData | null>(null);
  const [cardLoading, setCardLoading] = useState(false);

  // Astro data from dashboard — only displayed if 'astrological' is in sharedDataTypes
  const [astroData, setAstroData] = useState<any>(null);

  // AbortController ref for cancelling in-flight fetches on unmount/profile change
  const fetchAbortRef = useRef<AbortController | null>(null);

  const fetchCardData = useCallback(async () => {
    if (!user?.id) return;

    // Cancel any in-flight card fetch
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    setCardLoading(true);
    try {
      const res = await getTruthCard(user.id);
      if (!controller.signal.aborted && res.data) {
        setCardData(res.data);
      }
    } catch (err: any) {
      if (!controller.signal.aborted) {
        console.error('[TruthStreamOverview] Card fetch failed:', err?.message || err);
      }
    }
    if (!controller.signal.aborted) setCardLoading(false);
  }, [user?.id]);

  const fetchAstroData = useCallback(async () => {
    try {
      const dashData = await getPersonalIntelligenceApi();
      if (dashData?.completeAstrologicalData?.available) {
        setAstroData(dashData.completeAstrologicalData);
      }
    } catch (err: any) {
      console.error('[TruthStreamOverview] Astro fetch failed:', err?.message || err);
    }
  }, []);

  // Fetch card data whenever profile changes (creation, update, return to overview)
  useEffect(() => {
    if (profile) {
      fetchCardData();
      if (!astroData) fetchAstroData();
    }
    return () => { fetchAbortRef.current?.abort(); };
  }, [profile, fetchCardData, fetchAstroData, astroData]);

  // === DATA GATING ===
  // Photo is only shown to reviewers if 'facial' is in sharedDataTypes.
  // This is self-view, so we show it if the user has a photo (for their own reference),
  // but the "as reviewers see it" section should reflect what reviewers actually get.
  const sharedTypes = profile?.sharedDataTypes || [];
  const facialShared = sharedTypes.includes('facial');
  const voiceShared = sharedTypes.includes('voice');

  // Resolve photo URL — only show in reviewer preview if facial is shared
  const photoPath = cardData?.photoPath || profile?.photoPath;
  const photoUrl = (photoPath && facialShared && user?.id) ? buildStorageUrl(photoPath, user.id, 'tier1') : null;

  // Resolve voice URL — only show if voice is shared
  const voicePath = cardData?.vocalSalutationPath || profile?.vocalSalutationPath;
  const voiceUrl = (voicePath && voiceShared && user?.id) ? buildStorageUrl(voicePath, user.id, 'tier2') : null;

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

          {/* Your Truth Card — Full Reviewer Preview */}
          <div className="enhanced-glass-card space-y-4">
            <div className="flex items-center justify-between">
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

            {/* Identity header — photo gated by 'facial' in sharedDataTypes */}
            <div className="flex items-center gap-4">
              <div
                className="rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
                style={{
                  width: 64, height: 64, minWidth: 64, minHeight: 64,
                  background: photoUrl
                    ? 'none'
                    : 'linear-gradient(135deg, rgba(244,114,182,0.25), rgba(167,139,250,0.25))',
                  border: '2px solid rgba(244,114,182,0.3)',
                }}
              >
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt="Profile"
                    style={{ width: 64, height: 64, objectFit: 'cover', display: 'block' }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <span className="text-2xl">🎭</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-semibold" style={{ color: COLORS.heading }}>
                  {profile.displayAlias}
                </p>
                {profile.ageRange && (
                  <p className="text-xs" style={{ color: COLORS.body }}>Age: {profile.ageRange}</p>
                )}
                <div className="flex items-center gap-3 mt-1 text-[10px]" style={{ color: COLORS.label }}>
                  <span>{profile.totalReviewsReceived} reviews received</span>
                  <span>·</span>
                  <span>{profile.totalReviewsGiven} given</span>
                  {profile.perceptionGapScore != null && (
                    <>
                      <span>·</span>
                      <span>Gap: {Math.round(profile.perceptionGapScore)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Voice Greeting Player — gated by 'voice' in sharedDataTypes */}
            {voiceUrl && (
              <VoicePlayer url={voiceUrl} />
            )}

            {/* Self Statement */}
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: COLORS.label }}>
                How they see themselves
              </p>
              <p className="text-sm leading-relaxed" style={{ color: COLORS.body }}>
                &ldquo;{profile.selfStatement}&rdquo;
              </p>
            </div>

            {/* Feedback Areas */}
            {profile.feedbackAreas.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: COLORS.label }}>
                  Wants feedback on
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.feedbackAreas.map((area) => (
                    <span
                      key={area}
                      className="text-xs px-2.5 py-1 rounded-full font-medium"
                      style={{ background: 'rgba(244,114,182,0.15)', border: '1px solid rgba(244,114,182,0.3)', color: COLORS.heading }}
                    >
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Shared Assessment Data — only iterates over opted-in types */}
            {sharedTypes.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: COLORS.label }}>
                  Shared Assessment Data
                </p>
                <div className="space-y-2">
                  {sharedTypes.map((type) => {
                    const meta = SHAREABLE_ICONS[type];
                    const shared = cardData?.sharedData;
                    return (
                      <div
                        key={type}
                        className="rounded-lg p-3"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span>{meta?.icon}</span>
                          <span className="text-xs font-medium" style={{ color: COLORS.heading }}>{meta?.label}</span>
                        </div>
                        <OverviewSharedSnippet type={type} shared={shared} astroData={astroData} loading={cardLoading} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between text-[10px] pt-2" style={{ color: COLORS.label, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <span>Profile completeness: {profile.profileCompleteness}%</span>
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

function VoicePlayer({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioError, setAudioError] = useState(false);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audioError) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play().catch((err) => {
        console.error('[VoicePlayer] Playback failed:', err?.message || err);
        setAudioError(true);
      });
    }
  }, [playing, audioError]);

  const formatTime = (s: number) => {
    if (!isFinite(s) || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (audioError) {
    return (
      <div className="rounded-xl p-3 text-xs" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: COLORS.label }}>
        Voice greeting unavailable
      </div>
    );
  }

  return (
    <div className="rounded-xl p-3 flex items-center gap-3"
      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = (e.target as HTMLAudioElement).duration;
          if (isFinite(d)) setDuration(d);
        }}
        onTimeUpdate={(e) => setCurrentTime((e.target as HTMLAudioElement).currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrentTime(0); }}
        onError={() => setAudioError(true)}
      />
      <button onClick={toggle}
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, rgba(244,114,182,0.2), rgba(167,139,250,0.2))', border: '1px solid rgba(244,114,182,0.3)' }}>
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: COLORS.heading }}>
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: COLORS.heading }}>
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: COLORS.label }}>
          Voice Greeting
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <div className="h-full rounded-full transition-all"
              style={{
                width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%',
                background: 'linear-gradient(90deg, #f472b6, #a78bfa)',
              }} />
          </div>
          <span className="text-[10px] flex-shrink-0" style={{ color: COLORS.label }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}

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

/**
 * Renders a snippet of shared assessment data.
 * Only called for types that ARE in profile.sharedDataTypes (gated by caller).
 * Astrological fallback only uses dashboard data when 'astrological' is in shared types.
 */
function OverviewSharedSnippet({ type, shared, astroData, loading }: {
  type: TruthStreamShareableType;
  shared: TruthCardData['sharedData'] | undefined;
  astroData: any;
  loading: boolean;
}) {
  if (loading) return <p className="text-[10px]" style={{ color: COLORS.label }}>Loading...</p>;
  if (!shared && type !== 'astrological') return <p className="text-[10px] italic" style={{ color: COLORS.label }}>Data not yet available</p>;

  switch (type) {
    case 'personality':
      if (!shared?.personality) return <SnippetPlaceholder />;
      return (
        <div className="text-xs" style={{ color: COLORS.body }}>
          <p><strong>{shared.personality.mbtiType}</strong> — {shared.personality.description}</p>
          {shared.personality.dominantTraits?.length > 0 && (
            <p className="mt-0.5">Traits: {shared.personality.dominantTraits.join(', ')}</p>
          )}
        </div>
      );
    case 'cognitive':
      if (!shared?.cognitive) return <SnippetPlaceholder />;
      return (
        <div className="text-xs" style={{ color: COLORS.body }}>
          <p>Category: {shared.cognitive.category}</p>
          {shared.cognitive.strengths?.length > 0 && (
            <p className="mt-0.5">Strengths: {shared.cognitive.strengths.join(', ')}</p>
          )}
        </div>
      );
    case 'facial':
      if (!shared?.facial) return <SnippetPlaceholder />;
      return (
        <p className="text-xs" style={{ color: COLORS.body }}>Dominant expression: {shared.facial.dominantExpression}</p>
      );
    case 'voice':
      if (!shared?.voice) return <SnippetPlaceholder />;
      return (
        <p className="text-xs" style={{ color: COLORS.body }}>Voice sample: {shared.voice.duration}s recorded</p>
      );
    case 'astrological': {
      // This case is ONLY reached when 'astrological' is in sharedDataTypes (gated by caller).
      // Try card shared data first, fall back to dashboard data.
      const cardAstro = shared?.astrological;
      const western = cardAstro?.westernSign || astroData?.western?.sunSign;
      const chinese = cardAstro?.chineseSign || astroData?.chinese?.animalSign;
      const synthesis = cardAstro?.synthesis || astroData?.synthesis?.lifeDirection;

      if (!western && !chinese) return <SnippetPlaceholder />;
      return (
        <div className="text-xs space-y-0.5" style={{ color: COLORS.body }}>
          <p>
            {western && <>Sun Sign: {western}</>}
            {western && chinese && ' · '}
            {chinese && <>Chinese Zodiac: {chinese}</>}
          </p>
          {synthesis && <p className="mt-0.5">{synthesis}</p>}
        </div>
      );
    }
    default:
      return <SnippetPlaceholder />;
  }
}

function SnippetPlaceholder() {
  return <p className="text-[10px] italic" style={{ color: COLORS.label }}>Assessment not yet completed</p>;
}
