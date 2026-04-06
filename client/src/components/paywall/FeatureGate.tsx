// ============================================================================
// FEATURE GATE COMPONENT
// ============================================================================
// File: components/paywall/FeatureGate.tsx
// Wrapper component that gates premium features. Shows children if user has
// access, otherwise shows a contextual upgrade prompt.
//
// Usage:
//   <FeatureGate feature="journal_analysis">
//     <AnalysisPanel />
//   </FeatureGate>
//
//   <FeatureGate feature="journal_entries_per_month" usageKey="journal_entries_per_month">
//     <CreateEntryButton />
//   </FeatureGate>
// ============================================================================

import React, { useCallback } from 'react';
import { useSubscription } from '../../context/SubscriptionContext';
import '../../styles/enhanced-glass.css';

// ============================================================================
// FEATURE DESCRIPTIONS (for upgrade prompts)
// ============================================================================

const FEATURE_INFO: Record<string, { title: string; description: string; icon: string }> = {
  journal_analysis: {
    title: 'Journal AI Analysis',
    description: 'Unlock AI-powered analysis of your journal entries to reveal mood trends, emotional patterns, and growth insights.',
    icon: '📊',
  },
  personal_analysis: {
    title: 'Personal Mirror Report',
    description: 'Get your comprehensive 6-dimension personal analysis with actionable growth recommendations.',
    icon: '🪞',
  },
  create_group: {
    title: 'Create MirrorGroups',
    description: 'Create your own groups for family, partners, friends, or teams with AI-powered group dynamics.',
    icon: '👥',
  },
  group_insights: {
    title: 'Group AI Insights',
    description: 'Generate compatibility matrices, collective strengths, and conflict risk analysis for your groups.',
    icon: '🧠',
  },
  truth_mirror_report: {
    title: 'Truth Mirror Report',
    description: 'Access your comprehensive perception gap analysis and growth trajectory from peer reviews.',
    icon: '🔮',
  },
  receive_reviews: {
    title: 'Receive TruthStream Reviews',
    description: 'Get honest anonymous feedback from the community to discover your blind spots.',
    icon: '💬',
  },
  dina_unlimited: {
    title: 'Unlimited @Dina AI',
    description: 'Remove the daily limit on @Dina AI queries in group chats.',
    icon: '✨',
  },
  data_export: {
    title: 'Data Export',
    description: 'Export your personal data, analysis history, and insights.',
    icon: '📥',
  },
  unlimited_journal: {
    title: 'Unlimited Journaling',
    description: 'Remove the monthly limit on journal entries for continuous self-reflection.',
    icon: '📝',
  },
  unlimited_groups: {
    title: 'Unlimited Groups',
    description: 'Join as many MirrorGroups as you want with no restrictions.',
    icon: '🌐',
  },
  full_intake_rerun: {
    title: 'Re-run Full Intake',
    description: 'Re-take your complete intake assessment to track how you\'ve grown over time.',
    icon: '🔄',
  },
};

const DEFAULT_FEATURE_INFO = {
  title: 'Premium Feature',
  description: 'This feature is available with Mirror Premium.',
  icon: '⭐',
};

// ============================================================================
// TYPES
// ============================================================================

interface FeatureGateProps {
  /** The feature key to check access for */
  feature: string;
  /** Optional usage key for limit-based gating (free tier limits) */
  usageKey?: string;
  /** Custom fallback component instead of default upgrade prompt */
  fallback?: React.ReactNode;
  /** If true, render children but with a visual indicator (e.g., blurred) */
  softGate?: boolean;
  /** If true, show nothing instead of an upgrade prompt when blocked */
  silent?: boolean;
  /** Children to render when user has access */
  children: React.ReactNode;
}

// ============================================================================
// COMPONENT
// ============================================================================

const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  usageKey,
  fallback,
  softGate = false,
  silent = false,
  children,
}) => {
  const { canAccess, isPremium, getFeatureUsage, openUpgradeModal } = useSubscription();

  const handleUpgradeClick = useCallback(() => {
    openUpgradeModal(feature);
  }, [feature, openUpgradeModal]);

  // Check feature access
  const hasFeatureAccess = canAccess(feature);

  // Check usage limits (only for free tier)
  let usageExceeded = false;
  let usageInfo: { used: number; limit: number; remaining: number } | null = null;

  if (usageKey && !isPremium()) {
    usageInfo = getFeatureUsage(usageKey);
    if (usageInfo && usageInfo.remaining <= 0) {
      usageExceeded = true;
    }
  }

  const isBlocked = !hasFeatureAccess || usageExceeded;

  // User has access — render children
  if (!isBlocked) {
    return <>{children}</>;
  }

  // Silent mode — render nothing
  if (silent) {
    return null;
  }

  // Custom fallback
  if (fallback) {
    return <>{fallback}</>;
  }

  // Soft gate — render children with overlay
  if (softGate) {
    return (
      <div className="relative">
        <div className="opacity-40 blur-[2px] pointer-events-none select-none">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            onClick={handleUpgradeClick}
            className="enhanced-glass-card px-6 py-3 text-center cursor-pointer"
            style={{
              transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            }}
          >
            <span className="enhanced-glass-text block text-sm">
              Upgrade to Premium
            </span>
            <span className="enhanced-glass-subtle block text-xs mt-1">
              Unlock this feature
            </span>
          </button>
        </div>
      </div>
    );
  }

  // Default upgrade prompt
  const info = FEATURE_INFO[feature] || DEFAULT_FEATURE_INFO;

  return (
    <div className="enhanced-glass-card p-6 text-center">
      <div className="text-3xl mb-3">{info.icon}</div>
      <h3 className="enhanced-glass-heading text-lg mb-2">{info.title}</h3>
      <p className="enhanced-glass-body text-sm mb-4 max-w-sm mx-auto">
        {info.description}
      </p>

      {usageExceeded && usageInfo && (
        <p className="text-amber-300/80 text-xs mb-3" style={{
          fontFamily: "'Inter', sans-serif",
          textShadow: '0 1px 4px rgba(0, 0, 0, 0.2)',
        }}>
          {usageInfo.used}/{usageInfo.limit} used this {usageKey?.includes('day') ? 'day' : 'month'}
        </p>
      )}

      <button
        onClick={handleUpgradeClick}
        className="enhanced-action-button inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm text-white"
        style={{
          background: 'linear-gradient(135deg, #ff69b4, #ff1493)',
          boxShadow: '0 4px 20px rgba(255, 105, 180, 0.3)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = '0 6px 28px rgba(255, 105, 180, 0.5)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(255, 105, 180, 0.3)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        Upgrade to Premium — $9.99/mo
      </button>

      <p className="enhanced-glass-subtle text-xs mt-3">7-day free trial included</p>
    </div>
  );
};

export default FeatureGate;
