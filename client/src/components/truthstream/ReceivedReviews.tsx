// src/components/truthstream/ReceivedReviews.tsx
// Display received anonymous reviews — glass morphism aesthetic matching AnalysisDashboard
// Handles dynamic questionnaire-based responses (Record<sectionId, Record<questionId, value>>)

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTruthStream } from '../../context/TruthStreamContext';
import { onWebSocketEvent } from '../../services/groupsWebSocket';
import type { ReviewResponse } from '../../types/truthstream';

// ============================================================================
// COLOR PALETTE — matches AnalysisDashboard / VisualStep expression colors
// ============================================================================
const CLASSIFICATION_COLORS: Record<string, { color: string; glow: string; label: string }> = {
  constructive:  { color: '#60a5fa', glow: 'rgba(96,165,250,0.35)',  label: 'Constructive' },
  affirming:     { color: '#4ade80', glow: 'rgba(74,222,128,0.35)',  label: 'Affirming' },
  raw_truth:     { color: '#facc15', glow: 'rgba(250,204,21,0.35)',  label: 'Raw Truth' },
  hostile:       { color: '#f87171', glow: 'rgba(248,113,113,0.35)', label: 'Hostile' },
};
const FALLBACK_SECTION_COLORS = [
  { color: '#f472b6', glow: 'rgba(244,114,182,0.35)' },
  { color: '#a78bfa', glow: 'rgba(167,139,250,0.35)' },
  { color: '#60a5fa', glow: 'rgba(96,165,250,0.35)' },
  { color: '#4ade80', glow: 'rgba(74,222,128,0.35)' },
  { color: '#facc15', glow: 'rgba(250,204,21,0.35)' },
  { color: '#fb923c', glow: 'rgba(251,146,60,0.35)' },
  { color: '#2dd4bf', glow: 'rgba(45,212,191,0.35)' },
  { color: '#818cf8', glow: 'rgba(129,140,248,0.35)' },
];

// ============================================================================
// HELPERS
// ============================================================================

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

function classificationMeta(c: string | null) {
  return CLASSIFICATION_COLORS[c || ''] || { color: '#94a3b8', glow: 'rgba(148,163,184,0.35)', label: 'Pending' };
}

/** Pretty-print a camelCase or snake_case key into a readable label */
function humanize(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (s) => s.toUpperCase());
}

/** Check if a value is a numeric score (1-10 range) */
function isScore(v: unknown): v is number {
  return typeof v === 'number' && v >= 0 && v <= 10;
}

// ============================================================================
// SVG SCORE RING (from AnalysisDashboard)
// ============================================================================
const ScoreRing: React.FC<{
  score: number; maxScore?: number; size?: number; strokeWidth?: number; color: string; glow: string;
}> = ({ score, maxScore = 10, size = 48, strokeWidth = 3.5, color, glow }) => {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = maxScore > 0 ? score / maxScore : 0;
  const offset = circumference - pct * circumference;

  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }}
          style={{ filter: `drop-shadow(0 0 4px ${glow})` }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="enhanced-glass-heading" style={{ fontSize: size * 0.3, color, margin: 0 }}>
          {typeof score === 'number' ? score.toFixed(1) : score}
        </span>
      </div>
    </div>
  );
};

