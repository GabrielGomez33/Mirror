// src/components/truthstream/ReviewQueue.tsx
// Display the review queue and allow starting a review

import { useEffect, useState, useCallback } from 'react';
import { useTruthStream } from '../../context/TruthStreamContext';

const COLORS = {
  heading: 'var(--dash-heading, #3d1428)',
  body: 'var(--dash-body, #4a1c30)',
  label: 'var(--mg-label, #2d0a16)',
};

// Refresh interval for expiry timers (60 seconds)
const EXPIRY_REFRESH_MS = 60_000;

function timeUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function isExpired(dateStr: string): boolean {
  return new Date(dateStr).getTime() <= Date.now();
}

export default function ReviewQueue() {
  const { queue, isLoading, isSubmitting, loadQueue, startQueueItem, setView } = useTruthStream();
  // Force re-render periodically to keep expiry timers accurate
  const [, setTick] = useState(0);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // Periodic refresh for expiry countdowns
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), EXPIRY_REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  const handleStartItem = useCallback((itemId: string, expiresAt: string) => {
    if (isExpired(expiresAt)) return; // Don't start expired items
    startQueueItem(itemId);
  }, [startQueueItem]);

  if (isLoading) {
    return (
      <div className="enhanced-glass-card text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-3" style={{ borderColor: COLORS.heading }} />
        <p className="text-sm" style={{ color: COLORS.body }}>Loading queue...</p>
      </div>
    );
  }

  if (!queue || queue.items.length === 0) {
    return (
      <div className="space-y-4">
        <div className="enhanced-glass-card text-center py-12">
          <span className="text-4xl block mb-4">📋</span>
          <h3 className="text-lg font-medium mb-2" style={{ color: COLORS.heading }}>No Reviews Available</h3>
          <p className="text-sm mb-4" style={{ color: COLORS.body }}>
            New profiles will be assigned to your queue periodically. Check back soon!
          </p>
          {queue?.nextBatchAvailableAt && (
            <p className="text-xs" style={{ color: COLORS.label }}>
              Next batch estimated: {new Date(queue.nextBatchAvailableAt).toLocaleDateString()}
            </p>
          )}
        </div>
        <button onClick={() => setView('overview')} className="enhanced-action-button w-full py-3">
          <span className="font-medium" style={{ color: COLORS.label }}>Back to Overview</span>
        </button>
      </div>
    );
  }

  const { items, batchNumber, completedCount, totalCount, canReceiveReviews } = queue;
  const pendingItems = items.filter((i) => i.status === 'pending' || i.status === 'in_progress');
  const completedItems = items.filter((i) => i.status === 'completed');
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
              onClick={() => setView('overview')}
              className="enhanced-action-button text-xs px-3 py-1"
              style={{ padding: '6px 12px', borderRadius: 10, border:'1px solid rgba(255, 255, 255, 0.15)', boxShadow:'1px 1px 1px 1px white' }}
            
            >
              <span className="enhanced-glass-subtle" style={{ fontSize:'0.85rem',fontWeight:'500' }}>{'\u2190'} Back to Overview</span>
            </button>

      {/* Batch Header */}
      <div className="enhanced-glass-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold" style={{ color: COLORS.heading }}>Review Queue</h2>
          <span className="text-xs px-3 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.08)', color: COLORS.label }}>
            Batch #{batchNumber}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm" style={{ color: COLORS.body }}>
          <span>{completedCount}/{totalCount} completed</span>
          <div
            className="flex-1 h-2 rounded-full"
            style={{ background: 'rgba(255,255,255,0.1)' }}
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Batch progress: ${completedCount} of ${totalCount} completed`}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${progressPercent}%`,
                background: 'linear-gradient(90deg, #f472b6, #a78bfa)',
              }}
            />
          </div>
        </div>
        {!canReceiveReviews && (
          <p className="text-xs mt-2" style={{ color: COLORS.label }}>
            Give at least 1 review to start receiving reviews.
          </p>
        )}
      </div>

      {/* Pending Items */}
      {pendingItems.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium px-1" style={{ color: COLORS.heading }}>Ready to Review</h3>
          {pendingItems.map((item) => {
            const expired = isExpired(item.expiresAt);
            return (
              <div key={item.id} className="enhanced-glass-card" style={{ opacity: expired ? 0.5 : 1 }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                      style={{ background: expired
                        ? 'rgba(239,68,68,0.2)'
                        : 'linear-gradient(135deg, rgba(244,114,182,0.2), rgba(167,139,250,0.2))'
                      }}
                    >
                      {expired ? '⏰' : '🎭'}
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: COLORS.heading }}>Anonymous Profile</p>
                      <p className="text-xs" style={{ color: expired ? '#ef4444' : COLORS.label }}>
                        {expired
                          ? 'Expired'
                          : `${item.status === 'in_progress' ? 'In progress' : 'Ready'} · Expires in ${timeUntil(item.expiresAt)}`
                        }
                      </p>
                    </div>
                  </div>
                  {!expired && item.truthCard?.feedbackAreas && (
                    <div className="hidden sm:flex gap-1 flex-wrap justify-end max-w-[160px]">
                      {item.truthCard.feedbackAreas.slice(0, 2).map((area) => (
                        <span
                          key={area}
                          className="text-[10px] px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(255,255,255,0.08)', color: COLORS.label }}
                        >
                          {area}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Truth Card preview snippet */}
                {!expired && item.truthCard?.selfStatement && (
                  <p className="text-xs mb-3 line-clamp-2 leading-relaxed" style={{ color: COLORS.body }}>
                    "{item.truthCard.selfStatement}"
                  </p>
                )}

                {expired ? (
                  <div className="text-center py-2">
                    <p className="text-xs" style={{ color: COLORS.label }}>This review has expired and can no longer be started.</p>
                  </div>
                ) : (
                  <button
                    onClick={() => handleStartItem(item.id, item.expiresAt)}
                    disabled={isSubmitting}
                    className="w-full enhanced-action-button py-2.5"
                    style={{ opacity: isSubmitting ? 0.6 : 1 }}
                  >
                    <span className="font-medium text-sm" style={{ color: COLORS.label }}>
                      {item.status === 'in_progress' ? 'Continue Review' : 'Start Review'}
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Completed Items */}
      {completedItems.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium px-1" style={{ color: COLORS.heading }}>Completed</h3>
          {completedItems.map((item) => (
            <div key={item.id} className="enhanced-glass-card" style={{ opacity: 0.6 }}>
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                  style={{ background: 'rgba(34,197,94,0.2)' }}
                >
                  ✓
                </div>
                <div>
                  <p className="text-sm" style={{ color: COLORS.body }}>Review completed</p>
                  <p className="text-xs" style={{ color: COLORS.label }}>
                    {item.timeSpentSeconds ? `${Math.round(item.timeSpentSeconds / 60)} min` : 'Done'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}