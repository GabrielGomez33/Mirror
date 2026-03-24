// src/components/truthstream/TruthStreamOverview.tsx
// Main TruthStream overview — stats, quick actions, profile status
// Security: All shared data is gated by profile.sharedDataTypes — only opted-in data is displayed.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTruthStream } from '../../context/TruthStreamContext';
import { getPersonalIntelligenceApi } from '../../services/mirrorDashboard';
import { type TruthCardData, type TruthCardSharedData } from '../../types/truthstream';
import RevieweeTruthCard from './RevieweeTruthCard';

const COLORS = {
  heading: '#3d1428',
  body: '#4a1c30',
  label: '#2d0a16',
};

// ============================================================================
// SVG MILESTONE ICONS — professional monochrome stroke icons
// ============================================================================
const MilestoneIcon: React.FC<{ icon: string; color: string; size?: number }> = ({ icon, color, size = 22 }) => {
  const s = { width: size, height: size, display: 'block' as const };
  const p = { fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  switch (icon) {
    // Reviews Given
    case 'sprout':
      return (<svg viewBox="0 0 24 24" style={s}><path {...p} d="M12 22V12"/><path {...p} d="M8 12c0-4 4-8 4-8s4 4 4 8"/><path {...p} d="M5.5 8.5C7 7 9.5 7 12 9"/><path {...p} d="M18.5 8.5C17 7 14.5 7 12 9"/></svg>);
    case 'handshake':
      return (<svg viewBox="0 0 24 24" style={s}><path {...p} d="M2 14l4-4 3 3 5-5 3 3 5-5"/><path {...p} d="M15 5h5v5"/></svg>);
    case 'bricks':
      return (<svg viewBox="0 0 24 24" style={s}><rect {...p} x="3" y="4" width="8" height="6" rx="1"/><rect {...p} x="13" y="4" width="8" height="6" rx="1"/><rect {...p} x="3" y="14" width="8" height="6" rx="1"/><rect {...p} x="13" y="14" width="8" height="6" rx="1"/></svg>);
    case 'compass':
      return (<svg viewBox="0 0 24 24" style={s}><circle {...p} cx="12" cy="12" r="9"/><polygon {...p} points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88"/></svg>);
    case 'shield-star':
      return (<svg viewBox="0 0 24 24" style={s}><path {...p} d="M12 2l7 4v5c0 5.25-3.5 9.74-7 11-3.5-1.26-7-5.75-7-11V6l7-4z"/><path {...p} d="M12 8l1.5 3 3 .5-2.25 2 .75 3L12 15l-3 1.5.75-3L7.5 11.5l3-.5z"/></svg>);
    case 'crystal':
      return (<svg viewBox="0 0 24 24" style={s}><path {...p} d="M12 2L6 8.5 12 22l6-13.5L12 2z"/><path {...p} d="M6 8.5h12"/><path {...p} d="M9 2l-3 6.5"/><path {...p} d="M15 2l3 6.5"/></svg>);
    case 'crown':
      return (<svg viewBox="0 0 24 24" style={s}><path {...p} d="M2 18h20V8l-5 4-5-6-5 6-5-4v10z"/><path {...p} d="M2 18l1 2h18l1-2"/></svg>);

    // Reviews Received
    case 'echo':
      return (<svg viewBox="0 0 24 24" style={s}><path {...p} d="M8 12a4 4 0 018 0"/><path {...p} d="M5 12a7 7 0 0114 0"/><path {...p} d="M2 12a10 10 0 0120 0"/><circle fill={color} stroke="none" cx="12" cy="12" r="1.5"/></svg>);
    case 'ear':
      return (<svg viewBox="0 0 24 24" style={s}><path {...p} d="M6 12a6 6 0 1112 0c0 3-2 5-3 7s-2 3-4 3-2-1-2-3"/><path {...p} d="M10 12a2 2 0 014 0c0 1-.5 2-1 3"/></svg>);
    case 'eye':
      return (<svg viewBox="0 0 24 24" style={s}><path {...p} d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle {...p} cx="12" cy="12" r="3"/></svg>);
    case 'magnet':
      return (<svg viewBox="0 0 24 24" style={s}><path {...p} d="M6 3v7a6 6 0 0012 0V3"/><path {...p} d="M6 3h3v4H6z"/><path {...p} d="M15 3h3v4h-3z"/></svg>);
    case 'megaphone':
      return (<svg viewBox="0 0 24 24" style={s}><path {...p} d="M18 4L6 9H3v6h3l12 5V4z"/><path {...p} d="M21 10c1 1 1 3 0 4"/></svg>);
    case 'throne':
      return (<svg viewBox="0 0 24 24" style={s}><path {...p} d="M7 21h10"/><path {...p} d="M9 21V13H7V5l5-2 5 2v8h-2v8"/><path {...p} d="M9 9h6"/></svg>);

    // Classification
    case 'heart':
      return (<svg viewBox="0 0 24 24" style={s}><path {...p} d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/></svg>);
    case 'target':
      return (<svg viewBox="0 0 24 24" style={s}><circle {...p} cx="12" cy="12" r="9"/><circle {...p} cx="12" cy="12" r="5"/><circle fill={color} stroke="none" cx="12" cy="12" r="1.5"/></svg>);
    case 'wrench':
      return (<svg viewBox="0 0 24 24" style={s}><path {...p} d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94L6.73 20.2a2 2 0 01-2.83 0 2 2 0 010-2.83l6.73-6.73A6 6 0 016.93 2.83l3.77 3.77z"/></svg>);
    case 'bolt':
      return (<svg viewBox="0 0 24 24" style={s}><polygon {...p} points="13 2 3 14 12 14 11 22 21 10 12 10"/></svg>);
    case 'flame':
      return (<svg viewBox="0 0 24 24" style={s}><path {...p} d="M12 22c4-3 7-7 7-11a7 7 0 00-14 0c0 4 3 8 7 11z"/><path {...p} d="M12 22c-2-1.5-3.5-3.5-3.5-5.5a3.5 3.5 0 017 0c0 2-1.5 4-3.5 5.5z"/></svg>);

    // Quality & Special
    case 'third-eye':
      return (<svg viewBox="0 0 24 24" style={s}><path {...p} d="M12 4C7 4 3 12 3 12s4 8 9 8 9-8 9-8-4-8-9-8z"/><circle {...p} cx="12" cy="12" r="3"/><path {...p} d="M12 2v2"/><path {...p} d="M12 20v2"/></svg>);
    case 'verified':
      return (<svg viewBox="0 0 24 24" style={s}><path {...p} d="M12 2l3 3h4v4l3 3-3 3v4h-4l-3 3-3-3H5v-4L2 12l3-3V5h4l3-3z"/><path {...p} d="M9 12l2 2 4-4"/></svg>);
    case 'diamond':
      return (<svg viewBox="0 0 24 24" style={s}><path {...p} d="M6 3h12l4 7-10 12L2 10z"/><path {...p} d="M2 10h20"/><path {...p} d="M12 22L6 3"/><path {...p} d="M12 22l6-19"/></svg>);
    case 'mirror':
      return (<svg viewBox="0 0 24 24" style={s}><ellipse {...p} cx="12" cy="10" rx="7" ry="8"/><path {...p} d="M8.5 20h7"/><path {...p} d="M10 18h4v2h-4z"/><path {...p} d="M9 7c0-1.5 1.5-3 3-3s3 1.5 3 3" opacity="0.5"/></svg>);
    case 'batch':
      return (<svg viewBox="0 0 24 24" style={s}><rect {...p} x="3" y="3" width="7" height="7" rx="1"/><rect {...p} x="14" y="3" width="7" height="7" rx="1"/><rect {...p} x="3" y="14" width="7" height="7" rx="1"/><rect {...p} x="14" y="14" width="7" height="7" rx="1"/><path {...p} d="M6.5 6.5l1-1m0 2l-1-1"/><path {...p} d="M17.5 6.5l1-1m0 2l-1-1"/></svg>);
    case 'lock':
      return (<svg viewBox="0 0 24 24" style={s}><rect {...p} x="5" y="11" width="14" height="10" rx="2"/><path {...p} d="M8 11V7a4 4 0 018 0v4"/><circle fill={color} stroke="none" cx="12" cy="16" r="1.5"/></svg>);

    default:
      return (<svg viewBox="0 0 24 24" style={s}><circle {...p} cx="12" cy="12" r="9"/><path {...p} d="M12 8v4l3 3"/></svg>);
  }
};

// ============================================================================
// MILESTONE DATA MODEL
// ============================================================================
type MilestoneCategory = 'given' | 'received' | 'report' | 'classification' | 'quality';

interface MilestoneCheckCtx {
  totalReviewsGiven: number;
  totalReviewsReceived: number;
  perceptionGapScore: number | null;
  reviewerQualityScore: number;
  averageQualityScore: number;
  completedBatches: number;
  constructive: number;
  affirming: number;
  rawTruth: number;
  hostile: number;
  hasReport: boolean;
}

interface MilestoneTier {
  key: string;
  name: string;
  desc: string;
  icon: string;
  color: string;
  category: MilestoneCategory;
  check: (ctx: MilestoneCheckCtx) => boolean;
  progress?: (ctx: MilestoneCheckCtx) => { current: number; target: number };
}

function buildCheckCtx(stats: any, hasReport: boolean): MilestoneCheckCtx {
  // classificationBreakdown comes from server with snake_case keys (raw_truth)
  // transformKeys converts them to camelCase (rawTruth)
  const cb = stats?.classificationBreakdown;
  return {
    totalReviewsGiven: Number(stats?.totalReviewsGiven) || 0,
    totalReviewsReceived: Number(stats?.totalReviewsReceived) || 0,
    perceptionGapScore: stats?.perceptionGapScore != null ? Number(stats.perceptionGapScore) : null,
    reviewerQualityScore: Number(stats?.reviewerQualityScore) || 0,
    averageQualityScore: Number(stats?.averageQualityScore) || 0,
    completedBatches: Number(stats?.completedBatches) || 0,
    constructive: Number(cb?.constructive) || 0,
    affirming: Number(cb?.affirming) || 0,
    rawTruth: Number(cb?.rawTruth) || 0,
    hostile: Number(cb?.hostile) || 0,
    hasReport,
  };
}

const MILESTONE_TIERS: MilestoneTier[] = [
  // ── Reviews Given ─────────────────────────────────────────────────────
  { key: 'review_rookie', name: 'Review Rookie', desc: 'Give your first review', icon: 'sprout', color: '#4ade80',
    category: 'given',
    check: (c) => c.totalReviewsGiven >= 1,
    progress: (c) => ({ current: Math.min(c.totalReviewsGiven, 1), target: 1 }),
  },
  { key: 'feedback_friend', name: 'Feedback Friend', desc: 'Give 10 reviews', icon: 'handshake', color: '#60a5fa',
    category: 'given',
    check: (c) => c.totalReviewsGiven >= 10,
    progress: (c) => ({ current: Math.min(c.totalReviewsGiven, 10), target: 10 }),
  },
  { key: 'insight_builder', name: 'Insight Builder', desc: 'Give 30 reviews', icon: 'bricks', color: '#fb923c',
    category: 'given',
    check: (c) => c.totalReviewsGiven >= 30,
    progress: (c) => ({ current: Math.min(c.totalReviewsGiven, 30), target: 30 }),
  },
  { key: 'truth_seeker', name: 'Truth Seeker', desc: 'Give 50 reviews', icon: 'compass', color: '#a78bfa',
    category: 'given',
    check: (c) => c.totalReviewsGiven >= 50,
    progress: (c) => ({ current: Math.min(c.totalReviewsGiven, 50), target: 50 }),
  },
  { key: 'mirror_master', name: 'Mirror Master', desc: 'Give 100 reviews', icon: 'shield-star', color: '#facc15',
    category: 'given',
    check: (c) => c.totalReviewsGiven >= 100,
    progress: (c) => ({ current: Math.min(c.totalReviewsGiven, 100), target: 100 }),
  },
  { key: 'oracle', name: 'Oracle', desc: 'Give 500 reviews', icon: 'crystal', color: '#c084fc',
    category: 'given',
    check: (c) => c.totalReviewsGiven >= 500,
    progress: (c) => ({ current: Math.min(c.totalReviewsGiven, 500), target: 500 }),
  },
  { key: 'enlightened', name: 'Enlightened', desc: 'Give 1,000 reviews', icon: 'crown', color: '#fbbf24',
    category: 'given',
    check: (c) => c.totalReviewsGiven >= 1000,
    progress: (c) => ({ current: Math.min(c.totalReviewsGiven, 1000), target: 1000 }),
  },

  // ── Reviews Received ──────────────────────────────────────────────────
  { key: 'first_echo', name: 'First Echo', desc: 'Receive your first review', icon: 'echo', color: '#38bdf8',
    category: 'received',
    check: (c) => c.totalReviewsReceived >= 1,
    progress: (c) => ({ current: Math.min(c.totalReviewsReceived, 1), target: 1 }),
  },
  { key: 'heard', name: 'Heard', desc: 'Receive 5 reviews', icon: 'ear', color: '#818cf8',
    category: 'received',
    check: (c) => c.totalReviewsReceived >= 5,
    progress: (c) => ({ current: Math.min(c.totalReviewsReceived, 5), target: 5 }),
  },
  { key: 'visible', name: 'Visible', desc: 'Receive 10 reviews', icon: 'eye', color: '#34d399',
    category: 'received',
    check: (c) => c.totalReviewsReceived >= 10,
    progress: (c) => ({ current: Math.min(c.totalReviewsReceived, 10), target: 10 }),
  },
  { key: 'in_demand', name: 'In Demand', desc: 'Receive 25 reviews', icon: 'magnet', color: '#f472b6',
    category: 'received',
    check: (c) => c.totalReviewsReceived >= 25,
    progress: (c) => ({ current: Math.min(c.totalReviewsReceived, 25), target: 25 }),
  },
  { key: 'community_voice', name: 'Community Voice', desc: 'Receive 50 reviews', icon: 'megaphone', color: '#fb923c',
    category: 'received',
    check: (c) => c.totalReviewsReceived >= 50,
    progress: (c) => ({ current: Math.min(c.totalReviewsReceived, 50), target: 50 }),
  },
  { key: 'icon', name: 'Icon', desc: 'Receive 100 reviews', icon: 'throne', color: '#fbbf24',
    category: 'received',
    check: (c) => c.totalReviewsReceived >= 100,
    progress: (c) => ({ current: Math.min(c.totalReviewsReceived, 100), target: 100 }),
  },

  // ── Report ────────────────────────────────────────────────────────────
  { key: 'first_reflection', name: 'First Reflection', desc: 'Generate your first report', icon: 'mirror', color: '#f472b6',
    category: 'report',
    check: (c) => c.hasReport,
  },

  // ── Classification Streaks ────────────────────────────────────────────
  { key: 'kind_heart', name: 'Kind Heart', desc: '5 affirming reviews given', icon: 'heart', color: '#f87171',
    category: 'classification',
    check: (c) => c.affirming >= 5,
    progress: (c) => ({ current: Math.min(c.affirming, 5), target: 5 }),
  },
  { key: 'the_builder', name: 'The Builder', desc: '10 constructive reviews', icon: 'wrench', color: '#60a5fa',
    category: 'classification',
    check: (c) => c.constructive >= 10,
    progress: (c) => ({ current: Math.min(c.constructive, 10), target: 10 }),
  },
  { key: 'straight_shooter', name: 'Straight Shooter', desc: '5 raw truth reviews', icon: 'target', color: '#fb923c',
    category: 'classification',
    check: (c) => c.rawTruth >= 5,
    progress: (c) => ({ current: Math.min(c.rawTruth, 5), target: 5 }),
  },
  { key: 'truth_cannon', name: 'Truth Cannon', desc: '15 raw truth reviews', icon: 'bolt', color: '#facc15',
    category: 'classification',
    check: (c) => c.rawTruth >= 15,
    progress: (c) => ({ current: Math.min(c.rawTruth, 15), target: 15 }),
  },
  { key: 'dark_streak', name: 'Dark Streak', desc: '3 hostile-flagged reviews', icon: 'flame', color: '#ef4444',
    category: 'classification',
    check: (c) => c.hostile >= 3,
    progress: (c) => ({ current: Math.min(c.hostile, 3), target: 3 }),
  },

  // ── Quality & Special ─────────────────────────────────────────────────
  { key: 'self_aware', name: 'Self-Aware', desc: 'Perception Gap above 80', icon: 'third-eye', color: '#2dd4bf',
    category: 'quality',
    check: (c) => (c.perceptionGapScore ?? 0) >= 80,
  },
  { key: 'trusted_voice', name: 'Trusted Voice', desc: 'Top 20% reviewer quality', icon: 'verified', color: '#f59e0b',
    category: 'quality',
    check: (c) => c.reviewerQualityScore >= 80,
  },
  { key: 'sharp_eye', name: 'Sharp Eye', desc: 'Average quality score 0.8+', icon: 'diamond', color: '#818cf8',
    category: 'quality',
    check: (c) => c.averageQualityScore >= 0.8 && c.totalReviewsGiven >= 5,
  },
  { key: 'batch_boss', name: 'Batch Boss', desc: 'Complete 5 review batches', icon: 'batch', color: '#4ade80',
    category: 'quality',
    check: (c) => c.completedBatches >= 5,
    progress: (c) => ({ current: Math.min(c.completedBatches, 5), target: 5 }),
  },
];

const CATEGORY_LABELS: Record<MilestoneCategory, { label: string; color: string }> = {
  given:          { label: 'Reviews Given',    color: '#4ade80' },
  received:       { label: 'Reviews Received', color: '#38bdf8' },
  report:         { label: 'Reports',          color: '#f472b6' },
  classification: { label: 'Review Style',     color: '#fb923c' },
  quality:        { label: 'Quality & Skill',  color: '#a78bfa' },
};

export default function TruthStreamOverview() {
  const { user } = useAuth();
  const { profile, stats, queue, analysis, isLoading, setView, refreshAll, successMessage } = useTruthStream();

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
    <div className="space-y-6" style={{ maxHeight: '100vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
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
          {/* Stats Row — 3 cards in one line */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Reviews Received" value={stats?.totalReviewsReceived ?? 0} icon="📥" />
            <StatCard label="Reviews Given" value={stats?.totalReviewsGiven ?? 0} icon="📤" />
            <StatCard
              label="Perception Gap"
              value={stats?.perceptionGapScore != null ? `${Math.round(stats.perceptionGapScore)}` : '—'}
              icon="🔮"
            />
          </div>

          {/* Milestone Progression Rail */}
          <MilestoneRail stats={stats} hasReport={!!analysis} />

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
              icon="📤"
              label="Reviews Given"
              description="See your reviews, engagement, and continue conversations"
              badge={stats?.totalReviewsGiven ? String(stats.totalReviewsGiven) : undefined}
              onClick={() => setView('given')}
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

// ============================================================================
// MILESTONE RAIL — horizontal scrollable progression with category groups
// ============================================================================
function MilestoneRail({ stats, hasReport }: { stats: any; hasReport: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(true);
  const [showTabsLeftFade, setShowTabsLeftFade] = useState(false);
  const [showTabsRightFade, setShowTabsRightFade] = useState(false);
  const [activeFilter, setActiveFilter] = useState<MilestoneCategory | 'all'>('all');

  const ctx = buildCheckCtx(stats, hasReport);
  const earnedCount = MILESTONE_TIERS.filter((t) => t.check(ctx)).length;

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeftFade(el.scrollLeft > 8);
    setShowRightFade(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  }, []);

  // Convert vertical mouse wheel to horizontal scroll for desktop users
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const scrollBy = useCallback((dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 200, behavior: 'smooth' });
  }, []);

  // Tabs rail scroll state
  const handleTabsScroll = useCallback(() => {
    const el = tabsRef.current;
    if (!el) return;
    setShowTabsLeftFade(el.scrollLeft > 8);
    setShowTabsRightFade(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  }, []);

  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const frame = requestAnimationFrame(handleTabsScroll);
    el.addEventListener('scroll', handleTabsScroll, { passive: true });
    return () => { cancelAnimationFrame(frame); el.removeEventListener('scroll', handleTabsScroll); };
  }, [handleTabsScroll]);

  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const scrollTabsBy = useCallback((dir: number) => {
    tabsRef.current?.scrollBy({ left: dir * 120, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Recompute after filter change
    const frame = requestAnimationFrame(handleScroll);
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => { cancelAnimationFrame(frame); el.removeEventListener('scroll', handleScroll); };
  }, [handleScroll, activeFilter]);

  // Reset scroll position when filter changes
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
  }, [activeFilter]);

  const filteredTiers = activeFilter === 'all'
    ? MILESTONE_TIERS
    : MILESTONE_TIERS.filter((t) => t.category === activeFilter);

  const categories: Array<MilestoneCategory | 'all'> = ['all', 'given', 'received', 'report', 'classification', 'quality'];

  return (
    <div className="enhanced-glass-card" style={{ padding: '16px 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', marginBottom: 10 }}>
        <h3 className="text-sm font-medium" style={{ color: COLORS.heading, margin: 0 }}>Milestones</h3>
        <span
          className="text-[10px] font-bold px-2.5 py-1 rounded-full"
          style={{
            background: earnedCount > 0
              ? 'linear-gradient(135deg, rgba(244,114,182,0.2), rgba(167,139,250,0.2))'
              : 'rgba(255,255,255,0.06)',
            color: earnedCount > 0 ? COLORS.heading : COLORS.label,
            border: earnedCount > 0 ? '1px solid rgba(244,114,182,0.2)' : '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {earnedCount} / {MILESTONE_TIERS.length}
        </span>
      </div>

      {/* Category filter tabs */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        {showTabsLeftFade && (
          <>
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0, width: 28, zIndex: 4,
              background: 'linear-gradient(90deg, rgba(30,15,25,0.8), transparent)',
              pointerEvents: 'none', borderRadius: '8px 0 0 8px',
            }} />
            <button
              onClick={() => scrollTabsBy(-1)}
              aria-label="Scroll tabs left"
              style={{
                position: 'absolute', left: 2, top: '50%', transform: 'translateY(-50%)',
                zIndex: 5, width: 24, height: 24, borderRadius: '50%', border: 'none',
                background: 'rgba(61,20,40,0.85)', color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 0,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
          </>
        )}
        {showTabsRightFade && (
          <>
            <div style={{
              position: 'absolute', right: 0, top: 0, bottom: 0, width: 28, zIndex: 4,
              background: 'linear-gradient(270deg, rgba(30,15,25,0.8), transparent)',
              pointerEvents: 'none', borderRadius: '0 8px 8px 0',
            }} />
            <button
              onClick={() => scrollTabsBy(1)}
              aria-label="Scroll tabs right"
              style={{
                position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)',
                zIndex: 5, width: 24, height: 24, borderRadius: '50%', border: 'none',
                background: 'rgba(61,20,40,0.85)', color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 0,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </>
        )}
        <div
          ref={tabsRef}
          style={{
            position: 'relative', zIndex: 1,
            display: 'flex', gap: 6, padding: '0 16px',
            overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none',
          }}
        >
          {categories.map((cat) => {
            const isActive = activeFilter === cat;
            const catLabel = cat === 'all' ? 'All' : CATEGORY_LABELS[cat].label;
            const catColor = cat === 'all' ? '#f472b6' : CATEGORY_LABELS[cat].color;
            const catCount = cat === 'all'
              ? earnedCount
              : MILESTONE_TIERS.filter((t) => t.category === cat && t.check(ctx)).length;
            const catTotal = cat === 'all'
              ? MILESTONE_TIERS.length
              : MILESTONE_TIERS.filter((t) => t.category === cat).length;

            return (
              <button
                key={cat}
                onClick={() => setActiveFilter(cat)}
                style={{
                  flex: '0 0 auto',
                  padding: '5px 10px',
                  borderRadius: 8,
                  border: isActive ? `1px solid ${catColor}50` : '1px solid rgba(255,255,255,0.06)',
                  background: isActive ? `${catColor}15` : 'rgba(255,255,255,0.02)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <span style={{
                  fontSize: 10, fontWeight: isActive ? 700 : 500,
                  color: isActive ? COLORS.heading : COLORS.label,
                  whiteSpace: 'nowrap',
                }}>
                  {catLabel}
                </span>
                <span style={{
                  fontSize: 8, fontWeight: 700,
                  color: catCount > 0 ? catColor : COLORS.label,
                  opacity: catCount > 0 ? 1 : 0.5,
                }}>
                  {catCount}/{catTotal}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable rail */}
      <div style={{ position: 'relative' }}>
        {showLeftFade && (
          <>
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0, width: 32, zIndex: 2,
              background: 'linear-gradient(90deg, rgba(30,15,25,0.8), transparent)',
              pointerEvents: 'none', borderRadius: '8px 0 0 8px',
            }} />
            <button
              onClick={() => scrollBy(-1)}
              aria-label="Scroll left"
              style={{
                position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)',
                zIndex: 3, width: 28, height: 28, borderRadius: '50%', border: 'none',
                background: 'rgba(61,20,40,0.7)', color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, lineHeight: 1,
              }}
            >
              ‹
            </button>
          </>
        )}
        {showRightFade && (
          <>
            <div style={{
              position: 'absolute', right: 0, top: 0, bottom: 0, width: 32, zIndex: 2,
              background: 'linear-gradient(270deg, rgba(30,15,25,0.8), transparent)',
              pointerEvents: 'none', borderRadius: '0 8px 8px 0',
            }} />
            <button
              onClick={() => scrollBy(1)}
              aria-label="Scroll right"
              style={{
                position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                zIndex: 3, width: 28, height: 28, borderRadius: '50%', border: 'none',
                background: 'rgba(61,20,40,0.7)', color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, lineHeight: 1,
              }}
            >
              ›
            </button>
          </>
        )}

        <div
          ref={scrollRef}
          style={{
            display: 'flex', gap: 10, overflowX: 'auto', padding: '0 16px 6px',
            scrollbarWidth: 'none', msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {filteredTiers.map((tier) => {
            const earned = tier.check(ctx);
            const prog = tier.progress?.(ctx);
            const progressPct = prog ? Math.round((prog.current / prog.target) * 100) : (earned ? 100 : 0);

            return (
              <div
                key={tier.key}
                style={{
                  flex: '0 0 auto',
                  width: 86,
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 5, padding: '14px 8px 10px',
                  borderRadius: 14,
                  background: earned
                    ? `linear-gradient(160deg, ${tier.color}15, ${tier.color}05)`
                    : 'rgba(255,255,255,0.015)',
                  border: earned
                    ? `1px solid ${tier.color}35`
                    : '1px solid rgba(255,255,255,0.05)',
                  transition: 'all 0.3s ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Earned shimmer accent */}
                {earned && (
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                    background: `linear-gradient(90deg, transparent, ${tier.color}60, transparent)`,
                  }} />
                )}

                {/* Icon container with ring progress */}
                <div style={{
                  width: 44, height: 44,
                  borderRadius: 22,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                  background: earned
                    ? `linear-gradient(135deg, ${tier.color}20, ${tier.color}08)`
                    : 'rgba(255,255,255,0.03)',
                  boxShadow: earned
                    ? `0 0 16px ${tier.color}25, inset 0 0 8px ${tier.color}10`
                    : 'none',
                  transition: 'all 0.3s ease',
                }}>
                  {/* Progress ring (SVG) */}
                  {!earned && prog && progressPct > 0 && (
                    <svg
                      width="44" height="44"
                      viewBox="0 0 44 44"
                      style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}
                    >
                      <circle cx="22" cy="22" r="20" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="2" />
                      <circle
                        cx="22" cy="22" r="20" fill="none"
                        stroke={`${tier.color}50`} strokeWidth="2" strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 20}`}
                        strokeDashoffset={`${2 * Math.PI * 20 * (1 - progressPct / 100)}`}
                        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                      />
                    </svg>
                  )}

                  {/* Icon */}
                  <div style={{ opacity: earned ? 1 : 0.35, transition: 'opacity 0.3s' }}>
                    {earned
                      ? <MilestoneIcon icon={tier.icon} color={tier.color} size={22} />
                      : <MilestoneIcon icon="lock" color={COLORS.label} size={18} />
                    }
                  </div>
                </div>

                {/* Name */}
                <span style={{
                  fontSize: 9.5, fontWeight: 700,
                  color: earned ? COLORS.heading : COLORS.label,
                  textAlign: 'center', lineHeight: 1.25,
                  width: '100%', wordBreak: 'break-word',
                  opacity: earned ? 1 : 0.55,
                  letterSpacing: '0.01em',
                  transition: 'color 0.3s, opacity 0.3s',
                }}>
                  {tier.name}
                </span>

                {/* Description */}
                <span style={{
                  fontSize: 7.5, fontWeight: 400,
                  color: COLORS.label,
                  textAlign: 'center', lineHeight: 1.3,
                  width: '100%',
                  opacity: earned ? 0.7 : 0.4,
                }}>
                  {tier.desc}
                </span>

                {/* Progress count for unearned */}
                {!earned && prog && prog.current > 0 && (
                  <span style={{
                    fontSize: 7.5, fontWeight: 700,
                    color: tier.color,
                    textAlign: 'center',
                    fontFamily: 'monospace',
                    opacity: 0.8,
                    marginTop: -2,
                  }}>
                    {prog.current}/{prog.target}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
