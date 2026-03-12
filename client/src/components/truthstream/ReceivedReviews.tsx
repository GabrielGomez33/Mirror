// src/components/truthstream/ReceivedReviews.tsx
// Display received anonymous reviews with helpful toggle and respond

import { useEffect, useState, useRef } from 'react';
import { useTruthStream } from '../../context/TruthStreamContext';
import type { AnonymousReview } from '../../types/truthstream';

const COLORS = {
  heading: '#3d1428',
  body: '#4a1c30',
  label: '#2d0a16',
};

const RESPONSE_MAX_LENGTH = 1000;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return 'just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function classificationBadge(c: string | null): { label: string; bg: string } {
  switch (c) {
    case 'constructive': return { label: 'Constructive', bg: 'rgba(59,130,246,0.2)' };
    case 'affirming': return { label: 'Affirming', bg: 'rgba(34,197,94,0.2)' };
    case 'raw_truth': return { label: 'Raw Truth', bg: 'rgba(251,191,36,0.2)' };
    case 'hostile': return { label: 'Hostile', bg: 'rgba(239,68,68,0.2)' };
    default: return { label: 'Pending', bg: 'rgba(255,255,255,0.08)' };
  }
}

function ReviewCard({ review }: { review: AnonymousReview }) {
  const { toggleHelpful, respondToReview, flagReview, isSubmitting } = useTruthStream();
  const [showRespond, setShowRespond] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const [showFlagConfirm, setShowFlagConfirm] = useState(false);
  const respondGuardRef = useRef(false);

  const badge = classificationBadge(review.classification);

  const handleRespond = async () => {
    if (!responseText.trim() || respondGuardRef.current) return;
    respondGuardRef.current = true;
    setIsResponding(true);
    try {
      const ok = await respondToReview(review.id, responseText.trim());
      if (ok) {
        setResponseText('');
        setShowRespond(false);
      }
    } finally {
      setIsResponding(false);
      respondGuardRef.current = false;
    }
  };

  const handleFlag = async () => {
    setShowFlagConfirm(false);
    await flagReview(review.id, 'Inappropriate content');
  };

  const charCount = responseText.length;
  const charWarning = charCount >= RESPONSE_MAX_LENGTH * 0.9;

  return (
    <div className="enhanced-glass-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: COLORS.heading }}>{review.reviewerLabel}</span>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full"
            style={{ background: badge.bg, color: COLORS.label }}
          >
            {badge.label}
          </span>
        </div>
        <span className="text-xs" style={{ color: COLORS.label }}>{timeAgo(review.createdAt)}</span>
      </div>

      {/* Scores summary row */}
      <div className="flex flex-wrap gap-2 mb-3">
        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: COLORS.body }}>
          Overall: {review.overallScore}/10
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: COLORS.body }}>
          1st Impression: {review.firstImpressionScore}/10
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: COLORS.body }}>
          Self-Align: {review.selfAlignmentScore}/10
        </span>
      </div>

      {/* Impression words */}
      {review.impressionWords.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {review.impressionWords.map((w) => (
            <span
              key={w}
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: 'linear-gradient(135deg, rgba(244,114,182,0.15), rgba(167,139,250,0.15))', color: COLORS.body }}
            >
              {w}
            </span>
          ))}
        </div>
      )}

      {/* First impression */}
      <p className="text-xs leading-relaxed mb-2" style={{ color: COLORS.body }}>
        {review.firstImpressionExplanation}
      </p>

      {/* Expandable detail */}
      {expanded && (
        <div className="space-y-2 mb-3 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-xs" style={{ color: COLORS.body }}>
            <strong style={{ color: COLORS.heading }}>Strength:</strong> {review.greatestStrengthCategory} — {review.greatestStrengthExplanation}
          </p>
          <p className="text-xs" style={{ color: COLORS.body }}>
            <strong style={{ color: COLORS.heading }}>Struggle:</strong> {review.struggleCategory} — {review.struggleExplanation}
          </p>
          <p className="text-xs" style={{ color: COLORS.body }}>
            <strong style={{ color: COLORS.heading }}>Advice:</strong> {review.advice}
          </p>
          {review.freeFormText && (
            <p className="text-xs italic" style={{ color: COLORS.body }}>
              "{review.freeFormText}"
            </p>
          )}
          <div className="flex gap-2 text-[10px]" style={{ color: COLORS.label }}>
            <span>Group: {review.wouldWantInGroup}</span>
            <span>·</span>
            <span>Tone: {review.reviewTone}</span>
            <span>·</span>
            <span>Quality: {review.qualityScore}%</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2" style={{ borderTop: expanded ? undefined : '1px solid rgba(255,255,255,0.08)' }}>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs"
          style={{ color: COLORS.label }}
          aria-expanded={expanded}
        >
          {expanded ? 'Show less' : 'Show full review'}
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => toggleHelpful(review.id, review.hasUserMarkedHelpful)}
            className="flex items-center gap-1 text-xs transition-opacity"
            style={{ color: review.hasUserMarkedHelpful ? '#f472b6' : COLORS.body }}
            aria-pressed={review.hasUserMarkedHelpful}
            aria-label={review.hasUserMarkedHelpful ? 'Unmark as helpful' : 'Mark as helpful'}
          >
            {review.hasUserMarkedHelpful ? '❤️' : '🤍'} {review.helpfulCount >= 0 ? review.helpfulCount : ''}
          </button>
          <button
            onClick={() => setShowRespond(!showRespond)}
            className="text-xs"
            style={{ color: COLORS.body }}
            aria-label="Respond to review"
          >
            💬 {review.responseCount > 0 ? review.responseCount : ''}
          </button>
          {!review.isFlagged && (
            <button
              onClick={() => setShowFlagConfirm(true)}
              className="text-xs"
              style={{ color: COLORS.label }}
              aria-label="Flag review"
            >
              🚩
            </button>
          )}
        </div>
      </div>

      {/* Flag Confirmation */}
      {showFlagConfirm && (
        <div
          className="mt-3 p-3 rounded-lg"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}
          role="alert"
        >
          <p className="text-xs mb-2" style={{ color: COLORS.body }}>
            Flag this review as inappropriate? This action will notify moderators.
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowFlagConfirm(false)}
              className="text-xs px-3 py-1 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.08)', color: COLORS.label }}
            >
              Cancel
            </button>
            <button
              onClick={handleFlag}
              className="text-xs px-3 py-1 rounded-lg"
              style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5' }}
            >
              Flag Review
            </button>
          </div>
        </div>
      )}

      {/* Respond */}
      {showRespond && (
        <div className="mt-3 space-y-2">
          <textarea
            value={responseText}
            onChange={(e) => setResponseText(e.target.value)}
            maxLength={RESPONSE_MAX_LENGTH}
            rows={2}
            placeholder="Write an anonymous response..."
            className="w-full rounded-lg p-2 text-xs resize-none"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: COLORS.body,
              outline: 'none',
            }}
            aria-label="Response text"
          />
          <div className="flex items-center justify-between">
            <span
              className="text-[10px]"
              style={{ color: charWarning ? '#f472b6' : COLORS.label }}
            >
              {charCount}/{RESPONSE_MAX_LENGTH}
            </span>
            <button
              onClick={handleRespond}
              disabled={!responseText.trim() || isResponding || isSubmitting}
              className="enhanced-action-button px-4 py-1.5 text-xs"
              style={{ opacity: responseText.trim() && !isResponding ? 1 : 0.5 }}
              aria-busy={isResponding}
            >
              <span className="font-medium" style={{ color: COLORS.label }}>
                {isResponding ? 'Sending...' : 'Send'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReceivedReviews() {
  const { receivedReviews, receivedHasMore, isLoading, isLoadingMore, loadReceivedReviews, setView } = useTruthStream();

  useEffect(() => {
    if (receivedReviews.length === 0) loadReceivedReviews();
  }, [receivedReviews.length, loadReceivedReviews]);

  return (
    <div className="space-y-4">
      <div className="enhanced-glass-card">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold" style={{ color: COLORS.heading }}>Reviews Received</h2>
          <button onClick={() => setView('overview')} className="text-xs px-3 py-1 rounded-lg" style={{ color: COLORS.label, background: 'rgba(255,255,255,0.08)' }}>
            Back
          </button>
        </div>
        <p className="text-xs mt-1" style={{ color: COLORS.body }}>
          {receivedReviews.length} review{receivedReviews.length !== 1 ? 's' : ''} — all anonymous
        </p>
      </div>

      {/* Loading state */}
      {isLoading && receivedReviews.length === 0 && (
        <div className="enhanced-glass-card text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-3" style={{ borderColor: COLORS.heading }} />
          <p className="text-sm" style={{ color: COLORS.body }}>Loading reviews...</p>
        </div>
      )}

      {/* Empty state */}
      {receivedReviews.length === 0 && !isLoading && (
        <div className="enhanced-glass-card text-center py-12">
          <span className="text-4xl block mb-4">🔍</span>
          <p className="text-sm" style={{ color: COLORS.body }}>No reviews yet. Complete your batch to start receiving feedback!</p>
        </div>
      )}

      {receivedReviews.map((review) => (
        <ReviewCard key={review.id} review={review} />
      ))}

      {receivedHasMore && (
        <button
          onClick={() => loadReceivedReviews(true)}
          disabled={isLoadingMore}
          className="w-full enhanced-action-button py-3"
          style={{ opacity: isLoadingMore ? 0.6 : 1 }}
          aria-busy={isLoadingMore}
        >
          <span className="font-medium" style={{ color: COLORS.label }}>
            {isLoadingMore ? 'Loading...' : 'Load More'}
          </span>
        </button>
      )}
    </div>
  );
}