// ============================================================================
// ANIMATED BAR (from AnalysisDashboard)
// ============================================================================
const AnimatedBar: React.FC<{
  label: string; value: number; maxValue: number; color: string; glow: string; index: number;
}> = ({ label, value, maxValue, color, glow, index }) => {
  const pct = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
    >
      <span className="enhanced-glass-subtle" style={{ fontSize: 11, width: 90, textAlign: 'right', flexShrink: 0, margin: 0 }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(pct, 2)}%` }}
          transition={{ delay: 0.1 + index * 0.04, duration: 0.5, ease: 'easeOut' }}
          style={{
            height: '100%', borderRadius: 3,
            background: `linear-gradient(90deg, ${color}99, ${color})`,
            boxShadow: pct > 5 ? `0 0 6px ${glow}, 0 0 2px ${color}` : 'none',
          }}
        />
      </div>
      <span className="enhanced-glass-text" style={{ fontSize: 11, fontWeight: 600, width: 32, textAlign: 'right', flexShrink: 0, margin: 0, fontFamily: 'monospace' }}>
        {value.toFixed(1)}
      </span>
    </motion.div>
  );
};

// ============================================================================
// DIALOGUE THREAD — inline anonymous chat (reviewee perspective)
// ============================================================================
const MESSAGE_MAX_LENGTH = 1000;
const MESSAGE_MIN_LENGTH = 5;
const SEEN_COUNTS_KEY = 'ts_dialogue_seen_counts';

// [P2] Cache localStorage reads in memory to avoid repeated parse on every component mount.
// Writes are debounced to reduce I/O when multiple reviews update rapidly.
let _seenCountsCache: Record<string, number> | null = null;
let _seenCountsWriteTimer: ReturnType<typeof setTimeout> | null = null;

/** Read per-review last-seen response counts (cached in memory) */
function getSeenCounts(): Record<string, number> {
  if (_seenCountsCache) return _seenCountsCache;
  try {
    const raw = localStorage.getItem(SEEN_COUNTS_KEY);
    _seenCountsCache = raw ? JSON.parse(raw) : {};
  } catch {
    _seenCountsCache = {};
  }
  return _seenCountsCache!;
}

/** Persist last-seen response count for a review (debounced write) */
function markResponseCountSeen(reviewId: string, count: number): void {
  const counts = getSeenCounts();
  counts[reviewId] = count;
  // Debounce writes — batch rapid updates into a single localStorage write
  if (_seenCountsWriteTimer) clearTimeout(_seenCountsWriteTimer);
  _seenCountsWriteTimer = setTimeout(() => {
    try {
      localStorage.setItem(SEEN_COUNTS_KEY, JSON.stringify(_seenCountsCache));
    } catch { /* non-critical */ }
    _seenCountsWriteTimer = null;
  }, 500);
}

function DialogueThread({ reviewId, responseCount }: { reviewId: string; responseCount: number }) {
  const { loadDialogue, respondToReview, isSubmitting, focusReviewId, setFocusReview } = useTruthStream();
  const [messages, setMessages] = useState<ReviewResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sendGuardRef = useRef(false);
  const threadRef = useRef<HTMLDivElement>(null);

  // Auto-open when this review is the focused review from a notification deep-link
  useEffect(() => {
    if (focusReviewId === reviewId) {
      setIsOpen(true);
      // Scroll the review card into view
      setTimeout(() => {
        threadRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
      // Clear the focus so it doesn't re-trigger
      setFocusReview(null);
    }
  }, [focusReviewId, reviewId, setFocusReview]);

  // Unread badge: compare current responseCount to last-seen count
  const seenCount = getSeenCounts()[reviewId] ?? 0;
  const hasUnread = responseCount > seenCount;

  const fetchMessages = useCallback(async () => {
    setIsLoading(true);
    try {
      const msgs = await loadDialogue(reviewId);
      setMessages(msgs);
    } finally {
      setIsLoading(false);
    }
  }, [reviewId, loadDialogue]);

  // Mark as seen when thread is opened
  useEffect(() => {
    if (isOpen && responseCount > 0) {
      markResponseCountSeen(reviewId, responseCount);
    }
  }, [isOpen, reviewId, responseCount]);

  useEffect(() => {
    if (isOpen && messages.length === 0) fetchMessages();
  }, [isOpen, messages.length, fetchMessages]);

  // Auto-refresh when a dialogue message WebSocket event fires
  useEffect(() => {
    if (!isOpen) return;
    const unsub = onWebSocketEvent('ts:dialogue_message' as any, (data: any) => {
      // Refresh if the event is for this review or no reviewId filter (refresh all open threads)
      if (!data?.metadata?.reviewId || data.metadata.reviewId === reviewId) {
        fetchMessages();
      }
    });
    return unsub;
  }, [isOpen, reviewId, fetchMessages]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async () => {
    const trimmed = newMessage.trim();
    if (!trimmed || trimmed.length < MESSAGE_MIN_LENGTH || sendGuardRef.current) return;
    sendGuardRef.current = true;
    setIsSending(true);
    setLocalError(null);
    try {
      const ok = await respondToReview(reviewId, trimmed);
      if (ok) {
        setNewMessage('');
        await fetchMessages();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send message';
      if (typeof err === 'object' && err !== null && 'code' in err && (err as any).code === 'RATE_LIMITED') {
        setLocalError('Too many messages. Please slow down.');
      } else if (typeof err === 'object' && err !== null && 'code' in err && (err as any).code === 'THREAD_CLOSED') {
        setLocalError('This conversation has reached its limit.');
      } else {
        setLocalError(msg);
      }
    } finally {
      setIsSending(false);
      sendGuardRef.current = false;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const charCount = newMessage.length;
  const canSend = charCount >= MESSAGE_MIN_LENGTH && charCount <= MESSAGE_MAX_LENGTH && !isSending && !isSubmitting;

  return (
    <div ref={threadRef} style={{ marginTop: 10 }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, position: 'relative' }}
      >
        <span style={{ fontSize: 14, position: 'relative' }}>
          💬
          {hasUnread && !isOpen && (
            <span
              style={{
                position: 'absolute', top: -2, right: -4,
                width: 8, height: 8, borderRadius: '50%',
                background: '#f472b6',
                boxShadow: '0 0 6px rgba(244,114,182,0.7)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          )}
        </span>
        <span className="enhanced-glass-subtle" style={{ fontSize: 11, margin: 0, color: hasUnread && !isOpen ? '#f472b6' : undefined }}>
          {responseCount > 0 ? `${responseCount} message${responseCount !== 1 ? 's' : ''}` : 'Start conversation'}
          {hasUnread && !isOpen && <span style={{ marginLeft: 4, fontSize: 9, color: '#f472b6', fontWeight: 700 }}>NEW</span>}
        </span>
        <motion.span
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ fontSize: 10, display: 'inline-block' }}
          className="enhanced-glass-subtle"
        >
          ▶
        </motion.span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <div
              ref={scrollRef}
              style={{
                marginTop: 10, maxHeight: 300, overflowY: 'auto',
                scrollbarWidth: 'none', msOverflowStyle: 'none',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}
            >
              {isLoading && messages.length === 0 && (
                <div className="text-center" style={{ padding: 16 }}>
                  <div className="animate-spin rounded-full h-5 w-5 mx-auto" style={{ border: '2px solid rgba(255,255,255,0.08)', borderTopColor: '#f472b6' }} />
                </div>
              )}
              {!isLoading && messages.length === 0 && (
                <div style={{ padding: 12, textAlign: 'center' }}>
                  <p className="enhanced-glass-subtle" style={{ fontSize: 11, margin: 0 }}>
                    No messages yet. Start an anonymous conversation with this reviewer.
                  </p>
                </div>
              )}
              {messages.map((msg, i) => {
                const isReviewee = msg.authorRole === 'reviewee';
                const bubbleColor = isReviewee ? '#f472b6' : '#a78bfa';
                const isSystem = (msg as any).isSystemMessage;
                if (isSystem) {
                  return (
                    <div key={msg.id || i} style={{ textAlign: 'center', padding: '4px 0' }}>
                      <span className="enhanced-glass-subtle" style={{ fontSize: 10, fontStyle: 'italic' }}>{msg.content}</span>
                    </div>
                  );
                }
                return (
                  <motion.div
                    key={msg.id || i}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.2 }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: isReviewee ? 'flex-end' : 'flex-start' }}
                  >
                    <div style={{
                      maxWidth: '80%', padding: '8px 12px', borderRadius: 12,
                      background: `${bubbleColor}12`, border: `1px solid ${bubbleColor}25`,
                      borderBottomRightRadius: isReviewee ? 4 : 12,
                      borderBottomLeftRadius: isReviewee ? 12 : 4,
                    }}>
                      <div className="flex items-center gap-2" style={{ marginBottom: 2 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: bubbleColor }}>
                          {isReviewee ? 'You (Reviewee)' : 'Reviewer'}
                        </span>
                        <span className="enhanced-glass-subtle" style={{ fontSize: 9, margin: 0 }}>{timeAgo(msg.createdAt)}</span>
                      </div>
                      <p className="enhanced-glass-body" style={{ fontSize: 12, margin: 0, lineHeight: 1.5, wordBreak: 'break-word' }}>{msg.content}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            <div style={{ marginTop: 8 }}>
              {localError && (
                <div style={{ padding: '6px 10px', marginBottom: 6, borderRadius: 8, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)' }}>
                  <span style={{ fontSize: 11, color: '#fca5a5' }}>{localError}</span>
                </div>
              )}
              <div className="flex gap-2">
                <textarea
                  value={newMessage}
                  onChange={(e) => { setNewMessage(e.target.value); setLocalError(null); }}
                  onKeyDown={handleKeyDown}
                  maxLength={MESSAGE_MAX_LENGTH}
                  rows={2}
                  placeholder="Reply anonymously... (min 5 chars)"
                  className="flex-1 rounded-lg p-2.5 text-xs resize-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'inherit', outline: 'none', fontSize: 12 }}
                  aria-label="Dialogue message"
                />
                <button
                  onClick={handleSend}
                  disabled={!canSend}
                  className="enhanced-action-button"
                  style={{ padding: '0 16px', borderRadius: 10, alignSelf: 'flex-end', opacity: canSend ? 1 : 0.4 }}
                  aria-busy={isSending}
                >
                  <span className="enhanced-glass-text" style={{ fontSize: 11, fontWeight: 600 }}>{isSending ? '...' : 'Send'}</span>
                </button>
              </div>
              <div className="flex items-center justify-between" style={{ marginTop: 4 }}>
                <span className="enhanced-glass-subtle" style={{ fontSize: 10, color: charCount >= MESSAGE_MAX_LENGTH * 0.9 ? '#f472b6' : undefined }}>
                  {charCount}/{MESSAGE_MAX_LENGTH}
                </span>
                <span className="enhanced-glass-subtle" style={{ fontSize: 10, fontStyle: 'italic', margin: 0 }}>
                  Enter to send · Shift+Enter for newline
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// REVIEW CARD — glass morphism with animated elements
// ============================================================================
function ReviewCard({ review, index }: { review: any; index: number }) {
  const { toggleHelpful, flagReview } = useTruthStream();
  const [expanded, setExpanded] = useState(false);
  const [showFlagConfirm, setShowFlagConfirm] = useState(false);

  const cls = classificationMeta(review.classification);
  const responses: Record<string, Record<string, unknown>> = review.responses || {};

  // Extract scores and text responses from dynamic data
  const scores: Array<{ key: string; value: number }> = [];
  const textResponses: Array<{ key: string; value: string }> = [];
  const wordSelections: Array<{ key: string; words: string[] }> = [];

  Object.entries(responses).forEach(([_sectionId, questions]) => {
    if (!questions || typeof questions !== 'object') return;
    Object.entries(questions).forEach(([qId, val]) => {
      if (isScore(val)) {
        scores.push({ key: qId, value: val });
      } else if (typeof val === 'string' && val.trim().length > 0) {
        textResponses.push({ key: qId, value: val });
      } else if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string') {
        wordSelections.push({ key: qId, words: val });
      } else if (typeof val === 'object' && val !== null) {
        // category_explain: { category, explanation }
        const obj = val as Record<string, unknown>;
        if (typeof obj.category === 'string' && typeof obj.explanation === 'string') {
          textResponses.push({ key: qId, value: `${humanize(obj.category)}: ${obj.explanation}` });
        }
      }
    });
  });

  // Primary score = first score or quality score
  const primaryScore = scores.length > 0 ? scores[0] : null;
  const qualityPct = Math.round((review.qualityScore ?? 0) * 100);

  const handleFlag = async () => {
    setShowFlagConfirm(false);
    await flagReview(review.id, 'Inappropriate content');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      className="enhanced-glass-card"
      style={{ borderRadius: 16, overflow: 'hidden' }}
    >
      {/* ── Header: classification + time ──────────────────────────────── */}
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <div className="flex items-center gap-2">
          <span
            className="enhanced-glass-heading"
            style={{ fontSize: 13 }}
          >
            Review #{index + 1}
          </span>
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.2 }}
            className="px-2.5 py-0.5 rounded-full"
            style={{
              fontSize: 10, fontWeight: 600,
              background: `${cls.color}18`,
              border: `1px solid ${cls.color}35`,
              color: cls.color,
              boxShadow: `0 0 4px ${cls.glow}`,
            }}
          >
            {cls.label}
          </motion.span>
        </div>
        <span className="enhanced-glass-subtle" style={{ fontSize: 11 }}>{timeAgo(review.createdAt)}</span>
      </div>

      {/* ── Scores row: ring + bars ────────────────────────────────────── */}
      {scores.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          {primaryScore && (
            <ScoreRing
              score={primaryScore.value}
              color={cls.color}
              glow={cls.glow}
            />
          )}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {scores.slice(0, expanded ? scores.length : 4).map((s, i) => {
              const c = FALLBACK_SECTION_COLORS[i % FALLBACK_SECTION_COLORS.length];
              return (
                <AnimatedBar
                  key={s.key}
                  label={humanize(s.key)}
                  value={s.value}
                  maxValue={10}
                  color={c.color}
                  glow={c.glow}
                  index={i}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── Word selections — glass pills with glow ────────────────────── */}
      {wordSelections.length > 0 && (
        <div className="flex flex-wrap gap-1.5" style={{ marginBottom: 12 }}>
          {wordSelections.flatMap((ws) => ws.words).map((word, i) => {
            const pill = FALLBACK_SECTION_COLORS[i % FALLBACK_SECTION_COLORS.length];
            return (
              <motion.span
                key={`${word}-${i}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.25 + i * 0.04, duration: 0.2 }}
                className="px-2.5 py-1 rounded-full"
                style={{
                  fontSize: 11,
                  background: `linear-gradient(135deg, ${pill.color}15, ${pill.color}08)`,
                  border: `1px solid ${pill.color}30`,
                  color: pill.color,
                }}
              >
                {word}
              </motion.span>
            );
          })}
        </div>
      )}

      {/* ── First text response always visible ─────────────────────────── */}
      {textResponses.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          style={{
            padding: 12, borderRadius: 12, marginBottom: 10,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderLeftWidth: 3,
            borderLeftColor: cls.color,
          }}
        >
          <span className="enhanced-glass-subtle" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {humanize(textResponses[0].key)}
          </span>
          <p className="enhanced-glass-body" style={{ fontSize: 12, margin: '4px 0 0', lineHeight: 1.6 }}>
            {textResponses[0].value}
          </p>
        </motion.div>
      )}

      {/* ── Quality + metadata pills ───────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: 10 }}>
        <span
          className="px-2 py-0.5 rounded-full"
          style={{
            fontSize: 10, fontWeight: 600,
            background: `rgba(74,222,128,${qualityPct >= 70 ? 0.15 : 0.06})`,
            border: `1px solid rgba(74,222,128,${qualityPct >= 70 ? 0.3 : 0.1})`,
            color: qualityPct >= 70 ? '#4ade80' : '#94a3b8',
          }}
        >
          Quality: {qualityPct}%
        </span>
        {review.depthScore != null && (
          <span className="px-2 py-0.5 rounded-full" style={{ fontSize: 10, background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>
            Depth: {Math.round((review.depthScore ?? 0) * 100)}%
          </span>
        )}
        {review.timeSpentSeconds > 0 && (
          <span className="px-2 py-0.5 rounded-full" style={{ fontSize: 10, background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>
            {Math.round(review.timeSpentSeconds / 60)}m spent
          </span>
        )}
      </div>

      {/* ── Expanded content ───────────────────────────────────────────── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            {/* Remaining text responses */}
            {textResponses.slice(1).map((t, i) => (
              <motion.div
                key={t.key}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.2 }}
                style={{
                  padding: 12, borderRadius: 12, marginBottom: 8,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderLeftWidth: 3,
                  borderLeftColor: FALLBACK_SECTION_COLORS[(i + 1) % FALLBACK_SECTION_COLORS.length].color,
                }}
              >
                <span className="enhanced-glass-subtle" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {humanize(t.key)}
                </span>
                <p className="enhanced-glass-body" style={{ fontSize: 12, margin: '4px 0 0', lineHeight: 1.6 }}>
                  {t.value}
                </p>
              </motion.div>
            ))}

            {/* Dina counter-analysis */}
            {review.dinaCounterAnalysis && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 }}
                style={{
                  padding: 12, borderRadius: 12, marginBottom: 8,
                  background: 'rgba(192,132,252,0.06)',
                  border: '1px solid rgba(192,132,252,0.15)',
                  borderLeftWidth: 3,
                  borderLeftColor: '#c084fc',
                }}
              >
                <span className="enhanced-glass-subtle" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#c084fc' }}>
                  Dina's Analysis
                </span>
                <p className="enhanced-glass-body" style={{ fontSize: 12, margin: '4px 0 0', lineHeight: 1.6 }}>
                  {review.dinaCounterAnalysis}
                </p>
              </motion.div>
            )}

            {/* Classification reasoning */}
            {review.classificationReasoning && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                style={{
                  padding: 12, borderRadius: 12, marginBottom: 8,
                  background: `${cls.color}08`,
                  border: `1px solid ${cls.color}15`,
                  borderLeftWidth: 3,
                  borderLeftColor: cls.color,
                }}
              >
                <span className="enhanced-glass-subtle" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Classification Reasoning
                </span>
                <p className="enhanced-glass-body" style={{ fontSize: 12, margin: '4px 0 0', lineHeight: 1.6 }}>
                  {review.classificationReasoning}
                </p>
                {review.classificationConfidence != null && (
                  <span className="enhanced-glass-subtle" style={{ fontSize: 10, display: 'block', marginTop: 4 }}>
                    Confidence: {Math.round(review.classificationConfidence * 100)}%
                  </span>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Action bar ─────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between"
        style={{ paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className="enhanced-glass-subtle"
          style={{ fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          aria-expanded={expanded}
        >
          {expanded ? 'Show less' : 'Show full review'}
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => toggleHelpful(review.id, review.hasUserMarkedHelpful)}
            className="flex items-center gap-1 transition-opacity"
            style={{
              fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              color: review.hasUserMarkedHelpful ? '#f472b6' : undefined,
            }}
            aria-pressed={review.hasUserMarkedHelpful}
            aria-label={review.hasUserMarkedHelpful ? 'Unmark as helpful' : 'Mark as helpful'}
          >
            <span style={{ fontSize: 14 }}>{review.hasUserMarkedHelpful ? '❤️' : '🤍'}</span>
            <span className="enhanced-glass-subtle" style={{ fontSize: 11, color: review.hasUserMarkedHelpful ? '#f472b6' : undefined, margin: 0 }}>
              {review.helpfulCount > 0 ? review.helpfulCount : ''}
            </span>
          </button>
          {!review.isFlagged && (
            <button
              onClick={() => setShowFlagConfirm(true)}
              style={{ fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', padding: 0, opacity: 0.5 }}
              aria-label="Flag review"
            >
              🚩
            </button>
          )}
        </div>
      </div>

      {/* ── Flag Confirmation ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showFlagConfirm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              marginTop: 10, padding: 12, borderRadius: 12, overflow: 'hidden',
              background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)',
            }}
            role="alert"
          >
            <p className="enhanced-glass-body" style={{ fontSize: 12, marginBottom: 8 }}>
              Flag this review as inappropriate? This will notify moderators.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowFlagConfirm(false)}
                className="enhanced-action-button px-3 py-1.5"
                style={{ borderRadius: 10 }}
              >
                <span className="enhanced-glass-subtle" style={{ fontSize: 11 }}>Cancel</span>
              </button>
              <button
                onClick={handleFlag}
                className="px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(248,113,113,0.2)', border: '1px solid rgba(248,113,113,0.3)', color: '#fca5a5', fontSize: 11, cursor: 'pointer' }}
              >
                Flag Review
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Dialogue thread ────────────────────────────────────────────── */}
      <DialogueThread reviewId={review.id} responseCount={review.responseCount ?? 0} />
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function ReceivedReviews() {
  const { receivedReviews, receivedHasMore, isLoading, isLoadingMore, loadReceivedReviews, setView } = useTruthStream();

  // Scroll-to-top ref for pagination
  const topRef = useRef<HTMLDivElement>(null);

  const handleLoadMore = useCallback(() => {
    loadReceivedReviews(true);
  }, [loadReceivedReviews]);

  useEffect(() => {
    if (receivedReviews.length === 0) loadReceivedReviews();
  }, [receivedReviews.length, loadReceivedReviews]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <motion.div
        ref={topRef}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="enhanced-glass-card"
      >
        <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView('overview')}
              className="enhanced-action-button"
              style={{ padding: '6px 12px', borderRadius: 10 }}
            >
              <span className="enhanced-glass-subtle" style={{ fontSize: 12 }}>Back</span>
            </button>
            <h2 className="enhanced-glass-heading" style={{ fontSize: 18, margin: 0 }}>Reviews Received</h2>
          </div>
          {receivedReviews.length > 0 && (
            <span
              className="px-2.5 py-1 rounded-full"
              style={{
                fontSize: 10, fontWeight: 600,
                background: 'linear-gradient(135deg, rgba(244,114,182,0.15), rgba(167,139,250,0.15))',
                border: '1px solid rgba(244,114,182,0.2)',
                color: '#f472b6',
              }}
            >
              {receivedReviews.length} review{receivedReviews.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <p className="enhanced-glass-subtle" style={{ fontSize: 11, margin: 0 }}>
          All reviews are anonymous — identities are never revealed
        </p>
      </motion.div>

      {/* ── Loading state ──────────────────────────────────────────────── */}
      {isLoading && receivedReviews.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="enhanced-glass-card text-center py-12"
        >
          <div
            className="animate-spin rounded-full h-8 w-8 mx-auto mb-3"
            style={{ border: '2px solid rgba(255,255,255,0.08)', borderTopColor: '#f472b6' }}
          />
          <p className="enhanced-glass-body" style={{ fontSize: 13 }}>Loading reviews...</p>
        </motion.div>
      )}

      {/* ── Empty state ────────────────────────────────────────────────── */}
      {receivedReviews.length === 0 && !isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="enhanced-glass-card text-center py-12"
        >
          <span className="text-4xl block mb-4">🔍</span>
          <h3 className="enhanced-glass-heading" style={{ fontSize: 15, marginBottom: 6 }}>No Reviews Yet</h3>
          <p className="enhanced-glass-body" style={{ fontSize: 13 }}>
            Give at least 1 review to start seeing feedback!
          </p>
        </motion.div>
      )}

      {/* ── Review cards ───────────────────────────────────────────────── */}
      {receivedReviews.map((review, i) => (
        <ReviewCard key={review.id} review={review} index={i} />
      ))}

      {/* ── Load more ──────────────────────────────────────────────────── */}
      {receivedHasMore && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={handleLoadMore}
          disabled={isLoadingMore}
          className="w-full enhanced-action-button py-3"
          style={{ opacity: isLoadingMore ? 0.5 : 1, borderRadius: 12 }}
          aria-busy={isLoadingMore}
        >
          <span className="enhanced-glass-text" style={{ fontWeight: 600, fontSize: 13 }}>
            {isLoadingMore ? 'Loading...' : 'Load More'}
          </span>
        </motion.button>
      )}
    </motion.div>
  );
}
